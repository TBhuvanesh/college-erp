import { query } from '../config/database';
import { AppError } from '../errors/AppError';

// ── StudentRegistry ──────────────────────────────────────────────────────────
// The only way other modules should resolve a student's core identity
// (name/roll number/department/program/semester/section). Student Management
// (student.service.ts) remains the single owner of the `students` table and
// its full CRUD surface — this registry re-exports that surface for a single
// import path, and adds the one thing that was missing: a shared "core
// identity" lookup. Before this file, ~20 service files each wrote their own
// ad-hoc `SELECT ... FROM students WHERE id = $1` (or `user_id = $1`) with a
// slightly different column list (docs/erp-integration-audit.md and this
// sprint's follow-up audit both confirmed this) — every one of those is a
// duplicate of the same lookup, not a different one.

export {
  getStudentById,
  getStudentByUserId,
  listStudents,
  listDistinctSections,
  createStudent,
  updateStudent,
  updateStudentStatus,
  deleteStudent,
} from '../services/student.service';

export interface StudentCore {
  id: string;
  userId: string;
  rollNumber: string;
  fullName: string;
  departmentId: string;
  programId: string;
  semester: number;
  section: string | null;
  academicYear: string;
}

interface StudentCoreRow {
  id: string;
  user_id: string;
  roll_number: string;
  full_name: string;
  department_id: string;
  program_id: string;
  semester: number;
  section: string | null;
  academic_year: string;
}

function toCore(r: StudentCoreRow): StudentCore {
  return {
    id: r.id,
    userId: r.user_id,
    rollNumber: r.roll_number,
    fullName: r.full_name,
    departmentId: r.department_id,
    programId: r.program_id,
    semester: r.semester,
    section: r.section,
    academicYear: r.academic_year,
  };
}

const CORE_COLS = 'id, user_id, roll_number, full_name, department_id, program_id, semester, section, academic_year';

/** Resolves a student's core identity by their own row id. The one lookup every other module should use instead of inlining this SELECT. */
export async function getStudentCore(studentId: string): Promise<StudentCore> {
  const { rows } = await query<StudentCoreRow>(
    `SELECT ${CORE_COLS} FROM students WHERE id = $1 AND deleted_at IS NULL`,
    [studentId]
  );
  if (!rows[0]) throw AppError.notFound('Student not found');
  return toCore(rows[0]);
}

/** Same lookup, resolved from the logged-in user's id (the common case: "who is the student behind this request"). */
export async function getStudentCoreByUserId(userId: string): Promise<StudentCore> {
  const { rows } = await query<StudentCoreRow>(
    `SELECT ${CORE_COLS} FROM students WHERE user_id = $1 AND deleted_at IS NULL`,
    [userId]
  );
  if (!rows[0]) throw AppError.forbidden('No student profile is linked to this account');
  return toCore(rows[0]);
}

/** Bulk variant — one query for a batch of student ids, never N+1. */
export async function getStudentCoreBatch(studentIds: string[]): Promise<Map<string, StudentCore>> {
  if (studentIds.length === 0) return new Map();
  const { rows } = await query<StudentCoreRow>(
    `SELECT ${CORE_COLS} FROM students WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`,
    [studentIds]
  );
  return new Map(rows.map((r) => [r.id, toCore(r)]));
}
