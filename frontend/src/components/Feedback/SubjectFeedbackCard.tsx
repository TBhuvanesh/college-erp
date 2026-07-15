"use client";

import Link from "next/link";
import { BookOpen, Calendar, CheckCircle2, User, ChevronRight } from "lucide-react";

export interface SubjectFeedbackData {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  facultyId: string;
  facultyName: string;
  isCompleted: boolean;
  deadline: string;
  windowId: string;
  templateId: string;
}

interface SubjectFeedbackCardProps {
  subject: SubjectFeedbackData;
}

export function SubjectFeedbackCard({ subject }: SubjectFeedbackCardProps) {
  const isExpired = new Date(subject.deadline) < new Date();

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border-subtle bg-surface p-5 transition-all hover:border-border-hover hover:shadow-md flex flex-col justify-between h-full group">
      {/* Visual Completion Indicator */}
      <div 
        className={`absolute top-0 left-0 right-0 h-[3px] ${
          subject.isCompleted 
            ? "bg-emerald-500" 
            : isExpired 
            ? "bg-red-500" 
            : "bg-blue-500"
        }`}
      />

      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <span className="font-mono text-[10px] font-bold tracking-widest text-accent-blue uppercase bg-accent-blue/10 dark:bg-accent-blue/15 px-2 py-0.5 rounded">
              {subject.subjectCode}
            </span>
            <h3 className="font-display font-bold text-base text-text-primary mt-1 line-clamp-1">
              {subject.subjectName}
            </h3>
          </div>
          
          <span 
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider border ${
              subject.isCompleted
                ? "text-emerald-600 bg-emerald-50 border-emerald-250 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/20"
                : isExpired
                ? "text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-500/10 dark:border-red-500/20"
                : "text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-500/10 dark:border-blue-500/20"
            }`}
          >
            {subject.isCompleted ? (
              <>
                <CheckCircle2 size={10} /> Completed
              </>
            ) : isExpired ? (
              "Expired"
            ) : (
              "Pending"
            )}
          </span>
        </div>

        {/* Details list */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <User size={13} className="text-text-muted" />
            <span className="font-medium text-text-secondary">Faculty: {subject.facultyName}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <Calendar size={13} className="text-text-muted" />
            <span className="font-medium text-text-secondary">Deadline: {new Date(subject.deadline).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {/* Button CTA */}
      <div className="mt-5 pt-4 border-t border-border-subtle">
        {subject.isCompleted ? (
          <div className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/[0.03] dark:bg-emerald-500/[0.05] rounded-xl border border-emerald-500/10 cursor-default">
            <CheckCircle2 size={14} /> Evaluation Completed
          </div>
        ) : isExpired ? (
          <div className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-text-muted bg-neutral-500/[0.03] dark:bg-neutral-500/[0.05] rounded-xl border border-border-subtle cursor-not-allowed">
            Evaluation Closed
          </div>
        ) : (
          <Link
            href={`/student/feedback/submit?windowId=${subject.windowId}&subjectId=${subject.subjectId}&templateId=${subject.templateId}&facultyId=${subject.facultyId}`}
            className="w-full inline-flex items-center justify-center gap-1 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-sm group-hover:scale-[1.01]"
          >
            Start Feedback <ChevronRight size={14} />
          </Link>
        )}
      </div>
    </div>
  );
}
