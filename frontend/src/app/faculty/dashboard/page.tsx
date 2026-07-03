"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSimulation } from "@/context/SimulationContext";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { 
  Calendar, 
  AlertCircle, 
  ArrowRight, 
  CheckCircle, 
  Clock, 
  FileSpreadsheet, 
  PlusCircle, 
  Users, 
  BookOpen, 
  Loader2,
  CalendarDays,
  Bell,
  ClipboardList
} from "lucide-react";

// Import Reusable Dashboard Widgets
import { StatsCard } from "@/components/Dashboard/StatsCard";
import { AssignmentWidget, FacultyAssignmentData } from "@/components/Dashboard/AssignmentWidget";
import { CalendarWidget } from "@/components/Dashboard/CalendarWidget";
import { NotificationWidget } from "@/components/Dashboard/NotificationWidget";
import { UpcomingEventsWidget } from "@/components/Dashboard/UpcomingEventsWidget";
import { UnifiedEvent } from "@/components/CalendarView";

export default function FacultyDashboard() {
  const { accessToken } = useAuth();
  const { 
    faculty, 
    currentFacultyId
  } = useSimulation();

  // Find active faculty profile (simulation context fallback)
  const activeFaculty = faculty.find(f => f.id === currentFacultyId) || faculty[0];

  // API State
  const [apiWorkload, setApiWorkload] = useState<any[]>([]);
  const [apiExams, setApiExams] = useState<any[]>([]);
  const [apiCalendarEvents, setApiCalendarEvents] = useState<any[]>([]);
  const [apiNotifications, setApiNotifications] = useState<any[]>([]);
  const [apiAttendanceToday, setApiAttendanceToday] = useState<any[]>([]);
  const [apiResults, setApiResults] = useState<any[]>([]);
  const [apiLmsAssignments, setApiLmsAssignments] = useState<any[]>([]);
  const [apiSubmissions, setApiSubmissions] = useState<any[]>([]);
  const [apiOpportunities, setApiOpportunities] = useState<any[]>([]);
  const [apiPersonalEntries, setApiPersonalEntries] = useState<any[]>([]);

  // Loading states
  const [loadingWorkload, setLoadingWorkload] = useState(false);
  const [loadingExams, setLoadingExams] = useState(false);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [loadingLms, setLoadingLms] = useState(false);

  const todayStr = new Date().toISOString().split("T")[0];

  // Sync / Fetch function
  const loadDashboardData = useCallback(async () => {
    if (!accessToken) return;

    // Fetch Assigned Subjects Workload
    setLoadingWorkload(true);
    try {
      const res = await apiFetch("/attendance/my-assignments", {}, accessToken);
      if (res.success && res.data?.assignments) {
        setApiWorkload(res.data.assignments.filter((a: any) => a.isActive));
      }
    } catch (err) {
      console.error("Dashboard failed to fetch faculty assignments", err);
    } finally {
      setLoadingWorkload(false);
    }

    // Fetch Upcoming Exams for Faculty subjects
    setLoadingExams(true);
    try {
      const res = await apiFetch("/examinations/my-schedule", {}, accessToken);
      if (res.success && res.data?.exams) {
        setApiExams(res.data.exams);
      }
    } catch (err) {
      console.error("Dashboard failed to fetch exams schedule", err);
    } finally {
      setLoadingExams(false);
    }

    // Fetch Registrar Calendar Events
    setLoadingCalendar(true);
    try {
      const res = await apiFetch("/calendar?limit=50", {}, accessToken);
      if (res.success && res.data?.events) {
        setApiCalendarEvents(res.data.events);
      }
    } catch (err) {
      console.error("Dashboard failed to fetch calendar events", err);
    } finally {
      setLoadingCalendar(false);
    }

    // Fetch Personal entries
    try {
      const entryRes = await apiFetch("/calendar-entries?limit=100", {}, accessToken);
      if (entryRes.success && entryRes.data?.entries) {
        setApiPersonalEntries(entryRes.data.entries);
      }
    } catch (err) {
      console.error("Dashboard failed to fetch personal entries", err);
    }

    // Fetch Notifications
    setLoadingNotifications(true);
    try {
      const res = await apiFetch("/notifications?limit=20", {}, accessToken);
      if (res.success && res.data?.notifications) {
        setApiNotifications(res.data.notifications);
      }
    } catch (err) {
      console.error("Dashboard failed to fetch notifications", err);
    } finally {
      setLoadingNotifications(false);
    }

    // Fetch Opportunities (needed for unified calendar)
    try {
      const res = await apiFetch("/opportunities?limit=50", {}, accessToken);
      if (res.success && res.data?.opportunities) {
        setApiOpportunities(res.data.opportunities);
      }
    } catch (err) {
      console.error("Dashboard failed to fetch opportunities", err);
    }

    // Fetch Today's Attendance logs to compute pending tasks
    try {
      const res = await apiFetch(`/attendance?date=${todayStr}`, {}, accessToken);
      if (res.success && res.data?.records) {
        setApiAttendanceToday(res.data.records);
      }
    } catch (err) {
      console.error("Dashboard failed to fetch today's attendance logs", err);
    }

    // Fetch all evaluations results to check pending marks entry
    try {
      const res = await apiFetch("/results", {}, accessToken);
      if (res.success && res.data?.results) {
        setApiResults(res.data.results);
      }
    } catch (err) {
      console.error("Dashboard failed to fetch results", err);
    }

    // Fetch LMS Assignments & Submissions
    setLoadingLms(true);
    try {
      const [assignRes, subRes] = await Promise.all([
        apiFetch("/lms/assignments?limit=50", {}, accessToken),
        apiFetch("/lms/submissions?limit=100", {}, accessToken)
      ]);

      if (assignRes.success && assignRes.data?.assignments) {
        setApiLmsAssignments(assignRes.data.assignments);
      }
      if (subRes.success && subRes.data?.submissions) {
        setApiSubmissions(subRes.data.submissions);
      }
    } catch (err) {
      console.error("Dashboard failed to fetch LMS assignments/submissions", err);
    } finally {
      setLoadingLms(false);
    }

  }, [accessToken, todayStr]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadDashboardData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadDashboardData]);

  // Mark notification read callback
  const handleMarkNotificationRead = async (id: string) => {
    if (!accessToken) return;
    try {
      const res = await apiFetch(`/notifications/${id}/read`, { method: "PUT" }, accessToken);
      if (res.success) {
        setApiNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
        );
        window.dispatchEvent(new Event("notificationUpdate"));
      }
    } catch (err) {
      console.error("Failed to mark notification as read", err);
    }
  };

  if (!activeFaculty) {
    return <div className="text-text-muted font-mono text-center py-10">No active faculty profile loaded.</div>;
  }

  // 1. Today's Class Schedule Slots (dynamic mappings from workload)
  const timetableSlots = apiWorkload.map((sub, idx) => {
    // Check if attendance has been registered today for this subject + section
    const isLogged = apiAttendanceToday.some(log => log.subjectId === sub.subjectId && log.section === sub.section);

    return {
      time: idx === 0 ? "09:00 AM - 10:30 AM" : "11:30 AM - 01:00 PM",
      subjectId: sub.subjectId,
      subjectName: sub.subjectName,
      subjectCode: sub.subjectCode,
      batch: `${activeFaculty.department} - Sem ${sub.semester} (Sec ${sub.section})`,
      section: sub.section,
      location: idx === 0 ? "Lab Block LH-402" : "Seminar Hall SH-101",
      isLogged,
      status: idx === 0 ? "Active" : "Upcoming"
    };
  });

  // 2. Pending Tasks
  const pendingAttendanceTasks = timetableSlots.filter(slot => !slot.isLogged);

  const pendingMarksEntry = apiWorkload.filter(sub => {
    // Check if marks are entered for this subject code
    const marksEntered = apiResults.some(res => res.subjectId === sub.subjectId && res.resultStatus !== "Draft");
    return !marksEntered;
  });

  // 3. Upcoming examinations for checklist
  const displayExams = apiExams.filter(ex => ex.status === "Scheduled").slice(0, 3);

  // 4. LMS assignments with evaluations summary
  const facultyAssignmentData: FacultyAssignmentData[] = apiLmsAssignments.map((a: any) => {
    const submissionsForAssignment = apiSubmissions.filter((s: any) => s.assignmentId === a.id);
    const totalSubmissions = submissionsForAssignment.length;
    const pendingEvaluations = submissionsForAssignment.filter((s: any) => s.status === "Submitted" || s.status === "Late Submission").length;
    
    return {
      id: a.id,
      title: a.title,
      subjectName: a.subjectName,
      dueDate: a.dueDate,
      pendingEvaluations,
      totalSubmissions
    };
  });

  const totalPendingEvaluations = facultyAssignmentData.reduce((acc, curr) => acc + curr.pendingEvaluations, 0);

  // 5. Unified calendar events for calendar widget
  const mappedAcademicEvents = apiCalendarEvents
    .filter(ev => ev.targetAudience === "All" || ev.targetAudience === "Faculty")
    .map((ev: any) => ({
      id: ev.id,
      title: ev.title,
      description: ev.description,
      startDate: ev.startDate,
      endDate: ev.endDate,
      eventType: ev.eventType === "Holiday" ? "Holiday" : "Academic Event",
      sourceModule: "academic_calendar" as const,
      sourceLabel: "Academic Desk",
      departmentId: ev.departmentId,
      departmentName: ev.departmentName,
      semester: ev.semester,
      targetAudience: ev.targetAudience,
      rawEvent: ev
    }));

  const mappedLmsEvents = apiLmsAssignments.map((a: any) => ({
    id: a.id,
    title: a.title,
    description: a.description || null,
    startDate: a.dueDate,
    endDate: null,
    eventType: "Assignment Deadline",
    sourceModule: "lms_assignment" as const,
    sourceLabel: "LMS Desk",
    departmentId: null,
    departmentName: null,
    semester: a.semester || null
  }));

  const mappedOpportunityEvents = apiOpportunities.map((o: any) => ({
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

  const mappedPersonalEvents = apiPersonalEntries.map((e: any) => ({
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

  const unifiedEvents: UnifiedEvent[] = [
    ...mappedAcademicEvents,
    ...mappedLmsEvents,
    ...mappedOpportunityEvents,
    ...mappedPersonalEvents
  ];

  return (
    <div className="space-y-6 pb-12">
      
      {/* Welcome banner */}
      <div className="p-5 rounded-xl border dark:border-blue-500/20 border-blue-200 dark:bg-blue-500/5 bg-blue-50 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-xl text-text-primary">Welcome back, {activeFaculty.name}!</h2>
          <p className="text-xs text-text-muted mt-1">
            Department: {activeFaculty.department} Engineering / Faculty ID: {activeFaculty.employeeId}
          </p>
        </div>
        <div className="flex items-center gap-1.5 bg-surface border border-border-subtle px-3 py-1.5 rounded-lg text-xs font-semibold text-text-primary">
          <Clock size={14} className="text-blue-400" />
          <span>Academic Term: 2026-27</span>
        </div>
      </div>

      {/* QUICK ACTIONS PANEL */}
      <div className="bg-surface border border-border-subtle rounded-xl p-5">
        <h3 className="font-display font-bold text-text-primary text-xs uppercase tracking-wider mb-4">Quick Workload Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Link
            href="/faculty/attendance"
            className="flex flex-col items-center justify-center p-4 rounded-lg border border-border-subtle bg-background/45 hover:bg-surface-elevated/20 dark:hover:border-blue-500/30 hover:border-blue-500/40 transition text-center group cursor-pointer"
          >
            <Users size={20} className="text-blue-400 group-hover:scale-110 transition-transform mb-2" />
            <span className="text-xs font-semibold text-text-primary">Take Attendance</span>
            <span className="text-[9px] text-text-muted mt-0.5">Register rolls</span>
          </Link>

          <Link
            href="/faculty/grades"
            className="flex flex-col items-center justify-center p-4 rounded-lg border border-border-subtle bg-background/45 hover:bg-surface-elevated/20 dark:hover:border-emerald-500/30 hover:border-emerald-500/40 transition text-center group cursor-pointer"
          >
            <FileSpreadsheet size={20} className="text-emerald-400 group-hover:scale-110 transition-transform mb-2" />
            <span className="text-xs font-semibold text-text-primary">Enter Marks</span>
            <span className="text-[9px] text-text-muted mt-0.5">Upload exam grades</span>
          </Link>

          <Link
            href="/faculty/examinations"
            className="flex flex-col items-center justify-center p-4 rounded-lg border border-border-subtle bg-background/45 hover:bg-surface-elevated/20 dark:hover:border-amber-500/30 hover:border-amber-500/40 transition text-center group cursor-pointer"
          >
            <Calendar size={20} className="text-amber-400 group-hover:scale-110 transition-transform mb-2" />
            <span className="text-xs font-semibold text-text-primary">Manage Exams</span>
            <span className="text-[9px] text-text-muted mt-0.5">Create & run assessments</span>
          </Link>

          <Link
            href="/faculty/calendar"
            className="flex flex-col items-center justify-center p-4 rounded-lg border border-border-subtle bg-background/45 hover:bg-surface-elevated/20 dark:hover:border-indigo-500/30 hover:border-indigo-500/40 transition text-center group cursor-pointer"
          >
            <CalendarDays size={20} className="text-indigo-400 group-hover:scale-110 transition-transform mb-2" />
            <span className="text-xs font-semibold text-text-primary">View Calendar</span>
            <span className="text-[9px] text-text-muted mt-0.5">Events milestones</span>
          </Link>

          <Link
            href="/faculty/lms"
            className="flex flex-col items-center justify-center p-4 rounded-lg border border-border-subtle bg-background/45 hover:bg-surface-elevated/20 dark:hover:border-indigo-500/30 hover:border-indigo-500/40 transition text-center group cursor-pointer"
          >
            <BookOpen size={20} className="text-indigo-450 group-hover:scale-110 transition-transform mb-2" />
            <span className="text-xs font-semibold text-text-primary">LMS Portal</span>
            <span className="text-[9px] text-text-muted mt-0.5">Courseware & Materials</span>
          </Link>
        </div>
      </div>

      {/* Stats Cards Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Assigned Classes"
          value={loadingWorkload ? "..." : apiWorkload.length}
          icon={Users}
          description="Active class allocations"
          iconClass="dark:bg-blue-500/10 bg-blue-50 dark:text-blue-400 text-blue-700 border dark:border-blue-500/20 border-blue-200"
        />
        <StatsCard
          title="Attendance Roll Calls"
          value={loadingWorkload ? "..." : pendingAttendanceTasks.length}
          icon={Clock}
          description="Pending registration today"
          iconClass={pendingAttendanceTasks.length > 0 ? "dark:bg-amber-500/10 bg-amber-50 dark:text-amber-400 text-amber-700 border dark:border-amber-500/20 border-amber-200" : "dark:bg-emerald-500/10 bg-emerald-50 dark:text-emerald-400 text-emerald-700 border dark:border-emerald-500/20 border-emerald-200"}
        />
        <StatsCard
          title="Active Assignments"
          value={loadingLms ? "..." : apiLmsAssignments.length}
          icon={BookOpen}
          description="LMS course tasks created"
          iconClass="dark:bg-indigo-500/10 bg-indigo-50 dark:text-indigo-400 text-indigo-700 border dark:border-indigo-500/20 border-indigo-200"
        />
        <StatsCard
          title="Pending Evaluations"
          value={loadingLms ? "..." : totalPendingEvaluations}
          icon={FileSpreadsheet}
          description="Submissions requiring grading"
          iconClass={totalPendingEvaluations > 0 ? "dark:bg-rose-500/10 bg-rose-50 dark:text-rose-400 text-rose-700 border dark:border-rose-500/20 border-rose-200" : "dark:bg-emerald-500/10 bg-emerald-50 dark:text-emerald-400 text-emerald-700 border dark:border-emerald-500/20 border-emerald-200"}
        />
      </div>

      {/* Main Grid Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Calendar selector & milestones */}
        <div className="space-y-6 lg:col-span-1">
          <CalendarWidget
            events={unifiedEvents}
            loading={loadingCalendar}
            role="faculty"
          />
          <UpcomingEventsWidget
            events={unifiedEvents}
            loading={loadingCalendar}
            role="faculty"
          />
        </div>

        {/* Center/Right Column: LMS workload details & Today's timetable */}
        <div className="space-y-6 lg:col-span-2">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <NotificationWidget
              notifications={apiNotifications}
              loading={loadingNotifications}
              onMarkRead={handleMarkNotificationRead}
              role="faculty"
            />
            <AssignmentWidget
              facultyData={facultyAssignmentData}
              loading={loadingLms}
              role="faculty"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Timetable from original */}
            <div className="bg-surface border border-border-subtle rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-bold text-text-primary text-base">Today&apos;s Class Timetable</h3>
                <span className="text-[10px] text-text-muted font-mono" suppressHydrationWarning>{new Date().toLocaleDateString("en-IN", { weekday: 'short', month: 'short', day: 'numeric' })}</span>
              </div>

              <div className="space-y-3">
                {timetableSlots.length > 0 ? (
                  timetableSlots.map((slot, i) => (
                    <div 
                      key={i} 
                      className={`p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 transition-all ${
                        slot.status === "Active"
                          ? "bg-blue-600/5 border-blue-500/30"
                          : "bg-background/40 border-border-subtle"
                      }`}
                    >
                      <div className="space-y-0.5">
                        <span className="text-[8px] text-text-muted font-mono block">{slot.time}</span>
                        <h4 className="text-xs font-bold text-text-primary">{slot.subjectName}</h4>
                        <span className="text-[8px] text-text-muted font-semibold">{slot.batch}</span>
                      </div>
                      
                      {slot.isLogged ? (
                        <span className="text-[10px] dark:text-emerald-400 text-emerald-700 flex items-center gap-1 font-bold">
                          <CheckCircle size={12} />
                          <span>Logged</span>
                        </span>
                      ) : (
                        <Link 
                          href="/faculty/attendance" 
                          className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold text-center transition"
                        >
                          Mark
                        </Link>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-text-muted font-mono italic">No teaching slots today.</div>
                )}
              </div>
            </div>

            {/* Checklist from original */}
            <div className="bg-surface border border-border-subtle rounded-xl p-5 space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-amber-500" />
                  <h4 className="font-display font-bold text-text-primary text-sm">Attendance Checklist</h4>
                </div>
                
                {pendingAttendanceTasks.length > 0 ? (
                  <div className="space-y-2">
                    {pendingAttendanceTasks.map((task, idx) => (
                      <div key={idx} className="p-2.5 dark:bg-rose-500/[0.02] bg-rose-50/10 border dark:border-rose-500/20 border-rose-200 rounded-lg flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <span className="font-semibold text-text-primary block truncate">{task.subjectName.split(":")[1] || task.subjectName}</span>
                          <span className="text-[8px] text-text-muted font-mono">Sec {task.section}</span>
                        </div>
                        <Link 
                          href="/faculty/attendance"
                          className="px-2 py-0.5 dark:bg-amber-500/10 bg-amber-50 dark:hover:bg-amber-500/20 hover:bg-amber-100 dark:text-amber-500 text-amber-700 border dark:border-amber-500/20 border-amber-200 rounded text-[9px] font-bold transition shrink-0"
                        >
                          Roll Call
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-2.5 dark:bg-emerald-500/5 bg-emerald-50 border dark:border-emerald-500/10 border-emerald-200 dark:text-emerald-400 text-emerald-700 text-[10px] font-semibold rounded-lg flex items-center gap-1.5">
                    <CheckCircle size={12} />
                    <span>All attendance logs completed today.</span>
                  </div>
                )}
              </div>

              <div className="space-y-3 pt-3 border-t border-border-subtle">
                <div className="flex items-center gap-2">
                  <ClipboardList size={16} className="text-amber-500" />
                  <h4 className="font-display font-bold text-text-primary text-sm">Examinations Scheduled</h4>
                </div>

                {displayExams.length > 0 ? (
                  <div className="space-y-2">
                    {displayExams.map((ex: any, idx: number) => (
                      <div key={ex.id || idx} className="p-2.5 bg-background/45 border border-border-subtle rounded-lg text-xs space-y-1">
                        <div className="flex justify-between items-start">
                          <span className="font-semibold text-text-primary block truncate max-w-[130px]">{ex.subjectName.split(":")[1] || ex.subjectName}</span>
                          <span className="text-[8px] dark:bg-blue-500/10 bg-blue-50 dark:text-blue-400 text-blue-700 border dark:border-blue-500/20 border-blue-200 px-1 rounded font-bold">{ex.examType}</span>
                        </div>
                        <div className="flex items-center justify-between text-[8px] text-text-muted font-mono">
                          <span>{ex.examDate}</span>
                          <span>{ex.startTime}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-[10px] text-text-muted font-mono italic">No exam duties scheduled.</div>
                )}
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
