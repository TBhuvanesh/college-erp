-- Migration 025: Faculty Teaching Planner & Course Progress Management
-- Dependencies: faculty (003), subjects (004), departments (002),
--               course_materials (017), assignments (017)
--
-- Design notes:
--   • department_id/year/semester are denormalized copies of subjects.department_id
--     and subjects.semester (year = CEIL(semester / 2)) captured at creation time,
--     following the same convention as mentor_groups (024) — kept for query
--     convenience, never accepted directly from clients (see teachingPlan.service.ts).
--   • material_id/assignment_id reference existing LMS rows — no LMS data is
--     duplicated here.
--   • Calendar visibility (Faculty/Student Calendar) and student notifications are
--     synced into the existing calendar_entries/notifications tables at the
--     application layer (source_module = 'teaching_plan'), not new tables here.

CREATE TYPE lesson_completion_status AS ENUM ('Planned', 'Completed', 'Rescheduled', 'Cancelled');

CREATE TABLE teaching_plans (
  id                  UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
  faculty_id          UUID                     NOT NULL REFERENCES faculty(id),
  subject_id          UUID                     NOT NULL REFERENCES subjects(id),
  department_id       UUID                     NOT NULL REFERENCES departments(id),
  year                SMALLINT                 NOT NULL CHECK (year BETWEEN 1 AND 6),
  semester             SMALLINT                NOT NULL CHECK (semester BETWEEN 1 AND 12),
  section             VARCHAR(10)              NOT NULL,
  week_number         SMALLINT                 NOT NULL CHECK (week_number BETWEEN 1 AND 52),
  lesson_date         DATE                     NOT NULL,
  topic_title         VARCHAR(255)             NOT NULL,
  topic_description   TEXT,
  learning_objectives TEXT,
  material_id         UUID                     REFERENCES course_materials(id),
  assignment_id       UUID                     REFERENCES assignments(id),
  homework            TEXT,
  quiz_planned        BOOLEAN                  NOT NULL DEFAULT FALSE,
  completion_status   lesson_completion_status NOT NULL DEFAULT 'Planned',
  created_at          TIMESTAMPTZ              NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ              NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

-- Faculty's own plan list / ownership checks
CREATE INDEX idx_teaching_plans_faculty ON teaching_plans (faculty_id) WHERE deleted_at IS NULL;

-- Student roster + course-progress queries (subject + section + semester)
CREATE INDEX idx_teaching_plans_subject_section ON teaching_plans (subject_id, section, semester)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_teaching_plans_department ON teaching_plans (department_id) WHERE deleted_at IS NULL;

-- Today's-topic / upcoming / calendar range queries
CREATE INDEX idx_teaching_plans_lesson_date ON teaching_plans (lesson_date) WHERE deleted_at IS NULL;

-- Syllabus-completion aggregation
CREATE INDEX idx_teaching_plans_status ON teaching_plans (completion_status) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_teaching_plans_updated_at
  BEFORE UPDATE ON teaching_plans
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
