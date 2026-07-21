import { z } from 'zod';

export interface AllocationDetail {
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

export const createAllocationSchema = z.object({
  facultyId: z.string().uuid('Invalid faculty ID'),
  subjectId: z.string().uuid('Invalid subject ID'),
  academicYear: academicYearSchema,
  section: z.string().min(1).max(10).trim().toUpperCase(),
  status: z.enum(['active', 'inactive', 'pending']).optional().default('active'),
  notes: z.string().optional(),
});

export const updateAllocationSchema = z.object({
  facultyId: z.string().uuid('Invalid faculty ID').optional(),
  subjectId: z.string().uuid('Invalid subject ID').optional(),
  section: z.string().min(1).max(10).trim().toUpperCase().optional(),
  status: z.enum(['active', 'inactive', 'pending']).optional(),
  notes: z.string().optional(),
});

export const transferAllocationSchema = z.object({
  facultyId: z.string().uuid('Invalid new faculty ID'),
});

export const deleteAllocationSchema = z.object({
  reason: z.string().min(3, 'Reason must be at least 3 characters').max(500),
});

export const listAllocationsQuerySchema = z.object({
  departmentId: z.string().uuid().optional(),
  semester: z.preprocess((val) => (val ? Number(val) : undefined), z.number().min(1).max(12).optional()),
  section: z.string().optional(),
  subjectId: z.string().uuid().optional(),
  facultyId: z.string().uuid().optional(),
  academicYear: z.string().optional(),
  status: z.enum(['active', 'inactive', 'pending']).optional(),
  search: z.string().optional(),
});

export type CreateAllocationInput = z.infer<typeof createAllocationSchema>;
export type UpdateAllocationInput = z.infer<typeof updateAllocationSchema>;
export type TransferAllocationInput = z.infer<typeof transferAllocationSchema>;
export type DeleteAllocationInput = z.infer<typeof deleteAllocationSchema>;
export type ListAllocationsQuery = z.infer<typeof listAllocationsQuerySchema>;
