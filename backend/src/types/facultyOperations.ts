import { z } from 'zod';
import type { TeachingPlan, CourseProgress } from './teachingPlan';

// ── Enums ──────────────────────────────────────────────────────────────────────

export const WORKLOAD_STATUSES = ['Light', 'Balanced', 'Heavy', 'Overloaded'] as const;
export type WorkloadStatus = (typeof WORKLOAD_STATUSES)[number];

export const TASK_TYPES = ['attendance', 'evaluation', 'lesson', 'mentor_meeting', 'quiz', 'internal_marks', 'invigilation'] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_PRIORITIES = ['low', 'medium', 'high'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

// ── Task Center ────────────────────────────────────────────────────────────────
// Tasks are generated fresh on every request from live data — never stored —
// so a completed task simply stops matching its generating query next time.

export interface FacultyTask {
  id: string;
  type: TaskType;
  title: string;
  context: string | null;
  priority: TaskPriority;
  dueDate: string | null;
}

// ── Workload Engine ───────────────────────────────────────────────────────────

export interface FacultyWorkload {
  facultyId: string;
  facultyName: string;
  teachingHours: number;
  subjectsAssigned: number;
  weeklyClasses: number;
  monthlyClasses: number;
  assignmentsCreated: number;
  assignmentsPendingReview: number;
  materialsUploaded: number;
  mentorshipStudents: number;
  upcomingEvaluations: number;
  upcomingMeetings: number;
  teachingPlannerProgress: number;
  attendancePending: number;
  internalMarksPending: number;
  examinationDuties: number;
  status: WorkloadStatus;
}

// ── Faculty Operations Center dashboard ──────────────────────────────────────

export interface PendingAttendanceItem {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  section: string;
}

export interface PendingEvaluationItem {
  assignmentId: string;
  assignmentTitle: string;
  subjectCode: string;
  pendingCount: number;
}

export interface UpcomingDeadlineItem {
  assignmentId: string;
  assignmentTitle: string;
  subjectCode: string;
  dueDate: Date;
}

export interface MentorMeetingItem {
  noteId: string;
  studentId: string;
  studentName: string;
  title: string;
  followUpDate: string;
}

export interface UpcomingExamItem {
  examId: string;
  subjectCode: string;
  examType: string;
  examDate: string;
  status: string;
}

export interface CalendarSummaryItem {
  id: string;
  title: string;
  startDate: Date;
  eventType: string;
}

export interface NotificationSummary {
  total: number;
  unread: number;
}

export interface FacultyOperationsDashboard {
  todaySchedule: TeachingPlan[];
  pendingAttendance: PendingAttendanceItem[];
  assignmentsPendingEvaluation: PendingEvaluationItem[];
  upcomingDeadlines: UpcomingDeadlineItem[];
  mentorMeetings: { upcoming: MentorMeetingItem[]; overdue: MentorMeetingItem[] };
  upcomingQuizzes: TeachingPlan[];
  upcomingExams: UpcomingExamItem[];
  teachingProgress: CourseProgress;
  notificationSummary: NotificationSummary;
  calendarSummary: CalendarSummaryItem[];
  workload: FacultyWorkload;
  tasks: FacultyTask[];
  warnings: string[];
}

// ── Workload Analytics ────────────────────────────────────────────────────────

export interface WorkloadAnalytics {
  teachingHours: number;
  assignmentsReviewed: number;
  averageEvaluationHours: number;
  mentorMeetingsCompleted: number;
  lessonsCompleted: number;
  averageWeeklyWorkloadHours: number;
}

// ── Admin/HOD workload distribution views ────────────────────────────────────

export interface WorkloadDistributionEntry extends FacultyWorkload {
  departmentName: string;
}

// ── Zod schemas ──────────────────────────────────────────────────────────────

export const workloadQuerySchema = z.object({
  facultyId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
});
export type WorkloadQuery = z.infer<typeof workloadQuerySchema>;

export const facultyAnalyticsQuerySchema = z.object({
  facultyId: z.string().uuid().optional(),
});
export type FacultyOperationsAnalyticsQuery = z.infer<typeof facultyAnalyticsQuerySchema>;
