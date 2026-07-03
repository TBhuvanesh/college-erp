"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import {
  Bell,
  Calendar,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  Loader2,
  Info,
  Clock,
  User
} from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  content: string;
  targetAudience: string;
  departmentName: string | null;
  semester: number | null;
  priority: "Low" | "Medium" | "High" | "Urgent";
  status: string;
  publishDate: string;
  expiryDate: string | null;
  createdByName: string;
}

export default function StudentAnnouncements() {
  const { accessToken } = useAuth();

  // Lists and filtering state
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("ALL");

  // Pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Expander
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });

      if (debouncedSearch.trim()) {
        queryParams.append("search", debouncedSearch.trim());
      }
      if (priorityFilter !== "ALL") {
        queryParams.append("priority", priorityFilter);
      }

      const res = await apiFetch(`/announcements?${queryParams.toString()}`, {}, accessToken);
      if (res.success && res.data) {
        setAnnouncements(res.data.announcements || []);
        if (res.data.pagination) {
          setTotalPages(res.data.pagination.totalPages || 1);
          setTotalRecords(res.data.pagination.total || 0);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load campus notices.");
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, priorityFilter, accessToken]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAnnouncements();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchAnnouncements]);

  const getPriorityBadgeStyle = (priority: string) => {
    switch (priority) {
      case "Urgent":
        return "dark:bg-rose-500/10 bg-rose-50 dark:text-rose-400 text-rose-700 dark:border-rose-500/20 border-rose-200 animate-pulse";
      case "High":
        return "dark:bg-amber-500/10 bg-amber-50 dark:text-amber-400 text-amber-700 dark:border-amber-500/20 border-amber-200";
      case "Medium":
        return "dark:bg-blue-500/10 bg-blue-50 dark:text-blue-400 text-blue-700 dark:border-blue-500/20 border-blue-200";
      default:
        return "dark:bg-neutral-800 bg-surface-elevated dark:text-neutral-400 text-text-secondary dark:border-neutral-700 border-border-subtle";
    }
  };

  const getPriorityIcon = (priority: string) => {
    if (priority === "Urgent" || priority === "High") {
      return <AlertTriangle size={12} className="shrink-0" />;
    }
    return <Clock size={12} className="shrink-0" />;
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Urgent announcement banner logic
  const urgentNotice = announcements.find(ann => ann.priority === "Urgent");

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h2 className="font-display font-bold text-2xl dark:text-white text-text-primary">Campus Notices</h2>
        <p className="text-xs dark:text-neutral-400 text-text-secondary mt-1">
          Stay updated with official department schedules, exam warnings, and institutional listings.
        </p>
      </div>

      {/* Urgent Notice Banner Widget */}
      {urgentNotice && (
        <div className="p-4 rounded-xl border dark:border-rose-500/30 border-rose-500/20 dark:bg-rose-500/5 bg-rose-50/50 space-y-2 relative overflow-hidden animate-pulse">
          <div className="flex items-center gap-2 dark:text-rose-400 text-rose-700">
            <AlertTriangle size={16} />
            <h4 className="text-xs font-bold font-display uppercase tracking-wider">Urgent Broadcast notice</h4>
          </div>
          <h3 className="text-sm font-bold dark:text-white text-text-primary leading-snug">{urgentNotice.title}</h3>
          <p className="text-[11px] dark:text-neutral-350 text-text-secondary leading-relaxed truncate-2-lines">
            {urgentNotice.content}
          </p>
          <button
            onClick={() => toggleExpand(urgentNotice.id)}
            className="text-[10px] dark:text-rose-400 text-rose-750 font-bold uppercase tracking-wider hover:underline animate-none"
          >
            {expandedId === urgentNotice.id ? "Minimize Notice" : "Read Full Notice"}
          </button>
        </div>
      )}

      {/* Search & Priority Filters */}
      <div className="glass-card border dark:border-neutral-800 border-border-subtle rounded-xl p-4 flex flex-col sm:flex-row gap-3">
        {/* Title Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 dark:text-neutral-500 text-text-muted" />
          <input
            type="text"
            placeholder="Search notice title..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs dark:bg-neutral-950 bg-surface border dark:border-neutral-850 border-border-subtle rounded dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition"
          />
        </div>

        {/* Priority Filter */}
        <div className="w-full sm:w-48 flex items-center gap-2 dark:bg-neutral-950 bg-surface border dark:border-neutral-850 border-border-subtle rounded px-2.5 text-xs dark:text-white text-text-primary">
          <Filter size={12} className="dark:text-neutral-500 text-text-muted" />
          <span className="dark:text-neutral-500 text-text-muted">Priority:</span>
          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            className="bg-transparent dark:text-white text-text-primary cursor-pointer py-2 flex-1 focus:outline-none"
          >
            <option value="ALL">All Levels</option>
            <option value="Urgent">Urgent</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>
      </div>

      {/* Notices Feed */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 glass-card border border-border-subtle rounded-xl">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-xs text-text-muted mt-2 font-mono">Syncing broadcast registry...</p>
          </div>
        ) : error ? (
          <div className="p-6 text-center glass-card border dark:border-rose-955/20 border-rose-500/20 bg-rose-505/[0.02] rounded-xl">
            <AlertTriangle className="w-8 h-8 mx-auto text-rose-500 mb-2" />
            <p className="text-xs dark:text-rose-400 text-rose-700 font-semibold">{error}</p>
            <button
              onClick={fetchAnnouncements}
              className="mt-3 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider dark:bg-neutral-800 bg-surface-elevated hover:bg-surface-hover dark:text-white text-text-primary border dark:border-transparent border-border-subtle rounded transition"
            >
              Retry Sync
            </button>
          </div>
        ) : announcements.length === 0 ? (
          <div className="p-8 text-center glass-card border border-border-subtle rounded-xl">
            <Info className="w-8 h-8 mx-auto text-text-muted mb-2" />
            <p className="text-xs text-text-muted font-mono">No campus notices targeted to your profile.</p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {announcements.map(ann => {
              const isExpanded = expandedId === ann.id;

              return (
                <div
                  key={ann.id}
                  className={`glass-card border rounded-xl overflow-hidden transition-all duration-200 ${
                    ann.priority === "Urgent"
                      ? "dark:border-rose-955/50 border-rose-200 bg-rose-505/[0.005]"
                      : ann.priority === "High"
                      ? "dark:border-amber-955/40 border-amber-200"
                      : "dark:border-neutral-850 border-border-subtle"
                  }`}
                >
                  {/* Card Header Row */}
                  <div
                    onClick={() => toggleExpand(ann.id)}
                    className="p-5 cursor-pointer flex justify-between items-start gap-4 select-none"
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[8px] font-bold border uppercase tracking-wider flex items-center gap-1 ${getPriorityBadgeStyle(
                            ann.priority
                          )}`}
                        >
                          {getPriorityIcon(ann.priority)}
                          <span>{ann.priority} Priority</span>
                        </span>
                        {ann.departmentName && (
                          <span className="px-2 py-0.5 rounded text-[8px] font-bold border dark:border-blue-900/30 border-blue-200 dark:bg-blue-900/10 bg-blue-50 dark:text-blue-400 text-blue-700 font-mono">
                            {ann.departmentName}
                          </span>
                        )}
                        {ann.semester && (
                          <span className="px-2 py-0.5 rounded text-[8px] font-bold border dark:border-indigo-900/30 border-indigo-200 dark:bg-indigo-900/10 bg-indigo-50 dark:text-indigo-400 text-indigo-700 font-mono">
                            Semester {ann.semester}
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-bold dark:text-white text-text-primary leading-tight">{ann.title}</h4>
                      <div className="flex items-center gap-1.5 text-[9px] dark:text-neutral-500 text-text-muted font-mono">
                        <Calendar size={11} className="dark:text-neutral-600 text-text-muted" />
                        <span>Posted on: {ann.publishDate}</span>
                        <span>•</span>
                        <span>By: {ann.createdByName}</span>
                      </div>
                    </div>

                    <div className="dark:text-neutral-500 text-text-secondary dark:hover:text-white hover:text-text-primary transition shrink-0 mt-0.5">
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>

                  {/* Expandable Body */}
                  {isExpanded && (
                    <div className="dark:bg-neutral-950/60 bg-surface-elevated border-t dark:border-neutral-900 border-border-subtle p-5 space-y-3">
                      <p className="text-xs dark:text-neutral-300 text-text-secondary leading-relaxed font-sans whitespace-pre-wrap">
                        {ann.content}
                      </p>
                      
                      {ann.expiryDate && (
                        <div className="flex items-center gap-1.5 text-[10px] dark:text-neutral-500 text-text-muted font-mono pt-2 border-t dark:border-neutral-900/50 border-border-subtle/50">
                          <Clock size={11} className="dark:text-neutral-600 text-text-muted" />
                          <span>Notice validity expires: {ann.expiryDate}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && !loading && (
        <div className="flex items-center justify-between pt-2 select-none">
          <span className="text-[10px] dark:text-neutral-500 text-text-muted font-mono">
            Page {page} of {totalPages} ({totalRecords} total)
          </span>
          <div className="flex items-center gap-1.5">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(p - 1, 1))}
              className="px-2.5 py-1.5 rounded dark:bg-neutral-900 bg-surface-elevated border dark:border-neutral-800 border-border-subtle text-[10px] font-bold uppercase dark:hover:bg-neutral-800 hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition dark:text-neutral-300 text-text-secondary cursor-pointer"
            >
              Prev
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(p + 1, totalPages))}
              className="px-2.5 py-1.5 rounded dark:bg-neutral-900 bg-surface-elevated border dark:border-neutral-800 border-border-subtle text-[10px] font-bold uppercase dark:hover:bg-neutral-800 hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition dark:text-neutral-300 text-text-secondary cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
