import { query } from '../config/database';
import type { FacultyTask } from '../types/facultyOperations';

// Every task here is generated fresh from live data — nothing is stored, so a
// task "disappears automatically when completed" simply because the query that
// produced it (e.g. "no attendance row for today") stops matching.

export async function generateTodayTasks(facultyId: string): Promise<FacultyTask[]> {
  const tasks: FacultyTask[] = [];

  const [pendingAttendance, todayLessons, todayQuizzes, pendingEvaluations, todayMeetings, marksPending, todayInvigilation] = await Promise.all([
    query<{ subject_id: string; subject_code: string; subject_name: string; section: string }>(
      `SELECT fsa.subject_id, s.code AS subject_code, s.name AS subject_name, fsa.section
       FROM faculty_subject_assignments fsa
       JOIN subjects s ON s.id = fsa.subject_id
       WHERE fsa.faculty_id = $1 AND fsa.is_active = TRUE AND fsa.deleted_at IS NULL AND s.deleted_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM attendance a WHERE a.subject_id = fsa.subject_id AND a.section = fsa.section
             AND a.faculty_id = $1 AND a.attendance_date = CURRENT_DATE
         )`,
      [facultyId]
    ),
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
    query<{ assignment_id: string; title: string; subject_code: string; pending: string }>(
      `SELECT a.id AS assignment_id, a.title, s.code AS subject_code, COUNT(asub.id)::text AS pending
       FROM assignments a
       JOIN subjects s ON s.id = a.subject_id
       JOIN assignment_submissions asub ON asub.assignment_id = a.id AND asub.deleted_at IS NULL
         AND asub.status IN ('Submitted', 'Late Submission')
       WHERE a.faculty_id = $1 AND a.deleted_at IS NULL
       GROUP BY a.id, a.title, s.code`,
      [facultyId]
    ),
    query<{ id: string; student_name: string; title: string; follow_up_date: string }>(
      `SELECT mn.id, s.full_name AS student_name, mn.title, TO_CHAR(mn.follow_up_date, 'YYYY-MM-DD') AS follow_up_date
       FROM mentoring_notes mn JOIN students s ON s.id = mn.student_id
       WHERE mn.mentor_id = $1 AND mn.deleted_at IS NULL AND mn.follow_up_date = CURRENT_DATE`,
      [facultyId]
    ),
    query<{ exam_id: string; subject_code: string; exam_type: string; section: string }>(
      `SELECT e.id AS exam_id, s.code AS subject_code, e.exam_type::text AS exam_type, e.section
       FROM exams e JOIN subjects s ON s.id = e.subject_id
       WHERE e.faculty_id = $1 AND e.status = 'Completed' AND e.exam_type IN ('Mid-1', 'Mid-2', 'Internal')
         AND e.exam_date >= CURRENT_DATE - INTERVAL '30 days' AND e.deleted_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM internal_marks im WHERE im.subject_id = e.subject_id AND im.section = e.section
             AND im.assessment_type::text = e.exam_type::text
         )`,
      [facultyId]
    ),
    query<{ id: string; room_name: string; start_time: string; end_time: string }>(
      `SELECT eid.id, er.name AS room_name, eid.start_time::text, eid.end_time::text
       FROM exam_invigilation_duties eid JOIN exam_rooms er ON er.id = eid.room_id
       WHERE eid.faculty_id = $1 AND eid.status = 'Assigned' AND eid.duty_date = CURRENT_DATE AND eid.deleted_at IS NULL`,
      [facultyId]
    ),
  ]);

  for (const r of pendingAttendance.rows) {
    tasks.push({
      id: `attendance-${r.subject_id}-${r.section}`,
      type: 'attendance',
      title: `Take attendance for ${r.subject_code} - Section ${r.section}`,
      context: r.subject_name,
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

  for (const r of pendingEvaluations.rows) {
    tasks.push({
      id: `evaluation-${r.assignment_id}`,
      type: 'evaluation',
      title: `Evaluate ${r.pending} submission(s) for "${r.title}" (${r.subject_code})`,
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

  for (const r of marksPending.rows) {
    tasks.push({
      id: `internal-marks-${r.exam_id}`,
      type: 'internal_marks',
      title: `Submit internal marks for ${r.subject_code} - ${r.exam_type} (Section ${r.section})`,
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
