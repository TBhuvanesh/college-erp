"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  List,
  Clock,
  Search,
  Filter,
  Info,
  CalendarDays,
  User,
  BookOpen,
  MapPin,
  FileText,
  AlertCircle,
  Plus,
  Sparkles,
  Award,
  Briefcase,
  AlertTriangle,
  Star,
  CheckCircle,
  HelpCircle
} from "lucide-react";
import { PersonalEventModal } from "./PersonalEventModal";

export interface AcademicCalendarEvent {
  id: string;
  parsedEventId: string;
  sourceDocumentId: string;
  sourceDocumentTitle: string;
  parsedEventTitle: string;
  title: string;
  description: string | null;
  startDate: string; // YYYY-MM-DD
  endDate: string | null; // YYYY-MM-DD
  eventType: string;
  targetAudience: string;
  departmentId: string | null;
  departmentName: string | null;
  semester: number | null;
  publishStatus: "Published" | "Updated" | "Archived";
  isEdited: boolean;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export interface UnifiedEvent {
  id: string;
  title: string;
  description: string | null;
  startDate: string; // YYYY-MM-DD or datetime ISO string
  endDate: string | null; // YYYY-MM-DD or datetime ISO string
  eventType: string; // Academic Event, Assignment Deadline, Workshop, Seminar, Hackathon, Placement Drive, Internship Deadline, Personal Reminder
  sourceModule: "academic_calendar" | "personal_calendar" | "lms_assignment" | "opportunity" | "announcement";
  sourceLabel: string; // "Academic Desk", "Personal", "LMS", "Opportunity Hub", "Announcements"
  departmentId: string | null;
  departmentName: string | null;
  semester: number | null;
  targetAudience?: string;
  isOwner?: boolean;
  rawEvent?: any; // reference to original database row
}

export interface CategoryInfo {
  label: string;
  color: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
}

// Custom Category Mapper for unified academic calendar types
export function getEventCategoryInfo(type: string, title = ""): CategoryInfo {
  const lowerType = (type || "").toLowerCase();
  const lowerTitle = (title || "").toLowerCase();
  
  if (lowerType.includes("assignment") || lowerTitle.includes("assignment") || lowerTitle.includes("project deadline")) {
    return {
      label: "Assignment Deadline",
      color: "#f43f5e", // rose
      bgClass: "dark:bg-rose-500/10 bg-rose-50",
      borderClass: "dark:border-rose-500/20 border-rose-200",
      textClass: "dark:text-rose-400 text-rose-700"
    };
  }
  if (lowerType.includes("workshop") || lowerTitle.includes("workshop")) {
    return {
      label: "Workshop",
      color: "#f97316", // orange
      bgClass: "dark:bg-orange-500/10 bg-orange-50",
      borderClass: "dark:border-orange-500/20 border-orange-200",
      textClass: "dark:text-orange-400 text-orange-700"
    };
  }
  if (lowerType.includes("seminar") || lowerTitle.includes("seminar") || lowerTitle.includes("webinar")) {
    return {
      label: "Seminar",
      color: "#8b5cf6", // purple
      bgClass: "dark:bg-purple-500/10 bg-purple-50",
      borderClass: "dark:border-purple-500/20 border-purple-200",
      textClass: "dark:text-purple-400 text-purple-700"
    };
  }
  if (lowerType.includes("hackathon") || lowerTitle.includes("hackathon") || lowerTitle.includes("code contest")) {
    return {
      label: "Hackathon",
      color: "#06b6d4", // cyan
      bgClass: "dark:bg-cyan-500/10 bg-cyan-50",
      borderClass: "dark:border-cyan-500/20 border-cyan-200",
      textClass: "dark:text-cyan-400 text-cyan-700"
    };
  }
  if (lowerType.includes("placement") || lowerTitle.includes("placement") || lowerTitle.includes("drive") || lowerTitle.includes("recruitment")) {
    return {
      label: "Placement Drive",
      color: "#ec4899", // pink
      bgClass: "dark:bg-pink-500/10 bg-pink-50",
      borderClass: "dark:border-pink-500/20 border-pink-200",
      textClass: "dark:text-pink-400 text-pink-700"
    };
  }
  if (lowerType.includes("internship") || lowerTitle.includes("internship")) {
    return {
      label: "Internship Deadline",
      color: "#6366f1", // indigo
      bgClass: "dark:bg-indigo-500/10 bg-indigo-50",
      borderClass: "dark:border-indigo-500/20 border-indigo-200",
      textClass: "dark:text-indigo-400 text-indigo-700"
    };
  }
  if (lowerType.includes("reminder") || lowerTitle.includes("reminder") || lowerTitle.includes("task") || lowerType.includes("personal")) {
    return {
      label: "Personal Reminder",
      color: "#f59e0b", // amber
      bgClass: "dark:bg-amber-500/10 bg-amber-50",
      borderClass: "dark:border-amber-500/20 border-amber-200",
      textClass: "dark:text-amber-400 text-amber-700"
    };
  }

  // Fallback to core academic classifications
  switch (type) {
    case "Class Commencement":
    case "Academic Activity":
    case "Academic":
      return {
        label: "Academic Event",
        color: "#3b82f6", // blue
        bgClass: "dark:bg-blue-500/10 bg-blue-50",
        borderClass: "dark:border-blue-500/20 border-blue-200",
        textClass: "dark:text-blue-400 text-blue-700"
      };
    case "Holiday":
      return {
        label: "Holiday",
        color: "#ef4444", // red
        bgClass: "dark:bg-rose-500/10 bg-rose-50",
        borderClass: "dark:border-rose-500/20 border-rose-200",
        textClass: "dark:text-rose-450 dark:text-red-400 text-red-700"
      };
    default:
      return {
        label: "Academic Event",
        color: "#3b82f6", // blue
        bgClass: "dark:bg-blue-500/10 bg-blue-50",
        borderClass: "dark:border-blue-500/20 border-blue-200",
        textClass: "dark:text-blue-400 text-blue-700"
      };
  }
}

interface CalendarViewProps {
  events: AcademicCalendarEvent[];
  loading: boolean;
  error: string | null;
  role: "admin" | "faculty" | "student";
  onEditEvent?: (event: AcademicCalendarEvent) => void;
  onArchiveEvent?: (id: string, currentStatus: string) => void;
}

interface Department {
  id: string;
  name: string;
  code: string;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  events: propEvents,
  loading: propLoading,
  error: propError,
  role,
  onEditEvent,
  onArchiveEvent
}) => {
  const { accessToken } = useAuth();
  
  // Views: "month" | "week" | "upcoming" | "list"
  const [viewMode, setViewMode] = useState<"month" | "week" | "upcoming" | "list">("month");
  
  // Calendar Dates
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  
  // Scopes & Personal Event states
  const [personalEvents, setPersonalEvents] = useState<UnifiedEvent[]>([]);
  const [lmsAssignments, setLmsAssignments] = useState<UnifiedEvent[]>([]);
  const [opportunities, setOpportunities] = useState<UnifiedEvent[]>([]);
  const [announcements, setAnnouncements] = useState<UnifiedEvent[]>([]);
  
  const [loadingExtras, setLoadingExtras] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  
  // Modal toggles
  const [personalModalOpen, setPersonalModalOpen] = useState(false);
  const [selectedPersonalEvent, setSelectedPersonalEvent] = useState<any | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("ALL");
  const [scopeFilter, setScopeFilter] = useState("ALL"); // ALL, ACADEMIC, PERSONAL, OPPORTUNITIES, ASSIGNMENTS
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [semFilter, setSemFilter] = useState("ALL");

  // Fetch departments
  useEffect(() => {
    const fetchDepts = async () => {
      try {
        const res = await apiFetch("/departments", {}, accessToken);
        if (res.success && res.data?.departments) {
          setDepartments(res.data.departments);
        }
      } catch (err) {
        console.error("Failed to load departments in CalendarView", err);
      }
    };
    if (accessToken) {
      fetchDepts();
    }
  }, [accessToken]);

  // Load Extra Calendar Modules
  const fetchAllCalendarModules = useCallback(async () => {
    if (!accessToken) return;
    setLoadingExtras(true);
    try {
      // 1. Personal Entries
      const entryRes = await apiFetch("/calendar-entries?limit=100", {}, accessToken);
      if (entryRes.success && entryRes.data?.entries) {
        const mapped = entryRes.data.entries.map((e: any) => ({
          id: e.id,
          title: e.title,
          description: e.description,
          startDate: e.startDate,
          endDate: e.endDate,
          eventType: e.eventType === "Meeting" ? "Workshop" : e.eventType === "Reminder" ? "Personal Reminder" : "Personal Reminder",
          sourceModule: "personal_calendar" as const,
          sourceLabel: e.isOwner ? "Personal" : "Department Desk",
          departmentId: e.departmentId,
          departmentName: e.departmentName,
          semester: e.semester,
          isOwner: e.isOwner,
          rawEvent: e
        }));
        setPersonalEvents(mapped);
      }

      // 2. LMS Assignments
      const lmsRes = await apiFetch("/lms/assignments?limit=50", {}, accessToken);
      if (lmsRes.success && lmsRes.data?.assignments) {
        const mapped = lmsRes.data.assignments.map((a: any) => ({
          id: a.id,
          title: a.title,
          description: a.instructions || a.description || null,
          startDate: a.dueDate, // Date of assignment
          endDate: null,
          eventType: "Assignment Deadline",
          sourceModule: "lms_assignment" as const,
          sourceLabel: "LMS Desk",
          departmentId: null,
          departmentName: null,
          semester: a.semester || null
        }));
        setLmsAssignments(mapped);
      }

      // 3. Opportunities
      const oppRes = await apiFetch("/opportunities?limit=50", {}, accessToken);
      if (oppRes.success && oppRes.data?.opportunities) {
        const mapped = oppRes.data.opportunities.map((o: any) => ({
          id: o.id,
          title: o.title,
          description: o.description,
          startDate: o.startDate || o.deadline,
          endDate: o.deadline,
          eventType: o.type === "Placement Drive" ? "Placement Drive" : "Internship Deadline",
          sourceModule: "opportunity" as const,
          sourceLabel: "Opportunity Hub",
          departmentId: o.departmentId,
          departmentName: o.departmentName,
          semester: null
        }));
        setOpportunities(mapped);
      }

      // 4. Announcements
      const annRes = await apiFetch("/announcements?limit=50", {}, accessToken);
      if (annRes.success && annRes.data?.announcements) {
        const mapped = annRes.data.announcements.map((an: any) => ({
          id: an.id,
          title: an.title,
          description: an.content,
          startDate: an.publishDate || new Date().toISOString(),
          endDate: an.expiryDate,
          eventType: "Academic Event",
          sourceModule: "announcement" as const,
          sourceLabel: "Announcements",
          departmentId: an.departmentId,
          departmentName: null,
          semester: an.semester || null
        }));
        setAnnouncements(mapped);
      }
    } catch (err) {
      console.error("Failed to load secondary calendar event lists:", err);
    } finally {
      setLoadingExtras(false);
    }
  }, [accessToken]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (accessToken) {
        fetchAllCalendarModules();
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [accessToken, fetchAllCalendarModules]);

  // Combine everything into a unified array
  const getUnifiedEvents = (): UnifiedEvent[] => {
    const list: UnifiedEvent[] = [];
    
    // Core Registrar Events from props
    if (propEvents && propEvents.length > 0) {
      propEvents.forEach((ev) => {
        list.push({
          id: ev.id,
          title: ev.title,
          description: ev.description,
          startDate: ev.startDate,
          endDate: ev.endDate,
          eventType: ev.eventType === "Holiday" ? "Holiday" : "Academic Event",
          sourceModule: "academic_calendar",
          sourceLabel: "Academic Desk",
          departmentId: ev.departmentId,
          departmentName: ev.departmentName,
          semester: ev.semester,
          targetAudience: ev.targetAudience,
          rawEvent: ev
        });
      });
    }

    return [...list, ...personalEvents, ...lmsAssignments, ...opportunities, ...announcements];
  };

  const allUnifiedEvents = getUnifiedEvents();

  // Helper date mapping checks (safely handling both ISO datetime strings and simple YYYY-MM-DD strings)
  const isEventOnDate = (event: UnifiedEvent, dateStr: string) => {
    const startStr = (event.startDate || "").slice(0, 10);
    const endStr = (event.endDate || event.startDate || "").slice(0, 10);
    return dateStr >= startStr && dateStr <= endStr;
  };

  // Perform client side unified filtering
  const filteredEvents = allUnifiedEvents.filter((event) => {
    // 1. Search Query
    const matchesSearch =
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (event.description || "").toLowerCase().includes(searchQuery.toLowerCase());

    // 2. Event Type Filter
    const matchesType =
      eventTypeFilter === "ALL" || event.eventType === eventTypeFilter;

    // 3. Scope Filter
    let matchesScope = true;
    if (scopeFilter === "ACADEMIC") {
      matchesScope = event.sourceModule === "academic_calendar";
    } else if (scopeFilter === "PERSONAL") {
      matchesScope = event.sourceModule === "personal_calendar";
    } else if (scopeFilter === "OPPORTUNITIES") {
      matchesScope = event.sourceModule === "opportunity";
    } else if (scopeFilter === "ASSIGNMENTS") {
      matchesScope = event.sourceModule === "lms_assignment";
    } else if (scopeFilter === "ANNOUNCEMENTS") {
      matchesScope = event.sourceModule === "announcement";
    }

    // 4. Department Filter
    const matchesDept =
      deptFilter === "ALL" ||
      event.departmentId === deptFilter ||
      (deptFilter === "NONE" && !event.departmentId);

    // 5. Semester Filter
    const matchesSem =
      semFilter === "ALL" ||
      (event.semester !== null && event.semester.toString() === semFilter) ||
      (semFilter === "NONE" && event.semester === null);

    return matchesSearch && matchesType && matchesScope && matchesDept && matchesSem;
  });

  // Calendar parameters
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Week navigation calculation
  const handlePrevWeek = () => {
    const d = new Date(currentDate);
    d.setDate(currentDate.getDate() - 7);
    setCurrentDate(d);
  };

  const handleNextWeek = () => {
    const d = new Date(currentDate);
    d.setDate(currentDate.getDate() + 7);
    setCurrentDate(d);
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  // Get events on date
  const getEventsForDateStr = (dateStr: string) => {
    return filteredEvents.filter((ev) => isEventOnDate(ev, dateStr));
  };

  // Week Days compute (Sun to Sat)
  const getWeekDays = (): Date[] => {
    const weekDays: Date[] = [];
    const sun = new Date(currentDate);
    // Align to Sunday
    sun.setDate(currentDate.getDate() - currentDate.getDay());
    for (let i = 0; i < 7; i++) {
      const day = new Date(sun);
      day.setDate(sun.getDate() + i);
      weekDays.push(day);
    }
    return weekDays;
  };

  const weekDaysList = getWeekDays();

  // Render cells for Month View
  const renderMonthDays = () => {
    const cells: React.ReactNode[] = [];
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const totalDaysInPrevMonth = new Date(year, month, 0).getDate();

    // Prev Month filler cells
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const prevDay = totalDaysInPrevMonth - i;
      cells.push(
        <div
          key={`prev-${prevDay}`}
          className="min-h-[90px] border-b border-r border-neutral-900 bg-neutral-950/20 p-2 text-neutral-600 text-[10px] font-medium"
        >
          {prevDay}
        </div>
      );
    }

    // Current Month active cells
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const dayDate = new Date(year, month, day);
      const isSelected = selectedDate && dayDate.toDateString() === selectedDate.toDateString();
      const isToday = dayDate.toDateString() === new Date().toDateString();
      
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dayEvents = getEventsForDateStr(dateStr);

      cells.push(
        <div
          key={`curr-${day}`}
          onClick={() => setSelectedDate(dayDate)}
          className={`min-h-[95px] border-b border-r dark:border-neutral-900 border-border-subtle p-1.5 transition-all cursor-pointer relative flex flex-col justify-between ${
            isSelected
              ? "bg-blue-600/10 border-l border-t border-blue-500/30"
              : "dark:hover:bg-neutral-900/30 hover:bg-surface-hover dark:bg-neutral-955/40 bg-surface"
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-semibold flex items-center justify-center w-6 h-6 rounded-full ${
                isToday
                  ? "bg-blue-600 text-white font-bold animate-pulse"
                  : isSelected
                  ? "dark:text-blue-400 text-blue-600 font-bold"
                  : "dark:text-neutral-300 text-text-secondary"
              }`}
            >
              {day}
            </span>
            {dayEvents.length > 0 && (
              <span className="text-[9px] font-mono dark:text-neutral-500 text-text-muted">
                {dayEvents.length}
              </span>
            )}
          </div>

          <div className="mt-2 space-y-1 overflow-hidden flex-1 flex flex-col justify-end">
            {dayEvents.slice(0, 2).map((ev) => {
              const cat = getEventCategoryInfo(ev.eventType, ev.title);
              return (
                <div
                  key={ev.id}
                  className={`text-[8px] px-1.5 py-0.5 rounded border leading-tight truncate font-sans text-left font-medium ${cat.bgClass} ${cat.borderClass} ${cat.textClass}`}
                  title={`${ev.sourceLabel}: ${ev.title}`}
                >
                  {ev.title}
                </div>
              );
            })}
            {dayEvents.length > 2 && (
              <div className="text-[8px] font-bold font-mono dark:text-neutral-500 text-text-muted text-left pl-1">
                +{dayEvents.length - 2} more...
              </div>
            )}
          </div>
        </div>
      );
    }

    // Next Month filler cells
    const totalCells = cells.length;
    const remainingCells = totalCells <= 35 ? 35 - totalCells : 42 - totalCells;
    for (let day = 1; day <= remainingCells; day++) {
      cells.push(
        <div
          key={`next-${day}`}
          className="min-h-[90px] border-b border-r dark:border-neutral-900 border-border-subtle dark:bg-neutral-950/20 bg-surface-hover/30 p-2 dark:text-neutral-600 text-text-muted text-[10px] font-medium"
        >
          {day}
        </div>
      );
    }

    return cells;
  };

  // Click handler on unified cards (launch personal edit if owner, or trigger registrar edits if admin)
  const handleEventCardClick = (event: UnifiedEvent) => {
    if (event.sourceModule === "personal_calendar" && event.isOwner) {
      setSelectedPersonalEvent(event.rawEvent);
      setPersonalModalOpen(true);
    } else if (event.sourceModule === "academic_calendar" && role === "admin" && onEditEvent) {
      onEditEvent(event.rawEvent);
    }
  };

  // Selected Day variables
  const selectedDateStr = selectedDate
    ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`
    : "";
  const selectedDateEvents = selectedDate ? getEventsForDateStr(selectedDateStr) : [];

  // Sort upcoming events chronologically (today onwards)
  const todayDateStr = new Date().toISOString().split("T")[0];
  const upcomingEventsList = filteredEvents
    .filter((ev) => (ev.endDate || ev.startDate).slice(0, 10) >= todayDateStr)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  return (
    <div className="space-y-6">
      
      {/* Search and Filters panel */}
      <div className="glass-card border dark:border-neutral-800 border-border-subtle rounded-xl p-4 flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          
          {/* Search bar */}
          <div className="relative col-span-1 sm:col-span-2">
            <Search className="absolute left-3 top-2.5 w-4 h-4 dark:text-neutral-500 text-text-muted" />
            <input
              type="text"
              placeholder="Search ERP calendar events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs dark:bg-neutral-950 bg-surface border dark:border-neutral-800 border-border-subtle rounded dark:text-white text-text-primary focus:outline-none focus:border-border-strong"
            />
          </div>

          {/* Event Type Filter */}
          <div className="flex items-center gap-2 dark:bg-neutral-950 bg-surface border dark:border-neutral-800 border-border-subtle rounded px-2 text-xs dark:text-white text-text-primary relative">
            <Filter size={12} className="dark:text-neutral-500 text-text-muted shrink-0" />
            <span className="dark:text-neutral-500 text-text-muted">Type:</span>
            <div className="relative flex-1">
              <select
                value={eventTypeFilter}
                onChange={(e) => setEventTypeFilter(e.target.value)}
                className="w-full bg-transparent dark:text-white text-text-primary cursor-pointer py-2 pr-6 appearance-none focus:outline-none text-[11px] font-bold"
              >
                <option value="ALL">All Categories</option>
                <option value="Academic Event">Academic Events</option>
                <option value="Assignment Deadline">Assignments</option>
                <option value="Workshop">Workshops</option>
                <option value="Seminar">Seminars</option>
                <option value="Hackathon">Hackathons</option>
                <option value="Placement Drive">Placement Drives</option>
                <option value="Internship Deadline">Internships</option>
                <option value="Personal Reminder">Personal Tasks</option>
                <option value="Holiday">Holidays</option>
              </select>
              <div className="absolute right-0.5 top-1/2 -translate-y-1/2 pointer-events-none dark:text-neutral-450 text-text-muted">
                ▼
              </div>
            </div>
          </div>

          {/* Module Integration Scope Filter */}
          <div className="flex items-center gap-2 dark:bg-neutral-950 bg-surface border dark:border-neutral-800 border-border-subtle rounded px-2 text-xs dark:text-white text-text-primary relative">
            <Filter size={12} className="dark:text-neutral-500 text-text-muted shrink-0" />
            <span className="dark:text-neutral-500 text-text-muted">Source:</span>
            <div className="relative flex-1">
              <select
                value={scopeFilter}
                onChange={(e) => setScopeFilter(e.target.value)}
                className="w-full bg-transparent dark:text-white text-text-primary cursor-pointer py-2 pr-6 appearance-none focus:outline-none text-[11px] font-bold"
              >
                <option value="ALL">All Integrated Modules</option>
                <option value="ACADEMIC">Academic Desk</option>
                <option value="PERSONAL">Personal Reminders</option>
                <option value="OPPORTUNITIES">Opportunities Hub</option>
                <option value="ASSIGNMENTS">LMS Assignments</option>
                <option value="ANNOUNCEMENTS">Announcements Desk</option>
              </select>
              <div className="absolute right-0.5 top-1/2 -translate-y-1/2 pointer-events-none dark:text-neutral-450 text-text-muted">
                ▼
              </div>
            </div>
          </div>

          {/* Department Filter (Visible only to Admin/Faculty) */}
          <div className="flex items-center gap-2 dark:bg-neutral-950 bg-surface border dark:border-neutral-800 border-border-subtle rounded px-2 text-xs dark:text-white text-text-primary relative">
            <Filter size={12} className="dark:text-neutral-500 text-text-muted shrink-0" />
            <span className="dark:text-neutral-500 text-text-muted">Dept:</span>
            <div className="relative flex-1">
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="w-full bg-transparent dark:text-white text-text-primary cursor-pointer py-2 pr-6 appearance-none focus:outline-none text-[11px] font-bold"
              >
                <option value="ALL">All Departments</option>
                <option value="NONE">General / Inst</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.code}
                  </option>
                ))}
              </select>
              <div className="absolute right-0.5 top-1/2 -translate-y-1/2 pointer-events-none dark:text-neutral-450 text-text-muted">
                ▼
              </div>
            </div>
          </div>

        </div>

        {/* View Mode controls, Semester Filter & Personal Creation */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t dark:border-neutral-900 border-border-subtle">
          
          {/* Semester & Personal Creation trigger */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex items-center dark:bg-neutral-950 bg-surface border dark:border-neutral-850 border-border-subtle px-2 py-1 rounded text-xs">
              <span className="dark:text-neutral-500 text-text-muted mr-1.5">Sem:</span>
              <select
                value={semFilter}
                onChange={(e) => setSemFilter(e.target.value)}
                className="bg-transparent dark:text-white text-text-primary cursor-pointer appearance-none focus:outline-none text-[10px] font-bold pr-4"
              >
                <option value="ALL">All Semesters</option>
                <option value="NONE">General / Inst</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                  <option key={sem} value={sem.toString()}>
                    Semester {sem}
                  </option>
                ))}
              </select>
            </div>

            {/* Student/Faculty: Add personal entry */}
            {(role === "student" || role === "faculty") && (
              <button
                onClick={() => {
                  setSelectedPersonalEvent(null);
                  setPersonalModalOpen(true);
                }}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer transition shadow-md shadow-blue-600/15 font-sans"
              >
                <Plus size={13} />
                <span>Add Task/Reminder</span>
              </button>
            )}
          </div>

          {/* View Toggles (Adding WEEK VIEW) */}
          <div className="flex rounded-lg dark:bg-neutral-950 bg-surface-elevated border dark:border-neutral-800 border-border-subtle p-0.5 w-full sm:w-auto self-stretch sm:self-auto justify-around sm:justify-start">
            <button
              onClick={() => setViewMode("month")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded cursor-pointer transition ${
                viewMode === "month" ? "bg-blue-600 text-white" : "dark:text-neutral-400 text-text-secondary dark:hover:text-neutral-200 hover:text-text-primary"
              }`}
            >
              <CalendarDays size={12} />
              <span>Month</span>
            </button>
            <button
              onClick={() => setViewMode("week")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded cursor-pointer transition ${
                viewMode === "week" ? "bg-blue-600 text-white" : "dark:text-neutral-400 text-text-secondary dark:hover:text-neutral-200 hover:text-text-primary"
              }`}
            >
              <CalendarIcon size={12} />
              <span>Week View</span>
            </button>
            <button
              onClick={() => setViewMode("upcoming")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded cursor-pointer transition ${
                viewMode === "upcoming" ? "bg-blue-600 text-white" : "dark:text-neutral-400 text-text-secondary dark:hover:text-neutral-200 hover:text-text-primary"
              }`}
            >
              <Clock size={12} />
              <span>Upcoming</span>
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded cursor-pointer transition ${
                viewMode === "list" ? "bg-blue-600 text-white" : "dark:text-neutral-400 text-text-secondary dark:hover:text-neutral-200 hover:text-text-primary"
              }`}
            >
              <List size={12} />
              <span>Full List</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {propLoading || loadingExtras ? (
        <div className="glass-card border dark:border-neutral-800 border-border-subtle rounded-xl p-12 text-center dark:text-neutral-500 text-text-muted font-mono text-xs shadow-xl">
          <div className="animate-spin inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mb-3"></div>
          <div>Synchronizing all calendars, LMS assignments, and portals...</div>
        </div>
      ) : propError ? (
        <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold font-mono flex items-center gap-2">
          <AlertCircle size={16} />
          <span>Error loading calendar timeline database: {propError}</span>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="glass-card border dark:border-neutral-800 border-border-subtle rounded-xl p-12 text-center dark:text-neutral-500 text-text-muted font-mono text-xs shadow-xl">
          <CalendarIcon className="mx-auto mb-2 dark:text-neutral-600 text-text-muted" size={24} />
          <div>No events found matching the filter criteria.</div>
        </div>
      ) : (
        <>
          {/* MONTH GRID VIEW */}
          {viewMode === "month" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Month Selector & Grid */}
              <div className="lg:col-span-8 glass-card border dark:border-neutral-800 border-border-subtle rounded-xl overflow-hidden shadow-xl">
                <div className="flex items-center justify-between px-4 py-3 dark:bg-neutral-900 bg-surface border-b dark:border-neutral-800 border-border-subtle">
                  <h3 className="font-display font-bold dark:text-white text-text-primary text-sm flex items-center gap-2">
                    <CalendarDays size={16} className="text-blue-500" />
                    <span>
                      {currentDate.toLocaleString("default", { month: "long" })} {year}
                    </span>
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handlePrevMonth}
                      className="p-1 rounded dark:bg-neutral-800 bg-surface-elevated dark:hover:bg-neutral-750 hover:bg-surface-hover dark:text-neutral-400 text-text-secondary dark:hover:text-white hover:text-text-primary border border-border-subtle shadow-sm cursor-pointer transition"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      onClick={handleToday}
                      className="px-2.5 py-1 text-[10px] font-bold rounded dark:bg-neutral-800 bg-surface-elevated dark:hover:bg-neutral-750 hover:bg-surface-hover dark:text-neutral-300 text-text-secondary dark:hover:text-white hover:text-text-primary border border-border-subtle shadow-sm cursor-pointer transition uppercase"
                    >
                      Today
                    </button>
                    <button
                      onClick={handleNextMonth}
                      className="p-1 rounded dark:bg-neutral-800 bg-surface-elevated dark:hover:bg-neutral-750 hover:bg-surface-hover dark:text-neutral-400 text-text-secondary dark:hover:text-white hover:text-text-primary border border-border-subtle shadow-sm cursor-pointer transition"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 border-b dark:border-neutral-900 border-border-subtle text-center dark:bg-neutral-950/60 bg-surface py-2">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <span key={day} className="text-[10px] font-bold dark:text-neutral-500 text-text-muted uppercase">
                      {day}
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-7 border-r dark:border-neutral-900 border-border-subtle">
                  {renderMonthDays()}
                </div>
              </div>

              {/* Selected Day details (Right sidebar) */}
              <div className="lg:col-span-4 glass-card border dark:border-neutral-800 border-border-subtle rounded-xl p-4 shadow-xl text-left">
                <div className="border-b dark:border-neutral-900 border-border-subtle pb-3 mb-4">
                  <span className="text-[10px] font-bold dark:text-neutral-500 text-text-muted uppercase tracking-wider font-mono">DAY TARGET SCHEDULE</span>
                  <h4 className="font-display font-bold dark:text-white text-text-primary text-sm mt-0.5">
                    {selectedDate ? selectedDate.toLocaleDateString("en-IN", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : "No Date Selected"}
                  </h4>
                </div>

                <div className="space-y-3 max-h-[390px] overflow-y-auto pr-1">
                  {selectedDateEvents.length > 0 ? (
                    selectedDateEvents.map((ev) => {
                      const cat = getEventCategoryInfo(ev.eventType, ev.title);
                      return (
                        <div
                          key={ev.id}
                          onClick={() => handleEventCardClick(ev)}
                          className={`p-3 rounded-lg border flex flex-col gap-2 transition-all relative ${
                            ev.isOwner ? "cursor-pointer hover:border-blue-500/50" : ""
                          } ${cat.bgClass} ${cat.borderClass}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase border font-mono ${cat.textClass} ${cat.borderClass} ${cat.bgClass}`}>
                              {cat.label}
                            </span>
                            <span className="text-[8px] px-1.5 py-0.5 dark:bg-neutral-900/60 bg-surface border dark:border-neutral-800 border-border-subtle dark:text-neutral-400 text-text-secondary rounded font-mono font-semibold uppercase">
                              {ev.sourceLabel}
                            </span>
                          </div>

                          <h4 className="font-bold dark:text-white text-text-primary text-xs mt-1 leading-snug">{ev.title}</h4>
                          
                          {ev.description && (
                            <p className="text-[10px] dark:text-neutral-400 text-text-secondary leading-normal line-clamp-3">{ev.description}</p>
                          )}

                          <div className="grid grid-cols-2 gap-y-1 text-[8px] font-mono dark:text-neutral-400 text-text-secondary border-t dark:border-neutral-900/40 border-border-subtle/40 pt-2 mt-1">
                            <div>
                              <span className="dark:text-neutral-500 text-text-muted block text-[7px] uppercase font-bold">Scope / Semester</span>
                              <span>{ev.semester ? `Semester ${ev.semester}` : "Institution Wide"}</span>
                            </div>
                            {ev.isOwner && (
                              <div className="text-right">
                                <span className="text-blue-400 font-bold block hover:underline cursor-pointer">
                                  Edit Task
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-12 dark:text-neutral-600 text-text-muted font-mono text-[10px] dark:bg-neutral-950/20 bg-surface border dark:border-neutral-900 border-border-subtle rounded-lg">
                      No events registered for this date.
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* WEEK VIEW (MODERN 7 DAY CALENDAR BLOCK) */}
          {viewMode === "week" && (
            <div className="glass-card border dark:border-neutral-800 border-border-subtle rounded-xl overflow-hidden shadow-xl text-left">
              {/* Week header navigation */}
              <div className="flex items-center justify-between px-4 py-3 dark:bg-neutral-900 bg-surface border-b dark:border-neutral-800 border-border-subtle">
                <h3 className="font-display font-bold dark:text-white text-text-primary text-sm flex items-center gap-2">
                  <CalendarIcon size={16} className="text-blue-500" />
                  <span>
                    Week Range: {weekDaysList[0].toLocaleDateString("en-IN", { day: '2-digit', month: 'short' })} - {weekDaysList[6].toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </h3>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handlePrevWeek}
                    className="p-1 rounded dark:bg-neutral-800 bg-surface-elevated dark:hover:bg-neutral-750 hover:bg-surface-hover dark:text-neutral-400 text-text-secondary dark:hover:text-white hover:text-text-primary border border-border-subtle shadow-sm cursor-pointer transition"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={handleToday}
                    className="px-2.5 py-1 text-[10px] font-bold rounded dark:bg-neutral-800 bg-surface-elevated dark:hover:bg-neutral-750 hover:bg-surface-hover dark:text-neutral-300 text-text-secondary dark:hover:text-white hover:text-text-primary border border-border-subtle shadow-sm cursor-pointer transition uppercase"
                  >
                    Today
                  </button>
                  <button
                    onClick={handleNextWeek}
                    className="p-1 rounded dark:bg-neutral-800 bg-surface-elevated dark:hover:bg-neutral-750 hover:bg-surface-hover dark:text-neutral-400 text-text-secondary dark:hover:text-white hover:text-text-primary border border-border-subtle shadow-sm cursor-pointer transition"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {/* 7 Column Layout for week days */}
              <div className="grid grid-cols-1 md:grid-cols-7 divide-y md:divide-y-0 md:divide-x dark:divide-neutral-900 divide-border-subtle dark:bg-neutral-950/20 bg-surface">
                {weekDaysList.map((day) => {
                  const dayStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
                  const dayEvents = getEventsForDateStr(dayStr);
                  const isToday = day.toDateString() === new Date().toDateString();
                  
                  return (
                    <div key={dayStr} className="min-h-[220px] p-3 flex flex-col gap-2">
                      {/* Column Day title */}
                      <div className={`pb-2 border-b dark:border-neutral-900/60 border-border-subtle flex items-center justify-between ${
                        isToday ? "text-blue-400 font-extrabold" : "dark:text-neutral-400 text-text-secondary"
                      }`}>
                        <span className="text-[10px] font-bold uppercase">{day.toLocaleString("default", { weekday: "short" })}</span>
                        <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded-full ${
                          isToday ? "bg-blue-600 text-white" : ""
                        }`}>{day.getDate()}</span>
                      </div>

                      {/* Day list of events */}
                      <div className="flex-1 space-y-2 overflow-y-auto max-h-[260px] pr-0.5">
                        {dayEvents.length === 0 ? (
                          <div className="text-[9px] dark:text-neutral-650 text-text-muted font-mono italic pt-4 text-center">
                            No tasks
                          </div>
                        ) : (
                          dayEvents.map((ev) => {
                            const cat = getEventCategoryInfo(ev.eventType, ev.title);
                            return (
                              <div
                                key={ev.id}
                                onClick={() => handleEventCardClick(ev)}
                                className={`p-2 rounded border text-left transition-all ${
                                  ev.isOwner ? "cursor-pointer hover:border-blue-500/40" : ""
                                } ${cat.bgClass} ${cat.borderClass}`}
                              >
                                <div className="flex items-center justify-between text-[7px] font-bold uppercase tracking-wider font-mono opacity-85">
                                  <span>{cat.label}</span>
                                  <span className="dark:text-neutral-500 text-text-muted">{ev.sourceLabel}</span>
                                </div>
                                <h5 className="font-bold text-[10px] dark:text-white text-text-primary leading-tight mt-1 line-clamp-2">
                                  {ev.title}
                                </h5>
                                {ev.isOwner && (
                                  <span className="text-[6px] font-bold text-blue-400 uppercase tracking-widest block mt-1">
                                    Click to Edit
                                  </span>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* UPCOMING EVENTS TIMELINE LIST */}
          {viewMode === "upcoming" && (
            <div className="glass-card border dark:border-neutral-800 border-border-subtle rounded-xl p-5 max-w-3xl mx-auto shadow-xl text-left">
              <div className="border-b dark:border-neutral-900 border-border-subtle pb-3 mb-5 flex items-center justify-between">
                <div>
                  <h3 className="font-display font-bold dark:text-white text-text-primary text-base">Academic & Personal Task Roadmap</h3>
                  <p className="text-[10px] dark:text-neutral-500 text-text-muted mt-0.5">Timeline checkins, project deadlines, fee dates, and institutional events.</p>
                </div>
                <span className="text-[10px] font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded">
                  {upcomingEventsList.length} Active Events
                </span>
              </div>

              {upcomingEventsList.length > 0 ? (
                <div className="relative pl-6 border-l dark:border-neutral-800 border-border-subtle space-y-6">
                  {upcomingEventsList.map((ev) => {
                    const cat = getEventCategoryInfo(ev.eventType, ev.title);
                    return (
                      <div key={ev.id} className="relative group text-left">
                        {/* Timeline dot accent */}
                        <div
                          className="absolute -left-[31px] top-1 w-2.5 h-2.5 rounded-full border-2 transition-all group-hover:scale-125 dark:bg-neutral-950 bg-background"
                          style={{ borderColor: cat.color }}
                        ></div>

                        {/* Event Card */}
                        <div
                          onClick={() => handleEventCardClick(ev)}
                          className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row gap-4 items-start justify-between shadow-md ${
                            ev.isOwner ? "cursor-pointer hover:border-blue-500/40 hover:border-blue-500 dark:hover:bg-neutral-900/10 hover:bg-surface-hover" : "dark:bg-neutral-950/40 bg-surface dark:border-neutral-900 border-border-subtle/80"
                          }`}
                        >
                          <div className="space-y-2 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase border font-mono ${cat.textClass} ${cat.borderClass} ${cat.bgClass}`}>
                                {cat.label}
                              </span>
                              <span className="text-[9px] font-mono dark:text-neutral-500 text-text-muted">
                                Date: {ev.startDate.slice(0,10)} {ev.endDate && ev.endDate.slice(0,10) !== ev.startDate.slice(0,10) ? `to ${ev.endDate.slice(0,10)}` : ""}
                              </span>
                              <span className="dark:bg-neutral-900 bg-surface px-2 py-0.5 rounded border dark:border-neutral-850 border-border-subtle text-[8px] font-bold dark:text-neutral-450 text-text-secondary uppercase font-mono">
                                Source: {ev.sourceLabel}
                              </span>
                            </div>
                            
                            <h4 className="font-bold dark:text-white text-text-primary text-xs leading-snug">{ev.title}</h4>
                            {ev.description && (
                              <p className="text-[10px] dark:text-neutral-400 text-text-secondary leading-normal max-w-2xl">{ev.description}</p>
                            )}
                            
                            <div className="flex items-center gap-3 text-[9px] dark:text-neutral-500 text-text-muted flex-wrap pt-1 font-mono">
                              {ev.departmentName && (
                                <span className="dark:bg-neutral-900 bg-surface px-2 py-0.5 rounded border dark:border-neutral-850 border-border-subtle">
                                  Dept: {ev.departmentName}
                                </span>
                              )}
                              {ev.semester && (
                                <span className="dark:bg-neutral-900 bg-surface px-2 py-0.5 rounded border dark:border-neutral-850 border-border-subtle">
                                  Semester {ev.semester}
                                </span>
                              )}
                              {ev.isOwner && (
                                <span className="text-[8px] text-blue-400 font-bold uppercase tracking-widest">
                                  ★ Personal Entry (Click to Edit)
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Admin core event options */}
                          {role === "admin" && ev.sourceModule === "academic_calendar" && (
                            <div className="flex md:flex-col items-center gap-1.5 self-end md:self-auto pt-2 md:pt-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEditEvent && onEditEvent(ev.rawEvent);
                                }}
                                className="px-2 py-1 rounded dark:bg-neutral-900 bg-surface hover:dark:bg-neutral-800 hover:bg-surface-hover border dark:border-neutral-800 border-border-subtle text-[9px] font-bold dark:text-white text-text-primary transition cursor-pointer shrink-0"
                              >
                                Edit
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onArchiveEvent && onArchiveEvent(ev.id, ev.rawEvent.publishStatus);
                                }}
                                className={`px-2 py-1 rounded text-[9px] font-bold transition cursor-pointer shrink-0 ${
                                  ev.rawEvent?.publishStatus === "Archived"
                                    ? "bg-emerald-950 border border-emerald-900 text-emerald-400 hover:bg-emerald-900"
                                    : "bg-rose-955 border border-rose-900 text-rose-400 hover:bg-rose-900"
                                }`}
                              >
                                {ev.rawEvent?.publishStatus === "Archived" ? "Restore" : "Archive"}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 dark:text-neutral-600 text-text-muted font-mono text-[10px] dark:bg-neutral-955/20 bg-surface border dark:border-neutral-900 border-border-subtle rounded-lg">
                  No upcoming calendar events scheduled.
                </div>
              )}
            </div>
          )}
        
          {/* TABULAR FULL EVENT LIST VIEW */}
          {viewMode === "list" && (
            <div className="glass-card border dark:border-neutral-800 border-border-subtle rounded-xl overflow-hidden shadow-xl text-left">
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 z-10 dark:bg-neutral-900/95 bg-surface/95 backdrop-blur-md border-b dark:border-neutral-850 border-border-subtle shadow-sm">
                    <tr className="dark:text-neutral-400 text-text-secondary font-semibold">
                      <th className="px-4 py-3">Duration</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Title & Notes</th>
                      <th className="px-4 py-3">Source Desk</th>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3">Semester</th>
                      {role === "admin" && <th className="px-4 py-3 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-neutral-900 divide-border-subtle dark:text-neutral-300 text-text-secondary">
                    {filteredEvents.map((ev) => {
                      const cat = getEventCategoryInfo(ev.eventType, ev.title);
                      return (
                        <tr
                          key={ev.id}
                          onClick={() => handleEventCardClick(ev)}
                          className={`transition-colors ${
                            ev.isOwner ? "cursor-pointer hover:bg-blue-600/5" : "dark:hover:bg-neutral-900/30 hover:bg-surface-hover"
                          }`}
                        >
                          <td className="px-4 py-3 font-mono text-[10px] whitespace-nowrap">
                            <span className="block dark:text-white text-text-primary font-semibold">{ev.startDate.slice(0,10)}</span>
                            {ev.endDate && ev.endDate.slice(0,10) !== ev.startDate.slice(0,10) && (
                              <span className="dark:text-neutral-500 text-text-muted text-[9px] block">to {ev.endDate.slice(0,10)}</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase border font-mono ${cat.textClass} ${cat.borderClass} ${cat.bgClass}`}>
                              {cat.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-semibold dark:text-white text-text-primary block leading-tight">{ev.title}</span>
                            {ev.description && (
                              <span className="text-[10px] dark:text-neutral-500 text-text-muted block leading-normal mt-0.5 line-clamp-1 max-w-sm" title={ev.description}>
                                {ev.description}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-1.5 py-0.5 dark:bg-neutral-900/50 bg-surface dark:text-neutral-450 text-text-secondary border dark:border-neutral-850 border-border-subtle rounded font-mono text-[9px]">
                              {ev.sourceLabel}
                            </span>
                          </td>
                          <td className="px-4 py-3 dark:text-neutral-400 text-text-secondary truncate max-w-[120px]" title={ev.departmentName || "All Departments"}>
                            {ev.departmentName || "General (Institution)"}
                          </td>
                          <td className="px-4 py-3">
                            {ev.semester ? (
                              <span className="font-mono dark:text-white text-text-primary dark:bg-neutral-900 bg-surface px-2 py-0.5 border dark:border-neutral-855 border-border-subtle rounded text-[9px]">
                                Sem {ev.semester}
                              </span>
                            ) : (
                              <span className="dark:text-neutral-500 text-text-muted text-[9px]">All Semesters</span>
                            )}
                          </td>
                          
                          {role === "admin" && (
                            <td className="px-4 py-3 text-right">
                              {ev.sourceModule === "academic_calendar" && (
                                <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => onEditEvent && onEditEvent(ev.rawEvent)}
                                    className="px-2 py-1 rounded dark:bg-neutral-900 bg-surface hover:dark:bg-neutral-800 hover:bg-surface-hover border dark:border-neutral-800 border-border-subtle text-[9px] font-bold dark:text-white text-text-primary transition cursor-pointer"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => onArchiveEvent && onArchiveEvent(ev.id, ev.rawEvent.publishStatus)}
                                    className={`px-2 py-1 rounded text-[9px] font-bold transition cursor-pointer ${
                                      ev.rawEvent?.publishStatus === "Archived"
                                        ? "bg-emerald-950 border border-emerald-900 text-emerald-400 hover:bg-emerald-900"
                                        : "bg-rose-955 border border-rose-900 text-rose-400 hover:bg-rose-900"
                                    }`}
                                  >
                                    {ev.rawEvent?.publishStatus === "Archived" ? "Restore" : "Archive"}
                                  </button>
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Reusable PersonalEventModal mount */}
      <PersonalEventModal
        isOpen={personalModalOpen}
        onClose={() => {
          setPersonalModalOpen(false);
          setSelectedPersonalEvent(null);
        }}
        eventToEdit={selectedPersonalEvent}
        onSaveSuccess={fetchAllCalendarModules}
        role={role}
      />

    </div>
  );
};
