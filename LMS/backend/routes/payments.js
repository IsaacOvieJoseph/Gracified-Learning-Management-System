const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Payment = require('../models/Payment');
const Classroom = require('../models/Classroom');
const Topic = require('../models/Topic');
const User = require('../models/User');
const Notification = require('../models/Notification'); // Import Notification model
const axios = require('axios'); // Ensure axios is imported here
const crypto = require('crypto');
const { auth } = require('../middleware/auth');
const router = express.Router();

// Paystack integration
// Initiate a Paystack transaction and return authorization URL
router.post('/paystack/initiate', auth, async (req, res) => {
  try {
    const { amount, classroomId, topicId, type, returnUrl } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ message: 'Invalid amount' });
    const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
    if (!PAYSTACK_SECRET) return res.status(500).json({ message: 'Paystack not configured' });

    // Paystack expects amount in kobo for NGN (or smallest currency unit). Default to NGN and multiply by 100.
    const currency = process.env.PAYSTACK_CURRENCY || 'NGN';
    let payAmount = amount;
    if (currency === 'NGN' || currency === 'ngn') payAmount = Math.round(amount * 100);

    const payload = {
      email: req.user.email,
      amount: payAmount,
      metadata: {
        userId: req.user._id.toString(),
        type: type || 'class_enrollment',
        classroomId: classroomId || null,
        topicId: topicId || null
      },
      // optional return URL
      ...(returnUrl ? { callback_url: returnUrl } : {})
    };

    const resp = await axios.post('https://api.paystack.co/transaction/initialize', payload, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` }
    });

    if (resp.data && resp.data.status) {
      return res.json({ authorization_url: resp.data.data.authorization_url, reference: resp.data.data.reference });
    }
    return res.status(500).json({ message: 'Failed to initialize Paystack transaction' });
  } catch (error) {
    console.error('Paystack initiate error', error.message);
    return res.status(500).json({ message: error.message });
  }
});

// Verify Paystack transaction by reference and process enrollment/payment
router.get('/paystack/verify', auth, async (req, res) => {
  try {
    const { reference } = req.query;
    if (!reference) return res.status(400).json({ message: 'Missing reference' });
    const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
    if (!PAYSTACK_SECRET) return res.status(500).json({ message: 'Paystack not configured' });

    const resp = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` }
    });

    if (!(resp.data && resp.data.data && resp.data.data.status === 'success')) {
      return res.status(400).json({ message: 'Payment not successful', data: resp.data });
    }

    const data = resp.data.data;
    const metadata = data.metadata || {};
    const amountReceived = (data.amount !== undefined) ? data.amount : null; // in kobo if NGN
    const currency = data.currency || process.env.PAYSTACK_CURRENCY || 'NGN';
    let normalizedAmount = amountReceived;
    if (currency === 'NGN' && typeof amountReceived === 'number') normalizedAmount = amountReceived / 100;

    // idempotency: if payment with this reference already exists, return it
    let existing = await Payment.findOne({ paystackReference: reference });
    if (existing) {
      return res.json({ message: 'Payment already processed', payment: existing });
    }

    // create payment record
    const payment = new Payment({
      userId: req.user._id,
      type: metadata.type || 'class_enrollment',
      classroomId: metadata.classroomId || null,
      topicId: metadata.topicId || null,
      amount: normalizedAmount || 0,
      paystackReference: reference,
      status: 'completed'
    });
    await payment.save();

    // handle enrollment if applicable
    if (payment.type === 'class_enrollment' && payment.classroomId) {
      const classroom = await Classroom.findById(payment.classroomId);
      if (classroom && !classroom.students.includes(req.user._id)) {
        classroom.students.push(req.user._id);
        await classroom.save();

        await User.findByIdAndUpdate(req.user._id, { $addToSet: { enrolledClasses: payment.classroomId } });
      }
    }

    // notify
    try {
      await axios.post(`http://localhost:${process.env.PORT || 5000}/api/notifications/payment-notification`, {
        userId: req.user._id,
        type: payment.type,
        amount: payment.amount,
        status: payment.status
      }, { headers: { 'x-internal-api-key': process.env.INTERNAL_API_KEY } });
    } catch (notificationError) {
      console.error('Error sending payment notification:', notificationError.message);
    }

    try {
      await Notification.create({
        userId: req.user._id,
        message: `Your payment of ${payment.amount} ${currency} for ${payment.type.replace('_', ' ')} was successful.`,
        type: 'payment_success',
        entityId: payment._id,
        entityRef: 'Payment',
      });
    } catch (inAppNotifError) {
      console.error('Error creating in-app notification for payment:', inAppNotifError.message);
    }

    return res.json({ message: 'Payment verified and processed', payment });
  } catch (error) {
    console.error('Paystack verify error', error.message);
    return res.status(500).json({ message: error.message });
  }
});

