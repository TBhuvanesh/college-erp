import { query, withTransaction } from '../config/database';
import { auditLog } from '../utils/audit';
import { AppError } from '../errors/AppError';
import { isFacultyAssigned } from './assignment.service';
import * as notificationService from './notification.service';
import { emitWorkflowEvent } from './workflowEngine.service';
import type { Role } from '../types/roles';
import type { NotificationType } from '../types/notification';
import type {
  TeachingPlan,
  LessonStatus,
  HolidayConflict,
  CreateTeachingPlanInput,
  UpdateTeachingPlanInput,
  UpdateLessonStatusInput,
  RescheduleTeachingPlanInput,
  ListTeachingPlansQuery,
  PaginatedTeachingPlans,
} from '../types/teachingPlan';

// ── Row type ───────────────────────────────────────────────────────────────────

export interface TeachingPlanRow {
  id: string;
  faculty_id: string;
  faculty_name: string;
  subject_id: string;
  subject_code: string;
  subject_name: string;
  department_id: string;
  department_name: string;
  year: number;
  semester: number;
  section: string;
  lesson_sequence: number;
  week_number: number;
  lesson_date: Date;
  topic_title: string;
  topic_description: string | null;
  learning_objectives: string | null;
  estimated_duration: number;
  material_id: string | null;
  material_title: string | null;
  assignment_id: string | null;
  assignment_title: string | null;
  assignment_due_date: Date | null;
  homework: string | null;
  quiz_planned: boolean;
  lesson_status: LessonStatus;
  coverage_percentage: number | null;
  remaining_topics: string | null;
  status_reason: string | null;
  auto_shift_enabled: boolean;
  is_continuation: boolean;
  parent_lesson_id: string | null;
  is_delayed: boolean;
  holiday_id: string | null;
  holiday_title: string | null;
  holiday_start_date: Date | null;
  holiday_end_date: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface TeachingPlanListRow extends TeachingPlanRow {
  total_count: string;
}

// ── Shared SQL fragments ─────────────────────────────────────────────────────────
// The holiday LATERAL join is the Holiday Detection Logic: every fetched lesson
// automatically carries its own holiday-conflict status in one round trip
// (no N+1 lookups), likewise is_delayed is computed inline rather than in app code.

export const COLS = `
  tp.id,
  tp.faculty_id,     f.full_name AS faculty_name,
  tp.subject_id,     s.code      AS subject_code,     s.name AS subject_name,
  tp.department_id,  d.name      AS department_name,
  tp.year, tp.semester, tp.section, tp.lesson_sequence, tp.week_number, tp.lesson_date,
  tp.topic_title, tp.topic_description, tp.learning_objectives, tp.estimated_duration,
  tp.material_id,    cm.title    AS material_title,
  tp.assignment_id,  a.title     AS assignment_title, a.due_date AS assignment_due_date,
  tp.homework, tp.quiz_planned, tp.lesson_status,
  tp.coverage_percentage, tp.remaining_topics, tp.status_reason,
  tp.auto_shift_enabled, tp.is_continuation, tp.parent_lesson_id,
  (tp.lesson_date < CURRENT_DATE AND tp.lesson_status IN ('Planned', 'In Progress')) AS is_delayed,
  hol.id AS holiday_id, hol.title AS holiday_title,
  hol.start_date AS holiday_start_date, hol.end_date AS holiday_end_date,
  tp.created_at, tp.updated_at
`;

export const JOINS = `
  JOIN      faculty          f  ON f.id  = tp.faculty_id
  JOIN      subjects         s  ON s.id  = tp.subject_id
  JOIN      departments      d  ON d.id  = tp.department_id
  LEFT JOIN course_materials cm ON cm.id = tp.material_id
  LEFT JOIN assignments      a  ON a.id  = tp.assignment_id
  LEFT JOIN LATERAL (
    SELECT ace.id, ace.title, ace.start_date, ace.end_date
    FROM academic_calendar_events ace
    WHERE ace.event_type = 'Holiday' AND ace.deleted_at IS NULL AND ace.publish_status != 'Archived'
      AND (ace.department_id IS NULL OR ace.department_id = tp.department_id)
      AND tp.lesson_date BETWEEN ace.start_date AND COALESCE(ace.end_date, ace.start_date)
    ORDER BY ace.start_date
    LIMIT 1
  ) hol ON TRUE
`;

// ── Mapper ─────────────────────────────────────────────────────────────────────

export function toTeachingPlan(r: TeachingPlanRow): TeachingPlan {
  const holidayConflict: HolidayConflict | null = r.holiday_id
    ? {
        holidayId: r.holiday_id,
        holidayTitle: r.holiday_title!,
        startDate: r.holiday_start_date!,
        endDate: r.holiday_end_date,
      }
    : null;

  return {
    id: r.id,
    facultyId: r.faculty_id,
    facultyName: r.faculty_name,
    subjectId: r.subject_id,
    subjectCode: r.subject_code,
    subjectName: r.subject_name,
    departmentId: r.department_id,
    departmentName: r.department_name,
    year: r.year,
    semester: r.semester,
    section: r.section,
    lessonSequence: r.lesson_sequence,
    weekNumber: r.week_number,
    lessonDate: r.lesson_date,
    topicTitle: r.topic_title,
    topicDescription: r.topic_description,
    learningObjectives: r.learning_objectives,
    estimatedDuration: r.estimated_duration,
    materialId: r.material_id,
    materialTitle: r.material_title,
    materialDownloadUrl: r.material_id ? `/api/lms/materials/${r.material_id}/download` : null,
    assignmentId: r.assignment_id,
    assignmentTitle: r.assignment_title,
    assignmentDueDate: r.assignment_due_date,
    homework: r.homework,
    quizPlanned: r.quiz_planned,
    lessonStatus: r.lesson_status,
    coveragePercentage: r.coverage_percentage,
    remainingTopics: r.remaining_topics,
    statusReason: r.status_reason,
    autoShiftEnabled: r.auto_shift_enabled,
    isContinuation: r.is_continuation,
    parentLessonId: r.parent_lesson_id,
    isDelayed: r.is_delayed,
    holidayConflict,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ── Internal helpers ───────────────────────────────────────────────────────────

export async function resolveFacultyId(userId: string): Promise<string> {
  const { rows } = await query<{ id: string }>(
    'SELECT id FROM faculty WHERE user_id = $1 AND deleted_at IS NULL',
    [userId]
  );
  if (!rows[0]) throw AppError.notFound('Faculty profile not found');
  return rows[0].id;
}

export interface StudentCtx {
  studentId: string;
  programId: string;
  departmentId: string;
  semester: number;
  section: string | null;
}

export async function resolveStudentCtx(userId: string): Promise<StudentCtx> {
  const { rows } = await query<{
    id: string;
    program_id: string;
    department_id: string;
    semester: number;
    section: string | null;
  }>(
    'SELECT id, program_id, department_id, semester, section FROM students WHERE user_id = $1 AND deleted_at IS NULL',
    [userId]
  );
  if (!rows[0]) throw AppError.notFound('Student profile not found');
  return {
    studentId: rows[0].id,
    programId: rows[0].program_id,
    departmentId: rows[0].department_id,
    semester: rows[0].semester,
    section: rows[0].section,
  };
}

interface SubjectContext {
  id: string;
  code: string;
  departmentId: string;
  semester: number;
  status: string;
}

async function fetchSubjectContext(subjectId: string, facultyId: string, section: string): Promise<SubjectContext> {
  const { rows } = await query<{
    id: string;
    code: string;
    department_id: string;
    semester: number;
    status: string;
  }>(
    `SELECT s.id, s.code, scm.department_id, scm.semester, s.status
     FROM subjects s
     JOIN subject_curriculum_mappings scm ON scm.subject_id = s.id
     JOIN faculty_subject_assignments fsa ON fsa.subject_curriculum_mapping_id = scm.id
     WHERE s.id = $1 AND fsa.faculty_id = $2 AND fsa.section = $3 AND s.deleted_at IS NULL AND fsa.deleted_at IS NULL`,
    [subjectId, facultyId, section]
  );
  if (!rows[0]) throw AppError.notFound('Subject not found');
  return {
    id: rows[0].id,
    code: rows[0].code,
    departmentId: rows[0].department_id,
    semester: rows[0].semester,
    status: rows[0].status,
  };
}

export async function fetchTeachingPlanRow(id: string): Promise<TeachingPlanRow | null> {
  const { rows } = await query<TeachingPlanRow>(
    `SELECT ${COLS} FROM teaching_plans tp ${JOINS} WHERE tp.id = $1 AND tp.deleted_at IS NULL`,
    [id]
  );
  return rows[0] ?? null;
}

export async function assertTeachingPlanAccess(row: TeachingPlanRow, userId: string, role: Role): Promise<void> {
  if (role === 'admin') return;

  if (role === 'faculty') {
    const facultyId = await resolveFacultyId(userId);
    if (row.faculty_id !== facultyId) {
      throw AppError.forbidden('You do not have access to this teaching plan');
    }
    return;
  }

  const ctx = await resolveStudentCtx(userId);
  const { rows } = await query<{ id: string }>(
    `SELECT s.id
     FROM subjects s
     JOIN subject_curriculum_mappings scm ON scm.subject_id = s.id
     WHERE s.id = $1 AND scm.program_id = $2 AND scm.semester = $3 AND s.deleted_at IS NULL`,
    [row.subject_id, ctx.programId, ctx.semester]
  );
  if (!rows[0]) throw AppError.forbidden('This teaching plan is not in your enrolled subjects');
  if (ctx.section && row.section !== ctx.section) {
    throw AppError.forbidden('This teaching plan is not for your section');
  }
}

// LMS integration — attached material/assignment must be the faculty's own resource
// for the same subject. No LMS data is copied, only the foreign key is stored.
async function assertMaterialBelongsToFacultySubject(
  facultyId: string,
  subjectId: string,
  materialId: string
): Promise<void> {
  const { rows } = await query<{ id: string }>(
    `SELECT id FROM course_materials
     WHERE id = $1 AND subject_id = $2 AND faculty_id = $3 AND deleted_at IS NULL`,
    [materialId, subjectId, facultyId]
  );
  if (!rows[0]) throw AppError.badRequest('Material not found for this subject', 'MATERIAL_NOT_FOUND');
}

async function assertAssignmentBelongsToFacultySubject(
  facultyId: string,
  subjectId: string,
  assignmentId: string
): Promise<void> {
  const { rows } = await query<{ id: string }>(
    `SELECT id FROM assignments
     WHERE id = $1 AND subject_id = $2 AND faculty_id = $3 AND deleted_at IS NULL`,
    [assignmentId, subjectId, facultyId]
  );
  if (!rows[0]) throw AppError.badRequest('Assignment not found for this subject', 'ASSIGNMENT_NOT_FOUND');
}

// Next free position in the teaching order for this class (subject+section+semester).
async function resolveNextSequence(subjectId: string, section: string, semester: number): Promise<number> {
  const { rows } = await query<{ max_seq: number | null }>(
    `SELECT MAX(lesson_sequence) AS max_seq FROM teaching_plans
     WHERE subject_id = $1 AND section = $2 AND semester = $3 AND deleted_at IS NULL`,
    [subjectId, section, semester]
  );
  return (rows[0]?.max_seq ?? 0) + 1;
}

// ── Calendar integration ─────────────────────────────────────────────────────────
// Teaching plans are projected into the existing calendar_entries table
// (source_module = 'teaching_plan') rather than duplicated into a new table.
// 'department' visibility is used because it is the only value both the
// Faculty Calendar and Student Calendar scopes render (see calendarEntry.service.ts).

async function createCalendarSyncEntry(
  userId: string,
  teachingPlanId: string,
  title: string,
  lessonDate: Date,
  departmentId: string,
  semester: number
): Promise<void> {
  await query(
    `INSERT INTO calendar_entries
       (title, description, event_type, start_date, visibility, source_module, source_id, department_id, semester, created_by)
     VALUES ($1, $2, 'Academic', $3, 'department', 'teaching_plan', $4, $5, $6, $7)`,
    [`Lesson: ${title}`, 'Auto-generated from Teaching Plan', lessonDate, teachingPlanId, departmentId, semester, userId]
  );
}

async function updateCalendarSyncEntry(teachingPlanId: string, title: string, lessonDate: Date): Promise<void> {
  await query(
    `UPDATE calendar_entries SET title = $1, start_date = $2
     WHERE source_module = 'teaching_plan' AND source_id = $3 AND deleted_at IS NULL`,
    [`Lesson: ${title}`, lessonDate, teachingPlanId]
  );
}

async function deleteCalendarSyncEntry(teachingPlanId: string): Promise<void> {
  await query(
    `UPDATE calendar_entries SET deleted_at = NOW()
     WHERE source_module = 'teaching_plan' AND source_id = $1 AND deleted_at IS NULL`,
    [teachingPlanId]
  );
}

// ── Notification integration ─────────────────────────────────────────────────────
// Broadcasts to all students in the lesson's department + semester via the
// existing Notification Center (no per-recipient table exists in this codebase).

async function notifyStudents(
  userId: string,
  title: string,
  message: string,
  type: NotificationType,
  departmentId: string,
  semester: number
): Promise<void> {
  await notificationService.createNotification(userId, 'faculty', {
    title,
    message,
    type,
    targetRole: 'student',
    departmentId,
    semester,
    isImportant: false,
  });
}

// ── CRUD ───────────────────────────────────────────────────────────────────────

export async function createTeachingPlan(userId: string, data: CreateTeachingPlanInput): Promise<TeachingPlan> {
  const facultyId = await resolveFacultyId(userId);
  const subject = await fetchSubjectContext(data.subjectId, facultyId, data.section);

  if (subject.status === 'archived') {
    throw AppError.badRequest('Cannot plan lessons for an archived subject', 'SUBJECT_ARCHIVED');
  }

  const assigned = await isFacultyAssigned(facultyId, data.subjectId, data.section);
  if (!assigned) throw AppError.forbidden('You are not assigned to teach this subject/section');

  if (data.materialId) await assertMaterialBelongsToFacultySubject(facultyId, data.subjectId, data.materialId);
  if (data.assignmentId) await assertAssignmentBelongsToFacultySubject(facultyId, data.subjectId, data.assignmentId);

  const year = Math.ceil(subject.semester / 2);
  const sequence = data.lessonSequence ?? (await resolveNextSequence(data.subjectId, data.section, subject.semester));

  const { rows } = await query<{ id: string }>(
    `INSERT INTO teaching_plans
       (faculty_id, subject_id, department_id, year, semester, section, lesson_sequence, week_number, lesson_date,
        topic_title, topic_description, learning_objectives, estimated_duration,
        material_id, assignment_id, homework, quiz_planned, auto_shift_enabled)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     RETURNING id`,
    [
      facultyId,
      data.subjectId,
      subject.departmentId,
      year,
      subject.semester,
      data.section,
      sequence,
      data.weekNumber,
      data.lessonDate,
      data.topicTitle,
      data.topicDescription ?? null,
      data.learningObjectives ?? null,
      data.estimatedDuration,
      data.materialId ?? null,
      data.assignmentId ?? null,
      data.homework ?? null,
      data.quizPlanned,
      data.autoShiftEnabled,
    ]
  );
  const id = rows[0].id;

  await auditLog({ actorId: userId, action: 'CREATE', resource: 'teaching_plan', resourceId: id });

  await createCalendarSyncEntry(userId, id, data.topicTitle, data.lessonDate, subject.departmentId, subject.semester);

  await notifyStudents(
    userId,
    'New Lesson Published',
    `A new lesson "${data.topicTitle}" has been published for ${subject.code} (Lesson ${sequence}).`,
    'Event',
    subject.departmentId,
    subject.semester
  );

  if (data.homework) {
    await notifyStudents(
      userId,
      'New Homework Assigned',
      `Homework added for "${data.topicTitle}" (${subject.code}): ${data.homework}`,
      'Assignment',
      subject.departmentId,
      subject.semester
    );
  }

  if (data.quizPlanned) {
    await notifyStudents(
      userId,
      'Quiz Announced',
      `A quiz has been planned for "${data.topicTitle}" (${subject.code}).`,
      'Academic Alert',
      subject.departmentId,
      subject.semester
    );
    await emitWorkflowEvent('quiz.published', userId, {
      departmentId: subject.departmentId,
      semester: subject.semester,
      title: 'Quiz Announced',
      message: `A quiz has been planned for "${data.topicTitle}" (${subject.code}).`,
      notificationType: 'Academic Alert',
      sourceId: id,
    });
  }

  const row = await fetchTeachingPlanRow(id);
  return toTeachingPlan(row!);
}

export async function listTeachingPlans(
  userId: string,
  role: Role,
  filters: ListTeachingPlansQuery
): Promise<PaginatedTeachingPlans> {
  const {
    page,
    limit,
    departmentId,
    subjectId,
    facultyId,
    year,
    semester,
    section,
    weekNumber,
    lessonStatus,
    from,
    to,
    hasHomework,
    quizPlanned,
  } = filters;
  const offset = (page - 1) * limit;
  const conditions: string[] = ['tp.deleted_at IS NULL'];
  const params: unknown[] = [];

  const push = (cond: string, val: unknown) => {
    params.push(val);
    conditions.push(`${cond} $${params.length}`);
  };

  if (role === 'faculty') {
    const ownFacultyId = await resolveFacultyId(userId);
    push('tp.faculty_id =', ownFacultyId);
  } else if (role === 'student') {
    const ctx = await resolveStudentCtx(userId);
    push('tp.semester =', ctx.semester);
    params.push(ctx.departmentId);
    conditions.push(`EXISTS (SELECT 1 FROM subject_curriculum_mappings scm WHERE scm.subject_id = tp.subject_id AND scm.department_id = $${params.length} AND scm.deleted_at IS NULL)`);
    if (ctx.section) push('tp.section =', ctx.section);
  } else if (facultyId) {
    push('tp.faculty_id =', facultyId);
  }

  if (departmentId) push('tp.department_id =', departmentId);
  if (subjectId) push('tp.subject_id =', subjectId);
  if (year) push('tp.year =', year);
  if (semester && role !== 'student') push('tp.semester =', semester);
  if (section && role !== 'student') push('tp.section =', section);
  if (weekNumber) push('tp.week_number =', weekNumber);
  if (lessonStatus) push('tp.lesson_status =', lessonStatus);
  if (from) push('tp.lesson_date >=', from);
  if (to) push('tp.lesson_date <=', to);
  if (hasHomework === 'true') conditions.push('tp.homework IS NOT NULL');
  if (hasHomework === 'false') conditions.push('tp.homework IS NULL');
  if (quizPlanned === 'true') conditions.push('tp.quiz_planned = TRUE');
  if (quizPlanned === 'false') conditions.push('tp.quiz_planned = FALSE');

  params.push(limit, offset);
  const limitN = params.length - 1;
  const offsetN = params.length;

  const { rows } = await query<TeachingPlanListRow>(
    `SELECT ${COLS}, COUNT(*) OVER() AS total_count
     FROM teaching_plans tp ${JOINS}
     WHERE ${conditions.join(' AND ')}
     ORDER BY tp.lesson_sequence ASC
     LIMIT $${limitN} OFFSET $${offsetN}`,
    params
  );

  const total = rows[0] ? Number(rows[0].total_count) : 0;
  return {
    teachingPlans: rows.map(toTeachingPlan),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getTeachingPlanById(userId: string, role: Role, id: string): Promise<TeachingPlan> {
  const row = await fetchTeachingPlanRow(id);
  if (!row) throw AppError.notFound('Teaching plan not found');
  await assertTeachingPlanAccess(row, userId, role);
  return toTeachingPlan(row);
}

export async function updateTeachingPlan(
  userId: string,
  id: string,
  data: UpdateTeachingPlanInput
): Promise<TeachingPlan> {
  const facultyId = await resolveFacultyId(userId);
  const existing = await fetchTeachingPlanRow(id);
  if (!existing) throw AppError.notFound('Teaching plan not found');
  if (existing.faculty_id !== facultyId) throw AppError.forbidden('You do not own this teaching plan');
  if (existing.lesson_status === 'Completed' || existing.lesson_status === 'Cancelled') {
    throw AppError.badRequest(`Cannot edit a lesson that is already ${existing.lesson_status.toLowerCase()}`);
  }

  if (data.materialId) await assertMaterialBelongsToFacultySubject(facultyId, existing.subject_id, data.materialId);
  if (data.assignmentId) {
    await assertAssignmentBelongsToFacultySubject(facultyId, existing.subject_id, data.assignmentId);
  }

  const sets: string[] = [];
  const params: unknown[] = [];
  const push = (col: string, val: unknown) => {
    params.push(val);
    sets.push(`${col} = $${params.length}`);
  };

  if (data.topicTitle !== undefined) push('topic_title', data.topicTitle);
  if (data.topicDescription !== undefined) push('topic_description', data.topicDescription || null);
  if (data.learningObjectives !== undefined) push('learning_objectives', data.learningObjectives || null);
  if (data.estimatedDuration !== undefined) push('estimated_duration', data.estimatedDuration);
  if ('materialId' in data) push('material_id', data.materialId ?? null);
  if ('assignmentId' in data) push('assignment_id', data.assignmentId ?? null);
  if ('homework' in data) push('homework', data.homework ?? null);
  if (data.quizPlanned !== undefined) push('quiz_planned', data.quizPlanned);
  if (data.autoShiftEnabled !== undefined) push('auto_shift_enabled', data.autoShiftEnabled);

  if (sets.length === 0) throw AppError.badRequest('No fields to update');

  params.push(id);
  await query(`UPDATE teaching_plans SET ${sets.join(', ')} WHERE id = $${params.length}`, params);

  await auditLog({
    actorId: userId,
    action: 'UPDATE',
    resource: 'teaching_plan',
    resourceId: id,
    changes: data as Record<string, unknown>,
  });

  const contentChanged =
    data.topicTitle !== undefined || data.topicDescription !== undefined || data.learningObjectives !== undefined;

  if (contentChanged) {
    await updateCalendarSyncEntry(id, data.topicTitle ?? existing.topic_title, existing.lesson_date);
    await notifyStudents(
      userId,
      'Lesson Updated',
      `The lesson "${data.topicTitle ?? existing.topic_title}" (${existing.subject_code}) has been updated.`,
      'Reminder',
      existing.department_id,
      existing.semester
    );
  }

  if ('homework' in data && data.homework && !existing.homework) {
    await notifyStudents(
      userId,
      'New Homework Assigned',
      `Homework added for "${data.topicTitle ?? existing.topic_title}" (${existing.subject_code}): ${data.homework}`,
      'Assignment',
      existing.department_id,
      existing.semester
    );
  }

  if (data.quizPlanned === true && !existing.quiz_planned) {
    await notifyStudents(
      userId,
      'Quiz Announced',
      `A quiz has been planned for "${data.topicTitle ?? existing.topic_title}" (${existing.subject_code}).`,
      'Academic Alert',
      existing.department_id,
      existing.semester
    );
    await emitWorkflowEvent('quiz.published', userId, {
      departmentId: existing.department_id,
      semester: existing.semester,
      title: 'Quiz Announced',
      message: `A quiz has been planned for "${data.topicTitle ?? existing.topic_title}" (${existing.subject_code}).`,
      notificationType: 'Academic Alert',
      sourceId: id,
    });
  }

  const updated = await fetchTeachingPlanRow(id);
  return toTeachingPlan(updated!);
}

export async function deleteTeachingPlan(userId: string, id: string): Promise<void> {
  const facultyId = await resolveFacultyId(userId);
  const existing = await fetchTeachingPlanRow(id);
  if (!existing) throw AppError.notFound('Teaching plan not found');
  if (existing.faculty_id !== facultyId) throw AppError.forbidden('You do not own this teaching plan');

  await query('UPDATE teaching_plans SET deleted_at = NOW() WHERE id = $1', [id]);
  await deleteCalendarSyncEntry(id);

  await auditLog({ actorId: userId, action: 'DELETE', resource: 'teaching_plan', resourceId: id });
}

// ── Lesson Progress Engine ───────────────────────────────────────────────────────
// Single entry point (PUT /:id/status) for every class-completion outcome.
// Completed/Cancelled are terminal; In Progress/Partially Completed/Rescheduled
// are not — a lesson can move between those until it's finally wrapped up.

async function mergeIntoNextLesson(existing: TeachingPlanRow): Promise<void> {
  const { rows } = await query<{ id: string; topic_description: string | null }>(
    `SELECT id, topic_description FROM teaching_plans
     WHERE subject_id = $1 AND section = $2 AND semester = $3
       AND lesson_sequence > $4 AND lesson_status = 'Planned' AND deleted_at IS NULL
     ORDER BY lesson_sequence ASC LIMIT 1`,
    [existing.subject_id, existing.section, existing.semester, existing.lesson_sequence]
  );
  if (!rows[0]) return; // nothing to merge into — falls back to a plain cancellation

  const mergedNote = `[Merged from "${existing.topic_title}"] ${existing.topic_description ?? ''}`.trim();
  const newDescription = rows[0].topic_description ? `${rows[0].topic_description}\n\n${mergedNote}` : mergedNote;
  await query('UPDATE teaching_plans SET topic_description = $1 WHERE id = $2', [newDescription, rows[0].id]);
}

export async function updateLessonStatus(
  userId: string,
  id: string,
  data: UpdateLessonStatusInput
): Promise<{ teachingPlan: TeachingPlan; continuationLesson: TeachingPlan | null }> {
  const facultyId = await resolveFacultyId(userId);
  const existing = await fetchTeachingPlanRow(id);
  if (!existing) throw AppError.notFound('Teaching plan not found');
  if (existing.faculty_id !== facultyId) throw AppError.forbidden('You do not own this teaching plan');

  const from = existing.lesson_status;
  const to = data.status;

  if (from === 'Completed' || from === 'Cancelled') {
    throw AppError.badRequest(`Cannot change status of a lesson that is already ${from.toLowerCase()}`);
  }
  if (to === 'In Progress' && from !== 'Planned' && from !== 'Rescheduled') {
    throw AppError.badRequest(`Cannot mark as In Progress from status ${from}`);
  }

  // Holiday "merge" resolution — fold this lesson's topic into the next planned one.
  if (to === 'Cancelled' && data.mergeWithNextLesson) {
    await mergeIntoNextLesson(existing);
  }

  const sets: string[] = ['lesson_status = $1'];
  const params: unknown[] = [to];
  const push = (col: string, val: unknown) => {
    params.push(val);
    sets.push(`${col} = $${params.length}`);
  };

  if (to === 'Partially Completed') {
    push('coverage_percentage', data.coveragePercentage ?? null);
    push('remaining_topics', data.remainingTopics ?? null);
  }
  if (data.reason !== undefined) push('status_reason', data.reason);

  params.push(id);
  await query(`UPDATE teaching_plans SET ${sets.join(', ')} WHERE id = $${params.length}`, params);

  await auditLog({
    actorId: userId,
    action: 'UPDATE',
    resource: 'teaching_plan',
    resourceId: id,
    changes: { lessonStatus: to, ...data },
  });

  if (to === 'Cancelled') {
    await deleteCalendarSyncEntry(id);
  }

  let continuationLesson: TeachingPlan | null = null;
  if (to === 'Partially Completed' && data.continueNextClass) {
    continuationLesson = await createContinuationLesson(userId, id, {
      lessonDate: data.continuationLessonDate,
    });
  }

  if (to === 'Completed') {
    // Teaching progress / roadmap / dashboard / analytics are all computed live
    // from teaching_plans, so there is nothing further to synchronize here —
    // the Academic Workflow Engine's role for this trigger is purely the audit
    // trail (see the seeded 'lesson.completed' -> log_only rule).
    await emitWorkflowEvent('lesson.completed', userId, {
      departmentId: existing.department_id,
      semester: existing.semester,
      title: 'Lesson Completed',
      message: `Lesson "${existing.topic_title}" (${existing.subject_code}) marked completed.`,
      notificationType: 'Reminder',
      sourceId: id,
    });
  }

  const updated = await fetchTeachingPlanRow(id);
  return { teachingPlan: toTeachingPlan(updated!), continuationLesson };
}

// ── Auto Shift Engine ─────────────────────────────────────────────────────────────
// Inserts a continuation lesson right after a partially completed one and pushes
// every future, not-yet-started lesson (Planned/Rescheduled) down one slot.
// Sequence numbers are unique per class (see uq_teaching_plans_sequence), so the
// shift must happen highest-sequence-first inside one transaction: a single bulk
// UPDATE would transiently collide two rows on the same number mid-statement.

export async function createContinuationLesson(
  userId: string,
  parentId: string,
  overrides: { lessonDate?: Date; estimatedDuration?: number } = {}
): Promise<TeachingPlan> {
  const facultyId = await resolveFacultyId(userId);
  const parent = await fetchTeachingPlanRow(parentId);
  if (!parent) throw AppError.notFound('Teaching plan not found');
  if (parent.faculty_id !== facultyId) throw AppError.forbidden('You do not own this teaching plan');
  if (parent.lesson_status !== 'Partially Completed') {
    throw AppError.badRequest('Continuation lessons can only be created for a partially completed lesson');
  }

  const { rows: existingContinuation } = await query<{ id: string }>(
    `SELECT id FROM teaching_plans WHERE parent_lesson_id = $1 AND deleted_at IS NULL LIMIT 1`,
    [parentId]
  );
  if (existingContinuation[0]) {
    throw AppError.conflict('A continuation lesson already exists for this lesson');
  }

  const insertSequence = parent.lesson_sequence + 1;
  const lessonDate = overrides.lessonDate ?? new Date(parent.lesson_date.getTime() + 7 * 24 * 60 * 60 * 1000);
  const estimatedDuration = overrides.estimatedDuration ?? parent.estimated_duration;
  const continuationTitle = `${parent.topic_title} (Continued)`;

  const newId = await withTransaction(async (client) => {
    const { rows: toShift } = await client.query<{ id: string }>(
      `SELECT id FROM teaching_plans
       WHERE subject_id = $1 AND section = $2 AND semester = $3
         AND lesson_sequence >= $4 AND lesson_status IN ('Planned', 'Rescheduled') AND deleted_at IS NULL
       ORDER BY lesson_sequence DESC`,
      [parent.subject_id, parent.section, parent.semester, insertSequence]
    );
    // Highest sequence first so a freed slot always exists before the next row claims it.
    for (const row of toShift) {
      await client.query('UPDATE teaching_plans SET lesson_sequence = lesson_sequence + 1 WHERE id = $1', [row.id]);
    }

    const { rows: inserted } = await client.query<{ id: string }>(
      `INSERT INTO teaching_plans
         (faculty_id, subject_id, department_id, year, semester, section, lesson_sequence, week_number, lesson_date,
          topic_title, topic_description, learning_objectives, estimated_duration,
          homework, quiz_planned, auto_shift_enabled, is_continuation, parent_lesson_id, lesson_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'Planned')
       RETURNING id`,
      [
        parent.faculty_id,
        parent.subject_id,
        parent.department_id,
        parent.year,
        parent.semester,
        parent.section,
        insertSequence,
        parent.week_number,
        lessonDate,
        continuationTitle,
        parent.remaining_topics,
        parent.learning_objectives,
        estimatedDuration,
        null,
        false,
        parent.auto_shift_enabled,
        true,
        parentId,
      ]
    );
    return inserted[0].id;
  });

  await auditLog({
    actorId: userId,
    action: 'CREATE',
    resource: 'teaching_plan',
    resourceId: newId,
    changes: { continuationOf: parentId },
  });

  await createCalendarSyncEntry(userId, newId, continuationTitle, lessonDate, parent.department_id, parent.semester);

  await notifyStudents(
    userId,
    'New Lesson Published',
    `Continuation of "${parent.topic_title}" (${parent.subject_code}) has been scheduled — remaining topics: ${
      parent.remaining_topics ?? 'see lesson details'
    }.`,
    'Event',
    parent.department_id,
    parent.semester
  );

  const created = await fetchTeachingPlanRow(newId);
  return toTeachingPlan(created!);
}

// ── Reschedule ─────────────────────────────────────────────────────────────────
// "Shift remaining lessons?" — auto derives the day delta from the date change;
// "Custom Shift" applies an explicit day offset to every future lesson instead.

export async function rescheduleLesson(
  userId: string,
  id: string,
  data: RescheduleTeachingPlanInput
): Promise<TeachingPlan> {
  const facultyId = await resolveFacultyId(userId);
  const existing = await fetchTeachingPlanRow(id);
  if (!existing) throw AppError.notFound('Teaching plan not found');
  if (existing.faculty_id !== facultyId) throw AppError.forbidden('You do not own this teaching plan');
  if (existing.lesson_status === 'Completed' || existing.lesson_status === 'Cancelled') {
    throw AppError.badRequest(`Cannot reschedule a lesson that is already ${existing.lesson_status.toLowerCase()}`);
  }

  const deltaDays =
    data.shiftRemaining === 'custom'
      ? data.customShiftDays!
      : Math.round((data.newDate.getTime() - existing.lesson_date.getTime()) / 86_400_000);

  await query(`UPDATE teaching_plans SET lesson_date = $1, lesson_status = 'Rescheduled' WHERE id = $2`, [
    data.newDate,
    id,
  ]);

  const shouldShift = data.shiftRemaining !== 'none' && deltaDays !== 0;

  if (shouldShift) {
    await query(
      `UPDATE teaching_plans
       SET lesson_date = lesson_date + make_interval(days => $1)
       WHERE subject_id = $2 AND section = $3 AND semester = $4
         AND lesson_sequence > $5 AND lesson_status IN ('Planned', 'Rescheduled') AND deleted_at IS NULL`,
      [deltaDays, existing.subject_id, existing.section, existing.semester, existing.lesson_sequence]
    );
  }

  await auditLog({
    actorId: userId,
    action: 'UPDATE',
    resource: 'teaching_plan',
    resourceId: id,
    changes: { lessonDate: data.newDate, reason: data.reason, shiftRemaining: data.shiftRemaining },
  });

  await updateCalendarSyncEntry(id, existing.topic_title, data.newDate);

  if (shouldShift) {
    // Re-sync calendar entries for every shifted lesson so Faculty/Student calendars stay accurate.
    const { rows: shifted } = await query<{ id: string; topic_title: string; lesson_date: Date }>(
      `SELECT id, topic_title, lesson_date FROM teaching_plans
       WHERE subject_id = $1 AND section = $2 AND semester = $3
         AND lesson_sequence > $4 AND lesson_status IN ('Planned', 'Rescheduled') AND deleted_at IS NULL`,
      [existing.subject_id, existing.section, existing.semester, existing.lesson_sequence]
    );
    for (const s of shifted) {
      await updateCalendarSyncEntry(s.id, s.topic_title, s.lesson_date);
    }
  }

  const reasonSuffix = data.reason ? ` Reason: ${data.reason}` : '';
  await notifyStudents(
    userId,
    'Lesson Rescheduled',
    `The lesson "${existing.topic_title}" (${existing.subject_code}) has been rescheduled to ${data.newDate.toDateString()}.${reasonSuffix}`,
    'Reminder',
    existing.department_id,
    existing.semester
  );

  // Calendar/roadmap/notification sync above is already the Auto Shift Engine's
  // own work — the Academic Workflow Engine just records the audit trail here.
  await emitWorkflowEvent('lesson.rescheduled', userId, {
    departmentId: existing.department_id,
    semester: existing.semester,
    title: 'Lesson Rescheduled',
    message: `Lesson "${existing.topic_title}" (${existing.subject_code}) rescheduled to ${data.newDate.toDateString()}.`,
    notificationType: 'Reminder',
    sourceId: id,
  });

  const updated = await fetchTeachingPlanRow(id);
  return toTeachingPlan(updated!);
}
