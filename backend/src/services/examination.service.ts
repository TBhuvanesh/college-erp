import type { PoolClient, QueryResultRow } from 'pg';
import { query, withTransaction } from '../config/database';
import { auditLog } from '../utils/audit';
import { AppError } from '../errors/AppError';
import { isFacultyAssigned } from './assignment.service';
import { createNotification } from './notification.service';
import type {
  ExamDetail,
  ExamSummary,
  PaginatedExams,
  ExamType,
  ExamStatus,
  CreateExamInput,
  UpdateExamInput,
  ListExamsQuery,
  CreateSessionInput,
  ConfigureSubjectScheduleInput,
  ExaminationSessionDetail,
  ExaminationSessionSummary,
  SubjectScheduleCard,
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
  LEFT JOIN faculty      f   ON f.id   = e.faculty_id
  LEFT JOIN subject_curriculum_mappings scm ON scm.subject_id = sub.id AND scm.semester = e.semester AND scm.deleted_at IS NULL
  LEFT JOIN departments  d   ON d.id   = scm.department_id
  LEFT JOIN examination_sessions es ON es.id = e.session_id
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

  params.push(filters.limit, (filters.page - 1) * filters.limit);

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
     WHERE e.deleted_at IS NULL
       AND e.faculty_id = $1
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
  const { rows: stu } = await query<{ program_id: string; semester: number; section: string; department_id: string }>(
    `SELECT program_id, semester, section, department_id
     FROM students
     WHERE user_id = $1 AND deleted_at IS NULL`,
    [userId]
  );
  if (!stu[0]) throw AppError.forbidden('No student profile is linked to this account');

  const { department_id, semester, section } = stu[0];

  const conditions: string[] = [
    'e.deleted_at IS NULL',
    'scm.department_id = $1',
    'e.semester = $2',
    '($3 = ANY(string_to_array(e.section, \',\')) OR e.section = $3)',
    '(e.session_id IS NULL OR es.status = \'Published\')'
  ];
  const params: unknown[] = [department_id, semester, section];

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
  const sections = typeof data.section === 'string' ? [data.section] : data.section;

  let resolvedFacultyId: string | undefined;

  if (userRole === 'faculty') {
    resolvedFacultyId = await resolveFacultyId(userId);
    for (const section of sections) {
      const assigned = await isFacultyAssigned(resolvedFacultyId, data.subjectId, section);
      if (!assigned) {
        throw AppError.forbidden(
          `You are not assigned to teach this subject and section (${section})`,
          'NOT_ASSIGNED'
        );
      }
    }

    if (data.examDate < new Date().toLocaleDateString('en-CA')) {
      throw AppError.badRequest(
        'Examination date cannot be in the past',
        'PAST_EXAM_DATE'
      );
    }
  }

  const createdIds = await withTransaction(async (client) => {
    // Validate subject exists and retrieve its semester for denormalization
    const { rows: sub } = await client.query<{ semester: number }>(
      `SELECT semester FROM subjects WHERE id = $1 AND deleted_at IS NULL`,
      [data.subjectId]
    );
    if (!sub[0]) throw AppError.notFound('Subject not found');
    const semester = sub[0].semester;

    const ids: string[] = [];

    for (const section of sections) {
      let facultyId = data.facultyId;
      if (userRole === 'faculty') {
        facultyId = resolvedFacultyId;
      }

      if (!facultyId) {
        // Resolve allocated faculty from faculty_subject_assignments
        const { rows: allocation } = await client.query<{ faculty_id: string }>(
          `SELECT faculty_id FROM faculty_subject_assignments 
           WHERE subject_id = $1 AND section = $2 AND deleted_at IS NULL 
           LIMIT 1`,
          [data.subjectId, section]
        );
        if (allocation[0]) {
          facultyId = allocation[0].faculty_id;
        } else {
          // Fallback 1: get any faculty from same department
          const { rows: deptFaculty } = await client.query<{ id: string }>(
            `SELECT f.id FROM faculty f
             JOIN subject_curriculum_mappings scm ON scm.department_id = f.department_id
             WHERE scm.subject_id = $1 AND f.deleted_at IS NULL AND scm.deleted_at IS NULL
             LIMIT 1`,
            [data.subjectId]
          );
          if (deptFaculty[0]) {
            facultyId = deptFaculty[0].id;
          } else {
            // Ultimate fallback: get any faculty in system
            const { rows: anyFaculty } = await client.query<{ id: string }>(
              `SELECT id FROM faculty WHERE deleted_at IS NULL LIMIT 1`
            );
            if (anyFaculty[0]) {
              facultyId = anyFaculty[0].id;
            } else {
              throw AppError.badRequest('No faculty member is available in the system to assign to this exam');
            }
          }
        }
      }

      // Validate faculty exists
      const { rows: fac } = await client.query<{ id: string }>(
        `SELECT id FROM faculty WHERE id = $1 AND deleted_at IS NULL`,
        [facultyId]
      );
      if (!fac[0]) throw AppError.notFound('Faculty member not found');

      // Prevent duplicate schedules: same subject, section, examType, examDate
      const { rows: duplicate } = await client.query(
        `SELECT id FROM exams 
         WHERE subject_id = $1 
           AND section = $2 
           AND exam_type = $3 
           AND exam_date = $4
           AND deleted_at IS NULL 
           AND status != 'Cancelled'`,
          [data.subjectId, section, data.examType, data.examDate]
      );
      if (duplicate.length > 0) {
        throw AppError.badRequest(
          `An examination of type ${data.examType} is already scheduled for this subject and section (${section}) on this date.`,
          'DUPLICATE_EXAM_SCHEDULE'
        );
      }

      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO exams
           (subject_id, faculty_id, semester, section, exam_type, exam_date, start_time, end_time, maximum_marks)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          data.subjectId,
          facultyId,
          semester,
          section,
          data.examType,
          data.examDate,
          data.startTime,
          data.endTime,
          data.maximumMarks,
        ]
      );

      ids.push(rows[0].id);
    }

    return ids;
  });

  const createdExams: ExamDetail[] = [];
  for (const id of createdIds) {
    const exam = await getExamById(id);
    createdExams.push(exam);

    await auditLog({
      actorId: userId,
      action: 'CREATE_EXAM',
      resource: 'exams',
      resourceId: exam.id,
      changes: {
        subjectId: data.subjectId,
        examType: data.examType,
        examDate: data.examDate,
        section: exam.section,
      },
    });
  }

  return createdExams[0];
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

