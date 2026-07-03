"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { 
  Calendar, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Loader2, 
  AlertCircle,
  TrendingUp,
  Percent,
  CheckCircle2,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Filter
} from "lucide-react";

interface SubjectAttendanceSummary {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  semester: number;
  totalClasses: number;
  attendedClasses: number;
  percentage: number;
}

interface StudentAttendanceSummary {
  subjects: SubjectAttendanceSummary[];
  overall: {
    totalClasses: number;
    attendedClasses: number;
    percentage: number;
  };
}

interface AttendanceHistoryEntry {
  id: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  section: string;
  attendanceDate: string;
  status: "present" | "absent";
  markedBy: string;
  updatedAt: string;
}

export default function StudentAttendance() {
  const { accessToken } = useAuth();

  // Loaders
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  
  // Feedback
  const [error, setError] = useState<string | null>(null);

  // Data
  const [summary, setSummary] = useState<StudentAttendanceSummary | null>(null);
  const [historyRecords, setHistoryRecords] = useState<AttendanceHistoryEntry[]>([]);
  const [selectedSubjFilter, setSelectedSubjFilter] = useState("ALL");
  
  // Pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Fetch summary metrics
  useEffect(() => {
    const fetchSummary = async () => {
      setLoadingSummary(true);
      setError(null);
      try {
        const res = await apiFetch("/attendance/summary", {}, accessToken);
        if (res.success && res.data) {
          setSummary(res.data);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load attendance summary");
      } finally {
        setLoadingSummary(false);
      }
    };
    fetchSummary();
  }, [accessToken]);

  // Fetch chronological history logs
  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });

      if (selectedSubjFilter !== "ALL") {
        queryParams.append("subjectId", selectedSubjFilter);
      }

      const res = await apiFetch(`/attendance/history?${queryParams.toString()}`, {}, accessToken);
      if (res.success && res.data) {
        setHistoryRecords(res.data.records || []);
        if (res.data.pagination) {
          setTotalPages(res.data.pagination.totalPages || 1);
          setTotalRecords(res.data.pagination.total || 0);
        }
      }
    } catch (err: any) {
      console.error("Failed to load attendance history logs", err);
    } finally {
      setLoadingHistory(false);
    }
  }, [page, limit, selectedSubjFilter, accessToken]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchHistory();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchHistory]);

  // Reset to page 1 on filter changes
  const handleFilterChange = (val: string) => {
    setSelectedSubjFilter(val);
    setPage(1);
  };

  if (loadingSummary) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-text-muted">
        <Loader2 className="animate-spin text-blue-500 mb-3" size={30} />
        <span className="font-mono text-xs">Accessing attendance ledger card file...</span>
      </div>
    );
  }

  const overallPct = summary?.overall?.percentage ? Math.round(summary.overall.percentage) : 0;
  const isOverallEligible = overallPct >= 75;

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <h2 className="font-display font-bold text-2xl text-text-primary">Attendance Logs</h2>
        <p className="text-xs text-text-muted mt-1">
          Detailed lecture presence logs and metrics. Standard academic policy requires 75% final presence for exam eligibility.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold rounded-lg flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Classes Attended Card */}
        <div className="bg-surface rounded-xl p-5 border border-border-subtle flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-text-muted uppercase tracking-wide">Classes Attended</span>
            <h3 className="font-display font-bold text-2xl text-text-primary mt-1">
              {summary?.overall?.attendedClasses || 0} / {summary?.overall?.totalClasses || 0}
            </h3>
            <span className="text-[10px] text-text-muted mt-0.5 block">Aggregated lectures count</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
            <BookOpen size={18} />
          </div>
        </div>

        {/* Overall Percentage Card */}
        <div className="bg-surface rounded-xl p-5 border border-border-subtle flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-text-muted uppercase tracking-wide">Overall Attendance</span>
            <h3 className={`font-display font-bold text-2xl mt-1 ${isOverallEligible ? "dark:text-emerald-400 text-emerald-700" : "dark:text-rose-500 text-rose-600"}`}>
              {overallPct}%
            </h3>
            <span className="text-[10px] text-text-muted mt-0.5 block">Average across all courses</span>
          </div>
          <div className="w-10 h-10 rounded-lg dark:bg-amber-500/10 bg-amber-50 dark:text-amber-400 text-amber-700 dark:border-amber-500/20 border-amber-200 flex items-center justify-center">
            <Percent size={18} />
          </div>
        </div>

        {/* Exam Eligibility Card */}
        <div className={`bg-surface rounded-xl p-5 border flex items-center justify-between ${
          isOverallEligible ? "dark:border-emerald-500/20 border-emerald-500/30 dark:bg-emerald-500/5 bg-emerald-50/40" : "dark:border-rose-500/20 border-rose-500/30 dark:bg-rose-500/5 bg-rose-50/40"
        }`}>
          <div>
            <span className="text-xs font-bold text-text-muted uppercase tracking-wide">Exam Eligibility</span>
            <h3 className={`font-display font-bold text-lg mt-1 ${isOverallEligible ? "dark:text-emerald-400 text-emerald-700" : "dark:text-rose-500 text-rose-600"}`}>
              {isOverallEligible ? "ELIGIBLE" : "SHORTAGE"}
            </h3>
            <span className="text-[10px] text-text-muted mt-0.5 block">
              {isOverallEligible ? "Status in Good Standing" : "Detention Risk (Below 75%)"}
            </span>
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${
            isOverallEligible 
              ? "dark:bg-emerald-500/10 bg-emerald-50 dark:text-emerald-400 text-emerald-700 dark:border-emerald-500/20 border-emerald-200" 
              : "dark:bg-rose-500/10 bg-rose-50 dark:text-rose-455 text-rose-700 dark:border-rose-500/20 border-rose-200"
          }`}>
            {isOverallEligible ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          </div>
        </div>
      </div>

      {/* Grid: Subject-wise breakdown cards */}
      <div>
        <h3 className="font-display font-bold text-text-primary text-base mb-4 flex items-center gap-2">
          <TrendingUp size={16} className="text-blue-400" />
          <span>Subject-Wise Progress Breakdown</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {summary?.subjects && summary.subjects.length > 0 ? (
            summary.subjects.map(sub => {
              const subPct = Math.round(sub.percentage);
              const isSubSafe = subPct >= 75;

              return (
                <div
                  key={sub.subjectId}
                  className={`bg-surface border rounded-xl p-4 flex flex-col justify-between hover:border-neutral-700 dark:hover:border-neutral-600 hover:border-border-strong transition ${
                    isSubSafe ? "border-border-subtle" : "dark:border-rose-500/20 border-rose-500/30 dark:bg-rose-500/5 bg-rose-50/40"
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between mb-3">
                      <div className="min-w-0 pr-2">
                        <h4 className="font-bold text-text-primary text-sm leading-tight truncate" title={sub.subjectName}>
                          {sub.subjectName}
                        </h4>
                        <span className="text-[9px] text-text-muted font-mono mt-0.5 block">
                          CODE: {sub.subjectCode} • Semester {sub.semester}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold border shrink-0 ${
                        isSubSafe 
                          ? "dark:bg-emerald-500/10 bg-emerald-50 dark:text-emerald-400 text-emerald-700 dark:border-emerald-500/20 border-emerald-200"
                          : "dark:bg-rose-500/10 bg-rose-50 dark:text-rose-400 text-rose-700 dark:border-rose-500/20 border-rose-200"
                      }`}>
                        {isSubSafe ? "Eligible" : "Shortage"}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full dark:bg-background bg-neutral-100 rounded-full h-1.5 mb-4 border border-border-subtle overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          isSubSafe ? "bg-emerald-500" : "bg-rose-505"
                        }`}
                        style={{ width: `${Math.min(subPct, 100)}%` }}
                      ></div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 py-2.5 border-t border-border-subtle text-center text-xs">
                      <div>
                        <span className="text-[9px] text-text-muted uppercase font-bold tracking-wide">Held</span>
                        <span className="block font-semibold text-text-primary mt-0.5">{sub.totalClasses} lectures</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-text-muted uppercase font-bold tracking-wide">Attended</span>
                        <span className="block font-semibold text-text-primary mt-0.5">{sub.attendedClasses} lectures</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-text-muted uppercase font-bold tracking-wide">Percentage</span>
                        <span className={`block font-bold mt-0.5 ${isSubSafe ? "dark:text-emerald-400 text-emerald-700" : "dark:text-rose-500 text-rose-600"}`}>
                          {subPct}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {!isSubSafe && sub.totalClasses > 0 && (
                    <div className="text-[10px] dark:text-rose-400 text-rose-700 flex items-center gap-1 leading-none mt-2 font-semibold dark:bg-rose-505/5 bg-rose-50 border dark:border-rose-505/10 border-rose-200 rounded p-2">
                      <AlertTriangle size={12} className="shrink-0" />
                      <span>Detention Risk: Must increase presence to reach 75%.</span>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="col-span-2 p-8 text-center bg-surface border border-border-subtle text-text-muted font-mono text-xs">
              No subjects registered in study plan.
            </div>
          )}
        </div>
      </div>
      {/* Chronological logs register */}
      <div className="glass-card border dark:border-neutral-800 border-border-subtle rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5 pb-3 border-b dark:border-neutral-900 border-border-subtle">
          <h3 className="font-display font-bold dark:text-white text-text-primary text-sm flex items-center gap-2">
            <Calendar size={14} className="text-blue-400" />
            <span>Chronological Lecture Presence Log</span>
          </h3>

          {/* Subject Filter dropdown */}
          <div className="w-full sm:w-60 flex items-center gap-2 dark:bg-neutral-950 bg-surface border dark:border-neutral-850 border-border-subtle rounded px-2.5 text-xs dark:text-white text-text-primary">
            <Filter size={12} className="dark:text-neutral-500 text-text-muted shrink-0" />
            <span className="dark:text-neutral-500 text-text-muted">Subject:</span>
            <select
              value={selectedSubjFilter}
              onChange={(e) => handleFilterChange(e.target.value)}
              className="bg-transparent dark:text-white text-text-primary cursor-pointer py-2 flex-1 focus:outline-none"
            >
              <option value="ALL">All Subjects</option>
              {summary?.subjects.map(s => (
                <option key={s.subjectId} value={s.subjectId}>
                  {s.subjectCode}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* History Records List */}
        <div className="space-y-2">
          {loadingHistory ? (
            <div className="text-center py-10 dark:text-neutral-500 text-text-muted">
              <Loader2 className="animate-spin text-blue-500 mx-auto mb-2" size={20} />
              <span className="font-mono text-[10px]">Loading lecture records...</span>
            </div>
          ) : historyRecords.length > 0 ? (
            <>
              {/* History Cards - Universal Responsive Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                {historyRecords.map(log => (
                  <div key={log.id} className="p-3.5 rounded-lg dark:bg-neutral-955/40 bg-surface border dark:border-neutral-900 border-border-subtle dark:hover:border-neutral-805 hover:border-border-strong transition flex items-center justify-between text-xs gap-3">
                    <div className="space-y-1 min-w-0">
                      <h4 className="font-semibold dark:text-white text-text-primary truncate" title={log.subjectName}>
                        {log.subjectCode}: {log.subjectName}
                      </h4>
                      <div className="flex items-center flex-wrap gap-1.5 text-[9px] dark:text-neutral-500 text-text-muted font-mono mt-1">
                        <span className="dark:text-neutral-400 text-text-secondary font-bold">{log.attendanceDate}</span>
                        <span>•</span>
                        <span>Sec {log.section}</span>
                        <span>•</span>
                        <span className="truncate">{log.markedBy}</span>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {log.status === "present" ? (
                        <span className="flex items-center gap-1 text-[9px] font-bold dark:text-emerald-400 text-emerald-700 dark:bg-emerald-500/10 bg-emerald-50 border dark:border-emerald-500/20 border-emerald-200 rounded px-2.5 py-1">
                          <CheckCircle size={12} />
                          <span>Present</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[9px] font-bold dark:text-rose-505 text-rose-700 dark:bg-rose-505/10 bg-rose-50 border dark:border-rose-500/20 border-rose-200 rounded px-2.5 py-1">
                          <XCircle size={12} />
                          <span>Absent</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t dark:border-neutral-900 border-border-subtle pt-4 mt-4">
                  <div className="text-[10px] font-mono dark:text-neutral-500 text-text-muted">
                    Showing {(page - 1) * limit + 1} - {Math.min(page * limit, totalRecords)} of {totalRecords} logs
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(p - 1, 1))}
                      disabled={page === 1}
                      className="p-1.5 rounded dark:bg-neutral-905 bg-surface-elevated border dark:border-neutral-850 border-border-subtle dark:hover:bg-neutral-800 hover:bg-surface-hover disabled:opacity-40 dark:text-neutral-400 text-text-secondary dark:hover:text-white hover:text-text-primary cursor-pointer disabled:cursor-not-allowed transition"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span className="text-[10px] font-mono dark:text-white text-text-primary font-bold px-2">
                      {page} / {totalPages}
                    </span>
                    <button
                      onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                      disabled={page === totalPages}
                      className="p-1.5 rounded dark:bg-neutral-905 bg-surface-elevated border dark:border-neutral-855 border-border-subtle dark:hover:bg-neutral-800 hover:bg-surface-hover disabled:opacity-40 dark:text-neutral-400 text-text-secondary dark:hover:text-white hover:text-text-primary cursor-pointer disabled:cursor-not-allowed transition"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-[10px] text-neutral-500 font-mono italic text-center py-6">
              No session attendance data logged for active term.
            </p>
          )}
        </div>
      </div>

    </div>
  );
}
