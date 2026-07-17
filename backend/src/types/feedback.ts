import { z } from 'zod';

// ── Enums ──────────────────────────────────────────────────────────────────────

export const FEEDBACK_TYPES = ['faculty', 'course', 'lms', 'erp'] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

export const QUESTION_TYPES = ['rating', 'mcq', 'text', 'boolean'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

// 'open'/'closed' are derived at read time from 'published'/'closed' + the
// start/end date window (see feedback.service.ts::deriveEffectiveStatus) —
// they still appear here because a campaign's *stored* status can be
// explicitly set to them by an admin force-close/archive action.
export const CAMPAIGN_STATUSES = ['draft', 'published', 'open', 'closed', 'archived'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

// Subject/faculty-scoped types require a faculty_subject_assignments-based
// audience; institution/department-scoped types resolve eligibility purely
// from students (no subject/faculty axis).
export const SUBJECT_SCOPED_TYPES: FeedbackType[] = ['faculty', 'course'];

// ── Campaign ──────────────────────────────────────────────────────────────────

export interface FeedbackCampaign {
  id: string;
  title: string;
  academicYear: string;
  status: CampaignStatus;
  effectiveStatus: CampaignStatus;
  templateId: string | null;
  templateTitle: string | null;
  templateType: FeedbackType | null;
  targetDepartmentIds: string[];
  targetDepartmentNames: string[];
  targetSemesters: number[];
  targetSections: string[];
  targetSubjectIds: string[];
  targetFacultyIds: string[];
  startDate: Date;
  endDate: Date;
  publishedAt: Date | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  eligibleCount?: number;
  submittedCount?: number;
}

const dateString = z.string().refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid date' });

const campaignTargetFields = {
  templateId: z.string().uuid('A feedback form template is required'),
  targetDepartmentIds: z.array(z.string().uuid()).min(1, 'At least one target department is required'),
  targetSemesters: z.array(z.number().int().min(1).max(8)).min(1, 'At least one target academic session is required'),
  targetSections: z.array(z.string().trim().max(10)).default([]),
  targetSubjectIds: z.array(z.string().uuid()).default([]),
  targetFacultyIds: z.array(z.string().uuid()).default([]),
};

export const createCampaignSchema = z
  .object({
    title: z.string().trim().min(1).max(255),
    academicYear: z.string().regex(/^\d{4}-\d{4}$/, 'academicYear must be like 2026-2027'),
    startDate: dateString,
    endDate: dateString,
    ...campaignTargetFields,
  })
  .refine((data) => new Date(data.endDate) > new Date(data.startDate), {
    message: 'Close date must be after the open date',
    path: ['endDate'],
  });
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

export const updateCampaignSchema = z
  .object({
    title: z.string().trim().min(1).max(255).optional(),
    academicYear: z.string().regex(/^\d{4}-\d{4}$/).optional(),
    startDate: dateString.optional(),
    endDate: dateString.optional(),
    templateId: z.string().uuid().optional(),
    targetDepartmentIds: z.array(z.string().uuid()).min(1).optional(),
    targetSemesters: z.array(z.number().int().min(1).max(8)).min(1).optional(),
    targetSections: z.array(z.string().trim().max(10)).optional(),
    targetSubjectIds: z.array(z.string().uuid()).optional(),
    targetFacultyIds: z.array(z.string().uuid()).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided for update' });
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;

export const previewEligibilitySchema = z.object({
  templateId: campaignTargetFields.templateId,
  targetDepartmentIds: campaignTargetFields.targetDepartmentIds,
  targetSemesters: campaignTargetFields.targetSemesters,
  targetSections: campaignTargetFields.targetSections,
  targetSubjectIds: campaignTargetFields.targetSubjectIds,
  targetFacultyIds: campaignTargetFields.targetFacultyIds,
  excludeCampaignId: z.string().uuid().optional(),
  startDate: dateString.optional(),
  endDate: dateString.optional(),
});
export type PreviewEligibilityInput = z.infer<typeof previewEligibilitySchema>;

export const listCampaignsQuerySchema = z.object({
  status: z.enum(CAMPAIGN_STATUSES).optional(),
  departmentId: z.string().uuid().optional(),
});
export type ListCampaignsQuery = z.infer<typeof listCampaignsQuerySchema>;

// ── Eligibility ───────────────────────────────────────────────────────────────

/** One row per (student, subject, faculty) obligation — subject/faculty are
 * null for institution/department-scoped (lms/erp) campaigns. */
export interface EligibilityEntry {
  studentId: string;
  subjectId: string | null;
  facultyId: string | null;
}

export interface StudentCampaignItem {
  subjectId: string | null;
  subjectCode: string | null;
  facultyId: string | null;
  facultyName: string | null;
  submitted: boolean;
}

export interface StudentCampaignView {
  campaignId: string;
  title: string;
  templateId: string;
  templateType: FeedbackType;
  status: CampaignStatus;
  startDate: Date;
  endDate: Date;
  items: StudentCampaignItem[];
  completed: boolean;
}

// ── Conflict / Validation Engine ─────────────────────────────────────────────

export const CAMPAIGN_CONFLICT_TYPES = [
  'no_eligible_students',
  'invalid_academic_session',
  'duplicate_campaign',
  'overlapping_audience',
] as const;
export type CampaignConflictType = (typeof CAMPAIGN_CONFLICT_TYPES)[number];

export interface CampaignConflict {
  type: CampaignConflictType;
  severity: 'warning' | 'error';
  message: string;
  context?: Record<string, unknown>;
}

export interface CampaignConflictCheckResult {
  hasBlockingConflicts: boolean;
  conflicts: CampaignConflict[];
  eligibleCount: number;
}

// ── Templates & Questions ────────────────────────────────────────────────────

export interface FeedbackTemplate {
  id: string;
  title: string;
  type: FeedbackType;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  questions?: FeedbackQuestion[];
}

export interface FeedbackQuestion {
  id: string;
  templateId: string;
  text: string;
  type: QuestionType;
  options: string[] | null;
  orderIndex: number;
  isRequired: boolean;
}

export const createTemplateSchema = z.object({
  title: z.string().trim().min(1).max(255),
  type: z.enum(FEEDBACK_TYPES),
});
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;

export const updateTemplateSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  type: z.enum(FEEDBACK_TYPES).optional(),
  isActive: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided for update' });
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;

export const createQuestionSchema = z.object({
  templateId: z.string().uuid(),
  text: z.string().trim().min(1).max(1000),
  type: z.enum(QUESTION_TYPES),
  options: z.array(z.string().trim().min(1)).optional().nullable(),
  orderIndex: z.number().int().min(0).default(0),
  isRequired: z.boolean().default(true),
});
export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;

export const updateQuestionSchema = z.object({
  text: z.string().trim().min(1).max(1000).optional(),
  type: z.enum(QUESTION_TYPES).optional(),
  options: z.array(z.string().trim().min(1)).optional().nullable(),
  orderIndex: z.number().int().min(0).optional(),
  isRequired: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided for update' });
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;

// ── Submission ────────────────────────────────────────────────────────────────

export const submitFeedbackSchema = z.object({
  campaignId: z.string().uuid(),
  subjectId: z.string().uuid().optional(),
  facultyId: z.string().uuid().optional(),
  answers: z.array(z.object({
    questionId: z.string().uuid(),
    ratingValue: z.number().int().min(1).max(5).optional(),
    textValue: z.string().max(2000).optional(),
  })).min(1, 'At least one answer is required'),
});
export type SubmitFeedbackInput = z.infer<typeof submitFeedbackSchema>;

// ── Analytics ─────────────────────────────────────────────────────────────────

export interface CampaignAnalyticsSummary {
  eligibleStudents: number;
  submittedCount: number;
  pendingCount: number;
  completionPercent: number;
}

export interface CampaignQuestionAnalytics {
  questionId: string;
  questionText: string;
  questionType: QuestionType;
  totalResponses: number;
  averageRating: number | null;
  mcqDistribution?: Record<string, number>;
  textComments?: string[];
}

export interface CampaignAnalytics {
  summary: CampaignAnalyticsSummary;
  questions: CampaignQuestionAnalytics[];
}

export const analyticsQuerySchema = z.object({
  campaignId: z.string().uuid(),
  departmentId: z.string().uuid().optional(),
  facultyId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
});
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
