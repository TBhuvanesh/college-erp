"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSimulation } from "@/context/SimulationContext";
import { apiFetch } from "@/lib/api";
import { CalendarView, AcademicCalendarEvent, getEventCategoryInfo } from "@/components/CalendarView";
import { CalendarDays, Filter, Info, Eye, Clock, Award, Sparkles, BookOpen } from "lucide-react";

export default function StudentCalendar() {
  const { accessToken } = useAuth();
  const { students, currentStudentId } = useSimulation();

  const [events, setEvents] = useState<AcademicCalendarEvent[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Toggle between personalized and full institutional calendar
  const [personalizedFilter, setPersonalizedFilter] = useState(true);

  // Find active student
  const activeStudent = students.find((s) => s.id === currentStudentId) || students[0];

  // Fetch live published events
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
      setError(err.message || "Failed to load published calendar.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  // Fetch departments to match the student's department code to department UUID
  useEffect(() => {
    const fetchDepts = async () => {
      try {
        const res = await apiFetch("/departments", {}, accessToken);
        if (res.success && res.data?.departments) {
          setDepartments(res.data.departments);
        }
      } catch (err) {
        console.warn("Failed to load departments in StudentCalendar (session may be expired):", err);
      }
    };
    const timer = setTimeout(() => {
      if (accessToken) {
        fetchDepts();
        fetchEvents();
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [accessToken, fetchEvents]);

  // Helper to map student semester to target year audience string
  const getYearAudience = (semStr: string): string => {
    const sem = parseInt(semStr.replace("Semester ", ""), 10);
    if (isNaN(sem)) return "";
    if (sem <= 2) return "I Year";
    if (sem <= 4) return "II Year";
    if (sem <= 6) return "III Year";
    if (sem <= 8) return "IV Year";
    return "";
  };

  // Find matching department ID for student's department code (e.g. "CSE")
  const studentDept = departments.find(d => d.code === activeStudent?.department);
  const studentDeptId = studentDept?.id;
  const studentSemNum = activeStudent?.semester ? parseInt(activeStudent.semester.replace("Semester ", ""), 10) : null;
  const studentYearAudience = activeStudent?.semester ? getYearAudience(activeStudent.semester) : "";

  // Perform client-side personal filter
  const displayedEvents = events.filter((ev) => {
    if (!personalizedFilter) return true;
    
    // Check target audience
    const audienceMatch =
      ev.targetAudience === "All" ||
      ev.targetAudience === "Students" ||
      ev.targetAudience === studentYearAudience;

    // Check department specificity
    const deptMatch =
      ev.departmentId === null ||
      ev.departmentId === studentDeptId;

    // Check semester specificity
    const semMatch =
      ev.semester === null ||
      ev.semester === studentSemNum;

    return audienceMatch && deptMatch && semMatch;
  });

  return (
    <div className="space-y-6">
      
      {/* Personalized Header block */}
      <div className="glass-card border dark:border-neutral-800 border-border-subtle rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-[9px] uppercase font-bold text-blue-500 tracking-wider font-mono">Student Calendar Access</span>
          <h2 className="font-display font-bold text-xl dark:text-white text-text-primary">
            Milestones for {activeStudent?.name || "Rahul Sharma"}
          </h2>
          <p className="text-[10px] dark:text-neutral-400 text-text-secondary">
            Current Roll No: <strong className="dark:text-neutral-200 text-text-primary">{activeStudent?.rollNo}</strong> | Academic Stream: <strong className="dark:text-neutral-200 text-text-primary">{activeStudent?.department} • {activeStudent?.semester}</strong>
          </p>
        </div>

        {/* Filter Toggle Switch */}
        <div className="flex items-center gap-3 dark:bg-neutral-950 bg-surface border dark:border-neutral-800 border-border-subtle rounded-lg p-1.5 shrink-0 self-stretch sm:self-auto justify-between sm:justify-start">
          <span className="text-[10px] font-bold dark:text-neutral-450 text-text-secondary uppercase pl-1.5">Personalized View:</span>
          <div className="flex rounded dark:bg-neutral-900 bg-surface border dark:border-neutral-850 border-border-subtle p-0.5">
            <button
              onClick={() => setPersonalizedFilter(true)}
              className={`px-3 py-1 text-[9px] font-bold rounded cursor-pointer transition ${
                personalizedFilter ? "bg-blue-600 text-white font-extrabold" : "dark:text-neutral-400 text-text-secondary dark:hover:text-neutral-200 hover:text-text-primary"
              }`}
            >
              My Roll Scope
            </button>
            <button
              onClick={() => setPersonalizedFilter(false)}
              className={`px-3 py-1 text-[9px] font-bold rounded cursor-pointer transition ${
                !personalizedFilter ? "bg-blue-600 text-white font-extrabold" : "dark:text-neutral-400 text-text-secondary dark:hover:text-neutral-200 hover:text-text-primary"
              }`}
            >
              All Institutional
            </button>
          </div>
        </div>
      </div>

      {/* Info notification about default filters */}
      {personalizedFilter && activeStudent && (
        <div className="p-3.5 rounded-lg dark:bg-blue-500/5 bg-blue-50/50 border dark:border-blue-500/15 border-blue-200 dark:text-blue-400 text-blue-700 text-[10px] font-medium leading-normal flex items-start gap-2 shadow-sm">
          <Info size={14} className="shrink-0 mt-0.5" />
          <span>
            Calendar is automatically scoped to <strong>{activeStudent.department}</strong> department, <strong>{activeStudent.semester}</strong> classes, and general announcements. Toggle &quot;All Institutional&quot; above to view timelines for other programs.
          </span>
        </div>
      )}

      {/* CalendarView Mount */}
      <CalendarView
        events={displayedEvents}
        loading={loading}
        error={error}
        role="student"
      />

    </div>
  );
}
