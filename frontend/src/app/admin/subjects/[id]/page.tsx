"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import type { SubjectProfile } from "@/types/subjectAllocation";
import {
  BookOpen,
  Users,
  Layers,
  ArrowLeft,
  Calendar,
  FileText,
  Bookmark,
  CheckCircle,
  HelpCircle,
  AlertCircle
} from "lucide-react";

export default function SubjectProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const { accessToken } = useAuth();

  const [profile, setProfile] = useState<SubjectProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!id || !accessToken) return;
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch(`/subject-allocations/subject/${id}/profile`, {}, accessToken);
        if (res.success && res.data?.profile) {
          setProfile(res.data.profile);
        } else {
          setError(res.message || "Failed to load subject details.");
        }
      } catch (err: any) {
        setError("Error loading subject profile.");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [id, accessToken]);

  if (loading) {
    return (
      <div className="p-20 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
        <span className="text-xs text-text-secondary">Loading subject profile metrics...</span>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-all font-semibold"
        >
          <ArrowLeft size={14} />
          <span>Go Back</span>
        </button>
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-xl flex items-center gap-3">
          <AlertCircle size={16} />
          <span>{error || "Unable to display subject profile details."}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header back bar */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-all font-semibold"
      >
        <ArrowLeft size={14} />
        <span>Back to Curriculum Scheme</span>
      </button>

      {/* Title */}
      <div>
        <span className="text-[9px] uppercase font-bold text-indigo-500 tracking-wider font-mono">
          Course Catalog Profile
        </span>
        <h2 className="font-display font-bold text-2xl dark:text-white text-text-primary mt-1">
          {profile.name}
        </h2>
        <p className="text-xs dark:text-neutral-400 text-text-secondary mt-0.5 font-mono">
          Code: {profile.code} • System ID: {profile.id.toUpperCase()}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Details and Sections (2 Columns) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Details Overview Card */}
          <div className="glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl p-5 space-y-6">
            <h3 className="font-display font-bold text-sm dark:text-white text-text-primary flex items-center gap-2 border-b dark:border-neutral-800 border-border-subtle pb-3">
              <Bookmark size={14} className="text-indigo-400" />
              <span>Academic Parameters</span>
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-xs">
              <div>
                <span className="text-[10px] text-text-muted uppercase font-bold block">Department</span>
                <span className="font-semibold text-text-primary block mt-1.5">{profile.departmentName}</span>
              </div>
              <div>
                <span className="text-[10px] text-text-muted uppercase font-bold block">Program / Scheme</span>
                <span className="font-semibold text-text-primary block mt-1.5">{profile.programName || "Unspecified"}</span>
              </div>
              <div>
                <span className="text-[10px] text-text-muted uppercase font-bold block">Regulation</span>
                <span className="font-semibold text-text-primary block mt-1.5">{profile.regulation}</span>
              </div>
              <div>
                <span className="text-[10px] text-text-muted uppercase font-bold block">Year / Semester</span>
                <span className="font-semibold text-text-primary block mt-1.5">
                  Year {profile.year || "N/A"} • Sem {profile.semesterRaw || "N/A"} (Sem {profile.semester})
                </span>
              </div>
              <div>
                <span className="text-[10px] text-text-muted uppercase font-bold block">L - T - P Structure</span>
                <span className="font-semibold text-text-primary block mt-1.5">
                  {profile.lectureHours} - {profile.tutorialHours} - {profile.practicalHours}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-text-muted uppercase font-bold block">Academic Credits</span>
                <span className="font-semibold text-text-primary block mt-1.5">{profile.credits} Credits</span>
              </div>
              <div>
                <span className="text-[10px] text-text-muted uppercase font-bold block">Enrolled Students</span>
                <span className="font-semibold text-text-primary block mt-1.5">{profile.studentsEnrolled} Enrolled</span>
              </div>
              <div>
                <span className="text-[10px] text-text-muted uppercase font-bold block">Status</span>
                <span className="inline-flex px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold uppercase tracking-wider text-[9px] mt-1 border border-emerald-500/20">
                  {profile.status}
                </span>
              </div>
            </div>

            {profile.description && (
              <div className="border-t dark:border-neutral-800 border-border-subtle pt-4 text-xs text-text-secondary leading-relaxed">
                <span className="text-[10px] text-text-muted uppercase font-bold block mb-1">Subject Syllabus Description</span>
                <p className="dark:text-neutral-300 text-text-primary font-normal">{profile.description}</p>
              </div>
            )}
          </div>

          {/* Assigned Faculty and Sections mapping */}
          <div className="glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl p-5">
            <h3 className="font-display font-bold text-sm dark:text-white text-text-primary mb-4 flex items-center gap-2">
              <Users size={14} className="text-indigo-400" />
              <span>Assigned Teaching Faculty</span>
            </h3>

            {profile.assignedFaculty.length === 0 ? (
              <div className="py-6 text-center text-xs text-text-muted border border-dashed dark:border-neutral-800 border-border-subtle rounded-lg">
                No faculty allocations are mapped to this subject. Assign instructors in the Subject Allocation dashboard.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {profile.assignedFaculty.map((f) => (
                  <div
                    key={f.allocationId}
                    className="p-4 border dark:border-neutral-800 border-border-subtle dark:bg-neutral-950/40 bg-neutral-50/50 rounded-lg flex items-center justify-between hover:border-indigo-500/30 transition-all"
                  >
                    <div>
                      <span className="font-bold text-xs dark:text-white text-text-primary">{f.facultyName}</span>
                      <p className="text-[10px] text-text-secondary mt-0.5 font-mono">ID: {f.employeeNumber}</p>
                      <p className="text-[10px] text-text-muted mt-1">Session: {f.academicYear}</p>
                    </div>
                    <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full px-2.5 py-0.5 font-bold uppercase">
                      Section {f.section}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Integration Statuses (1 Column) */}
        <div className="space-y-6">
          
          <div className="glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl p-5">
            <h3 className="font-display font-bold text-sm dark:text-white text-text-primary mb-4 flex items-center gap-2">
              <Layers size={14} className="text-indigo-400" />
              <span>Module Integrations</span>
            </h3>

            <div className="space-y-4">
              
              {/* Attendance Integration */}
              <div className="p-3 border dark:border-neutral-800 border-border-subtle dark:bg-neutral-900/30 bg-neutral-50/20 rounded-lg">
                <div className="flex items-center gap-2 text-xs">
                  <Calendar size={14} className="text-text-muted" />
                  <span className="font-semibold text-text-secondary">Attendance Logs</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px]">
                  <span className="text-text-muted">Ledger State</span>
                  <span className="font-bold dark:text-white text-text-primary">{profile.attendanceStatus}</span>
                </div>
              </div>

              {/* LMS Integration */}
              <div className="p-3 border dark:border-neutral-800 border-border-subtle dark:bg-neutral-900/30 bg-neutral-50/20 rounded-lg">
                <div className="flex items-center gap-2 text-xs">
                  <BookOpen size={14} className="text-text-muted" />
                  <span className="font-semibold text-text-secondary">LMS Classroom Materials</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px]">
                  <span className="text-text-muted">Classroom Space</span>
                  <span className="font-bold dark:text-white text-text-primary">{profile.lmsStatus}</span>
                </div>
              </div>

              {/* Internal Marks Integration */}
              <div className="p-3 border dark:border-neutral-800 border-border-subtle dark:bg-neutral-900/30 bg-neutral-50/20 rounded-lg">
                <div className="flex items-center gap-2 text-xs">
                  <FileText size={14} className="text-text-muted" />
                  <span className="font-semibold text-text-secondary">Internal Grades Ledger</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px]">
                  <span className="text-text-muted">Gradebook Status</span>
                  <span className="font-bold dark:text-white text-text-primary">{profile.internalMarksStatus}</span>
                </div>
              </div>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
