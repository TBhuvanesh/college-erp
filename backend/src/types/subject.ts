import { z } from 'zod';

// ── Enums ─────────────────────────────────────────────────────────────────────

export const SUBJECT_TYPES = ['core', 'elective', 'lab'] as const;
export type SubjectType = (typeof SUBJECT_TYPES)[number];

export const SUBJECT_STATUSES = ['active', 'inactive', 'archived'] as const;
export type SubjectStatus = (typeof SUBJECT_STATUSES)[number];

// ── Domain Interfaces ─────────────────────────────────────────────────────────

interface DepartmentRef {
  id: string;
  name: string;
  code: string;
}

interface ProgramRef {
  id: string;
  name: string;
  code: string;
}

/** Full subject record with resolved foreign keys — used in single-resource responses. */
export interface SubjectDetail {
  id: string;
  code: string;
  name: string;
  department: DepartmentRef;
  program: ProgramRef;
  semester: number;
  credits: number;
  type: SubjectType;
  status: SubjectStatus;
  createdAt: Date;
  updatedAt: Date;
}

/** Lightweight view used in paginated list responses. */
export interface SubjectSummary {
  id: string;
  code: string;
  name: string;
  departmentName: string;
  programName: string;
  semester: number;
  credits: number;
  type: SubjectType;
  status: SubjectStatus;
}

export interface PaginatedSubjects {
  subjects: SubjectSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ── Zod Validation Schemas ────────────────────────────────────────────────────

export const createSubjectSchema = z.object({
  code: z
    .string()
    .min(1, 'Subject code is required')
    .max(20)
    .trim()
    .toUpperCase(),
  name: z
    .string()
    .min(2, 'Subject name must be at least 2 characters')
    .max(150)
    .trim(),
  departmentId: z.string().uuid('Invalid department ID'),
  programId: z.string().uuid('Invalid program ID'),
  semester: z.number().int().min(1).max(12),
  credits: z.number().int().min(1).max(10),
  type: z.enum(SUBJECT_TYPES),
});

export const updateSubjectSchema = z
  .object({
    name: z.string().min(2).max(150).trim().optional(),
    departmentId: z.string().uuid().optional(),
    programId: z.string().uuid().optional(),
    semester: z.number().int().min(1).max(12).optional(),
    credits: z.number().int().min(1).max(10).optional(),
    type: z.enum(SUBJECT_TYPES).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const updateSubjectStatusSchema = z.object({
  status: z.enum(SUBJECT_STATUSES),
});

export const listSubjectsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(20),
  departmentId: z.string().uuid().optional(),
  programId: z.string().uuid().optional(),
  semester: z.coerce.number().int().min(1).max(12).optional(),
  type: z.enum(SUBJECT_TYPES).optional(),
  status: z.enum(SUBJECT_STATUSES).optional(),
  search: z.string().max(100).trim().optional(),
});

export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;
export type UpdateSubjectInput = z.infer<typeof updateSubjectSchema>;
export type UpdateSubjectStatusInput = z.infer<typeof updateSubjectStatusSchema>;
export type ListSubjectsQuery = z.infer<typeof listSubjectsQuerySchema>;
