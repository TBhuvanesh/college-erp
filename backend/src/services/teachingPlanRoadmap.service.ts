import { query } from '../config/database';
import { AppError } from '../errors/AppError';
import {
  COLS,
  JOINS,
  toTeachingPlan,
  resolveFacultyId,
  resolveStudentCtx,
  type TeachingPlanRow,
  type StudentCtx,
} from './teachingPlan.service';
import type { Role } from '../types/roles';
import type {
  TeachingPlan,
  LessonStatus,
  CourseProgress,
  CourseProgressQuery,
  StudentScopedQuery,
  UpcomingQuery,
  UpcomingLessons,
  TimelineWeek,
  StudentRoadmap,
  RoadmapSubject,
} from '../types/teachingPlan';

// Lessons that haven't happened yet — the shared definition of "upcoming"
// used by /today, /upcoming, and the roadmap generator below.
const ACTIVE_STATUSES = ['Planned', 'In Progress', 'Rescheduled'];

async function resolveStudentCtxByStudentId(studentId: string): Promise<StudentCtx> {
  const { rows } = await query<{
    id: string;
    program_id: string;
    department_id: string;
    semester: number;
    section: string | null;
  }>('SELECT id, program_id, department_id, semester, section FROM students WHERE id = $1 AND deleted_at IS NULL', [
    studentId,
  ]);
  if (!rows[0]) throw AppError.notFound('Student not found');
  return {
    studentId: rows[0].id,
    programId: rows[0].program_id,
    departmentId: rows[0].department_id,
    semester: rows[0].semester,
    section: rows[0].section,
  };
}

function applyStudentScope(ctx: StudentCtx, conditions: string[], params: unknown[]): void {
  params.push(ctx.semester);
  conditions.push(`tp.semester = $${params.length}`);
  params.push(ctx.programId);
  conditions.push(`EXISTS (SELECT 1 FROM subject_curriculum_mappings scm WHERE scm.subject_id = tp.subject_id AND scm.program_id = $${params.length})`);
  if (ctx.section) {
    params.push(ctx.section);
    conditions.push(`tp.section = $${params.length}`);
  }
}

// ── GET /teaching-plans/today ──────────────────────────────────────────────────

export async function getTodayLessons(
  userId: string,
  role: Role,
  filters: StudentScopedQuery
): Promise<TeachingPlan[]> {
  const conditions: string[] = ['tp.deleted_at IS NULL', 'tp.lesson_date = CURRENT_DATE'];
  const params: unknown[] = [];

  if (role === 'faculty') {
    const facultyId = await resolveFacultyId(userId);
    params.push(facultyId);
    conditions.push(`tp.faculty_id = $${params.length}`);
  } else if (role === 'student') {
    applyStudentScope(await resolveStudentCtx(userId), conditions, params);
  } else if (filters.studentId) {
    applyStudentScope(await resolveStudentCtxByStudentId(filters.studentId), conditions, params);
  }

  if (filters.subjectId) {
    params.push(filters.subjectId);
    conditions.push(`tp.subject_id = $${params.length}`);
  }

  const { rows } = await query<TeachingPlanRow>(
    `SELECT ${COLS} FROM teaching_plans tp ${JOINS} WHERE ${conditions.join(' AND ')} ORDER BY tp.lesson_sequence ASC`,
    params
  );
  return rows.map(toTeachingPlan);
}

// ── GET /teaching-plans/upcoming?view=week|month|semester ───────────────────────

