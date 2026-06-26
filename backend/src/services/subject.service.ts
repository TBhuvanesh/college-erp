import { query } from '../config/database';
import { auditLog } from '../utils/audit';
import { AppError } from '../errors/AppError';
import type {
  CreateSubjectInput,
  UpdateSubjectInput,
  UpdateSubjectStatusInput,
  ListSubjectsQuery,
  SubjectDetail,
  SubjectSummary,
  PaginatedSubjects,
} from '../types/subject';

// ── Row types (snake_case from PostgreSQL) ─────────────────────────────────────

interface SubjectDetailRow {
  id: string;
  code: string;
  name: string;
  department_id: string;
  department_name: string;
  department_code: string;
  program_id: string;
  program_name: string;
  program_code: string;
  semester: number;
  credits: number;
  type: SubjectDetail['type'];
  status: SubjectDetail['status'];
  created_at: Date;
  updated_at: Date;
}

interface SubjectListRow extends SubjectDetailRow {
  total_count: string; // pg returns bigint as string
}

// ── Shared query fragments ─────────────────────────────────────────────────────

const DETAIL_COLS = `
  s.id, s.code, s.name,
  d.id   AS department_id,
  d.name AS department_name,
  d.code AS department_code,
  p.id   AS program_id,
  p.name AS program_name,
  p.code AS program_code,
  s.semester, s.credits, s.type, s.status, s.created_at, s.updated_at
`;

const JOINS = `
  JOIN departments d ON d.id = s.department_id
  JOIN programs    p ON p.id = s.program_id
`;

// ── Mappers ───────────────────────────────────────────────────────────────────

function toDetail(r: SubjectDetailRow): SubjectDetail {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    department: {
      id: r.department_id,
      name: r.department_name,
      code: r.department_code,
    },
    program: {
      id: r.program_id,
      name: r.program_name,
      code: r.program_code,
    },
    semester: r.semester,
    credits: r.credits,
    type: r.type,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toSummary(r: SubjectDetailRow): SubjectSummary {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    departmentName: r.department_name,
    programName: r.program_name,
    semester: r.semester,
    credits: r.credits,
    type: r.type,
    status: r.status,
  };
}

// ── Validation helper ─────────────────────────────────────────────────────────

async function validateProgramPlacement(
  departmentId: string,
  programId: string,
  semester: number
): Promise<void> {
  const { rows: prog } = await query<{ department_id: string; total_semesters: number }>(
    'SELECT department_id, total_semesters FROM programs WHERE id = $1 AND deleted_at IS NULL',
    [programId]
  );
  if (!prog[0]) throw AppError.notFound('Program not found');
  if (prog[0].department_id !== departmentId) {
    throw AppError.badRequest(
      'Program does not belong to the specified department',
      'PROGRAM_DEPT_MISMATCH'
    );
  }
  if (semester > prog[0].total_semesters) {
    throw AppError.badRequest(
      `Semester ${semester} exceeds this program's duration of ${prog[0].total_semesters} semesters`,
      'SEMESTER_OUT_OF_RANGE'
    );
  }
}

// ── Read operations ───────────────────────────────────────────────────────────

export async function getSubjectById(id: string): Promise<SubjectDetail> {
  const { rows } = await query<SubjectDetailRow>(
    `SELECT ${DETAIL_COLS} FROM subjects s ${JOINS}
     WHERE s.id = $1 AND s.deleted_at IS NULL`,
    [id]
  );
  if (!rows[0]) throw AppError.notFound('Subject not found');
  return toDetail(rows[0]);
}

