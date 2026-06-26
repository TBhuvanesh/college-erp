import { z } from 'zod';
import { GRADES } from '../config/grading';

// ── Enums ─────────────────────────────────────────────────────────────────────

export type Grade = (typeof GRADES)[number];

export const RESULT_STATUSES = ['Pass', 'Fail', 'Absent'] as const;
export type ResultStatus = (typeof RESULT_STATUSES)[number];

export const PUBLICATION_STATUSES = ['Draft', 'Published'] as const;
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];

// ── Domain interfaces ─────────────────────────────────────────────────────────

export interface ResultDetail {
  id: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  departmentName: string;
  facultyId: string;
  facultyName: string;
  examId: string | null;
  semester: number;
  section: string;
  internalMarks: number;
  internalMaxMarks: number;
  externalMarks: number;
  externalMaxMarks: number;
  totalMarks: number;
  grade: Grade;
  resultStatus: ResultStatus;
  publicationStatus: PublicationStatus;
  publishedAt: Date | null;
  remarks: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResultSummary {
  id: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  subjectCode: string;
  subjectName: string;
  semester: number;
  section: string;
  internalMarks: number;
  internalMaxMarks: number;
  externalMarks: number;
  externalMaxMarks: number;
  totalMarks: number;
  grade: Grade;
  resultStatus: ResultStatus;
  publicationStatus: PublicationStatus;
}

export interface PaginatedResults {
  results: ResultSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/** Roster entry for faculty bulk submission: pre-populated with existing result if any. */
export interface RosterResultEntry {
  studentId: string;
  rollNumber: string;
  fullName: string;
  section: string;
  resultId: string | null;
  internalMarks: number | null;
  internalMaxMarks: number | null;
  externalMarks: number | null;
  externalMaxMarks: number | null;
  totalMarks: number | null;
  grade: Grade | null;
  resultStatus: ResultStatus | null;
  publicationStatus: PublicationStatus | null;
  remarks: string | null;
}

/** Flat result entry used in the student-facing result view, grouped by semester on the client. */
export interface StudentResultEntry {
  resultId: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  semester: number;
  internalMarks: number;
  internalMaxMarks: number;
  externalMarks: number;
  externalMaxMarks: number;
  totalMarks: number;
  grade: Grade;
  resultStatus: ResultStatus;
  publishedAt: Date;
}

// ── Validation schemas ────────────────────────────────────────────────────────

/**
 * Used for POST /api/results/sessions.
 * Faculty submits external marks for an entire section in one call.
 * internalMaxMarks and externalMaxMarks are session-level (same for all students).
 */
export const bulkSubmitResultsSchema = z
  .object({
    subjectId: z.string().uuid('Invalid subject ID'),
    examId: z.string().uuid('Invalid exam ID').optional(),
    section: z.string().min(1).max(10).trim().toUpperCase(),
    internalMaxMarks: z.coerce.number().min(1, 'Internal max marks must be at least 1').max(200),
    externalMaxMarks: z.coerce.number().min(1, 'External max marks must be at least 1').max(200),
    records: z
      .array(
        z.object({
          studentId: z.string().uuid('Invalid student ID'),
          internalMarks: z.coerce.number().min(0, 'Internal marks cannot be negative'),
          externalMarks: z.coerce.number().min(0, 'External marks cannot be negative'),
          isAbsent: z.boolean().default(false),
          remarks: z.string().trim().max(500).optional(),
        })
      )
      .min(1, 'At least one student record is required'),
  })
  .refine(
    (d) => d.records.every((r) => r.internalMarks <= d.internalMaxMarks),
    { message: 'Internal marks cannot exceed internal max marks for any student', path: ['records'] }
  )
  .refine(
    (d) => d.records.every((r) => r.isAbsent || r.externalMarks <= d.externalMaxMarks),
    { message: 'External marks cannot exceed external max marks for any student', path: ['records'] }
  );

export type BulkSubmitResultsInput = z.infer<typeof bulkSubmitResultsSchema>;

/**
 * PATCH /api/results/:id.
 * Recomputes grade and result_status when marks change.
 */
export const updateResultSchema = z
  .object({
    internalMarks: z.coerce.number().min(0).optional(),
    externalMarks: z.coerce.number().min(0).optional(),
    isAbsent: z.boolean().optional(),
    remarks: z.string().trim().max(500).nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'At least one field must be provided' });

export type UpdateResultInput = z.infer<typeof updateResultSchema>;

/** POST /api/results/publish — admin bulk-publishes Draft results for a subject+section. */
export const publishResultsSchema = z.object({
  subjectId: z.string().uuid('Invalid subject ID'),
  section: z.string().min(1).max(10).trim().toUpperCase(),
});

export type PublishResultsInput = z.infer<typeof publishResultsSchema>;

export const listResultsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(20),
  studentId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
  facultyId: z.string().uuid().optional(),
  semester: z.coerce.number().int().min(1).max(12).optional(),
  section: z.string().max(10).trim().toUpperCase().optional(),
  resultStatus: z.enum(RESULT_STATUSES).optional(),
  publicationStatus: z.enum(PUBLICATION_STATUSES).optional(),
  grade: z.enum(GRADES).optional(),
});

export type ListResultsQuery = z.infer<typeof listResultsQuerySchema>;
