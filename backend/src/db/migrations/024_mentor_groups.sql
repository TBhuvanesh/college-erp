-- Migration 024: Group-Based Student Mentorship
-- Dependency: faculty (003), students (002), departments (002), users (001)

-- Create mentor_assignment_method ENUM
CREATE TYPE mentor_assignment_method AS ENUM ('range', 'section', 'manual');

-- Create mentor_groups table
CREATE TABLE mentor_groups (
  id                  UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
  mentor_id           UUID                     NOT NULL REFERENCES faculty(id),
  department_id       UUID                     NOT NULL REFERENCES departments(id),
  year                INTEGER                  NOT NULL,
  semester            INTEGER                  NOT NULL,
  section             VARCHAR(50)              NOT NULL,
  assignment_method   mentor_assignment_method NOT NULL,
  roll_number_start   VARCHAR(50),
  roll_number_end     VARCHAR(50),
  created_by          UUID                     NOT NULL REFERENCES users(id),
  created_at          TIMESTAMPTZ              NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ              NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

-- Create mentor_group_students table for manual selection
CREATE TABLE mentor_group_students (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  mentor_group_id UUID        NOT NULL REFERENCES mentor_groups(id) ON DELETE CASCADE,
  student_id      UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

-- Index optimizations
CREATE UNIQUE INDEX idx_unique_manual_group_student
  ON mentor_group_students (student_id, mentor_group_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_mentor_groups_mentor
  ON mentor_groups (mentor_id)
  WHERE deleted_at IS NULL;

-- Trigger to update updated_at on mentor_groups
CREATE TRIGGER trg_mentor_groups_updated_at
  BEFORE UPDATE ON mentor_groups
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Porting script: Migrate active individual mentor_assignments into Mentor Groups
DO $$
DECLARE
    r RECORD;
    new_group_id UUID;
BEGIN
    FOR r IN 
        SELECT DISTINCT 
            ma.mentor_id, 
            s.department_id, 
            CEIL(s.semester::numeric / 2)::integer as yr, 
            s.semester, 
            COALESCE(s.section, 'A') as sec, 
            ma.assigned_by
        FROM mentor_assignments ma
        JOIN students s ON ma.student_id = s.id
        WHERE ma.status = 'active' AND ma.deleted_at IS NULL
    LOOP
        -- Insert a new mentor group representing the existing assignments
        INSERT INTO mentor_groups (
            mentor_id, department_id, year, semester, section, assignment_method, created_by
        )
        VALUES (
            r.mentor_id, r.department_id, r.yr, r.semester, r.sec, 'manual', r.assigned_by
        )
        RETURNING id INTO new_group_id;

        -- Associate all mapped students who belong to this mentor group
        INSERT INTO mentor_group_students (mentor_group_id, student_id)
        SELECT new_group_id, ma.student_id
        FROM mentor_assignments ma
        JOIN students s ON ma.student_id = s.id
        WHERE ma.status = 'active' AND ma.deleted_at IS NULL 
          AND ma.mentor_id = r.mentor_id 
          AND s.department_id = r.department_id 
          AND s.semester = r.semester 
          AND COALESCE(s.section, 'A') = r.sec;
    END LOOP;
END $$;
