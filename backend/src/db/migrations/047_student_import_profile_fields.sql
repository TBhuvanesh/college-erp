-- Migration 047: Student profile fields required by the official college
-- Excel import format (Gender, Student Mobile, Father Name, Mother Name).
--
-- Design notes:
--   • parent_contact already exists (migration 023) — reused directly for
--     the sheet's "Parent Mobile" column, no new column needed for it.
--   • All four new columns are nullable: existing students rows (and any
--     future non-import creation path, e.g. the admin "add student" form)
--     are unaffected — this is purely additive.
--   • No new enum for gender: free-text VARCHAR, normalized by the import
--     strategy (M/F/Male/Female/Other → stored value), matching how the
--     rest of this schema treats status/type fields it doesn't need to
--     constrain at the DB level.

ALTER TABLE students
  ADD COLUMN mobile_number VARCHAR(20),
  ADD COLUMN gender        VARCHAR(20),
  ADD COLUMN father_name   VARCHAR(150),
  ADD COLUMN mother_name   VARCHAR(150);