export async function getUpcomingLessons(
  userId: string,
  role: Role,
  filters: UpcomingQuery
): Promise<UpcomingLessons> {
  const { view, subjectId, studentId } = filters;
  const conditions: string[] = [
    'tp.deleted_at IS NULL',
    'tp.lesson_date >= CURRENT_DATE',
    `tp.lesson_status IN ('Planned', 'In Progress', 'Rescheduled')`,
  ];
  const params: unknown[] = [];

  if (role === 'faculty') {
    const facultyId = await resolveFacultyId(userId);
    params.push(facultyId);
    conditions.push(`tp.faculty_id = $${params.length}`);
  } else if (role === 'student') {
    applyStudentScope(await resolveStudentCtx(userId), conditions, params);
  } else if (studentId) {
    applyStudentScope(await resolveStudentCtxByStudentId(studentId), conditions, params);
  }

  if (subjectId) {
    params.push(subjectId);
    conditions.push(`tp.subject_id = $${params.length}`);
  }

  if (view === 'week') {
    conditions.push(`tp.lesson_date < CURRENT_DATE + INTERVAL '7 days'`);
  } else if (view === 'month') {
    conditions.push(`tp.lesson_date < CURRENT_DATE + INTERVAL '30 days'`);
  }
  // 'semester' — no additional upper date bound.

  const { rows } = await query<TeachingPlanRow>(
    `SELECT ${COLS} FROM teaching_plans tp ${JOINS} WHERE ${conditions.join(' AND ')} ORDER BY tp.lesson_sequence ASC`,
    params
  );
  const lessons = rows.map(toTeachingPlan);

  const weekMap = new Map<number, TeachingPlan[]>();
  for (const lesson of lessons) {
    if (!weekMap.has(lesson.weekNumber)) weekMap.set(lesson.weekNumber, []);
    weekMap.get(lesson.weekNumber)!.push(lesson);
  }
  const weeks: TimelineWeek[] = Array.from(weekMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([weekNumber, weekLessons]) => ({ weekNumber, lessons: weekLessons }));

  return { view, lessons, weeks };
}

// ── GET /teaching-plans/progress ─────────────────────────────────────────────────
// Syllabus Progress — Lessons Planned / Completed / Remaining / Current Lesson / %.

export async function getCourseProgress(
  userId: string,
  role: Role,
  filters: CourseProgressQuery
): Promise<CourseProgress> {
  const conditions: string[] = ['deleted_at IS NULL'];
  const params: unknown[] = [];
  const push = (cond: string, val: unknown) => {
    params.push(val);
    conditions.push(`${cond} $${params.length}`);
  };

  if (role === 'faculty') {
    const facultyId = await resolveFacultyId(userId);
    push('faculty_id =', facultyId);
  } else if (role === 'student') {
    if (!filters.subjectId) throw AppError.badRequest('subjectId is required');
    const ctx = await resolveStudentCtx(userId);
    const { rows } = await query<{ id: string }>(
      `SELECT s.id
       FROM subjects s
       JOIN subject_curriculum_mappings scm ON scm.subject_id = s.id
       WHERE s.id = $1 AND scm.program_id = $2 AND scm.semester = $3 AND s.deleted_at IS NULL`,
      [filters.subjectId, ctx.programId, ctx.semester]
    );
    if (!rows[0]) throw AppError.forbidden('This subject is not in your enrolled subjects');
  } else if (filters.facultyId) {
    push('faculty_id =', filters.facultyId);
  }

  if (filters.departmentId) push('department_id =', filters.departmentId);
  if (filters.subjectId) push('subject_id =', filters.subjectId);
  if (filters.section) push('section =', filters.section);
  if (filters.semester) push('semester =', filters.semester);

  const where = conditions.join(' AND ');

  const { rows } = await query<{ lesson_status: LessonStatus; count: string }>(
    `SELECT lesson_status, COUNT(*) AS count FROM teaching_plans WHERE ${where} GROUP BY lesson_status`,
    params
  );

  const counts: Record<LessonStatus, number> = {
    Planned: 0,
    'In Progress': 0,
    'Partially Completed': 0,
    Completed: 0,
    Rescheduled: 0,
    Cancelled: 0,
  };
  for (const r of rows) counts[r.lesson_status] = Number(r.count);

  const totalPlanned =
    counts.Planned + counts['In Progress'] + counts['Partially Completed'] + counts.Completed + counts.Rescheduled;
  const completed = counts.Completed;

  const { rows: currentRows } = await query<{
    id: string;
    lesson_sequence: number;
    topic_title: string;
    lesson_status: LessonStatus;
    lesson_date: Date;
  }>(
    `SELECT id, lesson_sequence, topic_title, lesson_status, lesson_date FROM teaching_plans
     WHERE ${where} AND lesson_status NOT IN ('Completed', 'Cancelled')
     ORDER BY lesson_sequence ASC LIMIT 1`,
    params
  );
  const currentLesson = currentRows[0]
    ? {
        id: currentRows[0].id,
        lessonSequence: currentRows[0].lesson_sequence,
        topicTitle: currentRows[0].topic_title,
        lessonStatus: currentRows[0].lesson_status,
        lessonDate: currentRows[0].lesson_date,
      }
    : null;

  return {
    totalPlanned,
    completed,
    remaining: totalPlanned - completed,
    rescheduled: counts.Rescheduled,
    cancelled: counts.Cancelled,
    completionPercentage: totalPlanned > 0 ? Math.round((completed / totalPlanned) * 10000) / 100 : 0,
    currentLesson,
  };
}

