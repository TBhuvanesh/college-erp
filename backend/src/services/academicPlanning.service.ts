import { query } from '../config/database';
import { getTeachingLoadSettings } from './teachingLoadSettings.service';
import { getFacultyWorkloadOverview } from './teachingAssignment.service';
import { createAllocation } from './teachingAssignment.service';
import { suggestBalancedGroups, listMentorCandidates, createMentorGroup, getAllGroupMemberships } from './mentorGroup.service';

// ── Types ────────────────────────────────────────────────────────────────────

export interface MissingAssignment {
  departmentId: string;
  departmentName: string;
  programId: string | null;
  semester: number;
  section: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  regulation: string;
  year: string;
}

export interface UnmentoredGroup {
  departmentId: string;
  departmentName: string;
  semester: number;
  section: string;
  studentCount: number;
}

export interface GapAnalysis {
  missingAssignments: MissingAssignment[];
  unmentoredGroups: UnmentoredGroup[];
}

export interface FacultyCapacityRow {
  facultyId: string;
  facultyName: string;
  employeeNumber: string;
  departmentId: string;
  departmentName: string;
  designation: string;
  status: string;
  currentAssignmentCount: number;
  maxSubjectsPerFaculty: number;
  equivalentTeachingLoad: number;
  maxWeeklyLoad: number;
  qualifiedSubjectIds: string[];
  mentorEligible: boolean;
}

// ── Phase 1: Gap Analysis (read-only) ───────────────────────────────────────

export async function analyzeGaps(academicYear: string, semester?: number, departmentId?: string): Promise<GapAnalysis> {
  const sectionParams: unknown[] = [];
  const sectionConditions: string[] = [`s.status = 'active'`, 's.deleted_at IS NULL', 's.section IS NOT NULL'];
  const push = (cond: string, val: unknown) => {
    sectionParams.push(val);
    sectionConditions.push(`${cond} $${sectionParams.length}`);
  };
  if (semester) push('s.semester =', semester);
  if (departmentId) push('s.department_id =', departmentId);

  const { rows: sections } = await query<{
    department_id: string;
    program_id: string;
    semester: number;
    section: string;
    student_count: string;
  }>(
    `SELECT s.department_id, s.program_id, s.semester, s.section, COUNT(*)::text AS student_count
     FROM students s
     WHERE ${sectionConditions.join(' AND ')}
     GROUP BY s.department_id, s.program_id, s.semester, s.section`,
    sectionParams
  );

  const missingAssignments: MissingAssignment[] = [];
  const unmentoredGroups: UnmentoredGroup[] = [];
  const memberships = await getAllGroupMemberships();
  const mentoredStudentIds = new Set(memberships.map((m) => m.studentId));

  for (const sec of sections) {
    const { rows: mappings } = await query<{
      subject_id: string;
      subject_code: string;
      subject_name: string;
      regulation: string;
      year: string;
      department_id: string;
      department_name: string;
    }>(
      `SELECT scm.subject_id, sub.code AS subject_code, sub.name AS subject_name,
              scm.regulation, scm.year, scm.department_id, d.name AS department_name
       FROM subject_curriculum_mappings scm
       JOIN subjects sub ON sub.id = scm.subject_id AND sub.status = 'active' AND sub.deleted_at IS NULL
       JOIN departments d ON d.id = scm.department_id
       WHERE scm.department_id = $1
         AND (scm.program_id = $2 OR scm.program_id IS NULL)
         AND scm.semester = $3
         AND scm.deleted_at IS NULL`,
      [sec.department_id, sec.program_id, sec.semester]
    );

    for (const m of mappings) {
      const { rows: existing } = await query<{ id: string }>(
        `SELECT ta.id FROM teaching_assignments ta
         JOIN subject_curriculum_mappings scm ON scm.id = ta.subject_curriculum_mapping_id
         WHERE scm.subject_id = $1 AND scm.department_id = $2 AND scm.semester = $3
           AND ta.section = $4 AND ta.academic_year = $5 AND ta.deleted_at IS NULL AND ta.is_active = TRUE
         LIMIT 1`,
        [m.subject_id, sec.department_id, sec.semester, sec.section, academicYear]
      );
      if (!existing[0]) {
        missingAssignments.push({
          departmentId: m.department_id,
          departmentName: m.department_name,
          programId: sec.program_id,
          semester: sec.semester,
          section: sec.section,
          subjectId: m.subject_id,
          subjectCode: m.subject_code,
          subjectName: m.subject_name,
          regulation: m.regulation,
          year: m.year,
        });
      }
    }

    const { rows: deptRows } = await query<{ name: string }>('SELECT name FROM departments WHERE id = $1', [sec.department_id]);
    const { rows: studentIdRows } = await query<{ id: string }>(
      `SELECT id FROM students WHERE department_id = $1 AND semester = $2 AND section = $3 AND status = 'active' AND deleted_at IS NULL`,
      [sec.department_id, sec.semester, sec.section]
    );
    const unmentoredCount = studentIdRows.filter((s) => !mentoredStudentIds.has(s.id)).length;
    if (unmentoredCount > 0) {
      unmentoredGroups.push({
        departmentId: sec.department_id,
        departmentName: deptRows[0]?.name ?? '',
        semester: sec.semester,
        section: sec.section,
        studentCount: unmentoredCount,
      });
    }
  }

  return { missingAssignments, unmentoredGroups };
}

