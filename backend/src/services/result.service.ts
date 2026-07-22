import { query, withTransaction } from '../config/database';
import { auditLog } from '../utils/audit';
import { AppError } from '../errors/AppError';
import { isFacultyAssigned } from './assignment.service';
import { computeGrade, computeResultStatus } from '../config/grading';
import type { Grade } from '../config/grading';
import type {
  ResultDetail,
  ResultSummary,
  PaginatedResults,
  RosterResultEntry,
  StudentResultEntry,
  BulkSubmitResultsInput,
  UpdateResultInput,
  PublishResultsInput,
  ListResultsQuery,
  PublicationStatus,
  ResultStatus,
} from '../types/result';
import type { Role } from '../types/roles';

// ── Row types (snake_case from PostgreSQL) ─────────────────────────────────────

interface ResultRow {
  id: string;
  student_id: string;
  student_name: string;
  roll_number: string;
  subject_id: string;
  subject_code: string;
  subject_name: string;
  department_name: string;
  faculty_id: string;
  faculty_name: string;
  exam_id: string | null;
  semester: number;
  section: string;
  internal_marks: string;
  internal_max_marks: string;
  external_marks: string;
  external_max_marks: string;
  total_marks: string;
  grade: Grade;
  result_status: ResultStatus;
  publication_status: PublicationStatus;
  published_at: Date | null;
  remarks: string | null;
  created_at: Date;
  updated_at: Date;
}

interface ResultListRow extends ResultRow {
  total_count: string;
}

interface RosterRow {
  student_id: string;
  roll_number: string;
  full_name: string;
  section: string;
  result_id: string | null;
  internal_marks: string | null;
  internal_max_marks: string | null;
  external_marks: string | null;
  external_max_marks: string | null;
  total_marks: string | null;
  grade: Grade | null;
  result_status: ResultStatus | null;
  publication_status: PublicationStatus | null;
  remarks: string | null;
}

interface StudentResultRow {
  result_id: string;
  subject_id: string;
  subject_code: string;
  subject_name: string;
  semester: number;
  internal_marks: string;
  internal_max_marks: string;
  external_marks: string;
  external_max_marks: string;
  total_marks: string;
  grade: Grade;
  result_status: ResultStatus;
  published_at: Date;
}

// ── Shared query fragments ─────────────────────────────────────────────────────

const DETAIL_COLS = `
  r.id,
  r.student_id,         st.full_name           AS student_name,  st.roll_number,
  r.subject_id,         sub.code               AS subject_code,  sub.name AS subject_name,
                        d.name                 AS department_name,
  r.faculty_id,         f.full_name            AS faculty_name,
  r.exam_id,
  r.semester,           r.section,
  r.internal_marks,     r.internal_max_marks,
  r.external_marks,     r.external_max_marks,
  r.total_marks,        r.grade,
  r.result_status,      r.publication_status,
  r.published_at,       r.remarks,
  r.created_at,         r.updated_at
`;

const DETAIL_JOINS = `
  JOIN students    st  ON st.id  = r.student_id
  JOIN subjects    sub ON sub.id = r.subject_id
  JOIN departments d   ON d.id   = st.department_id
  JOIN faculty     f   ON f.id   = r.faculty_id
`;

// ── Mappers ───────────────────────────────────────────────────────────────────

