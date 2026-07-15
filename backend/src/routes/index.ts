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
import mentorshipRouter from './mentorship.routes';
import mentorGroupsRouter from './mentorGroup.routes';
import teachingPlanRouter from './teachingPlan.routes';
import analyticsRouter from './analytics.routes';
import reportRouter from './report.routes';
import feedbackRouter from './feedback.routes';
import facultyOperationsRouter from './facultyOperations.routes';
import workflowRuleRouter from './workflowRule.routes';
import experienceRouter from './experience.routes';
import examRoomRouter from './examRoom.routes';
import examSeatingRouter from './examSeating.routes';
import examInvigilationRouter from './examInvigilation.routes';
import seatingPatternRouter from './seatingPattern.routes';
import examSessionRouter from './examSession.routes';

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
router.use('/mentorship', mentorshipRouter);
router.use('/mentor-groups', mentorGroupsRouter);
router.use('/teaching-plans', teachingPlanRouter);
router.use('/analytics', analyticsRouter);
router.use('/reports', reportRouter);
router.use('/feedback', feedbackRouter);
router.use('/faculty-operations', facultyOperationsRouter);
router.use('/workflow', workflowRuleRouter);
router.use('/experience', experienceRouter);
router.use('/exam-rooms', examRoomRouter);
router.use('/exam-seating', examSeatingRouter);
router.use('/exam-invigilation', examInvigilationRouter);
router.use('/seating-patterns', seatingPatternRouter);
router.use('/exam-sessions', examSessionRouter);

// Reference implementation for auth middleware patterns
router.use('/example', protectedRouter);

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: { status: 'ok', timestamp: new Date().toISOString() },
  });
});

export default router;
