-- Migration 050: Timetable Management Module

-- 1. Add abbreviation column to subjects
ALTER TABLE subjects ADD COLUMN abbreviation VARCHAR(20);

-- Update existing subjects to have a default abbreviation (uppercase of code)
UPDATE subjects SET abbreviation = UPPER(code) WHERE abbreviation IS NULL;

-- 2. Create timetables table
CREATE TABLE timetables (
  id             UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  academic_year  VARCHAR(9)     NOT NULL CHECK (academic_year ~ '^\d{4}-\d{4}$'),
  department_id  UUID           NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  program_id     UUID           REFERENCES programs(id) ON DELETE SET NULL,
  year           VARCHAR(10)    NOT NULL, -- 'I', 'II', 'III', 'IV'
  semester       SMALLINT       NOT NULL CHECK (semester BETWEEN 1 AND 12),
  section        VARCHAR(10)    NOT NULL,
  room_number    VARCHAR(50),
  status         VARCHAR(20)    NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'validated', 'published', 'archived')),
  working_days   VARCHAR(15)[]  NOT NULL,
  version        INT            NOT NULL DEFAULT 1,
  effective_from DATE,
  created_by     UUID           NOT NULL REFERENCES users(id),
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  deleted_at     TIMESTAMPTZ
);

CREATE TRIGGER trg_timetables_updated_at
  BEFORE UPDATE ON timetables
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Indexing for timetable searches
CREATE INDEX idx_timetables_lookup ON timetables (academic_year, department_id, year, semester, section) WHERE deleted_at IS NULL;

-- 3. Create timetable_slots table
CREATE TABLE timetable_slots (
  id             UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  timetable_id   UUID           NOT NULL REFERENCES timetables(id) ON DELETE CASCADE,
  start_time     TIME           NOT NULL,
  end_time       TIME           NOT NULL,
  slot_type      VARCHAR(20)    NOT NULL CHECK (slot_type IN ('TEACHING', 'BREAK', 'LUNCH')),
  sequence_order INT            NOT NULL,
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_timetable_slots_updated_at
  BEFORE UPDATE ON timetable_slots
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- 4. Create timetable_entries table
CREATE TABLE timetable_entries (
  id            UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  timetable_id  UUID           NOT NULL REFERENCES timetables(id) ON DELETE CASCADE,
  day_of_week   VARCHAR(15)    NOT NULL CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
  subject_id    UUID           NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  class_type    VARCHAR(20)    NOT NULL CHECK (class_type IN ('Theory', 'Lab', 'Project', 'Elective', 'Tutorial', 'Other')),
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_timetable_entries_updated_at
  BEFORE UPDATE ON timetable_entries
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- 5. Create timetable_entry_slots join table (supports merged periods)
CREATE TABLE timetable_entry_slots (
  entry_id UUID NOT NULL REFERENCES timetable_entries(id) ON DELETE CASCADE,
  slot_id  UUID NOT NULL REFERENCES timetable_slots(id) ON DELETE CASCADE,
  PRIMARY KEY (entry_id, slot_id)
);

-- 6. Create timetable_entry_faculty join table (supports multiple faculty members per entry)
CREATE TABLE timetable_entry_faculty (
  entry_id   UUID NOT NULL REFERENCES timetable_entries(id) ON DELETE CASCADE,
  faculty_id UUID NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
  PRIMARY KEY (entry_id, faculty_id)
);
