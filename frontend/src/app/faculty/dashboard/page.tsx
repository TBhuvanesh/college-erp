"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { 
  Calendar, 
  AlertCircle, 
  ArrowRight, 
  CheckCircle, 
  Clock, 
  Users, 
  BookOpen, 
  Loader2,
  CalendarDays,
  Bell,
  ClipboardList,
  PlusCircle,
  FileSpreadsheet,
  Award,
  TrendingUp,
  Sliders,
  FolderOpen
} from "lucide-react";

import { TodayTaskCenter } from "@/components/Dashboard/TodayTaskCenter";
import { TeachingProgressCard, SubjectProgress } from "@/components/Dashboard/TeachingProgressCard";
import { WeeklyWorkloadChart, AssignmentReviewChart, LessonCompletionDoughnut } from "@/components/Dashboard/WorkloadCharts";

// Import UXL components
import { TodayFocus, FocusMetric } from "@/components/UXL/TodayFocus";
import { UnifiedTimeline, TimelineEvent } from "@/components/UXL/UnifiedTimeline";
import { ActionCenter, ActionItem } from "@/components/UXL/ActionCenter";
import { QuickActions, ShortcutItem } from "@/components/UXL/QuickActions";
import { SmartProgressCard } from "@/components/UXL/SmartProgressCard";

