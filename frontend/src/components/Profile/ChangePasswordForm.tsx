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
      <div className="glass-card rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto">
          <ShieldCheck size={24} />
        </div>
        <h3 className="font-display font-bold text-white text-base">
          Password Updated Successfully
        </h3>
        <p className="text-xs text-neutral-400 max-w-sm mx-auto leading-normal">
          Your credentials have been updated, invalidating all other active sessions. You will be logged out to sign in with your new password.
        </p>
        <div className="text-xs font-mono text-emerald-400 font-bold">
          Logging out in {countdown} seconds...
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl border border-neutral-850 p-6">
      <h3 className="font-display font-bold text-white text-sm uppercase tracking-wider mb-4 border-b border-neutral-900 pb-2 flex items-center gap-2">
        <KeyRound size={16} className="text-blue-400" />
        <span>Change Account Password</span>
      </h3>

      {/* Notifications */}
      {error && (
        <div className="p-3 mb-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Current Password */}
        <div>
          <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
            Current Password <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showCurrent ? "text" : "password"}
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 pr-9 text-xs bg-neutral-950 border border-neutral-800 rounded text-white focus:outline-none focus:border-blue-600 transition"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-500 hover:text-neutral-300"
            >
              {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        {/* New Password */}
        <div>
          <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
            New Password <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showNew ? "text" : "password"}
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 pr-9 text-xs bg-neutral-950 border border-neutral-800 rounded text-white focus:outline-none focus:border-blue-600 transition"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-500 hover:text-neutral-300"
            >
              {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        {/* Password Strength Validation Checklist */}
        <div className="p-3 bg-neutral-950/50 border border-neutral-900 rounded space-y-2">
          <span className="block text-[9px] uppercase font-bold text-neutral-500">
            Password Requirements
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 gap-x-4">
            <div className="flex items-center gap-1.5 text-[10px]">
              {hasMinLength ? (
                <Check size={12} className="text-emerald-400" />
              ) : (
                <X size={12} className="text-neutral-600" />
              )}
              <span className={hasMinLength ? "text-neutral-300" : "text-neutral-500"}>
                At least 8 characters
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px]">
              {hasUppercase ? (
                <Check size={12} className="text-emerald-400" />
              ) : (
                <X size={12} className="text-neutral-600" />
              )}
              <span className={hasUppercase ? "text-neutral-300" : "text-neutral-500"}>
                At least 1 uppercase letter
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px]">
              {hasLowercase ? (
                <Check size={12} className="text-emerald-400" />
              ) : (
                <X size={12} className="text-neutral-600" />
              )}
              <span className={hasLowercase ? "text-neutral-300" : "text-neutral-500"}>
                At least 1 lowercase letter
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px]">
              {hasNumber ? (
                <Check size={12} className="text-emerald-400" />
              ) : (
                <X size={12} className="text-neutral-600" />
              )}
              <span className={hasNumber ? "text-neutral-300" : "text-neutral-500"}>
                At least 1 number
              </span>
            </div>
          </div>
        </div>

        {/* Confirm Password */}
        <div>
          <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
            Confirm New Password <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showConfirm ? "text" : "password"}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 pr-9 text-xs bg-neutral-950 border border-neutral-800 rounded text-white focus:outline-none focus:border-blue-600 transition"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-500 hover:text-neutral-300"
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
          className="w-full py-2.5 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-800 disabled:text-neutral-500 disabled:border-neutral-850 disabled:cursor-not-allowed text-white cursor-pointer transition text-center flex items-center justify-center gap-1.5 mt-2"
        >
          {submitting && <Loader2 size={14} className="animate-spin" />}
          <span>Update Password</span>
        </button>
      </form>
    </div>
  );
};
