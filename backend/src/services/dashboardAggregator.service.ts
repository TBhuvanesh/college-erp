import { query } from '../config/database';
import { withTtlCache } from '../utils/ttlCache';

// 30s TTL — these are the highest-read, lowest-volatility aggregations in
// the whole backend (institution-wide counts change by at most a handful of
// rows per minute even under heavy admin activity), invalidated implicitly
// by expiry rather than by event (the counts drift by a few rows at most
// during the TTL window, which is an acceptable staleness/latency tradeoff
// for a dashboard, not a source of truth).
const CACHE_TTL_MS = 30_000;

// Dashboard Aggregator (ERP Integration Sprint, Phase 5) — dashboard.service.ts
// composes its admin/HOD/faculty/student views from these named aggregation
// functions plus the existing domain services (attendance.service.ts,
// fee.service.ts, result.service.ts, examination.service.ts,
// mentorship.service.ts, feedback.service.ts) instead of inlining raw SQL
// for the institution-wide counters directly in the dashboard function body.
// This is a pure extraction — every query here is byte-for-byte the same
// SQL dashboard.service.ts ran before, just named and callable independently
// (and independently testable/cacheable — see Phase 6).

export interface InstitutionCounts {
  totalStudents: number;
  totalFaculty: number;
  totalSubjects: number;
  totalDepartments: number;
  totalAnnouncements: number;
  totalCalendarEvents: number;
  totalExaminations: number;
  totalFeeRecords: number;
  totalMaterials: number;
  totalLmsAssignments: number;
  totalSubmissions: number;
  lmsActiveAssignments: number;
  activeOpportunities: number;
  internshipPosts: number;
  placementDrives: number;
  upcomingWorkshops: number;
  totalNotifications: number;
}

export async function getInstitutionCounts(): Promise<InstitutionCounts> {
  return withTtlCache('dashboard:institutionCounts', CACHE_TTL_MS, () => computeInstitutionCounts());
}

async function computeInstitutionCounts(): Promise<InstitutionCounts> {
  const { rows } = await query<{
    total_students: number;
    total_faculty: number;
    total_subjects: number;
    total_departments: number;
    total_announcements: number;
    total_calendar_events: number;
    total_examinations: number;
    total_fee_records: number;
    total_materials: number;
    total_lms_assignments: number;
    total_submissions: number;
    lms_active_assignments: number;
    active_opportunities: number;
    internship_posts: number;
    placement_drives: number;
    upcoming_workshops: number;
    total_notifications: number;
  }>(`
    SELECT
      (SELECT COUNT(*)::int FROM students            WHERE deleted_at IS NULL)                                           AS total_students,
      (SELECT COUNT(*)::int FROM faculty             WHERE deleted_at IS NULL)                                           AS total_faculty,
      (SELECT COUNT(*)::int FROM subjects            WHERE deleted_at IS NULL)                                           AS total_subjects,
      (SELECT COUNT(*)::int FROM departments         WHERE deleted_at IS NULL)                                           AS total_departments,
      (SELECT COUNT(*)::int FROM announcements       WHERE deleted_at IS NULL)                                           AS total_announcements,
      (SELECT COUNT(*)::int FROM academic_calendar_events
                                                     WHERE deleted_at IS NULL AND publish_status != 'Archived')         AS total_calendar_events,
      (SELECT COUNT(*)::int FROM exams               WHERE deleted_at IS NULL)                                           AS total_examinations,
      (SELECT COUNT(*)::int FROM fees                WHERE deleted_at IS NULL)                                           AS total_fee_records,
      (SELECT COUNT(*)::int FROM course_materials    WHERE deleted_at IS NULL)                                           AS total_materials,
      (SELECT COUNT(*)::int FROM assignments         WHERE deleted_at IS NULL)                                           AS total_lms_assignments,
      (SELECT COUNT(*)::int FROM assignment_submissions WHERE deleted_at IS NULL)                                        AS total_submissions,
      (SELECT COUNT(*)::int FROM assignments         WHERE deleted_at IS NULL AND due_date >= NOW())                     AS lms_active_assignments,
      (SELECT COUNT(*)::int FROM opportunities       WHERE deleted_at IS NULL AND status = 'Active')                     AS active_opportunities,
      (SELECT COUNT(*)::int FROM opportunities       WHERE deleted_at IS NULL AND status = 'Active'
                                                       AND type = 'Internship')                                         AS internship_posts,
      (SELECT COUNT(*)::int FROM opportunities       WHERE deleted_at IS NULL AND status = 'Active'
                                                       AND type = 'Placement Drive')                                    AS placement_drives,
      (SELECT COUNT(*)::int FROM opportunities       WHERE deleted_at IS NULL AND status = 'Active'
                                                       AND type IN ('Workshop', 'Seminar')
                                                       AND (start_date IS NULL OR start_date >= CURRENT_DATE))          AS upcoming_workshops,
      (SELECT COUNT(*)::int FROM notifications       WHERE deleted_at IS NULL)                                           AS total_notifications
  `);
  const c = rows[0];
  return {
    totalStudents: Number(c.total_students) || 0,
    totalFaculty: Number(c.total_faculty) || 0,
    totalSubjects: Number(c.total_subjects) || 0,
    totalDepartments: Number(c.total_departments) || 0,
    totalAnnouncements: Number(c.total_announcements) || 0,
    totalCalendarEvents: Number(c.total_calendar_events) || 0,
    totalExaminations: Number(c.total_examinations) || 0,
    totalFeeRecords: Number(c.total_fee_records) || 0,
    totalMaterials: Number(c.total_materials) || 0,
    totalLmsAssignments: Number(c.total_lms_assignments) || 0,
    totalSubmissions: Number(c.total_submissions) || 0,
    lmsActiveAssignments: Number(c.lms_active_assignments) || 0,
    activeOpportunities: Number(c.active_opportunities) || 0,
    internshipPosts: Number(c.internship_posts) || 0,
    placementDrives: Number(c.placement_drives) || 0,
    upcomingWorkshops: Number(c.upcoming_workshops) || 0,
    totalNotifications: Number(c.total_notifications) || 0,
  };
}

