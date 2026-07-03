"use client";

import React from "react";
import Link from "next/link";
import { Opportunity } from "@/types/opportunity";
import {
  Calendar,
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  MapPin,
  Clock,
  Building2,
  ChevronRight
} from "lucide-react";

interface OpportunityCardProps {
  opportunity: Opportunity;
  onBookmarkToggle?: (id: string) => Promise<void> | void;
  isStudent?: boolean;
}

export const OpportunityCard: React.FC<OpportunityCardProps> = ({
  opportunity,
  onBookmarkToggle,
  isStudent = true,
}) => {
  const {
    id,
    title,
    type,
    departmentName,
    eligibleYears,
    organizer,
    startDate,
    deadline,
    registrationLink,
    status,
    isBookmarked,
  } = opportunity;

  // Formatting date nicely
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Check if deadline is passed
  const isExpired = deadline ? new Date(deadline) < new Date() : false;

  // Types colors
  const getTypeBadgeStyles = (oppType: string) => {
    switch (oppType) {
      case "Internship":
        return "dark:bg-cyan-500/10 bg-cyan-50 dark:text-cyan-400 text-cyan-700 dark:border-cyan-500/20 border-cyan-200";
      case "Job Opportunity":
        return "dark:bg-emerald-500/10 bg-emerald-50 dark:text-emerald-400 text-emerald-700 dark:border-emerald-500/20 border-emerald-200";
      case "Workshop":
        return "dark:bg-amber-500/10 bg-amber-50 dark:text-amber-400 text-amber-700 dark:border-amber-500/20 border-amber-200";
      case "Seminar":
        return "dark:bg-purple-500/10 bg-purple-50 dark:text-purple-400 text-purple-700 dark:border-purple-500/20 border-purple-200";
      case "Hackathon":
        return "dark:bg-rose-500/10 bg-rose-50 dark:text-rose-400 text-rose-700 dark:border-rose-500/20 border-rose-200";
      case "Competition":
        return "dark:bg-red-500/10 bg-red-50 dark:text-red-400 text-red-700 dark:border-red-500/20 border-red-200";
      case "Placement Drive":
        return "dark:bg-indigo-500/10 bg-indigo-50 dark:text-indigo-400 text-indigo-700 dark:border-indigo-500/20 border-indigo-200";
      case "College Event":
        return "dark:bg-teal-500/10 bg-teal-50 dark:text-teal-400 text-teal-700 dark:border-teal-500/20 border-teal-200";
      default:
        return "dark:bg-neutral-500/10 bg-surface dark:text-neutral-400 text-text-secondary dark:border-neutral-500/20 border-border-subtle";
    }
  };

  // Status colors
  const getStatusBadgeStyles = (statusVal: string) => {
    if (statusVal === "Closed" || isExpired) {
      return "dark:bg-rose-500/10 bg-rose-50 dark:text-rose-500 text-rose-700 dark:border-rose-500/20 border-rose-200";
    }
    if (statusVal === "Archived") {
      return "dark:bg-neutral-650 bg-surface-elevated dark:text-neutral-400 text-text-secondary dark:border-neutral-700 border-border-subtle";
    }
    return "dark:bg-emerald-500/10 bg-emerald-50 dark:text-emerald-400 text-emerald-700 dark:border-emerald-500/20 border-emerald-200";
  };

  return (
    <div className="glass-card relative flex flex-col justify-between p-5 rounded-xl border dark:border-neutral-800 border-border-subtle dark:hover:border-neutral-600 hover:border-border-strong transition-all duration-300 hover:shadow-md dark:hover:shadow-neutral-950/50 group">
      
      {/* Expired overlay indicator (subtle) */}
      {(isExpired || status === "Closed") && (
        <div className="absolute top-2 right-2 z-10">
          <span className="text-[9px] font-bold font-mono tracking-wider px-2 py-0.5 rounded border bg-neutral-950/80 text-neutral-400 border-neutral-800">
            EXPIRED
          </span>
        </div>
      )}

      <div>
        {/* Badges / Header */}
        <div className="flex flex-wrap gap-2 items-center mb-3.5">
          <span className={`text-[10px] font-bold font-mono tracking-wider px-2.5 py-1 rounded-full border ${getTypeBadgeStyles(type)}`}>
            {type}
          </span>
          <span className={`text-[10px] font-bold font-mono tracking-wider px-2.5 py-1 rounded-full border ${getStatusBadgeStyles(status)}`}>
            {status === "Active" && isExpired ? "Closed" : status}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-display font-bold dark:text-white text-text-primary text-base leading-snug group-hover:text-blue-400 transition-colors mb-2 line-clamp-2">
          {title}
        </h3>

        {/* Info Grid */}
        <div className="space-y-2 mb-4">
          {/* Organizer */}
          {organizer && (
            <div className="flex items-center gap-2 text-xs dark:text-neutral-400 text-text-secondary">
              <Building2 size={13} className="dark:text-neutral-500 text-text-muted shrink-0" />
              <span className="truncate">{organizer}</span>
            </div>
          )}

          {/* Department */}
          <div className="flex items-center gap-2 text-xs dark:text-neutral-400 text-text-secondary">
            <span className="dark:text-neutral-500 text-text-muted font-mono text-[10px] uppercase shrink-0">Dept:</span>
            <span className="truncate font-semibold dark:text-neutral-350 text-text-primary">{departmentName || "All Departments"}</span>
          </div>

          {/* Eligible Years */}
          <div className="flex items-center gap-2 text-xs dark:text-neutral-400 text-text-secondary">
            <span className="dark:text-neutral-500 text-text-muted font-mono text-[10px] uppercase shrink-0">Eligibility:</span>
            <span className="truncate dark:text-neutral-350 text-text-primary">
              {eligibleYears && eligibleYears.length > 0
                ? eligibleYears.join(", ")
                : "All Years"}
            </span>
          </div>

          {/* Timeline / Dates */}
          {[
            "Workshop",
            "Seminar",
            "Hackathon",
            "Competition",
            "College Event",
          ].includes(type) ? (
            <div className="flex items-center gap-2 text-xs dark:text-neutral-400 text-text-secondary">
              <Calendar size={13} className="dark:text-neutral-500 text-text-muted shrink-0" />
              <span className="flex items-center gap-1">
                <span className="dark:text-neutral-500 text-text-muted">Event Date:</span>
                <span className="dark:text-white text-text-primary font-semibold">
                  {startDate ? `${formatDate(startDate)} - ` : ""}
                  {formatDate(deadline)}
                </span>
              </span>
            </div>
          ) : (
            <>
              {startDate && (
                <div className="flex items-center gap-2 text-xs dark:text-neutral-400 text-text-secondary">
                  <Calendar size={13} className="dark:text-neutral-500 text-text-muted shrink-0" />
                  <span className="flex items-center gap-1">
                    <span className="dark:text-neutral-500 text-text-muted">Start Date:</span>
                    <span className="dark:text-white text-text-primary font-semibold">
                      {formatDate(startDate)}
                    </span>
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 text-xs dark:text-neutral-400 text-text-secondary">
                <Clock size={13} className="dark:text-neutral-500 text-text-muted shrink-0" />
                <span className="flex items-center gap-1">
                  <span className="dark:text-neutral-500 text-text-muted">Deadline:</span>
                  <span className={isExpired ? "dark:text-rose-450 text-rose-650 font-semibold" : "dark:text-white text-text-primary font-semibold"}>
                    {formatDate(deadline)}
                  </span>
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center gap-2 border-t dark:border-neutral-900/60 border-border-subtle pt-3.5 mt-auto">
        {/* View Details */}
        <Link
          href={`/student/opportunities/${id}`}
          className="flex-1 py-2 px-3 rounded dark:bg-neutral-800 bg-surface-elevated hover:dark:bg-neutral-750 hover:bg-surface-hover dark:text-white text-text-primary text-[11px] font-semibold text-center border dark:border-neutral-750 border-border-subtle hover:dark:border-neutral-600 hover:border-border-strong transition flex items-center justify-center gap-1 cursor-pointer"
        >
          <span>View Details</span>
          <ChevronRight size={12} />
        </Link>

        {/* Apply Now */}
        {registrationLink && (
          <a
            href={registrationLink}
            target="_blank"
            rel="noopener noreferrer"
            className={`py-2 px-3 rounded text-[11px] font-semibold text-center transition flex items-center justify-center gap-1 shrink-0 ${
              isExpired || status === "Closed"
                ? "dark:bg-neutral-800 bg-surface-hover dark:text-neutral-500 text-text-muted border dark:border-neutral-850 border-border-subtle cursor-not-allowed pointer-events-none"
                : "bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/10 cursor-pointer"
            }`}
          >
            <span>Apply</span>
            <ExternalLink size={11} />
          </a>
        )}

        {/* Bookmark button (Student only) */}
        {isStudent && onBookmarkToggle && (
          <button
            onClick={() => onBookmarkToggle(id)}
            className={`p-2 rounded border transition-all duration-200 shrink-0 cursor-pointer ${
              isBookmarked
                ? "dark:bg-amber-500/10 bg-amber-50 dark:border-amber-500/30 border-amber-200 dark:text-amber-400 text-amber-700 dark:hover:bg-amber-500/20 hover:bg-amber-100"
                : "dark:bg-neutral-950/40 bg-surface dark:border-neutral-800 border-border-subtle dark:text-neutral-450 text-text-secondary dark:hover:border-neutral-700 hover:border-border-strong dark:hover:text-white hover:text-text-primary"
            }`}
            title={isBookmarked ? "Remove Bookmark" : "Bookmark Opportunity"}
          >
            {isBookmarked ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
          </button>
        )}
      </div>
    </div>
  );

};
