"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import {
  Check,
  Users,
  BookOpen,
  Sparkles,
  Loader2,
  AlertCircle,
  Search,
  Lock,
  Unlock,
  Save,
  Settings,
  AlertTriangle,
  Info,
  ClipboardList,
  Send,
} from "lucide-react";

// Faculty Results now runs entirely off Pending Result Entry Tasks — created
// automatically when an exam the faculty is responsible for (via their
// Teaching Assignment) is marked Completed. There is no manual subject/section
// dropdown: a task only exists because the Workflow Engine already resolved
// exactly who is responsible for entering these marks.
interface ResultEntryTask {
  id: string;
  examId: string;
  teachingAssignmentId: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  section: string;
  examType: string;
  maximumMarks: number;
  status: "open" | "draft_saved" | "submitted_for_approval" | "published" | "closed";
  windowClosesAt: string | null;
}

interface RosterRecord {
  studentId: string;
  rollNumber: string;
  fullName: string;
  marks: string;
  isAbsent: boolean;
  remarks: string;
  publicationStatus: "Draft" | "Published" | null;
}

function daysUntil(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const diffMs = new Date(dateStr).getTime() - Date.now();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (days < 0) return "Overdue";
  if (days === 0) return "Due today";
  return `Due in ${days} day${days === 1 ? "" : "s"}`;
}

