"use client";

import { Sparkles, ArrowUpRight } from "lucide-react";

export interface FocusMetric {
  label: string;
  value: string | number;
  subtext?: string;
  colorClass?: string;
}

interface TodayFocusProps {
  userName: string;
  role: string;
  topicText?: string;
  metrics: FocusMetric[];
  subtitleText?: string;
}

export function TodayFocus({ userName, role, topicText, metrics, subtitleText }: TodayFocusProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border-subtle bg-surface p-5 lg:p-6 shadow-sm">
      {/* Accent strip */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-500" />
      
      <div className="absolute right-4 top-4 text-neutral-200/20 dark:text-neutral-700/10 pointer-events-none">
        <Sparkles size={100} />
      </div>

      <div className="space-y-5 relative">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] tracking-wider uppercase font-bold text-accent-blue bg-blue-500/5 px-2 py-0.5 rounded border border-blue-500/10">
              {role} Portal
            </span>
          </div>
          <h2 className="font-display font-extrabold text-xl text-text-primary mt-1 leading-tight">
            Hi, {userName} &mdash; Today's Focus
          </h2>
          <p className="text-xs text-text-secondary leading-relaxed max-w-xl">
            {subtitleText || "Here is your aggregated summary of tasks, classes, and schedules for today."}
          </p>
        </div>

        {topicText && (
          <div className="p-3.5 rounded-xl bg-background border border-border-subtle flex items-start justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-[9px] font-extrabold uppercase tracking-widest text-text-muted">Currently Active Learning Topic</span>
              <p className="text-xs font-semibold text-text-primary mt-0.5">{topicText}</p>
            </div>
            <span className="text-[10px] font-bold text-accent-blue bg-blue-500/5 px-2 py-1 rounded border border-blue-500/10 shrink-0">
              LMS Topic
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {metrics.map((m, idx) => (
            <div 
              key={idx} 
              className="p-3 rounded-xl border border-border-subtle bg-background flex flex-col justify-between gap-1 group hover:border-border-hover transition-colors"
            >
              <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted truncate">
                {m.label}
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className={`font-display font-black text-xl leading-none text-text-primary ${m.colorClass || ""}`}>
                  {m.value}
                </span>
                {m.subtext && (
                  <span className="text-[9px] font-bold text-text-muted truncate">{m.subtext}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
