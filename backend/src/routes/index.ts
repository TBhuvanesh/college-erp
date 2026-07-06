import { Router } from 'express';
import type { Request, Response } from 'express';
import authRouter from './auth.routes';
import protectedRouter from './protected.routes';
import departmentsRouter from './departments.routes';
import studentsRouter from './students.routes';
import facultyRouter from './faculty.routes';
import subjectsRouter from './subjects.routes';
import attendanceRouter from './attendance.routes';
import internalMarksRouter from './internal-marks.routes';
import examinationsRouter from './examination.routes';
import resultsRouter from './result.routes';
import feesRouter from './fee.routes';
import announcementsRouter from './announcement.routes';
import documentsRouter from './document.routes';
import parsedEventsRouter from './parsedEvent.routes';
import academicCalendarRouter from './academicCalendar.routes';
import dashboardRouter from './dashboard.routes';
import profileRouter from './profile.routes';
import searchRouter from './search.routes';
import materialRouter from './material.routes';
import lmsAssignmentRouter from './lmsAssignment.routes';
import lmsSubmissionRouter from './lmsSubmission.routes';
import opportunityHubRouter from './opportunityHub.routes';
import notificationRouter from './notification.routes';
import calendarEntryRouter from './calendarEntry.routes';
import accountantRouter from './accountant.routes';

const router = Router();

router.use('/auth', authRouter);
router.use('/search', searchRouter);
router.use('/profile', profileRouter);
router.use('/dashboard', dashboardRouter);
router.use('/accountants', accountantRouter);
router.use('/departments', departmentsRouter);
router.use('/students', studentsRouter);
router.use('/faculty', facultyRouter);
router.use('/subjects', subjectsRouter);
router.use('/attendance', attendanceRouter);
router.use('/internal-marks', internalMarksRouter);
router.use('/examinations', examinationsRouter);
router.use('/results', resultsRouter);
router.use('/fees', feesRouter);
router.use('/announcements', announcementsRouter);
router.use('/documents', documentsRouter);
router.use('/parsed-events', parsedEventsRouter);
router.use('/calendar', academicCalendarRouter);
router.use('/lms/materials', materialRouter);
router.use('/lms/assignments', lmsAssignmentRouter);
router.use('/lms/submissions', lmsSubmissionRouter);
router.use('/opportunities', opportunityHubRouter);
router.use('/notifications', notificationRouter);
router.use('/calendar-entries', calendarEntryRouter);

// Reference implementation for auth middleware patterns
router.use('/example', protectedRouter);

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: { status: 'ok', timestamp: new Date().toISOString() },
  });
});

export default router;
