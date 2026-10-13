"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";

// ── STUDENTS REGISTRY ────────────────────────────────────────────────────────
interface ListStudentsFilters {
  page?: number;
  limit?: number;
  search?: string;
  departmentId?: string;
  semester?: string | number;
  status?: string;
  academicYear?: string;
  section?: string;
}

export function useStudents(filters: ListStudentsFilters = {}) {
  const { accessToken } = useAuth();
  
  return useQuery({
    queryKey: ["students", filters],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (filters.page) queryParams.append("page", filters.page.toString());
      if (filters.limit) queryParams.append("limit", filters.limit.toString());
      if (filters.search) queryParams.append("search", filters.search);
      if (filters.departmentId && filters.departmentId !== "ALL") {
        queryParams.append("departmentId", filters.departmentId);
      }
      if (filters.semester && filters.semester !== "ALL") {
        queryParams.append("semester", filters.semester.toString());
      }
      if (filters.status && filters.status !== "ALL") {
        queryParams.append("status", filters.status.toLowerCase());
      }
      if (filters.academicYear && filters.academicYear !== "ALL") {
        queryParams.append("academicYear", filters.academicYear);
      }
      if (filters.section && filters.section !== "ALL") {
        queryParams.append("section", filters.section);
      }

      const res = await apiFetch(`/students?${queryParams.toString()}`, {}, accessToken);
      return {
        students: res.data?.students || [],
        pagination: res.data?.pagination || { page: 1, totalPages: 1, total: 0 },
      };
    },
    enabled: !!accessToken,
    staleTime: 30000, // cache for 30s
  });
}

// ── FACULTY REGISTRY ─────────────────────────────────────────────────────────
interface ListFacultyFilters {
  page?: number;
  limit?: number;
  search?: string;
  departmentId?: string;
  status?: string;
}

export function useFaculty(filters: ListFacultyFilters = {}) {
  const { accessToken } = useAuth();

  return useQuery({
    queryKey: ["faculty", filters],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (filters.page) queryParams.append("page", filters.page.toString());
      if (filters.limit) queryParams.append("limit", filters.limit.toString());
      if (filters.search) queryParams.append("search", filters.search);
      if (filters.departmentId && filters.departmentId !== "ALL") {
        queryParams.append("departmentId", filters.departmentId);
      }
      if (filters.status && filters.status !== "ALL") {
        queryParams.append("status", filters.status.toLowerCase());
      }

      const res = await apiFetch(`/faculty?${queryParams.toString()}`, {}, accessToken);
      return {
        faculty: res.data?.faculty || [],
        pagination: res.data?.pagination || { page: 1, totalPages: 1, total: 0 },
      };
    },
    enabled: !!accessToken,
    staleTime: 30000,
  });
}

// ── DEPARTMENT REGISTRY ──────────────────────────────────────────────────────
export function useDepartments() {
  const { accessToken } = useAuth();

  return useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const res = await apiFetch("/departments", {}, accessToken);
      return res.data?.departments || [];
    },
    enabled: !!accessToken,
    staleTime: 60000, // cache departments longer as they are static
  });
}

// ── ACADEMIC SESSION REGISTRY ────────────────────────────────────────────────
export function useAcademicSessions() {
  return useQuery({
    queryKey: ["academicSessions"],
    queryFn: () => {
      const startYear = 2024;
      const currentYear = new Date().getFullYear();
      const endYear = Math.max(currentYear + 2, 2029);
      const sessions = [];
      for (let y = startYear; y <= endYear; y++) {
        sessions.push(`${y}-${y + 1}`);
      }
      return sessions;
    },
    staleTime: Infinity,
  });
}

// ── SECTION REGISTRY ─────────────────────────────────────────────────────────
export function useSections(departmentId?: string, semester?: number) {
  const { accessToken } = useAuth();

  return useQuery<string[]>({
    queryKey: ["sections", departmentId, semester],
    queryFn: async (): Promise<string[]> => {
      if (!departmentId || !semester || departmentId === "ALL") return [];
      const queryParams = new URLSearchParams({
        departmentId,
        semester: semester.toString(),
      });
      const res = await apiFetch(`/students/sections?${queryParams.toString()}`, {}, accessToken);
      return res.success && Array.isArray(res.data?.sections) ? (res.data.sections as string[]) : [];
    },
    enabled: !!accessToken && !!departmentId && !!semester && departmentId !== "ALL",
    staleTime: 30000,
  });
}

