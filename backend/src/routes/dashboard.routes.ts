import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';

const router = Router();

router.use(authenticate);

// GET /api/dashboard/admin — aggregated institutional statistics for admin
router.get('/admin', requireRole('admin'), dashboardController.adminDashboard);

// GET /api/dashboard/faculty — workload + pending-task summary for the requesting faculty member
router.get('/faculty', requireRole('faculty'), dashboardController.facultyDashboard);

// GET /api/dashboard/hod — department metrics summary for HOD
router.get('/hod', requireRole('faculty'), dashboardController.hodDashboard);

// GET /api/dashboard/student — attendance, fees, results, and events for the requesting student
router.get('/student', requireRole('student'), dashboardController.studentDashboard);

// GET /api/dashboard/accountant — financial metrics summary for Accountant
router.get('/accountant', requireRole('accountant'), dashboardController.accountantDashboard);

export default router;