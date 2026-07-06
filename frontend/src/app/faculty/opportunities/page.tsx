"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import {
  fetchOpportunities,
  createOpportunity,
  updateOpportunity
} from "@/lib/opportunities";
import { Opportunity } from "@/types/opportunity";
import { OpportunityFilterBar } from "@/components/OpportunityFilterBar";
import { OpportunityFormModal } from "@/components/OpportunityFormModal";
import {
  Briefcase,
  PlusCircle,
  Loader2,
  AlertCircle,
  Edit,
  Archive,
  Calendar,
  Building2,
  GraduationCap,
  Inbox,
  UserCheck,
  Globe
} from "lucide-react";

export default function FacultyOpportunitiesDashboard() {
  const { user, accessToken } = useAuth();

  // API State
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);

  // Page State
  const [activeTab, setActiveTab] = useState<"my" | "all">("my");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);

  // Filters State
  const [filters, setFilters] = useState({
    search: "",
    type: "",
    departmentId: "",
    year: "",
    status: "", // Expose all statuses for faculty
  });

  const loadData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch departments
      const depRes = await apiFetch("/departments", {}, accessToken);
      if (depRes.success && depRes.data?.departments) {
        setDepartments(depRes.data.departments);
      }

      // 2. Fetch opportunities (backend returns active ones plus any they created)
      const oppRes = await fetchOpportunities(accessToken, {
        type: filters.type || undefined,
        departmentId: filters.departmentId || undefined,
        status: filters.status || undefined,
        limit: 100
      });

      if (oppRes.success && oppRes.data?.opportunities) {
        setOpportunities(oppRes.data.opportunities);
      } else if (oppRes.error) {
        setError(oppRes.error);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load opportunities registry.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, filters.type, filters.departmentId, filters.status]);

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
      status: "",
    });
  };

  // Open creation modal
  const handleCreateOpen = () => {
    setSelectedOpportunity(null);
    setIsModalOpen(true);
  };

  // Open edit modal
  const handleEditOpen = (opp: Opportunity) => {
    setSelectedOpportunity(opp);
    setIsModalOpen(true);
  };

  // Quick Archive action
  const handleArchiveOpportunity = async (oppId: string) => {
    if (!accessToken) return;
    if (!confirm("Are you sure you want to archive this opportunity?")) return;

    try {
      const res = await updateOpportunity(accessToken, oppId, { status: "Archived" });
      if (res.success) {
        // Refresh opportunities
        loadData();
      } else {
        alert(res.error || "Failed to archive opportunity.");
      }
    } catch (err: any) {
      console.error(err);
      alert("An error occurred while archiving.");
    }
  };

  // Save Modal Action (Create or Update)
  const handleSaveOpportunity = async (payload: any) => {
    if (!accessToken) return;

    let res;
    if (selectedOpportunity) {
      // Update
      res = await updateOpportunity(accessToken, selectedOpportunity.id, payload);
    } else {
      // Create
      res = await createOpportunity(accessToken, payload);
    }

    if (res.success) {
      loadData();
      setIsModalOpen(false);
    } else {
      throw new Error(res.error || "Failed to save opportunity.");
    }
  };

  // Client side filtration for Search & Year
  const getFilteredOpportunities = () => {
    const userId = user?.id || "";
    
    // 1. Filter by Active Tab ("my" vs "all")
    let baseList = opportunities;
    if (activeTab === "my") {
      baseList = opportunities.filter((opp) => opp.createdBy === userId);
    }

    // 2. Client-side Search and Year filters
    return baseList.filter((opp) => {
      const matchesSearch =
        filters.search === "" ||
        opp.title.toLowerCase().includes(filters.search.toLowerCase()) ||
        (opp.organizer && opp.organizer.toLowerCase().includes(filters.search.toLowerCase()));

      const matchesYear =
        filters.year === "" ||
        !opp.eligibleYears ||
        opp.eligibleYears.length === 0 ||
        opp.eligibleYears.includes(filters.year as any);

      return matchesSearch && matchesYear;
    });
  };

  const filteredList = getFilteredOpportunities();

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "Active":
        return "dark:bg-emerald-500/10 bg-emerald-50 dark:text-emerald-450 text-emerald-700 border dark:border-emerald-500/20 border-emerald-250";
      case "Closed":
        return "dark:bg-rose-500/10 bg-rose-50 dark:text-rose-455 text-rose-700 border dark:border-rose-500/20 border-rose-250";
      case "Archived":
        return "dark:bg-neutral-800 bg-neutral-100 dark:text-neutral-450 text-text-secondary border dark:border-neutral-750 border-border-subtle";
      default:
        return "dark:bg-neutral-800 bg-neutral-100 dark:text-neutral-400 text-text-muted border dark:border-neutral-750 border-border-subtle";
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Welcome & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-2xl dark:text-white text-text-primary flex items-center gap-2">
            <Briefcase className="text-blue-500" />
            <span>Opportunity Management Console</span>
          </h2>
          <p className="text-xs dark:text-neutral-450 text-text-secondary mt-1">
            Faculty Portal: Publish internships, jobs, hackathons, and seminars for eligible student cohorts.
          </p>
        </div>

        <button
          onClick={handleCreateOpen}
          className="py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/15 cursor-pointer flex items-center justify-center gap-2 self-start sm:self-auto transition"
        >
          <PlusCircle size={16} />
          <span>Post New Opportunity</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-450 text-xs font-semibold rounded-lg flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs Menu */}
      <div className="flex border-b border-border-subtle gap-4">
        <button
          onClick={() => setActiveTab("my")}
          className={`pb-3 text-xs font-bold transition-all relative cursor-pointer flex items-center gap-1.5 ${
            activeTab === "my" ? "text-blue-500" : "dark:text-neutral-400 text-text-secondary dark:hover:text-white hover:text-text-primary"
          }`}
        >
          <UserCheck size={14} />
          <span>My Posted Opportunities</span>
          {activeTab === "my" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full"></span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("all")}
          className={`pb-3 text-xs font-bold transition-all relative cursor-pointer flex items-center gap-1.5 ${
            activeTab === "all" ? "text-blue-500" : "dark:text-neutral-400 text-text-secondary dark:hover:text-white hover:text-text-primary"
          }`}
        >
          <Globe size={14} />
          <span>All Campus Opportunities</span>
          {activeTab === "all" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full"></span>
          )}
        </button>
      </div>

      {/* Filters */}
      <OpportunityFilterBar
        filters={filters}
        departments={departments}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        showStatusFilter={true}
      />

      {/* Desktop Management Table */}
      <div>
        {loading ? (
          <div className="text-center py-20 dark:text-neutral-400 text-text-secondary">
            <Loader2 className="animate-spin text-blue-500 mx-auto mb-3" size={30} />
            <span className="font-mono text-xs">Loading campus opportunities data grid...</span>
          </div>
        ) : filteredList.length > 0 ? (
          <div className="glass-card border border-border-subtle rounded-xl overflow-hidden dark:bg-neutral-900/40 bg-surface/50">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="dark:bg-neutral-900/60 bg-neutral-100/50 border-b border-border-subtle dark:text-neutral-400 text-text-secondary font-semibold">
                    <th className="px-4 py-3.5">Title & Type</th>
                    <th className="px-4 py-3.5">Department</th>
                    <th className="px-4 py-3.5">Eligibility</th>
                    <th className="px-4 py-3.5">Organizer</th>
                    <th className="px-4 py-3.5">Deadline</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5">Author</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-neutral-900 divide-border-subtle dark:text-neutral-300 text-text-secondary">
                  {filteredList.map((opp) => {
                    const isOwnOpportunity = opp.createdBy === user?.id;
                    return (
                      <tr key={opp.id} className="dark:hover:bg-neutral-900/30 hover:bg-neutral-100/50 transition">
                        <td className="px-4 py-3.5">
                          <span className="font-bold dark:text-white text-text-primary block text-sm">{opp.title}</span>
                          <span className="text-[10px] dark:text-blue-400 text-blue-700 font-mono mt-0.5 inline-block px-1.5 py-0.5 rounded dark:bg-blue-500/5 bg-blue-50 border dark:border-blue-500/10 border-blue-200">
                            {opp.type}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-medium dark:text-neutral-300 text-text-secondary">
                          {opp.departmentName || "All Departments"}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-[10px] dark:text-neutral-400 text-text-secondary">
                          {opp.eligibleYears && opp.eligibleYears.length > 0
                            ? opp.eligibleYears.join(", ")
                            : "All Years"}
                        </td>
                        <td className="px-4 py-3.5 dark:text-neutral-300 text-text-secondary flex items-center gap-1.5 mt-2">
                          <Building2 size={13} className="dark:text-neutral-500 text-text-muted" />
                          <span>{opp.organizer || "N/A"}</span>
                        </td>
                        <td className="px-4 py-3.5 font-mono dark:text-neutral-400 text-text-secondary">
                          {formatDate(opp.deadline)}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border capitalize ${getStatusBadgeClass(opp.status)}`}>
                            {opp.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-medium dark:text-neutral-400 text-text-secondary">
                          {opp.createdByName}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isOwnOpportunity ? (
                              <>
                                <button
                                  onClick={() => handleEditOpen(opp)}
                                  className="p-1.5 rounded dark:bg-neutral-850 bg-neutral-100 dark:hover:bg-neutral-800 hover:bg-neutral-200 text-blue-500 hover:text-blue-600 cursor-pointer border dark:border-neutral-800 border-border-subtle transition"
                                  title="Edit Opportunity"
                                >
                                  <Edit size={13} />
                                </button>
                                {opp.status !== "Archived" && (
                                  <button
                                    onClick={() => handleArchiveOpportunity(opp.id)}
                                    className="p-1.5 rounded dark:bg-neutral-850 bg-neutral-100 dark:hover:bg-neutral-800 hover:bg-neutral-200 text-rose-500 hover:text-rose-600 cursor-pointer border dark:border-neutral-800 border-border-subtle transition"
                                    title="Archive Opportunity"
                                  >
                                    <Archive size={13} />
                                  </button>
                                )}
                              </>
                            ) : (
                              <span className="text-[10px] dark:text-neutral-600 text-text-muted font-mono italic">Read-only</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-16 glass-card border border-border-subtle rounded-xl dark:text-neutral-500 text-text-muted font-mono text-xs flex flex-col items-center justify-center gap-2">
            <Inbox size={20} className="dark:text-neutral-650 text-text-muted" />
            <span>No opportunities found matching selected scope.</span>
          </div>
        )}
      </div>

      {/* Form Modal */}
      <OpportunityFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        opportunity={selectedOpportunity}
        onSave={handleSaveOpportunity}
        title={selectedOpportunity ? "Edit Posted Opportunity" : "Post Campus Opportunity"}
        userRole="Faculty"
      />
    </div>
  );
}
