-- Migration 031: Examination Module Enterprise Synchronization
--
-- Design notes:
--   • Every change here is additive — no existing column, table, or enum value
--     is altered/removed. Legacy rows and the existing flat-capacity/direct-
--     examIds seating flow keep working exactly as before.
--   • under_maintenance/maintenance_note extend exam_rooms so the Resource
--     Availability Engine can report a 'maintenance' state distinct from the
--     existing static is_active ('inactive') flag — a room can be temporarily
--     out of service without being deactivated entirely.
--   • room_id on calendar_entries lets ANY module (not just exam seating) book
--     a room via the existing generic calendar mechanism, and have the
--     Resource Availability Engine see it as occupied — reusing calendar_entries
--     instead of inventing a standalone room-reservation table.
--   • recipient_user_id on notifications enables single-recipient notifications
--     (e.g. "you've been assigned invigilation duty") alongside the existing
--     role+department+semester broadcast targeting — nullable, fully backward
--     compatible with every existing broadcast-only call site.
--   • last_conflict_count/validated_at on exam_sessions cache the outcome of
--     the Conflict Engine so dashboard widgets don't re-run a full conflict
--     check on every load, and validated_at marks the new 'validated' status
--     transition required before publish is allowed.
--   • The workflow_trigger_event enum addition ('exam_seating.published') and
--     the two new exam_session_status values ('validated', 'completed' — the
--     enum already had 'draft'/'generated'/'published'/'archived' from 030,
--     this fills in the missing lifecycle steps) are handled specially in
--     migrate.ts (like 020/021/026) since Postgres requires
--     ALTER TYPE ... ADD VALUE to run outside the migration's transaction.

ALTER TABLE exam_rooms
  ADD COLUMN under_maintenance BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN maintenance_note  TEXT;

ALTER TABLE calendar_entries ADD COLUMN room_id UUID REFERENCES exam_rooms(id);
CREATE INDEX idx_calendar_entries_room ON calendar_entries (room_id) WHERE deleted_at IS NULL AND room_id IS NOT NULL;

ALTER TABLE notifications ADD COLUMN recipient_user_id UUID REFERENCES users(id);
CREATE INDEX idx_notifications_recipient ON notifications (recipient_user_id) WHERE deleted_at IS NULL AND recipient_user_id IS NOT NULL;

ALTER TABLE exam_sessions
  ADD COLUMN last_conflict_count SMALLINT,
  ADD COLUMN validated_at        TIMESTAMPTZ;
