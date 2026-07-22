import { query } from '../config/database';
import type {
  SearchResult,
  StudentResult,
  FacultyResult,
  SubjectResult,
  AnnouncementResult,
  EventResult,
  ExaminationResult,
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
  const [studentsR, facultyR, subjectsR, announcementsR, eventsR, examsR] = await Promise.all([
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

    query<SubjectRow>(
      `SELECT s.id, s.code, s.name, d.name AS department_name, s.semester
       FROM subjects s
       JOIN departments d ON d.id = s.department_id
       WHERE s.deleted_at IS NULL
         AND (s.name ILIKE $1 OR s.code ILIKE $1)
       ORDER BY s.name ASC
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
  ]);

  return omitEmpty({
    students:      studentsR.rows.map(toStudent),
    faculty:       facultyR.rows.map(toFaculty),
    subjects:      subjectsR.rows.map(toSubject),
    announcements: announcementsR.rows.map(toAnnouncement),
    events:        eventsR.rows.map(toEvent),
    examinations:  examsR.rows.map(toExam),
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

  const [studentsR, subjectsR, announcementsR, eventsR, examsR] = await Promise.all([
    // Only students enrolled in sections that this faculty is currently assigned to teach
    query<StudentRow>(
      `SELECT DISTINCT s.id, s.roll_number, s.full_name, d.name AS department_name, s.semester
       FROM faculty_subject_assignments fsa
       JOIN subjects      sub ON sub.id = fsa.subject_id AND sub.deleted_at IS NULL
       JOIN students      s   ON s.program_id    = sub.program_id
                             AND s.semester      = sub.semester
                             AND s.section       = fsa.section
                             AND s.academic_year = fsa.academic_year
                             AND s.deleted_at    IS NULL
                             AND s.status        = 'active'
       JOIN departments   d   ON d.id = s.department_id
       WHERE fsa.faculty_id   = $1
         AND fsa.is_active    = TRUE
         AND fsa.deleted_at   IS NULL
         AND (s.full_name ILIKE $2 OR s.roll_number ILIKE $2)
       ORDER BY s.full_name ASC
       LIMIT ${LIMIT}`,
      [facultyId, pattern]
    ),

    // Only subjects this faculty is assigned to teach
    query<SubjectRow>(
      `SELECT DISTINCT sub.id, sub.code, sub.name, d.name AS department_name, scm.semester
       FROM faculty_subject_assignments fsa
       JOIN subject_curriculum_mappings scm ON scm.id = fsa.subject_curriculum_mapping_id AND scm.deleted_at IS NULL
       JOIN subjects    sub ON sub.id = scm.subject_id AND sub.deleted_at IS NULL
       JOIN departments d   ON d.id   = scm.department_id
       WHERE fsa.faculty_id  = $1
         AND fsa.is_active   = TRUE
         AND fsa.deleted_at  IS NULL
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
              TO_CHAR(e.exam_date, 'YYYY-MM-DD') AS exam_date
       FROM faculty_subject_assignments fsa
       JOIN exams   e   ON e.subject_id  = fsa.subject_id AND e.deleted_at IS NULL
       JOIN subjects sub ON sub.id        = e.subject_id
       WHERE fsa.faculty_id  = $1
         AND fsa.is_active   = TRUE
         AND fsa.deleted_at  IS NULL
         AND (sub.name ILIKE $2 OR e.exam_type::text ILIKE $2)
       ORDER BY e.exam_date DESC
       LIMIT ${LIMIT}`,
      [facultyId, pattern]
    ),
  ]);

  return omitEmpty({
    students:      studentsR.rows.map(toStudent),
    faculty:       [],    // faculty cannot search other faculty members
    subjects:      subjectsR.rows.map(toSubject),
    announcements: announcementsR.rows.map(toAnnouncement),
    events:        eventsR.rows.map(toEvent),
    examinations:  examsR.rows.map(toExam),
  });
}

// ── Student: personalized — own academic context only ─────────────────────────

async function searchStudent(userId: string, pattern: string): Promise<SearchResult> {
  const { rows: ctx } = await query<{
    program_id: string; semester: number; section: string; department_id: string;
  }>(
    `SELECT program_id, semester, section, department_id
     FROM students WHERE user_id = $1 AND deleted_at IS NULL`,
    [userId]
  );
  if (!ctx[0]) return {};

  const { program_id: programId, semester, section, department_id: departmentId } = ctx[0];
  const yearGroup = semesterToYearGroup(semester);

  const [subjectsR, announcementsR, eventsR, examsR] = await Promise.all([
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
  ]);

  return omitEmpty({
    students:      [],    // students cannot discover other students
    faculty:       [],    // students cannot see faculty records
    subjects:      subjectsR.rows.map(toSubject),
    announcements: announcementsR.rows.map(toAnnouncement),
    events:        eventsR.rows.map(toEvent),
    examinations:  examsR.rows.map(toExam),
  });
}
