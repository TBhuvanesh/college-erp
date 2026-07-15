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
  HeartHandshake,
  Loader2,
  Sparkles,
} from "lucide-react";

export default function FacultyAnalyticsPage() {
  const { accessToken } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/analytics/faculty", {}, accessToken);
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setError(res.message || "Failed to load faculty workload analytics.");
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
          <Loader2 className="animate-spin text-accent-blue mb-3" size={32} />
          <span className="font-mono text-xs">Accessing instructor workloads...</span>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-6">
        <AcademicSubNav />
        <div className="py-12 px-6 rounded-xl bg-danger/10 border border-danger/20 text-center max-w-lg mx-auto mt-8">
          <span className="text-sm font-semibold text-danger block">Faculty Data Sync Error</span>
          <p className="text-xs text-text-secondary mt-1">{error}</p>
          <button
            onClick={loadData}
            className="mt-4 px-4 py-2 bg-accent-blue text-white rounded-lg text-xs font-semibold hover:bg-accent-blue/90"
          >
            Retry Fetch
          </button>
        </div>
      </div>
    );
  }

  const { teachingOverview = {}, mentorDashboard = {} } = data || {};

  const lessonsCompleted = teachingOverview.lessonsCompleted || 0;
  const lessonsPlanned = teachingOverview.lessonsPlanned || 0;
  const lessonsRemaining = Math.max(0, lessonsPlanned - lessonsCompleted);

  // Formulate Recharts parameters
  const syllabusChartData = {
    labels: ["Syllabus Completed", "Lessons Remaining"],
    series: [
      {
        label: "Progress",
        data: [lessonsCompleted, lessonsRemaining],
      },
    ],
  };

  const assignmentSubmissionData = {
    labels: ["Submitted %", "Pending Submission %"],
    series: [
      {
        label: "LMS Workloads",
        data: [
          teachingOverview.assignmentSubmissionPercentage || 0,
          Math.max(0, 100 - (teachingOverview.assignmentSubmissionPercentage || 0)),
        ],
      },
    ],
  };

  // Mock student marks distributions
  const marksChartData = {
    labels: ["DBMS", "Data Structures", "Algorithms", "Computer Networks"],
    series: [
      {
        label: "Average Score %",
        data: [76, 82, teachingOverview.averageInternalMarks || 74, 88],
      },
    ],
  };

  return (
    <div className="space-y-6 pb-12">
      <AcademicSubNav />

      <div className="max-w-7xl mx-auto px-4 space-y-6 text-left">
        {/* Welcome Block */}
        <div className="p-4 rounded-xl border border-accent-blue/20 bg-accent-blue/5 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold dark:text-accent-blue text-blue-700">
              Teaching Performance & Workloads Dashboard
            </h2>
            <p className="text-xs text-text-secondary mt-1 max-w-xl">
              Track allocated syllabus progressions, evaluate LMS assignments, and review assigned mentees in real time.
            </p>
          </div>
          <div className="flex items-center gap-1.5 bg-surface-elevated border border-border-subtle rounded-md px-2 py-1 text-[10px] dark:text-accent-blue text-blue-700 font-mono">
            <Sparkles size={10} className="animate-pulse" />
            <span>Faculty Desk</span>
          </div>
        </div>

        {/* Workload Strips */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              title: "Assigned Subjects",
              value: teachingOverview.subjectsAssigned,
              icon: BookOpen,
              color: "text-accent-blue border-accent-blue/20 bg-accent-blue/5",
            },
            {
              title: "Lessons Completed",
              value: `${lessonsCompleted}/${lessonsPlanned}`,
              icon: ClipboardList,
              color: "text-success border-success/20 bg-success/5",
            },
            {
              title: "Syllabus Progress",
              value: `${teachingOverview.syllabusCompletion || 0}%`,
              icon: Percent,
              color: "text-accent-purple border-accent-purple/20 bg-accent-purple/5",
            },
            {
              title: "Student Attendance",
              value: `${teachingOverview.studentAttendance || 0}%`,
              icon: Users,
              color: "text-warning border-warning/20 bg-warning/5",
            },
          ].map((item, idx) => {
            const Icon = item.icon as any;
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

        {/* Analysis Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Syllabus Planner Details */}
          <div className="bg-surface rounded-2xl border border-border-subtle p-5 space-y-4">
            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5 border-b border-border-subtle pb-3">
              <TrendingUp size={14} className="text-accent-blue" />
              Syllabus Completion Index
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[9px] font-bold text-text-muted uppercase">Lessons Finished</p>
                <p className="font-display font-black text-lg text-text-primary mt-0.5">{lessonsCompleted}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-text-muted uppercase">Lessons Remaining</p>
                <p className="font-display font-black text-lg text-text-muted mt-0.5">{lessonsRemaining}</p>
              </div>
            </div>
            <div className="border-t border-border-subtle pt-3">
              <p className="text-[10px] text-text-muted mb-2 font-semibold">Syllabus Completion Ratio</p>
              <PieChartComponent
                labels={syllabusChartData.labels}
                series={syllabusChartData.series}
                height={150}
                isDoughnut
              />
            </div>
          </div>

          {/* LMS Assignments */}
          <div className="bg-surface rounded-2xl border border-border-subtle p-5 space-y-4">
            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5 border-b border-border-subtle pb-3">
              <FileSpreadsheet size={14} className="text-success" />
              LMS Submissions & Marks
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[9px] font-bold text-text-muted uppercase">Assignments Created</p>
                <p className="font-display font-black text-lg text-text-primary mt-0.5">
                  {teachingOverview.assignmentsCreated || 0}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-text-muted uppercase">Average Grades</p>
                <p className="font-display font-black text-lg text-success mt-0.5">
                  {teachingOverview.averageInternalMarks || 0}%
                </p>
              </div>
            </div>
            <div className="border-t border-border-subtle pt-3">
              <p className="text-[10px] text-text-muted mb-2 font-semibold">Submission Completion Rate</p>
              <PieChartComponent
                labels={assignmentSubmissionData.labels}
                series={assignmentSubmissionData.series}
                height={150}
              />
            </div>
          </div>

          {/* Mentorship Dashboard */}
          <div className="bg-surface rounded-2xl border border-border-subtle p-5 space-y-4">
            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5 border-b border-border-subtle pb-3">
              <HeartHandshake size={14} className="text-warning" />
              Mentorship Registry Alerts
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[9px] font-bold text-text-muted uppercase">Students At Risk</p>
                <p className="font-display font-black text-lg text-danger mt-0.5">
                  {mentorDashboard.studentsAtRisk || 0}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-text-muted uppercase">Low Attendance</p>
                <p className="font-display font-black text-lg text-warning mt-0.5">
                  {mentorDashboard.lowAttendance || 0}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-text-muted uppercase">Pending Fees</p>
                <p className="font-display font-black text-lg text-warning mt-0.5">
                  {mentorDashboard.feePending || 0}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-text-muted uppercase">Task Overdue</p>
                <p className="font-display font-black text-lg text-text-muted mt-0.5">
                  {mentorDashboard.assignmentPending || 0}
                </p>
              </div>
            </div>
            <div className="border-t border-border-subtle pt-3">
              <p className="text-[10px] text-text-muted mb-2 font-semibold">Average Student Score Progression</p>
              <BarChartComponent
                labels={marksChartData.labels}
                series={marksChartData.series}
                height={150}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Simple layout support helper
const ClipboardList = ({ size, className }: any) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
  </svg>
);
