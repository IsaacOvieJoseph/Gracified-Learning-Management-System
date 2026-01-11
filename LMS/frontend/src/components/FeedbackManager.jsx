import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { toast } from 'react-hot-toast';
import { Star, MessageSquare, X, Loader2 } from 'lucide-react';

const FeedbackManager = () => {
    const { user } = useAuth();
    const [feedbackRequests, setFeedbackRequests] = useState([]);
    const [currentRequest, setCurrentRequest] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(false);

    // Form State
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (user) {
            fetchPendingFeedback();
        }
    }, [user]);

    const fetchPendingFeedback = async () => {
        try {
            setLoading(true);
            const res = await api.get('/classrooms/feedback/pending', { skipLoader: true });
            if (res.data.feedbackRequests && res.data.feedbackRequests.length > 0) {
                setFeedbackRequests(res.data.feedbackRequests);
                setCurrentRequest(res.data.feedbackRequests[0]);
                setShowModal(true);
            }
        } catch (error) {
            console.error('Error fetching feedback requests:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRating = (value) => {
        setRating(value);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (rating === 0) {
            toast.error('Please select a rating');
            return;
        }

        setIsSubmitting(true);
        try {
            await api.post('/classrooms/feedback', {
                requestId: currentRequest._id,
                rating,
                comment
            }, { skipLoader: true });

            toast.success('Thank you for your feedback!');

            // Remove completed request and show next if any
            const remaining = feedbackRequests.slice(1);
            setFeedbackRequests(remaining);

            if (remaining.length > 0) {
                setCurrentRequest(remaining[0]);
                setRating(0);
                setComment('');
            } else {
                setShowModal(false);
                setCurrentRequest(null);
            }
        } catch (error) {
            toast.error('Error submitting feedback');
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!showModal || !currentRequest) return null;

    const isPlatform = currentRequest.type === 'platform';
    const headerColorClass = isPlatform ? 'bg-gradient-to-r from-purple-600 to-indigo-600' : 'bg-indigo-600';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[100] backdrop-blur-sm transition-opacity duration-300">
            <div className={`bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all duration-300 scale-100 animate-in fade-in zoom-in-95`}>
                <div className={`${headerColorClass} p-6 text-center relative overflow-hidden`}>
                    {/* Decorative circles */}
                    <div className="absolute top-0 left-0 w-20 h-20 bg-white opacity-10 rounded-full -translate-x-10 -translate-y-10"></div>
                    <div className="absolute bottom-0 right-0 w-16 h-16 bg-white opacity-10 rounded-full translate-x-5 translate-y-5"></div>

                    {isPlatform ? (
                        <div className="flex justify-center mb-3">
                            <div className="bg-white/20 p-3 rounded-full backdrop-blur-sm">
                                <img src="/logo.jpg" alt="Logo" className="w-10 h-10 object-contain rounded-full" onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.innerHTML = '<svg class="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>' }} />
                            </div>
                        </div>
                    ) : (
                        <MessageSquare className="w-12 h-12 text-white mx-auto mb-3" />
                    )}

                    <h3 className="text-2xl font-bold text-white">
                        {isPlatform ? 'We Value Your Feedback' : 'Classroom Ended'}
                    </h3>
                    <p className="text-indigo-100 mt-2 text-sm px-4">
                        {isPlatform
                            ? (currentRequest.title || 'How is your experience with our platform?')
                            : <span>The classroom <span className="font-semibold text-white">{currentRequest.classroomName || currentRequest.classroomId?.name}</span> has ended.</span>
                        }
                    </p>
                </div>

                <div className="p-6">
                    <p className="text-gray-600 text-center mb-6">
                        {isPlatform ? 'Please rate your overall experience so far.' : 'We value your opinion! Please take a moment to rate your learning experience.'}
                    </p>

                    <form onSubmit={handleSubmit}>
                        <div className="flex justify-center space-x-2 mb-6">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type="button"
                                    onClick={() => handleRating(star)}
                                    className={`w-10 h-10 transition-transform hover:scale-110 focus:outline-none ${rating >= star ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
                                        }`}
                                >
                                    <Star className="w-full h-full" />
                                </button>
                            ))}
                        </div>

                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Additional Comments (Optional)
                            </label>
                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                rows="4"
                                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                                placeholder="What did you like? What could be improved?"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-70 flex items-center justify-center"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                    Submitting...
                                </>
                            ) : (
                                'Submit Feedback'
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default FeedbackManager;
