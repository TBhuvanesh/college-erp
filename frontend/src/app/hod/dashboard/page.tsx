"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { 
  Users, 
  GraduationCap, 
  BookOpen, 
  Percent, 
  ClipboardList,
  Loader2, 
  Bell, 
  ArrowRight,
  ArrowUpRight,
  Sparkles
} from "lucide-react";
import { StatsCard } from "@/components/Dashboard/StatsCard";

interface HODDashboardData {
  profile: {
    id: string;
    fullName: string;
    employeeNumber: string;
    departmentName: string;
    designation: string;
  };
  metrics: {
    totalFaculty: number;
    totalStudents: number;
    totalClasses: number;
    attendanceRate: number;
    pendingApprovals: number;
  };
  notices: {
    id: string;
    title: string;
    priority: string;
    publishDate: string;
  }[];
  quickActions: {
    label: string;
    route: string;
  }[];
}

export default function HODDashboard() {
  const { accessToken } = useAuth();
  const [data, setData] = useState<HODDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;

    const fetchHODStats = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiFetch("/dashboard/hod", {}, accessToken);
        if (res.success && res.data) {
          setData(res.data);
        } else {
          setError(res.message || "Failed to load department dashboard");
        }
      } catch (err: any) {
        setError(err.message || "Connection error to server");
      } finally {
        setLoading(false);
      }
    };

    fetchHODStats();
  }, [accessToken]);

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-text-muted">
        <Loader2 className="animate-spin text-indigo-500 mb-3" size={32} />
        <span className="font-mono text-xs">Accessing department desk...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-12 px-6 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center max-w-lg mx-auto">
        <span className="text-sm font-semibold text-rose-500 block">Dashboard Error</span>
        <p className="text-xs text-text-secondary mt-1">{error || "Could not retrieve stats."}</p>
      </div>
    );
  }

  const { profile, metrics, notices, quickActions } = data;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="relative rounded-2xl border dark:border-neutral-800 border-border-subtle bg-surface p-6 overflow-hidden shadow-sm">
        <div className="absolute right-6 top-6 text-indigo-500/10 dark:text-indigo-400/5 pointer-events-none">
          <Sparkles size={80} />
        </div>
        <div className="z-10 relative">
          <span className="text-[10px] tracking-wider uppercase font-bold text-indigo-500">Department Control</span>
          <h2 className="font-display font-extrabold text-2xl dark:text-white text-text-primary mt-1">
            Welcome, Head of Department
          </h2>
          <p className="text-xs dark:text-neutral-400 text-text-secondary mt-1 max-w-xl leading-relaxed">
            Manage your department faculty roster, review student academic rosters, allocate course timetables, and monitor daily attendance aggregates.
          </p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatsCard
          title="Faculty Members"
          value={metrics.totalFaculty}
          icon={Users}
          description="Active teaching staff"
          iconClass="bg-indigo-500/10 text-indigo-500"
        />
        <StatsCard
          title="Active Students"
          value={metrics.totalStudents}
          icon={GraduationCap}
          description="Registered scholars"
          iconClass="bg-blue-500/10 text-blue-500"
        />
        <StatsCard
          title="Allocated Classes"
          value={metrics.totalClasses}
          icon={BookOpen}
          description="Timetable slots active"
          iconClass="bg-cyan-500/10 text-cyan-500"
        />
        <StatsCard
          title="Attendance Rate"
          value={`${metrics.attendanceRate}%`}
          icon={Percent}
          description="Aggregate department average"
          iconClass="bg-emerald-500/10 text-emerald-500"
        />
        <StatsCard
          title="Pending Approvals"
          value={metrics.pendingApprovals}
          icon={ClipboardList}
          description="Draft results pending"
          iconClass={metrics.pendingApprovals > 0 ? "bg-amber-500/10 text-amber-500" : "bg-neutral-500/10 text-text-muted"}
        />
      </div>

      {/* Lower Details Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Notices & Bulletins (Col 7) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="glass-card border dark:border-neutral-800 border-border-subtle bg-surface rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-indigo-500" />
                <h3 className="font-display font-bold text-sm text-text-primary">Department Announcements</h3>
              </div>
            </div>

            <div className="space-y-3">
              {notices.length === 0 ? (
                <div className="py-8 text-center text-xs dark:text-neutral-500 text-text-muted font-mono">
                  No active department announcements.
                </div>
              ) : (
                notices.map((notice) => (
                  <div 
                    key={notice.id}
                    className="p-3 rounded-lg bg-background border dark:border-neutral-850 border-border-subtle flex items-start justify-between gap-3"
                  >
                    <div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                        notice.priority === "Urgent" 
                          ? "bg-rose-500/10 text-rose-500 border-rose-500/20 animate-pulse"
                          : notice.priority === "High"
                          ? "bg-orange-500/10 text-orange-500 border-orange-500/20"
                          : "bg-neutral-500/10 text-text-secondary border-neutral-500/20"
                      }`}>
                        {notice.priority}
                      </span>
                      <h4 className="text-xs font-semibold text-text-primary mt-1.5 leading-snug">{notice.title}</h4>
                    </div>
                    <span className="text-[10px] font-mono text-text-muted shrink-0 mt-0.5">{notice.publishDate}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Profile Details & Quick Actions (Col 5) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Quick Actions Panel */}
          <div className="glass-card border dark:border-neutral-800 border-border-subtle bg-surface rounded-xl p-5 shadow-sm">
            <h3 className="font-display font-bold text-sm text-text-primary border-b border-border-subtle pb-3 mb-4">
              Quick Operations
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {quickActions.map((act) => (
                <Link
                  key={act.label}
                  href={act.route}
                  className="p-3 rounded-lg border dark:border-neutral-850 border-border-subtle bg-background dark:hover:bg-neutral-800 hover:bg-neutral-55 dark:hover:border-neutral-700 hover:border-border-strong text-xs font-semibold text-text-secondary hover:text-text-primary cursor-pointer transition flex items-center justify-between group"
                >
                  <span>{act.label}</span>
                  <ArrowRight size={14} className="text-text-muted group-hover:text-text-primary group-hover:translate-x-0.5 transition-transform" />
                </Link>
              ))}
            </div>
          </div>

          {/* Department Profile Box */}
          <div className="glass-card border dark:border-neutral-800 border-border-subtle bg-surface rounded-xl p-5 shadow-sm">
            <h3 className="font-display font-bold text-sm text-text-primary border-b border-border-subtle pb-3 mb-4">
              Department Desk Info
            </h3>
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">HOD Representative:</span>
                <span className="font-semibold text-text-primary">{profile.fullName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Employee Number:</span>
                <span className="font-mono font-semibold text-text-primary">{profile.employeeNumber}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Department:</span>
                <span className="font-semibold text-text-primary">{profile.departmentName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Official Designation:</span>
                <span className="capitalize font-semibold text-text-primary">{profile.designation.replace("_", " ")}</span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
