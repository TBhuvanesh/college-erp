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

export const createDepartmentSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(10),
  color: z.enum(DEPARTMENT_COLOR_PALETTE).nullable().optional(),
});
export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;

export const updateDepartmentSchema = createDepartmentSchema.partial();
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;

export interface Program {
  id: string;
  departmentId: string;
  name: string;
  code: string;
  totalSemesters: number;
  isActive: boolean;
}

export const createProgramSchema = z.object({
  departmentId: z.string().uuid(),
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(10),
  totalSemesters: z.number().int().min(1).max(12),
});
export type CreateProgramInput = z.infer<typeof createProgramSchema>;

export const updateProgramSchema = createProgramSchema.partial();
export type UpdateProgramInput = z.infer<typeof updateProgramSchema>;

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

export async function createDepartment(userId: string, data: CreateDepartmentInput): Promise<Department> {
  const { rows: existing } = await query(`SELECT id FROM departments WHERE (name = $1 OR code = $2) AND deleted_at IS NULL`, [data.name, data.code]);
  if (existing.length > 0) throw AppError.badRequest('Department with this name or code already exists');
  
  const { rows } = await query<DepartmentRow>(
    `INSERT INTO departments (name, code, color) VALUES ($1, $2, $3) RETURNING id, name, code, color, is_active`,
    [data.name, data.code, data.color ?? null]
  );
  await auditLog({ actorId: userId, action: 'CREATE', resource: 'department', resourceId: rows[0].id, changes: data });
  return toDepartment(rows[0]);
}

export async function updateDepartment(userId: string, id: string, data: UpdateDepartmentInput): Promise<Department> {
  const { rows: existing } = await query(`SELECT id FROM departments WHERE id != $1 AND (name = $2 OR code = $3) AND deleted_at IS NULL`, [id, data.name, data.code]);
  if (existing.length > 0) throw AppError.badRequest('Another department with this name or code already exists');
  
  const updates = [];
  const values: any[] = [];
  let idx = 1;
  if (data.name !== undefined) { updates.push(`name = $${idx++}`); values.push(data.name); }
  if (data.code !== undefined) { updates.push(`code = $${idx++}`); values.push(data.code); }
  if (data.color !== undefined) { updates.push(`color = $${idx++}`); values.push(data.color); }
  
  if (updates.length === 0) return getDepartmentById(id);
  values.push(id);
  
  const { rows } = await query<DepartmentRow>(
    `UPDATE departments SET ${updates.join(', ')} WHERE id = $${idx} AND deleted_at IS NULL RETURNING id, name, code, color, is_active`,
    values
  );
  if (!rows[0]) throw AppError.notFound('Department not found');
  
  await auditLog({ actorId: userId, action: 'UPDATE', resource: 'department', resourceId: id, changes: data });
  return toDepartment(rows[0]);
}

export async function archiveDepartment(userId: string, id: string): Promise<void> {
  const { rows: deps } = await query(`
    SELECT 
      (SELECT COUNT(*) FROM students WHERE department_id = $1 AND deleted_at IS NULL) as students_count,
      (SELECT COUNT(*) FROM faculty WHERE department_id = $1 AND deleted_at IS NULL) as faculty_count,
      (SELECT COUNT(*) FROM programs WHERE department_id = $1 AND deleted_at IS NULL) as programs_count,
      (SELECT COUNT(*) FROM subject_curriculum_mappings WHERE department_id = $1) as curr_count
  `, [id]);
  
  const d = deps[0];
  if (Number(d.students_count) > 0 || Number(d.faculty_count) > 0 || Number(d.programs_count) > 0 || Number(d.curr_count) > 0) {
    throw AppError.badRequest('Cannot archive department because it has active dependencies (students, faculty, programs, or curriculum)');
  }
  
  const { rowCount } = await query(`UPDATE departments SET deleted_at = NOW(), is_active = false WHERE id = $1 AND deleted_at IS NULL`, [id]);
  if (rowCount === 0) throw AppError.notFound('Department not found or already archived');
  await auditLog({ actorId: userId, action: 'ARCHIVE', resource: 'department', resourceId: id, changes: {} });
}

