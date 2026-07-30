import { Router } from 'express';
import * as timetableController from '../controllers/timetable.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';

const router = Router();

router.use(authenticate);

// List student's active timetable
router.get('/student/active', requireRole('student'), timetableController.getStudentActive);

// List faculty's schedule
router.get('/faculty/schedule', requireRole('faculty'), timetableController.getFacultySchedule);

// CRUD operations
router.post('/', requireRole('admin'), timetableController.create);
router.get('/', requireRole('admin', 'faculty', 'student'), timetableController.list);
router.get('/:id', requireRole('admin', 'faculty', 'student'), timetableController.getById);
router.put('/:id', requireRole('admin'), timetableController.update);
router.delete('/:id', requireRole('admin'), timetableController.remove);

// Validation & Publication flows
router.post('/validate-input', requireRole('admin'), timetableController.validateInput);
router.post('/:id/publish', requireRole('admin'), timetableController.publish);

export default router;
