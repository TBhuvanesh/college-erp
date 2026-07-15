"use client";

import { AlertCircle, AlertTriangle, Info, BellRing, ArrowRight } from "lucide-react";

export interface ActionItem {
  id: string;
  title: string;
  dueDate: string;
  priority: "high" | "medium" | "low";
  actionRoute?: string;
  actionText?: string;
}

interface ActionCenterProps {
  items: ActionItem[];
  onActionClick?: (item: ActionItem) => void;
}

export function ActionCenter({ items, onActionClick }: ActionCenterProps) {
  const sortedItems = [...items].sort((a, b) => {
    const priorityWeight = { high: 3, medium: 2, low: 1 };
    return priorityWeight[b.priority] - priorityWeight[a.priority];
  });

  const getPriorityStyle = (priority: ActionItem["priority"]) => {
    switch (priority) {
      case "high":
        return {
          icon: AlertCircle,
          color: "text-red-500 bg-red-500/10 border-red-500/20 dark:text-red-400",
          indicator: "🔴"
        };
      case "medium":
        return {
          icon: AlertTriangle,
          color: "text-amber-600 bg-amber-500/10 border-amber-500/20 dark:text-amber-400",
          indicator: "🟠"
        };
      default:
        return {
          icon: Info,
          color: "text-blue-500 bg-blue-500/10 border-blue-500/20 dark:text-blue-400",
          indicator: "🟢"
        };
    }
  };

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <BellRing className="text-red-500 animate-pulse h-4 w-4" />
          <h3 className="font-display font-bold text-sm text-text-primary uppercase tracking-wider">
            Action Center
          </h3>
        </div>
        <span className="text-[10px] font-extrabold uppercase bg-neutral-100 dark:bg-neutral-800 text-text-muted px-2 py-0.5 rounded">
          {items.length} Alerts
        </span>
      </div>

      <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
        {sortedItems.length === 0 ? (
          <div className="text-center py-6 text-text-muted text-xs">
            🎉 All set! No critical pending actions.
          </div>
        ) : (
          sortedItems.map((item) => {
            const style = getPriorityStyle(item.priority);
            const Icon = style.icon;

            return (
              <div 
                key={item.id}
                className="flex items-start justify-between gap-3 p-3 rounded-xl border border-border-subtle bg-background hover:border-border-hover hover:shadow-sm transition-all group"
              >
                <div className="flex gap-2.5 min-w-0">
                  <div className={`mt-0.5 w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 ${style.color}`}>
                    <Icon size={12} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-text-primary leading-tight group-hover:text-accent-blue transition-colors">
                      {item.title}
                    </p>
                    <p className="text-[10px] text-text-muted mt-1 font-medium">{item.dueDate}</p>
                  </div>
                </div>

                {item.actionText && (
                  <button
                    onClick={() => onActionClick?.(item)}
                    className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-accent-blue bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/10 hover:border-blue-500/20 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    <span>{item.actionText}</span>
                    <ArrowRight size={10} className="group-hover:translate-x-0.5 transition-transform" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
