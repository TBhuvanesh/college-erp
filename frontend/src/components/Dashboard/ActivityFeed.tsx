"use client";

import React from "react";
import { 
  UserPlus, 
  BookOpen, 
  Briefcase, 
  Calendar, 
  Award, 
  FileCheck,
  CheckCircle,
  HelpCircle,
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
        return <Briefcase size={14} className="text-cyan-400" />;
      case "event":
        return <Calendar size={14} className="text-amber-400" />;
      case "submission":
        return <FileCheck size={14} className="text-purple-400" />;
      default:
        return <CheckCircle size={14} className="text-neutral-400" />;
    }
  };

  const displayedActivities = activities.slice(0, maxItems);

  return (
    <div className="glass-card border border-neutral-800 rounded-xl p-5 flex flex-col h-full text-left">
      <div className="flex items-center gap-2 border-b border-neutral-850 pb-3 mb-4 shrink-0">
        <Clock size={16} className="text-blue-500" />
        <h3 className="font-display font-bold text-white text-base">Roster Activity Feed</h3>
      </div>

      <div className="flex-1 overflow-y-auto pr-1">
        {loading ? (
          <div className="py-12 text-center text-xs text-neutral-500 font-mono">
            <div className="animate-spin inline-block w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full mb-2"></div>
            <div>Syncing database logs...</div>
          </div>
        ) : displayedActivities.length === 0 ? (
          <div className="py-12 text-center text-xs text-neutral-600 font-mono italic">
            No recent activity recorded.
          </div>
        ) : (
          <div className="relative border-l border-neutral-850 ml-3.5 pl-5 space-y-5 py-1">
            {displayedActivities.map((act) => (
              <div key={act.id} className="relative group text-left">
                {/* Timeline icon indicator */}
                <div className="absolute -left-[32px] top-0.5 w-6 h-6 rounded-lg bg-neutral-950 border border-neutral-850 flex items-center justify-center transition-all group-hover:border-neutral-700">
                  {getIcon(act.type)}
                </div>

                <div className="space-y-0.5">
                  <span className="text-[8px] font-mono text-neutral-600 block">
                    {new Date(act.timestamp).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit"
                    }) + " — " + new Date(act.timestamp).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short"
                    })}
                  </span>
                  <h4 className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors leading-tight">
                    {act.title}
                  </h4>
                  <p className="text-[10px] text-neutral-450 leading-relaxed max-w-xl">
                    {act.description}
                  </p>
                  {act.meta && (
                    <span className="text-[8px] font-mono font-bold bg-neutral-900 border border-neutral-850 px-1.5 py-0.5 rounded text-neutral-500 uppercase tracking-wide inline-block mt-1">
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
