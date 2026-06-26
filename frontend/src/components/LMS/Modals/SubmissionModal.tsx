"use client";

import React, { useState, useEffect } from "react";
import { submitAssignment, Assignment, Submission } from "@/lib/lms";
import { X, Loader2, UploadCloud } from "lucide-react";

interface SubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  token: string;
  assignment: Assignment;
  existingSubmission?: Submission | null;
}

export const SubmissionModal: React.FC<SubmissionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  token,
  assignment,
  existingSubmission,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isOpen) {
        setFile(null);
        setError(null);
        setProgress(0);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      const ext = selectedFile.name.split(".").pop()?.toLowerCase();
      const allowed = ["pdf", "ppt", "pptx", "doc", "docx"];

      if (!ext || !allowed.includes(ext)) {
        setError("Unsupported file format. Supported: pdf, ppt, pptx, doc, docx");
        setFile(null);
        return;
      }
      setError(null);
      setFile(selectedFile);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError("Please choose a file to submit");
      return;
    }

    setSubmitting(true);
    setProgress(10);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 15;
      });
    }, 150);

    try {
      const formData = new FormData();
      formData.append("assignmentId", assignment.id);
      formData.append("file", file);

      await submitAssignment(formData, token);

      clearInterval(progressInterval);
      setProgress(100);
      setTimeout(() => {
        onSuccess(
          existingSubmission
            ? "Submission replaced successfully"
            : "Assignment submitted successfully"
        );
        onClose();
      }, 300);
    } catch (err: any) {
      clearInterval(progressInterval);
      setProgress(0);
      setError(err.message || "Failed to submit assignment.");
      setSubmitting(false);
    }
  };

  const isClosed = new Date() > new Date(assignment.dueDate);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/70 backdrop-blur-sm animate-fade-in p-4">
      <div className="relative w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-xl p-6 flex flex-col shadow-2xl z-10">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4 mb-4">
          <h3 className="font-display font-bold text-white text-lg flex items-center gap-2">
            <UploadCloud size={18} className="text-blue-500" />
            <span>{existingSubmission ? "Resubmit Assignment" : "Submit Assignment"}</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded bg-neutral-850 hover:bg-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Info detail */}
        <div className="mb-4 bg-neutral-950/50 p-3 rounded-lg border border-neutral-850">
          <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wide">
            Task details
          </span>
          <h4 className="text-sm font-bold text-white mt-1 leading-snug">
            {assignment.title}
          </h4>
          <p className="text-[10px] text-neutral-400 mt-1">
            Max Marks: <strong className="text-white">{assignment.maxMarks}</strong>
          </p>
        </div>

        {/* Error notification */}
        {error && (
          <div className="p-3 mb-4 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs font-semibold">
            {error}
          </div>
        )}

        {isClosed ? (
          <div className="p-4 text-center bg-rose-500/5 border border-rose-500/15 rounded-lg text-rose-455 text-xs font-semibold">
            The deadline for this assignment has passed. Submissions are closed.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* File Picker */}
            <div>
              <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
                Choose submission file <span className="text-rose-500">*</span>
              </label>
              <input
                type="file"
                required
                accept=".pdf,.ppt,.pptx,.doc,.docx"
                onChange={handleFileChange}
                className="w-full text-xs text-neutral-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-neutral-800 file:text-neutral-300 hover:file:bg-neutral-750 file:cursor-pointer"
              />
              <span className="text-[9px] text-neutral-500 mt-1.5 block leading-relaxed">
                Accepted: PDF, PPT, PPTX, DOC, DOCX. Max file size: 10MB.
              </span>
            </div>

            {/* Upload Progress Bar */}
            {submitting && (
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between text-[10px] text-neutral-400 font-mono">
                  <span>Uploading file...</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-neutral-950 h-1.5 rounded-full overflow-hidden border border-neutral-900">
                  <div
                    className="bg-blue-600 h-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Action triggers */}
            <div className="flex items-center gap-3 pt-4 border-t border-neutral-850 mt-4">
              <button
                type="button"
                disabled={submitting}
                onClick={onClose}
                className="flex-1 py-2 text-xs font-semibold rounded bg-neutral-800 hover:bg-neutral-750 text-neutral-300 hover:text-white cursor-pointer transition text-center disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition text-center flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {submitting && <Loader2 size={12} className="animate-spin" />}
                <span>{existingSubmission ? "Replace Submission" : "Submit File"}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
