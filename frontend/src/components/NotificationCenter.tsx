"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import {
  Bell,
  CheckCircle,
  Eye,
  EyeOff,
  AlertCircle,
  Clock,
  Star,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Award,
  Calendar,
  Briefcase,
  AlertTriangle
} from "lucide-react";

export type NotificationType =
  | "Announcement"
  | "Assignment"
  | "Grade Released"
  | "Event"
  | "Internship"
  | "Job Opportunity"
  | "Placement Drive"
  | "Reminder"
  | "Academic Alert";

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  sourceModule: string | null;
  sourceId: string | null;
  targetRole: "all" | "admin" | "faculty" | "student";
  departmentId: string | null;
  departmentName: string | null;
  semester: number | null;
  isImportant: boolean;
  isRead: boolean;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

const NOTIFICATION_TYPES: NotificationType[] = [
  "Announcement",
  "Assignment",
  "Grade Released",
  "Event",
  "Internship",
  "Job Opportunity",
  "Placement Drive",
  "Reminder",
  "Academic Alert",
];

export function getNotificationBadgeStyles(type: NotificationType) {
  switch (type) {
    case "Announcement":
      return "dark:bg-purple-500/10 bg-purple-50 dark:text-purple-400 text-purple-700 dark:border-purple-500/20 border-purple-200";
    case "Assignment":
      return "dark:bg-blue-500/10 bg-blue-50 dark:text-blue-400 text-blue-700 dark:border-blue-500/20 border-blue-200";
    case "Grade Released":
      return "dark:bg-emerald-500/10 bg-emerald-50 dark:text-emerald-400 text-emerald-700 dark:border-emerald-500/20 border-emerald-200";
    case "Event":
      return "dark:bg-amber-500/10 bg-amber-50 dark:text-amber-400 text-amber-700 dark:border-amber-500/20 border-amber-200";
    case "Internship":
      return "dark:bg-cyan-500/10 bg-cyan-50 dark:text-cyan-400 text-cyan-700 dark:border-cyan-500/20 border-cyan-200";
    case "Job Opportunity":
      return "dark:bg-indigo-500/10 bg-indigo-50 dark:text-indigo-400 text-indigo-700 dark:border-indigo-500/20 border-indigo-200";
    case "Placement Drive":
      return "dark:bg-pink-500/10 bg-pink-50 dark:text-pink-400 text-pink-700 dark:border-pink-500/20 border-pink-200";
    case "Reminder":
      return "dark:bg-orange-500/10 bg-orange-50 dark:text-orange-400 text-orange-700 dark:border-orange-500/20 border-orange-200";
    case "Academic Alert":
      return "dark:bg-rose-500/10 bg-rose-50 dark:text-rose-455 text-rose-700 dark:border-rose-500/20 border-rose-200 font-bold";
    default:
      return "dark:bg-neutral-500/10 bg-neutral-100 dark:text-neutral-400 text-text-secondary dark:border-neutral-500/20 border-border-subtle";
  }
}

export function getNotificationIcon(type: NotificationType, size = 16) {
  switch (type) {
    case "Announcement":
      return <Bell size={size} className="text-purple-400" />;
    case "Assignment":
      return <BookOpen size={size} className="text-blue-400" />;
    case "Grade Released":
      return <Award size={size} className="text-emerald-400" />;
    case "Event":
      return <Calendar size={size} className="text-amber-400" />;
    case "Internship":
    case "Job Opportunity":
    case "Placement Drive":
      return <Briefcase size={size} className="text-cyan-400" />;
    case "Reminder":
      return <Clock size={size} className="text-orange-400" />;
    case "Academic Alert":
      return <AlertTriangle size={size} className="text-rose-450" />;
  }
}

