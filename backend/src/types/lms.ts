import { z } from 'zod';

// ── Enums ──────────────────────────────────────────────────────────────────────

export const LMS_FILE_TYPES = ['pdf', 'ppt', 'pptx', 'doc', 'docx'] as const;
export type LmsFileType = (typeof LMS_FILE_TYPES)[number];

export const SUBMISSION_STATUSES = ['Submitted', 'Late Submission', 'Evaluated'] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

// ── Course Material ────────────────────────────────────────────────────────────

export interface CourseMaterial {
  id: string;
  title: string;
  description: string | null;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  facultyId: string;
  facultyName: string;
  fileName: string;
  fileType: LmsFileType;
  fileSize: number;
  downloadUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

export const createMaterialSchema = z.object({
  title:       z.string().trim().min(1).max(255),
  description: z.string().trim().max(2000).optional(),
  subjectId:   z.string().uuid('Invalid subject ID'),
});
export type CreateMaterialInput = z.infer<typeof createMaterialSchema>;

export const updateMaterialSchema = z.object({
  title:       z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(2000).optional(),
});
export type UpdateMaterialInput = z.infer<typeof updateMaterialSchema>;

export const listMaterialsQuerySchema = z.object({
  subjectId: z.string().uuid().optional(),
  page:      z.coerce.number().int().min(1).default(1),
  limit:     z.coerce.number().int().min(1).max(100).default(20),
});
export type ListMaterialsQuery = z.infer<typeof listMaterialsQuerySchema>;

export interface PaginatedMaterials {
  materials:  CourseMaterial[];
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
}

// ── Assignment ─────────────────────────────────────────────────────────────────

export interface Assignment {
  id: string;
  title: string;
  description: string | null;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  facultyId: string;
  facultyName: string;
  dueDate: Date;
  maxMarks: number;
  createdAt: Date;
  updatedAt: Date;
}

export const createAssignmentSchema = z.object({
  title:       z.string().trim().min(1).max(255),
  description: z.string().trim().max(2000).optional(),
  subjectId:   z.string().uuid('Invalid subject ID'),
  dueDate:     z.string()
                .refine((val) => !isNaN(Date.parse(val)), { message: 'dueDate must be a valid date' })
                .transform((val) => new Date(val).toISOString()),
  maxMarks:    z.coerce.number().positive('maxMarks must be greater than 0').max(1000),
});
export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;

export const updateAssignmentSchema = z.object({
  title:       z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(2000).optional(),
  dueDate:     z.string()
                .refine((val) => !isNaN(Date.parse(val)), { message: 'dueDate must be a valid date' })
                .transform((val) => new Date(val).toISOString())
                .optional(),
  maxMarks:    z.coerce.number().positive().max(1000).optional(),
});
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;

export const listAssignmentsQuerySchema = z.object({
  subjectId: z.string().uuid().optional(),
  page:      z.coerce.number().int().min(1).default(1),
  limit:     z.coerce.number().int().min(1).max(100).default(20),
});
export type ListAssignmentsQuery = z.infer<typeof listAssignmentsQuerySchema>;

export interface PaginatedAssignments {
  assignments: Assignment[];
  total:       number;
  page:        number;
  limit:       number;
  totalPages:  number;
}

// ── Submission ─────────────────────────────────────────────────────────────────

export interface Submission {
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  assignmentDueDate: Date;
  assignmentMaxMarks: number;
  studentId: string;
  studentRollNumber: string;
  studentName: string;
  fileName: string;
  fileSize: number;
  downloadUrl: string;
  status: SubmissionStatus;
  marks: number | null;
  feedback: string | null;
  submittedAt: Date;
  updatedAt: Date;
}

export const submitAssignmentSchema = z.object({
  assignmentId: z.string().uuid('Invalid assignment ID'),
});
export type SubmitAssignmentInput = z.infer<typeof submitAssignmentSchema>;

export const gradeSubmissionSchema = z.object({
  marks:    z.coerce.number().min(0, 'Marks cannot be negative'),
  feedback: z.string().trim().max(2000).optional(),
});
export type GradeSubmissionInput = z.infer<typeof gradeSubmissionSchema>;

export const listSubmissionsQuerySchema = z.object({
  assignmentId: z.string().uuid().optional(),
  studentId:    z.string().uuid().optional(),
  status:       z.enum(SUBMISSION_STATUSES).optional(),
  page:         z.coerce.number().int().min(1).default(1),
  limit:        z.coerce.number().int().min(1).max(100).default(20),
});
export type ListSubmissionsQuery = z.infer<typeof listSubmissionsQuerySchema>;

export interface PaginatedSubmissions {
  submissions: Submission[];
  total:       number;
  page:        number;
  limit:       number;
  totalPages:  number;
}
