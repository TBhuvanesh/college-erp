"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Sparkles, MapPin } from "lucide-react";
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
  const sortedEvents = [...events]
    .filter((e) => e.startDate)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, 4);

  return (
    <div className="bg-surface/95 border border-border-subtle rounded-[16px] p-5 shadow-sm backdrop-blur-xl flex flex-col h-full relative overflow-hidden">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-5 relative z-10">
        <div className="flex items-center gap-2">
          <div className="bg-accent-purple-soft p-1.5 rounded-lg text-accent-purple border border-accent-purple/20">
            <Sparkles size={16} strokeWidth={2.5} />
          </div>
          <h3 className="font-display font-bold text-text-primary tracking-wide">Upcoming Deadlines</h3>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar relative z-10 pr-1">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-neutral-500 gap-2 py-8">
            <div className="w-5 h-5 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
            <span className="text-xs font-medium">Syncing timeline...</span>
          </div>
        ) : sortedEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-neutral-600 gap-2 py-8">
            <MapPin size={24} className="text-neutral-700" />
            <span className="text-xs font-medium">No upcoming events</span>
          </div>
        ) : (
          sortedEvents.map((ev) => {
            const cat = getEventCategoryInfo(ev.eventType, ev.title);
            return (
              <div key={ev.id} className="relative pl-3 group border-l-2 border-border-subtle hover:border-accent-purple transition-colors cursor-pointer">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                  {new Date(ev.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
                <h4 className="text-sm font-semibold text-text-primary truncate transition-colors">
                  {ev.title}
                </h4>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase border tracking-wider ${cat.textClass} ${cat.borderClass} ${cat.bgClass}`}>
                    {cat.label}
                  </span>
                  <span className="text-[10px] text-text-muted uppercase tracking-wider">
                    {ev.sourceLabel}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Link
        href={`/${role.toLowerCase()}/calendar`}
        className="mt-4 pt-3 border-t border-border-subtle/50 flex items-center justify-center gap-1.5 text-xs font-semibold text-accent-purple hover:text-accent-purple-dark transition-colors w-full group relative z-10"
      >
        <span>Full Schedule</span>
        <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
      </Link>

      {/* Subtle Background Accent Gradient */}
      <div className="absolute -top-16 -right-16 w-48 h-48 blur-3xl opacity-[0.03] rounded-full z-0 pointer-events-none bg-accent-purple" />
    </div>
  );
};
