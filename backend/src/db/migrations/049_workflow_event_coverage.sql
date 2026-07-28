-- Migration 049: Workflow Event Coverage (ERP Integration Sprint, Phase 4)
--
-- Design notes:
--   • Adds the five events named in the integration sprint brief that
--     weren't wired through the Workflow Engine yet: AttendanceMarked,
--     MarksPublished, FeedbackPublished, MentorAssigned, FeePaid. Every one
--     of the underlying synchronizations already happens today (attendance
--     writes are immediate, publishResults already updates student-facing
--     state directly, etc.) — this migration only adds the *event*, so an
--     admin can attach additional configurable actions (a calendar entry, a
--     targeted notification) later without another migration, exactly like
--     the five trigger events added in migrations 028/031/042/044/046.
--   • Seeded with 'log_only' (audit-trail-only) rules, matching the
--     convention established in 028 — these are the safe, do-nothing-extra
--     default; an admin can add notify_students/create_calendar_event rules
--     for any of them later via the existing workflow_rules API without
--     touching code.
--   • Enum additions handled specially in migrate.ts (ALTER TYPE ... ADD
--     VALUE outside this migration's transaction — same pattern as every
--     prior workflow_trigger_event addition).

INSERT INTO workflow_rules (name, trigger_event, actions, created_by)
SELECT 'Log attendance marked (rosters already update live via implicit join)',
       'attendance.marked', ARRAY['log_only']::workflow_action_type[], u.id
FROM users u WHERE u.role = 'admin' ORDER BY u.created_at LIMIT 1;

INSERT INTO workflow_rules (name, trigger_event, actions, created_by)
SELECT 'Log marks published (student dashboard/CGPA/notifications already synced inline by result.service.ts)',
       'marks.published', ARRAY['log_only']::workflow_action_type[], u.id
FROM users u WHERE u.role = 'admin' ORDER BY u.created_at LIMIT 1;

INSERT INTO workflow_rules (name, trigger_event, actions, created_by)
SELECT 'Log feedback campaign published',
       'feedback.published', ARRAY['log_only']::workflow_action_type[], u.id
FROM users u WHERE u.role = 'admin' ORDER BY u.created_at LIMIT 1;

INSERT INTO workflow_rules (name, trigger_event, actions, created_by)
SELECT 'Log mentor assigned/reassigned',
       'mentor.assigned', ARRAY['log_only']::workflow_action_type[], u.id
FROM users u WHERE u.role = 'admin' ORDER BY u.created_at LIMIT 1;

INSERT INTO workflow_rules (name, trigger_event, actions, created_by)
SELECT 'Log fee payment recorded',
       'fee.paid', ARRAY['log_only']::workflow_action_type[], u.id
FROM users u WHERE u.role = 'admin' ORDER BY u.created_at LIMIT 1;
