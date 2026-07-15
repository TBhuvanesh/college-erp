"use client";

import { useState } from "react";
import { Star, ArrowLeft, ArrowRight, CheckCircle, Loader2 } from "lucide-react";

interface Question {
  id: string;
  template_id: string;
  text: string;
  type: "rating" | "mcq" | "text" | "boolean";
  options?: string[] | any;
  order_index: number;
}

interface Template {
  id: string;
  title: string;
  type: "faculty" | "course" | "lms" | "erp";
  questions: Question[];
}

interface FeedbackWizardProps {
  templates: Template[];
  subjectId: string;
  facultyId: string;
  windowId: string;
  onSubmit: (payloads: any[]) => Promise<void>;
  loading: boolean;
}

export function FeedbackWizard({
  templates,
  subjectId,
  facultyId,
  windowId,
  onSubmit,
  loading
}: FeedbackWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  // Answers state keyed by questionId
  const [answers, setAnswers] = useState<Record<string, { rating_value?: number; text_value?: string }>>({});
  const [error, setError] = useState<string | null>(null);

  // Group templates by type
  const facultyTemplate = templates.find((t) => t.type === "faculty");
  const courseTemplate = templates.find((t) => t.type === "course");
  const lmsTemplate = templates.find((t) => t.type === "lms");
  const erpTemplate = templates.find((t) => t.type === "erp");

  const steps = [
    { number: 1, label: "Faculty", template: facultyTemplate },
    { number: 2, label: "Course", template: courseTemplate },
    { number: 3, label: "LMS", template: lmsTemplate },
    { number: 4, label: "ERP / Suggestions", template: erpTemplate },
    { number: 5, label: "Review & Submit", template: null }
  ];

  const handleRatingChange = (questionId: string, value: number) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], rating_value: value }
    }));
  };

  const handleTextChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], text_value: value }
    }));
  };

  const handleRadioChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], text_value: value }
    }));
  };

  const validateStep = (): boolean => {
    setError(null);
    const activeStep = steps.find((s) => s.number === currentStep);
    if (!activeStep || !activeStep.template) return true;

    // Validate that rating questions in the active step are filled out
    for (const q of activeStep.template.questions) {
      const answer = answers[q.id];
      if (q.type === "rating" && (!answer || !answer.rating_value)) {
        setError(`Please provide a rating for: "${q.text}"`);
        return false;
      }
      if (q.type === "boolean" && (!answer || !answer.text_value)) {
        setError(`Please answer the yes/no question: "${q.text}"`);
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep()) {
      setCurrentStep((prev) => Math.min(prev + 1, steps.length));
    }
  };

  const handlePrev = () => {
    setError(null);
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    setError(null);
    const submissionPayloads: any[] = [];

    // Assemble payload for each feedback type
    for (const step of steps) {
      if (step.template) {
        const t = step.template;
        const stepAnswers = t.questions.map((q) => ({
          question_id: q.id,
          rating_value: answers[q.id]?.rating_value,
          text_value: answers[q.id]?.text_value
        }));

        submissionPayloads.push({
          window_id: windowId,
          template_id: t.id,
          subject_id: t.type === "erp" ? undefined : subjectId,
          faculty_id: t.type === "faculty" ? facultyId : undefined,
          feedback_type: t.type,
          answers: stepAnswers
        });
      }
    }

    try {
      await onSubmit(submissionPayloads);
      setCurrentStep(6); // Success Step
    } catch (err: any) {
      setError(err.message || "Failed to submit feedback. Please try again.");
    }
  };

  const renderQuestion = (q: Question) => {
    switch (q.type) {
      case "rating":
        const currentRating = answers[q.id]?.rating_value || 0;
        return (
          <div key={q.id} className="space-y-2 py-3 border-b border-border-subtle last:border-0">
            <label className="text-sm font-semibold text-text-primary">{q.text}</label>
            <div className="flex items-center gap-1.5 mt-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => handleRatingChange(q.id, star)}
                  className="p-1 transition-transform active:scale-95 cursor-pointer"
                >
                  <Star
                    className={`h-7 w-7 transition-colors ${
                      star <= currentRating
                        ? "fill-amber-400 stroke-amber-400"
                        : "stroke-neutral-300 dark:stroke-neutral-600 hover:stroke-amber-300"
                    }`}
                  />
                </button>
              ))}
              {currentRating > 0 && (
                <span className="text-xs font-bold text-text-muted ml-2">
                  {["Poor", "Average", "Good", "Very Good", "Excellent"][currentRating - 1]}
                </span>
              )}
            </div>
          </div>
        );

      case "boolean":
        const currentBool = answers[q.id]?.text_value;
        return (
          <div key={q.id} className="space-y-2 py-3 border-b border-border-subtle last:border-0">
            <label className="text-sm font-semibold text-text-primary">{q.text}</label>
            <div className="flex gap-4 mt-2">
              {["Yes", "No"].map((opt) => (
                <label key={opt} className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                  <input
                    type="radio"
                    name={`q-${q.id}`}
                    value={opt}
                    checked={currentBool === opt}
                    onChange={() => handleRadioChange(q.id, opt)}
                    className="accent-blue-600 h-4 w-4"
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
          </div>
        );

      case "mcq":
        const currentMcq = answers[q.id]?.text_value;
        const options = Array.isArray(q.options) ? q.options : JSON.parse(q.options || "[]");
        return (
          <div key={q.id} className="space-y-2 py-3 border-b border-border-subtle last:border-0">
            <label className="text-sm font-semibold text-text-primary">{q.text}</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              {options.map((opt: string) => (
                <label 
                  key={opt} 
                  className={`flex items-center gap-2 p-3 rounded-xl border text-sm transition-all cursor-pointer ${
                    currentMcq === opt 
                      ? "border-blue-500 bg-blue-500/5 text-text-primary" 
                      : "border-border-subtle hover:bg-surface-hover"
                  }`}
                >
                  <input
                    type="radio"
                    name={`q-${q.id}`}
                    value={opt}
                    checked={currentMcq === opt}
                    onChange={() => handleRadioChange(q.id, opt)}
                    className="accent-blue-600 h-4 w-4"
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
          </div>
        );

      case "text":
        const textVal = answers[q.id]?.text_value || "";
        return (
          <div key={q.id} className="space-y-2 py-3 border-b border-border-subtle last:border-0">
            <label className="text-sm font-semibold text-text-primary">{q.text}</label>
            <textarea
              value={textVal}
              onChange={(e) => handleTextChange(q.id, e.target.value)}
              placeholder="Provide details, comments or suggestions..."
              rows={4}
              className="w-full rounded-xl border border-border-subtle bg-background p-3 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        );

      default:
        return null;
    }
  };

  // Success screen
  if (currentStep === 6) {
    return (
      <div className="rounded-2xl border border-border-subtle bg-surface p-8 text-center max-w-md mx-auto space-y-5 shadow-sm">
        <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
          <CheckCircle size={40} />
        </div>
        <div className="space-y-2">
          <h2 className="font-display font-bold text-xl text-text-primary">Feedback Submitted!</h2>
          <p className="text-sm text-text-secondary">
            Thank you for helping us maintain and improve our academic standards. Your responses have been saved anonymously.
          </p>
        </div>
        <div className="pt-2">
          <a
            href="/student/feedback"
            className="w-full inline-flex items-center justify-center py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all"
          >
            Go back to Dashboard
          </a>
        </div>
      </div>
    );
  }

  const activeStep = steps[currentStep - 1];

  return (
    <div className="max-w-2xl mx-auto rounded-2xl border border-border-subtle bg-surface shadow-sm overflow-hidden flex flex-col h-full">
      {/* Header and Progress Tracker */}
      <div className="p-5 border-b border-border-subtle bg-neutral-50 dark:bg-neutral-900 flex justify-between items-center gap-4 flex-wrap">
        <div>
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
            Step {currentStep} of 5
          </span>
          <h2 className="font-display font-bold text-lg text-text-primary mt-0.5">
            {activeStep.label}
          </h2>
        </div>
        
        {/* Simple Progress Bar */}
        <div className="w-32 bg-neutral-200 dark:bg-neutral-800 h-2 rounded-full overflow-hidden">
          <div 
            className="bg-blue-600 h-full transition-all duration-300"
            style={{ width: `${(currentStep / 5) * 100}%` }}
          />
        </div>
      </div>

      {/* Main Form Area */}
      <div className="p-5 flex-1 min-h-[350px]">
        {error && (
          <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 p-3.5 text-xs font-semibold text-red-500">
            {error}
          </div>
        )}

        {/* Step 1-4: Render dynamic questions */}
        {activeStep.template && (
          <div className="space-y-4">
            <p className="text-xs text-text-muted italic mb-2">
              All rating questions are required.
            </p>
            {activeStep.template.questions.map(renderQuestion)}
          </div>
        )}

        {/* Step 5: Review responses */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <p className="text-xs text-text-muted">
              Please review all your ratings and comments. Once submitted, you cannot modify your responses.
            </p>
            
            {steps.filter(s => s.template).map((s) => (
              <div key={s.number} className="border border-border-subtle rounded-xl p-4 bg-neutral-500/[0.01]">
                <h3 className="font-display font-bold text-xs text-accent-blue uppercase tracking-wider mb-2">
                  {s.label} Ratings
                </h3>
                <div className="space-y-2">
                  {s.template?.questions.map((q) => {
                    const ans = answers[q.id];
                    return (
                      <div key={q.id} className="flex justify-between items-start gap-4 text-xs">
                        <span className="text-text-secondary font-medium leading-relaxed">{q.text}</span>
                        <span className="font-bold shrink-0 text-text-primary">
                          {q.type === "rating" 
                            ? `${ans?.rating_value || 0} / 5` 
                            : ans?.text_value || "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Navigation */}
      <div className="p-5 border-t border-border-subtle bg-neutral-50 dark:bg-neutral-900 flex justify-between items-center gap-3">
        <button
          type="button"
          onClick={handlePrev}
          disabled={currentStep === 1 || loading}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-text-secondary border border-border-subtle hover:bg-surface-hover disabled:opacity-50 cursor-pointer"
        >
          <ArrowLeft size={14} /> Back
        </button>

        {currentStep === 5 ? (
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
        ) : (
          <button
            type="button"
            onClick={handleNext}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all cursor-pointer"
          >
            Next <ArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
