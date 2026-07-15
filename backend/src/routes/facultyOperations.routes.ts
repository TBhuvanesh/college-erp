import { Router } from 'express';
import * as facultyOperationsController from '../controllers/facultyOperations.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { workloadQuerySchema, facultyAnalyticsQuerySchema } from '../types/facultyOperations';
import { listWorkflowLogsQuerySchema } from '../types/workflow';

const router = Router();

router.use(authenticate);

// Faculty Operations Center — faculty's own centralized workspace.
router.get('/dashboard', requireRole('faculty'), facultyOperationsController.getDashboard);
router.get('/tasks', requireRole('faculty'), facultyOperationsController.getTasks);

// Workload — faculty (own), HOD (department), admin (institution-wide / drill-down).
router.get(
  '/workload',
  requireRole('admin', 'faculty'),
  validate({ query: workloadQuerySchema }),
  facultyOperationsController.getWorkload
);

// Workflow execution audit trail — scoped by role in the service.
router.get(
  '/workflow-logs',
  requireRole('admin', 'faculty'),
  validate({ query: listWorkflowLogsQuerySchema }),
  facultyOperationsController.getWorkflowLogsHandler
);

// Workload analytics — faculty (own), HOD (department), admin (institution-wide).
router.get(
  '/analytics',
  requireRole('admin', 'faculty'),
  validate({ query: facultyAnalyticsQuerySchema }),
  facultyOperationsController.getAnalytics
);

export default router;
