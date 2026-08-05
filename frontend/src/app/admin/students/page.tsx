"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useStudents, useDepartments, useSections } from "@/hooks/useRegistry";
import { apiFetch } from "@/lib/api";
import { 
  Sparkles,
  Plus,
  Edit,
  Trash2,
  Eye,
  X,
  BookOpen,
  CreditCard
} from "lucide-react";
import { StudentFormDrawer } from "@/components/StudentFormDrawer";
import { SkeletonTable } from "@/components/UX/SkeletonLoaders";
import { EmptyState } from "@/components/UX/EmptyState";
import { UnifiedPagination } from "@/components/UX/UnifiedPagination";
import { UnifiedSearchBar } from "@/components/UX/UnifiedSearchBar";
import { ConfirmationDialog } from "@/components/UX/ConfirmationDialog";

interface StudentDetail {
  id: string;
  userId: string;
  rollNumber: string;
  fullName: string;
  email: string;
  department: { id: string; name: string; code: string };
  program: { id: string; name: string; code: string; totalSemesters: number };
  semester: number;
  section?: string;
  academicYear: string;
  status: string;
  createdAt: string;
}

interface StudentMetrics {
  attendancePct: string;
  grades: { id: string; subjectName: string; type: string; marks: number; maxMarks: number; grade: string }[];
  invoices: { id: string; type: string; dueDate: string; amount: number; status: string }[];
  outstandingFees: number;
}

