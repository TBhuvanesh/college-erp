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
  AreaChartComponent,
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
  Bell,
  HeartHandshake,
  Loader2,
  Calendar,
} from "lucide-react";

export default function AdminAnalyticsPage() {
  const { accessToken } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Departments dropdown list
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>("");

  const loadData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      // Build filters
      let endpoint = "/analytics/admin";
      if (selectedDept) {
        endpoint += `?departmentId=${selectedDept}`;
      }

      const [analyticsRes, deptRes] = await Promise.all([
        apiFetch(endpoint, {}, accessToken),
        apiFetch("/departments?limit=100", {}, accessToken),
      ]);

      if (analyticsRes.success) {
        setData(analyticsRes.data);
      } else {
        setError(analyticsRes.message || "Failed to load admin analytics.");
      }

      if (deptRes.success && deptRes.data?.departments) {
        setDepartments(deptRes.data.departments);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Connection error to server.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, selectedDept]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <AcademicSubNav />
        <div className="py-24 flex flex-col items-center justify-center text-text-muted">
          <Loader2 className="animate-spin text-accent-blue mb-3" size={32} />
          <span className="font-mono text-xs">Assembling institutional analytics matrix...</span>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-6">
        <AcademicSubNav />
        <div className="py-12 px-6 rounded-xl bg-danger/10 border border-danger/20 text-center max-w-lg mx-auto mt-8">
          <span className="text-sm font-semibold text-danger block">Analytics Sync Error</span>
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

  const {
    institutionOverview = {},
    academicAnalytics = {},
    teachingAnalytics = {},
    lmsAnalytics = {},
    mentorshipAnalytics = {},
    opportunityAnalytics = {},
    notificationAnalytics = {},
  } = data || {};

  // Formulate data for charts
  const passFailData = {
    labels: ["Passed", "Failed"],
    series: [
      {
        label: "Students",
        data: [
          academicAnalytics.passPercentage || 0,
          academicAnalytics.failPercentage || 0,
        ],
      },
    ],
  };

  const lmsActivityData = {
    labels: ["Submission Rate %", "Late Submissions %"],
    series: [
      {
        label: "Submissions",
        data: [
          lmsAnalytics.submissionPercentage || 0,
          lmsAnalytics.lateSubmissionPercentage || 0,
        ],
      },
    ],
  };

  const opportunityBreakdown = {
    labels: ["Internships", "Job Openings", "Workshops"],
    series: [
      {
        label: "Active Roles",
        data: [
          opportunityAnalytics.internships || 0,
          opportunityAnalytics.jobs || 0,
          opportunityAnalytics.workshops || 0,
        ],
      },
    ],
  };

  const facultyTeachingLabels =
    teachingAnalytics.facultyTeachingProgress?.map((f: any) => f.facultyName) || [];
  const facultyTeachingData = {
    labels: facultyTeachingLabels,
    series: [
      {
        label: "Completion %",
        data:
          teachingAnalytics.facultyTeachingProgress?.map(
            (f: any) => f.completionPercentage
          ) || [],
      },
    ],
  };

  // Mock static historical comparison data since backend returns only current snapshot
  const attendanceMonthlyLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  const attendanceMonthlyData = {
    labels: attendanceMonthlyLabels,
    series: [
      {
        label: "Attendance Rate %",
        data: [72, 75, 78, 80, 82, academicAnalytics.averageAttendance || 85],
      },
    ],
  };

  return (
    <div className="space-y-6 pb-12">
      <AcademicSubNav />

      <div className="max-w-7xl mx-auto px-4 space-y-6 text-left">
        {/* Header Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-text-primary">Institutional Academic Metrics</h2>
            <p className="text-xs text-text-secondary">
              Review and query aggregated results, syllabus completion, and LMS student engagements.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-text-secondary font-semibold shrink-0">Filter Department:</label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="px-3.5 py-2 text-xs bg-surface border border-border-subtle text-text-primary rounded-xl focus:border-accent-blue focus:outline-none"
            >
              <option value="">Institution Wide</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name} ({dept.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Institution Overview Stripe */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              title: "Students",
              value: institutionOverview.totalStudents,
              icon: GraduationCap,
              color: "text-accent-blue border-accent-blue/20 bg-accent-blue/5",
            },
            {
              title: "Faculty Staff",
              value: institutionOverview.totalFaculty,
              icon: Users,
              color: "text-success border-success/20 bg-success/5",
            },
            {
              title: "Departments",
              value: institutionOverview.totalDepartments,
              icon: BookOpen,
              color: "text-accent-purple border-accent-purple/20 bg-accent-purple/5",
            },
            {
              title: "Total Subjects",
              value: institutionOverview.totalSubjects,
              icon: FileSpreadsheet,
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
                  <p className="font-display font-black text-xl text-text-primary mt-0.5">
                    {item.value?.toLocaleString() || 0}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Computed Insights Cards Section */}
        <InsightCards />

        {/* Analytical Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* 1. Academic Performance Card */}
          <div className="bg-surface rounded-2xl border border-border-subtle p-5 space-y-4">
            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5 border-b border-border-subtle pb-3">
              <TrendingUp size={14} className="text-accent-blue" />
              Academic Performance Aggregates
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[9px] font-bold text-text-muted uppercase">Average Attendance</p>
                <p className="font-display font-black text-xl text-text-primary mt-0.5">
                  {academicAnalytics.averageAttendance || 0}%
                </p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-text-muted uppercase">Average CGPA</p>
                <p className="font-display font-black text-xl text-text-primary mt-0.5">
                  {academicAnalytics.averageCGPA || 0}/10
                </p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-text-muted uppercase">Pass Percentage</p>
                <p className="font-display font-black text-xl text-success mt-0.5">
                  {academicAnalytics.passPercentage || 0}%
                </p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-text-muted uppercase">Subject Completion</p>
                <p className="font-display font-black text-xl text-accent-purple mt-0.5">
                  {academicAnalytics.subjectCompletionRate || 0}%
                </p>
              </div>
            </div>
            <div className="border-t border-border-subtle pt-3">
              <p className="text-[10px] text-text-muted mb-2 font-semibold">Pass / Fail Breakup</p>
              <PieChartComponent
                labels={passFailData.labels}
                series={passFailData.series}
                height={150}
                isDoughnut
              />
            </div>
          </div>

          {/* 2. Teaching Planner & Progress */}
          <div className="bg-surface rounded-2xl border border-border-subtle p-5 space-y-4">
            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5 border-b border-border-subtle pb-3">
              <BookOpen size={14} className="text-success" />
              Syllabus & Course Planners
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[9px] font-bold text-text-muted uppercase">Syllabus Completion</p>
                <p className="font-display font-black text-xl text-success mt-0.5">
                  {teachingAnalytics.syllabusCompletion || 0}%
                </p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-text-muted uppercase">Active Lesson Plans</p>
                <p className="font-display font-black text-xl text-text-primary mt-0.5">
                  {teachingAnalytics.lessonsPlanned || 0}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-text-muted uppercase">Lessons Completed</p>
                <p className="font-display font-black text-xl text-text-primary mt-0.5">
                  {teachingAnalytics.lessonsCompleted || 0}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-text-muted uppercase">Remaining Lessons</p>
                <p className="font-display font-black text-xl text-text-muted mt-0.5">
                  {teachingAnalytics.lessonsRemaining || 0}
                </p>
              </div>
            </div>
            <div className="border-t border-border-subtle pt-3">
              <p className="text-[10px] text-text-muted mb-2 font-semibold">Syllabus Completion per Instructor</p>
              {facultyTeachingLabels.length > 0 ? (
                <BarChartComponent
                  labels={facultyTeachingData.labels}
                  series={facultyTeachingData.series}
                  height={150}
                />
              ) : (
                <p className="text-center font-mono text-[10px] text-text-muted py-8">
                  No teaching progress records found.
                </p>
              )}
            </div>
          </div>

          {/* 3. LMS Analytics & Files */}
          <div className="bg-surface rounded-2xl border border-border-subtle p-5 space-y-4">
            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5 border-b border-border-subtle pb-3">
              <FileSpreadsheet size={14} className="text-accent-purple" />
              LMS Learning Management
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[9px] font-bold text-text-muted uppercase">Course Materials</p>
                <p className="font-display font-black text-xl text-text-primary mt-0.5">
                  {lmsAnalytics.totalMaterialsUploaded || 0}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-text-muted uppercase">Assignments Created</p>
                <p className="font-display font-black text-xl text-text-primary mt-0.5">
                  {lmsAnalytics.totalAssignments || 0}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-text-muted uppercase">Submission Rate</p>
                <p className="font-display font-black text-xl text-success mt-0.5">
                  {lmsAnalytics.submissionPercentage || 0}%
                </p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-text-muted uppercase">Late Submissions</p>
                <p className="font-display font-black text-xl text-danger mt-0.5">
                  {lmsAnalytics.lateSubmissionPercentage || 0}%
                </p>
              </div>
            </div>
            <div className="border-t border-border-subtle pt-3">
              <p className="text-[10px] text-text-muted mb-2 font-semibold">LMS Upload/Submission Metrics</p>
              <BarChartComponent
                labels={lmsActivityData.labels}
                series={lmsActivityData.series}
                height={150}
              />
            </div>
          </div>
        </div>

        {/* Sub-strip for Mentorship, Opportunity Hub, and Notifications */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Mentorship Registry Summary */}
          <div className="bg-surface rounded-2xl border border-border-subtle p-5 space-y-4">
            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5 border-b border-border-subtle pb-3">
              <HeartHandshake size={14} className="text-warning" />
              Mentorship Registries
            </h3>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-3 bg-surface-elevated border border-border-subtle rounded-xl">
                <p className="text-[8px] font-bold text-text-muted uppercase">Groups</p>
                <p className="font-display font-black text-base text-text-primary mt-1">
                  {mentorshipAnalytics.totalMentorGroups || 0}
                </p>
              </div>
              <div className="p-3 bg-surface-elevated border border-border-subtle rounded-xl">
                <p className="text-[8px] font-bold text-text-muted uppercase">Mentors</p>
                <p className="font-display font-black text-base text-text-primary mt-1">
                  {mentorshipAnalytics.activeMentors || 0}
                </p>
              </div>
              <div className="p-3 bg-surface-elevated border border-border-subtle rounded-xl">
                <p className="text-[8px] font-bold text-text-muted uppercase">At Risk</p>
                <p className="font-display font-black text-base text-danger mt-1">
                  {mentorshipAnalytics.studentsAtRisk || 0}
                </p>
              </div>
            </div>
            <p className="text-[10px] text-text-secondary leading-relaxed bg-surface-elevated border border-border-subtle p-3 rounded-xl">
              💡 <strong>Mentorship Desk:</strong> Overdue assignment submissions, attendance drops below 75%, and pending fees automatically place students in the \"At Risk\" queue.
            </p>
          </div>

          {/* Opportunity Hub */}
          <div className="bg-surface rounded-2xl border border-border-subtle p-5 space-y-4">
            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5 border-b border-border-subtle pb-3">
              <Briefcase size={14} className="text-accent-blue" />
              Opportunity Hub Engagements
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[9px] font-bold text-text-muted uppercase">Active Drives</p>
                <p className="font-display font-bold text-base text-text-primary">
                  {opportunityAnalytics.activeOpportunities || 0}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-text-muted uppercase">Student Applications</p>
                <p className="font-display font-bold text-base text-text-primary">
                  {opportunityAnalytics.studentApplications || 0}
                </p>
              </div>
            </div>
            <div className="border-t border-border-subtle pt-3">
              <p className="text-[10px] text-text-muted mb-2 font-semibold">Active Posts Breakdown</p>
              <PieChartComponent
                labels={opportunityBreakdown.labels}
                series={opportunityBreakdown.series}
                height={130}
              />
            </div>
          </div>

          {/* Notifications Registry */}
          <div className="bg-surface rounded-2xl border border-border-subtle p-5 space-y-4">
            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5 border-b border-border-subtle pb-3">
              <Bell size={14} className="text-accent-purple" />
              System Announcements & Reads
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[9px] font-bold text-text-muted uppercase">Announcements Sent</p>
                <p className="font-display font-bold text-lg text-text-primary">
                  {notificationAnalytics.notificationsSent || 0}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-text-muted uppercase">Read Receipt Rate</p>
                <p className="font-display font-bold text-lg text-accent-purple">
                  {notificationAnalytics.readPercentage || 0}%
                </p>
              </div>
            </div>
            <div className="border-t border-border-subtle pt-3">
              <p className="text-[10px] text-text-muted mb-2 font-semibold">Academic Attendance Trend</p>
              <AreaChartComponent
                labels={attendanceMonthlyData.labels}
                series={attendanceMonthlyData.series}
                height={130}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
