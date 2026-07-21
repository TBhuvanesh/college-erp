-- Migration 035: Subjects Master Updates
-- 1. Alter type column in subjects table to TYPE VARCHAR(50) to allow mandatory/project/workshop types
ALTER TABLE subjects ALTER COLUMN type TYPE VARCHAR(50);

-- 2. Drop the NOT NULL constraint on program_id to allow nullable reference (so program is stored as string in Excel imports)
ALTER TABLE subjects ALTER COLUMN program_id DROP NOT NULL;

-- 3. Add the new curriculum, hours, and regulation columns
ALTER TABLE subjects
  ADD COLUMN IF NOT EXISTS regulation VARCHAR(20) DEFAULT 'R22',
  ADD COLUMN IF NOT EXISTS year VARCHAR(10), -- I, II, III, IV
  ADD COLUMN IF NOT EXISTS semester_raw VARCHAR(10), -- I, II
  ADD COLUMN IF NOT EXISTS lecture_hours INT DEFAULT 0, -- L
  ADD COLUMN IF NOT EXISTS tutorial_hours INT DEFAULT 0, -- T
  ADD COLUMN IF NOT EXISTS practical_hours INT DEFAULT 0, -- P
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS program VARCHAR(100);
