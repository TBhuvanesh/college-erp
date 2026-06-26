import { apiFetch } from "@/lib/api";

// Enums
export type LmsFileType = "pdf" | "ppt" | "pptx" | "doc" | "docx";
export type SubmissionStatus = "Submitted" | "Late Submission" | "Evaluated";

// Interfaces
export interface CourseMaterial {
  id: string;
  title: string;
  description: string | null;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  facultyId: string;
  facultyName: string;
  fileName: string;
  fileType: LmsFileType;
  fileSize: number;
  downloadUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedMaterials {
  materials: CourseMaterial[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Assignment {
  id: string;
  title: string;
  description: string | null;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  facultyId: string;
  facultyName: string;
  dueDate: string;
  maxMarks: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedAssignments {
  assignments: Assignment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Submission {
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  assignmentDueDate: string;
  assignmentMaxMarks: number;
  studentId: string;
  studentRollNumber: string;
  studentName: string;
  fileName: string;
  fileSize: number;
  downloadUrl: string;
  status: SubmissionStatus;
  marks: number | null;
  feedback: string | null;
  submittedAt: string;
  updatedAt: string;
}

export interface PaginatedSubmissions {
  submissions: Submission[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ── Materials API ────────────────────────────────────────────────────────────

export async function listMaterials(
  filters: { subjectId?: string; page?: number; limit?: number },
  token: string
): Promise<PaginatedMaterials> {
  const query = new URLSearchParams();
  if (filters.subjectId) query.append("subjectId", filters.subjectId);
  if (filters.page) query.append("page", filters.page.toString());
  if (filters.limit) query.append("limit", filters.limit.toString());

  return apiFetch<PaginatedMaterials>(`/lms/materials?${query.toString()}`, {}, token);
}

export async function createMaterial(
  formData: FormData,
  token: string
): Promise<CourseMaterial> {
  // apiFetch will auto-handle multi-part headers since options.body is a FormData
  const res = await apiFetch<{ material: CourseMaterial }>(
    "/lms/materials",
    {
      method: "POST",
      body: formData,
    },
    token
  );
  return res.material;
}

export async function updateMaterial(
  id: string,
  formData: FormData,
  token: string
): Promise<CourseMaterial> {
  const res = await apiFetch<{ material: CourseMaterial }>(
    `/lms/materials/${id}`,
    {
      method: "PUT",
      body: formData,
    },
    token
  );
  return res.material;
}

export async function deleteMaterial(id: string, token: string): Promise<void> {
  await apiFetch(`/lms/materials/${id}`, { method: "DELETE" }, token);
}

// ── Assignments API ──────────────────────────────────────────────────────────

export async function listAssignments(
  filters: { subjectId?: string; page?: number; limit?: number },
  token: string
): Promise<PaginatedAssignments> {
  const query = new URLSearchParams();
  if (filters.subjectId) query.append("subjectId", filters.subjectId);
  if (filters.page) query.append("page", filters.page.toString());
  if (filters.limit) query.append("limit", filters.limit.toString());

  return apiFetch<PaginatedAssignments>(`/lms/assignments?${query.toString()}`, {}, token);
}

export async function getAssignment(id: string, token: string): Promise<Assignment> {
  const res = await apiFetch<{ assignment: Assignment }>(`/lms/assignments/${id}`, {}, token);
  return res.assignment;
}

export async function createAssignment(
  data: { title: string; description?: string; subjectId: string; dueDate: string; maxMarks: number },
  token: string
): Promise<Assignment> {
  const res = await apiFetch<{ assignment: Assignment }>(
    "/lms/assignments",
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    token
  );
  return res.assignment;
}

export async function updateAssignment(
  id: string,
  data: { title?: string; description?: string; dueDate?: string; maxMarks?: number },
  token: string
): Promise<Assignment> {
  const res = await apiFetch<{ assignment: Assignment }>(
    `/lms/assignments/${id}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    },
    token
  );
  return res.assignment;
}

export async function deleteAssignment(id: string, token: string): Promise<void> {
  await apiFetch(`/lms/assignments/${id}`, { method: "DELETE" }, token);
}

// ── Submissions API ──────────────────────────────────────────────────────────

export async function listSubmissions(
  filters: { assignmentId?: string; studentId?: string; status?: SubmissionStatus; page?: number; limit?: number },
  token: string
): Promise<PaginatedSubmissions> {
  const query = new URLSearchParams();
  if (filters.assignmentId) query.append("assignmentId", filters.assignmentId);
  if (filters.studentId) query.append("studentId", filters.studentId);
  if (filters.status) query.append("status", filters.status);
  if (filters.page) query.append("page", filters.page.toString());
  if (filters.limit) query.append("limit", filters.limit.toString());

  return apiFetch<PaginatedSubmissions>(`/lms/submissions?${query.toString()}`, {}, token);
}

export async function getSubmission(id: string, token: string): Promise<Submission> {
  const res = await apiFetch<{ submission: Submission }>(`/lms/submissions/${id}`, {}, token);
  return res.submission;
}

export async function submitAssignment(
  formData: FormData,
  token: string
): Promise<Submission> {
  const res = await apiFetch<{ submission: Submission }>(
    "/lms/submissions",
    {
      method: "POST",
      body: formData,
    },
    token
  );
  return res.submission;
}

export async function gradeSubmission(
  id: string,
  data: { marks: number; feedback?: string },
  token: string
): Promise<Submission> {
  const res = await apiFetch<{ submission: Submission }>(
    `/lms/submissions/${id}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    },
    token
  );
  return res.submission;
}

// Helper to download files with Authorization header
export async function downloadLmsFile(
  downloadUrl: string,
  fileName: string,
  token: string
): Promise<void> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001/api";
  
  // Normalize downloadUrl because of a backend service mapper bug returning /api/materials instead of /api/lms/materials
  let normalizedUrl = downloadUrl;
  if (downloadUrl.startsWith("/api/materials")) {
    normalizedUrl = downloadUrl.replace("/api/materials", "/lms/materials");
  } else if (downloadUrl.startsWith("/api/lms")) {
    normalizedUrl = downloadUrl.replace("/api/lms", "/lms");
  } else if (!downloadUrl.startsWith("/lms")) {
    normalizedUrl = `/lms${downloadUrl}`;
  }

  const res = await fetch(`${API_URL}${normalizedUrl}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error("Failed to download file from server");
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
