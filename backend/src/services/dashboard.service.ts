import { query } from '../config/database';
import { AppError } from '../errors/AppError';
import { getStudentSummary } from './attendance.service';
import { getStudentDues, ensureAllStudentsHaveFees } from './fee.service';
import { getStudentResults } from './result.service';
import { getStudentTimetable } from './examination.service';
import { listRoomsWithAvailability } from './resourceAvailability.service';
import { getMentorshipAnalytics } from './analytics.service';
import { getMentorDashboard } from './mentorship.service';
import { getMentorGroups } from './mentorGroup.service';
import * as feedbackService from './feedback.service';

// ── Exam Seating & Invigilation admin widget — reused by both the admin and
// HOD dashboards (HOD scoped to their own department's sessions). ────────────
async function getExamSeatingOverview(departmentId: string | null) {
  const params: unknown[] = [];
  let deptFilter = '';
  if (departmentId) {
    params.push(departmentId);
    deptFilter = `AND $${params.length}::uuid = ANY(es.department_ids)`;
  }

  const { rows: statusRows } = await query<{ status: string; count: string; conflicts: string }>(
    `SELECT es.status::text AS status, COUNT(*)::text AS count, COALESCE(SUM(es.last_conflict_count), 0)::text AS conflicts
     FROM exam_sessions es WHERE es.deleted_at IS NULL ${deptFilter}
     GROUP BY es.status`,
    params
  );

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const nowTime = now.toISOString().slice(11, 16);
  const nowPlus = new Date(now.getTime() + 60000).toISOString().slice(11, 16);
  const roomAvailability = await listRoomsWithAvailability(today, nowTime, nowPlus, { isActive: true });

  const byStatus: Record<string, number> = {};
  let conflictCount = 0;
  for (const r of statusRows) {
    byStatus[r.status] = Number(r.count);
    conflictCount += Number(r.conflicts);
  }

  return {
    draftSessions: byStatus['draft'] ?? 0,
    generatedSessions: byStatus['generated'] ?? 0,
    validatedSessions: byStatus['validated'] ?? 0,
    publishedSessions: byStatus['published'] ?? 0,
    completedSessions: byStatus['completed'] ?? 0,
    archivedSessions: byStatus['archived'] ?? 0,
    conflictCount,
    availableRooms: roomAvailability.filter((r) => r.state === 'available').length,
    occupiedRooms: roomAvailability.filter((r) => r.state === 'occupied').length,
    maintenanceRooms: roomAvailability.filter((r) => r.state === 'maintenance').length,
  };
}

// ── Feedback Campaign overview — eligibility-driven, reused by admin, HOD,
// faculty and student dashboards. Denominators are always eligible students
// (never total students), per the eligibility-driven refactor. Aggregation
// logic lives in feedback.service.ts and is shared with analytics.service.ts. ──
const getFeedbackOverviewForAdmin = feedbackService.getInstitutionFeedbackAnalytics;
const getFeedbackOverviewForFaculty = feedbackService.getFacultyFeedbackAnalytics;

