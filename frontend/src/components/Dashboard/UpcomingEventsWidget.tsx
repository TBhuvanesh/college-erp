"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock, AlertCircle } from "lucide-react";
import { getEventCategoryInfo, UnifiedEvent } from "../CalendarView";

interface UpcomingEventsWidgetProps {
  events: UnifiedEvent[];
  loading?: boolean;
  role: "admin" | "faculty" | "student";
}

export const UpcomingEventsWidget: React.FC<UpcomingEventsWidgetProps> = ({
  events,
  loading = false,
  role
}) => {
  const now = Date.now();

  const sortedEvents = [...events]
    .filter((e) => e.startDate && new Date(e.startDate).getTime() >= now - 86400000)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, 6);

  const msInDay = 86400000;
  const getDaysUntil = (dateStr: string) =>
    Math.ceil((new Date(dateStr).getTime() - now) / msInDay);

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle/60">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-500">
            <CalendarClock size={14} strokeWidth={2.5} />
          </div>
          <h3 className="font-display font-bold text-sm text-text-primary">Upcoming Deadlines</h3>
          {!loading && sortedEvents.length > 0 && (
            <span className="text-[10px] font-bold bg-surface-elevated border border-border-subtle text-text-muted px-2 py-0.5 rounded-full">
              {sortedEvents.length}
            </span>
          )}
        </div>
        <Link
          href={`/${role}/calendar`}
          className="flex items-center gap-1 text-[11px] font-semibold text-accent-blue hover:underline"
        >
          Full calendar <ArrowRight size={11} />
        </Link>
      </div>

      {/* Timeline body */}
      <div className="p-5">
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex gap-4 animate-pulse">
                <div className="w-10 shrink-0 flex flex-col gap-1">
                  <div className="h-2.5 w-6 bg-surface-hover rounded" />
                  <div className="h-5 w-8 bg-surface-hover rounded" />
                </div>
                <div className="flex-1 space-y-1.5 pt-1">
                  <div className="h-3 bg-surface-hover rounded w-3/4" />
                  <div className="h-2.5 bg-surface-hover rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : sortedEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2 text-text-muted">
            <CalendarClock size={22} className="opacity-40" />
            <p className="text-xs font-medium">No upcoming deadlines</p>
          </div>
        ) : (
          <div className="relative pl-5">
            {/* Vertical timeline rule */}
            <div className="absolute left-[9px] top-1 bottom-0 w-px bg-border-subtle" />

            <div className="space-y-0">
              {sortedEvents.map((ev, idx) => {
                const cat = getEventCategoryInfo(ev.eventType, ev.title);
                const date = new Date(ev.startDate);
                const daysUntil = getDaysUntil(ev.startDate);
                const isUrgent = daysUntil <= 3;
                const isToday = daysUntil <= 0;
                const isLast = idx === sortedEvents.length - 1;

                return (
                  <div key={ev.id} className={`relative flex gap-4 group ${isLast ? "" : "pb-5"}`}>
                    {/* Timeline dot */}
                    <div className={`absolute -left-5 top-0.5 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center z-10 transition-all ${
                      isUrgent
                        ? "border-red-400 bg-red-500/10"
                        : "border-border-strong bg-surface group-hover:border-accent-blue/50"
                    }`}>
                      {isUrgent ? (
                        <div className={`w-2 h-2 rounded-full bg-red-400 ${isToday ? "animate-pulse" : ""}`} />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-text-muted/40 group-hover:bg-accent-blue/50 transition-colors" />
                      )}
                    </div>

                    {/* Date stamp */}
                    <div className="shrink-0 w-11 text-right pt-0.5">
                      <span className="text-[9px] font-black uppercase tracking-wider text-text-muted block">
                        {date.toLocaleDateString("en-US", { month: "short" })}
                      </span>
                      <span className={`text-lg font-display font-black leading-none block ${
                        isUrgent ? "text-red-400" : "text-text-primary"
                      }`}>
                        {date.getDate()}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-[13px] font-semibold text-text-primary group-hover:text-accent-blue transition-colors leading-snug truncate">
                          {ev.title}
                        </h4>
                        {isUrgent && (
                          <span className={`shrink-0 inline-flex items-center gap-1 text-[9px] font-extrabold uppercase border px-1.5 py-0.5 rounded-full ${
                            isToday
                              ? "text-red-400 bg-red-500/10 border-red-500/20"
                              : "text-amber-400 bg-amber-500/10 border-amber-500/20"
                          }`}>
                            <AlertCircle size={8} />
                            {isToday ? "Today" : `${daysUntil}d`}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[9px] font-extrabold uppercase border px-1.5 py-0.5 rounded tracking-wider ${cat.textClass} ${cat.borderClass} ${cat.bgClass}`}>
                          {cat.label}
                        </span>
                        <span className="text-[10px] text-text-muted">{ev.sourceLabel}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
