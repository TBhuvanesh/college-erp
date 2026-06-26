-- Sprint 6: Attendance Management
-- Dependency order: students, faculty, subjects (from 002–004) → faculty_subject_assignments (005) → attendance
--
-- Design decisions:
--   • No deleted_at — attendance is an immutable ledger. Records are corrected (UPDATE), never erased.
--   • UNIQUE (student_id, subject_id, attendance_date) prevents duplicate entries and enables upsert.
--   • attendance_date is DATE (timezone-agnostic) — the institution's local calendar date of the session.

CREATE TYPE attendance_status AS ENUM ('present', 'absent');

CREATE TABLE attendance (
  id              UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id      UUID              NOT NULL REFERENCES students(id),
  faculty_id      UUID              NOT NULL REFERENCES faculty(id),
  subject_id      UUID              NOT NULL REFERENCES subjects(id),
  section         VARCHAR(10)       NOT NULL,
  attendance_date DATE              NOT NULL,
  status          attendance_status NOT NULL,
  created_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, subject_id, attendance_date)
);

-- Single-column indexes used for filter queries (admin list)
CREATE INDEX idx_attendance_student  ON attendance (student_id);
CREATE INDEX idx_attendance_subject  ON attendance (subject_id);
CREATE INDEX idx_attendance_faculty  ON attendance (faculty_id);
CREATE INDEX idx_attendance_date     ON attendance (attendance_date DESC);

-- Composite indexes aligned to expected query patterns
-- Faculty marking session: look up all records for a session
CREATE INDEX idx_attendance_session         ON attendance (subject_id, section, attendance_date);
-- Student summary: aggregate per subject for one student
CREATE INDEX idx_attendance_student_subject ON attendance (student_id, subject_id);

CREATE TRIGGER trg_attendance_updated_at
  BEFORE UPDATE ON attendance
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
