import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User as FirebaseUser, 
  onAuthStateChanged, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { User } from '../types';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: User | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string, role: 'faculty' | 'student') => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signup = async (email: string, password: string, name: string, role: 'faculty' | 'student') => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    const userProfile: User = {
      uid: user.uid,
      email: user.email!,
      name,
      role,
      passwordChanged: role === 'faculty'
    };

    await setDoc(doc(db, 'users', user.uid), userProfile);
  };

  const logout = async () => {
    await signOut(auth);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        try {
          console.log('User authenticated:', user.email, 'UID:', user.uid);
          
          // First check users collection
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data() as User;
            console.log('Found user document:', userData);
            
            // If this is a student, sync with latest student data
            if (userData.role === 'student') {
              console.log('Student login detected, syncing data for:', userData.email);
              const studentsQuery = query(
                collection(db, 'students'),
                where('email', '==', userData.email)
              );
              const studentsSnapshot = await getDocs(studentsQuery);
              
              if (!studentsSnapshot.empty) {
                const latestStudentData = studentsSnapshot.docs[0].data();
                console.log('Found student data:', latestStudentData);
                
                // Update user profile with latest student data
                const updatedUserProfile: User = {
                  ...userData,
                  name: latestStudentData.name,
                  rollNo: latestStudentData.rollNo,
                  section: latestStudentData.section,
                  facultyId: latestStudentData.facultyId,
                  passwordChanged: latestStudentData.passwordChanged || userData.passwordChanged
                };
                
                // Update the users collection with latest data
                await setDoc(doc(db, 'users', user.uid), updatedUserProfile);
                console.log('Updated user profile:', updatedUserProfile);
                setUserProfile(updatedUserProfile);
              } else {
                console.log('No student data found for email:', userData.email);
                setUserProfile(userData);
              }
            } else {
              console.log('Faculty login detected');
              setUserProfile(userData);
            }
          } else {
            console.log('No user document found, checking if student by email:', user.email);
            // If not found in users, check if it's a student by email
            const email = user.email;
            if (email) {
              // Check if this user has faculty access
              const facultyAccessQuery = query(
                collection(db, 'facultyAccess'),
                where('facultyId', '==', user.uid)
              );
              const facultyAccessSnapshot = await getDocs(facultyAccessQuery);
              
              if (!facultyAccessSnapshot.empty) {
                console.log('Found faculty access for user');
                // This is a faculty member with access to another faculty's students
                const accessData = facultyAccessSnapshot.docs[0].data();
                const facultyProfile: User = {
                  uid: user.uid,
                  email: email,
                  name: accessData.facultyName,
                  role: 'faculty',
                  passwordChanged: true,
                  primaryFacultyId: accessData.primaryFacultyId // Store reference to primary faculty
                };
                
                // Create user profile in users collection
                await setDoc(doc(db, 'users', user.uid), facultyProfile);
                setUserProfile(facultyProfile);
                console.log('Created faculty profile:', facultyProfile);
              }
              
              console.log('Searching for student by email:', email);
              // Find student by email
              const studentsQuery = query(
                collection(db, 'students'),
                where('email', '==', email)
              );
              const studentsSnapshot = await getDocs(studentsQuery);
              
              if (!studentsSnapshot.empty) {
                const studentData = studentsSnapshot.docs[0].data();
                console.log('Found student by email search:', studentData);
                const studentProfile: User = {
                  uid: user.uid,
                  email: email,
                  name: studentData.name,
                  role: 'student',
                  rollNo: studentData.rollNo,
                  section: studentData.section,
                  facultyId: studentData.facultyId,
                  passwordChanged: studentData.passwordChanged || false
                };
                
                // Create user profile in users collection
                await setDoc(doc(db, 'users', user.uid), studentProfile);
                  console.log('Created student profile:', studentProfile);
                setUserProfile(studentProfile);
              } else {
                console.log('No faculty access found, searching for student by email:', email);
                console.log('No student found by email search');
                setUserProfile(null);
              }
            }
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
          setUserProfile(null);
        }
      } else {
        console.log('No user authenticated');
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userProfile,
    login,
    signup,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};