import { query } from '../config/database';
import { AppError } from '../errors/AppError';
import * as roadmapService from './teachingPlanRoadmap.service';
import { getMentorDashboard } from './mentorship.service';
import { getMentorGroups } from './mentorGroup.service';
import { getStudentDues } from './fee.service';
import { getStudentSummary as getAttendanceSummary } from './attendance.service';
import { getStudentSummary as getInternalMarksSummary } from './internal-marks.service';
import type { CourseProgressQuery } from '../types/teachingPlan';
import type {
  AdminAnalyticsQuery,
  AdminAnalyticsResponse,
  HodAnalyticsResponse,
  FacultyAnalyticsResponse,
  StudentAnalyticsResponse,
  InstitutionOverview,
  AcademicAnalytics,
  TeachingAnalytics,
  LmsAnalytics,
  MentorshipAnalytics,
  OpportunityAnalytics,
  NotificationAnalytics,
} from '../types/analytics';

// Credit-weighted grade-point expression shared by every CGPA/SGPA aggregate below —
// mirrors the exact formula used in mentorship.service.ts::getMentorDashboard.
const GRADE_POINT_SQL = `CASE r.grade WHEN 'O' THEN 10 WHEN 'A+' THEN 9 WHEN 'A' THEN 8 WHEN 'B+' THEN 7 WHEN 'B' THEN 6 WHEN 'C' THEN 5 ELSE 0 END`;

function pct(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 10000) / 100 : 0;
}

// ── Institution / department overview ────────────────────────────────────────────

