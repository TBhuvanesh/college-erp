"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import {
  Users,
  Loader2,
  AlertCircle,
  Search,
  Filter,
  ChevronRight,
  RefreshCw,
  FolderOpen
} from "lucide-react";
import { listMentorGroups, type MentorGroup } from "@/lib/mentorship";

export default function FacultyMentorGroupsDashboard() {
  const { accessToken } = useAuth();
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<MentorGroup[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Filters & Search
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [sessionFilter, setSessionFilter] = useState("ALL");
  const [methodFilter, setMethodFilter] = useState("ALL");

  const fetchGroups = useCallback(async (isRefresh = false) => {
    if (!accessToken) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await listMentorGroups({}, accessToken);
      setGroups(data);
    } catch (err: any) {
      setError(err.message || "Failed to load mentor groups");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  // Derived filter choices
  const departments = useMemo(() => {
    const list = new Set(groups.map(g => g.departmentName).filter((d): d is string => !!d));
    return Array.from(list);
  }, [groups]);

  // Filtered Groups
  const filteredGroups = useMemo(() => {
    return groups.filter(g => {
      const searchLower = search.toLowerCase();
      const matchSearch =
        (g.departmentName ?? "").toLowerCase().includes(searchLower) ||
        g.section.toLowerCase().includes(searchLower) ||
        (g.mentorName ?? "").toLowerCase().includes(searchLower);
      if (!matchSearch) return false;

      if (deptFilter !== "ALL" && g.departmentName !== deptFilter) return false;
      if (sessionFilter !== "ALL" && g.academicSession !== sessionFilter) return false;
      if (methodFilter !== "ALL" && g.assignmentMethod !== methodFilter) return false;

      return true;
    });
  }, [groups, search, deptFilter, sessionFilter, methodFilter]);

  // Total students sum across active groups
  const totalMentees = useMemo(() => {
    return groups.reduce((acc, curr) => acc + (curr.studentCount ?? 0), 0);
  }, [groups]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 text-accent-blue animate-spin" />
        <p className="text-text-secondary text-sm">Loading mentor groups...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 p-6 max-w-md mx-auto text-center">
        <AlertCircle className="w-12 h-12 text-danger" />
        <h3 className="text-lg font-bold text-text-primary">Dashboard Error</h3>
        <p className="text-text-secondary text-sm leading-normal">{error}</p>
        <button 
          onClick={() => fetchGroups()}
          className="mt-2 px-4 py-2 bg-accent-blue hover:bg-accent-blue/90 text-white rounded-lg text-sm font-semibold cursor-pointer inline-flex items-center gap-1.5 mx-auto"
        >
          <RefreshCw size={14} /> Retry loading
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">My Mentor Groups</h1>
          <p className="text-text-secondary text-sm mt-1">
            Faculty desk to monitor academic progress and log counselling sessions by group.
          </p>
        </div>
        <button
          onClick={() => fetchGroups(true)}
          disabled={refreshing}
          className="p-2 border border-border-subtle bg-surface hover:bg-surface-hover text-text-secondary hover:text-text-primary rounded-lg text-sm font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Refreshing..." : "Refresh list"}
        </button>
      </div>

      {/* Summary Stat */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-surface border border-border-subtle rounded-xl p-4 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-accent-blue-soft text-accent-blue">
            <Users size={20} />
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Total Assigned Groups</span>
            <h3 className="text-xl sm:text-2xl font-black text-text-primary leading-tight mt-0.5">{groups.length}</h3>
          </div>
        </div>

        <div className="bg-surface border border-border-subtle rounded-xl p-4 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-success-soft text-success">
            <Users size={20} />
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Total Active Mentees</span>
            <h3 className="text-xl sm:text-2xl font-black text-success leading-tight mt-0.5">{totalMentees} Students</h3>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-surface border border-border-subtle rounded-xl p-4 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
            <input
              type="text"
              placeholder="Search groups by department, section..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-background border border-border-subtle rounded-lg text-text-primary placeholder:text-text-muted focus:outline-hidden focus:border-accent-blue transition-colors"
            />
          </div>

          <div className="flex items-center gap-1.5 text-text-secondary text-xs sm:text-sm font-semibold shrink-0">
            <Filter size={15} />
            <span>Filters</span>
          </div>
        </div>

        {/* Filter Selection list */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Department */}
          <div>
            <label className="text-[10px] uppercase font-bold text-text-muted block mb-1">Department</label>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="w-full py-1.5 px-2.5 text-xs bg-background border border-border-subtle rounded-lg text-text-primary font-medium focus:outline-hidden"
            >
              <option value="ALL">All Departments</option>
              {departments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Academic Session */}
          <div>
            <label className="text-[10px] uppercase font-bold text-text-muted block mb-1">Academic Session</label>
            <select
              value={sessionFilter}
              onChange={(e) => setSessionFilter(e.target.value)}
              className="w-full py-1.5 px-2.5 text-xs bg-background border border-border-subtle rounded-lg text-text-primary font-medium focus:outline-hidden"
            >
              <option value="ALL">All Sessions</option>
              {["1-1", "1-2", "2-1", "2-2", "3-1", "3-2", "4-1", "4-2"].map(s => (
                <option key={s} value={s}>Session {s}</option>
              ))}
            </select>
          </div>

          {/* Method */}
          <div>
            <label className="text-[10px] uppercase font-bold text-text-muted block mb-1">Assignment Method</label>
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="w-full py-1.5 px-2.5 text-xs bg-background border border-border-subtle rounded-lg text-text-primary font-medium focus:outline-hidden"
            >
              <option value="ALL">All Methods</option>
              <option value="range">Roll Range</option>
              <option value="section">Whole Section</option>
              <option value="manual">Manual Select</option>
            </select>
          </div>
        </div>
      </div>

      {/* Groups Grid Cards */}
      {filteredGroups.length === 0 ? (
        <div className="bg-surface border border-border-subtle rounded-xl py-16 text-center shadow-sm">
          <FolderOpen className="w-12 h-12 text-text-muted/60 mx-auto mb-2" />
          <h3 className="text-text-primary font-bold text-base">No Mentor Groups Found</h3>
          <p className="text-text-muted text-sm mt-1 max-w-sm mx-auto">
            You do not have any groups assigned matching the current filter. Contact your Mentoring Head to create assignments.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredGroups.map((g) => (
            <div 
              key={g.id}
              className="bg-surface border border-border-subtle hover:border-border-strong rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              {/* Card Body */}
              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-text-primary text-base sm:text-lg leading-snug">
                      {g.departmentName}
                    </h3>
                    <p className="text-xs text-text-muted font-semibold uppercase tracking-wider mt-0.5">
                      Session {g.academicSession}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-accent-blue-soft border border-accent-blue/15 flex items-center justify-center font-bold text-accent-blue shrink-0">
                    {g.section}
                  </div>
                </div>

                <div className="space-y-2 text-xs sm:text-sm text-text-secondary">
                  <div className="flex items-center justify-between">
                    <span>Assignment Method</span>
                    <span className="font-semibold text-text-primary uppercase">{g.assignmentMethod}</span>
                  </div>
                  {g.assignmentMethod === "range" && (
                    <div className="flex items-center justify-between">
                      <span>Roll Number Scope</span>
                      <span className="font-mono font-semibold text-text-primary text-[11px]">{g.rollNumberStart} - {g.rollNumberEnd}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-border-subtle/50 pt-2.5 mt-1">
                    <span className="font-medium text-text-muted uppercase tracking-wider text-[10px]">Students Count</span>
                    <span className="font-black text-accent-blue">{g.studentCount ?? 0} Assigned</span>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="p-3 bg-surface-elevated/25 border-t border-border-subtle/50 flex justify-end">
                <Link
                  href={`/faculty/mentorship/${g.id}`}
                  className="px-3.5 py-1.5 rounded-lg bg-accent-blue hover:bg-accent-blue/90 hover:text-white text-white text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  View Group <ChevronRight size={13} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
