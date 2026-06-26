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
      <div className="text-center py-20 text-neutral-400">
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
          className="flex items-center gap-1.5 text-xs text-neutral-450 hover:text-white transition cursor-pointer"
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
        className="flex items-center gap-1.5 text-xs text-neutral-450 hover:text-white transition cursor-pointer"
      >
        <ChevronLeft size={16} />
        <span>Back to Opportunity Hub</span>
      </button>

      {/* Main Details Card */}
      <div className="glass-card border border-neutral-800 rounded-xl p-6 sm:p-8 space-y-6">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-neutral-850 pb-5">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2 items-center">
              <span className={`text-[10px] font-bold font-mono tracking-wider px-2.5 py-1 rounded-full border ${getTypeBadgeStyles(type)}`}>
                {type}
              </span>
              {(isExpired || status === "Closed") ? (
                <span className="text-[10px] font-bold font-mono tracking-wider px-2.5 py-1 rounded-full border bg-rose-500/10 text-rose-500 border-rose-500/20">
                  Expired / Closed
                </span>
              ) : (
                <span className="text-[10px] font-bold font-mono tracking-wider px-2.5 py-1 rounded-full border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                  Active
                </span>
              )}
            </div>
            <h1 className="font-display font-bold text-2xl text-white sm:text-3xl leading-tight">
              {title}
            </h1>
            {organizer && (
              <p className="text-sm text-neutral-300 flex items-center gap-2">
                <Building2 size={15} className="text-neutral-500" />
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
                  : "bg-neutral-950 border border-neutral-850 text-neutral-350 hover:border-neutral-750 hover:text-white"
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
                    ? "bg-neutral-800 text-neutral-500 border border-neutral-850 cursor-not-allowed pointer-events-none"
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-neutral-950 border border-neutral-850 rounded-xl p-5">
          {/* Eligibility Specs */}
          <div className="space-y-4">
            <h3 className="text-xs uppercase font-bold text-neutral-400 tracking-wider">Eligibility Requirements</h3>
            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5 text-xs">
                <GraduationCap size={16} className="text-neutral-500 shrink-0 mt-0.5" />
                <div>
                  <span className="text-neutral-500 block text-[10px] uppercase font-bold">Department</span>
                  <span className="font-semibold text-white">{departmentName || "All Departments"}</span>
                </div>
              </div>
              <div className="flex items-start gap-2.5 text-xs">
                <ShieldCheck size={16} className="text-neutral-500 shrink-0 mt-0.5" />
                <div>
                  <span className="text-neutral-500 block text-[10px] uppercase font-bold">Eligible Years</span>
                  <span className="font-semibold text-white">
                    {eligibleYears && eligibleYears.length > 0 ? eligibleYears.join(", ") : "All Years"}
                  </span>
                </div>
              </div>
              {location && (
                <div className="flex items-start gap-2.5 text-xs">
                  <MapPin size={16} className="text-neutral-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-neutral-500 block text-[10px] uppercase font-bold">Location</span>
                    <span className="font-semibold text-white">{location}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Dates & Timeline */}
          <div className="space-y-4 border-t md:border-t-0 md:border-l border-neutral-850 pt-4 md:pt-0 md:pl-6">
            <h3 className="text-xs uppercase font-bold text-neutral-400 tracking-wider">Opportunity Timeline</h3>
            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5 text-xs">
                <Calendar size={16} className="text-neutral-500 shrink-0 mt-0.5" />
                <div>
                  <span className="text-neutral-500 block text-[10px] uppercase font-bold">
                    {isEventType ? "Event Start Date" : "Start Date"}
                  </span>
                  <span className="font-semibold text-white">{formatDate(startDate)}</span>
                </div>
              </div>
              <div className="flex items-start gap-2.5 text-xs">
                <Clock size={16} className="text-neutral-500 shrink-0 mt-0.5" />
                <div>
                  <span className="text-neutral-500 block text-[10px] uppercase font-bold">
                    {isEventType ? "Event End Date / Deadline" : "Registration Deadline"}
                  </span>
                  <span className={`font-semibold ${isExpired ? "text-rose-450" : "text-white"}`}>
                    {formatDate(deadline)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Description Section */}
        <div className="space-y-3 pt-2">
          <h2 className="text-sm uppercase font-bold text-neutral-400 tracking-wider">Detailed Description</h2>
          <div className="text-sm text-neutral-300 leading-relaxed font-sans whitespace-pre-wrap">
            {description || "No description provided."}
          </div>
        </div>

      </div>
    </div>
  );
}

