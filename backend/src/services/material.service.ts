import fs from 'fs';
import path from 'path';
import { query } from '../config/database';
import { auditLog } from '../utils/audit';
import { AppError } from '../errors/AppError';
import { emitWorkflowEvent } from './workflowEngine.service';
import type { Role } from '../types/roles';
import type {
  CourseMaterial,
  CreateMaterialInput,
  UpdateMaterialInput,
  ListMaterialsQuery,
  PaginatedMaterials,
  LmsFileType,
} from '../types/lms';

// ── Row types ──────────────────────────────────────────────────────────────────

interface MaterialRow {
  id: string;
  title: string;
  description: string | null;
  subject_id: string;
  subject_code: string;
  subject_name: string;
  faculty_id: string;
  faculty_name: string;
  file_name: string;
  file_path: string;
  file_type: LmsFileType;
  file_size: string;   // BIGINT → string from pg
  created_at: Date;
  updated_at: Date;
}

interface MaterialListRow extends MaterialRow {
  total_count: string;
}

// ── Shared SQL fragments ───────────────────────────────────────────────────────

const COLS = `
  cm.id,
  cm.title,
  cm.description,
  cm.subject_id,
  sub.code    AS subject_code,
  sub.name    AS subject_name,
  cm.faculty_id,
  f.full_name AS faculty_name,
  cm.file_name,
  cm.file_path,
  cm.file_type,
  cm.file_size,
  cm.created_at,
  cm.updated_at
`;

const JOINS = `
  JOIN subjects sub ON sub.id = cm.subject_id
  JOIN faculty  f   ON f.id  = cm.faculty_id
`;

// ── Mapper ─────────────────────────────────────────────────────────────────────

function toMaterial(r: MaterialRow): CourseMaterial {
  return {
    id:           r.id,
    title:        r.title,
    description:  r.description,
    subjectId:    r.subject_id,
    subjectCode:  r.subject_code,
    subjectName:  r.subject_name,
    facultyId:    r.faculty_id,
    facultyName:  r.faculty_name,
    fileName:     r.file_name,
    fileType:     r.file_type,
    fileSize:     Number(r.file_size),
    downloadUrl:  `/api/lms/materials/${r.id}/download`,
    createdAt:    r.created_at,
    updatedAt:    r.updated_at,
  };
}

// ── Internal helpers ───────────────────────────────────────────────────────────

async function resolveFacultyId(userId: string): Promise<string> {
  const { rows } = await query<{ id: string }>(
    'SELECT id FROM faculty WHERE user_id = $1 AND deleted_at IS NULL',
    [userId]
  );
  if (!rows[0]) throw AppError.notFound('Faculty profile not found');
  return rows[0].id;
}

async function assertFacultyAssignedToSubject(facultyId: string, subjectId: string): Promise<void> {
  const { rows } = await query<{ id: string }>(
    `SELECT id FROM faculty_subject_assignments
     WHERE faculty_id = $1 AND subject_id = $2 AND is_active = TRUE AND deleted_at IS NULL`,
    [facultyId, subjectId]
  );
  if (!rows[0]) throw AppError.forbidden('You are not assigned to this subject');
}

async function fetchMaterialRow(id: string): Promise<MaterialRow | null> {
  const { rows } = await query<MaterialRow>(
    `SELECT ${COLS} FROM course_materials cm ${JOINS}
     WHERE cm.id = $1 AND cm.deleted_at IS NULL`,
    [id]
  );
  return rows[0] ?? null;
}

async function assertMaterialAccess(row: MaterialRow, userId: string, role: Role): Promise<void> {
  if (role === 'admin') return;

  if (role === 'faculty') {
    const facultyId = await resolveFacultyId(userId);
    const { rows } = await query<{ id: string }>(
      `SELECT id FROM faculty_subject_assignments
       WHERE faculty_id = $1 AND subject_id = $2 AND is_active = TRUE AND deleted_at IS NULL`,
      [facultyId, row.subject_id]
    );
    if (!rows[0]) throw AppError.forbidden('You do not have access to this material');
    return;
  }

  // Student: subject must be in their current program + semester
  const { rows: ctx } = await query<{ program_id: string; semester: number }>(
    'SELECT program_id, semester FROM students WHERE user_id = $1 AND deleted_at IS NULL',
    [userId]
  );
  if (!ctx[0]) throw AppError.notFound('Student profile not found');
  const { rows: sub } = await query<{ id: string }>(
    `SELECT s.id FROM subjects s
     JOIN subject_curriculum_mappings scm ON scm.subject_id = s.id
     WHERE s.id = $1 AND scm.program_id = $2 AND scm.semester = $3 AND s.deleted_at IS NULL`,
    [row.subject_id, ctx[0].program_id, ctx[0].semester]
  );
  if (!sub[0]) throw AppError.forbidden('This material is not in your enrolled subjects');
}

// ── Exports ────────────────────────────────────────────────────────────────────

