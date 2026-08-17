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
import { MyTeachingAssignmentsCard } from "@/components/Dashboard/MyTeachingAssignmentsCard";
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
  const [todaySchedule, setTodaySchedule] = useState<any[]>([]);
  const [nextLectureSubtext, setNextLectureSubtext] = useState("None Scheduled");
  const [facultySchedule, setFacultySchedule] = useState<any>(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const [workRes, examRes, calRes, notifRes, lmsRes, subRes, mentorRes, dashRes, timetableRes] = await Promise.all([
        apiFetch("/teaching-assignments/my", {}, accessToken),
        apiFetch("/examinations/my-schedule", {}, accessToken),
        apiFetch("/calendar?limit=50", {}, accessToken),
        apiFetch("/notifications?limit=20", {}, accessToken),
        apiFetch("/lms/assignments?limit=50", {}, accessToken),
        apiFetch("/lms/submissions?limit=100", {}, accessToken),
        apiFetch("/mentorship/my-mentees", {}, accessToken).catch(() => ({ success: true, data: [] })),
        apiFetch("/dashboard/faculty", {}, accessToken).catch(() => null),
        apiFetch("/timetables/faculty/schedule", {}, accessToken).catch(() => null)
      ]);

      if (workRes.success && workRes.data?.teachingAssignments) setWorkload(workRes.data.teachingAssignments);
      if (examRes.success && examRes.data?.exams) setExams(examRes.data.exams);
      if (calRes.success && calRes.data?.events) setEvents(calRes.data.events);
      if (notifRes.success && notifRes.data?.notifications) setNotifications(notifRes.data.notifications);
      if (lmsRes.success && lmsRes.data?.assignments) setLmsAssignments(lmsRes.data.assignments);
      if (subRes.success && subRes.data?.submissions) setLmsSubmissions(subRes.data.submissions);
      if (mentorRes.success && mentorRes.data) setMentorStudents(mentorRes.data);
      if (timetableRes && timetableRes.success && timetableRes.data) setFacultySchedule(timetableRes.data);

      if (dashRes && dashRes.success && dashRes.data?.todaySchedule) {
        const schedule = dashRes.data.todaySchedule;
        setTodaySchedule(schedule);
        const now = new Date();
        const nowTimeStr = now.toTimeString().slice(0, 8);
        const upcoming = schedule.find((c: any) => c.startTime && c.startTime > nowTimeStr);
        if (upcoming) {
          setNextLectureSubtext(`Next: ${upcoming.startTime.slice(0, 5)}`);
        } else if (schedule.length > 0) {
          setNextLectureSubtext("Completed");
        } else {
          setNextLectureSubtext("None Scheduled");
        }
      }
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

  useEffect(() => {
    window.addEventListener('realtimeDashboardUpdate', loadData);
    return () => {
      window.removeEventListener('realtimeDashboardUpdate', loadData);
    };
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
      return [];
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

  // 1. Weekly Workload from timetable schedule
  const weeklyData = useMemo(() => {
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const dayAbbreviations: Record<string, string> = {
      Monday: "Mon",
      Tuesday: "Tue",
      Wednesday: "Wed",
      Thursday: "Thu",
      Friday: "Fri",
      Saturday: "Sat",
      Sunday: "Sun"
    };

    if (!facultySchedule || !facultySchedule.schedule) {
      return days.map(day => ({ name: dayAbbreviations[day], Hours: 0 }));
    }

    return days.map(day => {
      const entries = facultySchedule.schedule[day] || [];
      let totalMinutes = 0;
      entries.forEach((entry: any) => {
        if (entry.slots && entry.slots.length > 0) {
          entry.slots.forEach((slot: any) => {
            const startParts = slot.startTime.split(":").map(Number);
            const endParts = slot.endTime.split(":").map(Number);
            const startMin = startParts[0] * 60 + startParts[1];
            const endMin = endParts[0] * 60 + endParts[1];
            if (endMin > startMin) {
              totalMinutes += (endMin - startMin);
            }
          });
        }
      });
      const hours = Math.round((totalMinutes / 60) * 10) / 10;
      return {
        name: dayAbbreviations[day],
        Hours: hours
      };
    });
  }, [facultySchedule]);

  // 2. LMS Grading Load from lmsSubmissions
  const assignmentData = useMemo(() => {
    if (!lmsSubmissions || lmsSubmissions.length === 0) {
      return [];
    }

    const countsMap = new Map<string, { Reviewed: number; Pending: number }>();
    lmsSubmissions.forEach((sub: any) => {
      const title = sub.assignmentTitle || "Unknown Assignment";
      if (!countsMap.has(title)) {
        countsMap.set(title, { Reviewed: 0, Pending: 0 });
      }
      const counts = countsMap.get(title)!;
      if (sub.status === "Evaluated") {
        counts.Reviewed += 1;
      } else {
        counts.Pending += 1;
      }
    });

    return Array.from(countsMap.entries()).map(([name, counts]) => ({
      name: name.length > 15 ? name.slice(0, 15) + "..." : name,
      Reviewed: counts.Reviewed,
      Pending: counts.Pending
    })).slice(0, 6);
  }, [lmsSubmissions]);

  // 3. Syllabus planners completion data
  const completionData = useMemo(() => {
    if (subjectProgressList.length === 0) {
      return [
        { name: "Completed", value: 0 },
        { name: "Remaining", value: 100 }
      ];
    }

    let totalCompleted = 0;
    let totalLessons = 0;
    subjectProgressList.forEach((sub) => {
      totalCompleted += sub.completedLessons;
      totalLessons += sub.totalLessons;
    });

    const totalRemaining = Math.max(0, totalLessons - totalCompleted);

    return [
      { name: "Completed", value: totalCompleted },
      { name: "Remaining", value: totalRemaining }
    ];
  }, [subjectProgressList]);

  // Today's Focus Metrics
  const focusMetrics: FocusMetric[] = useMemo(() => {
    return [
      { label: "Today's Lectures", value: todaySchedule.length, subtext: nextLectureSubtext },
      { label: "Grading Pending", value: pendingEvaluations, subtext: `${completedEvaluations} Evaluated`, colorClass: pendingEvaluations > 0 ? "text-amber-500" : "" },
      { label: "Weekly Classes", value: weeklyClasses, subtext: `${teachingHours} teaching hrs` },
      { label: "Mentees List", value: mentorStudents.length, subtext: "Group meeting" }
    ];
  }, [todaySchedule, nextLectureSubtext, pendingEvaluations, completedEvaluations, weeklyClasses, teachingHours, mentorStudents]);

  // Chronological Faculty Timeline
  const timelineEvents: TimelineEvent[] = useMemo(() => {
    const list: TimelineEvent[] = [];
    
    todaySchedule.forEach((cls: any, idx: number) => {
      list.push({
        id: `c-${idx}`,
        time: cls.time,
        title: `Deliver Lecture: ${cls.subjectName} (${cls.subjectAbbreviation || cls.subjectCode})`,
        subtitle: `Room: ${cls.room || "N/A"} | Section: ${cls.sectionDetails}. Mark attendance in portal.`,
        category: "Class"
      });
      list.push({
        id: `att-${idx}`,
        time: cls.time,
        title: `Attendance Registry: ${cls.subjectCode} (${cls.sectionDetails})`,
        subtitle: `Mark pending attendance lists.`,
        category: "Attendance",
        status: "pending"
      });
    });

    if (todaySchedule.length === 0) {
      list.push({
        id: "no-lectures",
        time: "Today",
        title: "No Lectures Scheduled",
        subtitle: "No teaching sessions scheduled for today.",
        category: "Event"
      });
    }

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
  }, [todaySchedule, pendingEvaluations]);

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
          <MyTeachingAssignmentsCard />

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
            <WeeklyWorkloadChart weeklyData={weeklyData} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm space-y-4">
              <h3 className="font-display font-bold text-sm text-text-primary uppercase tracking-wider">
                LMS Grading Load
              </h3>
              <AssignmentReviewChart assignmentData={assignmentData} />
            </div>

            <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm space-y-4">
              <h3 className="font-display font-bold text-sm text-text-primary uppercase tracking-wider">
                Syllabus Planners Summary
              </h3>
              <LessonCompletionDoughnut completionData={completionData} />
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
              progress={weeklyClasses > 0 ? (weeklyClasses / 20) * 100 : 0}
              trend={{ value: "Stable", isPositive: true }}
              details={[
                { label: "Weekly classes", value: weeklyClasses },
                { label: "Weekly hours", value: teachingHours }
              ]}
              actionText="Open Schedule"
              actionRoute="/faculty/schedule"
            />
            <SmartProgressCard 
              title="Mentorship Assignments"
              value={`${mentorStudents.length} Students`}
              icon={Users}
              progress={mentorStudents.length > 0 ? 100 : 0}
              trend={{ value: "0 risk alerts", isPositive: true }}
              details={[
                { label: "Assigned Group Size", value: mentorStudents.length },
                { label: "Mentorship Reviews", value: "0 pending" }
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