// ── Examination Sessions Redesign Service Methods ──────────────────────────────

export async function createExaminationSession(
  data: CreateSessionInput,
  userId: string
): Promise<ExaminationSessionDetail> {
  return await withTransaction(async (client) => {
    // Check for duplicate active session
    const { rows: existing } = await client.query(
      `SELECT id FROM examination_sessions
       WHERE name = $1 AND department_id = $2 AND year = $3 AND semester = $4 AND exam_type = $5 AND deleted_at IS NULL`,
      [data.name, data.departmentId, data.year, data.semester, data.examType]
    );

    if (existing.length > 0) {
      throw AppError.badRequest(
        `An examination session with name "${data.name}" already exists for this department, year, and semester.`
      );
    }

    // Insert examination_session
    const { rows: sessionRows } = await client.query<{ id: string }>(
      `INSERT INTO examination_sessions (
        name, academic_year, regulation, department_id, year, semester, exam_type, sections, subject_ids, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Draft', $10)
      RETURNING id`,
      [
        data.name,
        data.academicYear,
        data.regulation,
        data.departmentId,
        data.year,
        data.semester,
        data.examType,
        data.sections,
        data.subjectIds,
        userId,
      ]
    );

    const sessionId = sessionRows[0].id;

    // Create placeholder draft exam schedule entries for each selected subject
    for (const subId of data.subjectIds) {
      // Check subject type ('Theory' vs 'Practical' / 'Lab')
      const { rows: subRows } = await client.query<{ type: string; code: string; name: string }>(
        `SELECT type, code, name FROM subjects WHERE id = $1 AND deleted_at IS NULL`,
        [subId]
      );
      const subType = subRows[0]?.type || 'Theory';

      if (subType === 'Practical' || subType === 'Lab') {
        // For Lab subjects, create per-section draft schedule entries
        for (const sec of data.sections) {
          await client.query(
            `INSERT INTO exams (
              session_id, subject_id, semester, section, exam_type, maximum_marks, status
            ) VALUES ($1, $2, $3, $4, $5, 50, 'Scheduled')`,
            [sessionId, subId, data.semester, sec, data.examType]
          );
        }
      } else {
        // For Theory subjects, create draft schedule entry for the sections batch
        const combinedSections = data.sections.join(',');
        await client.query(
          `INSERT INTO exams (
            session_id, subject_id, semester, section, exam_type, maximum_marks, status
          ) VALUES ($1, $2, $3, $4, $5, 50, 'Scheduled')`,
          [sessionId, subId, data.semester, combinedSections, data.examType]
        );
      }
    }

    await auditLog({
      actorId: userId,
      action: 'CREATE_EXAM_SESSION',
      resource: 'examination_sessions',
      resourceId: sessionId,
      changes: { name: data.name, examType: data.examType, subjectCount: data.subjectIds.length },
    });

    return await getExaminationSessionById(sessionId, client);
  });
}

