"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Users, 
  Loader2, 
  AlertCircle,
  Search,
  Filter,
  ArrowLeft,
  ChevronRight,
  TrendingUp,
  Percent,
  CreditCard,
  FileText,
  AlertTriangle,
  HelpCircle,
  BookmarkCheck
} from "lucide-react";

interface StudentProfile {
  id: string;
  name: string;
  rollNumber: string;
  department: string;
  semester: number;
  year: number;
  phoneNumber: string | null;
  parentContact: string | null;
  email: string;
}

interface StudentSummary {
  attendancePercentage: number;
  latestCGPA: number;
  internalMarksSummary: string;
  feeStatus: string;
  assignmentStatus: string;
}

interface StudentAlerts {
  attendanceBelow75: boolean;
  feePending: boolean;
  assignmentOverdue: boolean;
  failedSubjects: boolean;
  lowInternalMarks: boolean;
}

interface MenteeDashboardRow {
  profile: StudentProfile;
  summary: StudentSummary;
  alerts: StudentAlerts;
}

interface MentorGroup {
  id: string;
  mentorId: string;
  mentorName: string;
  departmentId: string;
  departmentName: string;
  year: number;
  semester: number;
  section: string;
  assignmentMethod: "range" | "section" | "manual";
  rollNumberStart: string | null;
  rollNumberEnd: string | null;
}

