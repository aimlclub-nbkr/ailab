import React, { useState, useEffect } from 'react';
import { FileCheck, Eye, CheckCircle, XCircle, Filter, BookOpen, User, Calendar, Clock, Award, AlertCircle, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { collection, getDocs, query, where, doc, updateDoc, addDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Student, Experiment, StudentSubmission } from '../types';

interface StudentRecord {
  studentId: string;
  studentName: string;
  studentRollNo: string;
  studentEmail: string;
  experimentId: string;
  experimentTitle: string;
  submissionStatus: 'approved' | 'rejected' | 'pending';
  submissionDate?: Date;
  approvedDate?: Date;
  observationCorrected: boolean;
  recordSubmitted: boolean;
  observationCorrectedDate?: Date;
  recordSubmittedDate?: Date;
  vivaCompleted: boolean;
  vivaScore?: number;
  vivaDate?: Date;
  submissionLink?: string;
}

const Records: React.FC = () => {
  const { userProfile } = useAuth();
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [selectedExperiment, setSelectedExperiment] = useState<string>('all');
  const [records, setRecords] = useState<StudentRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<StudentRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'record-submitted' | 'not-submitted'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setupRealtimeListeners();
  }, [userProfile]);

  useEffect(() => {
    filterRecords();
  }, [records, selectedExperiment, statusFilter, searchTerm]);

  const setupRealtimeListeners = async () => {
    if (!userProfile) return;

    // Determine which faculty's data to fetch
    const targetFacultyId = userProfile.primaryFacultyId || userProfile.uid;

    try {
      // Fetch static data first
      await fetchStaticData(targetFacultyId);

      // Set up real-time listeners for dynamic data
      setupDynamicListeners(targetFacultyId);
    } catch (error) {
      console.error('Error setting up real-time listeners:', error);
    }
  };

  const setupDynamicListeners = (targetFacultyId: string) => {
    // Real-time submissions listener
    const unsubscribeSubmissions = onSnapshot(collection(db, 'submissions'), () => {
      rebuildRecords(targetFacultyId);
    });

    // Real-time viva attempts listener
    const unsubscribeVivaAttempts = onSnapshot(collection(db, 'vivaAttempts'), () => {
      rebuildRecords(targetFacultyId);
    });

    // Real-time student records listener
    const studentRecordsQuery = query(
      collection(db, 'studentRecords'),
      where('facultyId', '==', targetFacultyId)
    );
    
    const unsubscribeStudentRecords = onSnapshot(studentRecordsQuery, () => {
      rebuildRecords(targetFacultyId);
      console.log('Real-time update: Student records updated');
    });

    // Cleanup function
    return () => {
      unsubscribeSubmissions();
      unsubscribeVivaAttempts();
      unsubscribeStudentRecords();
    };
  };

  const fetchStaticData = async (targetFacultyId: string) => {
    // Fetch experiments
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
  };

  const rebuildRecords = async (targetFacultyId: string) => {
    try {
      // Fetch fresh data for records
      const [studentsSnapshot, usersSnapshot, submissionsSnapshot, vivaAttemptsSnapshot, recordsSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'students'), where('facultyId', '==', targetFacultyId))),
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'submissions')),
        getDocs(collection(db, 'vivaAttempts')),
        getDocs(query(collection(db, 'studentRecords'), where('facultyId', '==', targetFacultyId)))
      ]);

      const studentsData = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Student[];
      const usersData = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const submissionsData = submissionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        submittedAt: doc.data().submittedAt?.toDate(),
        approvedAt: doc.data().approvedAt?.toDate()
      })) as StudentSubmission[];
      const vivaAttemptsData = vivaAttemptsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        completedAt: doc.data().completedAt?.toDate()
      }));
      const existingRecords = recordsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        observationCorrectedDate: doc.data().observationCorrectedDate?.toDate(),
        recordSubmittedDate: doc.data().recordSubmittedDate?.toDate()
      }));

      // Build comprehensive records (same logic as before)
      const studentRecords: StudentRecord[] = [];
      const experimentIds = experiments.map(exp => exp.id);
      const facultySubmissions = submissionsData.filter(sub => experimentIds.includes(sub.experimentId));

      studentsData.forEach(student => {
        experiments.forEach(experiment => {
          const submission = facultySubmissions.find(sub =>
            sub.studentId === student.uid && sub.experimentId === experiment.id
          );

          const userProfile = usersData.find(user =>
            user.uid === student.uid || user.email === student.email
          );

          const studentName = userProfile?.name || student.name;
          const studentRollNo = userProfile?.rollNo || student.rollNo;
          const studentEmail = userProfile?.email || student.email;

          const vivaAttempt = vivaAttemptsData.find(attempt =>
            attempt.studentId === student.uid && attempt.experimentId === experiment.id
          );

          const existingRecord = existingRecords.find(record =>
            record.studentId === student.uid && record.experimentId === experiment.id
          );

          if (submission && submission.status === 'approved') {
            studentRecords.push({
              studentId: student.uid || student.id,
              studentName,
              studentRollNo,
              studentEmail,
              experimentId: experiment.id,
              experimentTitle: experiment.title,
              submissionStatus: submission.status,
              submissionDate: submission.submittedAt,
              approvedDate: submission.approvedAt,
              observationCorrected: existingRecord?.observationCorrected || false,
              recordSubmitted: existingRecord?.recordSubmitted || false,
              observationCorrectedDate: existingRecord?.observationCorrectedDate,
              recordSubmittedDate: existingRecord?.recordSubmittedDate,
              vivaCompleted: !!vivaAttempt,
              vivaScore: vivaAttempt?.score,
              vivaDate: vivaAttempt?.completedAt,
              submissionLink: submission.submissionLink
            });
          }
        });
      });

      setRecords(studentRecords);
    } catch (error) {
      console.error('Error rebuilding records:', error);
    }
  };

  const fetchData = async () => {
    if (!userProfile) return;

    // Determine which faculty's data to fetch
    const targetFacultyId = userProfile.primaryFacultyId || userProfile.uid;

    try {
      // Fetch experiments
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

      // Fetch students
      const studentsQuery = query(
        collection(db, 'students'),
        where('facultyId', '==', targetFacultyId)
      );
      const studentsSnapshot = await getDocs(studentsQuery);
      const studentsData = studentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Student[];

      // Fetch user profiles for student names
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Fetch all submissions
      const submissionsSnapshot = await getDocs(collection(db, 'submissions'));
      const submissionsData = submissionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        submittedAt: doc.data().submittedAt?.toDate(),
        approvedAt: doc.data().approvedAt?.toDate()
      })) as StudentSubmission[];

      // Fetch viva attempts
      const vivaAttemptsSnapshot = await getDocs(collection(db, 'vivaAttempts'));
      const vivaAttemptsData = vivaAttemptsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        completedAt: doc.data().completedAt?.toDate()
      }));

      // Fetch existing records
      const recordsQuery = query(
        collection(db, 'studentRecords'),
        where('facultyId', '==', targetFacultyId)
      );
      const recordsSnapshot = await getDocs(recordsQuery);
      const existingRecords = recordsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        observationCorrectedDate: doc.data().observationCorrectedDate?.toDate(),
        recordSubmittedDate: doc.data().recordSubmittedDate?.toDate()
      }));

      // Build comprehensive records
      const studentRecords: StudentRecord[] = [];
      const experimentIds = experimentsData.map(exp => exp.id);

      // Filter submissions for this faculty's experiments
      const facultySubmissions = submissionsData.filter(sub =>
        experimentIds.includes(sub.experimentId)
      );

      // Create records for each student-experiment combination
      studentsData.forEach(student => {
        experimentsData.forEach(experiment => {
          const submission = facultySubmissions.find(sub =>
            sub.studentId === student.uid && sub.experimentId === experiment.id
          );

          // Find student info from users collection
          const userProfile = usersData.find(user =>
            user.uid === student.uid || user.email === student.email
          );

          const studentName = userProfile?.name || student.name;
          const studentRollNo = userProfile?.rollNo || student.rollNo;
          const studentEmail = userProfile?.email || student.email;

          // Find viva attempt
          const vivaAttempt = vivaAttemptsData.find(attempt =>
            attempt.studentId === student.uid && attempt.experimentId === experiment.id
          );

          // Find existing record
          const existingRecord = existingRecords.find(record =>
            record.studentId === student.uid && record.experimentId === experiment.id
          );

          // Only include students with approved submissions
          if (submission && submission.status === 'approved') {
            studentRecords.push({
              studentId: student.uid || student.id,
              studentName,
              studentRollNo,
              studentEmail,
              experimentId: experiment.id,
              experimentTitle: experiment.title,
              submissionStatus: submission.status,
              submissionDate: submission.submittedAt,
              approvedDate: submission.approvedAt,
              observationCorrected: existingRecord?.observationCorrected || false,
              recordSubmitted: existingRecord?.recordSubmitted || false,
              observationCorrectedDate: existingRecord?.observationCorrectedDate,
              recordSubmittedDate: existingRecord?.recordSubmittedDate,
              vivaCompleted: !!vivaAttempt,
              vivaScore: vivaAttempt?.score,
              vivaDate: vivaAttempt?.completedAt,
              submissionLink: submission.submissionLink
            });
          }
        });
      });

      setRecords(studentRecords);
    } catch (error) {
      console.error('Error fetching records data:', error);
    }
  };

  const filterRecords = () => {
    let filtered = records;

    // Filter by experiment
    if (selectedExperiment !== 'all') {
      filtered = filtered.filter(record => record.experimentId === selectedExperiment);
    }

    // Filter by status
    if (statusFilter === 'record-submitted') {
      filtered = filtered.filter(record => record.recordSubmitted);
    } else if (statusFilter === 'not-submitted') {
      filtered = filtered.filter(record => !record.recordSubmitted);
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(record =>
        record.studentName.toLowerCase().includes(term) ||
        record.studentRollNo.toLowerCase().includes(term) ||
        record.studentEmail.toLowerCase().includes(term) ||
        record.experimentTitle.toLowerCase().includes(term)
      );
    }

    setFilteredRecords(filtered);
  };

  const handleObservationCorrected = async (studentId: string, experimentId: string) => {
    setLoading(true);
    try {
      // Check if record exists
      const recordsQuery = query(
        collection(db, 'studentRecords'),
        where('studentId', '==', studentId),
        where('experimentId', '==', experimentId),
        where('facultyId', '==', userProfile!.primaryFacultyId || userProfile!.uid)
      );
      const recordsSnapshot = await getDocs(recordsQuery);

      if (recordsSnapshot.empty) {
        // Create new record
        await addDoc(collection(db, 'studentRecords'), {
          studentId,
          experimentId,
          facultyId: userProfile!.primaryFacultyId || userProfile!.uid,
          observationCorrected: true,
          recordSubmitted: false,
          observationCorrectedDate: new Date(),
          observationCorrectedBy: userProfile!.uid,
          observationCorrectedByName: userProfile!.name
        });
      } else {
        // Update existing record
        const recordDoc = recordsSnapshot.docs[0];
        await updateDoc(recordDoc.ref, {
          observationCorrected: true,
          observationCorrectedDate: new Date(),
          observationCorrectedBy: userProfile!.uid,
          observationCorrectedByName: userProfile!.name
        });
      }

      fetchData();
      alert('Observation marked as corrected successfully!');
    } catch (error: any) {
      console.error('Error updating observation status:', error);
      alert(`Error updating observation status: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRecordSubmitted = async (studentId: string, experimentId: string) => {
    setLoading(true);
    try {
      // Check if record exists
      const recordsQuery = query(
        collection(db, 'studentRecords'),
        where('studentId', '==', studentId),
        where('experimentId', '==', experimentId),
        where('facultyId', '==', userProfile!.primaryFacultyId || userProfile!.uid)
      );
      const recordsSnapshot = await getDocs(recordsQuery);

      if (recordsSnapshot.empty) {
        // Create new record
        await addDoc(collection(db, 'studentRecords'), {
          studentId,
          experimentId,
          facultyId: userProfile!.primaryFacultyId || userProfile!.uid,
          observationCorrected: true, // Auto-mark as corrected when record is submitted
          recordSubmitted: true,
          observationCorrectedDate: new Date(),
          recordSubmittedDate: new Date(),
          recordSubmittedBy: userProfile!.uid,
          recordSubmittedByName: userProfile!.name
        });
      } else {
        // Update existing record
        const recordDoc = recordsSnapshot.docs[0];
        await updateDoc(recordDoc.ref, {
          recordSubmitted: true,
          recordSubmittedDate: new Date(),
          recordSubmittedBy: userProfile!.uid,
          recordSubmittedByName: userProfile!.name,
          // Also mark observation as corrected if not already
          observationCorrected: true,
          observationCorrectedDate: recordDoc.data().observationCorrectedDate || new Date()
        });
      }

      fetchData();
      alert('Record marked as submitted successfully!');
    } catch (error: any) {
      console.error('Error updating record status:', error);
      alert(`Error updating record status: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const openSubmissionLink = (link: string) => {
    if (link) {
      window.open(link, '_blank', 'noopener,noreferrer');
    }
  };

  const getExperimentStats = (experimentId: string) => {
    const experimentRecords = records.filter(record => record.experimentId === experimentId);
    return {
      total: experimentRecords.length,
      observationCorrected: experimentRecords.filter(record => record.observationCorrected).length,
      recordSubmitted: experimentRecords.filter(record => record.recordSubmitted).length,
      notSubmitted: experimentRecords.filter(record => !record.recordSubmitted).length
    };
  };

  const getOverallStats = () => {
    return {
      total: filteredRecords.length,
      observationCorrected: filteredRecords.filter(record => record.observationCorrected).length,
      recordSubmitted: filteredRecords.filter(record => record.recordSubmitted).length,
      notSubmitted: filteredRecords.filter(record => !record.recordSubmitted).length,
      vivaCompleted: filteredRecords.filter(record => record.vivaCompleted).length
    };
  };

  const stats = getOverallStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Student Records</h1>
        <div className="text-sm text-gray-600">
          Track student progress from submission to final record
        </div>
      </div>

      {/* Experiment Selection */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center space-x-4 mb-4">
          <BookOpen className="h-6 w-6 text-indigo-600" />
          <h2 className="text-lg font-semibold text-gray-900">Select Experiment</h2>
        </div>
        
        {experiments.length > 0 ? (
          <div className="space-y-4">
            {/* All Experiments Option */}
            <button
              onClick={() => setSelectedExperiment('all')}
              className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                selectedExperiment === 'all'
                  ? 'border-indigo-500 bg-indigo-50 shadow-md'
                  : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-25'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900 mb-1">All Experiments</h3>
                  <p className="text-sm text-gray-600">View records from all experiments</p>
                </div>
                <div className="flex items-center space-x-4 text-sm">
                  <div className="text-center">
                    <div className="font-bold text-blue-600">{records.length}</div>
                    <div className="text-gray-500">Total</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-green-600">{records.filter(r => r.recordSubmitted).length}</div>
                    <div className="text-gray-500">Submitted</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-yellow-600">{records.filter(r => !r.recordSubmitted).length}</div>
                    <div className="text-gray-500">Pending</div>
                  </div>
                </div>
              </div>
            </button>
            
            {/* Individual Experiments */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {experiments.map((experiment) => {
                const experimentStats = getExperimentStats(experiment.id);
                return (
                  <button
                    key={experiment.id}
                    onClick={() => setSelectedExperiment(experiment.id)}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      selectedExperiment === experiment.id
                        ? 'border-indigo-500 bg-indigo-50 shadow-md'
                        : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-25'
                    }`}
                  >
                    <h3 className="font-medium text-gray-900 mb-2">{experiment.title}</h3>
                    <p className="text-sm text-gray-600 line-clamp-2 mb-3">{experiment.description}</p>
                    
                    {/* Record Stats */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center justify-between bg-white rounded p-2">
                        <span className="text-gray-600">Total:</span>
                        <span className="font-bold text-blue-600">{experimentStats.total}</span>
                      </div>
                      <div className="flex items-center justify-between bg-white rounded p-2">
                        <span className="text-gray-600">Submitted:</span>
                        <span className="font-bold text-green-600">{experimentStats.recordSubmitted}</span>
                      </div>
                      <div className="flex items-center justify-between bg-white rounded p-2">
                        <span className="text-gray-600">Corrected:</span>
                        <span className="font-bold text-purple-600">{experimentStats.observationCorrected}</span>
                      </div>
                      <div className="flex items-center justify-between bg-white rounded p-2">
                        <span className="text-gray-600">Pending:</span>
                        <span className="font-bold text-yellow-600">{experimentStats.notSubmitted}</span>
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
              Please add experiments first to view student records.
            </p>
          </div>
        )}
      </div>

      {/* Filters and Search */}
      {selectedExperiment && (
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            <div className="flex items-center space-x-4">
              <Filter className="h-5 w-5 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Filter by Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="all">All Records</option>
                <option value="record-submitted">Record Submitted</option>
                <option value="not-submitted">Not Submitted</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div className="text-sm text-gray-600">
                Showing {filteredRecords.length} records
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {selectedExperiment && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Records</p>
                <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <div className="p-3 rounded-full bg-blue-100">
                <FileCheck className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Observation Corrected</p>
                <p className="text-3xl font-bold text-gray-900">{stats.observationCorrected}</p>
              </div>
              <div className="p-3 rounded-full bg-purple-100">
                <Eye className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Record Submitted</p>
                <p className="text-3xl font-bold text-gray-900">{stats.recordSubmitted}</p>
              </div>
              <div className="p-3 rounded-full bg-green-100">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Not Submitted</p>
                <p className="text-3xl font-bold text-gray-900">{stats.notSubmitted}</p>
              </div>
              <div className="p-3 rounded-full bg-yellow-100">
                <AlertCircle className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Viva Completed</p>
                <p className="text-3xl font-bold text-gray-900">{stats.vivaCompleted}</p>
              </div>
              <div className="p-3 rounded-full bg-orange-100">
                <Award className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Records Table */}
      {selectedExperiment && (
        <div className="bg-white rounded-lg shadow-sm border">
          {selectedExperiment !== 'all' && (
            <div className="p-6 border-b bg-gray-50">
              <div className="flex items-center space-x-3">
                <BookOpen className="h-6 w-6 text-indigo-600" />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {experiments.find(exp => exp.id === selectedExperiment)?.title}
                  </h2>
                  <p className="text-sm text-gray-600">
                    Student records for this experiment
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student Details
                  </th>
                  {selectedExperiment === 'all' && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Experiment
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Submission
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Viva Test
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Progress Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRecords.map((record, index) => (
                  <tr key={`${record.studentId}-${record.experimentId}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                            <User className="h-5 w-5 text-indigo-600" />
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{record.studentName}</div>
                          <div className="text-sm text-indigo-600 font-medium">Roll: {record.studentRollNo}</div>
                          <div className="text-sm text-gray-500">{record.studentEmail}</div>
                        </div>
                      </div>
                    </td>
                    
                    {selectedExperiment === 'all' && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{record.experimentTitle}</div>
                      </td>
                    )}
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Approved
                          </span>
                          <button
                            onClick={() => openSubmissionLink(record.submissionLink!)}
                            className="text-blue-600 hover:text-blue-800 text-xs"
                          >
                            View
                          </button>
                        </div>
                        <div className="text-xs text-gray-500">
                          Approved: {record.approvedDate?.toLocaleDateString()}
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      {record.vivaCompleted ? (
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-medium text-green-600">
                              {record.vivaScore}/10
                            </span>
                          </div>
                          <div className="text-xs text-gray-500">
                            {record.vivaDate?.toLocaleDateString()}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <XCircle className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-500">Not attempted</span>
                        </div>
                      )}
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          {record.observationCorrected ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-gray-400" />
                          )}
                          <span className={`text-sm ${record.observationCorrected ? 'text-green-600' : 'text-gray-500'}`}>
                            Observation {record.observationCorrected ? 'Corrected' : 'Pending'}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          {record.recordSubmitted ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-gray-400" />
                          )}
                          <span className={`text-sm ${record.recordSubmitted ? 'text-green-600' : 'text-gray-500'}`}>
                            Record {record.recordSubmitted ? 'Submitted' : 'Pending'}
                          </span>
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        {!record.observationCorrected && (
                          <button
                            onClick={() => handleObservationCorrected(record.studentId, record.experimentId)}
                            disabled={loading}
                            className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Observation Corrected
                          </button>
                        )}
                        {!record.recordSubmitted && (
                          <button
                            onClick={() => handleRecordSubmitted(record.studentId, record.experimentId)}
                            disabled={loading}
                            className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                          >
                            <FileCheck className="h-3 w-3 mr-1" />
                            Record Submitted
                          </button>
                        )}
                        {record.recordSubmitted && (
                          <span className="inline-flex items-center px-3 py-1 text-xs font-medium text-green-800 bg-green-100 rounded-md">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Complete
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredRecords.length === 0 && selectedExperiment && (
            <div className="text-center py-12">
              <FileCheck className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No records found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {selectedExperiment === 'all'
                  ? statusFilter === 'all'
                    ? 'No approved student submissions found yet.'
                    : `No ${statusFilter.replace('-', ' ')} records found.`
                  : statusFilter === 'all'
                    ? 'No approved submissions found for this experiment.'
                    : `No ${statusFilter.replace('-', ' ')} records found for this experiment.`
                }
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Records;