async function getFeedbackOverviewForStudent(userId: string) {
  const views = await feedbackService.getEligibleCampaignsForStudent(userId);
  const pending = views.filter((v) => !v.completed);
  const nextDeadline = pending.length > 0
    ? pending.reduce((min, v) => (v.endDate < min ? v.endDate : min), pending[0].endDate)
    : null;

  return {
    pendingCount: pending.length,
    nextDeadline,
    campaigns: views.map((v) => ({
      campaignId: v.campaignId,
      title: v.title,
      status: v.status,
      endDate: v.endDate,
      completed: v.completed,
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

export async function getAdminDashboardStats(userId: string) {
  const [
    countsRes,
    feeRes,
    attRes,
    examRes,
    notifRes,
    studentsRes,
    facultyRes,
    opportunitiesRes,
    annRes,
    eventsRes,
    activityRes,
  ] = await Promise.all([

    // ── All scalar counts in one round-trip ───────────────────────────────────
    query<{
      total_students:         number;
      total_faculty:          number;
      total_subjects:         number;
      total_departments:      number;
      total_announcements:    number;
      total_calendar_events:  number;
      total_examinations:     number;
      total_fee_records:      number;
      total_materials:        number;
      total_lms_assignments:  number;
      total_submissions:      number;
      lms_active_assignments: number;
      active_opportunities:   number;
      internship_posts:       number;
      placement_drives:       number;
      upcoming_workshops:     number;
      total_notifications:    number;
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
    `),

    // ── Fee totals ────────────────────────────────────────────────────────────
    query<{ total_billed: string; total_collected: string; total_outstanding: string }>(`
      SELECT
        COALESCE(SUM(total_amount),   0) AS total_billed,
        COALESCE(SUM(paid_amount),    0) AS total_collected,
        COALESCE(SUM(pending_amount), 0) AS total_outstanding
      FROM fees
      WHERE deleted_at IS NULL
    `),

    // ── Campus-wide attendance summary ────────────────────────────────────────
    query<{ total_records: number; total_present: number }>(`
      SELECT
        COUNT(*)::int                                    AS total_records,
        COUNT(*) FILTER (WHERE status = 'present')::int AS total_present
      FROM attendance
    `),

    // ── Examination status breakdown ──────────────────────────────────────────
    query<{ scheduled: number; ongoing: number; completed: number; cancelled: number; total: number }>(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'Scheduled')::int AS scheduled,
        COUNT(*) FILTER (WHERE status = 'Ongoing')::int   AS ongoing,
        COUNT(*) FILTER (WHERE status = 'Completed')::int AS completed,
        COUNT(*) FILTER (WHERE status = 'Cancelled')::int AS cancelled,
        COUNT(*)::int                                      AS total
      FROM exams
      WHERE deleted_at IS NULL
    `),

    // ── Admin notification unread count ───────────────────────────────────────
    query<{ total: string; unread: string }>(`
      SELECT
        COUNT(*)::int                              AS total,
        COUNT(*) FILTER (WHERE nr.id IS NULL)::int AS unread
      FROM notifications n
      LEFT JOIN notification_reads nr ON nr.notification_id = n.id AND nr.user_id = $1
      WHERE n.deleted_at IS NULL
        AND n.target_role IN ('all', 'admin')
    `, [userId]),

    // ── Recent student registrations ──────────────────────────────────────────
    query<{
      id: string; full_name: string; roll_number: string;
      department_code: string; semester: number; academic_year: string;
      created_at: Date;
    }>(`
      SELECT s.id, s.full_name, s.roll_number, d.code AS department_code,
             s.semester, s.academic_year, s.created_at
      FROM students s
      JOIN departments d ON d.id = s.department_id
      WHERE s.deleted_at IS NULL
      ORDER BY s.created_at DESC
      LIMIT 5
    `),

    // ── Recent faculty additions ──────────────────────────────────────────────
    query<{
      id: string; full_name: string; employee_number: string;
      department_name: string; designation: string; created_at: Date;
    }>(`
      SELECT f.id, f.full_name, f.employee_number, d.name AS department_name,
             f.designation, f.created_at
      FROM faculty f
      JOIN departments d ON d.id = f.department_id
      WHERE f.deleted_at IS NULL
      ORDER BY f.created_at DESC
      LIMIT 5
    `),

    // ── Recent opportunities ──────────────────────────────────────────────────
    query<{
      id: string; title: string; type: string; status: string;
      created_at: Date; deadline: Date | null;
    }>(`
      SELECT id, title, type, status, created_at, deadline
      FROM opportunities
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 5
    `),

    // ── Latest published announcements ────────────────────────────────────────
    query<{ id: string; title: string; priority: string; target_audience: string; publish_date: string }>(`
      SELECT id, title, priority, target_audience,
             TO_CHAR(publish_date, 'YYYY-MM-DD') AS publish_date
      FROM announcements
      WHERE deleted_at IS NULL AND status = 'Published'
      ORDER BY
        CASE priority WHEN 'Urgent' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END,
        publish_date DESC, created_at DESC
      LIMIT 3
    `),

    // ── Upcoming academic calendar events ─────────────────────────────────────
    query<{ id: string; title: string; start_date: string; event_type: string }>(`
      SELECT id, title,
             TO_CHAR(start_date, 'YYYY-MM-DD') AS start_date,
             event_type
      FROM academic_calendar_events
      WHERE deleted_at IS NULL
        AND publish_status IN ('Published', 'Updated')
        AND start_date >= CURRENT_DATE
      ORDER BY start_date ASC
      LIMIT 5
    `),

    // ── Activity feed: recent cross-module actions ─────────────────────────────
    query<{
      activity_type: string;
      actor: string;
      description: string;
      context: string | null;
      occurred_at: Date;
    }>(`
      (
        SELECT 'student_registration' AS activity_type,
               s.full_name            AS actor,
               'Student registered: ' || s.roll_number AS description,
               d.name                 AS context,
               s.created_at           AS occurred_at
        FROM students s
        JOIN departments d ON d.id = s.department_id
        WHERE s.deleted_at IS NULL
      )
      UNION ALL
      (
        SELECT 'faculty_addition' AS activity_type,
               f.full_name        AS actor,
               'Faculty added: '  || f.employee_number AS description,
               d.name             AS context,
               f.created_at       AS occurred_at
        FROM faculty f
        JOIN departments d ON d.id = f.department_id
        WHERE f.deleted_at IS NULL
      )
      UNION ALL
      (
        SELECT 'opportunity_post'   AS activity_type,
               u.full_name          AS actor,
               o.type || ' posted: ' || o.title AS description,
               NULL                 AS context,
               o.created_at         AS occurred_at
        FROM opportunities o
        JOIN users u ON u.id = o.created_by
        WHERE o.deleted_at IS NULL
      )
      UNION ALL
      (
        SELECT 'lms_assignment'         AS activity_type,
               f.full_name              AS actor,
               'Assignment created: '   || a.title AS description,
               NULL                     AS context,
               a.created_at             AS occurred_at
        FROM assignments a
        JOIN faculty f ON f.id = a.faculty_id
        WHERE a.deleted_at IS NULL
      )
      UNION ALL
      (
        SELECT 'material_upload'      AS activity_type,
               f.full_name            AS actor,
               'Material uploaded: '  || cm.title AS description,
               NULL                   AS context,
               cm.created_at          AS occurred_at
        FROM course_materials cm
        JOIN faculty f ON f.id = cm.faculty_id
        WHERE cm.deleted_at IS NULL
      )
      UNION ALL
      (
        SELECT 'calendar_publication' AS activity_type,
               u.full_name            AS actor,
               'Calendar event: '     || ace.title AS description,
               NULL                   AS context,
               ace.created_at         AS occurred_at
        FROM academic_calendar_events ace
        JOIN users u ON u.id = ace.created_by
        WHERE ace.deleted_at IS NULL
      )
      ORDER BY occurred_at DESC
      LIMIT 10
    `),
  ]);

  const c = countsRes.rows[0];
  const f = feeRes.rows[0];
  const a = attRes.rows[0];
  const e = examRes.rows[0];
  const n = notifRes.rows[0];

  const totalRecords = Number(a?.total_records) || 0;
  const totalPresent = Number(a?.total_present) || 0;
  const examSeatingOverview = await getExamSeatingOverview(null);
  const mentorshipOverview = await getMentorshipAnalytics(null);
  const feedbackOverview = await getFeedbackOverviewForAdmin(null);

  return {
    examSeatingOverview,
    mentorshipOverview,
    feedbackOverview,
    institutionOverview: {
      totalStudents:    Number(c.total_students)    || 0,
      totalFaculty:     Number(c.total_faculty)     || 0,
      totalSubjects:    Number(c.total_subjects)    || 0,
      totalDepartments: Number(c.total_departments) || 0,
    },
    academicOverview: {
      upcomingExaminations:  Number(e.scheduled)           || 0,
      upcomingCalendarEvents: eventsRes.rows.length,
      attendanceSummary: {
        totalRecords,
        totalPresent,
        averagePercentage: totalRecords > 0
          ? Math.round((totalPresent / totalRecords) * 10000) / 100
          : 0,
      },
    },
    examinationBreakdown: {
      scheduled: Number(e.scheduled) || 0,
      ongoing:   Number(e.ongoing)   || 0,
      completed: Number(e.completed) || 0,
      cancelled: Number(e.cancelled) || 0,
      total:     Number(e.total)     || 0,
    },
    feeStatistics: {
      totalBilled:      parseFloat(f.total_billed)      || 0,
      totalCollected:   parseFloat(f.total_collected)   || 0,
      totalOutstanding: parseFloat(f.total_outstanding) || 0,
      totalRecords:     Number(c.total_fee_records)     || 0,
    },
    lmsOverview: {
      totalMaterials:    Number(c.total_materials)        || 0,
      totalAssignments:  Number(c.total_lms_assignments)  || 0,
      totalSubmissions:  Number(c.total_submissions)      || 0,
      activeAssignments: Number(c.lms_active_assignments) || 0,
    },
    opportunityHubOverview: {
      activeOpportunities: Number(c.active_opportunities) || 0,
      internshipPosts:     Number(c.internship_posts)     || 0,
      placementDrives:     Number(c.placement_drives)     || 0,
      upcomingWorkshops:   Number(c.upcoming_workshops)   || 0,
    },
    notificationOverview: {
      totalNotifications: Number(c.total_notifications) || 0,
      unreadNotifications: Number(n?.unread)            || 0,
    },
    upcomingEvents: eventsRes.rows.map((r) => ({
      id:        r.id,
      title:     r.title,
      startDate: r.start_date,
      eventType: r.event_type,
    })),
    recentAnnouncements: annRes.rows.map((r) => ({
      id:             r.id,
      title:          r.title,
      priority:       r.priority,
      targetAudience: r.target_audience,
      publishDate:    r.publish_date,
    })),
    recentStudents: studentsRes.rows.map((r) => ({
      id:             r.id,
      fullName:       r.full_name,
      rollNumber:     r.roll_number,
      departmentCode: r.department_code,
      semester:       Number(r.semester),
      academicYear:   r.academic_year,
      createdAt:      r.created_at,
    })),
    recentFaculty: facultyRes.rows.map((r) => ({
      id:             r.id,
      fullName:       r.full_name,
      employeeNumber: r.employee_number,
      departmentName: r.department_name,
      designation:    r.designation,
      createdAt:      r.created_at,
    })),
    recentOpportunities: opportunitiesRes.rows.map((r) => ({
      id:       r.id,
      title:    r.title,
      type:     r.type,
      status:   r.status,
      deadline: r.deadline,
    })),
    activityFeed: activityRes.rows.map((r) => ({
      activityType: r.activity_type,
      actor:        r.actor,
      description:  r.description,
      context:      r.context,
      occurredAt:   r.occurred_at,
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FACULTY DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

export async function getFacultyDashboardStats(userId: string) {
  const { rows: profileRows } = await query<{
    id: string;
    full_name: string;
    employee_number: string;
    department_name: string;
    department_id: string;
    designation: string;
    status: string;
  }>(`
    SELECT f.id, f.full_name, f.employee_number, f.designation, f.status,
           d.name AS department_name, d.id AS department_id
    FROM faculty f
    JOIN departments d ON d.id = f.department_id
    WHERE f.user_id = $1 AND f.deleted_at IS NULL
  `, [userId]);

  if (!profileRows[0]) throw AppError.forbidden('No faculty profile is linked to this account');

  const { id: facultyId, department_id: departmentId } = profileRows[0];

  const [
    assignmentsRes,
    lmsCountRes,
    recentSubmissionsRes,
    upcomingExamsRes,
    notifRes,
    annRes,
    eventsRes,
  ] = await Promise.all([

    // ── Active subject assignments ─────────────────────────────────────────────
    query<{
      assignment_id: string;
      subject_id: string;
      subject_code: string;
      subject_name: string;
      section: string;
      semester: number;
      academic_year: string;
      attendance_logged_today: boolean;
      marks_submitted: boolean;
    }>(`
      SELECT
        fsa.id        AS assignment_id,
        fsa.subject_id,
        s.code        AS subject_code,
        s.name        AS subject_name,
        fsa.section,
        s.semester,
        fsa.academic_year,
        EXISTS(
          SELECT 1 FROM attendance a
          WHERE a.faculty_id      = fsa.faculty_id
            AND a.subject_id      = fsa.subject_id
            AND a.section         = fsa.section
            AND a.attendance_date = CURRENT_DATE
        ) AS attendance_logged_today,
        EXISTS(
          SELECT 1 FROM results r
          WHERE r.faculty_id         = fsa.faculty_id
            AND r.subject_id         = fsa.subject_id
            AND r.section            = fsa.section
            AND r.publication_status = 'Published'
            AND r.deleted_at         IS NULL
        ) AS marks_submitted
      FROM faculty_subject_assignments fsa
      JOIN subjects s ON s.id = fsa.subject_id
      WHERE fsa.faculty_id = $1
        AND fsa.is_active  = true
        AND fsa.deleted_at IS NULL
      ORDER BY s.semester ASC, s.code ASC
    `, [facultyId]),

    // ── LMS counts for this faculty ───────────────────────────────────────────
    query<{
      active_lms_assignments: number;
      pending_evaluations:    number;
      total_materials:        number;
    }>(`
      SELECT
        (SELECT COUNT(*)::int FROM assignments a
         WHERE a.faculty_id = $1 AND a.deleted_at IS NULL AND a.due_date >= NOW())               AS active_lms_assignments,
        (SELECT COUNT(*)::int FROM assignment_submissions asub
         JOIN assignments a ON a.id = asub.assignment_id
         WHERE a.faculty_id = $1 AND asub.deleted_at IS NULL AND asub.status != 'Evaluated')    AS pending_evaluations,
        (SELECT COUNT(*)::int FROM course_materials cm
         WHERE cm.faculty_id = $1 AND cm.deleted_at IS NULL)                                    AS total_materials
    `, [facultyId]),

    // ── Recent submissions awaiting grading ───────────────────────────────────
    query<{
      id: string;
      assignment_title: string;
      student_name: string;
      roll_number: string;
      status: string;
      submitted_at: Date;
    }>(`
      SELECT asub.id,
             a.title       AS assignment_title,
             st.full_name  AS student_name,
             st.roll_number,
             asub.status,
             asub.submitted_at
      FROM assignment_submissions asub
      JOIN assignments a  ON a.id  = asub.assignment_id
      JOIN students    st ON st.id = asub.student_id
      WHERE a.faculty_id     = $1
        AND asub.deleted_at  IS NULL
        AND asub.status     != 'Evaluated'
      ORDER BY asub.submitted_at DESC
      LIMIT 5
    `, [facultyId]),

    // ── Upcoming exams ────────────────────────────────────────────────────────
    query<{
      id: string;
      subject_code: string;
      subject_name: string;
      section: string;
      semester: number;
      exam_type: string;
      exam_date: string;
      start_time: string;
      end_time: string;
      maximum_marks: string;
      status: string;
    }>(`
      SELECT e.id,
             sub.code AS subject_code,
             sub.name AS subject_name,
             e.section, e.semester, e.exam_type,
             TO_CHAR(e.exam_date,  'YYYY-MM-DD') AS exam_date,
             TO_CHAR(e.start_time, 'HH24:MI')    AS start_time,
             TO_CHAR(e.end_time,   'HH24:MI')    AS end_time,
             e.maximum_marks, e.status
      FROM exams e
      JOIN subjects sub ON sub.id = e.subject_id
      WHERE e.faculty_id = $1
        AND e.deleted_at IS NULL
        AND e.status     = 'Scheduled'
        AND e.exam_date >= CURRENT_DATE
      ORDER BY e.exam_date ASC, e.start_time ASC
      LIMIT 5
    `, [facultyId]),

    // ── Unread notification count ─────────────────────────────────────────────
    query<{ unread: string }>(`
      SELECT COUNT(*) FILTER (WHERE nr.id IS NULL)::int AS unread
      FROM notifications n
      LEFT JOIN notification_reads nr ON nr.notification_id = n.id AND nr.user_id = $1
      WHERE n.deleted_at IS NULL
        AND n.target_role IN ('all', 'faculty')
        AND (n.department_id IS NULL OR n.department_id = $2)
    `, [userId, departmentId]),

    // ── Announcements visible to this faculty ─────────────────────────────────
    query<{ id: string; title: string; priority: string; publish_date: string }>(`
      SELECT id, title, priority,
             TO_CHAR(publish_date, 'YYYY-MM-DD') AS publish_date
      FROM announcements
      WHERE deleted_at IS NULL
        AND status = 'Published'
        AND (
              target_audience = 'All'
          OR  target_audience = 'Faculty'
          OR (target_audience = 'Department Specific' AND department_id = $1)
        )
      ORDER BY
        CASE priority WHEN 'Urgent' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END,
        publish_date DESC, created_at DESC
      LIMIT 3
    `, [departmentId]),

    // ── Upcoming calendar events ──────────────────────────────────────────────
    query<{ id: string; title: string; start_date: string; event_type: string }>(`
      SELECT id, title,
             TO_CHAR(start_date, 'YYYY-MM-DD') AS start_date,
             event_type
      FROM academic_calendar_events
      WHERE deleted_at IS NULL
        AND publish_status IN ('Published', 'Updated')
        AND target_audience != 'Students'
        AND ($1::uuid IS NULL OR department_id IS NULL OR department_id = $1::uuid)
        AND start_date >= CURRENT_DATE
      ORDER BY start_date ASC
      LIMIT 5
    `, [departmentId]),
  ]);

  const assignments = assignmentsRes.rows.map((r) => ({
    assignmentId:          r.assignment_id,
    subjectId:             r.subject_id,
    subjectCode:           r.subject_code,
    subjectName:           r.subject_name,
    section:               r.section,
    semester:              Number(r.semester),
    academicYear:          r.academic_year,
    attendanceLoggedToday: Boolean(r.attendance_logged_today),
    marksSubmitted:        Boolean(r.marks_submitted),
  }));

  const lms = lmsCountRes.rows[0];

  const myMentorGroups = await getMentorGroups({ mentorId: facultyId });
  let mentorshipOverview = { myMentorGroups: 0, totalMentees: 0, upcomingMeetings: 0, studentsNeedingAttention: 0 };
  if (myMentorGroups.length > 0) {
    const [menteeDashboard, upcomingMeetingsRes] = await Promise.all([
      getMentorDashboard(userId),
      query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM mentoring_notes
         WHERE mentor_id = $1 AND follow_up_date >= CURRENT_DATE AND deleted_at IS NULL`,
        [facultyId]
      ),
    ]);
    mentorshipOverview = {
      myMentorGroups: myMentorGroups.length,
      totalMentees: menteeDashboard.length,
      upcomingMeetings: Number(upcomingMeetingsRes.rows[0]?.count ?? 0),
      studentsNeedingAttention: menteeDashboard.filter((s) => Object.values(s.alerts).some(Boolean)).length,
    };
  }

  const feedbackOverview = await getFeedbackOverviewForFaculty(facultyId);

  return {
    mentorshipOverview,
    feedbackOverview,
    profile: {
      id:             profileRows[0].id,
      fullName:       profileRows[0].full_name,
      employeeNumber: profileRows[0].employee_number,
      departmentName: profileRows[0].department_name,
      designation:    profileRows[0].designation,
      status:         profileRows[0].status,
    },
    teachingOverview: {
      assignedSubjects: assignments.length,
      assignedClasses:  assignments.map((a) => `${a.subjectCode}-${a.section}`),
    },
    assignedSubjects:  assignments,
    pendingAttendance: assignments.filter((a) => !a.attendanceLoggedToday),
    pendingMarks:      assignments.filter((a) => !a.marksSubmitted),
    lmsOverview: {
      activeAssignments:  Number(lms?.active_lms_assignments) || 0,
      pendingEvaluations: Number(lms?.pending_evaluations)    || 0,
      totalMaterials:     Number(lms?.total_materials)        || 0,
    },
    recentSubmissions: recentSubmissionsRes.rows.map((r) => ({
      id:              r.id,
      assignmentTitle: r.assignment_title,
      studentName:     r.student_name,
      rollNumber:      r.roll_number,
      status:          r.status,
      submittedAt:     r.submitted_at,
    })),
    upcomingExams: upcomingExamsRes.rows.map((r) => ({
      id:           r.id,
      subjectCode:  r.subject_code,
      subjectName:  r.subject_name,
      section:      r.section,
      semester:     Number(r.semester),
      examType:     r.exam_type,
      examDate:     r.exam_date,
      startTime:    r.start_time,
      endTime:      r.end_time,
      maximumMarks: parseFloat(r.maximum_marks),
      status:       r.status,
    })),
    notificationOverview: {
      unreadNotifications: Number(notifRes.rows[0]?.unread) || 0,
    },
    recentAnnouncements: annRes.rows.map((r) => ({
      id:          r.id,
      title:       r.title,
      priority:    r.priority,
      publishDate: r.publish_date,
    })),
    upcomingEvents: eventsRes.rows.map((r) => ({
      id:        r.id,
      title:     r.title,
      startDate: r.start_date,
      eventType: r.event_type,
    })),
    quickActions: [
      { label: 'Upload Material',   route: '/lms/materials/upload' },
      { label: 'Create Assignment', route: '/lms/assignments/create' },
      { label: 'Grade Submission',  route: '/lms/submissions' },
      { label: 'View Calendar',     route: '/calendar-entries' },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

function semesterToYearGroup(semester: number): string {
  if (semester <= 2) return 'I Year';
  if (semester <= 4) return 'II Year';
  if (semester <= 6) return 'III Year';
  return 'IV Year';
}

export async function getStudentDashboardStats(userId: string) {
  const { rows: profileRows } = await query<{
    id: string;
    full_name: string;
    roll_number: string;
    semester: number;
    section: string | null;
    academic_year: string;
    status: string;
    department_name: string;
    department_id: string;
    program_name: string;
    program_id: string;
  }>(`
    SELECT s.id, s.full_name, s.roll_number, s.semester, s.section,
           s.academic_year, s.status, s.program_id,
           d.name AS department_name, d.id AS department_id,
           p.name AS program_name
    FROM students s
    JOIN departments d ON d.id = s.department_id
    JOIN programs    p ON p.id = s.program_id
    WHERE s.user_id = $1 AND s.deleted_at IS NULL
  `, [userId]);

  if (!profileRows[0]) throw AppError.forbidden('No student profile is linked to this account');

  const { id: studentId, semester, department_id: departmentId, program_id: programId } = profileRows[0];
  const yearGroup = semesterToYearGroup(semester);

  const [
    attendanceSummary,
    feeDues,
    results,
    upcomingExams,
    lmsDeadlinesRes,
    recentMaterialsRes,
    feedbackRes,
    newOpportunitiesRes,
    internshipDeadlinesRes,
    placementDrivesRes,
    calendarRes,
    notifRes,
    annRes,
    eventsRes,
  ] = await Promise.all([
    getStudentSummary(userId),
    getStudentDues(userId),
    getStudentResults(userId),
    getStudentTimetable(userId, 'upcoming'),

    // ── Upcoming LMS assignment deadlines ─────────────────────────────────────
    query<{
      id: string;
      title: string;
      due_date: Date;
      max_marks: string;
      subject_code: string;
      subject_name: string;
      submission_status: string | null;
    }>(`
      SELECT a.id, a.title, a.due_date, a.max_marks,
             sub.code AS subject_code,
             sub.name AS subject_name,
             asub.status AS submission_status
      FROM assignments a
      JOIN subjects sub ON sub.id = a.subject_id
      JOIN subject_curriculum_mappings scm ON scm.subject_id = sub.id
      LEFT JOIN assignment_submissions asub
        ON asub.assignment_id = a.id AND asub.student_id = $1 AND asub.deleted_at IS NULL
      WHERE a.deleted_at IS NULL
        AND a.due_date >= NOW()
        AND scm.program_id = $2
        AND scm.semester   = $3
        AND scm.deleted_at IS NULL
      ORDER BY a.due_date ASC
      LIMIT 5
    `, [studentId, programId, semester]),

    // ── Recent study materials ────────────────────────────────────────────────
    query<{
      id: string;
      title: string;
      file_type: string;
      subject_code: string;
      subject_name: string;
      created_at: Date;
    }>(`
      SELECT cm.id, cm.title, cm.file_type,
             sub.code AS subject_code,
             sub.name AS subject_name,
             cm.created_at
      FROM course_materials cm
      JOIN subjects sub ON sub.id = cm.subject_id
      JOIN subject_curriculum_mappings scm ON scm.subject_id = sub.id
      WHERE cm.deleted_at IS NULL
        AND scm.program_id = $1
        AND scm.semester   = $2
        AND scm.deleted_at IS NULL
      ORDER BY cm.created_at DESC
      LIMIT 5
    `, [programId, semester]),

    // ── Graded submissions (feedback received) ────────────────────────────────
    query<{
      id: string;
      assignment_title: string;
      marks: string;
      max_marks: string;
      feedback: string | null;
      updated_at: Date;
    }>(`
      SELECT asub.id, a.title AS assignment_title,
             asub.marks, a.max_marks, asub.feedback, asub.updated_at
      FROM assignment_submissions asub
      JOIN assignments a ON a.id = asub.assignment_id
      WHERE asub.student_id = $1
        AND asub.deleted_at IS NULL
        AND asub.status     = 'Evaluated'
      ORDER BY asub.updated_at DESC
      LIMIT 5
    `, [studentId]),

    // ── New opportunities (last 7 days) ───────────────────────────────────────
    query<{
      id: string;
      title: string;
      type: string;
      deadline: Date | null;
      registration_link: string | null;
    }>(`
      SELECT id, title, type, deadline, registration_link
      FROM opportunities
      WHERE deleted_at IS NULL
        AND status = 'Active'
        AND (department_id IS NULL OR department_id = $1)
        AND (eligible_years IS NULL OR $2 = ANY(eligible_years))
        AND created_at >= NOW() - INTERVAL '7 days'
      ORDER BY created_at DESC
      LIMIT 5
    `, [departmentId, yearGroup]),

    // ── Upcoming internship deadlines ─────────────────────────────────────────
    query<{
      id: string;
      title: string;
      deadline: Date;
      registration_link: string | null;
    }>(`
      SELECT id, title, deadline, registration_link
      FROM opportunities
      WHERE deleted_at IS NULL
        AND status = 'Active'
        AND type   = 'Internship'
        AND (department_id IS NULL OR department_id = $1)
        AND (eligible_years IS NULL OR $2 = ANY(eligible_years))
        AND deadline IS NOT NULL AND deadline >= CURRENT_DATE
      ORDER BY deadline ASC
      LIMIT 3
    `, [departmentId, yearGroup]),

    // ── Upcoming placement drives ─────────────────────────────────────────────
    query<{
      id: string;
      title: string;
      start_date: Date | null;
      deadline: Date | null;
    }>(`
      SELECT id, title, start_date, deadline
      FROM opportunities
      WHERE deleted_at IS NULL
        AND status = 'Active'
        AND type   = 'Placement Drive'
        AND (department_id IS NULL OR department_id = $1)
        AND (eligible_years IS NULL OR $2 = ANY(eligible_years))
      ORDER BY COALESCE(start_date, deadline) ASC NULLS LAST
      LIMIT 3
    `, [departmentId, yearGroup]),

    // ── Upcoming calendar entries visible to this student ─────────────────────
    query<{
      id: string;
      title: string;
      event_type: string;
      start_date: Date;
      end_date: Date | null;
      visibility: string;
    }>(`
      SELECT ce.id, ce.title, ce.event_type, ce.start_date, ce.end_date, ce.visibility
      FROM calendar_entries ce
      WHERE ce.deleted_at IS NULL
        AND ce.start_date >= NOW()
        AND (
          (ce.visibility = 'personal'          AND ce.created_by = $1)
          OR ce.visibility = 'institution_wide'
          OR ce.visibility = 'student'
          OR (ce.visibility = 'department' AND (ce.department_id IS NULL OR ce.department_id = $2))
          OR (ce.visibility = 'semester'   AND ce.semester = $3
              AND (ce.department_id IS NULL OR ce.department_id = $2))
        )
      ORDER BY ce.start_date ASC
      LIMIT 5
    `, [userId, departmentId, semester]),

    // ── Unread notification count ─────────────────────────────────────────────
    query<{ unread: string }>(`
      SELECT COUNT(*) FILTER (WHERE nr.id IS NULL)::int AS unread
      FROM notifications n
      LEFT JOIN notification_reads nr ON nr.notification_id = n.id AND nr.user_id = $1
      WHERE n.deleted_at IS NULL
        AND n.target_role IN ('all', 'student')
        AND (n.department_id IS NULL OR n.department_id = $2)
        AND (n.semester      IS NULL OR n.semester      = $3)
    `, [userId, departmentId, semester]),

    // ── Announcements visible to this student ─────────────────────────────────
    query<{ id: string; title: string; priority: string; publish_date: string }>(`
      SELECT id, title, priority,
             TO_CHAR(publish_date, 'YYYY-MM-DD') AS publish_date
      FROM announcements
      WHERE deleted_at IS NULL
        AND status = 'Published'
        AND (
              target_audience = 'All'
          OR  target_audience = 'Students'
          OR (target_audience = 'Department Specific' AND department_id = $1)
          OR (target_audience = 'Semester Specific'   AND semester      = $2)
        )
      ORDER BY
        CASE priority WHEN 'Urgent' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END,
        publish_date DESC, created_at DESC
      LIMIT 3
    `, [departmentId, semester]),

    // ── Upcoming academic calendar events for this student ────────────────────
    query<{ id: string; title: string; start_date: string; event_type: string }>(`
      SELECT id, title,
             TO_CHAR(start_date, 'YYYY-MM-DD') AS start_date,
             event_type
      FROM academic_calendar_events
      WHERE deleted_at IS NULL
        AND publish_status IN ('Published', 'Updated')
        AND target_audience != 'Faculty'
        AND (
              target_audience = 'All'
          OR  target_audience = 'Students'
          OR  target_audience = $1
        )
        AND ($2::uuid IS NULL OR department_id IS NULL OR department_id = $2::uuid)
        AND start_date >= CURRENT_DATE
      ORDER BY start_date ASC
      LIMIT 5
    `, [yearGroup, departmentId]),
  ]);

  const feedbackOverview = await getFeedbackOverviewForStudent(userId);

  return {
    feedbackOverview,
    profile: {
      id:             profileRows[0].id,
      fullName:       profileRows[0].full_name,
      rollNumber:     profileRows[0].roll_number,
      semester:       Number(semester),
      section:        profileRows[0].section ?? null,
      academicYear:   profileRows[0].academic_year,
      status:         profileRows[0].status,
      departmentName: profileRows[0].department_name,
      programName:    profileRows[0].program_name,
    },
    academicOverview: {
      attendanceSummary,
      results:       results.slice(0, 5),
      upcomingExams: upcomingExams.slice(0, 5),
    },
    feeStatus: {
      pendingAmount: feeDues.reduce((sum, fee) => sum + fee.pendingAmount, 0),
      nextDueDate:   feeDues.find((fee) => fee.pendingAmount > 0)?.dueDate ?? null,
      fees:          feeDues,
    },
    lmsOverview: {
      upcomingDeadlines: lmsDeadlinesRes.rows.map((r) => ({
        id:               r.id,
        title:            r.title,
        dueDate:          r.due_date,
        maxMarks:         parseFloat(r.max_marks),
        subjectCode:      r.subject_code,
        subjectName:      r.subject_name,
        submissionStatus: r.submission_status,
      })),
      recentMaterials: recentMaterialsRes.rows.map((r) => ({
        id:          r.id,
        title:       r.title,
        fileType:    r.file_type,
        subjectCode: r.subject_code,
        subjectName: r.subject_name,
        createdAt:   r.created_at,
      })),
      feedbackReceived: feedbackRes.rows.map((r) => ({
        id:              r.id,
        assignmentTitle: r.assignment_title,
        marks:           r.marks !== null ? parseFloat(r.marks) : null,
        maxMarks:        parseFloat(r.max_marks),
        feedback:        r.feedback,
        gradedAt:        r.updated_at,
      })),
    },
    opportunityHub: {
      newOpportunities:      newOpportunitiesRes.rows.map((r) => ({
        id:               r.id,
        title:            r.title,
        type:             r.type,
        deadline:         r.deadline,
        registrationLink: r.registration_link,
      })),
      internshipDeadlines:   internshipDeadlinesRes.rows.map((r) => ({
        id:               r.id,
        title:            r.title,
        deadline:         r.deadline,
        registrationLink: r.registration_link,
      })),
      upcomingPlacementDrives: placementDrivesRes.rows.map((r) => ({
        id:        r.id,
        title:     r.title,
        startDate: r.start_date,
        deadline:  r.deadline,
      })),
    },
    calendarOverview: {
      upcomingEntries: calendarRes.rows.map((r) => ({
        id:         r.id,
        title:      r.title,
        eventType:  r.event_type,
        startDate:  r.start_date,
        endDate:    r.end_date,
        visibility: r.visibility,
      })),
      academicEvents: eventsRes.rows.map((r) => ({
        id:        r.id,
        title:     r.title,
        startDate: r.start_date,
        eventType: r.event_type,
      })),
    },
    notificationOverview: {
      unreadNotifications: Number(notifRes.rows[0]?.unread) || 0,
    },
    recentAnnouncements: annRes.rows.map((r) => ({
      id:          r.id,
      title:       r.title,
      priority:    r.priority,
      publishDate: r.publish_date,
    })),
    quickActions: [
      { label: 'View Assignments',   route: '/lms/assignments' },
      { label: 'Submit Assignment',  route: '/lms/submissions' },
      { label: 'View Opportunities', route: '/opportunities' },
      { label: 'View Calendar',      route: '/calendar-entries' },
    ],
  };
}

export async function getHODDashboardStats(userId: string) {
  const { rows: profileRows } = await query<{
    id: string;
    full_name: string;
    employee_number: string;
    department_name: string;
    department_id: string;
    designation: string;
  }>(`
    SELECT f.id, f.full_name, f.employee_number, f.designation,
           d.name AS department_name, d.id AS department_id
    FROM faculty f
    JOIN departments d ON d.id = f.department_id
    WHERE f.user_id = $1 AND f.deleted_at IS NULL
  `, [userId]);

  if (!profileRows[0]) throw AppError.forbidden('No faculty profile is linked to this account');
  if (profileRows[0].designation !== 'hod') {
    throw AppError.forbidden('Only Head of Departments can view this dashboard');
  }

  const { department_id: departmentId } = profileRows[0];

  const [facCountRes, studCountRes, classCountRes, attStatsRes, noticesRes, pendingRes] = await Promise.all([
    query<{ count: string }>('SELECT COUNT(*)::text AS count FROM faculty WHERE department_id = $1 AND deleted_at IS NULL', [departmentId]),
    query<{ count: string }>('SELECT COUNT(*)::text AS count FROM students WHERE department_id = $1 AND deleted_at IS NULL', [departmentId]),
    query<{ count: string }>(
      `SELECT COUNT(DISTINCT(fsa.subject_id, fsa.section))::text AS count 
       FROM faculty_subject_assignments fsa 
       JOIN faculty f ON f.id = fsa.faculty_id 
       WHERE f.department_id = $1 AND fsa.is_active = true AND fsa.deleted_at IS NULL`,
      [departmentId]
    ),
    query<{ total: string; present: string }>(
      `SELECT COUNT(*)::text AS total, COUNT(*) FILTER (WHERE a.status = 'present')::text AS present 
       FROM attendance a 
       JOIN students s ON s.id = a.student_id 
       WHERE s.department_id = $1`,
      [departmentId]
    ),
    query<{ id: string; title: string; priority: string; publish_date: string }>(
      `SELECT id, title, priority, TO_CHAR(publish_date, 'YYYY-MM-DD') AS publish_date 
       FROM announcements 
       WHERE deleted_at IS NULL AND status = 'Published' 
         AND (target_audience = 'All' OR (target_audience = 'Department Specific' AND department_id = $1)) 
       ORDER BY publish_date DESC LIMIT 5`,
      [departmentId]
    ),
    query<{ count: string }>(
      `SELECT COUNT(*)::text AS count 
       FROM results r 
       JOIN subjects s ON s.id = r.subject_id 
       JOIN subject_curriculum_mappings scm ON scm.subject_id = s.id
       WHERE scm.department_id = $1 AND r.publication_status = 'Draft' AND r.deleted_at IS NULL AND scm.deleted_at IS NULL`,
      [departmentId]
    ),
  ]);

  const totalAtt = Number(attStatsRes.rows[0]?.total || 0);
  const presentAtt = Number(attStatsRes.rows[0]?.present || 0);
  const attendanceRate = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : 100;
  const examSeatingOverview = await getExamSeatingOverview(departmentId);
  const mentorshipOverview = await getMentorshipAnalytics(departmentId);
  const feedbackOverview = await getFeedbackOverviewForAdmin(departmentId);

  return {
    examSeatingOverview,
    mentorshipOverview,
    feedbackOverview,
    profile: {
      id:             profileRows[0].id,
      fullName:       profileRows[0].full_name,
      employeeNumber: profileRows[0].employee_number,
      departmentName: profileRows[0].department_name,
      designation:    profileRows[0].designation,
    },
    metrics: {
      totalFaculty:   Number(facCountRes.rows[0]?.count || 0),
      totalStudents:  Number(studCountRes.rows[0]?.count || 0),
      totalClasses:   Number(classCountRes.rows[0]?.count || 0),
      attendanceRate,
      pendingApprovals: Number(pendingRes.rows[0]?.count || 0),
    },
    notices: noticesRes.rows.map(r => ({
      id:          r.id,
      title:       r.title,
      priority:    r.priority,
      publishDate: r.publish_date,
    })),
    quickActions: [
      { label: 'View Students',     route: '/hod/students' },
      { label: 'View Faculty',      route: '/hod/faculty' },
      { label: 'View Attendance',   route: '/hod/attendance' },
      { label: 'Class Schedules',   route: '/hod/classes' },
    ],
  };
}

export async function getAccountantDashboardStats() {
  await ensureAllStudentsHaveFees();
  const [studCountRes, collectedRes, pendingRes, paidCountRes, partialCountRes, transactionsRes] = await Promise.all([
    query<{ count: string }>('SELECT COUNT(*)::text AS count FROM students WHERE deleted_at IS NULL'),
    query<{ total: string }>('SELECT COALESCE(SUM(paid_amount), 0)::text AS total FROM fees WHERE deleted_at IS NULL'),
    query<{ total: string }>('SELECT COALESCE(SUM(pending_amount), 0)::text AS total FROM fees WHERE deleted_at IS NULL'),
    query<{ count: string }>("SELECT COUNT(*)::text AS count FROM fees WHERE payment_status = 'Paid' AND deleted_at IS NULL"),
    query<{ count: string }>("SELECT COUNT(*)::text AS count FROM fees WHERE payment_status = 'Partially Paid' AND deleted_at IS NULL"),
    query<{ id: string; amount: string; payment_date: string; payment_mode: string; student_name: string; roll_number: string }>(
      `SELECT 
         fp.id, 
         fp.amount, 
         TO_CHAR(fp.payment_date, 'YYYY-MM-DD') AS payment_date, 
         fp.payment_mode, 
         s.full_name AS student_name, 
         s.roll_number
       FROM fee_payments fp
       JOIN fees f ON f.id = fp.fee_id
       JOIN students s ON s.id = f.student_id
       ORDER BY fp.created_at DESC
       LIMIT 5`
    ),
  ]);

  return {
    metrics: {
      totalStudents: Number(studCountRes.rows[0]?.count || 0),
      totalCollected: parseFloat(collectedRes.rows[0]?.total || '0'),
      totalPending: parseFloat(pendingRes.rows[0]?.total || '0'),
      fullyPaidStudents: Number(paidCountRes.rows[0]?.count || 0),
      partialPaidStudents: Number(partialCountRes.rows[0]?.count || 0),
    },
    recentTransactions: transactionsRes.rows.map(r => ({
      id: r.id,
      amount: parseFloat(r.amount),
      paymentDate: r.payment_date,
      paymentMode: r.payment_mode,
      studentName: r.student_name,
      rollNumber: r.roll_number,
    })),
  };
}
