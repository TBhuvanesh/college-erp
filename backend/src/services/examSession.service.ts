import { query, withTransaction } from '../config/database';
import { auditLog } from '../utils/audit';
import { AppError } from '../errors/AppError';
import { generateSeatingPlan, checkSeatingConflicts } from './examSeating.service';
import { generateInvigilationDuties } from './examInvigilation.service';
import { createNotification } from './notification.service';
import { emitWorkflowEvent } from './workflowEngine.service';
import type { Role } from '../types/roles';
import type {
  ExamSession,
  ExamSessionStatus,
  CreateExamSessionInput,
  UpdateExamSessionInput,
  ListExamSessionsQuery,
  PaginatedExamSessions,
  ResolveExamsResult,
  SeatingGenerationResult,
  ConflictCheckResult,
  InvigilationDuty,
} from '../types/examSeating';

interface SchedulingScope {
  departmentId: string | null;
}

async function resolveSchedulingScope(userId: string, role: Role): Promise<SchedulingScope> {
  if (role === 'admin') return { departmentId: null };

  if (role === 'faculty') {
    const { rows } = await query<{ department_id: string; designation: string | null }>(
      'SELECT department_id, designation FROM faculty WHERE user_id = $1 AND deleted_at IS NULL',
      [userId]
    );
    if (!rows[0]) throw AppError.forbidden('No faculty profile is linked to this account');
    if (rows[0].designation !== 'hod') throw AppError.forbidden('Only admins and HODs can manage exam sessions');
    return { departmentId: rows[0].department_id };
  }

  throw AppError.forbidden('You do not have access to exam session management');
}

