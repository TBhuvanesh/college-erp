-- Migration 040: Redesign Examination Sessions & Exam Schedule Linking

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'exam_session_status') THEN
    CREATE TYPE exam_session_status AS ENUM ('Draft', 'Scheduling', 'Ready for Review', 'Published', 'Archived');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS examination_sessions (
  id             UUID                 PRIMARY KEY DEFAULT uuid_generate_v4(),
  name           VARCHAR(255)         NOT NULL,
  academic_year  VARCHAR(20)          NOT NULL DEFAULT '2026-27',
  regulation     VARCHAR(20)          NOT NULL DEFAULT 'R22',
  department_id  UUID                 NOT NULL REFERENCES departments(id),
  year           VARCHAR(10)          NOT NULL DEFAULT 'I',
  semester       SMALLINT             NOT NULL CHECK (semester BETWEEN 1 AND 12),
  exam_type      exam_type            NOT NULL,
  sections       VARCHAR(10)[]        NOT NULL DEFAULT ARRAY[]::VARCHAR[],
  subject_ids    UUID[]               NOT NULL DEFAULT ARRAY[]::UUID[],
  status         VARCHAR(30)          NOT NULL DEFAULT 'Draft',
  created_by     UUID                 REFERENCES users(id),
  created_at     TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
  deleted_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_examination_sessions_dept ON examination_sessions (department_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_examination_sessions_status ON examination_sessions (status) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_examination_sessions_updated_at ON examination_sessions;
CREATE TRIGGER trg_examination_sessions_updated_at
  BEFORE UPDATE ON examination_sessions
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Alter exams table for session linking and flexible schedule builder
ALTER TABLE exams ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES examination_sessions(id) ON DELETE CASCADE;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS venue VARCHAR(255);
ALTER TABLE exams ADD COLUMN IF NOT EXISTS instructions TEXT;

ALTER TABLE exams ALTER COLUMN exam_date DROP NOT NULL;
ALTER TABLE exams ALTER COLUMN start_time DROP NOT NULL;
ALTER TABLE exams ALTER COLUMN end_time DROP NOT NULL;
ALTER TABLE exams ALTER COLUMN faculty_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_exams_session_id ON exams (session_id) WHERE deleted_at IS NULL;
