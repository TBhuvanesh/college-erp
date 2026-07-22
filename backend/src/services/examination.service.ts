import { query } from '../config/database';
import { auditLog } from '../utils/audit';
import { AppError } from '../errors/AppError';
import { isFacultyAssigned } from './assignment.service';
import type {
  ExamDetail,
  ExamSummary,
  PaginatedExams,
  ExamType,
  ExamStatus,
  CreateExamInput,
  UpdateExamInput,
  ListExamsQuery,
} from '../types/examination';
import {
  VALID_TRANSITIONS,
  FACULTY_ALLOWED_TRANSITIONS,
  TERMINAL_STATUSES,
} from '../types/examination';
import type { Role } from '../types/roles';

// ── Row types (snake_case from PostgreSQL) ─────────────────────────────────────

interface ExamRow {
  id: string;
  subject_id: string;
  subject_code: string;
  subject_name: string;
  department_name: string;
  faculty_id: string;
  faculty_name: string;
  semester: number;
  section: string;
  exam_type: ExamType;
  exam_date: string;   // TO_CHAR output: YYYY-MM-DD
  start_time: string;  // TO_CHAR output: HH24:MI
  end_time: string;
  maximum_marks: string;
  status: ExamStatus;
  created_at: Date;
  updated_at: Date;
}

interface ExamListRow extends ExamRow {
  total_count: string;
}

// ── Shared query fragments ─────────────────────────────────────────────────────

const DETAIL_COLS = `
  e.id,
  e.subject_id,         sub.code                        AS subject_code,
                        sub.name                        AS subject_name,
                        d.name                          AS department_name,
  e.faculty_id,         f.full_name                     AS faculty_name,
  e.semester,           e.section,     e.exam_type,
  TO_CHAR(e.exam_date,   'YYYY-MM-DD') AS exam_date,
  TO_CHAR(e.start_time,  'HH24:MI')    AS start_time,
  TO_CHAR(e.end_time,    'HH24:MI')    AS end_time,
  e.maximum_marks,      e.status,
  e.created_at,         e.updated_at
`;

const DETAIL_JOINS = `
  JOIN subjects     sub ON sub.id = e.subject_id
  JOIN faculty      f   ON f.id   = e.faculty_id
  LEFT JOIN subject_curriculum_mappings scm ON scm.subject_id = sub.id AND scm.semester = e.semester AND scm.department_id = f.department_id AND scm.deleted_at IS NULL
  LEFT JOIN departments  d   ON d.id   = scm.department_id
`;

// ── Mappers ───────────────────────────────────────────────────────────────────