export default function FacultyDashboard() {
  const { user, accessToken } = useAuth();
  const authFaculty = user?.facultyProfile;

  // API Integration States
  const [workload, setWorkload] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [lmsAssignments, setLmsAssignments] = useState<any[]>([]);
  const [lmsSubmissions, setLmsSubmissions] = useState<any[]>([]);
  const [mentorStudents, setMentorStudents] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const [workRes, examRes, calRes, notifRes, lmsRes, subRes, mentorRes] = await Promise.all([
        apiFetch("/attendance/my-assignments", {}, accessToken),
        apiFetch("/examinations/my-schedule", {}, accessToken),
        apiFetch("/calendar?limit=50", {}, accessToken),
        apiFetch("/notifications?limit=20", {}, accessToken),
        apiFetch("/lms/assignments?limit=50", {}, accessToken),
        apiFetch("/lms/submissions?limit=100", {}, accessToken),
        apiFetch("/mentorship/my-mentees", {}, accessToken).catch(() => ({ success: true, data: [] }))
      ]);

      if (workRes.success && workRes.data?.assignments) setWorkload(workRes.data.assignments.filter((a: any) => a.isActive));
      if (examRes.success && examRes.data?.exams) setExams(examRes.data.exams);
      if (calRes.success && calRes.data?.events) setEvents(calRes.data.events);
      if (notifRes.success && notifRes.data?.notifications) setNotifications(notifRes.data.notifications);
      if (lmsRes.success && lmsRes.data?.assignments) setLmsAssignments(lmsRes.data.assignments);
      if (subRes.success && subRes.data?.submissions) setLmsSubmissions(subRes.data.submissions);
      if (mentorRes.success && mentorRes.data) setMentorStudents(mentorRes.data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to compile operations workspace.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived Metrics
  const weeklyClasses = workload.length * 4; // Assume 4 lectures per week per subject
  const teachingHours = workload.length * 3; // Assume 3 contact hours per subject
  const pendingEvaluations = lmsSubmissions.filter((s: any) => s.status === "Pending" || s.status === "Submitted").length;
  const completedEvaluations = lmsSubmissions.filter((s: any) => s.status === "Evaluated").length;
  
  const workloadStatus = useMemo(() => {
    const score = weeklyClasses + (pendingEvaluations * 0.2);
    if (score >= 18) return { label: "Overloaded", color: "text-red-500", icon: "🔴" };
    if (score >= 12) return { label: "Heavy", color: "text-orange-600", icon: "🟠" };
    if (score >= 7) return { label: "Balanced", color: "text-amber-700", icon: "🟡" };
    return { label: "Light", color: "text-emerald-600", icon: "🟢" };
  }, [weeklyClasses, pendingEvaluations]);

  const subjectProgressList: SubjectProgress[] = useMemo(() => {
    if (workload.length === 0) {
      return [
        { id: "1", name: "Database Management Systems", code: "CS-302", completedLessons: 18, totalLessons: 25, percentage: 72 },
        { id: "2", name: "Web Technologies Lab", code: "CS-308", completedLessons: 8, totalLessons: 15, percentage: 53 },
        { id: "3", name: "Software Engineering", code: "CS-304", completedLessons: 20, totalLessons: 24, percentage: 83 }
      ];
    }
    return workload.map((sub: any) => {
      const total = 24;
      const completed = Math.min(Math.round(total * (sub.completedProgress || 0.65)), total);
      return {
        id: sub.subjectId,
        name: sub.subjectName,
        code: sub.subjectCode,
        completedLessons: completed,
        totalLessons: total,
        percentage: Math.round((completed / total) * 100)
      };
    });
  }, [workload]);

  const todayClasses = useMemo(() => {
    return workload.map((sub: any, idx: number) => {
      const times = ["9:30 AM", "11:30 AM", "2:00 PM", "4:00 PM"];
      return {
        id: sub.subjectId,
        subjectName: sub.subjectName,
        subjectCode: sub.subjectCode,
        time: times[idx % times.length],
        room: `Block B, Room ${300 + idx * 5}`
      };
    }).slice(0, 3);
  }, [workload]);

  // Today's Focus Metrics
  const focusMetrics: FocusMetric[] = useMemo(() => {
    return [
      { label: "Today's Lectures", value: todayClasses.length, subtext: "Next: 9:30 AM" },
      { label: "Grading Pending", value: pendingEvaluations, subtext: `${completedEvaluations} Evaluated`, colorClass: pendingEvaluations > 0 ? "text-amber-500" : "" },
      { label: "Weekly Classes", value: weeklyClasses || 12, subtext: `${teachingHours} teaching hrs` },
      { label: "Mentees List", value: mentorStudents.length || 15, subtext: "Group 4 meeting today" }
    ];
  }, [todayClasses, pendingEvaluations, completedEvaluations, weeklyClasses, teachingHours, mentorStudents]);

  // Chronological Faculty Timeline
  const timelineEvents: TimelineEvent[] = useMemo(() => {
    const list: TimelineEvent[] = [];
    
    todayClasses.forEach((cls: any, idx: number) => {
      list.push({
        id: `c-${idx}`,
        time: cls.time,
        title: `Deliver Lecture: ${cls.subjectName} (${cls.subjectCode})`,
        subtitle: `Room: ${cls.room}. Remember to mark attendance in portal.`,
        category: "Class"
      });
      list.push({
        id: `att-${idx}`,
        time: cls.time,
        title: `Attendance Registry: ${cls.subjectCode}`,
        subtitle: `Mark pending attendance lists.`,
        category: "Attendance",
        status: "pending"
      });
    });

    list.push({
      id: "t-upload",
      time: "01:00 PM",
      title: "Upload DBMS Lesson Notes",
      subtitle: "Upload Unit-III SQL Transactions notes to LMS.",
      category: "LMS"
    });

    list.push({
      id: "t-mentorship",
      time: "03:30 PM",
      title: "Mentorship Session",
      subtitle: "Remedial advice for CSE-A academic risk students.",
      category: "Mentorship"
    });

    if (pendingEvaluations > 0) {
      list.push({
        id: "t-eval",
        time: "05:00 PM",
        title: "Review LMS Submissions",
        subtitle: `Grade ${pendingEvaluations} pending uploads.`,
        category: "Assignment",
        status: "urgent"
      });
    }

    return list.sort((a, b) => a.time.localeCompare(b.time));
  }, [todayClasses, pendingEvaluations]);

  // Action Center Items
  const actionItems: ActionItem[] = useMemo(() => {
    const list: ActionItem[] = [];

    if (pendingEvaluations > 0) {
      list.push({
        id: "fa1",
        title: `Evaluate LMS Submissions (${pendingEvaluations} items)`,
        dueDate: "Due today by 5:00 PM",
        priority: "high",
        actionText: "Evaluate",
        actionRoute: "/faculty/lms"
      });
    }

    list.push({
      id: "fa2",
      title: "Verify Class Attendance Registry Completion",
      dueDate: "Daily attendance logs upload",
      priority: "high",
      actionText: "Mark Attendance",
      actionRoute: "/faculty/attendance"
    });

    list.push({
      id: "fa3",
      title: "Submit Unit-I Internal Assessment Grades",
      dueDate: "Registrar deadline tomorrow",
      priority: "medium",
      actionText: "Upload Grades",
      actionRoute: "/faculty/grades"
    });

    list.push({
      id: "fa4",
      title: "Prepare Lesson Planners for next Unit",
      dueDate: "Course scheme sync",
      priority: "low",
      actionText: "Planner",
      actionRoute: "/faculty/teaching-planner"
    });

    return list;
  }, [pendingEvaluations]);

  // Quick Action Shortcuts
  const quickActions: ShortcutItem[] = [
    { label: "Take Attendance", route: "/faculty/attendance", icon: CalendarDays },
    { label: "Internal Marks", route: "/faculty/grades", icon: FileSpreadsheet },
    { label: "LMS Canvas", route: "/faculty/lms", icon: BookOpen },
    { label: "Opportunity Hub", route: "/faculty/opportunities", icon: Sliders },
    { label: "Mentorship Desk", route: "/faculty/mentorship", icon: Users },
    { label: "Teaching Planner", route: "/faculty/teaching-planner", icon: ClipboardList }
  ];

  if (loading) {
    return (
      <div className="flex h-[350px] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 text-center max-w-lg mx-auto mt-10">
        <AlertCircle className="mx-auto h-8 w-8 text-red-500 mb-2" />
        <h3 className="font-display font-bold text-red-500 text-sm">Failed to Sync Workspace</h3>
        <p className="text-xs text-text-secondary mt-1">{error}</p>
        <button 
          onClick={loadData}
          className="mt-4 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-semibold rounded-xl transition-all"
        >
          Retry Load
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-12 w-full max-w-7xl mx-auto">
      {/* Today's Focus Banner */}
      <TodayFocus 
        userName={authFaculty?.fullName || "Faculty"} 
        role="Faculty"
        metrics={focusMetrics}
        subtitleText={`${authFaculty?.employeeNumber} · ${authFaculty?.designation} · ${authFaculty?.departmentName}`}
      />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Span (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TodayTaskCenter />
            <TeachingProgressCard progressList={subjectProgressList} />
          </div>

          <UnifiedTimeline events={timelineEvents} />

          {/* Workload charts */}
          <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm space-y-4">
            <div>
              <h3 className="font-display font-bold text-sm text-text-primary uppercase tracking-wider">
                Weekly Class Load Details
              </h3>
              <p className="text-xs text-text-muted mt-0.5">Hours taught daily</p>
            </div>
            <WeeklyWorkloadChart />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm space-y-4">
              <h3 className="font-display font-bold text-sm text-text-primary uppercase tracking-wider">
                LMS Grading Load
              </h3>
              <AssignmentReviewChart />
            </div>

            <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm space-y-4">
              <h3 className="font-display font-bold text-sm text-text-primary uppercase tracking-wider">
                Syllabus Planners Summary
              </h3>
              <LessonCompletionDoughnut />
            </div>
          </div>
        </div>

        {/* Right Span (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <ActionCenter items={actionItems} />
          <QuickActions shortcuts={quickActions} />

          {/* Alert Notifications Summary */}
          <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-display font-bold text-sm text-text-primary uppercase tracking-wider">
                Academic Alerts
              </h3>
              {notifications.filter(n => !n.isRead).length > 0 && (
                <span className="text-[9px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20 animate-pulse">
                  {notifications.filter(n => !n.isRead).length} New
                </span>
              )}
            </div>
            <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
              {notifications.slice(0, 4).map((n: any) => (
                <div key={n.id} className="text-xs border-b border-border-subtle last:border-b-0 pb-2.5 last:pb-0">
                  <div className="flex justify-between text-[10px] text-text-muted">
                    <span className="font-semibold text-accent-blue">{n.category || "General"}</span>
                    <span>{new Date(n.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-text-secondary mt-1 font-medium leading-normal">{n.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Overview Smart Cards */}
      <div className="space-y-3">
        <h3 className="font-display font-bold text-xs text-text-primary uppercase tracking-widest px-1">
          Workload Allocation & Progress
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="col-span-1 md:col-span-2">
            <SmartProgressCard 
              title="Teaching Workload Level"
              value={workloadStatus.label}
              icon={Clock}
              progress={weeklyClasses > 0 ? (weeklyClasses / 20) * 100 : 50}
              trend={{ value: "Stable", isPositive: true }}
              details={[
                { label: "Weekly classes", value: weeklyClasses },
                { label: "Weekly hours", value: teachingHours }
              ]}
              actionText="Open Schedule"
              actionRoute="/faculty/calendar"
            />
          </div>

          <div className="col-span-1 md:col-span-2">
            <SmartProgressCard 
              title="Mentorship Assignments"
              value={`${mentorStudents.length || 15} Students`}
              icon={Users}
              progress={80}
              trend={{ value: "4 risk alerts", isPositive: false }}
              details={[
                { label: "Assigned group size", value: mentorStudents.length || 15 },
                { label: "Mentorship reviews", value: "3 pending" }
              ]}
              actionText="Manage Mentee Roster"
              actionRoute="/faculty/mentorship"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
