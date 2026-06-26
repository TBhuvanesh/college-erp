import { query, withTransaction } from '../config/database';
import { hashPassword } from '../utils/password';
import { auditLog } from '../utils/audit';
import { AppError } from '../errors/AppError';
import type {
  CreateStudentInput,
  UpdateStudentInput,
  UpdateStatusInput,
  ListStudentsQuery,
  StudentDetail,
  StudentSummary,
  PaginatedStudents,
} from '../types/student';

// ── Row types (snake_case from PostgreSQL) ─────────────────────────────────────

interface StudentDetailRow {
  id: string;
  user_id: string;
  roll_number: string;
  full_name: string;
  email: string;
  department_id: string;
  department_name: string;
  department_code: string;
  program_id: string;
  program_name: string;
  program_code: string;
  total_semesters: number;
  semester: number;
  section: string | null;
  academic_year: string;
  status: StudentDetail['status'];
  created_at: Date;
  updated_at: Date;
}

interface StudentListRow extends StudentDetailRow {
  total_count: string; // pg returns bigint as string
}

// ── Shared query fragments ────────────────────────────────────────────────────

const DETAIL_COLS = `
  s.id, s.user_id, s.roll_number, s.full_name,
  u.email,
  d.id   AS department_id,
  d.name AS department_name,
  d.code AS department_code,
  p.id              AS program_id,
  p.name            AS program_name,
  p.code            AS program_code,
  p.total_semesters,
  s.semester, s.section, s.academic_year,
  s.status, s.created_at, s.updated_at
`;

const JOINS = `
  JOIN users       u ON u.id = s.user_id
  JOIN departments d ON d.id = s.department_id
  JOIN programs    p ON p.id = s.program_id
`;

// ── Mapper ────────────────────────────────────────────────────────────────────

function toDetail(r: StudentDetailRow): StudentDetail {
  return {
    id: r.id,
    userId: r.user_id,
    rollNumber: r.roll_number,
    fullName: r.full_name,
    email: r.email,
    department: {
      id: r.department_id,
      name: r.department_name,
      code: r.department_code,
    },
    program: {
      id: r.program_id,
      name: r.program_name,
      code: r.program_code,
      totalSemesters: r.total_semesters,
    },
    semester: r.semester,
    section: r.section ?? undefined,
    academicYear: r.academic_year,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toSummary(r: StudentDetailRow): StudentSummary {
  return {
    id: r.id,
    rollNumber: r.roll_number,
    fullName: r.full_name,
    email: r.email,
    departmentName: r.department_name,
    programName: r.program_name,
    semester: r.semester,
    section: r.section ?? undefined,
    academicYear: r.academic_year,
    status: r.status,
  };
}

// ── Read operations ───────────────────────────────────────────────────────────

export async function getStudentById(id: string): Promise<StudentDetail> {
  const { rows } = await query<StudentDetailRow>(
    `SELECT ${DETAIL_COLS} FROM students s ${JOINS}
     WHERE s.id = $1 AND s.deleted_at IS NULL`,
    [id]
  );
  if (!rows[0]) throw AppError.notFound('Student not found');
  return toDetail(rows[0]);
}

export async function getStudentByUserId(userId: string): Promise<StudentDetail> {
  const { rows } = await query<StudentDetailRow>(
    `SELECT ${DETAIL_COLS} FROM students s ${JOINS}
     WHERE s.user_id = $1 AND s.deleted_at IS NULL`,
    [userId]
  );
  if (!rows[0]) throw AppError.notFound('Student profile not found');
  return toDetail(rows[0]);
}

export async function listStudents(filters: ListStudentsQuery): Promise<PaginatedStudents> {
  const conditions: string[] = ['s.deleted_at IS NULL'];
  const params: unknown[] = [];

  const push = (condition: string, value: unknown) => {
    params.push(value);
    conditions.push(`${condition} $${params.length}`);
  };

  if (filters.departmentId) push('s.department_id =', filters.departmentId);
  if (filters.programId) push('s.program_id =', filters.programId);
  if (filters.semester) push('s.semester =', filters.semester);
  if (filters.status) push('s.status =', filters.status);
  if (filters.academicYear) push('s.academic_year =', filters.academicYear);

  if (filters.search) {
    const term = `%${filters.search}%`;
    params.push(term);
    conditions.push(
      `(s.full_name ILIKE $${params.length} OR s.roll_number ILIKE $${params.length})`
    );
  }

  const offset = (filters.page - 1) * filters.limit;
  params.push(filters.limit, offset);

  const { rows } = await query<StudentListRow>(
    `SELECT ${DETAIL_COLS}, COUNT(*) OVER() AS total_count
     FROM students s ${JOINS}
     WHERE ${conditions.join(' AND ')}
     ORDER BY s.full_name ASC, s.roll_number ASC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const total = rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0;

  return {
    students: rows.map(toSummary),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.ceil(total / filters.limit),
    },
  };
}

// ── Write operations ──────────────────────────────────────────────────────────

export async function createStudent(
  data: CreateStudentInput,
  actorId: string
): Promise<StudentDetail> {
  return withTransaction(async (client) => {
    // Validate department exists
    const { rows: dept } = await client.query<{ id: string }>(
      'SELECT id FROM departments WHERE id = $1 AND deleted_at IS NULL',
      [data.departmentId]
    );
    if (!dept[0]) throw AppError.notFound('Department not found');

    // Validate program exists and belongs to this department
    const { rows: prog } = await client.query<{ id: string; department_id: string; total_semesters: number }>(
      'SELECT id, department_id, total_semesters FROM programs WHERE id = $1 AND deleted_at IS NULL',
      [data.programId]
    );
    if (!prog[0]) throw AppError.notFound('Program not found');
    if (prog[0].department_id !== data.departmentId) {
      throw AppError.badRequest(
        'Program does not belong to the specified department',
        'PROGRAM_DEPT_MISMATCH'
      );
    }
    if (data.semester > prog[0].total_semesters) {
      throw AppError.badRequest(
        `Semester ${data.semester} exceeds this program's duration of ${prog[0].total_semesters} semesters`,
        'SEMESTER_OUT_OF_RANGE'
      );
    }

    // Create auth account for the student
    const passwordHash = await hashPassword(data.password);
    const { rows: userRows } = await client.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, role)
       VALUES ($1, $2, 'student')
       RETURNING id`,
      [data.email, passwordHash]
    );
    const userId = userRows[0].id;

    // Create student profile
    const { rows: studentRows } = await client.query<{ id: string }>(
      `INSERT INTO students
         (user_id, roll_number, full_name, department_id, program_id, semester, section, academic_year)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        userId, data.rollNumber, data.fullName,
        data.departmentId, data.programId,
        data.semester, data.section ?? null, data.academicYear,
      ]
    );
    const studentId = studentRows[0].id;

    // Fetch the full detail row within the same transaction
    const { rows: detail } = await client.query<StudentDetailRow>(
      `SELECT ${DETAIL_COLS} FROM students s ${JOINS}
       WHERE s.id = $1`,
      [studentId]
    );

    await auditLog({
      actorId,
      action: 'CREATE_STUDENT',
      resource: 'students',
      resourceId: studentId,
      changes: { rollNumber: data.rollNumber, email: data.email, role: 'student' },
    });

    return toDetail(detail[0]);
  });
}

