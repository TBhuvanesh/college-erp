"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import {
  CalendarDays,
  FileText,
  Upload,
  Plus,
  Trash2,
  Edit,
  CheckCircle,
  XCircle,
  Clock,
  Sparkles,
  Loader2,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  ChevronDown
} from "lucide-react";
import { CalendarView, AcademicCalendarEvent } from "@/components/CalendarView";
import { EventFormModal } from "@/components/EventFormModal";
import { PDFUploadModal } from "@/components/PDFUploadModal";

interface ParsedEvent {
  id: string;
  documentId: string;
  documentTitle: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string | null;
  eventType: string;
  targetAudience: string;
  departmentId: string | null;
  departmentName: string | null;
  semester: number | null;
  status: "Pending" | "Approved" | "Edited" | "Rejected";
  createdAt: string;
}

export default function AdminCalendar() {
  const { accessToken } = useAuth();
  
  // State: Tab navigation
  const [activeTab, setActiveTab] = useState<"live" | "candidates">("live");

  // State: Data loading
  const [liveEvents, setLiveEvents] = useState<AcademicCalendarEvent[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);

  const [candidates, setCandidates] = useState<ParsedEvent[]>([]);
  const [candLoading, setCandLoading] = useState(false);
  const [candError, setCandError] = useState<string | null>(null);

  // Pagination for Candidates
  const [candPage, setCandPage] = useState(1);
  const [candLimit] = useState(15);
  const [candTotalPages, setCandTotalPages] = useState(1);
  const [candTotalCount, setCandTotalCount] = useState(0);

  // Filter States for Candidates
  const [candStatusFilter, setCandStatusFilter] = useState("ALL");
  const [candTypeFilter, setCandTypeFilter] = useState("ALL");
  const [candSearchQuery, setCandSearchQuery] = useState("");

  // Selection states for Candidates (bulk action)
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Modals / Toast
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [selectedEventForEdit, setSelectedEventForEdit] = useState<any | null>(null);
  const [formModalTitle, setFormModalTitle] = useState("");
  const [formModalMode, setFormModalMode] = useState<"candidate" | "live">("candidate");

  const [toastMsg, setToastMsg] = useState("");

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 4000);
  };

  // Fetch Live Published Events
  const fetchLiveEvents = useCallback(async () => {
    if (!accessToken) return;
    setLiveLoading(true);
    setLiveError(null);
    try {
      // Admin lists all published and archived events
      const res = await apiFetch("/calendar?limit=100", {}, accessToken);
      if (res.success && res.data?.events) {
        setLiveEvents(res.data.events);
      }
    } catch (err: any) {
      setLiveError(err.message || "Failed to load live published calendar");
    } finally {
      setLiveLoading(false);
    }
  }, [accessToken]);

  // Fetch Candidate Events
  const fetchCandidates = useCallback(async () => {
    if (!accessToken) return;
    setCandLoading(true);
    setCandError(null);
    try {
      const params = new URLSearchParams({
        page: candPage.toString(),
        limit: candLimit.toString()
      });

      if (candStatusFilter !== "ALL") {
        params.append("status", candStatusFilter);
      }
      if (candTypeFilter !== "ALL") {
        params.append("eventType", candTypeFilter);
      }

      const res = await apiFetch(`/parsed-events?${params.toString()}`, {}, accessToken);
      if (res.success && res.data) {
        setCandidates(res.data.events || []);
        if (res.data.pagination) {
          setCandTotalPages(res.data.pagination.totalPages || 1);
          setCandTotalCount(res.data.pagination.total || 0);
        }
      }
    } catch (err: any) {
      setCandError(err.message || "Failed to load candidate events roster");
    } finally {
      setCandLoading(false);
    }
  }, [candPage, candLimit, candStatusFilter, candTypeFilter, accessToken]);

  // Sync data on load and tab switch
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLiveEvents();
      fetchCandidates();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchLiveEvents, fetchCandidates]);

  // Candidate selection checkbox handlers
  const handleSelectAllCandidates = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = new Set(candidates.map((c) => c.id));
      setSelectedCandidateIds(allIds);
    } else {
      setSelectedCandidateIds(new Set());
    }
  };

  const handleSelectOneCandidate = (id: string, checked: boolean) => {
    const newSet = new Set(selectedCandidateIds);
    if (checked) newSet.add(id);
    else newSet.delete(id);
    setSelectedCandidateIds(newSet);
  };

  // Bulk operation triggers
  const handleBulkStatusChange = async (newStatus: "Approved" | "Rejected") => {
    if (selectedCandidateIds.size === 0) return;
    if (!confirm(`Are you sure you want to change the status of ${selectedCandidateIds.size} events to ${newStatus}?`)) return;

    setBulkProcessing(true);
    let successCount = 0;
    try {
      for (const id of Array.from(selectedCandidateIds)) {
        await apiFetch(`/parsed-events/${id}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: newStatus })
        }, accessToken);
        successCount++;
      }
      triggerToast(`Bulk Action Complete: Successfully set ${successCount} candidates to ${newStatus}.`);
      setSelectedCandidateIds(new Set());
      fetchCandidates();
    } catch (err: any) {
      triggerToast(`Bulk operation error: ${err.message}`);
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleBulkPublish = async () => {
    if (selectedCandidateIds.size === 0) return;
    
    // Check if any selected is NOT Approved or Edited
    const nonApproved = candidates.filter(
      (c) => selectedCandidateIds.has(c.id) && c.status !== "Approved" && c.status !== "Edited"
    );
    if (nonApproved.length > 0) {
      alert("Only approved or edited candidate events can be published to the live calendar. Please approve them first.");
      return;
    }

    if (!confirm(`Confirm publishing ${selectedCandidateIds.size} events to the live Academic Calendar?`)) return;

    setBulkProcessing(true);
    try {
      const res = await apiFetch("/calendar/publish", {
        method: "POST",
        body: JSON.stringify({ parsedEventIds: Array.from(selectedCandidateIds) })
      }, accessToken);

      if (res.success) {
        triggerToast(`Successfully promoted ${res.data?.published || 0} events to the Live Calendar.`);
        setSelectedCandidateIds(new Set());
        fetchCandidates();
        fetchLiveEvents();
      }
    } catch (err: any) {
      triggerToast(`Publishing failed: ${err.message}`);
    } finally {
      setBulkProcessing(false);
    }
  };

  // Single Candidate Action Handlers
  const handleSingleApprove = async (id: string) => {
    try {
      const res = await apiFetch(`/parsed-events/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "Approved" })
      }, accessToken);
      if (res.success) {
        triggerToast("Candidate event marked as Approved.");
        fetchCandidates();
      }
    } catch (err: any) {
      triggerToast(`Error: ${err.message}`);
    }
  };

  const handleSingleReject = async (id: string) => {
    try {
      const res = await apiFetch(`/parsed-events/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "Rejected" })
      }, accessToken);
      if (res.success) {
        triggerToast("Candidate event rejected.");
        fetchCandidates();
      }
    } catch (err: any) {
      triggerToast(`Error: ${err.message}`);
    }
  };

  const handleDeleteCandidate = async (id: string) => {
    if (!confirm("Are you sure you want to delete this candidate event? It will be removed permanently.")) return;
    try {
      await apiFetch(`/parsed-events/${id}`, {
        method: "DELETE"
      }, accessToken);
      triggerToast("Candidate event deleted successfully.");
      fetchCandidates();
    } catch (err: any) {
      triggerToast(`Deletion failed: ${err.message}`);
    }
  };

  // Event editing (Modal launchers)
  const openEditCandidateModal = (event: ParsedEvent) => {
    setSelectedEventForEdit(event);
    setFormModalTitle("Edit Candidate Event Milestone");
    setFormModalMode("candidate");
    setFormModalOpen(true);
  };

  const openEditLiveModal = (event: AcademicCalendarEvent) => {
    setSelectedEventForEdit(event);
    setFormModalTitle("Modify Published Calendar Event");
    setFormModalMode("live");
    setFormModalOpen(true);
  };

  // Save changes from EventFormModal
  const handleSaveEventData = async (payload: any) => {
    if (!selectedEventForEdit) return;

    const endpoint =
      formModalMode === "candidate"
        ? `/parsed-events/${selectedEventForEdit.id}`
        : `/calendar/${selectedEventForEdit.id}`;

    const res = await apiFetch(endpoint, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }, accessToken);

    if (res.success) {
      triggerToast(`Event details updated successfully.`);
      if (formModalMode === "candidate") {
        fetchCandidates();
      } else {
        fetchLiveEvents();
      }
    }
  };

  // Live event archive status triggers
  const handleArchiveOrRestoreLive = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === "Archived" ? "Published" : "Archived";
    const phrase = nextStatus === "Archived" ? "archive" : "restore";
    
    if (!confirm(`Are you sure you want to ${phrase} this live calendar event?`)) return;

    try {
      const res = await apiFetch(`/calendar/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ publishStatus: nextStatus })
      }, accessToken);

      if (res.success) {
        triggerToast(`Event successfully ${nextStatus.toLowerCase()}.`);
        fetchLiveEvents();
      }
    } catch (err: any) {
      triggerToast(`Status change failed: ${err.message}`);
    }
  };

  // PDF Text Extraction callback
  const handlePdfExtractionSuccess = (msg: string) => {
    triggerToast(msg);
    setUploadModalOpen(false);
    setActiveTab("candidates");
    fetchCandidates();
  };

  // Client-side search filtering for candidates table
  const searchFilteredCandidates = candidates.filter((c) => {
    if (!candSearchQuery.trim()) return true;
    return (
      c.title.toLowerCase().includes(candSearchQuery.toLowerCase()) ||
      (c.description || "").toLowerCase().includes(candSearchQuery.toLowerCase()) ||
      c.eventType.toLowerCase().includes(candSearchQuery.toLowerCase())
    );
  });

  return (
    <div className="relative">
      
      {/* Toast message panel */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-blue-600 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-xl shadow-blue-600/20 border border-blue-400/20 animate-fade-in">
          <Sparkles size={14} className="animate-pulse" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="font-display font-bold text-2xl text-text-primary">Academic Calendar Desk</h2>
          <p className="text-xs text-text-muted mt-1">
            Publish semester instruction cycles, exams, JNTUH holidays, and general institutional fee deadlines.
          </p>
        </div>
        
        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={() => setUploadModalOpen(true)}
            className="px-4 py-2 text-xs font-semibold rounded border border-neutral-700 bg-surface hover:bg-surface-elevated text-text-secondary hover:text-text-primary cursor-pointer transition flex items-center gap-1.5"
          >
            <Upload size={14} />
            <span>PDF Upload Desk</span>
          </button>
        </div>
      </div>

      {/* Roster tab navigation switches */}
      <div className="flex border-b border-border-subtle mb-6">
        <button
          onClick={() => setActiveTab("live")}
          className={`px-4 py-2.5 text-xs font-semibold transition border-b-2 cursor-pointer ${
            activeTab === "live"
              ? "border-blue-500 text-text-primary font-bold"
              : "border-transparent text-text-muted hover:text-text-secondary"
          }`}
        >
          <span className="flex items-center gap-2">
            <CalendarDays size={14} />
            <span>Live Published Calendar</span>
          </span>
        </button>
        <button
          onClick={() => setActiveTab("candidates")}
          className={`px-4 py-2.5 text-xs font-semibold transition border-b-2 cursor-pointer ${
            activeTab === "candidates"
              ? "border-blue-500 text-text-primary font-bold"
              : "border-transparent text-text-muted hover:text-text-secondary"
          }`}
        >
          <span className="flex items-center gap-2">
            <FileText size={14} />
            <span>Candidate Events Roster</span>
            {candidates.filter(c => c.status === "Pending").length > 0 && (
              <span className="dark:bg-amber-500/10 bg-amber-500/20 dark:text-amber-500 text-amber-705 border dark:border-amber-500/25 border-amber-500/30 px-1.5 py-0.2 rounded-full text-[9px] font-bold">
                {candidates.filter(c => c.status === "Pending").length} new
              </span>
            )}
          </span>
        </button>
      </div>

      {/* TAB CONTENT: LIVE PUBLISHED CALENDAR VIEW */}
      {activeTab === "live" && (
        <CalendarView
          events={liveEvents}
          loading={liveLoading}
          error={liveError}
          role="admin"
          onEditEvent={openEditLiveModal}
          onArchiveEvent={handleArchiveOrRestoreLive}
        />
      )}

      {/* TAB CONTENT: CANDIDATE EVENTS REVIEW PANEL */}
      {activeTab === "candidates" && (
        <div className="space-y-6">
          
          {/* Candidate filters */}
          <div className="bg-surface border border-border-subtle rounded-xl p-4 flex flex-col md:flex-row gap-3">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-text-muted" />
              <input
                type="text"
                placeholder="Filter candidates by name or keywords..."
                value={candSearchQuery}
                onChange={(e) => setCandSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-background border border-border-subtle rounded text-text-primary focus:outline-none focus:border-neutral-700"
              />
            </div>

            {/* Status Filter */}
            <div className="w-full md:w-48 flex items-center gap-2 bg-background border border-border-subtle rounded px-2 text-xs text-text-primary">
              <Filter size={12} className="text-text-muted shrink-0" />
              <span className="text-text-muted">Status:</span>
              <select
                value={candStatusFilter}
                onChange={(e) => {
                  setCandStatusFilter(e.target.value);
                  setCandPage(1);
                }}
                className="bg-transparent text-text-primary cursor-pointer py-2 flex-1 focus:outline-none text-[11px]"
              >
                <option value="ALL">All Statuses</option>
                <option value="Pending">Pending Review</option>
                <option value="Approved">Approved</option>
                <option value="Edited">Edited</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>

            {/* Event Type Filter */}
            <div className="w-full md:w-48 flex items-center gap-2 bg-background border border-border-subtle rounded px-2 text-xs text-text-primary">
              <Filter size={12} className="text-text-muted shrink-0" />
              <span className="text-text-muted">Type:</span>
              <select
                value={candTypeFilter}
                onChange={(e) => {
                  setCandTypeFilter(e.target.value);
                  setCandPage(1);
                }}
                className="bg-transparent text-text-primary cursor-pointer py-2 flex-1 focus:outline-none text-[11px]"
              >
                <option value="ALL">All Types</option>
                <option value="Class Commencement">Class Commencement</option>
                <option value="Mid-Term Examination">Mid-Term Exams</option>
                <option value="End Semester Examination">Semester Exams</option>
                <option value="Lab Examination">Lab Exams</option>
                <option value="Holiday">Holidays</option>
                <option value="Academic Activity">Academic Activity</option>
                <option value="Other">Other / General</option>
              </select>
            </div>
          </div>

          {/* Roster grid table */}
          <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden relative">
            
            {candError && (
              <div className="p-4 bg-rose-500/10 border-b border-border-subtle text-rose-450 text-xs font-semibold font-mono">
                Error: {candError}
              </div>
            )}

            {/* Bulk actions float bar */}
            {selectedCandidateIds.size > 0 && (
              <div className="sticky top-0 left-0 right-0 z-20 dark:bg-blue-600/90 bg-blue-700/90 backdrop-blur-md border-b dark:border-blue-500/50 border-blue-550 p-2.5 flex items-center justify-between animate-fade-in shadow-xl">
                <span className="text-xs font-bold text-white ml-2 flex items-center gap-2">
                  <CheckCircle2 size={14} className="animate-pulse" />
                  {selectedCandidateIds.size} candidate event{selectedCandidateIds.size > 1 ? "s" : ""} selected
                </span>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedCandidateIds(new Set())}
                    className="px-3 py-1.5 rounded bg-blue-800 hover:bg-blue-900 text-white text-[10px] font-semibold transition cursor-pointer"
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => handleBulkStatusChange("Approved")}
                    disabled={bulkProcessing}
                    className="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleBulkStatusChange("Rejected")}
                    disabled={bulkProcessing}
                    className="px-3 py-1.5 rounded bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    Reject
                  </button>
                  <button
                    onClick={handleBulkPublish}
                    disabled={bulkProcessing}
                    className="px-3.5 py-1.5 rounded bg-white text-blue-700 hover:bg-neutral-100 disabled:opacity-55 font-extrabold text-[10px] transition flex items-center gap-1 cursor-pointer shadow-md"
                  >
                    {bulkProcessing ? (
                      <Loader2 size={12} className="animate-spin text-blue-700" />
                    ) : (
                      <Sparkles size={12} className="text-amber-500" />
                    )}
                    Publish Milestones
                  </button>
                </div>
              </div>
            )}

            {/* Desktop Table view */}
            <div className="hidden md:block overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 z-10 bg-surface border-b border-border-subtle shadow-sm">
                  <tr className="text-text-muted font-semibold">
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={candidates.length > 0 && selectedCandidateIds.size === candidates.length}
                        onChange={handleSelectAllCandidates}
                        className="rounded bg-background border-neutral-700 text-blue-500 focus:ring-0 cursor-pointer"
                      />
                    </th>
                    <th className="px-4 py-3">Milestone Duration</th>
                    <th className="px-4 py-3">Event Type</th>
                    <th className="px-4 py-3">Extracted Title / Details</th>
                    <th className="px-4 py-3">Dept & Sem</th>
                    <th className="px-4 py-3">Audience</th>
                    <th className="px-4 py-3">Review Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900 text-text-secondary">
                  {candLoading ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-text-muted font-mono text-[11px]">
                        <Loader2 className="animate-spin text-blue-500 mx-auto mb-2" size={20} />
                        <span>Scanning document extractions...</span>
                      </td>
                    </tr>
                  ) : searchFilteredCandidates.length > 0 ? (
                    searchFilteredCandidates.map((c) => (
                      <tr
                        key={c.id}
                        className={`hover:bg-surface/40 transition cursor-pointer select-none ${
                          selectedCandidateIds.has(c.id) ? "bg-surface/50" : ""
                        }`}
                        onClick={() => handleSelectOneCandidate(c.id, !selectedCandidateIds.has(c.id))}
                      >
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedCandidateIds.has(c.id)}
                            onChange={(e) => handleSelectOneCandidate(c.id, e.target.checked)}
                            className="rounded bg-background border-neutral-700 text-blue-500 focus:ring-0 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3 font-mono text-[10px] whitespace-nowrap">
                          <strong className="text-text-primary block">{c.startDate}</strong>
                          {c.endDate && c.endDate !== c.startDate && (
                            <span className="text-text-muted block">to {c.endDate}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-text-muted font-medium">
                          {c.eventType}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-text-primary block leading-tight">{c.title}</span>
                          {c.description && (
                            <span className="text-[10px] text-text-muted block leading-normal mt-0.5 line-clamp-1 max-w-sm" title={c.description}>
                              {c.description}
                            </span>
                          )}
                          <span className="text-[9px] dark:text-neutral-600 text-text-muted block mt-1 truncate max-w-sm" title={c.documentTitle}>
                            Source PDF: {c.documentTitle}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="block">{c.departmentName ? c.departmentName.split(" ")[0] : "General"}</span>
                          <span className="text-[9px] text-text-muted font-mono">
                            {c.semester ? `Semester ${c.semester}` : "All Semesters"}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-[10px]">{c.targetAudience}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[9px] font-bold border capitalize font-mono ${
                              c.status === "Approved"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                : c.status === "Edited"
                                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                                : c.status === "Rejected"
                                ? "bg-rose-500/10 text-rose-600 dark:text-rose-450 border-rose-500/20"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-500/20 animate-pulse"
                            }`}
                          >
                            {c.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => openEditCandidateModal(c)}
                              title="Edit Candidate Fields"
                              className="p-1.5 rounded bg-surface border border-border-subtle hover:bg-surface-elevated text-text-muted hover:text-text-primary transition cursor-pointer"
                            >
                              <Edit size={11} />
                            </button>
                            {c.status !== "Approved" && (
                              <button
                                onClick={() => handleSingleApprove(c.id)}
                                title="Approve Milestone"
                                className="p-1.5 rounded bg-surface border border-border-subtle hover:bg-surface-elevated text-emerald-600 dark:text-emerald-500 hover:text-emerald-700 transition cursor-pointer"
                              >
                                <CheckCircle size={11} />
                              </button>
                            )}
                            {c.status !== "Rejected" && (
                              <button
                                onClick={() => handleSingleReject(c.id)}
                                title="Reject Milestone"
                                className="p-1.5 rounded bg-surface border border-border-subtle hover:bg-surface-elevated text-rose-600 dark:text-rose-500 hover:text-rose-700 transition cursor-pointer"
                              >
                                <XCircle size={11} />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteCandidate(c.id)}
                              title="Delete Candidate"
                              className="p-1.5 rounded bg-surface border border-border-subtle hover:bg-surface-elevated text-text-muted hover:text-rose-600 transition cursor-pointer"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-neutral-600 font-mono text-[10px]">
                        No extracted candidate events fit active filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card view */}
            <div className="block md:hidden divide-y divide-neutral-900">
              {candLoading ? (
                <div className="text-center py-12 text-neutral-500 font-mono text-[11px]">
                  <Loader2 className="animate-spin text-blue-500 mx-auto mb-1" size={20} />
                  <span>Loading candidate events...</span>
                </div>
              ) : searchFilteredCandidates.length > 0 ? (
                searchFilteredCandidates.map((c) => (
                  <div
                    key={c.id}
                    className={`p-4 flex flex-col gap-2.5 hover:bg-neutral-900/10 cursor-pointer ${
                      selectedCandidateIds.has(c.id) ? "bg-neutral-900/20" : ""
                    }`}
                    onClick={() => handleSelectOneCandidate(c.id, !selectedCandidateIds.has(c.id))}
                  >
                    <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedCandidateIds.has(c.id)}
                        onChange={(e) => handleSelectOneCandidate(c.id, e.target.checked)}
                        className="rounded dark:bg-neutral-950 bg-background border dark:border-neutral-700 border-border-subtle text-blue-500 focus:ring-0 cursor-pointer w-4 h-4"
                      />
                      <span className="font-mono text-[9px] dark:text-neutral-500 text-text-muted">SELECT ME</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[8px] font-bold border capitalize font-mono ${
                        c.status === "Approved"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                          : c.status === "Edited"
                          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                          : c.status === "Rejected"
                          ? "bg-rose-500/10 text-rose-650 dark:text-rose-450 border-rose-500/20"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-505 border-amber-500/20 animate-pulse"
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold dark:text-white text-text-primary text-xs">{c.title}</h4>
                    {c.description && (
                      <p className="text-[10px] dark:text-neutral-400 text-text-secondary leading-normal mt-1">{c.description}</p>
                    )}
                    <span className="text-[9px] dark:text-neutral-600 text-text-muted block mt-1 italic">
                      File: {c.documentTitle}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-y-2 text-[10px] font-mono dark:text-neutral-300 text-text-secondary border-t dark:border-neutral-900 border-border-subtle pt-2.5">
                    <div>
                      <span className="dark:text-neutral-600 text-text-muted block text-[8px] uppercase font-bold">Duration</span>
                      <span>{c.startDate} {c.endDate && c.endDate !== c.startDate ? `to ${c.endDate}` : ""}</span>
                    </div>
                    <div>
                      <span className="dark:text-neutral-600 text-text-muted block text-[8px] uppercase font-bold">Type (Enum)</span>
                      <span>{c.eventType}</span>
                    </div>
                    <div>
                      <span className="dark:text-neutral-600 text-text-muted block text-[8px] uppercase font-bold">Scope / Semester</span>
                      <span>{c.departmentName ? c.departmentName.split(" ")[0] : "All"} / {c.semester ? `Sem ${c.semester}` : "All"}</span>
                    </div>
                    <div>
                      <span className="dark:text-neutral-600 text-text-muted block text-[8px] uppercase font-bold">Audience</span>
                      <span>{c.targetAudience}</span>
                    </div>
                  </div>

                    <div className="flex justify-end gap-2 border-t dark:border-neutral-900/50 border-border-subtle pt-2 mt-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => openEditCandidateModal(c)}
                        className="px-2.5 py-1 dark:bg-neutral-900 bg-neutral-100 dark:hover:bg-neutral-800 hover:bg-neutral-200 border dark:border-neutral-850 border-border-subtle rounded dark:text-neutral-300 text-text-primary text-[10px] transition cursor-pointer"
                      >
                        Edit
                      </button>
                      {c.status !== "Approved" && (
                        <button
                          onClick={() => handleSingleApprove(c.id)}
                          className="px-2.5 py-1 dark:bg-neutral-900 bg-neutral-100 dark:hover:bg-neutral-800 hover:bg-neutral-200 border dark:border-neutral-850 border-border-subtle rounded text-emerald-600 dark:text-emerald-400 text-[10px] transition cursor-pointer"
                        >
                          Approve
                        </button>
                      )}
                      {c.status !== "Rejected" && (
                        <button
                          onClick={() => handleSingleReject(c.id)}
                          className="px-2.5 py-1 dark:bg-neutral-900 bg-neutral-100 dark:hover:bg-neutral-800 hover:bg-neutral-200 border dark:border-neutral-850 border-border-subtle rounded text-rose-600 dark:text-rose-455 text-[10px] transition cursor-pointer"
                        >
                          Reject
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteCandidate(c.id)}
                        className="p-1.5 dark:bg-neutral-900 bg-neutral-100 dark:hover:bg-neutral-850 hover:bg-neutral-200 border dark:border-neutral-850 border-border-subtle rounded dark:text-neutral-500 text-text-muted hover:text-rose-600 transition cursor-pointer"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-neutral-650 font-mono text-[10px]">
                  No extracted candidates fit active filters.
                </div>
              )}
            </div>
          </div>

          {/* Pagination controls for candidates */}
          {candTotalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t dark:border-neutral-900 border-border-subtle dark:bg-neutral-950/20 bg-surface px-4 py-3 rounded-lg border dark:border-neutral-800 border-border-subtle">
              <span className="text-[10px] font-mono dark:text-neutral-500 text-text-muted">
                Milestones: Showing {(candPage - 1) * candLimit + 1} to {Math.min(candPage * candLimit, candTotalCount)} of {candTotalCount}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={candPage <= 1}
                  onClick={() => setCandPage(candPage - 1)}
                  className="px-2.5 py-1.5 dark:bg-neutral-900 bg-neutral-100 dark:hover:bg-neutral-850 hover:bg-neutral-200 dark:text-neutral-400 text-text-secondary disabled:opacity-55 border dark:border-neutral-850 border-border-subtle text-[10px] font-bold rounded transition cursor-pointer"
                >
                  Previous Page
                </button>
                <button
                  disabled={candPage >= candTotalPages}
                  onClick={() => setCandPage(candPage + 1)}
                  className="px-2.5 py-1.5 dark:bg-neutral-900 bg-neutral-100 dark:hover:bg-neutral-850 hover:bg-neutral-200 dark:text-neutral-400 text-text-secondary disabled:opacity-55 border dark:border-neutral-850 border-border-subtle text-[10px] font-bold rounded transition cursor-pointer"
                >
                  Next Page
                </button>
              </div>
            </div>
          )}

        </div>
      )}

      {/* PDF Upload Modal */}
      <PDFUploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onExtractionSuccess={handlePdfExtractionSuccess}
      />

      {/* Event Details Form Modal (Candidate & Live Edit) */}
      <EventFormModal
        isOpen={formModalOpen}
        onClose={() => {
          setFormModalOpen(false);
          setSelectedEventForEdit(null);
        }}
        event={selectedEventForEdit}
        onSave={handleSaveEventData}
        title={formModalTitle}
      />

    </div>
  );
}