interface ExamSessionRow {
  id: string;
  name: string;
  exam_type: string;
  department_ids: string[];
  years: number[];
  semester: number;
  sections: string[];
  exam_dates: string[];
  subject_ids: string[];
  classroom_ids: string[];
  invigilator_ids: string[];
  seating_pattern_id: string | null;
  status: ExamSessionStatus;
  resolved_exam_count: string;
  last_conflict_count: number | null;
  validated_at: Date | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

const COLS = `
  es.id, es.name, es.exam_type::text AS exam_type, es.department_ids, es.years, es.semester, es.sections,
  ARRAY(SELECT TO_CHAR(unnest(es.exam_dates), 'YYYY-MM-DD')) AS exam_dates,
  es.subject_ids, es.classroom_ids, es.invigilator_ids, es.seating_pattern_id, es.status::text AS status,
  es.last_conflict_count, es.validated_at,
  es.created_by, es.created_at, es.updated_at,
  (SELECT COUNT(*) FROM exam_session_exams ese WHERE ese.exam_session_id = es.id)::text AS resolved_exam_count
`;

function toExamSession(r: ExamSessionRow): ExamSession {
  return {
    id: r.id,
    name: r.name,
    examType: r.exam_type as ExamSession['examType'],
    departmentIds: r.department_ids,
    years: r.years,
    semester: r.semester,
    sections: r.sections,
    examDates: r.exam_dates,
    subjectIds: r.subject_ids,
    classroomIds: r.classroom_ids,
    invigilatorIds: r.invigilator_ids,
    seatingPatternId: r.seating_pattern_id,
    status: r.status,
    resolvedExamCount: Number(r.resolved_exam_count),
    lastConflictCount: r.last_conflict_count,
    validatedAt: r.validated_at,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

async function fetchSessionRow(id: string): Promise<ExamSessionRow | null> {
  const { rows } = await query<ExamSessionRow>(
    `SELECT ${COLS} FROM exam_sessions es WHERE es.id = $1 AND es.deleted_at IS NULL`,
    [id]
  );
  return rows[0] ?? null;
}

async function assertSessionScope(scope: SchedulingScope, session: ExamSessionRow): Promise<void> {
  if (scope.departmentId && !session.department_ids.includes(scope.departmentId)) {
    throw AppError.forbidden('You can only manage exam sessions within your own department');
  }
}

// ── Deriving session criteria from real, already-scheduled exams ────────────
// The admin only ever picks exam IDs (surfaced via GET /exam-seating/slots) —
// every other criterion (department/semester/section/subject/date/type) is
// read off the exams themselves, never re-entered.

interface ExamCriteriaRow {
  id: string;
  department_id: string;
  semester: number;
  section: string;
  exam_type: string;
  subject_id: string;
  exam_date: string;
  status: string;
}

async function fetchExamsWithCriteria(examIds: string[]): Promise<ExamCriteriaRow[]> {
  const { rows } = await query<ExamCriteriaRow>(
    `SELECT e.id, sub.department_id, e.semester, e.section, e.exam_type::text AS exam_type, e.subject_id,
       TO_CHAR(e.exam_date, 'YYYY-MM-DD') AS exam_date, e.status::text AS status
     FROM exams e JOIN subjects sub ON sub.id = e.subject_id
     WHERE e.id = ANY($1::uuid[]) AND e.deleted_at IS NULL`,
    [examIds]
  );
  return rows;
}

interface DerivedCriteria {
  departmentIds: string[];
  semester: number;
  sections: string[];
  subjectIds: string[];
  examDates: string[];
  examType: string;
}

function deriveCriteria(examRows: ExamCriteriaRow[]): DerivedCriteria {
  const semesters = [...new Set(examRows.map((r) => r.semester))];
  const examTypes = [...new Set(examRows.map((r) => r.exam_type))];
  if (semesters.length > 1) {
    throw AppError.badRequest('Selected exams span more than one semester — a session must be scoped to a single semester', 'MIXED_SEMESTER');
  }
  if (examTypes.length > 1) {
    throw AppError.badRequest('Selected exams span more than one exam type — a session must be scoped to a single exam type', 'MIXED_EXAM_TYPE');
  }
  return {
    departmentIds: [...new Set(examRows.map((r) => r.department_id))],
    semester: semesters[0],
    sections: [...new Set(examRows.map((r) => r.section))],
    subjectIds: [...new Set(examRows.map((r) => r.subject_id))],
    examDates: [...new Set(examRows.map((r) => r.exam_date))],
    examType: examTypes[0],
  };
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function listExamSessions(userId: string, role: Role, filters: ListExamSessionsQuery): Promise<PaginatedExamSessions> {
  const scope = await resolveSchedulingScope(userId, role);
  const conditions: string[] = ['es.deleted_at IS NULL'];
  const params: unknown[] = [];
  const push = (cond: string, val: unknown) => {
    params.push(val);
    conditions.push(`${cond} $${params.length}`);
  };

  const effectiveDepartmentId = scope.departmentId ?? filters.departmentId;
  if (effectiveDepartmentId) {
    params.push(effectiveDepartmentId);
    conditions.push(`$${params.length}::uuid = ANY(es.department_ids)`);
  }
  if (filters.status) push('es.status =', filters.status);

  params.push(filters.limit, (filters.page - 1) * filters.limit);
  const limitN = params.length - 1;
  const offsetN = params.length;

  const { rows } = await query<ExamSessionRow & { total_count: string }>(
    `SELECT ${COLS}, COUNT(*) OVER()::text AS total_count
     FROM exam_sessions es
     WHERE ${conditions.join(' AND ')}
     ORDER BY es.created_at DESC
     LIMIT $${limitN} OFFSET $${offsetN}`,
    params
  );

  const total = rows[0] ? Number(rows[0].total_count) : 0;
  return {
    sessions: rows.map(toExamSession),
    total,
    page: filters.page,
    limit: filters.limit,
    totalPages: Math.ceil(total / filters.limit),
  };
}

export async function getExamSessionById(userId: string, role: Role, id: string): Promise<ExamSession> {
  const scope = await resolveSchedulingScope(userId, role);
  const row = await fetchSessionRow(id);
  if (!row) throw AppError.notFound('Exam session not found');
  await assertSessionScope(scope, row);
  return toExamSession(row);
}

export async function createExamSession(userId: string, role: Role, data: CreateExamSessionInput): Promise<ExamSession> {
  const scope = await resolveSchedulingScope(userId, role);

  const examRows = await fetchExamsWithCriteria(data.examIds);
  if (examRows.length !== data.examIds.length) throw AppError.notFound('One or more exams were not found');
  if (examRows.some((e) => e.status !== 'Scheduled')) {
    throw AppError.badRequest('Only Scheduled exams can be added to an exam session', 'EXAM_NOT_SCHEDULED');
  }

  const criteria = deriveCriteria(examRows);
  if (scope.departmentId && criteria.departmentIds.some((d) => d !== scope.departmentId)) {
    throw AppError.forbidden('You can only create exam sessions within your own department');
  }

  const sessionId = await withTransaction(async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO exam_sessions
         (name, exam_type, department_ids, semester, sections, exam_dates, subject_ids, classroom_ids, invigilator_ids, seating_pattern_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6::date[], $7, $8, $9, $10, $11) RETURNING id`,
      [
        data.name,
        criteria.examType,
        criteria.departmentIds,
        criteria.semester,
        criteria.sections,
        criteria.examDates,
        criteria.subjectIds,
        data.classroomIds,
        data.invigilatorIds,
        data.seatingPatternId ?? null,
        userId,
      ]
    );
    const id = rows[0].id;
    for (const examId of data.examIds) {
      await client.query(
        `INSERT INTO exam_session_exams (exam_session_id, exam_id) VALUES ($1, $2) ON CONFLICT (exam_session_id, exam_id) DO NOTHING`,
        [id, examId]
      );
    }
    return id;
  });

  await auditLog({ actorId: userId, action: 'CREATE', resource: 'exam_session', resourceId: sessionId, changes: { examIds: data.examIds } });

  const row = await fetchSessionRow(sessionId);
  return toExamSession(row!);
}

export async function updateExamSession(userId: string, role: Role, id: string, data: UpdateExamSessionInput): Promise<ExamSession> {
  const scope = await resolveSchedulingScope(userId, role);
  const existing = await fetchSessionRow(id);
  if (!existing) throw AppError.notFound('Exam session not found');
  await assertSessionScope(scope, existing);
  if (existing.status !== 'draft') {
    throw AppError.badRequest('Only sessions in draft status can be edited', 'SESSION_NOT_DRAFT');
  }

  await withTransaction(async (client) => {
    const sets: string[] = [];
    const params: unknown[] = [];
    const push = (col: string, val: unknown) => {
      params.push(val);
      sets.push(`${col} = $${params.length}`);
    };

    if (data.name !== undefined) push('name', data.name);
    if (data.classroomIds !== undefined) push('classroom_ids', data.classroomIds);
    if (data.invigilatorIds !== undefined) push('invigilator_ids', data.invigilatorIds);
    if ('seatingPatternId' in data) push('seating_pattern_id', data.seatingPatternId ?? null);

    if (data.examIds !== undefined) {
      const examRows = await fetchExamsWithCriteria(data.examIds);
      if (examRows.length !== data.examIds.length) throw AppError.notFound('One or more exams were not found');
      if (examRows.some((e) => e.status !== 'Scheduled')) {
        throw AppError.badRequest('Only Scheduled exams can be added to an exam session', 'EXAM_NOT_SCHEDULED');
      }
      const criteria = deriveCriteria(examRows);
      if (scope.departmentId && criteria.departmentIds.some((d) => d !== scope.departmentId)) {
        throw AppError.forbidden('You can only manage exam sessions within your own department');
      }
      push('exam_type', criteria.examType);
      push('department_ids', criteria.departmentIds);
      push('semester', criteria.semester);
      push('sections', criteria.sections);
      params.push(criteria.examDates);
      sets.push(`exam_dates = $${params.length}::date[]`);
      push('subject_ids', criteria.subjectIds);

      await client.query(`DELETE FROM exam_session_exams WHERE exam_session_id = $1`, [id]);
      for (const examId of data.examIds) {
        await client.query(
          `INSERT INTO exam_session_exams (exam_session_id, exam_id) VALUES ($1, $2) ON CONFLICT (exam_session_id, exam_id) DO NOTHING`,
          [id, examId]
        );
      }
    }

    if (sets.length === 0) throw AppError.badRequest('No fields to update');

    params.push(id);
    await client.query(`UPDATE exam_sessions SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
  });

  await auditLog({ actorId: userId, action: 'UPDATE', resource: 'exam_session', resourceId: id, changes: data as Record<string, unknown> });

  const updated = await fetchSessionRow(id);
  return toExamSession(updated!);
}

export async function deleteExamSession(userId: string, role: Role, id: string): Promise<void> {
  const scope = await resolveSchedulingScope(userId, role);
  const existing = await fetchSessionRow(id);
  if (!existing) throw AppError.notFound('Exam session not found');
  await assertSessionScope(scope, existing);

  await query('UPDATE exam_sessions SET deleted_at = NOW() WHERE id = $1', [id]);
  await auditLog({ actorId: userId, action: 'DELETE', resource: 'exam_session', resourceId: id });
}

// ── Re-sync: re-derive criteria from currently-linked exams, drop stale links ──

async function getLinkedExamIds(sessionId: string): Promise<string[]> {
  const { rows } = await query<{ exam_id: string }>(
    `SELECT exam_id FROM exam_session_exams WHERE exam_session_id = $1`,
    [sessionId]
  );
  return rows.map((r) => r.exam_id);
}

export async function resolveExams(userId: string, role: Role, id: string): Promise<ResolveExamsResult> {
  const scope = await resolveSchedulingScope(userId, role);
  const session = await fetchSessionRow(id);
  if (!session) throw AppError.notFound('Exam session not found');
  await assertSessionScope(scope, session);

  const linkedIds = await getLinkedExamIds(id);
  const examRows = await fetchExamsWithCriteria(linkedIds);
  const stillValid = examRows.filter((e) => e.status === 'Scheduled');
  const validIds = new Set(stillValid.map((e) => e.id));
  const removedExamIds = linkedIds.filter((eid) => !validIds.has(eid));

  if (removedExamIds.length > 0) {
    await query(
      `DELETE FROM exam_session_exams WHERE exam_session_id = $1 AND exam_id = ANY($2::uuid[])`,
      [id, removedExamIds]
    );
  }

  if (stillValid.length > 0) {
    const criteria = deriveCriteria(stillValid);
    await query(
      `UPDATE exam_sessions
       SET exam_type = $1, department_ids = $2, semester = $3, sections = $4, exam_dates = $5::date[], subject_ids = $6
       WHERE id = $7`,
      [criteria.examType, criteria.departmentIds, criteria.semester, criteria.sections, criteria.examDates, criteria.subjectIds, id]
    );
  }

  return { linkedExamIds: stillValid.map((e) => e.id), removedExamIds };
}

// ── Conflict check / generation wrappers — thin, reuse the existing,
// exam-by-exam generation functions rather than duplicating logic ──────────

export async function checkSessionConflicts(userId: string, role: Role, id: string): Promise<ConflictCheckResult> {
  const scope = await resolveSchedulingScope(userId, role);
  const session = await fetchSessionRow(id);
  if (!session) throw AppError.notFound('Exam session not found');
  await assertSessionScope(scope, session);

  const examIds = await getLinkedExamIds(id);
  if (examIds.length === 0) {
    throw AppError.badRequest('Resolve exams for this session before checking conflicts', 'NO_EXAMS_RESOLVED');
  }
  if (session.classroom_ids.length === 0) {
    throw AppError.badRequest('This session has no classrooms selected', 'NO_CLASSROOMS');
  }

  const result = await checkSeatingConflicts(userId, role, { examIds, roomIds: session.classroom_ids });
  await query('UPDATE exam_sessions SET last_conflict_count = $1 WHERE id = $2', [result.conflicts.length, id]);
  return result;
}

export async function generateSessionSeating(userId: string, role: Role, id: string): Promise<SeatingGenerationResult> {
  const scope = await resolveSchedulingScope(userId, role);
  const session = await fetchSessionRow(id);
  if (!session) throw AppError.notFound('Exam session not found');
  await assertSessionScope(scope, session);

  const examIds = await getLinkedExamIds(id);
  if (examIds.length === 0) {
    throw AppError.badRequest('Resolve exams for this session before generating seating', 'NO_EXAMS_RESOLVED');
  }
  if (session.classroom_ids.length === 0) {
    throw AppError.badRequest('This session has no classrooms selected', 'NO_CLASSROOMS');
  }

  const result = await generateSeatingPlan(userId, role, {
    examIds,
    roomIds: session.classroom_ids,
    seatingPatternId: session.seating_pattern_id ?? undefined,
    examSessionId: id,
    allowOverride: false,
  });

  await query(`UPDATE exam_sessions SET status = 'generated' WHERE id = $1 AND status = 'draft'`, [id]);
  await auditLog({ actorId: userId, action: 'UPDATE', resource: 'exam_session', resourceId: id, changes: { from: 'draft', to: 'generated' } });

  return result;
}

export async function generateSessionInvigilation(userId: string, role: Role, id: string): Promise<InvigilationDuty[]> {
  const scope = await resolveSchedulingScope(userId, role);
  const session = await fetchSessionRow(id);
  if (!session) throw AppError.notFound('Exam session not found');
  await assertSessionScope(scope, session);

  const examIds = await getLinkedExamIds(id);
  if (examIds.length === 0) {
    throw AppError.badRequest('Resolve exams for this session before generating invigilation', 'NO_EXAMS_RESOLVED');
  }

  return generateInvigilationDuties(userId, role, {
    examIds,
    invigilatorsPerRoom: 1,
    departmentId: scope.departmentId ?? undefined,
    allowOverride: false,
  });
}

// ── Publish lifecycle: draft → generated → validated → published → completed → archived ──

export interface ValidateSessionResult {
  validated: boolean;
  conflicts: ConflictCheckResult['conflicts'];
  session: ExamSession;
}

export async function validateExamSession(userId: string, role: Role, id: string): Promise<ValidateSessionResult> {
  const scope = await resolveSchedulingScope(userId, role);
  const session = await fetchSessionRow(id);
  if (!session) throw AppError.notFound('Exam session not found');
  await assertSessionScope(scope, session);
  if (session.status !== 'generated') {
    throw AppError.badRequest('Only a session with generated seating can be validated', 'SESSION_NOT_GENERATED');
  }

  const conflictResult = await checkSessionConflicts(userId, role, id);
  if (conflictResult.hasBlockingConflicts) {
    const current = await fetchSessionRow(id);
    return { validated: false, conflicts: conflictResult.conflicts, session: toExamSession(current!) };
  }

  await query(`UPDATE exam_sessions SET status = 'validated', validated_at = NOW() WHERE id = $1`, [id]);
  await auditLog({ actorId: userId, action: 'UPDATE', resource: 'exam_session', resourceId: id, changes: { from: 'generated', to: 'validated' } });

  const updated = await fetchSessionRow(id);
  return { validated: true, conflicts: [], session: toExamSession(updated!) };
}

export async function publishExamSession(userId: string, role: Role, id: string): Promise<ExamSession> {
  const scope = await resolveSchedulingScope(userId, role);
  const session = await fetchSessionRow(id);
  if (!session) throw AppError.notFound('Exam session not found');
  await assertSessionScope(scope, session);

  if (session.status !== 'validated') {
    throw AppError.badRequest('Only a validated session (conflict-free) can be published', 'SESSION_NOT_VALIDATED');
  }

  await query(`UPDATE exam_sessions SET status = 'published' WHERE id = $1`, [id]);
  await auditLog({ actorId: userId, action: 'UPDATE', resource: 'exam_session', resourceId: id, changes: { from: 'validated', to: 'published' } });

  // Fire the workflow event for audit-trail/rule-extensibility (mirrors the
  // established pattern in teachingPlan.service.ts: emit for the trail, but
  // do the real notification/calendar work inline since ACTION_HANDLERS is a
  // closed 3-action registry not worth widening for this).
  await emitWorkflowEvent('exam_seating.published', userId, {
    departmentId: session.department_ids[0] ?? '',
    semester: session.semester,
    title: 'Exam Seating Published',
    message: `Seating for "${session.name}" has been published.`,
    notificationType: 'Academic Alert',
    sourceId: id,
  });

  // Student broadcast — one per affected department (seating for a session may
  // span multiple departments via the pattern's interleave).
  for (const departmentId of session.department_ids) {
    await createNotification(userId, role === 'admin' ? 'admin' : 'faculty', {
      title: 'Exam Seating Published',
      message: `Seating has been published for "${session.name}". Check your seat assignment.`,
      type: 'Academic Alert',
      targetRole: 'student',
      departmentId,
      semester: session.semester,
      isImportant: false,
    });
  }

  // Single-recipient notification to each assigned invigilator for this session's rooms.
  const { rows: invigilators } = await query<{ user_id: string; full_name: string; room_name: string }>(
    `SELECT DISTINCT f.user_id, f.full_name, er.name AS room_name
     FROM exam_invigilation_duties eid
     JOIN faculty f ON f.id = eid.faculty_id
     JOIN exam_rooms er ON er.id = eid.room_id
     WHERE eid.deleted_at IS NULL
       AND eid.room_id IN (
         SELECT DISTINCT room_id FROM exam_seat_allocations WHERE exam_session_id = $1 AND deleted_at IS NULL
       )`,
    [id]
  );
  for (const inv of invigilators) {
    await createNotification(userId, role === 'admin' ? 'admin' : 'faculty', {
      title: 'Invigilation Duty Confirmed',
      message: `Your invigilation duty in ${inv.room_name} for "${session.name}" has been published.`,
      type: 'Academic Alert',
      targetRole: 'faculty',
      recipientUserId: inv.user_id,
      isImportant: false,
    });
  }

  const updated = await fetchSessionRow(id);
  return toExamSession(updated!);
}

export async function completeExamSession(userId: string, role: Role, id: string): Promise<ExamSession> {
  const scope = await resolveSchedulingScope(userId, role);
  const session = await fetchSessionRow(id);
  if (!session) throw AppError.notFound('Exam session not found');
  await assertSessionScope(scope, session);
  if (session.status !== 'published') {
    throw AppError.badRequest('Only a published session can be marked completed', 'SESSION_NOT_PUBLISHED');
  }

  await query(`UPDATE exam_sessions SET status = 'completed' WHERE id = $1`, [id]);
  await auditLog({ actorId: userId, action: 'UPDATE', resource: 'exam_session', resourceId: id, changes: { from: 'published', to: 'completed' } });

  const updated = await fetchSessionRow(id);
  return toExamSession(updated!);
}

export async function archiveExamSession(userId: string, role: Role, id: string): Promise<ExamSession> {
  const scope = await resolveSchedulingScope(userId, role);
  const session = await fetchSessionRow(id);
  if (!session) throw AppError.notFound('Exam session not found');
  await assertSessionScope(scope, session);
  if (session.status !== 'published' && session.status !== 'completed') {
    throw AppError.badRequest('Only a published or completed session can be archived', 'SESSION_NOT_ARCHIVABLE');
  }

  await query(`UPDATE exam_sessions SET status = 'archived' WHERE id = $1`, [id]);
  await auditLog({ actorId: userId, action: 'UPDATE', resource: 'exam_session', resourceId: id, changes: { from: session.status, to: 'archived' } });

  const updated = await fetchSessionRow(id);
  return toExamSession(updated!);
}
