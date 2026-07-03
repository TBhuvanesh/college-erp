"use client";

import React from "react";
import Link from "next/link";
import { Briefcase, Clock, ArrowRight, Compass, Tag, ExternalLink } from "lucide-react";

export interface OpportunityData {
  id: string;
  title: string;
  description: string | null;
  type: string;
  departmentName: string | null;
  eligibleYears: string[] | null;
  deadline: string | null;
  organizer: string | null;
}

interface OpportunityWidgetProps {
  opportunities: OpportunityData[];
  loading?: boolean;
  role: "admin" | "faculty" | "student";
}

const typeConfig: Record<string, { label: string; cls: string }> = {
  "Placement Drive": { label: "Placement", cls: "dark:text-purple-400 text-purple-700 dark:bg-purple-500/10 bg-purple-50 border dark:border-purple-500/20 border-purple-200" },
  "Job Opportunity":  { label: "Job",       cls: "dark:text-purple-400 text-purple-700 dark:bg-purple-500/10 bg-purple-50 border dark:border-purple-500/20 border-purple-200" },
  "Internship":       { label: "Intern",    cls: "dark:text-blue-400 text-blue-700 dark:bg-blue-500/10 bg-blue-50 border dark:border-blue-500/20 border-blue-200" },
};

const getTypeConfig = (type: string) =>
  typeConfig[type] ?? { label: type, cls: "dark:text-emerald-400 text-emerald-700 dark:bg-emerald-500/10 bg-emerald-50 border dark:border-emerald-500/20 border-emerald-200" };

export const OpportunityWidget: React.FC<OpportunityWidgetProps> = ({
  opportunities,
  loading = false,
  role
}) => {
  const displayItems = opportunities.slice(0, 4);

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle/60">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
            <Compass size={14} strokeWidth={2.5} />
          </div>
          <h3 className="font-display font-bold text-sm text-text-primary">Opportunities</h3>
          {!loading && opportunities.length > 0 && (
            <span className="text-[10px] font-bold bg-surface-elevated border border-border-subtle text-text-muted px-2 py-0.5 rounded-full">
              {opportunities.length} active
            </span>
          )}
        </div>
        <Link
          href={`/${role}/opportunities`}
          className="flex items-center gap-1 text-[11px] font-semibold text-accent-blue hover:underline"
        >
          View all <ArrowRight size={11} />
        </Link>
      </div>

      {/* Card list */}
      <div className="p-3 space-y-2">
        {loading ? (
          <div className="space-y-2">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="p-3 rounded-xl border border-border-subtle animate-pulse">
                <div className="flex justify-between mb-2">
                  <div className="h-3 bg-surface-hover rounded w-3/5" />
                  <div className="h-4 w-14 bg-surface-hover rounded" />
                </div>
                <div className="h-2.5 bg-surface-hover rounded w-4/5 mb-1" />
                <div className="h-2.5 bg-surface-hover rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : displayItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-7 gap-2 text-text-muted">
            <Briefcase size={22} className="opacity-40" />
            <p className="text-xs font-medium">No active opportunities</p>
          </div>
        ) : (
          displayItems.map((o) => {
            const tc = getTypeConfig(o.type);
            const isExpiringSoon = o.deadline &&
              (new Date(o.deadline).getTime() - Date.now()) < 7 * 86400000;

            return (
              <div
                key={o.id}
                className="group p-3 rounded-xl border border-border-subtle bg-surface-hover/50 hover:bg-surface-hover hover:border-border-strong transition-all cursor-pointer"
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <h4 className="text-[13px] font-semibold text-text-primary group-hover:text-accent-blue transition-colors leading-snug truncate flex-1">
                    {o.title}
                  </h4>
                  <span className={`shrink-0 text-[9px] font-extrabold uppercase border px-1.5 py-0.5 rounded tracking-wider ${tc.cls}`}>
                    {tc.label}
                  </span>
                </div>

                {/* Organizer */}
                <p className="text-[11px] text-text-muted truncate">
                  {o.organizer || "Placement Cell"}
                </p>

                {/* Footer meta */}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-border-subtle/60">
                  {o.deadline ? (
                    <span className={`flex items-center gap-1 text-[10px] font-semibold ${isExpiringSoon ? "dark:text-red-400 text-red-600" : "text-text-muted"}`}>
                      <Clock size={10} />
                      Apply by {new Date(o.deadline).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                      {isExpiringSoon && <span className="ml-1 text-[9px] font-black uppercase dark:text-red-400 text-red-600">Soon</span>}
                    </span>
                  ) : <span />}

                  {o.eligibleYears && o.eligibleYears.length > 0 && (
                    <span className="flex items-center gap-1 text-[9px] font-semibold text-text-muted bg-surface border border-border-subtle px-1.5 py-0.5 rounded">
                      <Tag size={8} />
                      {o.eligibleYears.join(", ")}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer link */}
      {!loading && opportunities.length > 4 && (
        <div className="px-4 pb-3 pt-1">
          <Link
            href={`/${role}/opportunities`}
            className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-text-muted hover:text-accent-blue transition-colors py-2 rounded-xl border border-border-subtle hover:border-accent-blue/20 hover:bg-accent-blue/5 w-full"
          >
            <ExternalLink size={11} />
            {opportunities.length - 4} more opportunities
          </Link>
        </div>
      )}
    </div>
  );
};
