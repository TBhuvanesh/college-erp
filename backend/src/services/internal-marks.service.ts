import { query, withTransaction } from '../config/database';
import { auditLog } from '../utils/audit';
import { AppError } from '../errors/AppError';
import { isFacultyAssigned } from './assignment.service';
import type {
  InternalMarksRecord,
  PaginatedInternalMarks,
  RosterMarksEntry,
  StudentMarksSummary,
  SubjectMarksSummary,
  BulkEnterMarksInput,
  UpdateMarksInput,
  ListMarksQuery,
  AssessmentType,
} from '../types/internal-marks';
import type { Role } from '../types/roles';

// ── Row types (snake_case from PostgreSQL) ─────────────────────────────────────

interface MarksRow {
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
  assessment_type: AssessmentType;
  maximum_marks: string; // postgres numeric returned as string
  obtained_marks: string;
  remarks: string | null;
  created_at: Date;
  updated_at: Date;
}

interface MarksListRow extends MarksRow {
  total_count: string;
}

interface RosterRow {
  student_id: string;
  roll_number: string;
  full_name: string;
  section: string;
  marks_id: string | null;
  obtained_marks: string | null;
  maximum_marks: string | null;
  remarks: string | null;
}

interface SummaryRow {
  subject_id: string;
  subject_code: string;
  subject_name: string;
  semester: number;
  assessment_type: AssessmentType;
  obtained_marks: string;
  maximum_marks: string;
  remarks: string | null;
}

// ── Shared query fragments ─────────────────────────────────────────────────────

const RECORD_COLS = `
  m.id,
  m.student_id,  st.full_name              AS student_name,  st.roll_number,
  m.faculty_id,  f.full_name               AS faculty_name,
  m.subject_id,  sub.code                  AS subject_code,  sub.name AS subject_name,
  m.section,     m.assessment_type,
  m.maximum_marks, m.obtained_marks, m.remarks,
  m.created_at,  m.updated_at
`;

