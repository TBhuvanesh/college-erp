import { Router } from 'express';
import { z } from 'zod';
import * as examSeatingController from '../controllers/examSeating.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import {
  generateSeatingSchema,
  listSlotsQuerySchema,
  swapSeatsSchema,
  moveSeatSchema,
  lockSeatSchema,
  searchSeatingQuerySchema,
  seatingAnalyticsQuerySchema,
} from '../types/examSeating';

const router = Router();

const uuidParam = { params: z.object({ id: z.string().uuid('Invalid seat allocation ID') }) };

router.use(authenticate);

// GET /api/exam-seating/slots — admin/HOD, to pick which exams to seat together
router.get('/slots', requireRole('admin', 'faculty'), validate({ query: listSlotsQuerySchema }), examSeatingController.getExamSlots);

// POST /api/exam-seating/generate — admin/HOD (HOD scoped to own department in the service)
router.post(
  '/generate',
  requireRole('admin', 'faculty'),
  validate({ body: generateSeatingSchema }),
  examSeatingController.generateSeating
);

// POST /api/exam-seating/check-conflicts — dry-run validation before generation
router.post(
  '/check-conflicts',
  requireRole('admin', 'faculty'),
  validate({ body: generateSeatingSchema }),
  examSeatingController.checkConflicts
);

// GET /api/exam-seating/search — roll number/name/room/building/invigilator/bench search
router.get(
  '/search',
  requireRole('admin', 'faculty'),
  validate({ query: searchSeatingQuerySchema }),
  examSeatingController.searchSeating
);

// GET /api/exam-seating/analytics
router.get(
  '/analytics',
  requireRole('admin', 'faculty'),
  validate({ query: seatingAnalyticsQuerySchema }),
  examSeatingController.getSeatingAnalytics
);

// POST /api/exam-seating/swap — manual adjustment: swap two allocations
router.post('/swap', requireRole('admin', 'faculty'), validate({ body: swapSeatsSchema }), examSeatingController.swapSeats);

// POST /api/exam-seating/move — manual adjustment: move one allocation
router.post('/move', requireRole('admin', 'faculty'), validate({ body: moveSeatSchema }), examSeatingController.moveSeat);

// PUT /api/exam-seating/:id/lock — manual adjustment: lock/unlock one allocation
router.put(
  '/:id/lock',
  requireRole('admin', 'faculty'),
  validate({ params: uuidParam.params, body: lockSeatSchema }),
  examSeatingController.lockSeat
);

// GET /api/exam-seating/me — student's own upcoming seat assignments
router.get('/me', requireRole('student'), examSeatingController.getMySeating);

// GET /api/exam-seating/exam/:examId — room-wise chart for one exam (access scoped in the service)
router.get(
  '/exam/:examId',
  validate({ params: z.object({ examId: z.string().uuid('Invalid exam ID') }) }),
  examSeatingController.getSeatingByExam
);

// GET /api/exam-seating/room/:roomId?date=YYYY-MM-DD — a room's seating (access scoped in the service)
router.get(
  '/room/:roomId',
  validate({ params: z.object({ roomId: z.string().uuid('Invalid room ID') }) }),
  examSeatingController.getSeatingByRoom
);

export default router;
