-- Migration 042: Result Entry Tasks
--
-- Design notes:
--   • This is the concrete row the "Pending Result Entry Tasks" workflow
--     needs — a computed view can't carry due dates, status transitions, or
--     an audit trail, so (unlike Faculty Operations in 028) this genuinely
--     needs a new table rather than aggregating existing ones.
--   • One row per (exam, teaching_assignment): an exam can resolve to more
--     than one teaching assignment only if its section/subject maps to
--     multiple active assignments, which idx_unique_subject_section already
--     prevents in the common case — the composite UNIQUE constraint here is
--     defense in depth, not the primary duplicate guard.
--   • status intentionally separate from exams.status: the exam lifecycle
--     (Scheduled → Ongoing → Completed) is orthogonal to the result-entry
--     lifecycle (open → draft_saved → submitted_for_approval → published →
--     closed) — an exam is a scheduling concept, a task is a faculty to-do.
--   • window_closes_at is nullable: institutions that don't configure a due
--     date simply get an always-open task; the "Due in N Days" UI derives
--     the countdown when it is set.
--   • No faculty_id/subject_id/section denormalized here on purpose — every
--     consumer joins through teaching_assignment_id, which is exactly the
--     single-source-of-truth requirement of this refactor.

CREATE TYPE result_entry_task_status AS ENUM (
  'open',
  'draft_saved',
  'submitted_for_approval',
  'published',
  'closed'
);

CREATE TABLE result_entry_tasks (
  id                     UUID  PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id                UUID  NOT NULL REFERENCES exams(id),
  teaching_assignment_id UUID  NOT NULL REFERENCES teaching_assignments(id),
  faculty_id             UUID  NOT NULL REFERENCES faculty(id),
  status                 result_entry_task_status NOT NULL DEFAULT 'open',
  window_opens_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  window_closes_at       TIMESTAMPTZ,
  submitted_at           TIMESTAMPTZ,
  published_at           TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at             TIMESTAMPTZ,
  UNIQUE (exam_id, teaching_assignment_id)
);

CREATE INDEX idx_result_entry_tasks_faculty ON result_entry_tasks (faculty_id)
  WHERE deleted_at IS NULL AND status != 'closed';
CREATE INDEX idx_result_entry_tasks_exam ON result_entry_tasks (exam_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_result_entry_tasks_teaching_assignment ON result_entry_tasks (teaching_assignment_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_result_entry_tasks_updated_at
  BEFORE UPDATE ON result_entry_tasks
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- New Workflow Engine trigger/action pair, reusing 028's rule engine rather
-- than a bespoke hook. The enum additions ('exam.completed' trigger,
-- 'create_result_entry_task' action) are handled specially in migrate.ts
-- (ALTER TYPE ... ADD VALUE must run outside this migration's transaction —
-- same pattern as 031/039).
ALTER TABLE results ADD COLUMN teaching_assignment_id UUID REFERENCES teaching_assignments(id);
CREATE INDEX idx_results_teaching_assignment ON results (teaching_assignment_id) WHERE deleted_at IS NULL;

-- create_result_entry_task's handler both creates the row and notifies the
-- responsible faculty directly (see workflowEngine.service.ts) — kept as one
-- action rather than adding a separate notify_faculty action type, since the
-- notification content (which task, which exam) is only known inside the
-- handler that just created the task.
INSERT INTO workflow_rules (name, trigger_event, actions, created_by)
SELECT 'Open a result entry task for the resolved teaching assignment when an exam completes',
       'exam.completed', ARRAY['create_result_entry_task']::workflow_action_type[], u.id
FROM users u WHERE u.role = 'admin' ORDER BY u.created_at LIMIT 1;
