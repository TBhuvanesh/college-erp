import { z } from 'zod';

// ── Per-category result shapes ────────────────────────────────────────────────

export interface StudentResult {
  id: string;
  rollNumber: string;
  fullName: string;
  departmentName: string;
  semester: number;
}

export interface FacultyResult {
  id: string;
  employeeNumber: string;
  fullName: string;
  departmentName: string;
}

export interface SubjectResult {
  id: string;
  code: string;
  name: string;
  departmentName: string;
  semester: number;
}

export interface AnnouncementResult {
  id: string;
  title: string;
  publishDate: string;    // YYYY-MM-DD
}

export interface EventResult {
  id: string;
  title: string;
  startDate: string;      // YYYY-MM-DD
  eventType: string;
}

export interface ExaminationResult {
  id: string;
  examType: string;       // 'Mid-1', 'Mid-2', 'End Semester', etc.
  subjectName: string;
  examDate: string;       // YYYY-MM-DD
}

export interface DepartmentResult {
  id: string;
  name: string;
  code: string;
}

export interface TeachingAssignmentResult {
  id: string;
  facultyName: string;
  subjectName: string;
  subjectCode: string;
  section: string;
  academicYear: string;
}

export interface ResultRecordResult {
  id: string;
  studentName: string;
  rollNumber: string;
  subjectName: string;
  grade: string;
  publicationStatus: string;
}

export interface NotificationResult {
  id: string;
  title: string;
  createdAt: string;      // YYYY-MM-DD
}

export interface RoomResult {
  id: string;
  name: string;
  building: string | null;
  capacity: number;
}

// ── Envelope returned by all three role-scoped search functions ───────────────

/**
 * Categorized search response.
 * Categories with zero results are omitted from the API response.
 */
export interface SearchResult {
  students?:           StudentResult[];
  faculty?:            FacultyResult[];
  subjects?:           SubjectResult[];
  announcements?:      AnnouncementResult[];
  events?:             EventResult[];
  examinations?:       ExaminationResult[];
  departments?:        DepartmentResult[];
  teachingAssignments?: TeachingAssignmentResult[];
  results?:            ResultRecordResult[];
  notifications?:      NotificationResult[];
  rooms?:              RoomResult[];
}

// ── Zod Validation Schema ─────────────────────────────────────────────────────

export const searchQuerySchema = z.object({
  q: z
    .string({ required_error: 'Search query is required' })
    .trim()
    .min(2, 'Search query must be at least 2 characters')
    .max(100, 'Search query must be at most 100 characters'),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;
