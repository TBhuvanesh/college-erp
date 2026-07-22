import { z } from 'zod';

// ── Enums ─────────────────────────────────────────────────────────────────────

export const SUBJECT_TYPES = ['core', 'elective', 'lab', 'mandatory', 'project', 'workshop'] as const;
export type SubjectType = (typeof SUBJECT_TYPES)[number];

export const SUBJECT_STATUSES = ['active', 'inactive', 'archived'] as const;
export type SubjectStatus = (typeof SUBJECT_STATUSES)[number];

// ── Domain Interfaces ─────────────────────────────────────────────────────────



export interface SubjectCurriculumMappingDetail {
  id: string;
  subjectId: string;
  departmentId: string;
  departmentName: string;
  departmentCode: string;
  programId: string | null;
  programName: string | null;
  programCode: string | null;
  program: string | null;
  regulation: string;
  year: 'I' | 'II' | 'III' | 'IV';
  semester: number;
  semesterRaw: 'I' | 'II' | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Full subject record with resolved foreign keys — used in single-resource responses. */
export interface SubjectDetail {
  id: string;
  code: string;
  name: string;
  credits: number;
  type: SubjectType;
  status: SubjectStatus;
  lectureHours: number;
  tutorialHours: number;
  practicalHours: number;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  mappings: SubjectCurriculumMappingDetail[];
}

/** Lightweight view used in paginated list responses. */
export interface SubjectSummary {
  id: string;
  code: string;
  name: string;
  credits: number;
  type: SubjectType;
  status: SubjectStatus;
  lectureHours: number;
  tutorialHours: number;
  practicalHours: number;
  // If filtered by department, these fields represent that matching mapping's details:
  departmentId?: string;
  departmentName?: string;
  programId?: string | null;
  programName?: string | null;
  regulation?: string;
  year?: string | null;
  semester?: number;
  semesterRaw?: string | null;
  // General view: all mappings
  mappings?: SubjectCurriculumMappingDetail[];
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

export const createCurriculumMappingSchema = z.object({
  departmentId: z.string().uuid('Invalid department ID'),
  programId: z.string().uuid('Invalid program ID').optional().nullable(),
  program: z.string().max(100).trim().optional().nullable(),
  regulation: z.string().max(20).trim().default('R22'),
  year: z.enum(['I', 'II', 'III', 'IV']),
  semesterRaw: z.enum(['I', 'II']).optional().nullable(),
  semester: z.number().int().min(1).max(12).optional().nullable(),
});

export const updateCurriculumMappingSchema = z.object({
  departmentId: z.string().uuid('Invalid department ID').optional(),
  programId: z.string().uuid('Invalid program ID').optional().nullable(),
  program: z.string().max(100).trim().optional().nullable(),
  regulation: z.string().max(20).trim().optional(),
  year: z.enum(['I', 'II', 'III', 'IV']).optional(),
  semesterRaw: z.enum(['I', 'II']).optional().nullable(),
  semester: z.number().int().min(1).max(12).optional().nullable(),
});

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
  programId: z.string().uuid('Invalid program ID').optional().nullable(),
  program: z.string().max(100).trim().optional().nullable(),
  regulation: z.string().max(20).trim().default('R22'),
  year: z.enum(['I', 'II', 'III', 'IV']).optional().nullable(),
  semesterRaw: z.enum(['I', 'II']).optional().nullable(),
  semester: z.number().int().min(1).max(12).optional().nullable(),
  lectureHours: z.number().int().min(0).max(10).default(0),
  tutorialHours: z.number().int().min(0).max(10).default(0),
  practicalHours: z.number().int().min(0).max(10).default(0),
  credits: z.coerce.number().min(0, 'Credits must be at least 0').max(10),
  type: z.enum(SUBJECT_TYPES),
  description: z.string().max(1000).trim().optional().nullable(),
  status: z.enum(SUBJECT_STATUSES).default('active'),
});

export const updateSubjectSchema = z
  .object({
    name: z.string().min(2).max(150).trim().optional(),
    lectureHours: z.number().int().min(0).max(10).optional(),
    tutorialHours: z.number().int().min(0).max(10).optional(),
    practicalHours: z.number().int().min(0).max(10).optional(),
    credits: z.coerce.number().min(0).max(10).optional(),
    type: z.enum(SUBJECT_TYPES).optional(),
    description: z.string().max(1000).trim().optional().nullable(),
    status: z.enum(SUBJECT_STATUSES).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const updateSubjectStatusSchema = z.object({
  status: z.enum(SUBJECT_STATUSES),
});

export const listSubjectsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(10000).default(20),
  departmentId: z.string().uuid().optional(),
  programId: z.string().uuid().optional(),
  program: z.string().optional(),
  semester: z.coerce.number().int().min(1).max(12).optional(),
  regulation: z.string().optional(),
  year: z.string().optional(),
  type: z.enum(SUBJECT_TYPES).optional(),
  status: z.enum(SUBJECT_STATUSES).optional(),
  search: z.string().max(100).trim().optional(),
});

export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;
export type UpdateSubjectInput = z.infer<typeof updateSubjectSchema>;
export type UpdateSubjectStatusInput = z.infer<typeof updateSubjectStatusSchema>;
export type ListSubjectsQuery = z.infer<typeof listSubjectsQuerySchema>;

export type CreateCurriculumMappingInput = z.infer<typeof createCurriculumMappingSchema>;
export type UpdateCurriculumMappingInput = z.infer<typeof updateCurriculumMappingSchema>;

