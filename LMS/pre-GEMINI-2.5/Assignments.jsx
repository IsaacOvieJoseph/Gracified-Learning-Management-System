import React, { useEffect, useState } from 'react';
import { Calendar, FileText, CheckCircle } from 'lucide-react';
import Layout from '../components/Layout';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const Assignments = () => {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAssignments();
  }, []);

  const fetchAssignments = async () => {
    try {
      // Get all classrooms user is enrolled in
      const classroomsRes = await api.get('/classrooms');
      const enrolledClassrooms = classroomsRes.data.classrooms.filter(c =>
        c.students?.some(s => s._id === user?._id) || user?.enrolledClasses?.includes(c._id)
      );

      // Get assignments for each classroom
      const assignmentPromises = enrolledClassrooms.map(c =>
        api.get(`/assignments/classroom/${c._id}`)
      );

      const assignmentResponses = await Promise.all(assignmentPromises);
      const allAssignments = assignmentResponses.flatMap(res => res.data.assignments);

      setAssignments(allAssignments);
    } catch (error) {
      console.error('Error fetching assignments:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Layout><div className="text-center py-8">Loading...</div></Layout>;
  }

  return (
    <Layout>
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">My Assignments</h2>

        <div className="space-y-4">
          {assignments.length > 0 ? (
            assignments.map((assignment) => {
              const submission = assignment.submissions?.find(
                s => s.studentId?._id === user?._id
              );
              const isSubmitted = !!submission;
              const isGraded = submission?.status === 'graded';

              return (
                <div key={assignment._id} className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">{assignment.title}</h3>
                      <p className="text-gray-600 mt-1">{assignment.description}</p>
                    </div>
                    {isGraded && (
                      <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">
                        Graded
                      </span>
                    )}
                    {isSubmitted && !isGraded && (
                      <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-semibold">
                        Submitted
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-4 text-sm text-gray-600 mb-4">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      Due: {new Date(assignment.dueDate).toLocaleDateString()}
                    </div>
                    <div className="flex items-center">
                      <FileText className="w-4 h-4 mr-1" />
                      Max Score: {assignment.maxScore}
                    </div>
                  </div>

                  {isGraded && submission && (
                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <div className="flex items-center space-x-2 mb-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <span className="font-semibold">
                          Score: {submission.score}/{assignment.maxScore}
                        </span>
                      </div>
                      {submission.feedback && (
                        <p className="text-gray-700 mt-2">{submission.feedback}</p>
                      )}
                    </div>
                  )}

                  {!isSubmitted && (
                    <button
                      onClick={() => {
                        const content = prompt('Enter your submission:');
                        if (content) {
                          api.post(`/assignments/${assignment._id}/submit`, { content })
                            .then(() => {
                              alert('Assignment submitted successfully!');
                              fetchAssignments();
                            })
                            .catch(err => alert(err.response?.data?.message || 'Error submitting'));
                        }
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                      Submit Assignment
                    </button>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <p className="text-gray-500">No assignments available</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Assignments;

