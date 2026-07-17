"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { FeedbackBarChart } from "@/components/Feedback/FeedbackCharts";
import { AnonymousCommentList } from "@/components/Feedback/AnonymousCommentList";
import { listCampaigns, getCampaignAnalytics, FeedbackCampaign, CampaignAnalytics, statusBadgeClasses } from "@/lib/feedback";
import { Calendar, Filter, Loader2, Star, Users, Award, TrendingUp } from "lucide-react";

export default function HodFeedbackDashboard() {
  const { user, accessToken } = useAuth();
  const [campaigns, setCampaigns] = useState<FeedbackCampaign[]>([]);
  const [facultyMembers, setFacultyMembers] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);

  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [selectedFaculty, setSelectedFaculty] = useState<string>("ALL");
  const [selectedSubject, setSelectedSubject] = useState<string>("ALL");

  const [analytics, setAnalytics] = useState<CampaignAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deptName = user?.facultyProfile?.departmentName || "Department";
  const deptId = user?.facultyProfile?.departmentId;

  const loadFilters = useCallback(async () => {
    if (!accessToken || !deptId) return;
    setLoading(true);
    try {
      const [campaignData, facRes, subRes] = await Promise.all([
        listCampaigns({ departmentId: deptId }, accessToken),
        apiFetch("/faculty?limit=200", {}, accessToken),
        apiFetch("/subjects?limit=200", {}, accessToken),
      ]);

      const nonDraft = campaignData.filter((c) => c.status !== "draft");
      setCampaigns(nonDraft);
      if (nonDraft.length > 0) setSelectedCampaign(nonDraft[0].id);

      if (facRes.success && facRes.data?.faculty) {
        setFacultyMembers(facRes.data.faculty.filter((f: any) => f.department?.id === deptId || f.department_id === deptId));
      }
      if (subRes.success && subRes.data?.subjects) {
        setSubjects(subRes.data.subjects.filter((s: any) => s.department?.id === deptId || s.departmentId === deptId));
      }
    } catch (err) {
      console.error("Failed to load HOD filters", err);
    } finally {
      setLoading(false);
    }
  }, [accessToken, deptId]);

  const loadAnalytics = useCallback(async () => {
    if (!accessToken || !selectedCampaign) return;
    setAnalyticsLoading(true);
    setError(null);
    try {
      const filters: { facultyId?: string; subjectId?: string } = {};
      if (selectedFaculty !== "ALL") filters.facultyId = selectedFaculty;
      if (selectedSubject !== "ALL") filters.subjectId = selectedSubject;
      const result = await getCampaignAnalytics(selectedCampaign, filters, accessToken);
      setAnalytics(result);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load department analytics.");
    } finally {
      setAnalyticsLoading(false);
    }
  }, [accessToken, selectedCampaign, selectedFaculty, selectedSubject]);

  useEffect(() => {
    loadFilters();
  }, [loadFilters]);

  useEffect(() => {
    if (selectedCampaign) loadAnalytics();
  }, [selectedCampaign, selectedFaculty, selectedSubject, loadAnalytics]);

  const ratingQuestions = (analytics?.questions || []).filter((q) => q.questionType === "rating");
  const departmentAvg = useMemo(() => {
    if (ratingQuestions.length === 0) return 0;
    return Math.round((ratingQuestions.reduce((acc, q) => acc + (q.averageRating || 0), 0) / ratingQuestions.length) * 100) / 100;
  }, [ratingQuestions]);
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
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 p-5 rounded-2xl border border-border-subtle bg-surface shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Award className="text-blue-500 h-5 w-5" />
            <h1 className="font-display font-bold text-xl text-text-primary leading-none">Department Feedback Dashboard</h1>
          </div>
          <p className="text-xs text-text-muted">
            Department: <span className="font-bold text-accent-blue">{deptName}</span>. Only campaigns targeting this department are shown.
          </p>
        </div>

        {campaigns.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
            <div className="flex items-center gap-2 rounded-xl border border-border-subtle bg-background px-3 py-2 text-xs text-text-secondary w-full sm:w-auto">
              <Calendar size={14} className="text-text-muted shrink-0" />
              <select value={selectedCampaign} onChange={(e) => setSelectedCampaign(e.target.value)} className="bg-transparent focus:outline-none pr-6 font-semibold w-full">
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>{c.title} ({c.effectiveStatus})</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-border-subtle bg-background px-3 py-2 text-xs text-text-secondary w-full sm:w-auto">
              <Users size={14} className="text-text-muted shrink-0" />
              <select value={selectedFaculty} onChange={(e) => setSelectedFaculty(e.target.value)} className="bg-transparent focus:outline-none pr-6 font-semibold w-full">
                <option value="ALL">All Faculty</option>
                {facultyMembers.map((fac) => (
                  <option key={fac.id} value={fac.id}>{fac.full_name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-border-subtle bg-background px-3 py-2 text-xs text-text-secondary w-full sm:w-auto">
              <Filter size={14} className="text-text-muted shrink-0" />
              <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="bg-transparent focus:outline-none pr-6 font-semibold w-full">
                <option value="ALL">All Subjects</option>
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>{sub.code} - {sub.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {campaigns.length === 0 ? (
        <div className="rounded-2xl border border-border-subtle bg-surface p-10 text-center text-text-muted text-sm">
          No feedback campaigns currently target this department.
        </div>
      ) : (
        <>
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-border-subtle bg-surface p-5 flex items-center justify-between shadow-sm">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">Dept Average Rating</p>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <p className="font-display font-black text-3xl text-text-primary">{departmentAvg}</p>
                      <p className="text-xs text-text-muted">/5</p>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                    <Star size={18} className="fill-blue-500 stroke-blue-500" />
                  </div>
                </div>

                <div className="rounded-2xl border border-border-subtle bg-surface p-5 flex items-center justify-between shadow-sm">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">Completion</p>
                    <p className="font-display font-bold text-3xl text-text-primary mt-0.5">{analytics?.summary.completionPercent ?? 0}%</p>
                    <p className="text-[10px] text-text-muted mt-2 font-medium">
                      {analytics?.summary.submittedCount ?? 0} of {analytics?.summary.eligibleStudents ?? 0} eligible students
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                    <Users size={18} />
                  </div>
                </div>

                <div className="rounded-2xl border border-border-subtle bg-surface p-5 flex items-center justify-between shadow-sm">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">Active Faculty Tutors</p>
                    <p className="font-display font-bold text-3xl text-text-primary mt-0.5">{facultyMembers.length}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
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
