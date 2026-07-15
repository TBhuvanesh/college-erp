import { query } from '../config/database';
import { AppError } from '../errors/AppError';
import * as roadmapService from './teachingPlanRoadmap.service';
import * as facultyWorkloadService from './facultyWorkload.service';
import * as facultyTasksService from './facultyTasks.service';
import { getNotificationCount } from './notification.service';
import type { Role } from '../types/roles';
import type {
  FacultyOperationsDashboard,
  FacultyWorkload,
  WorkloadAnalytics,
  WorkloadDistributionEntry,
  WorkloadQuery,
  PendingAttendanceItem,
  PendingEvaluationItem,
  UpcomingDeadlineItem,
  MentorMeetingItem,
  UpcomingExamItem,
  CalendarSummaryItem,
} from '../types/facultyOperations';

async function resolveFacultyContext(
  userId: string
): Promise<{ id: string; departmentId: string; departmentName: string; designation: string | null }> {
  const { rows } = await query<{ id: string; department_id: string; department_name: string; designation: string | null }>(
    `SELECT f.id, f.department_id, d.name AS department_name, f.designation
     FROM faculty f JOIN departments d ON d.id = f.department_id
     WHERE f.user_id = $1 AND f.deleted_at IS NULL`,
    [userId]
  );
  if (!rows[0]) throw AppError.forbidden('No faculty profile is linked to this account');
  return { id: rows[0].id, departmentId: rows[0].department_id, departmentName: rows[0].department_name, designation: rows[0].designation };
}

// ── GET /faculty-operations/dashboard (faculty only) ─────────────────────────

