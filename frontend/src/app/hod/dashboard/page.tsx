"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { 
  Users, 
  GraduationCap, 
  BookOpen, 
  Percent, 
  ClipboardList,
  Loader2, 
  Bell, 
  ArrowRight,
  Sparkles,
  AlertTriangle,
  GitPullRequest
} from "lucide-react";
import { AcademicSubNav } from "@/components/Analytics/AcademicSubNav";
import { WeeklyWorkloadChart } from "@/components/Dashboard/WorkloadCharts";
import { TeachingProgressCard } from "@/components/Dashboard/TeachingProgressCard";

// Import UXL components
import { TodayFocus, FocusMetric } from "@/components/UXL/TodayFocus";
import { ActionCenter, ActionItem } from "@/components/UXL/ActionCenter";
import { QuickActions, ShortcutItem } from "@/components/UXL/QuickActions";
import { SmartProgressCard } from "@/components/UXL/SmartProgressCard";

interface HODDashboardData {
  profile: {
    id: string;
    fullName: string;
    employeeNumber: string;
    departmentName: string;
    designation: string;
  };
  metrics: {
    totalFaculty: number;
    totalStudents: number;
    totalClasses: number;
    attendanceRate: number;
    pendingApprovals: number;
  };
  notices: {
    id: string;
    title: string;
    priority: string;
    publishDate: string;
  }[];
  quickActions: {
    label: string;
    route: string;
  }[];
}

