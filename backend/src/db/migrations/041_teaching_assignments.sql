-- Migration 041: Teaching Assignment Refactor (Phase 1)
--
-- Design notes:
--   • faculty_subject_assignments is RENAMED to teaching_assignments — same
--     PK, same rows, so every existing FK/index survives untouched and no
--     dependent table needs a repoint for its existing columns.
--   • A compat VIEW named faculty_subject_assignments is created immediately
--     after the rename so any query still written against the old name keeps
--     working read-only during the transition (write path moves to the new
--     table name now). Dropped in a later cleanup migration once all
--     controllers/services reference teaching_assignments directly.
--   • New columns (department_id, academic_session_id, start_date, end_date,
--     weekly_teaching_hours) are additive and nullable — no existing INSERT
--     statement in subjectAllocation.service.ts breaks.
--   • department_id is backfilled from subject_curriculum_mappings (the real
--     department linkage already used by subjectAllocation.service.ts's
--     JOINs), not from subjects directly, since a subject can be mapped into
--     more than one department's curriculum.
--   • academic_session_id references examination_sessions.id is deliberately
--     NOT added here — examination_sessions models an exam-scheduling batch,
--     not a teaching-term session, and there is no dedicated "academic
--     session" table yet in this schema. Left nullable/untyped (UUID, no FK)
--     until that entity exists, so this migration doesn't invent a table the
--     rest of the plan doesn't otherwise need yet.
--   • The existing partial unique index idx_unique_subject_section
--     (subject_id, academic_year, section WHERE deleted_at IS NULL) already
--     enforces "prevent duplicate Teaching Assignments" — kept as-is under
--     the new table name.

ALTER TABLE faculty_subject_assignments RENAME TO teaching_assignments;

ALTER TABLE teaching_assignments
  ADD COLUMN department_id          UUID REFERENCES departments(id),
  ADD COLUMN academic_session_id    UUID,
  ADD COLUMN start_date             DATE,
  ADD COLUMN end_date               DATE,
  ADD COLUMN weekly_teaching_hours  NUMERIC(4, 1) CHECK (weekly_teaching_hours >= 0);

UPDATE teaching_assignments ta
SET department_id = scm.department_id
FROM subject_curriculum_mappings scm
WHERE ta.subject_curriculum_mapping_id = scm.id
  AND ta.department_id IS NULL;

CREATE INDEX idx_teaching_assignments_department ON teaching_assignments (department_id) WHERE deleted_at IS NULL;

-- Compat shim: anything still selecting from the old table name keeps working.
CREATE VIEW faculty_subject_assignments AS SELECT * FROM teaching_assignments;
