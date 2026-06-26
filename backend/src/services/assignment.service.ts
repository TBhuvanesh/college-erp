import { query } from '../config/database';
import { auditLog } from '../utils/audit';
import { AppError } from '../errors/AppError';
import type { AssignmentDetail, CreateAssignmentInput, ListAssignmentsQuery } from '../types/assignment';

// ── Row type ───────────────────────────────────────────────────────────────────

interface AssignmentRow {
  id: string;
  faculty_id: string;
  faculty_name: string;
  employee_number: string;
  subject_id: string;
  subject_code: string;
  subject_name: string;
  department_name: string;
  semester: number;
  academic_year: string;
  section: string;
  is_active: boolean;
  created_at: Date;
}

// ── Shared query fragments ─────────────────────────────────────────────────────

const DETAIL_COLS = `
  fsa.id,
  fsa.faculty_id,  f.full_name  AS faculty_name,  f.employee_number,
  fsa.subject_id,  s.code       AS subject_code,   s.name AS subject_name,
  d.name           AS department_name,              s.semester,
  fsa.academic_year, fsa.section, fsa.is_active, fsa.created_at
`;

const JOINS = `
  JOIN faculty     f ON f.id = fsa.faculty_id
  JOIN subjects    s ON s.id = fsa.subject_id
  JOIN departments d ON d.id = s.department_id
`;

// ── Mapper ────────────────────────────────────────────────────────────────────

function toDetail(r: AssignmentRow): AssignmentDetail {
  return {
    id: r.id,
    facultyId: r.faculty_id,
    facultyName: r.faculty_name,
    employeeNumber: r.employee_number,
    subjectId: r.subject_id,
    subjectCode: r.subject_code,
    subjectName: r.subject_name,
    departmentName: r.department_name,
    semester: r.semester,
    academicYear: r.academic_year,
    section: r.section,
    isActive: r.is_active,
    createdAt: r.created_at,
  };
}

// ── Read operations ───────────────────────────────────────────────────────────

export async function getAssignmentById(id: string): Promise<AssignmentDetail> {
  const { rows } = await query<AssignmentRow>(
    `SELECT ${DETAIL_COLS} FROM faculty_subject_assignments fsa ${JOINS}
     WHERE fsa.id = $1 AND fsa.deleted_at IS NULL`,
    [id]
  );
  if (!rows[0]) throw AppError.notFound('Assignment not found');
  return toDetail(rows[0]);
}

export async function listAssignments(filters: ListAssignmentsQuery): Promise<AssignmentDetail[]> {
  const conditions: string[] = ['fsa.deleted_at IS NULL'];
  const params: unknown[] = [];

  const push = (condition: string, value: unknown) => {
    params.push(value);
    conditions.push(`${condition} $${params.length}`);
  };

  if (filters.facultyId) push('fsa.faculty_id =', filters.facultyId);
  if (filters.subjectId) push('fsa.subject_id =', filters.subjectId);
  if (filters.academicYear) push('fsa.academic_year =', filters.academicYear);
  if (filters.section) push('fsa.section =', filters.section);
  if (filters.isActive !== undefined) push('fsa.is_active =', filters.isActive);

  const { rows } = await query<AssignmentRow>(
    `SELECT ${DETAIL_COLS} FROM faculty_subject_assignments fsa ${JOINS}
     WHERE ${conditions.join(' AND ')}
     ORDER BY fsa.academic_year DESC, f.full_name ASC, s.semester ASC`,
    params
  );
  return rows.map(toDetail);
}

/**
 * Returns active assignments for a specific faculty member.
 * Used by the attendance module to populate the faculty's subject list.
 */
export async function getAssignmentsByFacultyId(
  facultyId: string,
  academicYear?: string
): Promise<AssignmentDetail[]> {
  const conditions = [
    'fsa.faculty_id = $1',
    'fsa.deleted_at IS NULL',
    'fsa.is_active = TRUE',
  ];
  const params: unknown[] = [facultyId];

  if (academicYear) {
    params.push(academicYear);
    conditions.push(`fsa.academic_year = $${params.length}`);
  }

  const { rows } = await query<AssignmentRow>(
    `SELECT ${DETAIL_COLS} FROM faculty_subject_assignments fsa ${JOINS}
     WHERE ${conditions.join(' AND ')}
     ORDER BY s.semester ASC, s.code ASC`,
    params
  );
  return rows.map(toDetail);
}

/**
 * Checks whether a faculty member is actively assigned to teach a given subject+section.
 * Used by the attendance service to authorize mark-attendance requests.
 */
export async function isFacultyAssigned(
  facultyId: string,
  subjectId: string,
  section: string
): Promise<boolean> {
  const { rows } = await query<{ id: string }>(
    `SELECT id FROM faculty_subject_assignments
     WHERE faculty_id = $1 AND subject_id = $2 AND section = $3
       AND is_active = TRUE AND deleted_at IS NULL
     LIMIT 1`,
    [facultyId, subjectId, section]
  );
  return rows.length > 0;
}

// ── Write operations ──────────────────────────────────────────────────────────

export async function createAssignment(
  data: CreateAssignmentInput,
  actorId: string
): Promise<AssignmentDetail> {
  // Validate faculty exists
  const { rows: f } = await query<{ id: string }>(
    'SELECT id FROM faculty WHERE id = $1 AND deleted_at IS NULL',
    [data.facultyId]
  );
  if (!f[0]) throw AppError.notFound('Faculty member not found');

  // Validate subject exists and is active
  const { rows: s } = await query<{ id: string; status: string }>(
    'SELECT id, status FROM subjects WHERE id = $1 AND deleted_at IS NULL',
    [data.subjectId]
  );
  if (!s[0]) throw AppError.notFound('Subject not found');
  if (s[0].status === 'archived') {
    throw AppError.badRequest('Cannot assign an archived subject', 'SUBJECT_ARCHIVED');
  }

  const { rows } = await query<{ id: string }>(
    `INSERT INTO faculty_subject_assignments (faculty_id, subject_id, academic_year, section)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [data.facultyId, data.subjectId, data.academicYear, data.section]
  );
  const assignmentId = rows[0].id;

  await auditLog({
    actorId,
    action: 'CREATE_ASSIGNMENT',
    resource: 'faculty_subject_assignments',
    resourceId: assignmentId,
    changes: {
      facultyId: data.facultyId,
      subjectId: data.subjectId,
      section: data.section,
      academicYear: data.academicYear,
    },
  });

  return getAssignmentById(assignmentId);
}

export async function deleteAssignment(id: string, actorId: string): Promise<void> {
  const { rowCount } = await query(
    `UPDATE faculty_subject_assignments
     SET deleted_at = NOW(), is_active = FALSE
     WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  if (!rowCount) throw AppError.notFound('Assignment not found');

  await auditLog({
    actorId,
    action: 'DELETE_ASSIGNMENT',
    resource: 'faculty_subject_assignments',
    resourceId: id,
  });
}
