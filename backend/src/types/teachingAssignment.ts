import { z } from 'zod';

// Teaching Assignment is the renamed/extended faculty_subject_assignments
// entity (migration 041) — the single relationship every academic module
// (Attendance, Results, Internal Marks, Teaching Planner, LMS, Feedback,
// Exam Schedule) resolves through instead of picking faculty/subject/section
// independently.

export interface TeachingAssignmentDetail {
  id: string;
  facultyId: string;
  facultyName: string;
  employeeNumber: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  departmentId: string;
  departmentName: string;
  semester: number;
  section: string;
  academicYear: string;
  status: 'active' | 'inactive' | 'pending';
  startDate: string | null;
  endDate: string | null;
  weeklyTeachingHours: number | null;
  createdBy: string | null;
  createdByName?: string;
  createdAt: Date;
  updatedAt: Date;
  removedBy: string | null;
  removedByName?: string;
  removedAt: Date | null;
  removalReason: string | null;
}

export const academicYearSchema = z
  .string()
  .regex(/^\d{4}-\d{4}$/, 'Academic year must be in format YYYY-YYYY')
  .refine((val) => {
    const [start, end] = val.split('-').map(Number);
    return end === start + 1;
  }, 'Academic year years must be consecutive (e.g., 2024-2025)');

export const createTeachingAssignmentSchema = z.object({
  facultyId: z.string().uuid('Invalid faculty ID'),
  subjectId: z.string().uuid('Invalid subject ID'),
  academicYear: academicYearSchema,
  section: z.string().min(1).max(10).trim().toUpperCase(),
  status: z.enum(['active', 'inactive', 'pending']).optional().default('active'),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  weeklyTeachingHours: z.number().min(0).max(60).optional(),
  notes: z.string().optional(),
  departmentId: z.string().uuid().optional(),
  programId: z.string().uuid().optional().nullable(),
  regulation: z.string().optional(),
  year: z.string().optional(),
  semester: z.number().optional(),
});

export const updateTeachingAssignmentSchema = z.object({
  facultyId: z.string().uuid('Invalid faculty ID').optional(),
  subjectId: z.string().uuid('Invalid subject ID').optional(),
  section: z.string().min(1).max(10).trim().toUpperCase().optional(),
  status: z.enum(['active', 'inactive', 'pending']).optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  weeklyTeachingHours: z.number().min(0).max(60).optional(),
  notes: z.string().optional(),
});

export const transferTeachingAssignmentSchema = z.object({
  facultyId: z.string().uuid('Invalid new faculty ID'),
});

export const deleteTeachingAssignmentSchema = z.object({
  reason: z.string().min(3, 'Reason must be at least 3 characters').max(500),
});

export const listTeachingAssignmentsQuerySchema = z.object({
  departmentId: z.string().uuid().optional(),
  semester: z.preprocess((val) => (val ? Number(val) : undefined), z.number().min(1).max(12).optional()),
  section: z.string().optional(),
  subjectId: z.string().uuid().optional(),
  facultyId: z.string().uuid().optional(),
  academicYear: z.string().optional(),
  status: z.enum(['active', 'inactive', 'pending']).optional(),
  search: z.string().optional(),
});

export type CreateTeachingAssignmentInput = z.infer<typeof createTeachingAssignmentSchema>;
export type UpdateTeachingAssignmentInput = z.infer<typeof updateTeachingAssignmentSchema>;
export type TransferTeachingAssignmentInput = z.infer<typeof transferTeachingAssignmentSchema>;
export type DeleteTeachingAssignmentInput = z.infer<typeof deleteTeachingAssignmentSchema>;
export type ListTeachingAssignmentsQuery = z.infer<typeof listTeachingAssignmentsQuerySchema>;

// ── Back-compat aliases (subject-allocation naming) ───────────────────────
// subjectAllocation.controller.ts / .routes.ts keep working unmodified during
// the transition by importing these names — see subjectAllocation.service.ts,
// which now just re-exports teachingAssignment.service.ts.
export type AllocationDetail = TeachingAssignmentDetail;
export {
  createTeachingAssignmentSchema as createAllocationSchema,
  updateTeachingAssignmentSchema as updateAllocationSchema,
  transferTeachingAssignmentSchema as transferAllocationSchema,
  deleteTeachingAssignmentSchema as deleteAllocationSchema,
  listTeachingAssignmentsQuerySchema as listAllocationsQuerySchema,
};
export type CreateAllocationInput = CreateTeachingAssignmentInput;
export type UpdateAllocationInput = UpdateTeachingAssignmentInput;
export type TransferAllocationInput = TransferTeachingAssignmentInput;
export type DeleteAllocationInput = DeleteTeachingAssignmentInput;
export type ListAllocationsQuery = ListTeachingAssignmentsQuery;

export const resolveSubjectsForAssignmentQuerySchema = z.object({
  departmentId: z.string().uuid('Invalid department ID'),
  programId: z.string().optional().nullable(),
  regulation: z.string().min(1, 'Regulation is required'),
  year: z.string().min(1, 'Year is required'),
  semester: z.preprocess((val) => (val ? Number(val) : undefined), z.number().int().min(1).max(12)),
});

export type ResolveSubjectsForAssignmentQuery = z.infer<typeof resolveSubjectsForAssignmentQuerySchema>;

