"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { 
  Loader2, 
  Search, 
  Filter, 
  Calendar,
  Sparkles,
  Percent,
  CheckCircle,
  XCircle
} from "lucide-react";

interface AttendanceRecord {
  id: string;
  studentName: string;
  studentRollNo: string;
  subjectName: string;
  subjectCode: string;
  facultyName: string;
  attendanceDate: string;
  status: "present" | "absent" | "late";
}

export default function HODAttendancePage() {
  const { accessToken } = useAuth();

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  const fetchAttendance = useCallback(async () => {
    if (!accessToken) return;

    try {
      setLoading(true);
      setError(null);

      const queryParams = new URLSearchParams({
        page: "1",
        limit: "200",
      });

      if (dateFilter) queryParams.append("date", dateFilter);
      if (statusFilter !== "ALL") queryParams.append("status", statusFilter.toLowerCase());
      if (searchTerm.trim()) queryParams.append("search", searchTerm);

      const res = await apiFetch(`/attendance?${queryParams.toString()}`, {}, accessToken);
      if (res.success && res.data?.records) {
        setRecords(res.data.records);
      } else {
        setError(res.message || "Failed to load attendance logs");
      }
    } catch (err: any) {
      setError(err.message || "Error connecting to server");
    } finally {
      setLoading(false);
    }
  }, [accessToken, dateFilter, statusFilter, searchTerm]);

  useEffect(() => {
    const timer = setTimeout(fetchAttendance, 300);
    return () => clearTimeout(timer);
  }, [fetchAttendance]);

  // Compute analytics
  const total = records.length;
  const present = records.filter(r => r.status === "present").length;
  const late = records.filter(r => r.status === "late").length;
  const absent = records.filter(r => r.status === "absent").length;
  const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="font-display font-bold text-2xl dark:text-white text-text-primary">Department Attendance logs</h2>
        <p className="text-xs dark:text-neutral-400 text-text-secondary mt-1">
          Review campus-wide class attendance reports for all student sections and subjects in your department.
        </p>
      </div>

      {/* Analytics Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border dark:border-neutral-800 border-border-subtle bg-surface shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-text-muted">Total Logs Checked</span>
            <h3 className="font-display font-bold text-xl text-text-primary mt-1">{total}</h3>
          </div>
          <Calendar className="text-indigo-500 opacity-20" size={24} />
        </div>
        <div className="p-4 rounded-xl border dark:border-neutral-800 border-border-subtle bg-surface shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-text-muted">Present Rate</span>
            <h3 className="font-display font-bold text-xl text-emerald-500 mt-1">{rate}%</h3>
          </div>
          <Percent className="text-emerald-500 opacity-20" size={24} />
        </div>
        <div className="p-4 rounded-xl border dark:border-neutral-800 border-border-subtle bg-surface shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-text-muted">Present / Late</span>
            <h3 className="font-display font-bold text-xl text-indigo-500 mt-1">{present + late}</h3>
          </div>
          <CheckCircle className="text-indigo-500 opacity-20" size={24} />
        </div>
        <div className="p-4 rounded-xl border dark:border-neutral-800 border-border-subtle bg-surface shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-text-muted">Absent Logs</span>
            <h3 className="font-display font-bold text-xl text-rose-500 mt-1">{absent}</h3>
          </div>
          <XCircle className="text-rose-500 opacity-20" size={24} />
        </div>
      </div>

      {/* Filter Options */}
      <div className="glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl p-4 flex flex-col md:flex-row gap-3 shadow-sm">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 dark:text-neutral-500 text-text-muted" />
          <input
            type="text"
            placeholder="Search by student name or roll number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs dark:bg-neutral-955 bg-background border dark:border-neutral-850 border-border-subtle rounded dark:text-white text-text-primary focus:outline-none focus:border-blue-500/50 transition"
          />
        </div>

        {/* Date Filter */}
        <div className="w-full md:w-48 flex items-center gap-2 dark:bg-neutral-955 bg-background border dark:border-neutral-850 border-border-subtle rounded px-2 text-xs dark:text-white text-text-primary">
          <Calendar size={12} className="dark:text-neutral-500 text-text-muted shrink-0" />
          <span className="dark:text-neutral-500 text-text-secondary">Date:</span>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="bg-transparent dark:text-white text-text-primary cursor-pointer py-1.5 flex-1 focus:outline-none text-[11px]"
          />
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
            <option value="PRESENT">Present</option>
            <option value="LATE">Late</option>
            <option value="ABSENT">Absent</option>
          </select>
        </div>
      </div>

      {/* Roster table */}
      <div className="glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl overflow-hidden shadow-sm">
        {error && (
          <div className="p-4 bg-rose-500/10 border-b dark:border-neutral-800 border-border-subtle text-rose-600 dark:text-rose-400 text-xs font-semibold font-mono">
            Error: {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="dark:bg-neutral-900/50 bg-neutral-100 border-b dark:border-neutral-800 border-border-subtle dark:text-neutral-400 text-text-secondary font-semibold">
                <th className="px-4 py-3 font-mono">Log Date</th>
                <th className="px-4 py-3 font-mono">Roll Number</th>
                <th className="px-4 py-3">Student Name</th>
                <th className="px-4 py-3">Subject / Course</th>
                <th className="px-4 py-3">Teaching Faculty</th>
                <th className="px-4 py-3 text-right">Attendance Status</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-neutral-900 divide-border-subtle dark:text-neutral-300 text-text-secondary">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 dark:text-neutral-500 text-text-muted">
                    <Loader2 className="animate-spin text-indigo-500 mx-auto mb-2" size={20} />
                    <span className="font-mono text-[10px]">Accessing department registers...</span>
                  </td>
                </tr>
              ) : records.length > 0 ? (
                records.map((rec) => (
                  <tr
                    key={rec.id}
                    className="hover:bg-neutral-100/30 dark:hover:bg-neutral-900/10 transition cursor-default"
                  >
                    <td className="px-4 py-3 font-mono dark:text-neutral-400 text-text-secondary">
                      {new Date(rec.attendanceDate).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric"
                      })}
                    </td>
                    <td className="px-4 py-3 font-mono dark:text-neutral-300 text-text-primary">{rec.studentRollNo}</td>
                    <td className="px-4 py-3 font-semibold dark:text-white text-text-primary">{rec.studentName}</td>
                    <td className="px-4 py-3">
                      <span className="dark:text-neutral-300 text-text-primary block">{rec.subjectName}</span>
                      <span className="text-[10px] text-text-muted font-mono">{rec.subjectCode}</span>
                    </td>
                    <td className="px-4 py-3 dark:text-neutral-400 text-text-secondary">{rec.facultyName}</td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border capitalize ${
                          rec.status === "present"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                            : rec.status === "late"
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                            : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                        }`}
                      >
                        {rec.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-12 dark:text-neutral-500 text-text-muted font-mono">
                    No department attendance records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
