import { z } from 'zod';

// ── Enums ─────────────────────────────────────────────────────────────────────

export const STUDENT_STATUSES = ['active', 'graduated', 'suspended', 'inactive'] as const;
export type StudentStatus = (typeof STUDENT_STATUSES)[number];

// ── Domain Interfaces ─────────────────────────────────────────────────────────

export interface DepartmentRef {
  id: string;
  name: string;
  code: string;
}

export interface ProgramRef {
  id: string;
  name: string;
  code: string;
  totalSemesters: number;
}

/** Full student record with resolved foreign keys — used in single-resource responses. */
export interface StudentDetail {
  id: string;
  userId: string;
  rollNumber: string;
  fullName: string;
  email: string;           // sourced from users.email via JOIN
  department: DepartmentRef;
  program: ProgramRef;
  semester: number;
  section?: string;
  academicYear: string;
  status: StudentStatus;
  createdAt: Date;
  updatedAt: Date;
}

/** Lightweight view used in paginated list responses. */
export interface StudentSummary {
  id: string;
  rollNumber: string;
  fullName: string;
  email: string;
  departmentName: string;
  programName: string;
  semester: number;
  section?: string;
  academicYear: string;
  status: StudentStatus;
}

export interface PaginatedStudents {
  students: StudentSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ── Zod Validation Schemas ────────────────────────────────────────────────────

const academicYear = z
  .string()
  .regex(/^\d{4}-\d{4}$/, 'Academic year must be in format YYYY-YYYY')
  .refine((val) => {
    const [start, end] = val.split('-').map(Number);
    return end === start + 1;
  }, 'Academic year years must be consecutive (e.g., 2024-2025)');

export const createStudentSchema = z.object({
  // Auth credentials — creates the login account for this student
  email: z.string().email('Invalid email').toLowerCase().trim(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),

  // Student identity
  rollNumber: z.string().min(1).max(20).trim().toUpperCase(),
  fullName: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(255)
    .trim(),

  // Academic placement
  departmentId: z.string().uuid('Invalid department ID'),
  programId: z.string().uuid('Invalid program ID'),
  semester: z.number().int().min(1).max(12),
  section: z.string().max(10).trim().toUpperCase().optional(),
  academicYear,
});

export const updateStudentSchema = z
  .object({
    fullName: z.string().min(2).max(255).trim().optional(),
    departmentId: z.string().uuid().optional(),
    programId: z.string().uuid().optional(),
    semester: z.number().int().min(1).max(12).optional(),
    section: z.string().max(10).trim().toUpperCase().nullable().optional(),
    academicYear: academicYear.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const updateStatusSchema = z.object({
  status: z.enum(STUDENT_STATUSES),
});

export const listStudentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(20),
  departmentId: z.string().uuid().optional(),
  programId: z.string().uuid().optional(),
  semester: z.coerce.number().int().min(1).max(12).optional(),
  status: z.enum(STUDENT_STATUSES).optional(),
  academicYear: z.string().optional(),
  search: z.string().max(100).trim().optional(),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type ListStudentsQuery = z.infer<typeof listStudentsQuerySchema>;
