"use client";

import React, { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  studentId: string | null;
  studentName: string | null;
}

export const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  studentId,
  studentName,
}) => {
  const { accessToken } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!studentId) return;
    setError(null);
    setSubmitting(true);

    try {
      const res = await apiFetch(
        `/students/${studentId}`,
        {
          method: "DELETE",
        },
        accessToken
      );

      if (res.success) {
        onSuccess(res.message || "Student profile deactivated successfully");
        onClose();
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm animate-fade-in p-4">
      {/* Modal Card */}
      <div className="w-full max-w-sm bg-surface border border-border-subtle rounded-xl p-5 shadow-2xl relative animate-scale-up">
        {/* Warning Icon */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500">
            <AlertTriangle size={20} />
          </div>
          <div>
            <h3 className="font-display font-bold text-text-primary text-base">Deactivate Profile</h3>
            <p className="text-[10px] text-text-muted mt-0.5">Destructive administrative action.</p>
          </div>
        </div>

        {error && (
          <div className="p-2.5 mb-4 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
            {error}
          </div>
        )}

        <div className="text-xs text-text-secondary mb-6 leading-relaxed">
          Are you sure you want to deactivate <strong className="text-text-primary">{studentName}</strong>?
          This will suspend their student account and block their portal access immediately.
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="flex-1 py-2 text-xs font-semibold rounded bg-surface-elevated hover:bg-surface-hover text-text-secondary hover:text-text-primary cursor-pointer transition text-center"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={handleDelete}
            className="flex-1 py-2 text-xs font-semibold rounded bg-rose-600 hover:bg-rose-500 text-white cursor-pointer transition text-center flex items-center justify-center gap-1.5"
          >
            {submitting && <Loader2 size={12} className="animate-spin" />}
            <span>Deactivate</span>
          </button>
        </div>
      </div>
    </div>
  );
};
