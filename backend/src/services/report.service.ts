import { query } from '../config/database';
import { AppError } from '../errors/AppError';
import { getMentorshipReports } from './mentorship.service';
import * as analyticsService from './analytics.service';
import * as examSeatingService from './examSeating.service';
import * as examInvigilationService from './examInvigilation.service';
import type { Role } from '../types/roles';
import type { ReportFilters, ReportResult, ReportColumn, ChartData } from '../types/report';

const GRADE_POINT_SQL = `CASE r.grade WHEN 'O' THEN 10 WHEN 'A+' THEN 9 WHEN 'A' THEN 8 WHEN 'B+' THEN 7 WHEN 'B' THEN 6 WHEN 'C' THEN 5 ELSE 0 END`;

function pct(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 10000) / 100 : 0;
}

// ── Role scoping ──────────────────────────────────────────────────────────────
// admin: unrestricted. HOD (faculty w/ designation='hod'): forced to own department.
// plain faculty: forced to own facultyId ("assigned data only"). student: not
// permitted on class/institution reports (only /reports/student, handled inline).

interface ScopeContext {
  departmentId: string | null;
  facultyId: string | null;
}

async function resolveScopeContext(userId: string, role: Role): Promise<ScopeContext> {
  if (role === 'admin') return { departmentId: null, facultyId: null };

  if (role === 'faculty') {
    const { rows } = await query<{ id: string; department_id: string; designation: string | null }>(
      'SELECT id, department_id, designation FROM faculty WHERE user_id = $1 AND deleted_at IS NULL',
      [userId]
    );
    if (!rows[0]) throw AppError.forbidden('No faculty profile is linked to this account');
    if (rows[0].designation === 'hod') return { departmentId: rows[0].department_id, facultyId: null };
    return { departmentId: null, facultyId: rows[0].id };
  }

  throw AppError.forbidden('You do not have access to this report');
}

/** EXISTS clause restricting rows to subjects/sections this faculty is actively assigned to teach. */
function facultyAssignedExists(facultyId: string, params: unknown[], subjectAlias: string, sectionExpr: string): string {
  params.push(facultyId);
  return `EXISTS (
    SELECT 1 FROM faculty_subject_assignments fsa
    WHERE fsa.faculty_id = $${params.length} AND fsa.subject_id = ${subjectAlias}.id AND fsa.section = ${sectionExpr}
      AND fsa.is_active = TRUE AND fsa.deleted_at IS NULL
  )`;
}

// ── 1. Attendance Report ─────────────────────────────────────────────────────────

export async function getAttendanceReport(userId: string, role: Role, filters: ReportFilters): Promise<ReportResult> {
  const scope = await resolveScopeContext(userId, role);
  const conditions: string[] = ['st.deleted_at IS NULL'];
  const params: unknown[] = [];
  const push = (cond: string, val: unknown) => {
    params.push(val);
    conditions.push(`${cond} $${params.length}`);
  };

  const departmentId = scope.departmentId ?? filters.departmentId;
  if (departmentId) push('st.department_id =', departmentId);
  if (scope.facultyId) conditions.push(facultyAssignedExists(scope.facultyId, params, 'sub', 'st.section'));
  if (filters.subjectId) push('sub.id =', filters.subjectId);
  if (filters.studentId) push('st.id =', filters.studentId);
  if (filters.section) push('st.section =', filters.section);
  if (filters.semester) push('sub.semester =', filters.semester);
  if (filters.dateFrom) push('a.attendance_date >=', filters.dateFrom);
  if (filters.dateTo) push('a.attendance_date <=', filters.dateTo);

  const baseParams = [...params];
  const baseWhere = conditions.join(' AND ');

  params.push(filters.limit, (filters.page - 1) * filters.limit);
  const limitN = params.length - 1;
  const offsetN = params.length;

  const { rows } = await query<{
    student_id: string;
    roll_number: string;
    full_name: string;
    department_name: string;
    subject_code: string;
    subject_name: string;
    total: string;
    present: string;
    total_count: string;
  }>(
    `SELECT st.id AS student_id, st.roll_number, st.full_name, d.name AS department_name,
       sub.code AS subject_code, sub.name AS subject_name,
       COUNT(a.id)::text AS total, COUNT(a.id) FILTER (WHERE a.status = 'present')::text AS present,
       COUNT(*) OVER()::text AS total_count
     FROM students st
     JOIN departments d   ON d.id = st.department_id
     JOIN subjects    sub ON sub.program_id = st.program_id AND sub.semester = st.semester AND sub.deleted_at IS NULL
     LEFT JOIN attendance a ON a.subject_id = sub.id AND a.student_id = st.id
     WHERE ${baseWhere}
     GROUP BY st.id, st.roll_number, st.full_name, d.name, sub.id, sub.code, sub.name
     ORDER BY d.name, st.roll_number, sub.code
     LIMIT $${limitN} OFFSET $${offsetN}`,
    params
  );

  const trendRes = await query<{ month: Date; total: string; present: string }>(
    `SELECT DATE_TRUNC('month', a.attendance_date) AS month,
       COUNT(*)::text AS total, COUNT(*) FILTER (WHERE a.status = 'present')::text AS present
     FROM attendance a
     JOIN students st  ON st.id  = a.student_id
     JOIN subjects sub ON sub.id = a.subject_id
     WHERE ${baseWhere}
     GROUP BY month ORDER BY month`,
    baseParams
  );

  const totalOverall = rows.reduce((s, r) => s + Number(r.total), 0);
  const presentOverall = rows.reduce((s, r) => s + Number(r.present), 0);
  const total = rows[0] ? Number(rows[0].total_count) : 0;

  const columns: ReportColumn[] = [
    { key: 'rollNumber', label: 'Roll Number' },
    { key: 'studentName', label: 'Student Name' },
    { key: 'department', label: 'Department' },
    { key: 'subjectCode', label: 'Subject' },
    { key: 'subjectName', label: 'Subject Name' },
    { key: 'totalClasses', label: 'Total Classes' },
    { key: 'attendedClasses', label: 'Attended' },
    { key: 'percentage', label: 'Attendance %' },
  ];

  const charts: ChartData[] = [
    {
      title: 'Attendance Trend',
      type: 'line',
      labels: trendRes.rows.map((r) => new Date(r.month).toISOString().slice(0, 7)),
      series: [
        {
          label: 'Attendance %',
          data: trendRes.rows.map((r) => pct(Number(r.present), Number(r.total))),
        },
      ],
    },
  ];

  return {
    title: 'Attendance Report',
    columns,
    rows: rows.map((r) => ({
      rollNumber: r.roll_number,
      studentName: r.full_name,
      department: r.department_name,
      subjectCode: r.subject_code,
      subjectName: r.subject_name,
      totalClasses: Number(r.total),
      attendedClasses: Number(r.present),
      percentage: pct(Number(r.present), Number(r.total)),
    })),
    summary: {
      totalClasses: totalOverall,
      attendedClasses: presentOverall,
      overallPercentage: pct(presentOverall, totalOverall),
    },
    charts,
    total,
    page: filters.page,
    limit: filters.limit,
    totalPages: Math.ceil(total / filters.limit),
  };
}

