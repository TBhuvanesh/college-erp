import { query } from '../config/database';
import { auditLog } from '../utils/audit';
import { AppError } from '../errors/AppError';
import { emitWorkflowEvent } from './workflowEngine.service';
import { getTeachingLoadSettings } from './teachingLoadSettings.service';
import type {
  TeachingAssignmentDetail,
  CreateTeachingAssignmentInput,
  UpdateTeachingAssignmentInput,
  ListTeachingAssignmentsQuery,
  ResolveSubjectsForAssignmentQuery,
} from '../types/teachingAssignment';
import type { FacultyWorkloadOverview, FacultyTeachingLoadRow } from '../types/facultyTeachingLoad';

// ── Shared query fragments ─────────────────────────────────────────────────────

const DETAIL_COLS = `
  ta.id,
  ta.faculty_id AS "facultyId",
  f.full_name AS "facultyName",
  f.employee_number AS "employeeNumber",
  scm.subject_id AS "subjectId",
  s.code AS "subjectCode",
  s.name AS "subjectName",
  scm.department_id AS "departmentId",
  d.name AS "departmentName",
  scm.semester,
  ta.section,
  ta.academic_year AS "academicYear",
  ta.status,
  ta.start_date AS "startDate",
  ta.end_date AS "endDate",
  ta.weekly_teaching_hours AS "weeklyTeachingHours",
  ta.created_by AS "createdBy",
  u_creator.full_name AS "createdByName",
  ta.created_at AS "createdAt",
  ta.updated_at AS "updatedAt",
  ta.removed_by AS "removedBy",
  u_remover.full_name AS "removedByName",
  ta.deleted_at AS "removedAt",
  ta.removal_reason AS "removalReason"
`;

const JOINS = `
  JOIN faculty f ON f.id = ta.faculty_id
  JOIN subject_curriculum_mappings scm ON scm.id = ta.subject_curriculum_mapping_id
  JOIN subjects s ON s.id = scm.subject_id
  JOIN departments d ON d.id = scm.department_id
  LEFT JOIN users u_creator ON u_creator.id = ta.created_by
  LEFT JOIN users u_remover ON u_remover.id = ta.removed_by
`;

// ── Read operations ───────────────────────────────────────────────────────────

export async function getAllocationById(id: string): Promise<TeachingAssignmentDetail> {
  const { rows } = await query<any>(
    `SELECT ${DETAIL_COLS} FROM teaching_assignments ta ${JOINS}
     WHERE ta.id = $1 AND ta.deleted_at IS NULL`,
    [id]
  );
  if (!rows[0]) throw AppError.notFound('Teaching assignment not found');
  return rows[0] as TeachingAssignmentDetail;
}

export async function getAllocations(filters: ListTeachingAssignmentsQuery): Promise<TeachingAssignmentDetail[]> {
  const conditions: string[] = ['ta.deleted_at IS NULL'];
  const params: unknown[] = [];

  const push = (condition: string, value: unknown) => {
    params.push(value);
    conditions.push(`${condition} $${params.length}`);
  };

  if (filters.departmentId) push('scm.department_id =', filters.departmentId);
  if (filters.semester) push('scm.semester =', filters.semester);
  if (filters.section) push('ta.section =', filters.section);
  if (filters.subjectId) push('scm.subject_id =', filters.subjectId);
  if (filters.facultyId) push('ta.faculty_id =', filters.facultyId);
  if (filters.academicYear) push('ta.academic_year =', filters.academicYear);
  if (filters.status) push('ta.status =', filters.status);

  if (filters.search) {
    params.push(`%${filters.search}%`);
    conditions.push(
      `(f.full_name ILIKE $${params.length} OR s.name ILIKE $${params.length} OR s.code ILIKE $${params.length})`
    );
  }

  const { rows } = await query<any>(
    `SELECT ${DETAIL_COLS} FROM teaching_assignments ta ${JOINS}
     WHERE ${conditions.join(' AND ')}
     ORDER BY ta.academic_year DESC, d.name ASC, scm.semester ASC, s.code ASC, ta.section ASC`,
    params
  );
  return rows as TeachingAssignmentDetail[];
}

// Faculty Dashboard / Teaching Planner / Attendance / LMS all resolve "my
// teaching assignments" through this single function instead of each
// independently querying faculty+subject — this is the "faculty should
// never manually search for their subject" requirement.
export async function resolveMyTeachingAssignments(facultyId: string, academicYear?: string): Promise<TeachingAssignmentDetail[]> {
  return getAllocations({ facultyId, academicYear, status: 'active' } as ListTeachingAssignmentsQuery);
}

