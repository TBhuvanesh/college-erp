-- Migration 026: Intelligent Teaching Planner & Student Learning Roadmap
-- Enhancement of migration 025 (teaching_plans) — NOT a new table/module.
--
-- Design notes:
--   • lesson_status replaces completion_status (same column, renamed, +2 new
--     enum values) to reflect the richer 6-state lifecycle: Planned,
--     In Progress, Partially Completed, Completed, Rescheduled, Cancelled.
--   • lesson_sequence is the authoritative teaching order within a class
--     (subject_id, section, semester) — independent of lesson_date, so the
--     Auto Shift Engine can renumber future lessons without touching history.
--   • parent_lesson_id links an auto-generated continuation lesson back to the
--     lesson it continues ("Lesson 3 (Continued)"), for roadmap grouping.
--   • ALTER TYPE ... ADD VALUE statements below are re-run individually,
--     outside this migration's transaction, by db/migrate.ts (see the special
--     case for 026, mirroring 020/021) — Postgres restricts using a new enum
--     value inside the same transaction that adds it.

ALTER TYPE lesson_completion_status ADD VALUE IF NOT EXISTS 'In Progress';
ALTER TYPE lesson_completion_status ADD VALUE IF NOT EXISTS 'Partially Completed';

ALTER TABLE teaching_plans RENAME COLUMN completion_status TO lesson_status;

ALTER TABLE teaching_plans
  ADD COLUMN lesson_sequence     SMALLINT,
  ADD COLUMN estimated_duration  SMALLINT NOT NULL DEFAULT 50 CHECK (estimated_duration > 0),
  ADD COLUMN coverage_percentage SMALLINT CHECK (coverage_percentage BETWEEN 0 AND 100),
  ADD COLUMN remaining_topics    TEXT,
  ADD COLUMN auto_shift_enabled  BOOLEAN  NOT NULL DEFAULT TRUE,
  ADD COLUMN is_continuation     BOOLEAN  NOT NULL DEFAULT FALSE,
  ADD COLUMN parent_lesson_id    UUID     REFERENCES teaching_plans(id),
  ADD COLUMN status_reason       TEXT;

-- Backfill sequence for any pre-existing rows from current week/date ordering
-- (covers soft-deleted rows too, since the NOT NULL constraint below applies
-- table-wide), then lock the column down.
UPDATE teaching_plans tp
SET lesson_sequence = ranked.seq
FROM (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY subject_id, section, semester
    ORDER BY week_number, lesson_date
  ) AS seq
  FROM teaching_plans
) ranked
WHERE tp.id = ranked.id;

ALTER TABLE teaching_plans ALTER COLUMN lesson_sequence SET NOT NULL;

-- One lesson per position per class — the Auto Shift Engine relies on this to
-- fail loudly instead of silently corrupting ordering.
CREATE UNIQUE INDEX uq_teaching_plans_sequence
  ON teaching_plans (subject_id, section, semester, lesson_sequence)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_teaching_plans_parent ON teaching_plans (parent_lesson_id) WHERE deleted_at IS NULL;

-- Roadmap/status-engine queries filter heavily on (class, status, sequence)
CREATE INDEX idx_teaching_plans_class_status_seq
  ON teaching_plans (subject_id, section, semester, lesson_status, lesson_sequence)
  WHERE deleted_at IS NULL;