// ── Phase 2: Faculty Capacity Planning (read-only) ──────────────────────────

export async function planFacultyCapacity(departmentId?: string, academicYear = '2026-2027'): Promise<FacultyCapacityRow[]> {
  const settings = await getTeachingLoadSettings();
  const params: unknown[] = [];
  let deptFilter = '';
  if (departmentId) {
    params.push(departmentId);
    deptFilter = 'AND f.department_id = $1';
  }

  const { rows: faculty } = await query<{
    id: string;
    full_name: string;
    employee_number: string;
    department_id: string;
    department_name: string;
    designation: string;
    status: string;
  }>(
    `SELECT f.id, f.full_name, f.employee_number, f.department_id, d.name AS department_name,
            f.designation::text AS designation, f.status::text AS status
     FROM faculty f
     JOIN departments d ON d.id = f.department_id
     WHERE f.deleted_at IS NULL ${deptFilter}
     ORDER BY f.full_name ASC`,
    params
  );

  const overview = await getFacultyWorkloadOverview(academicYear);
  const loadByFaculty = new Map(overview.rows.map((r) => [r.facultyId, r]));

  const rows: FacultyCapacityRow[] = [];
  for (const f of faculty) {
    const { rows: history } = await query<{ subject_id: string }>(
      `SELECT DISTINCT scm.subject_id FROM teaching_assignments ta
       JOIN subject_curriculum_mappings scm ON scm.id = ta.subject_curriculum_mapping_id
       WHERE ta.faculty_id = $1 AND ta.deleted_at IS NULL`,
      [f.id]
    );
    const current = loadByFaculty.get(f.id);
    rows.push({
      facultyId: f.id,
      facultyName: f.full_name,
      employeeNumber: f.employee_number,
      departmentId: f.department_id,
      departmentName: f.department_name,
      designation: f.designation,
      status: f.status,
      currentAssignmentCount: current?.subjects.length ?? 0,
      maxSubjectsPerFaculty: settings.maxSubjectsPerFaculty,
      equivalentTeachingLoad: current?.equivalentTeachingLoad ?? 0,
      maxWeeklyLoad: settings.maxWeeklyLoad,
      qualifiedSubjectIds: history.map((h) => h.subject_id),
      mentorEligible: !['resigned', 'retired', 'on_leave'].includes(f.status),
    });
  }
  return rows;
}

// ── Phase 3: Auto-generate Teaching Assignments ─────────────────────────────

export interface GenerateAssignmentsResult {
  proposed: number;
  created: number;
  skipped: { subjectCode: string; departmentName: string; section: string; reason: string }[];
  assignments: { subjectCode: string; section: string; facultyName: string; departmentName: string }[];
}

