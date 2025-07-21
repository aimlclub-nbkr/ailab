import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, BookOpen, ExternalLink, Upload, Check, X, Clock, FileText, Play, CheckCircle, Trophy, Target, Star, Award } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Experiment, StudentSubmission } from '../types';
import VivaTest from './VivaTest';

const Experiments: React.FC = () => {
  const { userProfile } = useAuth();
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [vivaAttempts, setVivaAttempts] = useState<any[]>([]);
  const [studentRecords, setStudentRecords] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingExperiment, setEditingExperiment] = useState<Experiment | null>(null);
  const [showSubmissionModal, setShowSubmissionModal] = useState<Experiment | null>(null);
  const [showVivaTest, setShowVivaTest] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    manualLink: ''
  });
  const [submissionLink, setSubmissionLink] = useState('');

  useEffect(() => {
    fetchExperiments();
    if (userProfile?.role === 'student') {
      setupRealtimeListeners();
    }
    
    // Cleanup function
    return () => {
      // Cleanup will be handled by the listeners themselves
    };
  }, [userProfile]);

  const setupRealtimeListeners = () => {
    if (!userProfile || userProfile.role !== 'student') return;

    // Real-time submissions listener
    const submissionsQuery = query(
      collection(db, 'submissions'),
      where('studentId', '==', userProfile.uid)
    );
    
    const unsubscribeSubmissions = onSnapshot(submissionsQuery, (snapshot) => {
      const submissionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        submittedAt: doc.data().submittedAt?.toDate() || new Date(),
        approvedAt: doc.data().approvedAt?.toDate()
      })) as StudentSubmission[];
      setSubmissions(submissionsData);
      console.log('Real-time update: Submissions updated');
    });

    // Real-time viva attempts listener
    const vivaAttemptsQuery = query(
      collection(db, 'vivaAttempts'),
      where('studentId', '==', userProfile.uid)
    );
    
    const unsubscribeVivaAttempts = onSnapshot(vivaAttemptsQuery, (snapshot) => {
      const vivaAttemptsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        completedAt: doc.data().completedAt?.toDate() || new Date()
      }));
      setVivaAttempts(vivaAttemptsData);
      console.log('Real-time update: Viva attempts updated');
    });

    // Real-time student records listener
    const studentRecordsQuery = query(
      collection(db, 'studentRecords'),
      where('studentId', '==', userProfile.uid)
    );
    
    const unsubscribeStudentRecords = onSnapshot(studentRecordsQuery, (snapshot) => {
      const recordsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        observationCorrectedDate: doc.data().observationCorrectedDate?.toDate(),
        recordSubmittedDate: doc.data().recordSubmittedDate?.toDate()
      }));
      setStudentRecords(recordsData);
      console.log('Real-time update: Student records updated');
    });

    // Store unsubscribe functions for cleanup
    return () => {
      unsubscribeSubmissions();
      unsubscribeVivaAttempts();
      unsubscribeStudentRecords();
    };
  };

  const fetchExperiments = async () => {
    if (!userProfile) return;

    // Determine which faculty's experiments to fetch
    const targetFacultyId = userProfile.primaryFacultyId || userProfile.uid;

    try {
      let q;
      if (userProfile.role === 'faculty') {
        q = query(
          collection(db, 'experiments'),
          where('facultyId', '==', targetFacultyId)
        );
      } else {
        // For students, fetch experiments from their faculty
        q = query(
          collection(db, 'experiments'),
          where('facultyId', '==', userProfile.facultyId)
        );
      }
      
      const querySnapshot = await getDocs(q);
      const experimentsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as Experiment[];

      setExperiments(experimentsData);
    } catch (error) {
      console.error('Error fetching experiments:', error);
    }
  };

  const fetchSubmissions = async () => {
    if (!userProfile || userProfile.role !== 'student') return;

    try {
      const q = query(
        collection(db, 'submissions'),
        where('studentId', '==', userProfile.uid)
      );
      const querySnapshot = await getDocs(q);
      const submissionsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        submittedAt: doc.data().submittedAt?.toDate() || new Date(),
        approvedAt: doc.data().approvedAt?.toDate()
      })) as StudentSubmission[];

      setSubmissions(submissionsData);
    } catch (error) {
      console.error('Error fetching submissions:', error);
    }
  };

  const fetchVivaAttempts = async () => {
    if (!userProfile || userProfile.role !== 'student') return;

    try {
      const q = query(
        collection(db, 'vivaAttempts'),
        where('studentId', '==', userProfile.uid)
      );
      const querySnapshot = await getDocs(q);
      const vivaAttemptsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        completedAt: doc.data().completedAt?.toDate() || new Date()
      }));

      setVivaAttempts(vivaAttemptsData);
    } catch (error) {
      console.error('Error fetching viva attempts:', error);
    }
  };

  const fetchStudentRecords = async () => {
    if (!userProfile || userProfile.role !== 'student') return;

    try {
      const q = query(
        collection(db, 'studentRecords'),
        where('studentId', '==', userProfile.uid)
      );
      const querySnapshot = await getDocs(q);
      const recordsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        observationCorrectedDate: doc.data().observationCorrectedDate?.toDate(),
        recordSubmittedDate: doc.data().recordSubmittedDate?.toDate()
      }));

      setStudentRecords(recordsData);
    } catch (error) {
      console.error('Error fetching student records:', error);
    }
  };

  const handleAddExperiment = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Use the target faculty ID for creating experiments
    const targetFacultyId = userProfile!.primaryFacultyId || userProfile!.uid;

    try {
      await addDoc(collection(db, 'experiments'), {
        title: formData.title,
        description: formData.description,
        manualLink: formData.manualLink,
        facultyId: targetFacultyId,
        createdAt: new Date(),
        createdBy: userProfile!.uid, // Track who actually created the experiment
        createdByName: userProfile!.name
      });

      setFormData({ title: '', description: '', manualLink: '' });
      setShowAddModal(false);
      fetchExperiments();
      alert('Experiment added successfully!');
    } catch (error: any) {
      console.error('Error adding experiment:', error);
      alert(`Error adding experiment: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEditExperiment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExperiment) return;

    setLoading(true);
    try {
      await updateDoc(doc(db, 'experiments', editingExperiment.id), {
        title: formData.title,
        description: formData.description,
        manualLink: formData.manualLink
      });

      setEditingExperiment(null);
      setFormData({ title: '', description: '', manualLink: '' });
      fetchExperiments();
      alert('Experiment updated successfully!');
    } catch (error: any) {
      console.error('Error updating experiment:', error);
      alert(`Error updating experiment: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteExperiment = async (experimentId: string) => {
    if (!confirm('Are you sure you want to delete this experiment?')) return;

    try {
      await deleteDoc(doc(db, 'experiments', experimentId));
      fetchExperiments();
      alert('Experiment deleted successfully!');
    } catch (error: any) {
      console.error('Error deleting experiment:', error);
      alert(`Error deleting experiment: ${error.message}`);
    }
  };

  const handleSubmitExperiment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showSubmissionModal || !submissionLink.trim()) return;

    setLoading(true);
    try {
      await addDoc(collection(db, 'submissions'), {
        studentId: userProfile!.uid,
        experimentId: showSubmissionModal.id,
        submissionLink: submissionLink.trim(),
        status: 'pending',
        submittedAt: new Date()
      });

      setSubmissionLink('');
      setShowSubmissionModal(null);
      fetchSubmissions();
      alert('Submission sent successfully! Wait for faculty approval.');
    } catch (error: any) {
      console.error('Error submitting experiment:', error);
      alert(`Error submitting experiment: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (experiment: Experiment) => {
    setEditingExperiment(experiment);
    setFormData({
      title: experiment.title,
      description: experiment.description,
      manualLink: experiment.manualLink
    });
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingExperiment(null);
    setShowSubmissionModal(null);
    setFormData({ title: '', description: '', manualLink: '' });
    setSubmissionLink('');
  };

  const getSubmissionStatus = (experimentId: string) => {
    return submissions.find(sub => sub.experimentId === experimentId);
  };

  const getVivaAttempt = (experimentId: string) => {
    return vivaAttempts.find(attempt => attempt.experimentId === experimentId);
  };

  const getStudentRecord = (experimentId: string) => {
    return studentRecords.find(record => record.experimentId === experimentId);
  };

  const openManualLink = (link: string) => {
    if (link) {
      window.open(link, '_blank', 'noopener,noreferrer');
    }
  };

  const handleVivaComplete = () => {
    setShowVivaTest(null);
    // Refresh data to show updated scores
    fetchSubmissions();
    fetchVivaAttempts();
  };

  const handleTakeViva = (experimentId: string) => {
    // Only allow taking viva if not already attempted
    const existingAttempt = getVivaAttempt(experimentId);
    if (!existingAttempt) {
      setShowVivaTest(experimentId);
    }
  };

  const getScoreColor = (score: number, total: number) => {
    const percentage = (score / total) * 100;
    if (percentage >= 80) return 'text-green-600 bg-green-50 border-green-200';
    if (percentage >= 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getGradeIcon = (score: number, total: number) => {
    const percentage = (score / total) * 100;
    if (percentage >= 90) return <Trophy className="h-4 w-4" />;
    if (percentage >= 80) return <Award className="h-4 w-4" />;
    if (percentage >= 70) return <Star className="h-4 w-4" />;
    return <Target className="h-4 w-4" />;
  };

  const getPerformanceLabel = (score: number, total: number) => {
    const percentage = (score / total) * 100;
    if (percentage >= 90) return 'Excellent';
    if (percentage >= 80) return 'Very Good';
    if (percentage >= 70) return 'Good';
    if (percentage >= 60) return 'Average';
    return 'Needs Improvement';
  };

  if (showVivaTest) {
    return (
      <VivaTest
        experimentId={showVivaTest}
        onComplete={handleVivaComplete}
        onCancel={() => setShowVivaTest(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">
          {userProfile?.role === 'faculty' ? 'Experiments Management' : 'Experiments'}
        </h1>
        {userProfile?.role === 'faculty' && (
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-purple-700 transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span>Add Experiment</span>
          </button>
        )}
      </div>

      {/* Student Performance Summary */}
      {userProfile?.role === 'student' && experiments.length > 0 && (
        <div className="space-y-6">
          {/* Syllabus Section */}
          <div className="bg-gradient-to-r from-green-50 via-emerald-50 to-teal-50 rounded-xl p-6 border border-emerald-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-emerald-100 p-3 rounded-full">
                  <BookOpen className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Course Syllabus</h2>
                  <p className="text-emerald-700">Access the complete ARTIFICIAL INTELLIGENCE Lab syllabus</p>
                </div>
              </div>
              <button
                onClick={() => window.open('https://drive.google.com/file/d/173qD-30lRbfReGWk06gbAfHsLy2Hsqls/view?usp=sharing', '_blank', 'noopener,noreferrer')}
                className="bg-emerald-600 text-white px-6 py-3 rounded-lg flex items-center space-x-2 hover:bg-emerald-700 transition-colors shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                <BookOpen className="h-5 w-5" />
                <span>View Syllabus</span>
                <ExternalLink className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Performance Summary */}
          <div className="bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center space-x-2">
            <Trophy className="h-6 w-6 text-purple-600" />
            <span>Your Performance Overview</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="text-2xl font-bold text-blue-600">{experiments.length}</div>
              <div className="text-sm text-gray-600">Total Experiments</div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="text-2xl font-bold text-green-600">
                {submissions.filter(s => s.status === 'approved').length}
              </div>
              <div className="text-sm text-gray-600">Approved Submissions</div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="text-2xl font-bold text-purple-600">{vivaAttempts.length}</div>
              <div className="text-sm text-gray-600">Viva Tests Completed</div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="text-2xl font-bold text-yellow-600">
                {vivaAttempts.length > 0 
                  ? Math.round((vivaAttempts.reduce((sum, attempt) => sum + (attempt.score / attempt.totalQuestions), 0) / vivaAttempts.length) * 100)
                  : 0}%
              </div>
              <div className="text-sm text-gray-600">Average Viva Score</div>
            </div>
          </div>
        </div>
        </div>
      )}

      {/* Experiments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {experiments.map((experiment) => {
          const submission = userProfile?.role === 'student' ? getSubmissionStatus(experiment.id) : null;
          const vivaAttempt = userProfile?.role === 'student' ? getVivaAttempt(experiment.id) : null;
          const studentRecord = userProfile?.role === 'student' ? getStudentRecord(experiment.id) : null;
          
          return (
            <div key={experiment.id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <BookOpen className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{experiment.title}</h3>
                      <p className="text-sm text-gray-600">
                        Created {experiment.createdAt.toLocaleDateString()}
                        {experiment.createdByName && experiment.createdBy !== (userProfile?.primaryFacultyId || userProfile?.uid) && (
                          <span className="ml-2 text-blue-600">by {experiment.createdByName}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  
                  {userProfile?.role === 'faculty' && (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => openEditModal(experiment)}
                        className="text-blue-600 hover:text-blue-800 p-1"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteExperiment(experiment.id)}
                        className="text-red-600 hover:text-red-800 p-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                <p className="text-gray-700 mb-4 line-clamp-3">{experiment.description}</p>

                <div className="space-y-3">
                  {/* Manual Link */}
                  <button
                    onClick={() => openManualLink(experiment.manualLink)}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>View Manual</span>
                  </button>

                  {/* Student Actions */}
                  {userProfile?.role === 'student' && (
                    <div className="space-y-3">
                      {/* Submission Status */}
                      {submission ? (
                        <div className={`p-3 rounded-lg border ${
                          submission.status === 'approved' ? 'bg-green-50 border-green-200' :
                          submission.status === 'rejected' ? 'bg-red-50 border-red-200' :
                          'bg-yellow-50 border-yellow-200'
                        }`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              {submission.status === 'approved' ? (
                                <Check className="h-5 w-5 text-green-600" />
                              ) : submission.status === 'rejected' ? (
                                <X className="h-5 w-5 text-red-600" />
                              ) : (
                                <Clock className="h-5 w-5 text-yellow-600" />
                              )}
                              <span className={`text-sm font-medium ${
                                submission.status === 'approved' ? 'text-green-800' :
                                submission.status === 'rejected' ? 'text-red-800' :
                                'text-yellow-800'
                              }`}>
                                Submission {submission.status === 'approved' ? 'Approved' :
                                 submission.status === 'rejected' ? 'Rejected' :
                                 'Pending Review'}
                              </span>
                            </div>
                          </div>
                          
                          {/* Record Status - Only show for approved submissions */}
                          {submission.status === 'approved' && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <div className="grid grid-cols-2 gap-3">
                                {/* Observation Status */}
                                <div className={`p-2 rounded-lg border ${
                                  studentRecord?.observationCorrected 
                                    ? 'bg-green-50 border-green-200' 
                                    : 'bg-yellow-50 border-yellow-200'
                                }`}>
                                  <div className="flex items-center space-x-2">
                                    {studentRecord?.observationCorrected ? (
                                      <CheckCircle className="h-4 w-4 text-green-600" />
                                    ) : (
                                      <Clock className="h-4 w-4 text-yellow-600" />
                                    )}
                                    <div>
                                      <div className={`text-xs font-medium ${
                                        studentRecord?.observationCorrected ? 'text-green-800' : 'text-yellow-800'
                                      }`}>
                                        Observation
                                      </div>
                                      <div className={`text-xs ${
                                        studentRecord?.observationCorrected ? 'text-green-600' : 'text-yellow-600'
                                      }`}>
                                        {studentRecord?.observationCorrected ? 'Corrected' : 'Pending'}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Record Status */}
                                <div className={`p-2 rounded-lg border ${
                                  studentRecord?.recordSubmitted 
                                    ? 'bg-green-50 border-green-200' 
                                    : 'bg-yellow-50 border-yellow-200'
                                }`}>
                                  <div className="flex items-center space-x-2">
                                    {studentRecord?.recordSubmitted ? (
                                      <CheckCircle className="h-4 w-4 text-green-600" />
                                    ) : (
                                      <Clock className="h-4 w-4 text-yellow-600" />
                                    )}
                                    <div>
                                      <div className={`text-xs font-medium ${
                                        studentRecord?.recordSubmitted ? 'text-green-800' : 'text-yellow-800'
                                      }`}>
                                        Record
                                      </div>
                                      <div className={`text-xs ${
                                        studentRecord?.recordSubmitted ? 'text-green-600' : 'text-yellow-600'
                                      }`}>
                                        {studentRecord?.recordSubmitted ? 'Submitted' : 'Pending'}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Viva Score Display - Enhanced */}
                          {submission.status === 'approved' && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              {vivaAttempt ? (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-gray-700">Viva Test Result:</span>
                                    <div className="flex items-center space-x-2">
                                      {getGradeIcon(vivaAttempt.score, vivaAttempt.totalQuestions)}
                                      <span className="text-sm font-medium text-gray-600">
                                        {getPerformanceLabel(vivaAttempt.score, vivaAttempt.totalQuestions)}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  <div className={`p-3 rounded-lg border-2 ${getScoreColor(vivaAttempt.score, vivaAttempt.totalQuestions)}`}>
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center space-x-2">
                                        <Trophy className="h-5 w-5" />
                                        <span className="font-bold text-lg">
                                          {vivaAttempt.score}/{vivaAttempt.totalQuestions}
                                        </span>
                                      </div>
                                      <div className="text-right">
                                        <div className="text-2xl font-bold">
                                          {Math.round((vivaAttempt.score / vivaAttempt.totalQuestions) * 100)}%
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* Progress Bar */}
                                    <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                                      <div 
                                        className={`h-2 rounded-full transition-all duration-500 ${
                                          (vivaAttempt.score / vivaAttempt.totalQuestions) * 100 >= 80 ? 'bg-green-500' :
                                          (vivaAttempt.score / vivaAttempt.totalQuestions) * 100 >= 60 ? 'bg-yellow-500' :
                                          'bg-red-500'
                                        }`}
                                        style={{ width: `${(vivaAttempt.score / vivaAttempt.totalQuestions) * 100}%` }}
                                      ></div>
                                    </div>
                                    
                                    <div className="flex justify-between text-xs">
                                      <span>Completed: {vivaAttempt.completedAt.toLocaleDateString()}</span>
                                      <span>Questions: {vivaAttempt.totalQuestions}</span>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleTakeViva(experiment.id)}
                                  className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                                >
                                  <Play className="h-4 w-4" />
                                  <span>Take Viva Test</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowSubmissionModal(experiment)}
                          className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          <Upload className="h-4 w-4" />
                          <span>Submit Experiment</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {experiments.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border">
          <BookOpen className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No experiments found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {userProfile?.role === 'faculty' 
              ? 'Get started by adding your first experiment.'
              : 'No experiments have been added by your faculty yet.'
            }
          </p>
        </div>
      )}

      {/* Add/Edit Experiment Modal */}
      {(showAddModal || editingExperiment) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingExperiment ? 'Edit Experiment' : 'Add New Experiment'}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={editingExperiment ? handleEditExperiment : handleAddExperiment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Experiment Title
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Enter experiment title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  required
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Enter experiment description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Manual Google Drive Link
                </label>
                <input
                  type="url"
                  required
                  value={formData.manualLink}
                  onChange={(e) => setFormData({ ...formData, manualLink: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="https://drive.google.com/..."
                />
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      <span>{editingExperiment ? 'Update' : 'Add'} Experiment</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Student Submission Modal */}
      {showSubmissionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Submit Experiment: {showSubmissionModal.title}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmitExperiment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Google Drive Link (PDF)
                </label>
                <input
                  type="url"
                  required
                  value={submissionLink}
                  onChange={(e) => setSubmissionLink(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://drive.google.com/..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Upload your experiment execution PDF to Google Drive and share the link here.
                </p>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !submissionLink.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4" />
                      <span>Submit</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Experiments;