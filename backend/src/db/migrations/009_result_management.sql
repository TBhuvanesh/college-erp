-- Sprint 9: Result Management
-- Dependencies: students (002), faculty (003), subjects (004), exams (008)
--
-- Extensibility notes:
--   • results.id is the FK anchor for future transcript / academic-report tables.
--   • grade and result_status are stored (not derived at query time) so that
--     historical snapshots survive regulation changes.
--   • internal_max_marks + external_max_marks are stored per-row, not per-subject,
--     so that different exam sessions can carry different weightings.
--   • exam_id is nullable: a result can exist without a matching scheduled exam
--     (manual entry, supplementary, etc.). When present it ties the result to the
--     Examination Management module for cross-module analytics.
--   • publication_status governs student visibility; draft results are invisible
--     to students and visible only to faculty (own) and admin.
--
-- Grade computation:
--   Thresholds live in src/config/grading.ts, not here, so institution-level
--   overrides require no schema migrations.

CREATE TYPE result_grade AS ENUM ('O', 'A+', 'A', 'B+', 'B', 'C', 'F');
CREATE TYPE result_status AS ENUM ('Pass', 'Fail', 'Absent');
CREATE TYPE result_pub_status AS ENUM ('Draft', 'Published');

CREATE TABLE results (
  id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id          UUID            NOT NULL REFERENCES students(id),
  subject_id          UUID            NOT NULL REFERENCES subjects(id),
  exam_id             UUID            REFERENCES exams(id),     -- nullable; links to Examination module
  faculty_id          UUID            NOT NULL REFERENCES faculty(id),
  semester            SMALLINT        NOT NULL CHECK (semester BETWEEN 1 AND 12),
  section             VARCHAR(10)     NOT NULL,
  internal_marks      NUMERIC(5, 2)   NOT NULL CHECK (internal_marks >= 0),
  internal_max_marks  NUMERIC(5, 2)   NOT NULL CHECK (internal_max_marks > 0),
  external_marks      NUMERIC(5, 2)   NOT NULL CHECK (external_marks >= 0),
  external_max_marks  NUMERIC(5, 2)   NOT NULL CHECK (external_max_marks > 0),
  total_marks         NUMERIC(5, 2)   NOT NULL CHECK (total_marks >= 0),
  grade               result_grade    NOT NULL,
  result_status       result_status   NOT NULL,
  publication_status  result_pub_status NOT NULL DEFAULT 'Draft',
  published_at        TIMESTAMPTZ,
  remarks             TEXT,
  created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ,
  UNIQUE (student_id, subject_id),
  CONSTRAINT chk_result_internal_bounds  CHECK (internal_marks <= internal_max_marks),
  CONSTRAINT chk_result_external_bounds  CHECK (external_marks <= external_max_marks),
  CONSTRAINT chk_result_total_consistent CHECK (total_marks = internal_marks + external_marks)
);

-- Subject+section queries (faculty view, admin filter)
CREATE INDEX idx_results_subject_section ON results (subject_id, section) WHERE deleted_at IS NULL;

-- Student history queries
CREATE INDEX idx_results_student ON results (student_id) WHERE deleted_at IS NULL;

-- Admin filter by faculty
CREATE INDEX idx_results_faculty ON results (faculty_id) WHERE deleted_at IS NULL;

-- Semester filter
CREATE INDEX idx_results_semester ON results (semester) WHERE deleted_at IS NULL;

-- Student visibility: only Published results are served to students
CREATE INDEX idx_results_published ON results (student_id, publication_status)
  WHERE deleted_at IS NULL AND publication_status = 'Published';

CREATE TRIGGER trg_results_updated_at
  BEFORE UPDATE ON results
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
