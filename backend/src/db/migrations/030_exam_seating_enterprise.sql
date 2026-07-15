-- Migration 030: Exam Seating & Invigilation — Enterprise Refactor
--
-- Design notes:
--   • Every change here is additive. exam_rooms/exam_seat_allocations keep every
--     existing column unchanged — legacy rows and the existing flat-capacity flow
--     keep working exactly as before. New geometry/pattern/session concepts are
--     opt-in (nullable columns, new tables), not a breaking rewrite.
--   • Classroom geometry lives on exam_rooms itself (no new table) — a room's
--     rows/columns/bench_type describe ONE thing (the room), not a many-to-one
--     relationship, so normalizing further would just add join overhead.
--   • Department color lives on departments itself for the same reason — one
--     color per department, no separate "settings" table needed.
--   • exam_sessions is a pure orchestration/config record: it stores the admin's
--     *selection criteria* (departments/years/sections/dates/subjects/rooms/
--     invigilators/pattern) and links to the real exams it resolves to via
--     exam_session_exams — it never duplicates exam/subject/student data, and
--     seating/invigilation generation for a session ultimately calls the exact
--     same generation functions the old exam-by-exam flow already uses.
--   • exam_session_exams is a real join table (not an array column) because it
--     needs per-row FK integrity and is queried by exam_id independently of the
--     session, unlike the pure "selection criteria" arrays above which are only
--     ever read back as a whole (no precedent broken: opportunities.eligible_years
--     already uses a plain array column for the same kind of "stored intent" data).
--   • bench_number/seat_position backfill for existing exam_seat_allocations rows
--     assumes "single" bench (one seat per bench, position 'Left') for any room
--     without geometry defined yet, so old data is immediately compatible with a
--     bench-aware visual layout without requiring re-generation.

-- ── Classroom geometry (extends exam_rooms) ──────────────────────────────────

CREATE TYPE bench_type_enum AS ENUM ('single', 'double', 'triple');

ALTER TABLE exam_rooms
  ADD COLUMN floor       VARCHAR(20),
  ADD COLUMN room_number VARCHAR(20),
  ADD COLUMN rows        SMALLINT CHECK (rows > 0),
  ADD COLUMN columns     SMALLINT CHECK (columns > 0),
  ADD COLUMN bench_type  bench_type_enum,
  ADD COLUMN notes       TEXT;

-- ── Department colors (extends departments) ──────────────────────────────────

ALTER TABLE departments ADD COLUMN color VARCHAR(20);

UPDATE departments SET color = 'violet' WHERE code = 'AIML' AND color IS NULL;
UPDATE departments SET color = 'green'  WHERE code = 'CSE'  AND color IS NULL;
UPDATE departments SET color = 'orange' WHERE code = 'DS'   AND color IS NULL;
UPDATE departments SET color = 'red'    WHERE code = 'ECE'  AND color IS NULL;

-- ── Seating Pattern Engine ───────────────────────────────────────────────────

CREATE TYPE seating_pattern_type AS ENUM ('mid', 'semester', 'random', 'custom');

