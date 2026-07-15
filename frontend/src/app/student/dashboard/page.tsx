"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
  Users,
  Briefcase,
  AlertCircle,
  CheckCircle2,
  ListTodo
} from "lucide-react";

import { AcademicSubNav } from "@/components/Analytics/AcademicSubNav";
import { AttendanceRadialChart, CGPATrendChart } from "@/components/Dashboard/DashboardCharts";

// Import new UXL components
import { TodayFocus, FocusMetric } from "@/components/UXL/TodayFocus";
import { UnifiedTimeline, TimelineEvent } from "@/components/UXL/UnifiedTimeline";
import { ActionCenter, ActionItem } from "@/components/UXL/ActionCenter";
import { QuickActions, ShortcutItem } from "@/components/UXL/QuickActions";
import { SmartProgressCard } from "@/components/UXL/SmartProgressCard";

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

  // Loading states
  const [loading, setLoading] = useState(true);

  // Sync / Fetch function
  const loadDashboardData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [attRes, resRes, examRes, feeRes, calRes, notifRes, oppRes, assignRes, subRes] = await Promise.all([
        apiFetch("/attendance/summary", {}, accessToken),
        apiFetch("/results/my-results", {}, accessToken),
        apiFetch("/examinations/upcoming", {}, accessToken),
        apiFetch("/fees/my-fees", {}, accessToken),
        apiFetch("/calendar?limit=50", {}, accessToken),
        apiFetch("/notifications?limit=20", {}, accessToken),
        apiFetch("/opportunities?limit=50", {}, accessToken),
        apiFetch("/lms/assignments?limit=50", {}, accessToken),
        apiFetch("/lms/submissions?limit=100", {}, accessToken)
      ]);

      if (attRes.success && attRes.data) setApiAttendance(attRes.data);
      if (resRes.success && resRes.data?.results) setApiResults(resRes.data.results);
      if (examRes.success && examRes.data?.exams) setApiExams(examRes.data.exams);
      if (feeRes.success && feeRes.data?.fees) {
        setApiFees(feeRes.data.fees.filter((f: any) => f.paymentStatus !== "Paid"));
      }
      if (calRes.success && calRes.data?.events) setApiEvents(calRes.data.events);
      if (notifRes.success && notifRes.data?.notifications) setApiNotifications(notifRes.data.notifications);
      if (oppRes.success && oppRes.data?.opportunities) setApiOpportunities(oppRes.data.opportunities);
      if (assignRes.success && assignRes.data?.assignments) setApiAssignments(assignRes.data.assignments);
      if (subRes.success && subRes.data?.submissions) setApiSubmissions(subRes.data.submissions);
    } catch (err) {
      console.error("Failed to load UXL components dashboard data", err);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

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

  const cgpaTrend = [
    { semester: "Sem 1", cgpa: 7.8 },
    { semester: "Sem 2", cgpa: 8.1 },
    { semester: "Sem 3", cgpa: 8.0 },
    { semester: "Sem 4", cgpa: 8.4 },
    { semester: "Sem 5", cgpa: 8.5 },
    { semester: "Current", cgpa: parseFloat(computedCGPA) }
  ];

  const pendingAssignments = useMemo(() => {
    return apiAssignments.filter(a => {
      const sub = apiSubmissions.find(s => s.assignmentId === a.id);
      return !sub;
    });
  }, [apiAssignments, apiSubmissions]);

  // Today's Focus Metrics
  const focusMetrics: FocusMetric[] = useMemo(() => {
    return [
      { label: "Lectures Today", value: 3, subtext: "Next: 9:00 AM" },
      { label: "Homework Pending", value: pendingAssignments.length, subtext: `${apiAssignments.length - pendingAssignments.length} submitted`, colorClass: pendingAssignments.length > 0 ? "text-amber-500" : "" },
      { label: "Attendance Status", value: `${overallAttendancePct}%`, subtext: overallAttendancePct >= 75 ? "Compliant ✓" : "Alert ⚠", colorClass: overallAttendancePct >= 75 ? "text-emerald-500" : "text-red-500" },
      { label: "Fee Balance", value: unpaidTotalAmount > 0 ? `₹${unpaidTotalAmount.toLocaleString("en-IN")}` : "Paid", subtext: unpaidTotalAmount > 0 ? "Due" : "Cleared", colorClass: unpaidTotalAmount > 0 ? "text-red-500" : "text-emerald-500" }
    ];
  }, [pendingAssignments, overallAttendancePct, unpaidTotalAmount, apiAssignments]);

  // Timeline Events
  const timelineEvents: TimelineEvent[] = useMemo(() => {
    return [
      { id: "t1", time: "09:00 AM", title: "Database Management Systems", subtitle: "Topic: Normalization & 3NF (Notes uploaded in LMS)", category: "Class", status: "normal" },
      { id: "t2", time: "11:00 AM", title: "Operating Systems", subtitle: "Topic: Deadlocks Avoidance & Banker's Algorithm", category: "Class" },
      { id: "t3", time: "02:00 PM", title: "AI Lab Practice", subtitle: "Topic: Implementation of DFS/BFS in Python", category: "Class" },
      { id: "t4", time: "04:00 PM", title: "Assignment Deadline (DBMS)", subtitle: "LMS assignment #3 queries due", category: "Assignment", status: "urgent", actionText: "Open LMS", actionRoute: "/student/lms" },
      { id: "t5", time: "Tomorrow", title: "Workshop: Cloud Architectures", subtitle: "Conducted by Microsoft MVP guest series", category: "Event" }
    ];
  }, []);

  // Action Center Items
  const actionItems: ActionItem[] = useMemo(() => {
    const list: ActionItem[] = [];
    
    // Assignment item
    if (pendingAssignments.length > 0) {
      list.push({
        id: "a1",
        title: `Submit Assignment: ${pendingAssignments[0].title}`,
        dueDate: `Due: ${new Date(pendingAssignments[0].dueDate).toLocaleDateString()}`,
        priority: "high",
        actionText: "Submit",
        actionRoute: "/student/lms"
      });
    }

    // Fee item
    if (unpaidTotalAmount > 0) {
      list.push({
        id: "a2",
        title: "Pay Outstanding Tuition Fees",
        dueDate: "Due date approaching",
        priority: "high",
        actionText: "Pay Fees",
        actionRoute: "/student/fees"
      });
    }

    // Attendance alert
    if (overallAttendancePct < 75) {
      list.push({
        id: "a3",
        title: "Attendance is under compliant 75%",
        dueDate: "Requires immediate attention",
        priority: "high",
        actionText: "Contact Mentor",
        actionRoute: "/student/mentorship"
      });
    } else {
      list.push({
        id: "a4",
        title: "Conduct Mentor Consultation",
        dueDate: "Schedule semester review meet",
        priority: "medium",
        actionText: "Schedule",
        actionRoute: "/student/mentorship"
      });
    }

    list.push({
      id: "a5",
      title: "Review Midterm Examination Schedule",
      dueDate: "Mid semester starting next week",
      priority: "medium",
      actionText: "View Exams",
      actionRoute: "/student/examinations"
    });

    return list;
  }, [pendingAssignments, unpaidTotalAmount, overallAttendancePct]);

  // Quick Action Shortcuts
  const quickActions: ShortcutItem[] = [
    { label: "Open LMS Canvas", route: "/student/lms", icon: BookOpen, description: "Classroom materials" },
    { label: "Submit Assignment", route: "/student/lms", icon: ListTodo, description: "Upload assignment files" },
    { label: "Academic Calendar", route: "/student/calendar", icon: CalendarDays, description: "Semester schedules" },
    { label: "Transcripts & Results", route: "/student/results", icon: Award, description: "Check final GPAs" },
    { label: "Careers Opportunity", route: "/student/opportunities", icon: Briefcase, description: "Apply internships" },
    { label: "Contact Mentor", route: "/student/mentorship", icon: Users, description: "Request guidance session" }
  ];

  // Upcoming Week forecast
  const upcomingWeekForecast = useMemo(() => {
    return [
      { day: "Mon", event: "DBMS Class Quiz", details: "Unit 3 DB Normalization quiz, 10:00 AM", type: "Exam" },
      { day: "Tue", event: "Mentorship Meeting", details: "Review of Mid-Term marks with Dr. Amit Verma, 3:30 PM", type: "Mentorship" },
      { day: "Thu", event: "Microsoft Cloud Event", details: "Microsoft Azure sandbox lab session", type: "Event" },
      { day: "Fri", event: "WebTech Lab submission", details: "React Routing Lab assignment upload due, 5:00 PM", type: "Assignment" },
      { day: "Sat", event: "Azure Internship Deadline", details: "Closing date for AWS Cloud engineer post applications", type: "Opportunity" }
    ];
  }, []);

  if (!activeStudent) {
    return <div className="text-neutral-500 font-mono text-center py-10">No active student profile loaded.</div>;
  }

  return (
    <div className="space-y-4 pb-12 w-full max-w-7xl mx-auto">
      <AcademicSubNav />

      {/* Hero Banner: Today's Focus */}
      <TodayFocus 
        userName={activeStudent.name} 
        role="Student"
        topicText="Database Management Systems - Relational Normalization Form (1NF, 2NF, 3NF)"
        metrics={focusMetrics}
        subtitleText={`${activeStudent.rollNo} · ${activeStudent.program} · ${activeStudent.semester}`}
      />

      {/* Main Grid: Timeline & Action centers */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Side: Timeline (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <UnifiedTimeline events={timelineEvents} />

          {/* Upcoming Week Summary */}
          <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm space-y-4">
            <div>
              <h3 className="font-display font-bold text-sm text-text-primary uppercase tracking-wider">
                Upcoming Week Forecast
              </h3>
              <p className="text-[11px] text-text-muted mt-0.5">Next 7 days academic tracker</p>
            </div>
            <div className="space-y-3">
              {upcomingWeekForecast.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center gap-3 p-3 rounded-xl border border-border-subtle bg-background">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-xs font-black text-accent-blue bg-blue-500/5 border border-blue-500/10 w-10 h-10 rounded-xl flex items-center justify-center shrink-0">
                      {item.day}
                    </span>
                    <div className="min-w-0">
                      <h4 className="text-xs font-semibold text-text-primary line-clamp-1">{item.event}</h4>
                      <p className="text-[10px] text-text-muted mt-0.5 line-clamp-1">{item.details}</p>
                    </div>
                  </div>
                  <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded border text-text-secondary bg-surface border-border-subtle shrink-0">
                    {item.type}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Actions (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <ActionCenter items={actionItems} />
          <QuickActions shortcuts={quickActions} />
        </div>
      </div>

      {/* Learning Progress Section */}
      <div className="space-y-3">
        <h3 className="font-display font-bold text-xs text-text-primary uppercase tracking-widest px-1">
          Learning Progress Desk
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="col-span-1 md:col-span-2">
            <SmartProgressCard 
              title="Attendance Compliance"
              value={`${overallAttendancePct}%`}
              icon={Clock}
              progress={overallAttendancePct}
              trend={{ value: "↑ 2%", isPositive: true }}
              details={[
                { label: "Present lectures", value: apiAttendance?.overall?.presentCount ?? 14 },
                { label: "Absent lectures", value: apiAttendance?.overall?.absentCount ?? 2 }
              ]}
              actionText="View Attendance History"
              actionRoute="/student/attendance"
            />
          </div>

          <div className="col-span-1 md:col-span-2">
            <SmartProgressCard 
              title="Academic Standing (CGPA)"
              value={computedCGPA}
              icon={Award}
              progress={parseFloat(computedCGPA) * 10}
              trend={{ value: "Stable", isPositive: true }}
              details={[
                { label: "Semester GPA Status", value: "Distinction" },
                { label: "Credits completed", value: "18 / 22" }
              ]}
              actionText="View Official Transcripts"
              actionRoute="/student/results"
            />
          </div>

          <div className="col-span-1 md:col-span-2">
            <SmartProgressCard 
              title="LMS Assignments Tracker"
              value={`${apiAssignments.length - pendingAssignments.length} / ${apiAssignments.length}`}
              icon={BookOpen}
              progress={apiAssignments.length > 0 ? ((apiAssignments.length - pendingAssignments.length) / apiAssignments.length) * 100 : 80}
              details={[
                { label: "Pending Uploads", value: pendingAssignments.length, color: "text-amber-500" },
                { label: "Graded Submissions", value: apiSubmissions.filter(s => s.status === "Evaluated").length }
              ]}
              actionText="Open LMS Classroom"
              actionRoute="/student/lms"
            />
          </div>

          <div className="col-span-1 md:col-span-2">
            <SmartProgressCard 
              title="Semester Fee Settlements"
              value={unpaidTotalAmount > 0 ? `₹${unpaidTotalAmount.toLocaleString("en-IN")} Dues` : "All Paid"}
              icon={CreditCard}
              progress={unpaidTotalAmount === 0 ? 100 : 60}
              trend={{ value: unpaidTotalAmount > 0 ? "Pending" : "Completed", isPositive: unpaidTotalAmount === 0 }}
              details={[
                { label: "Outstanding Dues", value: `₹${unpaidTotalAmount.toLocaleString("en-IN")}` },
                { label: "Cleared invoices", value: 3 }
              ]}
              actionText="Issue Fee Receipt"
              actionRoute="/student/fees"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
