import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Video, Edit, Plus, Calendar, Users, Book, DollarSign, X, UserPlus } from 'lucide-react';
import Layout from '../components/Layout';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const ClassroomDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [classroom, setClassroom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [showChangeTeacherModal, setShowChangeTeacherModal] = useState(false);
  const [availableStudents, setAvailableStudents] = useState([]);
  const [availableTeachers, setAvailableTeachers] = useState([]);
  const [topicForm, setTopicForm] = useState({ name: '', description: '', order: 0 });
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');

  useEffect(() => {
    fetchClassroom();
  }, [id]);

  useEffect(() => {
    if (classroom) {
      if (['root_admin', 'school_admin', 'personal_teacher'].includes(user?.role)) {
        fetchAvailableStudents();
      }
      if (user?.role === 'root_admin') {
        fetchAvailableTeachers();
      }
    }
  }, [classroom, user]);

  const fetchClassroom = async () => {
    try {
      const response = await api.get(`/classrooms/${id}`);
      setClassroom(response.data.classroom);
    } catch (error) {
      console.error('Error fetching classroom:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async () => {
    try {
      if (classroom.isPaid) {
        // Redirect to payment
        navigate(`/payments?classroomId=${id}`);
      } else {
        await api.post(`/classrooms/${id}/enroll`);
        alert('Enrolled successfully!');
        fetchClassroom();
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Error enrolling');
    }
  };

  const handleCreateTopic = async (e) => {
    e.preventDefault();
    try {
      await api.post('/topics', {
        ...topicForm,
        classroomId: id
      });
      setShowTopicModal(false);
      setTopicForm({ name: '', description: '', order: 0 });
      fetchClassroom();
    } catch (error) {
      alert(error.response?.data?.message || 'Error creating topic');
    }
  };

  const handleStartZoom = async () => {
    try {
      const response = await api.post(`/zoom/create-meeting/${id}`);
      alert(`Zoom Meeting Created!\nMeeting ID: ${response.data.meetingId}\nPassword: ${response.data.password}\n\nJoin URL: ${response.data.joinUrl}`);
    } catch (error) {
      alert(error.response?.data?.message || 'Error creating Zoom meeting');
    }
  };

  const handleOpenWhiteboard = async () => {
    try {
      const response = await api.get(`/whiteboard/${id}`);
      window.open(response.data.whiteboardUrl, '_blank');
    } catch (error) {
      alert(error.response?.data?.message || 'Error opening whiteboard');
    }
  };

  const fetchAvailableStudents = async () => {
    try {
      const response = await api.get('/users');
      // Filter to get only students
      let students = response.data.users.filter(u => u.role === 'student');
      
      // School admin can only add students from their school
      if (user?.role === 'school_admin' && classroom?.schoolId) {
        students = students.filter(s => s.schoolId?.toString() === user?.schoolId?.toString());
      }
      
      // Filter out already enrolled students
      if (classroom) {
        const enrolledIds = classroom.students?.map(s => s._id || s) || [];
        const available = students.filter(s => !enrolledIds.includes(s._id));
        setAvailableStudents(available);
      } else {
        setAvailableStudents(students);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const fetchAvailableTeachers = async () => {
    try {
      const response = await api.get('/users');
      const teachers = response.data.users.filter(u => 
        ['teacher', 'personal_teacher'].includes(u.role)
      );
      setAvailableTeachers(teachers);
    } catch (error) {
      console.error('Error fetching teachers:', error);
    }
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/classrooms/${id}/students`, { studentId: selectedStudentId });
      alert('Student added successfully!');
      setShowAddStudentModal(false);
      setSelectedStudentId('');
      fetchClassroom();
      fetchAvailableStudents();
    } catch (error) {
      alert(error.response?.data?.message || 'Error adding student');
    }
  };

  const handleRemoveStudent = async (studentId) => {
    if (!window.confirm('Are you sure you want to remove this student?')) return;
    
    try {
      await api.delete(`/classrooms/${id}/students/${studentId}`);
      alert('Student removed successfully!');
      fetchClassroom();
      fetchAvailableStudents();
    } catch (error) {
      alert(error.response?.data?.message || 'Error removing student');
    }
  };

  const handleChangeTeacher = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/classrooms/${id}/teacher`, { teacherId: selectedTeacherId });
      alert('Teacher updated successfully!');
      setShowChangeTeacherModal(false);
      setSelectedTeacherId('');
      fetchClassroom();
    } catch (error) {
      alert(error.response?.data?.message || 'Error changing teacher');
    }
  };

  const isEnrolled = classroom?.students?.some(s => s._id === user?._id) ||
    user?.enrolledClasses?.includes(id);
  
  // Unpublished classes can be edited by teacher, personal teacher, school admin, and root admin
  // Published classes can only be edited by their teacher or admins
  const canEdit = 
    user?.role === 'root_admin' ||
    user?.role === 'school_admin' ||
    (user?.role === 'teacher' && classroom?.teacherId?._id === user?._id) ||
    (user?.role === 'personal_teacher' && classroom?.teacherId?._id === user?._id) ||
    (!classroom?.published && ['root_admin', 'school_admin', 'teacher', 'personal_teacher'].includes(user?.role));

  // Can manage students (add/remove)
  const canManageStudents = 
    user?.role === 'root_admin' ||
    (user?.role === 'school_admin' && classroom?.schoolId?.toString() === user?.schoolId?.toString()) ||
    (user?.role === 'personal_teacher' && classroom?.teacherId?._id === user?._id);

  // Can change teacher (root admin only, for non-personal teacher classes)
  const canChangeTeacher = 
    user?.role === 'root_admin' && 
    classroom?.schoolId && 
    classroom?.teacherId?.role !== 'personal_teacher';

  // Can view students (teachers can see their students)
  const canViewStudents = 
    user?.role === 'teacher' && classroom?.teacherId?._id === user?._id ||
    user?.role === 'personal_teacher' && classroom?.teacherId?._id === user?._id ||
    canManageStudents ||
    user?.role === 'root_admin';

  if (loading) {
    return <Layout><div className="text-center py-8">Loading...</div></Layout>;
  }

  if (!classroom) {
    return <Layout><div className="text-center py-8">Classroom not found</div></Layout>;
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-3xl font-bold text-gray-800">{classroom.name}</h2>
              <p className="text-gray-600 mt-2">{classroom.description}</p>
            </div>
            {classroom.isPaid && classroom.pricing?.amount > 0 ? (
              <span className="bg-green-100 text-green-800 px-4 py-2 rounded-full font-semibold">
                ${classroom.pricing?.amount || 0}
              </span>
            ) : (
              <span className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full font-semibold">
                Free
              </span>
            )}
            {!classroom.schoolId && classroom.teacherId?.role === 'personal_teacher' && (
              <span className="bg-purple-100 text-purple-800 px-4 py-2 rounded-full font-semibold ml-2">
                Personal Teacher
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="flex items-center space-x-2 text-gray-600">
              <Calendar className="w-5 h-5" />
              {/* Displaying schedule - iterate over the array */}
              {classroom.schedule && classroom.schedule.length > 0 ? (
                classroom.schedule.map((session, index) => (
                  <span key={index} className="mr-1">
                    {session.dayOfWeek ? session.dayOfWeek.substring(0, 3) : 'N/A'} {session.startTime}-{session.endTime}
                    {index < classroom.schedule.length - 1 ? ',' : ''}
                  </span>
                ))
              ) : (
                <span>No schedule available</span>
              )}
            </div>
            {user?.role !== 'student' && (
              <div className="flex items-center space-x-2 text-gray-600">
                <Users className="w-5 h-5" />
                <span>{classroom.students?.length || 0} students</span>
              </div>
            )}
            <div className="flex items-center space-x-2 text-gray-600">
              <Book className="w-5 h-5" />
              <span>{classroom.topics?.length || 0} topics</span>
            </div>
          </div>

          <div className="flex space-x-3">
            {!isEnrolled && user?.role === 'student' && classroom.published && (
              <button
                onClick={handleEnroll}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
              >
                {classroom.isPaid ? `Enroll - $${classroom.pricing?.amount || 0}` : 'Enroll (Free)'}
              </button>
            )}
            {!isEnrolled && user?.role === 'student' && !classroom.published && (
              <span className="px-6 py-2 bg-gray-300 text-gray-600 rounded-lg font-semibold">
                Not Available for Enrollment
              </span>
            )}
            {(isEnrolled || canEdit) && (
              <>
                <button
                  onClick={handleStartZoom}
                  className="flex items-center space-x-2 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                >
                  <Video className="w-5 h-5" />
                  <span>Start Zoom</span>
                </button>
                <button
                  onClick={handleOpenWhiteboard}
                  className="flex items-center space-x-2 px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
                >
                  <Edit className="w-5 h-5" />
                  <span>Whiteboard</span>
                </button>
              </>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold">Topics</h3>
            {canEdit && (
              <button
                onClick={() => setShowTopicModal(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Add Topic</span>
              </button>
            )}
          </div>

          <div className="space-y-3">
            {classroom.topics && classroom.topics.length > 0 ? (
              classroom.topics.map((topic) => (
                <div key={topic._id} className="border rounded-lg p-4 hover:bg-gray-50 transition">
                  <h4 className="font-semibold text-gray-800">{topic.name}</h4>
                  <p className="text-sm text-gray-600 mt-1">{topic.description}</p>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">No topics added yet</p>
            )}
          </div>
        </div>

        {/* Enrolled Students Section */}
        {canViewStudents && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Enrolled Students ({classroom.students?.length || 0}/{classroom.capacity})</h3>
              {canManageStudents && (
                <button
                  onClick={() => {
                    fetchAvailableStudents();
                    setShowAddStudentModal(true);
                  }}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Add Student</span>
                </button>
              )}
            </div>
            <div className="space-y-2">
              {classroom.students && classroom.students.length > 0 ? (
                classroom.students.map((student) => (
                  <div key={student._id || student} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                    <div>
                      <p className="font-medium text-gray-800">
                        {typeof student === 'object' ? student.name : 'Loading...'}
                      </p>
                      <p className="text-sm text-gray-600">
                        {typeof student === 'object' ? student.email : ''}
                      </p>
                    </div>
                    {canManageStudents && (
                      <button
                        onClick={() => handleRemoveStudent(student._id || student)}
                        className="text-red-600 hover:text-red-800 p-2"
                        title="Remove student"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">No students enrolled yet</p>
              )}
            </div>
          </div>
        )}

        {/* Teacher Management (Root Admin only) */}
        {user?.role === 'root_admin' && classroom?.schoolId && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-xl font-semibold">Class Management</h3>
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Teacher:</span> {classroom.teacherId?.name} ({classroom.teacherId?.email})
                  </p>
                  {classroom.schoolId?.adminId && (
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">School Admin:</span> {classroom.schoolId.adminId.name} ({classroom.schoolId.adminId.email})
                    </p>
                  )}
                </div>
              </div>
              {canChangeTeacher && (
                <button
                  onClick={() => {
                    fetchAvailableTeachers();
                    setShowChangeTeacherModal(true);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Change Teacher
                </button>
              )}
            </div>
          </div>
        )}

        {classroom.assignments && classroom.assignments.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-semibold mb-4">Assignments</h3>
            <div className="space-y-3">
              {classroom.assignments.map((assignment) => (
                <div key={assignment._id} className="border rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800">{assignment.title}</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Due: {new Date(assignment.dueDate).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showTopicModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Add Topic</h3>
            <form onSubmit={handleCreateTopic} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={topicForm.name}
                  onChange={(e) => setTopicForm({ ...topicForm, name: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={topicForm.description}
                  onChange={(e) => setTopicForm({ ...topicForm, description: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  rows="3"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Order</label>
                <input
                  type="number"
                  value={topicForm.order}
                  onChange={(e) => setTopicForm({ ...topicForm, order: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border rounded-lg"
                  min="0"
                />
              </div>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowTopicModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Student Modal */}
      {showAddStudentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Add Student</h3>
            <form onSubmit={handleAddStudent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Student</label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                >
                  <option value="">Select a student</option>
                  {availableStudents.map(student => (
                    <option key={student._id} value={student._id}>
                      {student.name} ({student.email})
                    </option>
                  ))}
                </select>
                {availableStudents.length === 0 && (
                  <p className="text-sm text-gray-500 mt-2">No available students to add</p>
                )}
              </div>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddStudentModal(false);
                    setSelectedStudentId('');
                  }}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedStudentId || availableStudents.length === 0}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  Add Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Teacher Modal */}
      {showChangeTeacherModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Change Teacher</h3>
            <form onSubmit={handleChangeTeacher} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Teacher</label>
                <select
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                >
                  <option value="">Select a teacher</option>
                  {availableTeachers
                    .filter(t => t._id !== classroom?.teacherId?._id)
                    .map(teacher => (
                      <option key={teacher._id} value={teacher._id}>
                        {teacher.name} ({teacher.email}) - {teacher.role.replace('_', ' ')}
                      </option>
                    ))}
                </select>
              </div>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowChangeTeacherModal(false);
                    setSelectedTeacherId('');
                  }}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedTeacherId}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Change Teacher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default ClassroomDetail;

