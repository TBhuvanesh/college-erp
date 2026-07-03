"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSimulation } from "@/context/SimulationContext";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { 
  Search, 
  Filter, 
  Eye, 
  ChevronRight, 
  ChevronLeft,
  X, 
  BookOpen, 
  Mail,
  Sparkles,
  Plus,
  Edit,
  Trash2,
  Loader2,
  CheckCircle
} from "lucide-react";
import { FacultyFormDrawer } from "@/components/FacultyFormDrawer";
import { FacultyDeleteModal } from "@/components/FacultyDeleteModal";

interface Department {
  id: string;
  name: string;
  code: string;
}

interface FacultySummary {
  id: string;
  employeeNumber: string;
  fullName: string;
  email: string;
  departmentName: string;
  designation: string;
  status: string;
}

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
  const { faculty: simFaculty } = useSimulation();

  // Lists & configs state
  const [facultyList, setFacultyList] = useState<FacultySummary[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  // Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [designationFilter, setDesignationFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalFaculty, setTotalFaculty] = useState(0);

  // Loaders / Messages
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState("");

  // Drawer / Modals selectors
  const [selectedFacultyId, setSelectedFacultyId] = useState<string | null>(null);
  const [selectedFaculty, setSelectedFaculty] = useState<FacultyDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [formDrawerOpen, setFormDrawerOpen] = useState(false);
  const [editingFacultyId, setEditingFacultyId] = useState<string | null>(null);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [facultyToDelete, setFacultyToDelete] = useState<{ id: string; name: string } | null>(null);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  };

  // Fetch departments list for filtering
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const res = await apiFetch("/departments", {}, accessToken);
        if (res.success && res.data?.departments) {
          setDepartments(res.data.departments);
        }
      } catch (err) {
        console.error("Failed to load departments", err);
      }
    };
    fetchDepartments();
  }, [accessToken]);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1); // Reset to first page
    }, 350);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Fetch faculty list
  const fetchFaculty = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (debouncedSearch.trim()) {
        queryParams.append("search", debouncedSearch.trim());
      }
      if (deptFilter !== "ALL") {
        queryParams.append("departmentId", deptFilter);
      }
      if (designationFilter !== "ALL") {
        queryParams.append("designation", designationFilter);
      }
      if (statusFilter !== "ALL") {
        queryParams.append("status", statusFilter.toLowerCase());
      }

      const res = await apiFetch(`/faculty?${queryParams.toString()}`, {}, accessToken);

      if (res.success && res.data) {
        setFacultyList(res.data.faculty || []);
        if (res.data.pagination) {
          setTotalPages(res.data.pagination.totalPages || 1);
          setTotalFaculty(res.data.pagination.total || 0);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load faculty directory");
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, deptFilter, designationFilter, statusFilter, accessToken]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchFaculty();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchFaculty]);

  // Fetch individual faculty profile
  useEffect(() => {
    const timer = setTimeout(() => {
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
    }, 0);

    return () => clearTimeout(timer);
  }, [selectedFacultyId, accessToken]);

  // Match backend faculty member to simulation workloads in context
  const getSimulatedWorkload = (fullName: string) => {
    const matched = simFaculty.find(
      (f) => f.name.toLowerCase() === fullName.toLowerCase()
    );
    return matched ? matched.assignedSubjects : [];
  };

  const workload = selectedFaculty ? getSimulatedWorkload(selectedFaculty.fullName) : [];

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
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 dark:text-neutral-500 text-text-muted" />
          <input
            type="text"
            placeholder="Search by name, email, or employee number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs dark:bg-neutral-955 bg-background border dark:border-neutral-850 border-border-subtle rounded dark:text-white text-text-primary focus:outline-none focus:border-blue-500/50 transition"
          />
        </div>

        {/* Dept Filter */}
        <div className="w-full md:w-48 flex items-center gap-2 dark:bg-neutral-955 bg-background border dark:border-neutral-850 border-border-subtle rounded px-2 text-xs dark:text-white text-text-primary">
          <Filter size={12} className="dark:text-neutral-500 text-text-muted shrink-0" />
          <span className="dark:text-neutral-500 text-text-secondary">Dept:</span>
          <select
            value={deptFilter}
            onChange={(e) => {
              setDeptFilter(e.target.value);
              setPage(1);
            }}
            className="bg-transparent dark:text-white text-text-primary cursor-pointer py-2 flex-1 focus:outline-none"
          >
            <option value="ALL">All Departments</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.code}
              </option>
            ))}
          </select>
        </div>

        {/* Designation Filter */}
        <div className="w-full md:w-48 flex items-center gap-2 dark:bg-neutral-955 bg-background border dark:border-neutral-850 border-border-subtle rounded px-2 text-xs dark:text-white text-text-primary">
          <Filter size={12} className="dark:text-neutral-500 text-text-muted shrink-0" />
          <span className="dark:text-neutral-500 text-text-secondary">Rank:</span>
          <select
            value={designationFilter}
            onChange={(e) => {
              setDesignationFilter(e.target.value);
              setPage(1);
            }}
            className="bg-transparent dark:text-white text-text-primary cursor-pointer py-2 flex-1 focus:outline-none"
          >
            <option value="ALL">All Designations</option>
            <option value="professor">Professor</option>
            <option value="associate_professor">Associate Professor</option>
            <option value="assistant_professor">Assistant Professor</option>
            <option value="lecturer">Lecturer</option>
            <option value="hod">HOD (Head of Department)</option>
          </select>
        </div>

        {/* Status Filter */}
        <div className="w-full md:w-48 flex items-center gap-2 dark:bg-neutral-955 bg-background border dark:border-neutral-850 border-border-subtle rounded px-2 text-xs dark:text-white text-text-primary">
          <Filter size={12} className="dark:text-neutral-500 text-text-muted shrink-0" />
          <span className="dark:text-neutral-500 text-text-secondary">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="bg-transparent dark:text-white text-text-primary cursor-pointer py-2 flex-1 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="ON_LEAVE">On Leave</option>
            <option value="RESIGNED">Resigned</option>
            <option value="RETIRED">Retired</option>
          </select>
        </div>
      </div>

      {/* Main Grid table */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Table container */}
        <div className="flex-1 w-full glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl overflow-hidden">
          {error && (
            <div className="p-4 bg-rose-500/10 border-b dark:border-neutral-800 border-border-subtle text-rose-600 dark:text-rose-400 text-xs font-semibold font-mono">
              Error: {error}
            </div>
          )}

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="dark:bg-neutral-900/50 bg-neutral-100 border-b dark:border-neutral-800 border-border-subtle dark:text-neutral-400 text-text-secondary font-semibold">
                  <th className="px-4 py-3 font-mono">Faculty ID</th>
                  <th className="px-4 py-3 font-mono">Employee ID</th>
                  <th className="px-4 py-3">Faculty</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Designation</th>
                  <th className="px-4 py-3">Specialization</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-neutral-900 divide-border-subtle dark:text-neutral-300 text-text-secondary">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 dark:text-neutral-500 text-text-muted">
                      <Loader2 className="animate-spin text-indigo-500 mx-auto mb-2" size={20} />
                      <span className="font-mono text-[10px]">Accessing faculty registry...</span>
                    </td>
                  </tr>
                ) : facultyList.length > 0 ? (
                  facultyList.map((fac) => (
                    <tr
                      key={fac.id}
                      className={`dark:hover:bg-neutral-900/30 hover:bg-neutral-100/50 transition cursor-pointer ${
                        selectedFacultyId === fac.id ? "dark:bg-indigo-600/10 bg-indigo-50 border-l-2 border-l-indigo-600 dark:text-indigo-300 text-indigo-750" : ""
                      }`}
                      onClick={() => setSelectedFacultyId(fac.id)}
                    >
                      <td className="px-4 py-3 font-mono text-[10px] dark:text-neutral-500 text-text-muted select-all" title={fac.id}>
                        {fac.id.substring(0, 8)}...
                      </td>
                      <td className="px-4 py-3 font-mono dark:text-neutral-300 text-text-primary">{fac.employeeNumber}</td>
                      <td className="px-4 py-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full dark:bg-neutral-800 bg-neutral-200 border dark:border-neutral-700 border-border-subtle flex items-center justify-center font-bold text-indigo-550 dark:text-indigo-400 shrink-0">
                          {fac.fullName.charAt(0)}
                        </div>
                        <div>
                          <span className="font-semibold dark:text-white text-text-primary block">{fac.fullName}</span>
                          <span className="text-[10px] dark:text-neutral-500 text-text-secondary">{fac.email}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 dark:text-neutral-300 text-text-secondary">{fac.departmentName}</td>
                      <td className="px-4 py-3 dark:text-neutral-300 text-text-secondary capitalize">
                        {DESIGNATION_LABELS[fac.designation] || fac.designation.replace("_", " ")}
                      </td>
                      <td className="px-4 py-3 dark:text-neutral-300 text-text-secondary truncate max-w-[150px]" title={getFacultySpecialization(fac.departmentName, fac.employeeNumber)}>
                        {getFacultySpecialization(fac.departmentName, fac.employeeNumber)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border capitalize ${
                            fac.status === "active"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                              : fac.status === "on_leave"
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                              : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                          }`}
                        >
                          {fac.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setSelectedFacultyId(fac.id)}
                            title="View Faculty Details"
                            className="p-1.5 rounded dark:bg-neutral-800 bg-neutral-100 dark:hover:bg-neutral-700 hover:bg-neutral-200 border dark:border-neutral-700 border-border-subtle dark:text-neutral-400 text-text-secondary dark:hover:text-white hover:text-text-primary cursor-pointer transition"
                          >
                            <Eye size={12} />
                          </button>
                          <button
                            onClick={() => {
                              setEditingFacultyId(fac.id);
                              setFormDrawerOpen(true);
                            }}
                            title="Edit Faculty"
                            className="p-1.5 rounded dark:bg-neutral-800 bg-neutral-100 dark:hover:bg-neutral-750 hover:bg-neutral-200 border dark:border-neutral-700 border-border-subtle dark:text-neutral-400 text-text-secondary dark:hover:text-white hover:text-text-primary cursor-pointer transition"
                          >
                            <Edit size={12} />
                          </button>
                          <button
                            onClick={() => {
                              setFacultyToDelete({ id: fac.id, name: fac.fullName });
                              setDeleteConfirmOpen(true);
                            }}
                            title="Deactivate Faculty"
                            className="p-1.5 rounded dark:bg-neutral-800 bg-neutral-105 dark:hover:bg-neutral-750 hover:bg-rose-50 border dark:border-neutral-700 border-border-subtle text-rose-500 hover:text-rose-600 cursor-pointer transition"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="text-center py-12 dark:text-neutral-500 text-text-muted font-mono">
                      No matching faculty profiles found in registry.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="block md:hidden divide-y divide-neutral-900">
            {loading ? (
              <div className="text-center py-12 text-neutral-500">
                <Loader2 className="animate-spin text-indigo-500 mx-auto mb-2" size={20} />
                <span className="font-mono text-[10px]">Accessing faculty registry...</span>
              </div>
            ) : facultyList.length > 0 ? (
              facultyList.map((fac) => (
                <div
                  key={fac.id}
                  className={`p-4 dark:hover:bg-neutral-900/10 hover:bg-neutral-100/50 transition cursor-pointer flex flex-col gap-2.5 ${
                    selectedFacultyId === fac.id ? "bg-indigo-600/5 border-l-2 border-l-indigo-600" : ""
                  }`}
                  onClick={() => setSelectedFacultyId(fac.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full dark:bg-neutral-800 bg-neutral-100 border dark:border-neutral-700 border-border-subtle flex items-center justify-center font-bold text-indigo-400 shrink-0">
                        {fac.fullName.charAt(0)}
                      </div>
                      <div>
                        <span className="font-semibold dark:text-white text-text-primary block">{fac.fullName}</span>
                        <span className="text-[10px] dark:text-neutral-500 text-text-secondary">{fac.email}</span>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-bold border capitalize ${
                        fac.status === "active"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : fac.status === "on_leave"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                      }`}
                    >
                      {fac.status.replace("_", " ")}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-[10px] dark:text-neutral-300 text-text-secondary font-mono mt-1">
                    <div>
                      <span className="dark:text-neutral-500 text-text-muted block text-[9px] uppercase font-bold tracking-wider">Faculty ID</span>
                      <span className="select-all" title={fac.id}>{fac.id.substring(0, 8)}...</span>
                    </div>
                    <div>
                      <span className="dark:text-neutral-500 text-text-muted block text-[9px] uppercase font-bold tracking-wider">Employee ID</span>
                      <span>{fac.employeeNumber}</span>
                    </div>
                    <div>
                      <span className="dark:text-neutral-500 text-text-muted block text-[9px] uppercase font-bold tracking-wider">Department</span>
                      <span>{fac.departmentName}</span>
                    </div>
                    <div>
                      <span className="dark:text-neutral-500 text-text-muted block text-[9px] uppercase font-bold tracking-wider">Designation</span>
                      <span className="capitalize">{DESIGNATION_LABELS[fac.designation] || fac.designation.replace("_", " ")}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="dark:text-neutral-500 text-text-muted block text-[9px] uppercase font-bold tracking-wider">Specialization</span>
                      <span>{getFacultySpecialization(fac.departmentName, fac.employeeNumber)}</span>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setSelectedFacultyId(fac.id)}
                      className="p-1.5 rounded dark:bg-neutral-850 bg-neutral-100 dark:hover:bg-neutral-800 hover:bg-neutral-200 border dark:border-neutral-800 border-border-subtle dark:text-neutral-400 text-text-secondary dark:hover:text-white hover:text-text-primary transition flex items-center gap-1 text-[10px]"
                    >
                      <Eye size={12} />
                      <span>View</span>
                    </button>
                    <button
                      onClick={() => {
                        setEditingFacultyId(fac.id);
                        setFormDrawerOpen(true);
                      }}
                      className="p-1.5 rounded dark:bg-neutral-850 bg-neutral-100 dark:hover:bg-neutral-800 hover:bg-neutral-200 border dark:border-neutral-800 border-border-subtle dark:text-neutral-400 text-text-secondary dark:hover:text-white hover:text-text-primary transition flex items-center gap-1 text-[10px]"
                    >
                      <Edit size={12} />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => {
                        setFacultyToDelete({ id: fac.id, name: fac.fullName });
                        setDeleteConfirmOpen(true);
                      }}
                      className="p-1.5 rounded dark:bg-neutral-850 bg-neutral-100 dark:hover:bg-neutral-800 hover:bg-neutral-200 border dark:border-neutral-800 border-border-subtle text-rose-500 hover:text-rose-600 transition flex items-center gap-1 text-[10px]"
                    >
                      <Trash2 size={12} />
                      <span>Deactivate</span>
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 dark:text-neutral-500 text-text-muted font-mono text-xs">
                No matching faculty profiles found in registry.
              </div>
            )}
          </div>
        </div>

        {/* Right side Details Drawer */}
        {selectedFacultyId && (
          <div className="w-full lg:w-96 glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl p-5 shadow-2xl relative animate-scale-up shrink-0">
            {loadingDetail ? (
              <div className="py-20 flex flex-col items-center justify-center dark:text-neutral-500 text-text-muted">
                <Loader2 className="animate-spin text-indigo-500 mb-2" size={20} />
                <span className="font-mono text-[9px]">Fetching record...</span>
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
                      {selectedFaculty.employeeNumber} / {selectedFaculty.department.code}
                    </p>
                    <span className="text-[9px] dark:text-neutral-605 text-text-muted font-mono mt-0.5 block">
                      Onboarded: {new Date(selectedFaculty.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Status and details */}
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                  {/* Info Blocks */}
                  <div className="p-3.5 dark:bg-neutral-950/40 bg-background border dark:border-neutral-900 border-border-subtle rounded-lg space-y-2">
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
                        {getFacultySpecialization(selectedFaculty.department.name, selectedFaculty.employeeNumber)}
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

                  {/* Workload list matching simulated context */}
                  <div>
                    <h5 className="text-[10px] uppercase font-bold dark:text-neutral-400 text-text-secondary flex items-center gap-1.5 mb-2">
                      <BookOpen size={12} className="text-indigo-400" />
                      <span>Assigned Workloads ({workload.length})</span>
                    </h5>
                    <div className="space-y-1.5">
                      {workload.length > 0 ? (
                        workload.map((sub, i) => (
                          <div
                            key={i}
                            className="p-2 rounded dark:bg-neutral-950/20 bg-background border dark:border-neutral-900 border-border-subtle flex items-center justify-between text-xs"
                          >
                            <span className="dark:text-white text-text-primary font-medium truncate max-w-[190px]">
                              {sub.subjectName}
                            </span>
                            <span className="text-[9px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded px-1.5 py-0.5 font-bold font-mono">
                              {sub.semester}
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
          fetchFaculty();
          if (editingFacultyId === selectedFacultyId) {
            setSelectedFacultyId(null);
            setTimeout(() => setSelectedFacultyId(editingFacultyId), 100);
          }
        }}
        facultyId={editingFacultyId}
      />

      {/* Delete Modal */}
      <FacultyDeleteModal
        isOpen={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setFacultyToDelete(null);
        }}
        onSuccess={(msg) => {
          triggerToast(msg);
          fetchFaculty();
          if (facultyToDelete?.id === selectedFacultyId) {
            setSelectedFacultyId(null);
          }
        }}
        facultyId={facultyToDelete?.id || null}
        facultyName={facultyToDelete?.name || null}
      />
    </div>
  );
}
