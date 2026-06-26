-- Sprint 2: Student Management
-- Dependency order: departments → programs → students
-- All tables use soft-delete (deleted_at) per the audit-first architectural mandate.

-- ── Departments ───────────────────────────────────────────────────────────────
CREATE TABLE departments (
  id         UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       VARCHAR(100) NOT NULL UNIQUE,
  code       VARCHAR(10)  NOT NULL UNIQUE,  -- e.g. 'CS', 'EC', 'ME'
  is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TRIGGER trg_departments_updated_at
  BEFORE UPDATE ON departments
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ── Programs (Degree Courses) ─────────────────────────────────────────────────
-- A program belongs to one department and has a fixed number of semesters.
CREATE TABLE programs (
  id               UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  department_id    UUID         NOT NULL REFERENCES departments(id),
  name             VARCHAR(100) NOT NULL,          -- e.g. 'B.Tech Computer Science'
  code             VARCHAR(10)  NOT NULL UNIQUE,   -- e.g. 'BTCS', 'MTCS'
  total_semesters  SMALLINT     NOT NULL DEFAULT 8 CHECK (total_semesters BETWEEN 1 AND 12),
  is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ,
  UNIQUE (department_id, name)
);

CREATE INDEX idx_programs_department ON programs (department_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_programs_updated_at
  BEFORE UPDATE ON programs
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ── Student Status ────────────────────────────────────────────────────────────
CREATE TYPE student_status AS ENUM ('active', 'graduated', 'suspended', 'inactive');

-- ── Students ──────────────────────────────────────────────────────────────────
-- One-to-one with users (user_id carries login credentials + role).
-- roll_number is the institution-assigned academic identifier.
-- All future modules (attendance, fees, examinations) reference students.id.
CREATE TABLE students (
  id            UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID           NOT NULL UNIQUE REFERENCES users(id),
  roll_number   VARCHAR(20)    NOT NULL UNIQUE,
  full_name     VARCHAR(255)   NOT NULL,
  department_id UUID           NOT NULL REFERENCES departments(id),
  program_id    UUID           NOT NULL REFERENCES programs(id),
  semester      SMALLINT       NOT NULL CHECK (semester BETWEEN 1 AND 12),
  section       VARCHAR(10),
  academic_year VARCHAR(9)     NOT NULL CHECK (academic_year ~ '^\d{4}-\d{4}$'),
  status        student_status NOT NULL DEFAULT 'active',
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

-- Covering indexes for the query patterns used by attendance, fees, and exams
CREATE INDEX idx_students_department   ON students (department_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_students_program      ON students (program_id)    WHERE deleted_at IS NULL;
CREATE INDEX idx_students_semester     ON students (semester)      WHERE deleted_at IS NULL;
CREATE INDEX idx_students_status       ON students (status)        WHERE deleted_at IS NULL;
CREATE INDEX idx_students_academic_yr  ON students (academic_year) WHERE deleted_at IS NULL;
-- Composite index used by attendance roster queries (future module)
CREATE INDEX idx_students_program_sem  ON students (program_id, semester) WHERE deleted_at IS NULL AND status = 'active';

CREATE TRIGGER trg_students_updated_at
  BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
