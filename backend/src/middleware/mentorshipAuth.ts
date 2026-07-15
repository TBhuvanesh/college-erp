import type { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';
import { AppError } from '../errors/AppError';

/**
 * Authorizes if the user is an admin or a faculty member marked as is_mentoring_head.
 */
export async function authorizeMentoringHead(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      return next(AppError.unauthorized());
    }

    if (req.user.role === 'admin') {
      return next();
    }

    if (req.user.role === 'faculty') {
      const result = await query<{ is_mentoring_head: boolean }>(
        'SELECT is_mentoring_head FROM faculty WHERE user_id = $1 AND deleted_at IS NULL',
        [req.user.id]
      );
      if (result.rows[0]?.is_mentoring_head) {
        return next();
      }
    }

    return next(AppError.forbidden('Access restricted to Mentoring Heads and Admins', 'MENTORSHIP_HEAD_REQUIRED'));
  } catch (err) {
    next(err);
  }
}

/**
 * Authorizes access to student-specific mentorship data.
 * Allowed for:
 * - Admins
 * - Mentoring Heads
 * - The student themselves (if requesting their own data)
 * - The active assigned mentor for this student
 */
export function authorizeStudentMentorshipAccess(source: 'params' | 'body' | 'query', field: string) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        return next(AppError.unauthorized());
      }

      let studentId: string | undefined;
      if (source === 'params') studentId = req.params[field];
      else if (source === 'body') studentId = req.body[field];
      else if (source === 'query') studentId = req.query[field] as string;

      if (!studentId) {
        return next(AppError.badRequest(`Missing student ID in ${source}`));
      }

      // 1. Admin gets full access
      if (req.user.role === 'admin') {
        return next();
      }

      // 2. Student gets access ONLY to their own records
      if (req.user.role === 'student') {
        const studentResult = await query<{ id: string }>(
          'SELECT id FROM students WHERE user_id = $1 AND deleted_at IS NULL',
          [req.user.id]
        );
        const myStudentId = studentResult.rows[0]?.id;
        if (myStudentId && myStudentId === studentId) {
          return next();
        }
        return next(AppError.forbidden('You can only access your own mentorship records', 'NOT_OWN_RECORDS'));
      }

      // 3. Faculty check
      if (req.user.role === 'faculty') {
        const facultyResult = await query<{ id: string; is_mentoring_head: boolean }>(
          'SELECT id, is_mentoring_head FROM faculty WHERE user_id = $1 AND deleted_at IS NULL',
          [req.user.id]
        );
        const faculty = facultyResult.rows[0];
        if (!faculty) {
          return next(AppError.forbidden('Faculty profile not found'));
        }

        // Mentoring Heads get full access
        if (faculty.is_mentoring_head) {
          return next();
        }

        // Faculty mentors get access only to their assigned mentees
        const assignmentResult = await query(
          `SELECT 1
           FROM mentor_groups mg
           JOIN students s ON s.id = $2 AND s.deleted_at IS NULL
           LEFT JOIN mentor_group_students mgs ON mg.id = mgs.mentor_group_id AND mgs.deleted_at IS NULL
           WHERE mg.mentor_id = $1 AND mg.deleted_at IS NULL AND (
             (mg.assignment_method = 'manual' AND mgs.student_id = s.id)
             OR
             (mg.assignment_method = 'section' AND mg.department_id = s.department_id AND mg.semester = s.semester AND mg.section = s.section)
             OR
             (mg.assignment_method = 'range' AND mg.department_id = s.department_id AND mg.semester = s.semester AND mg.section = s.section AND s.roll_number >= mg.roll_number_start AND s.roll_number <= mg.roll_number_end)
           )
           LIMIT 1`,
          [faculty.id, studentId]
        );
        if (assignmentResult.rowCount && assignmentResult.rowCount > 0) {
          return next();
        }
        return next(AppError.forbidden('You are not assigned as the mentor for this student', 'NOT_ASSIGNED_MENTOR'));
      }

      return next(AppError.forbidden('Unauthorized role for mentorship access'));
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Authorizes access to note modifications (update/delete/view single note).
 * Allowed for:
 * - Admins
 * - Mentoring Heads
 * - The mentor who created/is assigned to the note
 */
export async function authorizeNoteAccess(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      return next(AppError.unauthorized());
    }

    const noteId = req.params.id;
    if (!noteId) {
      return next(AppError.badRequest('Missing note ID'));
    }

    // 1. Admin gets full access
    if (req.user.role === 'admin') {
      return next();
    }

    // Resolve the note details
    const noteResult = await query<{ mentor_id: string; student_id: string }>(
      'SELECT mentor_id, student_id FROM mentoring_notes WHERE id = $1 AND deleted_at IS NULL',
      [noteId]
    );
    const note = noteResult.rows[0];
    if (!note) {
      return next(AppError.notFound('Mentoring note not found'));
    }

    // 2. Faculty check
    if (req.user.role === 'faculty') {
      const facultyResult = await query<{ id: string; is_mentoring_head: boolean }>(
        'SELECT id, is_mentoring_head FROM faculty WHERE user_id = $1 AND deleted_at IS NULL',
        [req.user.id]
      );
      const faculty = facultyResult.rows[0];
      if (!faculty) {
        return next(AppError.forbidden('Faculty profile not found'));
      }

      // Mentoring Head gets full access
      if (faculty.is_mentoring_head) {
        return next();
      }

      // Note creator (the assigned mentor) gets access
      if (note.mentor_id === faculty.id) {
        return next();
      }

      return next(AppError.forbidden('You do not have permission to access this note', 'NOT_NOTE_OWNER'));
    }

    return next(AppError.forbidden('Unauthorized role for note access'));
  } catch (err) {
    next(err);
  }
}