export default function AdminStudents() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  // Filter persistence using localStorage
  const [searchTerm, setSearchTerm] = useState("");
  const [deptFilter, setDeptFilter] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("erp_students_deptFilter") || "ALL";
    }
    return "ALL";
  });
  const [semFilter, setSemFilter] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("erp_students_semFilter") || "ALL";
    }
    return "ALL";
  });
  const [sectionFilter, setSectionFilter] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("erp_students_sectionFilter") || "ALL";
    }
    return "ALL";
  });
  const [statusFilter, setStatusFilter] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("erp_students_statusFilter") || "ALL";
    }
    return "ALL";
  });

  useEffect(() => {
    localStorage.setItem("erp_students_deptFilter", deptFilter);
  }, [deptFilter]);

  useEffect(() => {
    localStorage.setItem("erp_students_semFilter", semFilter);
  }, [semFilter]);

  useEffect(() => {
    localStorage.setItem("erp_students_sectionFilter", sectionFilter);
  }, [sectionFilter]);

  useEffect(() => {
    localStorage.setItem("erp_students_statusFilter", statusFilter);
  }, [statusFilter]);

  const { data: availableSections = [], isLoading: sectionsLoading } = useSections(
    deptFilter !== "ALL" ? deptFilter : undefined,
    semFilter !== "ALL" ? parseInt(semFilter) : undefined
  );

  useEffect(() => {
    if (availableSections.length > 0 && sectionFilter !== "ALL" && !availableSections.includes(sectionFilter)) {
      setSectionFilter("ALL");
    } else if (availableSections.length === 0 && (deptFilter === "ALL" || semFilter === "ALL") && sectionFilter !== "ALL") {
      setSectionFilter("ALL");
    }
  }, [availableSections, sectionFilter, deptFilter, semFilter]);

  // Pagination state
  const [page, setPage] = useState(1);
  const limit = 10;

  // Drawer / Modal states
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<StudentDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [formDrawerOpen, setFormDrawerOpen] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  // Batch operations state
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  const [toastMsg, setToastMsg] = useState("");

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3500);
  };

  // Queries
  const { data: departmentsData = [] } = useDepartments();

  const studentsQueryFilters = useMemo(() => ({
    page,
    limit,
    search: searchTerm,
    departmentId: deptFilter,
    semester: semFilter,
    section: sectionFilter,
    status: statusFilter,
  }), [page, limit, searchTerm, deptFilter, semFilter, sectionFilter, statusFilter]);

  const {
    data: studentsResult,
    isLoading: loadingStudents,
    error: studentsError,
  } = useStudents(studentsQueryFilters);

  const studentsList = studentsResult?.students || [];
  const totalPages = studentsResult?.pagination?.totalPages || 1;
  const totalStudents = studentsResult?.pagination?.total || 0;

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
    setSelectedStudentIds(new Set());
  }, [searchTerm, deptFilter, semFilter, sectionFilter, statusFilter]);

  // Fetch student detail when selectedStudentId changes
  useEffect(() => {
    if (!selectedStudentId) {
      setSelectedStudent(null);
      return;
    }

    const fetchStudentDetail = async () => {
      setLoadingDetail(true);
      try {
        const res = await apiFetch(`/students/${selectedStudentId}`, {}, accessToken);
        if (res.success && res.data?.student) {
          setSelectedStudent(res.data.student);
        }
      } catch (err: any) {
        triggerToast(err.message || "Failed to load student details");
        setSelectedStudentId(null);
      } finally {
        setLoadingDetail(false);
      }
    };

    fetchStudentDetail();
  }, [selectedStudentId, accessToken]);

  // Fetch metrics for selected student
  const [metrics, setMetrics] = useState<StudentMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);

  useEffect(() => {
    if (!selectedStudent) {
      setMetrics(null);
      return;
    }
    const studId = selectedStudent.id;
    const fetchMetrics = async () => {
      setMetricsLoading(true);
      try {
        const [attRes, marksRes, feeRes] = await Promise.all([
          apiFetch(`/attendance?studentId=${studId}&limit=1000`, {}, accessToken),
          apiFetch(`/internal-marks?studentId=${studId}&limit=100`, {}, accessToken),
          apiFetch(`/fees?studentId=${studId}&limit=100`, {}, accessToken),
        ]);

        const records = (attRes.success && attRes.data?.records) || [];
        const totalHeld = records.length;
        const present = records.filter((r: any) => r.status === "Present" || r.status === "Late").length;
        const attendancePct = totalHeld > 0 ? Math.min(Math.round((present / totalHeld) * 100), 100).toString() : "0";

        const marksRecords = (marksRes.success && marksRes.data?.records) || [];
        const studGrades = marksRecords.map((m: any) => ({
          id: m.id,
          subjectName: m.subjectName,
          type: m.assessmentType,
          marks: m.obtainedMarks,
          maxMarks: m.maximumMarks,
          grade: m.maximumMarks > 0 ? `${Math.round((m.obtainedMarks / m.maximumMarks) * 100)}%` : "N/A",
        }));

        const fees = (feeRes.success && feeRes.data?.fees) || [];
        const studInvoices = fees.map((f: any) => ({
          id: f.id,
          type: f.feeType,
          dueDate: f.dueDate,
          amount: f.totalAmount,
          status: f.paymentStatus,
        }));
        const outstanding = fees.reduce((acc: number, f: any) => acc + (f.pendingAmount || 0), 0);

        setMetrics({
          attendancePct,
          grades: studGrades,
          invoices: studInvoices,
          outstandingFees: outstanding,
        });
      } catch (err) {
        console.error("Failed to load student metrics", err);
        setMetrics(null);
      } finally {
        setMetricsLoading(false);
      }
    };
    fetchMetrics();
  }, [selectedStudent, accessToken]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = new Set<string>(studentsList.map((s: any) => s.id as string));
      setSelectedStudentIds(allIds);
    } else {
      setSelectedStudentIds(new Set<string>());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedStudentIds);
    if (checked) newSet.add(id);
    else newSet.delete(id);
    setSelectedStudentIds(newSet);
  };

  const handleBulkDeactivate = async () => {
    setBulkProcessing(true);
    let successCount = 0;
    try {
      for (const id of Array.from(selectedStudentIds)) {
        await apiFetch(`/students/${id}`, { method: "DELETE" }, accessToken);
        successCount++;
      }
      triggerToast(`Successfully deactivated ${successCount} students.`);
      setSelectedStudentIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["students"] });
    } catch (err: any) {
      triggerToast(`Error during bulk action: ${err.message}`);
    } finally {
      setBulkProcessing(false);
      setBulkConfirmOpen(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!studentToDelete) return;
    setDeactivating(true);
    try {
      const res = await apiFetch(`/students/${studentToDelete.id}`, { method: "DELETE" }, accessToken);
      if (res.success) {
        triggerToast("Student profile deactivated successfully");
        queryClient.invalidateQueries({ queryKey: ["students"] });
        if (studentToDelete.id === selectedStudentId) {
          setSelectedStudentId(null);
        }
      }
    } catch (err: any) {
      triggerToast(err.message || "Failed to deactivate student profile");
    } finally {
      setDeactivating(false);
      setDeleteConfirmOpen(false);
      setStudentToDelete(null);
    }
  };

  const handleResetFilters = () => {
    setSearchTerm("");
    setDeptFilter("ALL");
    setSemFilter("ALL");
    setSectionFilter("ALL");
    setStatusFilter("ALL");
  };

  return (
    <div className="relative">
      {/* Toast Alert */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-blue-600 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-xl shadow-blue-600/20 border border-blue-400/20 animate-fade-in">
          <Sparkles size={14} className="animate-pulse" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="font-display font-bold text-2xl text-text-primary">Student Registry</h2>
          <p className="text-xs text-text-muted mt-1">
            Review active student registers, academic standings, and outstanding fee invoices.
          </p>
        </div>
        <button
          onClick={() => {
            setEditingStudentId(null);
            setFormDrawerOpen(true);
          }}
          className="px-4 py-2 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition flex items-center gap-1.5 self-start md:self-auto"
        >
          <Plus size={14} />
          <span>Register Student</span>
        </button>
      </div>

      {/* Directory Filter controls */}
      <div className="bg-surface border border-border-subtle rounded-xl p-4 mb-6 flex flex-col md:flex-row gap-3">
        {/* Search */}
        <UnifiedSearchBar
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search by name, email, or roll number..."
          className="flex-1"
        />

        {/* Dept Filter */}
        <div className="w-full md:w-48 flex items-center gap-2 bg-background border border-border-subtle rounded px-2 text-xs text-text-primary">
          <span className="text-text-muted">Dept:</span>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="bg-transparent text-text-primary cursor-pointer py-2 flex-1 focus:outline-none"
          >
            <option value="ALL">All Departments</option>
            {departmentsData.map((dept: any) => (
              <option key={dept.id} value={dept.id}>
                {dept.code}
              </option>
            ))}
          </select>
        </div>

        {/* Semester Filter */}
        <div className="w-full md:w-48 flex items-center gap-2 bg-background border border-border-subtle rounded px-2 text-xs text-text-primary">
          <span className="text-text-muted">Sem:</span>
          <select
            value={semFilter}
            onChange={(e) => setSemFilter(e.target.value)}
            className="bg-transparent text-text-primary cursor-pointer py-2 flex-1 focus:outline-none"
          >
            <option value="ALL">All Semesters</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((sem) => (
              <option key={sem} value={sem.toString()}>
                Semester {sem}
              </option>
            ))}
          </select>
        </div>

        {/* Section Filter */}
        <div className="w-full md:w-32 flex items-center gap-2 bg-background border border-border-subtle rounded px-2 text-xs text-text-primary">
          <span className="text-text-muted">Sec:</span>
          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            disabled={sectionsLoading || availableSections.length === 0}
            className="bg-transparent text-text-primary cursor-pointer py-2 flex-1 focus:outline-none disabled:opacity-50"
          >
            <option value="ALL">All Sections</option>
            {availableSections.map((sec) => (
              <option key={sec} value={sec}>
                {sec}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="w-full md:w-48 flex items-center gap-2 bg-background border border-border-subtle rounded px-2 text-xs text-text-primary">
          <span className="text-text-muted">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-transparent text-text-primary cursor-pointer py-2 flex-1 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="GRADUATED">Graduated</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </div>

      {/* Main Table Grid split (70% table / 30% detail drawer overlay) */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Data List Table */}
        <div className="flex-1 w-full bg-surface border border-border-subtle rounded-xl overflow-hidden">
          {studentsError && (
            <div className="p-4 bg-rose-500/10 border-b border-border-subtle text-rose-400 text-xs font-semibold font-mono">
              Error loading registry. Please retry.
            </div>
          )}

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto max-h-[600px] overflow-y-auto relative">
            {/* Batch Action Bar */}
            {selectedStudentIds.size > 0 && (
              <div className="sticky top-0 left-0 right-0 z-20 bg-blue-600/90 backdrop-blur border-b border-blue-500/50 p-2.5 flex items-center justify-between animate-fade-in shadow-xl">
                <span className="text-xs font-bold text-white ml-2 flex items-center gap-2">
                  {selectedStudentIds.size} student{selectedStudentIds.size > 1 ? "s" : ""} selected
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedStudentIds(new Set())}
                    className="px-3 py-1.5 rounded bg-blue-700 hover:bg-blue-800 text-white text-[10px] font-semibold transition cursor-pointer"
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => setBulkConfirmOpen(true)}
                    className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold transition flex items-center gap-1.5 shadow-lg cursor-pointer"
                  >
                    Bulk Deactivate
                  </button>
                </div>
              </div>
            )}

            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-surface/90 backdrop-blur border-b border-border-subtle shadow-sm">
                <tr className="text-text-muted font-semibold">
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={studentsList.length > 0 && selectedStudentIds.size === studentsList.length}
                      onChange={handleSelectAll}
                      className="rounded bg-background border-neutral-700 text-blue-500 focus:ring-0 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3 font-mono">Student ID</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3 font-mono">Roll number</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Program</th>
                  <th className="px-4 py-3">Sem & Sec</th>
                  <th className="px-4 py-3 font-mono">Acad Year</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-text-secondary">
                {loadingStudents ? (
                  <tr>
                    <td colSpan={10} className="p-0">
                      <SkeletonTable cols={9} rows={8} />
                    </td>
                  </tr>
                ) : studentsList.length > 0 ? (
                  studentsList.map((student: any) => (
                    <tr
                      key={student.id}
                      tabIndex={0}
                      className={`hover:bg-surface/40 transition cursor-pointer outline-none focus:bg-surface-elevated/50 ${
                        selectedStudentId === student.id ? "bg-blue-600/10 border-l-2 border-l-blue-600" : ""
                      } ${selectedStudentIds.has(student.id) ? "bg-surface/50" : ""}`}
                      onClick={() => setSelectedStudentId(student.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") setSelectedStudentId(student.id);
                      }}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedStudentIds.has(student.id)}
                          onChange={(e) => handleSelectOne(student.id, e.target.checked)}
                          className="rounded bg-background border-neutral-700 text-blue-500 focus:ring-0 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3 font-mono text-[10px] text-text-muted select-all" title={student.id}>
                        {student.id.substring(0, 8)}...
                      </td>
                      <td className="px-4 py-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-surface-elevated border border-neutral-700 flex items-center justify-center font-bold text-blue-400 shrink-0">
                          {student.fullName.charAt(0)}
                        </div>
                        <div>
                          <span className="font-semibold text-text-primary block">{student.fullName}</span>
                          <span className="text-[10px] text-text-muted">{student.email}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono">{student.rollNumber}</td>
                      <td className="px-4 py-3">{student.departmentName}</td>
                      <td className="px-4 py-3 truncate max-w-[140px]" title={student.programName}>{student.programName}</td>
                      <td className="px-4 py-3">Sem {student.semester} - {student.section || "N/A"}</td>
                      <td className="px-4 py-3 font-mono">{student.academicYear}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border capitalize ${
                            student.status === "active" || student.status === "graduated"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : student.status === "suspended"
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                              : "bg-neutral-500/10 text-text-muted border-neutral-500/20"
                          }`}
                        >
                          {student.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setSelectedStudentId(student.id)}
                            title="View Profile Details"
                            className="p-1.5 rounded bg-surface-elevated hover:bg-neutral-700 border border-neutral-700 text-text-muted hover:text-text-primary cursor-pointer"
                          >
                            <Eye size={12} />
                          </button>
                          <button
                            onClick={() => {
                              setEditingStudentId(student.id);
                              setFormDrawerOpen(true);
                            }}
                            title="Edit Student"
                            className="p-1.5 rounded bg-surface-elevated hover:bg-surface-hover border border-neutral-700 text-text-muted hover:text-text-primary cursor-pointer"
                          >
                            <Edit size={12} />
                          </button>
                          <button
                            onClick={() => {
                              setStudentToDelete({ id: student.id, name: student.fullName });
                              setDeleteConfirmOpen(true);
                            }}
                            title="Deactivate Student"
                            className="p-1.5 rounded bg-surface-elevated hover:bg-surface-hover border border-neutral-700 text-rose-500 hover:text-rose-400 cursor-pointer"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} className="p-6">
                      <EmptyState
                        title="No Students Found"
                        description="No student registers match the current query filters or search criteria."
                        actionButton={
                          <button
                            onClick={handleResetFilters}
                            className="px-3 py-1.5 text-xs font-semibold rounded bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-750 dark:text-neutral-300 text-text-primary cursor-pointer transition"
                          >
                            Reset Filter Options
                          </button>
                        }
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="block md:hidden divide-y divide-border-subtle">
            {loadingStudents ? (
              <div className="p-4 space-y-4">
                <div className="h-20 bg-neutral-100 dark:bg-neutral-800 rounded animate-pulse" />
                <div className="h-20 bg-neutral-100 dark:bg-neutral-800 rounded animate-pulse" />
              </div>
            ) : studentsList.length > 0 ? (
              studentsList.map((student: any) => (
                <div
                  key={student.id}
                  className={`p-4 hover:bg-surface/10 transition cursor-pointer flex flex-col gap-2.5 ${
                    selectedStudentId === student.id ? "bg-blue-600/5 border-l-2 border-l-blue-600" : ""
                  }`}
                  onClick={() => setSelectedStudentId(student.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-surface-elevated border border-neutral-700 flex items-center justify-center font-bold text-blue-400 shrink-0">
                        {student.fullName.charAt(0)}
                      </div>
                      <div>
                        <span className="font-semibold text-text-primary block">{student.fullName}</span>
                        <span className="text-[10px] text-text-muted">{student.email}</span>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-bold border capitalize ${
                        student.status === "active" || student.status === "graduated"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : student.status === "suspended"
                          ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          : "bg-neutral-500/10 text-neutral-400 border-neutral-500/20"
                      }`}
                    >
                      {student.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-[10px] text-text-secondary font-mono mt-1">
                    <div>
                      <span className="text-text-muted block text-[9px] uppercase font-bold tracking-wider">Student ID</span>
                      <span className="select-all" title={student.id}>{student.id.substring(0, 8)}...</span>
                    </div>
                    <div>
                      <span className="text-text-muted block text-[9px] uppercase font-bold tracking-wider">Roll Number</span>
                      <span>{student.rollNumber}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500 block text-[9px] uppercase font-bold tracking-wider">Department</span>
                      <span>{student.departmentName}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500 block text-[9px] uppercase font-bold tracking-wider">Program</span>
                      <span>{student.programName}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500 block text-[9px] uppercase font-bold tracking-wider">Sem & Sec</span>
                      <span>Sem {student.semester} - {student.section || "N/A"}</span>
                    </div>
                    <div>
                      <span className="dark:text-neutral-505 text-text-muted block text-[9px] uppercase font-bold tracking-wider">Acad Year</span>
                      <span>{student.academicYear}</span>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setSelectedStudentId(student.id)}
                      className="p-1.5 rounded dark:bg-neutral-850 bg-neutral-100 dark:hover:bg-neutral-800 hover:bg-neutral-200 border dark:border-neutral-800 border-border-subtle dark:text-neutral-400 text-text-secondary dark:hover:text-white hover:text-text-primary transition flex items-center gap-1 text-[10px] cursor-pointer"
                    >
                      <Eye size={12} />
                      <span>View</span>
                    </button>
                    <button
                      onClick={() => {
                        setEditingStudentId(student.id);
                        setFormDrawerOpen(true);
                      }}
                      className="p-1.5 rounded dark:bg-neutral-850 bg-neutral-100 dark:hover:bg-neutral-800 hover:bg-neutral-200 border dark:border-neutral-800 border-border-subtle dark:text-neutral-400 text-text-secondary dark:hover:text-white hover:text-text-primary transition flex items-center gap-1 text-[10px] cursor-pointer"
                    >
                      <Edit size={12} />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => {
                        setStudentToDelete({ id: student.id, name: student.fullName });
                        setDeleteConfirmOpen(true);
                      }}
                      className="p-1.5 rounded dark:bg-neutral-850 bg-neutral-100 dark:hover:bg-neutral-800 hover:bg-neutral-200 border dark:border-neutral-800 border-border-subtle text-rose-500 hover:text-rose-600 transition flex items-center gap-1 text-[10px] cursor-pointer"
                    >
                      <Trash2 size={12} />
                      <span>Deactivate</span>
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                title="No Students Found"
                description="No student registers match the current query filters."
                actionButton={
                  <button
                    onClick={handleResetFilters}
                    className="px-3 py-1.5 text-xs font-semibold rounded bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-750 dark:text-neutral-300 text-text-primary cursor-pointer transition"
                  >
                    Reset Filter Options
                  </button>
                }
              />
            )}
          </div>

          {/* Unified Pagination */}
          {!loadingStudents && studentsList.length > 0 && (
            <UnifiedPagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              totalItems={totalStudents}
              itemsPerPage={limit}
            />
          )}
        </div>

        {/* Right Side Slide-out Details Drawer (renders if student selected) */}
        {selectedStudentId && (
          <div className="w-full lg:w-96 glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl p-5 shadow-2xl relative animate-scale-up shrink-0">
            {loadingDetail || (selectedStudent && metricsLoading && !metrics) ? (
              <div className="py-20 flex flex-col items-center justify-center dark:text-neutral-500 text-text-muted animate-pulse">
                <span className="text-xs font-mono">Fetching record...</span>
              </div>
            ) : selectedStudent && metrics ? (
              <>
                {/* Header close */}
                <div className="flex items-center justify-between border-b dark:border-neutral-800 border-border-subtle pb-3 mb-4">
                  <h3 className="font-display font-bold dark:text-white text-text-primary text-base">Academic Record File</h3>
                  <button
                    onClick={() => setSelectedStudentId(null)}
                    className="p-1 rounded dark:bg-neutral-850 bg-neutral-100 dark:hover:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-400 text-text-secondary dark:hover:text-white hover:text-text-primary cursor-pointer border dark:border-neutral-800 border-border-subtle"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Profile Brief */}
                <div className="flex items-center gap-4 mb-5 p-3 rounded-lg dark:bg-neutral-955/50 bg-background border dark:border-neutral-900 border-border-subtle">
                  <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/25 flex items-center justify-center font-bold text-blue-400 text-lg">
                    {selectedStudent.fullName.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold dark:text-white text-text-primary truncate">{selectedStudent.fullName}</h4>
                    <p className="text-[10px] dark:text-neutral-500 text-text-secondary font-mono mt-0.5">
                      {selectedStudent.rollNumber} / {selectedStudent.department?.code || ""}
                    </p>
                    <p className="text-[10px] dark:text-neutral-500 text-text-secondary font-mono truncate">{selectedStudent.email}</p>
                    <span className="text-[9px] dark:text-neutral-605 text-text-muted font-mono mt-0.5 block">
                      Registered: {new Date(selectedStudent.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Academic Details Block */}
                <div className="p-3.5 dark:bg-neutral-950/40 bg-background border dark:border-neutral-900 border-border-subtle rounded-lg space-y-2 mb-5">
                  <div className="flex justify-between text-xs">
                    <span className="dark:text-neutral-500 text-text-secondary">Student ID:</span>
                    <span className="dark:text-white text-text-primary font-mono text-[10px] select-all truncate max-w-[180px]" title={selectedStudent.id}>
                      {selectedStudent.id}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="dark:text-neutral-500 text-text-secondary">Program:</span>
                    <strong className="dark:text-white text-text-primary text-right truncate max-w-[180px]" title={selectedStudent.program?.name || ""}>
                      {selectedStudent.program?.name || ""} ({selectedStudent.program?.code || ""})
                    </strong>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="dark:text-neutral-500 text-text-secondary">Semester & Sec:</span>
                    <strong className="dark:text-white text-text-primary">Semester {selectedStudent.semester} - Section {selectedStudent.section || "N/A"}</strong>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="dark:text-neutral-500 text-text-secondary">Academic Year:</span>
                    <strong className="dark:text-white text-text-primary font-mono">{selectedStudent.academicYear}</strong>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="dark:text-neutral-500 text-text-secondary">Account Status:</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold border capitalize ${
                      selectedStudent.status === "active"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                    }`}>
                      {selectedStudent.status}
                    </span>
                  </div>
                </div>

                {/* Metrics cards */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="p-3 dark:bg-neutral-950/40 bg-background border dark:border-neutral-900 border-border-subtle rounded-lg text-center">
                    <span className="text-[10px] dark:text-neutral-500 text-text-secondary uppercase font-bold tracking-wide block">
                      Attendance
                    </span>
                    <span
                      className={`block text-xl font-bold font-sans mt-1 ${
                        parseInt(metrics.attendancePct) >= 75 ? "text-emerald-400" : "text-rose-500"
                      }`}
                    >
                      {metrics.attendancePct}%
                    </span>
                  </div>
                  <div className="p-3 dark:bg-neutral-950/40 bg-background border dark:border-neutral-900 border-border-subtle rounded-lg text-center">
                    <span className="text-[10px] dark:text-neutral-500 text-text-secondary uppercase font-bold tracking-wide block">
                      Outstanding
                    </span>
                    <span
                      className={`block text-xl font-bold font-sans mt-1 ${
                        metrics.outstandingFees > 0 ? "text-amber-500" : "text-emerald-400"
                      }`}
                    >
                      ₹{metrics.outstandingFees.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                {/* Section tabs content */}
                <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                  {/* Courses & Grades list */}
                  <div>
                    <h5 className="text-[10px] uppercase font-bold dark:text-neutral-400 text-text-secondary flex items-center gap-1.5 mb-2">
                      <BookOpen size={12} className="text-blue-400" />
                      <span>Internal Assessment ({metrics.grades.length})</span>
                    </h5>
                    <div className="space-y-1.5">
                      {metrics.grades.length > 0 ? (
                        metrics.grades.map((g) => (
                          <div
                            key={g.id}
                            className="p-2 rounded dark:bg-neutral-955/20 bg-background border dark:border-neutral-900 border-border-subtle flex items-center justify-between text-xs"
                          >
                            <div>
                              <p className="font-semibold dark:text-white text-text-primary leading-none">{g.subjectName}</p>
                              <span className="text-[9px] dark:text-neutral-500 text-text-muted mt-1 block">
                                {g.type} Evaluation
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-blue-400">
                                {g.marks}/{g.maxMarks}
                              </span>
                              <span className="text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded px-1.5 py-0.5 block mt-0.5 font-bold font-mono">
                                Grade: {g.grade}
                              </span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-[10px] dark:text-neutral-600 text-text-muted font-mono italic">
                          No exam gradebooks submitted yet.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Billing ledger invoices */}
                  <div>
                    <h5 className="text-[10px] uppercase font-bold dark:text-neutral-400 text-text-secondary flex items-center gap-1.5 mb-2">
                      <CreditCard size={12} className="text-emerald-400" />
                      <span>Academic Invoices ({metrics.invoices.length})</span>
                    </h5>
                    <div className="space-y-1.5">
                      {metrics.invoices.length > 0 ? (
                        metrics.invoices.map((inv) => (
                          <div
                            key={inv.id}
                            className="p-2 rounded dark:bg-neutral-955/20 bg-background border dark:border-neutral-900 border-border-subtle flex items-center justify-between text-xs"
                          >
                            <div>
                              <p className="font-semibold dark:text-white text-text-primary leading-none">{inv.type}</p>
                              <span className="text-[9px] dark:text-neutral-500 text-text-muted mt-1 block">
                                Due: {inv.dueDate}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="font-bold dark:text-white text-text-primary font-sans">
                                ₹{inv.amount.toLocaleString("en-IN")}
                              </span>
                              <span
                                className={`text-[9px] border rounded px-1.5 py-0.5 block mt-0.5 font-bold ${
                                  inv.status === "Paid"
                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                    : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                }`}
                              >
                                {inv.status}
                              </span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-[10px] dark:text-neutral-600 text-text-muted font-mono italic">
                          No invoices billed to account.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-10 text-neutral-500 text-xs font-mono">
                Failed to load profile record.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Form Drawer (Add/Edit Student) */}
      <StudentFormDrawer
        isOpen={formDrawerOpen}
        onClose={() => {
          setFormDrawerOpen(false);
          setEditingStudentId(null);
        }}
        onSuccess={(msg) => {
          triggerToast(msg);
          queryClient.invalidateQueries({ queryKey: ["students"] });
          if (editingStudentId === selectedStudentId) {
            setSelectedStudentId(null);
            setTimeout(() => setSelectedStudentId(editingStudentId), 100);
          }
        }}
        studentId={editingStudentId}
      />

      {/* Deactivate Single Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setStudentToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Deactivate Student Profile"
        message={`Are you sure you want to deactivate ${studentToDelete?.name || "this student"}? This will suspend their portal access immediately.`}
        confirmText="Deactivate"
        isDestructive={true}
        isLoading={deactivating}
      />

      {/* Bulk Deactivate Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={bulkConfirmOpen}
        onClose={() => setBulkConfirmOpen(false)}
        onConfirm={handleBulkDeactivate}
        title="Bulk Deactivate Student Profiles"
        message={`Are you sure you want to deactivate the ${selectedStudentIds.size} selected student profiles? This will block their access immediately.`}
        confirmText="Deactivate All"
        isDestructive={true}
        isLoading={bulkProcessing}
      />
    </div>
  );
}
