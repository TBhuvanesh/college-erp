-- Migration 021: Add Accountant Role & Re-initialize Fees
--

-- Alter user_role enum to add accountant
-- Note: executed outside transaction in migrate.ts

-- Alter table to clean existing seed fee obligations and payments, replacing with ₹106,000 tuition fee
TRUNCATE TABLE fee_payments, fees CASCADE;

-- Insert new standard tuition fee of 106,000 for every active student
INSERT INTO fees (id, student_id, academic_year, semester, fee_type, total_amount, paid_amount, pending_amount, due_date, payment_status, remarks)
SELECT 
  uuid_generate_v4() AS id,
  s.id AS student_id,
  '2026-2027' AS academic_year,
  s.semester AS semester,
  'Tuition Fee'::fee_type AS fee_type,
  106000.00 AS total_amount,
  CASE 
    WHEN (ascii(substring(s.roll_number, 10, 1)) % 10) < 6 THEN 106000.00
    WHEN (ascii(substring(s.roll_number, 10, 1)) % 10) < 9 THEN 50000.00
    ELSE 0.00
  END AS paid_amount,
  CASE 
    WHEN (ascii(substring(s.roll_number, 10, 1)) % 10) < 6 THEN 0.00
    WHEN (ascii(substring(s.roll_number, 10, 1)) % 10) < 9 THEN 56000.00
    ELSE 106000.00
  END AS pending_amount,
  '2026-07-15'::DATE AS due_date,
  CASE 
    WHEN (ascii(substring(s.roll_number, 10, 1)) % 10) < 6 THEN 'Paid'::payment_status
    WHEN (ascii(substring(s.roll_number, 10, 1)) % 10) < 9 THEN 'Partially Paid'::payment_status
    ELSE 'Pending'::payment_status
  END AS payment_status,
  'Standard Tuition Fee Billing' AS remarks
FROM students s
WHERE s.deleted_at IS NULL;

-- Insert initial payments for tracking collected metrics correctly
INSERT INTO fee_payments (id, fee_id, amount, payment_date, payment_mode, recorded_by, remarks)
SELECT 
  uuid_generate_v4() AS id,
  f.id AS fee_id,
  f.paid_amount AS amount,
  '2026-06-10'::DATE AS payment_date,
  'Online'::fee_payment_mode AS payment_mode,
  (SELECT id FROM users WHERE role = 'admin' LIMIT 1) AS recorded_by,
  'Initial payment transaction' AS remarks
FROM fees f
WHERE f.paid_amount > 0;
