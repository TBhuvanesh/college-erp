import { query } from '../config/database';
import { auditLog } from '../utils/audit';
import { AppError } from '../errors/AppError';
import { emitWorkflowEvent } from './workflowEngine.service';
import type { Role } from '../types/roles';
import type {
  Assignment,
  CreateAssignmentInput,
  UpdateAssignmentInput,
  ListAssignmentsQuery,
  PaginatedAssignments,
} from '../types/lms';

// ── Row types ──────────────────────────────────────────────────────────────────

interface AssignmentRow {
  id: string;
  title: string;
  description: string | null;
  subject_id: string;
  subject_code: string;
  subject_name: string;
  faculty_id: string;
  faculty_name: string;
  due_date: Date;
  max_marks: string;   // NUMERIC → string from pg
  created_at: Date;
  updated_at: Date;
}

interface AssignmentListRow extends AssignmentRow {
  total_count: string;
}

// ── Shared SQL fragments ───────────────────────────────────────────────────────

const COLS = `
  a.id,
  a.title,
  a.description,
  a.subject_id,
  sub.code    AS subject_code,
  sub.name    AS subject_name,
  a.faculty_id,
  f.full_name AS faculty_name,
  a.due_date,
  a.max_marks,
  a.created_at,
  a.updated_at
`;

const JOINS = `
  JOIN subjects sub ON sub.id = a.subject_id
  JOIN faculty  f   ON f.id  = a.faculty_id
`;

// ── Mapper ─────────────────────────────────────────────────────────────────────

