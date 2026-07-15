import { z } from 'zod';

// ── Timeline Engine ────────────────────────────────────────────────────────────

export const TIMELINE_CATEGORIES = [
  'class',
  'homework',
  'assignment',
  'quiz',
  'exam',
  'attendance',
  'fee',
  'mentorship',
  'event',
  'opportunity',
  'notification',
  'task',
  'result',
] as const;
export type TimelineCategory = (typeof TIMELINE_CATEGORIES)[number];

export const PRIORITIES = ['low', 'medium', 'high'] as const;
export type Priority = (typeof PRIORITIES)[number];

export interface TimelineEvent {
  id: string;
  category: TimelineCategory;
  title: string;
  subtitle: string | null;
  timestamp: string; // ISO — the instant this event is anchored to, used for sorting
  priority: Priority;
  sourceModule: string;
  sourceId: string | null;
  meta?: Record<string, unknown>;
}

// ── Action Engine ──────────────────────────────────────────────────────────────

export const ACTION_TYPES = [
  'complete_assignment',
  'pay_fees',
  'meet_mentor',
  'study_materials',
  'take_attendance',
  'evaluate_assignments',
  'submit_marks',
  'review_quiz',
  'upload_notes',
  'conduct_lesson',
  'invigilate_exam',
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export interface ActionItem {
  id: string;
  type: ActionType;
  title: string;
  description: string | null;
  priority: Priority;
  dueDate: string | null;
  sourceModule: string;
  sourceId: string | null;
}

// ── Widget Generator / Smart Dashboard ────────────────────────────────────────

export interface TrendWidget {
  key: string;
  label: string;
  value: number;
  unit: '%' | 'count' | 'currency';
  trend: number | null; // signed delta vs. previous period, null when not computable
  context: string | null; // e.g. "Lowest Subject: Operating Systems"
  extra?: Record<string, number | string>;
}

export interface Insight {
  icon: string;
  message: string;
  priority: Priority;
}

// ── Today Widget / Week View ──────────────────────────────────────────────────

export interface TodayWidget {
  date: string;
  currentSubject: {
    subjectId: string;
    subjectCode: string;
    subjectName: string;
    facultyName: string;
    topic: string;
    homework: string | null;
    quizPlanned: boolean;
    materialTitle: string | null;
    materialDownloadUrl: string | null;
    assignmentTitle: string | null;
    assignmentDueDate: string | null;
  } | null;
  allTodayLessons: number;
}

export interface WeekDayGroup {
  date: string;
  events: TimelineEvent[];
}

export interface WeekView {
  from: string;
  to: string;
  days: WeekDayGroup[];
}

// ── Zod query schemas ──────────────────────────────────────────────────────────

export const experienceQuerySchema = z.object({});
export type ExperienceQuery = z.infer<typeof experienceQuerySchema>;

export const dashboardWidgetsQuerySchema = z.object({
  departmentId: z.string().uuid().optional(),
});
export type DashboardWidgetsQuery = z.infer<typeof dashboardWidgetsQuerySchema>;
