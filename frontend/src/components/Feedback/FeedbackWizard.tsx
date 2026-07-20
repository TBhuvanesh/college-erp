"use client";

import { useState } from "react";
import { Star, CheckCircle, Loader2 } from "lucide-react";
import type { FeedbackTemplate, QuestionType } from "@/lib/feedback";

interface Answer {
  ratingValue?: number;
  textValue?: string;
}

interface CampaignFeedbackFormProps {
  template: FeedbackTemplate;
  campaignTitle: string;
  subjectLabel?: string | null;
  facultyLabel?: string | null;
  onSubmit: (answers: Array<{ questionId: string; ratingValue?: number; textValue?: string }>) => Promise<void>;
  loading: boolean;
}

export function FeedbackWizard({ template, campaignTitle, subjectLabel, facultyLabel, onSubmit, loading }: CampaignFeedbackFormProps) {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const setRating = (id: string, value: number) => setAnswers((prev) => ({ ...prev, [id]: { ...prev[id], ratingValue: value } }));
  const setText = (id: string, value: string) => setAnswers((prev) => ({ ...prev, [id]: { ...prev[id], textValue: value } }));

  const validate = (): boolean => {
    for (const q of template.questions) {
      if (!q.isRequired) continue;
      const a = answers[q.id];
      if (q.type === "rating" && !a?.ratingValue) {
        setError(`Please provide a rating for: "${q.text}"`);
        return false;
      }
      if ((q.type === "boolean" || q.type === "mcq") && !a?.textValue) {
        setError(`Please answer: "${q.text}"`);
        return false;
      }
      if (q.type === "text" && !a?.textValue?.trim()) {
        setError(`Please answer: "${q.text}"`);
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    setError(null);
    if (!validate()) return;
    try {
      await onSubmit(
        template.questions.map((q) => ({
          questionId: q.id,
          ratingValue: answers[q.id]?.ratingValue,
          textValue: answers[q.id]?.textValue,
        }))
      );
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "Failed to submit feedback. Please try again.");
    }
  };

  const renderQuestion = (q: FeedbackTemplate["questions"][number]) => {
    const type: QuestionType = q.type;
    switch (type) {
      case "rating": {
        const current = answers[q.id]?.ratingValue || 0;
        return (
          <div key={q.id} className="space-y-2 py-3 border-b border-border-subtle last:border-0">
            <label className="text-sm font-semibold text-text-primary">{q.text}</label>
            <div className="flex items-center gap-1.5 mt-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} type="button" onClick={() => setRating(q.id, star)} className="p-1 transition-transform active:scale-95 cursor-pointer">
                  <Star
                    className={`h-7 w-7 transition-colors ${
                      star <= current ? "fill-amber-400 stroke-amber-400" : "stroke-neutral-300 dark:stroke-neutral-600 hover:stroke-amber-300"
                    }`}
                  />
                </button>
              ))}
              {current > 0 && (
                <span className="text-xs font-bold text-text-muted ml-2">{["Poor", "Average", "Good", "Very Good", "Excellent"][current - 1]}</span>
              )}
            </div>
          </div>
        );
      }
      case "boolean": {
        const current = answers[q.id]?.textValue;
        return (
          <div key={q.id} className="space-y-2 py-3 border-b border-border-subtle last:border-0">
            <label className="text-sm font-semibold text-text-primary">{q.text}</label>
            <div className="flex gap-4 mt-2">
              {["Yes", "No"].map((opt) => (
                <label key={opt} className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                  <input type="radio" name={`q-${q.id}`} value={opt} checked={current === opt} onChange={() => setText(q.id, opt)} className="accent-blue-600 h-4 w-4" />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
          </div>
        );
      }
      case "mcq": {
        const current = answers[q.id]?.textValue;
        const options = Array.isArray(q.options) ? q.options : [];
        return (
          <div key={q.id} className="space-y-2 py-3 border-b border-border-subtle last:border-0">
            <label className="text-sm font-semibold text-text-primary">{q.text}</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              {options.map((opt) => (
                <label
                  key={opt}
                  className={`flex items-center gap-2 p-3 rounded-xl border text-sm transition-all cursor-pointer ${
                    current === opt ? "border-blue-500 bg-blue-500/5 text-text-primary" : "border-border-subtle hover:bg-surface-hover"
                  }`}
                >
                  <input type="radio" name={`q-${q.id}`} value={opt} checked={current === opt} onChange={() => setText(q.id, opt)} className="accent-blue-600 h-4 w-4" />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
          </div>
        );
      }
      case "text": {
        const val = answers[q.id]?.textValue || "";
        return (
          <div key={q.id} className="space-y-2 py-3 border-b border-border-subtle last:border-0">
            <label className="text-sm font-semibold text-text-primary">{q.text}</label>
            <textarea
              value={val}
              onChange={(e) => setText(q.id, e.target.value)}
              placeholder="Provide details, comments or suggestions..."
              rows={4}
              className="w-full rounded-xl border border-border-subtle bg-background p-3 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        );
      }
      default:
        return null;
    }
  };

  if (submitted) {
    return (
      <div className="rounded-2xl border border-border-subtle bg-surface p-8 text-center max-w-md mx-auto space-y-5 shadow-sm">
        <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
          <CheckCircle size={40} />
        </div>
        <div className="space-y-2">
          <h2 className="font-display font-bold text-xl text-text-primary">Feedback Submitted!</h2>
          <p className="text-sm text-text-secondary">
            Thank you for helping us maintain and improve our academic standards. Your response has been saved anonymously.
          </p>
        </div>
        <div className="pt-2">
          <a href="/student/feedback" className="w-full inline-flex items-center justify-center py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all">
            Go back to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto rounded-2xl border border-border-subtle bg-surface shadow-sm overflow-hidden flex flex-col h-full">
      <div className="p-5 border-b border-border-subtle bg-neutral-50 dark:bg-neutral-900">
        <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{template.title}</span>
        <h2 className="font-display font-bold text-lg text-text-primary mt-0.5">{campaignTitle}</h2>
        {(subjectLabel || facultyLabel) && (
          <p className="text-xs text-text-muted mt-1">
            {subjectLabel ? `Subject: ${subjectLabel}` : ""}{subjectLabel && facultyLabel ? " · " : ""}{facultyLabel ? `Faculty: ${facultyLabel}` : ""}
          </p>
        )}
      </div>

      <div className="p-5 flex-1 min-h-[350px]">
        {error && <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 p-3.5 text-xs font-semibold text-red-500">{error}</div>}
        <p className="text-xs text-text-muted italic mb-2">Your response is submitted anonymously — it cannot be traced back to you.</p>
        <div className="space-y-4">{template.questions.map(renderQuestion)}</div>
      </div>

      <div className="p-5 border-t border-border-subtle bg-neutral-50 dark:bg-neutral-900 flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all cursor-pointer disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Submitting...
            </>
          ) : (
            "Submit Feedback"
          )}
        </button>
      </div>
    </div>
  );
}
