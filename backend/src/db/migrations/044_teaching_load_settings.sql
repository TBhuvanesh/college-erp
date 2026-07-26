-- Migration 044: Teaching Load Settings (Faculty Teaching Load Management)
--
-- Design notes:
--   • Subjects already carry lecture_hours/tutorial_hours/practical_hours
--     (migration 035, the L-T-P breakdown) — "Equivalent Teaching Load" is
--     computed from those existing per-subject hours weighted by these
--     configurable multipliers, so no new per-subject "type weight" table is
--     needed and no existing subject data is touched.
--   • Singleton table (one row, id fixed) rather than a key-value settings
--     blob: every field is a named, typed, validated column — matches the
--     "config lives in a real table, not a JSONB bag" convention already
--     used elsewhere (grading thresholds are the one exception, and those
--     live in code specifically to avoid a migration per tweak; these
--     values are genuinely admin-editable policy, so they get a table).
--   • require_result_verification gates the optional 'verified' stage
--     inserted into result_entry_task_status (migration 045) — when false,
--     tasks flow straight from submitted_for_approval to published exactly
--     as they do today, so this is fully backward compatible.
--   • auto_marks_window_days / auto_close_marks_window_days configure how
--     long a result_entry_tasks window stays open after an exam completes;
--     NULL means "open indefinitely" (today's behavior — window_closes_at
--     is already nullable, see migration 042).

CREATE TABLE teaching_load_settings (
  id                            SMALLINT     PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- singleton
  theory_weight                 NUMERIC(4,2) NOT NULL DEFAULT 1.00 CHECK (theory_weight >= 0),
  lab_weight                    NUMERIC(4,2) NOT NULL DEFAULT 2.00 CHECK (lab_weight >= 0),
  tutorial_weight               NUMERIC(4,2) NOT NULL DEFAULT 1.00 CHECK (tutorial_weight >= 0),
  min_weekly_load               NUMERIC(5,2) CHECK (min_weekly_load >= 0),
  max_weekly_load               NUMERIC(5,2) NOT NULL DEFAULT 18.00 CHECK (max_weekly_load > 0),
  min_subjects_per_faculty      SMALLINT     NOT NULL DEFAULT 1 CHECK (min_subjects_per_faculty >= 0),
  max_subjects_per_faculty      SMALLINT     NOT NULL DEFAULT 3 CHECK (max_subjects_per_faculty > 0),
  auto_marks_window_days        SMALLINT     CHECK (auto_marks_window_days IS NULL OR auto_marks_window_days > 0),
  auto_close_marks_window_days  SMALLINT     CHECK (auto_close_marks_window_days IS NULL OR auto_close_marks_window_days > 0),
  require_result_verification   BOOLEAN      NOT NULL DEFAULT FALSE,
  updated_by                    UUID         REFERENCES users(id),
  created_at                    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

INSERT INTO teaching_load_settings (id) VALUES (1);

CREATE TRIGGER trg_teaching_load_settings_updated_at
  BEFORE UPDATE ON teaching_load_settings
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Subject Types (Part 3): 'project' and 'seminar' extend the existing
-- subject_type enum ('core','elective','lab' from migration 004) — additive,
-- handled specially in migrate.ts (ALTER TYPE ... ADD VALUE outside
-- transaction, same pattern as 031/039/042).
