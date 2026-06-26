"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { ProfileView, getProfile } from "@/lib/profile";
import { ProfileOverview } from "@/components/Profile/ProfileOverview";
import { EditProfileForm } from "@/components/Profile/EditProfileForm";
import { ChangePasswordForm } from "@/components/Profile/ChangePasswordForm";
import { Loader2, User } from "lucide-react";

export default function FacultyProfilePage() {
  const { accessToken } = useAuth();
  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getProfile(accessToken);
      setProfile(data);
    } catch (err: any) {
      setError(err.message || "Failed to load profile details.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProfile();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchProfile]);

  const handleProfileUpdate = (updatedProfile: ProfileView) => {
    setProfile(updatedProfile);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-neutral-400 font-mono text-xs">
        <Loader2 className="animate-spin text-blue-500 mb-2" size={32} />
        <span>Loading faculty profile...</span>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold text-center my-10">
        {error || "Unable to load profile info."}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="space-y-1">
        <span className="text-[9px] uppercase font-bold text-blue-500 tracking-wider font-mono">
          Faculty Portal
        </span>
        <h2 className="font-display font-bold text-xl text-white flex items-center gap-2">
          <User size={20} className="text-neutral-400" />
          <span>My Profile & Settings</span>
        </h2>
        <p className="text-[10px] text-neutral-400">
          Manage your faculty profile settings, contact information and credentials.
        </p>
      </div>

      {/* Desktop-First Adaptive Layout */}
      <div className="space-y-6">
        {/* Full Width Overview Card at top */}
        <ProfileOverview profile={profile} />

        {/* Forms side-by-side on desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <EditProfileForm
            profile={profile}
            accessToken={accessToken!}
            onSuccess={handleProfileUpdate}
          />
          <ChangePasswordForm accessToken={accessToken!} />
        </div>
      </div>
    </div>
  );
}
