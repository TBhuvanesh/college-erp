"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CalendarDays, ArrowRight, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { UnifiedEvent } from "../CalendarView";

interface CalendarWidgetProps {
  events: UnifiedEvent[];
  loading?: boolean;
  role: "admin" | "faculty" | "student";
}

export const CalendarWidget: React.FC<CalendarWidgetProps> = ({
  events,
  loading = false,
  role
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const currentDay = today.getDate();

  const days = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  // Filter events for current month
  const monthEvents = events.filter(e => {
    const d = new Date(e.startDate);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  return (
    <div className="bg-surface/95 border border-border-subtle rounded-[16px] p-5 shadow-sm backdrop-blur-xl flex flex-col relative overflow-hidden">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-5 relative z-10">
        <div className="flex items-center gap-2">
          <div className="bg-warning-soft p-1.5 rounded-lg text-warning border border-warning/20">
            <CalendarDays size={16} strokeWidth={2.5} />
          </div>
          <h3 className="font-display font-bold text-text-primary tracking-wide">Agenda</h3>
        </div>
        
        <div className="flex items-center gap-2">
          <button onClick={handlePrevMonth} className="p-1 text-text-muted hover:text-text-primary rounded hover:bg-surface-hover transition cursor-pointer">
            <ChevronLeft size={16} />
          </button>
          <span className="text-[11px] font-bold tracking-widest text-text-secondary uppercase w-20 text-center">
            {currentDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </span>
          <button onClick={handleNextMonth} className="p-1 text-text-muted hover:text-text-primary rounded hover:bg-surface-hover transition cursor-pointer">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {loading ? (
         <div className="flex flex-col items-center justify-center py-12 text-text-muted gap-2">
            <div className="w-5 h-5 border-2 border-warning-soft border-t-warning rounded-full animate-spin" />
            <span className="text-xs font-medium">Loading agenda...</span>
         </div>
      ) : (
        <div className="relative z-10">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <div key={i} className="text-[10px] font-bold text-text-muted text-center uppercase">
                {d}
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-1 mb-5">
            {days.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} className="h-8" />;
              }
              
              const isToday = isCurrentMonth && day === currentDay;
              
              // Check if day has events
              const dayEvents = monthEvents.filter(e => new Date(e.startDate).getDate() === day);
              const hasEvents = dayEvents.length > 0;
              
              return (
                <div 
                  key={day} 
                  className={`h-8 flex flex-col items-center justify-center rounded-lg text-xs font-medium transition-all ${
                    isToday 
                      ? "bg-warning text-white shadow-md shadow-warning/20 font-bold" 
                      : hasEvents 
                        ? "bg-surface-hover border border-border-subtle text-text-primary cursor-pointer hover:bg-border-subtle/50" 
                        : "text-text-muted hover:text-text-secondary hover:bg-surface-hover cursor-pointer border border-transparent"
                  }`}
                  title={hasEvents ? dayEvents.map(e => e.title).join(', ') : ""}
                >
                  <span>{day}</span>
                  {hasEvents && !isToday && (
                    <div className="w-1 h-1 bg-warning rounded-full mt-0.5" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Mini Event List for Selected Month */}
          <div className="space-y-2 border-t border-border-subtle/50 pt-4 max-h-[140px] overflow-y-auto custom-scrollbar pr-1">
            {monthEvents.length === 0 ? (
              <div className="text-center text-xs text-text-muted font-medium py-2">
                No events scheduled this month.
              </div>
            ) : (
              monthEvents.slice(0, 3).map((e) => (
                <div key={e.id} className="flex gap-3 p-2.5 rounded-xl bg-surface-hover border border-transparent hover:border-border-subtle transition-colors cursor-pointer group">
                  <div className="flex flex-col items-center justify-center min-w-[32px] shrink-0 bg-surface rounded-lg border border-border-subtle py-1 shadow-sm">
                    <span className="text-[9px] font-bold text-text-muted uppercase">{new Date(e.startDate).toLocaleDateString('en-US', { month: 'short' })}</span>
                    <span className="text-sm font-bold text-text-primary leading-none mt-0.5">{new Date(e.startDate).getDate()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-semibold text-text-primary truncate transition-colors">
                      {e.title}
                    </h4>
                    <span className="text-[10px] text-text-muted truncate block mt-0.5">{e.eventType}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <Link
        href={`/${role.toLowerCase()}/calendar`}
        className="mt-4 pt-3 border-t border-border-subtle/50 flex items-center justify-center gap-1.5 text-xs font-semibold text-warning hover:text-warning/80 transition-colors w-full group relative z-10"
      >
        <span>Full Calendar</span>
        <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
      </Link>

      {/* Subtle Background Accent Gradient */}
      <div className="absolute -bottom-16 -left-16 w-48 h-48 blur-3xl opacity-[0.04] rounded-full z-0 pointer-events-none bg-warning" />
    </div>
  );
};
