-- Sprint 17: Course Materials & Assignment Management (LMS MVP)
-- Dependencies: subjects (004), faculty (003), students (002),
--               faculty_subject_assignments (005)
--
-- Design notes:
--   • file_path stores the absolute server path; clients use the
--     /download endpoint — never the raw path.
--   • Soft-delete on all three tables preserves audit trail.
--   • uq_submission_active allows INSERT after soft-delete so a
--     student can resubmit without violating the uniqueness constraint.
--   • marks CHECK (marks >= 0) is enforced at DB level; the service
--     additionally checks marks <= assignment.max_marks.

CREATE TYPE lms_file_type AS ENUM ('pdf', 'ppt', 'pptx', 'doc', 'docx');

-- ── Course Materials ───────────────────────────────────────────────────────────

CREATE TABLE course_materials (
  id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  title       VARCHAR(255)  NOT NULL,
  description TEXT,
  subject_id  UUID          NOT NULL REFERENCES subjects(id),
  faculty_id  UUID          NOT NULL REFERENCES faculty(id),
  file_name   VARCHAR(255)  NOT NULL,       -- original filename for display / download
  file_path   TEXT          NOT NULL UNIQUE, -- absolute server path (UUID-named)
  file_type   lms_file_type NOT NULL,
  file_size   BIGINT        NOT NULL CHECK (file_size > 0),
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX idx_materials_subject ON course_materials(subject_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_materials_faculty ON course_materials(faculty_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_course_materials_updated_at
  BEFORE UPDATE ON course_materials
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ── Assignments ────────────────────────────────────────────────────────────────

CREATE TABLE assignments (
  id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  title       VARCHAR(255)  NOT NULL,
  description TEXT,
  subject_id  UUID          NOT NULL REFERENCES subjects(id),
  faculty_id  UUID          NOT NULL REFERENCES faculty(id),
  due_date    TIMESTAMPTZ   NOT NULL,
  max_marks   NUMERIC(5, 2) NOT NULL CHECK (max_marks > 0),
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX idx_assignments_subject  ON assignments(subject_id)  WHERE deleted_at IS NULL;
CREATE INDEX idx_assignments_faculty  ON assignments(faculty_id)  WHERE deleted_at IS NULL;
CREATE INDEX idx_assignments_due_date ON assignments(due_date)    WHERE deleted_at IS NULL;

CREATE TRIGGER trg_assignments_updated_at
  BEFORE UPDATE ON assignments
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ── Assignment Submissions ─────────────────────────────────────────────────────

CREATE TYPE submission_status AS ENUM ('Submitted', 'Late Submission', 'Evaluated');

CREATE TABLE assignment_submissions (
  id            UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID              NOT NULL REFERENCES assignments(id),
  student_id    UUID              NOT NULL REFERENCES students(id),
  file_name     VARCHAR(255)      NOT NULL,
  file_path     TEXT              NOT NULL UNIQUE,
  file_size     BIGINT            NOT NULL CHECK (file_size > 0),
  status        submission_status NOT NULL DEFAULT 'Submitted',
  marks         NUMERIC(5, 2)     CHECK (marks >= 0),
  feedback      TEXT,
  submitted_at  TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

-- One live submission per student per assignment.
-- Partial index allows a new INSERT after the prior row is soft-deleted
-- (should that ever be required), while still preventing duplicates.
CREATE UNIQUE INDEX uq_submission_active
  ON assignment_submissions(assignment_id, student_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_submissions_assignment ON assignment_submissions(assignment_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_submissions_student    ON assignment_submissions(student_id)    WHERE deleted_at IS NULL;
CREATE INDEX idx_submissions_status     ON assignment_submissions(status)        WHERE deleted_at IS NULL;

CREATE TRIGGER trg_submissions_updated_at
  BEFORE UPDATE ON assignment_submissions
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
