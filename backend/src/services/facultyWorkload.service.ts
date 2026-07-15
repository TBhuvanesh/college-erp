import { query } from '../config/database';
import { AppError } from '../errors/AppError';
import { getStudentsByMentor } from './mentorship.service';
import * as roadmapService from './teachingPlanRoadmap.service';
import type { FacultyWorkload, WorkloadStatus } from '../types/facultyOperations';

// Weekly-teaching-hours thresholds driving the Light/Balanced/Heavy/Overloaded
// classification — the standard academic workload proxy. Kept as named
// constants (not buried magic numbers) so they're the obvious place to make
// this configurable later without touching the calculation logic.
const WORKLOAD_THRESHOLDS = { light: 10, balanced: 18, heavy: 24 };

function classifyWorkload(weeklyHours: number): WorkloadStatus {
  if (weeklyHours < WORKLOAD_THRESHOLDS.light) return 'Light';
  if (weeklyHours < WORKLOAD_THRESHOLDS.balanced) return 'Balanced';
  if (weeklyHours < WORKLOAD_THRESHOLDS.heavy) return 'Heavy';
  return 'Overloaded';
}

export async function resolveFacultyId(userId: string): Promise<string> {
  const { rows } = await query<{ id: string }>(
    'SELECT id FROM faculty WHERE user_id = $1 AND deleted_at IS NULL',
    [userId]
  );
  if (!rows[0]) throw AppError.forbidden('No faculty profile is linked to this account');
  return rows[0].id;
}

export async function calculateFacultyWorkload(userId: string, facultyId: string): Promise<FacultyWorkload> {
  const [
    facultyRow,
    subjectsRes,
    totalMinutesRes,
    weeklyRes,
    monthlyRes,
    assignmentsCreatedRes,
    reviewRes,
    materialsRes,
    mentees,
    meetingsRes,
    attendancePendingRes,
    internalMarksPendingRes,
    examDutiesRes,
    progress,
  ] = await Promise.all([
    query<{ full_name: string }>('SELECT full_name FROM faculty WHERE id = $1', [facultyId]),
    query<{ count: string }>(
      `SELECT COUNT(DISTINCT subject_id)::text AS count FROM faculty_subject_assignments
       WHERE faculty_id = $1 AND is_active = TRUE AND deleted_at IS NULL`,
      [facultyId]
    ),
    query<{ minutes: string }>(
      `SELECT COALESCE(SUM(estimated_duration), 0)::text AS minutes FROM teaching_plans
       WHERE faculty_id = $1 AND lesson_status != 'Cancelled' AND deleted_at IS NULL`,
      [facultyId]
    ),
    query<{ classes: string; minutes: string }>(
      `SELECT COUNT(*)::text AS classes, COALESCE(SUM(estimated_duration), 0)::text AS minutes
       FROM teaching_plans
       WHERE faculty_id = $1 AND lesson_status != 'Cancelled' AND deleted_at IS NULL
         AND lesson_date >= date_trunc('week', CURRENT_DATE)
         AND lesson_date <  date_trunc('week', CURRENT_DATE) + INTERVAL '7 days'`,
      [facultyId]
    ),
    query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM teaching_plans
       WHERE faculty_id = $1 AND lesson_status != 'Cancelled' AND deleted_at IS NULL
         AND lesson_date >= date_trunc('month', CURRENT_DATE)
         AND lesson_date <  date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'`,
      [facultyId]
    ),
    query<{ count: string }>('SELECT COUNT(*)::text AS count FROM assignments WHERE faculty_id = $1 AND deleted_at IS NULL', [
      facultyId,
    ]),
    query<{ pending: string; upcoming: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE asub.status IN ('Submitted', 'Late Submission'))::text AS pending,
         COUNT(*) FILTER (WHERE asub.status IN ('Submitted', 'Late Submission') AND a.due_date <= NOW() + INTERVAL '7 days')::text AS upcoming
       FROM assignment_submissions asub
       JOIN assignments a ON a.id = asub.assignment_id
       WHERE a.faculty_id = $1 AND asub.deleted_at IS NULL`,
      [facultyId]
    ),
    query<{ count: string }>('SELECT COUNT(*)::text AS count FROM course_materials WHERE faculty_id = $1 AND deleted_at IS NULL', [
      facultyId,
    ]),
    getStudentsByMentor(facultyId),
    query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM mentoring_notes
       WHERE mentor_id = $1 AND deleted_at IS NULL
         AND follow_up_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '14 days'`,
      [facultyId]
    ),
    query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM faculty_subject_assignments fsa
       WHERE fsa.faculty_id = $1 AND fsa.is_active = TRUE AND fsa.deleted_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM attendance a
           WHERE a.subject_id = fsa.subject_id AND a.section = fsa.section
             AND a.faculty_id = $1 AND a.attendance_date = CURRENT_DATE
         )`,
      [facultyId]
    ),
    query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM exams e
       WHERE e.faculty_id = $1 AND e.status = 'Completed' AND e.exam_type IN ('Mid-1', 'Mid-2', 'Internal')
         AND e.exam_date >= CURRENT_DATE - INTERVAL '30 days' AND e.deleted_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM internal_marks im
           WHERE im.subject_id = e.subject_id AND im.section = e.section
             AND im.assessment_type::text = e.exam_type::text
         )`,
      [facultyId]
    ),
    query<{ count: string }>(
      `SELECT (
         (SELECT COUNT(*) FROM exams
          WHERE faculty_id = $1 AND status IN ('Scheduled', 'Ongoing') AND exam_date >= CURRENT_DATE AND deleted_at IS NULL)
         +
         (SELECT COUNT(*) FROM exam_invigilation_duties
          WHERE faculty_id = $1 AND status = 'Assigned' AND duty_date >= CURRENT_DATE AND deleted_at IS NULL)
       )::text AS count`,
      [facultyId]
    ),
    roadmapService.getCourseProgress(userId, 'faculty', {}),
  ]);

  const weeklyHours = Math.round((Number(weeklyRes.rows[0].minutes) / 60) * 100) / 100;
  const teachingHours = Math.round((Number(totalMinutesRes.rows[0].minutes) / 60) * 100) / 100;

  return {
    facultyId,
    facultyName: facultyRow.rows[0]?.full_name ?? '',
    teachingHours,
    subjectsAssigned: Number(subjectsRes.rows[0].count),
    weeklyClasses: Number(weeklyRes.rows[0].classes),
    monthlyClasses: Number(monthlyRes.rows[0].count),
    assignmentsCreated: Number(assignmentsCreatedRes.rows[0].count),
    assignmentsPendingReview: Number(reviewRes.rows[0].pending),
    materialsUploaded: Number(materialsRes.rows[0].count),
    mentorshipStudents: mentees.length,
    upcomingEvaluations: Number(reviewRes.rows[0].upcoming),
    upcomingMeetings: Number(meetingsRes.rows[0].count),
    teachingPlannerProgress: progress.completionPercentage,
    attendancePending: Number(attendancePendingRes.rows[0].count),
    internalMarksPending: Number(internalMarksPendingRes.rows[0].count),
    examinationDuties: Number(examDutiesRes.rows[0].count),
    status: classifyWorkload(weeklyHours),
  };
}

export async function getOwnWorkload(userId: string): Promise<FacultyWorkload> {
  const facultyId = await resolveFacultyId(userId);
  return calculateFacultyWorkload(userId, facultyId);
}
