import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';

const router = Router();

router.use(authenticate);

// GET /api/dashboard/admin — aggregated institutional statistics for admin
router.get('/admin', requireRole('admin'), dashboardController.adminDashboard);

// GET /api/dashboard/faculty/:userId? — workload + pending-task summary for the faculty member
router.get('/faculty/:userId?', requireRole('faculty', 'admin'), dashboardController.facultyDashboard);

// GET /api/dashboard/hod/:userId? — department metrics summary for HOD
router.get('/hod/:userId?', requireRole('faculty', 'admin'), dashboardController.hodDashboard);

// GET /api/dashboard/student/:userId? — attendance, fees, results, and events for the student
router.get('/student/:userId?', requireRole('student', 'faculty', 'admin'), dashboardController.studentDashboard);

// GET /api/dashboard/accountant — financial metrics summary for Accountant
router.get('/accountant', requireRole('accountant'), dashboardController.accountantDashboard);

export default router;