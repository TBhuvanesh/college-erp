-- Migration 022: Add Accountants Table
-- Dependency: users (001)

CREATE TABLE accountants (
  id              UUID                PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID                NOT NULL UNIQUE REFERENCES users(id),
  employee_number VARCHAR(20)         NOT NULL UNIQUE,
  full_name       VARCHAR(255)        NOT NULL,
  avatar_url      TEXT,
  created_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE TRIGGER trg_accountants_updated_at
  BEFORE UPDATE ON accountants
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Populate existing seeded accountant
INSERT INTO accountants (user_id, employee_number, full_name)
SELECT id, 'EMP-ACC001', 'Chief Accountant'
FROM users
WHERE role = 'accountant'
ON CONFLICT (user_id) DO NOTHING;
