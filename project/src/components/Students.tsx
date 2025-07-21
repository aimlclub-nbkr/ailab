import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Filter, UserPlus, Check, X, Award, Target, RefreshCw, ArrowUpDown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { db, auth } from '../lib/firebase';
import { Student } from '../types';

// Create a secondary Firebase app instance for student creation
const secondaryApp = initializeApp({
  apiKey: "AIzaSyAKgcmV-CWzzCgsYRai1p_52FVvA5C2LhM",
  authDomain: "computer-network-f5a23.firebaseapp.com",
  projectId: "computer-network-f5a23",
  storageBucket: "computer-network-f5a23.firebasestorage.app",
  messagingSenderId: "778971951016",
  appId: "1:778971951016:web:6e89abf42da9c10cf4779d",
  measurementId: "G-ECJ6JL196X"
}, "secondary");

const secondaryAuth = getAuth(secondaryApp);

const Students: React.FC = () => {
  const { userProfile } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [selectedSection, setSelectedSection] = useState('all');
  const [sections, setSections] = useState<string[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [studentStats, setStudentStats] = useState<{[key: string]: {
    submissions: number;
    approvedSubmissions: number;
    vivaAttempts: number;
    totalVivaScore: number;
    averageVivaScore: number;
  }}>({});
  const [formData, setFormData] = useState({
    name: '',
    rollNo: '',
    email: '',
    section: '',
    password: 'cse@nbkr'
  });

  // Function to sort students by roll number
  const sortStudentsByRollNo = (studentsArray: Student[]) => {
    return [...studentsArray].sort((a, b) => {
      // Extract numeric part from roll numbers for proper sorting
      const rollA = a.rollNo || '';
      const rollB = b.rollNo || '';
      
      // Extract numbers from roll numbers
      const numA = rollA.match(/\d+/);
      const numB = rollB.match(/\d+/);
      
      if (numA && numB) {
        const numberA = parseInt(numA[0]);
        const numberB = parseInt(numB[0]);
        
        // If numbers are different, sort by number
        if (numberA !== numberB) {
          return numberA - numberB;
        }
      }
      
      // If numbers are same or not found, sort alphabetically
      return rollA.toLowerCase().localeCompare(rollB.toLowerCase());
    });
  };

  useEffect(() => {
    setupRealtimeListeners();
  }, [userProfile]);

  useEffect(() => {
    filterStudents();
  }, [students, selectedSection]);

  useEffect(() => {
    if (students.length > 0) {
      setupStatsListeners();
    }
  }, [students]);

  const setupRealtimeListeners = () => {
    if (!userProfile) return;

    // Determine which faculty's students to fetch
    const targetFacultyId = userProfile.primaryFacultyId || userProfile.uid;

    // Real-time students listener
    const studentsQuery = query(
      collection(db, 'students'),
      where('facultyId', '==', targetFacultyId)
    );
    
    const unsubscribeStudents = onSnapshot(studentsQuery, (snapshot) => {
      const studentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Student[];

      // Sort students by roll number
      const sortedStudents = sortStudentsByRollNo(studentsData);
      setStudents(sortedStudents);

      // Extract unique sections
      const uniqueSections = Array.from(
        new Set(studentsData.map(student => student.section).filter(Boolean))
      );
      setSections(uniqueSections);
      
      console.log('Real-time update: Students updated');
    });

    // Cleanup function
    return () => {
      unsubscribeStudents();
    };
  };

  const setupStatsListeners = () => {
    // Real-time submissions listener for stats
    const unsubscribeSubmissions = onSnapshot(collection(db, 'submissions'), () => {
      fetchStudentStats();
    });

    // Real-time viva attempts listener for stats
    const unsubscribeVivaAttempts = onSnapshot(collection(db, 'vivaAttempts'), () => {
      fetchStudentStats();
    });

    // Cleanup function
    return () => {
      unsubscribeSubmissions();
      unsubscribeVivaAttempts();
    };
  };

  const fetchStudents = async () => {
    if (!userProfile) return;

    // Determine which faculty's students to fetch
    const targetFacultyId = userProfile.primaryFacultyId || userProfile.uid;

    try {
      const q = query(
        collection(db, 'students'),
        where('facultyId', '==', targetFacultyId)
      );
      const querySnapshot = await getDocs(q);
      const studentsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Student[];

      // Sort students by roll number
      const sortedStudents = sortStudentsByRollNo(studentsData);
      setStudents(sortedStudents);

      // Extract unique sections
      const uniqueSections = Array.from(
        new Set(studentsData.map(student => student.section).filter(Boolean))
      );
      setSections(uniqueSections);
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const handleRefreshStudents = async () => {
    setRefreshing(true);
    await fetchStudents();
    setTimeout(() => setRefreshing(false), 1000);
  };

  const fetchStudentStats = async () => {
    try {
      // Fetch all users to map student UIDs
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const allUsers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Fetch all submissions
      const submissionsSnapshot = await getDocs(collection(db, 'submissions'));
      const allSubmissions = submissionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Fetch all viva attempts
      const vivaAttemptsSnapshot = await getDocs(collection(db, 'vivaAttempts'));
      const allVivaAttempts = vivaAttemptsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Calculate stats for each student
      const stats: {[key: string]: {
        submissions: number;
        approvedSubmissions: number;
        vivaAttempts: number;
        totalVivaScore: number;
        averageVivaScore: number;
      }} = {};
      
      students.forEach(student => {
        // Find the user profile for this student
        const userProfile = allUsers.find(user => 
          user.email === student.email || 
          user.rollNo === student.rollNo ||
          user.uid === student.id
        );

        const studentUid = userProfile?.uid || student.id;

        // Get submissions for this student
        const studentSubmissions = allSubmissions.filter((sub: any) => 
          sub.studentId === studentUid || 
          sub.studentId === student.id ||
          sub.studentId === student.uid
        );

        const approvedSubmissions = studentSubmissions.filter((sub: any) => sub.status === 'approved');

        // Get viva attempts for this student
        const studentVivaAttempts = allVivaAttempts.filter((attempt: any) => 
          attempt.studentId === studentUid || 
          attempt.studentId === student.id ||
          attempt.studentId === student.uid
        );

        // Calculate viva scores
        const totalVivaScore = studentVivaAttempts.reduce((total: number, attempt: any) => 
          total + (attempt.score || 0), 0
        );
        const averageVivaScore = studentVivaAttempts.length > 0 
          ? Math.round((totalVivaScore / studentVivaAttempts.length) * 100) / 100 
          : 0;

        stats[student.id] = {
          submissions: studentSubmissions.length,
          approvedSubmissions: approvedSubmissions.length,
          vivaAttempts: studentVivaAttempts.length,
          totalVivaScore,
          averageVivaScore
        };
      });

      setStudentStats(stats);
    } catch (error) {
      console.error('Error fetching student stats:', error);
    }
  };

  const filterStudents = () => {
    let filtered: Student[];
    if (selectedSection === 'all') {
      filtered = students;
    } else {
      filtered = students.filter(student => student.section === selectedSection);
    }
    
    // Sort filtered students by roll number
    const sortedFiltered = sortStudentsByRollNo(filtered);
    setFilteredStudents(sortedFiltered);
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Use the target faculty ID for creating students
    const targetFacultyId = userProfile!.primaryFacultyId || userProfile!.uid;

    try {
      console.log('Creating student with email:', formData.email, 'and password:', formData.password);
      
      // Create authentication account for student using secondary auth instance
      // This won't affect the current faculty session
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, formData.email, formData.password);
      console.log('Created auth account for student:', formData.email);
      console.log('Student UID:', userCredential.user.uid);
      
      // Add student to students collection
      const studentData: Omit<Student, 'id'> = {
        name: formData.name,
        rollNo: formData.rollNo,
        email: formData.email,
        section: formData.section,
        facultyId: targetFacultyId,
        passwordChanged: false,
        experimentsCompleted: [],
        vivaScores: {},
        addedBy: userProfile!.uid, // Track who added the student
        addedByName: userProfile!.name,
        uid: userCredential.user.uid // Store the Firebase Auth UID
      };

      const studentDocRef = await addDoc(collection(db, 'students'), studentData);
      console.log('Added student to students collection:', studentDocRef.id);
      
      // Create user profile in users collection
      const userProfileData = {
        uid: userCredential.user.uid,
        email: formData.email,
        name: formData.name,
        role: 'student',
        rollNo: formData.rollNo,
        section: formData.section,
        facultyId: targetFacultyId,
        passwordChanged: false,
        addedBy: userProfile!.uid // Track who added the student
      };

      // Use setDoc with the UID as document ID instead of addDoc
      await setDoc(doc(db, 'users', userCredential.user.uid), userProfileData);
      console.log('Created user profile for student');

      // Sign out from secondary auth to ensure no session conflicts
      await signOut(secondaryAuth);
      console.log('Signed out from secondary auth');

      setFormData({ name: '', rollNo: '', email: '', section: '', password: 'cse@nbkr' });
      setShowAddModal(false);
      fetchStudents(); // This will automatically sort the new list
      alert(`Student added successfully! 
      
Login Credentials:
Email: ${formData.email}
Password: ${formData.password}

The student will be required to change their password on first login.`);
    } catch (error: any) {
      console.error('Error adding student:', error);
      alert(`Error adding student: ${error.message}
      
Please check:
1. Email format is correct
2. Email is not already in use
3. Password meets requirements (min 6 characters)`);
    } finally {
      setLoading(false);
    }
  };

  const handleEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;

    setLoading(true);
    try {
      // Update student in students collection
      await updateDoc(doc(db, 'students', editingStudent.id), {
        name: formData.name,
        rollNo: formData.rollNo,
        email: formData.email,
        section: formData.section
      });

      // Find and update corresponding user profile
      const usersQuery = query(
        collection(db, 'users'),
        where('email', '==', editingStudent.email)
      );
      const usersSnapshot = await getDocs(usersQuery);
      
      // Update user profile with new details
      const userUpdatePromises = usersSnapshot.docs.map(userDoc => 
        updateDoc(userDoc.ref, {
          name: formData.name,
          rollNo: formData.rollNo,
          email: formData.email,
          section: formData.section
        })
      );
      await Promise.all(userUpdatePromises);

      // If email changed, also try to find by rollNo
      if (formData.email !== editingStudent.email) {
        const usersQueryByRoll = query(
          collection(db, 'users'),
          where('rollNo', '==', editingStudent.rollNo)
        );
        const usersSnapshotByRoll = await getDocs(usersQueryByRoll);
        
        const userUpdatePromisesByRoll = usersSnapshotByRoll.docs.map(userDoc => 
          updateDoc(userDoc.ref, {
            name: formData.name,
            rollNo: formData.rollNo,
            email: formData.email,
            section: formData.section
          })
        );
        await Promise.all(userUpdatePromisesByRoll);
      }

      // Also find by facultyId and old email combination
      const usersQueryByFaculty = query(
        collection(db, 'users'),
        where('facultyId', '==', userProfile!.uid),
        where('role', '==', 'student')
      );
      const usersSnapshotByFaculty = await getDocs(usersQueryByFaculty);
      
      // Update any user profiles that match the old student data
      const facultyUserUpdatePromises = usersSnapshotByFaculty.docs
        .filter(userDoc => {
          const userData = userDoc.data();
          return userData.email === editingStudent.email || 
                 userData.rollNo === editingStudent.rollNo;
        })
        .map(userDoc => 
          updateDoc(userDoc.ref, {
            name: formData.name,
            rollNo: formData.rollNo,
            email: formData.email,
            section: formData.section
          })
        );
      await Promise.all(facultyUserUpdatePromises);

      console.log('Updated student data in both collections');

      setEditingStudent(null);
      setFormData({ name: '', rollNo: '', email: '', section: '', password: 'cse@nbkr' });
      fetchStudents(); // This will automatically sort the updated list
      alert('Student updated successfully! Changes will be reflected when they next login.');
    } catch (error: any) {
      console.error('Error updating student:', error);
      alert(`Error updating student: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStudent = async (studentId: string) => {
    if (!confirm('Are you sure you want to delete this student? This will also remove their login access.')) return;

    try {
      const studentToDelete = students.find(s => s.id === studentId);
      if (!studentToDelete) return;

      // Delete from students collection
      await deleteDoc(doc(db, 'students', studentId));

      // Find and delete corresponding user profile
      const usersQuery = query(
        collection(db, 'users'),
        where('email', '==', studentToDelete.email)
      );
      const usersSnapshot = await getDocs(usersQuery);
      
      const userDeletePromises = usersSnapshot.docs.map(userDoc => 
        deleteDoc(userDoc.ref)
      );
      await Promise.all(userDeletePromises);

      // Also try to find by rollNo
      const usersQueryByRoll = query(
        collection(db, 'users'),
        where('rollNo', '==', studentToDelete.rollNo)
      );
      const usersSnapshotByRoll = await getDocs(usersQueryByRoll);
      
      const userDeletePromisesByRoll = usersSnapshotByRoll.docs.map(userDoc => 
        deleteDoc(userDoc.ref)
      );
      await Promise.all(userDeletePromisesByRoll);

      fetchStudents(); // This will automatically sort the remaining list
      alert('Student deleted successfully! Their login access has been removed.');
    } catch (error: any) {
      console.error('Error deleting student:', error);
      alert(`Error deleting student: ${error.message}`);
    }
  };

  const openEditModal = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      name: student.name,
      rollNo: student.rollNo,
      email: student.email,
      section: student.section,
      password: 'cse@nbkr'
    });
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingStudent(null);
    setFormData({ name: '', rollNo: '', email: '', section: '', password: 'cse@nbkr' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Students Management</h1>
        <div className="flex space-x-3">
          <button
            onClick={handleRefreshStudents}
            disabled={refreshing}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span>Add Student</span>
          </button>
        </div>
      </div>

      {/* Filter Section */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Filter className="h-5 w-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Filter by Section:</span>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Sections</option>
              {sections.map((section) => (
                <option key={section} value={section}>{section}</option>
              ))}
            </select>
            <span className="text-sm text-gray-600">
              Showing {filteredStudents.length} of {students.length} students
            </span>
          </div>
          
          {/* Sorting Indicator */}
          <div className="flex items-center space-x-2 text-sm text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
            <ArrowUpDown className="h-4 w-4" />
            <span>Sorted by Roll Number</span>
          </div>
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center space-x-2">
                    <span>Student Details</span>
                    <ArrowUpDown className="h-3 w-3 text-blue-500" />
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Section
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Submissions
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Viva Performance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredStudents.map((student) => {
                const stats = studentStats[student.id] || { 
                  submissions: 0, 
                  approvedSubmissions: 0, 
                  vivaAttempts: 0, 
                  totalVivaScore: 0, 
                  averageVivaScore: 0 
                };
                
                return (
                  <tr key={student.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{student.name}</div>
                        <div className="text-sm text-blue-600 font-medium">Roll No: {student.rollNo}</div>
                        <div className="text-sm text-gray-500">{student.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                        {student.section}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-gray-600">Total:</span>
                          <span className="font-semibold text-blue-600">{stats.submissions}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-600">Approved:</span>
                          <span className="font-semibold text-green-600">{stats.approvedSubmissions}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        <div className="flex items-center space-x-2 mb-1">
                          <Target className="h-4 w-4 text-purple-500" />
                          <span className="text-gray-600">Attempts:</span>
                          <span className="font-semibold text-purple-600">{stats.vivaAttempts}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Award className="h-4 w-4 text-yellow-500" />
                          <span className="text-gray-600">Avg Score:</span>
                          <span className="font-semibold text-yellow-600">
                            {stats.averageVivaScore > 0 ? `${stats.averageVivaScore}/10` : 'N/A'}
                          </span>
                        </div>
                        {stats.totalVivaScore > 0 && (
                          <div className="text-xs text-gray-500 mt-1">
                            Total: {stats.totalVivaScore} marks
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        student.passwordChanged 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {student.passwordChanged ? 'Active' : 'Password Not Changed'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => openEditModal(student)}
                          className="text-blue-600 hover:text-blue-900 p-2 rounded-full hover:bg-blue-50"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteStudent(student.id)}
                          className="text-red-600 hover:text-red-900 p-2 rounded-full hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredStudents.length === 0 && (
          <div className="text-center py-12">
            <UserPlus className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No students found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {selectedSection === 'all' 
                ? 'Get started by adding your first student.'
                : `No students found in section ${selectedSection}.`
              }
            </p>
          </div>
        )}
      </div>

      {/* Add/Edit Student Modal */}
      {(showAddModal || editingStudent) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingStudent ? 'Edit Student' : 'Add New Student'}
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={editingStudent ? handleEditStudent : handleAddStudent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter student's full name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Roll Number
                </label>
                <input
                  type="text"
                  required
                  value={formData.rollNo}
                  onChange={(e) => setFormData({ ...formData, rollNo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter roll number (e.g., 21A91A0501)"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Students will be automatically sorted by roll number
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter college email address"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This will be used for student login
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Section
                </label>
                <input
                  type="text"
                  required
                  value={formData.section}
                  onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter section (e.g., CSE-A, CSE-B)"
                />
              </div>

              {!editingStudent && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default Password
                  </label>
                  <input
                    type="text"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Default password for student"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Student will be required to change this password on first login
                  </p>
                </div>
              )}

              {editingStudent && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> Changes will be reflected when the student logs in next time. 
                    If you change the email, the student will need to use the new email to login.
                  </p>
                </div>
              )}

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
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      <span>{editingStudent ? 'Update' : 'Add'} Student</span>
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

export default Students;