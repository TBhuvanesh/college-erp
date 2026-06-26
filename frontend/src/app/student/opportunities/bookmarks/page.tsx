"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { fetchBookmarks, toggleBookmark } from "@/lib/opportunities";
import { Opportunity } from "@/types/opportunity";
import { OpportunityCard } from "@/components/OpportunityCard";
import { useRouter } from "next/navigation";
import {
  Bookmark,
  ChevronLeft,
  Loader2,
  AlertCircle,
  Inbox
} from "lucide-react";

export default function StudentBookmarks() {
  const { accessToken } = useAuth();
  const router = useRouter();

  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBookmarks = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchBookmarks(accessToken);
      if (res.success && res.data?.opportunities) {
        setOpportunities(res.data.opportunities);
      } else if (res.error) {
        setError(res.error);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load bookmarked opportunities.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadBookmarks();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadBookmarks]);

  // Remove Bookmark (Toggle off)
  const handleBookmarkToggle = async (id: string) => {
    if (!accessToken) return;
    try {
      const res = await toggleBookmark(accessToken, id);
      if (res.success && res.data) {
        // Since we are on bookmarks page, toggle off should remove it from the list
        if (!res.data.bookmarked) {
          setOpportunities((prev) => prev.filter((opp) => opp.id !== id));
        }
      }
    } catch (err: any) {
      console.error("Failed to remove bookmark", err);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Back Button */}
      <button
        onClick={() => router.push("/student/opportunities")}
        className="flex items-center gap-1.5 text-xs text-neutral-450 hover:text-white transition cursor-pointer"
      >
        <ChevronLeft size={16} />
        <span>Back to Opportunity Hub</span>
      </button>

      {/* Header */}
      <div>
        <h2 className="font-display font-bold text-2xl text-white flex items-center gap-2">
          <Bookmark className="text-amber-400" />
          <span>My Opportunities</span>
        </h2>
        <p className="text-xs text-neutral-400 mt-1">
          Review and track deadlines for all your bookmarked internships, jobs, and events.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-450 text-xs font-semibold rounded-lg flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-neutral-400">
          <Loader2 className="animate-spin text-blue-500 mx-auto mb-3" size={30} />
          <span className="font-mono text-xs">Accessing bookmarked opportunities...</span>
        </div>
      ) : opportunities.length === 0 ? (
        <div className="text-center py-16 glass-card border border-neutral-800 rounded-xl text-neutral-500 font-mono text-xs flex flex-col items-center justify-center gap-2">
          <Inbox size={24} className="text-neutral-600" />
          <span>You haven&apos;t bookmarked any opportunities yet.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {opportunities.map((opp) => (
            <OpportunityCard
              key={opp.id}
              opportunity={opp}
              onBookmarkToggle={handleBookmarkToggle}
              isStudent={true}
            />
          ))}
        </div>
      )}
    </div>
  );
}
