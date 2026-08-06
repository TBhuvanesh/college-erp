import { query } from '../config/database';
import { AppError } from '../errors/AppError';
import { auditLog } from '../utils/audit';
import type { ResultEntryTask, ResultEntryTaskStatus, ListResultEntryTasksQuery } from '../types/resultEntryTask';

import { ensureCompletedExamsHaveTasks } from './examination.service';

// Faculty Results page consumes this instead of a manual subject dropdown —
// "faculty should only see examinations assigned through their Teaching
// Assignments" is enforced here by joining on teaching_assignments.faculty_id,
// not by trusting a client-supplied facultyId/subjectId.

interface TaskRow {
  id: string;
  exam_id: string;
  teaching_assignment_id: string;
  faculty_id: string;
  subject_id: string;
  subject_code: string;
  subject_name: string;
  section: string;
  exam_type: string;
  status: ResultEntryTaskStatus;
  window_opens_at: Date;
  window_closes_at: Date | null;
  submitted_at: Date | null;
  published_at: Date | null;
  created_at: Date;
}

const COLS = `
  ret.id, ret.exam_id,
  ret.teaching_assignment_id, ret.faculty_id,
  ta.subject_id, s.code AS subject_code, s.name AS subject_name, ta.section,
  e.exam_type, e.maximum_marks, ret.status, ret.window_opens_at, ret.window_closes_at,
  ret.submitted_at, ret.published_at, ret.created_at
`;

const JOINS = `
  JOIN teaching_assignments ta ON ta.id = ret.teaching_assignment_id
  JOIN subjects s ON s.id = ta.subject_id
  JOIN exams e ON e.id = ret.exam_id
`;

function toTask(r: any): ResultEntryTask {
  return {
    id: r.id,
    examId: r.exam_id,
    teachingAssignmentId: r.teaching_assignment_id,
    facultyId: r.faculty_id,
    subjectId: r.subject_id,
    subjectCode: r.subject_code,
    subjectName: r.subject_name,
    section: r.section,
    examType: r.exam_type,
    maximumMarks: parseFloat(r.maximum_marks),
    status: r.status,
    windowOpensAt: r.window_opens_at,
    windowClosesAt: r.window_closes_at,
    submittedAt: r.submitted_at,
    publishedAt: r.published_at,
    createdAt: r.created_at,
  };
}

export async function resolveFacultyId(userId: string): Promise<string> {
  const { rows } = await query<{ id: string }>(
    'SELECT id FROM faculty WHERE user_id = $1 AND deleted_at IS NULL',
    [userId]
  );
  if (!rows[0]) throw AppError.forbidden('No faculty profile is linked to this account');
  return rows[0].id;
}

export async function listResultEntryTasks(
  userId: string,
  userRole: string,
  filters: ListResultEntryTasksQuery
): Promise<ResultEntryTask[]> {
  await ensureCompletedExamsHaveTasks();

  const conditions = ['ret.deleted_at IS NULL'];
  const params: unknown[] = [];

  if (userRole === 'faculty') {
    const { rows: fac } = await query<{ id: string; designation: string; department_id: string }>(
      'SELECT id, designation, department_id FROM faculty WHERE user_id = $1 AND deleted_at IS NULL',
      [userId]
    );
    if (!fac[0]) throw AppError.forbidden('No faculty profile is linked to this account');

    if (fac[0].designation === 'hod') {
      params.push(fac[0].department_id);
      conditions.push(`ta.department_id = $${params.length}`);
    } else {
      params.push(fac[0].id);
      conditions.push(`ret.faculty_id = $${params.length}`);
    }
  }

  if (filters.status) {
    params.push(filters.status);
    conditions.push(`ret.status = $${params.length}`);
  }

  const { rows } = await query<TaskRow>(
    `SELECT ${COLS} FROM result_entry_tasks ret ${JOINS}
     WHERE ${conditions.join(' AND ')}
     ORDER BY ret.window_closes_at ASC NULLS LAST, ret.created_at DESC`,
    params
  );
  return rows.map(toTask);
}

