import { query } from '../config/database';
import { AppError } from '../errors/AppError';

// ── FacultyRegistry ──────────────────────────────────────────────────────────
// The only way other modules should resolve a faculty member's core identity.
// Faculty Management (faculty.service.ts) remains the single owner of the
// `faculty` table and its full CRUD surface — re-exported here for a single
// import path. getFacultyCore/getFacultyCoreByUserId consolidate the ~25
// files that previously each wrote their own inline
// `SELECT ... FROM faculty WHERE user_id = $1 AND deleted_at IS NULL`.

export {
  getFacultyById,
  getFacultyByUserId,
  listFaculty,
  createFaculty,
  updateFaculty,
  updateFacultyStatus,
  deleteFaculty,
} from '../services/faculty.service';

export interface FacultyCore {
  id: string;
  userId: string;
  employeeNumber: string;
  fullName: string;
  departmentId: string;
  designation: string | null;
}

interface FacultyCoreRow {
  id: string;
  user_id: string;
  employee_number: string;
  full_name: string;
  department_id: string;
  designation: string | null;
}

function toCore(r: FacultyCoreRow): FacultyCore {
  return {
    id: r.id,
    userId: r.user_id,
    employeeNumber: r.employee_number,
    fullName: r.full_name,
    departmentId: r.department_id,
    designation: r.designation,
  };
}

const CORE_COLS = 'id, user_id, employee_number, full_name, department_id, designation';

/** Resolves a faculty member's core identity by their own row id. */
export async function getFacultyCore(facultyId: string): Promise<FacultyCore> {
  const { rows } = await query<FacultyCoreRow>(
    `SELECT ${CORE_COLS} FROM faculty WHERE id = $1 AND deleted_at IS NULL`,
    [facultyId]
  );
  if (!rows[0]) throw AppError.notFound('Faculty member not found');
  return toCore(rows[0]);
}

/** Same lookup, resolved from the logged-in user's id — the single most
 * duplicated query pattern found in this sprint's audit. */
export async function getFacultyCoreByUserId(userId: string): Promise<FacultyCore> {
  const { rows } = await query<FacultyCoreRow>(
    `SELECT ${CORE_COLS} FROM faculty WHERE user_id = $1 AND deleted_at IS NULL`,
    [userId]
  );
  if (!rows[0]) throw AppError.forbidden('No faculty profile is linked to this account');
  return toCore(rows[0]);
}

/** Bulk variant — one query for a batch of faculty ids, never N+1. */
export async function getFacultyCoreBatch(facultyIds: string[]): Promise<Map<string, FacultyCore>> {
  if (facultyIds.length === 0) return new Map();
  const { rows } = await query<FacultyCoreRow>(
    `SELECT ${CORE_COLS} FROM faculty WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`,
    [facultyIds]
  );
  return new Map(rows.map((r) => [r.id, toCore(r)]));
}
