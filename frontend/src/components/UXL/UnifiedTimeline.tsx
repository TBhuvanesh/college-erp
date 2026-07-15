"use client";

import { useState, useMemo } from "react";
import { 
  BookOpen, 
  Calendar, 
  AlertCircle, 
  ClipboardList, 
  Clock, 
  GraduationCap, 
  CreditCard,
  Briefcase,
  Users,
  Filter,
  CheckCircle2
} from "lucide-react";

export interface TimelineEvent {
  id: string;
  time: string; // e.g. "09:00 AM" or "Tomorrow" or date
  title: string;
  subtitle: string;
  category: "Class" | "Assignment" | "Exam" | "Mentorship" | "LMS" | "Opportunity" | "Attendance" | "Result" | "Fee" | "Event";
  status?: "pending" | "completed" | "urgent" | "normal";
  actionText?: string;
  actionRoute?: string;
}

interface UnifiedTimelineProps {
  events: TimelineEvent[];
}

const CATEGORY_ICONS: Record<TimelineEvent["category"], any> = {
  Class: Clock,
  Assignment: ClipboardList,
  Exam: GraduationCap,
  Mentorship: Users,
  LMS: BookOpen,
  Opportunity: Briefcase,
  Attendance: CheckCircle2,
  Result: GraduationCap,
  Fee: CreditCard,
  Event: Calendar
};

const CATEGORY_COLORS: Record<TimelineEvent["category"], string> = {
  Class: "text-blue-600 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400 border-blue-100 dark:border-blue-900/50",
  Assignment: "text-purple-600 bg-purple-50 dark:bg-purple-950/30 dark:text-purple-400 border-purple-100 dark:border-purple-900/50",
  Exam: "text-red-650 bg-red-50 dark:bg-red-950/30 dark:text-red-400 border-red-100 dark:border-red-900/50",
  Mentorship: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/50",
  LMS: "text-cyan-600 bg-cyan-50 dark:bg-cyan-950/30 dark:text-cyan-400 border-cyan-100 dark:border-cyan-900/50",
  Opportunity: "text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 border-amber-100 dark:border-amber-900/50",
  Attendance: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/50",
  Result: "text-rose-600 bg-rose-50 dark:bg-rose-950/30 dark:text-rose-400 border-rose-100 dark:border-rose-900/50",
  Fee: "text-pink-650 bg-pink-50 dark:bg-pink-950/30 dark:text-pink-400 border-pink-100 dark:border-pink-900/50",
  Event: "text-teal-600 bg-teal-50 dark:bg-teal-950/30 dark:text-teal-400 border-teal-100 dark:border-teal-900/50"
};

export function UnifiedTimeline({ events }: UnifiedTimelineProps) {
  const [filter, setFilter] = useState<string>("ALL");

  const filteredEvents = useMemo(() => {
    if (filter === "ALL") return events;
    return events.filter(e => e.category === filter);
  }, [events, filter]);

  const categories = useMemo(() => {
    const list = new Set(events.map(e => e.category));
    return Array.from(list);
  }, [events]);

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border-subtle">
        <div>
          <h3 className="font-display font-bold text-sm text-text-primary uppercase tracking-wider">
            Today's Timeline
          </h3>
          <p className="text-[11px] text-text-muted mt-0.5">Chronological layout of campus activities</p>
        </div>

        {categories.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pr-1">
            <button
              onClick={() => setFilter("ALL")}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all shrink-0 ${
                filter === "ALL"
                  ? "bg-accent-blue text-white border-accent-blue shadow-sm shadow-blue-500/10"
                  : "bg-background text-text-secondary border-border-subtle hover:bg-surface-hover hover:border-border-hover"
              }`}
            >
              All Events
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all shrink-0 ${
                  filter === cat
                    ? "bg-accent-blue text-white border-accent-blue shadow-sm shadow-blue-500/10"
                    : "bg-background text-text-secondary border-border-subtle hover:bg-surface-hover hover:border-border-hover"
                }`}
              >
                {cat}s
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative pl-5 border-l border-neutral-200 dark:border-neutral-800 space-y-6 ml-3 pt-2">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-6 text-text-muted text-xs">
            No events scheduled for the active filters.
          </div>
        ) : (
          filteredEvents.map((event) => {
            const Icon = CATEGORY_ICONS[event.category] || Calendar;
            const colorClass = CATEGORY_COLORS[event.category] || "";
            
            return (
              <div key={event.id} className="relative group transition-all">
                {/* Node Dot */}
                <div className={`absolute -left-[31px] top-1 w-6 h-6 rounded-full border flex items-center justify-center transition-transform group-hover:scale-110 ${colorClass}`}>
                  <Icon size={12} strokeWidth={2.5} />
                </div>

                <div className="space-y-1 pl-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] font-extrabold text-blue-600 dark:text-blue-400">
                      {event.time}
                    </span>
                    {event.status && (
                      <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${
                        event.status === "urgent"
                          ? "text-red-650 bg-red-500/10 border-red-500/20 dark:text-red-400"
                          : event.status === "completed"
                          ? "text-emerald-700 bg-emerald-500/10 border-emerald-500/20 dark:text-emerald-400"
                          : "text-text-muted bg-neutral-100 border-transparent"
                      }`}>
                        {event.status}
                      </span>
                    )}
                  </div>

                  <h4 className="text-xs font-semibold text-text-primary leading-tight group-hover:text-accent-blue transition-colors">
                    {event.title}
                  </h4>
                  <p className="text-[11px] text-text-secondary leading-normal">{event.subtitle}</p>

                  {event.actionText && (
                    <div className="pt-1.5">
                      <span className="text-[10px] font-bold text-accent-blue hover:underline cursor-pointer">
                        {event.actionText} &rarr;
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
