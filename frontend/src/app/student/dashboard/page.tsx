"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSimulation } from "@/context/SimulationContext";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import {
  CreditCard,
  CalendarDays,
  BookOpen,
  ShieldCheck,
  Clock,
  Award,
  BookMarked,
  Briefcase
} from "lucide-react";

// Import Reusable Dashboard Widgets
import { StatsCard } from "@/components/Dashboard/StatsCard";
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

  // Derived Metrics
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
  const studentYearAudience = activeStudent?.semester ? `Year ${Math.ceil(parseInt(activeStudent.semester.replace(/\D/g, "")) / 2)}` : "All"; // Rough approximation

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

  return (
    <div className="space-y-6 pb-12 w-full max-w-7xl mx-auto">
      
      {/* Dynamic Profile Section */}
      <div className="bg-[#0A0A0A]/95 border border-neutral-800/60 rounded-[20px] p-6 lg:p-8 shadow-xl shadow-black/40 backdrop-blur-xl relative overflow-hidden flex flex-col md:flex-row gap-8 items-start md:items-center justify-between">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 opacity-80" />
        
        <div className="flex items-center gap-6 z-10">
          <div className="relative">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-neutral-800 to-neutral-900 border-2 border-neutral-700/50 flex items-center justify-center font-display font-bold text-3xl text-neutral-400 shadow-inner">
              {activeStudent.name.charAt(0)}
            </div>
            <div className="absolute -bottom-1 -right-1 bg-emerald-500 p-1.5 rounded-full border-2 border-[#0A0A0A]">
              <ShieldCheck size={12} className="text-white" />
            </div>
          </div>
          
          <div>
            <h1 className="font-display font-bold text-2xl md:text-3xl text-white tracking-tight">{activeStudent.name}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-xs font-mono font-medium text-neutral-400">{activeStudent.rollNo}</span>
              <span className="w-1 h-1 rounded-full bg-neutral-700" />
              <span className="text-xs font-semibold text-blue-400">{activeStudent.program}</span>
              <span className="w-1 h-1 rounded-full bg-neutral-700" />
              <span className="text-xs font-medium text-neutral-400">{activeStudent.semester}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto z-10 flex-wrap">
          {/* Floating Action Chips */}
          <Link href="/student/results" className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 transition-all font-semibold text-xs shadow-sm cursor-pointer">
            <Award size={14} /> Transcripts
          </Link>
          <Link href="/student/calendar" className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-neutral-800/60 border border-neutral-700/50 text-neutral-300 hover:bg-neutral-800 transition-all font-semibold text-xs shadow-sm cursor-pointer">
            <CalendarDays size={14} /> Schedule
          </Link>
          <Link href="/student/fees" className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-neutral-800/60 border border-neutral-700/50 text-neutral-300 hover:bg-neutral-800 transition-all font-semibold text-xs shadow-sm cursor-pointer">
            <CreditCard size={14} /> Payments
          </Link>
        </div>
        
        {/* Decorative Grid */}
        <div className="absolute top-0 right-0 w-1/2 h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-900/10 via-transparent to-transparent opacity-60 pointer-events-none" />
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatsCard
          title="Attendance"
          value={loadingAttendance ? "..." : `${overallAttendancePct}%`}
          icon={Clock}
          iconClass={overallAttendancePct >= 75 ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"}
          bgClass="bg-[#0A0A0A]/95 border-neutral-800/60 shadow-lg"
        >
          <div className="flex justify-center -mt-2">
            <AttendanceRadialChart percentage={overallAttendancePct} />
          </div>
        </StatsCard>
        
        <StatsCard
          title="CGPA Trend"
          value={loadingResults ? "..." : computedCGPA}
          icon={Award}
          iconClass="bg-blue-500/10 text-blue-500"
          bgClass="bg-[#0A0A0A]/95 border-neutral-800/60 shadow-lg"
        >
          <CGPATrendChart data={cgpaTrend} />
        </StatsCard>
        
        <StatsCard
          title="Pending Dues"
          value={loadingFees ? "..." : `₹${unpaidTotalAmount.toLocaleString('en-IN')}`}
          icon={CreditCard}
          description={unpaidTotalAmount > 0 ? "Semester outstanding balance" : "Fully paid"}
          iconClass={unpaidTotalAmount > 0 ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500"}
          bgClass="bg-[#0A0A0A]/95 border-neutral-800/60 shadow-lg"
        />
        
        <StatsCard
          title="Canvas Tasks"
          value={loadingAssignments ? "..." : activeAssignmentsCount}
          icon={BookMarked}
          description="Assignments awaiting submission"
          iconClass="bg-purple-500/10 text-purple-500"
          bgClass="bg-[#0A0A0A]/95 border-neutral-800/60 shadow-lg"
        />
      </div>

      {/* Dashboard Main Grid Structure */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (Wider): Timeline & Tasks */}
        <div className="lg:col-span-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AssignmentWidget
              studentData={studentAssignmentData}
              loading={loadingAssignments}
              role="student"
            />
            <UpcomingEventsWidget
              events={unifiedEvents}
              loading={loadingEvents}
              role="student"
            />
          </div>
          
          <NotificationWidget
            notifications={apiNotifications}
            loading={loadingNotifications}
            onMarkRead={handleMarkNotificationRead}
            role="student"
          />
        </div>

        {/* Right Column (Narrower): Calendar & Opportunities */}
        <div className="lg:col-span-4 space-y-6">
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
