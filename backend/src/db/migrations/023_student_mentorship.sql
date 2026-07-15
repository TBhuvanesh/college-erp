-- Migration 023: Student Mentorship Management
-- Dependency: faculty (003), students (002)

-- Create mentor_assignment_status ENUM
CREATE TYPE mentor_assignment_status AS ENUM ('active', 'reassigned', 'completed');

-- Create mentor_assignments table
CREATE TABLE mentor_assignments (
  id            UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
  mentor_id     UUID                     NOT NULL REFERENCES faculty(id),
  student_id    UUID                     NOT NULL REFERENCES students(id),
  assigned_by   UUID                     NOT NULL REFERENCES users(id),
  assigned_date TIMESTAMPTZ              NOT NULL DEFAULT NOW(),
  status        mentor_assignment_status NOT NULL DEFAULT 'active',
  created_at    TIMESTAMPTZ              NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ              NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

-- Ensure a student can have at most one active mentor at a time
CREATE UNIQUE INDEX idx_unique_active_mentee 
  ON mentor_assignments (student_id) 
  WHERE status = 'active' AND deleted_at IS NULL;

CREATE INDEX idx_mentor_assignments_mentor 
  ON mentor_assignments (mentor_id) 
  WHERE deleted_at IS NULL;

-- Trigger to update updated_at on mentor_assignments
CREATE TRIGGER trg_mentor_assignments_updated_at
  BEFORE UPDATE ON mentor_assignments
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Create mentoring_notes table
CREATE TABLE mentoring_notes (
  id             UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  mentor_id      UUID         NOT NULL REFERENCES faculty(id),
  student_id     UUID         NOT NULL REFERENCES students(id),
  title          VARCHAR(255) NOT NULL,
  remarks        TEXT         NOT NULL,
  meeting_date   DATE         NOT NULL,
  follow_up_date DATE,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at     TIMESTAMPTZ
);

CREATE INDEX idx_mentoring_notes_student 
  ON mentoring_notes (student_id) 
  WHERE deleted_at IS NULL;

CREATE INDEX idx_mentoring_notes_mentor 
  ON mentoring_notes (mentor_id) 
  WHERE deleted_at IS NULL;

-- Trigger to update updated_at on mentoring_notes
CREATE TRIGGER trg_mentoring_notes_updated_at
  BEFORE UPDATE ON mentoring_notes
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Add is_mentoring_head flag to faculty table
ALTER TABLE faculty ADD COLUMN is_mentoring_head BOOLEAN NOT NULL DEFAULT false;

-- Add parent_contact to students table
ALTER TABLE students ADD COLUMN parent_contact VARCHAR(20);