export default function HODDashboard() {
  const { accessToken } = useAuth();
  const [data, setData] = useState<HODDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;

    const fetchHODStats = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiFetch("/dashboard/hod", {}, accessToken);
        if (res.success && res.data) {
          setData(res.data);
        } else {
          setError(res.message || "Failed to load department dashboard");
        }
      } catch (err: any) {
        setError(err.message || "Connection error to server");
      } finally {
        setLoading(false);
      }
    };

    fetchHODStats();
  }, [accessToken]);

  // Mock department specific comparison
  const workloadData = [
    { name: "Dr. Sharma", Hours: 16 },
    { name: "Prof. Verma", Hours: 14 },
    { name: "Dr. Nair", Hours: 18 },
    { name: "Mrs. Patel", Hours: 15 },
    { name: "Mr. Das", Hours: 10 }
  ];

  const deptProgressList = [
    { id: "1", name: "Database Management Systems", code: "CS-302", completedLessons: 18, totalLessons: 25, percentage: 72 },
    { id: "2", name: "Web Technologies Lab", code: "CS-308", completedLessons: 8, totalLessons: 15, percentage: 53 },
    { id: "3", name: "Software Engineering", code: "CS-304", completedLessons: 20, totalLessons: 24, percentage: 83 }
  ];

  // Map alerts to UXL ActionItems
  const actionItems: ActionItem[] = useMemo(() => {
    return [
      { id: "h1", title: "Dr. R. Nair is Overloaded (18 teaching hours/week)", dueDate: "Redistribute lecture slots if required", priority: "high", actionText: "Review", actionRoute: "/hod/faculty" },
      { id: "h2", title: "Mrs. K. Patel: WebTech syllabus progress lagging (53%)", dueDate: "Sync with teaching plans", priority: "medium", actionText: "Syllabus", actionRoute: "/hod/classes" },
      { id: "h3", title: "Review Pending Maker-Checker Grade Sheets", dueDate: "Approvals deadline", priority: "high", actionText: "Approve", actionRoute: "/hod/analytics" }
    ];
  }, []);

  // Map focus metrics
  const focusMetrics: FocusMetric[] = useMemo(() => {
    if (!data) return [];
    return [
      { label: "Faculty staff", value: data.metrics.totalFaculty, subtext: "Active in department" },
      { label: "Scholars registered", value: data.metrics.totalStudents, subtext: "Total student strength" },
      { label: "Timetable hours", value: data.metrics.totalClasses, subtext: "Timetable active slots" },
      { label: "Department attendance", value: `${data.metrics.attendanceRate}%`, subtext: "Average attendance" }
    ];
  }, [data]);

  // HOD quick actions
  const quickActions: ShortcutItem[] = useMemo(() => {
    if (!data) return [];
    return [
      ...data.quickActions.map(act => ({
        label: act.label,
        route: act.route,
        icon: GitPullRequest
      })),
      { label: "Workflow logs", route: "/faculty/workflows", icon: GitPullRequest }
    ];
  }, [data]);

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-text-muted">
        <Loader2 className="animate-spin text-indigo-500 mb-3" size={32} />
        <span className="font-mono text-xs">Accessing department desk...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-12 px-6 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center max-w-lg mx-auto">
        <span className="text-sm font-semibold text-rose-500 block">Dashboard Error</span>
        <p className="text-xs text-text-secondary mt-1">{error || "Could not retrieve stats."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-12">
      <AcademicSubNav />
      
      {/* HOD Focus Banner */}
      <TodayFocus 
        userName={data.profile.fullName} 
        role="Head of Department"
        metrics={focusMetrics}
        subtitleText={`${data.profile.employeeNumber} · HOD Desk · ${data.profile.departmentName}`}
      />

      {/* Smart metrics row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SmartProgressCard 
          title="Department Attendance Compliance"
          value={`${data.metrics.attendanceRate}%`}
          icon={Percent}
          progress={data.metrics.attendanceRate}
          trend={{ value: "Stable", isPositive: true }}
          details={[
            { label: "At-Risk Scholars", value: "8 students < 75%", color: "text-red-500" }
          ]}
          actionText="View Attendance Logs"
          actionRoute="/hod/attendance"
        />

        <SmartProgressCard 
          title="Grade Approvals (Maker-Checker)"
          value={`${data.metrics.pendingApprovals} pending`}
          icon={ClipboardList}
          progress={data.metrics.pendingApprovals > 0 ? 40 : 100}
          trend={{ value: data.metrics.pendingApprovals > 0 ? "Pending" : "Cleared", isPositive: data.metrics.pendingApprovals === 0 }}
          details={[
            { label: "Evaluation batches", value: "4 units" }
          ]}
          actionText="Review Grades"
          actionRoute="/hod/analytics"
        />

        <SmartProgressCard 
          title="Curriculum Tracker"
          value="3 Subjects Active"
          icon={BookOpen}
          progress={69}
          trend={{ value: "Lagging", isPositive: false }}
          details={[
            { label: "Average progress", value: "69% complete" }
          ]}
          actionText="Review Timetables"
          actionRoute="/hod/classes"
        />
      </div>

      {/* Faculty Workload and Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm space-y-4">
          <div>
            <h3 className="font-display font-bold text-sm text-text-primary uppercase tracking-wider">
              Department Faculty Workload Comparison
            </h3>
            <p className="text-[11px] text-text-muted mt-0.5">Contact hours per week per lecturer</p>
          </div>
          <WeeklyWorkloadChart weeklyData={workloadData} />
        </div>

        <div className="lg:col-span-4">
          <TeachingProgressCard progressList={deptProgressList} />
        </div>
      </div>

      {/* Lower Details Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 space-y-4">
          <ActionCenter items={actionItems} />

          {/* Notices */}
          <div className="border border-border-subtle bg-surface rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-indigo-500" />
                <h3 className="font-display font-bold text-sm text-text-primary">Department Announcements</h3>
              </div>
            </div>

            <div className="space-y-3">
              {data.notices.length === 0 ? (
                <div className="py-8 text-center text-xs dark:text-neutral-500 text-text-muted font-mono">
                  No active department announcements.
                </div>
              ) : (
                data.notices.map((notice) => (
                  <div 
                    key={notice.id}
                    className="p-3 rounded-lg bg-background border border-border-subtle flex items-start justify-between gap-3"
                  >
                    <div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                        notice.priority === "Urgent" 
                          ? "bg-rose-500/10 text-rose-500 border-rose-500/20 animate-pulse"
                          : notice.priority === "High"
                          ? "bg-orange-500/10 text-orange-500 border-orange-500/20"
                          : "bg-neutral-500/10 text-text-secondary border-neutral-500/20"
                      }`}>
                        {notice.priority}
                      </span>
                      <h4 className="text-xs font-semibold text-text-primary mt-1.5 leading-snug">{notice.title}</h4>
                    </div>
                    <span className="text-[10px] font-mono text-text-muted shrink-0 mt-0.5">{notice.publishDate}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Profile Details & Quick Actions (Col 5) */}
        <div className="lg:col-span-5 space-y-4">
          <QuickActions shortcuts={quickActions} />

          {/* Department Profile Box */}
          <div className="border border-border-subtle bg-surface rounded-2xl p-5 shadow-sm">
            <h3 className="font-display font-bold text-sm text-text-primary border-b border-border-subtle pb-3 mb-4">
              Department Desk Info
            </h3>
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">HOD Representative:</span>
                <span className="font-semibold text-text-primary">{data.profile.fullName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Employee Number:</span>
                <span className="font-mono font-semibold text-text-primary">{data.profile.employeeNumber}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Department:</span>
                <span className="font-semibold text-text-primary">{data.profile.departmentName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Official Designation:</span>
                <span className="capitalize font-semibold text-text-primary">{data.profile.designation.replace("_", " ")}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
