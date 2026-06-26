"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import {
  listMaterials,
  listAssignments,
  listSubmissions,
  downloadLmsFile,
  CourseMaterial,
  Assignment,
  Submission,
} from "@/lib/lms";
import {
  BookOpen,
  FileText,
  Calendar,
  Clock,
  MessageSquare,
  Award,
  Download,
  Loader2,
  AlertCircle,
  ChevronRight,
  Sparkles,
} from "lucide-react";

interface SubjectItem {
  id: string;
  name: string;
  code: string;
  semester?: number;
  section?: string;
}

export const LMSDashboard: React.FC = () => {
  const { user, accessToken } = useAuth();
  const role = user?.role || "student";

  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [materials, setMaterials] = useState<CourseMaterial[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [feedback, setFeedback] = useState<Submission[]>([]);

  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubjects = useCallback(async () => {
    if (!accessToken) return;
    setLoadingSubjects(true);
    try {
      if (role === "admin") {
        const res = await apiFetch("/subjects?limit=100", {}, accessToken);
        if (res.success && res.data?.subjects) {
          setSubjects(
            res.data.subjects.map((s: any) => ({
              id: s.id,
              name: s.name,
              code: s.code,
              semester: s.semester,
            }))
          );
        }
      } else if (role === "faculty") {
        const res = await apiFetch("/attendance/my-assignments", {}, accessToken);
        if (res.success && res.data?.assignments) {
          setSubjects(
            res.data.assignments
              .filter((a: any) => a.isActive)
              .map((a: any) => ({
                id: a.subjectId,
                name: a.subjectName,
                code: a.subjectCode,
                semester: a.semester,
                section: a.section,
              }))
          );
        }
      } else {
        // Student
        const res = await apiFetch("/attendance/summary", {}, accessToken);
        if (res.success && res.subjects) {
          setSubjects(
            res.subjects.map((s: any) => ({
              id: s.subjectId,
              name: s.subjectName,
              code: s.subjectCode,
              semester: s.semester,
            }))
          );
        }
      }
    } catch (err: any) {
      console.error("Failed to load LMS subjects", err);
      setError("Failed to initialize course modules.");
    } finally {
      setLoadingSubjects(false);
    }
  }, [accessToken, role]);

  const fetchLmsData = useCallback(async () => {
    if (!accessToken) return;
    setLoadingData(true);
    try {
      const [matRes, assignRes] = await Promise.all([
        listMaterials({ page: 1, limit: 5 }, accessToken),
        listAssignments({ page: 1, limit: 5 }, accessToken),
      ]);

      setMaterials(matRes.materials || []);
      setAssignments(assignRes.assignments || []);

      if (role === "student") {
        const subRes = await listSubmissions({ status: "Evaluated", page: 1, limit: 5 }, accessToken);
        setFeedback(subRes.submissions || []);
      }
    } catch (err: any) {
      console.error("Failed to load LMS dashboard logs", err);
    } finally {
      setLoadingData(false);
    }
  }, [accessToken, role]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSubjects();
      fetchLmsData();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchSubjects, fetchLmsData]);

  const handleDownload = async (mat: CourseMaterial) => {
    try {
      await downloadLmsFile(mat.downloadUrl, mat.fileName, accessToken!);
    } catch {
      alert("Download failed.");
    }
  };

  const getDeadlineStatus = (dueDateStr: string) => {
    const due = new Date(dueDateStr);
    const now = new Date();
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffTime < 0) {
      return { label: "Closed", style: "bg-rose-500/10 text-rose-455 border-rose-500/20" };
    }
    if (diffDays <= 2) {
      return { label: "Due Soon", style: "bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse" };
    }
    return { label: "Open", style: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" };
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1">
          <span className="text-[9px] uppercase font-bold text-blue-500 tracking-wider font-mono">
            LMS Module
          </span>
          <h2 className="font-display font-bold text-2xl text-white flex items-center gap-2">
            <BookOpen size={24} className="text-neutral-400" />
            <span>Learning Management Dashboard</span>
          </h2>
          <p className="text-xs text-neutral-400">
            Access course syllabi, download learning materials, and submit classroom assignments.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-455 text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Grid: Subjects and Feeds */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Subjects (span 2) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card border border-neutral-800 rounded-xl p-5">
            <h3 className="font-display font-bold text-white text-base mb-4 flex items-center gap-2">
              <BookOpen size={16} className="text-blue-455" />
              <span>Registered Subject Courseware</span>
            </h3>

            {loadingSubjects ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="animate-spin text-blue-500" size={28} />
              </div>
            ) : subjects.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {subjects.map((sub) => (
                  <Link
                    key={sub.id + (sub.section || "")}
                    href={`/${role}/lms/${sub.id}`}
                    className="p-4 rounded-xl bg-neutral-950/45 hover:bg-neutral-800/40 border border-neutral-900 hover:border-neutral-700 transition flex flex-col justify-between group select-none cursor-pointer"
                  >
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] text-neutral-500 font-mono">
                          {sub.code}
                        </span>
                        {sub.section && (
                          <span className="text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded font-bold font-mono">
                            Sec {sub.section}
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors leading-tight">
                        {sub.name}
                      </h4>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-neutral-500 font-mono border-t border-neutral-950 pt-3 mt-4">
                      <span>Semester {sub.semester}</span>
                      <span className="flex items-center gap-0.5 text-blue-400 group-hover:underline">
                        <span>Open LMS</span>
                        <ChevronRight size={10} />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-neutral-500 font-mono italic">
                No active subject curriculum assignments found.
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Activity Feeds (span 1) */}
        <div className="space-y-6">
          
          {/* Upcoming Assignments */}
          <div className="glass-card border border-neutral-800 rounded-xl p-5">
            <h3 className="font-display font-bold text-white text-sm mb-4 border-b border-neutral-850 pb-2 flex items-center gap-2">
              <Calendar size={14} className="text-amber-500" />
              <span>Assignment Deadlines</span>
            </h3>

            {loadingData ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              </div>
            ) : assignments.length > 0 ? (
              <div className="space-y-3">
                {assignments.map((assign) => {
                  const deadline = getDeadlineStatus(assign.dueDate);
                  return (
                    <Link
                      key={assign.id}
                      href={`/${role}/lms/${assign.subjectId}`}
                      className="block p-3 bg-neutral-950/40 hover:bg-neutral-800/40 border border-neutral-900 rounded-lg space-y-2 group transition-colors cursor-pointer"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-bold text-white group-hover:text-amber-500 text-xs block leading-tight truncate max-w-[150px] transition-colors">
                          {assign.title}
                        </span>
                        <span
                          className={`text-[8px] border px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${deadline.style}`}
                        >
                          {deadline.label}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[9px] text-neutral-500 font-mono">
                        <span>{assign.subjectCode}</span>
                        <span className="flex items-center gap-0.5">
                          <Clock size={10} />
                          {formatDate(assign.dueDate)}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-neutral-600 font-mono italic text-xs">
                No active assignments listed.
              </div>
            )}
          </div>

          {/* Recent Course Materials */}
          <div className="glass-card border border-neutral-800 rounded-xl p-5">
            <h3 className="font-display font-bold text-white text-sm mb-4 border-b border-neutral-850 pb-2 flex items-center gap-2">
              <FileText size={14} className="text-indigo-400" />
              <span>Recent Materials</span>
            </h3>

            {loadingData ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              </div>
            ) : materials.length > 0 ? (
              <div className="space-y-3">
                {materials.map((mat) => (
                  <div
                    key={mat.id}
                    className="p-3 bg-neutral-950/40 border border-neutral-900 rounded-lg flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/${role}/lms/${mat.subjectId}`}
                        className="font-semibold text-white hover:text-indigo-400 block leading-tight truncate transition-colors"
                      >
                        {mat.title}
                      </Link>
                      <span className="text-[9px] text-neutral-500 font-mono mt-1 block">
                        {mat.subjectCode} • {mat.fileType.toUpperCase()}
                      </span>
                    </div>

                    <button
                      onClick={() => handleDownload(mat)}
                      className="p-1.5 rounded bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 text-neutral-400 hover:text-white transition cursor-pointer"
                      title="Download resource file"
                    >
                      <Download size={12} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-neutral-600 font-mono italic text-xs">
                No syllabus resources uploaded.
              </div>
            )}
          </div>

          {/* Recent Evaluations Feedback (Student Only) */}
          {role === "student" && (
            <div className="glass-card border border-neutral-800 rounded-xl p-5">
              <h3 className="font-display font-bold text-white text-sm mb-4 border-b border-neutral-850 pb-2 flex items-center gap-2">
                <MessageSquare size={14} className="text-emerald-400" />
                <span>Recent Feedback</span>
              </h3>

              {loadingData ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                </div>
              ) : feedback.length > 0 ? (
                <div className="space-y-3">
                  {feedback.map((feed) => (
                    <div
                      key={feed.id}
                      className="p-3 bg-neutral-950/40 border border-neutral-900 rounded-lg space-y-2 text-xs"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-bold text-white block leading-tight truncate max-w-[150px]">
                          {feed.assignmentTitle}
                        </span>
                        <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-semibold font-mono">
                          {feed.marks}/{feed.assignmentMaxMarks}
                        </span>
                      </div>
                      <p className="text-[10px] text-neutral-400 leading-normal italic font-sans">
                        &quot;{feed.feedback || "No comment remarks entered."}&quot;
                      </p>
                      <span className="text-[8px] text-neutral-500 block font-mono">
                        Graded By: {feed.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-neutral-600 font-mono italic text-xs">
                  No evaluated assignments.
                </div>
              )}
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
