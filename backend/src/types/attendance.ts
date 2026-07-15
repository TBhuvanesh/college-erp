import { z } from 'zod';

// ── Enums ─────────────────────────────────────────────────────────────────────

export const ATTENDANCE_STATUSES = ['present', 'absent'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

// ── Domain Interfaces ─────────────────────────────────────────────────────────

/** Full attendance record with resolved names — single-resource and list responses. */
export interface AttendanceRecord {
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
  attendanceDate: string; // YYYY-MM-DD — stored as DATE, returned as ISO string
  status: AttendanceStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedAttendance {
  records: AttendanceRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/** One row in the roster response — includes existing attendance if already marked. */
export interface RosterEntry {
  studentId: string;
  rollNumber: string;
  fullName: string;
  section: string;
  attendanceId: string | null;
  status: AttendanceStatus | null;
}

/** Subject-level summary for a student's attendance report. */
export interface SubjectAttendanceSummary {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  semester: number;
  totalClasses: number;
  attendedClasses: number;
  percentage: number;
  facultyId?: string;
  facultyName?: string;
}

export interface StudentAttendanceSummary {
  subjects: SubjectAttendanceSummary[];
  overall: {
    totalClasses: number;
    attendedClasses: number;
    percentage: number;
  };
}

/** One row in the student's history response. */
export interface AttendanceHistoryEntry {
  id: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  section: string;
  attendanceDate: string;
  status: AttendanceStatus;
  markedBy: string;
  updatedAt: Date;
}

export interface PaginatedHistory {
  records: AttendanceHistoryEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ── Zod Validation Schemas ────────────────────────────────────────────────────

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in format YYYY-MM-DD')
  .refine((d) => !isNaN(Date.parse(d)), 'Invalid date');

export const markAttendanceSchema = z.object({
  subjectId: z.string().uuid('Invalid subject ID'),
  section: z.string().min(1).max(10).trim().toUpperCase(),
  date: isoDate,
  records: z
    .array(
      z.object({
        studentId: z.string().uuid('Invalid student ID'),
        status: z.enum(ATTENDANCE_STATUSES),
      })
    )
    .min(1, 'At least one student record is required'),
});

export const updateAttendanceSchema = z.object({
  status: z.enum(ATTENDANCE_STATUSES),
});

const optionalIsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in format YYYY-MM-DD')
  .optional();

export const listAttendanceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(50),
  studentId: z.string().uuid().optional(),
  facultyId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
  section: z.string().max(10).trim().toUpperCase().optional(),
  date: optionalIsoDate,
  dateFrom: optionalIsoDate,
  dateTo: optionalIsoDate,
  status: z.enum(ATTENDANCE_STATUSES).optional(),
});

export const rosterQuerySchema = z.object({
  subjectId: z.string().uuid('Invalid subject ID'),
  section: z.string().min(1).max(10).trim().toUpperCase(),
  date: isoDate,
});

export const historyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(30),
  subjectId: z.string().uuid().optional(),
  dateFrom: optionalIsoDate,
  dateTo: optionalIsoDate,
});

export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>;
export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>;
export type ListAttendanceQuery = z.infer<typeof listAttendanceQuerySchema>;
export type RosterQuery = z.infer<typeof rosterQuerySchema>;
export type HistoryQuery = z.infer<typeof historyQuerySchema>;
