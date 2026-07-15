"use client";

import { useState } from "react";
import { CheckCircle2, Circle, Clock, Check } from "lucide-react";

export interface TaskItem {
  id: string;
  title: string;
  priority: "high" | "medium" | "low";
  dueTime: string;
  completed: boolean;
}

const INITIAL_TASKS: TaskItem[] = [
  { id: "1", title: "Take Attendance (II Year CSE-A)", priority: "high", dueTime: "11:30 AM", completed: false },
  { id: "2", title: "Upload DBMS Notes (Unit 3)", priority: "medium", dueTime: "1:00 PM", completed: false },
  { id: "3", title: "Publish Web Tech Assignment 2", priority: "medium", dueTime: "3:00 PM", completed: false },
  { id: "4", title: "Evaluate LMS Lab Submissions", priority: "high", dueTime: "5:00 PM", completed: false },
  { id: "5", title: "Conduct Mentorship Meeting (Group 4)", priority: "low", dueTime: "4:00 PM", completed: false },
  { id: "6", title: "Submit Unit-I Internal Marks", priority: "high", dueTime: "6:00 PM", completed: false }
];

export function TodayTaskCenter() {
  const [tasks, setTasks] = useState<TaskItem[]>(INITIAL_TASKS);

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const pendingTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm space-y-4 flex flex-col h-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-sm text-text-primary uppercase tracking-wider">
            Today's Task Center
          </h2>
          <p className="text-[11px] text-text-muted mt-0.5">Focus on high priority academic targets</p>
        </div>
        <span className="text-[10px] font-extrabold uppercase bg-neutral-100 dark:bg-neutral-800 text-text-muted px-2 py-0.5 rounded">
          {pendingTasks.length} Pending
        </span>
      </div>

      <div className="flex-1 space-y-3 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
        {/* Pending Tasks Group */}
        {pendingTasks.length === 0 ? (
          <div className="text-center text-xs text-text-muted py-6">
            🎉 All tasks completed for today!
          </div>
        ) : (
          <div className="space-y-2">
            {pendingTasks.map(task => (
              <div 
                key={task.id}
                className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border-subtle hover:border-border-hover bg-background transition-all group"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <button 
                    onClick={() => toggleTask(task.id)}
                    className="mt-0.5 text-text-muted hover:text-blue-500 transition-colors shrink-0 cursor-pointer"
                  >
                    <Circle size={16} className="group-hover:scale-105 transition-transform" />
                  </button>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-text-primary leading-tight line-clamp-1">{task.title}</p>
                    <div className="flex items-center gap-1.5 mt-1 font-medium text-[10px] text-text-muted">
                      <Clock size={10} />
                      <span>Due: {task.dueTime}</span>
                    </div>
                  </div>
                </div>

                <span 
                  className={`shrink-0 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${
                    task.priority === "high"
                      ? "text-red-650 bg-red-500/10 border-red-500/20 dark:text-red-400"
                      : task.priority === "medium"
                      ? "text-amber-700 bg-amber-500/10 border-amber-500/20 dark:text-amber-400"
                      : "text-blue-700 bg-blue-500/10 border-blue-500/20 dark:text-blue-400"
                  }`}
                >
                  {task.priority}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Completed Group */}
        {completedTasks.length > 0 && (
          <div className="pt-3 border-t border-border-subtle space-y-2">
            <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1.5">Completed Today</h4>
            {completedTasks.map(task => (
              <div 
                key={task.id}
                className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/40 border border-transparent opacity-60"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <button 
                    onClick={() => toggleTask(task.id)}
                    className="text-emerald-500 shrink-0 cursor-pointer"
                  >
                    <CheckCircle2 size={16} />
                  </button>
                  <p className="text-xs font-medium text-text-secondary line-through line-clamp-1 leading-none">{task.title}</p>
                </div>
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                  <Check size={10} />
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