export async function getFacultyOperationsDashboard(userId: string): Promise<FacultyOperationsDashboard> {
  const ctx = await resolveFacultyContext(userId);
  const facultyId = ctx.id;

  const [
    todaySchedule,
    pendingAttendanceRows,
    pendingEvaluationRows,
    upcomingDeadlineRows,
    upcomingMeetingsRows,
    overdueMeetingsRows,
    upcomingExamRows,
    teachingProgress,
    notificationSummary,
    calendarRows,
    workload,
    tasks,
  ] = await Promise.all([
    roadmapService.getTodayLessons(userId, 'faculty', {}),
    query<{ subject_id: string; subject_code: string; subject_name: string; section: string }>(
      `SELECT fsa.subject_id, s.code AS subject_code, s.name AS subject_name, fsa.section
       FROM faculty_subject_assignments fsa
       JOIN subjects s ON s.id = fsa.subject_id
       WHERE fsa.faculty_id = $1 AND fsa.is_active = TRUE AND fsa.deleted_at IS NULL AND s.deleted_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM attendance a WHERE a.subject_id = fsa.subject_id AND a.section = fsa.section
             AND a.faculty_id = $1 AND a.attendance_date = CURRENT_DATE
         )`,
      [facultyId]
    ),
    query<{ assignment_id: string; assignment_title: string; subject_code: string; pending_count: string }>(
      `SELECT a.id AS assignment_id, a.title AS assignment_title, s.code AS subject_code, COUNT(asub.id)::text AS pending_count
       FROM assignments a
       JOIN subjects s ON s.id = a.subject_id
       JOIN assignment_submissions asub ON asub.assignment_id = a.id AND asub.deleted_at IS NULL
         AND asub.status IN ('Submitted', 'Late Submission')
       WHERE a.faculty_id = $1 AND a.deleted_at IS NULL
       GROUP BY a.id, a.title, s.code
       ORDER BY pending_count DESC`,
      [facultyId]
    ),
    query<{ assignment_id: string; assignment_title: string; subject_code: string; due_date: Date }>(
      `SELECT a.id AS assignment_id, a.title AS assignment_title, s.code AS subject_code, a.due_date
       FROM assignments a JOIN subjects s ON s.id = a.subject_id
       WHERE a.faculty_id = $1 AND a.deleted_at IS NULL
         AND a.due_date BETWEEN NOW() AND NOW() + INTERVAL '7 days'
       ORDER BY a.due_date ASC`,
      [facultyId]
    ),
    query<{ id: string; student_id: string; student_name: string; title: string; follow_up_date: string }>(
      `SELECT mn.id, mn.student_id, s.full_name AS student_name, mn.title, TO_CHAR(mn.follow_up_date, 'YYYY-MM-DD') AS follow_up_date
       FROM mentoring_notes mn JOIN students s ON s.id = mn.student_id
       WHERE mn.mentor_id = $1 AND mn.deleted_at IS NULL
         AND mn.follow_up_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '14 days'
       ORDER BY mn.follow_up_date ASC`,
      [facultyId]
    ),
    query<{ id: string; student_id: string; student_name: string; title: string; follow_up_date: string }>(
      `SELECT mn.id, mn.student_id, s.full_name AS student_name, mn.title, TO_CHAR(mn.follow_up_date, 'YYYY-MM-DD') AS follow_up_date
       FROM mentoring_notes mn JOIN students s ON s.id = mn.student_id
       WHERE mn.mentor_id = $1 AND mn.deleted_at IS NULL AND mn.follow_up_date < CURRENT_DATE
       ORDER BY mn.follow_up_date ASC`,
      [facultyId]
    ),
    query<{ id: string; subject_code: string; exam_type: string; exam_date: string; status: string }>(
      `SELECT e.id, s.code AS subject_code, e.exam_type::text AS exam_type,
         TO_CHAR(e.exam_date, 'YYYY-MM-DD') AS exam_date, e.status::text AS status
       FROM exams e JOIN subjects s ON s.id = e.subject_id
       WHERE e.faculty_id = $1 AND e.status IN ('Scheduled', 'Ongoing') AND e.exam_date >= CURRENT_DATE
         AND e.deleted_at IS NULL
       ORDER BY e.exam_date ASC`,
      [facultyId]
    ),
    roadmapService.getCourseProgress(userId, 'faculty', {}),
    getNotificationCount(userId, 'faculty' as Role),
    query<{ id: string; title: string; start_date: Date; event_type: string }>(
      `SELECT id, title, start_date, event_type::text AS event_type
       FROM calendar_entries
       WHERE deleted_at IS NULL AND start_date >= NOW()
         AND (created_by = $1 OR visibility IN ('faculty', 'institution_wide'))
       ORDER BY start_date ASC LIMIT 10`,
      [userId]
    ),
    facultyWorkloadService.calculateFacultyWorkload(userId, facultyId),
    facultyTasksService.generateTodayTasks(facultyId),
  ]);

  const pendingAttendance: PendingAttendanceItem[] = pendingAttendanceRows.rows.map((r) => ({
    subjectId: r.subject_id,
    subjectCode: r.subject_code,
    subjectName: r.subject_name,
    section: r.section,
  }));

  const assignmentsPendingEvaluation: PendingEvaluationItem[] = pendingEvaluationRows.rows.map((r) => ({
    assignmentId: r.assignment_id,
    assignmentTitle: r.assignment_title,
    subjectCode: r.subject_code,
    pendingCount: Number(r.pending_count),
  }));

  const upcomingDeadlines: UpcomingDeadlineItem[] = upcomingDeadlineRows.rows.map((r) => ({
    assignmentId: r.assignment_id,
    assignmentTitle: r.assignment_title,
    subjectCode: r.subject_code,
    dueDate: r.due_date,
  }));

  const toMeetingItem = (r: { id: string; student_id: string; student_name: string; title: string; follow_up_date: string }): MentorMeetingItem => ({
    noteId: r.id,
    studentId: r.student_id,
    studentName: r.student_name,
    title: r.title,
    followUpDate: r.follow_up_date,
  });

  const upcomingExams: UpcomingExamItem[] = upcomingExamRows.rows.map((r) => ({
    examId: r.id,
    subjectCode: r.subject_code,
    examType: r.exam_type,
    examDate: r.exam_date,
    status: r.status,
  }));

  const calendarSummary: CalendarSummaryItem[] = calendarRows.rows.map((r) => ({
    id: r.id,
    title: r.title,
    startDate: r.start_date,
    eventType: r.event_type,
  }));

  const upcomingQuizzesList = await roadmapService.getUpcomingLessons(userId, 'faculty', { view: 'week' });

  const warnings: string[] = [];
  if (workload.status === 'Overloaded') {
    warnings.push(`Workload is Overloaded (${workload.teachingHours}h/week planned) — consider redistributing subjects.`);
  }
  if (overdueMeetingsRows.rows.length > 0) {
    warnings.push(`${overdueMeetingsRows.rows.length} mentor meeting(s) are overdue.`);
  }

  return {
    todaySchedule,
    pendingAttendance,
    assignmentsPendingEvaluation,
    upcomingDeadlines,
    mentorMeetings: {
      upcoming: upcomingMeetingsRows.rows.map(toMeetingItem),
      overdue: overdueMeetingsRows.rows.map(toMeetingItem),
    },
    upcomingQuizzes: upcomingQuizzesList.lessons.filter((l) => l.quizPlanned),
    upcomingExams,
    teachingProgress,
    notificationSummary,
    calendarSummary,
    workload,
    tasks,
    warnings,
  };
}

