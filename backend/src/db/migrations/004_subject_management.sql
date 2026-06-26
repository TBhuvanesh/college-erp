-- Sprint 5: Subject Management
-- Dependency order: departments + programs (from 002) → subjects
-- subjects.id is the FK target for future attendance sessions and faculty assignments.

-- ── Subject Type ───────────────────────────────────────────────────────────────
CREATE TYPE subject_type AS ENUM ('core', 'elective', 'lab');

-- ── Subject Status ─────────────────────────────────────────────────────────────
CREATE TYPE subject_status AS ENUM ('active', 'inactive', 'archived');

-- ── Subjects ──────────────────────────────────────────────────────────────────
-- A subject belongs to one program for one semester.
-- code is globally unique (institutional identifier, e.g. 'CS301').
-- Future modules: faculty_subject_assignments and attendance_sessions reference subjects.id.
CREATE TABLE subjects (
  id            UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  code          VARCHAR(20)    NOT NULL UNIQUE,
  name          VARCHAR(150)   NOT NULL,
  department_id UUID           NOT NULL REFERENCES departments(id),
  program_id    UUID           NOT NULL REFERENCES programs(id),
  semester      SMALLINT       NOT NULL CHECK (semester BETWEEN 1 AND 12),
  credits       SMALLINT       NOT NULL CHECK (credits BETWEEN 1 AND 10),
  type          subject_type   NOT NULL,
  status        subject_status NOT NULL DEFAULT 'active',
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ,
  UNIQUE (program_id, name)
);

CREATE INDEX idx_subjects_department  ON subjects (department_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_subjects_program     ON subjects (program_id)    WHERE deleted_at IS NULL;
CREATE INDEX idx_subjects_semester    ON subjects (semester)      WHERE deleted_at IS NULL;
CREATE INDEX idx_subjects_status      ON subjects (status)        WHERE deleted_at IS NULL;
-- Composite: attendance sessions query roster by (program_id, semester)
CREATE INDEX idx_subjects_program_sem ON subjects (program_id, semester) WHERE deleted_at IS NULL AND status = 'active';

CREATE TRIGGER trg_subjects_updated_at
  BEFORE UPDATE ON subjects
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
