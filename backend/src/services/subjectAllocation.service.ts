import { query } from '../config/database';
import { auditLog } from '../utils/audit';
import { AppError } from '../errors/AppError';
import type {
  AllocationDetail,
  CreateAllocationInput,
  UpdateAllocationInput,
  ListAllocationsQuery,
} from '../types/subjectAllocation';

// ── Shared query fragments ─────────────────────────────────────────────────────

const DETAIL_COLS = `
  fsa.id,
  fsa.faculty_id AS "facultyId",
  f.full_name AS "facultyName",
  f.employee_number AS "employeeNumber",
  fsa.subject_id AS "subjectId",
  s.code AS "subjectCode",
  s.name AS "subjectName",
  s.department_id AS "departmentId",
  d.name AS "departmentName",
  s.semester,
  fsa.section,
  fsa.academic_year AS "academicYear",
  fsa.status,
  fsa.created_by AS "createdBy",
  u_creator.full_name AS "createdByName",
  fsa.created_at AS "createdAt",
  fsa.updated_at AS "updatedAt",
  fsa.removed_by AS "removedBy",
  u_remover.full_name AS "removedByName",
  fsa.deleted_at AS "removedAt",
  fsa.removal_reason AS "removalReason"
`;

const JOINS = `
  JOIN faculty f ON f.id = fsa.faculty_id
  JOIN subjects s ON s.id = fsa.subject_id
  JOIN departments d ON d.id = s.department_id
  LEFT JOIN users u_creator ON u_creator.id = fsa.created_by
  LEFT JOIN users u_remover ON u_remover.id = fsa.removed_by
`;

// ── Read operations ───────────────────────────────────────────────────────────

export async function getAllocationById(id: string): Promise<AllocationDetail> {
  const { rows } = await query<any>(
    `SELECT ${DETAIL_COLS} FROM faculty_subject_assignments fsa ${JOINS}
     WHERE fsa.id = $1 AND fsa.deleted_at IS NULL`,
    [id]
  );
  if (!rows[0]) throw AppError.notFound('Subject allocation not found');
  return rows[0] as AllocationDetail;
}

export async function getAllocations(filters: ListAllocationsQuery): Promise<AllocationDetail[]> {
  const conditions: string[] = ['fsa.deleted_at IS NULL'];
  const params: unknown[] = [];

  const push = (condition: string, value: unknown) => {
    params.push(value);
    conditions.push(`${condition} $${params.length}`);
  };

  if (filters.departmentId) push('s.department_id =', filters.departmentId);
  if (filters.semester) push('s.semester =', filters.semester);
  if (filters.section) push('fsa.section =', filters.section);
  if (filters.subjectId) push('fsa.subject_id =', filters.subjectId);
  if (filters.facultyId) push('fsa.faculty_id =', filters.facultyId);
  if (filters.academicYear) push('fsa.academic_year =', filters.academicYear);
  if (filters.status) push('fsa.status =', filters.status);

  if (filters.search) {
    params.push(`%${filters.search}%`);
    conditions.push(
      `(f.full_name ILIKE $${params.length} OR s.name ILIKE $${params.length} OR s.code ILIKE $${params.length})`
    );
  }

  const { rows } = await query<any>(
    `SELECT ${DETAIL_COLS} FROM faculty_subject_assignments fsa ${JOINS}
     WHERE ${conditions.join(' AND ')}
     ORDER BY fsa.academic_year DESC, d.name ASC, s.semester ASC, s.code ASC, fsa.section ASC`,
    params
  );
  return rows as AllocationDetail[];
}

// ── Write operations ──────────────────────────────────────────────────────────

