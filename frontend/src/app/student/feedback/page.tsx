"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { getMyCampaigns, StudentCampaignView } from "@/lib/feedback";
import { SubjectFeedbackCard, CampaignFeedbackItemData } from "@/components/Feedback/SubjectFeedbackCard";
import { AlertCircle, Calendar, CheckCircle2, ClipboardList, Loader2 } from "lucide-react";

export default function StudentFeedbackDashboard() {
  const { accessToken } = useAuth();
  const [campaigns, setCampaigns] = useState<StudentCampaignView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getMyCampaigns(accessToken);
      setCampaigns(data);
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
        <button onClick={loadData} className="mt-4 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-semibold rounded-xl transition-all">
          Try Again
        </button>
      </div>
    );
  }

  // Flatten campaign items into feedback cards — only campaigns/items this
  // student is actually eligible for ever reach this list (server-resolved).
  const items: CampaignFeedbackItemData[] = campaigns.flatMap((c) => {
    const now = Date.now();
    const isOpen = c.status === "open" && now <= new Date(c.endDate).getTime();
    return c.items.map((item) => ({
      campaignId: c.campaignId,
      campaignTitle: c.title,
      subjectId: item.subjectId,
      subjectCode: item.subjectCode,
      facultyId: item.facultyId,
      facultyName: item.facultyName,
      submitted: item.submitted,
      deadline: c.endDate,
      isOpen,
    }));
  });

  const pendingItems = items.filter((i) => !i.submitted);
  const completedItems = items.filter((i) => i.submitted);
  const nextDeadline = pendingItems.length > 0
    ? pendingItems.reduce((min, i) => (i.deadline < min ? i.deadline : min), pendingItems[0].deadline)
    : null;

  return (
    <div className="space-y-6 pb-12 w-full max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl border border-border-subtle bg-surface shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ClipboardList className="text-blue-500 h-5 w-5" />
            <h1 className="font-display font-bold text-xl text-text-primary leading-none">Academic Feedback & Evaluation</h1>
          </div>
          <p className="text-xs text-text-muted">
            Evaluate your course content, faculty members, and learning systems anonymously. Only campaigns that apply to you are shown here.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/15">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
          <span>{campaigns.length} Active Campaign{campaigns.length === 1 ? "" : "s"}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-border-subtle bg-surface p-5 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">Awaiting Feedback</p>
            <p className="font-display font-bold text-2xl text-text-primary">{pendingItems.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">P</div>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface p-5 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">Evaluated</p>
            <p className="font-display font-bold text-2xl text-emerald-600 dark:text-emerald-450">{completedItems.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 size={18} />
          </div>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface p-5 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">Nearest Deadline</p>
            <p className="font-display font-bold text-sm text-text-primary mt-1">
              {nextDeadline ? new Date(nextDeadline).toLocaleString() : "—"}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-650 dark:text-red-400 flex items-center justify-center text-xs font-bold">EXP</div>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="font-display font-bold text-sm text-text-primary uppercase tracking-wider">
          Pending & Completed Feedback ({items.length})
        </h2>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-border-subtle bg-surface p-10 text-center space-y-3 text-text-muted">
            <Calendar className="mx-auto h-8 w-8 opacity-50" />
            <p>No feedback campaigns currently apply to you. You&apos;ll be notified when a new one opens.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item, idx) => (
              <SubjectFeedbackCard key={`${item.campaignId}-${item.subjectId ?? "general"}-${idx}`} subject={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
