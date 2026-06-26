-- Sprint 16: User profile fields
-- phone_number: voluntary contact info editable by the account owner via PUT /profile
-- last_login: set on every successful login; surfaced in GET /profile responses

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20),
  ADD COLUMN IF NOT EXISTS last_login   TIMESTAMPTZ;