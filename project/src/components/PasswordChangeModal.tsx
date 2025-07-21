import React, { useState } from 'react';
import { Key, Eye, EyeOff, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { updatePassword } from 'firebase/auth';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

const PasswordChangeModal: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('Passwords do not match');
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
        
        // Update password changed status in users collection
        await updateDoc(doc(db, 'users', currentUser.uid), {
          passwordChanged: true
        });

        // If user is a student, also update the students collection
        if (userProfile.role === 'student') {
          // Find and update student record by email
          const studentsQuery = query(
            collection(db, 'students'),
            where('email', '==', userProfile.email)
          );
          const studentsSnapshot = await getDocs(studentsQuery);
          
          // Update all matching student records
          const updatePromises = studentsSnapshot.docs.map(doc => 
            updateDoc(doc.ref, { passwordChanged: true })
          );
          await Promise.all(updatePromises);

          // Also try to find by rollNo if email search didn't find anything
          if (studentsSnapshot.empty && userProfile.rollNo) {
            const studentsQueryByRoll = query(
              collection(db, 'students'),
              where('rollNo', '==', userProfile.rollNo)
            );
            const studentsSnapshotByRoll = await getDocs(studentsQueryByRoll);
            
            const updatePromisesByRoll = studentsSnapshotByRoll.docs.map(doc => 
              updateDoc(doc.ref, { passwordChanged: true })
            );
            await Promise.all(updatePromisesByRoll);
          }
        }

        // The auth context will automatically refresh and redirect
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-yellow-100 p-3 rounded-full">
              <Shield className="h-12 w-12 text-yellow-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Password Change Required
          </h1>
          <p className="text-gray-600">
            For security reasons, please change your default password before continuing.
          </p>
        </div>

        <form onSubmit={handlePasswordChange} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter new password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Confirm new password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Updating Password...</span>
              </>
            ) : (
              <>
                <Key className="h-5 w-5" />
                <span>Update Password</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Password must be at least 6 characters long</p>
        </div>
      </div>
    </div>
  );
};

export default PasswordChangeModal;