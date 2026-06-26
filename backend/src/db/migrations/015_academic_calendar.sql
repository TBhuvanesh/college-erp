-- Sprint 11 Phase 3: Academic Calendar Publication System
--
-- Reuses parsed_event_type and parsed_event_audience ENUMs from 014_parsed_events.sql
-- so adding a new event type in Phase 2 automatically propagates here.
--
-- Traceability chain:
--   documents (source PDF)
--     └─ parsed_events (candidate event extracted by rule-based engine)
--           └─ academic_calendar_events (admin-approved live calendar entry)
--
-- Invariants:
--   • parsed_event_id UNIQUE (partial) — one live event per candidate; prevents
--     double-publication even if admin calls publish twice.
--   • Publishing never touches parsed_events or documents tables.
--   • is_edited tracks post-publication edits; publish_status = 'Updated' signals
--     the content has diverged from the originally approved extracted text.

CREATE TYPE cal_publish_status AS ENUM ('Published', 'Updated', 'Archived');

CREATE TABLE academic_calendar_events (
  id                  UUID                    PRIMARY KEY DEFAULT uuid_generate_v4(),
  parsed_event_id     UUID                    NOT NULL REFERENCES parsed_events(id),
  source_document_id  UUID                    NOT NULL REFERENCES documents(id),
  title               VARCHAR(500)            NOT NULL,
  description         TEXT,
  start_date          DATE                    NOT NULL,
  end_date            DATE,
  event_type          parsed_event_type       NOT NULL,
  target_audience     parsed_event_audience   NOT NULL DEFAULT 'All',
  department_id       UUID                    REFERENCES departments(id),
  semester            SMALLINT                CHECK (semester BETWEEN 1 AND 12),
  publish_status      cal_publish_status      NOT NULL DEFAULT 'Published',
  is_edited           BOOLEAN                 NOT NULL DEFAULT FALSE,
  created_by          UUID                    NOT NULL REFERENCES users(id),
  created_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ,
  CONSTRAINT chk_cal_event_date_order CHECK (end_date IS NULL OR end_date >= start_date)
);

-- Prevent duplicate publication of the same candidate event
CREATE UNIQUE INDEX uq_cal_event_parsed_event
  ON academic_calendar_events(parsed_event_id)
  WHERE deleted_at IS NULL;

-- Date-range browsing — most common student/faculty access pattern
CREATE INDEX idx_cal_events_dates
  ON academic_calendar_events(start_date, end_date)
  WHERE deleted_at IS NULL AND publish_status != 'Archived';

-- Role-based visibility queries: department scoping
CREATE INDEX idx_cal_events_department
  ON academic_calendar_events(department_id, publish_status)
  WHERE deleted_at IS NULL;

-- Admin dashboard: list by status (Published / Updated / Archived)
CREATE INDEX idx_cal_events_publish_status
  ON academic_calendar_events(publish_status, start_date)
  WHERE deleted_at IS NULL;

-- Phase 4 readiness: fast look-up by event type for report generation
CREATE INDEX idx_cal_events_type
  ON academic_calendar_events(event_type, start_date)
  WHERE deleted_at IS NULL AND publish_status != 'Archived';
