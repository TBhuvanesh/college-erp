import { Router } from 'express';
import * as reportController from '../controllers/report.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { reportFiltersSchema, exportQuerySchema } from '../types/report';

const router = Router();

router.use(authenticate);

const filtersValidator = validate({ query: reportFiltersSchema });

// Institution/department/class-level reports — admin (unrestricted) and faculty
// (own department if HOD, own assigned data otherwise; enforced in report.service.ts).
router.get('/attendance', requireRole('admin', 'faculty'), filtersValidator, reportController.getAttendanceReport);
router.get('/results', requireRole('admin', 'faculty'), filtersValidator, reportController.getResultsReport);
router.get('/fees', requireRole('admin', 'faculty'), filtersValidator, reportController.getFeesReport);
router.get('/lms', requireRole('admin', 'faculty'), filtersValidator, reportController.getLmsReport);
router.get('/mentorship', requireRole('admin', 'faculty'), filtersValidator, reportController.getMentorshipReport);
router.get('/department', requireRole('admin', 'faculty'), filtersValidator, reportController.getDepartmentReport);
router.get('/opportunities', requireRole('admin', 'faculty'), filtersValidator, reportController.getOpportunitiesReport);
router.get('/teaching', requireRole('admin', 'faculty'), filtersValidator, reportController.getTeachingReport);

// Exam Seating & Invigilation Print Center — admin/HOD/faculty (scoped in the service)
router.get('/room-seating-chart', requireRole('admin', 'faculty'), filtersValidator, reportController.getRoomSeatingChartReport);
router.get('/student-seating-list', requireRole('admin', 'faculty'), filtersValidator, reportController.getStudentSeatingListReport);
router.get('/invigilator-sheet', requireRole('admin', 'faculty'), filtersValidator, reportController.getInvigilatorSheetReport);
router.get('/seating-attendance-sheet', requireRole('admin', 'faculty'), filtersValidator, reportController.getSeatingAttendanceSheetReport);
router.get('/seating-summary', requireRole('admin', 'faculty'), filtersValidator, reportController.getSeatingSummaryReport);

// Student report — admin/faculty may inspect any (scoped) student; a student may
// only ever see their own (enforced in report.service.ts::getStudentReport).
router.get('/student', requireRole('admin', 'faculty', 'student'), filtersValidator, reportController.getStudentReport);

// Export — same access as the report endpoints; reportType selects which report to render.
const exportValidator = validate({ query: exportQuerySchema });
router.get('/export/pdf', requireRole('admin', 'faculty'), exportValidator, reportController.exportPdf);
router.get('/export/excel', requireRole('admin', 'faculty'), exportValidator, reportController.exportExcel);
router.get('/export/csv', requireRole('admin', 'faculty'), exportValidator, reportController.exportCsv);

export default router;
