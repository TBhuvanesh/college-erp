import { Router } from 'express';
import { z } from 'zod';
import * as examRoomController from '../controllers/examRoom.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import {
  createExamRoomSchema,
  updateExamRoomSchema,
  listExamRoomsQuerySchema,
  availabilityQuerySchema,
  roomSuggestionQuerySchema,
} from '../types/examSeating';

const router = Router();

const uuidParam = { params: z.object({ id: z.string().uuid('Invalid exam room ID') }) };

router.use(authenticate);

// Resource Availability Engine — registered before /:id so these literal paths win.
router.get('/availability', requireRole('admin', 'faculty'), validate({ query: availabilityQuerySchema }), examRoomController.listRoomAvailability);
router.get('/suggest', requireRole('admin', 'faculty'), validate({ query: roomSuggestionQuerySchema }), examRoomController.suggestRooms);

// GET /api/exam-rooms — all authenticated roles may view (needed to pick a room in the seating UI)
router.get('/', validate({ query: listExamRoomsQuerySchema }), examRoomController.listExamRooms);
router.get('/:id', validate(uuidParam), examRoomController.getExamRoom);

// Room infrastructure management — admin only
router.post('/', requireRole('admin'), validate({ body: createExamRoomSchema }), examRoomController.createExamRoom);
router.put(
  '/:id',
  requireRole('admin'),
  validate({ params: uuidParam.params, body: updateExamRoomSchema }),
  examRoomController.updateExamRoom
);
router.delete('/:id', requireRole('admin'), validate(uuidParam), examRoomController.deleteExamRoom);

export default router;
