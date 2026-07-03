"use client";

import React from "react";
import {
  UserPlus,
  BookOpen,
  Briefcase,
  Calendar,
  FileCheck,
  CheckCircle,
  Clock
} from "lucide-react";

export interface ActivityItem {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  type: "registration" | "faculty" | "workload" | "opportunity" | "assignment" | "event" | "lms" | "submission";
  meta?: string;
}

interface ActivityFeedProps {
  activities: ActivityItem[];
  loading?: boolean;
  maxItems?: number;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  activities,
  loading = false,
  maxItems = 5
}) => {
  const getIcon = (type: string) => {
    switch (type) {
      case "registration":
        return <UserPlus size={14} className="text-blue-400" />;
      case "faculty":
        return <UserPlus size={14} className="text-emerald-400" />;
      case "assignment":
      case "lms":
        return <BookOpen size={14} className="text-indigo-400" />;
      case "opportunity":
        return <Briefcase size={14} className="text-cyan-500" />;
      case "event":
        return <Calendar size={14} className="text-amber-400" />;
      case "submission":
        return <FileCheck size={14} className="text-purple-400" />;
      default:
        return <CheckCircle size={14} className="text-text-muted" />;
    }
  };

  const displayedActivities = activities.slice(0, maxItems);

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface p-5 flex flex-col h-full text-left">
      <div className="flex items-center gap-2 border-b border-border-subtle/60 pb-3 mb-4 shrink-0">
        <Clock size={16} className="text-accent-blue" />
        <h3 className="font-display font-bold text-text-primary text-base">Roster Activity Feed</h3>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
        {loading ? (
          <div className="py-12 text-center text-xs text-text-muted font-mono">
            <div className="animate-spin inline-block w-5 h-5 border-2 border-accent-blue border-t-transparent rounded-full mb-2" />
            <div>Syncing database logs...</div>
          </div>
        ) : displayedActivities.length === 0 ? (
          <div className="py-12 text-center text-xs text-text-muted font-mono italic">
            No recent activity recorded.
          </div>
        ) : (
          <div className="relative border-l border-border-subtle ml-3.5 pl-5 space-y-5 py-1">
            {displayedActivities.map((act) => (
              <div key={act.id} className="relative group text-left">
                {/* Timeline icon */}
                <div className="absolute -left-[32px] top-0.5 w-6 h-6 rounded-lg bg-surface border border-border-subtle flex items-center justify-center transition-all group-hover:border-border-strong">
                  {getIcon(act.type)}
                </div>

                <div className="space-y-0.5">
                  <span className="text-[8px] font-mono text-text-muted block">
                    {new Date(act.timestamp).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit"
                    }) + " — " + new Date(act.timestamp).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short"
                    })}
                  </span>
                  <h4 className="text-xs font-bold text-text-primary group-hover:text-accent-blue transition-colors leading-tight">
                    {act.title}
                  </h4>
                  <p className="text-[10px] text-text-secondary leading-relaxed max-w-xl">
                    {act.description}
                  </p>
                  {act.meta && (
                    <span className="text-[8px] font-mono font-bold bg-surface-elevated border border-border-subtle px-1.5 py-0.5 rounded text-text-muted uppercase tracking-wide inline-block mt-1">
                      {act.meta}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
