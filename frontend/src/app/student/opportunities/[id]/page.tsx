"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getOpportunity, toggleBookmark } from "@/lib/opportunities";
import { Opportunity } from "@/types/opportunity";
import {
  Calendar,
  Clock,
  MapPin,
  Building2,
  ChevronLeft,
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  Loader2,
  AlertCircle,
  ShieldCheck,
  GraduationCap
} from "lucide-react";

export default function StudentOpportunityDetails() {
  const { accessToken } = useAuth();
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookmarking, setBookmarking] = useState(false);

  const loadOpportunity = useCallback(async () => {
    if (!accessToken || !id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getOpportunity(accessToken, id);
      if (res.success && res.data) {
        setOpportunity(res.data);
      } else {
        setError(res.error || "Failed to load opportunity details.");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadOpportunity();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadOpportunity]);

  const handleBookmarkToggle = async () => {
    if (!accessToken || !opportunity || bookmarking) return;
    setBookmarking(true);
    try {
      const res = await toggleBookmark(accessToken, opportunity.id);
      if (res.success && res.data) {
        setOpportunity((prev) =>
          prev ? { ...prev, isBookmarked: res.data!.bookmarked } : null
        );
      }
    } catch (err: any) {
      console.error("Failed to toggle bookmark", err);
    } finally {
      setBookmarking(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-20 text-text-muted">
        <Loader2 className="animate-spin text-blue-500 mx-auto mb-3" size={30} />
        <span className="font-mono text-xs">Accessing opportunity details...</span>
      </div>
    );
  }

  if (error || !opportunity) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition cursor-pointer"
        >
          <ChevronLeft size={16} />
          <span>Back to Opportunities</span>
        </button>
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-450 text-xs font-semibold rounded-lg flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error || "Opportunity not found"}</span>
        </div>
      </div>
    );
  }

  const {
    title,
    description,
    type,
    departmentName,
    eligibleYears,
    registrationLink,
    startDate,
    deadline,
    location,
    organizer,
    status,
    isBookmarked,
  } = opportunity;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const isExpired = deadline ? new Date(deadline) < new Date() : false;

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
        return "dark:bg-neutral-500/10 bg-neutral-100 dark:text-neutral-400 text-text-secondary dark:border-neutral-500/20 border-border-subtle";
    }
  };
  const isEventType = [
    "Workshop",
    "Seminar",
    "Hackathon",
    "Competition",
    "College Event",
  ].includes(type);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition cursor-pointer"
      >
        <ChevronLeft size={16} />
        <span>Back to Opportunity Hub</span>
      </button>

      {/* Main Details Card */}
      <div className="bg-surface border border-border-subtle rounded-xl p-6 sm:p-8 space-y-6">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border-subtle pb-5">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2 items-center">
              <span className={`text-[10px] font-bold font-mono tracking-wider px-2.5 py-1 rounded-full border ${getTypeBadgeStyles(type)}`}>
                {type}
              </span>
              {(isExpired || status === "Closed") ? (
                <span className="text-[10px] font-bold font-mono tracking-wider px-2.5 py-1 rounded-full border dark:bg-rose-500/10 bg-rose-50 dark:text-rose-500 text-rose-700 dark:border-rose-500/20 border-rose-200">
                  Expired / Closed
                </span>
              ) : (
                <span className="text-[10px] font-bold font-mono tracking-wider px-2.5 py-1 rounded-full border dark:bg-emerald-500/10 bg-emerald-50 dark:text-emerald-400 text-emerald-700 dark:border-emerald-500/20 border-emerald-200">
                  Active
                </span>
              )}
            </div>
            <h1 className="font-display font-bold text-2xl dark:text-white text-text-primary sm:text-3xl leading-tight">
              {title}
            </h1>
            {organizer && (
              <p className="text-sm dark:text-neutral-300 text-text-secondary flex items-center gap-2">
                <Building2 size={15} className="dark:text-neutral-500 text-text-muted" />
                <span className="font-medium">{organizer}</span>
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 w-full md:w-auto self-stretch md:self-auto pt-2 md:pt-0">
            {/* Bookmark button */}
            <button
              onClick={handleBookmarkToggle}
              disabled={bookmarking}
              className={`flex-1 md:flex-initial py-2.5 px-4 rounded-lg text-xs font-semibold border transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 ${
                isBookmarked
                  ? "bg-amber-500/10 border-amber-500/35 text-amber-400 hover:bg-amber-500/20"
                  : "dark:bg-neutral-950 bg-surface border dark:border-neutral-850 border-border-subtle dark:text-neutral-350 text-text-secondary dark:hover:border-neutral-750 hover:border-border-strong dark:hover:text-white hover:text-text-primary"
              }`}
            >
              {isBookmarked ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
              <span>{isBookmarked ? "Bookmarked" : "Bookmark"}</span>
            </button>

            {/* Apply Now */}
            {registrationLink && (
              <a
                href={registrationLink}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex-1 md:flex-initial py-2.5 px-5 rounded-lg text-xs font-semibold text-center transition flex items-center justify-center gap-2 ${
                  isExpired || status === "Closed"
                    ? "dark:bg-neutral-800 bg-neutral-100 dark:text-neutral-505 text-text-muted border dark:border-neutral-850 border-border-subtle cursor-not-allowed pointer-events-none"
                    : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/15 cursor-pointer"
                }`}
              >
                <span>Apply Now</span>
                <ExternalLink size={14} />
              </a>
            )}
          </div>
        </div>

        {/* Info Grid (Eligibility, Dates) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 dark:bg-neutral-950 bg-surface border dark:border-neutral-850 border-border-subtle rounded-xl p-5">
          {/* Eligibility Specs */}
          <div className="space-y-4">
            <h3 className="text-xs uppercase font-bold dark:text-neutral-400 text-text-secondary tracking-wider font-semibold">Eligibility Requirements</h3>
            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5 text-xs">
                <GraduationCap size={16} className="dark:text-neutral-500 text-text-muted shrink-0 mt-0.5" />
                <div>
                  <span className="dark:text-neutral-500 text-text-muted block text-[10px] uppercase font-bold">Department</span>
                  <span className="font-semibold dark:text-white text-text-primary">{departmentName || "All Departments"}</span>
                </div>
              </div>
              <div className="flex items-start gap-2.5 text-xs">
                <ShieldCheck size={16} className="dark:text-neutral-500 text-text-muted shrink-0 mt-0.5" />
                <div>
                  <span className="dark:text-neutral-500 text-text-muted block text-[10px] uppercase font-bold">Eligible Years</span>
                  <span className="font-semibold dark:text-white text-text-primary">
                    {eligibleYears && eligibleYears.length > 0 ? eligibleYears.join(", ") : "All Years"}
                  </span>
                </div>
              </div>
              {location && (
                <div className="flex items-start gap-2.5 text-xs">
                  <MapPin size={16} className="dark:text-neutral-500 text-text-muted shrink-0 mt-0.5" />
                  <div>
                    <span className="dark:text-neutral-500 text-text-muted block text-[10px] uppercase font-bold">Location</span>
                    <span className="font-semibold dark:text-white text-text-primary">{location}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Dates & Timeline */}
          <div className="space-y-4 border-t md:border-t-0 md:border-l dark:border-neutral-850 border-border-subtle pt-4 md:pt-0 md:pl-6">
            <h3 className="text-xs uppercase font-bold dark:text-neutral-400 text-text-secondary tracking-wider font-semibold">Opportunity Timeline</h3>
            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5 text-xs">
                <Calendar size={16} className="dark:text-neutral-500 text-text-muted shrink-0 mt-0.5" />
                <div>
                  <span className="dark:text-neutral-500 text-text-muted block text-[10px] uppercase font-bold">
                    {isEventType ? "Event Start Date" : "Start Date"}
                  </span>
                  <span className="font-semibold dark:text-white text-text-primary">{formatDate(startDate)}</span>
                </div>
              </div>
              <div className="flex items-start gap-2.5 text-xs">
                <Clock size={16} className="dark:text-neutral-500 text-text-muted shrink-0 mt-0.5" />
                <div>
                  <span className="dark:text-neutral-500 text-text-muted block text-[10px] uppercase font-bold">
                    {isEventType ? "Event End Date / Deadline" : "Registration Deadline"}
                  </span>
                  <span className={`font-semibold ${isExpired ? "dark:text-rose-400 text-rose-700" : "dark:text-white text-text-primary"}`}>
                    {formatDate(deadline)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Description Section */}
        <div className="space-y-3 pt-2">
          <h2 className="text-sm uppercase font-bold dark:text-neutral-400 text-text-secondary tracking-wider font-semibold">Detailed Description</h2>
          <div className="text-sm dark:text-neutral-300 text-text-secondary leading-relaxed font-sans whitespace-pre-wrap">
            {description || "No description provided."}
          </div>
        </div>

      </div>
    </div>
  );
}