function toDetail(r: ExamRow): ExamDetail {
  return {
    id: r.id,
    subjectId: r.subject_id,
    subjectCode: r.subject_code,
    subjectName: r.subject_name,
    departmentName: r.department_name,
    facultyId: r.faculty_id,
    facultyName: r.faculty_name,
    semester: Number(r.semester),
    section: r.section,
    examType: r.exam_type,
    examDate: r.exam_date,
    startTime: r.start_time,
    endTime: r.end_time,
    maximumMarks: parseFloat(r.maximum_marks),
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toSummary(r: ExamRow): ExamSummary {
  return {
    id: r.id,
    subjectId: r.subject_id,
    subjectCode: r.subject_code,
    subjectName: r.subject_name,
    facultyName: r.faculty_name,
    semester: Number(r.semester),
    section: r.section,
    examType: r.exam_type,
    examDate: r.exam_date,
    startTime: r.start_time,
    endTime: r.end_time,
    maximumMarks: parseFloat(r.maximum_marks),
    status: r.status,
  };
}

// ── Private helpers ───────────────────────────────────────────────────────────

/** Resolves users.id → faculty.id. Throws 403 when no faculty profile exists. */
async function resolveFacultyId(userId: string): Promise<string> {
  const { rows } = await query<{ id: string }>(
    'SELECT id FROM faculty WHERE user_id = $1 AND deleted_at IS NULL',
    [userId]
  );
  if (!rows[0]) throw AppError.forbidden('No faculty profile is linked to this account');
  return rows[0].id;
}

// ── Read operations ───────────────────────────────────────────────────────────

export async function getExamById(id: string): Promise<ExamDetail> {
  const { rows } = await query<ExamRow>(
    `SELECT ${DETAIL_COLS} FROM exams e ${DETAIL_JOINS}
     WHERE e.id = $1 AND e.deleted_at IS NULL`,
    [id]
  );
  if (!rows[0]) throw AppError.notFound('Examination not found');
  return toDetail(rows[0]);
}

export async function listExams(filters: ListExamsQuery): Promise<PaginatedExams> {
  const conditions: string[] = ['e.deleted_at IS NULL'];
  const params: unknown[] = [];

  const push = (condition: string, value: unknown) => {
    params.push(value);
    conditions.push(`${condition} $${params.length}`);
  };

  if (filters.subjectId) push('e.subject_id =', filters.subjectId);
  if (filters.facultyId) push('e.faculty_id =', filters.facultyId);
  if (filters.semester)  push('e.semester =',   filters.semester);
  if (filters.section)   push('e.section =',    filters.section);
  if (filters.examType)  push('e.exam_type =',  filters.examType);
  if (filters.status)    push('e.status =',     filters.status);
  if (filters.date)      push('e.exam_date =',  filters.date);
  if (filters.dateFrom)  push('e.exam_date >=', filters.dateFrom);
  if (filters.dateTo)    push('e.exam_date <=', filters.dateTo);

  const offset = (filters.page - 1) * filters.limit;
  params.push(filters.limit, offset);

  const { rows } = await query<ExamListRow>(
    `SELECT ${DETAIL_COLS}, COUNT(*) OVER() AS total_count
     FROM exams e ${DETAIL_JOINS}
     WHERE ${conditions.join(' AND ')}
     ORDER BY e.exam_date ASC, e.start_time ASC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const total = rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0;

  return {
    exams: rows.map(toSummary),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.ceil(total / filters.limit),
    },
  };
}

/**
 * Returns all non-cancelled, non-deleted exams for the requesting faculty member,
 * ordered by exam_date ascending.
 */
export async function getFacultySchedule(userId: string): Promise<ExamSummary[]> {
  const facultyId = await resolveFacultyId(userId);

  const { rows } = await query<ExamRow>(
    `SELECT ${DETAIL_COLS}
     FROM exams e ${DETAIL_JOINS}
     WHERE e.faculty_id  = $1
       AND e.deleted_at  IS NULL
     ORDER BY e.exam_date ASC, e.start_time ASC`,
    [facultyId]
  );

  return rows.map(toSummary);
}

/**
 * Returns a student's exam timetable for their current semester and section.
 * Implicit enrollment: students in a matching program_id + semester are enrolled.
 *
 * @param statusFilter  Optional status to narrow results (e.g. 'Scheduled' for upcoming)
 */
export async function getStudentTimetable(
  userId: string,
  statusFilter?: ExamStatus | 'upcoming'
): Promise<ExamSummary[]> {
  const { rows: stu } = await query<{ program_id: string; semester: number; section: string }>(
    `SELECT program_id, semester, section
     FROM students
     WHERE user_id = $1 AND deleted_at IS NULL`,
    [userId]
  );
  if (!stu[0]) throw AppError.forbidden('No student profile is linked to this account');

  const { program_id, semester, section } = stu[0];

  const conditions: string[] = [
    'e.deleted_at IS NULL',
    'sub.program_id = $1',
    'e.semester = $2',
    'e.section = $3',
  ];
  const params: unknown[] = [program_id, semester, section];

  if (statusFilter === 'upcoming') {
    conditions.push(`e.exam_date >= CURRENT_DATE`);
    conditions.push(`e.status IN ('Scheduled', 'Ongoing')`);
  } else if (statusFilter) {
    params.push(statusFilter);
    conditions.push(`e.status = $${params.length}`);
  } else {
    // Full timetable: hide nothing except hard-deleted; show cancelled for awareness
    conditions.push(`e.status != 'Cancelled'`);
  }

  const { rows } = await query<ExamRow>(
    `SELECT ${DETAIL_COLS}
     FROM exams e ${DETAIL_JOINS}
     WHERE ${conditions.join(' AND ')}
     ORDER BY e.exam_date ASC, e.start_time ASC`,
    params
  );

  return rows.map(toSummary);
}

// ── Write operations ──────────────────────────────────────────────────────────

/**
 * Creates a new exam.
 *  – Admin: uses the facultyId supplied in data; no assignment check.
 *  – Faculty: resolves own facultyId; validates they are assigned to the subject+section;
 *             prevents scheduling on past dates.
 */
export async function createExam(
  data: CreateExamInput,
  userId: string,
  userRole: Role
): Promise<ExamDetail> {
  let facultyId = data.facultyId;

  if (userRole === 'faculty') {
    facultyId = await resolveFacultyId(userId);

    const assigned = await isFacultyAssigned(facultyId, data.subjectId, data.section);
    if (!assigned) {
      throw AppError.forbidden(
        'You are not assigned to teach this subject and section',
        'NOT_ASSIGNED'
      );
    }

    if (data.examDate < new Date().toLocaleDateString('en-CA')) {
      throw AppError.badRequest(
        'Examination date cannot be in the past',
        'PAST_EXAM_DATE'
      );
    }
  }

  // Validate subject exists and retrieve its semester for denormalization
  const { rows: sub } = await query<{ semester: number }>(
    `SELECT semester FROM subjects WHERE id = $1 AND deleted_at IS NULL`,
    [data.subjectId]
  );
  if (!sub[0]) throw AppError.notFound('Subject not found');

  // Validate faculty exists
  const { rows: fac } = await query<{ id: string }>(
    `SELECT id FROM faculty WHERE id = $1 AND deleted_at IS NULL`,
    [facultyId]
  );
  if (!fac[0]) throw AppError.notFound('Faculty member not found');

  const { rows } = await query<{ id: string }>(
    `INSERT INTO exams
       (subject_id, faculty_id, semester, section, exam_type, exam_date, start_time, end_time, maximum_marks)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      data.subjectId,
      facultyId,
      sub[0].semester,
      data.section,
      data.examType,
      data.examDate,
      data.startTime,
      data.endTime,
      data.maximumMarks,
    ]
  );

  const exam = await getExamById(rows[0].id);

  await auditLog({
    actorId: userId,
    action: 'CREATE_EXAM',
    resource: 'exams',
    resourceId: exam.id,
    changes: {
      subjectId: data.subjectId,
      examType: data.examType,
      examDate: data.examDate,
      section: data.section,
    },
  });

  return exam;
}

/**
 * Updates reschedulable fields on an exam.
 *  – Admin: may update any non-identity field.
 *  – Faculty: may only update their own exams; cannot update completed/cancelled exams.
 */
export async function updateExam(
  id: string,
  data: UpdateExamInput,
  userId: string,
  userRole: Role
): Promise<ExamDetail> {
  const { rows } = await query<{ faculty_id: string; status: ExamStatus }>(
    `SELECT faculty_id, status FROM exams WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  if (!rows[0]) throw AppError.notFound('Examination not found');

  const current = rows[0];

  if (TERMINAL_STATUSES.has(current.status)) {
    throw AppError.badRequest(
      `Cannot modify a ${current.status.toLowerCase()} examination`,
      'EXAM_TERMINAL_STATUS'
    );
  }

  if (userRole === 'faculty') {
    const facultyId = await resolveFacultyId(userId);
    if (current.faculty_id !== facultyId) {
      throw AppError.forbidden(
        'You can only update examinations you are assigned to conduct',
        'NOT_EXAM_OWNER'
      );
    }
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  const pushUpdate = (col: string, val: unknown) => {
    params.push(val);
    updates.push(`${col} = $${params.length}`);
  };

  if (data.section)       pushUpdate('section',       data.section);
  if (data.examDate)      pushUpdate('exam_date',     data.examDate);
  if (data.startTime)     pushUpdate('start_time',    data.startTime);
  if (data.endTime)       pushUpdate('end_time',      data.endTime);
  if (data.maximumMarks !== undefined) pushUpdate('maximum_marks', data.maximumMarks);

  if (updates.length === 0) throw AppError.badRequest('No valid fields to update');

  params.push(id);
  await query(
    `UPDATE exams SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`,
    params
  );

  const updated = await getExamById(id);

  await auditLog({
    actorId: userId,
    action: 'UPDATE_EXAM',
    resource: 'exams',
    resourceId: id,
    changes: data,
  });

  return updated;
}

/**
 * Transitions an exam to a new status.
 *  – Admin: any transition except from terminal states.
 *  – Faculty: forward-only transitions on their own exams (Scheduled→Ongoing, Ongoing→Completed).
 *             Faculty cannot cancel.
 */
export async function updateExamStatus(
  id: string,
  newStatus: ExamStatus,
  userId: string,
  userRole: Role
): Promise<ExamDetail> {
  const { rows } = await query<{ faculty_id: string; status: ExamStatus }>(
    `SELECT faculty_id, status FROM exams WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  if (!rows[0]) throw AppError.notFound('Examination not found');

  const { faculty_id, status: currentStatus } = rows[0];

  if (TERMINAL_STATUSES.has(currentStatus)) {
    throw AppError.badRequest(
      `Cannot change status of a ${currentStatus.toLowerCase()} examination`,
      'EXAM_TERMINAL_STATUS'
    );
  }

  if (userRole === 'faculty') {
    const facultyId = await resolveFacultyId(userId);
    if (faculty_id !== facultyId) {
      throw AppError.forbidden(
        'You can only update the status of examinations you are assigned to conduct',
        'NOT_EXAM_OWNER'
      );
    }
    const allowed = FACULTY_ALLOWED_TRANSITIONS[currentStatus];
    if (!allowed.includes(newStatus)) {
      throw AppError.forbidden(
        `Faculty cannot transition an exam from ${currentStatus} to ${newStatus}. ` +
          `Allowed: ${allowed.join(', ') || 'none'}`,
        'INVALID_TRANSITION'
      );
    }
  } else {
    const allowed = VALID_TRANSITIONS[currentStatus];
    if (!allowed.includes(newStatus)) {
      throw AppError.badRequest(
        `Cannot transition exam from ${currentStatus} to ${newStatus}. ` +
          `Allowed: ${allowed.join(', ') || 'none'}`,
        'INVALID_TRANSITION'
      );
    }
  }

  await query(
    `UPDATE exams SET status = $1, updated_at = NOW() WHERE id = $2`,
    [newStatus, id]
  );

  const updated = await getExamById(id);

  await auditLog({
    actorId: userId,
    action: 'UPDATE_EXAM_STATUS',
    resource: 'exams',
    resourceId: id,
    changes: { from: currentStatus, to: newStatus },
  });

  return updated;
}

/**
 * Soft-deletes an exam. Admin only — enforced at the route level.
 * Completed exams cannot be deleted (results may depend on them).
 */
export async function deleteExam(id: string, userId: string): Promise<void> {
  const { rows } = await query<{ status: ExamStatus }>(
    `SELECT status FROM exams WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  if (!rows[0]) throw AppError.notFound('Examination not found');

  if (rows[0].status === 'Completed') {
    throw AppError.badRequest(
      'Completed examinations cannot be deleted. Cancel first if re-scheduling is needed.',
      'EXAM_COMPLETED'
    );
  }

  await query(
    `UPDATE exams SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [id]
  );

  await auditLog({
    actorId: userId,
    action: 'DELETE_EXAM',
    resource: 'exams',
    resourceId: id,
    changes: { previousStatus: rows[0].status },
  });
}
