import { Router } from 'express';
import * as controller from '../controllers/teachingAssignment.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { resolveSubjectsForAssignmentQuerySchema } from '../types/teachingAssignment';

const router = Router();

router.use(authenticate);

// Read-only/dashboard endpoints accessible to Admins, HODs, and Faculty
router.get('/', controller.listTeachingAssignments);
router.get('/my', controller.getMyTeachingAssignments);
router.get('/statistics', controller.getStatistics);
router.get('/workload-overview', controller.getFacultyWorkloadOverview);
router.get('/subjects', validate({ query: resolveSubjectsForAssignmentQuerySchema }), controller.resolveSubjectsForAssignment);
router.get('/subject/:subjectId/profile', controller.getSubjectProfile);
router.get('/:id', controller.getTeachingAssignment);

// Management endpoints restricted to Admins only
router.post('/', requireRole('admin'), controller.createTeachingAssignment);
router.put('/:id', requireRole('admin'), controller.updateTeachingAssignment);
router.post('/:id/transfer', requireRole('admin'), controller.transferTeachingAssignment);
router.delete('/:id', requireRole('admin'), controller.deleteTeachingAssignment);

export default router;