function toDetail(r: ResultRow): ResultDetail {
  return {
    id: r.id,
    studentId: r.student_id,
    studentName: r.student_name,
    rollNumber: r.roll_number,
    subjectId: r.subject_id,
    subjectCode: r.subject_code,
    subjectName: r.subject_name,
    departmentName: r.department_name,
    facultyId: r.faculty_id,
    facultyName: r.faculty_name,
    examId: r.exam_id,
    semester: Number(r.semester),
    section: r.section,
    internalMarks: parseFloat(r.internal_marks),
    internalMaxMarks: parseFloat(r.internal_max_marks),
    externalMarks: parseFloat(r.external_marks),
    externalMaxMarks: parseFloat(r.external_max_marks),
    totalMarks: parseFloat(r.total_marks),
    grade: r.grade,
    resultStatus: r.result_status,
    publicationStatus: r.publication_status,
    publishedAt: r.published_at,
    remarks: r.remarks,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toSummary(r: ResultRow): ResultSummary {
  return {
    id: r.id,
    studentId: r.student_id,
    studentName: r.student_name,
    rollNumber: r.roll_number,
    subjectCode: r.subject_code,
    subjectName: r.subject_name,
    semester: Number(r.semester),
    section: r.section,
    internalMarks: parseFloat(r.internal_marks),
    internalMaxMarks: parseFloat(r.internal_max_marks),
    externalMarks: parseFloat(r.external_marks),
    externalMaxMarks: parseFloat(r.external_max_marks),
    totalMarks: parseFloat(r.total_marks),
    grade: r.grade,
    resultStatus: r.result_status,
    publicationStatus: r.publication_status,
  };
}

// ── Private helpers ───────────────────────────────────────────────────────────

async function resolveFacultyId(userId: string): Promise<string> {
  const { rows } = await query<{ id: string }>(
    'SELECT id FROM faculty WHERE user_id = $1 AND deleted_at IS NULL',
    [userId]
  );
  if (!rows[0]) throw AppError.forbidden('No faculty profile is linked to this account');
  return rows[0].id;
}

interface ComputedResult {
  totalMarks: number;
  grade: Grade;
  resultStatus: ResultStatus;
  effectiveExternalMarks: number;
}

function computeResult(
  internalMarks: number,
  externalMarks: number,
  internalMaxMarks: number,
  externalMaxMarks: number,
  isAbsent: boolean
): ComputedResult {
  const effectiveExternalMarks = isAbsent ? 0 : externalMarks;
  const totalMarks = internalMarks + effectiveExternalMarks;
  const totalMax = internalMaxMarks + externalMaxMarks;
  const grade = computeGrade(totalMarks, totalMax);
  const resultStatus = computeResultStatus(grade, isAbsent);
  return { totalMarks, grade, resultStatus, effectiveExternalMarks };
}

// ── Read operations ───────────────────────────────────────────────────────────

export async function getResultById(id: string): Promise<ResultDetail> {
  const { rows } = await query<ResultRow>(
    `SELECT ${DETAIL_COLS} FROM results r ${DETAIL_JOINS}
     WHERE r.id = $1 AND r.deleted_at IS NULL`,
    [id]
  );
  if (!rows[0]) throw AppError.notFound('Result not found');
  return toDetail(rows[0]);
}

export async function listResults(filters: ListResultsQuery): Promise<PaginatedResults> {
  const conditions: string[] = ['r.deleted_at IS NULL'];
  const params: unknown[] = [];

  const push = (condition: string, value: unknown) => {
    params.push(value);
    conditions.push(`${condition} $${params.length}`);
  };

  if (filters.studentId)         push('r.student_id =',          filters.studentId);
  if (filters.subjectId)         push('r.subject_id =',          filters.subjectId);
  if (filters.facultyId)         push('r.faculty_id =',          filters.facultyId);
  if (filters.semester)          push('r.semester =',            filters.semester);
  if (filters.section)           push('r.section =',             filters.section);
  if (filters.resultStatus)      push('r.result_status =',       filters.resultStatus);
  if (filters.publicationStatus) push('r.publication_status =',  filters.publicationStatus);
  if (filters.grade)             push('r.grade =',               filters.grade);

  const offset = (filters.page - 1) * filters.limit;
  params.push(filters.limit, offset);

  const { rows } = await query<ResultListRow>(
    `SELECT ${DETAIL_COLS}, COUNT(*) OVER() AS total_count
     FROM results r ${DETAIL_JOINS}
     WHERE ${conditions.join(' AND ')}
     ORDER BY r.updated_at DESC, st.roll_number ASC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const total = rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0;

  return {
    results: rows.map(toSummary),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.ceil(total / filters.limit),
    },
  };
}

/**
 * Returns the student roster for a subject+section, pre-populated with any
 * existing Draft or Published result.
 */
export async function getRoster(
  subjectId: string,
  section: string,
  userId: string
): Promise<RosterResultEntry[]> {
  const facultyId = await resolveFacultyId(userId);
  // Verify subject exists and get its program context
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
       r.id             AS result_id,
       r.internal_marks,
       r.internal_max_marks,
       r.external_marks,
       r.external_max_marks,
       r.total_marks,
       r.grade,
       r.result_status,
       r.publication_status,
       r.remarks
     FROM students st
     LEFT JOIN results r
       ON r.student_id = st.id
      AND r.subject_id = $1
      AND r.deleted_at IS NULL
     WHERE st.program_id = $2
       AND st.semester   = $3
       AND st.section    = $4
       AND st.status     = 'active'
       AND st.deleted_at IS NULL
     ORDER BY st.roll_number`,
    [subjectId, sub[0].program_id, sub[0].semester, section]
  );

  return rows.map((r) => ({
    studentId: r.student_id,
    rollNumber: r.roll_number,
    fullName: r.full_name,
    section: r.section,
    resultId: r.result_id,
    internalMarks: r.internal_marks ? parseFloat(r.internal_marks) : null,
    internalMaxMarks: r.internal_max_marks ? parseFloat(r.internal_max_marks) : null,
    externalMarks: r.external_marks ? parseFloat(r.external_marks) : null,
    externalMaxMarks: r.external_max_marks ? parseFloat(r.external_max_marks) : null,
    totalMarks: r.total_marks ? parseFloat(r.total_marks) : null,
    grade: r.grade,
    resultStatus: r.result_status,
    publicationStatus: r.publication_status,
    remarks: r.remarks,
  }));

  void userId; // facultyId validated at route level; roster is read-only
}

/**
 * Returns all Published results for the requesting student.
 * Optionally filtered by semester. Ordered by semester then subject code.
 */
export async function getStudentResults(
  userId: string,
  semester?: number
): Promise<StudentResultEntry[]> {
  const conditions: string[] = [
    'r.publication_status = \'Published\'',
    'r.deleted_at IS NULL',
    'st.user_id = $1',
  ];
  const params: unknown[] = [userId];

  if (semester !== undefined) {
    params.push(semester);
    conditions.push(`r.semester = $${params.length}`);
  }

  const { rows } = await query<StudentResultRow>(
    `SELECT
       r.id             AS result_id,
       r.subject_id,
       sub.code         AS subject_code,
       sub.name         AS subject_name,
       r.semester,
       r.internal_marks,
       r.internal_max_marks,
       r.external_marks,
       r.external_max_marks,
       r.total_marks,
       r.grade,
       r.result_status,
       r.published_at
     FROM results r
     JOIN subjects sub ON sub.id = r.subject_id
     JOIN students st  ON st.id  = r.student_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY r.semester ASC, sub.code ASC`,
    params
  );

  return rows.map((r) => ({
    resultId: r.result_id,
    subjectId: r.subject_id,
    subjectCode: r.subject_code,
    subjectName: r.subject_name,
    semester: Number(r.semester),
    internalMarks: 0,
    internalMaxMarks: 0,
    externalMarks: 0,
    externalMaxMarks: 0,
    totalMarks: 0,
    grade: r.grade,
    resultStatus: r.result_status,
    publishedAt: r.published_at,
  }));
}

// ── Write operations ──────────────────────────────────────────────────────────

/**
 * Bulk-submits (upserts) results for a section.
 *  – Validates faculty assignment.
 *  – Blocks if any target student already has a Published result.
 *  – Computes grade and result_status from marks using configurable rules.
 *  – isAbsent=true forces externalMarks=0, grade=F, status=Absent.
 */
export async function bulkSubmitResults(
  data: BulkSubmitResultsInput,
  userId: string
): Promise<{ inserted: number; updated: number }> {
  const facultyId = await resolveFacultyId(userId);

  const assigned = await isFacultyAssigned(facultyId, data.subjectId, data.section);
  if (!assigned) {
    throw AppError.forbidden(
      'You are not assigned to teach this subject and section',
      'NOT_ASSIGNED'
    );
  }

  // Verify subject exists and get semester for denormalization
  const { rows: sub } = await query<{ id: string; semester: number }>(
    `SELECT s.id, scm.semester
     FROM faculty_subject_assignments fsa
     JOIN subject_curriculum_mappings scm ON scm.id = fsa.subject_curriculum_mapping_id
     JOIN subjects s ON s.id = scm.subject_id
     WHERE fsa.faculty_id = $1 AND fsa.subject_id = $2 AND fsa.section = $3 AND fsa.deleted_at IS NULL`,
    [facultyId, data.subjectId, data.section]
  );
  if (!sub[0]) throw AppError.notFound('Subject not found');

  // Guard: block update if any target student already has a Published result
  const studentIds = data.records.map((r) => r.studentId);
  const { rows: published } = await query<{ student_id: string }>(
    `SELECT student_id FROM results
     WHERE subject_id = $1 AND student_id = ANY($2::uuid[])
       AND publication_status = 'Published' AND deleted_at IS NULL`,
    [data.subjectId, studentIds]
  );
  if (published.length > 0) {
    throw AppError.badRequest(
      'One or more students already have published results for this subject. ' +
        'Contact an administrator to correct published results.',
      'RESULTS_ALREADY_PUBLISHED'
    );
  }

  let inserted = 0;
  let updated = 0;

  await withTransaction(async (client) => {
    for (const record of data.records) {
      const { totalMarks, grade, resultStatus, effectiveExternalMarks } = computeResult(
        record.internalMarks,
        record.isAbsent ? 0 : record.externalMarks,
        data.internalMaxMarks,
        data.externalMaxMarks,
        record.isAbsent
      );

      const result = await client.query<{ created_at: Date; updated_at: Date }>(
        `INSERT INTO results
           (student_id, faculty_id, subject_id, exam_id, semester, section,
            internal_marks, internal_max_marks, external_marks, external_max_marks,
            total_marks, grade, result_status, remarks)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (student_id, subject_id) DO UPDATE SET
           faculty_id         = EXCLUDED.faculty_id,
           exam_id            = COALESCE(EXCLUDED.exam_id, results.exam_id),
           internal_marks     = EXCLUDED.internal_marks,
           internal_max_marks = EXCLUDED.internal_max_marks,
           external_marks     = EXCLUDED.external_marks,
           external_max_marks = EXCLUDED.external_max_marks,
           total_marks        = EXCLUDED.total_marks,
           grade              = EXCLUDED.grade,
           result_status      = EXCLUDED.result_status,
           remarks            = EXCLUDED.remarks,
           updated_at         = NOW()
         RETURNING created_at, updated_at`,
        [
          record.studentId,
          facultyId,
          data.subjectId,
          data.examId ?? null,
          sub[0].semester,
          data.section,
          record.internalMarks,
          data.internalMaxMarks,
          effectiveExternalMarks,
          data.externalMaxMarks,
          totalMarks,
          grade,
          resultStatus,
          record.remarks ?? null,
        ]
      );

      const row = result.rows[0];
      const wasInserted = Math.abs(row.updated_at.getTime() - row.created_at.getTime()) < 1000;
      if (wasInserted) inserted++;
      else updated++;
    }

    await auditLog({
      actorId: userId,
      action: 'BULK_SUBMIT_RESULTS',
      resource: 'results',
      resourceId: data.subjectId,
      changes: {
        section: data.section,
        internalMaxMarks: data.internalMaxMarks,
        externalMaxMarks: data.externalMaxMarks,
        totalRecords: data.records.length,
        inserted,
        updated,
      },
    });
  });

  return { inserted, updated };
}

/**
 * Updates a single result, recomputing grade and result_status.
 *  – Admin: may update any result (Draft or Published).
 *  – Faculty: may only update their own Draft results.
 */
export async function updateResult(
  id: string,
  data: UpdateResultInput,
  userId: string,
  userRole: Role
): Promise<ResultDetail> {
  const { rows } = await query<{
    faculty_id: string;
    publication_status: PublicationStatus;
    internal_marks: string;
    internal_max_marks: string;
    external_marks: string;
    external_max_marks: string;
    result_status: ResultStatus;
  }>(
    `SELECT faculty_id, publication_status,
            internal_marks, internal_max_marks,
            external_marks, external_max_marks,
            result_status
     FROM results WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  if (!rows[0]) throw AppError.notFound('Result not found');

  const current = rows[0];

  if (userRole === 'faculty') {
    const facultyId = await resolveFacultyId(userId);
    if (current.faculty_id !== facultyId) {
      throw AppError.forbidden(
        'You can only update results you have submitted',
        'NOT_RESULT_OWNER'
      );
    }
    if (current.publication_status === 'Published') {
      throw AppError.forbidden(
        'Published results cannot be modified. Contact an administrator.',
        'RESULT_ALREADY_PUBLISHED'
      );
    }
  }

  // Determine effective values after partial update
  const newInternalMarks =
    data.internalMarks !== undefined ? data.internalMarks : parseFloat(current.internal_marks);
  const newExternalMarks =
    data.externalMarks !== undefined ? data.externalMarks : parseFloat(current.external_marks);
  const internalMaxMarks = parseFloat(current.internal_max_marks);
  const externalMaxMarks = parseFloat(current.external_max_marks);

  // isAbsent: explicit flag in data overrides, otherwise derive from current status
  const isAbsent =
    data.isAbsent !== undefined ? data.isAbsent : current.result_status === 'Absent';

  // Validate marks within max bounds
  if (newInternalMarks > internalMaxMarks) {
    throw AppError.badRequest(
      `Internal marks (${newInternalMarks}) exceed maximum (${internalMaxMarks})`,
      'INTERNAL_MARKS_EXCEED_MAX'
    );
  }
  if (!isAbsent && newExternalMarks > externalMaxMarks) {
    throw AppError.badRequest(
      `External marks (${newExternalMarks}) exceed maximum (${externalMaxMarks})`,
      'EXTERNAL_MARKS_EXCEED_MAX'
    );
  }

  const { totalMarks, grade, resultStatus, effectiveExternalMarks } = computeResult(
    newInternalMarks,
    newExternalMarks,
    internalMaxMarks,
    externalMaxMarks,
    isAbsent
  );

  const updates: string[] = [];
  const params: unknown[] = [];

  const pushUpdate = (col: string, val: unknown) => {
    params.push(val);
    updates.push(`${col} = $${params.length}`);
  };

  pushUpdate('internal_marks',  newInternalMarks);
  pushUpdate('external_marks',  effectiveExternalMarks);
  pushUpdate('total_marks',     totalMarks);
  pushUpdate('grade',           grade);
  pushUpdate('result_status',   resultStatus);

  if (data.remarks !== undefined) pushUpdate('remarks', data.remarks);

  params.push(id);
  await query(
    `UPDATE results SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`,
    params
  );

  await auditLog({
    actorId: userId,
    action: 'UPDATE_RESULT',
    resource: 'results',
    resourceId: id,
    changes: { ...data, recomputedGrade: grade, recomputedStatus: resultStatus },
  });

  return getResultById(id);
}

/**
 * Bulk-publishes all Draft results for a subject+section.
 * Returns the count of results transitioned to Published.
 */
export async function publishResults(
  criteria: PublishResultsInput,
  userId: string
): Promise<{ published: number }> {
  const { rows } = await query<{ id: string }>(
    `UPDATE results
     SET publication_status = 'Published', published_at = NOW(), updated_at = NOW()
     WHERE subject_id          = $1
       AND section             = $2
       AND publication_status  = 'Draft'
       AND deleted_at          IS NULL
     RETURNING id`,
    [criteria.subjectId, criteria.section]
  );

  await auditLog({
    actorId: userId,
    action: 'PUBLISH_RESULTS',
    resource: 'results',
    resourceId: criteria.subjectId,
    changes: { section: criteria.section, published: rows.length },
  });

  return { published: rows.length };
}

/**
 * Soft-deletes a result. Admin only — enforced at the route level.
 */
export async function deleteResult(id: string, userId: string): Promise<void> {
  const { rows } = await query<{ id: string }>(
    'SELECT id FROM results WHERE id = $1 AND deleted_at IS NULL',
    [id]
  );
  if (!rows[0]) throw AppError.notFound('Result not found');

  await query(
    'UPDATE results SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1',
    [id]
  );

  await auditLog({
    actorId: userId,
    action: 'DELETE_RESULT',
    resource: 'results',
    resourceId: id,
    changes: {},
  });
}
