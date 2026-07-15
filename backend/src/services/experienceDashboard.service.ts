import { query } from '../config/database';
import { AppError } from '../errors/AppError';
import * as roadmapService from './teachingPlanRoadmap.service';
import * as analyticsService from './analytics.service';
import * as facultyOperationsService from './facultyOperations.service';
import { buildStudentTimeline, buildFacultyTimeline } from './timelineEngine.service';
import { buildStudentActions, buildFacultyActions } from './actionEngine.service';
import { listAssignments } from './lmsAssignment.service';
import { listMaterials } from './material.service';
import { listSubmissions } from './lmsSubmission.service';
import { getStudentFees } from './fee.service';
import { getStudentSummary as getAttendanceSummary } from './attendance.service';
import { getMentorByStudent, getNotesByStudent } from './mentorship.service';
import { listOpportunities, listBookmarks } from './opportunityHub.service';
import { listCalendarEntries } from './calendarEntry.service';
import type { Role } from '../types/roles';
import type {
  TimelineEvent,
  TodayWidget,
  WeekView,
  WeekDayGroup,
  TrendWidget,
  Insight,
  DashboardWidgetsQuery,
} from '../types/experience';

// ── Today Widget (student) ────────────────────────────────────────────────────

export async function getStudentTodayWidget(userId: string): Promise<TodayWidget> {
  const lessons = await roadmapService.getTodayLessons(userId, 'student', {});
  const first = lessons[0] ?? null;

  return {
    date: new Date().toISOString().slice(0, 10),
    currentSubject: first
      ? {
          subjectId: first.subjectId,
          subjectCode: first.subjectCode,
          subjectName: first.subjectName,
          facultyName: first.facultyName,
          topic: first.topicTitle,
          homework: first.homework,
          quizPlanned: first.quizPlanned,
          materialTitle: first.materialTitle,
          materialDownloadUrl: first.materialDownloadUrl,
          assignmentTitle: first.assignmentTitle,
          assignmentDueDate: first.assignmentDueDate ? new Date(first.assignmentDueDate).toISOString() : null,
        }
      : null,
    allTodayLessons: lessons.length,
  };
}

// ── Week View (student / faculty) ────────────────────────────────────────────

function groupByDay(events: TimelineEvent[], from: Date, days: number): WeekDayGroup[] {
  const groups: WeekDayGroup[] = [];
  for (let i = 0; i < days; i++) {
    const dayKey = new Date(from.getTime() + i * 86_400_000).toISOString().slice(0, 10);
    groups.push({ date: dayKey, events: events.filter((e) => e.timestamp.slice(0, 10) === dayKey) });
  }
  return groups;
}

export async function getStudentWeek(userId: string): Promise<WeekView> {
  const from = new Date();
  const events = await buildStudentTimeline(userId, 7);
  return {
    from: from.toISOString().slice(0, 10),
    to: new Date(from.getTime() + 7 * 86_400_000).toISOString().slice(0, 10),
    days: groupByDay(events, from, 7),
  };
}

// ── Mentorship / LMS / Opportunity / Calendar summaries (student) ───────────

async function getStudentMentorshipSummary(userId: string) {
  const { rows } = await query<{ id: string }>('SELECT id FROM students WHERE user_id = $1 AND deleted_at IS NULL', [userId]);
  if (!rows[0]) throw AppError.forbidden('No student profile is linked to this account');

  const mentor = await getMentorByStudent(rows[0].id);
  const notes = await getNotesByStudent(rows[0].id);
  const nextMeeting = notes
    .filter((n) => n.followUpDate && new Date(n.followUpDate) >= new Date())
    .sort((a, b) => new Date(a.followUpDate!).getTime() - new Date(b.followUpDate!).getTime())[0] ?? null;

  return { mentor, nextMeeting: nextMeeting ? { noteId: nextMeeting.id, title: nextMeeting.title, followUpDate: nextMeeting.followUpDate } : null };
}

async function getStudentLmsSummary(userId: string) {
  const [materialsRes, assignmentsRes] = await Promise.all([
    listMaterials(userId, 'student', { page: 1, limit: 5 } as never),
    listAssignments(userId, 'student', { page: 1, limit: 100 } as never),
  ]);

  const now = new Date();
  const dueSoon = assignmentsRes.assignments.filter((a) => new Date(a.dueDate) >= now).length;
  const overdue = assignmentsRes.assignments.filter((a) => new Date(a.dueDate) < now).length;

  return {
    recentMaterials: materialsRes.materials,
    assignmentProgress: { total: assignmentsRes.total, dueSoon, overdue },
  };
}

