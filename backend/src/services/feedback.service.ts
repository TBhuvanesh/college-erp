import { pool } from '../config/database';
import { SubmitFeedbackRequest, FeedbackWindow } from '../types/feedback';
import { AppError } from '../errors/AppError';

export class FeedbackService {
  /**
   * Get all currently active feedback windows
   */
  async getActiveWindows(): Promise<FeedbackWindow[]> {
    const query = `
      SELECT * FROM feedback_windows
      WHERE is_active = true
        AND start_date <= NOW()
        AND end_date >= NOW()
    `;
    const { rows } = await pool.query(query);
    return rows;
  }

  /**
   * Get all feedback windows (active or inactive)
   */
  async getWindows(): Promise<FeedbackWindow[]> {
    const query = `SELECT * FROM feedback_windows ORDER BY start_date DESC`;
    const { rows } = await pool.query(query);
    return rows;
  }

  /**
   * Get templates by type
   */
  async getTemplates(type?: string): Promise<any[]> {
    let query = `SELECT * FROM feedback_templates WHERE is_active = true`;
    let params: any[] = [];
    if (type) {
      query += ` AND type = $1`;
      params.push(type);
    }
    const { rows: templates } = await pool.query(query, params);

    for (const template of templates) {
      const { rows: questions } = await pool.query(
        `SELECT * FROM feedback_questions WHERE template_id = $1 ORDER BY order_index ASC`,
        [template.id]
      );
      template.questions = questions;
    }
    return templates;
  }

  /**
   * Submit anonymous feedback
   */
  async submitFeedback(userId: string, request: SubmitFeedbackRequest): Promise<void> {
    const studentRes = await pool.query('SELECT id FROM students WHERE user_id = $1', [userId]);
    if (studentRes.rowCount === 0) {
      throw AppError.notFound('Student profile not found.');
    }
    const studentId = studentRes.rows[0].id;

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Verify window is active
      const windowCheck = await client.query(
        `SELECT id FROM feedback_windows WHERE id = $1 AND is_active = true AND start_date <= NOW() AND end_date >= NOW()`,
        [request.window_id]
      );
      if (windowCheck.rowCount === 0) {
        throw AppError.badRequest('Feedback window is not active or invalid.');
      }

      // 2. Insert into tracking (will throw unique constraint error if already submitted)
      try {
        await client.query(
          `INSERT INTO feedback_submission_tracking (window_id, student_id, subject_id, feedback_type)
           VALUES ($1, $2, $3, $4)`,
          [request.window_id, studentId, request.subject_id || null, request.feedback_type]
        );
      } catch (err: any) {
        if (err.code === '23505') { // Postgres unique_violation
          throw AppError.conflict('Feedback has already been submitted for this context.');
        }
        throw err;
      }

      // 3. Insert anonymous response envelope
      const responseResult = await client.query(
        `INSERT INTO feedback_responses (window_id, template_id, subject_id, faculty_id)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [request.window_id, request.template_id, request.subject_id || null, request.faculty_id || null]
      );
      const responseId = responseResult.rows[0].id;

      // 4. Insert answers
      for (const answer of request.answers) {
        await client.query(
          `INSERT INTO feedback_answers (response_id, question_id, rating_value, text_value)
           VALUES ($1, $2, $3, $4)`,
          [responseId, answer.question_id, answer.rating_value || null, answer.text_value || null]
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Get submission tracking records for a student and window
   */
  async getStudentSubmissions(userId: string, windowId: string): Promise<any[]> {
    const studentRes = await pool.query('SELECT id FROM students WHERE user_id = $1', [userId]);
    if (studentRes.rowCount === 0) return [];
    const studentId = studentRes.rows[0].id;

    const { rows } = await pool.query(
      `SELECT subject_id, feedback_type FROM feedback_submission_tracking 
       WHERE student_id = $1 AND window_id = $2`,
      [studentId, windowId]
    );
    return rows;
  }

  /**
   * Get analytics for HOD/Admin/Faculty
   */
  async getAnalytics(windowId: string, filterOptions: { departmentId?: string, facultyId?: string, subjectId?: string }): Promise<any> {
    let baseQuery = `
      SELECT 
        q.id as question_id,
        q.text as question_text,
        q.type as question_type,
        q.options as question_options,
        COUNT(a.id)::int as total_responses,
        ROUND(AVG(a.rating_value), 2) as average_rating
      FROM feedback_answers a
      JOIN feedback_responses r ON a.response_id = r.id
      JOIN feedback_questions q ON a.question_id = q.id
      WHERE r.window_id = $1
    `;

    const params: any[] = [windowId];
    let paramIndex = 2;

    if (filterOptions.facultyId) {
      baseQuery += ` AND r.faculty_id = $${paramIndex++}`;
      params.push(filterOptions.facultyId);
    }
    
    if (filterOptions.subjectId) {
      baseQuery += ` AND r.subject_id = $${paramIndex++}`;
      params.push(filterOptions.subjectId);
    }
    
    if (filterOptions.departmentId) {
      // HOD filtering for their department
      baseQuery += ` AND r.faculty_id IN (SELECT id FROM faculty WHERE department_id = $${paramIndex++})`;
      params.push(filterOptions.departmentId);
    }

    baseQuery += ` GROUP BY q.id, q.text, q.type, q.options`;

    const { rows } = await pool.query(baseQuery, params);

    for (const row of rows) {
      if (row.question_type === 'text') {
        const textRes = await pool.query(
          `SELECT a.text_value, a.id, r.created_at
           FROM feedback_answers a
           JOIN feedback_responses r ON a.response_id = r.id
           WHERE a.question_id = $1 AND r.window_id = $2 AND a.text_value IS NOT NULL AND a.text_value != ''`,
          [row.question_id, windowId]
        );
        row.text_comments = textRes.rows;
      }
    }

    return rows;
  }
}

export const feedbackService = new FeedbackService();
