import { query } from '../config/database';
import { auditLog } from '../utils/audit';
import { AppError } from '../errors/AppError';
import type {
  CreateSubjectInput,
  UpdateSubjectInput,
  UpdateSubjectStatusInput,
  ListSubjectsQuery,
  SubjectDetail,
  PaginatedSubjects,
  CreateCurriculumMappingInput,
  UpdateCurriculumMappingInput,
} from '../types/subject';

// ── Helper: Map Raw Year/Semester to absolute Semester (1-8) ────────────────────

export function mapYearSemToSemester(year?: string | null, semRaw?: string | null): number {
  if (!year || !semRaw) return 1;

  const y = year.toUpperCase();
  const s = semRaw.toUpperCase();

  if (y === 'I') return s === 'II' ? 2 : 1;
  if (y === 'II') return s === 'II' ? 4 : 3;
  if (y === 'III') return s === 'II' ? 6 : 5;
  if (y === 'IV') return s === 'II' ? 8 : 7;

  return 1;
}

// ── Validation helper ─────────────────────────────────────────────────────────

async function validateProgramPlacement(
  departmentId: string,
  programId: string,
  semester: number
): Promise<void> {
  const { rows: prog } = await query<{ department_id: string; total_semesters: number }>(
    'SELECT department_id, total_semesters FROM programs WHERE id = $1 AND deleted_at IS NULL',
    [programId]
  );
  if (!prog[0]) throw AppError.notFound('Program not found');
  if (prog[0].department_id !== departmentId) {
    throw AppError.badRequest(
      'Program does not belong to the specified department',
      'PROGRAM_DEPT_MISMATCH'
    );
  }
  if (semester > prog[0].total_semesters) {
    throw AppError.badRequest(
      `Semester ${semester} exceeds this program's duration of ${prog[0].total_semesters} semesters`,
      'SEMESTER_OUT_OF_RANGE'
    );
  }
}

// ── Read operations ───────────────────────────────────────────────────────────

