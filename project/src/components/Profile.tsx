import React, { useState, useEffect } from 'react';
import { User, Mail, Hash, BookOpen, Key, Save, Award, Calendar, UserCheck, Plus, Users, Shield, Check, X, Edit, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { updatePassword, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, updateDoc, collection, query, where, getDocs, getDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

const Profile: React.FC = () => {
  const { userProfile, currentUser } = useAuth();
  const [facultyInfo, setFacultyInfo] = useState<{ name: string; email: string } | null>(null);
  const [allFacultyInfo, setAllFacultyInfo] = useState<any[]>([]);
  const [submissionHistory, setSubmissionHistory] = useState<any[]>([]);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [showAddFaculty, setShowAddFaculty] = useState(false);
  const [isDefaultPassword, setIsDefaultPassword] = useState<boolean | null>(null);
  const [facultyList, setFacultyList] = useState<any[]>([]);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [facultyFormData, setFacultyFormData] = useState({
    name: '',
    email: '',
    password: 'cse@nbkr'
  });
  const [loading, setLoading] = useState(false);
  const [facultyLoading, setFacultyLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (userProfile?.role === 'student' && userProfile?.facultyId) {
      fetchAllFacultyInfo();
      fetchSubmissionHistory();
    } else if (userProfile?.role === 'faculty') {
      fetchFacultyList();
    }
    checkPasswordStatus();
  }, [userProfile]);

  const checkPasswordStatus = async () => {
    if (!userProfile || !currentUser) return;

    try {
      // Create a temporary auth instance to test if current password is default
      const tempAuth = auth;
      
      // Try to sign in with the default password
      await signInWithEmailAndPassword(tempAuth, userProfile.email, 'cse@nbkr');
      setIsDefaultPassword(true);
      
      // Re-authenticate with current user to maintain session
      if (currentUser) {
        await currentUser.reload();
      }
    } catch (error) {
      // If sign in fails, it means the password is not the default
      setIsDefaultPassword(false);
    }
  };

  const fetchAllFacultyInfo = async () => {
    if (!userProfile?.facultyId) return;

    try {
      const facultyList = [];
      
      // Get primary faculty info
      const primaryFacultyDoc = await getDoc(doc(db, 'users', userProfile.facultyId));
      if (primaryFacultyDoc.exists()) {
        const primaryFacultyData = primaryFacultyDoc.data();
        facultyList.push({
          ...primaryFacultyData,
          isPrimary: true,
          role: 'Primary Faculty'
        });
      }
      
      // Get all faculty members who have access to this primary faculty's students
      const facultyAccessQuery = query(
        collection(db, 'facultyAccess'),
        where('primaryFacultyId', '==', userProfile.facultyId)
      );
      const facultyAccessSnapshot = await getDocs(facultyAccessQuery);
      
      // Get details of each additional faculty member
      for (const accessDoc of facultyAccessSnapshot.docs) {
        const accessData = accessDoc.data();
        const facultyDoc = await getDoc(doc(db, 'users', accessData.facultyId));
        
        if (facultyDoc.exists()) {
          const facultyData = facultyDoc.data();
          facultyList.push({
            ...facultyData,
            isPrimary: false,
            role: 'Additional Faculty',
            addedDate: accessData.createdAt?.toDate?.() || new Date()
          });
        }
      }
      
      setAllFacultyInfo(facultyList);
      
      // Set primary faculty info for backward compatibility
      const primaryFaculty = facultyList.find(f => f.isPrimary);
      if (primaryFaculty) {
        setFacultyInfo({
          name: primaryFaculty.name,
          email: primaryFaculty.email
        });
      }
    } catch (error) {
      console.error('Error fetching faculty info:', error);
    }
  };

  const fetchSubmissionHistory = async () => {
    if (!userProfile || userProfile.role !== 'student') return;

    try {
      // Get student's submissions
      const submissionsQuery = query(
        collection(db, 'submissions'),
        where('studentId', '==', userProfile.uid)
      );
      const submissionsSnapshot = await getDocs(submissionsQuery);
      
      // Get experiment details and faculty info for each submission
      const submissionDetails = await Promise.all(
        submissionsSnapshot.docs.map(async (submissionDoc) => {
          const submissionData = submissionDoc.data();
          
          // Get experiment details
          const experimentDoc = await getDoc(doc(db, 'experiments', submissionData.experimentId));
          const experimentData = experimentDoc.exists() ? experimentDoc.data() : null;
          
          // Get faculty who approved/rejected (if any)
          let approvedByFaculty = null;
          if (submissionData.status !== 'pending' && submissionData.approvedBy) {
            const facultyDoc = await getDoc(doc(db, 'users', submissionData.approvedBy));
            if (facultyDoc.exists()) {
              approvedByFaculty = facultyDoc.data();
            }
          }
          
          return {
            id: submissionDoc.id,
            ...submissionData,
            submittedAt: submissionData.submittedAt?.toDate?.() || new Date(),
            approvedAt: submissionData.approvedAt?.toDate?.(),
            experiment: experimentData,
            approvedByFaculty
          };
        })
      );
      
      setSubmissionHistory(submissionDetails);
    } catch (error) {
      console.error('Error fetching submission history:', error);
    }
  };

  const fetchFacultyList = async () => {
    if (!userProfile || userProfile.role !== 'faculty') return;

    try {
      // Fetch all faculty members who have access to this faculty's students
      const facultyQuery = query(
        collection(db, 'facultyAccess'),
        where('primaryFacultyId', '==', userProfile.uid)
      );
      const facultySnapshot = await getDocs(facultyQuery);
      
      const facultyAccessList = facultySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Get details of each faculty member
      const facultyDetails = await Promise.all(
        facultyAccessList.map(async (access) => {
          const userDoc = await getDoc(doc(db, 'users', access.facultyId));
          if (userDoc.exists()) {
            return {
              ...access,
              ...userDoc.data(),
              accessId: access.id
            };
          }
          return null;
        })
      );

      setFacultyList(facultyDetails.filter(Boolean));
    } catch (error) {
      console.error('Error fetching faculty list:', error);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    try {
      if (currentUser && userProfile) {
        // Update Firebase Auth password
        await updatePassword(currentUser, passwordData.newPassword);
        
        // Determine if the new password is the default password
        const newIsDefaultPassword = passwordData.newPassword === 'cse@nbkr';
        setIsDefaultPassword(newIsDefaultPassword);
        
        // Update password changed status in users collection
        await updateDoc(doc(db, 'users', currentUser.uid), {
          passwordChanged: !newIsDefaultPassword // true if not default password, false if default
        });

        // If user is a student, also update the students collection
        if (userProfile.role === 'student') {
          console.log('Updating student password status for:', userProfile.email, userProfile.rollNo);
          
          // Find and update student record by email
          const studentsQueryByEmail = query(
            collection(db, 'students'),
            where('email', '==', userProfile.email)
          );
          const studentsSnapshotByEmail = await getDocs(studentsQueryByEmail);
          
          if (!studentsSnapshotByEmail.empty) {
            console.log('Found student by email, updating...');
            const updatePromises = studentsSnapshotByEmail.docs.map(docRef => 
              updateDoc(docRef.ref, { passwordChanged: !newIsDefaultPassword })
            );
            await Promise.all(updatePromises);
          }

          // Also try to find by rollNo
          if (userProfile.rollNo) {
            const studentsQueryByRoll = query(
              collection(db, 'students'),
              where('rollNo', '==', userProfile.rollNo)
            );
            const studentsSnapshotByRoll = await getDocs(studentsQueryByRoll);
            
            if (!studentsSnapshotByRoll.empty) {
              console.log('Found student by rollNo, updating...');
              const updatePromisesByRoll = studentsSnapshotByRoll.docs.map(docRef => 
                updateDoc(docRef.ref, { passwordChanged: !newIsDefaultPassword })
              );
              await Promise.all(updatePromisesByRoll);
            }
          }

          // Also try to find by facultyId if available
          if (userProfile.facultyId) {
            const studentsQueryByFaculty = query(
              collection(db, 'students'),
              where('facultyId', '==', userProfile.facultyId),
              where('email', '==', userProfile.email)
            );
            const studentsSnapshotByFaculty = await getDocs(studentsQueryByFaculty);
            
            if (!studentsSnapshotByFaculty.empty) {
              console.log('Found student by faculty and email, updating...');
              const updatePromisesByFaculty = studentsSnapshotByFaculty.docs.map(docRef => 
                updateDoc(docRef.ref, { passwordChanged: !newIsDefaultPassword })
              );
              await Promise.all(updatePromisesByFaculty);
            }
          }
        }

        if (newIsDefaultPassword) {
          setSuccess('Password updated to default password. Status will show as "Password Not Changed" in faculty view.');
        } else {
          setSuccess('Password updated successfully! Status will show as "Active" in faculty view.');
        }
        
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setShowPasswordChange(false);
        
        console.log('Password change completed successfully');
      }
    } catch (error: any) {
      console.error('Password change error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setFacultyLoading(true);

    try {
      // Create authentication account for new faculty
      const userCredential = await createUserWithEmailAndPassword(auth, facultyFormData.email, facultyFormData.password);
      console.log('Created auth account for faculty:', facultyFormData.email);
      
      // Create user profile in users collection
      const newFacultyProfile = {
        uid: userCredential.user.uid,
        email: facultyFormData.email,
        name: facultyFormData.name,
        role: 'faculty',
        passwordChanged: facultyFormData.password !== 'cse@nbkr'
      };

      await addDoc(collection(db, 'users'), newFacultyProfile);
      console.log('Created user profile for new faculty');

      // Create faculty access record
      await addDoc(collection(db, 'facultyAccess'), {
        primaryFacultyId: userProfile!.uid,
        facultyId: userCredential.user.uid,
        facultyName: facultyFormData.name,
        facultyEmail: facultyFormData.email,
        createdAt: new Date(),
        createdBy: userProfile!.name
      });

      setFacultyFormData({ name: '', email: '', password: 'cse@nbkr' });
      setShowAddFaculty(false);
      fetchFacultyList();
      setSuccess('Faculty member added successfully! They can now login and access your students.');
    } catch (error: any) {
      console.error('Error adding faculty:', error);
      setError(`Error adding faculty: ${error.message}`);
    } finally {
      setFacultyLoading(false);
    }
  };

  const handleRemoveFaculty = async (accessId: string, facultyName: string) => {
    if (!confirm(`Are you sure you want to remove ${facultyName} from faculty access?`)) return;

    try {
      await deleteDoc(doc(db, 'facultyAccess', accessId));
      fetchFacultyList();
      setSuccess(`${facultyName} has been removed from faculty access.`);
    } catch (error: any) {
      console.error('Error removing faculty:', error);
      setError(`Error removing faculty: ${error.message}`);
    }
  };

  // Determine password status based on actual password check
  const getPasswordStatus = () => {
    if (isDefaultPassword === null) {
      return {
        status: 'Checking...',
        color: 'text-gray-600',
        bgColor: 'bg-gray-100',
        icon: 'text-gray-600'
      };
    } else if (isDefaultPassword === false) {
      return {
        status: 'Custom Password',
        color: 'text-green-600',
        bgColor: 'bg-green-100',
        icon: 'text-green-600'
      };
    } else {
      return {
        status: 'Default Password (cse@nbkr)',
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-100',
        icon: 'text-yellow-600'
      };
    }
  };

  if (!userProfile) return null;

  const passwordStatus = getPasswordStatus();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
        <div className="flex space-x-3">
          {userProfile.role === 'faculty' && (
            <button
              onClick={() => setShowAddFaculty(true)}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-purple-700 transition-colors"
            >
              <Plus className="h-5 w-5" />
              <span>Add Faculty</span>
            </button>
          )}
          <button
            onClick={() => setShowPasswordChange(!showPasswordChange)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 transition-colors"
          >
            <Key className="h-5 w-5" />
            <span>Change Password</span>
          </button>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Profile Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Information */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-blue-100 p-3 rounded-full">
              <User className="h-6 w-6 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Basic Information</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
              <User className="h-5 w-5 text-gray-500" />
              <div>
                <label className="text-sm font-medium text-gray-500">Full Name</label>
                <p className="text-lg font-semibold text-gray-900">{userProfile.name}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
              <Mail className="h-5 w-5 text-gray-500" />
              <div>
                <label className="text-sm font-medium text-gray-500">Email Address</label>
                <p className="text-lg font-semibold text-gray-900">{userProfile.email}</p>
              </div>
            </div>

            {userProfile.role === 'student' && (
              <>
                <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
                  <Hash className="h-5 w-5 text-gray-500" />
                  <div>
                    <label className="text-sm font-medium text-gray-500">Roll Number</label>
                    <p className="text-lg font-semibold text-gray-900">{userProfile.rollNo}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
                  <BookOpen className="h-5 w-5 text-gray-500" />
                  <div>
                    <label className="text-sm font-medium text-gray-500">Section</label>
                    <p className="text-lg font-semibold text-gray-900">{userProfile.section}</p>
                  </div>
                </div>

                {/* Faculty Information */}
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center space-x-2 mb-3">
                    <UserCheck className="h-5 w-5 text-blue-600" />
                    <label className="text-sm font-medium text-blue-700">Faculty Members</label>
                  </div>
                  
                  {allFacultyInfo.length > 0 ? (
                    <div className="space-y-2">
                      {allFacultyInfo.map((faculty, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-white rounded border">
                          <div>
                            <p className="font-semibold text-blue-900">{faculty.name}</p>
                            <p className="text-xs text-blue-600">{faculty.email}</p>
                          </div>
                          <div className="text-right">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              faculty.isPrimary 
                                ? 'bg-blue-100 text-blue-800' 
                                : 'bg-purple-100 text-purple-800'
                            }`}>
                              {faculty.role}
                            </span>
                            {!faculty.isPrimary && faculty.addedDate && (
                              <p className="text-xs text-gray-500 mt-1">
                                Added: {faculty.addedDate.toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      <p className="text-sm text-blue-600">Loading faculty information...</p>
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
              <Award className="h-5 w-5 text-gray-500" />
              <div>
                <label className="text-sm font-medium text-gray-500">Role</label>
                <p className="text-lg font-semibold text-gray-900 capitalize">{userProfile.role}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Account Status */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-green-100 p-3 rounded-full">
              <Calendar className="h-6 w-6 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Account Status</h2>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-500">Password Status</label>
                  <p className={`text-lg font-semibold ${passwordStatus.color}`}>
                    {passwordStatus.status}
                  </p>
                  {isDefaultPassword && (
                    <p className="text-xs text-gray-500 mt-1">
                      Using default password. Consider changing for security.
                    </p>
                  )}
                </div>
                <div className={`p-2 rounded-full ${passwordStatus.bgColor}`}>
                  <Key className={`h-5 w-5 ${passwordStatus.icon}`} />
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-500">Account Type</label>
                  <p className="text-lg font-semibold text-gray-900">
                    {userProfile.role === 'faculty' ? 'Faculty Member' : 'Student'}
                  </p>
                </div>
                <div className="p-2 rounded-full bg-blue-100">
                  <User className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </div>

            {userProfile.role === 'student' && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Enrollment Status</label>
                    <p className={`text-lg font-semibold ${isDefaultPassword === false ? 'text-green-600' : 'text-yellow-600'}`}>
                      {isDefaultPassword === false ? 'Active' : 'Password Not Changed'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {isDefaultPassword === false
                        ? 'Account is fully activated' 
                        : 'Please change default password to activate account'
                      }
                    </p>
                  </div>
                  <div className={`p-2 rounded-full ${isDefaultPassword === false ? 'bg-green-100' : 'bg-yellow-100'}`}>
                    <Award className={`h-5 w-5 ${isDefaultPassword === false ? 'text-green-600' : 'text-yellow-600'}`} />
                  </div>
                </div>
              </div>
            )}

            {/* Additional Student Information */}
            {userProfile.role === 'student' && allFacultyInfo.length > 0 && (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-blue-700">Primary Faculty</label>
                    <p className="text-lg font-semibold text-blue-900">
                      {allFacultyInfo.find(f => f.isPrimary)?.name || 'Loading...'}
                    </p>
                    <p className="text-sm text-blue-600">
                      {allFacultyInfo.length > 1 
                        ? `+ ${allFacultyInfo.length - 1} additional faculty member(s)`
                        : 'Primary Faculty Mentor'
                      }
                    </p>
                  </div>
                  <div className="p-2 rounded-full bg-blue-100">
                    <UserCheck className="h-5 w-5 text-blue-600" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Faculty Access Management - Only for Faculty */}
      {userProfile.role === 'faculty' && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-purple-100 p-3 rounded-full">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Faculty Access Management</h2>
          </div>

          <div className="mb-4">
            <p className="text-gray-600">
              Faculty members added here will have full access to your students and can perform all faculty operations.
            </p>
          </div>

          {facultyList.length > 0 ? (
            <div className="space-y-3">
              {facultyList.map((faculty) => (
                <div key={faculty.accessId} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="bg-purple-100 p-2 rounded-full">
                      <User className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{faculty.name}</p>
                      <p className="text-sm text-gray-600">{faculty.email}</p>
                      <p className="text-xs text-gray-500">
                        Added on {faculty.createdAt?.toDate?.()?.toLocaleDateString() || 'Unknown date'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                      Active
                    </span>
                    <button
                      onClick={() => handleRemoveFaculty(faculty.accessId, faculty.name)}
                      className="text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <Users className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No additional faculty members</h3>
              <p className="mt-1 text-sm text-gray-500">
                Add faculty members to give them access to your students.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Password Change Form */}
      {showPasswordChange && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Change Password</h2>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-800 mb-2">Password Guidelines:</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• If you set password to "cse@nbkr", it will be considered as default password</li>
              <li>• Default password status will show as "Password Not Changed" in faculty view</li>
              <li>• Any other password will show as "Active" status in faculty view</li>
              <li>• Password must be at least 6 characters long</li>
            </ul>
          </div>
          
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Password
              </label>
              <input
                type="password"
                required
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter new password (e.g., cse@nbkr for default)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Confirm new password"
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowPasswordChange(false)}
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
                    <span>Updating...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>Update Password</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Faculty Modal */}
      {showAddFaculty && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add Faculty Member</h3>
              <button
                onClick={() => setShowAddFaculty(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
              <div className="flex items-start space-x-3">
                <Shield className="h-5 w-5 text-purple-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-purple-800 mb-1">Faculty Access Permissions</h4>
                  <ul className="text-sm text-purple-700 space-y-1">
                    <li>• Full access to all your students</li>
                    <li>• Can add, edit, and manage students</li>
                    <li>• Can create and manage experiments</li>
                    <li>• Can add viva questions and review submissions</li>
                    <li>• Same privileges as the primary faculty</li>
                  </ul>
                </div>
              </div>
            </div>

            <form onSubmit={handleAddFaculty} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Faculty Name
                </label>
                <input
                  type="text"
                  required
                  value={facultyFormData.name}
                  onChange={(e) => setFacultyFormData({ ...facultyFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Enter faculty full name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={facultyFormData.email}
                  onChange={(e) => setFacultyFormData({ ...facultyFormData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Enter faculty email address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Default Password
                </label>
                <input
                  type="text"
                  value={facultyFormData.password}
                  onChange={(e) => setFacultyFormData({ ...facultyFormData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Default password for faculty"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Faculty can change this password after first login
                </p>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddFaculty(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={facultyLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                >
                  {facultyLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Adding...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Add Faculty</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Submission History - Only for Students */}
      {userProfile.role === 'student' && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-green-100 p-3 rounded-full">
              <Award className="h-6 w-6 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Submission History</h2>
          </div>

          {submissionHistory.length > 0 ? (
            <div className="space-y-4">
              {submissionHistory.map((submission) => (
                <div key={submission.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {submission.experiment?.title || 'Unknown Experiment'}
                      </h3>
                      <p className="text-sm text-gray-600">
                        Submitted: {submission.submittedAt.toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      submission.status === 'approved' ? 'bg-green-100 text-green-800' :
                      submission.status === 'rejected' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {submission.status.charAt(0).toUpperCase() + submission.status.slice(1)}
                    </span>
                  </div>
                  
                  {submission.status !== 'pending' && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex items-center justify-between text-sm">
                        <div>
                          <span className="text-gray-600">
                            {submission.status === 'approved' ? 'Approved by:' : 'Rejected by:'}
                          </span>
                          <span className="ml-2 font-medium text-gray-900">
                            {submission.approvedByFaculty?.name || 'Faculty Member'}
                          </span>
                        </div>
                        {submission.approvedAt && (
                          <span className="text-gray-500">
                            {submission.approvedAt.toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <Award className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No submissions yet</h3>
              <p className="mt-1 text-sm text-gray-500">
                Your experiment submissions will appear here.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Profile;