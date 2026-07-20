import { apiFetch } from "@/lib/api";

interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
}

// ── Enums ────────────────────────────────────────────────────────────────────

export const FEEDBACK_TYPES = ["faculty", "course", "lms", "erp"] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

export const QUESTION_TYPES = ["rating", "mcq", "text", "boolean"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const CAMPAIGN_STATUSES = ["draft", "published", "open", "closed", "archived"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const SUBJECT_SCOPED_TYPES: FeedbackType[] = ["faculty", "course"];

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
  startDate: string;
  endDate: string;
  publishedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCampaignInput {
  title: string;
  academicYear: string;
  templateId: string;
  targetDepartmentIds: string[];
  targetSemesters: number[];
  targetSections: string[];
  targetSubjectIds: string[];
  targetFacultyIds: string[];
  startDate: string;
  endDate: string;
}

export type UpdateCampaignInput = Partial<CreateCampaignInput>;

export interface CampaignConflict {
  type: "no_eligible_students" | "invalid_academic_session" | "duplicate_campaign" | "overlapping_audience";
  severity: "warning" | "error";
  message: string;
  context?: Record<string, unknown>;
}

export interface CampaignConflictCheckResult {
  hasBlockingConflicts: boolean;
  conflicts: CampaignConflict[];
  eligibleCount: number;
}

export async function listCampaigns(
  filters: { status?: CampaignStatus; departmentId?: string } = {},
  token: string
): Promise<FeedbackCampaign[]> {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined) query.append(k, String(v));
  });
  const qs = query.toString();
  const res = await apiFetch<ApiSuccess<FeedbackCampaign[]>>(`/feedback/campaigns${qs ? `?${qs}` : ""}`, {}, token);
  return res.data;
}

export async function getCampaign(id: string, token: string): Promise<FeedbackCampaign> {
  const res = await apiFetch<ApiSuccess<FeedbackCampaign>>(`/feedback/campaigns/${id}`, {}, token);
  return res.data;
}

export async function createCampaign(data: CreateCampaignInput, token: string): Promise<FeedbackCampaign> {
  const res = await apiFetch<ApiSuccess<FeedbackCampaign>>("/feedback/campaigns", { method: "POST", body: JSON.stringify(data) }, token);
  return res.data;
}

export async function updateCampaign(id: string, data: UpdateCampaignInput, token: string): Promise<FeedbackCampaign> {
  const res = await apiFetch<ApiSuccess<FeedbackCampaign>>(`/feedback/campaigns/${id}`, { method: "PUT", body: JSON.stringify(data) }, token);
  return res.data;
}

export async function previewEligibility(
  data: {
    templateId: string;
    targetDepartmentIds: string[];
    targetSemesters: number[];
    targetSections: string[];
    targetSubjectIds: string[];
    targetFacultyIds: string[];
    startDate?: string;
    endDate?: string;
    excludeCampaignId?: string;
  },
  token: string
): Promise<{ eligibleCount: number; conflicts: CampaignConflict[]; hasBlockingConflicts: boolean }> {
  const res = await apiFetch<ApiSuccess<{ eligibleCount: number; conflicts: CampaignConflict[]; hasBlockingConflicts: boolean }>>(
    "/feedback/campaigns/preview-eligibility",
    { method: "POST", body: JSON.stringify(data) },
    token
  );
  return res.data;
}

export async function publishCampaign(id: string, token: string): Promise<FeedbackCampaign> {
  const res = await apiFetch<ApiSuccess<FeedbackCampaign>>(`/feedback/campaigns/${id}/publish`, { method: "POST" }, token);
  return res.data;
}

export async function closeCampaign(id: string, token: string): Promise<FeedbackCampaign> {
  const res = await apiFetch<ApiSuccess<FeedbackCampaign>>(`/feedback/campaigns/${id}/close`, { method: "POST" }, token);
  return res.data;
}

export async function archiveCampaign(id: string, token: string): Promise<FeedbackCampaign> {
  const res = await apiFetch<ApiSuccess<FeedbackCampaign>>(`/feedback/campaigns/${id}/archive`, { method: "POST" }, token);
  return res.data;
}

// ── Student-facing eligibility view ──────────────────────────────────────────

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
  startDate: string;
  endDate: string;
  items: StudentCampaignItem[];
  completed: boolean;
}

