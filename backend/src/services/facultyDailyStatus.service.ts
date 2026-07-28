import { query } from '../config/database';

// Shared resolver for "what does this faculty member currently owe" —
// previously computed three separate ways in facultyTasks.service.ts,
// facultyWorkload.service.ts, and facultyOperations.service.ts (identical
// or near-identical SQL against the same tables). Each of those three now
// calls the functions below instead of re-querying attendance/
// result_entry_tasks/assignment_submissions directly, so there is exactly
// one place that defines "pending attendance for today," "pending result
// entry," and "pending assignment evaluation."

export interface PendingAttendanceSection {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  section: string;
}

export async function getPendingAttendanceSections(facultyId: string): Promise<PendingAttendanceSection[]> {
  const { rows } = await query<{ subject_id: string; subject_code: string; subject_name: string; section: string }>(
    `SELECT ta.subject_id, s.code AS subject_code, s.name AS subject_name, ta.section
     FROM teaching_assignments ta
     JOIN subjects s ON s.id = ta.subject_id
     WHERE ta.faculty_id = $1 AND ta.is_active = TRUE AND ta.deleted_at IS NULL AND s.deleted_at IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM attendance a WHERE a.subject_id = ta.subject_id AND a.section = ta.section
           AND a.faculty_id = $1 AND a.attendance_date = CURRENT_DATE
       )`,
    [facultyId]
  );
  return rows.map((r) => ({
    subjectId: r.subject_id,
    subjectCode: r.subject_code,
    subjectName: r.subject_name,
    section: r.section,
  }));
}

export interface PendingResultEntry {
  examId: string;
  subjectCode: string;
  examType: string;
  section: string;
}

// Sourced from result_entry_tasks — the single source of truth for "marks
// pending," created automatically when an exam reaches Scripts Distributed
// and resolved through the faculty's Teaching Assignment (see
// examination.service.ts / resultEntryTask.service.ts).
export async function getPendingResultEntries(facultyId: string): Promise<PendingResultEntry[]> {
  const { rows } = await query<{ exam_id: string; subject_code: string; exam_type: string; section: string }>(
    `SELECT ret.exam_id, s.code AS subject_code, e.exam_type::text AS exam_type, ta.section
     FROM result_entry_tasks ret
     JOIN teaching_assignments ta ON ta.id = ret.teaching_assignment_id
     JOIN subjects s ON s.id = ta.subject_id
     JOIN exams e ON e.id = ret.exam_id
     WHERE ret.faculty_id = $1 AND ret.deleted_at IS NULL
       AND ret.status NOT IN ('published', 'closed')`,
    [facultyId]
  );
  return rows.map((r) => ({ examId: r.exam_id, subjectCode: r.subject_code, examType: r.exam_type, section: r.section }));
}

export interface PendingEvaluation {
  assignmentId: string;
  assignmentTitle: string;
  subjectCode: string;
  pendingCount: number;
  dueDate: Date;
}

export async function getPendingEvaluations(facultyId: string): Promise<PendingEvaluation[]> {
  const { rows } = await query<{
    assignment_id: string;
    assignment_title: string;
    subject_code: string;
    pending_count: string;
    due_date: Date;
  }>(
    `SELECT a.id AS assignment_id, a.title AS assignment_title, s.code AS subject_code,
            COUNT(asub.id)::text AS pending_count, a.due_date
     FROM assignments a
     JOIN subjects s ON s.id = a.subject_id
     JOIN assignment_submissions asub ON asub.assignment_id = a.id AND asub.deleted_at IS NULL
       AND asub.status IN ('Submitted', 'Late Submission')
     WHERE a.faculty_id = $1 AND a.deleted_at IS NULL
     GROUP BY a.id, a.title, s.code, a.due_date
     ORDER BY pending_count DESC`,
    [facultyId]
  );
  return rows.map((r) => ({
    assignmentId: r.assignment_id,
    assignmentTitle: r.assignment_title,
    subjectCode: r.subject_code,
    pendingCount: Number(r.pending_count),
    dueDate: r.due_date,
  }));
}
