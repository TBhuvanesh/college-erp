import { z } from 'zod';

// ── Enums ─────────────────────────────────────────────────────────────────────

export const FACULTY_DESIGNATIONS = [
  'professor',
  'associate_professor',
  'assistant_professor',
  'lecturer',
  'hod',
] as const;
export type FacultyDesignation = (typeof FACULTY_DESIGNATIONS)[number];

export const FACULTY_STATUSES = ['active', 'on_leave', 'resigned', 'retired'] as const;
export type FacultyStatus = (typeof FACULTY_STATUSES)[number];

// ── Domain Interfaces ─────────────────────────────────────────────────────────

interface DepartmentRef {
  id: string;
  name: string;
  code: string;
}

/** Full faculty record with resolved foreign keys — used in single-resource responses. */
export interface FacultyDetail {
  id: string;
  userId: string;
  employeeNumber: string;
  fullName: string;
  email: string;           // sourced from users.email via JOIN
  department: DepartmentRef;
  designation: FacultyDesignation;
  status: FacultyStatus;
  createdAt: Date;
  updatedAt: Date;
}

/** Lightweight view used in paginated list responses. */
export interface FacultySummary {
  id: string;
  employeeNumber: string;
  fullName: string;
  email: string;
  departmentId: string;
  departmentName: string;
  designation: FacultyDesignation;
  status: FacultyStatus;
}

export interface PaginatedFaculty {
  faculty: FacultySummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ── Zod Validation Schemas ────────────────────────────────────────────────────

export const createFacultySchema = z.object({
  // Auth credentials — creates the login account for this faculty member
  email: z.string().email('Invalid email').toLowerCase().trim(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),

  // Faculty identity
  employeeNumber: z.string().min(1).max(20).trim().toUpperCase(),
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(255).trim(),

  // Academic placement
  departmentId: z.string().uuid('Invalid department ID'),
  designation: z.enum(FACULTY_DESIGNATIONS),
});

export const updateFacultySchema = z
  .object({
    fullName: z.string().min(2).max(255).trim().optional(),
    departmentId: z.string().uuid().optional(),
    designation: z.enum(FACULTY_DESIGNATIONS).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const updateFacultyStatusSchema = z.object({
  status: z.enum(FACULTY_STATUSES),
});

export const listFacultyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(20),
  departmentId: z.string().uuid().optional(),
  designation: z.enum(FACULTY_DESIGNATIONS).optional(),
  status: z.enum(FACULTY_STATUSES).optional(),
  search: z.string().max(100).trim().optional(),
});

export type CreateFacultyInput = z.infer<typeof createFacultySchema>;
export type UpdateFacultyInput = z.infer<typeof updateFacultySchema>;
export type UpdateFacultyStatusInput = z.infer<typeof updateFacultyStatusSchema>;
export type ListFacultyQuery = z.infer<typeof listFacultyQuerySchema>;