export async function listSubjects(filters: ListSubjectsQuery): Promise<PaginatedSubjects> {
  const conditions: string[] = ['s.deleted_at IS NULL'];
  const params: unknown[] = [];

  const push = (condition: string, value: unknown) => {
    params.push(value);
    conditions.push(`${condition} $${params.length}`);
  };

  if (filters.departmentId) push('s.department_id =', filters.departmentId);
  if (filters.programId) push('s.program_id =', filters.programId);
  if (filters.semester) push('s.semester =', filters.semester);
  if (filters.type) push('s.type =', filters.type);
  if (filters.status) push('s.status =', filters.status);

  if (filters.search) {
    const term = `%${filters.search}%`;
    params.push(term);
    conditions.push(
      `(s.name ILIKE $${params.length} OR s.code ILIKE $${params.length})`
    );
  }

  const offset = (filters.page - 1) * filters.limit;
  params.push(filters.limit, offset);

  const { rows } = await query<SubjectListRow>(
    `SELECT ${DETAIL_COLS}, COUNT(*) OVER() AS total_count
     FROM subjects s ${JOINS}
     WHERE ${conditions.join(' AND ')}
     ORDER BY s.semester ASC, s.code ASC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const total = rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0;

  return {
    subjects: rows.map(toSummary),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.ceil(total / filters.limit),
    },
  };
}

// ── Write operations ──────────────────────────────────────────────────────────

export async function createSubject(
  data: CreateSubjectInput,
  actorId: string
): Promise<SubjectDetail> {
  // Validate department exists
  const { rows: dept } = await query<{ id: string }>(
    'SELECT id FROM departments WHERE id = $1 AND deleted_at IS NULL',
    [data.departmentId]
  );
  if (!dept[0]) throw AppError.notFound('Department not found');

  // Validate program belongs to department and semester is in range
  await validateProgramPlacement(data.departmentId, data.programId, data.semester);

  const { rows } = await query<{ id: string }>(
    `INSERT INTO subjects (code, name, department_id, program_id, semester, credits, type)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      data.code, data.name,
      data.departmentId, data.programId,
      data.semester, data.credits, data.type,
    ]
  );
  const subjectId = rows[0].id;

  await auditLog({
    actorId,
    action: 'CREATE_SUBJECT',
    resource: 'subjects',
    resourceId: subjectId,
    changes: { code: data.code, name: data.name, type: data.type },
  });

  return getSubjectById(subjectId);
}

export async function updateSubject(
  id: string,
  data: UpdateSubjectInput,
  actorId: string
): Promise<SubjectDetail> {
  // Fetch current state for cross-field validation
  const current = await getSubjectById(id);

  const newDeptId = data.departmentId ?? current.department.id;
  const newProgId = data.programId ?? current.program.id;
  const newSemester = data.semester ?? current.semester;

  // Validate consistency when department, program, or semester changes
  if (data.departmentId !== undefined || data.programId !== undefined || data.semester !== undefined) {
    await validateProgramPlacement(newDeptId, newProgId, newSemester);
  }

  const setClauses: string[] = [];
  const params: unknown[] = [];

  const set = (col: string, val: unknown) => {
    params.push(val);
    setClauses.push(`${col} = $${params.length}`);
  };

  if (data.name !== undefined) set('name', data.name);
  if (data.departmentId !== undefined) set('department_id', data.departmentId);
  if (data.programId !== undefined) set('program_id', data.programId);
  if (data.semester !== undefined) set('semester', data.semester);
  if (data.credits !== undefined) set('credits', data.credits);
  if (data.type !== undefined) set('type', data.type);

  params.push(id);
  const { rowCount } = await query(
    `UPDATE subjects
     SET ${setClauses.join(', ')}
     WHERE id = $${params.length} AND deleted_at IS NULL`,
    params
  );
  if (!rowCount) throw AppError.notFound('Subject not found');

  await auditLog({
    actorId,
    action: 'UPDATE_SUBJECT',
    resource: 'subjects',
    resourceId: id,
    changes: data as Record<string, unknown>,
  });

  return getSubjectById(id);
}

export async function updateSubjectStatus(
  id: string,
  data: UpdateSubjectStatusInput,
  actorId: string
): Promise<SubjectDetail> {
  const { rowCount } = await query(
    `UPDATE subjects SET status = $1
     WHERE id = $2 AND deleted_at IS NULL`,
    [data.status, id]
  );
  if (!rowCount) throw AppError.notFound('Subject not found');

  await auditLog({
    actorId,
    action: 'UPDATE_SUBJECT_STATUS',
    resource: 'subjects',
    resourceId: id,
    changes: { status: data.status },
  });

  return getSubjectById(id);
}

export async function deleteSubject(id: string, actorId: string): Promise<void> {
  const { rowCount } = await query(
    `UPDATE subjects
     SET deleted_at = NOW(), status = 'archived'
     WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  if (!rowCount) throw AppError.notFound('Subject not found');

  await auditLog({
    actorId,
    action: 'DELETE_SUBJECT',
    resource: 'subjects',
    resourceId: id,
  });
}
