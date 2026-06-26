-- Sprint 8: Examination Management
-- Dependency order: students, faculty, subjects (002–004) → exams
--
-- Extensibility notes:
--   • exams.id is designed to be the FK target for a future exam_results table:
--       CREATE TABLE exam_results (
--         exam_id        UUID NOT NULL REFERENCES exams(id),
--         student_id     UUID NOT NULL REFERENCES students(id),
--         obtained_marks NUMERIC(5,2) NOT NULL CHECK (obtained_marks <= (SELECT maximum_marks FROM exams WHERE id = exam_id)),
--         UNIQUE (exam_id, student_id)
--       );
--   • exams.maximum_marks is the authoritative ceiling for result validation.
--   • exams.status transitions: Scheduled → Ongoing → Completed (terminal)
--                                Scheduled → Cancelled (terminal)
--                                Ongoing   → Cancelled (terminal)
--   • semester is stored redundantly from subjects.semester for fast timetable queries
--     without requiring a JOIN to subjects every time.

CREATE TYPE exam_type AS ENUM ('Mid-1', 'Mid-2', 'Lab Exam', 'Internal', 'End Semester');
CREATE TYPE exam_status AS ENUM ('Scheduled', 'Ongoing', 'Completed', 'Cancelled');

CREATE TABLE exams (
  id            UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id    UUID          NOT NULL REFERENCES subjects(id),
  faculty_id    UUID          NOT NULL REFERENCES faculty(id),
  semester      SMALLINT      NOT NULL CHECK (semester BETWEEN 1 AND 12),
  section       VARCHAR(10)   NOT NULL,
  exam_type     exam_type     NOT NULL,
  exam_date     DATE          NOT NULL,
  start_time    TIME          NOT NULL,
  end_time      TIME          NOT NULL,
  maximum_marks NUMERIC(5, 2) NOT NULL CHECK (maximum_marks > 0),
  status        exam_status   NOT NULL DEFAULT 'Scheduled',
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ,
  CONSTRAINT chk_exam_end_after_start CHECK (end_time > start_time)
);

-- Single-column indexes for filter queries
CREATE INDEX idx_exams_subject  ON exams (subject_id)   WHERE deleted_at IS NULL;
CREATE INDEX idx_exams_faculty  ON exams (faculty_id)   WHERE deleted_at IS NULL;
CREATE INDEX idx_exams_date     ON exams (exam_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_exams_status   ON exams (status)       WHERE deleted_at IS NULL;

-- Composite: student timetable queries join on semester + section
CREATE INDEX idx_exams_semester_section ON exams (semester, section) WHERE deleted_at IS NULL;

-- Prevents scheduling the same exam type twice for a subject+section.
-- Partial: allows a new exam to be created after the previous one is Cancelled or deleted.
CREATE UNIQUE INDEX idx_exams_no_duplicate
  ON exams (subject_id, section, exam_type)
  WHERE deleted_at IS NULL AND status != 'Cancelled';

CREATE TRIGGER trg_exams_updated_at
  BEFORE UPDATE ON exams
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
