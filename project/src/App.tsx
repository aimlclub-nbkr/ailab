import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Students from './components/Students';
import Experiments from './components/Experiments';
import VivaQuestions from './components/VivaQuestions';
import Submissions from './components/Submissions';
import Profile from './components/Profile';
import Records from './components/Records';
import PasswordChangeModal from './components/PasswordChangeModal';

const AppContent: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  console.log('AppContent - currentUser:', currentUser?.email);
  console.log('AppContent - userProfile:', userProfile);

  if (!currentUser || !userProfile) {
    console.log('Showing login - currentUser:', !!currentUser, 'userProfile:', !!userProfile);
    return <Login />;
  }

  // Check if student needs to change password
  if (userProfile.role === 'student' && !userProfile.passwordChanged) {
    console.log('Student needs to change password:', userProfile.email);
    return <PasswordChangeModal/>;
  }

  console.log('Showing main app for:', userProfile.role, userProfile.email);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'students':
        return userProfile.role === 'faculty' ? <Students /> : <Dashboard />;
      case 'experiments':
        return <Experiments />;
      case 'viva-questions':
        return userProfile.role === 'faculty' ? <VivaQuestions /> : <Dashboard />;
      case 'submissions':
        return userProfile.role === 'faculty' ? <Submissions /> : <Dashboard />;
      case 'records':
        return userProfile.role === 'faculty' ? <Records /> : <Dashboard />;
      case 'profile':
        return <Profile />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderContent()}
    </Layout>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;