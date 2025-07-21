export interface User {
  uid: string;
  email: string;
  name: string;
  role: 'faculty' | 'student';
  rollNo?: string;
  section?: string;
  facultyId?: string;
  passwordChanged?: boolean;
  primaryFacultyId?: string; // For faculty members who have access to another faculty's students
}

export interface Student {
  id: string;
  name: string;
  rollNo: string;
  email: string;
  section: string;
  facultyId: string;
  passwordChanged: boolean;
  experimentsCompleted: string[];
  vivaScores: { [experimentId: string]: number };
  uid?: string; // Firebase Auth UID
  addedBy?: string;
  addedByName?: string;
}

export interface Experiment {
  id: string;
  title: string;  
  description: string;
  manualLink: string;
  facultyId: string;
  createdAt: Date;
}

export interface VivaQuestion {
  id: string;
  experimentId: string;
  question: string;
  options: string[];
  correctAnswer: number;
  facultyId: string;
}

export interface StudentSubmission {
  id: string;
  studentId: string;
  experimentId: string;
  submissionLink: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: Date;
  approvedAt?: Date;
}

export interface VivaAttempt {
  id: string;
  studentId: string;
  experimentId: string;
  score: number;
  totalQuestions: number;
  completedAt: Date;
  answers: number[];
  selectedQuestionIds?: string[]; // Track which questions were selected for this attempt
  securityViolations?: {
    tabSwitches: number;
    windowSwitches: number;
    aiToolDetections: number;
    devToolsAttempts: number;
  };
  aiToolsDetected?: string[];
  autoSubmittedDueToViolation?: boolean;
  violationReason?: string;
}