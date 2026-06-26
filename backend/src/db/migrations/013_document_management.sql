-- Sprint 11: PDF-Based Academic Calendar Management — Phase 1 (Upload & Extraction)
--
-- Extensibility notes:
--   • document_type ENUM is open-ended: future document types (Timetable, Syllabus, etc.)
--     can be added without schema changes to other tables.
--   • extracted_text is stored raw; Phase 2 will parse it into calendar_events rows
--     by FK-joining on documents.id.
--   • status = 'Uploaded' → system received the file but extraction has not succeeded yet.
--     status = 'Processed' → extracted_text is populated and ready for Phase 2 parsing.

CREATE TYPE document_type   AS ENUM ('Academic Calendar');
CREATE TYPE document_status AS ENUM ('Uploaded', 'Processed');

CREATE TABLE documents (
  id              UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
  title           VARCHAR(255)     NOT NULL,
  file_name       VARCHAR(255)     NOT NULL,
  file_path       TEXT             NOT NULL UNIQUE,
  document_type   document_type    NOT NULL DEFAULT 'Academic Calendar',
  extracted_text  TEXT,
  upload_date     DATE             NOT NULL DEFAULT CURRENT_DATE,
  uploaded_by     UUID             NOT NULL REFERENCES users(id),
  status          document_status  NOT NULL DEFAULT 'Uploaded',
  created_at      TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

-- Fast look-up by uploader (admin dashboard "my uploads" view)
CREATE INDEX idx_documents_uploaded_by
  ON documents(uploaded_by)
  WHERE deleted_at IS NULL;

-- Efficient status filtering for Phase 2 processing pipelines
CREATE INDEX idx_documents_type_status
  ON documents(document_type, status)
  WHERE deleted_at IS NULL;
