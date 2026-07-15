"use client";

import { useState, useMemo } from "react";
import { GitBranch, AlertCircle, CheckCircle2, Clock, RotateCw, Filter, Search, ShieldAlert, Cpu, Heart, Check } from "lucide-react";

interface SystemWorkflow {
  id: string;
  name: string;
  triggerEvent: string;
  avgDurationMs: number;
  successCount: number;
  failureCount: number;
  retryAttempts: number;
  healthStatus: "Healthy" | "Degraded" | "Critical";
}

const INSTITUTIONAL_WORKFLOWS: SystemWorkflow[] = [
  { id: "1", name: "Syllabus Progress Tracker", triggerEvent: "Faculty unit progress commit", avgDurationMs: 110, successCount: 1420, failureCount: 2, retryAttempts: 5, healthStatus: "Healthy" },
  { id: "2", name: "LMS Submission Scraper", triggerEvent: "Student assignment submit", avgDurationMs: 380, successCount: 3890, failureCount: 15, retryAttempts: 25, healthStatus: "Healthy" },
  { id: "3", name: "Grade Announcement Alert", triggerEvent: "Faculty marks publish", avgDurationMs: 950, successCount: 230, failureCount: 8, retryAttempts: 12, healthStatus: "Degraded" },
  { id: "4", name: "Fee Payment Broadcast", triggerEvent: "System invoice schedule", avgDurationMs: 1400, successCount: 110, failureCount: 14, retryAttempts: 28, healthStatus: "Critical" },
  { id: "5", name: "Compliance Notifier", triggerEvent: "Daily attendance complete", avgDurationMs: 540, successCount: 890, failureCount: 0, retryAttempts: 0, healthStatus: "Healthy" }
];

export default function AdminWorkflowsPage() {
  const [workflows, setWorkflows] = useState<SystemWorkflow[]>(INSTITUTIONAL_WORKFLOWS);
  const [searchTerm, setSearchTerm] = useState("");
  const [healthFilter, setHealthFilter] = useState<string>("ALL");

  const filteredWorkflows = useMemo(() => {
    return workflows.filter(w => {
      const matchesSearch = w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            w.triggerEvent.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesHealth = healthFilter === "ALL" || w.healthStatus === healthFilter;
      return matchesSearch && matchesHealth;
    });
  }, [workflows, searchTerm, healthFilter]);

  const totalRuns = workflows.reduce((acc, w) => acc + w.successCount + w.failureCount, 0);
  const totalFailures = workflows.reduce((acc, w) => acc + w.failureCount, 0);
  const successRate = Math.round(((totalRuns - totalFailures) / totalRuns) * 100);

  return (
    <div className="space-y-6 pb-12 w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl border border-border-subtle bg-surface shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Cpu className="text-blue-600 dark:text-blue-400 h-5 w-5" />
            <h1 className="font-display font-bold text-xl text-text-primary leading-none">
              System Workflow Health & Logs
            </h1>
          </div>
          <p className="text-xs text-text-muted">
            Super Admin access. Monitor microservice triggers, execution times, retry rates, and automated alerts health.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-500 text-xs font-bold px-3 py-1.5 rounded-full border border-emerald-500/20">
          <Heart size={12} className="fill-emerald-500 animate-pulse" />
          <span>All Engines Online</span>
        </div>
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-border-subtle bg-surface p-5 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">Global Success Rate</p>
            <p className="font-display font-black text-2xl text-text-primary">{successRate}%</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <CheckCircle2 size={18} />
          </div>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface p-5 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">Total Executions</p>
            <p className="font-display font-bold text-2xl text-text-primary">{totalRuns}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
            <Cpu size={18} />
          </div>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface p-5 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">Retry Attempts</p>
            <p className="font-display font-bold text-2xl text-text-primary">
              {workflows.reduce((acc, w) => acc + w.retryAttempts, 0)}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <RotateCw size={18} />
          </div>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface p-5 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">Failed Jobs</p>
            <p className="font-display font-bold text-2xl text-red-500">{totalFailures}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center">
            <ShieldAlert size={18} />
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-4 rounded-xl border border-border-subtle bg-surface shadow-sm">
          <div>
            <h3 className="font-display font-bold text-xs text-text-primary uppercase tracking-wider">
              Workflow Status Registry
            </h3>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Search */}
            <div className="flex items-center gap-2 rounded-lg border border-border-subtle bg-background px-3 py-1.5 text-xs text-text-secondary w-full sm:w-auto">
              <Search size={13} className="text-text-muted" />
              <input
                type="text"
                placeholder="Search workflows..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent focus:outline-none w-full"
              />
            </div>

            {/* Filter */}
            <div className="flex items-center gap-2 rounded-lg border border-border-subtle bg-background px-3 py-1.5 text-xs text-text-secondary shrink-0">
              <Filter size={13} className="text-text-muted" />
              <select
                value={healthFilter}
                onChange={(e) => setHealthFilter(e.target.value)}
                className="bg-transparent focus:outline-none font-semibold"
              >
                <option value="ALL">All Health</option>
                <option value="Healthy">Healthy</option>
                <option value="Degraded">Degraded</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
          </div>
        </div>

        {/* Workflow Table */}
        <div className="rounded-2xl border border-border-subtle bg-surface overflow-hidden shadow-sm">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="bg-neutral-50 dark:bg-neutral-900 border-b border-border-subtle text-text-muted font-bold">
              <tr>
                <th className="p-4">Workflow Name</th>
                <th className="p-4">Trigger Action</th>
                <th className="p-4">Avg Duration</th>
                <th className="p-4 text-center">Successful runs</th>
                <th className="p-4 text-center">Failed runs</th>
                <th className="p-4 text-center">Retries</th>
                <th className="p-4">Engine Health</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle text-text-secondary font-medium">
              {filteredWorkflows.map((w) => (
                <tr key={w.id} className="hover:bg-surface-hover/30">
                  <td className="p-4 font-bold text-text-primary">{w.name}</td>
                  <td className="p-4">{w.triggerEvent}</td>
                  <td className="p-4 font-mono">{w.avgDurationMs}ms</td>
                  <td className="p-4 text-center text-emerald-500">{w.successCount}</td>
                  <td className="p-4 text-center text-red-500">{w.failureCount}</td>
                  <td className="p-4 text-center">{w.retryAttempts}</td>
                  <td className="p-4">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider border ${
                      w.healthStatus === "Healthy"
                        ? "text-emerald-600 bg-emerald-50 border-emerald-250 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/20"
                        : w.healthStatus === "Degraded"
                        ? "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/20"
                        : "text-red-750 bg-red-50 border-red-200 dark:text-red-450 dark:bg-red-500/10 dark:border-red-500/20"
                    }`}>
                      {w.healthStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
