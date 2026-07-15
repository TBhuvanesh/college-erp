import { z } from 'zod';
import { GRADES } from '../config/grading';

// ── Report / export type registries ──────────────────────────────────────────────

export const REPORT_TYPES = [
  'attendance',
  'results',
  'fees',
  'lms',
  'mentorship',
  'department',
  'student',
  'opportunities',
  'teaching',
  'room_seating_chart',
  'student_seating_list',
  'invigilator_sheet',
  'attendance_sheet',
  'seating_summary',
] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const EXPORT_FORMATS = ['pdf', 'excel', 'csv'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

// ── Chart-ready structures (no images — frontend renders these) ─────────────────

export const CHART_TYPES = ['bar', 'line', 'pie', 'donut'] as const;
export type ChartType = (typeof CHART_TYPES)[number];

export interface ChartSeries {
  label: string;
  data: number[];
}

export interface ChartData {
  title: string;
  type: ChartType;
  labels: string[];
  series: ChartSeries[];
}

// ── Generic tabular report envelope ──────────────────────────────────────────────

export interface ReportColumn {
  key: string;
  label: string;
}

export interface ReportResult {
  title: string;
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
  summary?: Record<string, unknown>;
  charts?: ChartData[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ── Shared filters (each report reads only the fields relevant to it) ───────────

export const reportFiltersSchema = z.object({
  academicYear: z.string().regex(/^\d{4}-\d{4}$/, 'academicYear must be like 2026-2027').optional(),
  semester: z.coerce.number().int().min(1).max(12).optional(),
  departmentId: z.string().uuid().optional(),
  facultyId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
  section: z.string().trim().max(10).optional(),
  dateFrom: z.string().refine((v) => !isNaN(Date.parse(v)), { message: 'dateFrom must be a valid date' }).optional(),
  dateTo: z.string().refine((v) => !isNaN(Date.parse(v)), { message: 'dateTo must be a valid date' }).optional(),

  // Per-report optional narrowing filters (ignored by reports that don't use them)
  grade: z.enum(GRADES).optional(),
  resultStatus: z.enum(['Pass', 'Fail', 'Absent']).optional(),
  publicationStatus: z.enum(['Draft', 'Published']).optional(),
  paymentStatus: z.enum(['Pending', 'Partially Paid', 'Paid', 'Overdue']).optional(),
  feeType: z.enum(['Tuition Fee', 'Examination Fee', 'Laboratory Fee', 'Miscellaneous Fee']).optional(),
  opportunityType: z
    .enum([
      'Internship',
      'Job Opportunity',
      'Workshop',
      'Seminar',
      'Hackathon',
      'Competition',
      'Placement Drive',
      'College Event',
    ])
    .optional(),
  opportunityStatus: z.enum(['Active', 'Closed', 'Archived']).optional(),
  lessonStatus: z
    .enum(['Planned', 'In Progress', 'Partially Completed', 'Completed', 'Rescheduled', 'Cancelled'])
    .optional(),

  // Exam Seating & Invigilation print-center reports
  examId: z.string().uuid().optional(),
  roomId: z.string().uuid().optional(),
  examSessionId: z.string().uuid().optional(),

  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
});
export type ReportFilters = z.infer<typeof reportFiltersSchema>;

export const exportQuerySchema = reportFiltersSchema.extend({
  reportType: z.enum(REPORT_TYPES),
});
export type ExportQuery = z.infer<typeof exportQuerySchema>;
