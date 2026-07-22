-- Migration 038: Decouple subjects curriculum parameters to subject_curriculum_mappings

-- 1. Create subject_curriculum_mappings table
CREATE TABLE subject_curriculum_mappings (
  id            UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id    UUID           NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  department_id UUID           NOT NULL REFERENCES departments(id),
  program_id    UUID           REFERENCES programs(id) ON DELETE SET NULL,
  program       VARCHAR(100),
  regulation    VARCHAR(20)    NOT NULL DEFAULT 'R22',
  year          VARCHAR(10)    NOT NULL,
  semester      SMALLINT       NOT NULL CHECK (semester BETWEEN 1 AND 12),
  semester_raw  VARCHAR(10),
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ,
  CONSTRAINT uq_subject_curriculum_mapping UNIQUE (subject_id, department_id, program, regulation, year, semester)
);

CREATE TRIGGER trg_scm_updated_at
  BEFORE UPDATE ON subject_curriculum_mappings
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- 2. Populate subject_curriculum_mappings with existing subjects' department/program placement
INSERT INTO subject_curriculum_mappings (
  subject_id,
  department_id,
  program_id,
  program,
  regulation,
  year,
  semester,
  semester_raw,
  created_at,
  updated_at
)
SELECT
  id,
  department_id,
  program_id,
  program,
  regulation,
  COALESCE(year, 'I'),
  semester,
  semester_raw,
  created_at,
  updated_at
FROM subjects;

-- 3. Add subject_curriculum_mapping_id reference to faculty_subject_assignments
ALTER TABLE faculty_subject_assignments
  ADD COLUMN subject_curriculum_mapping_id UUID REFERENCES subject_curriculum_mappings(id);

-- 4. Set mapping references for existing allocations
UPDATE faculty_subject_assignments fsa
SET subject_curriculum_mapping_id = scm.id
FROM subject_curriculum_mappings scm
WHERE scm.subject_id = fsa.subject_id;

-- 5. If any existing allocation has no mapping (e.g. orphan), delete it or assign a placeholder mapping.
-- To be safe, we delete them first before setting NOT NULL
DELETE FROM faculty_subject_assignments WHERE subject_curriculum_mapping_id IS NULL;

-- 6. Enforce NOT NULL for mapping reference in assignments
ALTER TABLE faculty_subject_assignments
  ALTER COLUMN subject_curriculum_mapping_id SET NOT NULL;

-- 7. Clean up indexes and constraints on subjects
DROP INDEX IF EXISTS idx_subjects_department;
DROP INDEX IF EXISTS idx_subjects_program;
DROP INDEX IF EXISTS idx_subjects_semester;
DROP INDEX IF EXISTS idx_subjects_program_sem;

ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_program_id_name_key;
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_semester_check;
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_program_id_fkey;
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_department_id_fkey;

-- 8. Drop direct curriculum columns from subjects
ALTER TABLE subjects
  DROP COLUMN department_id,
  DROP COLUMN program_id,
  DROP COLUMN program,
  DROP COLUMN regulation,
  DROP COLUMN year,
  DROP COLUMN semester,
  DROP COLUMN semester_raw;
