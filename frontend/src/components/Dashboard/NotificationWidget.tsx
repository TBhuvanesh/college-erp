"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Bell, ArrowRight, Check, CheckCheck, Info, AlertTriangle, MessageSquare, Star } from "lucide-react";
import { Notification } from "../NotificationCenter";

interface NotificationWidgetProps {
  notifications: Notification[];
  loading?: boolean;
  onMarkRead?: (id: string) => Promise<void>;
  role: "admin" | "faculty" | "student";
}

const getIconForType = (type: string) => {
  if (type.includes("Alert") || type.includes("Urgent"))
    return { icon: <AlertTriangle size={12} />, cls: "dark:text-red-400 text-red-700 dark:bg-red-500/10 bg-red-50 border dark:border-red-500/20 border-red-200" };
  if (type.includes("Event"))
    return { icon: <Star size={12} />, cls: "dark:text-amber-400 text-amber-700 dark:bg-amber-500/10 bg-amber-50 border dark:border-amber-500/20 border-amber-200" };
  if (type.includes("System"))
    return { icon: <Info size={12} />, cls: "dark:text-blue-400 text-blue-700 dark:bg-blue-500/10 bg-blue-50 border dark:border-blue-500/20 border-blue-200" };
  return { icon: <MessageSquare size={12} />, cls: "text-text-muted bg-surface-elevated border border-border-subtle" };
};

const relativeTime = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export const NotificationWidget: React.FC<NotificationWidgetProps> = ({
  notifications,
  loading = false,
  onMarkRead,
  role
}) => {
  const [processingId, setProcessingId] = useState<string | null>(null);

  const unreadNotifs = notifications.filter((n) => !n.isRead).slice(0, 6);
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkRead = async (id: string) => {
    if (!onMarkRead) return;
    setProcessingId(id);
    try { await onMarkRead(id); }
    catch (err) { console.error(err); }
    finally { setProcessingId(null); }
  };

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle/60">
        <div className="flex items-center gap-2.5">
          <div className="relative w-7 h-7 rounded-lg bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center text-accent-blue">
            <Bell size={14} strokeWidth={2.5} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 border-2 border-surface rounded-full" />
            )}
          </div>
          <h3 className="font-display font-bold text-sm text-text-primary">Notifications</h3>
          {unreadCount > 0 && (
            <span className="text-[10px] font-bold dark:bg-red-500/10 bg-red-50 dark:text-red-400 text-red-700 border dark:border-red-500/20 border-red-200 px-2 py-0.5 rounded-full">
              {unreadCount} new
            </span>
          )}
        </div>
        <Link
          href={`/${role}/notifications`}
          className="flex items-center gap-1 text-[11px] font-semibold text-accent-blue hover:underline"
        >
          All notifications <ArrowRight size={11} />
        </Link>
      </div>

      {/* Timeline feed */}
      <div className="px-5 py-4">
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="w-6 h-6 rounded-full bg-surface-hover shrink-0" />
                <div className="flex-1 space-y-1.5 pt-1">
                  <div className="h-3 bg-surface-hover rounded w-2/3" />
                  <div className="h-2.5 bg-surface-hover rounded w-full" />
                  <div className="h-2.5 bg-surface-hover rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : unreadNotifs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-7 gap-2 text-text-muted">
            <CheckCheck size={22} className="opacity-40" />
            <p className="text-xs font-medium">You&apos;re all caught up</p>
          </div>
        ) : (
          <div className="relative pl-8">
            {/* Timeline line */}
            <div className="absolute left-3 top-1 bottom-1 w-px bg-border-subtle" />

            <div className="space-y-4">
              {unreadNotifs.map((n) => {
                const { icon, cls } = getIconForType(n.type);
                return (
                  <div key={n.id} className="relative group">
                    {/* Icon dot */}
                    <div className={`absolute -left-8 top-0.5 w-6 h-6 rounded-full border flex items-center justify-center z-10 shadow-sm ${cls}`}>
                      {icon}
                    </div>

                    {/* Card */}
                    <div className="bg-surface-hover border border-border-subtle rounded-xl p-3 hover:border-border-strong hover:bg-surface transition-all">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-[13px] font-semibold text-text-primary leading-snug">
                            {n.title}
                          </h4>
                          <p className="text-[11px] text-text-secondary mt-0.5 line-clamp-2 leading-relaxed">
                            {n.message}
                          </p>
                        </div>
                        {onMarkRead && (
                          <button
                            onClick={() => handleMarkRead(n.id)}
                            disabled={processingId === n.id}
                            title="Mark as read"
                            className="w-6 h-6 rounded-full bg-surface border border-border-strong hover:bg-accent-blue/10 text-text-muted hover:text-accent-blue hover:border-accent-blue/30 flex items-center justify-center shrink-0 transition-colors"
                          >
                            {processingId === n.id ? (
                              <div className="w-3 h-3 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
                            ) : (
                              <Check size={11} strokeWidth={3} />
                            )}
                          </button>
                        )}
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border-subtle/60">
                        <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider">
                          {n.createdByName}
                        </span>
                        <span className="text-[10px] text-text-muted">
                          {relativeTime(n.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
