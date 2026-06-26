"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Bell, ArrowRight, Check, CheckCheck, Info, AlertTriangle, MessageSquare, Star } from "lucide-react";
import { Notification, getNotificationBadgeStyles } from "../NotificationCenter";

interface NotificationWidgetProps {
  notifications: Notification[];
  loading?: boolean;
  onMarkRead?: (id: string) => Promise<void>;
  role: "admin" | "faculty" | "student";
}

export const NotificationWidget: React.FC<NotificationWidgetProps> = ({
  notifications,
  loading = false,
  onMarkRead,
  role
}) => {
  const [processingId, setProcessingId] = useState<string | null>(null);

  const unreadNotifs = notifications.filter((n) => !n.isRead).slice(0, 4);

  const handleMarkRead = async (id: string) => {
    if (!onMarkRead) return;
    setProcessingId(id);
    try {
      await onMarkRead(id);
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingId(null);
    }
  };

  const getIconForType = (type: string) => {
    if (type.includes("Alert") || type.includes("Urgent")) return <AlertTriangle size={14} className="text-danger" />;
    if (type.includes("Event")) return <Star size={14} className="text-warning" />;
    if (type.includes("System")) return <Info size={14} className="text-accent-blue" />;
    return <MessageSquare size={14} className="text-text-muted" />;
  };

  return (
    <div className="bg-surface/95 border border-border-subtle rounded-[16px] p-5 shadow-sm backdrop-blur-xl flex flex-col h-full relative overflow-hidden">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-5 relative z-10">
        <div className="flex items-center gap-2">
          <div className="bg-accent-blue-soft p-1.5 rounded-lg text-accent-blue border border-accent-blue/20 relative">
            <Bell size={16} strokeWidth={2.5} />
            {unreadNotifs.length > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-danger border-2 border-surface rounded-full animate-pulse" />
            )}
          </div>
          <h3 className="font-display font-bold text-text-primary tracking-wide">Notifications</h3>
        </div>
        <span className="text-[10px] uppercase font-bold tracking-widest text-text-muted bg-surface-elevated px-2 py-0.5 rounded-full border border-border-subtle shadow-sm">
          {notifications.filter((n) => !n.isRead).length} New
        </span>
      </div>

      {/* Timeline Feed */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10 pl-2">
        <div className="absolute left-4 top-2 bottom-2 w-px bg-border-subtle" /> {/* Timeline line */}

        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted gap-2 py-8">
            <div className="w-5 h-5 border-2 border-accent-blue-soft border-t-accent-blue rounded-full animate-spin" />
            <span className="text-xs font-medium">Fetching updates...</span>
          </div>
        ) : unreadNotifs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted gap-2 py-8">
            <CheckCheck size={24} className="text-text-muted/50" />
            <span className="text-xs font-medium">You're all caught up!</span>
          </div>
        ) : (
          <div className="space-y-4">
            {unreadNotifs.map((n) => (
              <div key={n.id} className="relative pl-7 group">
                {/* Timeline Dot/Icon */}
                <div className="absolute -left-2.5 top-0.5 w-6 h-6 rounded-full bg-surface-elevated border border-border-strong flex items-center justify-center z-10 shadow-sm">
                  {getIconForType(n.type)}
                </div>

                <div className="bg-surface-hover border border-border-subtle rounded-xl p-3 hover:bg-surface hover:shadow-sm hover:border-border-strong transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-semibold text-text-primary leading-tight">
                        {n.title}
                      </h4>
                      <p className="text-[11px] text-text-secondary mt-1 line-clamp-2 leading-relaxed">
                        {n.message}
                      </p>
                    </div>
                    {onMarkRead && (
                      <button
                        onClick={() => handleMarkRead(n.id)}
                        disabled={processingId === n.id}
                        className="w-6 h-6 rounded-full bg-surface border border-border-strong hover:bg-accent-blue-soft text-text-muted hover:text-accent-blue hover:border-accent-blue/30 flex items-center justify-center shrink-0 transition-colors shadow-sm"
                        title="Mark as read"
                      >
                        {processingId === n.id ? (
                          <div className="w-3 h-3 border-2 border-accent-blue-soft border-t-accent-blue rounded-full animate-spin" />
                        ) : (
                          <Check size={12} strokeWidth={3} />
                        )}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-border-subtle font-medium">
                    <span className="text-[9px] font-semibold text-text-muted uppercase tracking-wider">
                      {n.createdByName}
                    </span>
                    <span className="text-[10px] text-text-muted">
                      {new Date(n.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Link
        href={`/${role.toLowerCase()}/notifications`}
        className="mt-4 pt-3 border-t border-border-subtle/50 flex items-center justify-center gap-1.5 text-xs font-semibold text-accent-blue hover:text-accent-blue-dark transition-colors w-full group relative z-10"
      >
        <span>View Notification Inbox</span>
        <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
      </Link>

      {/* Subtle Background Accent Gradient - Visible slightly in light mode too but very soft */}
      <div className="absolute -top-16 -right-16 w-48 h-48 blur-3xl opacity-[0.05] rounded-full z-0 pointer-events-none bg-accent-blue" />
    </div>
  );
};
