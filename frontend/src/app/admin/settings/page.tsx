"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Shield, Settings, Database, Activity, Save, RefreshCw, CheckCircle, SlidersHorizontal, AlertCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";

// Part 2 / Part 10: Teaching Load Settings — Theory/Lab/Tutorial weights,
// min/max subjects per faculty, weekly load bounds, and the marks-entry
// window policy. Backed by the real /teaching-load-settings endpoint
// (a singleton row every workload calculation and validation reads from).
interface TeachingLoadSettings {
  theoryWeight: number;
  labWeight: number;
  tutorialWeight: number;
  minWeeklyLoad: number | null;
  maxWeeklyLoad: number;
  minSubjectsPerFaculty: number;
  maxSubjectsPerFaculty: number;
  autoMarksWindowDays: number | null;
  autoCloseMarksWindowDays: number | null;
  requireResultVerification: boolean;
}

function TeachingLoadSettingsCard() {
  const { accessToken } = useAuth();
  const [settings, setSettings] = useState<TeachingLoadSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/teaching-load-settings", {}, accessToken);
      if (res.success && res.data?.settings) setSettings(res.data.settings);
    } catch (err: any) {
      setError(err?.message || "Failed to load teaching load settings");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch("/teaching-load-settings", {
        method: "PUT",
        body: JSON.stringify(settings),
      }, accessToken);
      if (res.success) {
        setSettings(res.data.settings);
        setMessage("Teaching load settings updated successfully");
        setTimeout(() => setMessage(null), 4000);
      } else {
        setError(res.message || "Failed to update settings");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  const numField = (key: keyof TeachingLoadSettings, label: string, opts?: { step?: string; nullable?: boolean }) => (
    <div>
      <label className="text-[10px] uppercase font-bold text-text-muted block mb-1">{label}</label>
      <input
        type="number"
        step={opts?.step ?? "1"}
        value={settings ? (settings[key] as number | null) ?? "" : ""}
        onChange={(e) => {
          if (!settings) return;
          const raw = e.target.value;
          const val = raw === "" ? (opts?.nullable ? null : 0) : Number(raw);
          setSettings({ ...settings, [key]: val });
        }}
        className="w-full px-3 py-2 text-xs dark:bg-neutral-900 bg-background border border-border-subtle rounded-lg dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition"
      />
    </div>
  );

  return (
    <div className="bg-surface border border-border-subtle rounded-xl p-6 shadow-sm">
      <h3 className="font-display font-bold text-text-primary text-base flex items-center gap-2 mb-4 border-b border-border-subtle/60 pb-3">
        <SlidersHorizontal size={18} className="text-indigo-500" />
        <span>Teaching Load & Academic Policy Settings</span>
      </h3>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-text-muted">
          <RefreshCw size={16} className="animate-spin" />
        </div>
      ) : settings ? (
        <form onSubmit={handleSave} className="space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[11px] rounded-lg flex items-start gap-2">
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {message && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-[11px] rounded-lg flex items-center gap-2">
              <CheckCircle size={14} />
              <span>{message}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {numField("theoryWeight", "Theory Weight", { step: "0.1" })}
            {numField("labWeight", "Lab Weight", { step: "0.1" })}
            {numField("tutorialWeight", "Tutorial Weight", { step: "0.1" })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {numField("minWeeklyLoad", "Minimum Weekly Load (optional)", { nullable: true })}
            {numField("maxWeeklyLoad", "Maximum Weekly Load")}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {numField("minSubjectsPerFaculty", "Minimum Subjects Per Faculty")}
            {numField("maxSubjectsPerFaculty", "Maximum Subjects Per Faculty")}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {numField("autoMarksWindowDays", "Auto Marks Window (days, optional)", { nullable: true })}
            {numField("autoCloseMarksWindowDays", "Auto Close Marks Window (days, optional)", { nullable: true })}
          </div>

          <div className="flex items-center gap-2 py-1">
            <input
              type="checkbox"
              id="requireResultVerification"
              checked={settings.requireResultVerification}
              onChange={(e) => setSettings({ ...settings, requireResultVerification: e.target.checked })}
              className="w-4 h-4 rounded border-border-subtle"
            />
            <label htmlFor="requireResultVerification" className="text-xs font-semibold text-text-primary cursor-pointer select-none">
              Require HOD/Admin verification before results can be published
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition cursor-pointer"
          >
            {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
            Save Teaching Load Settings
          </button>
        </form>
      ) : (
        <div className="text-xs text-text-muted">Unable to load settings.</div>
      )}
    </div>
  );
}

export default function AdminSettingsPage() {
  const [term, setTerm] = useState("2026-27");
  const [systemName, setSystemName] = useState("Sreyas Institute of Engineering & Technology ERP");
  const [saving, setSaving] = useState(false);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      alert("ERP Configuration updated successfully!");
    }, 1000);
  };

  const handleBackup = () => {
    setBackupStatus("in_progress");
    setTimeout(() => {
      setBackupStatus("completed");
    }, 2000);
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Header */}
      <div className="space-y-1">
        <span className="text-[9px] uppercase font-bold text-purple-500 tracking-wider font-mono">
          Super Admin Control
        </span>
        <h2 className="font-display font-bold text-xl dark:text-white text-text-primary flex items-center gap-2">
          <Settings size={20} className="text-purple-500" />
          <span>System Settings & Configuration</span>
        </h2>
        <p className="text-[10px] dark:text-neutral-400 text-text-secondary">
          Configure ERP portal settings, roles permissions registry, and system database backups.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: ERP System Configuration */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-surface border border-border-subtle rounded-xl p-6 shadow-sm">
            <h3 className="font-display font-bold text-text-primary text-base flex items-center gap-2 mb-4 border-b border-border-subtle/60 pb-3">
              <Settings size={18} className="text-blue-500" />
              <span>ERP Configuration Settings</span>
            </h3>
            
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-bold text-text-muted block mb-1">Institution System Name</label>
                <input
                  type="text"
                  value={systemName}
                  onChange={(e) => setSystemName(e.target.value)}
                  className="w-full px-3 py-2 text-xs dark:bg-neutral-900 bg-background border border-border-subtle rounded-lg dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-text-muted block mb-1">Active Academic Term</label>
                  <select
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    className="w-full px-3 py-2 text-xs dark:bg-neutral-900 bg-background border border-border-subtle rounded-lg dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition"
                  >
                    <option value="2025-26">Academic Year 2025-2026</option>
                    <option value="2026-27">Academic Year 2026-2027 (Odd Sem)</option>
                    <option value="2027-28">Academic Year 2027-2028</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-text-muted block mb-1">System Mode</label>
                  <select
                    className="w-full px-3 py-2 text-xs dark:bg-neutral-900 bg-background border border-border-subtle rounded-lg dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition"
                    defaultValue="dev"
                  >
                    <option value="dev">Development / Simulation Mode</option>
                    <option value="prod">Production Mode</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition cursor-pointer"
              >
                {saving ? (
                  <RefreshCw size={13} className="animate-spin" />
                ) : (
                  <Save size={13} />
                )}
                Save Configuration
              </button>
            </form>
          </div>

          <TeachingLoadSettingsCard />

          {/* User Roles & Permissions Map */}
          <div className="bg-surface border border-border-subtle rounded-xl p-6 shadow-sm">
            <h3 className="font-display font-bold text-text-primary text-base flex items-center gap-2 mb-4 border-b border-border-subtle/60 pb-3">
              <Shield size={18} className="text-purple-500" />
              <span>User Roles & Security Permissions Map</span>
            </h3>

            <div className="space-y-4">
              <p className="text-[11px] text-text-secondary leading-relaxed">
                Review client-side Role-Based Access Control settings mapping access indices to system endpoints:
              </p>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border-subtle text-text-muted uppercase text-[9px] font-bold">
                      <th className="py-2">System Action</th>
                      <th className="py-2">Super Admin</th>
                      <th className="py-2">College Admin</th>
                      <th className="py-2">Faculty/HOD</th>
                      <th className="py-2">Student</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle/60 text-text-secondary">
                    {[
                      { action: "users:create / modify roles", sa: "Yes", ca: "No", fa: "No", st: "No" },
                      { action: "database:maintenance / config", sa: "Yes", ca: "No", fa: "No", st: "No" },
                      { action: "announcements:write", sa: "Yes", ca: "Yes", fa: "Yes (HOD)", st: "No" },
                      { action: "attendance:take", sa: "No", ca: "No", fa: "Yes", st: "No" },
                      { action: "grades:upload & check results", sa: "Yes", ca: "Yes", fa: "Yes", st: "Yes (Read)" },
                      { action: "fees:invoice generation", sa: "Yes", ca: "Yes", fa: "No", st: "No" },
                    ].map((row, idx) => (
                      <tr key={idx} className="hover:bg-surface-hover/30">
                        <td className="py-2.5 font-mono text-[10px] font-bold text-text-primary">{row.action}</td>
                        <td className="py-2.5 text-purple-500 font-bold">{row.sa}</td>
                        <td className="py-2.5">{row.ca}</td>
                        <td className="py-2.5">{row.fa}</td>
                        <td className="py-2.5">{row.st}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Maintenance & Logs */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-surface border border-border-subtle rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="font-display font-bold text-text-primary text-base flex items-center gap-2 border-b border-border-subtle/60 pb-3">
              <Database size={18} className="text-amber-500" />
              <span>Database Maintenance</span>
            </h3>

            <div className="space-y-3">
              <p className="text-[11px] text-text-secondary leading-relaxed">
                Initiate snapshot backups of the PostgreSQL active schemas or clear transient caches:
              </p>

              <button
                onClick={handleBackup}
                disabled={backupStatus === "in_progress"}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-border-subtle bg-surface hover:bg-slate-100 dark:hover:bg-neutral-800 rounded-lg text-xs font-semibold text-text-primary cursor-pointer transition"
              >
                <Activity size={13} className="text-amber-500" />
                <span>Create System Backup</span>
              </button>

              {backupStatus === "in_progress" && (
                <div className="text-[10px] text-text-muted font-mono flex items-center gap-1.5 justify-center py-1">
                  <RefreshCw size={12} className="animate-spin text-amber-500" />
                  <span>Dumping postgres schemas to SQL snapshot...</span>
                </div>
              )}

              {backupStatus === "completed" && (
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-semibold flex items-center gap-1.5 justify-center">
                  <CheckCircle size={12} />
                  <span>Backup SIET_DB_2026.sql downloaded.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
