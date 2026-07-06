"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { BookOpen, Calendar, CheckCircle2, Loader2 } from "lucide-react";

interface AssignmentDetail {
  id: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  semester: number;
  section: string;
  isActive: boolean;
}

interface AttendanceRecord {
  subjectId: string;
  status: "present" | "absent";
}

export default function FacultySubjects() {
  const { accessToken } = useAuth();
  const [assignments, setAssignments] = useState<AssignmentDetail[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [rosterCounts, setRosterCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const todayStr = useMemo(() => new Date().toLocaleDateString("en-CA"), []);

  const loadWorkload = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const assignmentRes = await apiFetch("/attendance/my-assignments", {}, accessToken);
      const activeAssignments: AssignmentDetail[] = assignmentRes.success && assignmentRes.data?.assignments
        ? assignmentRes.data.assignments.filter((a: AssignmentDetail) => a.isActive)
        : [];
      setAssignments(activeAssignments);

      const attendanceRes = await apiFetch("/attendance?limit=1000", {}, accessToken);
      setAttendanceRecords(
        attendanceRes.success && attendanceRes.data?.records ? attendanceRes.data.records : []
      );

      const counts = await Promise.all(
        activeAssignments.map(async (assignment) => {
          const params = new URLSearchParams({
            subjectId: assignment.subjectId,
            section: assignment.section,
            date: todayStr,
          });
          try {
            const rosterRes = await apiFetch(`/attendance/roster?${params.toString()}`, {}, accessToken);
            return [assignment.id, rosterRes.data?.total || 0] as const;
          } catch {
            return [assignment.id, 0] as const;
          }
        })
      );
      setRosterCounts(Object.fromEntries(counts));
    } finally {
      setLoading(false);
    }
  }, [accessToken, todayStr]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadWorkload();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadWorkload]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 dark:text-neutral-400 text-text-secondary">
        <Loader2 className="animate-spin text-blue-500 mb-3" size={30} />
        <span className="font-mono text-xs">Loading faculty workload mappings...</span>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-display font-bold text-2xl dark:text-white text-text-primary">Teaching Workload</h2>
        <p className="text-xs dark:text-neutral-400 text-text-secondary mt-1">Review active subject codes, student allocations, and historical attendance rates linked to your profile.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {assignments.length > 0 ? (
          assignments.map(sub => {
            const logs = attendanceRecords.filter(l => l.subjectId === sub.subjectId);
            const totalLogs = logs.length;
            const presentLogs = logs.filter(l => l.status === "present").length;
            const avgAtt = totalLogs > 0 ? ((presentLogs / totalLogs) * 100).toFixed(0) : "100";

            return (
              <div key={sub.id} className="glass-card border border-border-subtle rounded-xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg dark:bg-blue-500/10 bg-blue-50 border dark:border-blue-500/25 border-blue-200 flex items-center justify-center dark:text-blue-400 text-blue-750">
                        <BookOpen size={18} />
                      </div>
                      <div>
                        <h3 className="font-bold dark:text-white text-text-primary text-sm leading-tight">{sub.subjectName}</h3>
                        <span className="text-[10px] dark:text-neutral-500 text-text-muted font-mono mt-0.5 block">Course Code: {sub.subjectCode}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 py-3 border-y dark:border-neutral-900 border-border-subtle mb-4 text-center">
                    <div>
                      <span className="text-[9px] dark:text-neutral-500 text-text-muted uppercase font-bold tracking-wide">Semester</span>
                      <span className="block text-xs font-semibold dark:text-white text-text-primary mt-0.5">Semester {sub.semester}</span>
                    </div>
                    <div>
                      <span className="text-[9px] dark:text-neutral-500 text-text-muted uppercase font-bold tracking-wide">Enrolled</span>
                      <span className="block text-xs font-semibold dark:text-white text-text-primary mt-0.5">{rosterCounts[sub.id] || 0} Students</span>
                    </div>
                    <div>
                      <span className="text-[9px] dark:text-neutral-500 text-text-muted uppercase font-bold tracking-wide">Avg Attendance</span>
                      <span className={`block text-xs font-bold mt-0.5 ${parseInt(avgAtt) >= 75 ? "dark:text-emerald-400 text-emerald-700" : "dark:text-rose-400 text-rose-700"}`}>{avgAtt}%</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] dark:text-neutral-400 text-text-secondary font-mono">
                    <Calendar size={12} className="dark:text-neutral-500 text-text-muted" />
                    <span>Total sessions logged to date: {totalLogs}</span>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t dark:border-neutral-900 border-border-subtle flex items-center justify-between text-[10px] dark:text-neutral-500 text-text-muted font-mono">
                  <span>Class: Sec {sub.section} - Semester {sub.semester}</span>
                  <span className="dark:text-emerald-500 text-emerald-700 flex items-center gap-1 font-sans font-bold">
                    <CheckCircle2 size={12} />
                    <span>Active Syllabus</span>
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full text-center py-10 glass-card border border-border-subtle dark:text-neutral-500 text-text-muted font-mono">
            No subjects assigned to your teaching profile.
          </div>
        )}
      </div>
    </div>
  );
}