export async function createMaterial(
  userId: string,
  data: CreateMaterialInput,
  file: Express.Multer.File
): Promise<CourseMaterial> {
  const facultyId = await resolveFacultyId(userId);
  await assertFacultyAssignedToSubject(facultyId, data.subjectId);

  const ext = (path.extname(file.originalname).slice(1).toLowerCase() || 'pdf') as LmsFileType;

  const { rows } = await query<{ id: string }>(
    `INSERT INTO course_materials
       (title, description, subject_id, faculty_id, file_name, file_path, file_type, file_size)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      data.title, data.description ?? null, data.subjectId, facultyId,
      file.originalname, file.path, ext, file.size,
    ]
  );

  await auditLog({ actorId: userId, action: 'CREATE', resource: 'course_material', resourceId: rows[0].id });

  const row = await fetchMaterialRow(rows[0].id);
  const material = toMaterial(row!);

  // Academic Workflow Engine — material upload has no built-in notification of
  // its own, so the default seeded rule notifies students here.
  const { rows: mappings } = await query<{ department_id: string; semester: number }>(
    'SELECT department_id, semester FROM subject_curriculum_mappings WHERE subject_id = $1 AND deleted_at IS NULL',
    [data.subjectId]
  );
  for (const m of mappings) {
    await emitWorkflowEvent('material.created', userId, {
      departmentId: m.department_id,
      semester: m.semester,
      title: 'New Study Material Uploaded',
      message: `New material "${material.title}" (${material.subjectCode}) is now available.`,
      notificationType: 'Announcement',
      sourceId: material.id,
    });
  }

  return material;
}

export async function listMaterials(
  userId: string,
  role: Role,
  filters: ListMaterialsQuery
): Promise<PaginatedMaterials> {
  const { page, limit, subjectId } = filters;
  const offset = (page - 1) * limit;
  const conditions: string[] = ['cm.deleted_at IS NULL'];
  const params: unknown[] = [];

  if (subjectId) {
    params.push(subjectId);
    conditions.push(`cm.subject_id = $${params.length}`);
  }

  if (role === 'faculty') {
    const facultyId = await resolveFacultyId(userId);
    params.push(facultyId);
    conditions.push(`EXISTS (
      SELECT 1 FROM faculty_subject_assignments fsa
      WHERE fsa.faculty_id = $${params.length}
        AND fsa.subject_id = cm.subject_id
        AND fsa.is_active  = TRUE
        AND fsa.deleted_at IS NULL
    )`);
  } else if (role === 'student') {
    const { rows: ctx } = await query<{ program_id: string; semester: number }>(
      'SELECT program_id, semester FROM students WHERE user_id = $1 AND deleted_at IS NULL',
      [userId]
    );
    if (!ctx[0]) return { materials: [], total: 0, page, limit, totalPages: 0 };
    params.push(ctx[0].program_id, ctx[0].semester);
    conditions.push(`EXISTS (
      SELECT 1 FROM subject_curriculum_mappings scm
      WHERE scm.subject_id = cm.subject_id
        AND scm.program_id = $${params.length - 1}
        AND scm.semester   = $${params.length}
        AND scm.deleted_at IS NULL
    )`);
  }

  const where = conditions.join(' AND ');
  params.push(limit, offset);
  const limitN = params.length - 1;
  const offsetN = params.length;

  const { rows } = await query<MaterialListRow>(
    `SELECT ${COLS}, COUNT(*) OVER() AS total_count
     FROM course_materials cm ${JOINS}
     WHERE ${where}
     ORDER BY cm.created_at DESC
     LIMIT $${limitN} OFFSET $${offsetN}`,
    params
  );

  const total = rows[0] ? Number(rows[0].total_count) : 0;
  return { materials: rows.map(toMaterial), total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getMaterialById(userId: string, role: Role, id: string): Promise<CourseMaterial> {
  const row = await fetchMaterialRow(id);
  if (!row) throw AppError.notFound('Material not found');
  await assertMaterialAccess(row, userId, role);
  return toMaterial(row);
}

export async function getMaterialFilePath(
  userId: string,
  role: Role,
  id: string
): Promise<{ filePath: string; fileName: string }> {
  const row = await fetchMaterialRow(id);
  if (!row) throw AppError.notFound('Material not found');
  await assertMaterialAccess(row, userId, role);
  return { filePath: row.file_path, fileName: row.file_name };
}

export async function updateMaterial(
  userId: string,
  id: string,
  data: UpdateMaterialInput,
  file: Express.Multer.File | null
): Promise<CourseMaterial> {
  const facultyId = await resolveFacultyId(userId);
  const existing = await fetchMaterialRow(id);
  if (!existing) throw AppError.notFound('Material not found');
  if (existing.faculty_id !== facultyId) throw AppError.forbidden('You do not own this material');

  const sets: string[] = [];
  const params: unknown[] = [];

  if (data.title !== undefined) {
    params.push(data.title);
    sets.push(`title = $${params.length}`);
  }
  if (data.description !== undefined) {
    params.push(data.description || null);
    sets.push(`description = $${params.length}`);
  }

  if (file) {
    try { fs.unlinkSync(existing.file_path); } catch { /* ignore missing file */ }
    const ext = (path.extname(file.originalname).slice(1).toLowerCase() || 'pdf') as LmsFileType;
    params.push(file.originalname, file.path, ext, file.size);
    const n = params.length;
    sets.push(
      `file_name = $${n - 3}`,
      `file_path = $${n - 2}`,
      `file_type = $${n - 1}`,
      `file_size = $${n}`
    );
  }

  if (sets.length === 0) throw AppError.badRequest('No fields to update');

  params.push(id);
  await query(
    `UPDATE course_materials SET ${sets.join(', ')} WHERE id = $${params.length}`,
    params
  );

  await auditLog({ actorId: userId, action: 'UPDATE', resource: 'course_material', resourceId: id });

  const updated = await fetchMaterialRow(id);
  return toMaterial(updated!);
}

export async function deleteMaterial(userId: string, id: string): Promise<void> {
  const facultyId = await resolveFacultyId(userId);
  const existing = await fetchMaterialRow(id);
  if (!existing) throw AppError.notFound('Material not found');
  if (existing.faculty_id !== facultyId) throw AppError.forbidden('You do not own this material');

  await query('UPDATE course_materials SET deleted_at = NOW() WHERE id = $1', [id]);

  try { fs.unlinkSync(existing.file_path); } catch { /* ignore */ }

  await auditLog({ actorId: userId, action: 'DELETE', resource: 'course_material', resourceId: id });
}
