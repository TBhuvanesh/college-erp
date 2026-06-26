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
  CreditCard, 
  Sparkles,
  Plus,
  Edit,
  Trash2,
  Loader2,
  CheckCircle
} from "lucide-react";
import { StudentFormDrawer } from "@/components/StudentFormDrawer";
import { DeleteConfirmationModal } from "@/components/DeleteConfirmationModal";

interface Department {
  id: string;
  name: string;
  code: string;
}

interface StudentSummary {
  id: string;
  rollNumber: string;
  fullName: string;
  email: string;
  departmentName: string;
  programName: string;
  semester: number;
  section?: string;
  academicYear: string;
  status: string;
}

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

export default function AdminStudents() {
  const { accessToken } = useAuth();
  const { attendanceLogs, grades, invoices } = useSimulation();

  // Filter & List state
  const [studentsList, setStudentsList] = useState<StudentSummary[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [semFilter, setSemFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalStudents, setTotalStudents] = useState(0);

  // Loading & error states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState("");

  // Drawer / Modal states
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<StudentDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [formDrawerOpen, setFormDrawerOpen] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<{ id: string; name: string } | null>(null);

  // Batch operations state
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = new Set(studentsList.map((s) => s.id));
      setSelectedStudentIds(allIds);
    } else {
      setSelectedStudentIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedStudentIds);
    if (checked) newSet.add(id);
    else newSet.delete(id);
    setSelectedStudentIds(newSet);
  };

  const handleBulkDeactivate = async () => {
    if (!confirm(`Are you sure you want to deactivate ${selectedStudentIds.size} selected students?`)) return;
    setBulkProcessing(true);
    let successCount = 0;
    try {
      for (const id of Array.from(selectedStudentIds)) {
        await apiFetch(`/students/${id}`, { method: "DELETE" }, accessToken);
        successCount++;
      }
      triggerToast(`Successfully deactivated ${successCount} students.`);
      setSelectedStudentIds(new Set());
      fetchStudents();
    } catch (err: any) {
      triggerToast(`Error during bulk action: ${err.message}`);
    } finally {
      setBulkProcessing(false);
    }
  };

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  };

  // Fetch departments list for filter
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const res = await apiFetch("/departments", {}, accessToken);
        if (res.success && res.data?.departments) {
          setDepartments(res.data.departments);
        }
      } catch (err: any) {
        console.error("Failed to load departments for filters", err);
      }
    };
    fetchDepartments();
  }, [accessToken]);

  // Debounce search term
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1); // Reset to page 1 on search change
      setSelectedStudentIds(new Set()); // Reset selection on filter change
    }, 350);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Fetch students list
  const fetchStudents = useCallback(async () => {
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
      if (semFilter !== "ALL") {
        queryParams.append("semester", semFilter);
      }
      if (statusFilter !== "ALL") {
        queryParams.append("status", statusFilter.toLowerCase());
      }

      const res = await apiFetch(`/students?${queryParams.toString()}`, {}, accessToken);
      
      if (res.success && res.data) {
        setStudentsList(res.data.students || []);
        if (res.data.pagination) {
          setTotalPages(res.data.pagination.totalPages || 1);
          setTotalStudents(res.data.pagination.total || 0);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load students registry");
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, deptFilter, semFilter, statusFilter, accessToken]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStudents();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchStudents]);

  // Fetch single student detail
  useEffect(() => {
    const timer = setTimeout(() => {
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
    }, 0);

    return () => clearTimeout(timer);
  }, [selectedStudentId, accessToken]);

  // Map backend student detail to frontend simulation metrics
  const getStudentMetrics = (studId: string, fullName: string) => {
    const logs = attendanceLogs.filter(
      (log) => log.studentId === studId || log.studentName.toLowerCase() === fullName.toLowerCase()
    );
    const totalHeld = logs.length;
    const present = logs.filter((log) => log.status === "Present" || log.status === "Late").length;
    const attPct = totalHeld > 0 ? ((present / totalHeld) * 100).toFixed(0) : "85";
    const finalAttPct = Math.min(Number(attPct), 100).toString();

    const studGrades = grades.filter(
      (g) => g.studentId === studId || g.studentId === fullName // or match any other fields if needed
    );
    const studInvoices = invoices.filter(
      (inv) => inv.studentId === studId || inv.studentName.toLowerCase() === fullName.toLowerCase()
    );
    const outstanding = studInvoices
      .filter((inv) => inv.status !== "Paid")
      .reduce((acc, curr) => acc + curr.amount, 0);

    return {
      attendancePct: finalAttPct,
      grades: studGrades,
      invoices: studInvoices,
      outstandingFees: outstanding,
    };
  };

  const metrics = selectedStudent ? getStudentMetrics(selectedStudent.id, selectedStudent.fullName) : null;

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
          <h2 className="font-display font-bold text-2xl text-white">Student Registry</h2>
          <p className="text-xs text-neutral-400 mt-1">
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
      <div className="glass-card border border-neutral-800 rounded-xl p-4 mb-6 flex flex-col md:flex-row gap-3">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-500" />
          <input
            type="text"
            placeholder="Search by name, email, or roll number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded text-white focus:outline-none focus:border-neutral-700"
          />
        </div>

        {/* Dept Filter */}
        <div className="w-full md:w-48 flex items-center gap-2 bg-neutral-950 border border-neutral-800 rounded px-2 text-xs text-white">
          <Filter size={12} className="text-neutral-500" />
          <span className="text-neutral-500">Dept:</span>
          <select
            value={deptFilter}
            onChange={(e) => {
              setDeptFilter(e.target.value);
              setPage(1);
            }}
            className="bg-transparent text-white cursor-pointer py-2 flex-1 focus:outline-none"
          >
            <option value="ALL">All Departments</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.code}
              </option>
            ))}
          </select>
        </div>

        {/* Semester Filter */}
        <div className="w-full md:w-48 flex items-center gap-2 bg-neutral-950 border border-neutral-800 rounded px-2 text-xs text-white">
          <Filter size={12} className="text-neutral-500" />
          <span className="text-neutral-500">Sem:</span>
          <select
            value={semFilter}
            onChange={(e) => {
              setSemFilter(e.target.value);
              setPage(1);
            }}
            className="bg-transparent text-white cursor-pointer py-2 flex-1 focus:outline-none"
          >
            <option value="ALL">All Semesters</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((sem) => (
              <option key={sem} value={sem.toString()}>
                Semester {sem}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="w-full md:w-48 flex items-center gap-2 bg-neutral-950 border border-neutral-800 rounded px-2 text-xs text-white">
          <Filter size={12} className="text-neutral-500" />
          <span className="text-neutral-500">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="bg-transparent text-white cursor-pointer py-2 flex-1 focus:outline-none"
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
        <div className="flex-1 w-full glass-card border border-neutral-800 rounded-xl overflow-hidden">
          {error && (
            <div className="p-4 bg-rose-500/10 border-b border-neutral-800 text-rose-400 text-xs font-semibold font-mono">
              Error: {error}
            </div>
          )}

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto max-h-[600px] overflow-y-auto relative">
            {/* Batch Action Bar */}
            {selectedStudentIds.size > 0 && (
              <div className="sticky top-0 left-0 right-0 z-20 bg-blue-600/90 backdrop-blur border-b border-blue-500/50 p-2.5 flex items-center justify-between animate-fade-in shadow-xl">
                <span className="text-xs font-bold text-white ml-2 flex items-center gap-2">
                  <CheckCircle size={14} />
                  {selectedStudentIds.size} student{selectedStudentIds.size > 1 ? "s" : ""} selected
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedStudentIds(new Set())}
                    className="px-3 py-1.5 rounded bg-blue-700 hover:bg-blue-800 text-white text-[10px] font-semibold transition"
                  >
                    Clear
                  </button>
                  <button
                    onClick={handleBulkDeactivate}
                    disabled={bulkProcessing}
                    className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-[10px] font-bold transition flex items-center gap-1.5 shadow-lg"
                  >
                    {bulkProcessing ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    Bulk Deactivate
                  </button>
                </div>
              </div>
            )}

            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-neutral-900/90 backdrop-blur border-b border-neutral-800 shadow-sm">
                <tr className="text-neutral-400 font-semibold">
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={studentsList.length > 0 && selectedStudentIds.size === studentsList.length}
                      onChange={handleSelectAll}
                      className="rounded bg-neutral-950 border-neutral-700 text-blue-500 focus:ring-0 cursor-pointer"
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
              <tbody className="divide-y divide-neutral-900 text-neutral-300">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-neutral-500">
                      <Loader2 className="animate-spin text-blue-500 mx-auto mb-2" size={20} />
                      <span className="font-mono text-[10px]">Accessing student registry...</span>
                    </td>
                  </tr>
                ) : studentsList.length > 0 ? (
                  studentsList.map((student) => (
                    <tr
                      key={student.id}
                      tabIndex={0}
                      className={`hover:bg-neutral-900/40 transition cursor-pointer outline-none focus:bg-neutral-800/50 ${
                        selectedStudentId === student.id ? "bg-blue-600/10 border-l-2 border-l-blue-600" : ""
                      } ${selectedStudentIds.has(student.id) ? "bg-neutral-900/50" : ""}`}
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
                          className="rounded bg-neutral-950 border-neutral-700 text-blue-500 focus:ring-0 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3 font-mono text-[10px] text-neutral-500 select-all" title={student.id}>
                        {student.id.substring(0, 8)}...
                      </td>
                      <td className="px-4 py-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center font-bold text-blue-400 shrink-0">
                          {student.fullName.charAt(0)}
                        </div>
                        <div>
                          <span className="font-semibold text-white block">{student.fullName}</span>
                          <span className="text-[10px] text-neutral-500">{student.email}</span>
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
                              : "bg-neutral-500/10 text-neutral-400 border-neutral-500/20"
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
                            className="p-1.5 rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-400 hover:text-white cursor-pointer"
                          >
                            <Eye size={12} />
                          </button>
                          <button
                            onClick={() => {
                              setEditingStudentId(student.id);
                              setFormDrawerOpen(true);
                            }}
                            title="Edit Student"
                            className="p-1.5 rounded bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 text-neutral-400 hover:text-white cursor-pointer"
                          >
                            <Edit size={12} />
                          </button>
                          <button
                            onClick={() => {
                              setStudentToDelete({ id: student.id, name: student.fullName });
                              setDeleteConfirmOpen(true);
                            }}
                            title="Deactivate Student"
                            className="p-1.5 rounded bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 text-rose-500 hover:text-rose-400 cursor-pointer"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-neutral-500 font-mono">
                      No matching student profiles found in registry.
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
                <Loader2 className="animate-spin text-blue-500 mx-auto mb-2" size={20} />
                <span className="font-mono text-[10px]">Accessing student registry...</span>
              </div>
            ) : studentsList.length > 0 ? (
              studentsList.map((student) => (
                <div
                  key={student.id}
                  className={`p-4 hover:bg-neutral-900/10 transition cursor-pointer flex flex-col gap-2.5 ${
                    selectedStudentId === student.id ? "bg-blue-600/5 border-l-2 border-l-blue-600" : ""
                  }`}
                  onClick={() => setSelectedStudentId(student.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center font-bold text-blue-400 shrink-0">
                        {student.fullName.charAt(0)}
                      </div>
                      <div>
                        <span className="font-semibold text-white block">{student.fullName}</span>
                        <span className="text-[10px] text-neutral-500">{student.email}</span>
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

                  <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-[10px] text-neutral-300 font-mono mt-1">
                    <div>
                      <span className="text-neutral-500 block text-[9px] uppercase font-bold tracking-wider">Student ID</span>
                      <span className="select-all" title={student.id}>{student.id.substring(0, 8)}...</span>
                    </div>
                    <div>
                      <span className="text-neutral-500 block text-[9px] uppercase font-bold tracking-wider">Roll Number</span>
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
                      <span className="text-neutral-500 block text-[9px] uppercase font-bold tracking-wider">Acad Year</span>
                      <span>{student.academicYear}</span>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setSelectedStudentId(student.id)}
                      className="p-1.5 rounded bg-neutral-850 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-white transition flex items-center gap-1 text-[10px]"
                    >
                      <Eye size={12} />
                      <span>View</span>
                    </button>
                    <button
                      onClick={() => {
                        setEditingStudentId(student.id);
                        setFormDrawerOpen(true);
                      }}
                      className="p-1.5 rounded bg-neutral-850 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-white transition flex items-center gap-1 text-[10px]"
                    >
                      <Edit size={12} />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => {
                        setStudentToDelete({ id: student.id, name: student.fullName });
                        setDeleteConfirmOpen(true);
                      }}
                      className="p-1.5 rounded bg-neutral-850 hover:bg-neutral-800 border border-neutral-800 text-rose-500 hover:text-rose-400 transition flex items-center gap-1 text-[10px]"
                    >
                      <Trash2 size={12} />
                      <span>Deactivate</span>
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-neutral-500 font-mono text-xs">
                No matching student profiles found in registry.
              </div>
            )}
          </div>
        </div>

        {/* Right Side Slide-out Details Drawer (renders if student selected) */}
        {selectedStudentId && (
          <div className="w-full lg:w-96 glass-card border border-neutral-800 rounded-xl p-5 shadow-2xl relative animate-scale-up shrink-0">
            {loadingDetail ? (
              <div className="py-20 flex flex-col items-center justify-center text-neutral-500">
                <Loader2 className="animate-spin text-blue-500 mb-2" size={20} />
                <span className="font-mono text-[9px]">Fetching record...</span>
              </div>
            ) : selectedStudent && metrics ? (
              <>
                {/* Header close */}
                <div className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-4">
                  <h3 className="font-display font-bold text-white text-base">Academic Record File</h3>
                  <button
                    onClick={() => setSelectedStudentId(null)}
                    className="p-1 rounded bg-neutral-850 hover:bg-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Profile Brief */}
                <div className="flex items-center gap-4 mb-5 p-3 rounded-lg bg-neutral-950/50 border border-neutral-900">
                  <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/25 flex items-center justify-center font-bold text-blue-400 text-lg">
                    {selectedStudent.fullName.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-white truncate">{selectedStudent.fullName}</h4>
                    <p className="text-[10px] text-neutral-500 font-mono mt-0.5">
                      {selectedStudent.rollNumber} / {selectedStudent.department.code}
                    </p>
                    <p className="text-[10px] text-neutral-500 font-mono truncate">{selectedStudent.email}</p>
                    <span className="text-[9px] text-neutral-600 font-mono mt-0.5 block">
                      Registered: {new Date(selectedStudent.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Academic Details Block */}
                <div className="p-3.5 bg-neutral-950/40 border border-neutral-900 rounded-lg space-y-2 mb-5">
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-500">Student ID:</span>
                    <span className="text-white font-mono text-[10px] select-all truncate max-w-[180px]" title={selectedStudent.id}>
                      {selectedStudent.id}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-500">Program:</span>
                    <strong className="text-white text-right truncate max-w-[180px]" title={selectedStudent.program.name}>
                      {selectedStudent.program.name} ({selectedStudent.program.code})
                    </strong>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-500">Semester & Sec:</span>
                    <strong className="text-white">Semester {selectedStudent.semester} - Section {selectedStudent.section || "N/A"}</strong>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-500">Academic Year:</span>
                    <strong className="text-white font-mono">{selectedStudent.academicYear}</strong>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-500">Account Status:</span>
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
                  <div className="p-3 bg-neutral-950/40 border border-neutral-900 rounded-lg text-center">
                    <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-wide block">
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
                  <div className="p-3 bg-neutral-950/40 border border-neutral-900 rounded-lg text-center">
                    <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-wide block">
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
                    <h5 className="text-[10px] uppercase font-bold text-neutral-400 flex items-center gap-1.5 mb-2">
                      <BookOpen size={12} className="text-blue-400" />
                      <span>Internal Assessment ({metrics.grades.length})</span>
                    </h5>
                    <div className="space-y-1.5">
                      {metrics.grades.length > 0 ? (
                        metrics.grades.map((g) => (
                          <div
                            key={g.id}
                            className="p-2 rounded bg-neutral-950/20 border border-neutral-900 flex items-center justify-between text-xs"
                          >
                            <div>
                              <p className="font-semibold text-white leading-none">{g.subjectName}</p>
                              <span className="text-[9px] text-neutral-500 mt-1 block">
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
                        <p className="text-[10px] text-neutral-600 font-mono italic">
                          No exam gradebooks submitted yet.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Billing ledger invoices */}
                  <div>
                    <h5 className="text-[10px] uppercase font-bold text-neutral-400 flex items-center gap-1.5 mb-2">
                      <CreditCard size={12} className="text-emerald-400" />
                      <span>Academic Invoices ({metrics.invoices.length})</span>
                    </h5>
                    <div className="space-y-1.5">
                      {metrics.invoices.length > 0 ? (
                        metrics.invoices.map((inv) => (
                          <div
                            key={inv.id}
                            className="p-2 rounded bg-neutral-950/20 border border-neutral-900 flex items-center justify-between text-xs"
                          >
                            <div>
                              <p className="font-semibold text-white leading-none">{inv.type}</p>
                              <span className="text-[9px] text-neutral-500 mt-1 block">
                                Due: {inv.dueDate}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-white font-sans">
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
                        <p className="text-[10px] text-neutral-600 font-mono italic">
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
          fetchStudents();
          // If editing selected student, trigger refresh
          if (editingStudentId === selectedStudentId) {
            setSelectedStudentId(null);
            setTimeout(() => setSelectedStudentId(editingStudentId), 100);
          }
        }}
        studentId={editingStudentId}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setStudentToDelete(null);
        }}
        onSuccess={(msg) => {
          triggerToast(msg);
          fetchStudents();
          if (studentToDelete?.id === selectedStudentId) {
            setSelectedStudentId(null);
          }
        }}
        studentId={studentToDelete?.id || null}
        studentName={studentToDelete?.name || null}
      />
    </div>
  );
}
