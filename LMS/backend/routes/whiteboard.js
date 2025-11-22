const express = require('express');
const Classroom = require('../models/Classroom');
const { auth } = require('../middleware/auth');
const router = express.Router();

// Get or create whiteboard URL
router.get('/:classroomId', auth, async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.classroomId);

    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }

    // Check if user is enrolled or is teacher/admin
    const isEnrolled = classroom.students.some(
      student => student.toString() === req.user._id.toString()
    );
    const isTeacher = classroom.teacherId.toString() === req.user._id.toString();

    if (!isEnrolled && !isTeacher && req.user.role !== 'root_admin' && req.user.role !== 'school_admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Generate or return existing whiteboard URL
    if (!classroom.whiteboardUrl) {
      // In production, integrate with a whiteboard service like Excalidraw, Miro, or custom solution
      const boardId = `board-${classroom._id}-${Date.now()}`;
      classroom.whiteboardUrl = `https://whiteboard.lms.com/${boardId}`;
      await classroom.save();
    }

    res.json({
      whiteboardUrl: classroom.whiteboardUrl,
      classroomId: classroom._id,
      classroomName: classroom.name
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new whiteboard session
router.post('/:classroomId/create', auth, async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.classroomId);

    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }

    // Check permissions
    const canCreate = 
      req.user.role === 'root_admin' ||
      (req.user.role === 'school_admin' && classroom.schoolId?.toString() === req.user.schoolId?.toString()) ||
      classroom.teacherId.toString() === req.user._id.toString();

    if (!canCreate) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Generate new whiteboard URL
    const boardId = `board-${classroom._id}-${Date.now()}`;
    classroom.whiteboardUrl = `https://whiteboard.lms.com/${boardId}`;
    await classroom.save();

    res.json({
      whiteboardUrl: classroom.whiteboardUrl,
      message: 'Whiteboard created successfully'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

