-- Migration 050: Sprint 3 Workflow Events & Seed Rules
--
-- Adds default rules for new lifecycle trigger events.

INSERT INTO workflow_rules (name, trigger_event, actions, created_by)
SELECT 'Log faculty created',
       'faculty.created', ARRAY['log_only']::workflow_action_type[], u.id
FROM users u WHERE u.role = 'admin' ORDER BY u.created_at LIMIT 1;

INSERT INTO workflow_rules (name, trigger_event, actions, created_by)
SELECT 'Log faculty updated',
       'faculty.updated', ARRAY['log_only']::workflow_action_type[], u.id
FROM users u WHERE u.role = 'admin' ORDER BY u.created_at LIMIT 1;

INSERT INTO workflow_rules (name, trigger_event, actions, created_by)
SELECT 'Handle faculty deactivated',
       'faculty.deactivated', ARRAY['log_only']::workflow_action_type[], u.id
FROM users u WHERE u.role = 'admin' ORDER BY u.created_at LIMIT 1;

INSERT INTO workflow_rules (name, trigger_event, actions, created_by)
SELECT 'Log teaching assignment updated',
       'teaching_assignment.updated', ARRAY['log_only']::workflow_action_type[], u.id
FROM users u WHERE u.role = 'admin' ORDER BY u.created_at LIMIT 1;

INSERT INTO workflow_rules (name, trigger_event, actions, created_by)
SELECT 'Handle teaching assignment revoked',
       'teaching_assignment.revoked', ARRAY['log_only']::workflow_action_type[], u.id
FROM users u WHERE u.role = 'admin' ORDER BY u.created_at LIMIT 1;

INSERT INTO workflow_rules (name, trigger_event, actions, created_by)
SELECT 'Handle result finalized',
       'result.finalized', ARRAY['log_only']::workflow_action_type[], u.id
FROM users u WHERE u.role = 'admin' ORDER BY u.created_at LIMIT 1;
