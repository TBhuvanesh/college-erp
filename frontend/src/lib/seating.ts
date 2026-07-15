import { apiFetch } from "@/lib/api";

interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
}

// ── Enums ────────────────────────────────────────────────────────────────────

export type BenchType = "single" | "double" | "triple";
export type SeatPosition = "Left" | "Middle" | "Right";
export type SeatingPatternType = "mid" | "semester" | "random" | "custom";
export type ExamSessionStatus = "draft" | "generated" | "published" | "archived";
export type InvigilationStatus = "Assigned" | "Completed" | "Cancelled";
export type ConflictType =
  | "duplicate_student"
  | "duplicate_invigilator"
  | "capacity_exceeded"
  | "unavailable_room"
  | "empty_classroom";

export const DEPARTMENT_COLOR_PALETTE = [
  "violet", "green", "orange", "red", "blue", "amber", "rose", "cyan", "indigo", "teal", "pink", "lime",
] as const;

const DEPT_COLOR_CLASS_MAP: Record<string, string> = {
  violet: "text-violet-700 bg-violet-50 border-violet-200 dark:text-violet-400 dark:bg-violet-500/10 dark:border-violet-500/20",
  green: "text-green-700 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-500/10 dark:border-green-500/20",
  orange: "text-orange-700 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-500/10 dark:border-orange-500/20",
  red: "text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-500/10 dark:border-red-500/20",
  blue: "text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-500/10 dark:border-blue-500/20",
  amber: "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/20",
  rose: "text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-500/10 dark:border-rose-500/20",
  cyan: "text-cyan-700 bg-cyan-50 border-cyan-200 dark:text-cyan-400 dark:bg-cyan-500/10 dark:border-cyan-500/20",
  indigo: "text-indigo-700 bg-indigo-50 border-indigo-200 dark:text-indigo-400 dark:bg-indigo-500/10 dark:border-indigo-500/20",
  teal: "text-teal-700 bg-teal-50 border-teal-200 dark:text-teal-400 dark:bg-teal-500/10 dark:border-teal-500/20",
  pink: "text-pink-700 bg-pink-50 border-pink-200 dark:text-pink-400 dark:bg-pink-500/10 dark:border-pink-500/20",
  lime: "text-lime-700 bg-lime-50 border-lime-200 dark:text-lime-400 dark:bg-lime-500/10 dark:border-lime-500/20",
};

export function departmentColorClasses(color: string | null): string {
  return DEPT_COLOR_CLASS_MAP[color ?? ""] ?? "text-text-secondary bg-neutral-100 border-border-subtle dark:bg-neutral-800";
}

// ── Exam Rooms (Classroom Management) ───────────────────────────────────────