export async function getInstitutionOverview(departmentId: string | null): Promise<InstitutionOverview> {
  const deptParams = departmentId ? [departmentId] : [];
  const deptFilter = departmentId ? 'AND department_id = $1' : '';

  const [stu, fac, dept, sub] = await Promise.all([
    query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM students WHERE deleted_at IS NULL ${deptFilter}`, deptParams),
    query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM faculty WHERE deleted_at IS NULL ${deptFilter}`, deptParams),
    departmentId
      ? query<{ count: string }>('SELECT COUNT(*)::text AS count FROM departments WHERE id = $1 AND deleted_at IS NULL', [departmentId])
      : query<{ count: string }>('SELECT COUNT(*)::text AS count FROM departments WHERE deleted_at IS NULL'),
    query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM subjects WHERE deleted_at IS NULL ${deptFilter}`, deptParams),
  ]);

  return {
    totalStudents: Number(stu.rows[0].count),
    totalFaculty: Number(fac.rows[0].count),
    totalDepartments: Number(dept.rows[0].count),
    totalSubjects: Number(sub.rows[0].count),
  };
}

// ── Academic analytics (attendance / CGPA / pass-fail / subject completion) ─────

export async function getAcademicAnalytics(departmentId: string | null): Promise<AcademicAnalytics> {
  const attParams: unknown[] = [];
  let attJoin = '';
  let attWhere = '';
  if (departmentId) {
    attJoin = 'JOIN students st ON st.id = a.student_id';
    attParams.push(departmentId);
    attWhere = 'AND st.department_id = $1';
  }
  const attRes = await query<{ total: string; present: string }>(
    `SELECT COUNT(*)::text AS total, COUNT(*) FILTER (WHERE a.status = 'present')::text AS present
     FROM attendance a ${attJoin} WHERE 1=1 ${attWhere}`,
    attParams
  );

  const resultParams: unknown[] = [];
  const resultDeptWhere = departmentId ? 'AND sub.department_id = $1' : '';
  if (departmentId) resultParams.push(departmentId);

  const gradeRes = await query<{
    total_points: string;
    total_credits: string;
    pass_count: string;
    fail_count: string;
    total_results: string;
  }>(
    `SELECT
       COALESCE(SUM(${GRADE_POINT_SQL} * sub.credits), 0)::text AS total_points,
       COALESCE(SUM(sub.credits), 0)::text AS total_credits,
       COUNT(*) FILTER (WHERE r.result_status = 'Pass')::text AS pass_count,
       COUNT(*) FILTER (WHERE r.result_status = 'Fail')::text AS fail_count,
       COUNT(*)::text AS total_results
     FROM results r
     JOIN subjects sub ON sub.id = r.subject_id
     WHERE r.publication_status = 'Published' AND r.deleted_at IS NULL ${resultDeptWhere}`,
    resultParams
  );

  const completionRes = await query<{ published: string; total: string }>(
    `SELECT
       COUNT(DISTINCT r.subject_id) FILTER (WHERE r.publication_status = 'Published')::text AS published,
       COUNT(DISTINCT r.subject_id)::text AS total
     FROM results r
     JOIN subjects sub ON sub.id = r.subject_id
     WHERE r.deleted_at IS NULL ${resultDeptWhere}`,
    resultParams
  );

  const totalPoints = Number(gradeRes.rows[0].total_points);
  const totalCredits = Number(gradeRes.rows[0].total_credits);

  return {
    averageAttendance: pct(Number(attRes.rows[0].present), Number(attRes.rows[0].total)),
    averageCGPA: totalCredits > 0 ? Math.round((totalPoints / totalCredits) * 100) / 100 : 0,
    passPercentage: pct(Number(gradeRes.rows[0].pass_count), Number(gradeRes.rows[0].total_results)),
    failPercentage: pct(Number(gradeRes.rows[0].fail_count), Number(gradeRes.rows[0].total_results)),
    subjectCompletionRate: pct(Number(completionRes.rows[0].published), Number(completionRes.rows[0].total)),
  };
}

// ── Teaching analytics — reuses the Teaching Planner's own progress engine ──────

export async function getTeachingAnalytics(userId: string, departmentId: string | null): Promise<TeachingAnalytics> {
  const progressFilters: CourseProgressQuery = departmentId ? { departmentId } : {};
  const progress = await roadmapService.getCourseProgress(userId, 'admin', progressFilters);

  const params: unknown[] = [];
  const deptWhere = departmentId ? 'AND tp.department_id = $1' : '';
  if (departmentId) params.push(departmentId);

  const { rows } = await query<{ faculty_id: string; faculty_name: string; planned: string; completed: string }>(
    `SELECT tp.faculty_id, f.full_name AS faculty_name,
       COUNT(*) FILTER (WHERE tp.lesson_status != 'Cancelled')::text AS planned,
       COUNT(*) FILTER (WHERE tp.lesson_status = 'Completed')::text AS completed
     FROM teaching_plans tp
     JOIN faculty f ON f.id = tp.faculty_id
     WHERE tp.deleted_at IS NULL ${deptWhere}
     GROUP BY tp.faculty_id, f.full_name
     ORDER BY f.full_name`,
    params
  );

  return {
    syllabusCompletion: progress.completionPercentage,
    lessonsPlanned: progress.totalPlanned,
    lessonsCompleted: progress.completed,
    lessonsRemaining: progress.remaining,
    facultyTeachingProgress: rows.map((r) => ({
      facultyId: r.faculty_id,
      facultyName: r.faculty_name,
      lessonsPlanned: Number(r.planned),
      lessonsCompleted: Number(r.completed),
      completionPercentage: pct(Number(r.completed), Number(r.planned)),
    })),
  };
}

// ── LMS analytics ─────────────────────────────────────────────────────────────────

async function getLmsAnalytics(departmentId: string | null): Promise<LmsAnalytics> {
  const materialParams: unknown[] = [];
  const materialJoin = departmentId ? 'JOIN subjects sub ON sub.id = cm.subject_id' : '';
  const materialWhere = departmentId ? 'AND sub.department_id = $1' : '';
  if (departmentId) materialParams.push(departmentId);

  const assignParams: unknown[] = [];
  const assignJoin = departmentId ? 'JOIN subjects sub ON sub.id = a.subject_id' : '';
  const assignWhere = departmentId ? 'AND sub.department_id = $1' : '';
  if (departmentId) assignParams.push(departmentId);

  const expectedParams: unknown[] = [];
  const expectedWhere = departmentId ? 'AND s.department_id = $1' : '';
  if (departmentId) expectedParams.push(departmentId);

  const submissionParams: unknown[] = [];
  const submissionJoin = departmentId
    ? 'JOIN assignments a ON a.id = asub.assignment_id JOIN subjects sub ON sub.id = a.subject_id'
    : '';
  const submissionWhere = departmentId ? 'AND sub.department_id = $1' : '';
  if (departmentId) submissionParams.push(departmentId);

  const [materialRes, assignRes, expectedRes, submissionRes] = await Promise.all([
    query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM course_materials cm ${materialJoin} WHERE cm.deleted_at IS NULL ${materialWhere}`,
      materialParams
    ),
    query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM assignments a ${assignJoin} WHERE a.deleted_at IS NULL ${assignWhere}`,
      assignParams
    ),
    query<{ expected: string }>(
      `SELECT COUNT(*)::text AS expected
       FROM assignments a
       JOIN subjects s  ON s.id = a.subject_id
       JOIN students st ON st.program_id = s.program_id AND st.semester = s.semester
       WHERE a.deleted_at IS NULL AND s.deleted_at IS NULL AND st.deleted_at IS NULL AND st.status = 'active' ${expectedWhere}`,
      expectedParams
    ),
    query<{ total: string; late: string }>(
      `SELECT COUNT(*)::text AS total, COUNT(*) FILTER (WHERE asub.status = 'Late Submission')::text AS late
       FROM assignment_submissions asub ${submissionJoin}
       WHERE asub.deleted_at IS NULL ${submissionWhere}`,
      submissionParams
    ),
  ]);

  const totalSubmissions = Number(submissionRes.rows[0].total);

  return {
    totalMaterialsUploaded: Number(materialRes.rows[0].count),
    totalAssignments: Number(assignRes.rows[0].count),
    submissionPercentage: pct(totalSubmissions, Number(expectedRes.rows[0].expected)),
    lateSubmissionPercentage: pct(Number(submissionRes.rows[0].late), totalSubmissions),
  };
}

// ── Mentorship analytics ─────────────────────────────────────────────────────────

export async function getMentorshipAnalytics(departmentId: string | null): Promise<MentorshipAnalytics> {
  const groups = await getMentorGroups(departmentId ? { departmentId } : {});
  const totalMentorGroups = groups.length;
  const activeMentors = new Set(groups.map((g) => g.mentorId)).size;

  const atRiskParams: unknown[] = [];
  const atRiskWhere = departmentId ? 'AND st.department_id = $1' : '';
  if (departmentId) atRiskParams.push(departmentId);

  const { rows } = await query<{ count: string }>(
    `WITH att AS (
       SELECT student_id, COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'present') AS present
       FROM attendance GROUP BY student_id
     ),
     fee AS (
       SELECT student_id, SUM(pending_amount) AS pending FROM fees WHERE deleted_at IS NULL GROUP BY student_id
     ),
     fails AS (
       SELECT DISTINCT student_id FROM results
       WHERE result_status = 'Fail' AND publication_status = 'Published' AND deleted_at IS NULL
     )
     SELECT COUNT(DISTINCT st.id)::text AS count
     FROM students st
     LEFT JOIN att   a  ON a.student_id  = st.id
     LEFT JOIN fee   f  ON f.student_id  = st.id
     LEFT JOIN fails fl ON fl.student_id = st.id
     WHERE st.deleted_at IS NULL ${atRiskWhere} AND (
       (a.total > 0 AND (a.present::numeric / a.total) < 0.75)
       OR COALESCE(f.pending, 0) > 0
       OR fl.student_id IS NOT NULL
     )`,
    atRiskParams
  );

  return { totalMentorGroups, activeMentors, studentsAtRisk: Number(rows[0].count) };
}

// ── Opportunity analytics ────────────────────────────────────────────────────────
// "Student Applications" — this codebase has no application-tracking table for
// Opportunity Hub (post/bookmark only, per 018_opportunity_hub.sql), so bookmark
// count is used as the closest existing signal rather than inventing a new table.

export async function getOpportunityAnalytics(departmentId: string | null): Promise<OpportunityAnalytics> {
  const params: unknown[] = [];
  const deptWhere = departmentId ? 'AND (department_id = $1 OR department_id IS NULL)' : '';
  if (departmentId) params.push(departmentId);

  const oppRes = await query<{ active: string; internships: string; jobs: string; workshops: string }>(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'Active')::text        AS active,
       COUNT(*) FILTER (WHERE type = 'Internship')::text       AS internships,
       COUNT(*) FILTER (WHERE type = 'Job Opportunity')::text  AS jobs,
       COUNT(*) FILTER (WHERE type = 'Workshop')::text         AS workshops
     FROM opportunities WHERE deleted_at IS NULL ${deptWhere}`,
    params
  );

  const bookmarkParams: unknown[] = [];
  const bookmarkJoin = departmentId ? 'JOIN opportunities opp ON opp.id = ob.opportunity_id' : '';
  const bookmarkWhere = departmentId ? 'AND (opp.department_id = $1 OR opp.department_id IS NULL)' : '';
  if (departmentId) bookmarkParams.push(departmentId);

  const bookmarkRes = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM opportunity_bookmarks ob ${bookmarkJoin} WHERE 1=1 ${bookmarkWhere}`,
    bookmarkParams
  );

  return {
    activeOpportunities: Number(oppRes.rows[0].active),
    internships: Number(oppRes.rows[0].internships),
    jobs: Number(oppRes.rows[0].jobs),
    workshops: Number(oppRes.rows[0].workshops),
    studentApplications: Number(bookmarkRes.rows[0].count),
  };
}

// ── Notification analytics ───────────────────────────────────────────────────────
// "Read Percentage" = share of sent notifications with at least one recorded read
// (an engagement-rate proxy — there is no per-recipient delivery table to compute
// a true per-recipient read rate against, see notification.service.ts).

async function getNotificationAnalytics(): Promise<NotificationAnalytics> {
  const { rows } = await query<{ total: string; with_reads: string }>(
    `SELECT COUNT(*)::text AS total,
       COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM notification_reads nr WHERE nr.notification_id = n.id))::text AS with_reads
     FROM notifications n WHERE n.deleted_at IS NULL`
  );
  return {
    notificationsSent: Number(rows[0].total),
    readPercentage: pct(Number(rows[0].with_reads), Number(rows[0].total)),
  };
}

// ── Exports ────────────────────────────────────────────────────────────────────

export async function getAdminAnalytics(
  userId: string,
  filters: AdminAnalyticsQuery
): Promise<AdminAnalyticsResponse> {
  const deptId = filters.departmentId ?? null;

  const [institutionOverview, academicAnalytics, teachingAnalytics, lmsAnalytics, mentorshipAnalytics, opportunityAnalytics, notificationAnalytics] =
    await Promise.all([
      getInstitutionOverview(deptId),
      getAcademicAnalytics(deptId),
      getTeachingAnalytics(userId, deptId),
      getLmsAnalytics(deptId),
      getMentorshipAnalytics(deptId),
      getOpportunityAnalytics(deptId),
      getNotificationAnalytics(),
    ]);

  return {
    institutionOverview,
    academicAnalytics,
    teachingAnalytics,
    lmsAnalytics,
    mentorshipAnalytics,
    opportunityAnalytics,
    notificationAnalytics,
  };
}

export async function getHodAnalytics(userId: string): Promise<HodAnalyticsResponse> {
  const { rows: facRows } = await query<{
    id: string;
    department_id: string;
    designation: string | null;
    department_name: string;
  }>(
    `SELECT f.id, f.department_id, f.designation, d.name AS department_name
     FROM faculty f JOIN departments d ON d.id = f.department_id
     WHERE f.user_id = $1 AND f.deleted_at IS NULL`,
    [userId]
  );
  if (!facRows[0]) throw AppError.forbidden('No faculty profile is linked to this account');
  if (facRows[0].designation !== 'hod') throw AppError.forbidden('Only Heads of Department can access this report');

  const departmentId = facRows[0].department_id;

  const [overview, academic, teaching, mentorship, opportunity] = await Promise.all([
    getInstitutionOverview(departmentId),
    getAcademicAnalytics(departmentId),
    getTeachingAnalytics(userId, departmentId),
    getMentorshipAnalytics(departmentId),
    getOpportunityAnalytics(departmentId),
  ]);

  const { rows: feePendingRows } = await query<{ count: string }>(
    `SELECT COUNT(DISTINCT f.student_id)::text AS count
     FROM fees f JOIN students st ON st.id = f.student_id
     WHERE st.department_id = $1 AND f.pending_amount > 0 AND f.deleted_at IS NULL`,
    [departmentId]
  );

  return {
    departmentId,
    departmentName: facRows[0].department_name,
    departmentStudents: overview.totalStudents,
    facultyCount: overview.totalFaculty,
    subjectCount: overview.totalSubjects,
    departmentAttendance: academic.averageAttendance,
    departmentCGPA: academic.averageCGPA,
    passPercentage: academic.passPercentage,
    feePendingStudents: Number(feePendingRows[0].count),
    teachingProgress: {
      lessonsPlanned: teaching.lessonsPlanned,
      lessonsCompleted: teaching.lessonsCompleted,
      lessonsRemaining: teaching.lessonsRemaining,
      completionPercentage: teaching.syllabusCompletion,
    },
    mentorshipStatistics: {
      totalMentorGroups: mentorship.totalMentorGroups,
      activeMentors: mentorship.activeMentors,
    },
    placementOpportunities: {
      total: opportunity.activeOpportunities,
      internships: opportunity.internships,
      jobs: opportunity.jobs,
      workshops: opportunity.workshops,
    },
  };
}

export async function getFacultyAnalytics(userId: string): Promise<FacultyAnalyticsResponse> {
  const { rows: facRows } = await query<{ id: string }>(
    'SELECT id FROM faculty WHERE user_id = $1 AND deleted_at IS NULL',
    [userId]
  );
  if (!facRows[0]) throw AppError.forbidden('No faculty profile is linked to this account');
  const facultyId = facRows[0].id;

  const [subjRes, progress, assignRes, submissionRes, attRes, marksRes, mentees] = await Promise.all([
    query<{ count: string }>(
      `SELECT COUNT(DISTINCT subject_id)::text AS count FROM faculty_subject_assignments
       WHERE faculty_id = $1 AND is_active = TRUE AND deleted_at IS NULL`,
      [facultyId]
    ),
    roadmapService.getCourseProgress(userId, 'faculty', {}),
    query<{ count: string }>('SELECT COUNT(*)::text AS count FROM assignments WHERE faculty_id = $1 AND deleted_at IS NULL', [
      facultyId,
    ]),
    query<{ expected: string; submitted: string; late: string }>(
      `SELECT
         (SELECT COUNT(*) FROM assignments a
            JOIN subjects s  ON s.id = a.subject_id
            JOIN students st ON st.program_id = s.program_id AND st.semester = s.semester
          WHERE a.faculty_id = $1 AND a.deleted_at IS NULL AND s.deleted_at IS NULL
            AND st.deleted_at IS NULL AND st.status = 'active')::text AS expected,
         (SELECT COUNT(*) FROM assignment_submissions asub
            JOIN assignments a ON a.id = asub.assignment_id
          WHERE a.faculty_id = $1 AND asub.deleted_at IS NULL)::text AS submitted,
         (SELECT COUNT(*) FROM assignment_submissions asub
            JOIN assignments a ON a.id = asub.assignment_id
          WHERE a.faculty_id = $1 AND asub.deleted_at IS NULL AND asub.status = 'Late Submission')::text AS late`,
      [facultyId]
    ),
    query<{ total: string; present: string }>(
      `SELECT COUNT(*)::text AS total, COUNT(*) FILTER (WHERE status = 'present')::text AS present
       FROM attendance WHERE faculty_id = $1`,
      [facultyId]
    ),
    query<{ avg_pct: string | null }>(
      `SELECT AVG(obtained_marks / NULLIF(maximum_marks, 0) * 100)::text AS avg_pct
       FROM internal_marks WHERE faculty_id = $1`,
      [facultyId]
    ),
    getMentorDashboard(userId),
  ]);

  const studentsAtRisk = mentees.filter((m) => Object.values(m.alerts).some(Boolean)).length;
  const lowAttendance = mentees.filter((m) => m.alerts.attendanceBelow75).length;
  const feePending = mentees.filter((m) => m.alerts.feePending).length;
  const assignmentPending = mentees.filter((m) => m.alerts.assignmentOverdue).length;

  return {
    teachingOverview: {
      subjectsAssigned: Number(subjRes.rows[0].count),
      lessonsPlanned: progress.totalPlanned,
      lessonsCompleted: progress.completed,
      syllabusCompletion: progress.completionPercentage,
      assignmentsCreated: Number(assignRes.rows[0].count),
      assignmentSubmissionPercentage: pct(Number(submissionRes.rows[0].submitted), Number(submissionRes.rows[0].expected)),
      studentAttendance: pct(Number(attRes.rows[0].present), Number(attRes.rows[0].total)),
      averageInternalMarks: marksRes.rows[0].avg_pct ? Math.round(Number(marksRes.rows[0].avg_pct) * 100) / 100 : 0,
    },
    mentorDashboard: {
      studentsAtRisk,
      lowAttendance,
      feePending,
      assignmentPending,
      mentees,
    },
  };
}

export async function getStudentAnalytics(userId: string): Promise<StudentAnalyticsResponse> {
  const { rows: stuRows } = await query<{ id: string }>(
    'SELECT id FROM students WHERE user_id = $1 AND deleted_at IS NULL',
    [userId]
  );
  if (!stuRows[0]) throw AppError.forbidden('No student profile is linked to this account');

  const [attendanceSummary, cgpaTrendRes, marksSummary, assignmentRes, roadmap, fees, bookmarkRes] = await Promise.all([
    getAttendanceSummary(userId),
    query<{ semester: number; sgpa: string | null }>(
      `SELECT r.semester,
         (COALESCE(SUM(${GRADE_POINT_SQL} * sub.credits), 0)::float / NULLIF(SUM(sub.credits), 0)::float)::text AS sgpa
       FROM results r
       JOIN subjects sub ON sub.id = r.subject_id
       JOIN students st  ON st.id  = r.student_id
       WHERE st.user_id = $1 AND r.publication_status = 'Published' AND r.deleted_at IS NULL
       GROUP BY r.semester ORDER BY r.semester`,
      [userId]
    ),
    getInternalMarksSummary(userId),
    query<{ total: string; submitted: string }>(
      `SELECT COUNT(a.id)::text AS total, COUNT(asub.id)::text AS submitted
       FROM assignments a
       JOIN subjects s  ON s.id = a.subject_id
       JOIN students st ON st.program_id = s.program_id AND st.semester = s.semester
       LEFT JOIN assignment_submissions asub
         ON asub.assignment_id = a.id AND asub.student_id = st.id AND asub.deleted_at IS NULL
       WHERE st.user_id = $1 AND a.deleted_at IS NULL AND s.deleted_at IS NULL`,
      [userId]
    ),
    roadmapService.getStudentRoadmap(userId, 'student', {}),
    getStudentDues(userId),
    query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM opportunity_bookmarks ob
       JOIN students st ON st.id = ob.student_id WHERE st.user_id = $1`,
      [userId]
    ),
  ]);

  return {
    attendanceTrend: attendanceSummary,
    cgpaTrend: cgpaTrendRes.rows.map((r) => ({
      semester: Number(r.semester),
      sgpa: r.sgpa ? Math.round(Number(r.sgpa) * 100) / 100 : 0,
    })),
    internalMarksTrend: marksSummary,
    assignmentCompletionPercentage: pct(Number(assignmentRes.rows[0].submitted), Number(assignmentRes.rows[0].total)),
    learningProgress: roadmap,
    feeStatus: fees,
    opportunityParticipation: Number(bookmarkRes.rows[0].count),
  };
}
