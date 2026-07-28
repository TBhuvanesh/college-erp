"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useFaculty, useDepartments } from "@/hooks/useRegistry";
import { apiFetch } from "@/lib/api";
import { 
  Sparkles,
  Plus,
  Edit,
  Trash2,
  Eye,
  X,
  BookOpen,
  Mail
} from "lucide-react";
import { FacultyFormDrawer } from "@/components/FacultyFormDrawer";
import { SkeletonTable } from "@/components/UX/SkeletonLoaders";
import { EmptyState } from "@/components/UX/EmptyState";
import { UnifiedPagination } from "@/components/UX/UnifiedPagination";
import { UnifiedSearchBar } from "@/components/UX/UnifiedSearchBar";
import { ConfirmationDialog } from "@/components/UX/ConfirmationDialog";

interface FacultyDetail {
  id: string;
  userId: string;
  employeeNumber: string;
  fullName: string;
  email: string;
  department: { id: string; name: string; code: string };
  designation: string;
  status: string;
  createdAt: string;
}

const DESIGNATION_LABELS: Record<string, string> = {
  professor: "Professor",
  associate_professor: "Associate Professor",
  assistant_professor: "Assistant Professor",
  lecturer: "Lecturer",
  hod: "HOD (Head of Department)"
};

function getFacultySpecialization(departmentName: string, employeeNumber: string): string {
  const code = (departmentName || "").toLowerCase();
  if (code.includes("computer") || code.includes("cse")) {
    return "Distributed Systems & Machine Learning";
  }
  if (code.includes("electronic") || code.includes("ece")) {
    return "VLSI Design & Signal Processing";
  }
  if (code.includes("artificial") || code.includes("aiml")) {
    return "Deep Learning & NLP Models";
  }
  if (code.includes("data science") || code.includes("ds")) {
    return "Big Data Infrastructure & Analytics";
  }
  return "Advanced Engineering Research";
}

