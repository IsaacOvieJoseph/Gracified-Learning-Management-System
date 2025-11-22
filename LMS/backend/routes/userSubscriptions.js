const express = require('express');
const UserSubscription = require('../models/UserSubscription');
const User = require('../models/User');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const { auth, authorize } = require('../middleware/auth');
const router = express.Router();

// Get current user's subscription
router.get('/me', auth, async (req, res) => {
  try {
    const userSubscription = await UserSubscription.findOne({ userId: req.user._id })
      .populate('planId');

    if (!userSubscription) {
      return res.status(404).json({ message: 'No active subscription found for this user' });
    }
    res.json({ subscription: userSubscription });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all user subscriptions (Admin only)
router.get('/', auth, authorize('root_admin', 'school_admin'), async (req, res) => {
  try {
    let query = {};

    // School admins can only see subscriptions for users within their school
    if (req.user.role === 'school_admin' && req.user.schoolId) {
      const schoolUsers = await User.find({ schoolId: req.user.schoolId }).select('_id');
      const userIds = schoolUsers.map(user => user._id);
      query.userId = { $in: userIds };
    }

    const subscriptions = await UserSubscription.find(query)
      .populate('userId', 'name email role schoolId')
      .populate('planId');

    res.json({ subscriptions });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create/Update user subscription (Admin only for direct creation, or internal for trial activation)
router.post('/', auth, authorize('root_admin', 'school_admin'), async (req, res) => {
  try {
    const { userId, planId, status, startDate, endDate, paymentId, stripeSubscriptionId } = req.body;

    // Ensure userId exists and is valid
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Ensure planId exists and is valid
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({ message: 'Subscription plan not found' });
    }

    // Find and update existing subscription or create new one
    let userSubscription = await UserSubscription.findOneAndUpdate(
      { userId },
      { planId, status, startDate, endDate, paymentId, stripeSubscriptionId },
      { new: true, upsert: true, runValidators: true }
    );

    // Update user's subscription fields
    user.subscriptionPlan = planId;
    user.subscriptionStatus = status;
    user.subscriptionStartDate = startDate;
    user.subscriptionEndDate = endDate;
    await user.save();

    res.status(200).json({ subscription: userSubscription });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update user subscription status (Admin only)
router.patch('/:id/status', auth, authorize('root_admin', 'school_admin'), async (req, res) => {
  try {
    const { status } = req.body;

    const userSubscription = await UserSubscription.findById(req.params.id);
    if (!userSubscription) {
      return res.status(404).json({ message: 'User subscription not found' });
    }

    userSubscription.status = status;
    await userSubscription.save();

    // Update user's main subscription status
    await User.findByIdAndUpdate(userSubscription.userId, { subscriptionStatus: status });

    res.json({ subscription: userSubscription });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
