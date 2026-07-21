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
  program_id: string | null;
  program_name: string | null;
  program_code: string | null;
  semester: number;
  credits: number;
  type: SubjectDetail['type'];
  status: SubjectDetail['status'];
  created_at: Date;
  updated_at: Date;
  regulation: string;
  year: string | null;
  semester_raw: string | null;
  lecture_hours: number;
  tutorial_hours: number;
  practical_hours: number;
  description: string | null;
  program: string | null;
}

interface SubjectListRow extends SubjectDetailRow {
  total_count: string;
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
  s.semester, s.credits, s.type, s.status, s.created_at, s.updated_at,
  s.regulation, s.year, s.semester_raw, s.lecture_hours, s.tutorial_hours, s.practical_hours, s.description, s.program
`;

const JOINS = `
  JOIN departments d ON d.id = s.department_id
  LEFT JOIN programs    p ON p.id = s.program_id
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
    program: r.program_id ? {
      id: r.program_id,
      name: r.program_name || '',
      code: r.program_code || '',
    } : null,
    programName: r.program || r.program_name || null,
    regulation: r.regulation,
    year: r.year as any,
    semester: r.semester,
    semesterRaw: r.semester_raw as any,
    lectureHours: r.lecture_hours,
    tutorialHours: r.tutorial_hours,
    practicalHours: r.practical_hours,
    credits: r.credits,
    type: r.type,
    status: r.status,
    description: r.description,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toSummary(r: SubjectDetailRow): SubjectSummary {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    departmentId: r.department_id,
    departmentName: r.department_name,
    programId: r.program_id,
    programName: r.program || r.program_name || null,
    regulation: r.regulation,
    year: r.year,
    semester: r.semester,
    semesterRaw: r.semester_raw,
    credits: r.credits,
    type: r.type,
    status: r.status,
    lectureHours: r.lecture_hours,
    tutorialHours: r.tutorial_hours,
    practicalHours: r.practical_hours,
  };
}

// ── Helper: Map Raw Year/Semester to absolute Semester (1-8) ────────────────────

