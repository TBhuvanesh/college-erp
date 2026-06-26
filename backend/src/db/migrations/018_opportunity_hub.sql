-- Sprint 18: Opportunity Hub Module
-- Dependencies: departments (004 via subjects), users (001)
--
-- Design notes:
--   • department_id = NULL means "all departments" — no join required for eligibility.
--   • eligible_years = NULL means "all years" — stored as TEXT[] so the
--     check is simply: $yearGroup = ANY(eligible_years).
--   • created_by references users(id) so both admin and faculty UUIDs work.
--   • Soft-delete on opportunities; bookmarks use hard-delete (toggle semantics).
--   • start_date / deadline are stored so future calendar integration can
--     read them without schema changes.

CREATE TYPE opportunity_type AS ENUM (
  'Internship',
  'Job Opportunity',
  'Workshop',
  'Seminar',
  'Hackathon',
  'Competition',
  'Placement Drive',
  'College Event'
);

CREATE TYPE opportunity_status AS ENUM ('Active', 'Closed', 'Archived');

-- ── Opportunities ──────────────────────────────────────────────────────────────

CREATE TABLE opportunities (
  id                UUID               PRIMARY KEY DEFAULT uuid_generate_v4(),
  title             VARCHAR(255)       NOT NULL,
  description       TEXT,
  type              opportunity_type   NOT NULL,
  department_id     UUID               REFERENCES departments(id),     -- NULL = all departments
  eligible_years    TEXT[],                                             -- NULL = all years; e.g. '{"I Year","III Year"}'
  registration_link TEXT,
  start_date        TIMESTAMPTZ,
  deadline          TIMESTAMPTZ,
  location          VARCHAR(255),
  organizer         VARCHAR(255),
  status            opportunity_status NOT NULL DEFAULT 'Active',
  created_by        UUID               NOT NULL REFERENCES users(id),
  created_at        TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ,

  CONSTRAINT chk_opportunity_dates CHECK (
    start_date IS NULL OR deadline IS NULL OR start_date <= deadline
  )
);

CREATE INDEX idx_opportunities_type       ON opportunities(type)          WHERE deleted_at IS NULL;
CREATE INDEX idx_opportunities_status     ON opportunities(status)        WHERE deleted_at IS NULL;
CREATE INDEX idx_opportunities_department ON opportunities(department_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_opportunities_deadline   ON opportunities(deadline)      WHERE deleted_at IS NULL;
CREATE INDEX idx_opportunities_created_by ON opportunities(created_by)    WHERE deleted_at IS NULL;

-- Index to accelerate student eligibility queries (department + year array)
CREATE INDEX idx_opportunities_eligible_years ON opportunities USING GIN (eligible_years)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_opportunities_updated_at
  BEFORE UPDATE ON opportunities
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ── Bookmarks (student ↔ opportunity, no soft-delete) ─────────────────────────

CREATE TABLE opportunity_bookmarks (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  opportunity_id UUID        NOT NULL REFERENCES opportunities(id),
  student_id     UUID        NOT NULL REFERENCES students(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_bookmark_student_opportunity
  ON opportunity_bookmarks(student_id, opportunity_id);

CREATE INDEX idx_bookmarks_student      ON opportunity_bookmarks(student_id);
CREATE INDEX idx_bookmarks_opportunity  ON opportunity_bookmarks(opportunity_id);
