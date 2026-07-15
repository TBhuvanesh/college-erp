"use client";

import React from "react";
import Link from "next/link";
import { Lock, ArrowLeft, ShieldAlert } from "lucide-react";
import { usePermission } from "@/context/PermissionContext";

export default function UnauthorizedPage() {
  const { rbacRole } = usePermission();

  const getDashboardLink = () => {
    const roleLower = rbacRole.toLowerCase();
    if (roleLower.includes("admin")) {
      return "/admin/dashboard";
    }
    if (roleLower.includes("hod")) {
      return "/hod/dashboard";
    }
    if (roleLower.includes("coordinator") || roleLower.includes("placement") || roleLower.includes("mentoring") || roleLower.includes("faculty")) {
      return "/faculty/dashboard";
    }
    return "/student/dashboard";
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-neutral-950 px-4 relative overflow-hidden font-sans">
      {/* Background accents */}
      <div className="absolute top-1/4 left-1/4 w-[350px] h-[350px] rounded-full bg-red-500/5 dark:bg-red-500/10 blur-[80px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] rounded-full bg-orange-500/5 dark:bg-orange-500/10 blur-[80px] pointer-events-none" />

      <div className="z-10 text-center max-w-md w-full p-8 rounded-2xl border border-red-200/50 dark:border-red-500/10 bg-white dark:bg-neutral-900 shadow-xl shadow-red-500/5">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 mb-6 border border-red-200/40 dark:border-red-500/20">
          <Lock className="h-8 w-8 animate-pulse" />
        </div>

        <h1 className="font-display font-extrabold text-2xl md:text-3xl dark:text-white text-text-primary tracking-tight">
          403 Unauthorized
        </h1>

        <p className="text-xs text-text-muted mt-2 uppercase tracking-widest font-mono font-bold">
          Access Restrained
        </p>

        <p className="text-sm dark:text-neutral-400 text-text-secondary mt-4 leading-relaxed">
          Your current active role (<span className="font-bold text-red-500">{rbacRole}</span>) does not have administrative permissions to view this section.
        </p>

        <div className="mt-8 pt-6 border-t border-border-subtle flex flex-col gap-3">
          <Link
            href={getDashboardLink()}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-xs font-semibold bg-red-600 dark:bg-red-500 text-white hover:bg-red-700 dark:hover:bg-red-600 shadow-lg shadow-red-500/20 dark:shadow-none transition-all cursor-pointer"
          >
            <ArrowLeft size={14} />
            Back to Dashboard
          </Link>
          <Link
            href="/"
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-xs font-semibold border border-border-subtle bg-surface hover:bg-slate-100 dark:hover:bg-neutral-800 dark:text-neutral-300 transition-all cursor-pointer"
          >
            Go to Portal Lobby
          </Link>
        </div>
      </div>
    </div>
  );
}
