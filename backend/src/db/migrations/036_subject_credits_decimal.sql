-- Migration 036: Alter subjects credits type to NUMERIC(3,1)
-- Allows storing fractional credits such as 1.5 or 2.5, matching curriculum standards.
ALTER TABLE subjects ALTER COLUMN credits TYPE NUMERIC(3,1);