export default function AdminFaculty() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  // Filter persistence using localStorage
  const [searchTerm, setSearchTerm] = useState("");
  const [deptFilter, setDeptFilter] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("erp_faculty_deptFilter") || "ALL";
    }
    return "ALL";
  });
  const [designationFilter, setDesignationFilter] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("erp_faculty_designationFilter") || "ALL";
    }
    return "ALL";
  });
  const [statusFilter, setStatusFilter] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("erp_faculty_statusFilter") || "ALL";
    }
    return "ALL";
  });

  useEffect(() => {
    localStorage.setItem("erp_faculty_deptFilter", deptFilter);
  }, [deptFilter]);

  useEffect(() => {
    localStorage.setItem("erp_faculty_designationFilter", designationFilter);
  }, [designationFilter]);

  useEffect(() => {
    localStorage.setItem("erp_faculty_statusFilter", statusFilter);
  }, [statusFilter]);

  // Pagination state
  const [page, setPage] = useState(1);
  const limit = 10;

  // Drawer / Modals selectors
  const [selectedFacultyId, setSelectedFacultyId] = useState<string | null>(null);
  const [selectedFaculty, setSelectedFaculty] = useState<FacultyDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [formDrawerOpen, setFormDrawerOpen] = useState(false);
  const [editingFacultyId, setEditingFacultyId] = useState<string | null>(null);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [facultyToDelete, setFacultyToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  const [toastMsg, setToastMsg] = useState("");

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3500);
  };

  // Reset page when filter inputs change
  useEffect(() => {
    setPage(1);
  }, [searchTerm, deptFilter, designationFilter, statusFilter]);

  // Fetch departments for filter option
  const { data: departmentsData = [] } = useDepartments();

  // Fetch faculty registry list
  const facultyQueryFilters = useMemo(() => ({
    page,
    limit,
    search: searchTerm,
    departmentId: deptFilter,
    status: statusFilter,
  }), [page, limit, searchTerm, deptFilter, statusFilter]);

  const {
    data: facultyResult,
    isLoading: loadingFaculty,
    error: facultyError,
  } = useFaculty(facultyQueryFilters);

  const rawFacultyList = facultyResult?.faculty || [];
  const totalPages = facultyResult?.pagination?.totalPages || 1;
  const totalFaculty = facultyResult?.pagination?.total || 0;

  // Client-side designation filtering (since API doesn't handle designation directly, or does it? Keep filter behavior safe)
  const facultyList = useMemo(() => {
    if (designationFilter === "ALL") return rawFacultyList;
    return rawFacultyList.filter((f: any) => f.designation === designationFilter);
  }, [rawFacultyList, designationFilter]);

  // Fetch individual faculty profile details
  useEffect(() => {
    if (!selectedFacultyId) {
      setSelectedFaculty(null);
      return;
    }

    const fetchDetail = async () => {
      setLoadingDetail(true);
      try {
        const res = await apiFetch(`/faculty/${selectedFacultyId}`, {}, accessToken);
        if (res.success && res.data?.faculty) {
          setSelectedFaculty(res.data.faculty);
        }
      } catch (err: any) {
        triggerToast(err.message || "Failed to load faculty record");
        setSelectedFacultyId(null);
      } finally {
        setLoadingDetail(false);
      }
    };

    fetchDetail();
  }, [selectedFacultyId, accessToken]);

  // Timetable assignments mapping for workload overview (replaces simulation fallback)
  const [workloads, setWorkloads] = useState<any[]>([]);
  const [loadingWorkload, setLoadingWorkload] = useState(false);

  useEffect(() => {
    if (!selectedFaculty) {
      setWorkloads([]);
      return;
    }
    const fetchTimetableLoad = async () => {
      setLoadingWorkload(true);
      try {
        const res = await apiFetch(`/teaching-assignments?facultyId=${selectedFaculty.id}&status=active`, {}, accessToken);
        const assignments = res.data?.assignments || res.data || [];
        setWorkloads(assignments);
      } catch (err) {
        console.error("Failed to load faculty workloads", err);
        setWorkloads([]);
      } finally {
        setLoadingWorkload(false);
      }
    };
    fetchTimetableLoad();
  }, [selectedFaculty, accessToken]);

  const handleDeleteConfirm = async () => {
    if (!facultyToDelete) return;
    setDeactivating(true);
    try {
      const res = await apiFetch(`/faculty/${facultyToDelete.id}`, { method: "DELETE" }, accessToken);
      if (res.success) {
        triggerToast("Faculty profile deactivated successfully");
        queryClient.invalidateQueries({ queryKey: ["faculty"] });
        if (facultyToDelete.id === selectedFacultyId) {
          setSelectedFacultyId(null);
        }
      }
    } catch (err: any) {
      triggerToast(err.message || "Failed to deactivate faculty profile");
    } finally {
      setDeactivating(false);
      setDeleteConfirmOpen(false);
      setFacultyToDelete(null);
    }
  };

  const handleResetFilters = () => {
    setSearchTerm("");
    setDeptFilter("ALL");
    setDesignationFilter("ALL");
    setStatusFilter("ALL");
  };

  return (
    <div className="relative">
      {/* Toast alert */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-indigo-600 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-xl shadow-indigo-600/20 border border-indigo-400/20 animate-fade-in">
          <Sparkles size={14} className="animate-pulse" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="font-display font-bold text-2xl dark:text-white text-text-primary">Faculty Directory</h2>
          <p className="text-xs dark:text-neutral-400 text-text-secondary mt-1">
            Review active professors, department mappings, and subject workloads.
          </p>
        </div>
        <button
          onClick={() => {
            setEditingFacultyId(null);
            setFormDrawerOpen(true);
          }}
          className="px-4 py-2 text-xs font-semibold rounded bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer transition flex items-center gap-1.5 self-start md:self-auto border-none shadow-md shadow-indigo-600/10 select-none"
        >
          <Plus size={14} />
          <span>Register Faculty</span>
        </button>
      </div>

      {/* Filters */}
      <div className="glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl p-4 mb-6 flex flex-col md:flex-row gap-3">
        {/* Search */}
        <UnifiedSearchBar
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search by name, email, or employee number..."
          className="flex-1"
        />

        {/* Dept Filter */}
        <div className="w-full md:w-48 flex items-center gap-2 dark:bg-neutral-955 bg-background border dark:border-neutral-850 border-border-subtle rounded px-2 text-xs dark:text-white text-text-primary">
          <span className="dark:text-neutral-500 text-text-secondary">Dept:</span>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="bg-transparent dark:text-white text-text-primary cursor-pointer py-2 flex-1 focus:outline-none"
          >
            <option value="ALL">All Departments</option>
            {departmentsData.map((dept: any) => (
              <option key={dept.id} value={dept.id}>
                {dept.code}
              </option>
            ))}
          </select>
        </div>

        {/* Designation Filter */}
        <div className="w-full md:w-48 flex items-center gap-2 dark:bg-neutral-955 bg-background border dark:border-neutral-850 border-border-subtle rounded px-2 text-xs dark:text-white text-text-primary">
          <span className="dark:text-neutral-500 text-text-secondary">Role:</span>
          <select
            value={designationFilter}
            onChange={(e) => setDesignationFilter(e.target.value)}
            className="bg-transparent dark:text-white text-text-primary cursor-pointer py-2 flex-1 focus:outline-none"
          >
            <option value="ALL">All Designations</option>
            {Object.entries(DESIGNATION_LABELS).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="w-full md:w-48 flex items-center gap-2 dark:bg-neutral-955 bg-background border dark:border-neutral-850 border-border-subtle rounded px-2 text-xs dark:text-white text-text-primary">
          <span className="dark:text-neutral-500 text-text-secondary">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-transparent dark:text-white text-text-primary cursor-pointer py-2 flex-1 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </div>

      {/* Main Table Grid split (70% table / 30% detail drawer overlay) */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Data List Table */}
        <div className="flex-1 w-full bg-surface border border-border-subtle rounded-xl overflow-hidden">
          {facultyError && (
            <div className="p-4 bg-rose-500/10 border-b border-border-subtle text-rose-400 text-xs font-semibold font-mono">
              Error loading registry. Please retry.
            </div>
          )}

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto max-h-[600px] overflow-y-auto relative">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-surface/90 backdrop-blur border-b border-border-subtle shadow-sm">
                <tr className="text-text-muted font-semibold">
                  <th className="px-4 py-3 font-mono">Faculty ID</th>
                  <th className="px-4 py-3">Faculty</th>
                  <th className="px-4 py-3 font-mono">Employee ID</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Designation</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-text-secondary">
                {loadingFaculty ? (
                  <tr>
                    <td colSpan={7} className="p-0">
                      <SkeletonTable cols={7} rows={8} />
                    </td>
                  </tr>
                ) : facultyList.length > 0 ? (
                  facultyList.map((fac: any) => (
                    <tr
                      key={fac.id}
                      tabIndex={0}
                      className={`hover:bg-surface/40 transition cursor-pointer outline-none focus:bg-surface-elevated/50 ${
                        selectedFacultyId === fac.id ? "bg-indigo-600/10 border-l-2 border-l-indigo-600" : ""
                      }`}
                      onClick={() => setSelectedFacultyId(fac.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") setSelectedFacultyId(fac.id);
                      }}
                    >
                      <td className="px-4 py-3 font-mono text-[10px] text-text-muted select-all" title={fac.id}>
                        {fac.id.substring(0, 8)}...
                      </td>
                      <td className="px-4 py-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-surface-elevated border border-neutral-700 flex items-center justify-center font-bold text-indigo-400 shrink-0">
                          {fac.fullName.charAt(0)}
                        </div>
                        <div>
                          <span className="font-semibold text-text-primary block">{fac.fullName}</span>
                          <span className="text-[10px] text-text-muted">{fac.email}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono">{fac.employeeNumber}</td>
                      <td className="px-4 py-3">{fac.departmentName}</td>
                      <td className="px-4 py-3 capitalize">
                        {DESIGNATION_LABELS[fac.designation] || fac.designation.replace("_", " ")}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border capitalize ${
                            fac.status === "active"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : "bg-neutral-500/10 text-text-muted border-neutral-500/20"
                          }`}
                        >
                          {fac.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setSelectedFacultyId(fac.id)}
                            title="View Faculty File"
                            className="p-1.5 rounded bg-surface-elevated hover:bg-neutral-700 border border-neutral-700 text-text-muted hover:text-text-primary cursor-pointer"
                          >
                            <Eye size={12} />
                          </button>
                          <button
                            onClick={() => {
                              setEditingFacultyId(fac.id);
                              setFormDrawerOpen(true);
                            }}
                            title="Edit Faculty"
                            className="p-1.5 rounded bg-surface-elevated hover:bg-surface-hover border border-neutral-700 text-text-muted hover:text-text-primary cursor-pointer"
                          >
                            <Edit size={12} />
                          </button>
                          <button
                            onClick={() => {
                              setFacultyToDelete({ id: fac.id, name: fac.fullName });
                              setDeleteConfirmOpen(true);
                            }}
                            title="Deactivate Faculty"
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
                    <td colSpan={7} className="p-6">
                      <EmptyState
                        title="No Faculty Members Found"
                        description="No faculty directory profiles match the current filter selection."
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
            {loadingFaculty ? (
              <div className="p-4 space-y-4">
                <div className="h-20 bg-neutral-100 dark:bg-neutral-800 rounded animate-pulse" />
                <div className="h-20 bg-neutral-100 dark:bg-neutral-800 rounded animate-pulse" />
              </div>
            ) : facultyList.length > 0 ? (
              facultyList.map((fac: any) => (
                <div
                  key={fac.id}
                  className={`p-4 hover:bg-surface/10 transition cursor-pointer flex flex-col gap-2.5 ${
                    selectedFacultyId === fac.id ? "bg-indigo-600/5 border-l-2 border-l-indigo-600" : ""
                  }`}
                  onClick={() => setSelectedFacultyId(fac.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-surface-elevated border border-neutral-700 flex items-center justify-center font-bold text-indigo-400 shrink-0">
                        {fac.fullName.charAt(0)}
                      </div>
                      <div>
                        <span className="font-semibold text-text-primary block">{fac.fullName}</span>
                        <span className="text-[10px] text-text-muted">{fac.email}</span>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-bold border capitalize ${
                        fac.status === "active"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-neutral-500/10 text-neutral-405 border-neutral-500/20"
                      }`}
                    >
                      {fac.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-[10px] text-text-secondary font-mono mt-1">
                    <div>
                      <span className="text-text-muted block text-[9px] uppercase font-bold tracking-wider">Faculty ID</span>
                      <span className="select-all" title={fac.id}>{fac.id.substring(0, 8)}...</span>
                    </div>
                    <div>
                      <span className="text-text-muted block text-[9px] uppercase font-bold tracking-wider">Employee ID</span>
                      <span>{fac.employeeNumber}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500 block text-[9px] uppercase font-bold tracking-wider">Department</span>
                      <span>{fac.departmentName}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500 block text-[9px] uppercase font-bold tracking-wider">Designation</span>
                      <span>{DESIGNATION_LABELS[fac.designation] || fac.designation.replace("_", " ")}</span>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setSelectedFacultyId(fac.id)}
                      className="p-1.5 rounded dark:bg-neutral-855 bg-neutral-100 dark:hover:bg-neutral-800 hover:bg-neutral-200 border dark:border-neutral-800 border-border-subtle dark:text-neutral-400 text-text-secondary dark:hover:text-white hover:text-text-primary transition flex items-center gap-1 text-[10px] cursor-pointer"
                    >
                      <Eye size={12} />
                      <span>View</span>
                    </button>
                    <button
                      onClick={() => {
                        setEditingFacultyId(fac.id);
                        setFormDrawerOpen(true);
                      }}
                      className="p-1.5 rounded dark:bg-neutral-855 bg-neutral-100 dark:hover:bg-neutral-800 hover:bg-neutral-200 border dark:border-neutral-800 border-border-subtle dark:text-neutral-400 text-text-secondary dark:hover:text-white hover:text-text-primary transition flex items-center gap-1 text-[10px] cursor-pointer"
                    >
                      <Edit size={12} />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => {
                        setFacultyToDelete({ id: fac.id, name: fac.fullName });
                        setDeleteConfirmOpen(true);
                      }}
                      className="p-1.5 rounded dark:bg-neutral-855 bg-neutral-100 dark:hover:bg-neutral-800 hover:bg-neutral-200 border dark:border-neutral-800 border-border-subtle text-rose-500 hover:text-rose-600 transition flex items-center gap-1 text-[10px] cursor-pointer"
                    >
                      <Trash2 size={12} />
                      <span>Deactivate</span>
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                title="No Faculty Members Found"
                description="No faculty roster profiles match the current filter selection."
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
          {!loadingFaculty && facultyList.length > 0 && (
            <UnifiedPagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              totalItems={totalFaculty}
              itemsPerPage={limit}
            />
          )}
        </div>

        {/* Right Side Slide-out Details Drawer (renders if student selected) */}
        {selectedFacultyId && (
          <div className="w-full lg:w-96 glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl p-5 shadow-2xl relative animate-scale-up shrink-0">
            {loadingDetail ? (
              <div className="py-20 flex flex-col items-center justify-center dark:text-neutral-500 text-text-muted">
                <span className="text-xs font-mono">Fetching record...</span>
              </div>
            ) : selectedFaculty ? (
              <>
                {/* Header close */}
                <div className="flex items-center justify-between border-b dark:border-neutral-800 border-border-subtle pb-3 mb-4">
                  <h3 className="font-display font-bold dark:text-white text-text-primary text-base">Faculty Service File</h3>
                  <button
                    onClick={() => setSelectedFacultyId(null)}
                    className="p-1 rounded dark:bg-neutral-850 bg-neutral-100 dark:hover:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-400 text-text-secondary dark:hover:text-white hover:text-text-primary cursor-pointer border dark:border-neutral-800 border-border-subtle"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Profile Brief */}
                <div className="flex items-center gap-4 mb-5 p-3 rounded-lg dark:bg-neutral-955/50 bg-background border dark:border-neutral-900 border-border-subtle">
                  <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center font-bold text-indigo-400 text-lg">
                    {selectedFaculty.fullName.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold dark:text-white text-text-primary truncate">{selectedFaculty.fullName}</h4>
                    <p className="text-[10px] dark:text-neutral-500 text-text-secondary font-mono mt-0.5">
                      {selectedFaculty.employeeNumber} / {selectedFaculty.department?.code || "N/A"}
                    </p>
                    <span className="text-[9px] dark:text-neutral-605 text-text-muted font-mono mt-0.5 block">
                      Onboarded: {new Date(selectedFaculty.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Status and details */}
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                  {/* Info Blocks */}
                  <div className="p-3.5 dark:bg-neutral-955/40 bg-background border dark:border-neutral-900 border-border-subtle rounded-lg space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="dark:text-neutral-500 text-text-secondary">Faculty ID:</span>
                      <span className="dark:text-white text-text-primary font-mono text-[10px] select-all truncate max-w-[180px]" title={selectedFaculty.id}>
                        {selectedFaculty.id}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="dark:text-neutral-500 text-text-secondary">Employee ID:</span>
                      <span className="dark:text-white text-text-primary font-mono">{selectedFaculty.employeeNumber}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="dark:text-neutral-500 text-text-secondary">Designation:</span>
                      <strong className="dark:text-white text-text-primary capitalize">
                        {DESIGNATION_LABELS[selectedFaculty.designation] || selectedFaculty.designation.replace("_", " ")}
                      </strong>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="dark:text-neutral-500 text-text-secondary">Specialization:</span>
                      <strong className="dark:text-white text-text-primary text-right">
                        {getFacultySpecialization(selectedFaculty.department?.name || "", selectedFaculty.employeeNumber)}
                      </strong>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="dark:text-neutral-500 text-text-secondary">Email:</span>
                      <span className="dark:text-white text-text-primary font-mono text-[10px] select-all flex items-center gap-1">
                        <Mail size={10} className="dark:text-neutral-500 text-text-muted" />
                        {selectedFaculty.email}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="dark:text-neutral-500 text-text-secondary">Status:</span>
                      <strong className="capitalize text-indigo-400">{selectedFaculty.status.replace("_", " ")}</strong>
                    </div>
                  </div>

                  {/* Workload list */}
                  <div>
                    <h5 className="text-[10px] uppercase font-bold dark:text-neutral-400 text-text-secondary flex items-center gap-1.5 mb-2">
                      <BookOpen size={12} className="text-indigo-400" />
                      <span>Timetable Workloads ({workloads.length})</span>
                    </h5>
                    <div className="space-y-1.5">
                      {loadingWorkload ? (
                        <div className="h-10 bg-neutral-100 dark:bg-neutral-800 rounded animate-pulse" />
                      ) : workloads.length > 0 ? (
                        workloads.map((ta: any, i: number) => (
                          <div
                            key={i}
                            className="p-2 rounded dark:bg-neutral-955/20 bg-background border dark:border-neutral-900 border-border-subtle flex items-center justify-between text-xs"
                          >
                            <div>
                              <span className="dark:text-white text-text-primary font-medium block">
                                {ta.subjectName} ({ta.subjectCode})
                              </span>
                              <span className="text-[9px] dark:text-neutral-500 text-text-muted">
                                Section {ta.section || "N/A"}
                              </span>
                            </div>
                            <span className="text-[9px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded px-1.5 py-0.5 font-bold font-mono">
                              Sem {ta.semester}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-[10px] dark:text-neutral-600 text-text-muted font-mono italic">
                          No active workloads mapped in timetable indexes.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-10 dark:text-neutral-500 text-text-muted text-xs font-mono">
                Failed to load profile record.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Form Drawer (Add/Edit Faculty) */}
      <FacultyFormDrawer
        isOpen={formDrawerOpen}
        onClose={() => {
          setFormDrawerOpen(false);
          setEditingFacultyId(null);
        }}
        onSuccess={(msg) => {
          triggerToast(msg);
          queryClient.invalidateQueries({ queryKey: ["faculty"] });
          if (editingFacultyId === selectedFacultyId) {
            setSelectedFacultyId(null);
            setTimeout(() => setSelectedFacultyId(editingFacultyId), 100);
          }
        }}
        facultyId={editingFacultyId}
      />

      {/* Deactivate Modal */}
      <ConfirmationDialog
        isOpen={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setFacultyToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Deactivate Faculty Profile"
        message={`Are you sure you want to deactivate ${facultyToDelete?.name || "this faculty member"}? This will suspend their portal access immediately.`}
        confirmText="Deactivate"
        isDestructive={true}
        isLoading={deactivating}
      />
    </div>
  );
}
