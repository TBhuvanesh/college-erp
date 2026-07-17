-- Migration 033: Academic Feedback — Eligibility-Driven Campaign Management
--
-- Design notes:
--   • Purely additive to feedback_windows — no changes to feedback_templates,
--     feedback_questions, feedback_submission_tracking, feedback_responses, or
--     feedback_answers. The anonymous-response design (feedback_responses has
--     no student_id by intent) and the existing dedupe-tracking mechanism are
--     untouched.
--   • The legacy singular department_id/semester/is_active columns on
--     feedback_windows are left in place and backfilled into the new array
--     columns below, so existing rows keep resolving eligibility exactly as
--     before, just through the new array-based path the service now reads.
--   • 'open' and 'closed' are not distinct meaningfully-stored states that can
--     drift from reality — the service derives them from status='published'/
--     'closed' plus start_date/end_date at read time (matches the "computed on
--     demand, never duplicated" convention used for exam-seating conflict
--     checks and mentor-group capacity checks this session). The enum still
--     declares all 5 values so an admin can explicitly force-close/archive.

CREATE TYPE campaign_status_enum AS ENUM ('draft', 'published', 'open', 'closed', 'archived');

ALTER TABLE feedback_windows
  ADD COLUMN status                 campaign_status_enum NOT NULL DEFAULT 'draft',
  ADD COLUMN template_id            UUID REFERENCES feedback_templates(id),
  ADD COLUMN target_department_ids  UUID[]     NOT NULL DEFAULT ARRAY[]::UUID[],
  ADD COLUMN target_semesters       SMALLINT[] NOT NULL DEFAULT ARRAY[]::SMALLINT[],
  ADD COLUMN target_sections        VARCHAR(10)[] NOT NULL DEFAULT ARRAY[]::VARCHAR[],
  ADD COLUMN target_subject_ids     UUID[]     NOT NULL DEFAULT ARRAY[]::UUID[],
  ADD COLUMN target_faculty_ids     UUID[]     NOT NULL DEFAULT ARRAY[]::UUID[],
  ADD COLUMN published_at           TIMESTAMPTZ;

-- Safe backfill: old semester/department_id-scoped windows keep resolving the same way.
UPDATE feedback_windows SET target_department_ids = ARRAY[department_id] WHERE department_id IS NOT NULL;
UPDATE feedback_windows SET target_semesters = ARRAY[semester]::SMALLINT[] WHERE semester IS NOT NULL;
UPDATE feedback_windows SET status = 'published', published_at = created_at WHERE is_active = TRUE AND status = 'draft';

CREATE INDEX idx_feedback_windows_status ON feedback_windows (status) WHERE status != 'archived';
