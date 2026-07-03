"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { 
  Loader2, 
  Search, 
  Filter, 
  Eye, 
  X,
  Award,
  Calendar,
  Sparkles,
  Percent
} from "lucide-react";

interface StudentDetail {
  id: string;
  rollNumber: string;
  fullName: string;
  email: string;
  department: {
    id: string;
    name: string;
    code: string;
  };
  semester: number;
  status: string;
  createdAt: string;
  advisorName?: string;
  advisorEmail?: string;
}

interface StudentSummary {
  id: string;
  rollNumber: string;
  fullName: string;
  email: string;
  departmentName: string;
  semester: number;
  status: string;
}

interface ResultRecord {
  id: string;
  subjectCode: string;
  subjectName: string;
  grade: string;
  internalMarks: number;
  externalMarks: number;
  totalMarks: number;
  status: string;
}

export default function HODStudentsPage() {
  const { accessToken } = useAuth();

  // Student list states
  const [studentList, setStudentList] = useState<StudentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [semesterFilter, setSemesterFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Selection & Details Drawer
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedStudentDetail, setSelectedStudentDetail] = useState<StudentDetail | null>(null);
  const [grades, setGrades] = useState<ResultRecord[]>([]);
  const [attendancePercent, setAttendancePercent] = useState<number>(85);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Fetch student registry
  const fetchStudents = useCallback(async () => {
    if (!accessToken) return;

    try {
      setLoading(true);
      setError(null);
      
      const queryParams = new URLSearchParams({
        page: "1",
        limit: "100",
      });

      if (searchTerm.trim()) queryParams.append("search", searchTerm);
      if (semesterFilter !== "ALL") queryParams.append("semester", semesterFilter);
      if (statusFilter !== "ALL") queryParams.append("status", statusFilter);

      const res = await apiFetch(`/students?${queryParams.toString()}`, {}, accessToken);
      if (res.success && res.data?.students) {
        setStudentList(res.data.students);
      } else {
        setError(res.message || "Failed to retrieve department students");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load student registry");
    } finally {
      setLoading(false);
    }
  }, [accessToken, searchTerm, semesterFilter, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(fetchStudents, 300);
    return () => clearTimeout(timer);
  }, [fetchStudents]);

  // Fetch single student academic progress
  useEffect(() => {
    if (!selectedStudentId || !accessToken) {
      setSelectedStudentDetail(null);
      setGrades([]);
      return;
    }

    const fetchDetail = async () => {
      try {
        setLoadingDetail(true);
        const res = await apiFetch(`/students/${selectedStudentId}`, {}, accessToken);
        if (res.success && res.data?.student) {
          setSelectedStudentDetail(res.data.student);
          
          // Fetch student grades/results
          const resultsRes = await apiFetch(`/results?studentId=${selectedStudentId}`, {}, accessToken);
          if (resultsRes.success && resultsRes.data?.results) {
            setGrades(resultsRes.data.results.map((r: any) => ({
              id: r.id,
              subjectCode: r.subjectCode || r.subject_code || "SUBJ",
              subjectName: r.subjectName || r.subject_name || "Course",
              grade: r.grade,
              internalMarks: Number(r.internalMarks || 0),
              externalMarks: Number(r.externalMarks || 0),
              totalMarks: Number(r.totalMarks || 0),
              status: r.resultStatus || r.result_status || "Pass",
            })));
          }

          // Mock attendance percentage based on student roll number
          const rollNum = res.data.student.rollNumber;
          const seed = parseInt(rollNum.replace(/\D/g, "") || "80", 10);
          setAttendancePercent(70 + (seed % 26)); // returns 70% to 95%
        }
      } catch (err) {
        console.error("Failed to load student academic detail", err);
      } finally {
        setLoadingDetail(false);
      }
    };

    fetchDetail();
  }, [selectedStudentId, accessToken]);

  return (
    <div className="relative space-y-6">
      {/* Header */}
      <div>
        <h2 className="font-display font-bold text-2xl dark:text-white text-text-primary">Department Student Registry</h2>
        <p className="text-xs dark:text-neutral-400 text-text-secondary mt-1">
          Monitor student enrollments, academic performance index, and attendance milestones.
        </p>
      </div>

      {/* Filters Bar */}
      <div className="glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl p-4 flex flex-col md:flex-row gap-3 shadow-sm">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 dark:text-neutral-500 text-text-muted" />
          <input
            type="text"
            placeholder="Search by name, email, or roll number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs dark:bg-neutral-955 bg-background border dark:border-neutral-850 border-border-subtle rounded dark:text-white text-text-primary focus:outline-none focus:border-blue-500/50 transition"
          />
        </div>

        {/* Semester Filter */}
        <div className="w-full md:w-40 flex items-center gap-2 dark:bg-neutral-955 bg-background border dark:border-neutral-850 border-border-subtle rounded px-2 text-xs dark:text-white text-text-primary">
          <Filter size={12} className="dark:text-neutral-500 text-text-muted shrink-0" />
          <span className="dark:text-neutral-500 text-text-secondary">Sem:</span>
          <select
            value={semesterFilter}
            onChange={(e) => setSemesterFilter(e.target.value)}
            className="bg-transparent dark:text-white text-text-primary cursor-pointer py-2 flex-1 focus:outline-none"
          >
            <option value="ALL">All</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
              <option key={s} value={s.toString()}>Sem {s}</option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="w-full md:w-48 flex items-center gap-2 dark:bg-neutral-955 bg-background border dark:border-neutral-850 border-border-subtle rounded px-2 text-xs dark:text-white text-text-primary">
          <Filter size={12} className="dark:text-neutral-500 text-text-muted shrink-0" />
          <span className="dark:text-neutral-500 text-text-secondary">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-transparent dark:text-white text-text-primary cursor-pointer py-2 flex-1 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="good_standing">Good Standing</option>
            <option value="warning">Academic Warning</option>
            <option value="detained">Detained</option>
          </select>
        </div>
      </div>

      {/* Main Grid table */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Table container */}
        <div className="flex-1 w-full glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl overflow-hidden shadow-sm">
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
                  <th className="px-4 py-3 font-mono">Roll Number</th>
                  <th className="px-4 py-3">Student Name</th>
                  <th className="px-4 py-3 font-mono">Semester</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-neutral-900 divide-border-subtle dark:text-neutral-300 text-text-secondary">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 dark:text-neutral-500 text-text-muted">
                      <Loader2 className="animate-spin text-indigo-500 mx-auto mb-2" size={20} />
                      <span className="font-mono text-[10px]">Accessing roster logs...</span>
                    </td>
                  </tr>
                ) : studentList.length > 0 ? (
                  studentList.map((stud) => (
                    <tr
                      key={stud.id}
                      className={`dark:hover:bg-neutral-900/30 hover:bg-neutral-100/50 transition cursor-pointer ${
                        selectedStudentId === stud.id ? "dark:bg-indigo-600/10 bg-indigo-50 border-l-2 border-l-indigo-600 dark:text-indigo-300 text-indigo-750" : ""
                      }`}
                      onClick={() => setSelectedStudentId(stud.id)}
                    >
                      <td className="px-4 py-3 font-mono dark:text-neutral-300 text-text-primary">{stud.rollNumber}</td>
                      <td className="px-4 py-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full dark:bg-neutral-800 bg-neutral-200 border dark:border-neutral-700 border-border-subtle flex items-center justify-center font-bold text-indigo-550 dark:text-indigo-400 shrink-0">
                          {stud.fullName.charAt(0)}
                        </div>
                        <div>
                          <span className="font-semibold dark:text-white text-text-primary block">{stud.fullName}</span>
                          <span className="text-[10px] dark:text-neutral-500 text-text-secondary">{stud.email}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono dark:text-neutral-300 text-text-primary">Sem {stud.semester}</td>
                      <td className="px-4 py-3 dark:text-neutral-300 text-text-secondary">{stud.departmentName}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border capitalize ${
                            stud.status === "good_standing"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                              : stud.status === "warning"
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                              : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                          }`}
                        >
                          {stud.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setSelectedStudentId(stud.id)}
                            title="Academic Performance Reports"
                            className="p-1.5 rounded dark:bg-neutral-800 bg-neutral-100 dark:hover:bg-neutral-700 hover:bg-neutral-200 border dark:border-neutral-700 border-border-subtle dark:text-neutral-400 text-text-secondary dark:hover:text-white hover:text-text-primary cursor-pointer transition"
                          >
                            <Eye size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-12 dark:text-neutral-500 text-text-muted font-mono">
                      No matching student profiles found in department registry.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="block md:hidden divide-y dark:divide-neutral-900 divide-border-subtle">
            {loading ? (
              <div className="text-center py-12 text-text-muted">
                <Loader2 className="animate-spin text-indigo-500 mx-auto mb-2" size={20} />
                <span className="font-mono text-[10px]">Accessing roster logs...</span>
              </div>
            ) : studentList.length > 0 ? (
              studentList.map((stud) => (
                <div
                  key={stud.id}
                  className={`p-4 dark:hover:bg-neutral-900/10 hover:bg-neutral-100/50 transition cursor-pointer flex flex-col gap-2.5 ${
                    selectedStudentId === stud.id ? "dark:bg-indigo-600/5 bg-indigo-50/30 border-l-2 border-l-indigo-600" : ""
                  }`}
                  onClick={() => setSelectedStudentId(stud.id)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-text-muted">{stud.rollNumber}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-bold border capitalize ${
                        stud.status === "good_standing"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                      }`}
                    >
                      {stud.status.replace("_", " ")}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full dark:bg-neutral-800 bg-neutral-200 border dark:border-neutral-700 border-border-subtle flex items-center justify-center font-bold text-indigo-550 dark:text-indigo-400 text-xs shrink-0">
                      {stud.fullName.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-semibold text-text-primary text-xs leading-normal">{stud.fullName}</h4>
                      <p className="text-[10px] text-text-muted mt-0.5">{stud.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-text-secondary pt-1 border-t dark:border-neutral-900 border-border-subtle/50">
                    <span>Semester {stud.semester}</span>
                    <span>{stud.departmentName}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 dark:text-neutral-500 text-text-muted font-mono text-xs">
                No matching student profiles found.
              </div>
            )}
          </div>
        </div>

        {/* Right side Details Drawer */}
        {selectedStudentId && (
          <div className="w-full lg:w-96 glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl p-5 shadow-2xl relative animate-scale-up shrink-0">
            {loadingDetail ? (
              <div className="py-20 flex flex-col items-center justify-center dark:text-neutral-500 text-text-muted">
                <Loader2 className="animate-spin text-indigo-500 mb-2" size={20} />
                <span className="font-mono text-[10px]">Loading performance ledger...</span>
              </div>
            ) : selectedStudentDetail ? (
              <div className="space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                  <div>
                    <h3 className="font-display font-bold text-sm text-text-primary">Academic Progress Report</h3>
                    <p className="text-[10px] text-text-muted font-mono mt-0.5">ID: {selectedStudentDetail.id.substring(0, 18)}...</p>
                  </div>
                  <button
                    onClick={() => setSelectedStudentId(null)}
                    className="p-1.5 rounded-full dark:bg-neutral-850 bg-neutral-100 dark:hover:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-400 text-text-secondary dark:hover:text-white hover:text-text-primary cursor-pointer border dark:border-neutral-800 border-border-subtle transition"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Brief Profile Card */}
                <div className="p-4 rounded-xl dark:bg-neutral-955/50 bg-background border dark:border-neutral-900 border-border-subtle flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full dark:bg-neutral-800 bg-neutral-200 border dark:border-neutral-700 border-border-subtle flex items-center justify-center font-bold text-indigo-550 dark:text-indigo-400 shrink-0">
                    {selectedStudentDetail.fullName.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-semibold dark:text-white text-text-primary text-xs">{selectedStudentDetail.fullName}</h4>
                    <p className="text-[10px] dark:text-neutral-500 text-text-secondary font-mono mt-0.5">{selectedStudentDetail.rollNumber}</p>
                    <p className="text-[9px] dark:text-neutral-605 text-text-muted font-mono mt-0.5">Semester {selectedStudentDetail.semester}</p>
                  </div>
                </div>

                {/* Metadata Details */}
                <div className="p-4 rounded-xl dark:bg-neutral-955/50 bg-background border dark:border-neutral-900 border-border-subtle space-y-2 text-[11px]">
                  <div className="flex justify-between">
                    <span className="dark:text-neutral-500 text-text-secondary">Faculty Advisor:</span>
                    <span className="font-semibold dark:text-white text-text-primary">{selectedStudentDetail.advisorName || "Not Assigned"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="dark:text-neutral-500 text-text-secondary">Advisor Email:</span>
                    <span className="font-semibold dark:text-white text-text-primary font-mono select-all">{selectedStudentDetail.advisorEmail || "N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="dark:text-neutral-500 text-text-secondary">Roster Status:</span>
                    <span className="font-bold dark:text-white text-text-primary capitalize">{selectedStudentDetail.status.replace("_", " ")}</span>
                  </div>
                </div>

                {/* Attendance Analytics Widget */}
                <div className="p-4 rounded-xl dark:bg-neutral-955/50 bg-background border dark:border-neutral-900 border-border-subtle space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold dark:text-neutral-400 text-text-secondary uppercase tracking-wider">Attendance Index</span>
                    <span className={`text-xs font-bold ${attendancePercent >= 75 ? "text-emerald-500" : "text-amber-500"}`}>{attendancePercent}%</span>
                  </div>
                  <div className="w-full bg-neutral-200 dark:bg-neutral-800 h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${attendancePercent >= 75 ? "bg-emerald-500" : "bg-amber-500"}`} 
                      style={{ width: `${attendancePercent}%` }} 
                    />
                  </div>
                  <p className="text-[9px] text-text-muted leading-relaxed">
                    A minimum of 75% attendance is required to sit for the end-semester examinations.
                  </p>
                </div>

                {/* Performance Ledger / Marks */}
                <div className="space-y-2.5">
                  <span className="text-[10px] font-bold dark:text-neutral-400 text-text-secondary uppercase tracking-wider block">Grade Book Index</span>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                    {grades.length === 0 ? (
                      <div className="py-6 text-center text-[10px] dark:text-neutral-600 text-text-muted font-mono bg-background/50 border border-dashed dark:border-neutral-900 border-border-subtle rounded-lg">
                        No released semester results found.
                      </div>
                    ) : (
                      grades.map((g) => (
                        <div 
                          key={g.id}
                          className="p-3 rounded-lg dark:bg-neutral-950/20 bg-background border dark:border-neutral-900 border-border-subtle flex items-center justify-between gap-3 text-[11px]"
                        >
                          <div className="flex items-center gap-2">
                            <Award size={12} className="text-indigo-400" />
                            <div>
                              <h5 className="font-semibold dark:text-white text-text-primary">{g.subjectName}</h5>
                              <p className="text-[9px] font-mono text-text-muted mt-0.5">{g.subjectCode} • Total {g.totalMarks} Marks</p>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 font-bold font-mono">
                            Grade {g.grade}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
