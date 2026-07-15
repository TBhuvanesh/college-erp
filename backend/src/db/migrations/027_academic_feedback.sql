-- Migration 027: Academic Feedback & Evaluation System

CREATE TYPE feedback_type_enum AS ENUM ('faculty', 'course', 'lms', 'erp');
CREATE TYPE question_type_enum AS ENUM ('rating', 'mcq', 'text', 'boolean');

CREATE TABLE feedback_windows (
  id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  title         VARCHAR(255) NOT NULL,
  academic_year VARCHAR(20)  NOT NULL,
  semester      INT,         -- Optional: if NULL, applies to all semesters
  department_id UUID         REFERENCES departments(id), -- Optional: if NULL, applies to all departments
  start_date    TIMESTAMPTZ  NOT NULL,
  end_date      TIMESTAMPTZ  NOT NULL,
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_by    UUID         REFERENCES users(id)
);

CREATE TRIGGER trg_feedback_windows_updated_at
  BEFORE UPDATE ON feedback_windows
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TABLE feedback_templates (
  id            UUID               PRIMARY KEY DEFAULT uuid_generate_v4(),
  title         VARCHAR(255)       NOT NULL,
  type          feedback_type_enum NOT NULL,
  is_active     BOOLEAN            NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_feedback_templates_updated_at
  BEFORE UPDATE ON feedback_templates
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TABLE feedback_questions (
  id            UUID               PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id   UUID               NOT NULL REFERENCES feedback_templates(id) ON DELETE CASCADE,
  text          TEXT               NOT NULL,
  type          question_type_enum NOT NULL,
  options       JSONB,             -- For MCQ options: ["Excellent", "Good", "Average"]
  order_index   INT                NOT NULL DEFAULT 0,
  is_required   BOOLEAN            NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_f_questions_template ON feedback_questions (template_id);

-- Enforces one submission per student per context without linking to their actual answers
CREATE TABLE feedback_submission_tracking (
  id            UUID               PRIMARY KEY DEFAULT uuid_generate_v4(),
  window_id     UUID               NOT NULL REFERENCES feedback_windows(id) ON DELETE CASCADE,
  student_id    UUID               NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id    UUID               REFERENCES subjects(id) ON DELETE CASCADE, -- Null for ERP feedback
  feedback_type feedback_type_enum NOT NULL,
  created_at    TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_feedback_tracking UNIQUE(window_id, student_id, subject_id, feedback_type)
);
CREATE INDEX idx_f_sub_tracking_student ON feedback_submission_tracking (student_id);

-- Stores anonymous responses with no link to the student
CREATE TABLE feedback_responses (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  window_id     UUID        NOT NULL REFERENCES feedback_windows(id) ON DELETE CASCADE,
  template_id   UUID        NOT NULL REFERENCES feedback_templates(id),
  subject_id    UUID        REFERENCES subjects(id) ON DELETE CASCADE,
  faculty_id    UUID        REFERENCES faculty(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_f_responses_window ON feedback_responses (window_id);
CREATE INDEX idx_f_responses_faculty ON feedback_responses (faculty_id);
CREATE INDEX idx_f_responses_subject ON feedback_responses (subject_id);

CREATE TABLE feedback_answers (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  response_id   UUID        NOT NULL REFERENCES feedback_responses(id) ON DELETE CASCADE,
  question_id   UUID        NOT NULL REFERENCES feedback_questions(id),
  rating_value  INT,
  text_value    TEXT
);
CREATE INDEX idx_f_answers_response ON feedback_answers (response_id);
CREATE INDEX idx_f_answers_question ON feedback_answers (question_id);
