import { query } from '../config/database';
import type { FacultyTask } from '../types/facultyOperations';
import { getPendingAttendanceSections, getPendingResultEntries, getPendingEvaluations } from './facultyDailyStatus.service';

// Every task here is generated fresh from live data — nothing is stored, so a
// task "disappears automatically when completed" simply because the query that
// produced it (e.g. "no attendance row for today") stops matching.
//
// Pending attendance and pending result entry are resolved through
// facultyDailyStatus.service.ts (shared with facultyWorkload.service.ts and
// facultyOperations.service.ts) rather than re-querying attendance/
// result_entry_tasks here — the three services previously computed the same
// two things three different ways.

export async function generateTodayTasks(facultyId: string): Promise<FacultyTask[]> {
  const tasks: FacultyTask[] = [];

  const [pendingAttendance, todayLessons, todayQuizzes, pendingEvaluations, todayMeetings, marksPending, todayInvigilation] = await Promise.all([
    getPendingAttendanceSections(facultyId),
    query<{ id: string; topic_title: string; subject_code: string; week_number: number }>(
      `SELECT tp.id, tp.topic_title, s.code AS subject_code, tp.week_number
       FROM teaching_plans tp JOIN subjects s ON s.id = tp.subject_id
       WHERE tp.faculty_id = $1 AND tp.deleted_at IS NULL AND tp.lesson_date = CURRENT_DATE
         AND tp.lesson_status IN ('Planned', 'In Progress')`,
      [facultyId]
    ),
    query<{ id: string; topic_title: string; subject_code: string }>(
      `SELECT tp.id, tp.topic_title, s.code AS subject_code
       FROM teaching_plans tp JOIN subjects s ON s.id = tp.subject_id
       WHERE tp.faculty_id = $1 AND tp.deleted_at IS NULL AND tp.lesson_date = CURRENT_DATE
         AND tp.quiz_planned = TRUE AND tp.lesson_status NOT IN ('Completed', 'Cancelled')`,
      [facultyId]
    ),
    getPendingEvaluations(facultyId),
    query<{ id: string; student_name: string; title: string; follow_up_date: string }>(
      `SELECT mn.id, s.full_name AS student_name, mn.title, TO_CHAR(mn.follow_up_date, 'YYYY-MM-DD') AS follow_up_date
       FROM mentoring_notes mn JOIN students s ON s.id = mn.student_id
       WHERE mn.mentor_id = $1 AND mn.deleted_at IS NULL AND mn.follow_up_date = CURRENT_DATE`,
      [facultyId]
    ),
    getPendingResultEntries(facultyId),
    query<{ id: string; room_name: string; start_time: string; end_time: string }>(
      `SELECT eid.id, er.name AS room_name, eid.start_time::text, eid.end_time::text
       FROM exam_invigilation_duties eid JOIN exam_rooms er ON er.id = eid.room_id
       WHERE eid.faculty_id = $1 AND eid.status = 'Assigned' AND eid.duty_date = CURRENT_DATE AND eid.deleted_at IS NULL`,
      [facultyId]
    ),
  ]);

  for (const r of pendingAttendance) {
    tasks.push({
      id: `attendance-${r.subjectId}-${r.section}`,
      type: 'attendance',
      title: `Take attendance for ${r.subjectCode} - Section ${r.section}`,
      context: r.subjectName,
      priority: 'high',
      dueDate: null,
    });
  }

  for (const r of todayLessons.rows) {
    tasks.push({
      id: `lesson-${r.id}`,
      type: 'lesson',
      title: `Conduct lesson: ${r.topic_title} (${r.subject_code}, Week ${r.week_number})`,
      context: null,
      priority: 'high',
      dueDate: null,
    });
  }

  for (const r of todayQuizzes.rows) {
    tasks.push({
      id: `quiz-${r.id}`,
      type: 'quiz',
      title: `Conduct quiz: ${r.topic_title} (${r.subject_code})`,
      context: null,
      priority: 'medium',
      dueDate: null,
    });
  }

  for (const r of pendingEvaluations) {
    tasks.push({
      id: `evaluation-${r.assignmentId}`,
      type: 'evaluation',
      title: `Evaluate ${r.pendingCount} submission(s) for "${r.assignmentTitle}" (${r.subjectCode})`,
      context: null,
      priority: 'medium',
      dueDate: null,
    });
  }

  for (const r of todayMeetings.rows) {
    tasks.push({
      id: `mentor-meeting-${r.id}`,
      type: 'mentor_meeting',
      title: `Mentor meeting with ${r.student_name}`,
      context: r.title,
      priority: 'medium',
      dueDate: r.follow_up_date,
    });
  }

  for (const r of marksPending) {
    tasks.push({
      id: `result-entry-${r.examId}`,
      type: 'internal_marks',
      title: `Enter results for ${r.subjectCode} - ${r.examType} (Section ${r.section})`,
      context: null,
      priority: 'high',
      dueDate: null,
    });
  }

  for (const r of todayInvigilation.rows) {
    tasks.push({
      id: `invigilation-${r.id}`,
      type: 'invigilation',
      title: `Invigilate ${r.room_name} (${r.start_time}–${r.end_time})`,
      context: null,
      priority: 'high',
      dueDate: null,
    });
  }

  return tasks;
}
