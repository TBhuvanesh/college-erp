"use client";

import React from "react";
import { ProfileView } from "@/lib/profile";
import {
  User,
  Mail,
  Phone,
  Shield,
  Calendar,
  Clock,
  BookOpen,
  Briefcase,
  Building,
  Hash,
  GraduationCap,
  ShieldCheck,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface ProfileOverviewProps {
  profile: ProfileView;
}

export const ProfileOverview: React.FC<ProfileOverviewProps> = ({ profile }) => {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "N/A";
      return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "N/A";
    }
  };

  const isStudent = profile.role === "student";
  const isFaculty = profile.role === "faculty";
  const isAdmin = profile.role === "admin";

  return (
    <div className="glass-card rounded-xl border border-neutral-850 p-6 flex flex-col md:flex-row gap-6 items-start">
      {/* Profile Avatar Container */}
      <div className="w-full md:w-32 h-36 bg-neutral-950 border border-neutral-900 rounded-lg flex flex-col items-center justify-center shrink-0">
        <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-full text-blue-400">
          <User size={36} />
        </div>
        <span className="text-[9px] font-mono text-neutral-500 mt-3 tracking-wider uppercase">
          {profile.role} AVATAR
        </span>
      </div>

      {/* Profile Details Grid */}
      <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6">
        {/* Name and Basic Info */}
        <div className="col-span-1 sm:col-span-2 md:col-span-3 border-b border-neutral-900 pb-3 mb-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display font-bold text-xl text-white leading-tight">
              {profile.fullName}
            </h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Shield size={10} />
              {profile.role}
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider uppercase border ${
                profile.isActive
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-rose-500/10 text-rose-400 border-rose-500/20"
              }`}
            >
              {profile.isActive ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
              {profile.isActive ? "Active" : "Inactive"}
            </span>
          </div>
          <p className="text-[10px] text-neutral-500 font-mono mt-1">
            User ID: {profile.userId.toUpperCase()}
          </p>
        </div>

        {/* Role-Specific Properties */}
        {isStudent && (
          <>
            <div>
              <span className="text-[9px] uppercase font-bold text-neutral-500 flex items-center gap-1">
                <Hash size={10} className="text-neutral-600" />
                Roll Number
              </span>
              <p className="text-xs font-semibold text-white mt-1 font-mono">
                {(profile as any).rollNumber || "N/A"}
              </p>
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold text-neutral-500 flex items-center gap-1">
                <Building size={10} className="text-neutral-600" />
                Department
              </span>
              <p className="text-xs font-semibold text-white mt-1">
                {(profile as any).department?.name || "N/A"}
              </p>
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold text-neutral-500 flex items-center gap-1">
                <GraduationCap size={10} className="text-neutral-600" />
                Program
              </span>
              <p className="text-xs font-semibold text-white mt-1">
                {(profile as any).program?.name || "N/A"}
              </p>
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold text-neutral-500 flex items-center gap-1">
                <BookOpen size={10} className="text-neutral-600" />
                Semester & Year
              </span>
              <p className="text-xs font-semibold text-white mt-1">
                Semester {(profile as any).semester || "N/A"} / Year {(profile as any).year || "N/A"}
              </p>
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold text-neutral-500 flex items-center gap-1">
                <ShieldCheck size={10} className="text-neutral-600" />
                Status
              </span>
              <p className="text-xs font-semibold text-white mt-1">
                {(profile as any).status || "N/A"}
              </p>
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold text-neutral-500 flex items-center gap-1">
                <Calendar size={10} className="text-neutral-600" />
                Academic Year
              </span>
              <p className="text-xs font-semibold text-white mt-1">
                {(profile as any).academicYear || "N/A"}
              </p>
            </div>
          </>
        )}

        {isFaculty && (
          <>
            <div>
              <span className="text-[9px] uppercase font-bold text-neutral-500 flex items-center gap-1">
                <Hash size={10} className="text-neutral-600" />
                Employee Number
              </span>
              <p className="text-xs font-semibold text-white mt-1 font-mono">
                {(profile as any).employeeNumber || "N/A"}
              </p>
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold text-neutral-500 flex items-center gap-1">
                <Briefcase size={10} className="text-neutral-600" />
                Designation
              </span>
              <p className="text-xs font-semibold text-white mt-1">
                {(profile as any).designation || "N/A"}
              </p>
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold text-neutral-500 flex items-center gap-1">
                <Building size={10} className="text-neutral-600" />
                Department
              </span>
              <p className="text-xs font-semibold text-white mt-1">
                {(profile as any).department?.name || "N/A"}
              </p>
            </div>
          </>
        )}

        {isAdmin && (
          <div>
            <span className="text-[9px] uppercase font-bold text-neutral-500 flex items-center gap-1">
              <Shield size={10} className="text-neutral-600" />
              Role Authority
            </span>
            <p className="text-xs font-semibold text-white mt-1">
              System Admin / Operations
            </p>
          </div>
        )}

        {/* Global Metadata (common to all roles) */}
        <div>
          <span className="text-[9px] uppercase font-bold text-neutral-500 flex items-center gap-1">
            <Mail size={10} className="text-neutral-600" />
            Registered Email
          </span>
          <p className="text-xs font-semibold text-white mt-1 truncate">
            {profile.email}
          </p>
        </div>

        <div>
          <span className="text-[9px] uppercase font-bold text-neutral-500 flex items-center gap-1">
            <Phone size={10} className="text-neutral-600" />
            Phone Number
          </span>
          <p className="text-xs font-semibold text-white mt-1 font-mono">
            {profile.phoneNumber || "None configured"}
          </p>
        </div>

        <div className="col-span-1 sm:col-span-2 md:col-span-3 border-t border-neutral-900/50 pt-3 mt-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <span className="text-[9px] uppercase font-bold text-neutral-500 flex items-center gap-1">
              <Calendar size={10} className="text-neutral-600" />
              Account Created
            </span>
            <p className="text-xs text-neutral-300 mt-1">
              {formatDate(profile.createdAt)}
            </p>
          </div>
          <div>
            <span className="text-[9px] uppercase font-bold text-neutral-500 flex items-center gap-1">
              <Clock size={10} className="text-neutral-600" />
              Last Signed In
            </span>
            <p className="text-xs text-neutral-300 mt-1">
              {formatDate(profile.lastLogin)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
