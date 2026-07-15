import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';
import { 
  authorizeMentoringHead, 
  authorizeStudentMentorshipAccess, 
  authorizeNoteAccess 
} from '../middleware/mentorshipAuth';
import * as mentorshipController from '../controllers/mentorship.controller';
import { query } from '../config/database';
import { AppError } from '../errors/AppError';

const router = Router();

// Apply authenticate middleware to all routes
router.use(authenticate);

// Custom helper middleware for GET /mentor/:id
async function authorizeMentorSelfOrHead(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      return next(AppError.unauthorized());
    }

    if (req.user.role === 'admin') {
      return next();
    }

    let isHead = false;
    let facultyId = req.user.facultyId;

    if (req.user.role === 'faculty') {
      const result = await query<{ id: string; is_mentoring_head: boolean }>(
        'SELECT id, is_mentoring_head FROM faculty WHERE user_id = $1 AND deleted_at IS NULL',
        [req.user.id]
      );
      if (result.rows[0]) {
        isHead = result.rows[0].is_mentoring_head;
        facultyId = result.rows[0].id;
      }
    }

    if (isHead) {
      return next();
    }

    if (req.user.role === 'faculty' && facultyId === req.params.id) {
      return next();
    }

    return next(AppError.forbidden('You can only view your own mentees', 'NOT_OWN_MENTEES'));
  } catch (err) {
    next(err);
  }
}

// ── Mentor Assignment Endpoints ───────────────────────────────────────────────
router.post('/assign', authorizeMentoringHead, mentorshipController.assignMentor);
router.put('/reassign', authorizeMentoringHead, mentorshipController.reassignMentor);
router.get('/mentor/:id', authorizeMentorSelfOrHead, mentorshipController.getStudentsByMentor);
router.get('/student/:id', authorizeStudentMentorshipAccess('params', 'id'), mentorshipController.getMentorByStudent);

// ── Mentoring Dashboard ───────────────────────────────────────────────────────
router.get('/dashboard', requireRole('faculty'), mentorshipController.getMentorDashboard);

// ── Workload & Reports ────────────────────────────────────────────────────────
router.get('/workloads', authorizeMentoringHead, mentorshipController.getMentorWorkloads);
router.get('/reports', authorizeMentoringHead, mentorshipController.getMentorshipReports);

// ── Mentoring Notes Endpoints ──────────────────────────────────────────────────
router.post('/notes', authorizeStudentMentorshipAccess('body', 'studentId'), mentorshipController.addNote);
router.put('/notes/:id', authorizeNoteAccess, mentorshipController.updateNote);
router.delete('/notes/:id', authorizeNoteAccess, mentorshipController.deleteNote);
router.get('/notes/student/:id', authorizeStudentMentorshipAccess('params', 'id'), mentorshipController.getNotesByStudent);

export default router;
