-- Sprint 6: Faculty Subject Assignments (prerequisite for Attendance)
-- One row = one faculty member teaches one subject for one section in one academic year.
-- attendance.faculty_id and attendance.subject_id are validated against this table at mark-time.

CREATE TABLE faculty_subject_assignments (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  faculty_id    UUID        NOT NULL REFERENCES faculty(id),
  subject_id    UUID        NOT NULL REFERENCES subjects(id),
  academic_year VARCHAR(9)  NOT NULL CHECK (academic_year ~ '^\d{4}-\d{4}$'),
  section       VARCHAR(10) NOT NULL,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ,
  UNIQUE (faculty_id, subject_id, academic_year, section)
);

CREATE INDEX idx_fsa_faculty  ON faculty_subject_assignments (faculty_id)    WHERE deleted_at IS NULL;
CREATE INDEX idx_fsa_subject  ON faculty_subject_assignments (subject_id)    WHERE deleted_at IS NULL;
-- Hot path: faculty loads their active assignments for the current year
CREATE INDEX idx_fsa_active   ON faculty_subject_assignments (faculty_id, academic_year)
                               WHERE deleted_at IS NULL AND is_active = TRUE;

CREATE TRIGGER trg_fsa_updated_at
  BEFORE UPDATE ON faculty_subject_assignments
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
