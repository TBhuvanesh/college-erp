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

import { usePermission } from "@/context/PermissionContext";

interface ProfileOverviewProps {
  profile: ProfileView;
}

export const ProfileOverview: React.FC<ProfileOverviewProps> = ({ profile }) => {
  const { rbacRole } = usePermission();

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

  const getRolePermissionsList = (role: string) => {
    switch (role) {
      case "Super Admin":
        return [
          "User Management (Onboard Students/Faculty)",
          "Roles & Access Control Configuration",
          "ERP Settings & Parameters Setup",
          "Academic Departments Configs",
          "Database Maintenance & Reset Control",
          "Full System Configuration Registry"
        ];
      case "College Admin":
        return [
          "Manage Student Directory Registries",
          "Manage Faculty Roster Records",
          "Configure Academic Subjects & Curriculum",
          "Track Invoice Collections & Fees",
          "Manage Institutional Notices & Announcements",
          "Generate Official Registry Reports"
        ];
      case "HOD":
        return [
          "Monitor Department Analytics Dashboard",
          "Review Faculty timetables & allocations",
          "Syllabus completion & lesson logs",
          "Oversee Department Student Registry",
          "Department attendance aggregates",
          "Access Mentorship compliance ledgers"
        ];
      case "Academic Coordinator":
        return [
          "Configure live Academic Calendar",
          "Approve timetables & teaching planners",
          "Semester scheduling & plans setup",
          "Schedule Mid/End semester examinations"
        ];
      case "Placement Officer":
        return [
          "Post job openings & internships",
          "Monitor placement drives progress",
          "Manage Opportunity Hub listings",
          "Generate career placements reports"
        ];
      case "Mentoring Head":
        return [
          "Create and manage mentor groups",
          "Allocate faculty advisors to student batches",
          "Review mentorship feedback & warnings"
        ];
      case "Faculty":
        return [
          "Mark subject daily timetable attendance",
          "Grade examinations & mid/final test items",
          "Manage LMS subject course files",
          "Review assigned batch mentorship groups",
          "Recommend student roadmaps & milestones"
        ];
      case "Student":
        return [
          "Track daily subject attendance progress",
          "Access LMS course files & download notes",
          "Inspect graded test marks & transcripts",
          "Post and submit assignments",
          "Browse Opportunity Hub postings",
          "Review Fee Dues & outstanding statements"
        ];
      default:
        return ["Read academic profile info"];
    }
  };

  const isStudent = profile.role === "student";
  const isFaculty = profile.role === "faculty";
  const isAdmin = profile.role === "admin";

  return (
    <div className="glass-card rounded-xl border dark:border-neutral-850 border-border-subtle p-6 flex flex-col md:flex-row gap-6 items-start font-sans">
      {/* Profile Avatar Container */}
      <div className="w-full md:w-32 h-36 dark:bg-neutral-955 bg-neutral-100 border dark:border-neutral-900 border-border-subtle rounded-lg flex flex-col items-center justify-center shrink-0">
        <div className="p-3 dark:bg-neutral-900 bg-surface border dark:border-neutral-800 border-border-subtle rounded-full text-blue-400">
          <User size={36} />
        </div>
        <span className="text-[9px] font-mono dark:text-neutral-500 text-text-muted mt-3 tracking-wider uppercase">
          {profile.role} AVATAR
        </span>
      </div>

      {/* Profile Details Grid */}
      <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6">
        {/* Name and Basic Info */}
        <div className="col-span-1 sm:col-span-2 md:col-span-3 border-b dark:border-neutral-900 border-border-subtle pb-3 mb-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display font-bold text-xl dark:text-white text-text-primary leading-tight">
              {profile.fullName}
            </h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider uppercase dark:bg-blue-500/10 bg-blue-50 dark:text-blue-400 text-blue-700 border dark:border-blue-500/20 border-blue-200">
              <Shield size={10} />
              {rbacRole}
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider uppercase border ${
                profile.isActive
                  ? "dark:bg-emerald-500/10 bg-emerald-50 dark:text-emerald-400 text-emerald-700 dark:border-emerald-500/20 border-emerald-200"
                  : "dark:bg-rose-500/10 bg-rose-50 dark:text-rose-400 text-rose-700 dark:border-rose-500/20 border-rose-200"
              }`}
            >
              {profile.isActive ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
              {profile.isActive ? "Active" : "Inactive"}
            </span>
          </div>
          <p className="text-[10px] dark:text-neutral-500 text-text-muted font-mono mt-1">
            User ID: {profile.userId.toUpperCase()}
          </p>
        </div>

        {/* Role-Specific Properties */}
        {isStudent && (
          <>
            <div>
              <span className="text-[9px] uppercase font-bold dark:text-neutral-500 text-text-muted flex items-center gap-1">
                <Hash size={10} className="dark:text-neutral-600 text-text-muted" />
                Roll Number
              </span>
              <p className="text-xs font-semibold dark:text-white text-text-primary mt-1 font-mono">
                {(profile as any).rollNumber || "N/A"}
              </p>
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold dark:text-neutral-500 text-text-muted flex items-center gap-1">
                <Building size={10} className="dark:text-neutral-600 text-text-muted" />
                Department
              </span>
              <p className="text-xs font-semibold dark:text-white text-text-primary mt-1">
                {(profile as any).department?.name || "N/A"}
              </p>
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold dark:text-neutral-500 text-text-muted flex items-center gap-1">
                <GraduationCap size={10} className="dark:text-neutral-600 text-text-muted" />
                Program
              </span>
              <p className="text-xs font-semibold dark:text-white text-text-primary mt-1">
                {(profile as any).program?.name || "N/A"}
              </p>
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold dark:text-neutral-500 text-text-muted flex items-center gap-1">
                <BookOpen size={10} className="dark:text-neutral-600 text-text-muted" />
                Semester & Year
              </span>
              <p className="text-xs font-semibold dark:text-white text-text-primary mt-1">
                Semester {(profile as any).semester || "N/A"} / Year {(profile as any).year || "N/A"}
              </p>
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold dark:text-neutral-500 text-text-muted flex items-center gap-1">
                <ShieldCheck size={10} className="dark:text-neutral-600 text-text-muted" />
                Status
              </span>
              <p className="text-xs font-semibold dark:text-white text-text-primary mt-1">
                {(profile as any).status || "N/A"}
              </p>
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold dark:text-neutral-500 text-text-muted flex items-center gap-1">
                <Calendar size={10} className="dark:text-neutral-600 text-text-muted" />
                Academic Year
              </span>
              <p className="text-xs font-semibold dark:text-white text-text-primary mt-1">
                {(profile as any).academicYear || "N/A"}
              </p>
            </div>
          </>
        )}

        {isFaculty && (
          <>
            <div>
              <span className="text-[9px] uppercase font-bold dark:text-neutral-500 text-text-muted flex items-center gap-1">
                <Hash size={10} className="dark:text-neutral-600 text-text-muted" />
                Employee Number
              </span>
              <p className="text-xs font-semibold dark:text-white text-text-primary mt-1 font-mono">
                {(profile as any).employeeNumber || "N/A"}
              </p>
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold dark:text-neutral-500 text-text-muted flex items-center gap-1">
                <Briefcase size={10} className="dark:text-neutral-600 text-text-muted" />
                Designation
              </span>
              <p className="text-xs font-semibold dark:text-white text-text-primary mt-1">
                {(profile as any).designation || "N/A"}
              </p>
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold dark:text-neutral-500 text-text-muted flex items-center gap-1">
                <Building size={10} className="dark:text-neutral-600 text-text-muted" />
                Department
              </span>
              <p className="text-xs font-semibold dark:text-white text-text-primary mt-1">
                {(profile as any).department?.name || "N/A"}
              </p>
            </div>
          </>
        )}

        {isAdmin && (
          <div>
            <span className="text-[9px] uppercase font-bold dark:text-neutral-500 text-text-muted flex items-center gap-1">
              <Shield size={10} className="dark:text-neutral-600 text-text-muted" />
              Role Authority
            </span>
            <p className="text-xs font-semibold dark:text-white text-text-primary mt-1">
              {rbacRole} Control
            </p>
          </div>
        )}

        {/* Global Metadata (common to all roles) */}
        <div>
          <span className="text-[9px] uppercase font-bold dark:text-neutral-500 text-text-muted flex items-center gap-1">
            <Mail size={10} className="dark:text-neutral-600 text-text-muted" />
            Registered Email
          </span>
          <p className="text-xs font-semibold dark:text-white text-text-primary mt-1 truncate">
            {profile.email}
          </p>
        </div>

        <div>
          <span className="text-[9px] uppercase font-bold dark:text-neutral-500 text-text-muted flex items-center gap-1">
            <Phone size={10} className="dark:text-neutral-600 text-text-muted" />
            Phone Number
          </span>
          <p className="text-xs font-semibold dark:text-white text-text-primary mt-1 font-mono">
            {profile.phoneNumber || "None configured"}
          </p>
        </div>

        <div className="col-span-1 sm:col-span-2 md:col-span-3 border-t dark:border-neutral-900/50 border-border-subtle pt-3 mt-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <span className="text-[9px] uppercase font-bold dark:text-neutral-500 text-text-muted flex items-center gap-1">
              <Calendar size={10} className="dark:text-neutral-600 text-text-muted" />
              Account Created
            </span>
            <p className="text-xs dark:text-neutral-300 text-text-secondary mt-1">
              {formatDate(profile.createdAt)}
            </p>
          </div>
          <div>
            <span className="text-[9px] uppercase font-bold dark:text-neutral-500 text-text-muted flex items-center gap-1">
              <Clock size={10} className="dark:text-neutral-600 text-text-muted" />
              Last Signed In
            </span>
            <p className="text-xs dark:text-neutral-300 text-text-secondary mt-1">
              {formatDate(profile.lastLogin)}
            </p>
          </div>
        </div>

        {/* Active RBAC Role Permissions */}
        <div className="col-span-1 sm:col-span-2 md:col-span-3 border-t dark:border-neutral-900 border-border-subtle pt-4 mt-2">
          <span className="text-[10px] uppercase font-bold text-blue-500 tracking-wider font-mono block mb-2">
            Active Security Permissions ({rbacRole})
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
            {getRolePermissionsList(rbacRole).map((perm, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs dark:text-neutral-300 text-text-secondary">
                <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                <span>{perm}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

