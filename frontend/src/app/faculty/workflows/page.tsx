"use client";

import { useState, useMemo } from "react";
import { GitBranch, AlertCircle, CheckCircle2, Clock, RotateCw, Filter, Search, ChevronLeft, ChevronRight, Play } from "lucide-react";

interface WorkflowLog {
  id: string;
  name: string;
  triggerEvent: string;
  executionTime: string;
  durationMs: number;
  status: "Success" | "Running" | "Failed" | "Retrying";
  retryCount: number;
}

const WORKFLOW_LOGS: WorkflowLog[] = [
  { id: "1", name: "Syllabus Progress Tracker", triggerEvent: "Faculty updated Lesson Unit-I", executionTime: "2026-07-09T10:14:00Z", durationMs: 120, status: "Success", retryCount: 0 },
  { id: "2", name: "LMS Submission Scraper", triggerEvent: "Student uploaded WebTech Lab assignment", executionTime: "2026-07-09T09:45:00Z", durationMs: 450, status: "Success", retryCount: 0 },
  { id: "3", name: "Grade Announcement Alert", triggerEvent: "Faculty published Internal Marks Unit-II", executionTime: "2026-07-09T09:12:00Z", durationMs: 1100, status: "Failed", retryCount: 2 },
  { id: "4", name: "LMS Syllabus Sync", triggerEvent: "Super Admin updated term dates", executionTime: "2026-07-09T08:30:00Z", durationMs: 80, status: "Success", retryCount: 0 },
  { id: "5", name: "Fee Payment Alert Broadcast", triggerEvent: "System invoice schedule", executionTime: "2026-07-09T08:00:00Z", durationMs: 1500, status: "Retrying", retryCount: 1 },
  { id: "6", name: "Timetable Scheduler", triggerEvent: "HOD adjusted lecture slots", executionTime: "2026-07-09T07:15:00Z", durationMs: 340, status: "Success", retryCount: 0 },
  { id: "7", name: "Attendance Compliance Notifier", triggerEvent: "Daily attendance submission complete", executionTime: "2026-07-09T06:00:00Z", durationMs: 620, status: "Success", retryCount: 0 }
];

