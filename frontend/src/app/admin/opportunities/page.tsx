"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import {
  fetchOpportunities,
  createOpportunity,
  updateOpportunity,
  deleteOpportunity
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
  Trash2,
  Archive,
  Building2,
  Inbox,
  BarChart3,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FolderArchive
} from "lucide-react";

export default function AdminOpportunitiesDashboard() {
  const { accessToken } = useAuth();

  // API State
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);

  // Page State
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
    status: "", // Expose all statuses
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

      // 2. Fetch opportunities
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
      setError(err.message || "Failed to load opportunities database.");
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

  // Open modal
  const handleCreateOpen = () => {
    setSelectedOpportunity(null);
    setIsModalOpen(true);
  };

  const handleEditOpen = (opp: Opportunity) => {
    setSelectedOpportunity(opp);
    setIsModalOpen(true);
  };

  // Delete Action
  const handleDeleteOpportunity = async (oppId: string) => {
    if (!accessToken) return;
    if (!confirm("CRITICAL WARNING: Are you sure you want to PERMANENTLY DELETE this opportunity? This cannot be undone.")) return;

    try {
      const res = await deleteOpportunity(accessToken, oppId);
      if (res.success) {
        loadData();
      } else {
        alert(res.error || "Failed to delete opportunity.");
      }
    } catch (err: any) {
      console.error(err);
      alert("An error occurred during deletion.");
    }
  };

  // Archive Action
  const handleArchiveOpportunity = async (oppId: string) => {
    if (!accessToken) return;
    if (!confirm("Are you sure you want to archive this opportunity?")) return;

    try {
      const res = await updateOpportunity(accessToken, oppId, { status: "Archived" });
      if (res.success) {
        loadData();
      } else {
        alert(res.error || "Failed to archive opportunity.");
      }
    } catch (err: any) {
      console.error(err);
      alert("An error occurred while archiving.");
    }
  };

  // Save Modal Action
  const handleSaveOpportunity = async (payload: any) => {
    if (!accessToken) return;

    let res;
    if (selectedOpportunity) {
      res = await updateOpportunity(accessToken, selectedOpportunity.id, payload);
    } else {
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
    return opportunities.filter((opp) => {
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

  // Compute Analytics Metrics
  const totalCount = opportunities.length;
  const activeCount = opportunities.filter((opp) => opp.status === "Active").length;
  const closedCount = opportunities.filter((opp) => opp.status === "Closed").length;
  const archivedCount = opportunities.filter((opp) => opp.status === "Archived").length;

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-emerald-500/10 text-emerald-450 border-emerald-500/20";
      case "Closed":
        return "bg-rose-500/10 text-rose-455 border-rose-500/20";
      case "Archived":
        return "bg-neutral-800 text-neutral-450 border-neutral-750";
      default:
        return "bg-neutral-800 text-neutral-400 border-neutral-750";
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-2xl dark:text-white text-text-primary flex items-center gap-2">
            <Briefcase className="text-blue-500" />
            <span>Opportunity Administration</span>
          </h2>
          <p className="text-xs dark:text-neutral-450 text-text-secondary mt-1">
            Admin Console: Complete lifecycle CRUD management for campus-wide professional, placement, and extracurricular opportunities.
          </p>
        </div>

        <button
          onClick={handleCreateOpen}
          className="py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/15 cursor-pointer flex items-center justify-center gap-2 self-start sm:self-auto transition select-none"
        >
          <PlusCircle size={16} />
          <span>Publish Opportunity</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-455 text-xs font-semibold rounded-lg flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Analytics Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 rounded-xl dark:border-neutral-800 border-border-subtle bg-surface flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] dark:text-neutral-500 text-text-muted uppercase font-bold tracking-wider">Total Mapped</span>
            <h4 className="text-2xl font-bold font-sans dark:text-white text-text-primary">{totalCount}</h4>
          </div>
          <BarChart3 className="text-blue-500 shrink-0" size={24} />
        </div>
        <div className="glass-card p-4 rounded-xl dark:border-neutral-800 border-border-subtle bg-surface flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] dark:text-neutral-500 text-text-muted uppercase font-bold tracking-wider">Active Slots</span>
            <h4 className="text-2xl font-bold font-sans text-emerald-555 dark:text-emerald-400">{activeCount}</h4>
          </div>
          <CheckCircle className="text-emerald-500 dark:text-emerald-450 shrink-0" size={24} />
        </div>
        <div className="glass-card p-4 rounded-xl dark:border-neutral-800 border-border-subtle bg-surface flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] dark:text-neutral-500 text-text-muted uppercase font-bold tracking-wider">Closed</span>
            <h4 className="text-2xl font-bold font-sans text-rose-600 dark:text-rose-450">{closedCount}</h4>
          </div>
          <XCircle className="text-rose-500 dark:text-rose-455 shrink-0" size={24} />
        </div>
        <div className="glass-card p-4 rounded-xl dark:border-neutral-800 border-border-subtle bg-surface flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] dark:text-neutral-500 text-text-muted uppercase font-bold tracking-wider">Archived</span>
            <h4 className="text-2xl font-bold font-sans dark:text-neutral-400 text-text-secondary">{archivedCount}</h4>
          </div>
          <FolderArchive className="dark:text-neutral-500 text-text-secondary shrink-0" size={24} />
        </div>
      </div>

      {/* Filters */}
      <OpportunityFilterBar
        filters={filters}
        departments={departments}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        showStatusFilter={true}
      />

      {/* Grid Table */}
      <div>
        {loading ? (
          <div className="text-center py-20 dark:text-neutral-400 text-text-secondary">
            <Loader2 className="animate-spin text-blue-500 mx-auto mb-3" size={30} />
            <span className="font-mono text-xs">Querying global administrative database...</span>
          </div>
        ) : filteredList.length > 0 ? (
          <div className="glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="dark:bg-neutral-900/60 bg-neutral-100 border-b dark:border-neutral-800 border-border-subtle dark:text-neutral-400 text-text-secondary font-semibold">
                    <th className="px-4 py-3.5">Title & Type</th>
                    <th className="px-4 py-3.5">Department</th>
                    <th className="px-4 py-3.5">Eligibility</th>
                    <th className="px-4 py-3.5">Organizer</th>
                    <th className="px-4 py-3.5">Deadline</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5">Creator</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-neutral-900 divide-border-subtle dark:text-neutral-300 text-text-secondary">
                  {filteredList.map((opp) => (
                    <tr key={opp.id} className="dark:hover:bg-neutral-900/30 hover:bg-neutral-100/50 transition">
                      <td className="px-4 py-3.5">
                        <span className="font-bold dark:text-white text-text-primary block text-sm">{opp.title}</span>
                        <span className="text-[10px] dark:text-blue-450 text-blue-650 font-mono mt-0.5 inline-block px-1.5 py-0.5 rounded bg-blue-500/5 border border-blue-500/10">
                          {opp.type}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-medium dark:text-neutral-300 text-text-secondary">
                        {opp.departmentName || "All Departments"}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-[10px] dark:text-neutral-455 text-text-muted">
                        {opp.eligibleYears && opp.eligibleYears.length > 0
                          ? opp.eligibleYears.join(", ")
                          : "All Years"}
                      </td>
                      <td className="px-4 py-3.5 dark:text-neutral-350 text-text-secondary flex items-center gap-1.5 mt-2">
                        <Building2 size={13} className="dark:text-neutral-500 text-text-muted" />
                        <span>{opp.organizer || "N/A"}</span>
                      </td>
                      <td className="px-4 py-3.5 font-mono dark:text-neutral-450 text-text-secondary">
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
                          <button
                            onClick={() => handleEditOpen(opp)}
                            className="p-1.5 rounded dark:bg-neutral-900 bg-neutral-100 dark:hover:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-400 text-text-secondary dark:hover:text-white hover:text-text-primary border dark:border-neutral-800 border-border-subtle transition cursor-pointer"
                            title="Edit"
                          >
                            <Edit size={13} />
                          </button>
                          {opp.status !== "Archived" && (
                            <button
                              onClick={() => handleArchiveOpportunity(opp.id)}
                              className="p-1.5 rounded dark:bg-neutral-900 bg-neutral-100 dark:hover:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-400 text-text-secondary dark:hover:text-white hover:text-text-primary border dark:border-neutral-800 border-border-subtle transition cursor-pointer"
                              title="Archive"
                            >
                              <Archive size={13} />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteOpportunity(opp.id)}
                            className="p-1.5 rounded dark:bg-neutral-900 bg-neutral-105 dark:hover:bg-neutral-800 hover:bg-rose-50 dark:text-rose-500 text-rose-600 dark:hover:text-rose-400 border dark:border-neutral-800 border-border-subtle transition cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-16 glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl dark:text-neutral-500 text-text-muted font-mono text-xs flex flex-col items-center justify-center gap-2">
            <Inbox size={20} className="dark:text-neutral-650 text-text-muted" />
            <span>No opportunities logged in register.</span>
          </div>
        )}
      </div>

      {/* Form Modal */}
      <OpportunityFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        opportunity={selectedOpportunity}
        onSave={handleSaveOpportunity}
        title={selectedOpportunity ? "Edit Opportunity Record" : "Publish Institutional Opportunity"}
        userRole="Admin"
      />
    </div>
  );
}