// Equivalent teaching-load hours (lecture/tutorial/practical * configured
// weights) is the measure enforced everywhere else in this system
// (getFacultyWorkloadOverview, maxWeeklyLoad) — the allocator uses the same
// measure instead of a separate raw subject-count cap, so "how many subjects"
// never blocks a faculty who has hour headroom (e.g. several low-hour electives).
async function computeSubjectLoadHours(subjectId: string, settings: Awaited<ReturnType<typeof getTeachingLoadSettings>>): Promise<number> {
  const { rows } = await query<{ lecture_hours: number; tutorial_hours: number; practical_hours: number }>(
    `SELECT COALESCE(lecture_hours, 0) AS lecture_hours, COALESCE(tutorial_hours, 0) AS tutorial_hours, COALESCE(practical_hours, 0) AS practical_hours
     FROM subjects WHERE id = $1`,
    [subjectId]
  );
  const s = rows[0];
  if (!s) return 0;
  return Number(s.lecture_hours) * settings.theoryWeight + Number(s.tutorial_hours) * settings.tutorialWeight + Number(s.practical_hours) * settings.labWeight;
}

export async function autoGenerateTeachingAssignments(
  academicYear: string,
  semester: number | undefined,
  departmentId: string | undefined,
  dryRun: boolean,
  actorId: string
): Promise<GenerateAssignmentsResult> {
  const gaps = await analyzeGaps(academicYear, semester, departmentId);
  const settings = await getTeachingLoadSettings();
  const result: GenerateAssignmentsResult = { proposed: gaps.missingAssignments.length, created: 0, skipped: [], assignments: [] };

  // Running per-faculty equivalent load (hours) for this generation pass, seeded from current DB state.
  const overview = await getFacultyWorkloadOverview(academicYear);
  const loadHours = new Map<string, number>(overview.rows.map((r) => [r.facultyId, r.equivalentTeachingLoad]));

  for (const gap of gaps.missingAssignments) {
    const subjectHours = await computeSubjectLoadHours(gap.subjectId, settings);

    // History-matched faculty (taught this subject before) are preferred, but
    // the full active department pool is always available as fallback — a
    // history match that's already over capacity must not block picking
    // someone else with room, so both sets are combined rather than history
    // short-circuiting the department fallback.
    const { rows: history } = await query<{ faculty_id: string }>(
      `SELECT DISTINCT ta.faculty_id FROM teaching_assignments ta
       JOIN subject_curriculum_mappings scm ON scm.id = ta.subject_curriculum_mapping_id
       WHERE scm.subject_id = $1 AND ta.department_id = $2 AND ta.deleted_at IS NULL`,
      [gap.subjectId, gap.departmentId]
    );
    const { rows: deptFaculty } = await query<{ id: string }>(
      `SELECT id FROM faculty WHERE department_id = $1 AND status = 'active' AND deleted_at IS NULL`,
      [gap.departmentId]
    );
    const historyIds = new Set(history.map((h) => h.faculty_id));
    const candidateIds = Array.from(new Set([...historyIds, ...deptFaculty.map((f) => f.id)]));

    if (candidateIds.length === 0) {
      result.skipped.push({
        subjectCode: gap.subjectCode,
        departmentName: gap.departmentName,
        section: gap.section,
        reason: 'No active faculty found in department',
      });
      continue;
    }

    // Among candidates with room for this subject, prefer a history match;
    // within each group, prefer the lowest current load.
    const candidates = candidateIds
      .map((fid) => ({ fid, current: loadHours.get(fid) ?? 0, hasHistory: historyIds.has(fid) }))
      .filter((c) => c.current + subjectHours <= settings.maxWeeklyLoad)
      .sort((a, b) => (a.hasHistory === b.hasHistory ? a.current - b.current : a.hasHistory ? -1 : 1));
    const chosen = candidates[0];

    if (!chosen) {
      result.skipped.push({
        subjectCode: gap.subjectCode,
        departmentName: gap.departmentName,
        section: gap.section,
        reason: `All qualified faculty would exceed the max weekly load (${settings.maxWeeklyLoad}h) if assigned this ${subjectHours}h subject`,
      });
      continue;
    }

    const { rows: facRows } = await query<{ full_name: string }>('SELECT full_name FROM faculty WHERE id = $1', [chosen.fid]);
    result.assignments.push({
      subjectCode: gap.subjectCode,
      section: gap.section,
      facultyName: facRows[0]?.full_name ?? '',
      departmentName: gap.departmentName,
    });

    if (!dryRun) {
      await createAllocation(
        {
          facultyId: chosen.fid,
          subjectId: gap.subjectId,
          departmentId: gap.departmentId,
          programId: gap.programId ?? undefined,
          regulation: gap.regulation,
          year: gap.year,
          semester: gap.semester,
          section: gap.section,
          academicYear,
          status: 'active',
        } as any,
        actorId
      );
      result.created += 1;
    }
    loadHours.set(chosen.fid, chosen.current + subjectHours);
  }

  return result;
}

