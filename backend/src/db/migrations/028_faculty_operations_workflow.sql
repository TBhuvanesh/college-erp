-- Migration 028: Intelligent Faculty Operations & Academic Workflow Engine
--
-- Design notes:
--   • is_super_admin is a capability FLAG on users (role stays 'admin'), mirroring
--     how HOD is a `designation` on faculty rather than inventing a new Role enum
--     value — avoids threading a brand-new role through PERMISSIONS/JWT/RBAC.
--   • workflow_rules stores CONFIGURABLE trigger→condition→actions mappings, but
--     `actions` is restricted to a closed enum of built-in, safe handlers (see
--     workflowEngine.service.ts's action registry) — not arbitrary code, so the
--     "rule engine" cannot execute unsafe logic even though rules are admin-editable.
--   • condition is optional JSONB: an array of {field, operator, value} clauses,
--     ANDed together, evaluated against the event payload at dispatch time.
--   • workflow_logs is an append-only audit trail — one row per (event, rule)
--     execution attempt, including the "no active rule matched" case, so every
--     emitted event has a durable trace regardless of configuration.
--   • Faculty Operations Center itself (dashboard/tasks/workload) needs no new
--     tables — it is entirely computed from existing modules (attendance,
--     internal_marks, exams, teaching_plans, mentoring_notes, assignments, etc.),
--     per "No duplicate data" / "calculated dynamically" principle already
--     established by the Analytics module.

ALTER TABLE users ADD COLUMN is_super_admin BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TYPE workflow_trigger_event AS ENUM (
  'material.created',
  'assignment.created',
  'lesson.completed',
  'lesson.rescheduled',
  'quiz.published'
);

CREATE TYPE workflow_action_type AS ENUM (
  'notify_students',
  'create_calendar_event',
  'log_only'
);

CREATE TYPE workflow_log_status AS ENUM ('success', 'failed', 'retrying');

CREATE TABLE workflow_rules (
  id            UUID                    PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(255)            NOT NULL,
  trigger_event workflow_trigger_event  NOT NULL,
  condition     JSONB,
  actions       workflow_action_type[]  NOT NULL CHECK (array_length(actions, 1) > 0),
  is_active     BOOLEAN                 NOT NULL DEFAULT TRUE,
  created_by    UUID                    NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

-- Dispatch-time lookup: active rules for a given trigger
CREATE INDEX idx_workflow_rules_trigger ON workflow_rules (trigger_event)
  WHERE is_active = TRUE AND deleted_at IS NULL;

CREATE TRIGGER trg_workflow_rules_updated_at
  BEFORE UPDATE ON workflow_rules
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TABLE workflow_logs (
  id            UUID                   PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_name VARCHAR(255)           NOT NULL,
  trigger_event workflow_trigger_event NOT NULL,
  rule_id       UUID                   REFERENCES workflow_rules(id),
  action        workflow_action_type,
  actor_id      UUID                   REFERENCES users(id),
  payload       JSONB,
  status        workflow_log_status    NOT NULL DEFAULT 'success',
  error_message TEXT,
  retry_count   SMALLINT               NOT NULL DEFAULT 0,
  executed_at   TIMESTAMPTZ            NOT NULL DEFAULT NOW()
);

-- Faculty Operations "workflow-logs" tab: recent events, optionally by actor
CREATE INDEX idx_workflow_logs_trigger ON workflow_logs (trigger_event, executed_at DESC);
CREATE INDEX idx_workflow_logs_actor   ON workflow_logs (actor_id, executed_at DESC);
CREATE INDEX idx_workflow_logs_status  ON workflow_logs (status) WHERE status != 'success';

-- Seed the two default rules that give real new synchronization behavior —
-- LMS assignment/material creation currently have no notification/calendar
-- side effects at all (confirmed absent from lmsAssignment.service.ts and
-- material.service.ts). The other trigger events (lesson.completed,
-- lesson.rescheduled, quiz.published) already get their notifications/calendar
-- sync done inline by teachingPlan.service.ts, so they default to log_only —
-- editable later via POST/PUT /workflow/rules without another migration.
INSERT INTO workflow_rules (name, trigger_event, actions, created_by)
SELECT 'Notify students and add calendar deadline on new assignment',
       'assignment.created', ARRAY['notify_students', 'create_calendar_event']::workflow_action_type[], u.id
FROM users u WHERE u.role = 'admin' ORDER BY u.created_at LIMIT 1;

INSERT INTO workflow_rules (name, trigger_event, actions, created_by)
SELECT 'Notify students when new course material is uploaded',
       'material.created', ARRAY['notify_students']::workflow_action_type[], u.id
FROM users u WHERE u.role = 'admin' ORDER BY u.created_at LIMIT 1;

INSERT INTO workflow_rules (name, trigger_event, actions, created_by)
SELECT 'Log lesson completion sync (progress/roadmap/dashboard/analytics are computed live)',
       'lesson.completed', ARRAY['log_only']::workflow_action_type[], u.id
FROM users u WHERE u.role = 'admin' ORDER BY u.created_at LIMIT 1;

INSERT INTO workflow_rules (name, trigger_event, actions, created_by)
SELECT 'Log lesson reschedule sync (calendar/roadmap/notification already handled inline)',
       'lesson.rescheduled', ARRAY['log_only']::workflow_action_type[], u.id
FROM users u WHERE u.role = 'admin' ORDER BY u.created_at LIMIT 1;

INSERT INTO workflow_rules (name, trigger_event, actions, created_by)
SELECT 'Log quiz publication sync (notification already handled inline)',
       'quiz.published', ARRAY['log_only']::workflow_action_type[], u.id
FROM users u WHERE u.role = 'admin' ORDER BY u.created_at LIMIT 1;
