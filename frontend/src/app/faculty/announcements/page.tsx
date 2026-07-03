"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import {
  Bell,
  Calendar,
  AlertTriangle,
  Search,
  Filter,
  Loader2,
  Info,
  Clock,
  ChevronRight,
  ArrowUpDown,
  X
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

export default function FacultyAnnouncements() {
  const { accessToken } = useAuth();

  // Data state
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & sorting
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<"priority" | "date">("priority");

  // Pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Expand Modal details
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  // Debounce search
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
      setError(err.message || "Failed to load faculty bulletin boards.");
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

  // Client-side sorting for "latest date" or "default priority"
  const getSortedAnnouncements = () => {
    if (sortBy === "priority") {
      // Backend already returns sorted by priority, so we can just return the array
      return announcements;
    }
    // Sort by publishDate DESC, then createdAt DESC
    return [...announcements].sort((a, b) => {
      const dateA = new Date(a.publishDate).getTime();
      const dateB = new Date(b.publishDate).getTime();
      if (dateB !== dateA) return dateB - dateA;
      return b.id.localeCompare(a.id);
    });
  };

  const getPriorityBadgeStyle = (priority: string) => {
    switch (priority) {
      case "Urgent":
        return "dark:bg-rose-500/10 bg-rose-50 dark:text-rose-400 text-rose-700 border dark:border-rose-500/20 border-rose-200";
      case "High":
        return "dark:bg-amber-500/10 bg-amber-50 dark:text-amber-400 text-amber-700 border dark:border-amber-500/20 border-amber-200";
      case "Medium":
        return "dark:bg-blue-500/10 bg-blue-50 dark:text-blue-400 text-blue-700 border dark:border-blue-500/20 border-blue-200";
      default:
        return "dark:bg-surface-elevated bg-neutral-100 dark:text-text-muted text-text-secondary border dark:border-neutral-700 border-border-subtle";
    }
  };

  const sortedList = getSortedAnnouncements();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-2xl text-text-primary">Faculty Bulletins</h2>
          <p className="text-xs text-text-muted mt-1">
            Access official notices, department notifications, and campus holiday broadcasts.
          </p>
        </div>
      </div>

      {/* Filter and Sorting Row */}
      <div className="bg-surface border border-border-subtle rounded-xl p-4 flex flex-col md:flex-row gap-3">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search bulletins by title..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-background border border-border-subtle rounded text-text-primary focus:outline-none focus:border-blue-600 transition"
          />
        </div>

        {/* Priority Filter */}
        <div className="w-full md:w-48 flex items-center gap-2 bg-background border border-border-subtle rounded px-2.5 text-xs text-text-primary">
          <Filter size={12} className="text-text-muted" />
          <span className="text-text-muted">Priority:</span>
          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            className="bg-transparent text-text-primary cursor-pointer py-2 flex-1 focus:outline-none"
          >
            <option value="ALL">All Levels</option>
            <option value="Urgent">Urgent</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>

        {/* Sorting Toggle */}
        <div className="w-full md:w-48 flex items-center gap-2 bg-background border border-border-subtle rounded px-2.5 text-xs text-text-primary">
          <ArrowUpDown size={12} className="text-text-muted" />
          <span className="text-text-muted">Sort by:</span>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="bg-transparent text-text-primary cursor-pointer py-2 flex-1 focus:outline-none font-semibold"
          >
            <option value="priority">Priority Rank</option>
            <option value="date">Latest Date</option>
          </select>
        </div>
      </div>

      {/* Main Bulletins Grid List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-surface border border-border-subtle rounded-xl">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-xs text-text-muted mt-2 font-mono">Syncing departmental bulletin boards...</p>
        </div>
      ) : error ? (
        <div className="p-8 text-center bg-surface border border-rose-950/20 bg-rose-500/[0.02] rounded-xl">
          <AlertTriangle className="w-8 h-8 mx-auto text-rose-500 mb-2" />
          <p className="text-xs text-rose-400 font-semibold">{error}</p>
          <button
            onClick={fetchAnnouncements}
            className="mt-3 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-surface-elevated hover:bg-surface-hover text-text-primary rounded transition"
          >
            Retry Sync
          </button>
        </div>
      ) : sortedList.length === 0 ? (
        <div className="p-10 text-center bg-surface border border-border-subtle rounded-xl">
          <Info className="w-8 h-8 mx-auto text-neutral-600 mb-2" />
          <p className="text-xs text-text-muted font-mono">No active announcements logged for faculty.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedList.map(ann => (
            <div
              key={ann.id}
              onClick={() => setSelectedAnnouncement(ann)}
              className={`bg-surface border rounded-xl p-5 hover:bg-surface-hover hover:shadow transition flex flex-col justify-between min-h-[160px] select-none ${
                ann.priority === "Urgent"
                  ? "dark:border-rose-950 border-rose-200 dark:bg-rose-500/[0.005] bg-rose-50/[0.03] hover:border-rose-300 dark:hover:border-rose-900"
                  : "border-border-subtle hover:border-border-strong"
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[8px] font-bold border uppercase tracking-wider ${getPriorityBadgeStyle(
                      ann.priority
                    )}`}
                  >
                    {ann.priority}
                  </span>
                  <div className="flex items-center gap-1 text-[9px] dark:text-text-muted text-text-secondary font-mono">
                    <Calendar size={11} className="dark:text-neutral-600 text-text-muted" />
                    <span>{ann.publishDate}</span>
                  </div>
                </div>

                <h4 className="text-sm font-bold text-text-primary leading-tight group-hover:text-blue-500 transition">
                  {ann.title}
                </h4>
                <p className="text-xs text-text-muted line-clamp-2 leading-relaxed">
                  {ann.content}
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border-subtle/60 mt-3">
                <span className="text-[9px] text-text-muted font-mono">Posted by: {ann.createdByName}</span>
                <span className="text-[10px] text-blue-500 font-bold flex items-center gap-0.5">
                  <span>Read Notice</span>
                  <ChevronRight size={12} />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && !loading && (
        <div className="flex items-center justify-between pt-4 select-none">
          <span className="text-[10px] text-text-muted font-mono">
            Showing Page {page} of {totalPages} ({totalRecords} bulletins)
          </span>
          <div className="flex items-center gap-1.5">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(p - 1, 1))}
              className="px-3 py-1.5 rounded bg-surface border border-border-subtle text-[10px] font-bold uppercase hover:bg-surface-elevated disabled:opacity-40 disabled:cursor-not-allowed transition text-text-secondary cursor-pointer"
            >
              Previous Page
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(p + 1, totalPages))}
              className="px-3 py-1.5 rounded bg-surface border border-border-subtle text-[10px] font-bold uppercase hover:bg-surface-elevated disabled:opacity-40 disabled:cursor-not-allowed transition text-text-secondary cursor-pointer"
            >
              Next Page
            </button>
          </div>
        </div>
      )}

      {/* Modal Dialog: Notice Context breakdown */}
      {selectedAnnouncement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-lg bg-surface border border-border-subtle rounded-xl p-6 shadow-2xl relative animate-scale-up">
            {/* Exit button */}
            <button
              onClick={() => setSelectedAnnouncement(null)}
              className="absolute right-4 top-4 p-1 rounded bg-surface-elevated hover:bg-surface-hover text-text-muted hover:text-text-primary transition cursor-pointer"
            >
              <X size={16} />
            </button>

            {/* Header info */}
            <div className="space-y-1.5 pr-8 pb-4 border-b border-border-subtle">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded text-[8px] font-bold border uppercase tracking-wider ${getPriorityBadgeStyle(
                    selectedAnnouncement.priority
                  )}`}
                >
                  {selectedAnnouncement.priority} Priority
                </span>
                {selectedAnnouncement.departmentName && (
                  <span className="px-2 py-0.5 rounded text-[8px] font-bold border dark:border-blue-900/30 border-blue-200 dark:bg-blue-900/10 bg-blue-50 dark:text-blue-400 text-blue-700 font-mono">
                    {selectedAnnouncement.departmentName} Dept
                  </span>
                )}
                {selectedAnnouncement.semester && (
                  <span className="px-2 py-0.5 rounded text-[8px] font-bold border dark:border-indigo-900/30 border-indigo-200 dark:bg-indigo-900/10 bg-indigo-50 dark:text-indigo-400 text-indigo-700 font-mono">
                    Semester {selectedAnnouncement.semester}
                  </span>
                )}
              </div>
              <h3 className="font-display font-bold text-lg text-text-primary leading-tight">
                {selectedAnnouncement.title}
              </h3>
              <div className="flex items-center gap-2 text-[10px] text-text-muted font-mono">
                <span>Posted: {selectedAnnouncement.publishDate}</span>
                <span>•</span>
                <span>Author: {selectedAnnouncement.createdByName}</span>
              </div>
            </div>

            {/* Content Body */}
            <div className="py-5 space-y-4 max-h-[350px] overflow-y-auto pr-2">
              <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap font-sans">
                {selectedAnnouncement.content}
              </p>
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-border-subtle flex items-center justify-between">
              <span className="text-[10px] dark:text-neutral-500 text-text-muted font-mono">
                {selectedAnnouncement.expiryDate
                  ? `Valid until: ${selectedAnnouncement.expiryDate}`
                  : "Notice remains open indefinitely"}
              </span>
              <button
                type="button"
                onClick={() => setSelectedAnnouncement(null)}
                className="px-4 py-2 text-xs font-semibold rounded dark:bg-neutral-800 bg-neutral-100 dark:hover:bg-neutral-750 hover:bg-neutral-200 dark:text-neutral-350 text-text-primary transition cursor-pointer select-none border border-border-subtle"
              >
                Close notice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
