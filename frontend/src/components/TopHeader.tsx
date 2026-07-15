"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useSimulation } from "@/context/SimulationContext";
import { apiFetch } from "@/lib/api";
import { Notification, NotificationType } from "./NotificationCenter";
import { GlobalSearch } from "./Search/GlobalSearch";
import { usePermission } from "@/context/PermissionContext";

import { 
  Bell, 
  User, 
  Menu, 
  Sun, 
  Moon, 
  LogOut, 
  Award,
  BookOpen,
  Calendar,
  Briefcase,
  Clock,
  AlertTriangle,
  Star
} from "lucide-react";

export const TopHeader: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { currentRole, students, faculty, currentStudentId, currentFacultyId, theme, toggleTheme } = useSimulation();
  const { rbacRole } = usePermission();

  const { accessToken, logout } = useAuth();
  
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Simplified title logic
  const getPageTitle = () => {
    if (!pathname) return "Dashboard";
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length < 2) return "Academic Dashboard";
    
    const view = parts[1];
    return view.charAt(0).toUpperCase() + view.slice(1).replace("-", " ");
  };

  const fetchHeaderNotifications = async () => {
    try {
      const res = await apiFetch("/notifications?limit=25", {}, accessToken);
      if (res.success && res.data?.notifications) {
        const notifs = res.data.notifications;
        const filtered = notifs.filter((n: Notification) => {
          const typeLower = (n.type || "").toLowerCase();
          
          if (rbacRole === "Student") {
            return typeLower.includes("assignment") || 
                   typeLower.includes("homework") || 
                   typeLower.includes("grade") || 
                   typeLower.includes("result") ||
                   typeLower.includes("calendar") || 
                   typeLower.includes("event") ||
                   typeLower.includes("opportunity") ||
                   typeLower.includes("placement");
          }
          
          if (rbacRole === "Faculty") {
            return typeLower.includes("submission") || 
                   typeLower.includes("lesson") || 
                   typeLower.includes("workload") ||
                   typeLower.includes("mentor") ||
                   typeLower.includes("alert");
          }
          
          if (rbacRole === "Placement Officer") {
            return typeLower.includes("opportunity") || 
                   typeLower.includes("placement") || 
                   typeLower.includes("internship") || 
                   typeLower.includes("company");
          }
          
          if (rbacRole === "Mentoring Head") {
            return typeLower.includes("mentor") || 
                   typeLower.includes("alert") ||
                   typeLower.includes("system");
          }

          if (rbacRole === "Academic Coordinator") {
            return typeLower.includes("calendar") || 
                   typeLower.includes("exam") ||
                   typeLower.includes("academic") ||
                   typeLower.includes("system");
          }

          if (rbacRole === "Super Admin") {
            if (typeLower.includes("assignment") || typeLower.includes("homework") || typeLower.includes("grade") || typeLower.includes("lesson") || typeLower.includes("attendance")) {
              return false;
            }
            return typeLower.includes("system") || 
                   typeLower.includes("alert") || 
                   typeLower.includes("user") || 
                   typeLower.includes("config");
          }

          if (rbacRole === "College Admin") {
            if (typeLower.includes("submission") || typeLower.includes("lesson") || typeLower.includes("teaching")) {
              return false;
            }
            return true;
          }
          
          return true;
        });

        setNotifications(filtered.slice(0, 5));
        setUnreadCount(filtered.filter((n: Notification) => !n.isRead).length);
      }
    } catch (err) {
      console.error("Failed to fetch recent notifications", err);
    }
  };


  useEffect(() => {
    const load = async () => {
      if (accessToken) {
        await fetchHeaderNotifications();
      }
    };
    
    const timer = setTimeout(load, 0);

    // Listen for events from NotificationCenter component to sync read states
    const handleSync = () => {
      fetchHeaderNotifications();
    };
    window.addEventListener("notificationUpdate", handleSync);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("notificationUpdate", handleSync);
    };
  }, [accessToken]);

  const markQuickRead = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (!accessToken) return;
    try {
      const res = await apiFetch(`/notifications/${id}/read`, { method: "PUT" }, accessToken);
      if (res.success) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
        window.dispatchEvent(new Event("notificationUpdate"));
      }
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  };

  // Get matching category styles for dropdown
  const getDropdownIcon = (type: NotificationType) => {
    switch (type) {
      case "Announcement":
        return <Bell size={14} className="text-accent-purple mt-0.5" />;
      case "Assignment":
        return <BookOpen size={14} className="text-accent-blue mt-0.5" />;
      case "Grade Released":
        return <Award size={14} className="text-success mt-0.5" />;
      case "Event":
        return <Calendar size={14} className="text-warning mt-0.5" />;
      case "Internship":
      case "Job Opportunity":
      case "Placement Drive":
        return <Briefcase size={14} className="text-cyan-500 mt-0.5" />; // Keep cyan as is, or use accent-blue
      case "Reminder":
        return <Clock size={14} className="text-orange-500 mt-0.5" />;
      case "Academic Alert":
        return <AlertTriangle size={14} className="text-danger mt-0.5" />;
      default:
        return <Bell size={14} className="text-text-muted mt-0.5" />;
    }
  };

  return (
    <header className="h-16 border-b border-border-subtle bg-surface/80 backdrop-blur-md sticky top-0 flex items-center justify-between px-4 lg:px-6 z-20 transition-colors">
      {/* Title / Breadcrumb */}
      <div className="hidden sm:flex items-center gap-3 shrink-0">
        <h1 className="font-display font-semibold text-lg text-text-primary tracking-tight">
          {getPageTitle()}
        </h1>
      </div>

      {/* Global Search Bar */}
      <div className="flex-1 max-w-xs md:max-w-md mx-2 sm:mx-4">
        <GlobalSearch />
      </div>

      {/* Global Controls & Dropdowns */}
      <div className="flex items-center gap-3">
        
        {/* Profile Link */}
        <Link
          href={`/${currentRole.toLowerCase()}/profile`}
          className="p-2 rounded-lg bg-surface border border-border-subtle text-text-muted hover:text-text-primary hover:bg-surface-hover cursor-pointer relative flex items-center justify-center transition-all shadow-sm"
          title="View Profile Settings"
        >
          <User size={16} />
        </Link>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg bg-surface border border-border-subtle text-text-muted hover:text-text-primary hover:bg-surface-hover cursor-pointer relative flex items-center justify-center transition-all shadow-sm"
          title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
        >
          {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
        </button>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="p-2 rounded-lg bg-surface border border-border-subtle text-text-muted hover:text-text-primary hover:bg-surface-hover cursor-pointer relative shadow-sm transition-all"
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[9px] font-bold text-white ring-2 ring-surface px-0.5">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown Panel */}
          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl bg-surface-elevated border border-border-strong shadow-2xl p-2.5 z-40">
              <div className="flex items-center justify-between px-2 py-1.5 border-b border-border-subtle mb-1.5">
                <span className="text-[10px] font-bold text-text-primary uppercase tracking-wider font-mono">University Notices</span>
                {unreadCount > 0 && (
                  <span className="text-[8px] dark:bg-accent-blue-soft bg-blue-50 dark:text-accent-blue text-blue-700 border border-accent-blue/20 px-1.5 py-0.5 rounded font-bold">
                    {unreadCount} Unread
                  </span>
                )}
              </div>
              
              <div className="space-y-1 max-h-64 overflow-y-auto pr-0.5 custom-scrollbar">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-[10px] text-text-muted font-mono">
                    No active notifications
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`p-2 rounded-lg flex items-start gap-2.5 transition relative border ${
                        notif.isRead
                          ? "hover:bg-surface-hover text-text-secondary border-transparent"
                          : "bg-surface-hover border-border-subtle hover:bg-border-subtle/30 text-text-primary shadow-sm"
                      }`}
                    >
                      {getDropdownIcon(notif.type)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1">
                          <h4 className="text-[11px] font-bold text-text-primary truncate leading-snug">
                            {notif.title}
                          </h4>
                          {notif.isImportant && (
                            <Star size={9} className="text-warning shrink-0 fill-currentColor mt-0.5" />
                          )}
                        </div>
                        <p className="text-[9px] text-text-secondary mt-0.5 leading-relaxed line-clamp-2">
                          {notif.message}
                        </p>
                        
                        <div className="flex items-center justify-between mt-1 text-[8px] font-mono text-text-muted">
                          <span>
                            {new Date(notif.createdAt).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                            })}
                          </span>
                          
                          {!notif.isRead && (
                            <button
                              onClick={(e) => markQuickRead(e, notif.id)}
                              className="text-accent-blue hover:text-accent-blue-dark font-bold transition hover:underline cursor-pointer"
                            >
                              Mark Read
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="border-t border-border-subtle mt-2 pt-2">
                <Link
                  href={`/${currentRole.toLowerCase()}/notifications`}
                  onClick={() => setNotifOpen(false)}
                  className="block text-center text-[10px] font-bold text-accent-blue hover:text-accent-blue-dark py-1 transition"
                >
                  View All Notifications
                </Link>
              </div>
            </div>
          )}
        </div>

      </div>
    </header>
  );
};
