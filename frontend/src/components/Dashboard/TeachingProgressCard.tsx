"use client";

import { CheckCircle2, AlertTriangle, BookOpen } from "lucide-react";

export interface SubjectProgress {
  id: string;
  name: string;
  code: string;
  completedLessons: number;
  totalLessons: number;
  percentage: number;
}

interface TeachingProgressCardProps {
  progressList: SubjectProgress[];
}

export function TeachingProgressCard({ progressList }: TeachingProgressCardProps) {
  if (!progressList || progressList.length === 0) {
    return (
      <div className="rounded-2xl border border-border-subtle bg-surface p-5 text-center text-text-muted text-xs">
        <BookOpen className="mx-auto h-8 w-8 opacity-45 mb-2" />
        No active subjects found in teaching planner.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm space-y-4 flex flex-col h-full">
      <div>
        <h2 className="font-display font-bold text-sm text-text-primary uppercase tracking-wider">
          Teaching Planner Progress
        </h2>
        <p className="text-[11px] text-text-muted mt-0.5">Syllabus completions per course</p>
      </div>

      <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
        {progressList.map((subject) => {
          const isLagging = subject.percentage < 60;
          return (
            <div key={subject.id} className="space-y-2 pb-3 border-b border-border-subtle last:border-b-0 last:pb-0">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <span className="font-mono text-[9px] font-extrabold uppercase bg-neutral-100 dark:bg-neutral-800 text-accent-blue px-2 py-0.5 rounded">
                    {subject.code}
                  </span>
                  <h4 className="text-xs font-semibold text-text-primary mt-1 line-clamp-1">
                    {subject.name}
                  </h4>
                </div>
                
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${
                  isLagging ? "text-amber-500" : "text-emerald-500"
                }`}>
                  {isLagging ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
                  <span>{subject.percentage}%</span>
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-neutral-150 dark:bg-neutral-800 h-2 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${
                    isLagging ? "bg-amber-550" : "bg-emerald-500"
                  }`} 
                  style={{ width: `${subject.percentage}%` }}
                />
              </div>

              <div className="flex justify-between text-[10px] text-text-muted font-medium">
                <span>Lessons: {subject.completedLessons} / {subject.totalLessons}</span>
                <span>{subject.totalLessons - subject.completedLessons} lectures remaining</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
