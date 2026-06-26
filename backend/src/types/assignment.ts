import { z } from 'zod';

// ── Domain Interface ──────────────────────────────────────────────────────────

export interface AssignmentDetail {
  id: string;
  facultyId: string;
  facultyName: string;
  employeeNumber: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  departmentName: string;
  semester: number;
  academicYear: string;
  section: string;
  isActive: boolean;
  createdAt: Date;
}

// ── Zod Validation Schemas ────────────────────────────────────────────────────

const academicYear = z
  .string()
  .regex(/^\d{4}-\d{4}$/, 'Academic year must be in format YYYY-YYYY')
  .refine((val) => {
    const [start, end] = val.split('-').map(Number);
    return end === start + 1;
  }, 'Academic year years must be consecutive (e.g., 2024-2025)');

export const createAssignmentSchema = z.object({
  facultyId: z.string().uuid('Invalid faculty ID'),
  subjectId: z.string().uuid('Invalid subject ID'),
  academicYear,
  section: z.string().min(1).max(10).trim().toUpperCase(),
});

export const listAssignmentsQuerySchema = z.object({
  facultyId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
  academicYear: z.string().optional(),
  section: z.string().max(10).trim().toUpperCase().optional(),
  isActive: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type ListAssignmentsQuery = z.infer<typeof listAssignmentsQuerySchema>;
