-- Sprint 11 Phase 2: Candidate Event Extraction and Admin Review
--
-- Extensibility notes:
--   • parsed_event_type ENUM mirrors Announcement categories where possible so
--     Phase 3 can translate Approved/Edited events into Announcements or
--     AcademicCalendar entries without a schema migration.
--   • status = 'Pending'  → freshly extracted, not yet reviewed by admin.
--     status = 'Edited'   → admin modified extracted fields; pending re-approval.
--     status = 'Approved' → admin confirmed; ready for Phase 3 publication.
--     status = 'Rejected' → admin discarded; excluded from Phase 3.
--   • document_id FK lets Phase 3 trace every live calendar event back to the
--     source PDF for audit purposes.
--   • department_id is nullable — the extractor cannot resolve names to UUIDs;
--     admin sets this during review.

CREATE TYPE parsed_event_type AS ENUM (
  'Class Commencement',
  'Mid-Term Examination',
  'End Semester Examination',
  'Lab Examination',
  'Internal Assessment',
  'Holiday',
  'Supplementary Examination',
  'Academic Activity',
  'Other'
);

CREATE TYPE parsed_event_audience AS ENUM (
  'All', 'Students', 'Faculty',
  'I Year', 'II Year', 'III Year', 'IV Year'
);

CREATE TYPE parsed_event_status AS ENUM (
  'Pending', 'Approved', 'Edited', 'Rejected'
);

CREATE TABLE parsed_events (
  id              UUID                   PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id     UUID                   NOT NULL REFERENCES documents(id),
  title           VARCHAR(500)           NOT NULL,
  description     TEXT,
  start_date      DATE                   NOT NULL,
  end_date        DATE,
  event_type      parsed_event_type      NOT NULL DEFAULT 'Other',
  target_audience parsed_event_audience  NOT NULL DEFAULT 'All',
  department_id   UUID                   REFERENCES departments(id),
  semester        SMALLINT               CHECK (semester BETWEEN 1 AND 12),
  status          parsed_event_status    NOT NULL DEFAULT 'Pending',
  created_at      TIMESTAMPTZ            NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ            NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  CONSTRAINT chk_parsed_event_date_order CHECK (end_date IS NULL OR end_date >= start_date)
);

-- Fast look-up when admin opens a document and views its candidate events
CREATE INDEX idx_parsed_events_document
  ON parsed_events(document_id, status)
  WHERE deleted_at IS NULL;

-- Dashboard filter: "show me all Pending events across all documents"
CREATE INDEX idx_parsed_events_status
  ON parsed_events(status)
  WHERE deleted_at IS NULL;

-- Date-range queries for future Phase 3 publication pipeline
CREATE INDEX idx_parsed_events_dates
  ON parsed_events(start_date, end_date)
  WHERE deleted_at IS NULL AND status IN ('Approved', 'Edited');