// ── 2. Results Report ─────────────────────────────────────────────────────────

export async function getResultsReport(userId: string, role: Role, filters: ReportFilters): Promise<ReportResult> {
  const scope = await resolveScopeContext(userId, role);
  const conditions: string[] = ['r.deleted_at IS NULL'];
  const params: unknown[] = [];
  const push = (cond: string, val: unknown) => {
    params.push(val);
    conditions.push(`${cond} $${params.length}`);
  };

  const departmentId = scope.departmentId ?? filters.departmentId;
  if (departmentId) push('sub.department_id =', departmentId);
  if (scope.facultyId) push('r.faculty_id =', scope.facultyId);
  else if (filters.facultyId) push('r.faculty_id =', filters.facultyId);
  if (filters.subjectId) push('r.subject_id =', filters.subjectId);
  if (filters.studentId) push('r.student_id =', filters.studentId);
  if (filters.section) push('r.section =', filters.section);
  if (filters.semester) push('r.semester =', filters.semester);
  if (filters.grade) push('r.grade =', filters.grade);
  if (filters.resultStatus) push('r.result_status =', filters.resultStatus);
  if (filters.publicationStatus) push('r.publication_status =', filters.publicationStatus);

  const baseWhere = conditions.join(' AND ');
  const baseParams = [...params];

  params.push(filters.limit, (filters.page - 1) * filters.limit);
  const limitN = params.length - 1;
  const offsetN = params.length;

  const { rows } = await query<{
    roll_number: string;
    student_name: string;
    department_name: string;
    subject_code: string;
    subject_name: string;
    semester: number;
    section: string;
    internal_marks: string;
    external_marks: string;
    total_marks: string;
    grade: string;
    result_status: string;
    publication_status: string;
    total_count: string;
  }>(
    `SELECT st.roll_number, st.full_name AS student_name, d.name AS department_name,
       sub.code AS subject_code, sub.name AS subject_name, r.semester, r.section,
       r.internal_marks, r.external_marks, r.total_marks, r.grade, r.result_status, r.publication_status,
       COUNT(*) OVER()::text AS total_count
     FROM results r
     JOIN students    st  ON st.id  = r.student_id
     JOIN subjects    sub ON sub.id = r.subject_id
     JOIN departments d   ON d.id   = sub.department_id
     WHERE ${baseWhere}
     ORDER BY d.name, st.roll_number, sub.code
     LIMIT $${limitN} OFFSET $${offsetN}`,
    params
  );

  const summaryRes = await query<{ pass: string; fail: string; absent: string; total: string; avg_pct: string | null }>(
    `SELECT
       COUNT(*) FILTER (WHERE r.result_status = 'Pass')::text   AS pass,
       COUNT(*) FILTER (WHERE r.result_status = 'Fail')::text   AS fail,
       COUNT(*) FILTER (WHERE r.result_status = 'Absent')::text AS absent,
       COUNT(*)::text AS total,
       AVG(r.total_marks / NULLIF(r.internal_max_marks + r.external_max_marks, 0) * 100)::text AS avg_pct
     FROM results r
     JOIN subjects sub ON sub.id = r.subject_id
     WHERE ${baseWhere}`,
    baseParams
  );

  const subjectChartRes = await query<{ subject_code: string; pass: string; total: string }>(
    `SELECT sub.code AS subject_code,
       COUNT(*) FILTER (WHERE r.result_status = 'Pass')::text AS pass, COUNT(*)::text AS total
     FROM results r JOIN subjects sub ON sub.id = r.subject_id
     WHERE ${baseWhere}
     GROUP BY sub.code ORDER BY sub.code`,
    baseParams
  );

  const gradeChartRes = await query<{ grade: string; count: string }>(
    `SELECT r.grade, COUNT(*)::text AS count
     FROM results r JOIN subjects sub ON sub.id = r.subject_id
     WHERE ${baseWhere}
     GROUP BY r.grade ORDER BY r.grade`,
    baseParams
  );

  const total = rows[0] ? Number(rows[0].total_count) : 0;

  const columns: ReportColumn[] = [
    { key: 'rollNumber', label: 'Roll Number' },
    { key: 'studentName', label: 'Student Name' },
    { key: 'department', label: 'Department' },
    { key: 'subjectCode', label: 'Subject' },
    { key: 'semester', label: 'Semester' },
    { key: 'section', label: 'Section' },
    { key: 'internalMarks', label: 'Internal' },
    { key: 'externalMarks', label: 'External' },
    { key: 'totalMarks', label: 'Total' },
    { key: 'grade', label: 'Grade' },
    { key: 'resultStatus', label: 'Status' },
    { key: 'publicationStatus', label: 'Published' },
  ];

  const charts: ChartData[] = [
    {
      title: 'Subject Pass Percentage',
      type: 'bar',
      labels: subjectChartRes.rows.map((r) => r.subject_code),
      series: [{ label: 'Pass %', data: subjectChartRes.rows.map((r) => pct(Number(r.pass), Number(r.total))) }],
    },
    {
      title: 'Grade Distribution',
      type: 'pie',
      labels: gradeChartRes.rows.map((r) => r.grade),
      series: [{ label: 'Students', data: gradeChartRes.rows.map((r) => Number(r.count)) }],
    },
  ];

  return {
    title: 'Result Report',
    columns,
    rows: rows.map((r) => ({
      rollNumber: r.roll_number,
      studentName: r.student_name,
      department: r.department_name,
      subjectCode: r.subject_code,
      subjectName: r.subject_name,
      semester: r.semester,
      section: r.section,
      internalMarks: Number(r.internal_marks),
      externalMarks: Number(r.external_marks),
      totalMarks: Number(r.total_marks),
      grade: r.grade,
      resultStatus: r.result_status,
      publicationStatus: r.publication_status,
    })),
    summary: {
      passCount: Number(summaryRes.rows[0].pass),
      failCount: Number(summaryRes.rows[0].fail),
      absentCount: Number(summaryRes.rows[0].absent),
      passPercentage: pct(Number(summaryRes.rows[0].pass), Number(summaryRes.rows[0].total)),
      averagePercentage: summaryRes.rows[0].avg_pct ? Math.round(Number(summaryRes.rows[0].avg_pct) * 100) / 100 : 0,
    },
    charts,
    total,
    page: filters.page,
    limit: filters.limit,
    totalPages: Math.ceil(total / filters.limit),
  };
}