export default function FacultyMentorGroupDetailPage() {
  const { accessToken } = useAuth();
  const params = useParams();
  const router = useRouter();
  const groupId = params.groupId as string;

  // States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Data State
  const [group, setGroup] = useState<MentorGroup | null>(null);
  const [studentsInGroup, setStudentsInGroup] = useState<any[]>([]); // Resolved students list
  const [dashboardTelemetry, setDashboardTelemetry] = useState<MenteeDashboardRow[]>([]); // Telemetry data for this mentor's students
  
  // Filters
  const [search, setSearch] = useState("");
  const [attentionFilter, setAttentionFilter] = useState("ALL"); // ALL, ATTENTION, GOOD_STANDING

  const loadData = useCallback(async () => {
    if (!accessToken || !groupId) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch group details
      const groupsRes = await apiFetch("/mentor-groups", {}, accessToken);
      if (groupsRes.success && groupsRes.data) {
        const found = (groupsRes.data as MentorGroup[]).find(g => g.id === groupId);
        if (found) {
          setGroup(found);
        } else {
          throw new Error("Mentor group details not found");
        }
      }

      // 2. Fetch students who match this group dynamically
      const studentsRes = await apiFetch(`/mentor-groups/${groupId}/students`, {}, accessToken);
      if (studentsRes.success && studentsRes.data) {
        setStudentsInGroup(studentsRes.data);
      }

      // 3. Fetch all dashboard telemetry for this mentor
      const telemetryRes = await apiFetch("/mentorship/dashboard", {}, accessToken);
      if (telemetryRes.success && telemetryRes.data) {
        setDashboardTelemetry(telemetryRes.data);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load group details");
    } finally {
      setLoading(false);
    }
  }, [accessToken, groupId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Combine resolved student profiles with their dashboard telemetry details
  const groupMentees: MenteeDashboardRow[] = useMemo(() => {
    return studentsInGroup.map(student => {
      // Find matching telemetry row
      const teleRow = dashboardTelemetry.find(row => row.profile.id === student.id);
      if (teleRow) {
        return teleRow;
      }
      // Fallback dummy telemetry if no stats generated yet
      return {
        profile: {
          id: student.id,
          name: student.name,
          rollNumber: student.rollNumber,
          department: student.department || group?.departmentName || "CSE",
          semester: student.semester,
          year: student.year,
          phoneNumber: student.phoneNumber,
          parentContact: student.parentContact,
          email: student.email
        },
        summary: {
          attendancePercentage: 100,
          latestCGPA: 0,
          internalMarksSummary: "N/A",
          feeStatus: "Paid",
          assignmentStatus: "0/0"
        },
        alerts: {
          attendanceBelow75: false,
          feePending: false,
          assignmentOverdue: false,
          failedSubjects: false,
          lowInternalMarks: false
        }
      };
    });
  }, [studentsInGroup, dashboardTelemetry, group]);

  // Derived summaries for the group
  const groupMetrics = useMemo(() => {
    if (groupMentees.length === 0) {
      return {
        avgAttendance: 100,
        avgCGPA: 0,
        pendingFeesCount: 0,
        assignmentSubmitted: 0,
        assignmentTotal: 0,
        totalAlerts: 0,
        attentionCount: 0
      };
    }

    let totalAtt = 0;
    let totalCgpa = 0;
    let cgpaCount = 0;
    let pendingFees = 0;
    let submittedAssigns = 0;
    let totalAssigns = 0;
    let alertsSum = 0;
    let attentionSum = 0;

    groupMentees.forEach(m => {
      totalAtt += m.summary.attendancePercentage;
      
      if (m.summary.latestCGPA > 0) {
        totalCgpa += m.summary.latestCGPA;
        cgpaCount++;
      }

      if (m.alerts.feePending) {
        pendingFees++;
      }

      // Parse assignment status string (e.g. "4/5 Submitted")
      const matches = m.summary.assignmentStatus.match(/(\d+)\/(\d+)/);
      if (matches) {
        submittedAssigns += parseInt(matches[1], 10);
        totalAssigns += parseInt(matches[2], 10);
      }

      const activeAlertsCount = 
        (m.alerts.attendanceBelow75 ? 1 : 0) +
        (m.alerts.feePending ? 1 : 0) +
        (m.alerts.failedSubjects ? 1 : 0) +
        (m.alerts.assignmentOverdue ? 1 : 0) +
        (m.alerts.lowInternalMarks ? 1 : 0);

      alertsSum += activeAlertsCount;
      if (activeAlertsCount > 0) {
        attentionSum++;
      }
    });

    return {
      avgAttendance: Math.round(totalAtt / groupMentees.length),
      avgCGPA: cgpaCount > 0 ? Number((totalCgpa / cgpaCount).toFixed(2)) : 0,
      pendingFeesCount: pendingFees,
      assignmentSubmitted: submittedAssigns,
      assignmentTotal: totalAssigns,
      totalAlerts: alertsSum,
      attentionCount: attentionSum
    };
  }, [groupMentees]);

  // Filtered Student Mentees Listing
  const filteredMentees = useMemo(() => {
    return groupMentees.filter(m => {
      const searchLower = search.toLowerCase();
      const matchSearch = 
        m.profile.name.toLowerCase().includes(searchLower) ||
        m.profile.rollNumber.toLowerCase().includes(searchLower);
      if (!matchSearch) return false;

      const hasAlert = 
        m.alerts.attendanceBelow75 ||
        m.alerts.feePending ||
        m.alerts.failedSubjects ||
        m.alerts.assignmentOverdue ||
        m.alerts.lowInternalMarks;

      if (attentionFilter === "ATTENTION" && !hasAlert) return false;
      if (attentionFilter === "GOOD_STANDING" && hasAlert) return false;

      return true;
    });
  }, [groupMentees, search, attentionFilter]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 text-accent-blue animate-spin" />
        <p className="text-text-secondary text-sm">Loading group telemetry...</p>
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 p-6 max-w-md mx-auto text-center">
        <AlertCircle className="w-12 h-12 text-danger" />
        <h3 className="text-lg font-bold text-text-primary">Group Error</h3>
        <p className="text-text-secondary text-sm leading-normal">{error || "Group detail not found."}</p>
        <button 
          onClick={() => router.push("/faculty/mentorship")}
          className="mt-2 px-4 py-2 bg-accent-blue hover:bg-accent-blue/90 text-white rounded-lg text-sm font-semibold cursor-pointer inline-flex items-center gap-1"
        >
          <ArrowLeft size={14} /> Back to groups
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/faculty/mentorship")}
          className="p-1.5 rounded-lg border border-border-subtle bg-surface hover:bg-surface-hover text-text-secondary hover:text-text-primary cursor-pointer transition-colors"
          title="Back to Groups"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <span className="text-xs uppercase font-bold text-accent-blue">Mentor Group Details</span>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">
            {group.departmentName} — Section {group.section}
          </h1>
          <p className="text-text-secondary text-xs mt-0.5 font-semibold">
            Year {group.year} • Semester {group.semester} • {groupMentees.length} Students Assigned
          </p>
        </div>
      </div>

      {/* Group Telemetry Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Attendance Avg */}
        <div className="bg-surface border border-border-subtle rounded-xl p-4 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-accent-blue-soft text-accent-blue">
            <Percent size={20} />
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Average Attendance</span>
            <h3 className="text-xl sm:text-2xl font-black text-text-primary leading-tight mt-0.5">
              {groupMetrics.avgAttendance}%
            </h3>
          </div>
        </div>

        {/* Avg CGPA */}
        <div className="bg-surface border border-border-subtle rounded-xl p-4 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-success-soft text-success">
            <TrendingUp size={20} />
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Average CGPA</span>
            <h3 className="text-xl sm:text-2xl font-black text-success leading-tight mt-0.5">
              {groupMetrics.avgCGPA > 0 ? groupMetrics.avgCGPA.toFixed(2) : "N/A"}
            </h3>
          </div>
        </div>

        {/* Pending Fees */}
        <div className="bg-surface border border-border-subtle rounded-xl p-4 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-warning-soft text-warning">
            <CreditCard size={20} />
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Pending Fees</span>
            <h3 className="text-xl sm:text-2xl font-black text-warning leading-tight mt-0.5">
              {groupMetrics.pendingFeesCount} Students
            </h3>
          </div>
        </div>

        {/* Attention Needed count */}
        <div className="bg-surface border border-border-subtle rounded-xl p-4 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-danger-soft text-danger">
            <AlertTriangle size={20} />
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Needs Attention</span>
            <h3 className="text-xl sm:text-2xl font-black text-danger leading-tight mt-0.5">
              {groupMetrics.attentionCount} Mentees
            </h3>
          </div>
        </div>
      </div>

      {/* Filter and Search Container */}
      <div className="bg-surface border border-border-subtle rounded-xl p-4 shadow-sm flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
          <input
            type="text"
            placeholder="Search student by name or roll number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-background border border-border-subtle rounded-lg text-text-primary placeholder:text-text-muted focus:outline-hidden focus:border-accent-blue transition-colors"
          />
        </div>

        <select
          value={attentionFilter}
          onChange={(e) => setAttentionFilter(e.target.value)}
          className="py-2 px-3 text-xs bg-background border border-border-subtle rounded-lg text-text-primary focus:outline-hidden"
        >
          <option value="ALL">All Mentees</option>
          <option value="ATTENTION">Attention Required (Alert Active)</option>
          <option value="GOOD_STANDING">Good Standing Only</option>
        </select>
      </div>

      {/* Mentees Group Listing */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredMentees.length === 0 ? (
          <div className="col-span-full bg-surface border border-border-subtle rounded-xl py-12 text-center text-text-muted text-sm">
            No mentees match the current search or status filters.
          </div>
        ) : (
          filteredMentees.map((mentee) => {
            const activeAlertsCount = 
              (mentee.alerts.attendanceBelow75 ? 1 : 0) +
              (mentee.alerts.feePending ? 1 : 0) +
              (mentee.alerts.failedSubjects ? 1 : 0) +
              (mentee.alerts.assignmentOverdue ? 1 : 0) +
              (mentee.alerts.lowInternalMarks ? 1 : 0);

            return (
              <div 
                key={mentee.profile.id}
                className={`bg-surface border ${activeAlertsCount > 0 ? 'border-danger/35 hover:border-danger/60' : 'border-border-subtle hover:border-border-strong'} rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col`}
              >
                {/* Header info */}
                <div className="p-4 bg-surface-elevated/40 border-b border-border-subtle/50 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-bold text-text-primary text-sm sm:text-base leading-snug truncate">
                      {mentee.profile.name}
                    </h3>
                    <p className="text-xs font-mono text-text-muted mt-0.5">{mentee.profile.rollNumber}</p>
                  </div>
                  <div className="w-9 h-9 rounded-lg bg-accent-blue-soft border border-accent-blue/15 flex items-center justify-center font-bold text-accent-blue text-sm shrink-0">
                    {mentee.profile.name.charAt(0)}
                  </div>
                </div>

                {/* Metrics */}
                <div className="p-4 space-y-2 text-xs text-text-secondary flex-1">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1"><Percent size={13} /> Attendance</span>
                    <span className={`font-semibold ${mentee.summary.attendancePercentage < 75 ? 'text-danger font-bold' : 'text-text-primary'}`}>
                      {mentee.summary.attendancePercentage}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1"><TrendingUp size={13} /> CGPA</span>
                    <span className="font-semibold text-text-primary font-mono">{mentee.summary.latestCGPA > 0 ? mentee.summary.latestCGPA.toFixed(2) : "N/A"}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1"><FileText size={13} /> Internals</span>
                    <span className="font-semibold text-text-primary truncate max-w-[120px]">{mentee.summary.internalMarksSummary}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1"><CreditCard size={13} /> Fees</span>
                    <span className={`font-semibold ${mentee.alerts.feePending ? 'text-warning font-bold' : 'text-success'}`}>
                      {mentee.summary.feeStatus}
                    </span>
                  </div>

                  {/* Active Alert tags */}
                  {activeAlertsCount > 0 && (
                    <div className="border-t border-border-subtle/50 pt-2.5 mt-2 flex flex-wrap gap-1">
                      {mentee.alerts.attendanceBelow75 && (
                        <span className="text-[9px] bg-danger-soft text-danger border border-danger/10 px-1 py-0.5 rounded font-bold">Low Att</span>
                      )}
                      {mentee.alerts.feePending && (
                        <span className="text-[9px] bg-warning-soft text-warning border border-warning/10 px-1 py-0.5 rounded font-bold">Fees</span>
                      )}
                      {mentee.alerts.failedSubjects && (
                        <span className="text-[9px] bg-danger-soft text-danger border border-danger/10 px-1 py-0.5 rounded font-bold">Failed Subj</span>
                      )}
                      {mentee.alerts.assignmentOverdue && (
                        <span className="text-[9px] bg-danger-soft text-danger border border-danger/10 px-1 py-0.5 rounded font-bold">Overdue LMS</span>
                      )}
                      {mentee.alerts.lowInternalMarks && (
                        <span className="text-[9px] bg-warning-soft text-warning border border-warning/10 px-1 py-0.5 rounded font-bold">Internals</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Counselling Note Action */}
                <div className="p-3 bg-surface-elevated/25 border-t border-border-subtle/50 flex justify-end">
                  <Link
                    href={`/faculty/mentorship/${groupId}/${mentee.profile.id}`}
                    className="px-3 py-1.5 rounded bg-accent-blue/10 border border-accent-blue/20 hover:bg-accent-blue hover:text-white text-accent-blue text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all"
                  >
                    Counselling File <ChevronRight size={12} />
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
