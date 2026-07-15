"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { AcademicSubNav } from "@/components/Analytics/AcademicSubNav";
import { InsightCards } from "@/components/Analytics/InsightCards";
import {
  AreaChartComponent,
  BarChartComponent,
  PieChartComponent,
} from "@/components/Analytics/AnalyticsCharts";
import {
  Award,
  Calendar,
  Percent,
  CheckCircle,
  Briefcase,
  TrendingUp,
  FileSpreadsheet,
  Clock,
  Loader2,
  Sparkles,
} from "lucide-react";

export default function StudentAnalyticsPage() {
  const { accessToken } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/analytics/student", {}, accessToken);
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setError(res.message || "Failed to load student performance insights.");
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
          <span className="font-mono text-xs">Assembling your academic profile...</span>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-6">
        <AcademicSubNav />
        <div className="py-12 px-6 rounded-xl bg-danger/10 border border-danger/20 text-center max-w-lg mx-auto mt-8">
          <span className="text-sm font-semibold text-danger block">Student Profile Error</span>
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
    attendanceTrend = {},
    cgpaTrend = [],
    internalMarksTrend = [],
    assignmentCompletionPercentage = 0,
    learningProgress = {},
    feeStatus = [],
    opportunityParticipation = 0,
  } = data || {};

  // Compute overall attendance from attendanceTrend
  const overallAttendance = Math.round(attendanceTrend.overall?.percentage || 78);
  const attendanceSubjects = attendanceTrend.subjectWise || [];

  // Formulate data for graphs
  const cgpaLabels = cgpaTrend.map((t: any) => `Sem ${t.semester}`);
  const cgpaChartData = {
    labels: cgpaLabels.length > 0 ? cgpaLabels : ["Sem 1", "Sem 2", "Sem 3"],
    series: [
      {
        label: "SGPA Score",
        data: cgpaTrend.map((t: any) => t.sgpa) || [8.2, 7.9, 8.4],
      },
    ],
  };

  const subjectAttendanceLabels = attendanceSubjects.map((s: any) => s.subjectCode);
  const subjectAttendanceData = {
    labels: subjectAttendanceLabels.length > 0 ? subjectAttendanceLabels : ["CS-301", "CS-302", "CS-303"],
    series: [
      {
        label: "Attendance Rate %",
        data: attendanceSubjects.map((s: any) => Math.round(s.percentage)) || [80, 72, 90],
      },
    ],
  };

  // Learning Progress variables
  const syllabusCompleted = learningProgress.completed || 0;
  const syllabusPlanned = learningProgress.totalPlanned || 0;
  const syllabusRemaining = Math.max(0, syllabusPlanned - syllabusCompleted);

  const learningProgressChart = {
    labels: ["Completed Classes", "Remaining Lessons"],
    series: [
      {
        label: "Lessons",
        data: [syllabusCompleted, syllabusRemaining],
      },
    ],
  };

  return (
    <div className="space-y-6 pb-12">
      <AcademicSubNav />

      {/* Main Container - Mobile First Column layout, wrapping cleanly */}
      <div className="max-w-7xl mx-auto px-4 space-y-5 text-left">
        {/* Welcome Message Card */}
        <div className="relative overflow-hidden rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm">
          <div className="absolute right-6 top-6 text-accent-blue/10 pointer-events-none">
            <Sparkles size={80} />
          </div>
          <span className="text-[10px] tracking-wider uppercase font-bold text-accent-blue">My Performance Deck</span>
          <h2 className="font-display font-extrabold text-xl dark:text-white text-text-primary mt-1">
            Academic Analytics & Insights
          </h2>
          <p className="text-xs text-text-secondary mt-1 max-w-lg leading-relaxed">
            Review your semester-wise grades progression, subject attendance trends, assignment tallies, and career placements.
          </p>
        </div>

        {/* Dynamic Metric Grid (Responsive columns) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-surface rounded-2xl border border-border-subtle p-4 hover:shadow-sm transition-shadow">
            <div className="w-8 h-8 rounded-xl bg-accent-blue/5 border border-accent-blue/20 flex items-center justify-center text-accent-blue">
              <Percent size={15} />
            </div>
            <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider mt-3">My Attendance</p>
            <p className="font-display font-black text-lg text-text-primary mt-0.5">{overallAttendance}%</p>
            <span className={`inline-block text-[9px] font-bold mt-1 px-1.5 py-0.5 rounded-full ${
              overallAttendance >= 75 ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
            }`}>
              {overallAttendance >= 75 ? "✓ Compliant" : "⚠ Below 75%"}
            </span>
          </div>

          <div className="bg-surface rounded-2xl border border-border-subtle p-4 hover:shadow-sm transition-shadow">
            <div className="w-8 h-8 rounded-xl bg-success/5 border border-success/20 flex items-center justify-center text-success">
              <Award size={15} />
            </div>
            <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider mt-3">Cumulative CGPA</p>
            <p className="font-display font-black text-lg text-text-primary mt-0.5">
              {cgpaTrend[cgpaTrend.length - 1]?.sgpa || "8.25"}
            </p>
            <span className="text-[9px] font-mono text-text-muted block mt-1">Scale / 10.0</span>
          </div>

          <div className="bg-surface rounded-2xl border border-border-subtle p-4 hover:shadow-sm transition-shadow">
            <div className="w-8 h-8 rounded-xl bg-accent-purple/5 border border-accent-purple/20 flex items-center justify-center text-accent-purple">
              <CheckCircle size={15} />
            </div>
            <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider mt-3">Tasks Finished</p>
            <p className="font-display font-black text-lg text-text-primary mt-0.5">
              {assignmentCompletionPercentage}%
            </p>
            <span className="text-[9px] font-mono text-text-muted block mt-1">LMS Assignments</span>
          </div>

          <div className="bg-surface rounded-2xl border border-border-subtle p-4 hover:shadow-sm transition-shadow">
            <div className="w-8 h-8 rounded-xl bg-warning/5 border border-warning/20 flex items-center justify-center text-warning">
              <Briefcase size={15} />
            </div>
            <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider mt-3">Job Applications</p>
            <p className="font-display font-black text-lg text-text-primary mt-0.5">{opportunityParticipation}</p>
            <span className="text-[9px] font-mono text-text-muted block mt-1">Opportunity Hub</span>
          </div>
        </div>

        {/* Computed Insights Section */}
        <InsightCards />

        {/* Charts & Visualizations Stacks */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* CGPA Trend Chart */}
          <div className="bg-surface rounded-2xl border border-border-subtle p-5 space-y-4">
            <div>
              <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5 border-b border-border-subtle pb-3">
                <TrendingUp size={14} className="text-accent-blue" />
                Grades & GPA Trend
              </h3>
            </div>
            <AreaChartComponent
              labels={cgpaChartData.labels}
              series={cgpaChartData.series}
              height={220}
            />
          </div>

          {/* Subject Attendance Breakdown */}
          <div className="bg-surface rounded-2xl border border-border-subtle p-5 space-y-4">
            <div>
              <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5 border-b border-border-subtle pb-3">
                <Percent size={14} className="text-warning" />
                Subject-wise Attendance Rates
              </h3>
            </div>
            {subjectAttendanceLabels.length > 0 ? (
              <BarChartComponent
                labels={subjectAttendanceData.labels}
                series={subjectAttendanceData.series}
                height={220}
              />
            ) : (
              <div className="py-20 text-center text-text-muted font-mono text-xs">
                No attendance logs found.
              </div>
            )}
          </div>

          {/* Syllabus Progress Planner */}
          <div className="bg-surface rounded-2xl border border-border-subtle p-5 space-y-4">
            <div>
              <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5 border-b border-border-subtle pb-3">
                <Calendar size={14} className="text-success" />
                Learning Timelines & Planner
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-4 text-center sm:text-left">
              <div>
                <p className="text-[9px] font-bold text-text-muted uppercase">Lessons Attended</p>
                <p className="font-display font-black text-lg text-text-primary mt-0.5">{syllabusCompleted}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-text-muted uppercase">Syllabus Total</p>
                <p className="font-display font-black text-lg text-text-primary mt-0.5">{syllabusPlanned}</p>
              </div>
            </div>
            <div className="border-t border-border-subtle pt-3">
              <PieChartComponent
                labels={learningProgressChart.labels}
                series={learningProgressChart.series}
                height={160}
                isDoughnut
              />
            </div>
          </div>

          {/* Fee Ledger status summaries */}
          <div className="bg-surface rounded-2xl border border-border-subtle p-5 space-y-4">
            <div>
              <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5 border-b border-border-subtle pb-3">
                <FileSpreadsheet size={14} className="text-accent-purple" />
                Fee Payment Ledger Status
              </h3>
            </div>
            {feeStatus && feeStatus.length > 0 ? (
              <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                {feeStatus.map((fee: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-3 bg-surface-elevated border border-border-subtle rounded-xl flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-text-primary">{fee.feeType}</span>
                      <p className="text-[10px] text-text-muted mt-0.5 font-mono">Due: {fee.dueDate}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-text-primary">₹{fee.pendingAmount.toLocaleString("en-IN")}</span>
                      <span className={`block text-[9px] font-extrabold uppercase mt-1 px-1.5 py-0.5 rounded-full ${
                        fee.paymentStatus === "Paid" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
                      }`}>
                        {fee.paymentStatus}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-16 text-center text-text-muted font-mono text-xs border border-dashed border-border-subtle rounded-xl bg-surface-elevated/40">
                🎉 No outstanding fees found! All invoices are fully paid.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
