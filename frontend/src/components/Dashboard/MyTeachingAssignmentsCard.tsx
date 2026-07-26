"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { BookOpen, Loader2, ClipboardList, CalendarDays, FolderOpen, FileSpreadsheet, Award } from "lucide-react";

interface TeachingAssignment {
  id: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  section: string;
  academicYear: string;
  status: "active" | "inactive" | "pending";
}

// The single place a faculty member sees "which subjects/sections am I
// teaching" — every downstream module (Teaching Planner, Attendance, LMS,
// Results) is reached from here instead of a faculty manually searching for
// their subject in each module separately.
export function MyTeachingAssignmentsCard() {
  const { accessToken } = useAuth();
  const [assignments, setAssignments] = useState<TeachingAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    (async () => {
      setLoading(true);
      try {
        const res = await apiFetch("/teaching-assignments/my", {}, accessToken);
        if (res.success && res.data?.teachingAssignments) {
          setAssignments(res.data.teachingAssignments.filter((a: TeachingAssignment) => a.status === "active"));
        }
      } catch {
        // Non-fatal — the rest of the dashboard doesn't depend on this card.
      } finally {
        setLoading(false);
      }
    })();
  }, [accessToken]);

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-sm text-text-primary uppercase tracking-wider flex items-center gap-1.5">
          <BookOpen size={14} className="text-blue-500" />
          <span>My Teaching Assignments</span>
        </h3>
        <span className="text-[10px] text-text-muted font-mono">{assignments.length} active</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-text-muted">
          <Loader2 className="animate-spin" size={18} />
        </div>
      ) : assignments.length === 0 ? (
        <p className="text-xs text-text-muted py-4 text-center">
          No active teaching assignments yet. Contact your department admin.
        </p>
      ) : (
        <div className="space-y-2">
          {assignments.map((a) => (
            <div key={a.id} className="rounded-xl border border-border-subtle p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-text-primary">
                    {a.subjectCode} — {a.subjectName}
                  </div>
                  <div className="text-[10px] text-text-muted mt-0.5">
                    Section {a.section} · {a.academicYear}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Link
                  href="/faculty/teaching-planner"
                  className="text-[10px] font-semibold px-2 py-1 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 flex items-center gap-1"
                >
                  <ClipboardList size={10} /> Planner
                </Link>
                <Link
                  href="/faculty/attendance"
                  className="text-[10px] font-semibold px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 flex items-center gap-1"
                >
                  <CalendarDays size={10} /> Attendance
                </Link>
                <Link
                  href={`/faculty/lms/${a.subjectId}`}
                  className="text-[10px] font-semibold px-2 py-1 rounded-md bg-violet-500/10 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 flex items-center gap-1"
                >
                  <FolderOpen size={10} /> LMS
                </Link>
                <Link
                  href="/faculty/results"
                  className="text-[10px] font-semibold px-2 py-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 flex items-center gap-1"
                >
                  <Award size={10} /> Results
                </Link>
                <Link
                  href="/faculty/grades"
                  className="text-[10px] font-semibold px-2 py-1 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 flex items-center gap-1"
                >
                  <FileSpreadsheet size={10} /> Internal Marks
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
