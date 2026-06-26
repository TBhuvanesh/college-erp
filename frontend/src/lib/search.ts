import { apiFetch } from "@/lib/api";

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
  semester: number;
}

export interface AnnouncementResult {
  id: string;
  title: string;
  publishDate: string;
}

export interface EventResult {
  id: string;
  title: string;
  startDate: string;
  eventType: string;
}

export interface SearchResult {
  students: StudentResult[];
  faculty: FacultyResult[];
  subjects: SubjectResult[];
  announcements: AnnouncementResult[];
  events: EventResult[];
}

export interface SearchApiResponse {
  success: boolean;
  data: SearchResult;
}

export async function searchErp(
  query: string,
  accessToken: string
): Promise<SearchResult> {
  const res = await apiFetch<SearchApiResponse>(
    `/search?q=${encodeURIComponent(query)}`,
    {},
    accessToken
  );
  return res.data;
}
