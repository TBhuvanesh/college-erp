"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { FeedbackBarChart } from "@/components/Feedback/FeedbackCharts";
import { AnonymousCommentList } from "@/components/Feedback/AnonymousCommentList";
import { getCampaignAnalytics, CampaignAnalytics, statusBadgeClasses } from "@/lib/feedback";
import { Calendar, ClipboardList, Loader2, Star, Users, TrendingUp } from "lucide-react";

interface MyCampaign {
  campaignId: string;
  title: string;
  status: string;
  eligibleStudents: number;
  submittedCount: number;
  completionPercent: number;
}

export default function FacultyFeedbackDashboard() {
  const { accessToken } = useAuth();
  const [myCampaigns, setMyCampaigns] = useState<MyCampaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [analytics, setAnalytics] = useState<CampaignAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCampaigns = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await apiFetch("/dashboard/faculty", {}, accessToken);
      if (res.success) {
        const list: MyCampaign[] = res.data?.feedbackOverview?.campaigns || [];
        setMyCampaigns(list);
        if (list.length > 0) setSelectedCampaign(list[0].campaignId);
      }
    } catch (err) {
      console.error("Failed to load faculty feedback campaigns", err);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  const loadAnalytics = useCallback(async () => {
    if (!accessToken || !selectedCampaign) return;
    setAnalyticsLoading(true);
    setError(null);
    try {
      const result = await getCampaignAnalytics(selectedCampaign, {}, accessToken);
      setAnalytics(result);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load analytics.");
    } finally {
      setAnalyticsLoading(false);
    }
  }, [accessToken, selectedCampaign]);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  useEffect(() => {
    if (selectedCampaign) loadAnalytics();
  }, [selectedCampaign, loadAnalytics]);

  const ratingQuestions = (analytics?.questions || []).filter((q) => q.questionType === "rating");
  const overallAvg = useMemo(() => {
    if (ratingQuestions.length === 0) return 0;
    return Math.round((ratingQuestions.reduce((acc, q) => acc + (q.averageRating || 0), 0) / ratingQuestions.length) * 100) / 100;
  }, [ratingQuestions]);
  const comments = (analytics?.questions || []).find((q) => q.questionType === "text")?.textComments || [];
  const selected = myCampaigns.find((c) => c.campaignId === selectedCampaign);

  if (loading) {
    return (
      <div className="flex h-[350px] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 w-full max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 rounded-2xl border border-border-subtle bg-surface shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ClipboardList className="text-purple-500 h-5 w-5" />
            <h1 className="font-display font-bold text-xl text-text-primary leading-none">Faculty Feedback Insights</h1>
          </div>
          <p className="text-xs text-text-muted">
            Only campaigns targeting your own assigned subjects are shown. Individual student identities remain confidential.
          </p>
        </div>

        {myCampaigns.length > 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-border-subtle bg-background px-3 py-2 text-xs text-text-secondary w-full md:w-auto">
            <Calendar size={14} className="text-text-muted shrink-0" />
            <select
              value={selectedCampaign}
              onChange={(e) => setSelectedCampaign(e.target.value)}
              className="bg-transparent focus:outline-none pr-6 font-semibold w-full"
            >
              {myCampaigns.map((c) => (
                <option key={c.campaignId} value={c.campaignId}>{c.title} ({c.status})</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {myCampaigns.length === 0 ? (
        <div className="rounded-2xl border border-border-subtle bg-surface p-10 text-center text-text-muted text-sm">
          No feedback campaigns currently target subjects you teach.
        </div>
      ) : (
        <>
          {selected && (
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider border ${statusBadgeClasses(selected.status as any)}`}>
              {selected.status}
            </span>
          )}

          {analyticsLoading ? (
            <div className="flex h-[250px] w-full items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : error ? (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-xs text-red-500 font-medium">{error}</div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-border-subtle bg-surface p-5 flex items-center justify-between shadow-sm">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">Overall Rating</p>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <p className="font-display font-black text-3xl text-text-primary">{overallAvg}</p>
                      <p className="text-xs text-text-muted">/5</p>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                    <Star size={18} className="fill-amber-500" />
                  </div>
                </div>

                <div className="rounded-2xl border border-border-subtle bg-surface p-5 flex items-center justify-between shadow-sm">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">Eligible / Submitted</p>
                    <p className="font-display font-bold text-2xl text-text-primary mt-0.5">
                      {analytics?.summary.submittedCount ?? 0} / {analytics?.summary.eligibleStudents ?? 0}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                    <Users size={18} />
                  </div>
                </div>

                <div className="rounded-2xl border border-border-subtle bg-surface p-5 flex items-center justify-between shadow-sm">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">Completion</p>
                    <p className="font-display font-bold text-2xl text-text-primary mt-0.5">{analytics?.summary.completionPercent ?? 0}%</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                    <TrendingUp size={18} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-8 rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm space-y-4">
                  <h2 className="font-display font-bold text-sm text-text-primary uppercase tracking-wider">Question-Wise Ratings</h2>
                  {ratingQuestions.length > 0 ? (
                    <FeedbackBarChart
                      data={ratingQuestions.map((q) => ({ question_text: q.questionText, average_rating: q.averageRating || 0 }))}
                      xKey="question_text"
                      yKey="average_rating"
                    />
                  ) : (
                    <p className="text-xs text-text-muted py-10 text-center">No rating responses yet.</p>
                  )}
                </div>
                <div className="lg:col-span-4 rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm">
                  <AnonymousCommentList comments={comments.map((text_value, i) => ({ id: String(i), text_value }))} />
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
