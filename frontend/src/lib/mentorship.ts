import { apiFetch } from "@/lib/api";

interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
}

// ── Academic Session — the single derived replacement for independent
// Year/Semester dropdowns (mirrors backend types/mentorGroup.ts exactly). ────

export interface AcademicSession {
  label: string; // "1-1".."4-2"
  year: number;
  semester: number;
}

export const ACADEMIC_SESSIONS: AcademicSession[] = [1, 2, 3, 4, 5, 6, 7, 8].map((semester) => ({
  label: `${Math.ceil(semester / 2)}-${semester % 2 === 0 ? 2 : 1}`,
  year: Math.ceil(semester / 2),
  semester,
}));

export function sessionLabelForSemester(semester: number): string {
  return ACADEMIC_SESSIONS.find((s) => s.semester === semester)?.label ?? `${Math.ceil(semester / 2)}-${semester % 2 === 0 ? 2 : 1}`;
}

// ── Mentor Groups ─────────────────────────────────────────────────────────────

export const ASSIGNMENT_METHODS = ["range", "section", "manual"] as const;
export type AssignmentMethod = (typeof ASSIGNMENT_METHODS)[number];

export interface MentorGroup {
  id: string;
  mentorId: string;
  mentorName?: string;
  departmentId: string;
  departmentName?: string;
  year: number;
  semester: number;
  academicSession: string;
  section: string;
  assignmentMethod: AssignmentMethod;
  rollNumberStart: string | null;
  rollNumberEnd: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  studentCount?: number;
}

export interface ResolvedStudent {
  id: string;
  name: string;
  rollNumber: string;
  department: string;
  semester: number;
  year: number;
  phoneNumber: string | null;
  parentContact: string | null;
  email: string;
}

export interface CreateMentorGroupInput {
  mentorId: string;
  departmentId: string;
  semester: number;
  section: string;
  assignmentMethod: AssignmentMethod;
  rollNumberStart?: string | null;
  rollNumberEnd?: string | null;
  studentIds?: string[];
}
export type UpdateMentorGroupInput = Partial<CreateMentorGroupInput>;

export async function listMentorGroups(
  filters: { mentorId?: string; departmentId?: string; semester?: number; section?: string; assignmentMethod?: string } = {},
  token: string
): Promise<MentorGroup[]> {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined) query.append(k, String(v));
  });
  const res = await apiFetch<ApiSuccess<MentorGroup[]>>(`/mentor-groups?${query}`, {}, token);
  return res.data;
}

export async function getGroupStudents(groupId: string, token: string): Promise<ResolvedStudent[]> {
  const res = await apiFetch<ApiSuccess<ResolvedStudent[]>>(`/mentor-groups/${groupId}/students`, {}, token);
  return res.data;
}

export async function createMentorGroup(data: CreateMentorGroupInput, token: string): Promise<MentorGroup> {
  const res = await apiFetch<ApiSuccess<MentorGroup>>("/mentor-groups", { method: "POST", body: JSON.stringify(data) }, token);
  return res.data;
}

export async function updateMentorGroup(id: string, data: UpdateMentorGroupInput, token: string): Promise<MentorGroup> {
  const res = await apiFetch<ApiSuccess<MentorGroup>>(`/mentor-groups/${id}`, { method: "PUT", body: JSON.stringify(data) }, token);
  return res.data;
}

export async function deleteMentorGroup(id: string, token: string): Promise<void> {
  await apiFetch(`/mentor-groups/${id}`, { method: "DELETE" }, token);
}

// ── Conflict / Capacity Engine ───────────────────────────────────────────────

export const MENTOR_GROUP_CONFLICT_TYPES = [
  "invalid_academic_session",
  "empty_group",
  "invalid_roll_range",
  "capacity_exceeded",
  "duplicate_student",
  "duplicate_mentor_assignment",
] as const;
export type MentorGroupConflictType = (typeof MENTOR_GROUP_CONFLICT_TYPES)[number];