// ── Phase 4: Auto-assign Mentors ────────────────────────────────────────────

export interface GenerateMentorsResult {
  proposed: number;
  created: number;
  skipped: { departmentName: string; semester: number; section: string; reason: string }[];
  groups: { departmentName: string; semester: number; section: string; mentorName: string; studentCount: number }[];
}

export async function autoAssignMentors(departmentId: string | undefined, dryRun: boolean, actorId: string): Promise<GenerateMentorsResult> {
  const gaps = await analyzeGaps('2026-2027', undefined, departmentId);
  const result: GenerateMentorsResult = { proposed: 0, created: 0, skipped: [], groups: [] };

  const mentorLoad = new Map<string, number>();

  for (const grp of gaps.unmentoredGroups) {
    const candidates = await listMentorCandidates(grp.departmentId);
    const suggestion = await suggestBalancedGroups({ departmentId: grp.departmentId, semester: grp.semester, section: grp.section });

    for (const proposal of suggestion.proposals) {
      result.proposed += 1;
      const eligible = candidates
        .filter((c) => c.availableCapacity >= proposal.studentCount)
        .sort((a, b) => (mentorLoad.get(a.facultyId) ?? a.currentStudents) - (mentorLoad.get(b.facultyId) ?? b.currentStudents));
      const mentor = eligible[0];

      if (!mentor) {
        result.skipped.push({
          departmentName: grp.departmentName,
          semester: grp.semester,
          section: grp.section,
          reason: 'No mentor with sufficient available capacity in department',
        });
        continue;
      }

      result.groups.push({
        departmentName: grp.departmentName,
        semester: grp.semester,
        section: grp.section,
        mentorName: mentor.facultyName,
        studentCount: proposal.studentCount,
      });

      if (!dryRun) {
        await createMentorGroup(
          {
            mentorId: mentor.facultyId,
            departmentId: grp.departmentId,
            semester: grp.semester,
            section: grp.section,
            assignmentMethod: 'manual',
            studentIds: proposal.studentIds,
          } as any,
          actorId,
          'admin'
        );
        result.created += 1;
      }
      mentorLoad.set(mentor.facultyId, (mentorLoad.get(mentor.facultyId) ?? mentor.currentStudents) + proposal.studentCount);
    }
  }

  return result;
}

// ── Phase 9 (partial): Report ───────────────────────────────────────────────

export async function generateReport(academicYear: string, semester?: number, departmentId?: string) {
  const [gaps, facultyCapacity] = await Promise.all([
    analyzeGaps(academicYear, semester, departmentId),
    planFacultyCapacity(departmentId, academicYear),
  ]);

  const totalStudentsUnmentored = gaps.unmentoredGroups.reduce((sum, g) => sum + g.studentCount, 0);

  return {
    facultyPlanningSummary: {
      totalFaculty: facultyCapacity.length,
      overloaded: facultyCapacity.filter((f) => f.equivalentTeachingLoad >= f.maxWeeklyLoad).length,
      mentorEligible: facultyCapacity.filter((f) => f.mentorEligible).length,
    },
    teachingAssignmentSummary: {
      missingAssignmentCount: gaps.missingAssignments.length,
      affectedSections: new Set(gaps.missingAssignments.map((m) => `${m.departmentId}:${m.semester}:${m.section}`)).size,
    },
    mentorAllocationSummary: {
      unmentoredGroupCount: gaps.unmentoredGroups.length,
      unmentoredStudentCount: totalStudentsUnmentored,
    },
    validation: {
      everySectionHasFullCoverage: gaps.missingAssignments.length === 0,
      everyStudentHasMentor: totalStudentsUnmentored === 0,
    },
    remainingGaps: {
      missingAssignments: gaps.missingAssignments,
      unmentoredGroups: gaps.unmentoredGroups,
    },
  };
}
