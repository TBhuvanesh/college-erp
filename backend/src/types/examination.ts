import { z } from 'zod';

export const EXAM_TYPES = ['Mid-1', 'Mid-2', 'Lab Exam', 'Internal', 'End Semester'] as const;
export type ExamType = (typeof EXAM_TYPES)[number];

export const EXAM_STATUSES = ['Scheduled', 'Ongoing', 'Completed', 'Cancelled'] as const;
export type ExamStatus = (typeof EXAM_STATUSES)[number];

/** Terminal statuses — no further transitions allowed */
export const TERMINAL_STATUSES: ReadonlySet<ExamStatus> = new Set(['Completed', 'Cancelled']);

/** Valid next statuses for each status (admin-level transitions) */
export const VALID_TRANSITIONS: Record<ExamStatus, ExamStatus[]> = {
  Scheduled: ['Ongoing', 'Cancelled'],
  Ongoing: ['Completed', 'Cancelled'],
  Completed: [],
  Cancelled: [],
};

/** Faculty may only advance their own exam forward — not cancel */
export const FACULTY_ALLOWED_TRANSITIONS: Record<ExamStatus, ExamStatus[]> = {
  Scheduled: ['Ongoing'],
  Ongoing: ['Completed'],
  Completed: [],
  Cancelled: [],
};

// ── Domain types ──────────────────────────────────────────────────────────────

export interface ExamDetail {
  id: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  departmentName: string;
  facultyId: string;
  facultyName: string;
  semester: number;
  section: string;
  examType: ExamType;
  examDate: string;      // YYYY-MM-DD
  startTime: string;     // HH:MM
  endTime: string;       // HH:MM
  maximumMarks: number;
  status: ExamStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExamSummary {
  id: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  facultyName: string;
  semester: number;
  section: string;
  examType: ExamType;
  examDate: string;
  startTime: string;
  endTime: string;
  maximumMarks: number;
  status: ExamStatus;
}

export interface PaginatedExams {
  exams: ExamSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ── Shared field primitives ────────────────────────────────────────────────────

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .refine((d) => !isNaN(Date.parse(d)), { message: 'Invalid date value' });

const timeHHMM = z
  .string()
  .regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format');

// ── Validation schemas ────────────────────────────────────────────────────────

/**
 * Used for POST /api/examinations.
 * facultyId is required in the request body.
 * When the caller is a faculty role, the controller overrides it with the resolved faculty ID.
 */
export const createExamSchema = z
  .object({
    subjectId: z.string().uuid('Invalid subject ID'),
    facultyId: z.string().uuid('Invalid faculty ID'),
    section: z.string().min(1).max(10).trim().toUpperCase(),
    examType: z.enum(EXAM_TYPES),
    examDate: isoDate,
    startTime: timeHHMM,
    endTime: timeHHMM,
    maximumMarks: z.coerce.number().min(1, 'Minimum marks must be at least 1').max(200),
  })
  .refine((d) => d.endTime > d.startTime, {
    message: 'End time must be after start time',
    path: ['endTime'],
  });

export type CreateExamInput = z.infer<typeof createExamSchema>;

/**
 * Updatable fields: date, time, marks, section.
 * examType and subjectId are identity fields and cannot be changed after creation.
 */
export const updateExamSchema = z
  .object({
    section: z.string().min(1).max(10).trim().toUpperCase().optional(),
    examDate: isoDate.optional(),
    startTime: timeHHMM.optional(),
    endTime: timeHHMM.optional(),
    maximumMarks: z.coerce.number().min(1).max(200).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'At least one field must be provided' });

export type UpdateExamInput = z.infer<typeof updateExamSchema>;

export const updateExamStatusSchema = z.object({
  status: z.enum(EXAM_STATUSES),
});

export type UpdateExamStatusInput = z.infer<typeof updateExamStatusSchema>;

export const listExamsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(1000).default(20),
    subjectId: z.string().uuid().optional(),
    facultyId: z.string().uuid().optional(),
    semester: z.coerce.number().int().min(1).max(12).optional(),
    section: z.string().max(10).trim().toUpperCase().optional(),
    examType: z.enum(EXAM_TYPES).optional(),
    status: z.enum(EXAM_STATUSES).optional(),
    date: isoDate.optional(),
    dateFrom: isoDate.optional(),
    dateTo: isoDate.optional(),
  });

export type ListExamsQuery = z.infer<typeof listExamsQuerySchema>;
