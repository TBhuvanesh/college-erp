"use client";

import React from "react";
import Link from "next/link";
import { BookOpen, Clock, ArrowRight, CheckCircle2, AlertTriangle, FileText, ChevronRight } from "lucide-react";

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

export const AssignmentWidget: React.FC<AssignmentWidgetProps> = ({
  studentData = [],
  facultyData = [],
  loading = false,
  role
}) => {
  return (
    <div className="bg-surface/95 border border-border-subtle rounded-[16px] p-5 shadow-sm backdrop-blur-xl flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="bg-accent-purple-soft p-1.5 rounded-lg text-accent-purple border border-accent-purple/20">
            <BookOpen size={16} strokeWidth={2.5} />
          </div>
          <h3 className="font-display font-bold text-text-primary tracking-wide">Tasks & Assignments</h3>
        </div>
        <span className="text-[10px] uppercase font-bold tracking-widest text-text-muted">
          {role === "student" ? studentData.length : facultyData.length} Active
        </span>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto custom-scrollbar pr-1">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted gap-2 py-8">
            <div className="w-5 h-5 border-2 border-accent-purple-soft border-t-accent-purple rounded-full animate-spin" />
            <span className="text-xs font-medium">Syncing tasks...</span>
          </div>
        ) : role === "student" ? (
          studentData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-text-muted gap-2 py-8">
              <CheckCircle2 size={24} className="text-text-muted/50" />
              <span className="text-xs font-medium">All caught up!</span>
            </div>
          ) : (
            studentData.slice(0, 4).map((a) => (
              <div key={a.id} className="group relative flex items-start gap-3 p-3 rounded-xl hover:bg-surface-hover border border-transparent hover:border-border-subtle transition-all cursor-pointer">
                {/* Status Indicator */}
                <div className="pt-0.5 shrink-0">
                  {a.submissionStatus === "pending" ? (
                    <div className="w-4 h-4 rounded-full border-2 border-danger-soft bg-danger-soft/50 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-danger" />
                    </div>
                  ) : a.submissionStatus === "submitted" ? (
                    <div className="w-4 h-4 rounded-full border-2 border-accent-blue-soft bg-accent-blue-soft/50 flex items-center justify-center">
                      <CheckCircle2 size={10} className="text-accent-blue" />
                    </div>
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-success-soft bg-success-soft/50 flex items-center justify-center">
                      <CheckCircle2 size={10} className="text-success" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-text-primary truncate transition-colors">
                    {a.title}
                  </h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-text-muted font-medium truncate">
                      {a.subjectName}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-border-strong" />
                    <span className={`text-[10px] font-semibold flex items-center gap-1 ${a.submissionStatus === 'pending' ? 'text-danger' : 'text-text-muted'}`}>
                      <Clock size={10} />
                      {new Date(a.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                </div>

                {/* Action arrow */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center self-center shrink-0 pr-1">
                  <ChevronRight size={16} className="text-text-muted" />
                </div>
              </div>
            ))
          )
        ) : (
          facultyData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-text-muted gap-2 py-8">
              <FileText size={24} className="text-text-muted/50" />
              <span className="text-xs font-medium">No active tasks</span>
            </div>
          ) : (
            facultyData.slice(0, 4).map((a) => (
              <div key={a.id} className="group flex items-start gap-3 p-3 rounded-xl hover:bg-surface-hover border border-transparent hover:border-border-subtle transition-all cursor-pointer">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-text-primary truncate">
                    {a.title}
                  </h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-text-muted">{a.subjectName}</span>
                    <span className="w-1 h-1 rounded-full bg-border-strong" />
                    <span className="text-[10px] text-text-muted">
                      {new Date(a.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                </div>
                
                {a.pendingEvaluations > 0 ? (
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-warning-soft text-warning border border-warning/20">
                      {a.pendingEvaluations} To Grade
                    </span>
                    <span className="text-[9px] text-text-muted font-medium">
                      {a.totalSubmissions} Total
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-surface-elevated text-text-secondary border border-border-strong">
                      Evaluated
                    </span>
                  </div>
                )}
              </div>
            ))
          )
        )}
      </div>

      <Link
        href={role === "student" ? "/student/lms" : "/faculty/lms"}
        className="mt-4 pt-3 border-t border-border-subtle/50 flex items-center justify-center gap-1.5 text-xs font-semibold text-accent-purple hover:text-accent-purple-dark transition-colors w-full group"
      >
        <span>Go to Canvas</span>
        <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
      </Link>
    </div>
  );
};