export default function FacultyResults() {
  const { accessToken } = useAuth();

  const [loadingTasks, setLoadingTasks] = useState(true);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState("");

  const [tasks, setTasks] = useState<ResultEntryTask[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");

  const [records, setRecords] = useState<RosterRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  };

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) || null;

  // 1. Fetch pending result entry tasks — this is the "faculty should only
  // see examinations assigned through their Teaching Assignments" rule.
  const fetchTasks = useCallback(async () => {
    setLoadingTasks(true);
    setError(null);
    try {
      const res = await apiFetch("/result-entry-tasks", {}, accessToken);
      if (res.success && res.data?.tasks) {
        const openTasks: ResultEntryTask[] = res.data.tasks.filter(
          (t: ResultEntryTask) => t.status !== "published" && t.status !== "closed"
        );
        setTasks(openTasks);
        if (openTasks.length > 0) {
          setSelectedTaskId((current) => (openTasks.some((t) => t.id === current) ? current : openTasks[0].id));
        } else {
          setSelectedTaskId("");
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load pending result entry tasks.");
    } finally {
      setLoadingTasks(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // 2. Fetch roster for the selected task's subject+section
  const fetchRoster = useCallback(async () => {
    if (!selectedTask) return;
    setLoadingRoster(true);
    setError(null);
    try {
      const res = await apiFetch(
        `/results/roster?subjectId=${selectedTask.subjectId}&section=${selectedTask.section}`,
        {},
        accessToken
      );
      if (res.success && res.data?.roster) {
        const rosterData = res.data.roster;

        const initialRecords = rosterData.map((r: any) => ({
          studentId: r.studentId,
          rollNumber: r.rollNumber,
          fullName: r.fullName,
          marks: r.marks !== null ? r.marks.toString() : "0",
          isAbsent: r.resultStatus === "Absent",
          remarks: r.remarks || "",
          publicationStatus: r.publicationStatus,
        }));

        setRecords(initialRecords);
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch section results roster.");
      setRecords([]);
    } finally {
      setLoadingRoster(false);
    }
  }, [selectedTask, accessToken]);

  useEffect(() => {
    fetchRoster();
  }, [fetchRoster]);

  const handleRecordChange = (studentId: string, field: keyof RosterRecord, value: any) => {
    setRecords((prev) =>
      prev.map((r) => {
        if (r.studentId !== studentId) return r;
        const updated = { ...r, [field]: value };
        if (field === "isAbsent" && value === true) {
          updated.marks = "0";
        }
        return updated;
      })
    );
  };

  const buildFormattedRecords = (): { records: any[]; errors: string[] } | null => {
    if (!selectedTask) return null;
    const maxNum = selectedTask.maximumMarks;
    const errors: string[] = [];

    if (isNaN(maxNum) || maxNum <= 0) errors.push("Invalid maximum marks configuration for this exam.");
    if (errors.length > 0) return { records: [], errors };

    const formattedRecords = records.map((r) => {
      const marksNum = parseFloat(r.marks || "0");

      if (!r.isAbsent) {
        if (isNaN(marksNum) || marksNum < 0) errors.push(`Invalid marks for ${r.fullName}`);
        if (marksNum > maxNum) errors.push(`Marks for ${r.fullName} cannot exceed ${maxNum}`);
      }

      return {
        studentId: r.studentId,
        marks: r.isAbsent ? 0 : marksNum,
        isAbsent: r.isAbsent,
        remarks: r.remarks.trim() || undefined,
      };
    });

    return { records: formattedRecords, errors };
  };

  const handlePublish = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedTask) return;

    setError(null);
    const built = buildFormattedRecords();
    if (!built || built.errors.length > 0) {
      setError(built?.errors[0] || "Invalid marks entry.");
      return;
    }

    setPublishing(true);
    try {
      const body = {
        maxMarks: selectedTask.maximumMarks,
        records: built.records,
      };

      // Step 1: Save the data
      const draftRes = await apiFetch(
        `/results/tasks/${selectedTask.id}/draft`,
        { method: "POST", body: JSON.stringify(body) },
        accessToken
      );

      if (draftRes.success) {
        // Step 2: Immediately publish
        const pubRes = await apiFetch(`/results/tasks/${selectedTask.id}/publish`, { method: "POST" }, accessToken);
        if (pubRes.success) {
          triggerToast("Results published to students.");
          fetchRoster();
          fetchTasks();
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to publish results.");
    } finally {
      setPublishing(false);
    }
  };

  const filteredRecords = React.useMemo(() => {
    return records.filter(
      (r) =>
        r.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.rollNumber.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [records, searchTerm]);

  const stats = React.useMemo(() => {
    const total = records.length;
    const published = records.filter((r) => r.publicationStatus === "Published").length;
    const draft = records.filter((r) => r.publicationStatus === "Draft").length;
    const absents = records.filter((r) => r.isAbsent).length;
    return { total, published, draft, absents };
  }, [records]);

  if (loadingTasks) {
    return (
      <div className="flex flex-col items-center justify-center py-20 dark:text-neutral-400 text-text-secondary">
        <Loader2 className="animate-spin text-blue-500 mb-3" size={30} />
        <span className="font-mono text-xs">Loading pending result entry tasks...</span>
      </div>
    );
  }

  return (
    <div className="relative">
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-emerald-600 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-xl shadow-emerald-600/20 border border-emerald-400/20 animate-fade-in">
          <Sparkles size={14} className="animate-pulse" />
          <span>{toastMsg}</span>
        </div>
      )}

      <div className="mb-6">
        <h2 className="font-display font-bold text-2xl dark:text-white text-text-primary">Pending Result Entries</h2>
        <p className="text-xs dark:text-neutral-400 text-text-secondary mt-1">
          A task appears here automatically once an examination you are responsible for (via your Teaching
          Assignment) is marked Completed. There is no manual subject selection.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold rounded-lg mb-6 flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="p-12 text-center glass-card border border-border-subtle dark:text-neutral-500 text-text-muted font-mono text-xs">
          No pending result entry tasks. Tasks open automatically when an examination for one of your teaching
          assignments is marked Completed.
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          <div className="flex-1 w-full space-y-6">
            <div className="glass-card border border-border-subtle rounded-xl p-4 space-y-4">
              {/* Task list */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {tasks.map((t) => {
                  const due = daysUntil(t.windowClosesAt);
                  const isSelected = t.id === selectedTaskId;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTaskId(t.id)}
                      className={`text-left rounded-lg border p-3 transition ${
                        isSelected
                          ? "border-blue-500 bg-blue-500/10"
                          : "dark:border-neutral-850 border-border-subtle hover:border-blue-400/50"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold dark:text-white text-text-primary">
                        <ClipboardList size={12} className="text-blue-400" />
                        <span>
                          {t.subjectCode} · Section {t.section}
                        </span>
                      </div>
                      <div className="text-[10px] dark:text-neutral-500 text-text-muted mt-1">{t.examType}</div>
                      {due && (
                        <div
                          className={`text-[9px] font-bold mt-1 ${
                            due === "Overdue" ? "text-rose-400" : "text-amber-500"
                          }`}
                        >
                          {due}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="pt-3 border-t dark:border-neutral-900 border-border-subtle flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-xs dark:text-white text-text-primary">
                  <BookOpen size={12} className="dark:text-neutral-500 text-text-muted" />
                  <span className="font-semibold">
                    {selectedTask ? `${selectedTask.subjectName} — Section ${selectedTask.section}` : "Select a task"}
                  </span>
                </div>

                <div className="relative ml-auto">
                  <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 dark:text-neutral-500 text-text-muted" />
                  <input
                    type="text"
                    placeholder="Search by name or roll..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 pr-3 py-2 text-xs dark:bg-neutral-955 bg-surface border dark:border-neutral-850 border-border-subtle rounded dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition"
                  />
                </div>
              </div>

              {/* Removed internal/external manual max marks editors */}
            </div>

            <form onSubmit={handlePublish} className="space-y-4">
              <div className="space-y-2">
                {loadingRoster ? (
                  <div className="text-center py-16 text-neutral-500">
                    <Loader2 className="animate-spin text-blue-500 mx-auto mb-2" size={24} />
                    <span className="font-mono text-xs">Pulling class roster from database...</span>
                  </div>
                ) : filteredRecords.length > 0 ? (
                  filteredRecords.map((student, index) => {
                    const isPublished = student.publicationStatus === "Published";
                    return (
                      <div
                        key={student.studentId}
                        className={`glass-card border rounded-xl p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4 transition ${
                          isPublished
                            ? "dark:border-neutral-900 border-border-subtle dark:bg-neutral-950/20 bg-neutral-100/20"
                            : "border-border-subtle dark:hover:border-neutral-700 hover:border-border-strong"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-[240px]">
                          <div className="w-9 h-9 rounded-full dark:bg-neutral-900 bg-neutral-100 border dark:border-neutral-850 border-border-subtle flex items-center justify-center font-bold text-blue-400 shrink-0">
                            {student.fullName.charAt(0)}
                          </div>
                          <div>
                            <h4 className="text-xs font-bold dark:text-white text-text-primary leading-tight">{student.fullName}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[9px] dark:text-neutral-500 text-text-muted font-mono">Roll: {student.rollNumber}</span>
                              <span className="dark:text-neutral-700 text-neutral-300">•</span>
                              {isPublished ? (
                                <span className="flex items-center gap-0.5 text-[8px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-1">
                                  <Lock size={8} /> Published
                                </span>
                              ) : student.publicationStatus === "Draft" ? (
                                <span className="flex items-center gap-0.5 text-[8px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded px-1">
                                  <Unlock size={8} /> Draft Saved
                                </span>
                              ) : (
                                <span className="text-[8px] dark:text-neutral-600 text-text-muted italic">No entry</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end sm:items-center">
                          <div>
                            <label className="text-[9px] dark:text-neutral-500 text-text-muted uppercase font-bold block sm:hidden">Marks</label>
                            <div className="flex items-center gap-1.5 mt-1 sm:mt-0">
                              <input
                                id={`marks-input-${index}`}
                                type="number"
                                disabled={isPublished || student.isAbsent}
                                value={student.marks}
                                min="0"
                                max={selectedTask?.maximumMarks}
                                onChange={(e) => handleRecordChange(student.studentId, "marks", e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    const nextInput = document.getElementById(`marks-input-${index + 1}`);
                                    if (nextInput) {
                                      nextInput.focus();
                                      (nextInput as HTMLInputElement).select();
                                    }
                                  }
                                }}
                                className="w-16 dark:bg-neutral-955 bg-background border dark:border-neutral-850 border-border-subtle dark:disabled:bg-neutral-900 disabled:bg-neutral-100 dark:disabled:text-neutral-600 disabled:text-neutral-400 rounded px-2 py-1 text-xs dark:text-white text-text-primary font-mono text-center focus:outline-none focus:border-blue-600 transition"
                              />
                              <span className="text-[10px] dark:text-neutral-600 text-text-muted">/ {selectedTask?.maximumMarks}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`absent-${student.studentId}`}
                              disabled={isPublished}
                              checked={student.isAbsent}
                              onChange={(e) => handleRecordChange(student.studentId, "isAbsent", e.target.checked)}
                              className="dark:bg-neutral-950 bg-background border dark:border-neutral-850 border-border-subtle rounded text-blue-600 focus:ring-0 focus:ring-offset-0 disabled:opacity-40"
                            />
                            <label
                              htmlFor={`absent-${student.studentId}`}
                              className={`text-xs select-none cursor-pointer ${
                                student.isAbsent ? "text-amber-550 font-bold" : "dark:text-neutral-400 text-text-secondary"
                              } ${isPublished ? "pointer-events-none opacity-40" : ""}`}
                            >
                              Mark Absent
                            </label>
                          </div>

                          <div>
                            <input
                              type="text"
                              placeholder="Add remarks..."
                              disabled={isPublished}
                              value={student.remarks}
                              onChange={(e) => handleRecordChange(student.studentId, "remarks", e.target.value)}
                              className="w-full dark:bg-neutral-955 bg-background border dark:border-neutral-850 border-border-subtle dark:disabled:bg-neutral-900 disabled:bg-neutral-100 dark:disabled:text-neutral-600 disabled:text-neutral-400 rounded px-2.5 py-1 text-xs dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition dark:placeholder-neutral-700 placeholder-neutral-400"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-12 text-center glass-card border border-border-subtle dark:text-neutral-500 text-text-muted font-mono text-xs">
                    {searchTerm ? "No students match your query." : "No students registered for this section."}
                  </div>
                )}
              </div>

              {records.length > 0 && (
                <div className="glass-card border dark:border-neutral-850 border-border-subtle rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 dark:bg-neutral-955/65 bg-surface/95 sticky bottom-20 lg:bottom-4 z-15 shadow-2xl">
                  <div className="text-xs dark:text-neutral-400 text-text-secondary">
                    Total: <strong className="dark:text-white text-text-primary font-mono">{stats.total}</strong> •{" "}
                    Draft: <strong className="dark:text-blue-400 text-blue-700 font-mono">{stats.draft}</strong> •{" "}
                    Published: <strong className="dark:text-emerald-400 text-emerald-700 font-mono">{stats.published}</strong> •{" "}
                    Absent: <strong className="dark:text-amber-500 text-amber-700 font-mono">{stats.absents}</strong>
                  </div>

                  {stats.published === stats.total ? (
                    <div className="text-[10px] dark:text-emerald-400 text-emerald-700 font-mono flex items-center gap-1.5 font-semibold dark:bg-emerald-500/5 bg-emerald-50 border dark:border-emerald-500/10 border-emerald-200 rounded p-2">
                      <Lock size={12} />
                      <span>All marks for this task are published and locked.</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        type="submit"
                        disabled={publishing}
                        className="flex-1 sm:flex-none px-6 py-2.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs shadow-lg shadow-emerald-600/25 cursor-pointer disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5"
                      >
                        {publishing ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                        <span>Publish Results</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </form>
          </div>

          <div className="w-full lg:w-80 space-y-4 shrink-0">
            <div className="glass-card border border-border-subtle rounded-xl p-4 space-y-3">
              <h3 className="font-display font-bold dark:text-white text-text-primary text-sm flex items-center gap-1.5">
                <Info size={14} className="text-blue-400" />
                <span>How this works</span>
              </h3>
              <ul className="text-[11px] dark:text-neutral-400 text-text-secondary space-y-1.5 list-disc list-inside">
                <li>A task opens only after the exam is marked <strong className="dark:text-white text-text-primary">Completed</strong> and your Teaching Assignment is resolved.</li>
                <li>You can only enter marks for tasks assigned to you — nothing here was manually picked.</li>
                <li>
                  <Check size={10} className="inline text-emerald-400" /> Once you click Publish, the results are locked and update the student dashboard immediately.
                </li>
              </ul>
            </div>

            {stats.published > 0 && (
              <div className="glass-card border dark:border-neutral-800 border-amber-200 rounded-xl p-4 dark:bg-amber-500/5 bg-amber-50 dark:border-amber-500/10 text-amber-700 space-y-2">
                <h4 className="text-xs font-bold flex items-center gap-1">
                  <AlertTriangle size={13} />
                  <span>Partial Locks Active</span>
                </h4>
                <p className="text-[10px] dark:text-neutral-400 text-text-secondary leading-normal">
                  {stats.published} student records are locked because they have already been published.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
