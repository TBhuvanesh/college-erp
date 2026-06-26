"use client";

import React, { useState, useEffect } from "react";
import { gradeSubmission, downloadLmsFile, Submission } from "@/lib/lms";
import { X, Loader2, Award, Download } from "lucide-react";

interface GradingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  token: string;
  submission: Submission;
}

export const GradingModal: React.FC<GradingModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  token,
  submission,
}) => {
  const [marks, setMarks] = useState<string>("");
  const [feedback, setFeedback] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isOpen && submission) {
        setMarks(submission.marks !== null ? submission.marks.toString() : "");
        setFeedback(submission.feedback || "");
        setError(null);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [isOpen, submission]);

  if (!isOpen) return null;

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);
    try {
      await downloadLmsFile(submission.downloadUrl, submission.fileName, token);
    } catch (err: any) {
      setError(err.message || "Failed to download student file.");
    } finally {
      setDownloading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numericMarks = Number(marks);
    if (isNaN(numericMarks) || marks.trim() === "") {
      setError("Please enter a valid numeric grade.");
      return;
    }

    if (numericMarks < 0) {
      setError("Marks cannot be negative.");
      return;
    }

    if (numericMarks > submission.assignmentMaxMarks) {
      setError(`Marks cannot exceed the maximum score of ${submission.assignmentMaxMarks}.`);
      return;
    }

    setSubmitting(true);

    try {
      await gradeSubmission(
        submission.id,
        {
          marks: numericMarks,
          feedback: feedback.trim() || undefined,
        },
        token
      );
      onSuccess("Submission graded successfully");
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to submit evaluation.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/70 backdrop-blur-sm animate-fade-in p-4">
      <div className="relative w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-xl p-6 flex flex-col shadow-2xl z-10">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4 mb-4">
          <h3 className="font-display font-bold text-white text-lg flex items-center gap-2">
            <Award size={18} className="text-blue-500" />
            <span>Grade Student Submission</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded bg-neutral-850 hover:bg-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Student submission overview */}
        <div className="mb-4 bg-neutral-950/50 p-4 rounded-lg border border-neutral-850 space-y-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <div>
              <span className="text-[9px] uppercase font-bold text-neutral-500">Student Name</span>
              <p className="font-semibold text-white mt-0.5">{submission.studentName}</p>
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold text-neutral-500">Roll Number</span>
              <p className="font-semibold text-white mt-0.5 font-mono">{submission.studentRollNumber}</p>
            </div>
          </div>

          <div className="border-t border-neutral-900 pt-2.5 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <span className="text-[9px] uppercase font-bold text-neutral-500">Submitted File</span>
              <p className="text-xs text-neutral-350 truncate mt-0.5" title={submission.fileName}>
                {submission.fileName}
              </p>
              <span className="text-[9px] text-neutral-500 block font-mono">
                Size: {formatSize(submission.fileSize)}
              </span>
            </div>

            <button
              type="button"
              disabled={downloading}
              onClick={handleDownload}
              className="px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-750 text-white text-xs font-semibold flex items-center gap-1 shrink-0 border border-neutral-700 transition"
            >
              {downloading ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Download size={12} />
              )}
              <span>Download</span>
            </button>
          </div>
        </div>

        {/* Error notification */}
        {error && (
          <div className="p-3 mb-4 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Marks */}
          <div>
            <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
              Evaluated Score (Max: {submission.assignmentMaxMarks}) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                required
                min={0}
                max={submission.assignmentMaxMarks}
                value={marks}
                onChange={(e) => setMarks(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded text-white focus:outline-none focus:border-blue-600 transition"
                placeholder="Enter score"
              />
            </div>
          </div>

          {/* Feedback */}
          <div>
            <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
              Feedback Remarks
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded text-white focus:outline-none focus:border-blue-600 transition resize-none"
              placeholder="Provide comments or structural feedback..."
            />
          </div>

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
              className="flex-1 py-2 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer transition text-center flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {submitting && <Loader2 size={12} className="animate-spin" />}
              <span>Submit Grade</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
