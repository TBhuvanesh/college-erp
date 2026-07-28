import { getDepartments, getDepartmentById, getPrograms, getProgramById } from '../services/department.service';
import type { Department, Program } from '../services/department.service';
import { withTtlCache } from '../utils/ttlCache';

// ── AcademicRegistry ─────────────────────────────────────────────────────────
// Single source of truth for Departments, Programs, and "Academic Session."
//
// There is no dedicated academic_session table in this schema — a student's
// academic session is the `academic_year` column on `students` (e.g.
// "2026-2027"), and Teaching Assignments/Curriculum key on the same value
// directly. That is a deliberate, existing design (confirmed across two
// prior sprints), not a gap this registry needs to paper over with a new
// table — introducing one now would be exactly the kind of new module this
// sprint is explicitly told not to build.
//
// Departments and Programs already had a single owner (department.service.ts)
// — this registry re-exports that surface as the one import path other
// modules should use, and adds TTL caching: this is close to static data
// (an institution adds a handful of departments/programs a year), so a short
// cache measurably cuts DB round-trips for the many modules that resolve a
// department/program name just to display it.

const CACHE_TTL_MS = 60_000;

export async function getAllDepartments(): Promise<Department[]> {
  return withTtlCache('academicRegistry:departments', CACHE_TTL_MS, () => getDepartments());
}

export async function getDepartment(id: string): Promise<Department> {
  return withTtlCache(`academicRegistry:department:${id}`, CACHE_TTL_MS, () => getDepartmentById(id));
}

export async function getAllPrograms(departmentId?: string): Promise<Program[]> {
  return withTtlCache(`academicRegistry:programs:${departmentId ?? 'all'}`, CACHE_TTL_MS, () => getPrograms(departmentId));
}

export async function getProgram(id: string): Promise<Program> {
  return withTtlCache(`academicRegistry:program:${id}`, CACHE_TTL_MS, () => getProgramById(id));
}

/**
 * "Academic Session" resolver — validates a YYYY-YYYY academic year string
 * against the standard format. This is the one place that format check
 * should live rather than being re-implemented per importer/module (already
 * duplicated once, in studentImport.strategy.ts, before this registry).
 */
const ACADEMIC_YEAR_RE = /^\d{4}-\d{4}$/;
export function isValidAcademicYear(value: string): boolean {
  if (!ACADEMIC_YEAR_RE.test(value)) return false;
  const [start, end] = value.split('-').map(Number);
  return end === start + 1;
}

export { getDepartments, getDepartmentById, getPrograms, getProgramById };
export type { Department, Program };