async function getStudentOpportunitySummary(userId: string) {
  const [activeRes, bookmarksRes] = await Promise.all([
    listOpportunities(userId, 'student', { page: 1, limit: 100 } as never),
    listBookmarks(userId, { page: 1, limit: 100 }),
  ]);

  const now = Date.now();
  const closingSoon = activeRes.opportunities.filter((o) => o.deadline && new Date(o.deadline).getTime() - now <= 7 * 86_400_000);

  return {
    recommended: activeRes.opportunities.slice(0, 5),
    saved: bookmarksRes.opportunities,
    closingSoon,
    upcomingDeadlines: activeRes.opportunities
      .filter((o) => o.deadline)
      .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
      .slice(0, 5),
  };
}

async function getCalendarSummary(userId: string, role: Role) {
  const now = new Date();
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  const tomorrowStart = new Date(todayEnd.getTime() + 1);
  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setHours(23, 59, 59, 999);
  const weekEnd = new Date(now.getTime() + 7 * 86_400_000);

  const res = await listCalendarEntries(userId, role, { page: 1, limit: 50, from: now.toISOString(), to: weekEnd.toISOString() } as never);

  return {
    today: res.entries.filter((e) => new Date(e.startDate) <= todayEnd),
    tomorrow: res.entries.filter((e) => new Date(e.startDate) >= tomorrowStart && new Date(e.startDate) <= tomorrowEnd),
    thisWeek: res.entries,
    upcomingDeadlines: res.entries.filter((e) => e.eventType === 'Assignment Deadline' || e.eventType === 'Examination'),
  };
}

// ── Dashboard Insights — rule-based, no AI ───────────────────────────────────

export function generateInsights(events: TimelineEvent[]): Insight[] {
  const insights: Insight[] = [];
  const now = new Date();
  const tomorrowKey = new Date(now.getTime() + 86_400_000).toDateString();

  const attendanceAlerts = events.filter((e) => e.category === 'attendance');
  if (attendanceAlerts.length > 0) {
    insights.push({ icon: '⚠', message: `Attendance below 75% in ${attendanceAlerts.length} subject(s)`, priority: 'high' });
  }

  const assignmentsDueTomorrow = events.filter((e) => e.category === 'assignment' && new Date(e.timestamp).toDateString() === tomorrowKey);
  if (assignmentsDueTomorrow.length > 0) {
    insights.push({ icon: '📚', message: `${assignmentsDueTomorrow.length} assignment(s) due tomorrow`, priority: 'medium' });
  }

  const newOpportunities = events.filter((e) => e.category === 'opportunity');
  if (newOpportunities.length > 0) {
    insights.push({ icon: '🎓', message: `${newOpportunities.length} opportunity deadline(s) approaching`, priority: 'low' });
  }

  const feeSoon = events
    .filter((e) => e.category === 'fee')
    .filter((e) => {
      const days = (new Date(e.timestamp).getTime() - now.getTime()) / 86_400_000;
      return days >= 0 && days <= 3;
    });
  if (feeSoon.length > 0) {
    const days = Math.ceil((new Date(feeSoon[0].timestamp).getTime() - now.getTime()) / 86_400_000);
    insights.push({ icon: '💰', message: `Fee deadline in ${days} day(s)`, priority: 'high' });
  }

  const meetingTomorrow = events.filter((e) => e.category === 'mentorship' && new Date(e.timestamp).toDateString() === tomorrowKey);
  if (meetingTomorrow.length > 0) {
    insights.push({ icon: '📅', message: 'Mentor meeting tomorrow', priority: 'medium' });
  }

  const materialNotifications = events.filter(
    (e) => e.category === 'notification' && /material|notes|upload/i.test(e.title)
  );
  if (materialNotifications.length > 0) {
    insights.push({ icon: '📖', message: 'New notes uploaded', priority: 'low' });
  }

  const quizzesUpcoming = events.filter((e) => e.category === 'quiz');
  if (quizzesUpcoming.length > 0) {
    insights.push({ icon: '📝', message: `${quizzesUpcoming.length} quiz(zes) scheduled`, priority: 'medium' });
  }

  return insights;
}

// ── Smart Dashboard Widget Generator ─────────────────────────────────────────

