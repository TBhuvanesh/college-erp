"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSimulation } from "@/context/SimulationContext";
import { apiFetch } from "@/lib/api";
import { fetchOpportunities, toggleBookmark } from "@/lib/opportunities";
import { Opportunity } from "@/types/opportunity";
import { OpportunityCard } from "@/components/OpportunityCard";
import { OpportunityFilterBar } from "@/components/OpportunityFilterBar";
import {
  Briefcase,
  Bookmark,
  Clock,
  Sparkles,
  Loader2,
  AlertCircle,
  TrendingUp,
  Inbox
} from "lucide-react";

export default function StudentOpportunitiesDashboard() {
  const { accessToken } = useAuth();
  const { students, currentStudentId } = useSimulation();

  // Active student
  const activeStudent = students.find((s) => s.id === currentStudentId) || students[0];

  // API State
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  
  // Loading & error
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters State
  const [filters, setFilters] = useState({
    search: "",
    type: "",
    departmentId: "",
    year: "",
    status: "Active", // Student should focus on active ones by default
  });

  const loadData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch departments for dropdown
      const depRes = await apiFetch("/departments", {}, accessToken);
      if (depRes.success && depRes.data?.departments) {
        setDepartments(depRes.data.departments);
      }

      // 2. Fetch opportunities (backend automatically scopes by student's department/year)
      const oppRes = await fetchOpportunities(accessToken, {
        type: filters.type || undefined,
        departmentId: filters.departmentId || undefined,
        status: "Active", // Students only see Active opportunities
        limit: 100 // Load a decent batch so we can split/filter client-side
      });

      if (oppRes.success && oppRes.data?.opportunities) {
        setOpportunities(oppRes.data.opportunities);
      } else if (oppRes.error) {
        setError(oppRes.error);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load opportunities dashboard.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, filters.type, filters.departmentId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  // Handle filter changes
  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      search: "",
      type: "",
      departmentId: "",
      year: "",
      status: "Active",
    });
  };

  // Bookmark Toggle
  const handleBookmarkToggle = async (id: string) => {
    if (!accessToken) return;
    try {
      const res = await toggleBookmark(accessToken, id);
      if (res.success && res.data) {
        // Update local state to reflect toggled bookmark
        setOpportunities((prev) =>
          prev.map((opp) =>
            opp.id === id ? { ...opp, isBookmarked: res.data!.bookmarked } : opp
          )
        );
      }
    } catch (err: any) {
      console.error("Failed to toggle bookmark", err);
    }
  };

  // Perform client-side filter (for Search and Year)
  const getFilteredOpportunities = () => {
    return opportunities.filter((opp) => {
      // Search check
      const matchesSearch =
        filters.search === "" ||
        opp.title.toLowerCase().includes(filters.search.toLowerCase()) ||
        (opp.organizer && opp.organizer.toLowerCase().includes(filters.search.toLowerCase()));

      // Year check
      const matchesYear =
        filters.year === "" ||
        !opp.eligibleYears ||
        opp.eligibleYears.length === 0 ||
        opp.eligibleYears.includes(filters.year as any);

      return matchesSearch && matchesYear;
    });
  };

  const filteredList = getFilteredOpportunities();

  // Split into sections as required by MAIN PAGE prompt:
  // 1. Featured: Active, not expired, select first 3
  const featuredOpps = filteredList
    .filter((opp) => {
      const isExpired = opp.deadline ? new Date(opp.deadline) < new Date() : false;
      return !isExpired;
    })
    .slice(0, 3);

  // 2. New: Sorted by createdAt desc, select first 6
  const newOpps = [...filteredList]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  // 3. Upcoming Deadlines: Active, deadline in future, sorted by deadline asc
  const upcomingDeadlines = filteredList
    .filter((opp) => {
      if (!opp.deadline) return false;
      const isExpired = new Date(opp.deadline) < new Date();
      return !isExpired;
    })
    .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
    .slice(0, 4);

  // 4. Bookmarked Opportunities
  const bookmarkedOpps = filteredList.filter((opp) => opp.isBookmarked);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-2xl text-white flex items-center gap-2">
            <Briefcase className="text-blue-500" />
            <span>Opportunity Hub</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Discover internships, jobs, hackathons, competitions, workshops, seminars, and placement drives.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-450 text-xs font-semibold rounded-lg flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Bar */}
      <OpportunityFilterBar
        filters={filters}
        departments={departments}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        showStatusFilter={false}
      />

      {loading ? (
        <div className="text-center py-20 text-neutral-400">
          <Loader2 className="animate-spin text-blue-500 mx-auto mb-3" size={30} />
          <span className="font-mono text-xs">Querying institutional opportunity registry...</span>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="text-center py-16 glass-card border border-neutral-800 rounded-xl text-neutral-500 font-mono text-xs flex flex-col items-center justify-center gap-2">
          <Inbox size={24} className="text-neutral-600" />
          <span>No eligible opportunities found matching your filters.</span>
        </div>
      ) : (
        <div className="space-y-10">
          
          {/* Section 1: Featured Opportunities */}
          {featuredOpps.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-display font-bold text-white text-sm uppercase tracking-wider flex items-center gap-2 border-b border-neutral-900 pb-2">
                <TrendingUp size={16} className="text-blue-400" />
                <span>Recommended / Featured Opportunities</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {featuredOpps.map((opp) => (
                  <OpportunityCard
                    key={opp.id}
                    opportunity={opp}
                    onBookmarkToggle={handleBookmarkToggle}
                    isStudent={true}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Section 2: Upcoming Deadlines */}
          {upcomingDeadlines.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-display font-bold text-white text-sm uppercase tracking-wider flex items-center gap-2 border-b border-neutral-900 pb-2">
                <Clock size={16} className="text-rose-450" />
                <span>Upcoming Deadlines</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {upcomingDeadlines.map((opp) => (
                  <OpportunityCard
                    key={opp.id}
                    opportunity={opp}
                    onBookmarkToggle={handleBookmarkToggle}
                    isStudent={true}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Section 3: Bookmarked Opportunities */}
          {bookmarkedOpps.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-display font-bold text-white text-sm uppercase tracking-wider flex items-center gap-2 border-b border-neutral-900 pb-2">
                <Bookmark size={16} className="text-amber-400" />
                <span>Bookmarked Opportunities</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {bookmarkedOpps.map((opp) => (
                  <OpportunityCard
                    key={opp.id}
                    opportunity={opp}
                    onBookmarkToggle={handleBookmarkToggle}
                    isStudent={true}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Section 4: All / New Opportunities */}
          {newOpps.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-display font-bold text-white text-sm uppercase tracking-wider flex items-center gap-2 border-b border-neutral-900 pb-2">
                <Sparkles size={16} className="text-emerald-400" />
                <span>New Opportunities</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {newOpps.map((opp) => (
                  <OpportunityCard
                    key={opp.id}
                    opportunity={opp}
                    onBookmarkToggle={handleBookmarkToggle}
                    isStudent={true}
                  />
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