// ── 3. Fees Report ─────────────────────────────────────────────────────────────

export async function getFeesReport(userId: string, role: Role, filters: ReportFilters): Promise<ReportResult> {
  const scope = await resolveScopeContext(userId, role);
  if (scope.facultyId) throw AppError.forbidden('Faculty do not have access to the fees report');

  const conditions: string[] = ['f.deleted_at IS NULL'];
  const params: unknown[] = [];
  const push = (cond: string, val: unknown) => {
    params.push(val);
    conditions.push(`${cond} $${params.length}`);
  };

  const departmentId = scope.departmentId ?? filters.departmentId;
  if (departmentId) push('st.department_id =', departmentId);
  if (filters.studentId) push('f.student_id =', filters.studentId);
  if (filters.academicYear) push('f.academic_year =', filters.academicYear);
  if (filters.semester) push('f.semester =', filters.semester);
  if (filters.feeType) push('f.fee_type =', filters.feeType);
  if (filters.paymentStatus) push('f.payment_status =', filters.paymentStatus);

  const baseWhere = conditions.join(' AND ');
  const baseParams = [...params];

  params.push(filters.limit, (filters.page - 1) * filters.limit);
  const limitN = params.length - 1;
  const offsetN = params.length;

  const { rows } = await query<{
    roll_number: string;
    full_name: string;
    department_name: string;
    academic_year: string;
    semester: number;
    fee_type: string;
    total_amount: string;
    paid_amount: string;
    pending_amount: string;
    due_date: string;
    payment_status: string;
    total_count: string;
  }>(
    `SELECT st.roll_number, st.full_name, d.name AS department_name,
       f.academic_year, f.semester, f.fee_type, f.total_amount, f.paid_amount, f.pending_amount,
       TO_CHAR(f.due_date, 'YYYY-MM-DD') AS due_date, f.payment_status,
       COUNT(*) OVER()::text AS total_count
     FROM fees f
     JOIN students    st ON st.id = f.student_id
     JOIN departments d  ON d.id  = st.department_id
     WHERE ${baseWhere}
     ORDER BY f.due_date ASC
     LIMIT $${limitN} OFFSET $${offsetN}`,
    params
  );

  const summaryRes = await query<{ billed: string; collected: string; pending: string }>(
    `SELECT COALESCE(SUM(f.total_amount), 0)::text AS billed,
       COALESCE(SUM(f.paid_amount), 0)::text AS collected,
       COALESCE(SUM(f.pending_amount), 0)::text AS pending
     FROM fees f JOIN students st ON st.id = f.student_id
     WHERE ${baseWhere}`,
    baseParams
  );

  const trendParams: unknown[] = [];
  let trendDeptJoin = '';
  let trendDeptWhere = '';
  if (departmentId) {
    trendDeptJoin = 'JOIN fees f2 ON f2.id = fp.fee_id JOIN students st2 ON st2.id = f2.student_id';
    trendParams.push(departmentId);
    trendDeptWhere = 'AND st2.department_id = $1';
  }
  const trendRes = await query<{ month: Date; collected: string }>(
    `SELECT DATE_TRUNC('month', fp.payment_date) AS month, COALESCE(SUM(fp.amount), 0)::text AS collected
     FROM fee_payments fp ${trendDeptJoin}
     WHERE 1=1 ${trendDeptWhere}
     GROUP BY month ORDER BY month`,
    trendParams
  );

  const billed = Number(summaryRes.rows[0].billed);
  const collected = Number(summaryRes.rows[0].collected);
  const total = rows[0] ? Number(rows[0].total_count) : 0;

  const columns: ReportColumn[] = [
    { key: 'rollNumber', label: 'Roll Number' },
    { key: 'studentName', label: 'Student Name' },
    { key: 'department', label: 'Department' },
    { key: 'academicYear', label: 'Academic Year' },
    { key: 'semester', label: 'Semester' },
    { key: 'feeType', label: 'Fee Type' },
    { key: 'totalAmount', label: 'Total' },
    { key: 'paidAmount', label: 'Paid' },
    { key: 'pendingAmount', label: 'Pending' },
    { key: 'dueDate', label: 'Due Date' },
    { key: 'paymentStatus', label: 'Status' },
  ];

  const charts: ChartData[] = [
    {
      title: 'Fee Collection Trend',
      type: 'line',
      labels: trendRes.rows.map((r) => new Date(r.month).toISOString().slice(0, 7)),
      series: [{ label: 'Collected', data: trendRes.rows.map((r) => Number(r.collected)) }],
    },
  ];

  return {
    title: 'Fee Collection Report',
    columns,
    rows: rows.map((r) => ({
      rollNumber: r.roll_number,
      studentName: r.full_name,
      department: r.department_name,
      academicYear: r.academic_year,
      semester: r.semester,
      feeType: r.fee_type,
      totalAmount: Number(r.total_amount),
      paidAmount: Number(r.paid_amount),
      pendingAmount: Number(r.pending_amount),
      dueDate: r.due_date,
      paymentStatus: r.payment_status,
    })),
    summary: {
      totalBilled: billed,
      totalCollected: collected,
      totalPending: Number(summaryRes.rows[0].pending),
      collectionRate: pct(collected, billed),
    },
    charts,
    total,
    page: filters.page,
    limit: filters.limit,
    totalPages: Math.ceil(total / filters.limit),
  };
}

// ── 4. LMS Report ───────────────────────────────────────────────────────────────