export async function getSubjectById(id: string): Promise<SubjectDetail> {
  // 1. Fetch Subject Master Details
  const { rows: subRows } = await query<any>(
    `SELECT id, code, name, credits, type, status, lecture_hours, tutorial_hours, practical_hours, description, created_at, updated_at
     FROM subjects
     WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  if (!subRows[0]) throw AppError.notFound('Subject not found');
  const sub = subRows[0];

  // 2. Fetch Curriculum Mappings for this Subject
  const { rows: mapRows } = await query<any>(
    `SELECT scm.id, scm.subject_id, scm.department_id, d.name AS department_name, d.code AS department_code,
            scm.program_id, p.name AS program_name, p.code AS program_code, scm.program,
            scm.regulation, scm.year, scm.semester, scm.semester_raw, scm.created_at, scm.updated_at
     FROM subject_curriculum_mappings scm
     JOIN departments d ON d.id = scm.department_id
     LEFT JOIN programs p ON p.id = scm.program_id
     WHERE scm.subject_id = $1 AND scm.deleted_at IS NULL`,
    [id]
  );

  return {
    id: sub.id,
    code: sub.code,
    name: sub.name,
    credits: Number(sub.credits),
    type: sub.type,
    status: sub.status,
    lectureHours: sub.lecture_hours,
    tutorialHours: sub.tutorial_hours,
    practicalHours: sub.practical_hours,
    description: sub.description,
    createdAt: sub.created_at,
    updatedAt: sub.updated_at,
    mappings: mapRows.map((m: any) => ({
      id: m.id,
      subjectId: m.subject_id,
      departmentId: m.department_id,
      departmentName: m.department_name,
      departmentCode: m.department_code,
      programId: m.program_id,
      programName: m.program || m.program_name || null,
      programCode: m.program_code,
      program: m.program,
      regulation: m.regulation,
      year: m.year,
      semester: m.semester,
      semesterRaw: m.semester_raw,
      createdAt: m.created_at,
      updatedAt: m.updated_at,
    })),
  };
}

export async function listSubjects(filters: ListSubjectsQuery): Promise<PaginatedSubjects> {
  const conditions: string[] = ['s.deleted_at IS NULL'];
  const params: unknown[] = [];

  const push = (condition: string, value: unknown) => {
    params.push(value);
    conditions.push(`${condition} $${params.length}`);
  };

  const hasCurriculumFilter = !!(
    filters.departmentId ||
    filters.programId ||
    filters.program ||
    filters.semester ||
    filters.regulation ||
    filters.year
  );

  let queryText = '';

  if (hasCurriculumFilter) {
    // Return mapping-specific rows
    if (filters.departmentId) push('scm.department_id =', filters.departmentId);
    if (filters.programId) push('scm.program_id =', filters.programId);
    if (filters.semester) push('scm.semester =', filters.semester);
    if (filters.regulation) push('scm.regulation =', filters.regulation);
    if (filters.year) push('scm.year =', filters.year);
    if (filters.type) push('s.type =', filters.type);
    if (filters.status) push('s.status =', filters.status);

    if (filters.program) {
      params.push(`%${filters.program}%`);
      conditions.push(`(scm.program ILIKE $${params.length} OR p.name ILIKE $${params.length})`);
    }

    if (filters.search) {
      const term = `%${filters.search}%`;
      params.push(term);
      conditions.push(`(s.name ILIKE $${params.length} OR s.code ILIKE $${params.length})`);
    }

    const offset = (filters.page - 1) * filters.limit;
    params.push(filters.limit, offset);

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    queryText = `
      SELECT s.id, s.code, s.name, s.credits, s.type, s.status,
             s.lecture_hours, s.tutorial_hours, s.practical_hours,
             scm.id AS mapping_id, scm.department_id, d.name AS department_name, d.code AS department_code,
             scm.program_id, p.name AS program_name, p.code AS program_code, scm.program,
             scm.regulation, scm.year, scm.semester, scm.semester_raw,
             COUNT(*) OVER() AS total_count
      FROM subject_curriculum_mappings scm
      JOIN subjects s ON s.id = scm.subject_id
      JOIN departments d ON d.id = scm.department_id
      LEFT JOIN programs p ON p.id = scm.program_id
      ${whereClause} AND scm.deleted_at IS NULL
      ORDER BY scm.regulation DESC, scm.semester ASC, s.code ASC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;
  } else {
    // General View: Unique subjects grouped by master
    if (filters.type) push('s.type =', filters.type);
    if (filters.status) push('s.status =', filters.status);

    if (filters.search) {
      const term = `%${filters.search}%`;
      params.push(term);
      conditions.push(`(s.name ILIKE $${params.length} OR s.code ILIKE $${params.length})`);
    }

    const offset = (filters.page - 1) * filters.limit;
    params.push(filters.limit, offset);

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    queryText = `
      SELECT s.id, s.code, s.name, s.credits, s.type, s.status,
             s.lecture_hours, s.tutorial_hours, s.practical_hours,
             (
               SELECT JSON_AGG(JSON_BUILD_OBJECT(
                 'id', scm.id,
                 'departmentId', scm.department_id,
                 'departmentName', d.name,
                 'departmentCode', d.code,
                 'programId', scm.program_id,
                 'programName', COALESCE(scm.program, p.name),
                 'regulation', scm.regulation,
                 'year', scm.year,
                 'semester', scm.semester,
                 'semesterRaw', scm.semester_raw
               ))
               FROM subject_curriculum_mappings scm
               JOIN departments d ON d.id = scm.department_id
               LEFT JOIN programs p ON p.id = scm.program_id
               WHERE scm.subject_id = s.id AND scm.deleted_at IS NULL
             ) AS mappings_json,
             COUNT(*) OVER() AS total_count
      FROM subjects s
      ${whereClause}
      ORDER BY s.code ASC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;
  }

  const { rows } = await query<any>(queryText, params);
  const total = rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0;

  const mappedSubjects = rows.map((r: any) => {
    if (hasCurriculumFilter) {
      return {
        id: r.id,
        code: r.code,
        name: r.name,
        credits: Number(r.credits),
        type: r.type,
        status: r.status,
        lectureHours: r.lecture_hours,
        tutorialHours: r.tutorial_hours,
        practicalHours: r.practical_hours,
        departmentId: r.department_id,
        departmentName: r.department_name,
        programId: r.program_id,
        programName: r.program || r.program_name || null,
        regulation: r.regulation,
        year: r.year,
        semester: r.semester,
        semesterRaw: r.semester_raw,
      };
    } else {
      return {
        id: r.id,
        code: r.code,
        name: r.name,
        credits: Number(r.credits),
        type: r.type,
        status: r.status,
        lectureHours: r.lecture_hours,
        tutorialHours: r.tutorial_hours,
        practicalHours: r.practical_hours,
        mappings: r.mappings_json || [],
      };
    }
  });

  return {
    subjects: mappedSubjects,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.ceil(total / filters.limit),
    },
  };
}

// ── Write operations ──────────────────────────────────────────────────────────

export async function createSubject(
  data: CreateSubjectInput,
  actorId: string
): Promise<SubjectDetail> {
  // Validate department exists
  const { rows: dept } = await query<{ id: string }>(
    'SELECT id FROM departments WHERE id = $1 AND deleted_at IS NULL',
    [data.departmentId]
  );
  if (!dept[0]) throw AppError.notFound('Department not found');

  let calculatedSemester = data.semester || 1;
  if (data.year && data.semesterRaw) {
    calculatedSemester = mapYearSemToSemester(data.year, data.semesterRaw);
  }

  // Validate program belongs to department and semester is in range (only if programId is set)
  if (data.programId) {
    await validateProgramPlacement(data.departmentId, data.programId, calculatedSemester);
  }

  // Check if Subject Code already exists in subjects table
  const { rows: existingSub } = await query<{ id: string }>(
    'SELECT id FROM subjects WHERE code = $1 AND deleted_at IS NULL LIMIT 1',
    [data.code]
  );

  let subjectId: string;

  if (existingSub[0]) {
    // Reuse existing subject
    subjectId = existingSub[0].id;

    // Check if mapping already exists
    const { rows: dupMap } = await query(
      `SELECT id FROM subject_curriculum_mappings
       WHERE subject_id = $1 AND department_id = $2 AND COALESCE(program, '') = COALESCE($3, '')
         AND regulation = $4 AND year = $5 AND semester = $6 AND deleted_at IS NULL LIMIT 1`,
      [subjectId, data.departmentId, data.program || null, data.regulation || 'R22', data.year || 'I', calculatedSemester]
    );
    if (dupMap[0]) {
      throw AppError.badRequest('Curriculum mapping already exists for this subject', 'DUPLICATE_MAPPING');
    }

    // Insert new curriculum mapping
    const { rows: mappingRow } = await query<{ id: string }>(
      `INSERT INTO subject_curriculum_mappings (
        subject_id, department_id, program_id, program, regulation, year, semester, semester_raw
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [
        subjectId,
        data.departmentId,
        data.programId || null,
        data.program || null,
        data.regulation || 'R22',
        data.year || 'I',
        calculatedSemester,
        data.semesterRaw || null,
      ]
    );

    await auditLog({
      actorId,
      action: 'CREATE_CURRICULUM_MAPPING',
      resource: 'subject_curriculum_mappings',
      resourceId: mappingRow[0].id,
      changes: { subjectId, ...data },
    });
  } else {
    // Create new master subject
    const { rows: newSubRow } = await query<{ id: string }>(
      `INSERT INTO subjects (
        code, name, credits, type, status,
        lecture_hours, tutorial_hours, practical_hours, description
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [
        data.code,
        data.name,
        data.credits,
        data.type,
        data.status || 'active',
        data.lectureHours || 0,
        data.tutorialHours || 0,
        data.practicalHours || 0,
        data.description || null,
      ]
    );
    subjectId = newSubRow[0].id;

    // Create curriculum mapping
    const { rows: mappingRow } = await query<{ id: string }>(
      `INSERT INTO subject_curriculum_mappings (
        subject_id, department_id, program_id, program, regulation, year, semester, semester_raw
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [
        subjectId,
        data.departmentId,
        data.programId || null,
        data.program || null,
        data.regulation || 'R22',
        data.year || 'I',
        calculatedSemester,
        data.semesterRaw || null,
      ]
    );

    await auditLog({
      actorId,
      action: 'CREATE_SUBJECT',
      resource: 'subjects',
      resourceId: subjectId,
      changes: { code: data.code, name: data.name, type: data.type },
    });

    await auditLog({
      actorId,
      action: 'CREATE_CURRICULUM_MAPPING',
      resource: 'subject_curriculum_mappings',
      resourceId: mappingRow[0].id,
      changes: { subjectId, ...data },
    });
  }

  return getSubjectById(subjectId);
}

export async function updateSubject(
  id: string,
  data: UpdateSubjectInput,
  actorId: string
): Promise<SubjectDetail> {
  const setClauses: string[] = [];
  const params: unknown[] = [];

  const set = (col: string, val: unknown) => {
    params.push(val);
    setClauses.push(`${col} = $${params.length}`);
  };

  if (data.name !== undefined) set('name', data.name);
  if (data.credits !== undefined) set('credits', data.credits);
  if (data.type !== undefined) set('type', data.type);
  if (data.lectureHours !== undefined) set('lecture_hours', data.lectureHours);
  if (data.tutorialHours !== undefined) set('tutorial_hours', data.tutorialHours);
  if (data.practicalHours !== undefined) set('practical_hours', data.practicalHours);
  if (data.description !== undefined) set('description', data.description);
  if (data.status !== undefined) set('status', data.status);

  if (setClauses.length > 0) {
    params.push(id);
    const { rowCount } = await query(
      `UPDATE subjects
       SET ${setClauses.join(', ')}, updated_at = NOW()
       WHERE id = $${params.length} AND deleted_at IS NULL`,
      params
    );
    if (!rowCount) throw AppError.notFound('Subject not found');

    await auditLog({
      actorId,
      action: 'UPDATE_SUBJECT',
      resource: 'subjects',
      resourceId: id,
      changes: data as Record<string, unknown>,
    });
  }

  return getSubjectById(id);
}

export async function updateSubjectStatus(
  id: string,
  data: UpdateSubjectStatusInput,
  actorId: string
): Promise<SubjectDetail> {
  const { rowCount } = await query(
    `UPDATE subjects SET status = $1, updated_at = NOW()
     WHERE id = $2 AND deleted_at IS NULL`,
    [data.status, id]
  );
  if (!rowCount) throw AppError.notFound('Subject not found');

  await auditLog({
    actorId,
    action: 'UPDATE_SUBJECT_STATUS',
    resource: 'subjects',
    resourceId: id,
    changes: { status: data.status },
  });

  return getSubjectById(id);
}

export async function deleteSubject(id: string, actorId: string): Promise<void> {
  // Check if subject is actively referenced in allocations, attendance, etc.
  const { rows: fsa } = await query(
    'SELECT 1 FROM faculty_subject_assignments WHERE subject_id = $1 AND deleted_at IS NULL LIMIT 1',
    [id]
  );
  const { rows: att } = await query(
    'SELECT 1 FROM attendance WHERE subject_id = $1 LIMIT 1',
    [id]
  );
  const { rows: lmsMat } = await query(
    'SELECT 1 FROM course_materials WHERE subject_id = $1 AND deleted_at IS NULL LIMIT 1',
    [id]
  );
  const { rows: lmsAss } = await query(
    'SELECT 1 FROM assignments WHERE subject_id = $1 AND deleted_at IS NULL LIMIT 1',
    [id]
  );
  const { rows: marks } = await query(
    'SELECT 1 FROM internal_marks WHERE subject_id = $1 LIMIT 1',
    [id]
  );
  const { rows: results } = await query(
    'SELECT 1 FROM results WHERE subject_id = $1 LIMIT 1',
    [id]
  );
  const { rows: tp } = await query(
    'SELECT 1 FROM teaching_plans WHERE subject_id = $1 AND deleted_at IS NULL LIMIT 1',
    [id]
  );

  if (fsa[0] || att[0] || lmsMat[0] || lmsAss[0] || marks[0] || results[0] || tp[0]) {
    throw AppError.badRequest(
      'This subject is currently in use and cannot be deleted. Please remove curriculum mappings or mark it as archived instead.',
      'SUBJECT_IN_USE'
    );
  }

  // Soft delete subject master
  const { rowCount } = await query(
    `UPDATE subjects
     SET deleted_at = NOW(), status = 'archived'
     WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  if (!rowCount) throw AppError.notFound('Subject not found');

  // Cascade soft delete of mappings
  await query(
    `UPDATE subject_curriculum_mappings
     SET deleted_at = NOW()
     WHERE subject_id = $1 AND deleted_at IS NULL`,
    [id]
  );

  await auditLog({
    actorId,
    action: 'DELETE_SUBJECT',
    resource: 'subjects',
    resourceId: id,
  });
}

export async function deleteAllSubjects(
  actorId: string
): Promise<{ deletedCount: number; skippedCount: number }> {
  // Soft delete all active subjects
  const { rowCount } = await query(
    `UPDATE subjects
     SET deleted_at = NOW(), status = 'archived'
     WHERE deleted_at IS NULL`
  );
  const count = rowCount || 0;

  // Cascade soft delete of mappings
  await query(
    `UPDATE subject_curriculum_mappings
     SET deleted_at = NOW()
     WHERE deleted_at IS NULL`
  );

  await auditLog({
    actorId,
    action: 'DELETE_SUBJECT',
    resource: 'subjects',
    resourceId: 'all',
    changes: { count },
  });

  return {
    deletedCount: count,
    skippedCount: 0,
  };
}

// ── Curriculum Mapping Specific Operations ───────────────────────────────────

export async function createCurriculumMapping(
  subjectId: string,
  data: CreateCurriculumMappingInput,
  actorId: string
): Promise<string> {
  const { rows: sub } = await query('SELECT id FROM subjects WHERE id = $1 AND deleted_at IS NULL', [subjectId]);
  if (!sub[0]) throw AppError.notFound('Subject not found');

  const { rows: dept } = await query('SELECT id FROM departments WHERE id = $1 AND deleted_at IS NULL', [data.departmentId]);
  if (!dept[0]) throw AppError.notFound('Department not found');

  let calculatedSemester = data.semester || 1;
  if (data.year && data.semesterRaw) {
    calculatedSemester = mapYearSemToSemester(data.year, data.semesterRaw);
  }

  if (data.programId) {
    await validateProgramPlacement(data.departmentId, data.programId, calculatedSemester);
  }

  // Validate mapping uniqueness
  const { rows: dup } = await query(
    `SELECT id FROM subject_curriculum_mappings
     WHERE subject_id = $1 AND department_id = $2 AND COALESCE(program, '') = COALESCE($3, '')
       AND regulation = $4 AND year = $5 AND semester = $6 AND deleted_at IS NULL LIMIT 1`,
    [subjectId, data.departmentId, data.program || null, data.regulation || 'R22', data.year, calculatedSemester]
  );
  if (dup[0]) {
    throw AppError.badRequest('Curriculum mapping already exists for this subject', 'DUPLICATE_MAPPING');
  }

  const { rows } = await query<{ id: string }>(
    `INSERT INTO subject_curriculum_mappings (
       subject_id, department_id, program_id, program, regulation, year, semester, semester_raw
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [
      subjectId,
      data.departmentId,
      data.programId || null,
      data.program || null,
      data.regulation || 'R22',
      data.year,
      calculatedSemester,
      data.semesterRaw || null,
    ]
  );

  const mappingId = rows[0].id;

  await auditLog({
    actorId,
    action: 'CREATE_CURRICULUM_MAPPING',
    resource: 'subject_curriculum_mappings',
    resourceId: mappingId,
    changes: { subjectId, ...data },
  });

  return mappingId;
}

export async function updateCurriculumMapping(
  mappingId: string,
  data: UpdateCurriculumMappingInput,
  actorId: string
): Promise<SubjectDetail> {
  const { rows: current } = await query<any>(
    'SELECT id, subject_id, department_id, program_id, program, regulation, year, semester, semester_raw FROM subject_curriculum_mappings WHERE id = $1 AND deleted_at IS NULL',
    [mappingId]
  );
  if (!current[0]) throw AppError.notFound('Curriculum mapping not found');

  const mapping = current[0];

  const newDeptId = data.departmentId ?? mapping.department_id;
  const newProgId = data.programId !== undefined ? data.programId : mapping.program_id;
  let newYear = data.year ?? mapping.year;
  let newSemRaw = data.semesterRaw !== undefined ? data.semesterRaw : mapping.semester_raw;
  let newSemester = mapping.semester;

  if (data.year !== undefined || data.semesterRaw !== undefined) {
     newSemester = mapYearSemToSemester(newYear, newSemRaw);
  } else if (data.semester !== undefined && data.semester !== null) {
     newSemester = data.semester;
  }

  if (newProgId) {
    await validateProgramPlacement(newDeptId, newProgId, newSemester);
  }

  const setClauses: string[] = [];
  const params: unknown[] = [];

  const set = (col: string, val: unknown) => {
    params.push(val);
    setClauses.push(`${col} = $${params.length}`);
  };

  if (data.departmentId !== undefined) set('department_id', data.departmentId);
  set('program_id', newProgId);
  if (data.program !== undefined) set('program', data.program);
  if (data.regulation !== undefined) set('regulation', data.regulation);
  set('year', newYear);
  set('semester', newSemester);
  set('semester_raw', newSemRaw);

  params.push(mappingId);
  const { rowCount } = await query(
    `UPDATE subject_curriculum_mappings
     SET ${setClauses.join(', ')}, updated_at = NOW()
     WHERE id = $${params.length} AND deleted_at IS NULL`,
    params
  );
  if (!rowCount) throw AppError.notFound('Curriculum mapping not found');

  await auditLog({
    actorId,
    action: 'UPDATE_CURRICULUM_MAPPING',
    resource: 'subject_curriculum_mappings',
    resourceId: mappingId,
    changes: data as Record<string, unknown>,
  });

  return getSubjectById(mapping.subject_id);
}

export async function deleteCurriculumMapping(mappingId: string, actorId: string): Promise<SubjectDetail> {
  const { rows: mapping } = await query<{ subject_id: string }>(
    'SELECT subject_id FROM subject_curriculum_mappings WHERE id = $1 AND deleted_at IS NULL',
    [mappingId]
  );
  if (!mapping[0]) throw AppError.notFound('Curriculum mapping not found');

  // Verify that this mapping has no active allocations
  const { rows: allocs } = await query(
    'SELECT 1 FROM faculty_subject_assignments WHERE subject_curriculum_mapping_id = $1 AND deleted_at IS NULL LIMIT 1',
    [mappingId]
  );
  if (allocs[0]) {
    throw AppError.badRequest('This curriculum mapping has active faculty allocations and cannot be removed.', 'MAPPING_IN_USE');
  }

  const { rowCount } = await query(
    `UPDATE subject_curriculum_mappings
     SET deleted_at = NOW()
     WHERE id = $1 AND deleted_at IS NULL`,
    [mappingId]
  );
  if (!rowCount) throw AppError.notFound('Curriculum mapping not found');

  await auditLog({
    actorId,
    action: 'DELETE_CURRICULUM_MAPPING',
    resource: 'subject_curriculum_mappings',
    resourceId: mappingId,
  });

  return getSubjectById(mapping[0].subject_id);
}
