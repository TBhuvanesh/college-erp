-- Migration 048: Import Mode tracking on import_jobs
--
-- Row categorization (create vs. update vs. reject-as-duplicate) depends on
-- which mode the admin selected — Merge or Replace — so the mode has to be
-- fixed at preview time (it changes how validateRows() itself behaves, not
-- just what commit does with the result). Persisting it on the job means
-- commit reads the mode the preview was actually generated with, instead of
-- trusting a client-supplied value that could have drifted from what was
-- shown in the preview UI.

CREATE TYPE import_mode AS ENUM ('merge', 'replace');

ALTER TABLE import_jobs
  ADD COLUMN mode import_mode NOT NULL DEFAULT 'merge',
  ADD COLUMN updated_count INTEGER NOT NULL DEFAULT 0;