async function computeAttendanceTrend(userId: string): Promise<number | null> {
  const { rows } = await query<{ period: string; total: string; present: string }>(
    `SELECT
       CASE WHEN a.attendance_date >= CURRENT_DATE - INTERVAL '30 days' THEN 'recent' ELSE 'prior' END AS period,
       COUNT(*)::text AS total, COUNT(*) FILTER (WHERE a.status = 'present')::text AS present
     FROM attendance a JOIN students st ON st.id = a.student_id
     WHERE st.user_id = $1 AND a.attendance_date >= CURRENT_DATE - INTERVAL '60 days'
     GROUP BY period`,
    [userId]
  );
  const recent = rows.find((r) => r.period === 'recent');
  const prior = rows.find((r) => r.period === 'prior');
  if (!recent || !prior || Number(prior.total) === 0 || Number(recent.total) === 0) return null;

  const recentPct = (Number(recent.present) / Number(recent.total)) * 100;
  const priorPct = (Number(prior.present) / Number(prior.total)) * 100;
  return Math.round((recentPct - priorPct) * 100) / 100;
}

async function buildStudentWidgets(userId: string): Promise<TrendWidget[]> {
  const [attendanceSummary, assignmentsRes, fees, opportunitiesRes, trend] = await Promise.all([
    getAttendanceSummary(userId),
    listAssignments(userId, 'student', { page: 1, limit: 100 } as never),
    getStudentFees(userId, {}),
    listOpportunities(userId, 'student', { page: 1, limit: 100 } as never),
    computeAttendanceTrend(userId),
  ]);

  const lowestSubject = [...attendanceSummary.subjects].sort((a, b) => a.percentage - b.percentage)[0] ?? null;
  const todayKey = new Date().toDateString();
  const dueToday = assignmentsRes.assignments.filter((a) => new Date(a.dueDate).toDateString() === todayKey).length;

  const totalFee = fees.reduce((s, f) => s + f.totalAmount, 0);
  const paidFee = fees.reduce((s, f) => s + f.paidAmount, 0);
  const pendingFeeCount = fees.filter((f) => f.pendingAmount > 0).length;

  const closingSoon = opportunitiesRes.opportunities.filter(
    (o) => o.deadline && new Date(o.deadline).getTime() - Date.now() <= 7 * 86_400_000
  ).length;

  return [
    {
      key: 'attendance',
      label: 'Attendance',
      value: attendanceSummary.overall.percentage,
      unit: '%',
      trend,
      context: lowestSubject ? `Lowest Subject: ${lowestSubject.subjectName}` : null,
    },
    {
      key: 'assignments',
      label: 'Assignments',
      value: assignmentsRes.total,
      unit: 'count',
      trend: null,
      context: null,
      extra: { dueToday },
    },
    {
      key: 'fees',
      label: 'Fees Collected',
      value: totalFee > 0 ? Math.round((paidFee / totalFee) * 10000) / 100 : 100,
      unit: '%',
      trend: null,
      context: null,
      extra: { pendingCount: pendingFeeCount },
    },
    {
      key: 'opportunities',
      label: 'Opportunities',
      value: opportunitiesRes.total,
      unit: 'count',
      trend: null,
      context: null,
      extra: { closingSoon },
    },
  ];
}

async function buildFacultyWidgets(userId: string): Promise<TrendWidget[]> {
  const a = await analyticsService.getFacultyAnalytics(userId);
  return [
    { key: 'syllabus', label: 'Syllabus Completion', value: a.teachingOverview.syllabusCompletion, unit: '%', trend: null, context: null },
    {
      key: 'assignments',
      label: 'Assignments',
      value: a.teachingOverview.assignmentsCreated,
      unit: 'count',
      trend: null,
      context: null,
      extra: { submissionPercentage: a.teachingOverview.assignmentSubmissionPercentage },
    },
    { key: 'attendance', label: 'Student Attendance', value: a.teachingOverview.studentAttendance, unit: '%', trend: null, context: null },
    {
      key: 'mentees_at_risk',
      label: 'Students Requiring Attention',
      value: a.mentorDashboard.studentsAtRisk,
      unit: 'count',
      trend: null,
      context: null,
      extra: {
        lowAttendance: a.mentorDashboard.lowAttendance,
        feePending: a.mentorDashboard.feePending,
        assignmentPending: a.mentorDashboard.assignmentPending,
      },
    },
  ];
}

async function buildHodWidgets(userId: string): Promise<TrendWidget[]> {
  const h = await analyticsService.getHodAnalytics(userId);
  return [
    { key: 'department_attendance', label: 'Department Attendance', value: h.departmentAttendance, unit: '%', trend: null, context: h.departmentName },
    { key: 'teaching_progress', label: 'Department Teaching Progress', value: h.teachingProgress.completionPercentage, unit: '%', trend: null, context: null },
    { key: 'fee_pending', label: 'Fee Pending Students', value: h.feePendingStudents, unit: 'count', trend: null, context: null },
    { key: 'placement', label: 'Placement Opportunities', value: h.placementOpportunities.total, unit: 'count', trend: null, context: null },
  ];
}

