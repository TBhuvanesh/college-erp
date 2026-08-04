"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
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
  const { accessToken, user } = useAuth();

  // Find active student profile
  const activeStudent = user?.studentProfile;

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
  const [todaySchedule, setTodaySchedule] = useState<any[]>([]);
  const [nextClassSubtext, setNextClassSubtext] = useState("None Scheduled");

  // Loading states
  const [loading, setLoading] = useState(true);

  // Sync / Fetch function
  const loadDashboardData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [attRes, resRes, examRes, feeRes, calRes, notifRes, oppRes, assignRes, subRes, dashRes] = await Promise.all([
        apiFetch("/attendance/summary", {}, accessToken),
        apiFetch("/results/my-results", {}, accessToken),
        apiFetch("/examinations/upcoming", {}, accessToken),
        apiFetch("/fees/my-fees", {}, accessToken),
        apiFetch("/calendar?limit=50", {}, accessToken),
        apiFetch("/notifications?limit=20", {}, accessToken),
        apiFetch("/opportunities?limit=50", {}, accessToken),
        apiFetch("/lms/assignments?limit=50", {}, accessToken),
        apiFetch("/lms/submissions?limit=100", {}, accessToken),
        apiFetch("/dashboard/student", {}, accessToken).catch(() => null)
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

      if (dashRes && dashRes.success && dashRes.data?.todaySchedule) {
        const schedule = dashRes.data.todaySchedule;
        setTodaySchedule(schedule);
        const now = new Date();
        const nowTimeStr = now.toTimeString().slice(0, 8);
        const upcoming = schedule.find((c: any) => c.startTime && c.startTime > nowTimeStr);
        if (upcoming) {
          setNextClassSubtext(`Next: ${upcoming.startTime.slice(0, 5)}`);
        } else if (schedule.length > 0) {
          setNextClassSubtext("Completed");
        } else {
          setNextClassSubtext("None Scheduled");
        }
      }
    } catch (err) {
      console.error("Failed to load UXL components dashboard data", err);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    window.addEventListener('realtimeDashboardUpdate', loadDashboardData);
    return () => {
      window.removeEventListener('realtimeDashboardUpdate', loadDashboardData);
    };
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
      { label: "Lectures Today", value: todaySchedule.length, subtext: nextClassSubtext },
      { label: "Homework Pending", value: pendingAssignments.length, subtext: `${apiAssignments.length - pendingAssignments.length} submitted`, colorClass: pendingAssignments.length > 0 ? "text-amber-500" : "" },
      { label: "Attendance Status", value: `${overallAttendancePct}%`, subtext: overallAttendancePct >= 75 ? "Compliant ✓" : "Alert ⚠", colorClass: overallAttendancePct >= 75 ? "text-emerald-500" : "text-red-500" },
      { label: "Fee Balance", value: unpaidTotalAmount > 0 ? `₹${unpaidTotalAmount.toLocaleString("en-IN")}` : "Paid", subtext: unpaidTotalAmount > 0 ? "Due" : "Cleared", colorClass: unpaidTotalAmount > 0 ? "text-red-500" : "text-emerald-500" }
    ];
  }, [todaySchedule, nextClassSubtext, pendingAssignments, overallAttendancePct, unpaidTotalAmount, apiAssignments]);

  // Timeline Events
  const timelineEvents: TimelineEvent[] = useMemo(() => {
    const list: TimelineEvent[] = todaySchedule.map((cls, idx) => ({
      id: `class-${idx}`,
      time: cls.time,
      title: `${cls.subjectName} (${cls.subjectAbbreviation || cls.subjectCode})`,
      subtitle: `Room: ${cls.room || "N/A"} | Class: ${cls.classType} | Faculty: ${cls.faculties}`,
      category: "Class",
      status: "normal"
    }));

    if (list.length === 0) {
      list.push({
        id: "no-classes",
        time: "Today",
        title: "No Lectures Scheduled",
        subtitle: "Enjoy your free day or work on pending assignments.",
        category: "Event"
      });
    }

    pendingAssignments.slice(0, 2).forEach((a, idx) => {
      list.push({
        id: `deadline-${idx}`,
        time: "Due: " + new Date(a.dueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        title: `Assignment: ${a.title}`,
        subtitle: `Course: ${a.subjectName} (Requires submission)`,
        category: "Assignment",
        status: "urgent",
        actionText: "Open LMS",
        actionRoute: "/student/lms"
      });
    });

    return list;
  }, [todaySchedule, pendingAssignments]);

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
    const list: { day: string; event: string; details: string; type: string; dateVal: Date }[] = [];
    const now = new Date();
    const oneWeekLater = new Date();
    oneWeekLater.setDate(now.getDate() + 7);

    const getDayStr = (d: Date) => {
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      return days[d.getDay()];
    };

    // Add assignments
    apiAssignments.forEach((a: any) => {
      if (a.dueDate) {
        const d = new Date(a.dueDate);
        if (d >= now && d <= oneWeekLater) {
          list.push({
            day: getDayStr(d),
            event: a.title,
            details: `Due at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            type: "Assignment",
            dateVal: d
          });
        }
      }
    });

    // Add exams
    apiExams.forEach((e: any) => {
      if (e.examDate) {
        const d = new Date(e.examDate + (e.startTime ? 'T' + e.startTime : ''));
        if (d >= now && d <= oneWeekLater) {
          list.push({
            day: getDayStr(d),
            event: `${e.subjectCode} - ${e.examType}`,
            details: `${e.venue || 'Exam venue'} at ${e.startTime || ''}`,
            type: "Exam",
            dateVal: d
          });
        }
      }
    });

    // Add calendar events
    apiEvents.forEach((ev: any) => {
      if (ev.startDate) {
        const d = new Date(ev.startDate);
        if (d >= now && d <= oneWeekLater) {
          list.push({
            day: getDayStr(d),
            event: ev.title,
            details: ev.description || ev.category || "Institutional Event",
            type: "Event",
            dateVal: d
          });
        }
      }
    });

    // Add opportunities
    apiOpportunities.forEach((opp: any) => {
      if (opp.deadline) {
        const d = new Date(opp.deadline);
        if (d >= now && d <= oneWeekLater) {
          list.push({
            day: getDayStr(d),
            event: `${opp.title} Deadline`,
            details: opp.organizer || "Opportunity application closing",
            type: "Opportunity",
            dateVal: d
          });
        }
      }
    });

    // Sort by dateVal ascending
    list.sort((a, b) => a.dateVal.getTime() - b.dateVal.getTime());

    // Fallback if list is empty
    if (list.length === 0) {
      return [
        { day: "Mon", event: "No academic milestones scheduled", details: "Check calendar for monthly view", type: "Event" }
      ];
    }

    return list.slice(0, 5).map(item => ({
      day: item.day,
      event: item.event,
      details: item.details,
      type: item.type
    }));
  }, [apiAssignments, apiExams, apiEvents, apiOpportunities]);

  const focusTopic = useMemo(() => {
    if (todaySchedule && todaySchedule.length > 0) {
      const activeClass = todaySchedule.find(c => {
        const now = new Date();
        const nowTimeStr = now.toTimeString().slice(0, 8);
        return c.startTime && c.startTime > nowTimeStr;
      }) || todaySchedule[0];
      return `${activeClass.subjectCode}: ${activeClass.subjectName} (${activeClass.classType || 'Lecture'})`;
    }
    if (apiAssignments && apiAssignments.length > 0) {
      return `Next Task: ${apiAssignments[0].title}`;
    }
    return `Welcome back! Scoping: ${activeStudent?.departmentCode || 'B.Tech'} Academic Desk`;
  }, [todaySchedule, apiAssignments, activeStudent]);

  if (!activeStudent) {
    return <div className="text-neutral-500 font-mono text-center py-10">No active student profile loaded.</div>;
  }

  return (
    <div className="space-y-4 pb-12 w-full max-w-7xl mx-auto">
      <AcademicSubNav />

      {/* Hero Banner: Today's Focus */}
      <TodayFocus 
        userName={activeStudent.fullName} 
        role="Student"
        topicText={focusTopic}
        metrics={focusMetrics}
        subtitleText={`${activeStudent.rollNumber || ""} · B.Tech ${activeStudent.departmentCode || ""} · Semester ${activeStudent.semester || ""}`}
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