export async function getExaminationSessionById(
  sessionId: string,
  dbClient?: PoolClient
): Promise<ExaminationSessionDetail> {
  const executeQuery = <T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) =>
    dbClient ? dbClient.query<T>(text, params as unknown[]) : query<T>(text, params);

  const { rows: sRows } = await executeQuery<any>(
    `SELECT es.*, d.name AS department_name, d.code AS department_code
     FROM examination_sessions es
     JOIN departments d ON d.id = es.department_id
     WHERE es.id = $1 AND es.deleted_at IS NULL`,
    [sessionId]
  );

  if (!sRows[0]) throw AppError.notFound('Examination Session not found');

  const session = sRows[0];

  // Fetch all exams linked to this session
  const { rows: examRows } = await executeQuery<any>(
    `SELECT e.id, e.subject_id, sub.code AS subject_code, sub.name AS subject_name, sub.type AS subject_type,
            e.section, TO_CHAR(e.exam_date, 'YYYY-MM-DD') AS exam_date,
            TO_CHAR(e.start_time, 'HH24:MI') AS start_time, TO_CHAR(e.end_time, 'HH24:MI') AS end_time,
            e.maximum_marks, e.venue, e.instructions, e.status
     FROM exams e
     JOIN subjects sub ON sub.id = e.subject_id
     WHERE e.session_id = $1 AND e.deleted_at IS NULL
     ORDER BY sub.code ASC, e.section ASC`,
    [sessionId]
  );

  // Fetch subject catalog info for all subjects in session
  const { rows: subInfoRows } = await executeQuery<{ id: string; code: string; name: string; type: string }>(
    `SELECT id, code, name, type FROM subjects WHERE id = ANY($1::uuid[])`,
    [session.subject_ids]
  );
  const subInfoMap = new Map(subInfoRows.map((s: { id: string; code: string; name: string; type: string }) => [s.id, s]));

  // Group exams by subject
  const subjectsMap = new Map<string, SubjectScheduleCard>();

  for (const subId of session.subject_ids) {
    const matchingExams = examRows.filter((r: any) => r.subject_id === subId);
    const info = subInfoMap.get(subId);
    const subCode = matchingExams[0]?.subject_code || info?.code || '';
    const subName = matchingExams[0]?.subject_name || info?.name || '';
    const subType = matchingExams[0]?.subject_type || info?.type || 'Theory';

    const isLab = subType === 'Practical' || subType === 'Lab';
    const isScheduled = matchingExams.length > 0 && matchingExams.every((e: any) => e.exam_date && e.start_time);

    if (isLab && matchingExams.length > 0) {
      subjectsMap.set(subId, {
        subjectId: subId,
        subjectCode: subCode,
        subjectName: subName,
        subjectType: subType,
        status: isScheduled ? 'Scheduled' : 'Pending',
        sectionSchedules: matchingExams.map((e: any) => ({
          section: e.section,
          examId: e.id,
          examDate: e.exam_date || '',
          startTime: e.start_time || '',
          endTime: e.end_time || '',
          maximumMarks: Number(e.maximum_marks),
          venue: e.venue || undefined,
          instructions: e.instructions || undefined,
        })),
      });
    } else {
      const first = matchingExams[0] || {};
      subjectsMap.set(subId, {
        subjectId: subId,
        subjectCode: subCode,
        subjectName: subName,
        subjectType: subType,
        status: isScheduled ? 'Scheduled' : 'Pending',
        examId: first.id,
        examDate: first.exam_date || undefined,
        startTime: first.start_time || undefined,
        endTime: first.end_time || undefined,
        maximumMarks: first.maximum_marks ? Number(first.maximum_marks) : 50,
        venue: first.venue || undefined,
        instructions: first.instructions || undefined,
      });
    }
  }

  const subjectsList = Array.from(subjectsMap.values());
  const scheduledCount = subjectsList.filter((s) => s.status === 'Scheduled').length;

  // Conflict / Warning Calculations
  const warnings: string[] = [];
  const datesMap = new Map<string, string[]>();

  for (const sub of subjectsList) {
    if (sub.sectionSchedules) {
      for (const sec of sub.sectionSchedules) {
        if (sec.examDate) {
          const list = datesMap.get(sec.examDate) || [];
          list.push(`${sub.subjectCode} (Sec ${sec.section})`);
          datesMap.set(sec.examDate, list);
        }
      }
    } else if (sub.examDate) {
      const list = datesMap.get(sub.examDate) || [];
      list.push(sub.subjectCode);
      datesMap.set(sub.examDate, list);
    }
  }

  for (const [d, subs] of datesMap.entries()) {
    if (subs.length > 1) {
      warnings.push(`Multiple exams scheduled on ${d}: ${subs.join(', ')}`);
    }
  }

  return {
    id: session.id,
    name: session.name,
    academicYear: session.academic_year,
    regulation: session.regulation,
    departmentId: session.department_id,
    departmentName: session.department_name,
    departmentCode: session.department_code,
    year: session.year,
    semester: session.semester,
    examType: session.exam_type,
    sections: session.sections,
    subjectIds: session.subject_ids,
    status: session.status,
    scheduledSubjectCount: scheduledCount,
    totalSubjectCount: subjectsList.length,
    createdAt: session.created_at,
    updatedAt: session.updated_at,
    subjects: subjectsList,
    warnings,
  };
}