async function buildAdminWidgets(userId: string, departmentId?: string): Promise<TrendWidget[]> {
  const a = await analyticsService.getAdminAnalytics(userId, { departmentId });
  return [
    { key: 'attendance', label: 'Institution Attendance', value: a.academicAnalytics.averageAttendance, unit: '%', trend: null, context: null },
    { key: 'pass_rate', label: 'Pass Percentage', value: a.academicAnalytics.passPercentage, unit: '%', trend: null, context: null },
    { key: 'syllabus', label: 'Syllabus Completion', value: a.teachingAnalytics.syllabusCompletion, unit: '%', trend: null, context: null },
    { key: 'opportunities', label: 'Active Opportunities', value: a.opportunityAnalytics.activeOpportunities, unit: 'count', trend: null, context: null },
    { key: 'students_at_risk', label: 'Students At Risk', value: a.mentorshipAnalytics.studentsAtRisk, unit: 'count', trend: null, context: null },
  ];
}

export async function getDashboardWidgets(userId: string, role: Role, filters: DashboardWidgetsQuery): Promise<TrendWidget[]> {
  if (role === 'student') return buildStudentWidgets(userId);
  if (role === 'admin') return buildAdminWidgets(userId, filters.departmentId);
  if (role === 'faculty') {
    const { rows } = await query<{ designation: string | null }>(
      'SELECT designation FROM faculty WHERE user_id = $1 AND deleted_at IS NULL',
      [userId]
    );
    if (!rows[0]) throw AppError.forbidden('No faculty profile is linked to this account');
    return rows[0].designation === 'hod' ? buildHodWidgets(userId) : buildFacultyWidgets(userId);
  }
  throw AppError.forbidden('You do not have access to dashboard widgets');
}

// ── Top-level experience bundles ─────────────────────────────────────────────

export async function getStudentExperience(userId: string) {
  const [todayWidget, timeline, actions, widgets, mentorshipSummary, lmsSummary, opportunitySummary, calendarSummary] = await Promise.all([
    getStudentTodayWidget(userId),
    buildStudentTimeline(userId, 14),
    buildStudentActions(userId, 14),
    buildStudentWidgets(userId),
    getStudentMentorshipSummary(userId),
    getStudentLmsSummary(userId),
    getStudentOpportunitySummary(userId),
    getCalendarSummary(userId, 'student'),
  ]);

  return {
    todayWidget,
    timeline: timeline.slice(0, 25),
    actions,
    widgets,
    insights: generateInsights(timeline),
    mentorshipSummary,
    lmsSummary,
    opportunitySummary,
    calendarSummary,
  };
}

async function getFacultyLmsSummary(userId: string) {
  const { rows } = await query<{ id: string }>('SELECT id FROM faculty WHERE user_id = $1 AND deleted_at IS NULL', [userId]);
  if (!rows[0]) throw AppError.forbidden('No faculty profile is linked to this account');

  const [submissionsRes, materialsRes] = await Promise.all([
    listSubmissions(userId, 'faculty', { page: 1, limit: 5 } as never),
    listMaterials(userId, 'faculty', { page: 1, limit: 100 } as never),
  ]);

  return {
    recentSubmissions: submissionsRes.submissions,
    pendingReviews: submissionsRes.submissions.filter((s) => s.status !== 'Evaluated').length,
    materialsUploaded: materialsRes.total,
  };
}

export async function getFacultyExperience(userId: string) {
  const { rows: facRows } = await query<{ designation: string | null }>(
    'SELECT designation FROM faculty WHERE user_id = $1 AND deleted_at IS NULL',
    [userId]
  );
  if (!facRows[0]) throw AppError.forbidden('No faculty profile is linked to this account');
  const isHod = facRows[0].designation === 'hod';

  const [dashboard, timeline, actions, widgets, lmsSummary, calendarSummary] = await Promise.all([
    facultyOperationsService.getFacultyOperationsDashboard(userId),
    buildFacultyTimeline(userId),
    buildFacultyActions(userId),
    isHod ? buildHodWidgets(userId) : buildFacultyWidgets(userId),
    getFacultyLmsSummary(userId),
    getCalendarSummary(userId, 'faculty'),
  ]);

  return {
    dashboard,
    timeline,
    actions,
    widgets,
    insights: generateInsights(timeline),
    lmsSummary,
    calendarSummary,
  };
}