// ── GET /faculty-operations/tasks (faculty only) ──────────────────────────────

export async function getFacultyTasksView(userId: string) {
  const ctx = await resolveFacultyContext(userId);
  return facultyTasksService.generateTodayTasks(ctx.id);
}

// ── GET /faculty-operations/workload (role-scoped) ────────────────────────────

async function getDepartmentWorkloadDistribution(departmentId: string): Promise<{
  departmentId: string;
  facultyWorkloads: FacultyWorkload[];
  overloadedCount: number;
}> {
  const { rows } = await query<{ id: string; user_id: string }>(
    'SELECT id, user_id FROM faculty WHERE department_id = $1 AND deleted_at IS NULL',
    [departmentId]
  );
  const facultyWorkloads = await Promise.all(
    rows.map((r) => facultyWorkloadService.calculateFacultyWorkload(r.user_id, r.id))
  );
  return {
    departmentId,
    facultyWorkloads,
    overloadedCount: facultyWorkloads.filter((w) => w.status === 'Overloaded').length,
  };
}

async function getInstitutionWorkloadDistribution(departmentId: string | null): Promise<{
  facultyWorkloads: WorkloadDistributionEntry[];
  overloadedCount: number;
}> {
  const params: unknown[] = [];
  const where = departmentId ? (params.push(departmentId), 'WHERE f.department_id = $1 AND f.deleted_at IS NULL') : 'WHERE f.deleted_at IS NULL';
  const { rows } = await query<{ id: string; user_id: string; department_name: string }>(
    `SELECT f.id, f.user_id, d.name AS department_name FROM faculty f JOIN departments d ON d.id = f.department_id ${where}`,
    params
  );
  const facultyWorkloads = await Promise.all(
    rows.map(async (r) => ({
      ...(await facultyWorkloadService.calculateFacultyWorkload(r.user_id, r.id)),
      departmentName: r.department_name,
    }))
  );
  return {
    facultyWorkloads,
    overloadedCount: facultyWorkloads.filter((w) => w.status === 'Overloaded').length,
  };
}

export async function getWorkloadView(userId: string, role: Role, filters: WorkloadQuery): Promise<unknown> {
  if (role === 'faculty') {
    const ctx = await resolveFacultyContext(userId);
    if (ctx.designation === 'hod') {
      return getDepartmentWorkloadDistribution(ctx.departmentId);
    }
    return facultyWorkloadService.calculateFacultyWorkload(userId, ctx.id);
  }

  if (role === 'admin') {
    if (filters.facultyId) {
      const { rows } = await query<{ user_id: string }>('SELECT user_id FROM faculty WHERE id = $1 AND deleted_at IS NULL', [
        filters.facultyId,
      ]);
      if (!rows[0]) throw AppError.notFound('Faculty not found');
      return facultyWorkloadService.calculateFacultyWorkload(rows[0].user_id, filters.facultyId);
    }
    return getInstitutionWorkloadDistribution(filters.departmentId ?? null);
  }

  throw AppError.forbidden('You do not have access to faculty workload data');
}