// ── Write operations ──────────────────────────────────────────────────────────

export async function createAllocation(
  data: CreateTeachingAssignmentInput,
  actorId: string
): Promise<{ allocation: TeachingAssignmentDetail; warning?: string }> {
  const { rows: f } = await query<{ id: string; department_id: string }>(
    'SELECT id, department_id FROM faculty WHERE id = $1 AND deleted_at IS NULL',
    [data.facultyId]
  );
  if (!f[0]) throw AppError.notFound('Faculty member not found');

  const { rows: s } = await query<{ id: string; status: string }>(
    'SELECT id, status FROM subjects WHERE id = $1 AND deleted_at IS NULL',
    [data.subjectId]
  );
  if (!s[0]) throw AppError.notFound('Subject not found');
  if (s[0].status === 'archived') {
    throw AppError.badRequest('Cannot assign an archived subject', 'SUBJECT_ARCHIVED');
  }

  let scmId: string;
  let scmDeptId = f[0].department_id;

  if (data.departmentId && data.regulation && data.year && data.semester) {
    const { rows: scm } = await query<{ id: string; department_id: string }>(
      `SELECT id, department_id FROM subject_curriculum_mappings
       WHERE subject_id = $1 
         AND department_id = $2 
         AND (program_id = $3 OR program_id IS NULL)
         AND regulation = $4 
         AND year = $5 
         AND semester = $6 
         AND deleted_at IS NULL LIMIT 1`,
      [data.subjectId, data.departmentId, data.programId || null, data.regulation, data.year, data.semester]
    );
    if (!scm[0]) {
      throw AppError.badRequest("Subject is not mapped to the selected curriculum context", 'CURRICULUM_MISMATCH');
    }
    scmId = scm[0].id;
    scmDeptId = scm[0].department_id;
  } else {
    const { rows: scm } = await query<{ id: string; department_id: string }>(
      `SELECT id, department_id FROM subject_curriculum_mappings
       WHERE subject_id = $1 AND department_id = $2 AND deleted_at IS NULL LIMIT 1`,
      [data.subjectId, f[0].department_id]
    );
    if (!scm[0]) {
      throw AppError.badRequest("Subject is not mapped to the faculty member's department curriculum", 'CURRICULUM_MISMATCH');
    }
    scmId = scm[0].id;
    scmDeptId = scm[0].department_id;
  }

  const { rows: duplicate } = await query<{ id: string }>(
    `SELECT id FROM teaching_assignments
     WHERE subject_curriculum_mapping_id = $1 AND academic_year = $2 AND section = $3 AND deleted_at IS NULL LIMIT 1`,
    [scmId, data.academicYear, data.section]
  );
  if (duplicate[0]) {
    throw AppError.badRequest(
      'Duplicate Teaching Assignment: This subject and section combination is already assigned to a faculty member for this academic year',
      'DUPLICATE_ALLOCATION'
    );
  }

  const { rows: workload } = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM teaching_assignments
     WHERE faculty_id = $1 AND academic_year = $2 AND is_active = TRUE AND deleted_at IS NULL`,
    [data.facultyId, data.academicYear]
  );
  const currentLoadCount = parseInt(workload[0].count, 10);
  const settings = await getTeachingLoadSettings();
  let warning: string | undefined;
  if (currentLoadCount >= settings.maxSubjectsPerFaculty) {
    warning = `Workload Warning: Faculty currently has ${currentLoadCount} active teaching assignments. Exceeding configured limit of ${settings.maxSubjectsPerFaculty}.`;
  }

  const isActive = data.status === 'active';
  const { rows } = await query<{ id: string }>(
    `INSERT INTO teaching_assignments (
      faculty_id, subject_id, subject_curriculum_mapping_id, department_id, academic_year, section,
      status, is_active, start_date, end_date, weekly_teaching_hours, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING id`,
    [
      data.facultyId,
      data.subjectId,
      scmId,
      scmDeptId,
      data.academicYear,
      data.section,
      data.status,
      isActive,
      data.startDate ?? null,
      data.endDate ?? null,
      data.weeklyTeachingHours ?? null,
      actorId,
    ]
  );
  const allocationId = rows[0].id;

  await auditLog({
    actorId,
    action: 'CREATE_TEACHING_ASSIGNMENT',
    resource: 'teaching_assignments',
    resourceId: allocationId,
    changes: { ...data, isActive },
  });

  const allocation = await getAllocationById(allocationId);

  // "Teaching Assignment Created" workflow event — downstream faculty
  // dashboard/planner/LMS/attendance need no explicit sync since they all
  // read live via teaching_assignment_id; this just handles the faculty
  // notification / audit-adjacent side effect through the shared engine.
  await emitWorkflowEvent('teaching_assignment.created', actorId, {
    departmentId: allocation.departmentId,
    semester: allocation.semester,
    title: 'New Teaching Assignment',
    message: `You have been assigned to teach ${allocation.subjectName} (Section ${allocation.section}) for ${allocation.academicYear}.`,
    notificationType: 'Academic Alert',
    sourceId: allocationId,
    facultyId: allocation.facultyId,
  });

  return { allocation, warning };
}

export async function updateAllocation(
  id: string,
  data: UpdateTeachingAssignmentInput,
  actorId: string
): Promise<{ allocation: TeachingAssignmentDetail; warning?: string }> {
  const existing = await getAllocationById(id);

  const facultyId = data.facultyId || existing.facultyId;
  const subjectId = data.subjectId || existing.subjectId;
  const section = data.section || existing.section;

  const { rows: f } = await query<{ id: string; department_id: string }>(
    'SELECT id, department_id FROM faculty WHERE id = $1 AND deleted_at IS NULL',
    [facultyId]
  );
  if (!f[0]) throw AppError.notFound('Faculty member not found');

  const { rows: s } = await query<{ id: string; status: string }>(
    'SELECT id, status FROM subjects WHERE id = $1 AND deleted_at IS NULL',
    [subjectId]
  );
  if (!s[0]) throw AppError.notFound('Subject not found');
  if (s[0].status === 'archived') {
    throw AppError.badRequest('Cannot assign an archived subject', 'SUBJECT_ARCHIVED');
  }

  const { rows: scm } = await query<{ id: string; department_id: string }>(
    `SELECT id, department_id FROM subject_curriculum_mappings
     WHERE subject_id = $1 AND department_id = $2 AND deleted_at IS NULL LIMIT 1`,
    [subjectId, f[0].department_id]
  );
  if (!scm[0]) {
    throw AppError.badRequest("Subject is not mapped to the faculty member's department curriculum", 'CURRICULUM_MISMATCH');
  }
  const scmId = scm[0].id;

  const { rows: duplicate } = await query<{ id: string }>(
    `SELECT id FROM teaching_assignments
     WHERE subject_id = $1 AND academic_year = $2 AND section = $3 AND id != $4 AND deleted_at IS NULL LIMIT 1`,
    [subjectId, existing.academicYear, section, id]
  );
  if (duplicate[0]) {
    throw AppError.badRequest(
      'Duplicate Teaching Assignment: This subject and section combination is already assigned to a faculty member for this academic year',
      'DUPLICATE_ALLOCATION'
    );
  }

  const { rows: workload } = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM teaching_assignments
     WHERE faculty_id = $1 AND academic_year = $2 AND is_active = TRUE AND id != $3 AND deleted_at IS NULL`,
    [facultyId, existing.academicYear, id]
  );
  const currentLoadCount = parseInt(workload[0].count, 10);
  const settings = await getTeachingLoadSettings();
  let warning: string | undefined;
  if (currentLoadCount >= settings.maxSubjectsPerFaculty) {
    warning = `Workload Warning: Faculty currently has ${currentLoadCount} active teaching assignments. Exceeding configured limit of ${settings.maxSubjectsPerFaculty}.`;
  }

  const setClauses: string[] = [];
  const params: unknown[] = [];

  const set = (col: string, val: unknown) => {
    params.push(val);
    setClauses.push(`${col} = $${params.length}`);
  };

  if (data.facultyId !== undefined) set('faculty_id', data.facultyId);
  if (data.subjectId !== undefined) {
    set('subject_id', data.subjectId);
    set('subject_curriculum_mapping_id', scmId);
    set('department_id', scm[0].department_id);
  }
  if (data.section !== undefined) set('section', data.section);
  if (data.status !== undefined) {
    set('status', data.status);
    set('is_active', data.status === 'active');
  }
  if (data.startDate !== undefined) set('start_date', data.startDate);
  if (data.endDate !== undefined) set('end_date', data.endDate);
  if (data.weeklyTeachingHours !== undefined) set('weekly_teaching_hours', data.weeklyTeachingHours);

  params.push(id);
  await query(
    `UPDATE teaching_assignments
     SET ${setClauses.join(', ')}, updated_at = NOW()
     WHERE id = $${params.length}`,
    params
  );

  await auditLog({
    actorId,
    action: 'UPDATE_TEACHING_ASSIGNMENT',
    resource: 'teaching_assignments',
    resourceId: id,
    changes: data as Record<string, unknown>,
  });

  const allocation = await getAllocationById(id);
  return { allocation, warning };
}

