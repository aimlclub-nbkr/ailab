import { Experiment, VivaQuestion, StudentProgress } from '../types';
import { databaseService } from './databaseService';

class DataService {
  // Experiment methods
  async getExperiments(facultyId: string): Promise<Experiment[]> {
    try {
      const experimentsData = await databaseService.getExperimentsByFaculty(facultyId);
      return experimentsData.map(exp => ({
        id: exp.id,
        title: exp.title,
        description: exp.description,
        pdfUrl: exp.pdf_url,
        facultyId: exp.faculty_id,
        createdAt: exp.created_at
      }));
    } catch (error) {
      console.error('Get experiments error:', error);
      return [];
    }
  }

  async addExperiment(experiment: Omit<Experiment, 'id' | 'createdAt'>): Promise<Experiment> {
    try {
      const experimentId = await databaseService.createExperiment(experiment);
      return {
        id: experimentId,
        ...experiment,
        createdAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Add experiment error:', error);
      throw error;
    }
  }

  async updateExperiment(id: string, updates: Partial<Experiment>): Promise<boolean> {
    try {
      return await databaseService.updateExperiment(id, updates);
    } catch (error) {
      console.error('Update experiment error:', error);
      return false;
    }
  }

  async deleteExperiment(id: string): Promise<boolean> {
    try {
      return await databaseService.deleteExperiment(id);
    } catch (error) {
      console.error('Delete experiment error:', error);
      return false;
    }
  }

  // Viva questions methods
  async getVivaQuestions(experimentId: string): Promise<VivaQuestion[]> {
    try {
      return await databaseService.getVivaQuestionsByExperiment(experimentId);
    } catch (error) {
      console.error('Get viva questions error:', error);
      return [];
    }
  }

  async addVivaQuestion(question: Omit<VivaQuestion, 'id'>): Promise<VivaQuestion> {
    try {
      const questionId = await databaseService.createVivaQuestion(question);
      return {
        id: questionId,
        ...question
      };
    } catch (error) {
      console.error('Add viva question error:', error);
      throw error;
    }
  }

  async updateVivaQuestion(id: string, updates: Partial<VivaQuestion>): Promise<boolean> {
    try {
      return await databaseService.updateVivaQuestion(id, updates);
    } catch (error) {
      console.error('Update viva question error:', error);
      return false;
    }
  }

  async deleteVivaQuestion(id: string): Promise<boolean> {
    try {
      return await databaseService.deleteVivaQuestion(id);
    } catch (error) {
      console.error('Delete viva question error:', error);
      return false;
    }
  }

  // Student progress methods
  async getStudentProgress(studentId: string): Promise<StudentProgress[]> {
    try {
      const progressData = await databaseService.getStudentProgress(studentId);
      return progressData.map(progress => ({
        id: progress.id,
        studentId: progress.student_id,
        experimentId: progress.experiment_id,
        pdfUploaded: progress.pdf_uploaded,
        facultyConfirmed: progress.faculty_confirmed,
        vivaCompleted: progress.viva_completed,
        vivaScore: progress.viva_score,
        points: progress.points,
        uploadedPdfUrl: progress.uploaded_pdf_url
      }));
    } catch (error) {
      console.error('Get student progress error:', error);
      return [];
    }
  }

  async updateStudentProgress(progress: Partial<StudentProgress> & { studentId: string; experimentId: string }): Promise<boolean> {
    try {
      return await databaseService.updateStudentProgress(progress);
    } catch (error) {
      console.error('Update student progress error:', error);
      return false;
    }
  }

  async confirmExperimentCompletion(studentId: string, experimentId: string): Promise<boolean> {
    try {
      return await databaseService.confirmExperimentCompletion(studentId, experimentId);
    } catch (error) {
      console.error('Confirm experiment completion error:', error);
      return false;
    }
  }

  async submitVivaAnswers(studentId: string, experimentId: string, score: number): Promise<boolean> {
    try {
      return await databaseService.submitVivaAnswers(studentId, experimentId, score);
    } catch (error) {
      console.error('Submit viva answers error:', error);
      return false;
    }
  }
}

export const dataService = new DataService();