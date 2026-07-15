import { Router } from 'express';
import { z } from 'zod';
import * as examInvigilationController from '../controllers/examInvigilation.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import {
  generateInvigilationSchema,
  updateInvigilationDutySchema,
  listInvigilationQuerySchema,
  invigilatorSuggestionQuerySchema,
} from '../types/examSeating';

const router = Router();

const uuidParam = { params: z.object({ id: z.string().uuid('Invalid invigilation duty ID') }) };

router.use(authenticate);

// POST /api/exam-invigilation/generate — admin/HOD (HOD scoped to own department in the service)
router.post(
  '/generate',
  requireRole('admin', 'faculty'),
  validate({ body: generateInvigilationSchema }),
  examInvigilationController.generateInvigilation
);

// GET /api/exam-invigilation/suggest — Resource Availability Engine
router.get(
  '/suggest',
  requireRole('admin', 'faculty'),
  validate({ query: invigilatorSuggestionQuerySchema }),
  examInvigilationController.suggestInvigilators
);

// GET /api/exam-invigilation — faculty (own duties), HOD (department), admin (all/filtered)
router.get(
  '/',
  requireRole('admin', 'faculty'),
  validate({ query: listInvigilationQuerySchema }),
  examInvigilationController.listInvigilationDuties
);

// PUT /api/exam-invigilation/:id — manual reassignment/cancellation
router.put(
  '/:id',
  requireRole('admin', 'faculty'),
  validate({ params: uuidParam.params, body: updateInvigilationDutySchema }),
  examInvigilationController.updateInvigilationDuty
);

export default router;
