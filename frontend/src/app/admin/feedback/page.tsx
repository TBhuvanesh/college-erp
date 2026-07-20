"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { FeedbackBarChart } from "@/components/Feedback/FeedbackCharts";
import { AnonymousCommentList } from "@/components/Feedback/AnonymousCommentList";
import { FeedbackTemplatesManager } from "@/components/Feedback/FeedbackTemplatesManager";
import { CampaignManager } from "@/components/Feedback/CampaignManager";
import { listCampaigns, getCampaignAnalytics, FeedbackCampaign, CampaignAnalytics, statusBadgeClasses } from "@/lib/feedback";
import { Loader2, Users, Shield, CheckCircle2, Clock } from "lucide-react";

export default function AdminFeedbackDashboard() {
  const { accessToken } = useAuth();
  const [activeTab, setActiveTab] = useState<"campaigns" | "analytics" | "templates">("campaigns");

  const [campaigns, setCampaigns] = useState<FeedbackCampaign[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [selectedDept, setSelectedDept] = useState<string>("ALL");

  const [analytics, setAnalytics] = useState<CampaignAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFilterData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [campaignData, deptRes] = await Promise.all([
        listCampaigns({}, accessToken),
        apiFetch("/departments", {}, accessToken),
      ]);
      const nonDraft = campaignData.filter((c) => c.status !== "draft");
      setCampaigns(nonDraft);
      if (nonDraft.length > 0) setSelectedCampaign(nonDraft[0].id);
      if (deptRes.success) setDepartments(deptRes.data?.departments || []);
    } catch (err) {
      console.error("Failed to load admin filters", err);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  const loadAnalytics = useCallback(async () => {
    if (!accessToken || !selectedCampaign) return;
    setAnalyticsLoading(true);
    setError(null);
    try {
      const filters = selectedDept !== "ALL" ? { departmentId: selectedDept } : {};
      const result = await getCampaignAnalytics(selectedCampaign, filters, accessToken);
      setAnalytics(result);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load campaign analytics.");
    } finally {
      setAnalyticsLoading(false);
    }
  }, [accessToken, selectedCampaign, selectedDept]);

  useEffect(() => {
    loadFilterData();
  }, [loadFilterData]);

  useEffect(() => {
    if (activeTab === "analytics" && selectedCampaign) loadAnalytics();
  }, [activeTab, selectedCampaign, selectedDept, loadAnalytics]);

  const ratingQuestions = (analytics?.questions || []).filter((q) => q.questionType === "rating");
  const overallAvg =
    ratingQuestions.length > 0
      ? Math.round((ratingQuestions.reduce((acc, q) => acc + (q.averageRating || 0), 0) / ratingQuestions.length) * 100) / 100
      : 0;
  const comments = (analytics?.questions || []).find((q) => q.questionType === "text")?.textComments || [];
  const selectedCampaignObj = campaigns.find((c) => c.id === selectedCampaign);

  if (loading) {
    return (
      <div className="flex h-[350px] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 w-full max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-5 rounded-2xl border border-border-subtle bg-surface shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Shield className="text-blue-600 dark:text-blue-400 h-5 w-5" />
            <h1 className="font-display font-bold text-xl text-text-primary leading-none">
              Academic Feedback Campaign Management
            </h1>
          </div>
          <p className="text-xs text-text-muted">
            Eligibility-driven campaigns — every audience is resolved live from Student Management and Faculty Assignment.
          </p>
        </div>
      </div>

      <div className="flex border-b border-border-subtle gap-2 overflow-x-auto pb-px">
        {(["campaigns", "analytics", "templates"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer capitalize ${
              activeTab === tab ? "border-blue-600 text-blue-600" : "border-transparent text-text-muted hover:text-text-primary"
            }`}
          >
            {tab === "campaigns" ? "Campaigns" : tab === "analytics" ? "Analytics" : "Evaluation Templates"}
          </button>
        ))}
      </div>

      {activeTab === "campaigns" && accessToken && <CampaignManager accessToken={accessToken} />}

      {activeTab === "analytics" && (
        <div className="space-y-6">
          {campaigns.length === 0 ? (
            <div className="rounded-2xl border border-border-subtle bg-surface p-10 text-center text-text-muted text-sm">
              No published campaigns yet. Publish a campaign from the Campaigns tab to see analytics here.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl border border-border-subtle bg-surface">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase text-text-muted">Campaign</label>
                  <select
                    value={selectedCampaign}
                    onChange={(e) => setSelectedCampaign(e.target.value)}
                    className="rounded-lg border border-border-subtle bg-background px-3 py-1.5 text-xs font-medium text-text-secondary focus:outline-none"
                  >
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>{c.title} ({c.effectiveStatus})</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase text-text-muted">Department</label>
                  <select
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    className="rounded-lg border border-border-subtle bg-background px-3 py-1.5 text-xs font-medium text-text-secondary focus:outline-none"
                  >
                    <option value="ALL">All Target Departments</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedCampaignObj && (
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider border ${statusBadgeClasses(selectedCampaignObj.effectiveStatus)}`}>
                  {selectedCampaignObj.effectiveStatus}
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
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">Overall Rating</p>
                      <div className="flex items-baseline gap-1"><p className="font-display font-black text-3xl text-text-primary">{overallAvg}</p><p className="text-xs text-text-muted">/5</p></div>
                    </div>
                    <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1 flex items-center gap-1"><Users size={11} /> Eligible Students</p>
                      <p className="font-display font-bold text-3xl text-text-primary">{analytics?.summary.eligibleStudents ?? 0}</p>
                    </div>
                    <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1 flex items-center gap-1"><CheckCircle2 size={11} /> Submitted</p>
                      <p className="font-display font-bold text-3xl text-emerald-600">{analytics?.summary.submittedCount ?? 0}</p>
                    </div>
                    <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1 flex items-center gap-1"><Clock size={11} /> Completion</p>
                      <p className="font-display font-bold text-3xl text-blue-600">{analytics?.summary.completionPercent ?? 0}%</p>
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
      )}

      {activeTab === "templates" && <FeedbackTemplatesManager accessToken={accessToken || ""} />}
    </div>
  );
}
