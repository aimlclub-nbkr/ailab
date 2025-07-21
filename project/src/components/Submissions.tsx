import React, { useState, useEffect } from 'react';
import { Check, X, ExternalLink, Eye, FileText, Calendar, User, Clock, BookOpen, Filter } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.tsx';
import { collection, getDocs, query, where, doc, updateDoc, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { StudentSubmission, Student, Experiment } from '../types';

const Submissions: React.FC = () => {
  const { userProfile } = useAuth();
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [userProfiles, setUserProfiles] = useState<any[]>([]);
  const [selectedExperiment, setSelectedExperiment] = useState<string>('all');
  const [filteredSubmissions, setFilteredSubmissions] = useState<StudentSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  useEffect(() => {
    fetchData();
  }, [userProfile]);

  useEffect(() => {
    filterSubmissions();
  }, [submissions, selectedExperiment, filter]);

  const fetchData = async () => {
    if (!userProfile) return;

    // Determine which faculty's data to fetch
    const targetFacultyId = userProfile.primaryFacultyId || userProfile.uid;

    try {
      // Fetch all students enrolled by this faculty
      const studentsQuery = query(
        collection(db, 'students'),
        where('facultyId', '==', targetFacultyId)
      );
      const studentsSnapshot = await getDocs(studentsQuery);
      const studentsData = studentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Student[];
      setStudents(studentsData);

      // Fetch all user profiles to get student names by uid
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUserProfiles(usersData);

      // Fetch experiments created by this faculty
      const experimentsQuery = query(
        collection(db, 'experiments'),
        where('facultyId', '==', targetFacultyId)
      );
      const experimentsSnapshot = await getDocs(experimentsQuery);
      const experimentsData = experimentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as Experiment[];
      setExperiments(experimentsData);

      const experimentIds = experimentsData.map(exp => exp.id);

      // Fetch all submissions
      const submissionsSnapshot = await getDocs(
        query(collection(db, 'submissions'), orderBy('submittedAt', 'desc'))
      );
      const submissionsData = submissionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        submittedAt: doc.data().submittedAt?.toDate() || new Date(),
        approvedAt: doc.data().approvedAt?.toDate()
      })) as StudentSubmission[];

      // Filter submissions to only include those for this faculty's experiments
      const facultySubmissions = submissionsData.filter(sub =>
        experimentIds.includes(sub.experimentId)
      );

      setSubmissions(facultySubmissions);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const filterSubmissions = () => {
    let filtered = submissions;
    
    // Filter by experiment
    if (selectedExperiment !== 'all') {
      filtered = filtered.filter(sub => sub.experimentId === selectedExperiment);
    }
    
    // Filter by status
    if (filter !== 'all') {
      filtered = filtered.filter(sub => sub.status === filter);
    }
    
    setFilteredSubmissions(filtered);
  };

  const handleSubmissionAction = async (submissionId: string, action: 'approve' | 'reject') => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'submissions', submissionId), {
        status: action === 'approve' ? 'approved' : 'rejected',
        approvedAt: action === 'approve' ? new Date() : null,
        approvedBy: userProfile!.uid, // Track which faculty approved/rejected
        approvedByName: userProfile!.name // Store faculty name for easy reference
      });

      fetchData();
      alert(`Submission ${action === 'approve' ? 'approved' : 'rejected'} successfully!`);
    } catch (error: any) {
      console.error(`Error ${action}ing submission:`, error);
      alert(`Error ${action}ing submission: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getStudentInfo = (studentId: string) => {
    // First try to find in user profiles (by uid)
    const userProfile = userProfiles.find(user => user.uid === studentId || user.id === studentId);
    if (userProfile) {
      return {
        name: userProfile.name,
        rollNo: userProfile.rollNo || 'N/A',
        email: userProfile.email
      };
    }

    // Then try to find in students collection
    const student = students.find(s => 
      s.id === studentId || 
      s.uid === studentId || 
      s.userId === studentId
    );
    
    if (student) {
      return {
        name: student.name,
        rollNo: student.rollNo,
        email: student.email
      };
    }

    // If still not found, try to find by matching email in students
    const userByUid = userProfiles.find(user => user.uid === studentId);
    if (userByUid) {
      const studentByEmail = students.find(s => s.email === userByUid.email);
      if (studentByEmail) {
        return {
          name: studentByEmail.name,
          rollNo: studentByEmail.rollNo,
          email: studentByEmail.email
        };
      }
    }

    return {
      name: 'Unknown Student',
      rollNo: 'Unknown',
      email: 'Unknown'
    };
  };

  const getExperimentTitle = (experimentId: string) => {
    const experiment = experiments.find(e => e.id === experimentId);
    return experiment ? experiment.title : 'Unknown Experiment';
  };

  const openSubmissionLink = (link: string) => {
    if (link) {
      window.open(link, '_blank', 'noopener,noreferrer');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <Check className="h-4 w-4" />;
      case 'rejected':
        return <X className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getExperimentSubmissionStats = (experimentId: string) => {
    const experimentSubmissions = submissions.filter(sub => sub.experimentId === experimentId);
    return {
      total: experimentSubmissions.length,
      pending: experimentSubmissions.filter(sub => sub.status === 'pending').length,
      approved: experimentSubmissions.filter(sub => sub.status === 'approved').length,
      rejected: experimentSubmissions.filter(sub => sub.status === 'rejected').length
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Student Submissions</h1>
      </div>

      {/* Experiment Selection */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center space-x-4 mb-4">
          <BookOpen className="h-6 w-6 text-purple-600" />
          <h2 className="text-lg font-semibold text-gray-900">Select Experiment</h2>
        </div>
        
        {experiments.length > 0 ? (
          <div className="space-y-4">
            {/* All Experiments Option */}
            <button
              onClick={() => setSelectedExperiment('all')}
              className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                selectedExperiment === 'all'
                  ? 'border-purple-500 bg-purple-50 shadow-md'
                  : 'border-gray-200 hover:border-purple-300 hover:bg-purple-25'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900 mb-1">All Experiments</h3>
                  <p className="text-sm text-gray-600">View submissions from all experiments</p>
                </div>
                <div className="flex items-center space-x-4 text-sm">
                  <div className="text-center">
                    <div className="font-bold text-blue-600">{submissions.length}</div>
                    <div className="text-gray-500">Total</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-yellow-600">{submissions.filter(s => s.status === 'pending').length}</div>
                    <div className="text-gray-500">Pending</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-green-600">{submissions.filter(s => s.status === 'approved').length}</div>
                    <div className="text-gray-500">Approved</div>
                  </div>
                </div>
              </div>
            </button>
            
            {/* Individual Experiments */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {experiments.map((experiment) => {
                const stats = getExperimentSubmissionStats(experiment.id);
                return (
                  <button
                    key={experiment.id}
                    onClick={() => setSelectedExperiment(experiment.id)}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      selectedExperiment === experiment.id
                        ? 'border-purple-500 bg-purple-50 shadow-md'
                        : 'border-gray-200 hover:border-purple-300 hover:bg-purple-25'
                    }`}
                  >
                    <h3 className="font-medium text-gray-900 mb-2">{experiment.title}</h3>
                    <p className="text-sm text-gray-600 line-clamp-2 mb-3">{experiment.description}</p>
                    
                    {/* Submission Stats */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center justify-between bg-white rounded p-2">
                        <span className="text-gray-600">Total:</span>
                        <span className="font-bold text-blue-600">{stats.total}</span>
                      </div>
                      <div className="flex items-center justify-between bg-white rounded p-2">
                        <span className="text-gray-600">Pending:</span>
                        <span className="font-bold text-yellow-600">{stats.pending}</span>
                      </div>
                      <div className="flex items-center justify-between bg-white rounded p-2">
                        <span className="text-gray-600">Approved:</span>
                        <span className="font-bold text-green-600">{stats.approved}</span>
                      </div>
                      <div className="flex items-center justify-between bg-white rounded p-2">
                        <span className="text-gray-600">Rejected:</span>
                        <span className="font-bold text-red-600">{stats.rejected}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <BookOpen className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No experiments found</h3>
            <p className="mt-1 text-sm text-gray-500">
              Please add experiments first to view submissions.
            </p>
          </div>
        )}
      </div>

      {/* Filter Section */}
      {selectedExperiment && (
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Filter className="h-5 w-5 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Filter by Status:</span>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Submissions</option>
                <option value="pending">Pending Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div className="text-sm text-gray-600">
              {selectedExperiment === 'all' 
                ? `Showing ${filteredSubmissions.length} of ${submissions.length} total submissions`
                : `Showing ${filteredSubmissions.length} submissions for selected experiment`
              }
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      {selectedExperiment && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatsCard 
            title={selectedExperiment === 'all' ? "Total Submissions" : "Experiment Submissions"} 
            count={filteredSubmissions.length} 
            icon={<FileText className="h-6 w-6 text-blue-600" />} 
            bg="bg-blue-100" 
          />
          <StatsCard 
            title="Pending Review" 
            count={filteredSubmissions.filter(s => s.status === 'pending').length} 
            icon={<Clock className="h-6 w-6 text-yellow-600" />} 
            bg="bg-yellow-100" 
          />
          <StatsCard 
            title="Approved" 
            count={filteredSubmissions.filter(s => s.status === 'approved').length} 
            icon={<Check className="h-6 w-6 text-green-600" />} 
            bg="bg-green-100" 
          />
          <StatsCard 
            title="Rejected" 
            count={filteredSubmissions.filter(s => s.status === 'rejected').length} 
            icon={<X className="h-6 w-6 text-red-600" />} 
            bg="bg-red-100" 
          />
        </div>
      )}

      {/* Submission List */}
      {selectedExperiment && (
        <div className="bg-white rounded-lg shadow-sm border">
          {selectedExperiment !== 'all' && (
            <div className="p-6 border-b bg-gray-50">
              <div className="flex items-center space-x-3">
                <BookOpen className="h-6 w-6 text-purple-600" />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {experiments.find(exp => exp.id === selectedExperiment)?.title}
                  </h2>
                  <p className="text-sm text-gray-600">
                    {experiments.find(exp => exp.id === selectedExperiment)?.description}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <div className="divide-y divide-gray-200">
            {filteredSubmissions.map((submission) => {
              const studentInfo = getStudentInfo(submission.studentId);
              
              return (
                <div key={submission.id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4 text-gray-500" />
                          <span className="font-medium text-gray-900">
                            {studentInfo.name}
                          </span>
                        </div>
                        <span className="text-sm text-gray-500">
                          Roll No: {studentInfo.rollNo}
                        </span>
                        <span className="text-xs text-gray-400">
                          {studentInfo.email}
                        </span>
                      </div>

                      {selectedExperiment === 'all' && (
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          {getExperimentTitle(submission.experimentId)}
                        </h3>
                      )}

                      <div className="flex items-center space-x-4 text-sm text-gray-500 mb-3">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4" />
                          <span>Submitted: {submission.submittedAt.toLocaleDateString()}</span>
                        </div>
                        {submission.approvedAt && (
                          <div className="flex items-center space-x-1">
                            <Check className="h-4 w-4" />
                            <span>Approved: {submission.approvedAt.toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-3">
                        <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(submission.status)}`}>
                          {getStatusIcon(submission.status)}
                          <span className="capitalize">{submission.status}</span>
                        </span>
                        <button
                          onClick={() => openSubmissionLink(submission.submissionLink)}
                          className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          <Eye className="h-4 w-4" />
                          <span>View Submission</span>
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    {submission.status === 'pending' && (
                      <div className="flex space-x-2 ml-4">
                        <button
                          onClick={() => handleSubmissionAction(submission.id, 'approve')}
                          disabled={loading}
                          className="inline-flex items-center space-x-1 px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Check className="h-4 w-4" />
                          <span>Approve</span>
                        </button>
                        <button
                          onClick={() => handleSubmissionAction(submission.id, 'reject')}
                          disabled={loading}
                          className="inline-flex items-center space-x-1 px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <X className="h-4 w-4" />
                          <span>Reject</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredSubmissions.length === 0 && selectedExperiment && (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No submissions found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {selectedExperiment === 'all'
                  ? filter === 'all'
                    ? 'No student submissions have been received yet.'
                    : `No ${filter} submissions found.`
                  : filter === 'all'
                    ? 'No submissions found for this experiment.'
                    : `No ${filter} submissions found for this experiment.`
                }
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Reusable StatsCard Component
const StatsCard = ({ title, count, icon, bg }: { title: string; count: number; icon: React.ReactNode; bg: string }) => (
  <div className="bg-white rounded-xl shadow-sm border p-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <p className="text-3xl font-bold text-gray-900">{count}</p>
      </div>
      <div className={`p-3 rounded-full ${bg}`}>{icon}</div>
    </div>
  </div>
);

export default Submissions;