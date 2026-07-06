import { query, withTransaction } from '../config/database';
import { auditLog } from '../utils/audit';
import { AppError } from '../errors/AppError';
import { isFacultyAssigned } from './assignment.service';
import type {
  MarkAttendanceInput,
  UpdateAttendanceInput,
  ListAttendanceQuery,
  HistoryQuery,
  AttendanceRecord,
  PaginatedAttendance,
  RosterEntry,
  StudentAttendanceSummary,
  SubjectAttendanceSummary,
  PaginatedHistory,
  AttendanceStatus,
} from '../types/attendance';
import type { Role } from '../types/roles';

// ── Row types (snake_case from PostgreSQL) ─────────────────────────────────────

interface AttendanceRow {
  id: string;
  student_id: string;
  student_name: string;
  roll_number: string;
  faculty_id: string;
  faculty_name: string;
  subject_id: string;
  subject_code: string;
  subject_name: string;
  section: string;
  attendance_date: string; // returned as text via TO_CHAR
  status: AttendanceStatus;
  created_at: Date;
  updated_at: Date;
}

interface AttendanceListRow extends AttendanceRow {
  total_count: string;
}

interface RosterRow {
  student_id: string;
  roll_number: string;
  full_name: string;
  section: string;
  attendance_id: string | null;
  status: AttendanceStatus | null;
}

interface SummaryRow {
  subject_id: string;
  subject_code: string;
  subject_name: string;
  semester: number;
  total_classes: string; // pg returns bigint as string
  attended_classes: string;
}

interface HistoryRow {
  id: string;
  subject_id: string;
  subject_code: string;
  subject_name: string;
  section: string;
  attendance_date: string;
  status: AttendanceStatus;
  marked_by: string;
  updated_at: Date;
  total_count: string;
}

// ── Shared query fragments ─────────────────────────────────────────────────────

const RECORD_COLS = `
  a.id,
  a.student_id,  st.full_name              AS student_name,  st.roll_number,
  a.faculty_id,  f.full_name               AS faculty_name,
  a.subject_id,  sub.code                  AS subject_code,  sub.name AS subject_name,
  a.section,     TO_CHAR(a.attendance_date, 'YYYY-MM-DD') AS attendance_date,
  a.status,      a.created_at,             a.updated_at
`;

