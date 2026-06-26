"use client";

import React, { useState, useEffect } from "react";
import { ProfileView, updateProfile } from "@/lib/profile";
import { Mail, Phone, Loader2, Save } from "lucide-react";

interface EditProfileFormProps {
  profile: ProfileView;
  accessToken: string;
  onSuccess: (updatedProfile: ProfileView, message: string) => void;
}

export const EditProfileForm: React.FC<EditProfileFormProps> = ({
  profile,
  accessToken,
  onSuccess,
}) => {
  const [email, setEmail] = useState(profile.email);
  const [phoneNumber, setPhoneNumber] = useState(profile.phoneNumber || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sync inputs if profile changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setEmail(profile.email);
      setPhoneNumber(profile.phoneNumber || "");
    }, 0);
    return () => clearTimeout(timer);
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setSubmitting(true);

    try {
      const emailTrimmed = email.trim().toLowerCase();
      const phoneTrimmed = phoneNumber.trim();

      // Basic client-side validation
      if (!emailTrimmed) {
        throw new Error("Email address is required");
      }
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailTrimmed)) {
        throw new Error("Please enter a valid email address");
      }

      if (phoneTrimmed) {
        if (phoneTrimmed.length < 7) {
          throw new Error("Phone number must be at least 7 characters");
        }
        if (phoneTrimmed.length > 20) {
          throw new Error("Phone number must be at most 20 characters");
        }
        const phoneRegex = /^[+\d\s\-().]+$/;
        if (!phoneRegex.test(phoneTrimmed)) {
          throw new Error("Invalid phone number format. Allowed characters: digits, space, +, -, (, ), .");
        }
      }

      // If nothing has changed, avoid unnecessary API request
      if (emailTrimmed === profile.email && phoneTrimmed === (profile.phoneNumber || "")) {
        setSuccessMsg("Profile is already up to date.");
        setSubmitting(false);
        return;
      }

      const updated = await updateProfile(
        {
          email: emailTrimmed,
          phoneNumber: phoneTrimmed || undefined,
        },
        accessToken
      );

      setSuccessMsg("Profile details updated successfully.");
      onSuccess(updated, "Profile details updated successfully.");
    } catch (err: any) {
      setError(err.message || "Failed to update profile");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="glass-card rounded-xl border border-neutral-850 p-6">
      <h3 className="font-display font-bold text-white text-sm uppercase tracking-wider mb-4 border-b border-neutral-900 pb-2 flex items-center gap-2">
        <Mail size={16} className="text-blue-400" />
        <span>Contact Information</span>
      </h3>

      {/* Notifications */}
      {error && (
        <div className="p-3 mb-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="p-3 mb-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
          {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
            Email Address <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-neutral-500 pointer-events-none">
              <Mail size={14} />
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded text-white focus:outline-none focus:border-blue-600 transition"
              placeholder="name@university.edu"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
            Phone Number
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-neutral-500 pointer-events-none">
              <Phone size={14} />
            </span>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded text-white focus:outline-none focus:border-blue-600 transition"
              placeholder="+1 (555) 019-2834"
            />
          </div>
          <span className="text-[9px] text-neutral-500 mt-1 block leading-normal">
            Minimum 7 digits. Allowed: spaces, dashes, parentheses, +, .
          </span>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition text-center flex items-center justify-center gap-1.5 mt-2"
        >
          {submitting ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Save size={14} />
          )}
          <span>Save Contact Changes</span>
        </button>
      </form>
    </div>
  );
};