export default function FacultyWorkflowsPage() {
  const [logs, setLogs] = useState<WorkflowLog[]>(WORKFLOW_LOGS);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const limit = 5;

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch = log.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            log.triggerEvent.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "ALL" || log.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [logs, searchTerm, statusFilter]);

  const paginatedLogs = useMemo(() => {
    const start = (page - 1) * limit;
    return filteredLogs.slice(start, start + limit);
  }, [filteredLogs, page]);

  const totalPages = Math.ceil(filteredLogs.length / limit) || 1;

  // Stats
  const successCount = logs.filter(l => l.status === "Success").length;
  const failureCount = logs.filter(l => l.status === "Failed").length;
  const avgDuration = Math.round(logs.reduce((acc, l) => acc + l.durationMs, 0) / logs.length);

  return (
    <div className="space-y-6 pb-12 w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl border border-border-subtle bg-surface shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <GitBranch className="text-blue-500 h-5 w-5 rotate-90" />
            <h1 className="font-display font-bold text-xl text-text-primary leading-none">
              Academic Workflow Engine
            </h1>
          </div>
          <p className="text-xs text-text-muted">
            Track automated ERP system workflows, triggers, notification dispatches, and analytic sync logs.
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-border-subtle bg-surface p-5 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">Execution Status</p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <p className="font-display font-black text-2xl text-text-primary">
                {Math.round((successCount / logs.length) * 100)}%
              </p>
              <p className="text-xs text-text-muted font-bold">Success Rate</p>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <CheckCircle2 size={18} />
          </div>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface p-5 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">Avg Execution Time</p>
            <p className="font-display font-bold text-2xl text-text-primary mt-0.5">{avgDuration} ms</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
            <Clock size={18} />
          </div>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface p-5 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">System Failures</p>
            <p className="font-display font-bold text-2xl text-red-500 mt-0.5">{failureCount} Alert Logs</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center">
            <AlertCircle size={18} />
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Timeline */}
        <div className="lg:col-span-4 rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm space-y-4">
          <div>
            <h3 className="font-display font-bold text-sm text-text-primary uppercase tracking-wider">
              Active Workflow Timeline
            </h3>
            <p className="text-[11px] text-text-muted mt-0.5">Timeline of automated ERP cascading events</p>
          </div>

          <div className="relative pl-6 border-l border-neutral-200 dark:border-neutral-800 space-y-6 ml-2 pt-2">
            {[
              { title: "Syllabus Progress Tracker", trigger: "Faculty uploads unit planner notes", outcome: "Updated LMS materials status", time: "10 mins ago" },
              { title: "Automatic Grade Dispatch", trigger: "Internal marks published in portal", outcome: "Students notified on email", time: "1 hour ago" },
              { title: "Registrar Sync Engine", trigger: "HOD schedules remedial class", outcome: "Student calendar alerts dispatched", time: "3 hours ago" }
            ].map((node, index) => (
              <div key={index} className="relative space-y-1">
                {/* Node dot */}
                <div className="absolute -left-[30px] top-1.5 w-2 h-2 rounded-full bg-blue-500 ring-4 ring-blue-500/10" />
                <div className="flex justify-between items-center text-[10px] text-text-muted">
                  <span className="font-semibold text-accent-blue">{node.time}</span>
                </div>
                <h4 className="text-xs font-semibold text-text-primary">{node.title}</h4>
                <p className="text-[11px] text-text-secondary">{node.trigger} &rarr; <span className="italic">{node.outcome}</span></p>
              </div>
            ))}
          </div>
        </div>

        {/* Right Logs table */}
        <div className="lg:col-span-8 space-y-4">
          <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm space-y-4">
            {/* Filter and Search Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="font-display font-bold text-sm text-text-primary uppercase tracking-wider">
                  Workflow Execution Logs
                </h3>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {/* Search */}
                <div className="flex items-center gap-2 rounded-lg border border-border-subtle bg-background px-3 py-1.5 text-xs text-text-secondary w-full sm:w-auto">
                  <Search size={13} className="text-text-muted" />
                  <input
                    type="text"
                    placeholder="Search logs..."
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                    className="bg-transparent focus:outline-none w-full"
                  />
                </div>

                {/* Status select */}
                <div className="flex items-center gap-2 rounded-lg border border-border-subtle bg-background px-3 py-1.5 text-xs text-text-secondary shrink-0">
                  <Filter size={13} className="text-text-muted" />
                  <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                    className="bg-transparent focus:outline-none font-semibold"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="Success">Success</option>
                    <option value="Running">Running</option>
                    <option value="Failed">Failed</option>
                    <option value="Retrying">Retrying</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-border-subtle rounded-xl bg-background">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="bg-neutral-50 dark:bg-neutral-900 border-b border-border-subtle text-text-muted font-bold">
                  <tr>
                    <th className="p-3">Workflow Name</th>
                    <th className="p-3">Trigger Event</th>
                    <th className="p-3">Execution Time</th>
                    <th className="p-3">Time Elapsed</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Retries</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle text-text-secondary font-medium">
                  {paginatedLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-surface-hover/30">
                      <td className="p-3 font-bold text-text-primary">{log.name}</td>
                      <td className="p-3">{log.triggerEvent}</td>
                      <td className="p-3">{new Date(log.executionTime).toLocaleString()}</td>
                      <td className="p-3 font-mono">{log.durationMs}ms</td>
                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider border ${
                          log.status === "Success"
                            ? "text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/20"
                            : log.status === "Failed"
                            ? "text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-500/10 dark:border-red-500/20"
                            : log.status === "Retrying"
                            ? "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/20"
                            : "text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-500/10 dark:border-blue-500/20"
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="p-3 text-center">{log.retryCount}</td>
                    </tr>
                  ))}
                  {paginatedLogs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center p-6 text-text-muted italic">
                        No execution logs match the active filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center pt-2">
                <span className="text-xs text-text-muted">
                  Showing page {page} of {totalPages} ({filteredLogs.length} total logs)
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                    className="p-1.5 rounded-lg border border-border-subtle hover:bg-surface-hover hover:border-border-hover disabled:opacity-40 shrink-0 cursor-pointer"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    disabled={page === totalPages}
                    onClick={() => setPage(p => p + 1)}
                    className="p-1.5 rounded-lg border border-border-subtle hover:bg-surface-hover hover:border-border-hover disabled:opacity-40 shrink-0 cursor-pointer"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
