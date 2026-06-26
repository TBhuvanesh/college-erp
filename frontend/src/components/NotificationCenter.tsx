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
      return "bg-purple-500/10 border-purple-500/20 text-purple-400";
    case "Assignment":
      return "bg-blue-500/10 border-blue-500/20 text-blue-400";
    case "Grade Released":
      return "bg-emerald-500/10 border-emerald-500/20 text-emerald-400";
    case "Event":
      return "bg-amber-500/10 border-amber-500/20 text-amber-400";
    case "Internship":
      return "bg-cyan-500/10 border-cyan-500/20 text-cyan-400";
    case "Job Opportunity":
      return "bg-indigo-500/10 border-indigo-500/20 text-indigo-400";
    case "Placement Drive":
      return "bg-pink-500/10 border-pink-500/20 text-pink-400";
    case "Reminder":
      return "bg-orange-500/10 border-orange-500/20 text-orange-400";
    case "Academic Alert":
      return "bg-rose-500/10 border-rose-500/20 text-rose-450 font-bold";
    default:
      return "bg-neutral-500/10 border-neutral-500/20 text-neutral-400";
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
          <h2 className="font-display font-bold text-2xl text-white flex items-center gap-2">
            <Bell size={24} className="text-blue-500 animate-pulse" />
            <span>Notification Center</span>
          </h2>
          <p className="text-xs text-neutral-455 mt-1">
            Stay updated with real-time college notifications, exam results, assignments, and campus drives.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchNotifications}
            className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-405 hover:text-white transition flex items-center gap-2 text-xs font-semibold cursor-pointer"
            title="Refresh List"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          
          <button
            onClick={markAllPageAsRead}
            disabled={notifications.filter(n => !n.isRead).length === 0}
            className="px-3 py-2 rounded-lg bg-blue-600/10 border border-blue-500/20 text-blue-400 hover:bg-blue-600 hover:text-white transition text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            Mark Page as Read
          </button>
        </div>
      </div>

      {/* Tabs & Type Filter Panel */}
      <div className="glass-card border border-neutral-800 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        
        {/* Tabs */}
        <div className="flex rounded-lg bg-neutral-950 border border-neutral-850 p-1 w-full md:w-auto">
          <button
            onClick={() => { setActiveTab("all"); setPage(1); }}
            className={`flex-1 md:flex-initial px-4 py-1.5 text-xs font-bold rounded cursor-pointer transition ${
              activeTab === "all"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            All History
          </button>
          <button
            onClick={() => { setActiveTab("unread"); setPage(1); }}
            className={`flex-1 md:flex-initial px-4 py-1.5 text-xs font-bold rounded cursor-pointer transition relative ${
              activeTab === "unread"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Unread
          </button>
          <button
            onClick={() => { setActiveTab("important"); setPage(1); }}
            className={`flex-1 md:flex-initial px-4 py-1.5 text-xs font-bold rounded cursor-pointer transition ${
              activeTab === "important"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Important
          </button>
        </div>

        {/* Filter Dropdown */}
        <div className="flex items-center gap-2 bg-neutral-950 border border-neutral-850 rounded-lg px-3 py-1.5 w-full md:w-auto relative">
          <span className="text-[10px] text-neutral-500 font-bold uppercase shrink-0">Type Filter:</span>
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="bg-transparent text-white cursor-pointer py-0.5 pr-6 appearance-none focus:outline-none text-xs font-bold w-full md:w-44"
          >
            <option value="ALL">All Announcement Types</option>
            {NOTIFICATION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500">
            ▼
          </div>
        </div>

      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="glass-card border border-neutral-800 rounded-xl p-16 text-center text-neutral-500 font-mono text-xs shadow-xl">
          <div className="animate-spin inline-block w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mb-3"></div>
          <div>Syncing and loading notification matrices...</div>
        </div>
      ) : error ? (
        <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-455 text-xs font-semibold font-mono flex items-center gap-2">
          <AlertCircle size={16} />
          <span>Error loading Notification Desk: {error}</span>
        </div>
      ) : notifications.length === 0 ? (
        <div className="glass-card border border-neutral-800 rounded-xl p-16 text-center text-neutral-500 font-mono text-xs flex flex-col items-center shadow-xl">
          <Bell className="mx-auto mb-4 text-neutral-700 animate-bounce" size={32} />
          <h3 className="font-bold text-white text-sm mb-1">Your Inbox is Clean</h3>
          <p className="max-w-xs mx-auto text-[10px] text-neutral-450 mt-1 leading-normal">
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
                    ? "bg-neutral-950/20 border-neutral-900 hover:bg-neutral-900/10"
                    : "bg-neutral-900/60 border-neutral-800 hover:bg-neutral-850/80 ring-1 ring-blue-500/5"
                }`}
              >
                {/* Visual Unread dot accent */}
                {!n.isRead && (
                  <span className="absolute top-4 left-3.5 w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                )}

                {/* Left Type Icon */}
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center border shrink-0 bg-neutral-950 border-neutral-850`}>
                  {icon}
                </div>

                {/* Text Content */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-[4px] text-[8px] font-extrabold uppercase border tracking-wider font-mono ${badgeClass}`}>
                      {n.type}
                    </span>
                    {n.isImportant && (
                      <span className="flex items-center gap-0.5 text-amber-400 bg-amber-500/10 border border-amber-550/20 px-1.5 py-0.5 rounded text-[8px] font-bold font-mono">
                        <Star size={8} fill="currentColor" />
                        <span>IMPORTANT</span>
                      </span>
                    )}
                    <span className="text-[9px] font-mono text-neutral-500 flex items-center gap-1">
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

                  <h4 className={`text-xs font-bold transition-colors ${n.isRead ? "text-neutral-300" : "text-white"}`}>
                    {n.title}
                  </h4>
                  <p className="text-[10px] text-neutral-450 leading-relaxed max-w-3xl whitespace-pre-line">
                    {n.message}
                  </p>

                  <div className="flex items-center gap-4 text-[9px] text-neutral-500 pt-1 font-mono">
                    <span>Sender: <strong className="text-neutral-400 font-semibold">{n.createdByName}</strong></span>
                    {n.departmentName && (
                      <span>Dept: <strong className="text-neutral-400 font-semibold">{n.departmentName}</strong></span>
                    )}
                    {n.semester && (
                      <span>Semester: <strong className="text-neutral-400 font-semibold">{n.semester}</strong></span>
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
                        ? "bg-neutral-900 border-neutral-800 text-neutral-450 hover:bg-neutral-800 hover:text-white"
                        : "bg-blue-600/10 border-blue-500/20 text-blue-400 hover:bg-blue-600 hover:text-white shadow-sm"
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
            <div className="flex items-center justify-between border-t border-neutral-900 pt-4 mt-2">
              <span className="text-[10px] font-mono text-neutral-500">
                Showing <strong className="text-neutral-400">{(page - 1) * limit + 1}</strong> - <strong className="text-neutral-400">{Math.min(page * limit, totalCount)}</strong> of <strong className="text-neutral-400">{totalCount}</strong> notices
              </span>

              <div className="flex items-center gap-1 bg-neutral-950 border border-neutral-850 p-0.5 rounded">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-850 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="px-3 text-[10px] font-bold font-mono text-neutral-300">
                  {page} / {totalPages}
                </span>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-850 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition"
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
