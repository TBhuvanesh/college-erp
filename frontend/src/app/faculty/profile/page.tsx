"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { ProfileView, getProfile } from "@/lib/profile";
import { apiFetch } from "@/lib/api";
import { ProfileOverview } from "@/components/Profile/ProfileOverview";
import { EditProfileForm } from "@/components/Profile/EditProfileForm";
import { ChangePasswordForm } from "@/components/Profile/ChangePasswordForm";
import { Loader2, User, BookOpen } from "lucide-react";

export default function FacultyProfilePage() {
  const { accessToken } = useAuth();
  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [subjects, setSubjects] = useState<any[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(true);

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

  const fetchAllocations = useCallback(async () => {
    if (!accessToken) return;
    setSubjectsLoading(true);
    try {
      const res = await apiFetch("/subject-allocations", {}, accessToken);
      if (res.success && res.data?.allocations) {
        setSubjects(res.data.allocations.filter((a: any) => a.status === "active"));
      }
    } catch (err) {
      console.error("Error fetching faculty allocations", err);
    } finally {
      setSubjectsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProfile();
      fetchAllocations();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchProfile, fetchAllocations]);

  const handleProfileUpdate = (updatedProfile: ProfileView) => {
    setProfile(updatedProfile);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] dark:text-neutral-400 text-text-secondary font-mono text-xs">
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
        <h2 className="font-display font-bold text-xl dark:text-white text-text-primary flex items-center gap-2">
          <User size={20} className="dark:text-neutral-400 text-text-muted" />
          <span>My Profile & Settings</span>
        </h2>
        <p className="text-[10px] dark:text-neutral-400 text-text-secondary">
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

        {/* Teaching Subjects & Load Card */}
        <div className="glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl p-5">
          <div className="flex items-center gap-3 border-b dark:border-neutral-800 border-border-subtle pb-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400">
              <BookOpen size={16} />
            </div>
            <div>
              <h3 className="font-display font-bold dark:text-white text-text-primary text-base leading-tight">Teaching Subjects</h3>
              <p className="text-[10px] dark:text-neutral-400 text-text-secondary mt-0.5">Your currently allocated academic course workload.</p>
            </div>
          </div>

          {subjectsLoading ? (
            <div className="py-6 text-center text-xs text-text-muted">Loading assigned subjects...</div>
          ) : subjects.length === 0 ? (
            <div className="py-6 text-center text-xs text-text-muted">No active subject allocations assigned.</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {subjects.map((sub: any) => (
                  <div key={sub.id} className="p-4 dark:bg-neutral-950/40 bg-background border dark:border-neutral-900 border-border-subtle rounded-lg flex flex-col justify-between hover:border-indigo-500/30 transition-all">
                    <div>
                      <span className="font-mono text-[9px] dark:text-indigo-400 text-indigo-600 font-bold uppercase tracking-wider">{sub.subjectCode}</span>
                      <h4 className="font-bold text-xs dark:text-white text-text-primary mt-1">{sub.subjectName}</h4>
                      <p className="text-[10px] text-text-secondary mt-0.5">Section {sub.section} • Semester {sub.semester}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t dark:border-neutral-800 border-border-subtle pt-3 flex justify-between items-center text-xs">
                <span className="text-text-secondary">Total Teaching Load:</span>
                <span className="font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">{subjects.length} Subjects</span>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