export async function createAllocation(
  data: CreateAllocationInput,
  actorId: string
): Promise<{ allocation: AllocationDetail; warning?: string }> {
  // Validate faculty exists and get their department
  const { rows: f } = await query<{ id: string; department_id: string }>(
    'SELECT id, department_id FROM faculty WHERE id = $1 AND deleted_at IS NULL',
    [data.facultyId]
  );
  if (!f[0]) throw AppError.notFound('Faculty member not found');

  // Validate subject exists, get department and status
  const { rows: s } = await query<{ id: string; department_id: string; status: string }>(
    'SELECT id, department_id, status FROM subjects WHERE id = $1 AND deleted_at IS NULL',
    [data.subjectId]
  );
  if (!s[0]) throw AppError.notFound('Subject not found');
  if (s[0].status === 'archived') {
    throw AppError.badRequest('Cannot assign an archived subject', 'SUBJECT_ARCHIVED');
  }

  // 1. Validation: Faculty and subject must belong to same department
  if (f[0].department_id !== s[0].department_id) {
    throw AppError.badRequest(
      'Department Mismatch: Faculty and subject must belong to the same department',
      'DEPARTMENT_MISMATCH'
    );
  }

  // 2. Validation: Prevent duplicate allocations for this subject + academic year + section
  const { rows: duplicate } = await query<{ id: string }>(
    `SELECT id FROM faculty_subject_assignments
     WHERE subject_id = $1 AND academic_year = $2 AND section = $3 AND deleted_at IS NULL LIMIT 1`,
    [data.subjectId, data.academicYear, data.section]
  );
  if (duplicate[0]) {
    throw AppError.badRequest(
      'Duplicate Allocation: This subject and section combination is already allocated to a faculty member for this academic year',
      'DUPLICATE_ALLOCATION'
    );
  }

  // Calculate current workload for warning threshold
  const { rows: workload } = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM faculty_subject_assignments
     WHERE faculty_id = $1 AND academic_year = $2 AND is_active = TRUE AND deleted_at IS NULL`,
    [data.facultyId, data.academicYear]
  );
  const currentLoadCount = parseInt(workload[0].count, 10);
  let warning: string | undefined;
  if (currentLoadCount >= 3) {
    warning = `Workload Warning: Faculty currently has ${currentLoadCount} active subject assignments. Exceeding recommended limit of 3.`;
  }

  // Insert the allocation
  const isActive = data.status === 'active';
  const { rows } = await query<{ id: string }>(
    `INSERT INTO faculty_subject_assignments (
      faculty_id, subject_id, academic_year, section, status, is_active, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id`,
    [data.facultyId, data.subjectId, data.academicYear, data.section, data.status, isActive, actorId]
  );
  const allocationId = rows[0].id;

  await auditLog({
    actorId,
    action: 'CREATE_ALLOCATION',
    resource: 'faculty_subject_assignments',
    resourceId: allocationId,
    changes: { ...data, isActive },
  });

  const allocation = await getAllocationById(allocationId);
  return { allocation, warning };
}

export async function updateAllocation(
  id: string,
  data: UpdateAllocationInput,
  actorId: string
): Promise<{ allocation: AllocationDetail; warning?: string }> {
  // Retrieve existing allocation
  const existing = await getAllocationById(id);

  const facultyId = data.facultyId || existing.facultyId;
  const subjectId = data.subjectId || existing.subjectId;
  const section = data.section || existing.section;
  const status = data.status || existing.status;

  // Validate faculty exists and get department
  const { rows: f } = await query<{ id: string; department_id: string }>(
    'SELECT id, department_id FROM faculty WHERE id = $1 AND deleted_at IS NULL',
    [facultyId]
  );
  if (!f[0]) throw AppError.notFound('Faculty member not found');

  // Validate subject exists and get department
  const { rows: s } = await query<{ id: string; department_id: string; status: string }>(
    'SELECT id, department_id, status FROM subjects WHERE id = $1 AND deleted_at IS NULL',
    [subjectId]
  );
  if (!s[0]) throw AppError.notFound('Subject not found');
  if (s[0].status === 'archived') {
    throw AppError.badRequest('Cannot assign an archived subject', 'SUBJECT_ARCHIVED');
  }

  // 1. Validation: Faculty and subject must belong to same department
  if (f[0].department_id !== s[0].department_id) {
    throw AppError.badRequest(
      'Department Mismatch: Faculty and subject must belong to the same department',
      'DEPARTMENT_MISMATCH'
    );
  }

  // 2. Validation: Prevent duplicate subject + academic year + section (excluding this allocation)
  const { rows: duplicate } = await query<{ id: string }>(
    `SELECT id FROM faculty_subject_assignments
     WHERE subject_id = $1 AND academic_year = $2 AND section = $3 AND id != $4 AND deleted_at IS NULL LIMIT 1`,
    [subjectId, existing.academicYear, section, id]
  );
  if (duplicate[0]) {
    throw AppError.badRequest(
      'Duplicate Allocation: This subject and section combination is already allocated to a faculty member for this academic year',
      'DUPLICATE_ALLOCATION'
    );
  }

  // Calculate current workload of target faculty for warning
  const { rows: workload } = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM faculty_subject_assignments
     WHERE faculty_id = $1 AND academic_year = $2 AND id != $3 AND is_active = TRUE AND deleted_at IS NULL`,
    [facultyId, existing.academicYear, id]
  );
  const currentLoadCount = parseInt(workload[0].count, 10);
  let warning: string | undefined;
  if (currentLoadCount >= 3) {
    warning = `Workload Warning: Faculty currently has ${currentLoadCount} active subject assignments. Exceeding recommended limit of 3.`;
  }

  const isActive = status === 'active';
  await query(
    `UPDATE faculty_subject_assignments
     SET faculty_id = $1, subject_id = $2, section = $3, status = $4, is_active = $5, updated_at = NOW()
     WHERE id = $6`,
    [facultyId, subjectId, section, status, isActive, id]
  );

  await auditLog({
    actorId,
    action: 'UPDATE_ALLOCATION',
    resource: 'faculty_subject_assignments',
    resourceId: id,
    changes: { ...data, isActive },
  });

  const allocation = await getAllocationById(id);
  return { allocation, warning };
}

