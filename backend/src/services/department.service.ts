import { query } from '../config/database';
import { auditLog } from '../utils/audit';
import { AppError } from '../errors/AppError';
import { z } from 'zod';
import { DEPARTMENT_COLOR_PALETTE } from '../types/examSeating';

export interface Department {
  id: string;
  name: string;
  code: string;
  color: string | null;
  isActive: boolean;
}

export const updateDepartmentColorSchema = z.object({
  color: z.enum(DEPARTMENT_COLOR_PALETTE),
});
export type UpdateDepartmentColorInput = z.infer<typeof updateDepartmentColorSchema>;

export interface Program {
  id: string;
  departmentId: string;
  name: string;
  code: string;
  totalSemesters: number;
  isActive: boolean;
}

interface DepartmentRow {
  id: string;
  name: string;
  code: string;
  color: string | null;
  is_active: boolean;
}

interface ProgramRow {
  id: string;
  department_id: string;
  name: string;
  code: string;
  total_semesters: number;
  is_active: boolean;
}

function toDepartment(r: DepartmentRow): Department {
  return { id: r.id, name: r.name, code: r.code, color: r.color, isActive: r.is_active };
}

function toProgram(r: ProgramRow): Program {
  return {
    id: r.id,
    departmentId: r.department_id,
    name: r.name,
    code: r.code,
    totalSemesters: r.total_semesters,
    isActive: r.is_active,
  };
}

export async function getDepartments(): Promise<Department[]> {
  const { rows } = await query<DepartmentRow>(
    `SELECT id, name, code, color, is_active
     FROM departments
     WHERE deleted_at IS NULL
     ORDER BY name`
  );
  return rows.map(toDepartment);
}

export async function getDepartmentById(id: string): Promise<Department> {
  const { rows } = await query<DepartmentRow>(
    `SELECT id, name, code, color, is_active
     FROM departments
     WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  if (!rows[0]) throw AppError.notFound(`Department not found`);
  return toDepartment(rows[0]);
}

export async function updateDepartmentColor(userId: string, id: string, data: UpdateDepartmentColorInput): Promise<Department> {
  const { rows } = await query<DepartmentRow>(
    `UPDATE departments SET color = $1 WHERE id = $2 AND deleted_at IS NULL RETURNING id, name, code, color, is_active`,
    [data.color, id]
  );
  if (!rows[0]) throw AppError.notFound('Department not found');

  await auditLog({ actorId: userId, action: 'UPDATE', resource: 'department', resourceId: id, changes: { color: data.color } });

  return toDepartment(rows[0]);
}

/** Returns programs for all departments or filtered to one department. */
export async function getPrograms(departmentId?: string): Promise<Program[]> {
  const conditions = ['deleted_at IS NULL'];
  const params: unknown[] = [];

  if (departmentId) {
    conditions.push(`department_id = $${params.length + 1}`);
    params.push(departmentId);
  }

  const { rows } = await query<ProgramRow>(
    `SELECT id, department_id, name, code, total_semesters, is_active
     FROM programs
     WHERE ${conditions.join(' AND ')}
     ORDER BY name`,
    params
  );
  return rows.map(toProgram);
}

export async function getProgramById(id: string): Promise<Program> {
  const { rows } = await query<ProgramRow>(
    `SELECT id, department_id, name, code, total_semesters, is_active
     FROM programs
     WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  if (!rows[0]) throw AppError.notFound(`Program not found`);
  return toProgram(rows[0]);
}
