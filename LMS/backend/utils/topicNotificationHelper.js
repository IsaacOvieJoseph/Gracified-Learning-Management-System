const Topic = require('../models/Topic');
const Classroom = require('../models/Classroom');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendEmail } = require('./email');

/**
 * Sends notifications to students and teacher when a topic is activated
 * @param {string} topicId - The ID of the activated topic
 */
const notifyTopicActivated = async (topicId) => {
    try {
        const topic = await Topic.findById(topicId).populate({
            path: 'classroomId',
            populate: [
                { path: 'teacherId', select: 'name email role' },
                { path: 'students', select: 'name email' }
            ]
        });

        if (!topic || !topic.classroomId) {
            console.error('Topic or Classroom not found for notification:', topicId);
            return;
        }

        const classroom = topic.classroomId;
        const teacher = classroom.teacherId;
        const students = classroom.students || [];

        const topicName = topic.name;
        const classroomName = classroom.name;
        const expectedEndDate = topic.expectedEndDate ? new Date(topic.expectedEndDate).toLocaleDateString() : 'TBD';

        // Prepare recipients
        const recipientsMap = new Map(); // Use map to avoid duplicates

        // Add teacher
        if (teacher && teacher.email) {
            recipientsMap.set(teacher._id.toString(), { id: teacher._id, email: teacher.email, name: teacher.name, role: 'teacher' });
        }

        // Add students
        students.forEach(student => {
            if (student.email) {
                recipientsMap.set(student._id.toString(), { id: student._id, email: student.email, name: student.name, role: 'student' });
            }
        });

        // Add school admins if applicable
        if (classroom.schoolId && classroom.schoolId.length > 0) {
            const School = require('../models/School');
            for (const schoolId of classroom.schoolId) {
                const school = await School.findById(schoolId).populate('adminId', 'name email role');
                if (school && school.adminId && school.adminId.email) {
                    recipientsMap.set(school.adminId._id.toString(), {
                        id: school.adminId._id,
                        email: school.adminId.email,
                        name: school.adminId.name,
                        role: 'school_admin'
                    });
                }
            }
        }

        const recipients = Array.from(recipientsMap.values());

        if (recipients.length === 0) return;

        // 1. In-app Notifications
        const inAppNotifications = recipients.map(r => ({
            userId: r.id,
            message: `New topic "${topicName}" is now active in ${classroomName}.`,
            type: 'topic_activated',
            entityId: topic._id,
            entityRef: 'Topic'
        }));
        await Notification.insertMany(inAppNotifications);

        // 2. Email Notifications
        const emailSubject = `New Topic Active: ${topicName} | ${classroomName}`;
        const emailPromises = recipients.map(r => {
            const html = `
                <h2 style="color: #4f46e5;">New Topic Active</h2>
                <p>Hello <strong>${r.name}</strong>,</p>
                <p>A new topic has been started in your class <strong>${classroomName}</strong>.</p>
                <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4f46e5;">
                    <p style="margin: 5px 0;"><strong>Topic:</strong> ${topicName}</p>
                    ${topic.description ? `<p style="margin: 5px 0;"><strong>Description:</strong> ${topic.description}</p>` : ''}
                    <p style="margin: 5px 0;"><strong>Estimated Completion:</strong> ${expectedEndDate} (GMT)</p>
                </div>
                <p>Log in to your dashboard to access the learning materials.</p>
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/classrooms/${classroom._id}" 
                   style="display: inline-block; padding: 12px 24px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 10px;">
                    Go to Classroom
                </a>
            `;

            return sendEmail({
                to: r.email,
                subject: emailSubject,
                html,
                classroomId: classroom._id
            }).catch(err => console.error(`Failed to send topic activation email to ${r.email}:`, err.message));
        });

        await Promise.all(emailPromises);

    } catch (error) {
        console.error('Error in notifyTopicActivated:', error.message);
    }
};

module.exports = {
    notifyTopicActivated
};
