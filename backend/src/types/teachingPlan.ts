import { z } from 'zod';

// ── Enums ──────────────────────────────────────────────────────────────────────

export const LESSON_STATUSES = [
  'Planned',
  'In Progress',
  'Partially Completed',
  'Completed',
  'Rescheduled',
  'Cancelled',
] as const;
export type LessonStatus = (typeof LESSON_STATUSES)[number];

// Statuses settable through PUT /teaching-plans/:id/status.
// 'Planned' is the creation default; 'Rescheduled' is set only by the
// dedicated /reschedule endpoint (it always carries a date change).
export const SETTABLE_LESSON_STATUSES = ['In Progress', 'Completed', 'Partially Completed', 'Cancelled'] as const;

export const UPCOMING_VIEWS = ['week', 'month', 'semester'] as const;
export type UpcomingView = (typeof UPCOMING_VIEWS)[number];

export const SHIFT_MODES = ['none', 'auto', 'custom'] as const;
export type ShiftMode = (typeof SHIFT_MODES)[number];

// ── Model ──────────────────────────────────────────────────────────────────────

export interface TeachingPlan {
  id: string;
  facultyId: string;
  facultyName: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  departmentId: string;
  departmentName: string;
  year: number;
  semester: number;
  section: string;
  lessonSequence: number;
  weekNumber: number;
  lessonDate: Date;
  topicTitle: string;
  topicDescription: string | null;
  learningObjectives: string | null;
  estimatedDuration: number;
  materialId: string | null;
  materialTitle: string | null;
  materialDownloadUrl: string | null;
  assignmentId: string | null;
  assignmentTitle: string | null;
  assignmentDueDate: Date | null;
  homework: string | null;
  quizPlanned: boolean;
  lessonStatus: LessonStatus;
  coveragePercentage: number | null;
  remainingTopics: string | null;
  statusReason: string | null;
  autoShiftEnabled: boolean;
  isContinuation: boolean;
  parentLessonId: string | null;
  isDelayed: boolean;
  holidayConflict: HolidayConflict | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedTeachingPlans {
  teachingPlans: TeachingPlan[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CurrentLessonRef {
  id: string;
  lessonSequence: number;
  topicTitle: string;
  lessonStatus: LessonStatus;
  lessonDate: Date;
}

export interface CourseProgress {
  totalPlanned: number;
  completed: number;
  remaining: number;
  rescheduled: number;
  cancelled: number;
  completionPercentage: number;
  currentLesson: CurrentLessonRef | null;
}

export interface HolidayConflict {
  holidayId: string;
  holidayTitle: string;
  startDate: Date;
  endDate: Date | null;
}

export interface RoadmapSubject {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  facultyName: string;
  todayTopic: TeachingPlan | null;
  upcomingLessons: TeachingPlan[];
  completedLessons: TeachingPlan[];
  delayedLessons: TeachingPlan[];
  homework: TeachingPlan[];
  quizSchedule: TeachingPlan[];
  progress: CourseProgress;
}

export interface StudentRoadmap {
  subjects: RoadmapSubject[];
}

export interface TimelineWeek {
  weekNumber: number;
  lessons: TeachingPlan[];
}

export interface UpcomingLessons {
  view: UpcomingView;
  lessons: TeachingPlan[];
  weeks: TimelineWeek[];
}

// ── Date preprocessing (matches mentorship.ts convention for DATE columns) ──────

const dateField = (invalidMessage: string) =>
  z.preprocess((arg) => {
    if (typeof arg === 'string' || arg instanceof Date) return new Date(arg);
    return arg;
  }, z.date({ invalid_type_error: invalidMessage }));

// ── Zod schemas ──────────────────────────────────────────────────────────────────

export const createTeachingPlanSchema = z.object({
  subjectId: z.string().uuid('Invalid subject ID'),
  section: z.string().trim().min(1).max(10),
  lessonSequence: z.coerce.number().int().min(1, 'lessonSequence must be at least 1').optional(),
  weekNumber: z.coerce.number().int().min(1, 'weekNumber must be at least 1').max(52),
  lessonDate: dateField('Invalid lesson date'),
  topicTitle: z.string().trim().min(1, 'Topic title is required').max(255),
  topicDescription: z.string().trim().max(4000).optional(),
  learningObjectives: z.string().trim().max(2000).optional(),
  estimatedDuration: z.coerce.number().int().positive('estimatedDuration must be greater than 0').max(600).default(50),
  materialId: z.string().uuid('Invalid material ID').optional(),
  assignmentId: z.string().uuid('Invalid assignment ID').optional(),
  homework: z.string().trim().max(2000).optional(),
  quizPlanned: z.boolean().default(false),
  autoShiftEnabled: z.boolean().default(true),
});
export type CreateTeachingPlanInput = z.infer<typeof createTeachingPlanSchema>;

export const updateTeachingPlanSchema = z
  .object({
    topicTitle: z.string().trim().min(1).max(255).optional(),
    topicDescription: z.string().trim().max(4000).optional(),
    learningObjectives: z.string().trim().max(2000).optional(),
    estimatedDuration: z.coerce.number().int().positive().max(600).optional(),
    materialId: z.string().uuid('Invalid material ID').nullable().optional(),
    assignmentId: z.string().uuid('Invalid assignment ID').nullable().optional(),
    homework: z.string().trim().max(2000).nullable().optional(),
    quizPlanned: z.boolean().optional(),
    autoShiftEnabled: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });
export type UpdateTeachingPlanInput = z.infer<typeof updateTeachingPlanSchema>;

// PUT /teaching-plans/:id/status — the Lesson Progress Engine's entry point.
export const updateLessonStatusSchema = z
  .object({
    status: z.enum(SETTABLE_LESSON_STATUSES),
    coveragePercentage: z.coerce.number().int().min(0).max(100).optional(),
    remainingTopics: z.string().trim().max(2000).optional(),
    reason: z.string().trim().max(1000).optional(),
    // Partially Completed only — triggers the Auto Shift Engine.
    continueNextClass: z.boolean().optional(),
    continuationLessonDate: dateField('Invalid continuation lesson date').optional(),
    // Cancelled only — holiday "merge" resolution: folds this lesson's topic
    // into the next lesson instead of leaving a bare cancellation.
    mergeWithNextLesson: z.boolean().optional(),
  })
  .refine((data) => data.status !== 'Partially Completed' || data.coveragePercentage !== undefined, {
    message: 'coveragePercentage is required when status is "Partially Completed"',
    path: ['coveragePercentage'],
  });
export type UpdateLessonStatusInput = z.infer<typeof updateLessonStatusSchema>;

// PUT /teaching-plans/:id/reschedule
export const rescheduleTeachingPlanSchema = z
  .object({
    newDate: dateField('Invalid reschedule date'),
    reason: z.string().trim().max(1000).optional(),
    shiftRemaining: z.enum(SHIFT_MODES).default('none'),
    customShiftDays: z.coerce.number().int().optional(),
  })
  .refine((data) => data.shiftRemaining !== 'custom' || data.customShiftDays !== undefined, {
    message: 'customShiftDays is required when shiftRemaining is "custom"',
    path: ['customShiftDays'],
  });
export type RescheduleTeachingPlanInput = z.infer<typeof rescheduleTeachingPlanSchema>;

// PUT /teaching-plans/:id/continue — explicit continuation creation, also
// invoked internally when /status is called with continueNextClass: true.
export const continueLessonSchema = z.object({
  lessonDate: dateField('Invalid continuation lesson date').optional(),
  estimatedDuration: z.coerce.number().int().positive().max(600).optional(),
});
export type ContinueLessonInput = z.infer<typeof continueLessonSchema>;

export const listTeachingPlansQuerySchema = z.object({
  departmentId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
  facultyId: z.string().uuid().optional(),
  year: z.coerce.number().int().min(1).max(6).optional(),
  semester: z.coerce.number().int().min(1).max(12).optional(),
  section: z.string().trim().min(1).max(10).optional(),
  weekNumber: z.coerce.number().int().min(1).max(52).optional(),
  lessonStatus: z.enum(LESSON_STATUSES).optional(),
  from: z.string().refine((v) => !isNaN(Date.parse(v)), { message: 'from must be a valid date' }).optional(),
  to: z.string().refine((v) => !isNaN(Date.parse(v)), { message: 'to must be a valid date' }).optional(),
  hasHomework: z.enum(['true', 'false']).optional(),
  quizPlanned: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListTeachingPlansQuery = z.infer<typeof listTeachingPlansQuerySchema>;

export const courseProgressQuerySchema = z.object({
  departmentId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
  facultyId: z.string().uuid().optional(),
  section: z.string().trim().min(1).max(10).optional(),
  semester: z.coerce.number().int().min(1).max(12).optional(),
});
export type CourseProgressQuery = z.infer<typeof courseProgressQuerySchema>;

// GET /teaching-plans/today and /student-roadmap — admin/faculty may look up a
// specific student; students always resolve to themselves regardless of this.
export const studentScopedQuerySchema = z.object({
  studentId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
});
export type StudentScopedQuery = z.infer<typeof studentScopedQuerySchema>;

export const upcomingQuerySchema = z.object({
  studentId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
  view: z.enum(UPCOMING_VIEWS).default('week'),
});
export type UpcomingQuery = z.infer<typeof upcomingQuerySchema>;