// Paystack webhook - receives raw body and verifies signature
router.post('/paystack/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
    if (!PAYSTACK_SECRET) {
      console.warn('Paystack webhook called but secret not configured');
      return res.status(500).end();
    }

    const signature = req.headers['x-paystack-signature'] || req.headers['X-Paystack-Signature'];
    const hash = crypto.createHmac('sha512', PAYSTACK_SECRET).update(req.body).digest('hex');
    if (!signature || signature !== hash) {
      console.warn('Invalid Paystack webhook signature');
      return res.status(400).end();
    }

    const event = JSON.parse(req.body.toString());
    if (!event) return res.status(400).end();

    // Only process successful charge events
    const evtName = event.event;
    if (evtName !== 'charge.success' && evtName !== 'transaction.success') {
      return res.status(200).json({ status: 'ignored', event: evtName });
    }

    const data = event.data || {};
    const reference = data.reference;
    const metadata = data.metadata || {};

    if (!reference) return res.status(400).end();

    // idempotency: if payment already exists, acknowledge
    const existing = await Payment.findOne({ paystackReference: reference });
    if (existing) {
      return res.status(200).json({ status: 'ok', message: 'Already processed' });
    }

    const amountReceived = (data.amount !== undefined) ? data.amount : null; // in kobo for NGN
    const currency = data.currency || process.env.PAYSTACK_CURRENCY || 'NGN';
    let normalizedAmount = amountReceived;
    if (currency && currency.toUpperCase() === 'NGN' && typeof amountReceived === 'number') normalizedAmount = amountReceived / 100;

    const payment = new Payment({
      userId: metadata.userId || null,
      type: metadata.type || 'class_enrollment',
      classroomId: metadata.classroomId || null,
      topicId: metadata.topicId || null,
      amount: normalizedAmount || 0,
      paystackReference: reference,
      status: 'completed'
    });

    await payment.save();

    // handle enrollment if applicable (requires metadata.userId)
    try {
      if (payment.type === 'class_enrollment' && payment.classroomId && metadata.userId) {
        const userId = metadata.userId;
        const classroom = await Classroom.findById(payment.classroomId);
        if (classroom && !classroom.students.map(String).includes(String(userId))) {
          classroom.students.push(userId);
          await classroom.save();

          await User.findByIdAndUpdate(userId, { $addToSet: { enrolledClasses: payment.classroomId } });
        }
      }
    } catch (enrollErr) {
      console.error('Error enrolling user from Paystack webhook:', enrollErr.message);
    }

    // Send notification (best-effort) if metadata.userId present
    try {
      if (metadata.userId) {
        await axios.post(`http://localhost:${process.env.PORT || 5000}/api/notifications/payment-notification`, {
          userId: metadata.userId,
          type: payment.type,
          amount: payment.amount,
          status: payment.status
        }, { headers: { 'x-internal-api-key': process.env.INTERNAL_API_KEY } });

        await Notification.create({
          userId: metadata.userId,
          message: `Your payment of ${payment.amount} ${currency} for ${payment.type.replace('_', ' ')} was successful.`,
          type: 'payment_success',
          entityId: payment._id,
          entityRef: 'Payment'
        });
      }
    } catch (notifErr) {
      console.error('Paystack webhook notification error:', notifErr.message);
    }

    return res.status(200).json({ status: 'processed' });
  } catch (err) {
    console.error('Paystack webhook error', err);
    return res.status(500).end();
  }
});
// Create payment intent
router.post('/create-intent', auth, async (req, res) => {
  try {
    const { type, classroomId, topicId, amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    // Create Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      metadata: {
        userId: req.user._id.toString(),
        type,
        classroomId: classroomId || '',
        topicId: topicId || ''
      }
    });

    res.json({ 
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Confirm payment and enroll
router.post('/confirm', auth, async (req, res) => {
  try {
    const { paymentIntentId, type, classroomId, topicId, amount } = req.body;

    // Verify payment with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ message: 'Payment not completed' });
    }

    // Create payment record
    const payment = new Payment({
      userId: req.user._id,
      type,
      classroomId: classroomId || null,
      topicId: topicId || null,
      amount,
      stripePaymentId: paymentIntentId,
      status: 'completed'
    });

    await payment.save();

    // Handle enrollment based on type
    if (type === 'class_enrollment' && classroomId) {
      const classroom = await Classroom.findById(classroomId);
      if (classroom && !classroom.students.includes(req.user._id)) {
        classroom.students.push(req.user._id);
        await classroom.save();

        await User.findByIdAndUpdate(req.user._id, {
          $addToSet: { enrolledClasses: classroomId }
        });
      }
    }

    // Trigger payment notification (email)
    try {
      await axios.post(`http://localhost:${process.env.PORT || 5000}/api/notifications/payment-notification`, {
        userId: req.user._id,
        type: payment.type,
        amount: payment.amount,
        status: payment.status
      }, { headers: { 'x-internal-api-key': process.env.INTERNAL_API_KEY } }); // Added headers
    } catch (notificationError) {
      console.error('Error sending payment notification:', notificationError.message);
    }

    // Create in-app notification for successful payment
    try {
      await Notification.create({
        userId: req.user._id,
        message: `Your payment of $${payment.amount} for ${payment.type.replace('_', ' ')} was successful.`,
        type: 'payment_success',
        entityId: payment._id,
        entityRef: 'Payment',
      });
    } catch (inAppNotifError) {
      console.error('Error creating in-app notification for payment:', inAppNotifError.message);
    }

    res.json({ message: 'Payment confirmed and enrollment completed', payment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get payment history
router.get('/history', auth, async (req, res) => {
  try {
    let query = { userId: req.user._id };

    // Root Admin and School Admin can see all payments
    if (req.user.role === 'root_admin' || req.user.role === 'school_admin') {
      query = {};
    }

    const payments = await Payment.find(query)
      .populate('classroomId', 'name')
      .populate('topicId', 'name')
      .populate('userId', 'name email')
      .sort({ paymentDate: -1 });

    res.json({ payments });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get payment by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('classroomId', 'name')
      .populate('topicId', 'name')
      .populate('userId', 'name email');

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    // Check permissions
    if (payment.userId._id.toString() !== req.user._id.toString() && 
        req.user.role !== 'root_admin' && 
        req.user.role !== 'school_admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ payment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

