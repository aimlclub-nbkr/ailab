import mysql from 'mysql2/promise';

class DatabaseService {
  private connection: mysql.Connection | null = null;

  private async getConnection(): Promise<mysql.Connection> {
    if (!this.connection) {
      this.connection = await mysql.createConnection({
        host: 'database-1.cpqgm8meg5zo.ap-south-1.rds.amazonaws.com',
        user: 'admin',
        password: 'Suresh#786',
        port: 3306,
        database: 'computer_networks_lab',
        ssl: {
          rejectUnauthorized: false
        }
      });
    }
    return this.connection;
  }

  async initializeDatabase(): Promise<void> {
    const connection = await this.getConnection();
    
    try {
      // Create database if it doesn't exist
      await connection.execute('CREATE DATABASE IF NOT EXISTS computer_networks_lab');
      await connection.execute('USE computer_networks_lab');

      // Create users table
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(36) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255),
          role ENUM('faculty', 'student') NOT NULL,
          roll_no VARCHAR(50),
          section VARCHAR(10),
          faculty_id VARCHAR(36),
          password_changed BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_faculty_id (faculty_id),
          INDEX idx_role (role),
          INDEX idx_section (section)
        )
      `);

      // Create experiments table
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS experiments (
          id VARCHAR(36) PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          pdf_url TEXT,
          faculty_id VARCHAR(36) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_faculty_id (faculty_id)
        )
      `);

      // Create viva_questions table
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS viva_questions (
          id VARCHAR(36) PRIMARY KEY,
          experiment_id VARCHAR(36) NOT NULL,
          question TEXT NOT NULL,
          option_a VARCHAR(500) NOT NULL,
          option_b VARCHAR(500) NOT NULL,
          option_c VARCHAR(500) NOT NULL,
          option_d VARCHAR(500) NOT NULL,
          correct_answer INT NOT NULL,
          faculty_id VARCHAR(36) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_experiment_id (experiment_id),
          INDEX idx_faculty_id (faculty_id),
          FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE
        )
      `);

      // Create student_progress table
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS student_progress (
          id VARCHAR(36) PRIMARY KEY,
          student_id VARCHAR(36) NOT NULL,
          experiment_id VARCHAR(36) NOT NULL,
          pdf_uploaded BOOLEAN DEFAULT FALSE,
          uploaded_pdf_url TEXT,
          faculty_confirmed BOOLEAN DEFAULT FALSE,
          viva_completed BOOLEAN DEFAULT FALSE,
          viva_score INT DEFAULT 0,
          points INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_student_experiment (student_id, experiment_id),
          INDEX idx_student_id (student_id),
          INDEX idx_experiment_id (experiment_id),
          FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE
        )
      `);

      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    }
  }

  // User methods
  async createUser(userData: any): Promise<string> {
    const connection = await this.getConnection();
    const id = this.generateId();
    
    await connection.execute(
      `INSERT INTO users (id, name, email, password_hash, role, roll_no, section, faculty_id, password_changed) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userData.name,
        userData.email,
        userData.passwordHash || null,
        userData.role,
        userData.rollNo || null,
        userData.section || null,
        userData.facultyId || null,
        userData.passwordChanged || false
      ]
    );
    
    return id;
  }

  async getUserByEmail(email: string): Promise<any> {
    const connection = await this.getConnection();
    const [rows] = await connection.execute(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    return (rows as any[])[0] || null;
  }

  async getUserByRollNo(rollNo: string): Promise<any> {
    const connection = await this.getConnection();
    const [rows] = await connection.execute(
      'SELECT * FROM users WHERE roll_no = ? AND role = "student"',
      [rollNo]
    );
    return (rows as any[])[0] || null;
  }

  async updateUserPassword(userId: string, passwordChanged: boolean = true): Promise<boolean> {
    const connection = await this.getConnection();
    const [result] = await connection.execute(
      'UPDATE users SET password_changed = ? WHERE id = ?',
      [passwordChanged, userId]
    );
    return (result as any).affectedRows > 0;
  }

  async getStudentsByFaculty(facultyId: string): Promise<any[]> {
    const connection = await this.getConnection();
    const [rows] = await connection.execute(
      'SELECT * FROM users WHERE faculty_id = ? AND role = "student" ORDER BY section, name',
      [facultyId]
    );
    return rows as any[];
  }

  async updateStudent(studentId: string, updates: any): Promise<boolean> {
    const connection = await this.getConnection();
    const [result] = await connection.execute(
      'UPDATE users SET name = ?, email = ?, roll_no = ?, section = ? WHERE id = ?',
      [updates.name, updates.email, updates.rollNo, updates.section, studentId]
    );
    return (result as any).affectedRows > 0;
  }

  async deleteStudent(studentId: string): Promise<boolean> {
    const connection = await this.getConnection();
    const [result] = await connection.execute(
      'DELETE FROM users WHERE id = ? AND role = "student"',
      [studentId]
    );
    return (result as any).affectedRows > 0;
  }

  // Experiment methods
  async createExperiment(experimentData: any): Promise<string> {
    const connection = await this.getConnection();
    const id = this.generateId();
    
    await connection.execute(
      'INSERT INTO experiments (id, title, description, pdf_url, faculty_id) VALUES (?, ?, ?, ?, ?)',
      [id, experimentData.title, experimentData.description, experimentData.pdfUrl, experimentData.facultyId]
    );
    
    return id;
  }

  async getExperimentsByFaculty(facultyId: string): Promise<any[]> {
    const connection = await this.getConnection();
    const [rows] = await connection.execute(
      'SELECT * FROM experiments WHERE faculty_id = ? ORDER BY created_at DESC',
      [facultyId]
    );
    return rows as any[];
  }

  async updateExperiment(experimentId: string, updates: any): Promise<boolean> {
    const connection = await this.getConnection();
    const [result] = await connection.execute(
      'UPDATE experiments SET title = ?, description = ?, pdf_url = ? WHERE id = ?',
      [updates.title, updates.description, updates.pdfUrl, experimentId]
    );
    return (result as any).affectedRows > 0;
  }

  async deleteExperiment(experimentId: string): Promise<boolean> {
    const connection = await this.getConnection();
    const [result] = await connection.execute(
      'DELETE FROM experiments WHERE id = ?',
      [experimentId]
    );
    return (result as any).affectedRows > 0;
  }

  // Viva questions methods
  async createVivaQuestion(questionData: any): Promise<string> {
    const connection = await this.getConnection();
    const id = this.generateId();
    
    await connection.execute(
      `INSERT INTO viva_questions (id, experiment_id, question, option_a, option_b, option_c, option_d, correct_answer, faculty_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        questionData.experimentId,
        questionData.question,
        questionData.options[0],
        questionData.options[1],
        questionData.options[2],
        questionData.options[3],
        questionData.correctAnswer,
        questionData.facultyId
      ]
    );
    
    return id;
  }

  async getVivaQuestionsByExperiment(experimentId: string): Promise<any[]> {
    const connection = await this.getConnection();
    const [rows] = await connection.execute(
      'SELECT * FROM viva_questions WHERE experiment_id = ? ORDER BY created_at',
      [experimentId]
    );
    
    return (rows as any[]).map(row => ({
      id: row.id,
      experimentId: row.experiment_id,
      question: row.question,
      options: [row.option_a, row.option_b, row.option_c, row.option_d],
      correctAnswer: row.correct_answer,
      facultyId: row.faculty_id
    }));
  }

  async updateVivaQuestion(questionId: string, updates: any): Promise<boolean> {
    const connection = await this.getConnection();
    const [result] = await connection.execute(
      `UPDATE viva_questions SET question = ?, option_a = ?, option_b = ?, option_c = ?, option_d = ?, correct_answer = ? 
       WHERE id = ?`,
      [
        updates.question,
        updates.options[0],
        updates.options[1],
        updates.options[2],
        updates.options[3],
        updates.correctAnswer,
        questionId
      ]
    );
    return (result as any).affectedRows > 0;
  }

  async deleteVivaQuestion(questionId: string): Promise<boolean> {
    const connection = await this.getConnection();
    const [result] = await connection.execute(
      'DELETE FROM viva_questions WHERE id = ?',
      [questionId]
    );
    return (result as any).affectedRows > 0;
  }

  // Student progress methods
  async getStudentProgress(studentId: string): Promise<any[]> {
    const connection = await this.getConnection();
    const [rows] = await connection.execute(
      `SELECT sp.*, e.title as experiment_title 
       FROM student_progress sp 
       JOIN experiments e ON sp.experiment_id = e.id 
       WHERE sp.student_id = ?`,
      [studentId]
    );
    return rows as any[];
  }

  async updateStudentProgress(progressData: any): Promise<boolean> {
    const connection = await this.getConnection();
    
    // Check if record exists
    const [existing] = await connection.execute(
      'SELECT id FROM student_progress WHERE student_id = ? AND experiment_id = ?',
      [progressData.studentId, progressData.experimentId]
    );

    if ((existing as any[]).length > 0) {
      // Update existing record
      const [result] = await connection.execute(
        `UPDATE student_progress SET 
         pdf_uploaded = COALESCE(?, pdf_uploaded),
         uploaded_pdf_url = COALESCE(?, uploaded_pdf_url),
         faculty_confirmed = COALESCE(?, faculty_confirmed),
         viva_completed = COALESCE(?, viva_completed),
         viva_score = COALESCE(?, viva_score),
         points = COALESCE(?, points)
         WHERE student_id = ? AND experiment_id = ?`,
        [
          progressData.pdfUploaded,
          progressData.uploadedPdfUrl,
          progressData.facultyConfirmed,
          progressData.vivaCompleted,
          progressData.vivaScore,
          progressData.points,
          progressData.studentId,
          progressData.experimentId
        ]
      );
      return (result as any).affectedRows > 0;
    } else {
      // Create new record
      const id = this.generateId();
      const [result] = await connection.execute(
        `INSERT INTO student_progress (id, student_id, experiment_id, pdf_uploaded, uploaded_pdf_url, faculty_confirmed, viva_completed, viva_score, points)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          progressData.studentId,
          progressData.experimentId,
          progressData.pdfUploaded || false,
          progressData.uploadedPdfUrl || null,
          progressData.facultyConfirmed || false,
          progressData.vivaCompleted || false,
          progressData.vivaScore || 0,
          progressData.points || 0
        ]
      );
      return (result as any).affectedRows > 0;
    }
  }

  async confirmExperimentCompletion(studentId: string, experimentId: string): Promise<boolean> {
    const connection = await this.getConnection();
    const [result] = await connection.execute(
      'UPDATE student_progress SET faculty_confirmed = TRUE, points = 10 WHERE student_id = ? AND experiment_id = ? AND pdf_uploaded = TRUE',
      [studentId, experimentId]
    );
    return (result as any).affectedRows > 0;
  }

  async submitVivaAnswers(studentId: string, experimentId: string, score: number): Promise<boolean> {
    const connection = await this.getConnection();
    const [result] = await connection.execute(
      'UPDATE student_progress SET viva_completed = TRUE, viva_score = ? WHERE student_id = ? AND experiment_id = ?',
      [score, studentId, experimentId]
    );
    return (result as any).affectedRows > 0;
  }

  private generateId(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }

  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
    }
  }
}

export const databaseService = new DatabaseService();