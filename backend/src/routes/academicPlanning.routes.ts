import { Router } from 'express';
import * as controller from '../controllers/academicPlanning.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';

const router = Router();

router.use(authenticate);
router.use(requireRole('admin'));

router.get('/gaps', controller.getGaps);
router.get('/faculty-capacity', controller.getFacultyCapacity);
router.get('/report', controller.getReport);
router.post('/teaching-assignments/generate', controller.generateTeachingAssignments);
router.post('/mentors/generate', controller.generateMentors);

export default router;
