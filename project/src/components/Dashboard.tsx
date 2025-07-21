import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Users, BookOpen, MessageSquare, Award, TrendingUp } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

const Dashboard: React.FC = () => {
  const { userProfile } = useAuth();
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalExperiments: 0,
    completedSubmissions: 0,
    vivaAttempts: 0,
    sectionWiseStudents: [] as { name: string; value: number; color: string }[],
    experimentProgress: [] as { name: string; value: number; color: string }[],
    vivaProgress: [] as { name: string; value: number; color: string }[],
    submissionStats: [] as { name: string; value: number; color: string }[]
  });

  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316'];

  useEffect(() => {
    if (userProfile) {
      setupRealtimeStatsListeners();
    }
  }, [userProfile]);

  const setupRealtimeStatsListeners = () => {
    if (!userProfile) return;

    if (userProfile.role === 'faculty') {
      setupFacultyStatsListeners();
    } else {
      setupStudentStatsListeners();
    }
  };

  const setupFacultyStatsListeners = () => {
    const targetFacultyId = userProfile!.primaryFacultyId || userProfile!.uid;

    // Students listener
    const studentsQuery = query(
      collection(db, 'students'),
      where('facultyId', '==', targetFacultyId)
    );
    
    const unsubscribeStudents = onSnapshot(studentsQuery, () => {
      fetchFacultyStats(targetFacultyId);
    });

    // Experiments listener
    const experimentsQuery = query(
      collection(db, 'experiments'),
      where('facultyId', '==', targetFacultyId)
    );
    
    const unsubscribeExperiments = onSnapshot(experimentsQuery, () => {
      fetchFacultyStats(targetFacultyId);
    });

    // Submissions listener
    const unsubscribeSubmissions = onSnapshot(collection(db, 'submissions'), () => {
      fetchFacultyStats(targetFacultyId);
    });

    // Viva attempts listener
    const unsubscribeVivaAttempts = onSnapshot(collection(db, 'vivaAttempts'), () => {
      fetchFacultyStats(targetFacultyId);
    });

    // Initial fetch
    fetchFacultyStats(targetFacultyId);

    // Cleanup
    return () => {
      unsubscribeStudents();
      unsubscribeExperiments();
      unsubscribeSubmissions();
      unsubscribeVivaAttempts();
    };
  };

  const setupStudentStatsListeners = () => {
    // Experiments listener
    const experimentsQuery = query(
      collection(db, 'experiments'),
      where('facultyId', '==', userProfile!.facultyId)
    );
    
    const unsubscribeExperiments = onSnapshot(experimentsQuery, () => {
      fetchStudentStats();
    });

    // Submissions listener
    const submissionsQuery = query(
      collection(db, 'submissions'),
      where('studentId', '==', userProfile!.uid)
    );
    
    const unsubscribeSubmissions = onSnapshot(submissionsQuery, () => {
      fetchStudentStats();
    });

    // Viva attempts listener
    const vivaAttemptsQuery = query(
      collection(db, 'vivaAttempts'),
      where('studentId', '==', userProfile!.uid)
    );
    
    const unsubscribeVivaAttempts = onSnapshot(vivaAttemptsQuery, () => {
      fetchStudentStats();
    });

    // Initial fetch
    fetchStudentStats();

    // Cleanup
    return () => {
      unsubscribeExperiments();
      unsubscribeSubmissions();
      unsubscribeVivaAttempts();
    };
  };

  const fetchFacultyStats = async (targetFacultyId: string) => {
    try {
      // Fetch students enrolled by this faculty
      const studentsQuery = query(
        collection(db, 'students'),
        where('facultyId', '==', targetFacultyId)
      );
      const studentsSnapshot = await getDocs(studentsQuery);
      const students = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Calculate section-wise distribution
      const sectionMap = new Map();
      students.forEach((student: any) => {
        const section = student.section || 'Unknown';
        sectionMap.set(section, (sectionMap.get(section) || 0) + 1);
      });

      const sectionData = Array.from(sectionMap.entries()).map(([section, count], index) => ({
        name: section,
        value: count as number,
        color: colors[index % colors.length]
      }));

      // Fetch experiments created by this faculty
      const experimentsQuery = query(
        collection(db, 'experiments'),
        where('facultyId', '==', targetFacultyId)
      );
      const experimentsSnapshot = await getDocs(experimentsQuery);
      const experiments = experimentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Fetch submissions for this faculty's experiments
      const submissionsSnapshot = await getDocs(collection(db, 'submissions'));
      const allSubmissions = submissionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const experimentIds = experiments.map((exp: any) => exp.id);
      const facultySubmissions = allSubmissions.filter((sub: any) => 
        experimentIds.includes(sub.experimentId)
      );

      // Calculate submission stats
      const approvedSubmissions = facultySubmissions.filter((sub: any) => sub.status === 'approved').length;
      const pendingSubmissions = facultySubmissions.filter((sub: any) => sub.status === 'pending').length;
      const rejectedSubmissions = facultySubmissions.filter((sub: any) => sub.status === 'rejected').length;

      // Fetch viva attempts for this faculty's experiments
      const vivaAttemptsSnapshot = await getDocs(collection(db, 'vivaAttempts'));
      const allVivaAttempts = vivaAttemptsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const facultyVivaAttempts = allVivaAttempts.filter((attempt: any) => 
        experimentIds.includes(attempt.experimentId)
      );

      // Calculate experiment progress
      const totalPossibleSubmissions = students.length * experiments.length;
      const experimentProgressData = [
        { name: 'Submitted', value: facultySubmissions.length, color: '#10B981' },
        { name: 'Not Submitted', value: Math.max(0, totalPossibleSubmissions - facultySubmissions.length), color: '#E5E7EB' }
      ];

      // Calculate viva progress
      const totalPossibleVivaAttempts = students.length * experiments.length;
      const vivaProgressData = [
        { name: 'Attempted', value: facultyVivaAttempts.length, color: '#3B82F6' },
        { name: 'Not Attempted', value: Math.max(0, totalPossibleVivaAttempts - facultyVivaAttempts.length), color: '#E5E7EB' }
      ];

      // Submission status distribution
      const submissionStatsData = [
        { name: 'Approved', value: approvedSubmissions, color: '#10B981' },
        { name: 'Pending', value: pendingSubmissions, color: '#F59E0B' },
        { name: 'Rejected', value: rejectedSubmissions, color: '#EF4444' }
      ].filter(item => item.value > 0);

      setStats({
        totalStudents: students.length,
        totalExperiments: experiments.length,
        completedSubmissions: facultySubmissions.length,
        vivaAttempts: facultyVivaAttempts.length,
        sectionWiseStudents: sectionData,
        experimentProgress: experimentProgressData,
        vivaProgress: vivaProgressData,
        submissionStats: submissionStatsData
      });
      
      console.log('Real-time update: Faculty stats updated');
    } catch (error) {
      console.error('Error fetching faculty stats:', error);
    }
  };

  const fetchStudentStats = async () => {
    try {
      // Fetch experiments from student's faculty
      const experimentsQuery = query(
        collection(db, 'experiments'),
        where('facultyId', '==', userProfile!.facultyId)
      );
      const experimentsSnapshot = await getDocs(experimentsQuery);
      const totalExperiments = experimentsSnapshot.docs.length;

      // Fetch student's submissions
      const submissionsQuery = query(
        collection(db, 'submissions'),
        where('studentId', '==', userProfile!.uid)
      );
      const submissionsSnapshot = await getDocs(submissionsQuery);
      const submissions = submissionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const approvedSubmissions = submissions.filter((sub: any) => sub.status === 'approved').length;
      const pendingSubmissions = submissions.filter((sub: any) => sub.status === 'pending').length;
      const rejectedSubmissions = submissions.filter((sub: any) => sub.status === 'rejected').length;

      // Fetch student's viva attempts
      const vivaAttemptsQuery = query(
        collection(db, 'vivaAttempts'),
        where('studentId', '==', userProfile!.uid)
      );
      const vivaAttemptsSnapshot = await getDocs(vivaAttemptsQuery);
      const vivaAttempts = vivaAttemptsSnapshot.docs.length;

      // Calculate progress
      const experimentProgressData = [
        { name: 'Submitted', value: submissions.length, color: '#10B981' },
        { name: 'Not Submitted', value: Math.max(0, totalExperiments - submissions.length), color: '#E5E7EB' }
      ];

      const vivaProgressData = [
        { name: 'Attempted', value: vivaAttempts, color: '#3B82F6' },
        { name: 'Not Attempted', value: Math.max(0, totalExperiments - vivaAttempts), color: '#E5E7EB' }
      ];

      const submissionStatsData = [
        { name: 'Approved', value: approvedSubmissions, color: '#10B981' },
        { name: 'Pending', value: pendingSubmissions, color: '#F59E0B' },
        { name: 'Rejected', value: rejectedSubmissions, color: '#EF4444' }
      ].filter(item => item.value > 0);

      setStats({
        totalStudents: 0,
        totalExperiments,
        completedSubmissions: submissions.length,
        vivaAttempts,
        sectionWiseStudents: [],
        experimentProgress: experimentProgressData,
        vivaProgress: vivaProgressData,
        submissionStats: submissionStatsData
      });
      
      console.log('Real-time update: Student stats updated');
    } catch (error) {
      console.error('Error fetching student stats:', error);
    }
  };

  const fetchStats = async () => {
    if (!userProfile) return;

      try {
        if (userProfile.role === 'faculty') {
          // Determine which faculty's data to fetch
          const targetFacultyId = userProfile.primaryFacultyId || userProfile.uid;
          
          // Fetch students enrolled by this faculty
          const studentsQuery = query(
            collection(db, 'students'),
            where('facultyId', '==', targetFacultyId)
          );
          const studentsSnapshot = await getDocs(studentsQuery);
          const students = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

          // Calculate section-wise distribution
          const sectionMap = new Map();
          students.forEach((student: any) => {
            const section = student.section || 'Unknown';
            sectionMap.set(section, (sectionMap.get(section) || 0) + 1);
          });

          const sectionData = Array.from(sectionMap.entries()).map(([section, count], index) => ({
            name: section,
            value: count as number,
            color: colors[index % colors.length]
          }));

          // Fetch experiments created by this faculty
          const experimentsQuery = query(
            collection(db, 'experiments'),
            where('facultyId', '==', targetFacultyId)
          );
          const experimentsSnapshot = await getDocs(experimentsQuery);
          const experiments = experimentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

          // Fetch submissions for this faculty's experiments
          const submissionsSnapshot = await getDocs(collection(db, 'submissions'));
          const allSubmissions = submissionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          
          const experimentIds = experiments.map((exp: any) => exp.id);
          const facultySubmissions = allSubmissions.filter((sub: any) => 
            experimentIds.includes(sub.experimentId)
          );

          // Calculate submission stats
          const approvedSubmissions = facultySubmissions.filter((sub: any) => sub.status === 'approved').length;
          const pendingSubmissions = facultySubmissions.filter((sub: any) => sub.status === 'pending').length;
          const rejectedSubmissions = facultySubmissions.filter((sub: any) => sub.status === 'rejected').length;

          // Fetch viva attempts for this faculty's experiments
          const vivaAttemptsSnapshot = await getDocs(collection(db, 'vivaAttempts'));
          const allVivaAttempts = vivaAttemptsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          const facultyVivaAttempts = allVivaAttempts.filter((attempt: any) => 
            experimentIds.includes(attempt.experimentId)
          );

          // Calculate experiment progress
          const totalPossibleSubmissions = students.length * experiments.length;
          const experimentProgressData = [
            { name: 'Submitted', value: facultySubmissions.length, color: '#10B981' },
            { name: 'Not Submitted', value: Math.max(0, totalPossibleSubmissions - facultySubmissions.length), color: '#E5E7EB' }
          ];

          // Calculate viva progress
          const totalPossibleVivaAttempts = students.length * experiments.length;
          const vivaProgressData = [
            { name: 'Attempted', value: facultyVivaAttempts.length, color: '#3B82F6' },
            { name: 'Not Attempted', value: Math.max(0, totalPossibleVivaAttempts - facultyVivaAttempts.length), color: '#E5E7EB' }
          ];

          // Submission status distribution
          const submissionStatsData = [
            { name: 'Approved', value: approvedSubmissions, color: '#10B981' },
            { name: 'Pending', value: pendingSubmissions, color: '#F59E0B' },
            { name: 'Rejected', value: rejectedSubmissions, color: '#EF4444' }
          ].filter(item => item.value > 0);

          setStats({
            totalStudents: students.length,
            totalExperiments: experiments.length,
            completedSubmissions: facultySubmissions.length,
            vivaAttempts: facultyVivaAttempts.length,
            sectionWiseStudents: sectionData,
            experimentProgress: experimentProgressData,
            vivaProgress: vivaProgressData,
            submissionStats: submissionStatsData
          });
        } else {
          // Student dashboard stats
          const studentData = userProfile as any;
          
          // Fetch experiments from student's faculty
          const experimentsQuery = query(
            collection(db, 'experiments'),
            where('facultyId', '==', userProfile.facultyId)
          );
          const experimentsSnapshot = await getDocs(experimentsQuery);
          const totalExperiments = experimentsSnapshot.docs.length;

          // Fetch student's submissions
          const submissionsQuery = query(
            collection(db, 'submissions'),
            where('studentId', '==', userProfile.uid)
          );
          const submissionsSnapshot = await getDocs(submissionsQuery);
          const submissions = submissionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

          const approvedSubmissions = submissions.filter((sub: any) => sub.status === 'approved').length;
          const pendingSubmissions = submissions.filter((sub: any) => sub.status === 'pending').length;
          const rejectedSubmissions = submissions.filter((sub: any) => sub.status === 'rejected').length;

          // Fetch student's viva attempts
          const vivaAttemptsQuery = query(
            collection(db, 'vivaAttempts'),
            where('studentId', '==', userProfile.uid)
          );
          const vivaAttemptsSnapshot = await getDocs(vivaAttemptsQuery);
          const vivaAttempts = vivaAttemptsSnapshot.docs.length;

          // Calculate progress
          const experimentProgressData = [
            { name: 'Submitted', value: submissions.length, color: '#10B981' },
            { name: 'Not Submitted', value: Math.max(0, totalExperiments - submissions.length), color: '#E5E7EB' }
          ];

          const vivaProgressData = [
            { name: 'Attempted', value: vivaAttempts, color: '#3B82F6' },
            { name: 'Not Attempted', value: Math.max(0, totalExperiments - vivaAttempts), color: '#E5E7EB' }
          ];

          const submissionStatsData = [
            { name: 'Approved', value: approvedSubmissions, color: '#10B981' },
            { name: 'Pending', value: pendingSubmissions, color: '#F59E0B' },
            { name: 'Rejected', value: rejectedSubmissions, color: '#EF4444' }
          ].filter(item => item.value > 0);

          setStats({
            totalStudents: 0,
            totalExperiments,
            completedSubmissions: submissions.length,
            vivaAttempts,
            sectionWiseStudents: [],
            experimentProgress: experimentProgressData,
            vivaProgress: vivaProgressData,
            submissionStats: submissionStatsData
          });
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
  };

  if (!userProfile) return null;

  const StatCard: React.FC<{ title: string; value: number; icon: React.ReactNode; color: string }> = 
    ({ title, value, icon, color }) => (
      <div className="bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          </div>
          <div className={`p-3 rounded-full ${color}`}>
            {icon}
          </div>
        </div>
      </div>
    );

  const PieChartCard: React.FC<{ title: string; data: any[]; }> = ({ title, data }) => (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="h-64">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>No data available</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">
          {userProfile.role === 'faculty' ? 'Faculty Dashboard' : 'Student Dashboard'}
        </h1>
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <TrendingUp className="h-4 w-4" />
          <span>Real-time Analytics</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {userProfile.role === 'faculty' ? (
          <>
            <StatCard
              title="Total Students"
              value={stats.totalStudents}
              icon={<Users className="h-6 w-6 text-white" />}
              color="bg-blue-500"
            />
            <StatCard
              title="Total Experiments"
              value={stats.totalExperiments}
              icon={<BookOpen className="h-6 w-6 text-white" />}
              color="bg-green-500"
            />
            <StatCard
              title="Total Submissions"
              value={stats.completedSubmissions}
              icon={<Award className="h-6 w-6 text-white" />}
              color="bg-yellow-500"
            />
            <StatCard
              title="Viva Attempts"
              value={stats.vivaAttempts}
              icon={<MessageSquare className="h-6 w-6 text-white" />}
              color="bg-purple-500"
            />
          </>
        ) : (
          <>
            <StatCard
              title="Total Experiments"
              value={stats.totalExperiments}
              icon={<BookOpen className="h-6 w-6 text-white" />}
              color="bg-blue-500"
            />
            <StatCard
              title="Submissions Made"
              value={stats.completedSubmissions}
              icon={<Award className="h-6 w-6 text-white" />}
              color="bg-green-500"
            />
            <StatCard
              title="Viva Attempts"
              value={stats.vivaAttempts}
              icon={<MessageSquare className="h-6 w-6 text-white" />}
              color="bg-purple-500"
            />
            <StatCard
              title="Completion Rate"
              value={stats.totalExperiments > 0 ? Math.round((stats.completedSubmissions / stats.totalExperiments) * 100) : 0}
              icon={<TrendingUp className="h-6 w-6 text-white" />}
              color="bg-yellow-500"
            />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {userProfile.role === 'faculty' && stats.sectionWiseStudents.length > 0 && (
          <PieChartCard title="Students by Section" data={stats.sectionWiseStudents} />
        )}
        <PieChartCard title="Experiment Submissions" data={stats.experimentProgress} />
        <PieChartCard title="Viva Test Progress" data={stats.vivaProgress} />
        {stats.submissionStats.length > 0 && (
          <PieChartCard title="Submission Status" data={stats.submissionStats} />
        )}
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
        <div className="space-y-4">
          {userProfile.role === 'faculty' ? (
            <>
              <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Student submissions received</p>
                  <p className="text-xs text-gray-600">Check submissions tab for review</p>
                </div>
              </div>
              <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Viva tests completed</p>
                  <p className="text-xs text-gray-600">Students are taking viva tests</p>
                </div>
              </div>
              <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <div>
                  <p className="text-sm font-medium text-gray-900">System active</p>
                  <p className="text-xs text-gray-600">Lab evaluation system running smoothly</p>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Check experiment submissions</p>
                  <p className="text-xs text-gray-600">Submit pending experiments</p>
                </div>
              </div>
              <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Viva tests available</p>
                  <p className="text-xs text-gray-600">Take viva tests for approved experiments</p>
                </div>
              </div>
              <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Keep up the good work!</p>
                  <p className="text-xs text-gray-600">Continue with your lab experiments</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;