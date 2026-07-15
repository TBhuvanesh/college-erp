"use client";

import { LucideIcon, ArrowUpRight, TrendingUp, AlertCircle } from "lucide-react";
import Link from "next/link";

interface SmartProgressCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  details?: {
    label: string;
    value: string | number;
    color?: string;
  }[];
  progress?: number; // 0 to 100
  actionText?: string;
  actionRoute?: string;
}

export function SmartProgressCard({
  title,
  value,
  icon: Icon,
  trend,
  details,
  progress,
  actionText,
  actionRoute
}: SmartProgressCardProps) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm space-y-3.5 flex flex-col justify-between h-full group hover:border-border-hover transition-colors">
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-text-muted truncate">
              {title}
            </h4>
            <div className="flex items-baseline gap-2">
              <span className="font-display font-black text-xl text-text-primary leading-none">
                {value}
              </span>
              {trend && (
                <span className={`inline-flex items-center gap-0.5 text-[9px] font-extrabold px-1.5 py-0.5 rounded border leading-none ${
                  trend.isPositive
                    ? "text-emerald-700 bg-emerald-500/10 border-emerald-500/20 dark:text-emerald-400"
                    : "text-red-650 bg-red-500/10 border-red-500/20 dark:text-red-400"
                }`}>
                  <TrendingUp size={10} />
                  <span>{trend.value}</span>
                </span>
              )}
            </div>
          </div>

          {Icon && (
            <div className="w-9 h-9 rounded-xl bg-surface-elevated border border-border-subtle flex items-center justify-center shrink-0 text-text-secondary group-hover:text-accent-blue transition-colors">
              <Icon size={16} />
            </div>
          )}
        </div>

        {progress !== undefined && (
          <div className="space-y-1.5 pt-1">
            <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-1.5 rounded-full overflow-hidden">
              <div 
                className="h-full bg-accent-blue rounded-full transition-all duration-500" 
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-text-muted font-bold uppercase tracking-wider">
              <span>Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
          </div>
        )}

        {details && details.length > 0 && (
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border-subtle">
            {details.map((detail, idx) => (
              <div key={idx} className="min-w-0">
                <span className="text-[8px] font-bold uppercase tracking-widest text-text-muted truncate block">
                  {detail.label}
                </span>
                <span className={`text-[10px] font-bold block truncate ${detail.color || "text-text-secondary"}`}>
                  {detail.value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {actionText && actionRoute && (
        <div className="pt-2 border-t border-border-subtle">
          <Link
            href={actionRoute}
            className="inline-flex items-center gap-1 text-[10px] font-bold text-accent-blue hover:underline cursor-pointer"
          >
            <span>{actionText}</span>
            <ArrowUpRight size={12} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </Link>
        </div>
      )}
    </div>
  );
}
