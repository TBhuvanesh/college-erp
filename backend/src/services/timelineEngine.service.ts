import { query } from '../config/database';
import { AppError } from '../errors/AppError';
import * as roadmapService from './teachingPlanRoadmap.service';
import * as facultyOperationsService from './facultyOperations.service';
import { listAssignments } from './lmsAssignment.service';
import { getStudentSummary as getAttendanceSummary } from './attendance.service';
import { getStudentDues } from './fee.service';
import { getMentorByStudent, getNotesByStudent } from './mentorship.service';
import { listCalendarEntries } from './calendarEntry.service';
import { listOpportunities } from './opportunityHub.service';
import { listNotifications } from './notification.service';
import { getStudentResults } from './result.service';
import type { TimelineEvent, TimelineCategory, Priority } from '../types/experience';

function event(
  id: string,
  category: TimelineCategory,
  title: string,
  subtitle: string | null,
  timestamp: Date | string,
  priority: Priority,
  sourceModule: string,
  sourceId: string | null,
  meta?: Record<string, unknown>
): TimelineEvent {
  return {
    id,
    category,
    title,
    subtitle,
    timestamp: new Date(timestamp).toISOString(),
    priority,
    sourceModule,
    sourceId,
    meta,
  };
}

function sortChronologically(events: TimelineEvent[]): TimelineEvent[] {
  return [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

// ── Short-lived in-process cache ─────────────────────────────────────────────
// /experience/student, /timeline, /actions and /week all need the same
// aggregated event collection within the same few seconds of user activity —
// caching it avoids re-running ~9 parallel queries per endpoint hit. A plain
// TTL map is appropriate here: single-process Express app, no existing cache
// infra to extend, and correctness only requires "fresh within a few seconds",
// not strong consistency (mirrors why fee.service self-heals lazily instead of
// via a cron job).

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const CACHE_TTL_MS = 30_000;
const studentTimelineCache = new Map<string, CacheEntry<TimelineEvent[]>>();
const facultyTimelineCache = new Map<string, CacheEntry<TimelineEvent[]>>();

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = cache.get(key);
  if (!entry || entry.expiresAt < Date.now()) return null;
  return entry.value;
}

function setCached<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T): void {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ── Student Timeline ──────────────────────────────────────────────────────────
// Pure aggregation — every event is produced by reshaping the output of an
// existing service call, never by re-deriving business logic.

export async function buildStudentTimeline(userId: string, windowDays: number): Promise<TimelineEvent[]> {
  const cacheKey = `${userId}:${windowDays}`;
  const cached = getCached(studentTimelineCache, cacheKey);
  if (cached) return cached;

  const events = await computeStudentTimeline(userId, windowDays);
  setCached(studentTimelineCache, cacheKey, events);
  return events;
}

async function computeStudentTimeline(userId: string, windowDays: number): Promise<TimelineEvent[]> {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + windowDays * 86_400_000);

  const { rows: stuRows } = await query<{ id: string }>(
    'SELECT id FROM students WHERE user_id = $1 AND deleted_at IS NULL',
    [userId]
  );
  if (!stuRows[0]) throw AppError.forbidden('No student profile is linked to this account');
  const studentId = stuRows[0].id;

  const [roadmap, assignmentsRes, attendanceSummary, fees, mentor, calendarRes, opportunitiesRes, notificationsRes, results] =
    await Promise.all([
      roadmapService.getStudentRoadmap(userId, 'student', {}),
      listAssignments(userId, 'student', { page: 1, limit: 50 } as never),
      getAttendanceSummary(userId),
      getStudentDues(userId),
      getMentorByStudent(studentId),
      listCalendarEntries(userId, 'student', { page: 1, limit: 50, from: now.toISOString(), to: windowEnd.toISOString() } as never),
      listOpportunities(userId, 'student', { page: 1, limit: 50 } as never),
      listNotifications(userId, 'student', { page: 1, limit: 10 } as never),
      getStudentResults(userId),
    ]);

  const events: TimelineEvent[] = [];

  // Teaching Planner — today's/upcoming lessons, homework, quiz schedule, delayed lessons.
  for (const subject of roadmap.subjects) {
    for (const lesson of subject.upcomingLessons) {
      events.push(
        event(`class-${lesson.id}`, 'class', lesson.topicTitle, `${lesson.subjectCode} — ${lesson.facultyName}`, lesson.lessonDate, 'medium', 'teaching_planner', lesson.id)
      );
    }
    for (const lesson of subject.homework) {
      events.push(
        event(`homework-${lesson.id}`, 'homework', `Homework: ${lesson.homework}`, lesson.subjectCode, lesson.lessonDate, 'medium', 'teaching_planner', lesson.id)
      );
    }
    for (const lesson of subject.quizSchedule) {
      events.push(
        event(`quiz-${lesson.id}`, 'quiz', `Quiz: ${lesson.topicTitle}`, lesson.subjectCode, lesson.lessonDate, 'high', 'teaching_planner', lesson.id)
      );
    }
    for (const lesson of subject.delayedLessons) {
      events.push(
        event(`delayed-${lesson.id}`, 'class', `Delayed: ${lesson.topicTitle}`, lesson.subjectCode, lesson.lessonDate, 'high', 'teaching_planner', lesson.id)
      );
    }
  }

  // LMS — assignments due.
  for (const a of assignmentsRes.assignments) {
    events.push(
      event(`assignment-${a.id}`, 'assignment', `Assignment Due: ${a.title}`, a.subjectCode, a.dueDate, 'high', 'lms', a.id, { maxMarks: a.maxMarks })
    );
  }

  // Attendance alerts — subjects below 75%, anchored to "now" (not date-scheduled).
  for (const s of attendanceSummary.subjects) {
    if (s.totalClasses > 0 && s.percentage < 75) {
      events.push(
        event(`attendance-${s.subjectId}`, 'attendance', `Attendance below 75% in ${s.subjectCode}`, `${s.percentage}%`, now, 'high', 'attendance', s.subjectId)
      );
    }
  }

  // Fees — pending dues.
  for (const f of fees) {
    events.push(
      event(`fee-${f.id}`, 'fee', `Fee Due: ${f.feeType}`, `₹${f.pendingAmount.toFixed(2)} pending`, f.dueDate, 'high', 'fees', f.id, { pendingAmount: f.pendingAmount })
    );
  }

  // Mentorship — upcoming/overdue follow-up meetings.
  if (mentor) {
    const notes = await getNotesByStudent(studentId);
    for (const n of notes) {
      if (n.followUpDate) {
        events.push(
          event(`mentor-${n.id}`, 'mentorship', `Mentor Meeting: ${n.title}`, mentor.mentorName, n.followUpDate, 'medium', 'mentorship', n.id)
        );
      }
    }
  }

  // Academic Calendar / Personal Calendar.
  for (const c of calendarRes.entries) {
    events.push(event(`calendar-${c.id}`, 'event', c.title, c.eventType, c.startDate, 'low', 'calendar', c.id));
  }

  // Opportunity Hub — deadlines within the window.
  for (const o of opportunitiesRes.opportunities) {
    if (o.deadline && new Date(o.deadline) <= windowEnd) {
      events.push(event(`opportunity-${o.id}`, 'opportunity', `Deadline: ${o.title}`, o.type, o.deadline, 'medium', 'opportunity_hub', o.id));
    }
  }

  // Notification Center — recent notifications, informational.
  for (const n of notificationsRes.notifications) {
    events.push(event(`notification-${n.id}`, 'notification', n.title, n.type, n.createdAt, n.isImportant ? 'high' : 'low', 'notifications', n.id));
  }

  // Results — recently published.
  for (const r of results) {
    if (r.publishedAt && new Date(r.publishedAt) >= new Date(now.getTime() - 7 * 86_400_000)) {
      events.push(event(`result-${r.resultId}`, 'result', `Result Published: ${r.subjectCode}`, r.grade, r.publishedAt, 'medium', 'results', r.resultId));
    }
  }

  return sortChronologically(events);
}

