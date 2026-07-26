-- Migration 046: Academic Data Import Engine
--
-- Design notes:
--   • import_jobs is the audit/tracking record for a single preview→commit
--     run (Import Started/Completed, Imported By, Synchronization Status,
--     Rollback Events — the spec's Audit Logging section). It complements,
--     not replaces, the generic audit_logs table (001): audit_logs gets one
--     row per created student (via the existing auditLog() utility, same as
--     subjectImport.service.ts already does for subjects), import_jobs gets
--     one row per import run so "was this batch rolled back, and why" is a
--     single lookup instead of aggregating thousands of audit_log rows.
--   • entity_type is deliberately a Postgres ENUM (not free text) covering
--     every type named in the spec ("architecture must support") even
--     though only 'student' has a strategy implemented yet — adding a new
--     strategy later never needs a migration for this column, only
--     registering it in strategyRegistry.ts.
--   • No row-level "import_job_rows" table: at 5,000+ rows, persisting every
--     parsed cell server-side just to support a two-phase preview→commit
--     would itself become the performance bottleneck this migration is
--     supposed to avoid. Instead this reuses the exact pattern already
--     proven by subjectImport.service.ts — preview returns the validated
--     rows to the client, commit receives that same array back — so no new
--     infrastructure (Redis, temp tables) is introduced for a two-step flow
--     the codebase already knows how to do.
--   • created_count vs valid_rows: valid_rows is what preview found
--     importable; created_count is what commit actually inserted (can be
--     lower if commit is re-run after some rows were imported by a prior
--     partial job, or if a strategy dedupes further against DB state that
--     changed between preview and commit).

CREATE TYPE import_entity_type AS ENUM (
  'student',
  'faculty',
  'subject',
  'curriculum',
  'teaching_assignment',
  'department',
  'classroom',
  'timetable',
  'examination_schedule'
);

CREATE TYPE import_job_status AS ENUM (
  'previewed',
  'committing',
  'completed',
  'failed',
  'rolled_back'
);

CREATE TABLE import_jobs (
  id              UUID               PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type     import_entity_type NOT NULL,
  status          import_job_status  NOT NULL DEFAULT 'previewed',
  file_name       VARCHAR(255),
  total_rows      INTEGER            NOT NULL DEFAULT 0,
  valid_rows      INTEGER            NOT NULL DEFAULT 0,
  invalid_rows    INTEGER            NOT NULL DEFAULT 0,
  duplicate_rows  INTEGER            NOT NULL DEFAULT 0,
  created_count   INTEGER            NOT NULL DEFAULT 0,
  summary         JSONB,
  error_message   TEXT,
  created_by      UUID               NOT NULL REFERENCES users(id),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_import_jobs_entity_status ON import_jobs (entity_type, status);
CREATE INDEX idx_import_jobs_created_by    ON import_jobs (created_by, created_at DESC);

CREATE TRIGGER trg_import_jobs_updated_at
  BEFORE UPDATE ON import_jobs
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Workflow Engine integration (Part "IMPORT EVENTS"): one aggregate trigger
-- per completed import job, not one per imported row — the engine's
-- action registry (notify_students/create_calendar_event/log_only/
-- create_result_entry_task) operates on a single payload per dispatch, so
-- firing it 5,000 times per import would be both meaningless (there is no
-- per-student calendar/notification action to run) and a performance
-- regression in exactly the code path this migration exists to speed up.
-- Personalized "welcome" notifications are sent directly via
-- notification.service.ts per created student instead (see
-- studentImport.strategy.ts) — the same division of responsibility already
-- established by create_result_entry_task's handler in workflowEngine.service.ts.
-- Handled specially in migrate.ts (ALTER TYPE ... ADD VALUE outside this
-- migration's transaction, same pattern as 031/039/042/044/045).
