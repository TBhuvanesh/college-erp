-- Sprint 19: Notification Center & Calendar Integration
--
-- Design notes:
--   • notifications stores one row per notification (shared across many users).
--     Per-user read state lives in notification_reads — avoids N-row duplication.
--   • target_role TEXT CHECK is preferred over ENUM so 'all' can be added without
--     a type-system migration, and to keep the role model in one place (types/roles.ts).
--   • source_module + source_id (TEXT + UUID, no FK) provide cross-table traceability
--     without tight coupling. Integrity enforced at the application layer.
--   • calendar_entries stores both auto-generated (sourceModule set) and personal
--     entries (sourceModule NULL, visibility='personal').
--   • visibility = 'personal' entries are only shown to their creator.
--   • CHECK(start_date <= end_date) enforces date order at the DB level.

-- ── ENUMs ───────────────────────────────────────────────────────────────────────

CREATE TYPE notification_type AS ENUM (
  'Announcement',
  'Assignment',
  'Grade Released',
  'Event',
  'Internship',
  'Job Opportunity',
  'Placement Drive',
  'Reminder',
  'Academic Alert'
);

CREATE TYPE calendar_event_type AS ENUM (
  'Academic',
  'Assignment Deadline',
  'Examination',
  'Opportunity',
  'Reminder',
  'Meeting',
  'Other'
);

CREATE TYPE calendar_visibility AS ENUM (
  'personal',
  'department',
  'semester',
  'faculty',
  'student',
  'institution_wide'
);

-- ── Notifications ────────────────────────────────────────────────────────────────

CREATE TABLE notifications (
  id             UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  title          VARCHAR(255)      NOT NULL,
  message        TEXT              NOT NULL,
  type           notification_type NOT NULL,
  source_module  TEXT,
  source_id      UUID,
  target_role    TEXT              NOT NULL DEFAULT 'all'
                   CHECK (target_role IN ('all', 'admin', 'faculty', 'student')),
  department_id  UUID              REFERENCES departments(id),
  semester       SMALLINT          CHECK (semester BETWEEN 1 AND 12),
  is_important   BOOLEAN           NOT NULL DEFAULT FALSE,
  created_by     UUID              NOT NULL REFERENCES users(id),
  created_at     TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  deleted_at     TIMESTAMPTZ
);

-- Role+dept scoping — most common list query filter
CREATE INDEX idx_notifications_target ON notifications (target_role, department_id)
  WHERE deleted_at IS NULL;

-- Type filter for admin dashboards
CREATE INDEX idx_notifications_type ON notifications (type, created_at DESC)
  WHERE deleted_at IS NULL;

-- ── Notification reads (per-user read tracking) ──────────────────────────────────

CREATE TABLE notification_reads (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  notification_id UUID        NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_notification_read ON notification_reads (notification_id, user_id);

-- Fast unread count: user_id first since queries are always user-scoped
CREATE INDEX idx_notification_reads_user ON notification_reads (user_id, notification_id);

-- ── Calendar entries ─────────────────────────────────────────────────────────────

CREATE TABLE calendar_entries (
  id             UUID                PRIMARY KEY DEFAULT uuid_generate_v4(),
  title          VARCHAR(255)        NOT NULL,
  description    TEXT,
  event_type     calendar_event_type NOT NULL DEFAULT 'Other',
  start_date     TIMESTAMPTZ         NOT NULL,
  end_date       TIMESTAMPTZ,
  visibility     calendar_visibility NOT NULL DEFAULT 'personal',
  source_module  TEXT,
  source_id      UUID,
  department_id  UUID                REFERENCES departments(id),
  semester       SMALLINT            CHECK (semester BETWEEN 1 AND 12),
  created_by     UUID                NOT NULL REFERENCES users(id),
  created_at     TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  deleted_at     TIMESTAMPTZ,
  CONSTRAINT chk_calendar_entry_dates CHECK (end_date IS NULL OR end_date >= start_date)
);

-- Date-range browsing: most common query
CREATE INDEX idx_calendar_entries_dates ON calendar_entries (start_date, end_date)
  WHERE deleted_at IS NULL;

-- Visibility + dept scoping
CREATE INDEX idx_calendar_entries_visibility ON calendar_entries (visibility, department_id)
  WHERE deleted_at IS NULL;

-- Personal entries lookup by creator
CREATE INDEX idx_calendar_entries_creator ON calendar_entries (created_by, start_date)
  WHERE deleted_at IS NULL AND visibility = 'personal';

-- Source traceability (prevents duplicate auto-generation)
CREATE UNIQUE INDEX uq_calendar_source ON calendar_entries (source_module, source_id)
  WHERE deleted_at IS NULL AND source_module IS NOT NULL;

CREATE TRIGGER trg_calendar_entries_updated_at
  BEFORE UPDATE ON calendar_entries
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