// ── Faculty Timeline ──────────────────────────────────────────────────────────
// Faculty Operations already aggregates today's classes, pending attendance,
// pending evaluations, mentor meetings, exams, calendar and tasks — the
// Timeline Engine's job here is purely reshaping that single call into a
// chronologically-sortable event stream, not re-querying the same data.

export async function buildFacultyTimeline(userId: string): Promise<TimelineEvent[]> {
  const cached = getCached(facultyTimelineCache, userId);
  if (cached) return cached;

  const events = await computeFacultyTimeline(userId);
  setCached(facultyTimelineCache, userId, events);
  return events;
}

async function computeFacultyTimeline(userId: string): Promise<TimelineEvent[]> {
  const dashboard = await facultyOperationsService.getFacultyOperationsDashboard(userId);
  const events: TimelineEvent[] = [];

  for (const lesson of dashboard.todaySchedule) {
    events.push(event(`class-${lesson.id}`, 'class', lesson.topicTitle, lesson.subjectCode, lesson.lessonDate, 'medium', 'teaching_planner', lesson.id));
  }

  for (const item of dashboard.pendingAttendance) {
    events.push(
      event(`attendance-${item.subjectId}-${item.section}`, 'attendance', `Take attendance: ${item.subjectCode} (${item.section})`, item.subjectName, new Date(), 'high', 'attendance', item.subjectId)
    );
  }

  for (const item of dashboard.assignmentsPendingEvaluation) {
    events.push(
      event(`evaluation-${item.assignmentId}`, 'assignment', `Evaluate ${item.pendingCount} submission(s): ${item.assignmentTitle}`, item.subjectCode, new Date(), 'medium', 'lms', item.assignmentId)
    );
  }

  for (const item of dashboard.upcomingDeadlines) {
    events.push(event(`deadline-${item.assignmentId}`, 'assignment', `Assignment Deadline: ${item.assignmentTitle}`, item.subjectCode, item.dueDate, 'medium', 'lms', item.assignmentId));
  }

  for (const m of [...dashboard.mentorMeetings.upcoming, ...dashboard.mentorMeetings.overdue]) {
    events.push(event(`mentor-${m.noteId}`, 'mentorship', `Mentor Meeting: ${m.studentName}`, m.title, m.followUpDate, 'medium', 'mentorship', m.noteId));
  }

  for (const q of dashboard.upcomingQuizzes) {
    events.push(event(`quiz-${q.id}`, 'quiz', `Quiz: ${q.topicTitle}`, q.subjectCode, q.lessonDate, 'medium', 'teaching_planner', q.id));
  }

  for (const e of dashboard.upcomingExams) {
    events.push(event(`exam-${e.examId}`, 'exam', `${e.examType}: ${e.subjectCode}`, e.status, e.examDate, 'medium', 'examinations', e.examId));
  }

  for (const c of dashboard.calendarSummary) {
    events.push(event(`calendar-${c.id}`, 'event', c.title, c.eventType, c.startDate, 'low', 'calendar', c.id));
  }

  for (const t of dashboard.tasks) {
    events.push(event(`task-${t.id}`, 'task', t.title, t.context, t.dueDate ?? new Date(), t.priority, 'faculty_operations', t.id));
  }

  return sortChronologically(events);
}