export const NotificationCenter: React.FC = () => {
  const { accessToken } = useAuth();
  
  // Tabs: 'unread' | 'important' | 'all'
  const [activeTab, setActiveTab] = useState<"unread" | "important" | "all">("all");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination states
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Actions loading
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (activeTab === "unread") {
        queryParams.append("isRead", "false");
      }
      if (activeTab === "important") {
        queryParams.append("isImportant", "true");
      }
      if (typeFilter !== "ALL") {
        queryParams.append("type", typeFilter);
      }

      const res = await apiFetch(`/notifications?${queryParams.toString()}`, {}, accessToken);
      if (res.success && res.data) {
        setNotifications(res.data.notifications || []);
        setTotalPages(res.data.totalPages || 1);
        setTotalCount(res.data.total || 0);
      }
    } catch (err: any) {
      setError(err.message || "Failed to retrieve notifications.");
    } finally {
      setLoading(false);
    }
  }, [page, limit, activeTab, typeFilter, accessToken]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchNotifications();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchNotifications]);

  // Handle Mark Read / Unread
  const toggleReadStatus = async (id: string, currentlyRead: boolean) => {
    if (!accessToken) return;
    setActionLoadingId(id);
    try {
      const endpoint = `/notifications/${id}/${currentlyRead ? "unread" : "read"}`;
      const res = await apiFetch(endpoint, { method: "PUT" }, accessToken);
      if (res.success) {
        // Optimistically update or re-fetch
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: !currentlyRead } : n))
        );
        // Force recount update event for top header if needed
        window.dispatchEvent(new Event("notificationUpdate"));
      }
    } catch (err: any) {
      alert(err.message || "Failed to update notification status.");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Quick Action: Mark all page as read
  const markAllPageAsRead = async () => {
    if (!accessToken || notifications.length === 0) return;
    const unreadOnPage = notifications.filter((n) => !n.isRead);
    if (unreadOnPage.length === 0) return;

    setLoading(true);
    try {
      await Promise.all(
        unreadOnPage.map((n) =>
          apiFetch(`/notifications/${n.id}/read`, { method: "PUT" }, accessToken)
        )
      );
      fetchNotifications();
      window.dispatchEvent(new Event("notificationUpdate"));
    } catch (err: any) {
      alert("Failed to mark all page items as read.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Title & Top Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-2xl dark:text-white text-text-primary flex items-center gap-2">
            <Bell size={24} className="text-blue-500 animate-pulse" />
            <span>Notification Center</span>
          </h2>
          <p className="text-xs dark:text-neutral-400 text-text-secondary mt-1">
            Stay updated with real-time college notifications, exam results, assignments, and campus drives.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchNotifications}
            className="p-2 rounded-lg dark:bg-neutral-900 bg-surface border dark:border-neutral-800 border-border-subtle dark:text-neutral-400 text-text-secondary dark:hover:text-white hover:text-text-primary transition flex items-center gap-2 text-xs font-semibold cursor-pointer"
            title="Refresh List"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          
          <button
            onClick={markAllPageAsRead}
            disabled={notifications.filter(n => !n.isRead).length === 0}
            className="px-3 py-2 rounded-lg dark:bg-blue-600/10 bg-blue-50 border dark:border-blue-500/20 border-blue-200 dark:text-blue-400 text-blue-750 dark:hover:bg-blue-600 hover:bg-blue-600 dark:hover:text-white hover:text-white transition text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            Mark Page as Read
          </button>
        </div>
      </div>

      {/* Tabs & Type Filter Panel */}
      <div className="glass-card border border-border-subtle rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        
        {/* Tabs */}
        <div className="flex rounded-lg dark:bg-neutral-950 bg-neutral-100 border dark:border-neutral-855 border-border-subtle p-1 w-full md:w-auto">
          <button
            onClick={() => { setActiveTab("all"); setPage(1); }}
            className={`flex-1 md:flex-initial px-4 py-1.5 text-xs font-bold rounded cursor-pointer transition ${
              activeTab === "all"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                : "dark:text-neutral-400 text-text-secondary dark:hover:text-neutral-200 hover:text-text-primary"
            }`}
          >
            All History
          </button>
          <button
            onClick={() => { setActiveTab("unread"); setPage(1); }}
            className={`flex-1 md:flex-initial px-4 py-1.5 text-xs font-bold rounded cursor-pointer transition relative ${
              activeTab === "unread"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                : "dark:text-neutral-400 text-text-secondary dark:hover:text-neutral-200 hover:text-text-primary"
            }`}
          >
            Unread
          </button>
          <button
            onClick={() => { setActiveTab("important"); setPage(1); }}
            className={`flex-1 md:flex-initial px-4 py-1.5 text-xs font-bold rounded cursor-pointer transition ${
              activeTab === "important"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                : "dark:text-neutral-400 text-text-secondary dark:hover:text-neutral-200 hover:text-text-primary"
            }`}
          >
            Important
          </button>
        </div>

        {/* Filter Dropdown */}
        <div className="flex items-center gap-2 dark:bg-neutral-955 bg-surface border dark:border-neutral-850 border-border-subtle rounded-lg px-3 py-1.5 w-full md:w-auto relative">
          <span className="text-[10px] dark:text-neutral-500 text-text-muted font-bold uppercase shrink-0">Type Filter:</span>
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="bg-transparent dark:text-white text-text-primary cursor-pointer py-0.5 pr-6 appearance-none focus:outline-none text-xs font-bold w-full md:w-44"
          >
            <option value="ALL">All Announcement Types</option>
            {NOTIFICATION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none dark:text-neutral-500 text-text-muted">
            ▼
          </div>
        </div>

      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="glass-card border border-border-subtle rounded-xl p-16 text-center dark:text-neutral-500 text-text-muted font-mono text-xs shadow-xl">
          <div className="animate-spin inline-block w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mb-3"></div>
          <div>Syncing and loading notification matrices...</div>
        </div>
      ) : error ? (
        <div className="p-4 rounded-lg dark:bg-rose-500/10 bg-rose-50 border dark:border-rose-500/20 border-rose-205 dark:text-rose-455 text-rose-750 text-xs font-semibold font-mono flex items-center gap-2">
          <AlertCircle size={16} />
          <span>Error loading Notification Desk: {error}</span>
        </div>
      ) : notifications.length === 0 ? (
        <div className="glass-card border border-border-subtle rounded-xl p-16 text-center dark:text-neutral-500 text-text-muted font-mono text-xs flex flex-col items-center shadow-xl">
          <Bell className="mx-auto mb-4 dark:text-neutral-700 text-text-muted animate-bounce" size={32} />
          <h3 className="font-bold dark:text-white text-text-primary text-sm mb-1">Your Inbox is Clean</h3>
          <p className="max-w-xs mx-auto text-[10px] dark:text-neutral-450 text-text-secondary mt-1 leading-normal">
            No notification matches the selected filters. Any announcements sent by the Registrar or faculty will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {notifications.map((n) => {
            const badgeClass = getNotificationBadgeStyles(n.type);
            const icon = getNotificationIcon(n.type, 16);
            return (
              <div
                key={n.id}
                className={`relative group rounded-xl border p-4 transition-all shadow-sm flex gap-4 ${
                  n.isRead
                    ? "dark:bg-neutral-950/20 bg-surface/40 dark:border-neutral-900 border-border-subtle dark:hover:bg-neutral-900/10 hover:bg-surface-hover/20"
                    : "dark:bg-neutral-900/60 bg-surface dark:border-neutral-800 border-border-subtle dark:hover:bg-neutral-850/80 hover:bg-surface-hover ring-1 ring-blue-500/5"
                }`}
              >
                {/* Visual Unread dot accent */}
                {!n.isRead && (
                  <span className="absolute top-4 left-3.5 w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                )}

                {/* Left Type Icon */}
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center border shrink-0 dark:bg-neutral-950 bg-neutral-100 dark:border-neutral-850 border-border-subtle`}>
                  {icon}
                </div>

                {/* Text Content */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-[4px] text-[8px] font-extrabold uppercase border tracking-wider font-mono ${badgeClass}`}>
                      {n.type}
                    </span>
                    {n.isImportant && (
                      <span className="flex items-center gap-0.5 dark:text-amber-400 text-amber-700 dark:bg-amber-500/10 bg-amber-50 border dark:border-amber-550/20 border-amber-205 px-1.5 py-0.5 rounded text-[8px] font-bold font-mono">
                        <Star size={8} fill="currentColor" />
                        <span>IMPORTANT</span>
                      </span>
                    )}
                    <span className="text-[9px] font-mono dark:text-neutral-500 text-text-muted flex items-center gap-1">
                      <Clock size={10} />
                      {new Date(n.createdAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <h4 className={`text-xs font-bold transition-colors ${n.isRead ? "dark:text-neutral-300 text-text-secondary" : "dark:text-white text-text-primary"}`}>
                    {n.title}
                  </h4>
                  <p className="text-[10px] dark:text-neutral-450 text-text-secondary leading-relaxed max-w-3xl whitespace-pre-line">
                    {n.message}
                  </p>

                  <div className="flex items-center gap-4 text-[9px] dark:text-neutral-500 text-text-muted pt-1 font-mono">
                    <span>Sender: <strong className="dark:text-neutral-400 text-text-secondary font-semibold">{n.createdByName}</strong></span>
                    {n.departmentName && (
                      <span>Dept: <strong className="dark:text-neutral-400 text-text-secondary font-semibold">{n.departmentName}</strong></span>
                    )}
                    {n.semester && (
                      <span>Semester: <strong className="dark:text-neutral-400 text-text-secondary font-semibold">{n.semester}</strong></span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col justify-between items-end gap-2 self-stretch">
                  <button
                    onClick={() => toggleReadStatus(n.id, n.isRead)}
                    disabled={actionLoadingId === n.id}
                    className={`p-1.5 rounded border text-[10px] font-bold transition-all shrink-0 cursor-pointer flex items-center justify-center gap-1.5 ${
                      n.isRead
                        ? "dark:bg-neutral-900 bg-surface dark:border-neutral-800 border-border-subtle dark:text-neutral-450 text-text-secondary dark:hover:bg-neutral-800 hover:bg-surface-hover dark:hover:text-white hover:text-text-primary"
                        : "dark:bg-blue-600/10 bg-blue-50 dark:border-blue-500/20 border-blue-200 dark:text-blue-400 text-blue-700 dark:hover:bg-blue-600 hover:bg-blue-600 dark:hover:text-white hover:text-white shadow-sm"
                    }`}
                    title={n.isRead ? "Mark as Unread" : "Mark as Read"}
                  >
                    {actionLoadingId === n.id ? (
                      <RefreshCw size={12} className="animate-spin" />
                    ) : n.isRead ? (
                      <>
                        <EyeOff size={12} />
                        <span className="hidden sm:inline">Mark Unread</span>
                      </>
                    ) : (
                      <>
                        <Eye size={12} />
                        <span className="hidden sm:inline">Mark Read</span>
                      </>
                    )}
                  </button>
                </div>

              </div>
            );
          })}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t dark:border-neutral-900 border-border-subtle pt-4 mt-2">
              <span className="text-[10px] font-mono dark:text-neutral-500 text-text-muted">
                Showing <strong className="dark:text-neutral-400 text-text-secondary">{(page - 1) * limit + 1}</strong> - <strong className="dark:text-neutral-400 text-text-secondary">{Math.min(page * limit, totalCount)}</strong> of <strong className="dark:text-neutral-400 text-text-secondary">{totalCount}</strong> notices
              </span>

              <div className="flex items-center gap-1 dark:bg-neutral-950 bg-neutral-100 border dark:border-neutral-850 border-border-subtle p-0.5 rounded">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  className="p-1 rounded dark:text-neutral-400 text-text-secondary dark:hover:text-white hover:text-text-primary dark:hover:bg-neutral-850 hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="px-3 text-[10px] font-bold font-mono dark:text-neutral-300 text-text-secondary">
                  {page} / {totalPages}
                </span>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  className="p-1 rounded dark:text-neutral-400 text-text-secondary dark:hover:text-white hover:text-text-primary dark:hover:bg-neutral-850 hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