export async function updateStudent(
  id: string,
  data: UpdateStudentInput,
  actorId: string
): Promise<StudentDetail> {
  // Fetch current state to validate cross-field constraints
  const current = await getStudentById(id);

  const newDeptId = data.departmentId ?? current.department.id;
  const newProgId = data.programId ?? current.program.id;

  // Validate program ↔ department consistency when either changes
  if (data.departmentId || data.programId) {
    const { rows: prog } = await query<{ department_id: string; total_semesters: number }>(
      'SELECT department_id, total_semesters FROM programs WHERE id = $1 AND deleted_at IS NULL',
      [newProgId]
    );
    if (!prog[0]) throw AppError.notFound('Program not found');
    if (prog[0].department_id !== newDeptId) {
      throw AppError.badRequest(
        'Program does not belong to the specified department',
        'PROGRAM_DEPT_MISMATCH'
      );
    }

    const semesterToCheck = data.semester ?? current.semester;
    if (semesterToCheck > prog[0].total_semesters) {
      throw AppError.badRequest(
        `Semester ${semesterToCheck} exceeds this program's duration of ${prog[0].total_semesters} semesters`,
        'SEMESTER_OUT_OF_RANGE'
      );
    }
  }

  // Build SET clause from only the provided fields
  const setClauses: string[] = [];
  const params: unknown[] = [];

  const set = (col: string, val: unknown) => {
    params.push(val);
    setClauses.push(`${col} = $${params.length}`);
  };

  if (data.fullName !== undefined) set('full_name', data.fullName);
  if (data.departmentId !== undefined) set('department_id', data.departmentId);
  if (data.programId !== undefined) set('program_id', data.programId);
  if (data.semester !== undefined) set('semester', data.semester);
  if ('section' in data) set('section', data.section ?? null);
  if (data.academicYear !== undefined) set('academic_year', data.academicYear);

  params.push(id);
  const { rowCount } = await query(
    `UPDATE students
     SET ${setClauses.join(', ')}
     WHERE id = $${params.length} AND deleted_at IS NULL`,
    params
  );
  if (!rowCount) throw AppError.notFound('Student not found');

  await auditLog({
    actorId,
    action: 'UPDATE_STUDENT',
    resource: 'students',
    resourceId: id,
    changes: data as Record<string, unknown>,
  });

  return getStudentById(id);
}

export async function updateStudentStatus(
  id: string,
  data: UpdateStatusInput,
  actorId: string
): Promise<StudentDetail> {
  const { rowCount } = await query(
    `UPDATE students SET status = $1
     WHERE id = $2 AND deleted_at IS NULL`,
    [data.status, id]
  );
  if (!rowCount) throw AppError.notFound('Student not found');

  await auditLog({
    actorId,
    action: 'UPDATE_STUDENT_STATUS',
    resource: 'students',
    resourceId: id,
    changes: { status: data.status },
  });

  return getStudentById(id);
}

export async function deleteStudent(id: string, actorId: string): Promise<void> {
  const { rowCount } = await query(
    `UPDATE students
     SET deleted_at = NOW(), status = 'inactive'
     WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  if (!rowCount) throw AppError.notFound('Student not found');

  // Deactivate the linked auth account so the student can no longer log in
  await query(
    `UPDATE users SET is_active = FALSE
     WHERE id = (SELECT user_id FROM students WHERE id = $1)`,
    [id]
  );

  await auditLog({
    actorId,
    action: 'DELETE_STUDENT',
    resource: 'students',
    resourceId: id,
  });
}