export async function deleteAllocation(id: string, reason: string, actorId: string): Promise<void> {
  const { rowCount } = await query(
    `UPDATE teaching_assignments
     SET deleted_at = NOW(), is_active = FALSE, status = 'inactive', removed_by = $1, removal_reason = $2
     WHERE id = $3 AND deleted_at IS NULL`,
    [actorId, reason, id]
  );
  if (!rowCount) throw AppError.notFound('Teaching assignment not found');

  await auditLog({
    actorId,
    action: 'DELETE_TEACHING_ASSIGNMENT',
    resource: 'teaching_assignments',
    resourceId: id,
    changes: { removalReason: reason },
  });
}

export async function transferAllocation(
  id: string,
  newFacultyId: string,
  actorId: string
): Promise<{ allocation: TeachingAssignmentDetail; warning?: string }> {
  const existing = await getAllocationById(id);

  const { rows: f } = await query<{ id: string; department_id: string }>(
    'SELECT id, department_id FROM faculty WHERE id = $1 AND deleted_at IS NULL',
    [newFacultyId]
  );
  if (!f[0]) throw AppError.notFound('New Faculty member not found');

  const { rows: scm } = await query<{ id: string }>(
    `SELECT id FROM subject_curriculum_mappings
     WHERE subject_id = $1 AND department_id = $2 AND deleted_at IS NULL LIMIT 1`,
    [existing.subjectId, f[0].department_id]
  );
  if (!scm[0]) {
    throw AppError.badRequest(
      "Curriculum Mismatch: Target faculty's department does not have this subject mapped in their curriculum",
      'CURRICULUM_MISMATCH'
    );
  }
  const scmId = scm[0].id;

  const { rows: workload } = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM teaching_assignments
     WHERE faculty_id = $1 AND academic_year = $2 AND id != $3 AND is_active = TRUE AND deleted_at IS NULL`,
    [newFacultyId, existing.academicYear, id]
  );
  const currentLoadCount = parseInt(workload[0].count, 10);
  const settings = await getTeachingLoadSettings();
  let warning: string | undefined;
  if (currentLoadCount >= settings.maxSubjectsPerFaculty) {
    warning = `Workload Warning: Target faculty currently has ${currentLoadCount} active teaching assignments. Exceeding configured limit of ${settings.maxSubjectsPerFaculty}.`;
  }

  await query(
    `UPDATE teaching_assignments
     SET faculty_id = $1, subject_curriculum_mapping_id = $2, updated_at = NOW()
     WHERE id = $3`,
    [newFacultyId, scmId, id]
  );

  await auditLog({
    actorId,
    action: 'TRANSFER_TEACHING_ASSIGNMENT',
    resource: 'teaching_assignments',
    resourceId: id,
    changes: { fromFacultyId: existing.facultyId, toFacultyId: newFacultyId },
  });

  const allocation = await getAllocationById(id);
  return { allocation, warning };
}

// ── Statistics & Analytics ─────────────────────────────────────────────────────

export interface WorkloadStatistics {
  totalSubjects: number;
  assignedSubjects: number;
  unassignedSubjects: number;
  facultyWithMaxWorkload: { facultyId: string; facultyName: string; employeeNumber: string; count: number } | null;
  facultyWithMinWorkload: { facultyId: string; facultyName: string; employeeNumber: string; count: number } | null;
  averageSubjectsPerFaculty: number;
  pendingAllocations: number;
  labSubjectsCount?: number;
  theorySubjectsCount?: number;
  analytics: {
    subjectsPerFaculty: { facultyName: string; count: number }[];
    departmentDistribution: { departmentName: string; count: number }[];
    semesterDistribution: { semester: number; count: number }[];
    sectionDistribution?: { section: string; count: number }[];
  };
}

export async function getWorkloadStatistics(academicYear: string): Promise<WorkloadStatistics> {
  const { rows: tSubjs } = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM subjects WHERE status = 'active' AND deleted_at IS NULL`
  );
  const totalSubjects = parseInt(tSubjs[0].count, 10);

  const { rows: aSubjs } = await query<{ count: string }>(
    `SELECT COUNT(DISTINCT subject_id)::text AS count FROM teaching_assignments
     WHERE academic_year = $1 AND is_active = TRUE AND deleted_at IS NULL`,
    [academicYear]
  );
  const assignedSubjects = parseInt(aSubjs[0].count, 10);
  const unassignedSubjects = Math.max(0, totalSubjects - assignedSubjects);

  const { rows: rankings } = await query<{ faculty_id: string; full_name: string; employee_number: string; count: string }>(
    `SELECT ta.faculty_id, f.full_name, f.employee_number, COUNT(*)::text AS count
     FROM teaching_assignments ta
     JOIN faculty f ON f.id = ta.faculty_id
     WHERE ta.academic_year = $1 AND ta.is_active = TRUE AND ta.deleted_at IS NULL
     GROUP BY ta.faculty_id, f.full_name, f.employee_number
     ORDER BY COUNT(*) DESC`,
    [academicYear]
  );

  let facultyWithMaxWorkload = null;
  let facultyWithMinWorkload = null;

  if (rankings.length > 0) {
    const maxRank = rankings[0];
    const minRank = rankings[rankings.length - 1];

    facultyWithMaxWorkload = {
      facultyId: maxRank.faculty_id,
      facultyName: maxRank.full_name,
      employeeNumber: maxRank.employee_number,
      count: parseInt(maxRank.count, 10),
    };

    facultyWithMinWorkload = {
      facultyId: minRank.faculty_id,
      facultyName: minRank.full_name,
      employeeNumber: minRank.employee_number,
      count: parseInt(minRank.count, 10),
    };
  }

  const { rows: activeFacCount } = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM faculty WHERE status = 'active' AND deleted_at IS NULL`
  );
  const facultyCount = parseInt(activeFacCount[0].count, 10);
  const averageSubjectsPerFaculty = facultyCount > 0 ? parseFloat((assignedSubjects / facultyCount).toFixed(2)) : 0;

  const { rows: pendingAlloc } = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM teaching_assignments
     WHERE academic_year = $1 AND status = 'pending' AND deleted_at IS NULL`,
    [academicYear]
  );
  const pendingAllocations = parseInt(pendingAlloc[0].count, 10);

  const subjectsPerFaculty = rankings.slice(0, 10).map((r) => ({
    facultyName: r.full_name,
    count: parseInt(r.count, 10),
  }));

  const { rows: deptDist } = await query<{ department_name: string; count: string }>(
    `SELECT d.name AS department_name, COUNT(*)::text AS count
     FROM teaching_assignments ta
     JOIN subject_curriculum_mappings scm ON scm.id = ta.subject_curriculum_mapping_id
     JOIN departments d ON d.id = scm.department_id
     WHERE ta.academic_year = $1 AND ta.deleted_at IS NULL AND scm.deleted_at IS NULL
     GROUP BY d.name
     ORDER BY COUNT(*) DESC`,
    [academicYear]
  );
  const departmentDistribution = deptDist.map((r) => ({
    departmentName: r.department_name,
    count: parseInt(r.count, 10),
  }));

  const { rows: semDist } = await query<{ semester: number; count: string }>(
    `SELECT scm.semester, COUNT(*)::text AS count
     FROM teaching_assignments ta
     JOIN subject_curriculum_mappings scm ON scm.id = ta.subject_curriculum_mapping_id
     WHERE ta.academic_year = $1 AND ta.deleted_at IS NULL AND scm.deleted_at IS NULL
     GROUP BY scm.semester
     ORDER BY scm.semester ASC`,
    [academicYear]
  );
  const semesterDistribution = semDist.map((r) => ({
    semester: Number(r.semester),
    count: parseInt(r.count, 10),
  }));

  // Query Lab vs Theory active subjects
  const { rows: labCountRes } = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM subjects WHERE type IN ('lab', 'laboratory') AND status = 'active' AND deleted_at IS NULL`
  );
  const labSubjectsCount = parseInt(labCountRes[0].count, 10);

  const { rows: theoryCountRes } = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM subjects WHERE type NOT IN ('lab', 'laboratory') AND status = 'active' AND deleted_at IS NULL`
  );
  const theorySubjectsCount = parseInt(theoryCountRes[0].count, 10);

  // Query section distribution
  const { rows: sectionDistRes } = await query<{ section: string; count: string }>(
    `SELECT section, COUNT(*)::text AS count
     FROM teaching_assignments
     WHERE academic_year = $1 AND deleted_at IS NULL AND status = 'active'
     GROUP BY section
     ORDER BY section`,
    [academicYear]
  );
  const sectionDistribution = sectionDistRes.map((r) => ({
    section: r.section,
    count: parseInt(r.count, 10),
  }));

  return {
    totalSubjects,
    assignedSubjects,
    unassignedSubjects,
    facultyWithMaxWorkload,
    facultyWithMinWorkload,
    averageSubjectsPerFaculty,
    pendingAllocations,
    labSubjectsCount,
    theorySubjectsCount,
    analytics: {
      subjectsPerFaculty,
      departmentDistribution,
      semesterDistribution,
      sectionDistribution,
    },
  };
}

