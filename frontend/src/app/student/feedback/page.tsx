"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { SubjectFeedbackCard, SubjectFeedbackData } from "@/components/Feedback/SubjectFeedbackCard";
import { AlertCircle, Calendar, CheckCircle2, ClipboardList, Loader2 } from "lucide-react";

export default function StudentFeedbackDashboard() {
  const { accessToken } = useAuth();
  const [activeWindow, setActiveWindow] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch active feedback windows
      const windowRes = await apiFetch("/feedback/active-windows", {}, accessToken);
      const activeWin = windowRes.success && windowRes.data?.length > 0 ? windowRes.data[0] : null;
      setActiveWindow(activeWin);

      if (activeWin) {
        // 2. Fetch templates, student's registered subjects, and existing submissions in parallel
        const [templatesRes, subjectsRes, submissionsRes] = await Promise.all([
          apiFetch("/feedback/templates", {}, accessToken),
          apiFetch("/attendance/summary", {}, accessToken),
          apiFetch(`/feedback/my-submissions?windowId=${activeWin.id}`, {}, accessToken)
        ]);

        if (templatesRes.success) setTemplates(templatesRes.data || []);
        if (subjectsRes.success && subjectsRes.subjects) setSubjects(subjectsRes.subjects || []);
        if (submissionsRes.success) setSubmissions(submissionsRes.data || []);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load feedback dashboard data.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
        <h3 className="font-display font-bold text-red-500 text-sm">Error Loading Dashboard</h3>
        <p className="text-xs text-text-secondary mt-1">{error}</p>
        <button 
          onClick={loadData}
          className="mt-4 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-semibold rounded-xl transition-all"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!activeWindow) {
    return (
      <div className="rounded-2xl border border-border-subtle bg-surface p-8 text-center max-w-md mx-auto mt-10 space-y-4 shadow-sm">
        <div className="mx-auto w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-text-muted">
          <Calendar size={24} />
        </div>
        <div className="space-y-1">
          <h3 className="font-display font-bold text-base text-text-primary">No Active Evaluation Cycle</h3>
          <p className="text-xs text-text-muted leading-relaxed">
            There is currently no active academic feedback window. You will be notified by email/notifications once an evaluation window opens.
          </p>
        </div>
      </div>
    );
  }

  // Find the template mappings for rendering evaluation.
  // We assume a standard mapping where we have templates for faculty, course, and lms.
  const facultyTemplate = templates.find(t => t.type === "faculty");
  const courseTemplate = templates.find(t => t.type === "course");
  const lmsTemplate = templates.find(t => t.type === "lms");

  // Construct UI list items
  const feedbackItems: SubjectFeedbackData[] = subjects.map((sub: any) => {
    // Check if student completed feedback for this subject
    // We consider it completed if they submitted faculty, course, and lms feedback types
    const hasFacultySub = submissions.some(s => s.subject_id === sub.subjectId && s.feedback_type === "faculty");
    const hasCourseSub = submissions.some(s => s.subject_id === sub.subjectId && s.feedback_type === "course");
    const hasLmsSub = submissions.some(s => s.subject_id === sub.subjectId && s.feedback_type === "lms");

    const isCompleted = hasFacultySub && hasCourseSub && hasLmsSub;

    return {
      subjectId: sub.subjectId,
      subjectName: sub.subjectName,
      subjectCode: sub.subjectCode,
      facultyId: sub.facultyId || "",
      facultyName: sub.facultyName || "Assigned Faculty",
      isCompleted,
      deadline: activeWindow.end_date,
      windowId: activeWindow.id,
      templateId: facultyTemplate?.id || "" // The template list resolves inside submit page
    };
  });

  const completedCount = feedbackItems.filter(item => item.isCompleted).length;
  const pendingCount = feedbackItems.length - completedCount;

  return (
    <div className="space-y-6 pb-12 w-full max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl border border-border-subtle bg-surface shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ClipboardList className="text-blue-500 h-5 w-5" />
            <h1 className="font-display font-bold text-xl text-text-primary leading-none">
              Academic Feedback & Evaluation
            </h1>
          </div>
          <p className="text-xs text-text-muted">
            Evaluate your course content, faculty members, and learning systems anonymously.
          </p>
        </div>

        {/* Window Active Banner */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/15">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
          <span>Active Window: {activeWindow.title}</span>
        </div>
      </div>

      {/* Progress Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-border-subtle bg-surface p-5 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">Awaiting Feedback</p>
            <p className="font-display font-bold text-2xl text-text-primary">{pendingCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">
            P
          </div>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface p-5 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">Evaluated Subjects</p>
            <p className="font-display font-bold text-2xl text-emerald-600 dark:text-emerald-450">{completedCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 size={18} />
          </div>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface p-5 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">Evaluation Deadline</p>
            <p className="font-display font-bold text-sm text-text-primary mt-1">
              {new Date(activeWindow.end_date).toLocaleString()}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-650 dark:text-red-400 flex items-center justify-center text-xs font-bold">
            EXP
          </div>
        </div>
      </div>

      {/* Subjects Grid */}
      <div className="space-y-3">
        <h2 className="font-display font-bold text-sm text-text-primary uppercase tracking-wider">
          Enrolled Subjects for Evaluation ({feedbackItems.length})
        </h2>

        {feedbackItems.length === 0 ? (
          <div className="rounded-2xl border border-border-subtle bg-surface p-10 text-center text-text-muted">
            No subjects currently registered in your study planner.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {feedbackItems.map((item) => (
              <SubjectFeedbackCard key={item.subjectId} subject={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
