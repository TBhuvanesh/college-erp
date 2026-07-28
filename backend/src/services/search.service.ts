import { query } from '../config/database';
import type {
  SearchResult,
  StudentResult,
  FacultyResult,
  SubjectResult,
  AnnouncementResult,
  EventResult,
  ExaminationResult,
  DepartmentResult,
  TeachingAssignmentResult,
  ResultRecordResult,
  NotificationResult,
  RoomResult,
} from '../types/search';
import type { Role } from '../types/roles';

// ── Constants ─────────────────────────────────────────────────────────────────

const LIMIT = 10;

// ── Row types (snake_case from PostgreSQL) ────────────────────────────────────

interface StudentRow {
  id: string;
  roll_number: string;
  full_name: string;
  department_name: string;
  semester: number;
}

interface FacultyRow {
  id: string;
  employee_number: string;
  full_name: string;
  department_name: string;
}

interface SubjectRow {
  id: string;
  code: string;
  name: string;
  department_name: string;
  semester: number;
}

interface AnnouncementRow {
  id: string;
  title: string;
  publish_date: string;
}

interface EventRow {
  id: string;
  title: string;
  start_date: string;
  event_type: string;
}

interface ExamRow {
  id: string;
  exam_type: string;
  subject_name: string;
  exam_date: string;
}

interface DepartmentRow {
  id: string;
  name: string;
  code: string;
}

interface TeachingAssignmentRow {
  id: string;
  faculty_name: string;
  subject_name: string;
  subject_code: string;
  section: string;
  academic_year: string;
}

interface ResultRow {
  id: string;
  student_name: string;
  roll_number: string;
  subject_name: string;
  grade: string;
  publication_status: string;
}

interface NotificationRow {
  id: string;
  title: string;
  created_at: string;
}

