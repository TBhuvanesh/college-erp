-- Migration 029: Exam Seating & Invigilation Planner
--
-- Design notes:
--   • No "exam session" table — exams sharing the same (exam_date, start_time,
--     end_time) are treated as one slot dynamically at generation time; that
--     grouping is already fully derivable from the existing exams table, so
--     storing it separately would just be duplicate scheduling data.
--   • Seating/invigilation reference real exams.id / faculty.id / students.id
--     only — no roster or subject data is copied, only allocated.
--   • Room capacity is enforced purely by the seat-numbering scheme
--     (1..capacity assigned at generation time), not a separate counter
--     column, so capacity edits never desync from actual occupancy.
--   • Regeneration is idempotent: generating seating/invigilation again for
--     the same exam(s) soft-deletes the prior allocation first (see
--     examSeating.service.ts / examInvigilation.service.ts), so re-running
--     never creates duplicate rows.
--   • Faculty-side overlap prevention (a faculty can't invigilate two
--     overlapping slots) is enforced in the service layer, not a DB
--     constraint — true interval-overlap exclusion needs the btree_gist
--     extension, which nothing else in this schema uses.

CREATE TABLE exam_rooms (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       VARCHAR(50) NOT NULL UNIQUE,
  building   VARCHAR(100),
  capacity   SMALLINT    NOT NULL CHECK (capacity > 0),
  is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TRIGGER trg_exam_rooms_updated_at
  BEFORE UPDATE ON exam_rooms
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TABLE exam_seat_allocations (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id     UUID        NOT NULL REFERENCES exams(id),
  room_id     UUID        NOT NULL REFERENCES exam_rooms(id),
  student_id  UUID        NOT NULL REFERENCES students(id),
  seat_number SMALLINT    NOT NULL CHECK (seat_number > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

-- One live seat per student per exam, and one live occupant per room seat per exam.
CREATE UNIQUE INDEX uq_seat_allocation_student_exam
  ON exam_seat_allocations (exam_id, student_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_seat_allocation_room_seat
  ON exam_seat_allocations (room_id, seat_number, exam_id) WHERE deleted_at IS NULL;

CREATE INDEX idx_seat_allocations_room    ON exam_seat_allocations (room_id)    WHERE deleted_at IS NULL;
CREATE INDEX idx_seat_allocations_student ON exam_seat_allocations (student_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_seat_allocations_exam    ON exam_seat_allocations (exam_id)    WHERE deleted_at IS NULL;

CREATE TYPE invigilation_status AS ENUM ('Assigned', 'Completed', 'Cancelled');

-- Keyed by (room, time slot), not a single exam: after interleaved seating a
-- room can legitimately hold students from several exams at once, so "which
-- exam(s) this covers" is derived by joining exam_seat_allocations on
-- room_id + the exams sharing this duty's date/time, rather than duplicated
-- here as a column that could only ever point at one of them.
CREATE TABLE exam_invigilation_duties (
  id          UUID                PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id     UUID                NOT NULL REFERENCES exam_rooms(id),
  faculty_id  UUID                NOT NULL REFERENCES faculty(id),
  duty_date   DATE                NOT NULL,
  start_time  TIME                NOT NULL,
  end_time    TIME                NOT NULL,
  status      invigilation_status NOT NULL DEFAULT 'Assigned',
  assigned_by UUID                NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

-- A faculty member covers at most one duty per room per slot.
CREATE UNIQUE INDEX uq_invigilation_faculty_room_slot
  ON exam_invigilation_duties (room_id, duty_date, start_time, end_time, faculty_id) WHERE deleted_at IS NULL;

CREATE INDEX idx_invigilation_faculty_date ON exam_invigilation_duties (faculty_id, duty_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_invigilation_room_slot    ON exam_invigilation_duties (room_id, duty_date, start_time) WHERE deleted_at IS NULL;
CREATE INDEX idx_invigilation_status       ON exam_invigilation_duties (status)                 WHERE deleted_at IS NULL;

CREATE TRIGGER trg_exam_invigilation_duties_updated_at
  BEFORE UPDATE ON exam_invigilation_duties
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