const RECORD_JOINS = `
  JOIN students  st  ON st.id  = a.student_id
  JOIN faculty   f   ON f.id   = a.faculty_id
  JOIN subjects  sub ON sub.id = a.subject_id
`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function toRecord(r: AttendanceRow): AttendanceRecord {
  return {
    id: r.id,
    studentId: r.student_id,
    studentName: r.student_name,
    rollNumber: r.roll_number,
    facultyId: r.faculty_id,
    facultyName: r.faculty_name,
    subjectId: r.subject_id,
    subjectCode: r.subject_code,
    subjectName: r.subject_name,
    section: r.section,
    attendanceDate: r.attendance_date,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Resolves users.id → faculty.id. Throws 403 if no faculty profile exists. */
async function resolveFacultyId(userId: string): Promise<string> {
  const { rows } = await query<{ id: string }>(
    'SELECT id FROM faculty WHERE user_id = $1 AND deleted_at IS NULL',
    [userId]
  );
  if (!rows[0]) throw AppError.forbidden('No faculty profile is linked to this account');
  return rows[0].id;
}

/** Returns today's date as a YYYY-MM-DD string in local server time. */
function todayString(): string {
  return new Date().toLocaleDateString('en-CA'); // en-CA locale gives YYYY-MM-DD
}

// ── Read operations ───────────────────────────────────────────────────────────

export async function getAttendanceById(id: string): Promise<AttendanceRecord> {
  const { rows } = await query<AttendanceRow>(
    `SELECT ${RECORD_COLS} FROM attendance a ${RECORD_JOINS}
     WHERE a.id = $1`,
    [id]
  );
  if (!rows[0]) throw AppError.notFound('Attendance record not found');
  return toRecord(rows[0]);
}

/**
 * Returns the student roster for a given subject+section on a given date,
 * pre-populated with any existing attendance status for that date.
 * Used by faculty before marking a session.
 */
export async function getRoster(
  subjectId: string,
  section: string,
  date: string,
  userId: string
): Promise<RosterEntry[]> {
  const facultyId = await resolveFacultyId(userId);
  const assigned = await isFacultyAssigned(facultyId, subjectId, section);
  if (!assigned) {
    throw AppError.forbidden(
      'You are not assigned to teach this subject and section',
      'NOT_ASSIGNED'
    );
  }

  // Verify subject exists and retrieve program_id + semester for enrollment join
  const { rows: sub } = await query<{ program_id: string; semester: number }>(
    `SELECT program_id, semester FROM subjects WHERE id = $1 AND deleted_at IS NULL`,
    [subjectId]
  );
  if (!sub[0]) throw AppError.notFound('Subject not found');

  const { rows } = await query<RosterRow>(
    `SELECT
       st.id           AS student_id,
       st.roll_number,
       st.full_name,
       st.section,
       a.id            AS attendance_id,
       a.status
     FROM students st
     LEFT JOIN attendance a
       ON a.student_id      = st.id
      AND a.subject_id      = $1
      AND a.attendance_date = $4::date
     WHERE st.program_id   = $2
       AND st.semester      = $3
       AND st.section       = $5
       AND st.status        = 'active'
       AND st.deleted_at    IS NULL
     ORDER BY st.roll_number`,
    [subjectId, sub[0].program_id, sub[0].semester, date, section]
  );

  return rows.map((r) => ({
    studentId: r.student_id,
    rollNumber: r.roll_number,
    fullName: r.full_name,
    section: r.section,
    attendanceId: r.attendance_id,
    status: r.status,
  }));
}

export async function listAttendance(
  filters: ListAttendanceQuery
): Promise<PaginatedAttendance> {
  const conditions: string[] = ['1 = 1'];
  const params: unknown[] = [];

  const push = (condition: string, value: unknown) => {
    params.push(value);
    conditions.push(`${condition} $${params.length}`);
  };

  if (filters.studentId) push('a.student_id =', filters.studentId);
  if (filters.facultyId) push('a.faculty_id =', filters.facultyId);
  if (filters.subjectId) push('a.subject_id =', filters.subjectId);
  if (filters.section) push('a.section =', filters.section);
  if (filters.status) push('a.status =', filters.status);

  if (filters.date) {
    params.push(filters.date);
    conditions.push(`a.attendance_date = $${params.length}::date`);
  } else {
    if (filters.dateFrom) {
      params.push(filters.dateFrom);
      conditions.push(`a.attendance_date >= $${params.length}::date`);
    }
    if (filters.dateTo) {
      params.push(filters.dateTo);
      conditions.push(`a.attendance_date <= $${params.length}::date`);
    }
  }

  const offset = (filters.page - 1) * filters.limit;
  params.push(filters.limit, offset);

  const { rows } = await query<AttendanceListRow>(
    `SELECT ${RECORD_COLS}, COUNT(*) OVER() AS total_count
     FROM attendance a ${RECORD_JOINS}
     WHERE ${conditions.join(' AND ')}
     ORDER BY a.attendance_date DESC, st.roll_number ASC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const total = rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0;

  return {
    records: rows.map(toRecord),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.ceil(total / filters.limit),
    },
  };
}

/**
 * Returns subject-wise attendance counts and percentages for a student.
 * Shows all subjects for the student's current program+semester, even those
 * with zero attendance records yet.
 */
export async function getStudentSummary(userId: string): Promise<StudentAttendanceSummary> {
  const { rows } = await query<SummaryRow>(
    `SELECT
       sub.id                                                    AS subject_id,
       sub.code                                                  AS subject_code,
       sub.name                                                  AS subject_name,
       sub.semester,
       COUNT(a.id)                                               AS total_classes,
       COUNT(a.id) FILTER (WHERE a.status = 'present')          AS attended_classes
     FROM students st
     JOIN subjects sub
       ON sub.program_id = st.program_id
      AND sub.semester   = st.semester
      AND sub.deleted_at IS NULL
      AND sub.status    != 'archived'
     LEFT JOIN attendance a
       ON a.subject_id = sub.id
      AND a.student_id = st.id
     WHERE st.user_id   = $1
       AND st.deleted_at IS NULL
     GROUP BY sub.id, sub.code, sub.name, sub.semester
     ORDER BY sub.semester ASC, sub.code ASC`,
    [userId]
  );

  const subjects: SubjectAttendanceSummary[] = rows.map((r) => {
    const total = parseInt(r.total_classes, 10);
    const attended = parseInt(r.attended_classes, 10);
    return {
      subjectId: r.subject_id,
      subjectCode: r.subject_code,
      subjectName: r.subject_name,
      semester: r.semester,
      totalClasses: total,
      attendedClasses: attended,
      percentage: total > 0 ? Math.round((attended / total) * 10000) / 100 : 0,
    };
  });

  const totalClasses = subjects.reduce((s, r) => s + r.totalClasses, 0);
  const attendedClasses = subjects.reduce((s, r) => s + r.attendedClasses, 0);

  return {
    subjects,
    overall: {
      totalClasses,
      attendedClasses,
      percentage: totalClasses > 0 ? Math.round((attendedClasses / totalClasses) * 10000) / 100 : 0,
    },
  };
}

/**
 * Returns a student's own attendance history, optionally filtered by subject.
 * Only the student's own user_id is used — no need to pass student_id externally.
 */
export async function getStudentHistory(
  userId: string,
  filters: HistoryQuery
): Promise<PaginatedHistory> {
  const conditions: string[] = ['st.user_id = $1'];
  const params: unknown[] = [userId];

  const push = (condition: string, value: unknown) => {
    params.push(value);
    conditions.push(`${condition} $${params.length}`);
  };

  if (filters.subjectId) push('a.subject_id =', filters.subjectId);
  if (filters.dateFrom) {
    params.push(filters.dateFrom);
    conditions.push(`a.attendance_date >= $${params.length}::date`);
  }
  if (filters.dateTo) {
    params.push(filters.dateTo);
    conditions.push(`a.attendance_date <= $${params.length}::date`);
  }

  const offset = (filters.page - 1) * filters.limit;
  params.push(filters.limit, offset);

  const { rows } = await query<HistoryRow>(
    `SELECT
       a.id,
       a.subject_id,  sub.code  AS subject_code,  sub.name AS subject_name,
       a.section,
       TO_CHAR(a.attendance_date, 'YYYY-MM-DD') AS attendance_date,
       a.status,
       f.full_name  AS marked_by,
       a.updated_at,
       COUNT(*) OVER() AS total_count
     FROM attendance a
     JOIN students  st  ON st.id  = a.student_id
     JOIN subjects  sub ON sub.id = a.subject_id
     JOIN faculty   f   ON f.id   = a.faculty_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY a.attendance_date DESC, sub.code ASC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const total = rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0;

  return {
    records: rows.map((r) => ({
      id: r.id,
      subjectId: r.subject_id,
      subjectCode: r.subject_code,
      subjectName: r.subject_name,
      section: r.section,
      attendanceDate: r.attendance_date,
      status: r.status,
      markedBy: r.marked_by,
      updatedAt: r.updated_at,
    })),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.ceil(total / filters.limit),
    },
  };
}

// ── Write operations ──────────────────────────────────────────────────────────

/**
 * Bulk marks (or corrects) attendance for an entire session.
 * Operation is an upsert: inserts new records, updates existing ones for the same date.
 * Faculty must have an active assignment for the subject+section.
 * Date cannot be in the future.
 */
export async function markAttendance(
  data: MarkAttendanceInput,
  userId: string
): Promise<{ inserted: number; updated: number }> {
  const facultyId = await resolveFacultyId(userId);

  // Gate: faculty must be assigned to this subject+section
  const assigned = await isFacultyAssigned(facultyId, data.subjectId, data.section);
  if (!assigned) {
    throw AppError.forbidden(
      'You are not assigned to teach this subject and section',
      'NOT_ASSIGNED'
    );
  }

  // Gate: attendance date cannot be in the future
  if (data.date > todayString()) {
    throw AppError.badRequest(
      'Attendance date cannot be in the future',
      'FUTURE_DATE'
    );
  }

  // Verify subject exists
  const { rows: sub } = await query<{ id: string }>(
    'SELECT id FROM subjects WHERE id = $1 AND deleted_at IS NULL',
    [data.subjectId]
  );
  if (!sub[0]) throw AppError.notFound('Subject not found');

  let inserted = 0;
  let updated = 0;

  await withTransaction(async (client) => {
    for (const record of data.records) {
      const result = await client.query<{ created_at: Date; updated_at: Date }>(
        `INSERT INTO attendance
           (student_id, faculty_id, subject_id, section, attendance_date, status)
         VALUES ($1, $2, $3, $4, $5::date, $6)
         ON CONFLICT (student_id, subject_id, attendance_date)
         DO UPDATE SET
           status     = EXCLUDED.status,
           faculty_id = EXCLUDED.faculty_id,
           updated_at = NOW()
         RETURNING created_at, updated_at`,
        [record.studentId, facultyId, data.subjectId, data.section, data.date, record.status]
      );

      // If created_at ≈ updated_at the row was just inserted; otherwise it was updated
      const row = result.rows[0];
      const wasInserted = Math.abs(row.updated_at.getTime() - row.created_at.getTime()) < 1000;
      if (wasInserted) inserted++;
      else updated++;
    }

    const presentCount = data.records.filter((r) => r.status === 'present').length;

    await auditLog({
      actorId: userId,
      action: 'MARK_ATTENDANCE_SESSION',
      resource: 'attendance',
      resourceId: data.subjectId,
      changes: {
        date: data.date,
        section: data.section,
        total: data.records.length,
        present: presentCount,
        absent: data.records.length - presentCount,
        inserted,
        updated,
      },
    });
  });

  return { inserted, updated };
}

/**
 * Updates the status of a single attendance record.
 *
 * Faculty: can only update records they originally marked on the current date.
 * Admin:   no date or ownership restriction.
 */
export async function updateAttendance(
  id: string,
  data: UpdateAttendanceInput,
  userId: string,
  userRole: Role
): Promise<AttendanceRecord> {
  if (userRole === 'faculty') {
    const facultyId = await resolveFacultyId(userId);

    // Fetch current record to check ownership and date
    const { rows } = await query<{ faculty_id: string; attendance_date: string }>(
      `SELECT faculty_id, TO_CHAR(attendance_date, 'YYYY-MM-DD') AS attendance_date
       FROM attendance WHERE id = $1`,
      [id]
    );
    if (!rows[0]) throw AppError.notFound('Attendance record not found');

    if (rows[0].faculty_id !== facultyId) {
      throw AppError.forbidden(
        'You can only correct attendance records you originally marked',
        'NOT_RECORD_OWNER'
      );
    }

    if (rows[0].attendance_date !== todayString()) {
      throw AppError.forbidden(
        'Attendance can only be corrected on the same day it was marked',
        'CORRECTION_WINDOW_CLOSED'
      );
    }
  }

  const { rowCount } = await query(
    `UPDATE attendance SET status = $1 WHERE id = $2`,
    [data.status, id]
  );
  if (!rowCount) throw AppError.notFound('Attendance record not found');

  await auditLog({
    actorId: userId,
    action: 'UPDATE_ATTENDANCE',
    resource: 'attendance',
    resourceId: id,
    changes: { status: data.status },
  });

  return getAttendanceById(id);
}
