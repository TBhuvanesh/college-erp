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
        return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
      case "Job Opportunity":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "Workshop":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "Seminar":
        return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      case "Hackathon":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      case "Competition":
        return "bg-red-500/10 text-red-400 border-red-500/20";
      case "Placement Drive":
        return "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
      case "College Event":
        return "bg-teal-500/10 text-teal-400 border-teal-500/20";
      default:
        return "bg-neutral-500/10 text-neutral-400 border-neutral-500/20";
    }
  };

  // Status colors
  const getStatusBadgeStyles = (statusVal: string) => {
    if (statusVal === "Closed" || isExpired) {
      return "bg-rose-500/10 text-rose-500 border-rose-500/20";
    }
    if (statusVal === "Archived") {
      return "bg-neutral-650 text-neutral-400 border-neutral-700";
    }
    return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  };

  return (
    <div className="glass-card relative flex flex-col justify-between p-5 rounded-xl border border-neutral-800 hover:border-neutral-700 dark:hover:border-neutral-600 transition-all duration-300 hover:shadow-md dark:hover:shadow-neutral-950/50 group">
      
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
        <h3 className="font-display font-bold text-white text-base leading-snug group-hover:text-blue-400 transition-colors mb-2 line-clamp-2">
          {title}
        </h3>

        {/* Info Grid */}
        <div className="space-y-2 mb-4">
          {/* Organizer */}
          {organizer && (
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <Building2 size={13} className="text-neutral-500 shrink-0" />
              <span className="truncate">{organizer}</span>
            </div>
          )}

          {/* Department */}
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <span className="text-neutral-500 font-mono text-[10px] uppercase shrink-0">Dept:</span>
            <span className="truncate font-semibold text-neutral-350">{departmentName || "All Departments"}</span>
          </div>

          {/* Eligible Years */}
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <span className="text-neutral-500 font-mono text-[10px] uppercase shrink-0">Eligibility:</span>
            <span className="truncate text-neutral-350">
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
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <Calendar size={13} className="text-neutral-500 shrink-0" />
              <span className="flex items-center gap-1">
                <span className="text-neutral-500">Event Date:</span>
                <span className="text-white font-semibold">
                  {startDate ? `${formatDate(startDate)} - ` : ""}
                  {formatDate(deadline)}
                </span>
              </span>
            </div>
          ) : (
            <>
              {startDate && (
                <div className="flex items-center gap-2 text-xs text-neutral-400">
                  <Calendar size={13} className="text-neutral-500 shrink-0" />
                  <span className="flex items-center gap-1">
                    <span className="text-neutral-500">Start Date:</span>
                    <span className="text-white font-semibold">
                      {formatDate(startDate)}
                    </span>
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-neutral-400">
                <Clock size={13} className="text-neutral-500 shrink-0" />
                <span className="flex items-center gap-1">
                  <span className="text-neutral-500">Deadline:</span>
                  <span className={isExpired ? "text-rose-450 font-semibold" : "text-white font-semibold"}>
                    {formatDate(deadline)}
                  </span>
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center gap-2 border-t border-neutral-900/60 pt-3.5 mt-auto">
        {/* View Details */}
        <Link
          href={`/student/opportunities/${id}`}
          className="flex-1 py-2 px-3 rounded bg-neutral-800 hover:bg-neutral-750 text-white text-[11px] font-semibold text-center border border-neutral-750 hover:border-neutral-600 transition flex items-center justify-center gap-1 cursor-pointer"
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
                ? "bg-neutral-800 text-neutral-500 border border-neutral-850 cursor-not-allowed pointer-events-none"
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
                ? "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                : "bg-neutral-950/40 border-neutral-800 text-neutral-450 hover:border-neutral-700 hover:text-white"
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
