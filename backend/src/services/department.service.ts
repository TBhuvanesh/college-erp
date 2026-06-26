import { query } from '../config/database';
import { AppError } from '../errors/AppError';

export interface Department {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

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
  return { id: r.id, name: r.name, code: r.code, isActive: r.is_active };
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
    `SELECT id, name, code, is_active
     FROM departments
     WHERE deleted_at IS NULL
     ORDER BY name`
  );
  return rows.map(toDepartment);
}

export async function getDepartmentById(id: string): Promise<Department> {
  const { rows } = await query<DepartmentRow>(
    `SELECT id, name, code, is_active
     FROM departments
     WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  if (!rows[0]) throw AppError.notFound(`Department not found`);
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
