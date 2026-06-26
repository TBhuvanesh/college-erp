"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  Loader2, 
  AlertCircle,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  Trash2,
  Edit2,
  RefreshCw,
  SlidersHorizontal,
  User,
  GraduationCap,
  BookOpen
} from "lucide-react";

interface DepartmentRef {
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
  semester: number;
}

interface FacultySummary {
  id: string;
  employeeNumber: string;
  fullName: string;
  email: string;
  departmentName: string;
  designation: string;
}

interface SubjectSummary {
  id: string;
  code: string;
  name: string;
  departmentName: string;
  semester: number;
}

interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  facultyId: string;
  facultyName: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  section: string;
  attendanceDate: string;
  status: "present" | "absent";
  createdAt: string;
  updatedAt: string;
}

export default function AdminAttendance() {
  const { accessToken } = useAuth();

  // Loaders
  const [loadingList, setLoadingList] = useState(true);
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Messages / Toast
  const [error, setError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState("");

  // Options data for dropdowns
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [faculty, setFaculty] = useState<FacultySummary[]>([]);
  const [subjects, setSubjects] = useState<SubjectSummary[]>([]);

  // Filter States
  const [studentFilter, setStudentFilter] = useState("ALL");
  const [facultyFilter, setFacultyFilter] = useState("ALL");
  const [subjectFilter, setSubjectFilter] = useState("ALL");
  const [sectionFilter, setSectionFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");

  // Roster registry records list
  const [records, setRecords] = useState<AttendanceRecord[]>([]);

  // Pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  };

  // Fetch filter dropdown options on mount
  useEffect(() => {
    const fetchFilterOptions = async () => {
      setLoadingFilters(true);
      try {
        const [studRes, facRes, subRes] = await Promise.all([
          apiFetch("/students?limit=100", {}, accessToken),
          apiFetch("/faculty?limit=100", {}, accessToken),
          apiFetch("/subjects?limit=100", {}, accessToken)
        ]);

        if (studRes.success && studRes.data?.students) {
          setStudents(studRes.data.students);
        }
        if (facRes.success && facRes.data?.faculty) {
          setFaculty(facRes.data.faculty);
        }
        if (subRes.success && subRes.data?.subjects) {
          setSubjects(subRes.data.subjects);
        }
      } catch (err) {
        console.error("Failed to load filter directories", err);
      } finally {
        setLoadingFilters(false);
      }
    };

    fetchFilterOptions();
  }, [accessToken]);

  // Fetch attendance list with applied query filters
  const fetchAttendance = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });

      if (studentFilter !== "ALL") queryParams.append("studentId", studentFilter);
      if (facultyFilter !== "ALL") queryParams.append("facultyId", facultyFilter);
      if (subjectFilter !== "ALL") queryParams.append("subjectId", subjectFilter);
      if (sectionFilter.trim()) queryParams.append("section", sectionFilter.trim());
      if (dateFilter) queryParams.append("date", dateFilter);
      if (dateFromFilter) queryParams.append("dateFrom", dateFromFilter);
      if (dateToFilter) queryParams.append("dateTo", dateToFilter);

      const res = await apiFetch(`/attendance?${queryParams.toString()}`, {}, accessToken);
      if (res.success && res.data) {
        setRecords(res.data.records || []);
        if (res.data.pagination) {
          setTotalPages(res.data.pagination.totalPages || 1);
          setTotalRecords(res.data.pagination.total || 0);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load attendance records");
      setRecords([]);
    } finally {
      setLoadingList(false);
    }
  }, [page, limit, studentFilter, facultyFilter, subjectFilter, sectionFilter, dateFilter, dateFromFilter, dateToFilter, accessToken]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAttendance();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchAttendance]);

  // Handle corrections (inline status patches)
  const handleUpdateStatus = async (recordId: string, currentStatus: "present" | "absent") => {
    const newStatus = currentStatus === "present" ? "absent" : "present";
    setUpdatingId(recordId);
    setError(null);
    try {
      const res = await apiFetch(`/attendance/${recordId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus })
      }, accessToken);

      if (res.success) {
        triggerToast("Attendance status updated successfully!");
        // Update local status directly for immediate visual feedback
        setRecords(prev => prev.map(rec => rec.id === recordId ? { ...rec, status: newStatus } : rec));
      }
    } catch (err: any) {
      setError(err.message || "Failed to correct attendance record status");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleClearFilters = () => {
    setStudentFilter("ALL");
    setFacultyFilter("ALL");
    setSubjectFilter("ALL");
    setSectionFilter("");
    setDateFilter("");
    setDateFromFilter("");
    setDateToFilter("");
    setPage(1);
    triggerToast("Attendance filters cleared");
  };

  // Trigger page resets on filter modifications
  const handleFilterChange = (setter: (v: string) => void, val: string) => {
    setter(val);
    setPage(1);
  };

  // Computations for active dataset page
  const pagePresent = records.filter(r => r.status === "present").length;
  const pageAbsent = records.filter(r => r.status === "absent").length;
  const presenceRate = records.length > 0 ? ((pagePresent / records.length) * 100).toFixed(1) : "0.0";

  return (
    <div className="space-y-6 relative">
      
      {/* Toast alert */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-blue-600 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-xl shadow-blue-600/20 border border-blue-400/20 animate-fade-in">
          <Sparkles size={14} className="animate-pulse" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-2xl text-white">Attendance Registry Logs</h2>
          <p className="text-xs text-neutral-400 mt-1">
            Search, review, and authorize student attendance record corrections. Scopes cover all departments and courses.
          </p>
        </div>
        
        <button
          onClick={handleClearFilters}
          className="px-4 py-2 text-xs font-semibold rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 cursor-pointer transition flex items-center gap-1.5 self-start md:self-auto"
        >
          <RefreshCw size={12} />
          <span>Clear Filters</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold rounded-lg flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Filters Form Block */}
      <div className="glass-card border border-neutral-800 rounded-xl p-4 space-y-4">
        <div className="flex items-center gap-1.5 text-xs text-neutral-400 pb-2 border-b border-neutral-900">
          <SlidersHorizontal size={14} className="text-blue-500" />
          <span className="font-semibold text-white">Search Filters Panel</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Subject Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-bold text-neutral-500">Subject</label>
            <div className="flex items-center gap-2 bg-neutral-950 border border-neutral-850 rounded px-2.5 text-xs text-white">
              <BookOpen size={12} className="text-neutral-500 shrink-0" />
              <select
                value={subjectFilter}
                onChange={(e) => handleFilterChange(setSubjectFilter, e.target.value)}
                className="bg-transparent text-white cursor-pointer py-2 flex-1 focus:outline-none"
                disabled={loadingFilters}
              >
                <option value="ALL">All Subjects</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.code}: {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Student Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-bold text-neutral-500">Student</label>
            <div className="flex items-center gap-2 bg-neutral-950 border border-neutral-850 rounded px-2.5 text-xs text-white">
              <User size={12} className="text-neutral-500 shrink-0" />
              <select
                value={studentFilter}
                onChange={(e) => handleFilterChange(setStudentFilter, e.target.value)}
                className="bg-transparent text-white cursor-pointer py-2 flex-1 focus:outline-none"
                disabled={loadingFilters}
              >
                <option value="ALL">All Students</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.fullName} ({s.rollNumber})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Faculty Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-bold text-neutral-500">Faculty Instructor</label>
            <div className="flex items-center gap-2 bg-neutral-950 border border-neutral-850 rounded px-2.5 text-xs text-white">
              <GraduationCap size={12} className="text-neutral-500 shrink-0" />
              <select
                value={facultyFilter}
                onChange={(e) => handleFilterChange(setFacultyFilter, e.target.value)}
                className="bg-transparent text-white cursor-pointer py-2 flex-1 focus:outline-none"
                disabled={loadingFilters}
              >
                <option value="ALL">All Faculty</option>
                {faculty.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.fullName} ({f.employeeNumber})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-bold text-neutral-500">Section</label>
            <input
              type="text"
              placeholder="e.g. A, B, C..."
              value={sectionFilter}
              onChange={(e) => handleFilterChange(setSectionFilter, e.target.value)}
              className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-850 rounded text-white focus:outline-none focus:border-neutral-700"
            />
          </div>

          {/* Date Picker */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-bold text-neutral-500">Specific Date</label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setDateFromFilter(""); // Clear range if single date is set
                setDateToFilter("");
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-850 rounded text-white focus:outline-none focus:border-neutral-700"
            />
          </div>

          {/* Date From Range */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-bold text-neutral-500">Date From</label>
            <input
              type="date"
              value={dateFromFilter}
              onChange={(e) => {
                setDateFromFilter(e.target.value);
                setDateFilter(""); // Clear single date if range is set
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-850 rounded text-white focus:outline-none focus:border-neutral-700"
            />
          </div>

          {/* Date To Range */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-bold text-neutral-500">Date To</label>
            <input
              type="date"
              value={dateToFilter}
              onChange={(e) => {
                setDateToFilter(e.target.value);
                setDateFilter(""); // Clear single date if range is set
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-850 rounded text-white focus:outline-none focus:border-neutral-700"
            />
          </div>
        </div>
      </div>

      {/* Summary Statistics calculated on dynamic loaded records */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Records Matches */}
        <div className="glass-card rounded-xl p-4 border border-neutral-800 text-center">
          <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider block">Total Logs Found</span>
          <span className="block text-2xl font-bold text-white mt-1 font-mono">{totalRecords}</span>
        </div>

        {/* Loaded Page Presents */}
        <div className="glass-card rounded-xl p-4 border border-neutral-800 text-center">
          <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider block">Page Presents</span>
          <span className="block text-2xl font-bold text-emerald-400 mt-1 font-mono">{pagePresent}</span>
        </div>

        {/* Loaded Page Absents */}
        <div className="glass-card rounded-xl p-4 border border-neutral-800 text-center">
          <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider block">Page Absents</span>
          <span className="block text-2xl font-bold text-rose-400 mt-1 font-mono">{pageAbsent}</span>
        </div>

        {/* Presence Rate of Current Page */}
        <div className="glass-card rounded-xl p-4 border border-neutral-800 text-center">
          <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider block">Page Presence Rate</span>
          <span className="block text-2xl font-bold text-blue-400 mt-1 font-mono">{presenceRate}%</span>
        </div>
      </div>

      {/* Table grid block */}
      <div className="glass-card border border-neutral-800 rounded-xl overflow-hidden">
        {/* Desktop View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-neutral-900/50 border-b border-neutral-800 text-neutral-400 font-semibold">
                <th className="px-4 py-3 font-mono">Date</th>
                <th className="px-4 py-3 font-mono">Roll Number</th>
                <th className="px-4 py-3">Student Name</th>
                <th className="px-4 py-3">Subject Course</th>
                <th className="px-4 py-3 font-mono">Section</th>
                <th className="px-4 py-3">Marked By Faculty</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900 text-neutral-300">
              {loadingList ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-neutral-500">
                    <Loader2 className="animate-spin text-blue-500 mx-auto mb-2" size={20} />
                    <span className="font-mono text-[10px]">Scanning database logs...</span>
                  </td>
                </tr>
              ) : records.length > 0 ? (
                records.map(rec => (
                  <tr key={rec.id} className="hover:bg-neutral-900/20">
                    <td className="px-4 py-3 font-mono text-[10px] text-neutral-500 select-all" title={rec.id}>
                      {rec.attendanceDate}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold">{rec.rollNumber}</td>
                    <td className="px-4 py-3 text-white font-semibold">{rec.studentName}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-neutral-200">{rec.subjectCode}</span>: {rec.subjectName}
                    </td>
                    <td className="px-4 py-3 font-mono">Sec {rec.section}</td>
                    <td className="px-4 py-3 text-neutral-400">{rec.facultyName}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border capitalize ${
                        rec.status === "present"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                      }`}>
                        {rec.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleUpdateStatus(rec.id, rec.status)}
                        disabled={updatingId === rec.id}
                        className="px-2.5 py-1 text-[10px] font-bold rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 hover:text-white cursor-pointer disabled:opacity-40 transition flex items-center gap-1 ml-auto"
                      >
                        {updatingId === rec.id ? (
                          <Loader2 size={10} className="animate-spin" />
                        ) : (
                          <Edit2 size={10} />
                        )}
                        <span>Correct Roll</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-neutral-500 font-mono">
                    No matching attendance logs found in database registries.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View Cards */}
        <div className="block md:hidden divide-y divide-neutral-900">
          {loadingList ? (
            <div className="text-center py-12 text-neutral-500">
              <Loader2 className="animate-spin text-blue-500 mx-auto mb-2" size={20} />
              <span className="font-mono text-[10px]">Scanning database logs...</span>
            </div>
          ) : records.length > 0 ? (
            records.map(rec => (
              <div key={rec.id} className="p-4 flex flex-col gap-2.5">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-neutral-500 block text-[9px] uppercase font-bold tracking-wider">Student</span>
                    <span className="font-semibold text-white text-xs block">{rec.studentName}</span>
                    <span className="text-[10px] text-neutral-500 font-mono mt-0.5 block">Roll: {rec.rollNumber}</span>
                  </div>
                  
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold border capitalize ${
                    rec.status === "present"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                  }`}>
                    {rec.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-[10px] text-neutral-300 font-mono bg-neutral-950/30 p-2.5 border border-neutral-900 rounded-lg">
                  <div>
                    <span className="text-neutral-500 block text-[9px] uppercase font-bold tracking-wider">Date</span>
                    <span>{rec.attendanceDate}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block text-[9px] uppercase font-bold tracking-wider">Section</span>
                    <span>Section {rec.section}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-neutral-500 block text-[9px] uppercase font-bold tracking-wider">Subject</span>
                    <span>{rec.subjectCode}: {rec.subjectName}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-neutral-500 block text-[9px] uppercase font-bold tracking-wider">Faculty Instructor</span>
                    <span>{rec.facultyName}</span>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => handleUpdateStatus(rec.id, rec.status)}
                    disabled={updatingId === rec.id}
                    className="p-1.5 rounded bg-neutral-850 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-white transition flex items-center gap-1.5 text-[10px] cursor-pointer disabled:opacity-40"
                  >
                    {updatingId === rec.id ? (
                      <Loader2 size={10} className="animate-spin" />
                    ) : (
                      <Edit2 size={10} />
                    )}
                    <span>Correct Roll</span>
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-neutral-500 font-mono text-xs">
              No matching attendance logs found in database registries.
            </div>
          )}
        </div>

        {/* Pagination Block */}
        {!loadingList && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-neutral-850 p-4 bg-neutral-950/30">
            <div className="text-[10px] font-mono text-neutral-500">
              Showing {(page - 1) * limit + 1} - {Math.min(page * limit, totalRecords)} of {totalRecords} logs
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="p-1.5 rounded bg-neutral-905 border border-neutral-850 hover:bg-neutral-800 disabled:opacity-40 text-neutral-400 hover:text-white cursor-pointer disabled:cursor-not-allowed transition"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-[10px] font-mono text-white font-bold px-2">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
                className="p-1.5 rounded bg-neutral-905 border border-neutral-850 hover:bg-neutral-800 disabled:opacity-40 text-neutral-400 hover:text-white cursor-pointer disabled:cursor-not-allowed transition"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
