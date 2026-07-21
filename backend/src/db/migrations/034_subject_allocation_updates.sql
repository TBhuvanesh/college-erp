-- Migration 034: Subject Allocation Updates
ALTER TABLE faculty_subject_assignments
  ADD COLUMN created_by UUID REFERENCES users(id),
  ADD COLUMN status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
  ADD COLUMN removed_by UUID REFERENCES users(id),
  ADD COLUMN removal_reason TEXT;

-- Enforce that a subject can have only one faculty allocated per academic year and section (excluding deleted allocations)
CREATE UNIQUE INDEX idx_unique_subject_section ON faculty_subject_assignments (subject_id, academic_year, section) WHERE deleted_at IS NULL;
