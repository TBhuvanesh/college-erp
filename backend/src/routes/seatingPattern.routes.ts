import { Router } from 'express';
import { z } from 'zod';
import * as seatingPatternController from '../controllers/seatingPattern.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { createSeatingPatternSchema, updateSeatingPatternSchema, listSeatingPatternsQuerySchema } from '../types/examSeating';

const router = Router();

const uuidParam = { params: z.object({ id: z.string().uuid('Invalid seating pattern ID') }) };

router.use(authenticate);

// All authenticated roles may view (needed to pick a pattern in the seating UI)
router.get('/', validate({ query: listSeatingPatternsQuerySchema }), seatingPatternController.listSeatingPatterns);
router.get('/:id', validate(uuidParam), seatingPatternController.getSeatingPattern);

// Pattern management — admin only
router.post('/', requireRole('admin'), validate({ body: createSeatingPatternSchema }), seatingPatternController.createSeatingPattern);
router.put(
  '/:id',
  requireRole('admin'),
  validate({ params: uuidParam.params, body: updateSeatingPatternSchema }),
  seatingPatternController.updateSeatingPattern
);
router.delete('/:id', requireRole('admin'), validate(uuidParam), seatingPatternController.deleteSeatingPattern);

export default router;