export interface MentorGroupConflict {
  type: MentorGroupConflictType;
  severity: "warning" | "error";
  message: string;
  context?: Record<string, unknown>;
}

export interface MentorGroupConflictCheckResult {
  hasBlockingConflicts: boolean;
  conflicts: MentorGroupConflict[];
  resolvedCount: number;
}

export async function checkMentorGroupConflicts(
  data: CreateMentorGroupInput & { excludeGroupId?: string },
  token: string
): Promise<MentorGroupConflictCheckResult> {
  const res = await apiFetch<ApiSuccess<MentorGroupConflictCheckResult>>(
    "/mentor-groups/check-conflicts",
    { method: "POST", body: JSON.stringify(data) },
    token
  );
  return res.data;
}

// ── Auto Suggestion Engine ───────────────────────────────────────────────────

export interface BalancedGroupProposal {
  rollNumberStart: string;
  rollNumberEnd: string;
  studentCount: number;
  studentIds: string[];
}

export interface BalancedGroupsResult {
  section: string;
  totalStudents: number;
  targetSize: number;
  proposals: BalancedGroupProposal[];
}

export async function suggestBalancedGroups(
  filters: { departmentId: string; semester: number; section: string; targetSize?: number },
  token: string
): Promise<BalancedGroupsResult> {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined) query.append(k, String(v));
  });
  const res = await apiFetch<ApiSuccess<BalancedGroupsResult>>(`/mentor-groups/suggest?${query}`, {}, token);
  return res.data;
}

// ── Mentor (faculty) synchronization — capacity-aware candidates ────────────

export interface MentorCandidate {
  facultyId: string;
  facultyName: string;
  employeeNumber: string;
  departmentId: string;
  departmentName: string;
  isMentoringHead: boolean;
  status: string;
  currentGroups: number;
  currentStudents: number;
  availableCapacity: number;
  overLimit: boolean;
}

export async function listMentorCandidates(departmentId: string, token: string): Promise<MentorCandidate[]> {
  const res = await apiFetch<ApiSuccess<MentorCandidate[]>>(`/mentor-groups/candidates?departmentId=${departmentId}`, {}, token);
  return res.data;
}

// ── Split / Merge ─────────────────────────────────────────────────────────────

export async function splitMentorGroup(
  groupId: string,
  data: { splitAtRollNumber: string; newMentorId: string },
  token: string
): Promise<{ original: MentorGroup; created: MentorGroup }> {
  const res = await apiFetch<ApiSuccess<{ original: MentorGroup; created: MentorGroup }>>(
    `/mentor-groups/${groupId}/split`,
    { method: "POST", body: JSON.stringify(data) },
    token
  );
  return res.data;
}

export async function mergeMentorGroups(groupIdA: string, groupIdB: string, token: string): Promise<MentorGroup> {
  const res = await apiFetch<ApiSuccess<MentorGroup>>("/mentor-groups/merge", { method: "POST", body: JSON.stringify({ groupIdA, groupIdB }) }, token);
  return res.data;
}

// ── Mentorship Settings (global) ─────────────────────────────────────────────

export interface MentorshipSettings {
  id: string;
  recommendedStudentsPerMentor: number;
  maximumStudents: number;
  allowCrossDepartment: boolean;
  updatedBy: string | null;
  updatedAt: string;
}

export async function getMentorshipSettings(token: string): Promise<MentorshipSettings> {
  const res = await apiFetch<ApiSuccess<{ settings: MentorshipSettings }>>("/mentorship-settings", {}, token);
  return res.data.settings;
}

export async function updateMentorshipSettings(
  data: Partial<Pick<MentorshipSettings, "recommendedStudentsPerMentor" | "maximumStudents" | "allowCrossDepartment">>,
  token: string
): Promise<MentorshipSettings> {
  const res = await apiFetch<ApiSuccess<{ settings: MentorshipSettings }>>("/mentorship-settings", { method: "PUT", body: JSON.stringify(data) }, token);
  return res.data.settings;
}

// ── Student sections (Section Synchronization) ───────────────────────────────