function subjectProgress(lessons: TeachingPlan[]): CourseProgress {
  const totalPlanned = lessons.filter((l) => l.lessonStatus !== 'Cancelled').length;
  const completed = lessons.filter((l) => l.lessonStatus === 'Completed').length;
  const current = lessons.find((l) => l.lessonStatus !== 'Completed' && l.lessonStatus !== 'Cancelled') ?? null;

  return {
    totalPlanned,
    completed,
    remaining: totalPlanned - completed,
    rescheduled: lessons.filter((l) => l.lessonStatus === 'Rescheduled').length,
    cancelled: lessons.filter((l) => l.lessonStatus === 'Cancelled').length,
    completionPercentage: totalPlanned > 0 ? Math.round((completed / totalPlanned) * 10000) / 100 : 0,
    currentLesson: current
      ? {
          id: current.id,
          lessonSequence: current.lessonSequence,
          topicTitle: current.topicTitle,
          lessonStatus: current.lessonStatus,
          lessonDate: current.lessonDate,
        }
      : null,
  };
}

// ── GET /teaching-plans/student-roadmap ──────────────────────────────────────────
// Roadmap Generator: one query for the whole class list, grouped by subject in
// application code — avoids an N+1 query per enrolled subject.

export async function getStudentRoadmap(
  userId: string,
  role: Role,
  filters: StudentScopedQuery
): Promise<StudentRoadmap> {
  let ctx: StudentCtx;
  if (role === 'student') {
    ctx = await resolveStudentCtx(userId);
  } else if (role === 'admin' && filters.studentId) {
    ctx = await resolveStudentCtxByStudentId(filters.studentId);
  } else if (role === 'admin') {
    throw AppError.badRequest('studentId is required');
  } else {
    throw AppError.forbidden('Only students (own roadmap) or admins (via studentId) may view a learning roadmap');
  }

  const conditions: string[] = ['tp.deleted_at IS NULL'];
  const params: unknown[] = [];
  applyStudentScope(ctx, conditions, params);

  if (filters.subjectId) {
    params.push(filters.subjectId);
    conditions.push(`tp.subject_id = $${params.length}`);
  }

  const { rows } = await query<TeachingPlanRow>(
    `SELECT ${COLS} FROM teaching_plans tp ${JOINS}
     WHERE ${conditions.join(' AND ')}
     ORDER BY tp.subject_id, tp.lesson_sequence ASC`,
    params
  );

  const bySubject = new Map<string, TeachingPlan[]>();
  for (const row of rows) {
    const lesson = toTeachingPlan(row);
    if (!bySubject.has(lesson.subjectId)) bySubject.set(lesson.subjectId, []);
    bySubject.get(lesson.subjectId)!.push(lesson);
  }

  const todayKey = new Date().toDateString();

  const subjects: RoadmapSubject[] = Array.from(bySubject.values()).map((lessons) => {
    const first = lessons[0];
    return {
      subjectId: first.subjectId,
      subjectCode: first.subjectCode,
      subjectName: first.subjectName,
      facultyName: first.facultyName,
      todayTopic: lessons.find((l) => new Date(l.lessonDate).toDateString() === todayKey) ?? null,
      upcomingLessons: lessons.filter(
        (l) => ACTIVE_STATUSES.includes(l.lessonStatus) && new Date(l.lessonDate) >= new Date(todayKey)
      ),
      completedLessons: lessons.filter((l) => l.lessonStatus === 'Completed' || l.lessonStatus === 'Partially Completed'),
      delayedLessons: lessons.filter((l) => l.isDelayed),
      homework: lessons.filter((l) => l.homework && ACTIVE_STATUSES.includes(l.lessonStatus)),
      quizSchedule: lessons.filter((l) => l.quizPlanned && ACTIVE_STATUSES.includes(l.lessonStatus)),
      progress: subjectProgress(lessons),
    };
  });

  return { subjects };
}