export interface ExamRoom {
  id: string;
  name: string;
  building: string | null;
  floor: string | null;
  roomNumber: string | null;
  capacity: number;
  rows: number | null;
  columns: number | null;
  benchType: BenchType | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExamRoomInput {
  name: string;
  building?: string;
  floor?: string;
  roomNumber?: string;
  capacity: number;
  rows?: number;
  columns?: number;
  benchType?: BenchType;
  notes?: string;
  isActive?: boolean;
}

export type UpdateExamRoomInput = Partial<CreateExamRoomInput>;

export async function listExamRooms(
  filters: { isActive?: boolean; hasGeometry?: boolean } = {},
  token: string
): Promise<ExamRoom[]> {
  const query = new URLSearchParams();
  if (filters.isActive !== undefined) query.append("isActive", String(filters.isActive));
  if (filters.hasGeometry !== undefined) query.append("hasGeometry", String(filters.hasGeometry));
  const res = await apiFetch<ApiSuccess<{ rooms: ExamRoom[] }>>(`/exam-rooms?${query}`, {}, token);
  return res.data.rooms;
}

export async function createExamRoom(data: CreateExamRoomInput, token: string): Promise<ExamRoom> {
  const res = await apiFetch<ApiSuccess<{ room: ExamRoom }>>("/exam-rooms", { method: "POST", body: JSON.stringify(data) }, token);
  return res.data.room;
}

export async function updateExamRoom(id: string, data: UpdateExamRoomInput, token: string): Promise<ExamRoom> {
  const res = await apiFetch<ApiSuccess<{ room: ExamRoom }>>(`/exam-rooms/${id}`, { method: "PUT", body: JSON.stringify(data) }, token);
  return res.data.room;
}

export async function deleteExamRoom(id: string, token: string): Promise<void> {
  await apiFetch(`/exam-rooms/${id}`, { method: "DELETE" }, token);
}

// ── Seating Patterns ─────────────────────────────────────────────────────────

export interface SeatingPattern {
  id: string;
  name: string;
  patternType: SeatingPatternType;
  departmentSequence: string[];
  departmentSequenceCodes: string[];
  isDefault: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSeatingPatternInput {
  name: string;
  patternType: SeatingPatternType;
  departmentSequence: string[];
  isDefault?: boolean;
}

export async function listSeatingPatterns(token: string): Promise<SeatingPattern[]> {
  const res = await apiFetch<ApiSuccess<{ patterns: SeatingPattern[] }>>("/seating-patterns", {}, token);
  return res.data.patterns;
}

export async function createSeatingPattern(data: CreateSeatingPatternInput, token: string): Promise<SeatingPattern> {
  const res = await apiFetch<ApiSuccess<{ pattern: SeatingPattern }>>("/seating-patterns", { method: "POST", body: JSON.stringify(data) }, token);
  return res.data.pattern;
}

export async function updateSeatingPattern(id: string, data: Partial<CreateSeatingPatternInput>, token: string): Promise<SeatingPattern> {
  const res = await apiFetch<ApiSuccess<{ pattern: SeatingPattern }>>(`/seating-patterns/${id}`, { method: "PUT", body: JSON.stringify(data) }, token);
  return res.data.pattern;
}

export async function deleteSeatingPattern(id: string, token: string): Promise<void> {
  await apiFetch(`/seating-patterns/${id}`, { method: "DELETE" }, token);
}

// ── Departments (color) ──────────────────────────────────────────────────────

export interface Department {
  id: string;
  name: string;
  code: string;
  color: string | null;
  isActive: boolean;
}

export async function listDepartments(token: string): Promise<Department[]> {
  const res = await apiFetch<ApiSuccess<{ departments: Department[] }>>("/departments", {}, token);
  return res.data.departments;
}

export async function updateDepartmentColor(id: string, color: string, token: string): Promise<Department> {
  const res = await apiFetch<ApiSuccess<{ department: Department }>>(`/departments/${id}/color`, { method: "PUT", body: JSON.stringify({ color }) }, token);
  return res.data.department;
}

// ── Exam Sessions (orchestration) ───────────────────────────────────────────

export interface ExamSession {
  id: string;
  name: string;
  examType: string;
  departmentIds: string[];
  years: number[];
  semester: number;
  sections: string[];
  examDates: string[];
  subjectIds: string[];
  classroomIds: string[];
  invigilatorIds: string[];
  seatingPatternId: string | null;
  status: ExamSessionStatus;
  resolvedExamCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExamSessionInput {
  name: string;
  examType: string;
  departmentIds: string[];
  years?: number[];
  semester: number;
  sections: string[];
  examDates?: string[];
  subjectIds: string[];
  classroomIds?: string[];
  invigilatorIds?: string[];
  seatingPatternId?: string;
}

export interface PaginatedExamSessions {
  sessions: ExamSession[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ResolveExamsResult {
  linkedExamIds: string[];
  unresolvedCriteria: Array<{ subjectId: string; subjectCode: string; section: string; reason: string }>;
}

export async function listExamSessions(
  filters: { status?: ExamSessionStatus; page?: number; limit?: number } = {},
  token: string
): Promise<PaginatedExamSessions> {
  const query = new URLSearchParams();
  if (filters.status) query.append("status", filters.status);
  if (filters.page) query.append("page", String(filters.page));
  if (filters.limit) query.append("limit", String(filters.limit));
  const res = await apiFetch<ApiSuccess<PaginatedExamSessions>>(`/exam-sessions?${query}`, {}, token);
  return res.data;
}

export async function createExamSession(data: CreateExamSessionInput, token: string): Promise<ExamSession> {
  const res = await apiFetch<ApiSuccess<{ session: ExamSession }>>("/exam-sessions", { method: "POST", body: JSON.stringify(data) }, token);
  return res.data.session;
}

export async function deleteExamSession(id: string, token: string): Promise<void> {
  await apiFetch(`/exam-sessions/${id}`, { method: "DELETE" }, token);
}

export async function resolveExamSessionExams(id: string, token: string): Promise<ResolveExamsResult> {
  const res = await apiFetch<ApiSuccess<ResolveExamsResult>>(`/exam-sessions/${id}/resolve-exams`, { method: "POST" }, token);
  return res.data;
}

export async function checkExamSessionConflicts(id: string, token: string): Promise<ConflictCheckResult> {
  const res = await apiFetch<ApiSuccess<ConflictCheckResult>>(`/exam-sessions/${id}/check-conflicts`, { method: "POST" }, token);
  return res.data;
}

export async function generateExamSessionSeating(id: string, token: string): Promise<SeatingGenerationResult> {
  const res = await apiFetch<ApiSuccess<SeatingGenerationResult>>(`/exam-sessions/${id}/generate-seating`, { method: "POST" }, token);
  return res.data;
}

export async function generateExamSessionInvigilation(id: string, token: string): Promise<InvigilationDuty[]> {
  const res = await apiFetch<ApiSuccess<{ duties: InvigilationDuty[] }>>(`/exam-sessions/${id}/generate-invigilation`, { method: "POST" }, token);
  return res.data.duties;
}

export async function publishExamSession(id: string, token: string): Promise<ExamSession> {
  const res = await apiFetch<ApiSuccess<{ session: ExamSession }>>(`/exam-sessions/${id}/publish`, { method: "POST" }, token);
  return res.data.session;
}

// ── Exam Seating ─────────────────────────────────────────────────────────────

export interface ExamSlotSummary {
  examDate: string;
  startTime: string;
  endTime: string;
  exams: Array<{
    examId: string;
    subjectCode: string;
    subjectName: string;
    section: string;
    examType: string;
    rosterSize: number;
    hasSeating: boolean;
  }>;
  totalStudents: number;
}

export interface SeatAllocation {
  id: string;
  examId: string;
  subjectCode: string;
  examType: string;
  departmentId: string;
  departmentCode: string;
  departmentColor: string | null;
  roomId: string;
  roomName: string;
  studentId: string;
  rollNumber: string;
  studentName: string;
  seatNumber: number;
  benchNumber: number | null;
  seatPosition: SeatPosition | null;
  isLocked: boolean;
}

export interface RoomSeatingChart {
  roomId: string;
  roomName: string;
  rows: number | null;
  columns: number | null;
  benchType: BenchType | null;
  capacity: number;
  occupied: number;
  seats: SeatAllocation[];
}

export interface SeatingGenerationResult {
  examIds: string[];
  totalStudents: number;
  rooms: RoomSeatingChart[];
}

export interface SeatingConflict {
  type: ConflictType;
  severity: "warning" | "error";
  message: string;
  context?: Record<string, unknown>;
}

export interface ConflictCheckResult {
  hasBlockingConflicts: boolean;
  conflicts: SeatingConflict[];
}

export interface SeatingSearchResult {
  type: "student" | "room" | "invigilator";
  label: string;
  context: string;
  seatAllocation?: SeatAllocation;
  invigilationDuty?: InvigilationDuty;
}

export interface SeatingAnalytics {
  totalStudents: number;
  roomsUsed: number;
  capacityUtilizationPercent: number;
  invigilatorsAssigned: number;
  averageOccupancyPercent: number;
  conflictCount: number;
  studentsPerDepartment: Array<{ departmentId: string; departmentCode: string; departmentColor: string | null; count: number }>;
}

export async function listExamSlots(
  filters: { from?: string; to?: string; departmentId?: string } = {},
  token: string
): Promise<ExamSlotSummary[]> {
  const query = new URLSearchParams();
  if (filters.from) query.append("from", filters.from);
  if (filters.to) query.append("to", filters.to);
  if (filters.departmentId) query.append("departmentId", filters.departmentId);
  const res = await apiFetch<ApiSuccess<{ slots: ExamSlotSummary[] }>>(`/exam-seating/slots?${query}`, {}, token);
  return res.data.slots;
}

export async function generateSeatingPlan(
  data: { examIds: string[]; roomIds: string[]; seatingPatternId?: string; examSessionId?: string },
  token: string
): Promise<SeatingGenerationResult> {
  const res = await apiFetch<ApiSuccess<SeatingGenerationResult>>("/exam-seating/generate", { method: "POST", body: JSON.stringify(data) }, token);
  return res.data;
}

export async function checkSeatingConflicts(data: { examIds: string[]; roomIds: string[] }, token: string): Promise<ConflictCheckResult> {
  const res = await apiFetch<ApiSuccess<ConflictCheckResult>>("/exam-seating/check-conflicts", { method: "POST", body: JSON.stringify(data) }, token);
  return res.data;
}

export async function getSeatingByExam(examId: string, token: string): Promise<RoomSeatingChart[]> {
  const res = await apiFetch<ApiSuccess<{ rooms: RoomSeatingChart[] }>>(`/exam-seating/exam/${examId}`, {}, token);
  return res.data.rooms;
}

export async function getSeatingByRoom(roomId: string, date: string | undefined, token: string): Promise<RoomSeatingChart> {
  const query = date ? `?date=${date}` : "";
  const res = await apiFetch<ApiSuccess<{ chart: RoomSeatingChart }>>(`/exam-seating/room/${roomId}${query}`, {}, token);
  return res.data.chart;
}

export async function getMySeating(token: string): Promise<SeatAllocation[]> {
  const res = await apiFetch<ApiSuccess<{ seats: SeatAllocation[] }>>("/exam-seating/me", {}, token);
  return res.data.seats;
}

export async function swapSeats(allocationIdA: string, allocationIdB: string, token: string): Promise<void> {
  await apiFetch("/exam-seating/swap", { method: "POST", body: JSON.stringify({ allocationIdA, allocationIdB }) }, token);
}

export async function moveSeat(allocationId: string, targetRoomId: string, targetSeatNumber: number, token: string): Promise<SeatAllocation> {
  const res = await apiFetch<ApiSuccess<{ seat: SeatAllocation }>>(
    "/exam-seating/move",
    { method: "POST", body: JSON.stringify({ allocationId, targetRoomId, targetSeatNumber }) },
    token
  );
  return res.data.seat;
}

export async function lockSeat(allocationId: string, isLocked: boolean, token: string): Promise<SeatAllocation> {
  const res = await apiFetch<ApiSuccess<{ seat: SeatAllocation }>>(`/exam-seating/${allocationId}/lock`, { method: "PUT", body: JSON.stringify({ isLocked }) }, token);
  return res.data.seat;
}

export async function searchSeating(q: string, examId: string | undefined, token: string): Promise<SeatingSearchResult[]> {
  const query = new URLSearchParams({ q });
  if (examId) query.append("examId", examId);
  const res = await apiFetch<ApiSuccess<{ results: SeatingSearchResult[] }>>(`/exam-seating/search?${query}`, {}, token);
  return res.data.results;
}

export async function getSeatingAnalytics(
  filters: { examId?: string; examSessionId?: string } = {},
  token: string
): Promise<SeatingAnalytics> {
  const query = new URLSearchParams();
  if (filters.examId) query.append("examId", filters.examId);
  if (filters.examSessionId) query.append("examSessionId", filters.examSessionId);
  const res = await apiFetch<ApiSuccess<SeatingAnalytics>>(`/exam-seating/analytics?${query}`, {}, token);
  return res.data;
}

// ── Invigilation ───────────────────────────────────────────────────────────────

export interface InvigilationDutyExamCoverage {
  examId: string;
  subjectCode: string;
  examType: string;
}

export interface InvigilationDuty {
  id: string;
  roomId: string;
  roomName: string;
  facultyId: string;
  facultyName: string;
  dutyDate: string;
  startTime: string;
  endTime: string;
  status: InvigilationStatus;
  assignedBy: string;
  exams: InvigilationDutyExamCoverage[];
}

export interface PaginatedInvigilationDuties {
  duties: InvigilationDuty[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function generateInvigilationDuties(
  data: { examIds: string[]; invigilatorsPerRoom?: number; departmentId?: string },
  token: string
): Promise<InvigilationDuty[]> {
  const res = await apiFetch<ApiSuccess<{ duties: InvigilationDuty[] } | InvigilationDuty[]>>("/exam-invigilation/generate", { method: "POST", body: JSON.stringify(data) }, token);
  const d = res.data as any;
  return Array.isArray(d) ? d : d.duties;
}

export async function listInvigilationDuties(
  filters: { facultyId?: string; roomId?: string; status?: InvigilationStatus; from?: string; to?: string; page?: number; limit?: number } = {},
  token: string
): Promise<PaginatedInvigilationDuties> {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined) query.append(k, String(v));
  });
  const res = await apiFetch<ApiSuccess<PaginatedInvigilationDuties>>(`/exam-invigilation?${query}`, {}, token);
  return res.data;
}

export async function updateInvigilationDuty(
  id: string,
  data: { facultyId?: string; status?: InvigilationStatus },
  token: string
): Promise<InvigilationDuty> {
  const res = await apiFetch<ApiSuccess<InvigilationDuty>>(`/exam-invigilation/${id}`, { method: "PUT", body: JSON.stringify(data) }, token);
  return res.data;
}

// ── Print Center (Reports export) ───────────────────────────────────────────

export type SeatingReportType =
  | "room_seating_chart"
  | "student_seating_list"
  | "invigilator_sheet"
  | "attendance_sheet"
  | "seating_summary";

export async function exportSeatingReport(
  reportType: SeatingReportType,
  format: "pdf" | "excel" | "csv",
  filters: { examId?: string; roomId?: string; examSessionId?: string },
  token: string
): Promise<void> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001/api";
  const query = new URLSearchParams({ reportType });
  Object.entries(filters).forEach(([k, v]) => {
    if (v) query.append(k, v);
  });

  const res = await fetch(`${API_URL}/reports/export/${format}?${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to export report");

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const ext = format === "excel" ? "xlsx" : format;
  a.download = `${reportType}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