export async function getMyCampaigns(token: string): Promise<StudentCampaignView[]> {
  const res = await apiFetch<ApiSuccess<StudentCampaignView[]>>("/feedback/my-campaigns", {}, token);
  return res.data;
}

export interface SubmitFeedbackInput {
  campaignId: string;
  subjectId?: string;
  facultyId?: string;
  answers: Array<{ questionId: string; ratingValue?: number; textValue?: string }>;
}

export async function submitFeedback(data: SubmitFeedbackInput, token: string): Promise<void> {
  await apiFetch("/feedback/submit", { method: "POST", body: JSON.stringify(data) }, token);
}

export async function getMySubmissions(campaignId: string, token: string): Promise<Array<{ subjectId: string | null; feedbackType: string }>> {
  const res = await apiFetch<ApiSuccess<Array<{ subjectId: string | null; feedbackType: string }>>>(
    `/feedback/my-submissions?campaignId=${campaignId}`,
    {},
    token
  );
  return res.data;
}

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

export async function getCampaignAnalytics(
  campaignId: string,
  filters: { departmentId?: string; facultyId?: string; subjectId?: string } = {},
  token?: string
): Promise<CampaignAnalytics> {
  const query = new URLSearchParams({ campaignId });
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined) query.append(k, String(v));
  });
  const res = await apiFetch<ApiSuccess<CampaignAnalytics>>(`/feedback/analytics?${query}`, {}, token);
  return res.data;
}

// ── Templates & Questions ────────────────────────────────────────────────────

export interface FeedbackQuestion {
  id: string;
  templateId: string;
  text: string;
  type: QuestionType;
  options: string[] | null;
  orderIndex: number;
  isRequired: boolean;
}

export interface FeedbackTemplate {
  id: string;
  title: string;
  type: FeedbackType;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  questions: FeedbackQuestion[];
}

export async function getTemplates(token: string, type?: FeedbackType): Promise<FeedbackTemplate[]> {
  const res = await apiFetch<ApiSuccess<FeedbackTemplate[]>>(`/feedback/templates${type ? `?type=${type}` : ""}`, {}, token);
  return res.data;
}

export async function createTemplate(data: { title: string; type: FeedbackType }, token: string): Promise<FeedbackTemplate> {
  const res = await apiFetch<ApiSuccess<FeedbackTemplate>>("/feedback/templates", { method: "POST", body: JSON.stringify(data) }, token);
  return res.data;
}

export async function updateTemplate(
  id: string,
  data: { title?: string; type?: FeedbackType; isActive?: boolean },
  token: string
): Promise<FeedbackTemplate> {
  const res = await apiFetch<ApiSuccess<FeedbackTemplate>>(`/feedback/templates/${id}`, { method: "PUT", body: JSON.stringify(data) }, token);
  return res.data;
}

export async function createQuestion(
  data: { templateId: string; text: string; type: QuestionType; options?: string[] | null; orderIndex: number; isRequired: boolean },
  token: string
): Promise<FeedbackQuestion> {
  const res = await apiFetch<ApiSuccess<FeedbackQuestion>>("/feedback/questions", { method: "POST", body: JSON.stringify(data) }, token);
  return res.data;
}

export async function updateQuestion(
  id: string,
  data: { text?: string; type?: QuestionType; options?: string[] | null; orderIndex?: number; isRequired?: boolean },
  token: string
): Promise<FeedbackQuestion> {
  const res = await apiFetch<ApiSuccess<FeedbackQuestion>>(`/feedback/questions/${id}`, { method: "PUT", body: JSON.stringify(data) }, token);
  return res.data;
}

export async function deleteQuestion(id: string, token: string): Promise<void> {
  await apiFetch(`/feedback/questions/${id}`, { method: "DELETE" }, token);
}

// ── Display helpers ───────────────────────────────────────────────────────────

export function statusBadgeClasses(status: CampaignStatus): string {
  switch (status) {
    case "draft":
      return "text-text-muted bg-neutral-100 border-border-subtle dark:bg-neutral-800";
    case "published":
      return "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/20";
    case "open":
      return "text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-500/10 dark:border-blue-500/20";
    case "closed":
      return "text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/20";
    case "archived":
      return "text-text-muted bg-neutral-100 border-border-subtle dark:bg-neutral-800";
    default:
      return "text-text-muted bg-neutral-100 border-border-subtle dark:bg-neutral-800";
  }
}