export async function listDistinctSections(departmentId: string, semester: number, token: string): Promise<string[]> {
  const res = await apiFetch<ApiSuccess<{ sections: string[] }>>(`/students/sections?departmentId=${departmentId}&semester=${semester}`, {}, token);
  return res.data.sections;
}

// ── Legacy mentorship endpoints (individual assignment, notes, dashboards) ──
// Kept under the same client for a single import surface; response shapes are
// unchanged from before this refactor (backward compatible).

export interface MentorWorkload {
  mentorId: string;
  mentorName: string;
  employeeNumber: string;
  departmentName: string;
  isMentoringHead: boolean;
  activeMenteesCount: number;
}

export async function getMentorWorkloads(token: string): Promise<MentorWorkload[]> {
  const res = await apiFetch<ApiSuccess<MentorWorkload[]>>("/mentorship/workloads", {}, token);
  return res.data;
}

export interface MentorshipReport {
  summary: { totalStudents: number; assignedStudents: number; unassignedStudents: number };
  relationships: Array<{
    studentId: string;
    studentName: string;
    rollNumber: string;
    departmentName: string;
    semester: number;
    mentorName: string | null;
    mentorId: string | null;
  }>;
}

export async function getMentorshipReports(token: string): Promise<MentorshipReport> {
  const res = await apiFetch<ApiSuccess<MentorshipReport>>("/mentorship/reports", {}, token);
  return res.data;
}

export interface MenteeDashboardRow {
  profile: {
    id: string;
    name: string;
    rollNumber: string;
    department: string;
    semester: number;
    year: number;
    phoneNumber: string | null;
    parentContact: string | null;
    email: string;
  };
  summary: {
    attendancePercentage: number;
    latestCGPA: number;
    internalMarksSummary: string;
    feeStatus: string;
    assignmentStatus: string;
  };
  alerts: {
    attendanceBelow75: boolean;
    feePending: boolean;
    assignmentOverdue: boolean;
    failedSubjects: boolean;
    lowInternalMarks: boolean;
  };
}

export async function getMentorDashboard(token: string): Promise<MenteeDashboardRow[]> {
  const res = await apiFetch<ApiSuccess<MenteeDashboardRow[]>>("/mentorship/dashboard", {}, token);
  return res.data;
}

export interface MentorDetails {
  assignmentId: string;
  assignedDate: string;
  status: string;
  mentorId: string;
  mentorName: string;
  employeeNumber: string;
  departmentName: string;
  mentorEmail: string;
}

export async function getMentorByStudent(studentId: string, token: string): Promise<MentorDetails | null> {
  const res = await apiFetch<ApiSuccess<MentorDetails | null>>(`/mentorship/student/${studentId}`, {}, token);
  return res.data;
}

export interface MentoringNote {
  id: string;
  mentorId: string;
  studentId: string;
  title: string;
  remarks: string;
  meetingDate: string;
  followUpDate: string | null;
  createdAt: string;
}

export async function getNotesByStudent(studentId: string, token: string): Promise<MentoringNote[]> {
  const res = await apiFetch<ApiSuccess<MentoringNote[]>>(`/mentorship/notes/student/${studentId}`, {}, token);
  return res.data;
}

export async function addNote(
  data: { studentId: string; title: string; remarks: string; meetingDate: string; followUpDate?: string | null },
  token: string
): Promise<MentoringNote> {
  const res = await apiFetch<ApiSuccess<MentoringNote>>("/mentorship/notes", { method: "POST", body: JSON.stringify(data) }, token);
  return res.data;
}

export async function updateNote(
  id: string,
  data: { title?: string; remarks?: string; meetingDate?: string; followUpDate?: string | null },
  token: string
): Promise<MentoringNote> {
  const res = await apiFetch<ApiSuccess<MentoringNote>>(`/mentorship/notes/${id}`, { method: "PUT", body: JSON.stringify(data) }, token);
  return res.data;
}

export async function deleteNote(id: string, token: string): Promise<void> {
  await apiFetch(`/mentorship/notes/${id}`, { method: "DELETE" }, token);
}
