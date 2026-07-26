-- Migration 043: Attach Teaching Assignment to dependent modules
--
-- Design notes:
--   • Purely additive: teaching_assignment_id is nullable on every table
--     here, and none of faculty_id/subject_id/section is touched or
--     dropped. Existing controllers/services keep writing the old columns
--     until each is individually migrated to write teaching_assignment_id
--     as well (tracked per-service in the follow-on backend changes).
--   • Backfill matches existing rows to a teaching_assignments row by
--     (faculty_id, subject_id, section) — attendance/internal_marks/
--     teaching_plans/course_materials/assignments store section directly;
--     exams stores section too. academic_year isn't stored on most of these
--     tables, so the match intentionally ignores year and takes the most
--     recently created matching assignment — acceptable for a one-time
--     backfill of historical rows, not for new writes (new writes go
--     through teachingAssignment.service.ts's resolver, which is exact).
--   • Rows that can't be resolved (no matching assignment — e.g. a faculty
--     member who was removed from an allocation after marking attendance)
--     are logged to teaching_assignment_backfill_exceptions instead of
--     silently left NULL, so an admin can review and hand-fix them; this is
--     exactly the kind of drift the whole refactor exists to surface.

CREATE TABLE teaching_assignment_backfill_exceptions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_table VARCHAR(50) NOT NULL,
  source_id    UUID NOT NULL,
  faculty_id   UUID,
  subject_id   UUID,
  section      VARCHAR(10),
  reason       TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── attendance ─────────────────────────────────────────────────────────────
ALTER TABLE attendance ADD COLUMN teaching_assignment_id UUID REFERENCES teaching_assignments(id);
CREATE INDEX idx_attendance_teaching_assignment ON attendance (teaching_assignment_id);

UPDATE attendance a
SET teaching_assignment_id = ta.id
FROM (
  SELECT DISTINCT ON (faculty_id, subject_id, section) id, faculty_id, subject_id, section
  FROM teaching_assignments
  WHERE deleted_at IS NULL
  ORDER BY faculty_id, subject_id, section, created_at DESC
) ta
WHERE a.faculty_id = ta.faculty_id AND a.subject_id = ta.subject_id AND a.section = ta.section
  AND a.teaching_assignment_id IS NULL;

INSERT INTO teaching_assignment_backfill_exceptions (source_table, source_id, faculty_id, subject_id, section, reason)
SELECT 'attendance', id, faculty_id, subject_id, section, 'No matching teaching_assignments row for (faculty_id, subject_id, section)'
FROM attendance WHERE teaching_assignment_id IS NULL;

-- ── internal_marks ─────────────────────────────────────────────────────────
ALTER TABLE internal_marks ADD COLUMN teaching_assignment_id UUID REFERENCES teaching_assignments(id);
CREATE INDEX idx_internal_marks_teaching_assignment ON internal_marks (teaching_assignment_id);

UPDATE internal_marks im
SET teaching_assignment_id = ta.id
FROM (
  SELECT DISTINCT ON (faculty_id, subject_id, section) id, faculty_id, subject_id, section
  FROM teaching_assignments
  WHERE deleted_at IS NULL
  ORDER BY faculty_id, subject_id, section, created_at DESC
) ta
WHERE im.faculty_id = ta.faculty_id AND im.subject_id = ta.subject_id AND im.section = ta.section
  AND im.teaching_assignment_id IS NULL;

INSERT INTO teaching_assignment_backfill_exceptions (source_table, source_id, faculty_id, subject_id, section, reason)
SELECT 'internal_marks', id, faculty_id, subject_id, section, 'No matching teaching_assignments row for (faculty_id, subject_id, section)'
FROM internal_marks WHERE teaching_assignment_id IS NULL;

-- ── exams ──────────────────────────────────────────────────────────────────
-- faculty_id is nullable on exams since migration 040 (exam-session builder
-- can create exams before a faculty is resolved) — those rows simply can't
-- backfill a teaching_assignment_id yet; they get one when the exam-session
-- publish flow resolves it (see exam.service.ts change).
ALTER TABLE exams ADD COLUMN teaching_assignment_id UUID REFERENCES teaching_assignments(id);
CREATE INDEX idx_exams_teaching_assignment ON exams (teaching_assignment_id);

