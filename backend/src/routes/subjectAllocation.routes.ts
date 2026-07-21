import { Router } from 'express';
import * as controller from '../controllers/subjectAllocation.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';

const router = Router();

// Secure all endpoints with authentication
router.use(authenticate);

// Read-only/dashboard endpoints accessible to Admins, HODs, and Faculty
router.get('/', controller.listAllocations);
router.get('/statistics', controller.getStatistics);
router.get('/subject/:subjectId/profile', controller.getSubjectProfile);
router.get('/:id', controller.getAllocation);

// Management endpoints restricted to Admins only
router.post('/', requireRole('admin'), controller.createAllocation);
router.put('/:id', requireRole('admin'), controller.updateAllocation);
router.post('/:id/transfer', requireRole('admin'), controller.transferAllocation);
router.delete('/:id', requireRole('admin'), controller.deleteAllocation);

export default router;