const RECORD_JOINS = `
  JOIN students  st  ON st.id  = m.student_id
  JOIN faculty   f   ON f.id   = m.faculty_id
  JOIN subjects  sub ON sub.id = m.subject_id
`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function toRecord(r: MarksRow): InternalMarksRecord {
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
    assessmentType: r.assessment_type,
    maximumMarks: parseFloat(r.maximum_marks),
    obtainedMarks: parseFloat(r.obtained_marks),
    remarks: r.remarks,
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

// ── Read operations ───────────────────────────────────────────────────────────

export async function getMarksById(id: string): Promise<InternalMarksRecord> {
  const { rows } = await query<MarksRow>(
    `SELECT ${RECORD_COLS} FROM internal_marks m ${RECORD_JOINS}
     WHERE m.id = $1`,
    [id]
  );
  if (!rows[0]) throw AppError.notFound('Internal marks record not found');
  return toRecord(rows[0]);
}

/**
 * Returns the student roster for a given subject+section and assessmentType,
 * pre-populated with any existing marks for that assessment.
 */
export async function getRoster(
  subjectId: string,
  section: string,
  assessmentType: AssessmentType,
  userId: string
): Promise<RosterMarksEntry[]> {
  const facultyId = await resolveFacultyId(userId);
  const assigned = await isFacultyAssigned(facultyId, subjectId, section);
  if (!assigned) {
    throw AppError.forbidden(
      'You are not assigned to teach this subject and section',
      'NOT_ASSIGNED'
    );
  }

  // Verify subject exists and retrieve program_id + semester
  const { rows: sub } = await query<{ program_id: string; semester: number }>(
    `SELECT scm.program_id, scm.semester
     FROM faculty_subject_assignments fsa
     JOIN subject_curriculum_mappings scm ON scm.id = fsa.subject_curriculum_mapping_id
     WHERE fsa.faculty_id = $1 AND fsa.subject_id = $2 AND fsa.section = $3 AND fsa.deleted_at IS NULL`,
    [facultyId, subjectId, section]
  );
  if (!sub[0]) throw AppError.notFound('Subject not found');

  const { rows } = await query<RosterRow>(
    `SELECT
       st.id            AS student_id,
       st.roll_number,
       st.full_name,
       st.section,
       m.id             AS marks_id,
       m.obtained_marks,
       m.maximum_marks,
       m.remarks
     FROM students st
     LEFT JOIN internal_marks m
       ON m.student_id      = st.id
      AND m.subject_id      = $1
      AND m.assessment_type = $4
     WHERE st.program_id    = $2
       AND st.semester      = $3
       AND st.section       = $5
       AND st.status        = 'active'
       AND st.deleted_at    IS NULL
     ORDER BY st.roll_number`,
    [subjectId, sub[0].program_id, sub[0].semester, assessmentType, section]
  );

  return rows.map((r) => ({
    studentId: r.student_id,
    rollNumber: r.roll_number,
    fullName: r.full_name,
    section: r.section,
    marksId: r.marks_id,
    obtainedMarks: r.obtained_marks ? parseFloat(r.obtained_marks) : null,
    maximumMarks: r.maximum_marks ? parseFloat(r.maximum_marks) : null,
    remarks: r.remarks,
  }));
}

export async function listMarks(
  filters: ListMarksQuery
): Promise<PaginatedInternalMarks> {
  const conditions: string[] = ['1 = 1'];
  const params: unknown[] = [];

  const push = (condition: string, value: unknown) => {
    params.push(value);
    conditions.push(`${condition} $${params.length}`);
  };

  if (filters.studentId) push('m.student_id =', filters.studentId);
  if (filters.facultyId) push('m.faculty_id =', filters.facultyId);
  if (filters.subjectId) push('m.subject_id =', filters.subjectId);
  if (filters.section) push('m.section =', filters.section);
  if (filters.assessmentType) push('m.assessment_type =', filters.assessmentType);

  const offset = (filters.page - 1) * filters.limit;
  params.push(filters.limit, offset);

  const { rows } = await query<MarksListRow>(
    `SELECT ${RECORD_COLS}, COUNT(*) OVER() AS total_count
     FROM internal_marks m ${RECORD_JOINS}
     WHERE ${conditions.join(' AND ')}
     ORDER BY m.updated_at DESC, st.roll_number ASC
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
 * Returns subject-wise marks breakdown and overall aggregated statistics for a student.
 */
export async function getStudentSummary(userId: string): Promise<StudentMarksSummary> {
  const { rows } = await query<SummaryRow>(
    `SELECT
       sub.id                                                    AS subject_id,
       sub.code                                                  AS subject_code,
       sub.name                                                  AS subject_name,
       sub.semester,
       m.assessment_type,
       m.obtained_marks,
       m.maximum_marks,
       m.remarks
     FROM students st
     JOIN subjects sub
       ON sub.program_id = st.program_id
      AND sub.semester   = st.semester
      AND sub.deleted_at IS NULL
      AND sub.status     != 'archived'
     LEFT JOIN internal_marks m
       ON m.subject_id = sub.id
      AND m.student_id = st.id
     WHERE st.user_id    = $1
       AND st.deleted_at IS NULL
     ORDER BY sub.semester ASC, sub.code ASC, m.assessment_type ASC`,
    [userId]
  );

  // Group summary rows by subject
  const subjectsMap: Record<string, SubjectMarksSummary> = {};

  rows.forEach((r) => {
    if (!subjectsMap[r.subject_id]) {
      subjectsMap[r.subject_id] = {
        subjectId: r.subject_id,
        subjectCode: r.subject_code,
        subjectName: r.subject_name,
        semester: r.semester,
        assessments: [],
        totalObtained: 0,
        totalMaximum: 0,
      };
    }

    if (r.assessment_type) {
      const obtained = parseFloat(r.obtained_marks);
      const maximum = parseFloat(r.maximum_marks);
      subjectsMap[r.subject_id].assessments.push({
        assessmentType: r.assessment_type,
        obtainedMarks: obtained,
        maximumMarks: maximum,
        remarks: r.remarks,
      });
      subjectsMap[r.subject_id].totalObtained += obtained;
      subjectsMap[r.subject_id].totalMaximum += maximum;
    }
  });

  const subjects = Object.values(subjectsMap);
  const totalObtained = subjects.reduce((s, r) => s + r.totalObtained, 0);
  const totalMaximum = subjects.reduce((s, r) => s + r.totalMaximum, 0);

  return {
    subjects,
    overall: {
      totalObtained,
      totalMaximum,
      percentage: totalMaximum > 0 ? Math.round((totalObtained / totalMaximum) * 10000) / 100 : 0,
    },
  };
}

/**
 * Returns a student's own chronological marks history.
 */
export async function getStudentHistory(
  userId: string,
  filters: { page: number; limit: number; subjectId?: string }
): Promise<PaginatedInternalMarks> {
  // Resolve user_id to student_id
  const { rows: stud } = await query<{ id: string }>(
    'SELECT id FROM students WHERE user_id = $1 AND deleted_at IS NULL',
    [userId]
  );
  if (!stud[0]) throw AppError.forbidden('No student profile is linked to this account');

  const conditions: string[] = ['m.student_id = $1'];
  const params: unknown[] = [stud[0].id];

  const push = (condition: string, value: unknown) => {
    params.push(value);
    conditions.push(`${condition} $${params.length}`);
  };

  if (filters.subjectId) push('m.subject_id =', filters.subjectId);

  const offset = (filters.page - 1) * filters.limit;
  params.push(filters.limit, offset);

  const { rows } = await query<MarksListRow>(
    `SELECT ${RECORD_COLS}, COUNT(*) OVER() AS total_count
     FROM internal_marks m ${RECORD_JOINS}
     WHERE ${conditions.join(' AND ')}
     ORDER BY m.updated_at DESC, sub.code ASC
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

// ── Write operations ──────────────────────────────────────────────────────────

/**
 * Bulk enters (upserts) internal marks records for a session class.
 */
export async function bulkEnterMarks(
  data: BulkEnterMarksInput,
  userId: string
): Promise<{ inserted: number; updated: number }> {
  const facultyId = await resolveFacultyId(userId);

  // Gate: faculty must teach this subject+section
  const assigned = await isFacultyAssigned(facultyId, data.subjectId, data.section);
  if (!assigned) {
    throw AppError.forbidden(
      'You are not assigned to teach this subject and section',
      'NOT_ASSIGNED'
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
        `INSERT INTO internal_marks
           (student_id, faculty_id, subject_id, section, assessment_type, maximum_marks, obtained_marks, remarks)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (student_id, subject_id, assessment_type)
         DO UPDATE SET
           obtained_marks = EXCLUDED.obtained_marks,
           maximum_marks  = EXCLUDED.maximum_marks,
           remarks        = EXCLUDED.remarks,
           faculty_id     = EXCLUDED.faculty_id,
           updated_at     = NOW()
         RETURNING created_at, updated_at`,
        [
          record.studentId,
          facultyId,
          data.subjectId,
          data.section,
          data.assessmentType,
          data.maximumMarks,
          record.obtainedMarks,
          record.remarks || null,
        ]
      );

      const row = result.rows[0];
      const wasInserted = Math.abs(row.updated_at.getTime() - row.created_at.getTime()) < 1000;
      if (wasInserted) inserted++;
      else updated++;
    }

    await auditLog({
      actorId: userId,
      action: 'BULK_ENTER_MARKS',
      resource: 'internal_marks',
      resourceId: data.subjectId,
      changes: {
        section: data.section,
        type: data.assessmentType,
        maxMarks: data.maximumMarks,
        totalRecords: data.records.length,
        inserted,
        updated,
      },
    });
  });

  return { inserted, updated };
}

/**
 * Updates a single internal marks record.
 */
export async function updateMarks(
  id: string,
  data: UpdateMarksInput,
  userId: string,
  userRole: Role
): Promise<InternalMarksRecord> {
  // Fetch current record
  const { rows } = await query<{ faculty_id: string; maximum_marks: string; obtained_marks: string }>(
    'SELECT faculty_id, maximum_marks, obtained_marks FROM internal_marks WHERE id = $1',
    [id]
  );
  if (!rows[0]) throw AppError.notFound('Internal marks record not found');

  const currentRecord = rows[0];

  // Faculty role restriction
  if (userRole === 'faculty') {
    const facultyId = await resolveFacultyId(userId);
    if (currentRecord.faculty_id !== facultyId) {
      throw AppError.forbidden(
        'You can only correct internal marks records you originally entered',
        'NOT_RECORD_OWNER'
      );
    }
  }

  // Validate obtainedMarks vs maximumMarks comparison handling partial updates
  const finalMax = data.maximumMarks !== undefined ? data.maximumMarks : parseFloat(currentRecord.maximum_marks);
  const finalObtained = data.obtainedMarks !== undefined ? data.obtainedMarks : parseFloat(currentRecord.obtained_marks);

  if (finalObtained > finalMax) {
    throw AppError.badRequest(
      `Obtained marks (${finalObtained}) cannot exceed maximum marks (${finalMax})`,
      'INVALID_MARKS_RELATION'
    );
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  const pushUpdate = (col: string, val: unknown) => {
    params.push(val);
    updates.push(`${col} = $${params.length}`);
  };

  if (data.maximumMarks !== undefined) pushUpdate('maximum_marks', data.maximumMarks);
  if (data.obtainedMarks !== undefined) pushUpdate('obtained_marks', data.obtainedMarks);
  if (data.remarks !== undefined) pushUpdate('remarks', data.remarks);

  if (updates.length > 0) {
    params.push(id);
    await query(
      `UPDATE internal_marks
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${params.length}`,
      params
    );

    await auditLog({
      actorId: userId,
      action: 'UPDATE_MARKS_RECORD',
      resource: 'internal_marks',
      resourceId: id,
      changes: data,
    });
  }

  return getMarksById(id);
}
