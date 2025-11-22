const express = require('express');
const nodemailer = require('nodemailer');
const Classroom = require('../models/Classroom');
const Assignment = require('../models/Assignment');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const router = express.Router();

// Email transporter configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Send class reminder
router.post('/class-reminder/:classroomId', auth, async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.classroomId)
      .populate('teacherId', 'name email')
      .populate('students', 'name email');

    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }

    const recipients = [
      { email: classroom.teacherId.email, name: classroom.teacherId.name },
      ...classroom.students.map(student => ({ email: student.email, name: student.name }))
    ];

    const emailPromises = recipients.map(recipient => {
      return transporter.sendMail({
        from: process.env.SMTP_USER,
        to: recipient.email,
        subject: `Class Reminder: ${classroom.name}`,
        html: `
          <h2>Class Reminder</h2>
          <p>Hello ${recipient.name},</p>
          <p>This is a reminder that you have a class scheduled:</p>
          <ul>
            <li><strong>Class:</strong> ${classroom.name}</li>
            <li><strong>Schedule:</strong> ${classroom.schedule}</li>
            <li><strong>Time:</strong> ${new Date().toLocaleString()}</li>
          </ul>
          <p>Please be prepared and join on time.</p>
        `
      });
    });

    await Promise.all(emailPromises);

    res.json({ message: 'Class reminders sent successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Send assignment reminder
router.post('/assignment-reminder/:assignmentId', auth, async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.assignmentId)
      .populate('classroomId', 'name students teacherId');

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    const classroom = assignment.classroomId;
    const recipients = [
      { email: classroom.teacherId.email, name: classroom.teacherId.name },
      ...classroom.students.map(student => ({ email: student.email, name: student.name }))
    ];

    const emailPromises = recipients.map(recipient => {
      return transporter.sendMail({
        from: process.env.SMTP_USER,
        to: recipient.email,
        subject: `Assignment Reminder: ${assignment.title}`,
        html: `
          <h2>Assignment Reminder</h2>
          <p>Hello ${recipient.name},</p>
          <p>This is a reminder about an assignment:</p>
          <ul>
            <li><strong>Assignment:</strong> ${assignment.title}</li>
            <li><strong>Class:</strong> ${classroom.name}</li>
            <li><strong>Due Date:</strong> ${new Date(assignment.dueDate).toLocaleString()}</li>
          </ul>
          <p>Please make sure to submit before the due date.</p>
        `
      });
    });

    await Promise.all(emailPromises);

    res.json({ message: 'Assignment reminders sent successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Send assignment result
router.post('/assignment-result/:assignmentId/:studentId', auth, async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.assignmentId)
      .populate('classroomId', 'name teacherId')
      .populate('submissions.studentId', 'name email');

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    const submission = assignment.submissions.find(
      sub => sub.studentId._id.toString() === req.params.studentId
    );

    if (!submission || submission.status !== 'graded') {
      return res.status(400).json({ message: 'Assignment not graded yet' });
    }

    const student = submission.studentId;
    const teacher = assignment.classroomId.teacherId;

    // Send to student
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: student.email,
      subject: `Assignment Result: ${assignment.title}`,
      html: `
        <h2>Assignment Result</h2>
        <p>Hello ${student.name},</p>
        <p>Your assignment has been graded:</p>
        <ul>
          <li><strong>Assignment:</strong> ${assignment.title}</li>
          <li><strong>Score:</strong> ${submission.score}/${assignment.maxScore}</li>
          <li><strong>Feedback:</strong> ${submission.feedback || 'No feedback provided'}</li>
        </ul>
      `
    });

    // Send to teacher
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: teacher.email,
      subject: `Assignment Graded: ${assignment.title}`,
      html: `
        <h2>Assignment Graded</h2>
        <p>Hello ${teacher.name},</p>
        <p>You have graded an assignment:</p>
        <ul>
          <li><strong>Assignment:</strong> ${assignment.title}</li>
          <li><strong>Student:</strong> ${student.name}</li>
          <li><strong>Score:</strong> ${submission.score}/${assignment.maxScore}</li>
        </ul>
      `
    });

    res.json({ message: 'Assignment results sent successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Send payment notification
router.post('/payment-notification', auth, async (req, res) => {
  try {
    const { userId, type, amount, status } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: user.email,
      subject: `Payment ${status}: ${type}`,
      html: `
        <h2>Payment Notification</h2>
        <p>Hello ${user.name},</p>
        <p>Your payment has been ${status}:</p>
        <ul>
          <li><strong>Type:</strong> ${type}</li>
          <li><strong>Amount:</strong> $${amount}</li>
          <li><strong>Status:</strong> ${status}</li>
        </ul>
      `
    });

    res.json({ message: 'Payment notification sent successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