export async function getLmsReport(userId: string, role: Role, filters: ReportFilters): Promise<ReportResult> {
  const scope = await resolveScopeContext(userId, role);
  const conditions: string[] = ['sub.deleted_at IS NULL'];
  const params: unknown[] = [];
  const push = (cond: string, val: unknown) => {
    params.push(val);
    conditions.push(`${cond} $${params.length}`);
  };

  const departmentId = scope.departmentId ?? filters.departmentId;
  if (departmentId) push('sub.department_id =', departmentId);
  const assignedFacultyId = scope.facultyId ?? filters.facultyId;
  if (assignedFacultyId) {
    params.push(assignedFacultyId);
    conditions.push(`sub.id IN (
      SELECT subject_id FROM faculty_subject_assignments
      WHERE faculty_id = $${params.length} AND is_active = TRUE AND deleted_at IS NULL
    )`);
  }
  if (filters.subjectId) push('sub.id =', filters.subjectId);

  const baseWhere = conditions.join(' AND ');
  const baseParams = [...params];

  params.push(filters.limit, (filters.page - 1) * filters.limit);
  const limitN = params.length - 1;
  const offsetN = params.length;

  const { rows } = await query<{
    subject_code: string;
    subject_name: string;
    materials: string;
    assignments: string;
    submissions: string;
    late_submissions: string;
    total_count: string;
  }>(
    `SELECT sub.code AS subject_code, sub.name AS subject_name,
       (SELECT COUNT(*) FROM course_materials cm WHERE cm.subject_id = sub.id AND cm.deleted_at IS NULL)::text AS materials,
       (SELECT COUNT(*) FROM assignments a WHERE a.subject_id = sub.id AND a.deleted_at IS NULL)::text AS assignments,
       (SELECT COUNT(*) FROM assignment_submissions asub
          JOIN assignments a ON a.id = asub.assignment_id
        WHERE a.subject_id = sub.id AND asub.deleted_at IS NULL)::text AS submissions,
       (SELECT COUNT(*) FROM assignment_submissions asub
          JOIN assignments a ON a.id = asub.assignment_id
        WHERE a.subject_id = sub.id AND asub.deleted_at IS NULL AND asub.status = 'Late Submission')::text AS late_submissions,
       COUNT(*) OVER()::text AS total_count
     FROM subjects sub
     WHERE ${baseWhere}
     ORDER BY sub.code
     LIMIT $${limitN} OFFSET $${offsetN}`,
    params
  );

  const trendRes = await query<{ month: Date; count: string }>(
    `SELECT DATE_TRUNC('month', asub.submitted_at) AS month, COUNT(*)::text AS count
     FROM assignment_submissions asub
     JOIN assignments a  ON a.id  = asub.assignment_id
     JOIN subjects    sub ON sub.id = a.subject_id
     WHERE asub.deleted_at IS NULL AND ${baseWhere}
     GROUP BY month ORDER BY month`,
    baseParams
  );

  const total = rows[0] ? Number(rows[0].total_count) : 0;

  const columns: ReportColumn[] = [
    { key: 'subjectCode', label: 'Subject' },
    { key: 'subjectName', label: 'Subject Name' },
    { key: 'materials', label: 'Materials' },
    { key: 'assignments', label: 'Assignments' },
    { key: 'submissions', label: 'Submissions' },
    { key: 'lateSubmissions', label: 'Late Submissions' },
    { key: 'submissionRate', label: 'Late %' },
  ];

  const charts: ChartData[] = [
    {
      title: 'Monthly Assignment Submissions',
      type: 'bar',
      labels: trendRes.rows.map((r) => new Date(r.month).toISOString().slice(0, 7)),
      series: [{ label: 'Submissions', data: trendRes.rows.map((r) => Number(r.count)) }],
    },
  ];

  return {
    title: 'LMS Report',
    columns,
    rows: rows.map((r) => ({
      subjectCode: r.subject_code,
      subjectName: r.subject_name,
      materials: Number(r.materials),
      assignments: Number(r.assignments),
      submissions: Number(r.submissions),
      lateSubmissions: Number(r.late_submissions),
      submissionRate: pct(Number(r.late_submissions), Number(r.submissions)),
    })),
    summary: {
      totalMaterials: rows.reduce((s, r) => s + Number(r.materials), 0),
      totalAssignments: rows.reduce((s, r) => s + Number(r.assignments), 0),
      totalSubmissions: rows.reduce((s, r) => s + Number(r.submissions), 0),
      totalLateSubmissions: rows.reduce((s, r) => s + Number(r.late_submissions), 0),
    },
    charts,
    total,
    page: filters.page,
    limit: filters.limit,
    totalPages: Math.ceil(total / filters.limit),
  };
}

// ── 5. Mentorship Report ─────────────────────────────────────────────────────────
// Reuses mentorship.service.getMentorshipReports() verbatim, then narrows by role.