// ── Faculty Teaching Load (Part 1) ─────────────────────────────────────────────
// One row per faculty instead of one row per assignment. Built entirely from
// teaching_assignments + subjects' existing L-T-P hour breakdown (migration
// 035) and the configurable Theory/Lab/Tutorial weights (migration 044) — no
// new per-subject "type weight" table, and no change to how assignments are
// stored.

export async function getFacultyWorkloadOverview(academicYear: string): Promise<FacultyWorkloadOverview> {
  const settings = await getTeachingLoadSettings();

  interface Row {
    faculty_id: string;
    faculty_name: string;
    employee_number: string;
    department_name: string;
    teaching_assignment_id: string;
    subject_id: string;
    subject_code: string;
    subject_name: string;
    subject_type: string;
    section: string;
    semester: number;
    lecture_hours: number;
    tutorial_hours: number;
    practical_hours: number;
    weekly_teaching_hours: string | null;
    mentor_groups_count: string;
  }

  const { rows } = await query<Row>(
    `SELECT
       f.id AS faculty_id, f.full_name AS faculty_name, f.employee_number,
       d.name AS department_name,
       ta.id AS teaching_assignment_id, ta.section, ta.weekly_teaching_hours,
       scm.subject_id, s.code AS subject_code, s.name AS subject_name, s.type::text AS subject_type,
       scm.semester,
       COALESCE(s.lecture_hours, 0) AS lecture_hours,
       COALESCE(s.tutorial_hours, 0) AS tutorial_hours,
       COALESCE(s.practical_hours, 0) AS practical_hours,
       (SELECT COUNT(*)::text FROM mentor_groups mg WHERE mg.mentor_id = f.id AND mg.deleted_at IS NULL) AS mentor_groups_count
     FROM teaching_assignments ta
     JOIN faculty f ON f.id = ta.faculty_id
     JOIN departments d ON d.id = ta.department_id
     JOIN subject_curriculum_mappings scm ON scm.id = ta.subject_curriculum_mapping_id
     JOIN subjects s ON s.id = scm.subject_id
     WHERE ta.academic_year = $1 AND ta.is_active = TRUE AND ta.deleted_at IS NULL
     ORDER BY f.full_name ASC, s.code ASC, ta.section ASC`,
    [academicYear]
  );

  const byFaculty = new Map<string, FacultyTeachingLoadRow>();

  for (const r of rows) {
    const lecture = Number(r.lecture_hours);
    const tutorial = Number(r.tutorial_hours);
    const practical = Number(r.practical_hours);
    const equivalentLoad =
      lecture * settings.theoryWeight + tutorial * settings.tutorialWeight + practical * settings.labWeight;

    let facultyRow = byFaculty.get(r.faculty_id);
    if (!facultyRow) {
      facultyRow = {
        facultyId: r.faculty_id,
        facultyName: r.faculty_name,
        employeeNumber: r.employee_number,
        departmentName: r.department_name,
        academicYear,
        theoryCount: 0,
        labCount: 0,
        tutorialCount: 0,
        sections: [],
        mentorGroupsCount: Number(r.mentor_groups_count),
        weeklyTeachingHoursConfigured: null,
        equivalentTeachingLoad: 0,
        maxAllowedLoad: settings.maxWeeklyLoad,
        minAllowedLoad: settings.minWeeklyLoad,
        status: 'Balanced',
        subjects: [],
      };
      byFaculty.set(r.faculty_id, facultyRow);
    }

    if (practical > 0) facultyRow.labCount += 1;
    else if (tutorial > 0 && lecture === 0) facultyRow.tutorialCount += 1;
    else facultyRow.theoryCount += 1;

    if (!facultyRow.sections.includes(r.section)) facultyRow.sections.push(r.section);
    if (r.weekly_teaching_hours !== null) {
      facultyRow.weeklyTeachingHoursConfigured = (facultyRow.weeklyTeachingHoursConfigured ?? 0) + Number(r.weekly_teaching_hours);
    }
    facultyRow.equivalentTeachingLoad += equivalentLoad;

    facultyRow.subjects.push({
      teachingAssignmentId: r.teaching_assignment_id,
      subjectId: r.subject_id,
      subjectCode: r.subject_code,
      subjectName: r.subject_name,
      subjectType: r.subject_type,
      section: r.section,
      semester: Number(r.semester),
      academicYear,
      lectureHours: lecture,
      tutorialHours: tutorial,
      practicalHours: practical,
      equivalentLoad,
    });
  }

  for (const facultyRow of byFaculty.values()) {
    facultyRow.equivalentTeachingLoad = Math.round(facultyRow.equivalentTeachingLoad * 100) / 100;
    if (facultyRow.equivalentTeachingLoad > settings.maxWeeklyLoad) {
      facultyRow.status = 'Overloaded';
    } else if (settings.minWeeklyLoad !== null && facultyRow.equivalentTeachingLoad < settings.minWeeklyLoad) {
      facultyRow.status = 'Under Minimum';
    } else {
      facultyRow.status = 'Balanced';
    }
  }

  return {
    academicYear,
    rows: Array.from(byFaculty.values()).sort((a, b) => a.facultyName.localeCompare(b.facultyName)),
  };
}

