import { User } from '../types';
import { databaseService } from './databaseService';

class AuthService {
  async initializeDatabase(): Promise<void> {
    await databaseService.initializeDatabase();
  }

  async login(email: string, password: string): Promise<User | null> {
    try {
      // Check if it's a student login with roll number
      if (password === 'cse@nbkr') {
        const studentData = await databaseService.getUserByRollNo(email);
        if (studentData) {
          return {
            id: studentData.id,
            name: studentData.name,
            email: studentData.email,
            role: studentData.role,
            rollNo: studentData.roll_no,
            section: studentData.section,
            facultyId: studentData.faculty_id,
            passwordChanged: studentData.password_changed
          };
        }
        return null;
      }

      // Faculty login
      const facultyData = await databaseService.getUserByEmail(email);
      if (facultyData && facultyData.role === 'faculty') {
        return {
          id: facultyData.id,
          name: facultyData.name,
          email: facultyData.email,
          role: facultyData.role
        };
      }

      return null;
    } catch (error) {
      console.error('Login error:', error);
      return null;
    }
  }

  async signup(name: string, email: string, password: string): Promise<User | null> {
    try {
      // Check if faculty already exists
      const existingUser = await databaseService.getUserByEmail(email);
      if (existingUser) {
        throw new Error('User already exists');
      }

      const userId = await databaseService.createUser({
        name,
        email,
        role: 'faculty',
        passwordHash: password // In production, hash this password
      });

      return {
        id: userId,
        name,
        email,
        role: 'faculty'
      };
    } catch (error) {
      console.error('Signup error:', error);
      return null;
    }
  }

  async changePassword(userId: string, newPassword: string): Promise<boolean> {
    try {
      return await databaseService.updateUserPassword(userId, true);
    } catch (error) {
      console.error('Change password error:', error);
      return false;
    }
  }

  async enrollStudent(studentData: { name: string; rollNo: string; email: string; section: string; facultyId: string }): Promise<User | null> {
    try {
      const userId = await databaseService.createUser({
        name: studentData.name,
        email: studentData.email,
        role: 'student',
        rollNo: studentData.rollNo,
        section: studentData.section,
        facultyId: studentData.facultyId,
        passwordChanged: false
      });

      return {
        id: userId,
        name: studentData.name,
        email: studentData.email,
        role: 'student',
        rollNo: studentData.rollNo,
        section: studentData.section,
        facultyId: studentData.facultyId,
        passwordChanged: false
      };
    } catch (error) {
      console.error('Enroll student error:', error);
      return null;
    }
  }

  async getEnrolledStudents(facultyId: string): Promise<User[]> {
    try {
      const studentsData = await databaseService.getStudentsByFaculty(facultyId);
      return studentsData.map(student => ({
        id: student.id,
        name: student.name,
        email: student.email,
        role: student.role,
        rollNo: student.roll_no,
        section: student.section,
        facultyId: student.faculty_id,
        passwordChanged: student.password_changed
      }));
    } catch (error) {
      console.error('Get enrolled students error:', error);
      return [];
    }
  }

  async updateStudent(studentId: string, updates: any): Promise<boolean> {
    try {
      return await databaseService.updateStudent(studentId, updates);
    } catch (error) {
      console.error('Update student error:', error);
      return false;
    }
  }

  async deleteStudent(studentId: string): Promise<boolean> {
    try {
      return await databaseService.deleteStudent(studentId);
    } catch (error) {
      console.error('Delete student error:', error);
      return false;
    }
  }
}

export const authService = new AuthService();