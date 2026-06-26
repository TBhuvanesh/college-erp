-- Sprint 7: Internal Marks Management
-- Dependency order: students, faculty, subjects → faculty_subject_assignments → internal_marks
--
-- Design decisions:
--   • Implements UNIQUE (student_id, subject_id, assessment_type) constraint to prevent duplicate marks records.
--   • Numeric(5, 2) values are used for maximum and obtained marks (supporting decimal values like 18.5).
--   • Input checks confirm obtained marks cannot exceed maximum marks.

CREATE TYPE assessment_type AS ENUM ('Assignment', 'Mid-1', 'Mid-2', 'Lab', 'Internal');

CREATE TABLE internal_marks (
  id              UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id      UUID              NOT NULL REFERENCES students(id),
  faculty_id      UUID              NOT NULL REFERENCES faculty(id),
  subject_id      UUID              NOT NULL REFERENCES subjects(id),
  section         VARCHAR(10)       NOT NULL,
  assessment_type assessment_type   NOT NULL,
  maximum_marks   NUMERIC(5, 2)     NOT NULL,
  obtained_marks  NUMERIC(5, 2)     NOT NULL,
  remarks         TEXT,
  created_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, subject_id, assessment_type),
  CONSTRAINT chk_obtained_marks CHECK (obtained_marks >= 0 AND obtained_marks <= maximum_marks),
  CONSTRAINT chk_maximum_marks CHECK (maximum_marks > 0)
);

-- Indexes for performance filtering (Admin list filters)
CREATE INDEX idx_marks_student  ON internal_marks (student_id);
CREATE INDEX idx_marks_subject  ON internal_marks (subject_id);
CREATE INDEX idx_marks_faculty  ON internal_marks (faculty_id);
CREATE INDEX idx_marks_type     ON internal_marks (assessment_type);

-- Composite index for student summaries and history queries
CREATE INDEX idx_marks_student_subject ON internal_marks (student_id, subject_id);

CREATE TRIGGER trg_internal_marks_updated_at
  BEFORE UPDATE ON internal_marks
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