interface RoomRow {
  id: string;
  name: string;
  building: string | null;
  capacity: number;
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function toStudent(r: StudentRow): StudentResult {
  return {
    id:             r.id,
    rollNumber:     r.roll_number,
    fullName:       r.full_name,
    departmentName: r.department_name,
    semester:       Number(r.semester),
  };
}

function toFaculty(r: FacultyRow): FacultyResult {
  return {
    id:             r.id,
    employeeNumber: r.employee_number,
    fullName:       r.full_name,
    departmentName: r.department_name,
  };
}

function toSubject(r: SubjectRow): SubjectResult {
  return {
    id:             r.id,
    code:           r.code,
    name:           r.name,
    departmentName: r.department_name,
    semester:       Number(r.semester),
  };
}

function toAnnouncement(r: AnnouncementRow): AnnouncementResult {
  return { id: r.id, title: r.title, publishDate: r.publish_date };
}

function toEvent(r: EventRow): EventResult {
  return { id: r.id, title: r.title, startDate: r.start_date, eventType: r.event_type };
}

function toExam(r: ExamRow): ExaminationResult {
  return { id: r.id, examType: r.exam_type, subjectName: r.subject_name, examDate: r.exam_date };
}

function toDepartment(r: DepartmentRow): DepartmentResult {
  return { id: r.id, name: r.name, code: r.code };
}

function toTeachingAssignment(r: TeachingAssignmentRow): TeachingAssignmentResult {
  return {
    id: r.id,
    facultyName: r.faculty_name,
    subjectName: r.subject_name,
    subjectCode: r.subject_code,
    section: r.section,
    academicYear: r.academic_year,
  };
}

function toResultRecord(r: ResultRow): ResultRecordResult {
  return {
    id: r.id,
    studentName: r.student_name,
    rollNumber: r.roll_number,
    subjectName: r.subject_name,
    grade: r.grade,
    publicationStatus: r.publication_status,
  };
}

function toNotification(r: NotificationRow): NotificationResult {
  return { id: r.id, title: r.title, createdAt: r.created_at };
}

function toRoom(r: RoomRow): RoomResult {
  return { id: r.id, name: r.name, building: r.building, capacity: Number(r.capacity) };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function semesterToYearGroup(semester: number): string {
  if (semester <= 2) return 'I Year';
  if (semester <= 4) return 'II Year';
  if (semester <= 6) return 'III Year';
  return 'IV Year';
}

/** Strips categories that produced zero results from the response object. */
function omitEmpty(raw: Required<SearchResult>): SearchResult {
  const out: SearchResult = {};
  for (const [k, arr] of Object.entries(raw) as [keyof SearchResult, unknown[]][]) {
    if (arr.length > 0) (out as Record<string, unknown>)[k] = arr;
  }
  return out;
}

// ── Public entry point ────────────────────────────────────────────────────────

export async function search(userId: string, role: Role, term: string): Promise<SearchResult> {
  const pattern = `%${term}%`;
  if (role === 'admin')   return searchAdmin(pattern);
  if (role === 'faculty') return searchFaculty(userId, pattern);
  return searchStudent(userId, pattern);
}

// ── Admin: full, unrestricted access across all categories ────────────────────

async function searchAdmin(pattern: string): Promise<SearchResult> {
  const [
    studentsR,
    facultyR,
    subjectsR,
    announcementsR,
    eventsR,
    examsR,
    departmentsR,
    teachingAssignmentsR,
    resultsR,
    notificationsR,
    roomsR,
  ] = await Promise.all([
    query<StudentRow>(
      `SELECT s.id, s.roll_number, s.full_name, d.name AS department_name, s.semester
       FROM students s
       JOIN departments d ON d.id = s.department_id
       WHERE s.deleted_at IS NULL
         AND (s.full_name ILIKE $1 OR s.roll_number ILIKE $1)
       ORDER BY s.full_name ASC
       LIMIT ${LIMIT}`,
      [pattern]
    ),

    query<FacultyRow>(
      `SELECT f.id, f.employee_number, f.full_name, d.name AS department_name
       FROM faculty f
       JOIN departments d ON d.id = f.department_id
       WHERE f.deleted_at IS NULL
         AND (f.full_name ILIKE $1 OR f.employee_number ILIKE $1)
       ORDER BY f.full_name ASC
       LIMIT ${LIMIT}`,
      [pattern]
    ),

    // subjects.department_id/semester were dropped in migration 038 (Curriculum
    // became the owner of that mapping, subject_curriculum_mappings) — this
    // query pre-dated that migration and was left querying columns that no
    // longer exist, silently 500-ing every admin search. Fixed to resolve
    // department/semester through Curriculum, one row per subject (a subject
    // can have several curriculum mappings; DISTINCT ON picks one for display).
    query<SubjectRow>(
      `SELECT * FROM (
         SELECT DISTINCT ON (s.id) s.id, s.code, s.name, d.name AS department_name, scm.semester
         FROM subjects s
         LEFT JOIN subject_curriculum_mappings scm ON scm.subject_id = s.id AND scm.deleted_at IS NULL
         LEFT JOIN departments d ON d.id = scm.department_id
         WHERE s.deleted_at IS NULL
           AND (s.name ILIKE $1 OR s.code ILIKE $1)
         ORDER BY s.id
       ) sub
       ORDER BY sub.name ASC
       LIMIT ${LIMIT}`,
      [pattern]
    ),

    // Admin sees all non-deleted announcements (including Draft — admin needs to find them)
    query<AnnouncementRow>(
      `SELECT id, title, TO_CHAR(publish_date, 'YYYY-MM-DD') AS publish_date
       FROM announcements
       WHERE deleted_at IS NULL
         AND title ILIKE $1
       ORDER BY publish_date DESC
       LIMIT ${LIMIT}`,
      [pattern]
    ),

    // Admin sees all non-archived calendar events
    query<EventRow>(
      `SELECT id, title, TO_CHAR(start_date, 'YYYY-MM-DD') AS start_date, event_type
       FROM academic_calendar_events
       WHERE deleted_at IS NULL
         AND publish_status != 'Archived'
         AND title ILIKE $1
       ORDER BY start_date ASC
       LIMIT ${LIMIT}`,
      [pattern]
    ),

    // Admin can search examinations across all subjects
    query<ExamRow>(
      `SELECT e.id, e.exam_type, sub.name AS subject_name,
              TO_CHAR(e.exam_date, 'YYYY-MM-DD') AS exam_date
       FROM exams e
       JOIN subjects sub ON sub.id = e.subject_id
       WHERE e.deleted_at IS NULL
         AND (sub.name ILIKE $1 OR e.exam_type::text ILIKE $1)
       ORDER BY e.exam_date DESC
       LIMIT ${LIMIT}`,
      [pattern]
    ),

    query<DepartmentRow>(
      `SELECT id, name, code FROM departments
       WHERE deleted_at IS NULL AND (name ILIKE $1 OR code ILIKE $1)
       ORDER BY name ASC
       LIMIT ${LIMIT}`,
      [pattern]
    ),

    // Teaching Assignments — the central academic entity (Sprint 2, Step 5);
    // resolved from teaching_assignments directly, not a manual faculty+
    // subject+section pick.
    query<TeachingAssignmentRow>(
      `SELECT ta.id, f.full_name AS faculty_name, s.name AS subject_name, s.code AS subject_code,
              ta.section, ta.academic_year
       FROM teaching_assignments ta
       JOIN faculty f ON f.id = ta.faculty_id
       JOIN subjects s ON s.id = ta.subject_id
       WHERE ta.deleted_at IS NULL
         AND (f.full_name ILIKE $1 OR s.name ILIKE $1 OR s.code ILIKE $1)
       ORDER BY ta.academic_year DESC, f.full_name ASC
       LIMIT ${LIMIT}`,
      [pattern]
    ),

    query<ResultRow>(
      `SELECT r.id, st.full_name AS student_name, st.roll_number, sub.name AS subject_name,
              r.grade::text AS grade, r.publication_status::text AS publication_status
       FROM results r
       JOIN students st ON st.id = r.student_id
       JOIN subjects sub ON sub.id = r.subject_id
       WHERE r.deleted_at IS NULL
         AND (st.full_name ILIKE $1 OR st.roll_number ILIKE $1 OR sub.name ILIKE $1)
       ORDER BY r.updated_at DESC
       LIMIT ${LIMIT}`,
      [pattern]
    ),

    query<NotificationRow>(
      `SELECT id, title, TO_CHAR(created_at, 'YYYY-MM-DD') AS created_at
       FROM notifications
       WHERE deleted_at IS NULL AND title ILIKE $1
       ORDER BY created_at DESC
       LIMIT ${LIMIT}`,
      [pattern]
    ),

    query<RoomRow>(
      `SELECT id, name, building, capacity
       FROM exam_rooms
       WHERE deleted_at IS NULL AND (name ILIKE $1 OR building ILIKE $1)
       ORDER BY name ASC
       LIMIT ${LIMIT}`,
      [pattern]
    ),
  ]);

  return omitEmpty({
    students:            studentsR.rows.map(toStudent),
    faculty:             facultyR.rows.map(toFaculty),
    subjects:            subjectsR.rows.map(toSubject),
    announcements:       announcementsR.rows.map(toAnnouncement),
    events:              eventsR.rows.map(toEvent),
    examinations:        examsR.rows.map(toExam),
    departments:         departmentsR.rows.map(toDepartment),
    teachingAssignments: teachingAssignmentsR.rows.map(toTeachingAssignment),
    results:             resultsR.rows.map(toResultRecord),
    notifications:       notificationsR.rows.map(toNotification),
    rooms:               roomsR.rows.map(toRoom),
  });
}

// ── Faculty: assigned students + assigned subjects + scoped content ────────────

async function searchFaculty(userId: string, pattern: string): Promise<SearchResult> {
  const { rows: ctx } = await query<{ id: string; department_id: string }>(
    'SELECT id, department_id FROM faculty WHERE user_id = $1 AND deleted_at IS NULL',
    [userId]
  );
  if (!ctx[0]) return {};

  const { id: facultyId, department_id: departmentId } = ctx[0];

  const [
    studentsR,
    subjectsR,
    announcementsR,
    eventsR,
    examsR,
    departmentsR,
    teachingAssignmentsR,
    resultsR,
    notificationsR,
  ] = await Promise.all([
    // Only students enrolled in sections that this faculty is currently assigned to teach
    query<StudentRow>(
      `SELECT DISTINCT s.id, s.roll_number, s.full_name, d.name AS department_name, s.semester
       FROM teaching_assignments ta
       JOIN subject_curriculum_mappings scm ON scm.id = ta.subject_curriculum_mapping_id AND scm.deleted_at IS NULL
       JOIN students      s   ON s.department_id = scm.department_id
                             AND s.semester      = scm.semester
                             AND s.section       = ta.section
                             AND s.academic_year = ta.academic_year
                             AND s.deleted_at    IS NULL
                             AND s.status        = 'active'
       JOIN departments   d   ON d.id = s.department_id
       WHERE ta.faculty_id   = $1
         AND ta.is_active    = TRUE
         AND ta.deleted_at   IS NULL
         AND (s.full_name ILIKE $2 OR s.roll_number ILIKE $2)
       ORDER BY s.full_name ASC
       LIMIT ${LIMIT}`,
      [facultyId, pattern]
    ),

    // Only subjects this faculty is assigned to teach
    query<SubjectRow>(
      `SELECT DISTINCT sub.id, sub.code, sub.name, d.name AS department_name, scm.semester
       FROM teaching_assignments ta
       JOIN subject_curriculum_mappings scm ON scm.id = ta.subject_curriculum_mapping_id AND scm.deleted_at IS NULL
       JOIN subjects    sub ON sub.id = scm.subject_id AND sub.deleted_at IS NULL
       JOIN departments d   ON d.id   = scm.department_id
       WHERE ta.faculty_id  = $1
         AND ta.is_active   = TRUE
         AND ta.deleted_at  IS NULL
         AND (sub.name ILIKE $2 OR sub.code ILIKE $2)
       ORDER BY sub.name ASC
       LIMIT ${LIMIT}`,
      [facultyId, pattern]
    ),

    // Published announcements: All, Faculty, or faculty's own department
    query<AnnouncementRow>(
      `SELECT id, title, TO_CHAR(publish_date, 'YYYY-MM-DD') AS publish_date
       FROM announcements
       WHERE deleted_at IS NULL
         AND status     = 'Published'
         AND title ILIKE $1
         AND (
           target_audience IN ('All', 'Faculty')
           OR (target_audience = 'Department Specific' AND department_id = $2)
         )
       ORDER BY publish_date DESC
       LIMIT ${LIMIT}`,
      [pattern, departmentId]
    ),

    // Calendar events visible to faculty: All, Faculty, or faculty's department
    query<EventRow>(
      `SELECT id, title, TO_CHAR(start_date, 'YYYY-MM-DD') AS start_date, event_type
       FROM academic_calendar_events
       WHERE deleted_at IS NULL
         AND publish_status IN ('Published', 'Updated')
         AND target_audience != 'Students'
         AND ($2::uuid IS NULL OR department_id IS NULL OR department_id = $2::uuid)
         AND title ILIKE $1
       ORDER BY start_date ASC
       LIMIT ${LIMIT}`,
      [pattern, departmentId]
    ),

    // Examinations for subjects this faculty teaches
    query<ExamRow>(
      `SELECT DISTINCT e.id, e.exam_type, sub.name AS subject_name,
              TO_CHAR(e.exam_date, 'YYYY-MM-DD') AS exam_date, e.exam_date AS exam_date_raw
       FROM teaching_assignments ta
       JOIN exams   e   ON e.subject_id  = ta.subject_id AND e.deleted_at IS NULL
       JOIN subjects sub ON sub.id        = e.subject_id
       WHERE ta.faculty_id  = $1
         AND ta.is_active   = TRUE
         AND ta.deleted_at  IS NULL
         AND (sub.name ILIKE $2 OR e.exam_type::text ILIKE $2)
       ORDER BY exam_date_raw DESC
       LIMIT ${LIMIT}`,
      [facultyId, pattern]
    ),

    query<DepartmentRow>(
      `SELECT id, name, code FROM departments
       WHERE deleted_at IS NULL AND (name ILIKE $1 OR code ILIKE $1)
       ORDER BY name ASC
       LIMIT ${LIMIT}`,
      [pattern]
    ),

    // This faculty's own Teaching Assignments
    query<TeachingAssignmentRow>(
      `SELECT ta.id, f.full_name AS faculty_name, s.name AS subject_name, s.code AS subject_code,
              ta.section, ta.academic_year
       FROM teaching_assignments ta
       JOIN faculty f ON f.id = ta.faculty_id
       JOIN subjects s ON s.id = ta.subject_id
       WHERE ta.deleted_at IS NULL AND ta.faculty_id = $1
         AND (s.name ILIKE $2 OR s.code ILIKE $2)
       ORDER BY ta.academic_year DESC
       LIMIT ${LIMIT}`,
      [facultyId, pattern]
    ),

    // Results this faculty entered
    query<ResultRow>(
      `SELECT r.id, st.full_name AS student_name, st.roll_number, sub.name AS subject_name,
              r.grade::text AS grade, r.publication_status::text AS publication_status
       FROM results r
       JOIN students st ON st.id = r.student_id
       JOIN subjects sub ON sub.id = r.subject_id
       WHERE r.deleted_at IS NULL AND r.faculty_id = $1
         AND (st.full_name ILIKE $2 OR st.roll_number ILIKE $2 OR sub.name ILIKE $2)
       ORDER BY r.updated_at DESC
       LIMIT ${LIMIT}`,
      [facultyId, pattern]
    ),

    // This faculty's own notifications
    query<NotificationRow>(
      `SELECT id, title, TO_CHAR(created_at, 'YYYY-MM-DD') AS created_at
       FROM notifications
       WHERE deleted_at IS NULL AND recipient_user_id = $1 AND title ILIKE $2
       ORDER BY created_at DESC
       LIMIT ${LIMIT}`,
      [userId, pattern]
    ),
  ]);

  return omitEmpty({
    students:            studentsR.rows.map(toStudent),
    faculty:             [],    // faculty cannot search other faculty members
    subjects:            subjectsR.rows.map(toSubject),
    announcements:       announcementsR.rows.map(toAnnouncement),
    events:              eventsR.rows.map(toEvent),
    examinations:        examsR.rows.map(toExam),
    departments:         departmentsR.rows.map(toDepartment),
    teachingAssignments: teachingAssignmentsR.rows.map(toTeachingAssignment),
    results:             resultsR.rows.map(toResultRecord),
    notifications:       notificationsR.rows.map(toNotification),
    rooms:               [],    // room search is an admin/facilities concern
  });
}

// ── Student: personalized — own academic context only ─────────────────────────

async function searchStudent(userId: string, pattern: string): Promise<SearchResult> {
  const { rows: ctx } = await query<{
    id: string; program_id: string; semester: number; section: string; department_id: string;
  }>(
    `SELECT id, program_id, semester, section, department_id
     FROM students WHERE user_id = $1 AND deleted_at IS NULL`,
    [userId]
  );
  if (!ctx[0]) return {};

  const { id: studentId, program_id: programId, semester, section, department_id: departmentId } = ctx[0];
  const yearGroup = semesterToYearGroup(semester);

  const [subjectsR, announcementsR, eventsR, examsR, departmentsR, resultsR, notificationsR] = await Promise.all([
    // Only subjects in the student's own program and current semester
    query<SubjectRow>(
      `SELECT sub.id, sub.code, sub.name, d.name AS department_name, scm.semester
       FROM subjects sub
       JOIN subject_curriculum_mappings scm ON scm.subject_id = sub.id AND scm.deleted_at IS NULL
       JOIN departments d ON d.id = scm.department_id
       WHERE sub.deleted_at  IS NULL
         AND scm.program_id  = $2
         AND scm.semester    = $3
         AND (sub.name ILIKE $1 OR sub.code ILIKE $1)
       ORDER BY sub.name ASC
       LIMIT ${LIMIT}`,
      [pattern, programId, semester]
    ),

    // Published announcements visible to this student (audience + dept + semester)
    query<AnnouncementRow>(
      `SELECT id, title, TO_CHAR(publish_date, 'YYYY-MM-DD') AS publish_date
       FROM announcements
       WHERE deleted_at IS NULL
         AND status     = 'Published'
         AND title ILIKE $1
         AND (
           target_audience IN ('All', 'Students')
           OR (target_audience = 'Department Specific' AND department_id = $2)
           OR (target_audience = 'Semester Specific'   AND semester      = $3)
         )
       ORDER BY publish_date DESC
       LIMIT ${LIMIT}`,
      [pattern, departmentId, semester]
    ),

    // Calendar events: All, Students, or matching year-group; dept filter applied
    query<EventRow>(
      `SELECT id, title, TO_CHAR(start_date, 'YYYY-MM-DD') AS start_date, event_type
       FROM academic_calendar_events
       WHERE deleted_at IS NULL
         AND publish_status IN ('Published', 'Updated')
         AND target_audience != 'Faculty'
         AND (target_audience = 'All' OR target_audience = 'Students' OR target_audience = $2)
         AND ($3::uuid IS NULL OR department_id IS NULL OR department_id = $3::uuid)
         AND title ILIKE $1
       ORDER BY start_date ASC
       LIMIT ${LIMIT}`,
      [pattern, yearGroup, departmentId]
    ),

    // Exam schedule for the student's own semester + section
    query<ExamRow>(
      `SELECT e.id, e.exam_type, sub.name AS subject_name,
              TO_CHAR(e.exam_date, 'YYYY-MM-DD') AS exam_date
       FROM exams e
       JOIN subjects sub ON sub.id = e.subject_id
       WHERE e.deleted_at IS NULL
         AND e.semester   = $2
         AND e.section    = $3
         AND (sub.name ILIKE $1 OR e.exam_type::text ILIKE $1)
       ORDER BY e.exam_date ASC
       LIMIT ${LIMIT}`,
      [pattern, semester, section]
    ),

    query<DepartmentRow>(
      `SELECT id, name, code FROM departments
       WHERE deleted_at IS NULL AND (name ILIKE $1 OR code ILIKE $1)
       ORDER BY name ASC
       LIMIT ${LIMIT}`,
      [pattern]
    ),

    // This student's own results
    query<ResultRow>(
      `SELECT r.id, st.full_name AS student_name, st.roll_number, sub.name AS subject_name,
              r.grade::text AS grade, r.publication_status::text AS publication_status
       FROM results r
       JOIN students st ON st.id = r.student_id
       JOIN subjects sub ON sub.id = r.subject_id
       WHERE r.deleted_at IS NULL AND r.student_id = $1 AND r.publication_status = 'Published'
         AND sub.name ILIKE $2
       ORDER BY r.updated_at DESC
       LIMIT ${LIMIT}`,
      [studentId, pattern]
    ),

    // This student's own notifications
    query<NotificationRow>(
      `SELECT id, title, TO_CHAR(created_at, 'YYYY-MM-DD') AS created_at
       FROM notifications
       WHERE deleted_at IS NULL AND recipient_user_id = $1 AND title ILIKE $2
       ORDER BY created_at DESC
       LIMIT ${LIMIT}`,
      [userId, pattern]
    ),
  ]);

  return omitEmpty({
    students:            [],    // students cannot discover other students
    faculty:             [],    // students cannot see faculty records
    subjects:            subjectsR.rows.map(toSubject),
    announcements:       announcementsR.rows.map(toAnnouncement),
    events:              eventsR.rows.map(toEvent),
    examinations:        examsR.rows.map(toExam),
    departments:         departmentsR.rows.map(toDepartment),
    teachingAssignments: [],    // not applicable to students
    results:             resultsR.rows.map(toResultRecord),
    notifications:       notificationsR.rows.map(toNotification),
    rooms:               [],    // room search is an admin/facilities concern
  });
}