export async function listExaminationSessions(filters: {
  page?: number;
  limit?: number;
  departmentId?: string;
  year?: string;
  semester?: number;
  status?: string;
}): Promise<{ sessions: ExaminationSessionSummary[]; pagination: any }> {
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const offset = (page - 1) * limit;

  const conditions: string[] = ['es.deleted_at IS NULL'];
  const params: unknown[] = [];

  if (filters.departmentId) {
    params.push(filters.departmentId);
    conditions.push(`es.department_id = $${params.length}`);
  }
  if (filters.year) {
    params.push(filters.year);
    conditions.push(`es.year = $${params.length}`);
  }
  if (filters.semester) {
    params.push(filters.semester);
    conditions.push(`es.semester = $${params.length}`);
  }
  if (filters.status) {
    params.push(filters.status);
    conditions.push(`es.status = $${params.length}`);
  }

  params.push(limit, offset);

  const { rows } = await query<any>(
    `SELECT es.id, es.name, es.academic_year, es.regulation, es.department_id,
            d.name AS department_name, d.code AS department_code,
            es.year, es.semester, es.exam_type, es.sections, es.subject_ids, es.status,
            es.created_at, es.updated_at,
            (SELECT COUNT(*) FROM exams e WHERE e.session_id = es.id AND e.exam_date IS NOT NULL AND e.deleted_at IS NULL)::text AS scheduled_count,
            COUNT(*) OVER() AS total_count
     FROM examination_sessions es
     JOIN departments d ON d.id = es.department_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY es.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const total = rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0;

  const list: ExaminationSessionSummary[] = rows.map((r: any) => ({
    id: r.id,
    name: r.name,
    academicYear: r.academic_year,
    regulation: r.regulation,
    departmentId: r.department_id,
    departmentName: r.department_name,
    departmentCode: r.department_code,
    year: r.year,
    semester: Number(r.semester),
    examType: r.exam_type,
    sections: r.sections,
    subjectIds: r.subject_ids,
    status: r.status,
    scheduledSubjectCount: Number(r.scheduled_count),
    totalSubjectCount: r.subject_ids.length,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));

  return {
    sessions: list,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function configureSubjectSchedule(
  sessionId: string,
  data: ConfigureSubjectScheduleInput,
  userId: string
): Promise<ExaminationSessionDetail> {
  return await withTransaction(async (client) => {
    const { rows: session } = await client.query<{ status: string; sections: string[]; semester: number; exam_type: string }>(
      `SELECT status, sections, semester, exam_type FROM examination_sessions WHERE id = $1 AND deleted_at IS NULL`,
      [sessionId]
    );

    if (!session[0]) throw AppError.notFound('Examination session not found');
    if (session[0].status === 'Published') {
      throw AppError.badRequest('Published examination schedules cannot be modified. Unpublish or create a new session.');
    }

    if (data.sectionSchedules && data.sectionSchedules.length > 0) {
      // Lab / Per-section scheduling
      for (const item of data.sectionSchedules) {
        if (item.endTime <= item.startTime) {
          throw AppError.badRequest(`End time must be after start time for section ${item.section}`);
        }

        const { rows: existing } = await client.query<{ id: string }>(
          `SELECT id FROM exams WHERE session_id = $1 AND subject_id = $2 AND section = $3 AND deleted_at IS NULL`,
          [sessionId, data.subjectId, item.section]
        );

        if (existing[0]) {
          await client.query(
            `UPDATE exams SET exam_date = $1, start_time = $2, end_time = $3, maximum_marks = $4, venue = $5, instructions = $6, updated_at = NOW()
             WHERE id = $7`,
            [item.examDate, item.startTime, item.endTime, item.maximumMarks, item.venue || null, item.instructions || null, existing[0].id]
          );
        } else {
          await client.query(
            `INSERT INTO exams (
              session_id, subject_id, semester, section, exam_type, exam_date, start_time, end_time, maximum_marks, venue, instructions, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'Scheduled')`,
            [
              sessionId,
              data.subjectId,
              session[0].semester,
              item.section,
              session[0].exam_type,
              item.examDate,
              item.startTime,
              item.endTime,
              item.maximumMarks,
              item.venue || null,
              item.instructions || null,
            ]
          );
        }
      }
    } else {
      // Theory scheduling
      if (!data.examDate || !data.startTime || !data.endTime) {
        throw AppError.badRequest('Exam Date, Start Time, and End Time are required for scheduling.');
      }
      if (data.endTime <= data.startTime) {
        throw AppError.badRequest('End time must be after start time.');
      }

      const targetSection = data.section || session[0].sections.join(',');

      const { rows: existing } = await client.query<{ id: string }>(
        `SELECT id FROM exams WHERE session_id = $1 AND subject_id = $2 AND deleted_at IS NULL`,
        [sessionId, data.subjectId]
      );

      if (existing[0]) {
        await client.query(
          `UPDATE exams SET section = $1, exam_date = $2, start_time = $3, end_time = $4, maximum_marks = $5, venue = $6, instructions = $7, updated_at = NOW()
           WHERE id = $8`,
          [targetSection, data.examDate, data.startTime, data.endTime, data.maximumMarks, data.venue || null, data.instructions || null, existing[0].id]
        );
      } else {
        await client.query(
          `INSERT INTO exams (
            session_id, subject_id, semester, section, exam_type, exam_date, start_time, end_time, maximum_marks, venue, instructions, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'Scheduled')`,
          [
            sessionId,
            data.subjectId,
            session[0].semester,
            targetSection,
            session[0].exam_type,
            data.examDate,
            data.startTime,
            data.endTime,
            data.maximumMarks,
            data.venue || null,
            data.instructions || null,
          ]
        );
      }
    }

    if (session[0].status === 'Draft') {
      await client.query(`UPDATE examination_sessions SET status = 'Scheduling' WHERE id = $1`, [sessionId]);
    }

    await auditLog({
      actorId: userId,
      action: 'CONFIGURE_EXAM_SCHEDULE',
      resource: 'examination_sessions',
      resourceId: sessionId,
      changes: { subjectId: data.subjectId },
    });

    return await getExaminationSessionById(sessionId, client);
  });
}

export async function publishExaminationSession(sessionId: string, userId: string): Promise<ExaminationSessionDetail> {
  return await withTransaction(async (client) => {
    const { rows: sessionRows } = await client.query<any>(
      `SELECT es.*, d.name AS department_name
       FROM examination_sessions es
       JOIN departments d ON d.id = es.department_id
       WHERE es.id = $1 AND es.deleted_at IS NULL`,
      [sessionId]
    );

    if (!sessionRows[0]) throw AppError.notFound('Examination session not found');
    const session = sessionRows[0];

    const { rows: exams } = await client.query<any>(
      `SELECT e.id, e.subject_id, sub.code AS subject_code, sub.name AS subject_name,
              e.section, TO_CHAR(e.exam_date, 'YYYY-MM-DD') AS exam_date, TO_CHAR(e.start_time, 'HH24:MI') AS start_time,
              TO_CHAR(e.end_time, 'HH24:MI') AS end_time, e.venue, e.instructions
       FROM exams e
       JOIN subjects sub ON sub.id = e.subject_id
       WHERE e.session_id = $1 AND e.deleted_at IS NULL`,
      [sessionId]
    );

    const unscheduled = exams.filter((e: any) => !e.exam_date || !e.start_time);
    if (unscheduled.length > 0) {
      throw AppError.badRequest(`Cannot publish session. ${unscheduled.length} subject schedules are still pending dates and times.`);
    }

    await client.query(`UPDATE examination_sessions SET status = 'Published', updated_at = NOW() WHERE id = $1`, [sessionId]);
    await client.query(`UPDATE exams SET status = 'Scheduled', updated_at = NOW() WHERE session_id = $1 AND deleted_at IS NULL`, [sessionId]);

    for (const ex of exams) {
      const examStart = ex.exam_date && ex.start_time ? `${ex.exam_date} ${ex.start_time}:00` : ex.exam_date;
      const title = `${session.name}: ${ex.subject_code} - ${ex.subject_name}`;
      const description = `Official Exam for ${session.department_name} (Year ${session.year}, Sem ${session.semester}, Sec ${ex.section}). Venue: ${ex.venue || 'Assigned Halls'}.`;

      const { rows: existingCal } = await client.query<{ id: string }>(
        `SELECT id FROM calendar_entries WHERE source_module = 'Exam' AND source_id = $1 AND deleted_at IS NULL`,
        [ex.id]
      );

      if (existingCal[0]) {
        await client.query(
          `UPDATE calendar_entries
           SET title = $1, description = $2, start_date = $3::timestamptz, updated_at = NOW()
           WHERE id = $4`,
          [title, description, examStart, existingCal[0].id]
        );
      } else {
        await client.query(
          `INSERT INTO calendar_entries (
            title, description, event_type, start_date, visibility, source_module, source_id, department_id, semester, created_by
          ) VALUES ($1, $2, 'Examination', $3::timestamptz, 'department', 'Exam', $4, $5, $6, $7)`,
          [title, description, examStart, ex.id, session.department_id, session.semester, userId]
        );
      }
    }

    const { rows: students } = await client.query<{ user_id: string }>(
      `SELECT user_id FROM students
       WHERE department_id = $1 AND semester = $2 AND section = ANY($3::varchar[]) AND deleted_at IS NULL`,
      [session.department_id, session.semester, session.sections]
    );

    for (const stu of students) {
      try {
        await createNotification(userId, 'admin', {
          recipientUserId: stu.user_id,
          targetRole: 'student',
          title: `Exam Schedule Published: ${session.name}`,
          message: `The official examination schedule for ${session.name} has been published. Please check your timetable desk.`,
          type: 'Academic Alert',
          isImportant: true,
        });
      } catch (err) {
        // Silent catch for notification fallback
      }
    }

    const { rows: faculty } = await client.query<{ user_id: string }>(
      `SELECT DISTINCT f.user_id
       FROM faculty_subject_assignments fsa
       JOIN faculty f ON f.id = fsa.faculty_id
       WHERE fsa.subject_id = ANY($1::uuid[]) AND fsa.deleted_at IS NULL`,
      [session.subject_ids]
    );

    for (const fac of faculty) {
      try {
        await createNotification(userId, 'admin', {
          recipientUserId: fac.user_id,
          targetRole: 'faculty',
          title: `Exam Schedule Published: ${session.name}`,
          message: `The examination schedule for ${session.name} has been published for your assigned subject courses.`,
          type: 'Academic Alert',
          isImportant: false,
        });
      } catch (err) {
        // Silent catch
      }
    }

    await auditLog({
      actorId: userId,
      action: 'PUBLISH_EXAM_SESSION',
      resource: 'examination_sessions',
      resourceId: sessionId,
      changes: { status: 'Published', notificationCount: students.length + faculty.length },
    });

    return await getExaminationSessionById(sessionId, client);
  });
}

export async function deleteExaminationSession(sessionId: string, userId: string): Promise<void> {
  const { rows } = await query<{ status: string }>(
    `SELECT status FROM examination_sessions WHERE id = $1 AND deleted_at IS NULL`,
    [sessionId]
  );
  if (!rows[0]) throw AppError.notFound('Examination session not found');

  if (rows[0].status === 'Published') {
    throw AppError.badRequest('Published examination sessions cannot be deleted. Archive the session instead.');
  }

  await query(`UPDATE examination_sessions SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1`, [sessionId]);
  await query(`UPDATE exams SET deleted_at = NOW(), updated_at = NOW() WHERE session_id = $1`, [sessionId]);

  await auditLog({
    actorId: userId,
    action: 'DELETE_EXAM_SESSION',
    resource: 'examination_sessions',
    resourceId: sessionId,
    changes: { previousStatus: rows[0].status },
  });
}

