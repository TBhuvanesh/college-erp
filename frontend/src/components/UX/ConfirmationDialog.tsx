"use client";

import React from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Are you sure?",
  message = "This action cannot be undone. Please confirm you want to proceed.",
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDestructive = true,
  isLoading = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />

      {/* Dialog container */}
      <div className="relative w-full max-w-sm rounded-xl border dark:border-neutral-800 border-border-subtle dark:bg-neutral-900 bg-white p-5 shadow-2xl transition-all scale-100 animate-in fade-in zoom-in duration-200">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-full ${isDestructive ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-600' : 'bg-blue-50 dark:bg-blue-950/30 text-blue-600'}`}>
            <AlertTriangle size={18} />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold dark:text-white text-text-primary">
              {title}
            </h3>
            <p className="mt-1 text-xs text-text-muted dark:text-neutral-400 leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2.5 text-xs font-semibold">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-3.5 py-2 rounded-lg dark:bg-neutral-800 bg-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-750 dark:text-neutral-300 text-text-primary border dark:border-neutral-800 border-border-subtle cursor-pointer disabled:opacity-50 transition"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-3.5 py-2 rounded-lg text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition ${
              isDestructive 
                ? 'bg-rose-600 hover:bg-rose-500 active:bg-rose-700' 
                : 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700'
            }`}
          >
            {isLoading && <Loader2 size={12} className="animate-spin" />}
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
