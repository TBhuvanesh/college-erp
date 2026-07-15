"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { FeedbackWizard } from "@/components/Feedback/FeedbackWizard";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

export default function SubmitFeedbackPage() {
  const { accessToken } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const windowId = searchParams.get("windowId");
  const subjectId = searchParams.get("subjectId");
  const facultyId = searchParams.get("facultyId");

  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/feedback/templates", {}, accessToken);
      if (res.success) {
        setTemplates(res.data || []);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load evaluation forms.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleSubmit = async (payloads: any[]) => {
    if (!accessToken) return;
    setSubmitLoading(true);
    try {
      // Execute all submissions in parallel
      await Promise.all(
        payloads.map((payload) =>
          apiFetch("/feedback/submit", {
            method: "POST",
            body: JSON.stringify(payload)
          }, accessToken)
        )
      );
    } catch (err: any) {
      console.error("Submission failed", err);
      throw new Error(err.message || "Feedback submission failed.");
    } finally {
      setSubmitLoading(false);
    }
  };

  if (!windowId || !subjectId || !facultyId) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center max-w-md mx-auto mt-10 space-y-3">
        <AlertCircle className="mx-auto h-8 w-8 text-red-500" />
        <h3 className="font-display font-bold text-red-500 text-sm">Invalid Navigation Params</h3>
        <p className="text-xs text-text-secondary leading-relaxed">
          The evaluation page was reached without required configuration details. Please return to the dashboard.
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

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 text-center max-w-lg mx-auto mt-10">
        <AlertCircle className="mx-auto h-8 w-8 text-red-500 mb-2" />
        <h3 className="font-display font-bold text-red-500 text-sm">Evaluation Error</h3>
        <p className="text-xs text-text-secondary mt-1">{error}</p>
        <div className="pt-4">
          <Link href="/student/feedback" className="inline-flex items-center gap-1 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-semibold rounded-xl transition-all">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-12 w-full max-w-4xl mx-auto">
      {/* Back Button Navigation */}
      <div>
        <Link 
          href="/student/feedback"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors mb-2"
        >
          <ArrowLeft size={14} /> Back to Dashboard
        </Link>
      </div>

      <FeedbackWizard
        templates={templates}
        subjectId={subjectId}
        facultyId={facultyId}
        windowId={windowId}
        onSubmit={handleSubmit}
        loading={submitLoading}
      />
    </div>
  );
}