export async function restoreDepartment(userId: string, id: string): Promise<void> {
  const { rowCount } = await query(`UPDATE departments SET deleted_at = NULL, is_active = true WHERE id = $1 AND deleted_at IS NOT NULL`, [id]);
  if (rowCount === 0) throw AppError.notFound('Department not found or not archived');
  await auditLog({ actorId: userId, action: 'RESTORE', resource: 'department', resourceId: id, changes: {} });
}

export async function createProgram(userId: string, data: CreateProgramInput): Promise<Program> {
  const { rows: existing } = await query(`SELECT id FROM programs WHERE department_id = $1 AND (name = $2 OR code = $3) AND deleted_at IS NULL`, [data.departmentId, data.name, data.code]);
  if (existing.length > 0) throw AppError.badRequest('Program with this name or code already exists in this department');
  
  const { rows } = await query<ProgramRow>(
    `INSERT INTO programs (department_id, name, code, total_semesters) VALUES ($1, $2, $3, $4) RETURNING id, department_id, name, code, total_semesters, is_active`,
    [data.departmentId, data.name, data.code, data.totalSemesters]
  );
  await auditLog({ actorId: userId, action: 'CREATE', resource: 'program', resourceId: rows[0].id, changes: data });
  return toProgram(rows[0]);
}

export async function updateProgram(userId: string, id: string, data: UpdateProgramInput): Promise<Program> {
  const prog = await getProgramById(id);
  
  const { rows: existing } = await query(`SELECT id FROM programs WHERE id != $1 AND department_id = $2 AND (name = $3 OR code = $4) AND deleted_at IS NULL`, [id, data.departmentId ?? prog.departmentId, data.name ?? prog.name, data.code ?? prog.code]);
  if (existing.length > 0) throw AppError.badRequest('Another program with this name or code already exists in this department');
  
  const updates = [];
  const values: any[] = [];
  let idx = 1;
  if (data.departmentId !== undefined) { updates.push(`department_id = $${idx++}`); values.push(data.departmentId); }
  if (data.name !== undefined) { updates.push(`name = $${idx++}`); values.push(data.name); }
  if (data.code !== undefined) { updates.push(`code = $${idx++}`); values.push(data.code); }
  if (data.totalSemesters !== undefined) { updates.push(`total_semesters = $${idx++}`); values.push(data.totalSemesters); }
  
  if (updates.length === 0) return prog;
  values.push(id);
  
  const { rows } = await query<ProgramRow>(
    `UPDATE programs SET ${updates.join(', ')} WHERE id = $${idx} AND deleted_at IS NULL RETURNING id, department_id, name, code, total_semesters, is_active`,
    values
  );
  if (!rows[0]) throw AppError.notFound('Program not found');
  
  await auditLog({ actorId: userId, action: 'UPDATE', resource: 'program', resourceId: id, changes: data });
  return toProgram(rows[0]);
}

export async function archiveProgram(userId: string, id: string): Promise<void> {
  const { rows: deps } = await query(`
    SELECT 
      (SELECT COUNT(*) FROM students WHERE program_id = $1 AND deleted_at IS NULL) as students_count,
      (SELECT COUNT(*) FROM subject_curriculum_mappings WHERE program_id = $1) as curr_count
  `, [id]);
  
  const d = deps[0];
  if (Number(d.students_count) > 0 || Number(d.curr_count) > 0) {
    throw AppError.badRequest('Cannot archive program because it has active dependencies (students or curriculum)');
  }
  
  const { rowCount } = await query(`UPDATE programs SET deleted_at = NOW(), is_active = false WHERE id = $1 AND deleted_at IS NULL`, [id]);
  if (rowCount === 0) throw AppError.notFound('Program not found or already archived');
  await auditLog({ actorId: userId, action: 'ARCHIVE', resource: 'program', resourceId: id, changes: {} });
}

export async function restoreProgram(userId: string, id: string): Promise<void> {
  const { rowCount } = await query(`UPDATE programs SET deleted_at = NULL, is_active = true WHERE id = $1 AND deleted_at IS NOT NULL`, [id]);
  if (rowCount === 0) throw AppError.notFound('Program not found or not archived');
  await auditLog({ actorId: userId, action: 'RESTORE', resource: 'program', resourceId: id, changes: {} });
}
