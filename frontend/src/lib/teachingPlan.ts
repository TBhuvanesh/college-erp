import { apiFetch } from "@/lib/api";

export type CompletionStatus = "Planned" | "Completed" | "Rescheduled" | "Cancelled";

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
  weekNumber: number;
  lessonDate: string;
  topicTitle: string;
  topicDescription: string | null;
  learningObjectives: string | null;
  materialId: string | null;
  materialTitle: string | null;
  materialDownloadUrl: string | null;
  assignmentId: string | null;
  assignmentTitle: string | null;
  assignmentDueDate: string | null;
  homework: string | null;
  quizPlanned: boolean;
  completionStatus: CompletionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedTeachingPlans {
  teachingPlans: TeachingPlan[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CourseProgress {
  totalPlanned: number;
  completed: number;
  remaining: number;
  rescheduled: number;
  cancelled: number;
  completionPercentage: number;
}

export interface CreateTeachingPlanInput {
  subjectId: string;
  section: string;
  weekNumber: number;
  lessonDate: string;
  topicTitle: string;
  topicDescription?: string;
  learningObjectives?: string;
  materialId?: string;
  assignmentId?: string;
  homework?: string;
  quizPlanned?: boolean;
}

export interface UpdateTeachingPlanInput {
  weekNumber?: number;
  topicTitle?: string;
  topicDescription?: string;
  learningObjectives?: string;
  materialId?: string | null;
  assignmentId?: string | null;
  homework?: string | null;
  quizPlanned?: boolean;
  completionStatus?: "Cancelled";
}

export interface RescheduleTeachingPlanInput {
  newDate: string;
  reason?: string;
}

export interface ListTeachingPlansFilters {
  departmentId?: string;
  subjectId?: string;
  facultyId?: string;
  year?: number;
  semester?: number;
  section?: string;
  weekNumber?: number;
  completionStatus?: CompletionStatus;
  from?: string;
  to?: string;
  hasHomework?: "true" | "false";
  quizPlanned?: "true" | "false";
  page?: number;
  limit?: number;
}

interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
}

export async function listTeachingPlans(
  filters: ListTeachingPlansFilters,
  token: string
): Promise<PaginatedTeachingPlans> {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== "") {
      query.append(key, val.toString());
    }
  });

  const res = await apiFetch<ApiSuccess<PaginatedTeachingPlans>>(
    `/teaching-plans?${query.toString()}`,
    {},
    token
  );
  return res.data;
}

export async function getCourseProgress(
  filters: {
    departmentId?: string;
    subjectId?: string;
    facultyId?: string;
    section?: string;
    semester?: number;
  },
  token: string
): Promise<CourseProgress> {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== "") {
      query.append(key, val.toString());
    }
  });

  const res = await apiFetch<ApiSuccess<CourseProgress>>(
    `/teaching-plans/progress?${query.toString()}`,
    {},
    token
  );
  return res.data;
}

export async function getTeachingPlan(id: string, token: string): Promise<TeachingPlan> {
  const res = await apiFetch<ApiSuccess<TeachingPlan>>(`/teaching-plans/${id}`, {}, token);
  return res.data;
}

export async function createTeachingPlan(
  data: CreateTeachingPlanInput,
  token: string
): Promise<TeachingPlan> {
  const res = await apiFetch<ApiSuccess<TeachingPlan>>(
    "/teaching-plans",
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    token
  );
  return res.data;
}

export async function updateTeachingPlan(
  id: string,
  data: UpdateTeachingPlanInput,
  token: string
): Promise<TeachingPlan> {
  const res = await apiFetch<ApiSuccess<TeachingPlan>>(
    `/teaching-plans/${id}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    },
    token
  );
  return res.data;
}

export async function deleteTeachingPlan(id: string, token: string): Promise<void> {
  await apiFetch(`/teaching-plans/${id}`, { method: "DELETE" }, token);
}

export async function completeTeachingPlan(id: string, token: string): Promise<TeachingPlan> {
  const res = await apiFetch<ApiSuccess<TeachingPlan>>(
    `/teaching-plans/${id}/complete`,
    { method: "PUT" },
    token
  );
  return res.data;
}

export async function rescheduleTeachingPlan(
  id: string,
  data: RescheduleTeachingPlanInput,
  token: string
): Promise<TeachingPlan> {
  const res = await apiFetch<ApiSuccess<TeachingPlan>>(
    `/teaching-plans/${id}/reschedule`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    },
    token
  );
  return res.data;
}
