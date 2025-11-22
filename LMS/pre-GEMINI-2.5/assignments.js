const express = require('express');
const Assignment = require('../models/Assignment');
const Classroom = require('../models/Classroom');
const Notification = require('../models/Notification'); // Import Notification model
const axios = require('axios'); // Ensure axios is imported here
const { auth, authorize } = require('../middleware/auth');
const router = express.Router();

// Get assignments for a classroom
router.get('/classroom/:classroomId', auth, async (req, res) => {
  try {
    const assignments = await Assignment.find({ classroomId: req.params.classroomId })
      .populate('topicId', 'name')
      .populate({
        path: 'submissions.studentId',
        select: 'name email'
      })
      .sort({ dueDate: 1 });

    res.json({ assignments });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get assignment by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id)
      .populate('classroomId', 'name teacherId')
      .populate('topicId', 'name')
      .populate('submissions.studentId', 'name email');

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    res.json({ assignment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create assignment
router.post('/', auth, authorize('root_admin', 'school_admin', 'teacher', 'personal_teacher'), async (req, res) => {
  try {
    const { title, description, classroomId, topicId, dueDate, maxScore } = req.body;

    const classroom = await Classroom.findById(classroomId);
    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }

    const canCreate = 
      req.user.role === 'root_admin' ||
      (req.user.role === 'school_admin' && classroom.schoolId?.toString() === req.user.schoolId?.toString()) ||
      classroom.teacherId.toString() === req.user._id.toString();

    if (!canCreate) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const assignment = new Assignment({
      title,
      description,
      classroomId,
      topicId,
      dueDate,
      maxScore: maxScore || 100
    });

    await assignment.save();

    // Add assignment to classroom
    classroom.assignments.push(assignment._id);
    await classroom.save();

    // Trigger assignment reminder if dueDate is set
    if (assignment.dueDate) {
      try {
        // Replace with actual backend notification service call
        // Example using internal API call if setup (requires proper base URL)
        await axios.post(`http://localhost:${process.env.PORT || 5000}/api/notifications/assignment-reminder/${assignment._id}`);
      } catch (notificationError) {
        console.error('Error sending assignment reminder notification:', notificationError.message);
      }
    }

    // Create in-app notifications for new assignment
    try {
      // Notification for teacher
      await Notification.create({
        userId: classroom.teacherId,
        message: `New assignment: "${assignment.title}" has been created in "${classroom.name}".`,
        type: 'new_assignment',
        entityId: assignment._id,
        entityRef: 'Assignment',
      });

      // Notifications for students in the classroom
      const studentNotifications = classroom.students.map(studentId => ({
        userId: studentId,
        message: `New assignment: "${assignment.title}" has been posted in "${classroom.name}".`,
        type: 'new_assignment',
        entityId: assignment._id,
        entityRef: 'Assignment',
      }));
      await Notification.insertMany(studentNotifications);
    } catch (inAppNotifError) {
      console.error('Error creating in-app notifications for new assignment:', inAppNotifError.message);
    }

    res.status(201).json({ assignment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update assignment
router.put('/:id', auth, authorize('root_admin', 'school_admin', 'teacher', 'personal_teacher'), async (req, res) => {
  try {
    const { title, description, topicId, dueDate, maxScore } = req.body;

    const assignment = await Assignment.findById(req.params.id);

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    // Basic authorization check (can be expanded)
    const classroom = await Classroom.findById(assignment.classroomId);
    const canEdit = 
      req.user.role === 'root_admin' ||
      (req.user.role === 'school_admin' && classroom.schoolId?.toString() === req.user.schoolId?.toString()) ||
      classroom.teacherId.toString() === req.user._id.toString();

    if (!canEdit) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Update fields
    if (title) assignment.title = title;
    if (description) assignment.description = description;
    if (topicId !== undefined) assignment.topicId = topicId;
    if (dueDate !== undefined) assignment.dueDate = dueDate;
    if (maxScore) assignment.maxScore = maxScore;

    await assignment.save();

    // Trigger assignment reminder if dueDate is set/updated
    if (assignment.dueDate) {
      await axios.post(`http://localhost:${process.env.PORT || 5000}/api/notifications/assignment-reminder/${assignment._id}`); // Assuming `api` is available or import `axios`
    }

    // Create in-app notifications for updated assignment (especially if dueDate changes)
    try {
      // Only send if dueDate actually changed and is set
      const oldDueDate = req.body.oldDueDate; // Assuming frontend sends old dueDate for comparison
      if (assignment.dueDate && (!oldDueDate || new Date(assignment.dueDate).getTime() !== new Date(oldDueDate).getTime())) {
        const message = `Assignment "${assignment.title}" in "${classroom.name}" has been updated. New due date: ${new Date(assignment.dueDate).toLocaleDateString()}.`;

        await Notification.create({
          userId: classroom.teacherId,
          message,
          type: 'assignment_reminder',
          entityId: assignment._id,
          entityRef: 'Assignment',
        });

        const studentNotifications = classroom.students.map(studentId => ({
          userId: studentId,
          message,
          type: 'assignment_reminder',
          entityId: assignment._id,
          entityRef: 'Assignment',
        }));
        await Notification.insertMany(studentNotifications);
      }
    } catch (inAppNotifError) {
      console.error('Error creating in-app notifications for updated assignment:', inAppNotifError.message);
    }

    res.json({ message: 'Assignment updated successfully', assignment });
  } catch (error) {
    res.status(500).json({ message: error.reason || error.message });
  }
});

// Submit assignment (Student)
router.post('/:id/submit', auth, async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id)
      .populate('classroomId', 'students');

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    // Check if student is enrolled
    const isEnrolled = assignment.classroomId.students.some(
      student => student.toString() === req.user._id.toString()
    );

    if (!isEnrolled) {
      return res.status(403).json({ message: 'Not enrolled in this classroom' });
    }

    // Check if already submitted
    const existingSubmission = assignment.submissions.find(
      sub => sub.studentId.toString() === req.user._id.toString()
    );

    if (existingSubmission) {
      return res.status(400).json({ message: 'Already submitted' });
    }

    const { content, files } = req.body;

    assignment.submissions.push({
      studentId: req.user._id,
      content,
      files: files || [],
      status: 'submitted'
    });

    await assignment.save();

    // Create in-app notification for the teacher about new submission
    try {
      // Populate classroom and teacherId to get teacher's ID
      await assignment.populate('classroomId', 'teacherId'); // Ensure teacherId is populated
      const teacherId = assignment.classroomId.teacherId;

      if (teacherId) {
        await Notification.create({
          userId: teacherId,
          message: `Student ${req.user.name} has submitted assignment "${assignment.title}" in "${assignment.classroomId.name}".`,
          type: 'new_submission',
          entityId: assignment._id,
          entityRef: 'Assignment',
        });
      }
    } catch (inAppNotifError) {
      console.error('Error creating in-app notification for new submission:', inAppNotifError.message);
    }

    res.json({ message: 'Assignment submitted successfully', assignment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Grade assignment (Teacher)
router.put('/:id/grade', auth, authorize('root_admin', 'school_admin', 'teacher', 'personal_teacher'), async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id)
      .populate('classroomId');

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    const classroom = assignment.classroomId;
    const canGrade = 
      req.user.role === 'root_admin' ||
      (req.user.role === 'school_admin' && classroom.schoolId?.toString() === req.user.schoolId?.toString()) ||
      classroom.teacherId.toString() === req.user._id.toString();

    if (!canGrade) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { studentId, score, feedback } = req.body;

    const submission = assignment.submissions.find(
      sub => sub.studentId.toString() === studentId
    );

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    submission.score = score;
    submission.feedback = feedback;
    submission.status = 'graded';

    await assignment.save();

    // Trigger assignment result notification
    try {
      await axios.post(`http://localhost:${process.env.PORT || 5000}/api/notifications/assignment-result/${assignment._id}/${studentId}`);
    } catch (notificationError) {
      console.error('Error sending assignment result notification:', notificationError.message);
    }

    // Create in-app notifications for assignment graded
    try {
      // Notification for student
      await Notification.create({
        userId: studentId,
        message: `Your assignment "${assignment.title}" in "${classroom.name}" has been graded. Score: ${score}/${assignment.maxScore}.`,
        type: 'assignment_graded',
        entityId: assignment._id,
        entityRef: 'Assignment',
      });

      // Notification for teacher (who graded it)
      await Notification.create({
        userId: req.user._id, // The user grading is the teacher
        message: `You graded assignment "${assignment.title}" for ${submission.studentId.name}. Score: ${score}/${assignment.maxScore}.`,
        type: 'assignment_graded',
        entityId: assignment._id,
        entityRef: 'Assignment',
      });
    } catch (inAppNotifError) {
      console.error('Error creating in-app notifications for assignment graded:', inAppNotifError.message);
    }

    res.json({ message: 'Assignment graded successfully', assignment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

