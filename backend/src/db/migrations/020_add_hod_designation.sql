-- Alter faculty_designation enum to include 'hod'
-- Note: This is executed outside the transaction block by migrate.ts to avoid PostgreSQL enum alteration limits in transactions.
ALTER TYPE faculty_designation ADD VALUE 'hod';

-- Create a unique constraint to ensure only one HOD exists per department
CREATE UNIQUE INDEX idx_unique_hod_per_dept ON faculty (department_id) WHERE designation = 'hod' AND deleted_at IS NULL;
