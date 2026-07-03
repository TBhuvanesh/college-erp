"use client";

import React from "react";
import Link from "next/link";
import { BookOpen, Clock, ArrowRight, CheckCircle2, FileText, ChevronRight } from "lucide-react";

export interface StudentAssignmentData {
  id: string;
  title: string;
  subjectName: string;
  dueDate: string;
  isSubmitted: boolean;
  grade?: string | null;
  feedback?: string | null;
  submissionStatus: "graded" | "submitted" | "pending";
}

export interface FacultyAssignmentData {
  id: string;
  title: string;
  subjectName: string;
  dueDate: string;
  pendingEvaluations: number;
  totalSubmissions: number;
}

interface AssignmentWidgetProps {
  studentData?: StudentAssignmentData[];
  facultyData?: FacultyAssignmentData[];
  loading?: boolean;
  role: "student" | "faculty" | "admin";
}

const statusConfig = {
  pending: {
    dot: "border-red-400 bg-red-500/10",
    inner: "bg-red-400",
    label: "bg-red-500/10 text-red-400 border-red-500/20",
    text: "Pending",
  },
  submitted: {
    dot: "border-blue-400 bg-blue-500/10",
    inner: "bg-blue-400",
    label: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    text: "Submitted",
  },
  graded: {
    dot: "border-emerald-400 bg-emerald-500/10",
    inner: "bg-emerald-400",
    label: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    text: "Graded",
  },
};

export const AssignmentWidget: React.FC<AssignmentWidgetProps> = ({
  studentData = [],
  facultyData = [],
  loading = false,
  role
}) => {
  const pendingCount = studentData.filter(a => a.submissionStatus === "pending").length;
  const submittedCount = studentData.filter(a => a.submissionStatus === "submitted").length;
  const gradedCount = studentData.filter(a => a.submissionStatus === "graded").length;

  const displayData = role === "student"
    ? [...studentData].sort((a, b) => {
        const order = { pending: 0, submitted: 1, graded: 2 };
        return order[a.submissionStatus] - order[b.submissionStatus];
      }).slice(0, 6)
    : facultyData.slice(0, 6);

  const lmsHref = role === "student" ? "/student/lms" : "/faculty/lms";

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle/60">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500">
            <BookOpen size={14} strokeWidth={2.5} />
          </div>
          <h3 className="font-display font-bold text-sm text-text-primary">
            {role === "student" ? "Assignments" : "Tasks & Evaluations"}
          </h3>
        </div>
        <Link href={lmsHref} className="flex items-center gap-1 text-[11px] font-semibold text-accent-blue hover:underline">
          Open Canvas <ArrowRight size={11} />
        </Link>
      </div>

      {/* Student stats bar */}
      {role === "student" && !loading && studentData.length > 0 && (
        <div className="flex items-center gap-0 border-b border-border-subtle/60 divide-x divide-border-subtle/60">
          <div className="flex-1 flex flex-col items-center py-2.5 px-3">
            <span className="font-display font-black text-lg dark:text-red-400 text-red-650 leading-none">{pendingCount}</span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted mt-0.5">Pending</span>
          </div>
          <div className="flex-1 flex flex-col items-center py-2.5 px-3">
            <span className="font-display font-black text-lg dark:text-blue-400 text-blue-650 leading-none">{submittedCount}</span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted mt-0.5">Submitted</span>
          </div>
          <div className="flex-1 flex flex-col items-center py-2.5 px-3">
            <span className="font-display font-black text-lg dark:text-emerald-400 text-emerald-650 leading-none">{gradedCount}</span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted mt-0.5">Graded</span>
          </div>
        </div>
      )}

      {/* Task list */}
      <div className="px-3 py-3">
        {loading ? (
          <div className="space-y-2.5 p-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="w-4 h-4 rounded-full bg-surface-hover mt-0.5 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-surface-hover rounded w-3/4" />
                  <div className="h-2.5 bg-surface-hover rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : role === "student" ? (
          displayData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-7 gap-2 text-text-muted">
              <CheckCircle2 size={22} className="opacity-40" />
              <p className="text-xs font-medium">All assignments submitted</p>
            </div>
          ) : (
            <div className="space-y-1">
              {(displayData as StudentAssignmentData[]).map((a) => {
                const cfg = statusConfig[a.submissionStatus];
                const isPastDue = !a.isSubmitted && new Date(a.dueDate) < new Date();
                return (
                  <div
                    key={a.id}
                    className="group flex items-center gap-3 px-2.5 py-2.5 rounded-xl hover:bg-surface-hover border border-transparent hover:border-border-subtle transition-all cursor-pointer"
                  >
                    {/* Status dot */}
                    <div className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0 ${cfg.dot}`}>
                      {a.submissionStatus === "graded" ? (
                        <CheckCircle2 size={10} className="text-emerald-400" />
                      ) : (
                        <div className={`w-2 h-2 rounded-full ${cfg.inner}`} />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[13px] font-semibold text-text-primary truncate group-hover:text-accent-blue transition-colors">
                        {a.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-text-muted truncate max-w-[120px]">{a.subjectName}</span>
                        <span className="opacity-30 text-text-muted">·</span>
                        <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${isPastDue ? "dark:text-red-400 text-red-600" : "text-text-muted"}`}>
                          <Clock size={9} />
                          {new Date(a.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </span>
                        {a.grade && (
                          <>
                            <span className="opacity-30 text-text-muted">·</span>
                            <span className="text-[10px] font-bold text-emerald-400">{a.grade}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Status badge */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[9px] font-extrabold uppercase border px-1.5 py-0.5 rounded tracking-wider ${cfg.label}`}>
                        {cfg.text}
                      </span>
                      <ChevronRight size={13} className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          facultyData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-7 gap-2 text-text-muted">
              <FileText size={22} className="opacity-40" />
              <p className="text-xs font-medium">No active evaluations</p>
            </div>
          ) : (
            <div className="space-y-1">
              {(displayData as FacultyAssignmentData[]).map((a) => (
                <div key={a.id} className="group flex items-center gap-3 px-2.5 py-2.5 rounded-xl hover:bg-surface-hover border border-transparent hover:border-border-subtle transition-all cursor-pointer">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[13px] font-semibold text-text-primary truncate group-hover:text-accent-blue transition-colors">
                      {a.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-text-muted">{a.subjectName}</span>
                      <span className="opacity-30">·</span>
                      <span className="text-[10px] text-text-muted flex items-center gap-0.5">
                        <Clock size={9} />
                        {new Date(a.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                  </div>
                  {a.pendingEvaluations > 0 ? (
                    <span className="shrink-0 text-[9px] font-extrabold uppercase border border-amber-500/20 bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded tracking-wider">
                      {a.pendingEvaluations} to grade
                    </span>
                  ) : (
                    <span className="shrink-0 text-[9px] font-extrabold uppercase border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded tracking-wider">
                      Done
                    </span>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
};
