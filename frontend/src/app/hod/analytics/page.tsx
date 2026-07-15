"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { AcademicSubNav } from "@/components/Analytics/AcademicSubNav";
import { InsightCards } from "@/components/Analytics/InsightCards";
import {
  LineChartComponent,
  BarChartComponent,
  PieChartComponent,
} from "@/components/Analytics/AnalyticsCharts";
import {
  Users,
  GraduationCap,
  Percent,
  TrendingUp,
  BookOpen,
  FileSpreadsheet,
  AlertCircle,
  Briefcase,
  DollarSign,
  ClipboardList,
  Loader2,
  Sparkles,
} from "lucide-react";

export default function HodAnalyticsPage() {
  const { accessToken } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/analytics/hod", {}, accessToken);
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setError(res.message || "Failed to load HOD analytics.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Connection error to server.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <AcademicSubNav />
        <div className="py-24 flex flex-col items-center justify-center text-text-muted">
          <Loader2 className="animate-spin text-indigo-500 mb-3" size={32} />
          <span className="font-mono text-xs">Accessing department analytics registry...</span>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-6">
        <AcademicSubNav />
        <div className="py-12 px-6 rounded-xl bg-danger/10 border border-danger/20 text-center max-w-lg mx-auto mt-8">
          <span className="text-sm font-semibold text-danger block">Department Registry Sync Error</span>
          <p className="text-xs text-text-secondary mt-1">{error}</p>
          <button
            onClick={loadData}
            className="mt-4 px-4 py-2 bg-accent-blue text-white rounded-lg text-xs font-semibold hover:bg-accent-blue/90"
          >
            Retry Sync
          </button>
        </div>
      </div>
    );
  }

  const {
    departmentName = "",
    departmentStudents = 0,
    facultyCount = 0,
    subjectCount = 0,
    departmentAttendance = 0,
    departmentCGPA = 0,
    passPercentage = 0,
    feePendingStudents = 0,
    teachingProgress = {},
    mentorshipStatistics = {},
    placementOpportunities = {},
  } = data || {};

  // Formulate data for HOD Visualizations
  const teachingProgressData = {
    labels: ["Syllabus Completed %", "Syllabus Remaining %"],
    series: [
      {
        label: "Progress",
        data: [
          teachingProgress.completionPercentage || 0,
          Math.max(0, 105 - (teachingProgress.completionPercentage || 0)),
        ],
      },
    ],
  };

  const opportunitiesData = {
    labels: ["Internships", "Jobs", "Workshops"],
    series: [
      {
        label: "Openings",
        data: [
          placementOpportunities.internships || 0,
          placementOpportunities.jobs || 0,
          placementOpportunities.workshops || 0,
        ],
      },
    ],
  };

  // Mock department attendance trend over time
  const deptAttendanceTrend = {
    labels: ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5", "Week 6"],
    series: [
      {
        label: "Weekly Attendance %",
        data: [78, 81, 80, 83, 84, departmentAttendance || 85],
      },
    ],
  };

  return (
    <div className="space-y-6 pb-12">
      <AcademicSubNav />

      <div className="max-w-7xl mx-auto px-4 space-y-6 text-left">
        {/* HOD Profile Welcome */}
        <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold dark:text-indigo-400 text-indigo-700">
              Department analytics dashboard &mdash; {departmentName || "Academic Unit"}
            </h2>
            <p className="text-xs text-text-secondary mt-1 max-w-xl">
              Monitor syllabus progressions, mentor registers, and placement opportunities scoped strictly to your department.
            </p>
          </div>
          <div className="flex items-center gap-1.5 bg-surface-elevated border border-border-subtle rounded-md px-2 py-1 text-[10px] dark:text-indigo-400 text-indigo-700 font-mono">
            <Sparkles size={10} className="animate-pulse" />
            <span>Scope: {departmentName}</span>
          </div>
        </div>

        {/* HOD Metrics Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              title: "Active Students",
              value: departmentStudents,
              icon: GraduationCap,
              color: "text-accent-blue border-accent-blue/20 bg-accent-blue/5",
            },
            {
              title: "Staff Members",
              value: facultyCount,
              icon: Users,
              color: "text-success border-success/20 bg-success/5",
            },
            {
              title: "Active Timetables",
              value: subjectCount,
              icon: BookOpen,
              color: "text-accent-purple border-accent-purple/20 bg-accent-purple/5",
            },
            {
              title: "Avg Attendance",
              value: `${departmentAttendance}%`,
              icon: Percent,
              color: "text-warning border-warning/20 bg-warning/5",
            },
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="bg-surface rounded-2xl border border-border-subtle p-4 flex items-center gap-4 hover:shadow-sm transition-shadow"
              >
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${item.color}`}>
                  <Icon size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{item.title}</p>
                  <p className="font-display font-black text-xl text-text-primary mt-0.5">{item.value}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Computed Insights Cards Section */}
        <InsightCards />

        {/* Analytics Breakdown Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Academic Overview Card */}
          <div className="bg-surface rounded-2xl border border-border-subtle p-5 space-y-4">
            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5 border-b border-border-subtle pb-3">
              <TrendingUp size={14} className="text-accent-blue" />
              Department Academic Statistics
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[9px] font-bold text-text-muted uppercase">Department CGPA</p>
                <p className="font-display font-black text-xl text-text-primary mt-0.5">
                  {departmentCGPA || "0.0"}/10
                </p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-text-muted uppercase">Pass Percentage</p>
                <p className="font-display font-black text-xl text-success mt-0.5">
                  {passPercentage || 0}%
                </p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-text-muted uppercase">Pending Fees</p>
                <p className="font-display font-black text-xl text-danger mt-0.5">
                  {feePendingStudents} Students
                </p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-text-muted uppercase">Active Mentors</p>
                <p className="font-display font-black text-xl text-accent-purple mt-0.5">
                  {mentorshipStatistics.activeMentors || 0}
                </p>
              </div>
            </div>
            <div className="border-t border-border-subtle pt-3">
              <p className="text-[10px] text-text-muted mb-2 font-semibold">Department Attendance Trend</p>
              <LineChartComponent
                labels={deptAttendanceTrend.labels}
                series={deptAttendanceTrend.series}
                height={150}
              />
            </div>
          </div>

          {/* Syllabus Progress */}
          <div className="bg-surface rounded-2xl border border-border-subtle p-5 space-y-4">
            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5 border-b border-border-subtle pb-3">
              <ClipboardList size={14} className="text-success" />
              Syllabus Completion Index
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[9px] font-bold text-text-muted uppercase">Completion Rate</p>
                <p className="font-display font-black text-xl text-success mt-0.5">
                  {teachingProgress.completionPercentage || 0}%
                </p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-text-muted uppercase">Lessons Completed</p>
                <p className="font-display font-black text-xl text-text-primary mt-0.5">
                  {teachingProgress.lessonsCompleted || 0}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-text-muted uppercase">Planned Classes</p>
                <p className="font-display font-black text-xl text-text-primary mt-0.5">
                  {teachingProgress.lessonsPlanned || 0}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-text-muted uppercase">Remaining Slots</p>
                <p className="font-display font-black text-xl text-text-muted mt-0.5">
                  {teachingProgress.lessonsRemaining || 0}
                </p>
              </div>
            </div>
            <div className="border-t border-border-subtle pt-3">
              <p className="text-[10px] text-text-muted mb-2 font-semibold">Syllabus Execution Ratio</p>
              <PieChartComponent
                labels={teachingProgressData.labels}
                series={teachingProgressData.series}
                height={150}
                isDoughnut
              />
            </div>
          </div>

          {/* Opportunity Hub */}
          <div className="bg-surface rounded-2xl border border-border-subtle p-5 space-y-4">
            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5 border-b border-border-subtle pb-3">
              <Briefcase size={14} className="text-indigo-500" />
              Placement & Careers Desk
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[9px] font-bold text-text-muted uppercase">Active Postings</p>
                <p className="font-display font-black text-xl text-text-primary mt-0.5">
                  {placementOpportunities.total || 0}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-text-muted uppercase">Mentor Groups</p>
                <p className="font-display font-black text-xl text-text-primary mt-0.5">
                  {mentorshipStatistics.totalMentorGroups || 0}
                </p>
              </div>
            </div>
            <div className="border-t border-border-subtle pt-3">
              <p className="text-[10px] text-text-muted mb-2 font-semibold">Placements Category Split</p>
              <PieChartComponent
                labels={opportunitiesData.labels}
                series={opportunitiesData.series}
                height={150}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
