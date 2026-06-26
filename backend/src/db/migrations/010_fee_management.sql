-- Sprint 10: Fee Management
-- Dependencies: students (002), users (001)
--
-- Two-table design for future extensibility:
--   • fees           — the fee obligation record (what is owed, by when)
--   • fee_payments   — immutable payment ledger (what has been paid)
--
-- Extensibility notes:
--   • fees.id          → FK anchor for future receipt generation and financial reports
--   • fee_payments.id  → FK anchor for future payment gateway reconciliation
--   • fee_payment_mode includes 'Online' to accommodate future payment gateway entries
--                        without a schema migration
--   • fee_payments has no deleted_at / updated_at — payment records are financial
--     instruments and must be immutable once recorded
--   • fee_payments.transaction_ref stores the gateway reference when 'Online' mode is used
--   • pending_amount is stored (not derived) so it can be queried and indexed efficiently;
--     CHECK constraint enforces consistency on every write
--   • payment_status is always computed from (paid_amount, total_amount, due_date) by the
--     service layer on every write, so the column is always accurate without a cron job
--
-- Configurable by design:
--   • No hardcoded fee amounts — admin creates fee records with explicit amounts
--   • fee_type is an ENUM that can be extended when institution-specific types are needed
--   • fee_payment_mode can similarly be extended without service-layer changes

CREATE TYPE fee_type AS ENUM ('Tuition Fee', 'Examination Fee', 'Laboratory Fee', 'Miscellaneous Fee');
CREATE TYPE payment_status AS ENUM ('Pending', 'Partially Paid', 'Paid', 'Overdue');
CREATE TYPE fee_payment_mode AS ENUM ('Cash', 'DD', 'Cheque', 'Online');

CREATE TABLE fees (
  id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id      UUID            NOT NULL REFERENCES students(id),
  academic_year   VARCHAR(9)      NOT NULL CHECK (academic_year ~ '^\d{4}-\d{4}$'),
  semester        SMALLINT        NOT NULL CHECK (semester BETWEEN 1 AND 12),
  fee_type        fee_type        NOT NULL,
  total_amount    NUMERIC(10, 2)  NOT NULL CHECK (total_amount > 0),
  paid_amount     NUMERIC(10, 2)  NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  pending_amount  NUMERIC(10, 2)  NOT NULL CHECK (pending_amount >= 0),
  due_date        DATE            NOT NULL,
  payment_status  payment_status  NOT NULL DEFAULT 'Pending',
  remarks         TEXT,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  CONSTRAINT chk_fee_paid_within_total   CHECK (paid_amount <= total_amount),
  CONSTRAINT chk_fee_pending_consistency CHECK (pending_amount = total_amount - paid_amount)
);

-- Student fee queries (most common read path)
CREATE INDEX idx_fees_student ON fees (student_id) WHERE deleted_at IS NULL;

-- Admin filter by academic year + semester
CREATE INDEX idx_fees_academic ON fees (academic_year, semester) WHERE deleted_at IS NULL;

-- Admin filter by payment status (overdue/pending dashboards)
CREATE INDEX idx_fees_payment_status ON fees (payment_status) WHERE deleted_at IS NULL;

-- Upcoming due-date queries
CREATE INDEX idx_fees_due_date ON fees (due_date) WHERE deleted_at IS NULL AND payment_status != 'Paid';

-- Immutable payment ledger — one row per payment event
CREATE TABLE fee_payments (
  id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  fee_id          UUID            NOT NULL REFERENCES fees(id),
  amount          NUMERIC(10, 2)  NOT NULL CHECK (amount > 0),
  payment_date    DATE            NOT NULL DEFAULT CURRENT_DATE,
  payment_mode    fee_payment_mode NOT NULL DEFAULT 'Cash',
  transaction_ref VARCHAR(100),   -- gateway reference for future Online mode
  recorded_by     UUID            NOT NULL REFERENCES users(id),
  remarks         TEXT,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
  -- No updated_at or deleted_at: financial records are immutable
);

CREATE INDEX idx_fee_payments_fee ON fee_payments (fee_id);

CREATE TRIGGER trg_fees_updated_at
  BEFORE UPDATE ON fees
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