UPDATE exams e
SET teaching_assignment_id = ta.id
FROM (
  SELECT DISTINCT ON (faculty_id, subject_id, section) id, faculty_id, subject_id, section
  FROM teaching_assignments
  WHERE deleted_at IS NULL
  ORDER BY faculty_id, subject_id, section, created_at DESC
) ta
WHERE e.faculty_id = ta.faculty_id AND e.subject_id = ta.subject_id AND e.section = ta.section
  AND e.teaching_assignment_id IS NULL;

INSERT INTO teaching_assignment_backfill_exceptions (source_table, source_id, faculty_id, subject_id, section, reason)
SELECT 'exams', id, faculty_id, subject_id, section,
       CASE WHEN faculty_id IS NULL THEN 'exam has no faculty_id assigned yet'
            ELSE 'No matching teaching_assignments row for (faculty_id, subject_id, section)' END
FROM exams WHERE teaching_assignment_id IS NULL;

-- ── teaching_plans ─────────────────────────────────────────────────────────
ALTER TABLE teaching_plans ADD COLUMN teaching_assignment_id UUID REFERENCES teaching_assignments(id);
CREATE INDEX idx_teaching_plans_teaching_assignment ON teaching_plans (teaching_assignment_id);

UPDATE teaching_plans tp
SET teaching_assignment_id = ta.id
FROM (
  SELECT DISTINCT ON (faculty_id, subject_id, section) id, faculty_id, subject_id, section
  FROM teaching_assignments
  WHERE deleted_at IS NULL
  ORDER BY faculty_id, subject_id, section, created_at DESC
) ta
WHERE tp.faculty_id = ta.faculty_id AND tp.subject_id = ta.subject_id AND tp.section = ta.section
  AND tp.teaching_assignment_id IS NULL;

INSERT INTO teaching_assignment_backfill_exceptions (source_table, source_id, faculty_id, subject_id, section, reason)
SELECT 'teaching_plans', id, faculty_id, subject_id, section, 'No matching teaching_assignments row for (faculty_id, subject_id, section)'
FROM teaching_plans WHERE teaching_assignment_id IS NULL;

-- ── course_materials / assignments (LMS) ───────────────────────────────────
-- Neither table stores `section` today (materials/assignments are shared
-- across all sections of a subject) — a faculty can hold multiple teaching
-- assignments for the same subject across different sections, so the
-- backfill match is (faculty_id, subject_id) only and is intentionally
-- best-effort/ambiguous for that reason (picks the most recent). New writes
-- move to per-section LMS scoping via lmsAssignment.service.ts /
-- material.service.ts resolving the faculty's active teaching assignment
-- explicitly, not this backfill.
ALTER TABLE course_materials ADD COLUMN teaching_assignment_id UUID REFERENCES teaching_assignments(id);
CREATE INDEX idx_course_materials_teaching_assignment ON course_materials (teaching_assignment_id);

UPDATE course_materials cm
SET teaching_assignment_id = ta.id
FROM (
  SELECT DISTINCT ON (faculty_id, subject_id) id, faculty_id, subject_id
  FROM teaching_assignments
  WHERE deleted_at IS NULL
  ORDER BY faculty_id, subject_id, created_at DESC
) ta
WHERE cm.faculty_id = ta.faculty_id AND cm.subject_id = ta.subject_id
  AND cm.teaching_assignment_id IS NULL;

ALTER TABLE assignments ADD COLUMN teaching_assignment_id UUID REFERENCES teaching_assignments(id);
CREATE INDEX idx_assignments_teaching_assignment ON assignments (teaching_assignment_id);

UPDATE assignments a
SET teaching_assignment_id = ta.id
FROM (
  SELECT DISTINCT ON (faculty_id, subject_id) id, faculty_id, subject_id
  FROM teaching_assignments
  WHERE deleted_at IS NULL
  ORDER BY faculty_id, subject_id, created_at DESC
) ta
WHERE a.faculty_id = ta.faculty_id AND a.subject_id = ta.subject_id
  AND a.teaching_assignment_id IS NULL;