export async function transferAllocation(
  id: string,
  newFacultyId: string,
  actorId: string
): Promise<{ allocation: AllocationDetail; warning?: string }> {
  // Retrieve existing allocation
  const existing = await getAllocationById(id);

  // Validate new faculty exists and get department
  const { rows: f } = await query<{ id: string; department_id: string }>(
    'SELECT id, department_id FROM faculty WHERE id = $1 AND deleted_at IS NULL',
    [newFacultyId]
  );
  if (!f[0]) throw AppError.notFound('New Faculty member not found');

  // Validate new faculty belongs to same department as allocation's subject
  const { rows: s } = await query<{ department_id: string }>(
    'SELECT department_id FROM subjects WHERE id = $1',
    [existing.subjectId]
  );
  if (f[0].department_id !== s[0].department_id) {
    throw AppError.badRequest(
      'Department Mismatch: Target faculty and allocation subject must belong to the same department',
      'DEPARTMENT_MISMATCH'
    );
  }

  // Workload check for warning
  const { rows: workload } = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM faculty_subject_assignments
     WHERE faculty_id = $1 AND academic_year = $2 AND id != $3 AND is_active = TRUE AND deleted_at IS NULL`,
    [newFacultyId, existing.academicYear, id]
  );
  const currentLoadCount = parseInt(workload[0].count, 10);
  let warning: string | undefined;
  if (currentLoadCount >= 3) {
    warning = `Workload Warning: Target faculty currently has ${currentLoadCount} active subject assignments. Exceeding recommended limit of 3.`;
  }

  // Perform transfer
  await query(
    `UPDATE faculty_subject_assignments
     SET faculty_id = $1, updated_at = NOW()
     WHERE id = $2`,
    [newFacultyId, id]
  );

  await auditLog({
    actorId,
    action: 'TRANSFER_ALLOCATION',
    resource: 'faculty_subject_assignments',
    resourceId: id,
    changes: { fromFacultyId: existing.facultyId, toFacultyId: newFacultyId },
  });

  const allocation = await getAllocationById(id);
  return { allocation, warning };
}

export async function deleteAllocation(
  id: string,
  reason: string,
  actorId: string
): Promise<void> {
  const { rowCount } = await query(
    `UPDATE faculty_subject_assignments
     SET deleted_at = NOW(), is_active = FALSE, status = 'inactive', removed_by = $1, removal_reason = $2
     WHERE id = $3 AND deleted_at IS NULL`,
    [actorId, reason, id]
  );
  if (!rowCount) throw AppError.notFound('Subject allocation not found');

  await auditLog({
    actorId,
    action: 'DELETE_ALLOCATION',
    resource: 'faculty_subject_assignments',
    resourceId: id,
    changes: { removalReason: reason },
  });
}

// ── Statistics & Analytics ─────────────────────────────────────────────────────

export interface WorkloadStatistics {
  totalSubjects: number;
  assignedSubjects: number;
  unassignedSubjects: number;
  facultyWithMaxWorkload: { facultyId: string; facultyName: string; employeeNumber: string; count: number } | null;
  facultyWithMinWorkload: { facultyId: string; facultyName: string; employeeNumber: string; count: number } | null;
  averageSubjectsPerFaculty: number;
  pendingAllocations: number;
  analytics: {
    subjectsPerFaculty: { facultyName: string; count: number }[];
    departmentDistribution: { departmentName: string; count: number }[];
    semesterDistribution: { semester: number; count: number }[];
  };
}

export async function getWorkloadStatistics(academicYear: string): Promise<WorkloadStatistics> {
  // 1. Total active subjects
  const { rows: tSubjs } = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM subjects WHERE status = 'active' AND deleted_at IS NULL`
  );
  const totalSubjects = parseInt(tSubjs[0].count, 10);

  // 2. Assigned active subjects
  const { rows: aSubjs } = await query<{ count: string }>(
    `SELECT COUNT(DISTINCT subject_id)::text AS count FROM faculty_subject_assignments
     WHERE academic_year = $1 AND is_active = TRUE AND deleted_at IS NULL`,
    [academicYear]
  );
  const assignedSubjects = parseInt(aSubjs[0].count, 10);
  const unassignedSubjects = Math.max(0, totalSubjects - assignedSubjects);

  // 3. Faculty workload rankings
  const { rows: rankings } = await query<{ faculty_id: string; full_name: string; employee_number: string; count: string }>(
    `SELECT fsa.faculty_id, f.full_name, f.employee_number, COUNT(*)::text AS count
     FROM faculty_subject_assignments fsa
     JOIN faculty f ON f.id = fsa.faculty_id
     WHERE fsa.academic_year = $1 AND fsa.is_active = TRUE AND fsa.deleted_at IS NULL
     GROUP BY fsa.faculty_id, f.full_name, f.employee_number
     ORDER BY COUNT(*) DESC`,
    [academicYear]
  );

  let facultyWithMaxWorkload = null;
  let facultyWithMinWorkload = null;

  if (rankings.length > 0) {
    const maxRank = rankings[0];
    const minRank = rankings[rankings.length - 1];

    facultyWithMaxWorkload = {
      facultyId: maxRank.faculty_id,
      facultyName: maxRank.full_name,
      employeeNumber: maxRank.employee_number,
      count: parseInt(maxRank.count, 10),
    };

    facultyWithMinWorkload = {
      facultyId: minRank.faculty_id,
      facultyName: minRank.full_name,
      employeeNumber: minRank.employee_number,
      count: parseInt(minRank.count, 10),
    };
  }

  // 4. Active Faculty Count
  const { rows: activeFacCount } = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM faculty WHERE status = 'active' AND deleted_at IS NULL`
  );
  const facultyCount = parseInt(activeFacCount[0].count, 10);
  const averageSubjectsPerFaculty = facultyCount > 0 ? parseFloat((assignedSubjects / facultyCount).toFixed(2)) : 0;

  // 5. Pending Allocations
  const { rows: pendingAlloc } = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM faculty_subject_assignments
     WHERE academic_year = $1 AND status = 'pending' AND deleted_at IS NULL`,
    [academicYear]
  );
  const pendingAllocations = parseInt(pendingAlloc[0].count, 10);

  // ── Workload Analytics ──
  
  // A. Subjects per faculty details (Limit top 10 for dashboard display)
  const subjectsPerFaculty = rankings.slice(0, 10).map((r) => ({
    facultyName: r.full_name,
    count: parseInt(r.count, 10),
  }));

  // B. Department Distribution
  const { rows: deptDist } = await query<{ department_name: string; count: string }>(
    `SELECT d.name AS department_name, COUNT(*)::text AS count
     FROM faculty_subject_assignments fsa
     JOIN subjects s ON s.id = fsa.subject_id
     JOIN departments d ON d.id = s.department_id
     WHERE fsa.academic_year = $1 AND fsa.deleted_at IS NULL
     GROUP BY d.name
     ORDER BY COUNT(*) DESC`,
    [academicYear]
  );
  const departmentDistribution = deptDist.map((r) => ({
    departmentName: r.department_name,
    count: parseInt(r.count, 10),
  }));

  // C. Semester Distribution
  const { rows: semDist } = await query<{ semester: number; count: string }>(
    `SELECT s.semester, COUNT(*)::text AS count
     FROM faculty_subject_assignments fsa
     JOIN subjects s ON s.id = fsa.subject_id
     WHERE fsa.academic_year = $1 AND fsa.deleted_at IS NULL
     GROUP BY s.semester
     ORDER BY s.semester ASC`,
    [academicYear]
  );
  const semesterDistribution = semDist.map((r) => ({
    semester: Number(r.semester),
    count: parseInt(r.count, 10),
  }));

  return {
    totalSubjects,
    assignedSubjects,
    unassignedSubjects,
    facultyWithMaxWorkload,
    facultyWithMinWorkload,
    averageSubjectsPerFaculty,
    pendingAllocations,
    analytics: {
      subjectsPerFaculty,
      departmentDistribution,
      semesterDistribution,
    },
  };
}

