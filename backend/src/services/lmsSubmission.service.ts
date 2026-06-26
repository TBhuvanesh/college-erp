import fs from 'fs';
import { query } from '../config/database';
import { auditLog } from '../utils/audit';
import { AppError } from '../errors/AppError';
import type { Role } from '../types/roles';
import type {
  Submission,
  SubmissionStatus,
  GradeSubmissionInput,
  ListSubmissionsQuery,
  PaginatedSubmissions,
} from '../types/lms';

// ── Row types ──────────────────────────────────────────────────────────────────

interface SubmissionRow {
  id: string;
  assignment_id: string;
  assignment_title: string;
  assignment_due_date: Date;
  assignment_max_marks: string;  // NUMERIC → string
  student_id: string;
  student_roll_number: string;
  student_name: string;
  file_name: string;
  file_path: string;
  file_size: string;             // BIGINT → string
  status: SubmissionStatus;
  marks: string | null;          // NUMERIC → string
  feedback: string | null;
  submitted_at: Date;
  updated_at: Date;
}

interface SubmissionListRow extends SubmissionRow {
  total_count: string;
}

// ── Shared SQL fragments ───────────────────────────────────────────────────────

const COLS = `
  asub.id,
  asub.assignment_id,
  a.title          AS assignment_title,
  a.due_date       AS assignment_due_date,
  a.max_marks      AS assignment_max_marks,
  asub.student_id,
  st.roll_number   AS student_roll_number,
  st.full_name     AS student_name,
  asub.file_name,
  asub.file_path,
  asub.file_size,
  asub.status,
  asub.marks,
  asub.feedback,
  asub.submitted_at,
  asub.updated_at
`;

const JOINS = `
  JOIN assignments a  ON a.id  = asub.assignment_id
  JOIN students    st ON st.id = asub.student_id
`;

// ── Mapper ─────────────────────────────────────────────────────────────────────

