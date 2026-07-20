"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getMyCampaigns, getTemplates, submitFeedback, StudentCampaignView, FeedbackTemplate } from "@/lib/feedback";
import { FeedbackWizard } from "@/components/Feedback/FeedbackWizard";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

export default function SubmitFeedbackPage() {
  const { accessToken } = useAuth();
  const searchParams = useSearchParams();

  const campaignId = searchParams.get("campaignId");
  const subjectId = searchParams.get("subjectId") || undefined;
  const facultyId = searchParams.get("facultyId") || undefined;

  const [campaign, setCampaign] = useState<StudentCampaignView | null>(null);
  const [template, setTemplate] = useState<FeedbackTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken || !campaignId) return;
    setLoading(true);
    setError(null);
    try {
      const [campaigns, templates] = await Promise.all([getMyCampaigns(accessToken), getTemplates(accessToken)]);
      const view = campaigns.find((c) => c.campaignId === campaignId);
      if (!view) {
        setError("You are not eligible to submit feedback for this campaign, or it is no longer open.");
        return;
      }
      const item = view.items.find((i) => (i.subjectId ?? undefined) === subjectId && (i.facultyId ?? undefined) === facultyId);
      if (!item) {
        setError("This evaluation item was not found in your eligible feedback list.");
        return;
      }
      if (item.submitted) {
        setError("You have already submitted feedback for this item.");
        return;
      }
      const tmpl = templates.find((t) => t.id === view.templateId);
      if (!tmpl) {
        setError("The feedback form for this campaign could not be loaded.");
        return;
      }
      setCampaign(view);
      setTemplate(tmpl);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load evaluation form.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, campaignId, subjectId, facultyId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (answers: Array<{ questionId: string; ratingValue?: number; textValue?: string }>) => {
    if (!accessToken || !campaignId) return;
    setSubmitLoading(true);
    try {
      await submitFeedback({ campaignId, subjectId, facultyId, answers }, accessToken);
    } catch (err: any) {
      console.error("Submission failed", err);
      throw new Error(err.message || "Feedback submission failed.");
    } finally {
      setSubmitLoading(false);
    }
  };

  if (!campaignId) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center max-w-md mx-auto mt-10 space-y-3">
        <AlertCircle className="mx-auto h-8 w-8 text-red-500" />
        <h3 className="font-display font-bold text-red-500 text-sm">Invalid Navigation Params</h3>
        <p className="text-xs text-text-secondary leading-relaxed">
          The evaluation page was reached without a campaign reference. Please return to the dashboard.
        </p>
        <div className="pt-2">
          <Link href="/student/feedback" className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline">
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-[350px] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !campaign || !template) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 text-center max-w-lg mx-auto mt-10">
        <AlertCircle className="mx-auto h-8 w-8 text-red-500 mb-2" />
        <h3 className="font-display font-bold text-red-500 text-sm">Evaluation Unavailable</h3>
        <p className="text-xs text-text-secondary mt-1">{error}</p>
        <div className="pt-4">
          <Link href="/student/feedback" className="inline-flex items-center gap-1 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-semibold rounded-xl transition-all">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const item = campaign.items.find((i) => (i.subjectId ?? undefined) === subjectId && (i.facultyId ?? undefined) === facultyId);

  return (
    <div className="space-y-4 pb-12 w-full max-w-4xl mx-auto">
      <div>
        <Link href="/student/feedback" className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors mb-2">
          <ArrowLeft size={14} /> Back to Dashboard
        </Link>
      </div>

      <FeedbackWizard
        template={template}
        campaignTitle={campaign.title}
        subjectLabel={item?.subjectCode ?? null}
        facultyLabel={item?.facultyName ?? null}
        onSubmit={handleSubmit}
        loading={submitLoading}
      />
    </div>
  );
}