export async function getSubjectProfile(subjectId: string): Promise<any> {
  // 1. Get Subject details
  const { rows: subRows } = await query<any>(
    `SELECT s.id, s.code, s.name, s.semester, s.credits, s.status, s.program_id,
            d.name AS "departmentName", p.name AS "programName",
            s.regulation, s.year, s.semester_raw, s.lecture_hours, s.tutorial_hours, s.practical_hours, s.description, s.program
     FROM subjects s
     JOIN departments d ON d.id = s.department_id
     LEFT JOIN programs p ON p.id = s.program_id
     WHERE s.id = $1 AND s.deleted_at IS NULL`,
    [subjectId]
  );
  if (!subRows[0]) throw AppError.notFound('Subject not found');
  const subject = subRows[0];

  // 2. Get Assigned Faculty list
  const { rows: facRows } = await query<any>(
    `SELECT fsa.id AS "allocationId", f.id AS "facultyId", f.full_name AS "facultyName",
            f.employee_number AS "employeeNumber", fsa.section, fsa.status, fsa.academic_year AS "academicYear"
     FROM faculty_subject_assignments fsa
     JOIN faculty f ON f.id = fsa.faculty_id
     WHERE fsa.subject_id = $1 AND fsa.deleted_at IS NULL AND fsa.status = 'active'`,
    [subjectId]
  );

  // 3. Count Enrolled Students
  const { rows: studRows } = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM students
     WHERE program_id = $1 AND current_semester = $2 AND status = 'active' AND deleted_at IS NULL`,
    [subject.program_id, subject.semester]
  );
  const studentsEnrolled = parseInt(studRows[0].count, 10);

  // 4. Attendance summary (number of sessions logged)
  const { rows: attRows } = await query<{ count: string }>(
    `SELECT COUNT(DISTINCT attendance_date)::text AS count FROM attendance
     WHERE subject_id = $1`,
    [subjectId]
  );
  const attendanceSessionsLogged = parseInt(attRows[0].count, 10);

  // 5. LMS status
  const { rows: matRows } = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM course_materials WHERE subject_id = $1 AND deleted_at IS NULL`,
    [subjectId]
  );
  const { rows: lmsAssignRows } = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM assignments WHERE subject_id = $1 AND deleted_at IS NULL`,
    [subjectId]
  );
  const materialsCount = parseInt(matRows[0].count, 10);
  const assignmentsCount = parseInt(lmsAssignRows[0].count, 10);

  // 6. Internal marks submissions
  const { rows: marksRows } = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM internal_marks WHERE subject_id = $1 AND deleted_at IS NULL`,
    [subjectId]
  );
  const internalMarksSubmittedCount = parseInt(marksRows[0].count, 10);

  return {
    id: subject.id,
    code: subject.code,
    name: subject.name,
    departmentName: subject.departmentName,
    programName: subject.program || subject.programName || null,
    regulation: subject.regulation,
    year: subject.year,
    semester: subject.semester,
    semesterRaw: subject.semester_raw,
    lectureHours: subject.lecture_hours,
    tutorialHours: subject.tutorial_hours,
    practicalHours: subject.practical_hours,
    credits: subject.credits,
    status: subject.status,
    description: subject.description,
    studentsEnrolled,
    assignedFaculty: facRows.map((f: any) => ({
      allocationId: f.allocationId,
      facultyId: f.facultyId,
      facultyName: f.facultyName,
      employeeNumber: f.employeeNumber,
      section: f.section,
      status: f.status,
      academicYear: f.academicYear,
    })),
    sections: Array.from(new Set(facRows.map((f: any) => f.section))),
    attendanceStatus: attendanceSessionsLogged > 0 ? `Active (${attendanceSessionsLogged} sessions logged)` : 'No records logged',
    lmsStatus: `Active (${materialsCount} materials, ${assignmentsCount} assignments)`,
    internalMarksStatus: internalMarksSubmittedCount > 0 ? `Submitted (${internalMarksSubmittedCount} marks records)` : 'Pending submissions',
  };
}

