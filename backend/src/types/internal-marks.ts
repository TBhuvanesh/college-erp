import { z } from 'zod';

// ── Enums ─────────────────────────────────────────────────────────────────────

export const ASSESSMENT_TYPES = ['Assignment', 'Mid-1', 'Mid-2', 'Lab', 'Internal'] as const;
export type AssessmentType = (typeof ASSESSMENT_TYPES)[number];

// ── Domain Interfaces ─────────────────────────────────────────────────────────

export interface InternalMarksRecord {
  id: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  facultyId: string;
  facultyName: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  section: string;
  assessmentType: AssessmentType;
  maximumMarks: number;
  obtainedMarks: number;
  remarks: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedInternalMarks {
  records: InternalMarksRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface RosterMarksEntry {
  studentId: string;
  rollNumber: string;
  fullName: string;
  section: string;
  marksId: string | null;
  obtainedMarks: number | null;
  maximumMarks: number | null;
  remarks: string | null;
}

export interface SubjectMarksSummary {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  semester: number;
  assessments: {
    assessmentType: AssessmentType;
    obtainedMarks: number;
    maximumMarks: number;
    remarks: string | null;
  }[];
  totalObtained: number;
  totalMaximum: number;
}

export interface StudentMarksSummary {
  subjects: SubjectMarksSummary[];
  overall: {
    totalObtained: number;
    totalMaximum: number;
    percentage: number;
  };
}

// ── Zod Validation Schemas ────────────────────────────────────────────────────

export const bulkEnterMarksSchema = z.object({
  subjectId: z.string().uuid('Invalid subject ID'),
  section: z.string().min(1).max(10).trim().toUpperCase(),
  assessmentType: z.enum(ASSESSMENT_TYPES, { errorMap: () => ({ message: 'Invalid assessment type' }) }),
  maximumMarks: z.coerce.number().min(0.5, 'Maximum marks must be at least 0.5'),
  records: z
    .array(
      z.object({
        studentId: z.string().uuid('Invalid student ID'),
        obtainedMarks: z.coerce.number().min(0, 'Obtained marks cannot be negative'),
        remarks: z.string().trim().max(500).nullable().optional(),
      })
    )
    .min(1, 'At least one student record is required'),
}).refine((data) => {
  // Check that no student obtained more than maximumMarks
  return data.records.every((r) => r.obtainedMarks <= data.maximumMarks);
}, {
  message: 'Obtained marks cannot exceed maximum marks for any student',
  path: ['records'],
});

export const updateMarksSchema = z.object({
  maximumMarks: z.coerce.number().min(0.5, 'Maximum marks must be at least 0.5').optional(),
  obtainedMarks: z.coerce.number().min(0, 'Obtained marks cannot be negative').optional(),
  remarks: z.string().trim().max(500).nullable().optional(),
}).refine((data) => {
  // If both are provided, validate relation
  if (data.obtainedMarks !== undefined && data.maximumMarks !== undefined) {
    return data.obtainedMarks <= data.maximumMarks;
  }
  return true;
}, {
  message: 'Obtained marks cannot exceed maximum marks',
  path: ['obtainedMarks'],
});

export const listMarksQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(50),
  studentId: z.string().uuid().optional(),
  facultyId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
  section: z.string().max(10).trim().toUpperCase().optional(),
  assessmentType: z.enum(ASSESSMENT_TYPES).optional(),
});

export type BulkEnterMarksInput = z.infer<typeof bulkEnterMarksSchema>;
export type UpdateMarksInput = z.infer<typeof updateMarksSchema>;
export type ListMarksQuery = z.infer<typeof listMarksQuerySchema>;
