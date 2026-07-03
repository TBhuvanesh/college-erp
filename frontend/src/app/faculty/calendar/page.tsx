"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { CalendarView, AcademicCalendarEvent } from "@/components/CalendarView";
import { CalendarDays, HelpCircle } from "lucide-react";

export default function FacultyCalendar() {
  const { accessToken } = useAuth();
  const [events, setEvents] = useState<AcademicCalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/calendar?limit=100", {}, accessToken);
      if (res.success && res.data?.events) {
        setEvents(res.data.events);
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch academic calendar milestones.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEvents();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchEvents]);

  return (
    <div className="space-y-6">
      
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
        <div>
          <h2 className="font-display font-bold text-2xl dark:text-white text-text-primary flex items-center gap-2">
            <CalendarDays className="text-blue-500" size={24} />
            <span>Academic Calendar</span>
          </h2>
          <p className="text-xs dark:text-neutral-400 text-text-secondary mt-1">
            Official institutional timeline, mid-term examinations, fee deadlines, holidays, and seminars.
          </p>
        </div>

        <div className="p-3 dark:bg-neutral-900/60 bg-surface border dark:border-neutral-855 border-border-subtle rounded-lg max-w-xs text-[10px] dark:text-neutral-400 text-text-secondary flex items-start gap-2">
          <HelpCircle size={14} className="text-blue-400 shrink-0 mt-0.5" />
          <span>Events are synced directly with published registrar calendars. Select &quot;Upcoming&quot; or &quot;Events List&quot; to search.</span>
        </div>
      </div>

      {/* Calendar Component */}
      <CalendarView
        events={events}
        loading={loading}
        error={error}
        role="faculty"
      />

    </div>
  );
}
