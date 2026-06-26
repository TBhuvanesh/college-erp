-- Sprint 11: Announcement & Notification Management
-- Dependencies: departments (001/002), users (001)
--
-- Design notes:
--   • announcements.id is the FK anchor for future tables:
--       announcement_deliveries — tracks push/email/SMS sends
--       announcement_reads      — tracks per-user read receipts
--   • target_audience drives visibility without requiring a separate
--     announcement_targets join table; conditional CHECK constraints enforce
--     that department_id and semester are present when required.
--   • Department Specific and Semester Specific audiences allow precise targeting
--     while keeping the schema simple.
--   • status = 'Expired' is set by the service (lazy refresh on list reads)
--     when expiry_date has passed; no cron job required for MVP.
--   • Ordering: Urgent > High > Medium > Low, then publish_date DESC,
--     implemented in the service query — not in the schema.
--
-- Extensibility:
--   • Adding new audience types (e.g. 'Year Specific', 'Program Specific') is a
--     one-migration ENUM alteration + service rule addition.
--   • Adding priority levels is similarly a single ENUM change.
--   • Future notification delivery tables reference announcements.id as FK.

CREATE TYPE announcement_audience AS ENUM (
  'All', 'Students', 'Faculty', 'Admin',
  'Department Specific', 'Semester Specific'
);

CREATE TYPE announcement_priority AS ENUM ('Low', 'Medium', 'High', 'Urgent');

CREATE TYPE announcement_status AS ENUM ('Draft', 'Published', 'Expired');

CREATE TABLE announcements (
  id              UUID                   PRIMARY KEY DEFAULT uuid_generate_v4(),
  title           VARCHAR(255)           NOT NULL,
  content         TEXT                   NOT NULL,
  target_audience announcement_audience  NOT NULL,
  department_id   UUID                   REFERENCES departments(id),
  semester        SMALLINT               CHECK (semester BETWEEN 1 AND 12),
  priority        announcement_priority  NOT NULL DEFAULT 'Medium',
  publish_date    DATE                   NOT NULL,
  expiry_date     DATE,
  status          announcement_status    NOT NULL DEFAULT 'Draft',
  created_by      UUID                   NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ            NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ            NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  -- Department Specific requires a department_id
  CONSTRAINT chk_ann_dept_audience CHECK (
    target_audience != 'Department Specific' OR department_id IS NOT NULL
  ),
  -- Semester Specific requires a semester number
  CONSTRAINT chk_ann_sem_audience CHECK (
    target_audience != 'Semester Specific' OR semester IS NOT NULL
  ),
  -- expiry must be on or after publish date
  CONSTRAINT chk_ann_expiry_order CHECK (
    expiry_date IS NULL OR expiry_date >= publish_date
  )
);

-- Status-based filtering (most reads filter by status = 'Published')
CREATE INDEX idx_announcements_status ON announcements (status)
  WHERE deleted_at IS NULL;

-- Expiry refresh query: quickly finds stale Published records
CREATE INDEX idx_announcements_expiry ON announcements (expiry_date)
  WHERE deleted_at IS NULL AND status = 'Published' AND expiry_date IS NOT NULL;

-- Department-targeted lookups
CREATE INDEX idx_announcements_dept ON announcements (department_id)
  WHERE deleted_at IS NULL AND target_audience = 'Department Specific';

-- Semester-targeted lookups
CREATE INDEX idx_announcements_semester ON announcements (semester)
  WHERE deleted_at IS NULL AND target_audience = 'Semester Specific';

-- Admin chronological view
CREATE INDEX idx_announcements_created ON announcements (created_at DESC)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_announcements_updated_at
  BEFORE UPDATE ON announcements
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