export function mapYearSemToSemester(year?: string | null, semRaw?: string | null): number {
  if (!year || !semRaw) return 1;

  const y = year.toUpperCase();
  const s = semRaw.toUpperCase();

  if (y === 'I') return s === 'II' ? 2 : 1;
  if (y === 'II') return s === 'II' ? 4 : 3;
  if (y === 'III') return s === 'II' ? 6 : 5;
  if (y === 'IV') return s === 'II' ? 8 : 7;

  return 1;
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
  if (filters.regulation) push('s.regulation =', filters.regulation);
  if (filters.year) push('s.year =', filters.year);

  if (filters.program) {
    params.push(`%${filters.program}%`);
    conditions.push(`(s.program ILIKE $${params.length} OR p.name ILIKE $${params.length})`);
  }

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
     ORDER BY s.regulation DESC, s.semester ASC, s.code ASC
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

  // Validate program belongs to department and semester is in range (only if programId is set)
  let calculatedSemester = data.semester || 1;
  if (data.year && data.semesterRaw) {
    calculatedSemester = mapYearSemToSemester(data.year, data.semesterRaw);
  }

  if (data.programId) {
    await validateProgramPlacement(data.departmentId, data.programId, calculatedSemester);
  }

  // Validate subject code is unique
  const { rows: codeDup } = await query('SELECT id FROM subjects WHERE code = $1 AND deleted_at IS NULL LIMIT 1', [data.code]);
  if (codeDup[0]) {
    throw AppError.badRequest('Subject code must be unique', 'DUPLICATE_SUBJECT_CODE');
  }

  const { rows } = await query<{ id: string }>(
    `INSERT INTO subjects (
      code, name, department_id, program_id, semester, credits, type, status,
      regulation, year, semester_raw, lecture_hours, tutorial_hours, practical_hours, description, program
    )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     RETURNING id`,
    [
      data.code,
      data.name,
      data.departmentId,
      data.programId || null,
      calculatedSemester,
      data.credits,
      data.type,
      data.status || 'active',
      data.regulation || 'R22',
      data.year || null,
      data.semesterRaw || null,
      data.lectureHours || 0,
      data.tutorialHours || 0,
      data.practicalHours || 0,
      data.description || null,
      data.program || null,
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
  const current = await getSubjectById(id);

  const newDeptId = data.departmentId ?? current.department.id;
  const newProgId = data.programId !== undefined ? data.programId : (current.program ? current.program.id : null);
  
  let newSemester = current.semester;
  let newYear = data.year !== undefined ? data.year : current.year;
  let newSemRaw = data.semesterRaw !== undefined ? data.semesterRaw : current.semesterRaw;

  if (data.year !== undefined || data.semesterRaw !== undefined) {
    newSemester = mapYearSemToSemester(newYear, newSemRaw);
  } else if (data.semester !== undefined && data.semester !== null) {
    newSemester = data.semester;
  }

  // Validate consistency when department, program, or semester changes (only if program exists)
  if (newProgId && (data.departmentId !== undefined || data.programId !== undefined || data.semester !== undefined || data.year !== undefined || data.semesterRaw !== undefined)) {
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
  set('program_id', newProgId);
  if (data.program !== undefined) set('program', data.program);
  set('semester', newSemester);
  if (data.credits !== undefined) set('credits', data.credits);
  if (data.type !== undefined) set('type', data.type);
  if (data.regulation !== undefined) set('regulation', data.regulation);
  set('year', newYear);
  set('semester_raw', newSemRaw);
  if (data.lectureHours !== undefined) set('lecture_hours', data.lectureHours);
  if (data.tutorialHours !== undefined) set('tutorial_hours', data.tutorialHours);
  if (data.practicalHours !== undefined) set('practical_hours', data.practicalHours);
  if (data.description !== undefined) set('description', data.description);
  if (data.status !== undefined) set('status', data.status);

  params.push(id);
  const { rowCount } = await query(
    `UPDATE subjects
     SET ${setClauses.join(', ')}, updated_at = NOW()
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
    `UPDATE subjects SET status = $1, updated_at = NOW()
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
  // ── Verification: Check if subject is actively used in other modules ──
  
  // 1. Subject Allocation (faculty_subject_assignments)
  const { rows: fsa } = await query(
    'SELECT 1 FROM faculty_subject_assignments WHERE subject_id = $1 AND deleted_at IS NULL LIMIT 1',
    [id]
  );
  
  // 2. Attendance
  const { rows: att } = await query(
    'SELECT 1 FROM attendance WHERE subject_id = $1 LIMIT 1',
    [id]
  );

  // 3. LMS Course Materials
  const { rows: lmsMat } = await query(
    'SELECT 1 FROM course_materials WHERE subject_id = $1 AND deleted_at IS NULL LIMIT 1',
    [id]
  );

  // 4. LMS Assignments
  const { rows: lmsAss } = await query(
    'SELECT 1 FROM assignments WHERE subject_id = $1 AND deleted_at IS NULL LIMIT 1',
    [id]
  );

  // 5. Internal Marks
  const { rows: marks } = await query(
    'SELECT 1 FROM internal_marks WHERE subject_id = $1 LIMIT 1',
    [id]
  );

  // 6. Results
  const { rows: results } = await query(
    'SELECT 1 FROM results WHERE subject_id = $1 LIMIT 1',
    [id]
  );

  // 7. Teaching Plans
  const { rows: tp } = await query(
    'SELECT 1 FROM teaching_plans WHERE subject_id = $1 AND deleted_at IS NULL LIMIT 1',
    [id]
  );

  if (fsa[0] || att[0] || lmsMat[0] || lmsAss[0] || marks[0] || results[0] || tp[0]) {
    throw AppError.badRequest(
      'This subject is currently in use and cannot be deleted. Please mark it as Inactive instead.',
      'SUBJECT_IN_USE'
    );
  }

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

export async function deleteAllSubjects(
  actorId: string
): Promise<{ deletedCount: number; skippedCount: number }> {
  const { rowCount } = await query(
    `UPDATE subjects
     SET deleted_at = NOW(), status = 'archived'
     WHERE deleted_at IS NULL`
  );

  const count = rowCount || 0;

  await auditLog({
    actorId,
    action: 'DELETE_SUBJECT',
    resource: 'subjects',
    resourceId: 'all',
    changes: { count }
  });

  return {
    deletedCount: count,
    skippedCount: 0,
  };
}
