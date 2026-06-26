-- Sprint 1: Auth foundation tables
-- Roles match MVP: admin, faculty, student

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE user_role AS ENUM ('admin', 'faculty', 'student');

-- Core identity table. All other modules reference this via foreign key.
CREATE TABLE users (
  id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT         NOT NULL,
  role          user_role    NOT NULL,
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ  -- soft delete; never physically delete user rows
);

CREATE INDEX idx_users_email ON users (email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role  ON users (role)  WHERE deleted_at IS NULL;

-- Refresh tokens stored hashed (SHA-256). Rotation: old token is revoked on use.
CREATE TABLE refresh_tokens (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT        NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at  TIMESTAMPTZ           -- NULL means active
);

CREATE INDEX idx_refresh_tokens_user   ON refresh_tokens (user_id);
CREATE INDEX idx_refresh_tokens_active ON refresh_tokens (token_hash) WHERE revoked_at IS NULL;

-- Immutable audit trail. Every sensitive write operation appends here.
-- actor_id is NULL for system-generated events (e.g. auto-expiry jobs).
CREATE TABLE audit_logs (
  id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id    UUID         REFERENCES users(id),
  action      VARCHAR(100) NOT NULL,  -- e.g. 'LOGIN', 'UPDATE_GRADE', 'MARK_FEE_PAID'
  resource    VARCHAR(100) NOT NULL,  -- e.g. 'users', 'grades', 'fees'
  resource_id VARCHAR(255),           -- primary key of the affected row
  changes     JSONB,                  -- {before: {...}, after: {...}} for auditable mutations
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_actor    ON audit_logs (actor_id);
CREATE INDEX idx_audit_resource ON audit_logs (resource, resource_id);
CREATE INDEX idx_audit_time     ON audit_logs (created_at DESC);

-- Auto-update users.updated_at on every UPDATE
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