export async function getTaskById(id: string): Promise<ResultEntryTask> {
  const { rows } = await query<TaskRow>(
    `SELECT ${COLS} FROM result_entry_tasks ret ${JOINS} WHERE ret.id = $1 AND ret.deleted_at IS NULL`,
    [id]
  );
  if (!rows[0]) throw AppError.notFound('Result entry task not found');
  return toTask(rows[0]);
}

/**
 * The three-part Exam Validation rule from the refactor spec:
 *  1. Exam status is Completed
 *  2. The calling faculty is the one resolved through the Teaching Assignment
 *  3. The result-entry window is open (task status not closed/published)
 * Returns the task's teachingAssignmentId/subjectId/section for the caller
 * to use when writing to `results`.
 */
export async function assertTaskOpenForFaculty(taskId: string, userId: string): Promise<ResultEntryTask> {
  const facultyId = await resolveFacultyId(userId);
  const task = await getTaskById(taskId);

  if (task.facultyId !== facultyId) {
    throw AppError.forbidden('You are not the faculty assigned to this result entry task', 'NOT_ASSIGNED');
  }
  if (task.status === 'published' || task.status === 'closed') {
    throw AppError.badRequest('This result entry window is no longer open', 'WINDOW_CLOSED');
  }
  if (task.windowClosesAt && task.windowClosesAt.getTime() < Date.now()) {
    throw AppError.badRequest('The result entry window for this task has closed', 'WINDOW_EXPIRED');
  }

  const { rows: examRows } = await query<{ status: string; exam_date: string; start_time: string; end_time: string }>(
    `SELECT status, TO_CHAR(exam_date, 'YYYY-MM-DD') AS exam_date,
            TO_CHAR(start_time, 'HH24:MI') AS start_time,
            TO_CHAR(end_time, 'HH24:MI') AS end_time
     FROM exams WHERE id = $1`,
    [task.examId]
  );
  if (!examRows[0]) {
    throw AppError.badRequest('Exam does not exist', 'EXAM_NOT_FOUND');
  }

  const { resolveExamStatus } = require('./examination.service');
  const examStatus = resolveExamStatus(examRows[0]);
  if (!['Completed', 'Scripts Distributed'].includes(examStatus)) {
    throw AppError.badRequest(
      'Marks can only be entered once the examination has completed',
      'EXAM_NOT_READY'
    );
  }

  return task;
}

export async function markTaskStatus(taskId: string, status: ResultEntryTaskStatus): Promise<void> {
  const timestampCol =
    status === 'submitted_for_approval' ? 'submitted_at' : status === 'published' ? 'published_at' : null;

  await query(
    `UPDATE result_entry_tasks
     SET status = $1, updated_at = NOW()${timestampCol ? `, ${timestampCol} = NOW()` : ''}
     WHERE id = $2`,
    [status, taskId]
  );
}

/**
 * Faculty submits a draft for HOD/admin review. Only meaningful when
 * teaching_load_settings.require_result_verification is enabled — when it
 * isn't, faculty keep publishing directly from draft_saved, exactly as
 * before this stage existed.
 */
export async function submitForApproval(taskId: string, userId: string): Promise<void> {
  const task = await assertTaskOpenForFaculty(taskId, userId);
  if (task.status !== 'draft_saved' && task.status !== 'open') {
    throw AppError.badRequest('Save a draft before submitting for approval', 'NO_DRAFT_SAVED');
  }
  await markTaskStatus(taskId, 'submitted_for_approval');
}

/**
 * HOD/admin verification step (Part 7's optional "Verified" stage). Gated
 * by settings.requireResultVerification at the call site (result.controller.ts) —
 * this function itself just performs the transition once authorized.
 */
export async function verifyTask(taskId: string, actorId: string): Promise<void> {
  const task = await getTaskById(taskId);
  if (task.status !== 'submitted_for_approval') {
    throw AppError.badRequest('Only tasks submitted for approval can be verified', 'NOT_SUBMITTED');
  }

  // Automatically publish results when verified
  const { publishResults } = require('./result.service');
  await publishResults({ subjectId: task.subjectId, section: task.section }, actorId);

  await markTaskStatus(taskId, 'published');
  await auditLog({ actorId, action: 'VERIFY_RESULT_ENTRY_TASK', resource: 'result_entry_tasks', resourceId: taskId });
}