function toSubmission(r: SubmissionRow): Submission {
  return {
    id:                 r.id,
    assignmentId:       r.assignment_id,
    assignmentTitle:    r.assignment_title,
    assignmentDueDate:  r.assignment_due_date,
    assignmentMaxMarks: Number(r.assignment_max_marks),
    studentId:          r.student_id,
    studentRollNumber:  r.student_roll_number,
    studentName:        r.student_name,
    fileName:           r.file_name,
    fileSize:           Number(r.file_size),
    downloadUrl:        `/api/lms/submissions/${r.id}/download`,
    status:             r.status,
    marks:              r.marks !== null ? Number(r.marks) : null,
    feedback:           r.feedback,
    submittedAt:        r.submitted_at,
    updatedAt:          r.updated_at,
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

async function resolveStudentId(userId: string): Promise<string> {
  const { rows } = await query<{ id: string }>(
    'SELECT id FROM students WHERE user_id = $1 AND deleted_at IS NULL',
    [userId]
  );
  if (!rows[0]) throw AppError.notFound('Student profile not found');
  return rows[0].id;
}

async function fetchSubmissionRow(id: string): Promise<SubmissionRow | null> {
  const { rows } = await query<SubmissionRow>(
    `SELECT ${COLS} FROM assignment_submissions asub ${JOINS}
     WHERE asub.id = $1 AND asub.deleted_at IS NULL`,
    [id]
  );
  return rows[0] ?? null;
}

async function assertSubmissionAccess(
  row: SubmissionRow,
  userId: string,
  role: Role
): Promise<void> {
  if (role === 'admin') return;

  if (role === 'faculty') {
    const facultyId = await resolveFacultyId(userId);
    // Faculty can view submissions for assignments they created
    const { rows } = await query<{ faculty_id: string }>(
      'SELECT faculty_id FROM assignments WHERE id = $1 AND deleted_at IS NULL',
      [row.assignment_id]
    );
    if (!rows[0] || rows[0].faculty_id !== facultyId) {
      throw AppError.forbidden('You do not have access to this submission');
    }
    return;
  }

  // Student: can only see their own submissions
  const studentId = await resolveStudentId(userId);
  if (row.student_id !== studentId) {
    throw AppError.forbidden('You do not have access to this submission');
  }
}

// ── Exports ────────────────────────────────────────────────────────────────────

export async function submitAssignment(
  userId: string,
  assignmentId: string,
  file: Express.Multer.File
): Promise<Submission> {
  const studentId = await resolveStudentId(userId);

  // Fetch the assignment (validates it exists)
  const { rows: asgn } = await query<{
    id: string; subject_id: string; due_date: Date; faculty_id: string;
  }>(
    'SELECT id, subject_id, due_date, faculty_id FROM assignments WHERE id = $1 AND deleted_at IS NULL',
    [assignmentId]
  );
  if (!asgn[0]) throw AppError.notFound('Assignment not found');

  // Verify student is enrolled in the subject
  const { rows: ctx } = await query<{ program_id: string; semester: number }>(
    'SELECT program_id, semester FROM students WHERE id = $1 AND deleted_at IS NULL',
    [studentId]
  );
  if (!ctx[0]) throw AppError.notFound('Student profile not found');

  const { rows: sub } = await query<{ id: string }>(
    `SELECT id FROM subjects
     WHERE id = $1 AND program_id = $2 AND semester = $3 AND deleted_at IS NULL`,
    [asgn[0].subject_id, ctx[0].program_id, ctx[0].semester]
  );
  if (!sub[0]) throw AppError.forbidden('This assignment is not in your enrolled subjects');

  const now = new Date();
  const newStatus: SubmissionStatus = now > new Date(asgn[0].due_date)
    ? 'Late Submission'
    : 'Submitted';

  // Check for existing submission (resubmission path)
  const { rows: existing } = await query<{ id: string; status: SubmissionStatus; file_path: string }>(
    `SELECT id, status, file_path FROM assignment_submissions
     WHERE assignment_id = $1 AND student_id = $2 AND deleted_at IS NULL`,
    [assignmentId, studentId]
  );

  if (existing[0]) {
    if (existing[0].status === 'Evaluated') {
      throw AppError.conflict(
        'Cannot resubmit an assignment that has already been evaluated',
        'ALREADY_EVALUATED'
      );
    }
    // Resubmission: replace the file and reset status
    try { fs.unlinkSync(existing[0].file_path); } catch { /* ignore missing file */ }

    await query(
      `UPDATE assignment_submissions
       SET file_name = $1, file_path = $2, file_size = $3,
           status = $4, marks = NULL, feedback = NULL, submitted_at = NOW()
       WHERE id = $5`,
      [file.originalname, file.path, file.size, newStatus, existing[0].id]
    );

    await auditLog({
      actorId: userId,
      action: 'UPDATE',
      resource: 'lms_submission',
      resourceId: existing[0].id,
      changes: { resubmission: true, status: newStatus },
    });

    const row = await fetchSubmissionRow(existing[0].id);
    return toSubmission(row!);
  }

  // First submission
  const { rows } = await query<{ id: string }>(
    `INSERT INTO assignment_submissions
       (assignment_id, student_id, file_name, file_path, file_size, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [assignmentId, studentId, file.originalname, file.path, file.size, newStatus]
  );

  await auditLog({
    actorId: userId,
    action: 'CREATE',
    resource: 'lms_submission',
    resourceId: rows[0].id,
  });

  const row = await fetchSubmissionRow(rows[0].id);
  return toSubmission(row!);
}

export async function listSubmissions(
  userId: string,
  role: Role,
  filters: ListSubmissionsQuery
): Promise<PaginatedSubmissions> {
  const { page, limit, assignmentId, studentId, status } = filters;
  const offset = (page - 1) * limit;
  const conditions: string[] = ['asub.deleted_at IS NULL'];
  const params: unknown[] = [];

  if (assignmentId) {
    params.push(assignmentId);
    conditions.push(`asub.assignment_id = $${params.length}`);
  }
  if (studentId) {
    params.push(studentId);
    conditions.push(`asub.student_id = $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`asub.status = $${params.length}`);
  }

  if (role === 'faculty') {
    const facultyId = await resolveFacultyId(userId);
    params.push(facultyId);
    conditions.push(`a.faculty_id = $${params.length}`);
  } else if (role === 'student') {
    const sid = await resolveStudentId(userId);
    params.push(sid);
    conditions.push(`asub.student_id = $${params.length}`);
  }

  const where = conditions.join(' AND ');
  params.push(limit, offset);
  const limitN = params.length - 1;
  const offsetN = params.length;

  const { rows } = await query<SubmissionListRow>(
    `SELECT ${COLS}, COUNT(*) OVER() AS total_count
     FROM assignment_submissions asub ${JOINS}
     WHERE ${where}
     ORDER BY asub.submitted_at DESC
     LIMIT $${limitN} OFFSET $${offsetN}`,
    params
  );

  const total = rows[0] ? Number(rows[0].total_count) : 0;
  return {
    submissions: rows.map(toSubmission),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getSubmissionById(
  userId: string,
  role: Role,
  id: string
): Promise<Submission> {
  const row = await fetchSubmissionRow(id);
  if (!row) throw AppError.notFound('Submission not found');
  await assertSubmissionAccess(row, userId, role);
  return toSubmission(row);
}

export async function getSubmissionFilePath(
  userId: string,
  role: Role,
  id: string
): Promise<{ filePath: string; fileName: string }> {
  const row = await fetchSubmissionRow(id);
  if (!row) throw AppError.notFound('Submission not found');
  await assertSubmissionAccess(row, userId, role);
  return { filePath: row.file_path, fileName: row.file_name };
}

export async function gradeSubmission(
  userId: string,
  id: string,
  data: GradeSubmissionInput
): Promise<Submission> {
  const facultyId = await resolveFacultyId(userId);
  const row = await fetchSubmissionRow(id);
  if (!row) throw AppError.notFound('Submission not found');

  // Verify this faculty owns the assignment
  const { rows: asgn } = await query<{ faculty_id: string; max_marks: string }>(
    'SELECT faculty_id, max_marks FROM assignments WHERE id = $1 AND deleted_at IS NULL',
    [row.assignment_id]
  );
  if (!asgn[0]) throw AppError.notFound('Assignment not found');
  if (asgn[0].faculty_id !== facultyId) {
    throw AppError.forbidden('You do not own the assignment for this submission');
  }

  if (data.marks > Number(asgn[0].max_marks)) {
    throw AppError.badRequest(
      `Marks (${data.marks}) cannot exceed assignment max marks (${asgn[0].max_marks})`
    );
  }

  await query(
    `UPDATE assignment_submissions
     SET marks = $1, feedback = $2, status = 'Evaluated'
     WHERE id = $3`,
    [data.marks, data.feedback ?? null, id]
  );

  await auditLog({
    actorId: userId,
    action: 'UPDATE',
    resource: 'lms_submission',
    resourceId: id,
    changes: { action: 'graded', marks: data.marks },
  });

  const updated = await fetchSubmissionRow(id);
  return toSubmission(updated!);
}
