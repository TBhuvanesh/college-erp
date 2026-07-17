-- Migration 032: Mentorship Settings (Enterprise Mentor Group Management)
--
-- Design notes:
--   • Purely additive — no changes to mentor_groups, mentor_group_students,
--     mentor_assignments, or mentoring_notes. Every historical row (including
--     'section'-method groups and independently-set year values) keeps working
--     unchanged; the application layer now computes `year` from `semester`
--     server-side instead of accepting it as admin input, but the column itself
--     is untouched.
--   • One global settings row (confirmed with the user — not per-department).
--     recommended_students_per_mentor / maximum_students back the Auto
--     Suggestion Engine and the Conflict/Capacity Engine's capacity_exceeded
--     check; allow_cross_department backs "Faculty belonging to the selected
--     department (unless cross-department mentoring is enabled)".

CREATE TABLE mentorship_settings (
  id                               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  recommended_students_per_mentor  SMALLINT    NOT NULL DEFAULT 25 CHECK (recommended_students_per_mentor > 0),
  maximum_students                 SMALLINT    NOT NULL DEFAULT 30 CHECK (maximum_students >= recommended_students_per_mentor),
  allow_cross_department           BOOLEAN     NOT NULL DEFAULT FALSE,
  updated_by                       UUID        REFERENCES users(id),
  updated_at                       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO mentorship_settings (recommended_students_per_mentor, maximum_students, allow_cross_department)
VALUES (25, 30, FALSE);
