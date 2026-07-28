import { query } from '../config/database';

// ── CurriculumRegistry ───────────────────────────────────────────────────────
// Single source of truth for "what does Curriculum say a student/section
// should be studying" — resolved from subject_curriculum_mappings, keyed on
// (department, regulation, semester). Students never store a subject list;
// Teaching Assignments never store one either. Both resolve it here.
//
// Before this registry, "does a curriculum mapping exist for this
// department+regulation+semester" was independently re-derived in
// studentImport.strategy.ts (Academic Import Engine) and inline in
// subjectImport.service.ts — same question, two implementations. This file
// is now the one place that answers it.

export interface CurriculumSubject {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  subjectType: string;
  credits: number;
  lectureHours: number;
  tutorialHours: number;
  practicalHours: number;
}

interface CurriculumSubjectRow {
  subject_id: string;
  code: string;
  name: string;
  type: string;
  credits: number;
  lecture_hours: number;
  tutorial_hours: number;
  practical_hours: number;
}

/**
 * Resolves the live subject list for a department+regulation+semester —
 * "Subjects Automatically Linked" from the Academic Import Engine's
 * synchronization flow, and the same resolution Teaching Assignments and
 * Examination Eligibility rely on implicitly via the join pattern already
 * used throughout attendance/internal-marks/examination roster queries.
 */
export async function resolveCurriculumSubjects(
  departmentId: string,
  regulation: string,
  semester: number
): Promise<CurriculumSubject[]> {
  const { rows } = await query<CurriculumSubjectRow>(
    `SELECT s.id AS subject_id, s.code, s.name, s.type::text AS type, s.credits,
            s.lecture_hours, s.tutorial_hours, s.practical_hours
     FROM subject_curriculum_mappings scm
     JOIN subjects s ON s.id = scm.subject_id AND s.deleted_at IS NULL
     WHERE scm.department_id = $1 AND scm.regulation = $2 AND scm.semester = $3
       AND scm.deleted_at IS NULL
     ORDER BY s.code ASC`,
    [departmentId, regulation, semester]
  );
  return rows.map((r) => ({
    subjectId: r.subject_id,
    subjectCode: r.code,
    subjectName: r.name,
    subjectType: r.type,
    credits: Number(r.credits),
    lectureHours: Number(r.lecture_hours),
    tutorialHours: Number(r.tutorial_hours),
    practicalHours: Number(r.practical_hours),
  }));
}

/**
 * Existence-only check — used by import/validation pipelines that just need
 * to reject "Missing Curriculum" without materializing the full subject list.
 * Cheaper than resolveCurriculumSubjects for that purpose (no subjects join).
 */
export async function hasCurriculum(departmentId: string, regulation: string, semester: number): Promise<boolean> {
  const { rows } = await query<{ id: string }>(
    `SELECT scm.id FROM subject_curriculum_mappings scm
     WHERE scm.department_id = $1 AND scm.regulation = $2 AND scm.semester = $3
       AND scm.deleted_at IS NULL LIMIT 1`,
    [departmentId, regulation, semester]
  );
  return rows.length > 0;
}

/**
 * Bulk existence check — one query for every distinct (department,
 * regulation, semester) tuple a caller needs, keyed the same way
 * studentImport.strategy.ts already batches this lookup (avoids N+1 across
 * a multi-thousand-row import).
 */
export async function getAllCurriculumKeys(): Promise<Set<string>> {
  const { rows } = await query<{ department_id: string; regulation: string; semester: number }>(
    `SELECT DISTINCT department_id, regulation, semester FROM subject_curriculum_mappings WHERE deleted_at IS NULL`
  );
  return new Set(rows.map((r) => `${r.department_id}::${r.regulation}::${r.semester}`));
}
