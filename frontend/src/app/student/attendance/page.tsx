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
      <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
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
        <h2 className="font-display font-bold text-2xl text-white">Attendance Logs</h2>
        <p className="text-xs text-neutral-400 mt-1">
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
        <div className="glass-card rounded-xl p-5 border border-neutral-800 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wide">Classes Attended</span>
            <h3 className="font-display font-bold text-2xl text-white mt-1">
              {summary?.overall?.attendedClasses || 0} / {summary?.overall?.totalClasses || 0}
            </h3>
            <span className="text-[10px] text-neutral-400 mt-0.5 block">Aggregated lectures count</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
            <BookOpen size={18} />
          </div>
        </div>

        {/* Overall Percentage Card */}
        <div className="glass-card rounded-xl p-5 border border-neutral-800 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wide">Overall Attendance</span>
            <h3 className={`font-display font-bold text-2xl mt-1 ${isOverallEligible ? "text-emerald-400" : "text-rose-500"}`}>
              {overallPct}%
            </h3>
            <span className="text-[10px] text-neutral-400 mt-0.5 block">Average across all courses</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
            <Percent size={18} />
          </div>
        </div>

        {/* Exam Eligibility Card */}
        <div className={`glass-card rounded-xl p-5 border flex items-center justify-between ${
          isOverallEligible ? "border-emerald-500/20 bg-emerald-500/5" : "border-rose-500/20 bg-rose-500/5"
        }`}>
          <div>
            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wide">Exam Eligibility</span>
            <h3 className={`font-display font-bold text-lg mt-1 ${isOverallEligible ? "text-emerald-400" : "text-rose-500"}`}>
              {isOverallEligible ? "ELIGIBLE" : "SHORTAGE"}
            </h3>
            <span className="text-[10px] text-neutral-400 mt-0.5 block">
              {isOverallEligible ? "Status in Good Standing" : "Detention Risk (Below 75%)"}
            </span>
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${
            isOverallEligible 
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
              : "bg-rose-500/10 text-rose-400 border-rose-500/20"
          }`}>
            {isOverallEligible ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          </div>
        </div>
      </div>

      {/* Grid: Subject-wise breakdown cards */}
      <div>
        <h3 className="font-display font-bold text-white text-base mb-4 flex items-center gap-2">
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
                  className={`glass-card border rounded-xl p-4 flex flex-col justify-between hover:border-neutral-700 transition ${
                    isSubSafe ? "border-neutral-800" : "border-rose-500/20 bg-rose-500/5"
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between mb-3">
                      <div className="min-w-0 pr-2">
                        <h4 className="font-bold text-white text-sm leading-tight truncate" title={sub.subjectName}>
                          {sub.subjectName}
                        </h4>
                        <span className="text-[9px] text-neutral-500 font-mono mt-0.5 block">
                          CODE: {sub.subjectCode} • Semester {sub.semester}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold border shrink-0 ${
                        isSubSafe 
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                      }`}>
                        {isSubSafe ? "Eligible" : "Shortage"}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-neutral-950 rounded-full h-1.5 mb-4 border border-neutral-900 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          isSubSafe ? "bg-emerald-500" : "bg-rose-500"
                        }`}
                        style={{ width: `${Math.min(subPct, 100)}%` }}
                      ></div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 py-2.5 border-t border-neutral-900 text-center text-xs">
                      <div>
                        <span className="text-[9px] text-neutral-500 uppercase font-bold tracking-wide">Held</span>
                        <span className="block font-semibold text-white mt-0.5">{sub.totalClasses} lectures</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-neutral-500 uppercase font-bold tracking-wide">Attended</span>
                        <span className="block font-semibold text-white mt-0.5">{sub.attendedClasses} lectures</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-neutral-500 uppercase font-bold tracking-wide">Percentage</span>
                        <span className={`block font-bold mt-0.5 ${isSubSafe ? "text-emerald-400" : "text-rose-500"}`}>
                          {subPct}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {!isSubSafe && sub.totalClasses > 0 && (
                    <div className="text-[10px] text-rose-400 flex items-center gap-1 leading-none mt-2 font-semibold bg-rose-500/5 border border-rose-500/10 rounded p-2">
                      <AlertTriangle size={12} className="shrink-0" />
                      <span>Detention Risk: Must increase presence to reach 75%.</span>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="col-span-2 p-8 text-center glass-card border border-neutral-800 text-neutral-500 font-mono text-xs">
              No subjects registered in study plan.
            </div>
          )}
        </div>
      </div>

      {/* Chronological logs register */}
      <div className="glass-card border border-neutral-800 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5 pb-3 border-b border-neutral-900">
          <h3 className="font-display font-bold text-white text-sm flex items-center gap-2">
            <Calendar size={14} className="text-blue-400" />
            <span>Chronological Lecture Presence Log</span>
          </h3>

          {/* Subject Filter dropdown */}
          <div className="w-full sm:w-60 flex items-center gap-2 bg-neutral-950 border border-neutral-850 rounded px-2.5 text-xs text-white">
            <Filter size={12} className="text-neutral-500 shrink-0" />
            <span className="text-neutral-500">Subject:</span>
            <select
              value={selectedSubjFilter}
              onChange={(e) => handleFilterChange(e.target.value)}
              className="bg-transparent text-white cursor-pointer py-2 flex-1 focus:outline-none"
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
            <div className="text-center py-10 text-neutral-500">
              <Loader2 className="animate-spin text-blue-500 mx-auto mb-2" size={20} />
              <span className="font-mono text-[10px]">Loading lecture records...</span>
            </div>
          ) : historyRecords.length > 0 ? (
            <>
              {/* History Cards - Universal Responsive Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                {historyRecords.map(log => (
                  <div key={log.id} className="p-3.5 rounded-lg bg-neutral-950/40 border border-neutral-900 hover:border-neutral-800 transition flex items-center justify-between text-xs gap-3">
                    <div className="space-y-1 min-w-0">
                      <h4 className="font-semibold text-white truncate" title={log.subjectName}>
                        {log.subjectCode}: {log.subjectName}
                      </h4>
                      <div className="flex items-center flex-wrap gap-1.5 text-[9px] text-neutral-500 font-mono mt-1">
                        <span className="text-neutral-400 font-bold">{log.attendanceDate}</span>
                        <span>•</span>
                        <span>Sec {log.section}</span>
                        <span>•</span>
                        <span className="truncate">{log.markedBy}</span>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {log.status === "present" ? (
                        <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-2.5 py-1">
                          <CheckCircle size={12} />
                          <span>Present</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[9px] font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded px-2.5 py-1">
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
                <div className="flex items-center justify-between border-t border-neutral-900 pt-4 mt-4">
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