// ── SUBJECTS/CURRICULUM REGISTRY ─────────────────────────────────────────────
interface ListSubjectsFilters {
  page?: number;
  limit?: number;
  search?: string;
  departmentId?: string;
  programId?: string;
  semester?: number;
  regulation?: string;
  year?: string;
  type?: string;
  status?: string;
}

export function useSubjects(filters: ListSubjectsFilters = {}) {
  const { accessToken } = useAuth();

  return useQuery({
    queryKey: ["subjects", filters],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (filters.page) queryParams.append("page", filters.page.toString());
      if (filters.limit) queryParams.append("limit", filters.limit.toString());
      if (filters.search) queryParams.append("search", filters.search);
      if (filters.departmentId && filters.departmentId !== "ALL") {
        queryParams.append("departmentId", filters.departmentId);
      }
      if (filters.programId && filters.programId !== "ALL") {
        queryParams.append("programId", filters.programId);
      }
      if (filters.semester && filters.semester.toString() !== "ALL") {
        queryParams.append("semester", filters.semester.toString());
      }
      if (filters.regulation && filters.regulation !== "ALL") {
        queryParams.append("regulation", filters.regulation);
      }
      if (filters.year && filters.year !== "ALL") {
        queryParams.append("year", filters.year);
      }
      if (filters.type && filters.type !== "ALL") {
        queryParams.append("type", filters.type);
      }
      if (filters.status && filters.status !== "ALL") {
        queryParams.append("status", filters.status);
      }

      const res = await apiFetch(`/subjects?${queryParams.toString()}`, {}, accessToken);
      return {
        subjects: res.data?.subjects || [],
        pagination: res.data?.pagination || { page: 1, totalPages: 1, total: 0 },
      };
    },
    enabled: !!accessToken,
    staleTime: 30000,
  });
}

// ── TEACHING ASSIGNMENTS REGISTRY ────────────────────────────────────────────
interface ListTeachingAssignmentsFilters {
  departmentId?: string;
  semester?: number;
  section?: string;
  subjectId?: string;
  facultyId?: string;
  academicYear?: string;
  status?: string;
  search?: string;
}

export function useTeachingAssignments(filters: ListTeachingAssignmentsFilters = {}) {
  const { accessToken } = useAuth();

  return useQuery({
    queryKey: ["teachingAssignments", filters],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (filters.departmentId && filters.departmentId !== "ALL") {
        queryParams.append("departmentId", filters.departmentId);
      }
      if (filters.semester && filters.semester.toString() !== "ALL") {
        queryParams.append("semester", filters.semester.toString());
      }
      if (filters.section && filters.section !== "ALL") {
        queryParams.append("section", filters.section);
      }
      if (filters.subjectId && filters.subjectId !== "ALL") {
        queryParams.append("subjectId", filters.subjectId);
      }
      if (filters.facultyId && filters.facultyId !== "ALL") {
        queryParams.append("facultyId", filters.facultyId);
      }
      if (filters.academicYear && filters.academicYear !== "ALL") {
        queryParams.append("academicYear", filters.academicYear);
      }
      if (filters.status && filters.status !== "ALL") {
        queryParams.append("status", filters.status);
      }
      if (filters.search) {
        queryParams.append("search", filters.search);
      }

      const res = await apiFetch(`/teaching-assignments?${queryParams.toString()}`, {}, accessToken);
      return res.data?.assignments || res.data || [];
    },
    enabled: !!accessToken,
    staleTime: 30000,
  });
}

// ── CLASSROOMS REGISTRY ──────────────────────────────────────────────────────
interface ListClassroomsFilters {
  search?: string;
  capacity?: number;
}

export function useClassrooms(filters: ListClassroomsFilters = {}) {
  const { accessToken } = useAuth();

  return useQuery({
    queryKey: ["classrooms", filters],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (filters.search) queryParams.append("search", filters.search);
      if (filters.capacity) queryParams.append("capacity", filters.capacity.toString());

      const res = await apiFetch(`/exam-rooms?${queryParams.toString()}`, {}, accessToken);
      return res.data?.rooms || [];
    },
    enabled: !!accessToken,
    staleTime: 60000,
  });
}

// ── PROGRAM REGISTRY ─────────────────────────────────────────────────────────
export function usePrograms(departmentId?: string) {
  const { accessToken } = useAuth();

  return useQuery({
    queryKey: ["programs", departmentId],
    queryFn: async () => {
      const url = departmentId && departmentId !== "ALL"
        ? `/departments/programs/list?departmentId=${departmentId}`
        : "/departments/programs/list";
      const res = await apiFetch(url, {}, accessToken);
      return res.data?.programs || [];
    },
    enabled: !!accessToken,
    staleTime: 60000,
  });
}

