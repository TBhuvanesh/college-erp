"use client";

import React from "react";
import Link from "next/link";
import { Briefcase, Clock, ArrowRight, Tag, Compass } from "lucide-react";

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

export const OpportunityWidget: React.FC<OpportunityWidgetProps> = ({
  opportunities,
  loading = false,
  role
}) => {
  return (
    <div className="bg-surface/95 border border-border-subtle rounded-[16px] p-5 shadow-sm backdrop-blur-xl flex flex-col h-full relative overflow-hidden">
      
      <div className="flex items-center justify-between mb-5 relative z-10">
        <div className="flex items-center gap-2">
          <div className="bg-accent-blue-soft p-1.5 rounded-lg text-accent-blue border border-accent-blue/20">
            <Compass size={16} strokeWidth={2.5} />
          </div>
          <h3 className="font-display font-bold text-text-primary tracking-wide">Opportunities</h3>
        </div>
        <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-500">
          {opportunities.length} Active
        </span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar relative z-10 pr-1">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-neutral-500 gap-2 py-8">
            <div className="w-5 h-5 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
            <span className="text-xs font-medium">Loading opportunities...</span>
          </div>
        ) : opportunities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-neutral-600 gap-2 py-8">
            <Briefcase size={24} className="text-neutral-700" />
            <span className="text-xs font-medium">No new opportunities.</span>
          </div>
        ) : (
          opportunities.slice(0, 3).map((o) => (
            <div key={o.id} className="p-3 bg-surface/40 border border-border-subtle rounded-xl hover:bg-surface/80 hover:border-border-strong transition-colors group cursor-pointer">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold text-text-primary truncate group-hover:text-white transition-colors">{o.title}</h4>
                  <span className="text-[10px] text-text-muted block truncate mt-0.5">{o.organizer || "Placement Cell"}</span>
                </div>

                <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider border shrink-0 ${
                  o.type === "Placement Drive" || o.type === "Job Opportunity"
                    ? "bg-accent-purple-soft border-accent-purple/20 text-accent-purple"
                    : o.type === "Internship"
                    ? "bg-accent-blue-soft border-accent-blue/20 text-accent-blue"
                    : "bg-success-soft border-success/20 text-success"
                }`}>
                  {o.type}
                </span>
              </div>

              {o.description && (
                <p className="text-[11px] text-text-secondary mt-2 line-clamp-2 leading-relaxed">
                  {o.description}
                </p>
              )}

              <div className="flex justify-between items-center text-[9px] text-neutral-500 mt-3 pt-2 border-t border-neutral-800/50 font-medium">
                {o.deadline ? (
                  <span className="flex items-center gap-1 text-danger">
                    <Clock size={10} />
                    Apply by: {new Date(o.deadline).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short"
                    })}
                  </span>
                ) : (
                  <span />
                )}

                {o.eligibleYears && o.eligibleYears.length > 0 && (
                  <span className="flex items-center gap-1 bg-surface-elevated text-text-secondary px-1.5 py-0.5 rounded-sm">
                    <Tag size={8} />
                    {o.eligibleYears[0]}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <Link
        href={`/${role.toLowerCase()}/opportunities`}
        className="mt-4 pt-3 border-t border-border-subtle/50 flex items-center justify-center gap-1.5 text-xs font-semibold text-accent-blue hover:text-accent-blue transition-colors w-full group relative z-10"
      >
        <span>Open Placement Hub</span>
        <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
      </Link>

      <div className="absolute -bottom-16 -right-16 w-48 h-48 blur-3xl opacity-[0.03] rounded-full z-0 pointer-events-none bg-accent-blue" />
    </div>
  );
};