// ── GET /faculty-operations/analytics (role-scoped) ──────────────────────────

async function computeWorkloadAnalytics(facultyIds: string[] | null): Promise<WorkloadAnalytics> {
  const params: unknown[] = [];
  const scopeA = facultyIds ? (params.push(facultyIds), `tp.faculty_id = ANY($${params.length}::uuid[])`) : 'TRUE';

  const teachingRes = await query<{ minutes: string; lessons_completed: string; avg_weekly_minutes: string | null }>(
    `SELECT
       COALESCE(SUM(estimated_duration) FILTER (WHERE lesson_status = 'Completed'), 0)::text AS minutes,
       COUNT(*) FILTER (WHERE lesson_status = 'Completed')::text AS lessons_completed,
       (COALESCE(SUM(estimated_duration) FILTER (WHERE lesson_status = 'Completed'), 0)::float
         / NULLIF(COUNT(DISTINCT date_trunc('week', lesson_date)) FILTER (WHERE lesson_status = 'Completed'), 0))::text AS avg_weekly_minutes
     FROM teaching_plans tp WHERE ${scopeA} AND deleted_at IS NULL`,
    params
  );

  const params2: unknown[] = [];
  const scopeB = facultyIds ? (params2.push(facultyIds), `a.faculty_id = ANY($${params2.length}::uuid[])`) : 'TRUE';
  const evalRes = await query<{ reviewed: string; avg_hours: string | null }>(
    `SELECT
       COUNT(*) FILTER (WHERE asub.status = 'Evaluated')::text AS reviewed,
       (AVG(EXTRACT(EPOCH FROM (asub.updated_at - asub.submitted_at)) / 3600.0) FILTER (WHERE asub.status = 'Evaluated'))::text AS avg_hours
     FROM assignment_submissions asub JOIN assignments a ON a.id = asub.assignment_id
     WHERE ${scopeB} AND asub.deleted_at IS NULL`,
    params2
  );

  const params3: unknown[] = [];
  const scopeC = facultyIds ? (params3.push(facultyIds), `mentor_id = ANY($${params3.length}::uuid[])`) : 'TRUE';
  const meetingsRes = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM mentoring_notes WHERE ${scopeC} AND deleted_at IS NULL`,
    params3
  );

  return {
    teachingHours: Math.round((Number(teachingRes.rows[0].minutes) / 60) * 100) / 100,
    assignmentsReviewed: Number(evalRes.rows[0].reviewed),
    averageEvaluationHours: evalRes.rows[0].avg_hours ? Math.round(Number(evalRes.rows[0].avg_hours) * 100) / 100 : 0,
    mentorMeetingsCompleted: Number(meetingsRes.rows[0].count),
    lessonsCompleted: Number(teachingRes.rows[0].lessons_completed),
    averageWeeklyWorkloadHours: teachingRes.rows[0].avg_weekly_minutes
      ? Math.round((Number(teachingRes.rows[0].avg_weekly_minutes) / 60) * 100) / 100
      : 0,
  };
}

export async function getWorkloadAnalyticsView(
  userId: string,
  role: Role,
  filters: { facultyId?: string }
): Promise<WorkloadAnalytics> {
  if (role === 'faculty') {
    const ctx = await resolveFacultyContext(userId);
    if (ctx.designation === 'hod') {
      const { rows } = await query<{ id: string }>('SELECT id FROM faculty WHERE department_id = $1 AND deleted_at IS NULL', [
        ctx.departmentId,
      ]);
      return computeWorkloadAnalytics(rows.map((r) => r.id));
    }
    return computeWorkloadAnalytics([ctx.id]);
  }

  if (role === 'admin') {
    if (filters.facultyId) return computeWorkloadAnalytics([filters.facultyId]);
    return computeWorkloadAnalytics(null);
  }

  throw AppError.forbidden('You do not have access to workload analytics');
}