export async function getMentorshipReport(userId: string, role: Role, filters: ReportFilters): Promise<ReportResult> {
  const scope = await resolveScopeContext(userId, role);
  const full = await getMentorshipReports();

  let relationships = full.relationships as Array<{ departmentName: string; mentorId: string | null; [key: string]: unknown }>;

  const targetDepartmentId = scope.departmentId ?? filters.departmentId;
  if (targetDepartmentId) {
    const { rows: deptRows } = await query<{ name: string }>('SELECT name FROM departments WHERE id = $1', [targetDepartmentId]);
    if (deptRows[0]) relationships = relationships.filter((r) => r.departmentName === deptRows[0].name);
  }
  if (scope.facultyId) {
    relationships = relationships.filter((r) => r.mentorId === scope.facultyId);
  }

  const page = filters.page;
  const limit = filters.limit;
  const total = relationships.length;
  const paged = relationships.slice((page - 1) * limit, (page - 1) * limit + limit);

  const assignedCount = relationships.filter((r) => r.mentorId).length;

  const columns: ReportColumn[] = [
    { key: 'studentName', label: 'Student Name' },
    { key: 'rollNumber', label: 'Roll Number' },
    { key: 'departmentName', label: 'Department' },
    { key: 'semester', label: 'Semester' },
    { key: 'mentorName', label: 'Mentor' },
  ];

  return {
    title: 'Mentorship Report',
    columns,
    rows: paged,
    summary: {
      totalStudents: total,
      assignedStudents: assignedCount,
      unassignedStudents: total - assignedCount,
    },
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

// ── 6. Department Report ─────────────────────────────────────────────────────────
// Reuses the same per-department aggregate helpers as analytics.service's HOD view.

export async function getDepartmentReport(userId: string, role: Role, filters: ReportFilters): Promise<ReportResult> {
  const scope = await resolveScopeContext(userId, role);
  if (scope.facultyId) throw AppError.forbidden('Only admins and HODs can access the department report');

  const deptConditions: string[] = ['deleted_at IS NULL'];
  const deptParams: unknown[] = [];
  if (scope.departmentId) {
    deptParams.push(scope.departmentId);
    deptConditions.push(`id = $${deptParams.length}`);
  } else if (filters.departmentId) {
    deptParams.push(filters.departmentId);
    deptConditions.push(`id = $${deptParams.length}`);
  }

  const { rows: depts } = await query<{ id: string; name: string }>(
    `SELECT id, name FROM departments WHERE ${deptConditions.join(' AND ')} ORDER BY name`,
    deptParams
  );

  const rows = await Promise.all(
    depts.map(async (d) => {
      const [overview, academic, teaching, mentorship] = await Promise.all([
        analyticsService.getInstitutionOverview(d.id),
        analyticsService.getAcademicAnalytics(d.id),
        analyticsService.getTeachingAnalytics(userId, d.id),
        analyticsService.getMentorshipAnalytics(d.id),
      ]);
      return {
        department: d.name,
        students: overview.totalStudents,
        faculty: overview.totalFaculty,
        subjects: overview.totalSubjects,
        averageAttendance: academic.averageAttendance,
        averageCGPA: academic.averageCGPA,
        passPercentage: academic.passPercentage,
        syllabusCompletion: teaching.syllabusCompletion,
        mentorGroups: mentorship.totalMentorGroups,
      };
    })
  );

  const columns: ReportColumn[] = [
    { key: 'department', label: 'Department' },
    { key: 'students', label: 'Students' },
    { key: 'faculty', label: 'Faculty' },
    { key: 'subjects', label: 'Subjects' },
    { key: 'averageAttendance', label: 'Avg Attendance %' },
    { key: 'averageCGPA', label: 'Avg CGPA' },
    { key: 'passPercentage', label: 'Pass %' },
    { key: 'syllabusCompletion', label: 'Syllabus %' },
    { key: 'mentorGroups', label: 'Mentor Groups' },
  ];

  const charts: ChartData[] = [
    {
      title: 'Department Performance',
      type: 'bar',
      labels: rows.map((r) => r.department),
      series: [
        { label: 'Avg CGPA', data: rows.map((r) => r.averageCGPA) },
        { label: 'Pass %', data: rows.map((r) => r.passPercentage) },
      ],
    },
  ];

  return {
    title: 'Department Performance Report',
    columns,
    rows,
    charts,
    total: rows.length,
    page: 1,
    limit: rows.length || 1,
    totalPages: 1,
  };
}

// ── 7. Student Report ─────────────────────────────────────────────────────────

export async function getStudentReport(userId: string, role: Role, filters: ReportFilters): Promise<ReportResult> {
  const conditions: string[] = ['st.deleted_at IS NULL'];
  const params: unknown[] = [];
  const push = (cond: string, val: unknown) => {
    params.push(val);
    conditions.push(`${cond} $${params.length}`);
  };

  if (role === 'student') {
    const { rows } = await query<{ id: string }>('SELECT id FROM students WHERE user_id = $1 AND deleted_at IS NULL', [userId]);
    if (!rows[0]) throw AppError.forbidden('No student profile is linked to this account');
    push('st.id =', rows[0].id);
  } else {
    const scope = await resolveScopeContext(userId, role);
    const departmentId = scope.departmentId ?? filters.departmentId;
    if (departmentId) push('st.department_id =', departmentId);
    if (scope.facultyId) {
      params.push(scope.facultyId);
      conditions.push(`EXISTS (
        SELECT 1 FROM faculty_subject_assignments fsa
        JOIN subjects fsub ON fsub.id = fsa.subject_id
        WHERE fsa.faculty_id = $${params.length} AND fsa.section = st.section
          AND fsub.program_id = st.program_id AND fsub.semester = st.semester
          AND fsa.is_active = TRUE AND fsa.deleted_at IS NULL
      )`);
    }
    if (filters.studentId) push('st.id =', filters.studentId);
    if (filters.section) push('st.section =', filters.section);
    if (filters.semester) push('st.semester =', filters.semester);
  }

  const baseWhere = conditions.join(' AND ');
  params.push(filters.limit, (filters.page - 1) * filters.limit);
  const limitN = params.length - 1;
  const offsetN = params.length;

  const { rows } = await query<{
    id: string;
    roll_number: string;
    full_name: string;
    department_name: string;
    semester: number;
    section: string;
    att_total: string;
    att_present: string;
    res_points: string;
    res_credits: string;
    marks_obtained: string;
    marks_maximum: string;
    fee_pending: string;
    assign_total: string;
    assign_submitted: string;
    total_count: string;
  }>(
    `WITH att AS (
       SELECT student_id, COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'present') AS present
       FROM attendance GROUP BY student_id
     ),
     res AS (
       SELECT r.student_id,
         SUM(${GRADE_POINT_SQL} * sub.credits) AS points, SUM(sub.credits) AS credits
       FROM results r JOIN subjects sub ON sub.id = r.subject_id
       WHERE r.publication_status = 'Published' AND r.deleted_at IS NULL
       GROUP BY r.student_id
     ),
     marks AS (
       SELECT student_id, SUM(obtained_marks) AS obtained, SUM(maximum_marks) AS maximum
       FROM internal_marks GROUP BY student_id
     ),
     fee AS (
       SELECT student_id, SUM(pending_amount) AS pending FROM fees WHERE deleted_at IS NULL GROUP BY student_id
     ),
     assign AS (
       SELECT st2.id AS student_id, COUNT(a.id) AS total, COUNT(asub.id) AS submitted
       FROM students st2
       JOIN subjects s2 ON s2.program_id = st2.program_id AND s2.semester = st2.semester AND s2.deleted_at IS NULL
       JOIN assignments a ON a.subject_id = s2.id AND a.deleted_at IS NULL
       LEFT JOIN assignment_submissions asub
         ON asub.assignment_id = a.id AND asub.student_id = st2.id AND asub.deleted_at IS NULL
       WHERE st2.deleted_at IS NULL
       GROUP BY st2.id
     )
     SELECT st.id, st.roll_number, st.full_name, d.name AS department_name, st.semester, st.section,
       COALESCE(att.total, 0)::text AS att_total, COALESCE(att.present, 0)::text AS att_present,
       COALESCE(res.points, 0)::text AS res_points, COALESCE(res.credits, 0)::text AS res_credits,
       COALESCE(marks.obtained, 0)::text AS marks_obtained, COALESCE(marks.maximum, 0)::text AS marks_maximum,
       COALESCE(fee.pending, 0)::text AS fee_pending,
       COALESCE(assign.total, 0)::text AS assign_total, COALESCE(assign.submitted, 0)::text AS assign_submitted,
       COUNT(*) OVER()::text AS total_count
     FROM students st
     JOIN departments d ON d.id = st.department_id
     LEFT JOIN att    ON att.student_id    = st.id
     LEFT JOIN res    ON res.student_id    = st.id
     LEFT JOIN marks  ON marks.student_id  = st.id
     LEFT JOIN fee    ON fee.student_id    = st.id
     LEFT JOIN assign ON assign.student_id = st.id
     WHERE ${baseWhere}
     ORDER BY d.name, st.roll_number
     LIMIT $${limitN} OFFSET $${offsetN}`,
    params
  );

  const total = rows[0] ? Number(rows[0].total_count) : 0;

  const columns: ReportColumn[] = [
    { key: 'rollNumber', label: 'Roll Number' },
    { key: 'studentName', label: 'Student Name' },
    { key: 'department', label: 'Department' },
    { key: 'semester', label: 'Semester' },
    { key: 'section', label: 'Section' },
    { key: 'attendancePercentage', label: 'Attendance %' },
    { key: 'cgpa', label: 'CGPA' },
    { key: 'internalMarksPercentage', label: 'Internal Marks %' },
    { key: 'feePending', label: 'Fee Pending' },
    { key: 'assignmentCompletionPercentage', label: 'Assignment %' },
  ];

  return {
    title: 'Student Performance Report',
    columns,
    rows: rows.map((r) => ({
      rollNumber: r.roll_number,
      studentName: r.full_name,
      department: r.department_name,
      semester: r.semester,
      section: r.section,
      attendancePercentage: pct(Number(r.att_present), Number(r.att_total)),
      cgpa: Number(r.res_credits) > 0 ? Math.round((Number(r.res_points) / Number(r.res_credits)) * 100) / 100 : 0,
      internalMarksPercentage: pct(Number(r.marks_obtained), Number(r.marks_maximum)),
      feePending: Number(r.fee_pending),
      assignmentCompletionPercentage: pct(Number(r.assign_submitted), Number(r.assign_total)),
    })),
    total,
    page: filters.page,
    limit: filters.limit,
    totalPages: Math.ceil(total / filters.limit),
  };
}

// ── 8. Opportunities Report ─────────────────────────────────────────────────────

export async function getOpportunitiesReport(userId: string, role: Role, filters: ReportFilters): Promise<ReportResult> {
  const scope = await resolveScopeContext(userId, role);
  const conditions: string[] = ['opp.deleted_at IS NULL'];
  const params: unknown[] = [];
  const push = (cond: string, val: unknown) => {
    params.push(val);
    conditions.push(`${cond} $${params.length}`);
  };

  const departmentId = scope.departmentId ?? filters.departmentId;
  if (departmentId) {
    params.push(departmentId);
    conditions.push(`(opp.department_id = $${params.length} OR opp.department_id IS NULL)`);
  }
  if (scope.facultyId) {
    params.push(scope.facultyId);
    conditions.push(`opp.created_by = (SELECT user_id FROM faculty WHERE id = $${params.length})`);
  }
  if (filters.opportunityType) push('opp.type =', filters.opportunityType);
  if (filters.opportunityStatus) push('opp.status =', filters.opportunityStatus);

  const baseWhere = conditions.join(' AND ');
  params.push(filters.limit, (filters.page - 1) * filters.limit);
  const limitN = params.length - 1;
  const offsetN = params.length;

  const { rows } = await query<{
    title: string;
    type: string;
    department_name: string | null;
    status: string;
    start_date: Date | null;
    deadline: Date | null;
    bookmark_count: string;
    total_count: string;
  }>(
    `SELECT opp.title, opp.type, d.name AS department_name, opp.status, opp.start_date, opp.deadline,
       (SELECT COUNT(*) FROM opportunity_bookmarks ob WHERE ob.opportunity_id = opp.id)::text AS bookmark_count,
       COUNT(*) OVER()::text AS total_count
     FROM opportunities opp
     LEFT JOIN departments d ON d.id = opp.department_id
     WHERE ${baseWhere}
     ORDER BY opp.deadline ASC NULLS LAST
     LIMIT $${limitN} OFFSET $${offsetN}`,
    params
  );

  const total = rows[0] ? Number(rows[0].total_count) : 0;

  const columns: ReportColumn[] = [
    { key: 'title', label: 'Title' },
    { key: 'type', label: 'Type' },
    { key: 'department', label: 'Department' },
    { key: 'status', label: 'Status' },
    { key: 'startDate', label: 'Start Date' },
    { key: 'deadline', label: 'Deadline' },
    { key: 'studentApplications', label: 'Student Applications' },
  ];

  const charts: ChartData[] = [
    {
      title: 'Opportunity Participation',
      type: 'bar',
      labels: rows.map((r) => r.title),
      series: [{ label: 'Applications', data: rows.map((r) => Number(r.bookmark_count)) }],
    },
  ];

  return {
    title: 'Placement Opportunity Report',
    columns,
    rows: rows.map((r) => ({
      title: r.title,
      type: r.type,
      department: r.department_name ?? 'All Departments',
      status: r.status,
      startDate: r.start_date,
      deadline: r.deadline,
      studentApplications: Number(r.bookmark_count),
    })),
    charts,
    total,
    page: filters.page,
    limit: filters.limit,
    totalPages: Math.ceil(total / filters.limit),
  };
}

// ── 9. Teaching Report ────────────────────────────────────────────────────────

export async function getTeachingReport(userId: string, role: Role, filters: ReportFilters): Promise<ReportResult> {
  const scope = await resolveScopeContext(userId, role);
  const conditions: string[] = ['tp.deleted_at IS NULL'];
  const params: unknown[] = [];
  const push = (cond: string, val: unknown) => {
    params.push(val);
    conditions.push(`${cond} $${params.length}`);
  };

  const departmentId = scope.departmentId ?? filters.departmentId;
  if (departmentId) push('tp.department_id =', departmentId);
  if (scope.facultyId) push('tp.faculty_id =', scope.facultyId);
  else if (filters.facultyId) push('tp.faculty_id =', filters.facultyId);
  if (filters.subjectId) push('tp.subject_id =', filters.subjectId);
  if (filters.section) push('tp.section =', filters.section);
  if (filters.semester) push('tp.semester =', filters.semester);
  if (filters.lessonStatus) push('tp.lesson_status =', filters.lessonStatus);

  const baseWhere = conditions.join(' AND ');
  params.push(filters.limit, (filters.page - 1) * filters.limit);
  const limitN = params.length - 1;
  const offsetN = params.length;

  const { rows } = await query<{
    faculty_name: string;
    subject_code: string;
    subject_name: string;
    section: string;
    semester: number;
    department_name: string;
    planned: string;
    completed: string;
    total_count: string;
  }>(
    `SELECT f.full_name AS faculty_name, sub.code AS subject_code, sub.name AS subject_name,
       tp.section, tp.semester, d.name AS department_name,
       COUNT(*) FILTER (WHERE tp.lesson_status != 'Cancelled')::text AS planned,
       COUNT(*) FILTER (WHERE tp.lesson_status = 'Completed')::text AS completed,
       COUNT(*) OVER()::text AS total_count
     FROM teaching_plans tp
     JOIN faculty     f   ON f.id   = tp.faculty_id
     JOIN subjects    sub ON sub.id = tp.subject_id
     JOIN departments d   ON d.id   = tp.department_id
     WHERE ${baseWhere}
     GROUP BY tp.faculty_id, f.full_name, tp.subject_id, sub.code, sub.name, tp.section, tp.semester, d.name
     ORDER BY d.name, f.full_name, sub.code
     LIMIT $${limitN} OFFSET $${offsetN}`,
    params
  );

  // Window function COUNT(*) OVER() runs after GROUP BY but before LIMIT in Postgres's
  // logical processing order, so it already reflects the total group count pre-pagination.
  const total = rows[0] ? Number(rows[0].total_count) : 0;

  const columns: ReportColumn[] = [
    { key: 'facultyName', label: 'Faculty' },
    { key: 'subjectCode', label: 'Subject' },
    { key: 'department', label: 'Department' },
    { key: 'section', label: 'Section' },
    { key: 'semester', label: 'Semester' },
    { key: 'lessonsPlanned', label: 'Lessons Planned' },
    { key: 'lessonsCompleted', label: 'Lessons Completed' },
    { key: 'completionPercentage', label: 'Completion %' },
  ];

  const charts: ChartData[] = [
    {
      title: 'Teaching Progress',
      type: 'bar',
      labels: rows.map((r) => `${r.subject_code} (${r.section})`),
      series: [{ label: 'Completion %', data: rows.map((r) => pct(Number(r.completed), Number(r.planned))) }],
    },
  ];

  return {
    title: 'Teaching Progress Report',
    columns,
    rows: rows.map((r) => ({
      facultyName: r.faculty_name,
      subjectCode: r.subject_code,
      subjectName: r.subject_name,
      department: r.department_name,
      section: r.section,
      semester: r.semester,
      lessonsPlanned: Number(r.planned),
      lessonsCompleted: Number(r.completed),
      completionPercentage: pct(Number(r.completed), Number(r.planned)),
    })),
    charts,
    total,
    page: filters.page,
    limit: filters.limit,
    totalPages: Math.ceil(total / filters.limit),
  };
}

// ── 10. Room Seating Chart Report (Print Center) ─────────────────────────────
// Thin presentational wrapper over examSeating.service's own role/scope-checked
// read path — no seating data is duplicated here.

export async function getRoomSeatingChartReport(userId: string, role: Role, filters: ReportFilters): Promise<ReportResult> {
  if (!filters.roomId) throw AppError.badRequest('roomId is required for the room seating chart report');
  const chart = await examSeatingService.getSeatingByRoom(userId, role, filters.roomId, filters.dateFrom);

  const columns: ReportColumn[] = [
    { key: 'benchNumber', label: 'Bench' },
    { key: 'seatPosition', label: 'Position' },
    { key: 'seatNumber', label: 'Seat #' },
    { key: 'rollNumber', label: 'Roll Number' },
    { key: 'studentName', label: 'Student Name' },
    { key: 'departmentCode', label: 'Department' },
    { key: 'subjectCode', label: 'Subject' },
  ];

  const rows = [...chart.seats]
    .sort((a, b) => (a.benchNumber ?? a.seatNumber) - (b.benchNumber ?? b.seatNumber))
    .map((s) => ({
      benchNumber: s.benchNumber ?? s.seatNumber,
      seatPosition: s.seatPosition ?? '-',
      seatNumber: s.seatNumber,
      rollNumber: s.rollNumber,
      studentName: s.studentName,
      departmentCode: s.departmentCode,
      subjectCode: s.subjectCode,
    }));

  return {
    title: `Room Seating Chart — ${chart.roomName}`,
    columns,
    rows,
    summary: { capacity: chart.capacity, occupied: chart.occupied, roomName: chart.roomName },
    total: rows.length,
    page: 1,
    limit: rows.length || 1,
    totalPages: 1,
  };
}

// ── 11. Student Seating List Report (Print Center) ───────────────────────────

export async function getStudentSeatingListReport(userId: string, role: Role, filters: ReportFilters): Promise<ReportResult> {
  if (!filters.examId) throw AppError.badRequest('examId is required for the student seating list report');
  const rooms = await examSeatingService.getSeatingByExam(userId, role, filters.examId);

  const columns: ReportColumn[] = [
    { key: 'rollNumber', label: 'Roll Number' },
    { key: 'studentName', label: 'Student Name' },
    { key: 'departmentCode', label: 'Department' },
    { key: 'roomName', label: 'Room' },
    { key: 'benchNumber', label: 'Bench' },
    { key: 'seatPosition', label: 'Position' },
  ];

  const rows = rooms
    .flatMap((r) => r.seats)
    .sort((a, b) => a.rollNumber.localeCompare(b.rollNumber))
    .map((s) => ({
      rollNumber: s.rollNumber,
      studentName: s.studentName,
      departmentCode: s.departmentCode,
      roomName: s.roomName,
      benchNumber: s.benchNumber ?? s.seatNumber,
      seatPosition: s.seatPosition ?? '-',
    }));

  return {
    title: 'Student Seating List',
    columns,
    rows,
    total: rows.length,
    page: 1,
    limit: rows.length || 1,
    totalPages: 1,
  };
}

// ── 12. Invigilator Sheet Report (Print Center) ──────────────────────────────

export async function getInvigilatorSheetReport(userId: string, role: Role, filters: ReportFilters): Promise<ReportResult> {
  if (!filters.roomId) throw AppError.badRequest('roomId is required for the invigilator sheet report');

  const { duties } = await examInvigilationService.listInvigilationDuties(userId, role, {
    roomId: filters.roomId,
    from: filters.dateFrom,
    to: filters.dateTo,
    page: 1,
    limit: 200,
  });

  const columns: ReportColumn[] = [
    { key: 'dutyDate', label: 'Date' },
    { key: 'startTime', label: 'Start' },
    { key: 'endTime', label: 'End' },
    { key: 'roomName', label: 'Room' },
    { key: 'facultyName', label: 'Invigilator' },
    { key: 'status', label: 'Status' },
  ];

  const rows = duties.map((d) => ({
    dutyDate: d.dutyDate,
    startTime: d.startTime,
    endTime: d.endTime,
    roomName: d.roomName,
    facultyName: d.facultyName,
    status: d.status,
  }));

  return {
    title: 'Invigilator Duty Sheet',
    columns,
    rows,
    total: rows.length,
    page: 1,
    limit: rows.length || 1,
    totalPages: 1,
  };
}

// ── 13. Attendance Sheet Report (Print Center) ───────────────────────────────
// A blank printable roll-number + signature list generated from seat allocations
// — distinct from (and never reads) the actual Attendance module's records.

export async function getSeatingAttendanceSheetReport(userId: string, role: Role, filters: ReportFilters): Promise<ReportResult> {
  if (!filters.examId && !filters.roomId) {
    throw AppError.badRequest('Either examId or roomId is required for the attendance sheet report');
  }

  let seats: Array<{ rollNumber: string; studentName: string; roomName: string; benchNumber: number | null }>;
  if (filters.examId) {
    const rooms = await examSeatingService.getSeatingByExam(userId, role, filters.examId);
    seats = rooms.flatMap((r) => r.seats);
  } else {
    const chart = await examSeatingService.getSeatingByRoom(userId, role, filters.roomId!, filters.dateFrom);
    seats = chart.seats;
  }
  const sorted = [...seats].sort((a, b) => a.rollNumber.localeCompare(b.rollNumber));

  const columns: ReportColumn[] = [
    { key: 'rollNumber', label: 'Roll Number' },
    { key: 'studentName', label: 'Student Name' },
    { key: 'roomName', label: 'Room' },
    { key: 'benchNumber', label: 'Bench' },
    { key: 'signature', label: 'Signature' },
  ];

  const rows = sorted.map((s) => ({
    rollNumber: s.rollNumber,
    studentName: s.studentName,
    roomName: s.roomName,
    benchNumber: s.benchNumber ?? '-',
    signature: '',
  }));

  return {
    title: 'Exam Attendance Sheet',
    columns,
    rows,
    total: rows.length,
    page: 1,
    limit: rows.length || 1,
    totalPages: 1,
  };
}

// ── 14. Seating Summary Report (Print Center / Analytics) ────────────────────

export async function getSeatingSummaryReport(userId: string, role: Role, filters: ReportFilters): Promise<ReportResult> {
  const analytics = await examSeatingService.getSeatingAnalytics(userId, role, {
    examId: filters.examId,
    examSessionId: filters.examSessionId,
  });

  const columns: ReportColumn[] = [
    { key: 'departmentCode', label: 'Department' },
    { key: 'count', label: 'Students' },
  ];

  const rows = analytics.studentsPerDepartment.map((d) => ({ departmentCode: d.departmentCode, count: d.count }));

  const charts: ChartData[] = [
    {
      title: 'Students per Department',
      type: 'bar',
      labels: rows.map((r) => r.departmentCode),
      series: [{ label: 'Students', data: rows.map((r) => r.count) }],
    },
  ];

  return {
    title: 'Exam Seating Summary',
    columns,
    rows,
    summary: {
      totalStudents: analytics.totalStudents,
      roomsUsed: analytics.roomsUsed,
      capacityUtilizationPercent: analytics.capacityUtilizationPercent,
      invigilatorsAssigned: analytics.invigilatorsAssigned,
      averageOccupancyPercent: analytics.averageOccupancyPercent,
    },
    charts,
    total: rows.length,
    page: 1,
    limit: rows.length || 1,
    totalPages: 1,
  };
}

// ── Dispatcher used by the export endpoints ──────────────────────────────────────

export async function getReportByType(
  reportType: string,
  userId: string,
  role: Role,
  filters: ReportFilters
): Promise<ReportResult> {
  switch (reportType) {
    case 'attendance':
      return getAttendanceReport(userId, role, filters);
    case 'results':
      return getResultsReport(userId, role, filters);
    case 'fees':
      return getFeesReport(userId, role, filters);
    case 'lms':
      return getLmsReport(userId, role, filters);
    case 'mentorship':
      return getMentorshipReport(userId, role, filters);
    case 'department':
      return getDepartmentReport(userId, role, filters);
    case 'student':
      return getStudentReport(userId, role, filters);
    case 'opportunities':
      return getOpportunitiesReport(userId, role, filters);
    case 'teaching':
      return getTeachingReport(userId, role, filters);
    case 'room_seating_chart':
      return getRoomSeatingChartReport(userId, role, filters);
    case 'student_seating_list':
      return getStudentSeatingListReport(userId, role, filters);
    case 'invigilator_sheet':
      return getInvigilatorSheetReport(userId, role, filters);
    case 'attendance_sheet':
      return getSeatingAttendanceSheetReport(userId, role, filters);
    case 'seating_summary':
      return getSeatingSummaryReport(userId, role, filters);
    default:
      throw AppError.badRequest(`Unknown report type: ${reportType}`);
  }
}