CREATE TABLE seating_patterns (
  id                  UUID                 PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                VARCHAR(255)         NOT NULL,
  pattern_type        seating_pattern_type NOT NULL,
  -- Ordered department sequence to cycle through when allocating seats.
  -- Empty/ignored for pattern_type='random'.
  department_sequence UUID[]               NOT NULL DEFAULT ARRAY[]::UUID[],
  is_default          BOOLEAN              NOT NULL DEFAULT FALSE,
  created_by          UUID                 NOT NULL REFERENCES users(id),
  created_at          TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

CREATE TRIGGER trg_seating_patterns_updated_at
  BEFORE UPDATE ON seating_patterns
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Seed the two spec'd default patterns — safe no-op if matching departments/admin
-- don't exist yet (INSERT...SELECT simply inserts nothing), same pattern as the
-- workflow_rules seed in migration 028.
INSERT INTO seating_patterns (name, pattern_type, department_sequence, is_default, created_by)
SELECT 'Mid Examination Pattern', 'mid',
  ARRAY(SELECT id FROM departments WHERE code IN ('AIML', 'CSE')
        ORDER BY array_position(ARRAY['AIML', 'CSE'], code)),
  TRUE, u.id
FROM users u WHERE u.role = 'admin' ORDER BY u.created_at LIMIT 1;

INSERT INTO seating_patterns (name, pattern_type, department_sequence, is_default, created_by)
SELECT 'Semester Examination Pattern', 'semester',
  ARRAY(SELECT id FROM departments WHERE code IN ('AIML', 'DS', 'ECE', 'CSE')
        ORDER BY array_position(ARRAY['AIML', 'DS', 'ECE', 'CSE'], code)),
  TRUE, u.id
FROM users u WHERE u.role = 'admin' ORDER BY u.created_at LIMIT 1;

-- ── Exam Session (orchestration layer over the existing exams table) ────────

CREATE TYPE exam_session_status AS ENUM ('draft', 'generated', 'published', 'archived');

CREATE TABLE exam_sessions (
  id                 UUID                 PRIMARY KEY DEFAULT uuid_generate_v4(),
  name               VARCHAR(255)         NOT NULL,
  exam_type          exam_type            NOT NULL,
  department_ids     UUID[]               NOT NULL DEFAULT ARRAY[]::UUID[],
  years              SMALLINT[]           NOT NULL DEFAULT ARRAY[]::SMALLINT[],
  semester           SMALLINT             NOT NULL CHECK (semester BETWEEN 1 AND 12),
  sections           VARCHAR(10)[]        NOT NULL DEFAULT ARRAY[]::VARCHAR[],
  exam_dates         DATE[]               NOT NULL DEFAULT ARRAY[]::DATE[],
  subject_ids        UUID[]               NOT NULL DEFAULT ARRAY[]::UUID[],
  classroom_ids      UUID[]               NOT NULL DEFAULT ARRAY[]::UUID[],
  invigilator_ids    UUID[]               NOT NULL DEFAULT ARRAY[]::UUID[],
  seating_pattern_id UUID                 REFERENCES seating_patterns(id),
  status             exam_session_status  NOT NULL DEFAULT 'draft',
  created_by         UUID                 NOT NULL REFERENCES users(id),
  created_at         TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
  deleted_at         TIMESTAMPTZ
);

CREATE INDEX idx_exam_sessions_status ON exam_sessions (status) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_exam_sessions_updated_at
  BEFORE UPDATE ON exam_sessions
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TABLE exam_session_exams (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_session_id UUID        NOT NULL REFERENCES exam_sessions(id),
  exam_id         UUID        NOT NULL REFERENCES exams(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (exam_session_id, exam_id)
);

CREATE INDEX idx_exam_session_exams_session ON exam_session_exams (exam_session_id);
CREATE INDEX idx_exam_session_exams_exam    ON exam_session_exams (exam_id);

-- ── Manual seat adjustment support (extends exam_seat_allocations) ──────────

ALTER TABLE exam_seat_allocations
  ADD COLUMN bench_number    SMALLINT,
  ADD COLUMN seat_position   VARCHAR(10),
  ADD COLUMN is_locked       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN exam_session_id UUID REFERENCES exam_sessions(id);

CREATE INDEX idx_seat_allocations_session ON exam_seat_allocations (exam_session_id) WHERE deleted_at IS NULL;

-- Backfill existing rows: single-bench mapping (bench_number = seat_number,
-- position 'Left') for rooms without geometry defined; row/column-aware mapping
-- for rooms that already have a bench_type by the time this migration runs.
UPDATE exam_seat_allocations esa
SET
  bench_number = CEIL(
    esa.seat_number::numeric /
    CASE COALESCE(er.bench_type::text, 'single')
      WHEN 'double' THEN 2
      WHEN 'triple' THEN 3
      ELSE 1
    END
  )::smallint,
  seat_position = CASE COALESCE(er.bench_type::text, 'single')
    WHEN 'double' THEN (CASE WHEN esa.seat_number % 2 = 1 THEN 'Left' ELSE 'Right' END)
    WHEN 'triple' THEN (CASE (esa.seat_number - 1) % 3 WHEN 0 THEN 'Left' WHEN 1 THEN 'Middle' ELSE 'Right' END)
    ELSE 'Left'
  END
FROM exam_rooms er
WHERE er.id = esa.room_id AND esa.bench_number IS NULL;
