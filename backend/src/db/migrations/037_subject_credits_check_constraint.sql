-- Migration 037: Re-define subjects_credits_check constraint to allow 0 credits.
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_credits_check;
ALTER TABLE subjects ADD CONSTRAINT subjects_credits_check CHECK (credits >= 0 AND credits <= 10);