export interface FeeTotals {
  totalBilled: number;
  totalCollected: number;
  totalOutstanding: number;
}

export async function getFeeTotals(): Promise<FeeTotals> {
  return withTtlCache('dashboard:feeTotals', CACHE_TTL_MS, () => computeFeeTotals());
}

async function computeFeeTotals(): Promise<FeeTotals> {
  const { rows } = await query<{ total_billed: string; total_collected: string; total_outstanding: string }>(`
    SELECT
      COALESCE(SUM(total_amount),   0) AS total_billed,
      COALESCE(SUM(paid_amount),    0) AS total_collected,
      COALESCE(SUM(pending_amount), 0) AS total_outstanding
    FROM fees
    WHERE deleted_at IS NULL
  `);
  return {
    totalBilled: Number(rows[0].total_billed) || 0,
    totalCollected: Number(rows[0].total_collected) || 0,
    totalOutstanding: Number(rows[0].total_outstanding) || 0,
  };
}

export interface CampusAttendanceSummary {
  totalRecords: number;
  totalPresent: number;
}

export async function getCampusAttendanceSummary(): Promise<CampusAttendanceSummary> {
  const { rows } = await query<{ total_records: number; total_present: number }>(`
    SELECT
      COUNT(*)::int                                    AS total_records,
      COUNT(*) FILTER (WHERE status = 'present')::int AS total_present
    FROM attendance
  `);
  return { totalRecords: Number(rows[0].total_records) || 0, totalPresent: Number(rows[0].total_present) || 0 };
}

export interface ExaminationStatusBreakdown {
  scheduled: number;
  ongoing: number;
  completed: number;
  cancelled: number;
  total: number;
}

export async function getExaminationStatusBreakdown(): Promise<ExaminationStatusBreakdown> {
  return withTtlCache('dashboard:examBreakdown', CACHE_TTL_MS, () => computeExaminationStatusBreakdown());
}

async function computeExaminationStatusBreakdown(): Promise<ExaminationStatusBreakdown> {
  const { rows } = await query<{ scheduled: number; ongoing: number; completed: number; cancelled: number; total: number }>(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'Cancelled')::int AS cancelled,
      COUNT(*) FILTER (WHERE status != 'Cancelled' AND status != 'Archived' AND NOW() < (exam_date + start_time))::int AS scheduled,
      COUNT(*) FILTER (WHERE status != 'Cancelled' AND status != 'Archived' AND NOW() >= (exam_date + start_time) AND NOW() < (exam_date + end_time))::int AS ongoing,
      COUNT(*) FILTER (WHERE status != 'Cancelled' AND status != 'Archived' AND NOW() >= (exam_date + end_time))::int AS completed,
      COUNT(*)::int AS total
    FROM exams
    WHERE deleted_at IS NULL
  `);
  return {
    scheduled: Number(rows[0].scheduled) || 0,
    ongoing: Number(rows[0].ongoing) || 0,
    completed: Number(rows[0].completed) || 0,
    cancelled: Number(rows[0].cancelled) || 0,
    total: Number(rows[0].total) || 0,
  };
}