export async function getSubjectProfile(subjectId: string): Promise<any> {
  const { rows: subRows } = await query<any>(
    `SELECT id, code, name, credits, status,
            lecture_hours, tutorial_hours, practical_hours, description
     FROM subjects
     WHERE id = $1 AND deleted_at IS NULL`,
    [subjectId]
  );
  if (!subRows[0]) throw AppError.notFound('Subject not found');
  const subject = subRows[0];

  const { rows: mapRows } = await query<any>(
    `SELECT scm.id, scm.subject_id, scm.department_id, d.name AS department_name, d.code AS department_code,
            scm.program_id, p.name AS program_name, p.code AS program_code, scm.program,
            scm.regulation, scm.year, scm.semester, scm.semester_raw
     FROM subject_curriculum_mappings scm
     JOIN departments d ON d.id = scm.department_id
     LEFT JOIN programs p ON p.id = scm.program_id
     WHERE scm.subject_id = $1 AND scm.deleted_at IS NULL`,
    [subjectId]
  );

  const { rows: facRows } = await query<any>(
    `SELECT ta.id AS "allocationId", f.id AS "facultyId", f.full_name AS "facultyName",
            f.employee_number AS "employeeNumber", ta.section, ta.status, ta.academic_year AS "academicYear"
     FROM teaching_assignments ta
     JOIN faculty f ON f.id = ta.faculty_id
     WHERE ta.subject_id = $1 AND ta.deleted_at IS NULL AND ta.status = 'active'`,
    [subjectId]
  );

  const { rows: studRows } = await query<{ count: string }>(
    `SELECT COUNT(DISTINCT st.id)::text AS count FROM students st
     JOIN subject_curriculum_mappings scm ON scm.program_id = st.program_id AND scm.semester = st.current_semester
     WHERE scm.subject_id = $1 AND st.status = 'active' AND st.deleted_at IS NULL AND scm.deleted_at IS NULL`,
    [subjectId]
  );
  const studentsEnrolled = parseInt(studRows[0].count, 10);

  const { rows: attRows } = await query<{ count: string }>(
    `SELECT COUNT(DISTINCT attendance_date)::text AS count FROM attendance
     WHERE subject_id = $1`,
    [subjectId]
  );
  const attendanceSessionsLogged = parseInt(attRows[0].count, 10);

  const { rows: matRows } = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM course_materials WHERE subject_id = $1 AND deleted_at IS NULL`,
    [subjectId]
  );
  const { rows: lmsAssignRows } = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM assignments WHERE subject_id = $1 AND deleted_at IS NULL`,
    [subjectId]
  );
  const materialsCount = parseInt(matRows[0].count, 10);
  const assignmentsCount = parseInt(lmsAssignRows[0].count, 10);

  const { rows: marksRows } = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM internal_marks WHERE subject_id = $1 AND deleted_at IS NULL`,
    [subjectId]
  );
  const internalMarksSubmittedCount = parseInt(marksRows[0].count, 10);

  return {
    id: subject.id,
    code: subject.code,
    name: subject.name,
    lectureHours: subject.lecture_hours,
    tutorialHours: subject.tutorial_hours,
    practicalHours: subject.practical_hours,
    credits: subject.credits,
    status: subject.status,
    description: subject.description,
    studentsEnrolled,
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
    })),
    assignedFaculty: facRows.map((f: any) => ({
      allocationId: f.allocationId,
      facultyId: f.facultyId,
      facultyName: f.facultyName,
      employeeNumber: f.employeeNumber,
      section: f.section,
      status: f.status,
      academicYear: f.academicYear,
    })),
    sections: Array.from(new Set(facRows.map((f: any) => f.section))),
    attendanceStatus: attendanceSessionsLogged > 0 ? `Active (${attendanceSessionsLogged} sessions logged)` : 'No records logged',
    lmsStatus: `Active (${materialsCount} materials, ${assignmentsCount} assignments)`,
    internalMarksStatus: internalMarksSubmittedCount > 0 ? `Submitted (${internalMarksSubmittedCount} marks records)` : 'Pending submissions',
  };
}

export async function resolveSubjectsForAssignment(
  filters: ResolveSubjectsForAssignmentQuery
): Promise<{ subjects: any[]; warning?: string }> {
  // Trace logging
  console.log(`[Resolve Subjects API] Trace:`);
  console.log(`Department = ${filters.departmentId}`);
  console.log(`Program = ${filters.programId}`);
  console.log(`Regulation = ${filters.regulation}`);
  console.log(`Year = ${filters.year}`);
  console.log(`Semester = ${filters.semester}`);

  // 1. Fetch Curriculum Mappings
  const params = [filters.departmentId, filters.regulation, filters.semester];
  let programCondition = '';
  if (filters.programId) {
    if (filters.programId === 'B.Tech') {
      programCondition = `AND (scm.program_id IS NULL OR scm.program = 'B.Tech')`;
    } else {
      params.push(filters.programId);
      programCondition = `AND (scm.program_id = $4 OR scm.program_id IS NULL)`;
    }
  }

  const { rows: mappings } = await query<{ id: string; subject_id: string; program_id: string | null; program: string | null }>(
    `SELECT id, subject_id, program_id, program
     FROM subject_curriculum_mappings scm
     WHERE department_id = $1
       AND regulation = $2
       AND semester = $3
       ${programCondition}
       AND deleted_at IS NULL`,
    params
  );

  console.log(`↓`);
  if (mappings.length === 0) {
    console.log(`Found curriculum = NO`);
    console.log(`↓`);
    console.log(`Returning subjects`);
    return {
      subjects: [],
      warning: 'No curriculum has been created for this academic context.',
    };
  }

  console.log(`Found curriculum = YES`);

  // 2. Fetch Subjects details matching mapped subject IDs
  const subjectIds = mappings.map(m => m.subject_id);
  const { rows: subjects } = await query<{ id: string; code: string; name: string; credits: number; type: string; status: string }>(
    `SELECT id, code, name, credits, type, status 
     FROM subjects 
     WHERE id = ANY($1) 
       AND deleted_at IS NULL 
       AND status = 'active'`,
    [subjectIds]
  );

  console.log(`Found mapped subjects = ${subjects.length}`);

  // Check for orphan / missing subjects
  const resolvedIds = new Set(subjects.map(s => s.id));
  const missingSubjectIds = subjectIds.filter(id => !resolvedIds.has(id));
  if (missingSubjectIds.length > 0) {
    console.warn(`[Resolve Subjects API] Missing/Orphan Subject IDs referenced in SCM:`, missingSubjectIds);
  }

  if (subjects.length === 0) {
    console.log(`↓`);
    console.log(`Returning subjects`);
    return {
      subjects: [],
      warning: 'Curriculum exists but no subjects are mapped.',
    };
  }

  // Attach mapping details to subjects returned
  const subjectsWithMapping = subjects.map(s => {
    const matchingMapping = mappings.find(m => m.subject_id === s.id);
    return {
      ...s,
      mappingId: matchingMapping ? matchingMapping.id : null,
    };
  });

  console.log(`↓`);
  console.log(`Returning subjects`);
  return {
    subjects: subjectsWithMapping,
  };
}