function toAssignment(r: AssignmentRow): Assignment {
  return {
    id:           r.id,
    title:        r.title,
    description:  r.description,
    subjectId:    r.subject_id,
    subjectCode:  r.subject_code,
    subjectName:  r.subject_name,
    facultyId:    r.faculty_id,
    facultyName:  r.faculty_name,
    dueDate:      r.due_date,
    maxMarks:     Number(r.max_marks),
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

async function fetchAssignmentRow(id: string): Promise<AssignmentRow | null> {
  const { rows } = await query<AssignmentRow>(
    `SELECT ${COLS} FROM assignments a ${JOINS} WHERE a.id = $1 AND a.deleted_at IS NULL`,
    [id]
  );
  return rows[0] ?? null;
}

async function assertAssignmentAccess(row: AssignmentRow, userId: string, role: Role): Promise<void> {
  if (role === 'admin') return;

  if (role === 'faculty') {
    const facultyId = await resolveFacultyId(userId);
    const { rows } = await query<{ id: string }>(
      `SELECT id FROM faculty_subject_assignments
       WHERE faculty_id = $1 AND subject_id = $2 AND is_active = TRUE AND deleted_at IS NULL`,
      [facultyId, row.subject_id]
    );
    if (!rows[0]) throw AppError.forbidden('You do not have access to this assignment');
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
  if (!sub[0]) throw AppError.forbidden('This assignment is not in your enrolled subjects');
}

// ── Exports ────────────────────────────────────────────────────────────────────

export async function createAssignment(
  userId: string,
  data: CreateAssignmentInput
): Promise<Assignment> {
  const facultyId = await resolveFacultyId(userId);
  await assertFacultyAssignedToSubject(facultyId, data.subjectId);

  const { rows } = await query<{ id: string }>(
    `INSERT INTO assignments (title, description, subject_id, faculty_id, due_date, max_marks)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [data.title, data.description ?? null, data.subjectId, facultyId, data.dueDate, data.maxMarks]
  );

  await auditLog({ actorId: userId, action: 'CREATE', resource: 'lms_assignment', resourceId: rows[0].id });

  const row = await fetchAssignmentRow(rows[0].id);
  const assignment = toAssignment(row!);

  // Academic Workflow Engine — assignment creation has no built-in notification/
  // calendar sync of its own, so the default seeded rule wires those up here.
  const { rows: mappings } = await query<{ department_id: string; semester: number }>(
    'SELECT department_id, semester FROM subject_curriculum_mappings WHERE subject_id = $1 AND deleted_at IS NULL',
    [data.subjectId]
  );
  for (const m of mappings) {
    await emitWorkflowEvent('assignment.created', userId, {
      departmentId: m.department_id,
      semester: m.semester,
      title: 'New Assignment Posted',
      message: `A new assignment "${assignment.title}" (${assignment.subjectCode}) is due on ${new Date(assignment.dueDate).toDateString()}.`,
      notificationType: 'Assignment',
      sourceId: assignment.id,
      calendarDate: assignment.dueDate,
      calendarEventType: 'Assignment Deadline',
    });
  }

  return assignment;
}

export async function listAssignments(
  userId: string,
  role: Role,
  filters: ListAssignmentsQuery
): Promise<PaginatedAssignments> {
  const { page, limit, subjectId } = filters;
  const offset = (page - 1) * limit;
  const conditions: string[] = ['a.deleted_at IS NULL'];
  const params: unknown[] = [];

  if (subjectId) {
    params.push(subjectId);
    conditions.push(`a.subject_id = $${params.length}`);
  }

  if (role === 'faculty') {
    const facultyId = await resolveFacultyId(userId);
    params.push(facultyId);
    conditions.push(`EXISTS (
      SELECT 1 FROM faculty_subject_assignments fsa
      WHERE fsa.faculty_id = $${params.length}
        AND fsa.subject_id = a.subject_id
        AND fsa.is_active  = TRUE
        AND fsa.deleted_at IS NULL
    )`);
  } else if (role === 'student') {
    const { rows: ctx } = await query<{ program_id: string; semester: number }>(
      'SELECT program_id, semester FROM students WHERE user_id = $1 AND deleted_at IS NULL',
      [userId]
    );
    if (!ctx[0]) return { assignments: [], total: 0, page, limit, totalPages: 0 };
    params.push(ctx[0].program_id, ctx[0].semester);
    conditions.push(`EXISTS (
      SELECT 1 FROM subject_curriculum_mappings scm
      WHERE scm.subject_id = a.subject_id
        AND scm.program_id = $${params.length - 1}
        AND scm.semester   = $${params.length}
        AND scm.deleted_at IS NULL
    )`);
  }

  const where = conditions.join(' AND ');
  params.push(limit, offset);
  const limitN = params.length - 1;
  const offsetN = params.length;

  const { rows } = await query<AssignmentListRow>(
    `SELECT ${COLS}, COUNT(*) OVER() AS total_count
     FROM assignments a ${JOINS}
     WHERE ${where}
     ORDER BY a.due_date ASC
     LIMIT $${limitN} OFFSET $${offsetN}`,
    params
  );

  const total = rows[0] ? Number(rows[0].total_count) : 0;
  return {
    assignments: rows.map(toAssignment),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getAssignmentById(userId: string, role: Role, id: string): Promise<Assignment> {
  const row = await fetchAssignmentRow(id);
  if (!row) throw AppError.notFound('Assignment not found');
  await assertAssignmentAccess(row, userId, role);
  return toAssignment(row);
}

export async function updateAssignment(
  userId: string,
  id: string,
  data: UpdateAssignmentInput
): Promise<Assignment> {
  const facultyId = await resolveFacultyId(userId);
  const existing = await fetchAssignmentRow(id);
  if (!existing) throw AppError.notFound('Assignment not found');
  if (existing.faculty_id !== facultyId) throw AppError.forbidden('You do not own this assignment');

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
  if (data.dueDate !== undefined) {
    params.push(data.dueDate);
    sets.push(`due_date = $${params.length}`);
  }
  if (data.maxMarks !== undefined) {
    params.push(data.maxMarks);
    sets.push(`max_marks = $${params.length}`);
  }

  if (sets.length === 0) throw AppError.badRequest('No fields to update');

  params.push(id);
  await query(`UPDATE assignments SET ${sets.join(', ')} WHERE id = $${params.length}`, params);

  await auditLog({ actorId: userId, action: 'UPDATE', resource: 'lms_assignment', resourceId: id });

  const updated = await fetchAssignmentRow(id);
  return toAssignment(updated!);
}

export async function deleteAssignment(userId: string, id: string): Promise<void> {
  const facultyId = await resolveFacultyId(userId);
  const existing = await fetchAssignmentRow(id);
  if (!existing) throw AppError.notFound('Assignment not found');
  if (existing.faculty_id !== facultyId) throw AppError.forbidden('You do not own this assignment');

  await query('UPDATE assignments SET deleted_at = NOW() WHERE id = $1', [id]);

  await auditLog({ actorId: userId, action: 'DELETE', resource: 'lms_assignment', resourceId: id });
}
