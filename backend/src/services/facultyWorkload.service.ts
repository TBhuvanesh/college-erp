import { query } from '../config/database';
import { getStudentsByMentor } from './mentorship.service';
import { getFacultyCoreByUserId } from '../registries/facultyRegistry.service';
import * as roadmapService from './teachingPlanRoadmap.service';
import { getPendingAttendanceSections, getPendingResultEntries, getPendingEvaluations } from './facultyDailyStatus.service';
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
  const faculty = await getFacultyCoreByUserId(userId);
  return faculty.id;
}

export async function calculateFacultyWorkload(userId: string, facultyId: string): Promise<FacultyWorkload> {
  const [
    facultyRow,
    subjectsRes,
    totalMinutesRes,
    weeklyRes,
    monthlyRes,
    assignmentsCreatedRes,
    pendingEvaluationRows,
    materialsRes,
    mentees,
    meetingsRes,
    pendingAttendanceSections,
    pendingResultEntries,
    examDutiesRes,
    progress,
  ] = await Promise.all([
    query<{ full_name: string }>('SELECT full_name FROM faculty WHERE id = $1', [facultyId]),
    query<{ count: string }>(
      `SELECT COUNT(DISTINCT subject_id)::text AS count FROM teaching_assignments
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
    // Pending/upcoming submission counts derived from the shared per-assignment
    // resolver (facultyDailyStatus.service.ts) instead of a separate
    // aggregate query — same underlying rows facultyTasks.service.ts uses.
    getPendingEvaluations(facultyId),
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
    // Shared with facultyTasks.service.ts / facultyOperations.service.ts —
    // see facultyDailyStatus.service.ts.
    getPendingAttendanceSections(facultyId),
    getPendingResultEntries(facultyId),
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

  const in7Days = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const pendingReview = pendingEvaluationRows.reduce((sum, r) => sum + r.pendingCount, 0);
  const upcomingReview = pendingEvaluationRows
    .filter((r) => r.dueDate && new Date(r.dueDate).getTime() <= in7Days)
    .reduce((sum, r) => sum + r.pendingCount, 0);

  return {
    facultyId,
    facultyName: facultyRow.rows[0]?.full_name ?? '',
    teachingHours,
    subjectsAssigned: Number(subjectsRes.rows[0].count),
    weeklyClasses: Number(weeklyRes.rows[0].classes),
    monthlyClasses: Number(monthlyRes.rows[0].count),
    assignmentsCreated: Number(assignmentsCreatedRes.rows[0].count),
    assignmentsPendingReview: pendingReview,
    materialsUploaded: Number(materialsRes.rows[0].count),
    mentorshipStudents: mentees.length,
    upcomingEvaluations: upcomingReview,
    upcomingMeetings: Number(meetingsRes.rows[0].count),
    teachingPlannerProgress: progress.completionPercentage,
    attendancePending: pendingAttendanceSections.length,
    internalMarksPending: pendingResultEntries.length,
    examinationDuties: Number(examDutiesRes.rows[0].count),
    status: classifyWorkload(weeklyHours),
  };
}

export async function getOwnWorkload(userId: string): Promise<FacultyWorkload> {
  const facultyId = await resolveFacultyId(userId);
  return calculateFacultyWorkload(userId, facultyId);
}
