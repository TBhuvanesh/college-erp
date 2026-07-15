import { Router } from 'express';
import { z } from 'zod';
import * as examSessionController from '../controllers/examSession.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { createExamSessionSchema, updateExamSessionSchema, listExamSessionsQuerySchema } from '../types/examSeating';

const router = Router();

const uuidParam = { params: z.object({ id: z.string().uuid('Invalid exam session ID') }) };

router.use(authenticate);
router.use(requireRole('admin', 'faculty')); // HOD scoping enforced in the service

router.get('/', validate({ query: listExamSessionsQuerySchema }), examSessionController.listExamSessions);
router.get('/:id', validate(uuidParam), examSessionController.getExamSession);
router.post('/', validate({ body: createExamSessionSchema }), examSessionController.createExamSession);
router.put('/:id', validate({ params: uuidParam.params, body: updateExamSessionSchema }), examSessionController.updateExamSession);
router.delete('/:id', validate(uuidParam), examSessionController.deleteExamSession);

router.post('/:id/resolve-exams', validate(uuidParam), examSessionController.resolveExams);
router.post('/:id/check-conflicts', validate(uuidParam), examSessionController.checkConflicts);
router.post('/:id/generate-seating', validate(uuidParam), examSessionController.generateSeating);
router.post('/:id/generate-invigilation', validate(uuidParam), examSessionController.generateInvigilation);
router.post('/:id/validate', validate(uuidParam), examSessionController.validateExamSession);
router.post('/:id/publish', validate(uuidParam), examSessionController.publishExamSession);
router.post('/:id/complete', validate(uuidParam), examSessionController.completeExamSession);
router.post('/:id/archive', validate(uuidParam), examSessionController.archiveExamSession);

export default router;
