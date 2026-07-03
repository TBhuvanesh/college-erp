"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSimulation } from "@/context/SimulationContext";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import {
  CreditCard,
  CalendarDays,
  BookOpen,
  Clock,
  Award,
  BookMarked,
} from "lucide-react";

// Import Reusable Dashboard Widgets
import { AssignmentWidget, StudentAssignmentData } from "@/components/Dashboard/AssignmentWidget";
import { OpportunityWidget, OpportunityData } from "@/components/Dashboard/OpportunityWidget";
import { CalendarWidget } from "@/components/Dashboard/CalendarWidget";
import { NotificationWidget } from "@/components/Dashboard/NotificationWidget";
import { UpcomingEventsWidget } from "@/components/Dashboard/UpcomingEventsWidget";
import { UnifiedEvent } from "@/components/CalendarView";
import { AttendanceRadialChart, CGPATrendChart } from "@/components/Dashboard/DashboardCharts";

export default function StudentDashboard() {
  const { accessToken } = useAuth();
  const {
    students,
    currentStudentId
  } = useSimulation();

  // Find active student (simulation context fallback)
  const activeStudent = students.find(s => s.id === currentStudentId) || students[0];

  // API State
  const [apiAttendance, setApiAttendance] = useState<any>(null);
  const [apiResults, setApiResults] = useState<any[]>([]);
  const [apiExams, setApiExams] = useState<any[]>([]);
  const [apiFees, setApiFees] = useState<any[]>([]);
  const [apiEvents, setApiEvents] = useState<any[]>([]);
  const [apiNotifications, setApiNotifications] = useState<any[]>([]);
  const [apiOpportunities, setApiOpportunities] = useState<any[]>([]);
  const [apiAssignments, setApiAssignments] = useState<any[]>([]);
  const [apiSubmissions, setApiSubmissions] = useState<any[]>([]);
  const [apiPersonalEntries, setApiPersonalEntries] = useState<any[]>([]);
  const [apiDepartments, setApiDepartments] = useState<any[]>([]);

  // Loading states
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [loadingResults, setLoadingResults] = useState(false);
  const [loadingExams, setLoadingExams] = useState(false);
  const [loadingFees, setLoadingFees] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [loadingOpportunities, setLoadingOpportunities] = useState(false);
  const [loadingAssignments, setLoadingAssignments] = useState(false);

  // Sync / Fetch function
  const loadDashboardData = useCallback(async () => {
    if (!accessToken) return;

    // Fetch Departments (needed for calendar target scope matching)
    try {
      const depRes = await apiFetch("/departments", {}, accessToken);
      if (depRes.success && depRes.data?.departments) {
        setApiDepartments(depRes.data.departments);
      }
    } catch (err) {}

    // Fetch Attendance summary
    setLoadingAttendance(true);
    try {
      const res = await apiFetch("/attendance/summary", {}, accessToken);
      if (res.success && res.data) setApiAttendance(res.data);
    } catch (err) {} finally { setLoadingAttendance(false); }

    // Fetch Results
    setLoadingResults(true);
    try {
      const res = await apiFetch("/results/my-results", {}, accessToken);
      if (res.success && res.data?.results) setApiResults(res.data.results);
    } catch (err) {} finally { setLoadingResults(false); }

    // Fetch Upcoming Exams
    setLoadingExams(true);
    try {
      const res = await apiFetch("/examinations/upcoming", {}, accessToken);
      if (res.success && res.data?.exams) setApiExams(res.data.exams);
    } catch (err) {} finally { setLoadingExams(false); }

    // Fetch Fees
    setLoadingFees(true);
    try {
      const res = await apiFetch("/fees/my-dues", {}, accessToken);
      if (res.success && res.data?.fees) {
        setApiFees(res.data.fees);
      } else {
        const altRes = await apiFetch("/fees/my-fees", {}, accessToken);
        if (altRes.success && altRes.data?.fees) {
          setApiFees(altRes.data.fees.filter((f: any) => f.paymentStatus !== "Paid"));
        }
      }
    } catch (err) {} finally { setLoadingFees(false); }

    // Fetch Calendar events
    setLoadingEvents(true);
    try {
      const res = await apiFetch("/calendar?limit=50", {}, accessToken);
      if (res.success && res.data?.events) setApiEvents(res.data.events);
    } catch (err) {} finally { setLoadingEvents(false); }

    // Fetch Personal Calendar Entries
    try {
      const entryRes = await apiFetch("/calendar-entries?limit=100", {}, accessToken);
      if (entryRes.success && entryRes.data?.entries) setApiPersonalEntries(entryRes.data.entries);
    } catch (err) {}

    // Fetch Notifications
    setLoadingNotifications(true);
    try {
      const res = await apiFetch("/notifications?limit=20", {}, accessToken);
      if (res.success && res.data?.notifications) setApiNotifications(res.data.notifications);
    } catch (err) {} finally { setLoadingNotifications(false); }

    // Fetch Opportunities
    setLoadingOpportunities(true);
    try {
      const res = await apiFetch("/opportunities?limit=50", {}, accessToken);
      if (res.success && res.data?.opportunities) setApiOpportunities(res.data.opportunities);
    } catch (err) {} finally { setLoadingOpportunities(false); }

    // Fetch LMS Assignments & Submissions
    setLoadingAssignments(true);
    try {
      const [assignRes, subRes] = await Promise.all([
        apiFetch("/lms/assignments?limit=50", {}, accessToken),
        apiFetch("/lms/submissions?limit=100", {}, accessToken)
      ]);

      if (assignRes.success && assignRes.data?.assignments) setApiAssignments(assignRes.data.assignments);
      if (subRes.success && subRes.data?.submissions) setApiSubmissions(subRes.data.submissions);
    } catch (err) {} finally { setLoadingAssignments(false); }

  }, [accessToken]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadDashboardData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadDashboardData]);

  const handleMarkNotificationRead = async (id: string) => {
    if (!accessToken) return;
    try {
      const res = await apiFetch(`/notifications/${id}/read`, { method: "PUT" }, accessToken);
      if (res.success) {
        setApiNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
        window.dispatchEvent(new Event("notificationUpdate"));
      }
    } catch (err) {}
  };

  if (!activeStudent) {
    return <div className="text-neutral-500 font-mono text-center py-10">No active student profile loaded.</div>;
  }

  // ─── Derived Metrics ───────────────────────────────────────────────────────
  const overallAttendancePct = apiAttendance ? Math.round(apiAttendance.overall?.percentage || 0) : 0;
  const unpaidTotalAmount = apiFees.reduce((acc, curr) => acc + (curr.pendingAmount || 0), 0);

  let totalPoints = 0;
  let totalCredits = 0;
  apiResults.forEach(r => {
    const points = { "O": 10, "A+": 9, "A": 8, "B+": 7, "B": 6, "C": 5, "P": 4, "F": 0, "Ab": 0 }[r.grade as string] ?? 8.0;
    totalPoints += points * 4;
    totalCredits += 4;
  });
  const computedCGPA = totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : "8.25";

  // Mock Trend Data for Charts
  const cgpaTrend = [
    { semester: "Sem 1", cgpa: 7.8 },
    { semester: "Sem 2", cgpa: 8.1 },
    { semester: "Sem 3", cgpa: 8.0 },
    { semester: "Sem 4", cgpa: 8.4 },
    { semester: "Sem 5", cgpa: 8.5 },
    { semester: "Current", cgpa: parseFloat(computedCGPA) }
  ];

  const studentAssignmentData: StudentAssignmentData[] = apiAssignments.map((a: any) => {
    const submission = apiSubmissions.find((s: any) => s.assignmentId === a.id);
    const isSubmitted = !!submission;
    let status: "graded" | "submitted" | "pending" = "pending";
    if (isSubmitted) status = submission.status === "Evaluated" ? "graded" : "submitted";
    return {
      id: a.id, title: a.title, subjectName: a.subjectName, dueDate: a.dueDate,
      isSubmitted, grade: submission?.marks !== null && submission?.marks !== undefined ? `${submission.marks}/${a.maxMarks}` : null,
      feedback: submission?.feedback || null, submissionStatus: status
    };
  });
  const activeAssignmentsCount = studentAssignmentData.filter(a => a.submissionStatus === "pending").length;

  const studentDeptObj = apiDepartments.find(d => d.code === activeStudent?.department);
  const studentYearAudience = activeStudent?.semester ? `Year ${Math.ceil(parseInt(activeStudent.semester.replace(/\D/g, "")) / 2)}` : "All";

  const unifiedEvents: UnifiedEvent[] = [
    ...apiEvents.map((ev: any) => ({
      id: ev.id, title: ev.title, description: ev.description, startDate: ev.startDate, endDate: ev.endDate,
      eventType: ev.eventType === "Holiday" ? "Holiday" : "Academic Event", sourceModule: "academic_calendar" as const,
      sourceLabel: "Academic Desk", departmentId: ev.departmentId, departmentName: ev.departmentName, semester: ev.semester, targetAudience: ev.targetAudience, rawEvent: ev
    })),
    ...apiAssignments.map((a: any) => ({
      id: a.id, title: a.title, description: a.description || null, startDate: a.dueDate, endDate: null,
      eventType: "Assignment Deadline", sourceModule: "lms_assignment" as const, sourceLabel: "LMS Desk",
      departmentId: null, departmentName: null, semester: a.semester || null
    })),
    ...apiOpportunities.map((o: any) => ({
      id: o.id, title: o.title, description: o.description, startDate: o.startDate || o.deadline, endDate: o.deadline,
      eventType: o.type === "Placement Drive" ? "Placement Drive" : "Internship Deadline", sourceModule: "opportunity" as const,
      sourceLabel: "Opportunity Hub", departmentId: o.departmentId, departmentName: o.departmentName, semester: null
    }))
  ];

  const mappedOpportunities: OpportunityData[] = apiOpportunities.map((o: any) => ({
    id: o.id, title: o.title, description: o.description, type: o.type, departmentName: o.departmentName,
    eligibleYears: o.eligibleYears, deadline: o.deadline, organizer: o.organizer
  }));

  // CGPA grade label
  const cgpaValue = parseFloat(computedCGPA);
  const cgpaGrade = cgpaValue >= 9 ? "Excellent" : cgpaValue >= 8 ? "Distinction" : cgpaValue >= 7 ? "First Class" : "Pass";
  const cgpaBadgeClass = cgpaValue >= 9
    ? "dark:text-emerald-400 text-emerald-700 dark:bg-emerald-500/10 bg-emerald-50 dark:border-emerald-500/20 border-emerald-200"
    : cgpaValue >= 8
    ? "dark:text-blue-400 text-blue-700 dark:bg-blue-500/10 bg-blue-50 dark:border-blue-500/20 border-blue-200"
    : cgpaValue >= 7
    ? "dark:text-amber-400 text-amber-700 dark:bg-amber-500/10 bg-amber-50 dark:border-amber-500/20 border-amber-200"
    : "dark:text-red-400 text-red-700 dark:bg-red-500/10 bg-red-50 dark:border-red-500/20 border-red-200";

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 pb-12 w-full max-w-7xl mx-auto">

      {/* ── HERO: Profile Banner ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-sm">
        {/* Top accent stripe */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-violet-500 to-purple-500 opacity-80" />
        {/* Ambient gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/[0.025] via-transparent to-purple-600/[0.02] pointer-events-none" />
        <div className="absolute -top-10 right-0 w-64 h-48 bg-gradient-to-bl from-indigo-500/[0.05] to-transparent rounded-full blur-2xl pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 p-5 lg:p-6">
          {/* Identity */}
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/10 to-violet-500/15 border border-blue-500/20 flex items-center justify-center font-display font-black text-2xl text-accent-blue shadow-inner">
                {activeStudent.name.charAt(0)}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-[14px] h-[14px] rounded-full bg-success border-2 border-surface shadow-sm" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="font-display font-bold text-xl text-text-primary leading-none">
                  {activeStudent.name}
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider text-success bg-success/10 border border-success/15">
                  <span className="w-1.5 h-1.5 rounded-full bg-success" /> Enrolled
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0 mt-1.5">
                <span className="font-mono text-[11px] text-text-muted">{activeStudent.rollNo}</span>
                <span className="text-text-muted opacity-30 select-none">·</span>
                <span className="text-[11px] font-semibold text-accent-blue">{activeStudent.program}</span>
                <span className="text-text-muted opacity-30 select-none">·</span>
                <span className="text-[11px] text-text-secondary">{activeStudent.semester}</span>
                {activeStudent.department && (
                  <>
                    <span className="text-text-muted opacity-30 select-none">·</span>
                    <span className="text-[11px] text-text-muted">{activeStudent.department}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Quick action chips */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Link href="/student/results"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-accent-blue bg-accent-blue/8 border border-accent-blue/15 hover:bg-accent-blue/15 transition-colors">
              <Award size={12} /> Transcripts
            </Link>
            <Link href="/student/calendar"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-text-secondary bg-surface-elevated border border-border-subtle hover:bg-surface-hover transition-colors">
              <CalendarDays size={12} /> Schedule
            </Link>
            <Link href="/student/fees"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-text-secondary bg-surface-elevated border border-border-subtle hover:bg-surface-hover transition-colors">
              <CreditCard size={12} /> Fees
            </Link>
            <Link href="/student/lms"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-text-secondary bg-surface-elevated border border-border-subtle hover:bg-surface-hover transition-colors">
              <BookOpen size={12} /> Canvas
            </Link>
          </div>
        </div>
      </div>

      {/* ── PRIMARY METRICS ROW (asymmetric 12-col grid) ─────────────────────── */}
      <div className="grid grid-cols-12 gap-4">

        {/* ATTENDANCE — large horizontal card (5 cols) */}
        <div className="col-span-12 sm:col-span-6 lg:col-span-5">
          <div className={`h-full rounded-2xl border p-5 flex items-center gap-5 relative overflow-hidden ${
            overallAttendancePct >= 75
              ? "dark:border-emerald-500/20 border-emerald-500/30 bg-gradient-to-br dark:from-emerald-500/[0.05] from-emerald-500/[0.03] to-surface"
              : "dark:border-red-500/20 border-red-500/30 bg-gradient-to-br dark:from-red-500/[0.05] from-red-500/[0.03] to-surface"
          }`}>
            <div className="absolute top-3 right-3 opacity-[0.04] pointer-events-none">
              <Clock size={60} />
            </div>
            <div className="shrink-0">
              <AttendanceRadialChart percentage={loadingAttendance ? 0 : overallAttendancePct} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-0.5">Attendance</p>
              <div className="font-display font-black text-4xl text-text-primary leading-none">
                {loadingAttendance
                  ? <span className="text-2xl text-text-muted animate-pulse">—</span>
                  : `${overallAttendancePct}%`
                }
              </div>
              <div className={`inline-flex items-center mt-2 px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                overallAttendancePct >= 75
                  ? "dark:text-emerald-500 text-emerald-700 dark:bg-emerald-500/10 bg-emerald-50 dark:border-emerald-500/20 border-emerald-200"
                  : "dark:text-red-550 text-red-700 dark:bg-red-500/10 bg-red-50 dark:border-red-500/20 border-red-200"
              }`}>
                {overallAttendancePct >= 75 ? "✓ Compliant" : "⚠ Below 75%"}
              </div>
              {apiAttendance?.overall && (
                <p className="text-[10px] text-text-muted mt-1 font-medium">
                  {apiAttendance.overall.presentCount ?? 0}P &middot; {apiAttendance.overall.absentCount ?? 0}A
                </p>
              )}
            </div>
          </div>
        </div>

        {/* CGPA TREND — medium card with sparkline (4 cols) */}
        <div className="col-span-12 sm:col-span-6 lg:col-span-4">
          <div className="h-full rounded-2xl border border-border-subtle bg-surface p-5 relative overflow-hidden">
            <div className="absolute top-3 right-3 opacity-[0.04] pointer-events-none">
              <Award size={60} />
            </div>
            <div className="flex items-start justify-between gap-2 mb-1">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Academic CGPA</p>
                <div className="font-display font-black text-4xl text-text-primary leading-none mt-0.5">
                  {loadingResults
                    ? <span className="text-2xl text-text-muted animate-pulse">—</span>
                    : computedCGPA
                  }
                  <span className="text-sm font-normal text-text-muted ml-1">/10</span>
                </div>
              </div>
              <span className={`shrink-0 px-2 py-0.5 rounded-lg text-[10px] font-extrabold border mt-1 ${cgpaBadgeClass}`}>
                {cgpaGrade}
              </span>
            </div>
            <CGPATrendChart data={cgpaTrend} />
          </div>
        </div>

        {/* COMPACT COLUMN: Dues + Tasks stacked (3 cols) */}
        <div className="col-span-12 lg:col-span-3 grid grid-cols-2 lg:grid-cols-1 gap-3">

          {/* Pending Dues */}
          <Link href="/student/fees" className={`block rounded-2xl border p-4 transition-colors group ${
            unpaidTotalAmount > 0
              ? "dark:border-amber-500/20 border-amber-500/35 bg-gradient-to-br dark:from-amber-500/[0.05] from-amber-500/[0.03] to-surface dark:hover:from-amber-500/[0.08] hover:from-amber-500/[0.05]"
              : "border-border-subtle bg-surface hover:bg-surface-hover"
          }`}>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Dues</p>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105 ${
                unpaidTotalAmount > 0 ? "dark:bg-amber-500/10 bg-amber-50 dark:text-amber-500 text-amber-700" : "dark:bg-success/10 bg-emerald-50 dark:text-success text-emerald-700"
              }`}>
                <CreditCard size={14} strokeWidth={2} />
              </div>
            </div>
            <div className="font-display font-bold text-xl text-text-primary leading-none">
              {loadingFees ? "—" : `₹${unpaidTotalAmount.toLocaleString("en-IN")}`}
            </div>
            <p className={`text-[10px] font-semibold mt-1.5 ${unpaidTotalAmount > 0 ? "dark:text-amber-500 text-amber-700" : "dark:text-success text-success"}`}>
              {unpaidTotalAmount > 0 ? "Outstanding →" : "Fully paid ✓"}
            </p>
          </Link>

          {/* Active Tasks */}
          <Link href="/student/lms" className="block rounded-2xl border border-border-subtle bg-surface p-4 hover:bg-surface-hover transition-colors group">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Tasks</p>
              <div className="w-7 h-7 rounded-lg dark:bg-purple-500/10 bg-purple-50 dark:text-purple-500 text-purple-700 flex items-center justify-center transition-transform group-hover:scale-105">
                <BookMarked size={14} strokeWidth={2} />
              </div>
            </div>
            <div className="font-display font-bold text-xl text-text-primary leading-none">
              {loadingAssignments ? "—" : activeAssignmentsCount}
            </div>
            <p className={`text-[10px] font-semibold mt-1.5 ${activeAssignmentsCount === 0 ? "text-success" : "text-text-muted"}`}>
              {activeAssignmentsCount === 0 ? "All done ✓" : "Pending"}
            </p>
          </Link>
        </div>
      </div>

      {/* ── MAIN CONTENT GRID (8/4 split) ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* Left panel (8 cols): vertically stacked sections */}
        <div className="lg:col-span-8 space-y-4">
          <UpcomingEventsWidget
            events={unifiedEvents}
            loading={loadingEvents}
            role="student"
          />
          <AssignmentWidget
            studentData={studentAssignmentData}
            loading={loadingAssignments}
            role="student"
          />
          <NotificationWidget
            notifications={apiNotifications}
            loading={loadingNotifications}
            onMarkRead={handleMarkNotificationRead}
            role="student"
          />
        </div>

        {/* Right panel (4 cols): calendar + opportunities */}
        <div className="lg:col-span-4 space-y-4">
          <CalendarWidget
            events={unifiedEvents}
            loading={loadingEvents}
            role="student"
          />
          <OpportunityWidget
            opportunities={mappedOpportunities}
            loading={loadingOpportunities}
            role="student"
          />
        </div>
      </div>

    </div>
  );
}
