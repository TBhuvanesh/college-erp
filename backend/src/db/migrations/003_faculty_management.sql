-- Sprint 4: Faculty Management
-- Dependency order: departments (from 002) → faculty
-- Mirrors the student table structure: soft-delete, audit-ready, extensible.

-- ── Faculty Designation ────────────────────────────────────────────────────────
CREATE TYPE faculty_designation AS ENUM (
  'professor',
  'associate_professor',
  'assistant_professor',
  'lecturer'
);

-- ── Faculty Status ─────────────────────────────────────────────────────────────
CREATE TYPE faculty_status AS ENUM ('active', 'on_leave', 'resigned', 'retired');

-- ── Faculty ───────────────────────────────────────────────────────────────────
-- One-to-one with users (user_id carries login credentials + role).
-- employee_number is the institution-assigned HR identifier.
-- Future modules (timetables, subject assignments) reference faculty.id.
CREATE TABLE faculty (
  id              UUID                PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID                NOT NULL UNIQUE REFERENCES users(id),
  employee_number VARCHAR(20)         NOT NULL UNIQUE,
  full_name       VARCHAR(255)        NOT NULL,
  department_id   UUID                NOT NULL REFERENCES departments(id),
  designation     faculty_designation NOT NULL,
  status          faculty_status      NOT NULL DEFAULT 'active',
  created_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_faculty_department  ON faculty (department_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_faculty_designation ON faculty (designation)   WHERE deleted_at IS NULL;
CREATE INDEX idx_faculty_status      ON faculty (status)        WHERE deleted_at IS NULL;

CREATE TRIGGER trg_faculty_updated_at
  BEFORE UPDATE ON faculty
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
