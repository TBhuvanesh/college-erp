"use client";

import React, { useState } from "react";
import { changePassword } from "@/lib/profile";
import { KeyRound, Loader2, ShieldCheck, Check, X, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

interface ChangePasswordFormProps {
  accessToken: string;
}

export const ChangePasswordForm: React.FC<ChangePasswordFormProps> = ({
  accessToken,
}) => {
  const { logout } = useAuth();
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(3);

  // Password rules validation
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /\d/.test(newPassword);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword !== "";
  const diffFromCurrent = newPassword !== currentPassword && currentPassword !== "";

  const isValidPassword = hasMinLength && hasUppercase && hasLowercase && hasNumber;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      if (!currentPassword) {
        throw new Error("Current password is required");
      }
      if (!isValidPassword) {
        throw new Error("New password does not meet the requirements");
      }
      if (!passwordsMatch) {
        throw new Error("New password and confirm password do not match");
      }
      if (newPassword === currentPassword) {
        throw new Error("New password must be different from current password");
      }

      setSubmitting(true);

      await changePassword(
        {
          currentPassword,
          newPassword,
          confirmPassword,
        },
        accessToken
      );

      setSuccess(true);
      
      // Auto-logout countdown
      let count = 3;
      const interval = setInterval(() => {
        count -= 1;
        setCountdown(count);
        if (count <= 0) {
          clearInterval(interval);
          logout().then(() => {
            router.push("/");
          });
        }
      }, 1000);

    } catch (err: any) {
      setError(err.message || "Failed to update password");
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="glass-card rounded-xl border dark:border-emerald-500/20 border-emerald-200 dark:bg-emerald-500/5 bg-emerald-50 p-6 text-center space-y-4">
        <div className="w-12 h-12 rounded-full dark:bg-emerald-500/10 bg-emerald-100 dark:text-emerald-400 text-emerald-750 dark:border-emerald-500/20 border-emerald-200 flex items-center justify-center mx-auto">
          <ShieldCheck size={24} />
        </div>
        <h3 className="font-display font-bold dark:text-white text-text-primary text-base">
          Password Updated Successfully
        </h3>
        <p className="text-xs dark:text-neutral-400 text-text-secondary max-w-sm mx-auto leading-normal">
          Your credentials have been updated, invalidating all other active sessions. You will be logged out to sign in with your new password.
        </p>
        <div className="text-xs font-mono text-emerald-400 font-bold">
          Logging out in {countdown} seconds...
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl border dark:border-neutral-850 border-border-subtle p-6">
      <h3 className="font-display font-bold dark:text-white text-text-primary text-sm uppercase tracking-wider mb-4 border-b dark:border-neutral-900 border-border-subtle pb-2 flex items-center gap-2">
        <KeyRound size={16} className="text-blue-400" />
        <span>Change Account Password</span>
      </h3>

      {/* Notifications */}
      {error && (
        <div className="p-3 mb-4 rounded-lg dark:bg-rose-500/10 bg-rose-50 border dark:border-rose-500/20 border-rose-205 dark:text-rose-455 text-rose-700 text-xs font-semibold">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Current Password */}
        <div>
          <label className="block text-[10px] font-bold dark:text-neutral-400 text-text-secondary uppercase mb-1">
            Current Password <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showCurrent ? "text" : "password"}
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 pr-9 text-xs dark:bg-neutral-950 bg-surface border dark:border-neutral-800 border-border-subtle rounded dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center dark:text-neutral-500 text-text-muted hover:text-text-primary"
            >
              {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        {/* New Password */}
        <div>
          <label className="block text-[10px] font-bold dark:text-neutral-400 text-text-secondary uppercase mb-1">
            New Password <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showNew ? "text" : "password"}
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 pr-9 text-xs dark:bg-neutral-950 bg-surface border dark:border-neutral-800 border-border-subtle rounded dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center dark:text-neutral-500 text-text-muted hover:text-text-primary"
            >
              {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        {/* Password Strength Validation Checklist */}
        <div className="p-3 dark:bg-neutral-950/50 bg-neutral-100 border dark:border-neutral-900 border-border-subtle rounded space-y-2">
          <span className="block text-[9px] uppercase font-bold dark:text-neutral-500 text-text-muted">
            Password Requirements
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 gap-x-4">
            <div className="flex items-center gap-1.5 text-[10px]">
              {hasMinLength ? (
                <Check size={12} className="text-emerald-400" />
              ) : (
                <X size={12} className="dark:text-neutral-600 text-text-muted" />
              )}
              <span className={hasMinLength ? "dark:text-neutral-300 text-text-secondary" : "dark:text-neutral-500 text-text-muted"}>
                At least 8 characters
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px]">
              {hasUppercase ? (
                <Check size={12} className="text-emerald-400" />
              ) : (
                <X size={12} className="dark:text-neutral-600 text-text-muted" />
              )}
              <span className={hasUppercase ? "dark:text-neutral-300 text-text-secondary" : "dark:text-neutral-500 text-text-muted"}>
                At least 1 uppercase letter
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px]">
              {hasLowercase ? (
                <Check size={12} className="text-emerald-400" />
              ) : (
                <X size={12} className="dark:text-neutral-600 text-text-muted" />
              )}
              <span className={hasLowercase ? "dark:text-neutral-300 text-text-secondary" : "dark:text-neutral-500 text-text-muted"}>
                At least 1 lowercase letter
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px]">
              {hasNumber ? (
                <Check size={12} className="text-emerald-400" />
              ) : (
                <X size={12} className="dark:text-neutral-600 text-text-muted" />
              )}
              <span className={hasNumber ? "dark:text-neutral-300 text-text-secondary" : "dark:text-neutral-500 text-text-muted"}>
                At least 1 number
              </span>
            </div>
          </div>
        </div>

        {/* Confirm Password */}
        <div>
          <label className="block text-[10px] font-bold dark:text-neutral-400 text-text-secondary uppercase mb-1">
            Confirm New Password <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showConfirm ? "text" : "password"}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 pr-9 text-xs dark:bg-neutral-950 bg-surface border dark:border-neutral-800 border-border-subtle rounded dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center dark:text-neutral-500 text-text-muted hover:text-text-primary"
            >
              {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>

          {/* Confirm match message */}
          {confirmPassword && (
            <div className="flex items-center gap-1.5 mt-1.5 text-[10px]">
              {passwordsMatch ? (
                <>
                  <Check size={12} className="text-emerald-400" />
                  <span className="text-emerald-400 font-semibold">Passwords match</span>
                </>
              ) : (
                <>
                  <X size={12} className="text-rose-400" />
                  <span className="text-rose-400">Passwords do not match</span>
                </>
              )}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting || !isValidPassword || !passwordsMatch || (newPassword === currentPassword)}
          className="w-full py-2.5 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-500 dark:disabled:bg-neutral-800 disabled:bg-neutral-200 dark:disabled:text-neutral-500 disabled:text-text-muted dark:disabled:border-neutral-850 disabled:border-border-subtle disabled:cursor-not-allowed text-white cursor-pointer transition text-center flex items-center justify-center gap-1.5 mt-2"
        >
          {submitting && <Loader2 size={14} className="animate-spin" />}
          <span>Update Password</span>
        </button>
      </form>
    </div>
  );
};
