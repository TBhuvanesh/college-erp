"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import {
  Bell,
  Search,
  Plus,
  Edit,
  Trash2,
  Calendar,
  Filter,
  CheckCircle,
  Clock,
  Loader2,
  X,
  AlertTriangle,
  Eye,
  Send,
  Lock
} from "lucide-react";

interface Department {
  id: string;
  name: string;
  code: string;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  targetAudience: string;
  departmentId: string | null;
  departmentName: string | null;
  semester: number | null;
  priority: "Low" | "Medium" | "High" | "Urgent";
  status: "Draft" | "Published" | "Expired";
  publishDate: string;
  expiryDate: string | null;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export default function AdminAnnouncements() {
  const { accessToken } = useAuth();

  // Bulletins lists & states
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Filters state
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [audienceFilter, setAudienceFilter] = useState("ALL");

  // Modals / Drawers visibility
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Selected object anchors
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  // Create Form Fields
  const [cTitle, setCTitle] = useState("");
  const [cContent, setCContent] = useState("");
  const [cTargetAudience, setCTargetAudience] = useState("All");
  const [cDepartmentId, setCDepartmentId] = useState("");
  const [cSemester, setCSemester] = useState(1);
  const [cPriority, setCPriority] = useState<"Low" | "Medium" | "High" | "Urgent">("Medium");
  const [cPublishDate, setCPublishDate] = useState(() => new Date().toLocaleDateString("en-CA")); // YYYY-MM-DD
  const [cExpiryDate, setCExpiryDate] = useState("");
  const [submittingCreate, setSubmittingCreate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit Form Fields (audience targets remain disabled/immutable)
  const [eTitle, setETitle] = useState("");
  const [eContent, setEContent] = useState("");
  const [ePriority, setEPriority] = useState<"Low" | "Medium" | "High" | "Urgent">("Medium");
  const [ePublishDate, setEPublishDate] = useState("");
  const [eExpiryDate, setEExpiryDate] = useState("");
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Status and Delete submission states
  const [statusLoadingId, setStatusLoadingId] = useState<string | null>(null);
  const [submittingDelete, setSubmittingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  };

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Load departments for filter and creation drop-down
  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const res = await apiFetch("/departments", {}, accessToken);
        if (res.success && res.data?.departments) {
          setDepartments(res.data.departments);
          if (res.data.departments.length > 0) {
            setCDepartmentId(res.data.departments[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load departments:", err);
      }
    };
    if (accessToken) {
      loadDepartments();
    }
  }, [accessToken]);

  // Fetch list of announcements
  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });

      if (debouncedSearch.trim()) {
        queryParams.append("search", debouncedSearch.trim());
      }
      if (statusFilter !== "ALL") {
        queryParams.append("status", statusFilter);
      }
      if (priorityFilter !== "ALL") {
        queryParams.append("priority", priorityFilter);
      }
      if (audienceFilter !== "ALL") {
        queryParams.append("targetAudience", audienceFilter);
      }

      const res = await apiFetch(`/announcements?${queryParams.toString()}`, {}, accessToken);
      if (res.success && res.data) {
        setAnnouncements(res.data.announcements || []);
        if (res.data.pagination) {
          setTotalPages(res.data.pagination.totalPages || 1);
          setTotalRecords(res.data.pagination.total || 0);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load announcements bulletin board.");
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, statusFilter, priorityFilter, audienceFilter, accessToken]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAnnouncements();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchAnnouncements]);

  // Create Submit
  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setSubmittingCreate(true);

    try {
      if (!cTitle.trim()) throw new Error("Please specify a bulletin title.");
      if (!cContent.trim()) throw new Error("Please specify notice content details.");
      if (!cPublishDate) throw new Error("Please pick a publish date.");

      const payload: any = {
        title: cTitle.trim(),
        content: cContent.trim(),
        targetAudience: cTargetAudience,
        priority: cPriority,
        publishDate: cPublishDate
      };

      if (cTargetAudience === "Department Specific") {
        if (!cDepartmentId) throw new Error("Please assign target department.");
        payload.departmentId = cDepartmentId;
      } else if (cTargetAudience === "Semester Specific") {
        payload.semester = Number(cSemester);
      }

      if (cExpiryDate) {
        if (cExpiryDate < cPublishDate) {
          throw new Error("Expiry Date cannot be prior to publish date.");
        }
        payload.expiryDate = cExpiryDate;
      }

      const res = await apiFetch("/announcements", { method: "POST", body: JSON.stringify(payload) }, accessToken);
      if (res.success) {
        triggerToast("Notice template registered successfully (Draft status).");
        setIsCreateOpen(false);
        // Reset c-fields
        setCTitle("");
        setCContent("");
        setCTargetAudience("All");
        setCPriority("Medium");
        setCPublishDate(new Date().toLocaleDateString("en-CA"));
        setCExpiryDate("");
        fetchAnnouncements();
      }
    } catch (err: any) {
      setCreateError(err.message || "Template registration failed.");
    } finally {
      setSubmittingCreate(false);
    }
  };

  // Edit Submit
  const handleEditAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAnnouncement) return;
    setEditError(null);
    setSubmittingEdit(true);

    try {
      if (!eTitle.trim()) throw new Error("Notice title cannot be blank.");
      if (!eContent.trim()) throw new Error("Notice description cannot be blank.");
      if (!ePublishDate) throw new Error("Please pick a publish date.");

      const payload: any = {
        title: eTitle.trim(),
        content: eContent.trim(),
        priority: ePriority,
        publishDate: ePublishDate,
        expiryDate: eExpiryDate || null
      };

      if (eExpiryDate && eExpiryDate < ePublishDate) {
        throw new Error("Expiry date cannot be prior to publish date.");
      }

      const res = await apiFetch(`/announcements/${selectedAnnouncement.id}`, { method: "PATCH", body: JSON.stringify(payload) }, accessToken);
      if (res.success) {
        triggerToast("Bulletin details updated successfully.");
        setIsEditOpen(false);
        fetchAnnouncements();
      }
    } catch (err: any) {
      setEditError(err.message || "Failed to update notice fields.");
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Status transitions
  const handleStatusTransition = async (annId: string, status: "Draft" | "Published" | "Expired") => {
    setStatusLoadingId(annId);
    try {
      const res = await apiFetch(`/announcements/${annId}/status`, { method: "PATCH", body: JSON.stringify({ status }) }, accessToken);
      if (res.success) {
        triggerToast(`Notice transitions state to ${status.toLowerCase()}.`);
        fetchAnnouncements();
      }
    } catch (err: any) {
      triggerToast(err.message || "Failed to update publication status.");
    } finally {
      setStatusLoadingId(null);
    }
  };

  // Delete Submit
  const handleDeleteAnnouncement = async () => {
    if (!selectedAnnouncement) return;
    setDeleteError(null);
    setSubmittingDelete(true);

    try {
      const res = await apiFetch(`/announcements/${selectedAnnouncement.id}`, { method: "DELETE" }, accessToken);
      if (res.success) {
        triggerToast("Announcement deleted successfully.");
        setIsDeleteOpen(false);
        fetchAnnouncements();
      }
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete announcement.");
    } finally {
      setSubmittingDelete(false);
    }
  };

  // Setup modal open states
  const openEditDrawer = (ann: Announcement) => {
    setSelectedAnnouncement(ann);
    setETitle(ann.title);
    setEContent(ann.content);
    setEPriority(ann.priority);
    setEPublishDate(ann.publishDate);
    setEExpiryDate(ann.expiryDate || "");
    setEditError(null);
    setIsEditOpen(true);
  };

  const getPriorityBadgeStyle = (priority: string) => {
    switch (priority) {
      case "Urgent":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      case "High":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "Medium":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      default:
        return "bg-neutral-800 text-neutral-400 border-neutral-700";
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case "Published":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "Expired":
        return "bg-rose-500/10 text-rose-450 border-rose-500/20";
      default:
        return "bg-neutral-800 text-neutral-450 border-neutral-700";
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert Banner */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-neutral-900 border border-blue-500/30 text-blue-400 text-xs font-semibold px-4 py-3 rounded-lg shadow-2xl animate-slide-in">
          <CheckCircle size={14} className="text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-2xl dark:text-white text-text-primary">Institutional Notices Desk</h2>
          <p className="text-xs dark:text-neutral-400 text-text-secondary mt-1">
            Dispatch urgent notices, configure audience scopes, and audit publication schedules.
          </p>
        </div>
        <button
          onClick={() => {
            setCTitle("");
            setCContent("");
            setCTargetAudience("All");
            setCPriority("Medium");
            setCPublishDate(new Date().toLocaleDateString("en-CA"));
            setCExpiryDate("");
            setCreateError(null);
            setIsCreateOpen(true);
          }}
          className="px-3.5 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer transition flex items-center gap-1.5 text-xs shadow-lg shadow-blue-600/15 justify-center select-none"
        >
          <Plus size={14} />
          <span>Draft Notice</span>
        </button>
      </div>

      {/* Search & Filter Controls */}
      <div className="glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl p-4 flex flex-col md:flex-row gap-3">
        {/* Title Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 dark:text-neutral-500 text-text-muted" />
          <input
            type="text"
            placeholder="Search notice registry by title keywords..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs dark:bg-neutral-950 bg-background border dark:border-neutral-850 border-border-subtle rounded dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition"
          />
        </div>

        {/* Filter Audience */}
        <div className="w-full md:w-44 flex items-center gap-2 dark:bg-neutral-950 bg-background border dark:border-neutral-850 border-border-subtle rounded px-2.5 text-xs dark:text-white text-text-primary">
          <Filter size={12} className="dark:text-neutral-500 text-text-muted" />
          <span className="dark:text-neutral-500 text-text-secondary">Audience:</span>
          <select
            value={audienceFilter}
            onChange={e => {
              setAudienceFilter(e.target.value);
              setPage(1);
            }}
            className="bg-transparent dark:text-white text-text-primary cursor-pointer py-2 flex-1 focus:outline-none"
          >
            <option value="ALL">All Targets</option>
            <option value="All">All Roles</option>
            <option value="Students">Students Only</option>
            <option value="Faculty">Faculty Only</option>
            <option value="Admin">Admin Only</option>
            <option value="Department Specific">Department Specific</option>
            <option value="Semester Specific">Semester Specific</option>
          </select>
        </div>

        {/* Filter Priority */}
        <div className="w-full md:w-36 flex items-center gap-2 dark:bg-neutral-950 bg-background border dark:border-neutral-850 border-border-subtle rounded px-2.5 text-xs dark:text-white text-text-primary">
          <Filter size={12} className="dark:text-neutral-500 text-text-muted" />
          <span className="dark:text-neutral-500 text-text-secondary">Priority:</span>
          <select
            value={priorityFilter}
            onChange={e => {
              setPriorityFilter(e.target.value);
              setPage(1);
            }}
            className="bg-transparent dark:text-white text-text-primary cursor-pointer py-2 flex-1 focus:outline-none"
          >
            <option value="ALL">All Levels</option>
            <option value="Urgent">Urgent</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>

        {/* Filter Status */}
        <div className="w-full md:w-36 flex items-center gap-2 dark:bg-neutral-955 bg-background border dark:border-neutral-850 border-border-subtle rounded px-2.5 text-xs dark:text-white text-text-primary">
          <Filter size={12} className="dark:text-neutral-500 text-text-muted" />
          <span className="dark:text-neutral-500 text-text-secondary">Status:</span>
          <select
            value={statusFilter}
            onChange={e => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="bg-transparent dark:text-white text-text-primary cursor-pointer py-2 flex-1 focus:outline-none"
          >
            <option value="ALL">All Status</option>
            <option value="Draft">Draft</option>
            <option value="Published">Published</option>
            <option value="Expired">Expired</option>
          </select>
        </div>
      </div>

      {/* Registry Table */}
      <div className="glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-xs dark:text-neutral-500 text-text-muted mt-2 font-mono">Loading announcements database register...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center bg-rose-500/[0.01]">
            <AlertTriangle className="w-8 h-8 mx-auto text-rose-500 mb-2" />
            <p className="text-xs text-rose-455 font-semibold">{error}</p>
            <button
              onClick={fetchAnnouncements}
              className="mt-3 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-neutral-800 hover:bg-neutral-750 text-white rounded transition"
            >
              Retry Sync
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto relative">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="dark:bg-neutral-900/50 bg-neutral-100 border-b dark:border-neutral-800 border-border-subtle dark:text-neutral-400 text-text-secondary font-semibold sticky top-0 backdrop-blur-md z-10 select-none">
                  <th className="px-4 py-3 text-[10px] uppercase font-bold dark:text-neutral-550 text-text-secondary">Notice Title</th>
                  <th className="px-4 py-3 text-[10px] uppercase font-bold dark:text-neutral-555 text-text-secondary">Target Audience</th>
                  <th className="px-4 py-3 text-[10px] uppercase font-bold dark:text-neutral-555 text-text-secondary">Priority</th>
                  <th className="px-4 py-3 text-[10px] uppercase font-bold dark:text-neutral-555 text-text-secondary">Status</th>
                  <th className="px-4 py-3 text-[10px] uppercase font-bold dark:text-neutral-555 text-text-secondary">Publish Date</th>
                  <th className="px-4 py-3 text-[10px] uppercase font-bold dark:text-neutral-555 text-text-secondary">Expiry Date</th>
                  <th className="px-4 py-3 text-right text-[10px] uppercase font-bold dark:text-neutral-555 text-text-secondary">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-neutral-900 divide-border-subtle dark:text-neutral-300 text-text-secondary">
                {announcements.length > 0 ? (
                  announcements.map(ann => (
                    <tr key={ann.id} className="dark:hover:bg-neutral-900/30 hover:bg-neutral-100/50 transition duration-150 group">
                      {/* Title */}
                      <td className="px-4 py-3.5 max-w-[220px]">
                        <div>
                          <div className="font-semibold dark:text-white text-text-primary leading-tight truncate">{ann.title}</div>
                          <div className="text-[10px] dark:text-neutral-500 text-text-muted truncate mt-0.5" title={ann.content}>
                            {ann.content}
                          </div>
                        </div>
                      </td>

                      {/* Audience */}
                      <td className="px-4 py-3.5">
                        <div className="space-y-0.5">
                          <span className="font-semibold dark:text-neutral-200 text-text-secondary">{ann.targetAudience}</span>
                          {ann.departmentName && (
                            <span className="text-[9px] text-blue-500 dark:text-blue-400 font-mono block">
                              Dept: {ann.departmentName}
                            </span>
                          )}
                          {ann.semester && (
                            <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-mono block">
                              Sem: Semester {ann.semester}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Priority */}
                      <td className="px-4 py-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[8px] font-bold border uppercase tracking-wider ${getPriorityBadgeStyle(
                            ann.priority
                          )}`}
                        >
                          {ann.priority}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[8px] font-bold border uppercase tracking-wider ${getStatusBadgeStyle(
                            ann.status
                          )}`}
                        >
                          {ann.status}
                        </span>
                      </td>

                      {/* Publish Date */}
                      <td className="px-4 py-3.5 font-mono text-[10px] dark:text-neutral-450 text-text-secondary">{ann.publishDate}</td>

                      {/* Expiry Date */}
                      <td className="px-4 py-3.5 font-mono text-[10px] dark:text-neutral-455 text-text-secondary">
                        {ann.expiryDate || <span className="dark:text-neutral-600 text-text-muted italic">Indefinite</span>}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2.5">
                          {/* Publish Inline action */}
                          {ann.status !== "Published" && (
                            <button
                              onClick={() => handleStatusTransition(ann.id, "Published")}
                              disabled={statusLoadingId === ann.id}
                              title="Publish Bulletin"
                              className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer disabled:opacity-40 transition flex items-center gap-1 text-[10px] shadow-lg shadow-emerald-600/10 select-none border-none"
                            >
                              <Send size={9} />
                              <span>Publish</span>
                            </button>
                          )}

                          {/* Expire Inline action */}
                          {ann.status === "Published" && (
                            <button
                              onClick={() => handleStatusTransition(ann.id, "Expired")}
                              disabled={statusLoadingId === ann.id}
                              title="Expire Bulletin"
                              className="px-2 py-1 rounded dark:bg-neutral-800 bg-neutral-100 hover:bg-neutral-750 dark:border-neutral-750 border-border-subtle dark:text-neutral-450 text-text-secondary hover:text-white font-semibold cursor-pointer disabled:opacity-40 transition flex items-center gap-1 text-[10px] select-none"
                            >
                              <Lock size={9} />
                              <span>Expire</span>
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setSelectedAnnouncement(ann);
                              setIsDetailsOpen(true);
                            }}
                            title="Preview Content"
                            className="p-1.5 rounded dark:hover:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-400 text-text-secondary dark:hover:text-white hover:text-text-primary border dark:border-transparent border-border-subtle transition cursor-pointer"
                          >
                            <Eye size={12} />
                          </button>

                          <button
                            onClick={() => openEditDrawer(ann)}
                            title="Edit Notice"
                            className="p-1.5 rounded dark:hover:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-400 text-text-secondary dark:hover:text-white hover:text-text-primary border dark:border-transparent border-border-subtle transition cursor-pointer"
                          >
                            <Edit size={12} />
                          </button>

                          <button
                            onClick={() => {
                              setSelectedAnnouncement(ann);
                              setIsDeleteOpen(true);
                            }}
                            title="Delete Notice"
                            className="p-1.5 rounded dark:hover:bg-neutral-805 hover:bg-rose-50 dark:text-neutral-500 text-text-muted dark:hover:text-rose-450 hover:text-rose-650 border dark:border-transparent border-border-subtle transition cursor-pointer"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center py-12 dark:text-neutral-500 text-text-muted font-mono">
                      No matching announcements found in the bulletin index.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && !loading && (
          <div className="px-4 py-3 dark:bg-neutral-955/80 bg-neutral-100 border-t dark:border-neutral-900 border-border-subtle flex items-center justify-between select-none">
            <span className="text-[10px] dark:text-neutral-500 text-text-muted font-mono">
              Page {page} of {totalPages} ({totalRecords} total bulletins)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(p - 1, 1))}
                className="px-2.5 py-1 text-xs rounded dark:bg-neutral-900 bg-neutral-200 border dark:border-neutral-850 border-border-subtle hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition dark:text-neutral-300 text-text-primary"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                className="px-2.5 py-1 text-xs rounded dark:bg-neutral-900 bg-neutral-200 border dark:border-neutral-850 border-border-subtle hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition dark:text-neutral-300 text-text-primary"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal 1: Create Announcement Drawer (Slide-over from Right) */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm animate-fade-in flex justify-end">
          <div
            className="w-full max-w-md dark:bg-neutral-900 bg-surface border-l dark:border-neutral-800 border-border-subtle h-full flex flex-col justify-between shadow-2xl relative animate-slide-left overflow-y-auto"
            style={{ animationDuration: "250ms" }}
          >
            {/* Header */}
            <div className="p-5 border-b dark:border-neutral-850 border-border-subtle flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-lg dark:text-white text-text-primary">Create Announcement</h3>
                <p className="text-[10px] dark:text-neutral-500 text-text-secondary">Draft institutional broadcast alerts.</p>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1 rounded dark:bg-neutral-850 bg-neutral-100 dark:hover:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-400 text-text-secondary dark:hover:text-white hover:text-text-primary transition cursor-pointer border dark:border-neutral-855 border-border-subtle"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateAnnouncement} className="p-5 flex-1 space-y-4">
              {createError && (
                <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold">
                  {createError}
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-[10px] uppercase font-bold dark:text-neutral-400 text-text-secondary mb-1.5">Bulletin Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Schedule Changes for Autumn Midterm"
                  value={cTitle}
                  onChange={e => setCTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs dark:bg-neutral-955 bg-background border dark:border-neutral-850 border-border-subtle rounded dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition font-semibold"
                />
              </div>

              {/* Content */}
              <div>
                <label className="block text-[10px] uppercase font-bold dark:text-neutral-400 text-text-secondary mb-1.5">Description Content</label>
                <textarea
                  required
                  rows={6}
                  placeholder="Enter notice details..."
                  value={cContent}
                  onChange={e => setCContent(e.target.value)}
                  className="w-full px-3 py-2 text-xs dark:bg-neutral-955 bg-background border dark:border-neutral-850 border-border-subtle rounded dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition resize-none leading-normal"
                />
              </div>

              {/* Target Audience Select */}
              <div>
                <label className="block text-[10px] uppercase font-bold dark:text-neutral-400 text-text-secondary mb-1.5">Target Audience</label>
                <select
                  value={cTargetAudience}
                  onChange={e => setCTargetAudience(e.target.value)}
                  className="w-full dark:bg-neutral-955 bg-background border dark:border-neutral-850 border-border-subtle rounded px-3 py-2 text-xs dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition"
                >
                  <option value="All">All Roles</option>
                  <option value="Students">Students Only</option>
                  <option value="Faculty">Faculty Only</option>
                  <option value="Admin">Admin Only</option>
                  <option value="Department Specific">Department Specific</option>
                  <option value="Semester Specific">Semester Specific</option>
                </select>
                <span className="text-[9px] dark:text-neutral-500 text-text-muted mt-1 block italic leading-normal">
                  Audience target variables are immutable after notice creation.
                </span>
              </div>

              {/* Conditional Fields: Department */}
              {cTargetAudience === "Department Specific" && (
                <div className="animate-fade-in">
                  <label className="block text-[10px] uppercase font-bold dark:text-neutral-400 text-text-secondary mb-1.5">Target Department</label>
                  <select
                    value={cDepartmentId}
                    onChange={e => setCDepartmentId(e.target.value)}
                    className="w-full dark:bg-neutral-955 bg-background border dark:border-neutral-855 border-border-subtle rounded px-3 py-2 text-xs dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition"
                  >
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Conditional Fields: Semester */}
              {cTargetAudience === "Semester Specific" && (
                <div className="animate-fade-in">
                  <label className="block text-[10px] uppercase font-bold dark:text-neutral-400 text-text-secondary mb-1.5">Target Semester Batch</label>
                  <select
                    value={cSemester}
                    onChange={e => setCSemester(Number(e.target.value))}
                    className="w-full dark:bg-neutral-955 bg-background border dark:border-neutral-855 border-border-subtle rounded px-3 py-2 text-xs dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                      <option key={sem} value={sem}>
                        Semester {sem}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Priority level */}
              <div>
                <label className="block text-[10px] uppercase font-bold dark:text-neutral-400 text-text-secondary mb-1.5">Priority Level</label>
                <select
                  value={cPriority}
                  onChange={e => setCPriority(e.target.value as any)}
                  className="w-full dark:bg-neutral-955 bg-background border dark:border-neutral-855 border-border-subtle rounded px-3 py-2 text-xs dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold dark:text-neutral-400 text-text-secondary mb-1.5">Publish Date</label>
                  <input
                    type="date"
                    required
                    value={cPublishDate}
                    onChange={e => setCPublishDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs dark:bg-neutral-955 bg-background border dark:border-neutral-855 border-border-subtle rounded dark:text-white text-text-primary font-mono focus:outline-none focus:border-blue-600 transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold dark:text-neutral-400 text-text-secondary mb-1.5">Expiry Date</label>
                  <input
                    type="date"
                    placeholder="Optional"
                    value={cExpiryDate}
                    onChange={e => setCExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs dark:bg-neutral-955 bg-background border dark:border-neutral-855 border-border-subtle rounded dark:text-white text-text-primary font-mono focus:outline-none focus:border-blue-600 transition"
                  />
                </div>
              </div>
            </form>

            {/* Actions */}
            <div className="p-5 border-t dark:border-neutral-855 border-border-subtle flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="flex-1 py-2 text-xs font-semibold rounded dark:bg-neutral-800 bg-neutral-100 dark:hover:bg-neutral-750 hover:bg-neutral-200 dark:text-neutral-300 text-text-primary border dark:border-neutral-800 border-border-subtle cursor-pointer transition text-center select-none"
              >
                Cancel
              </button>
              <button
                type="submit"
                onClick={handleCreateAnnouncement}
                disabled={submittingCreate}
                className="flex-1 py-2 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-700 text-white cursor-pointer transition text-center flex items-center justify-center gap-1.5 select-none"
              >
                {submittingCreate && <Loader2 size={12} className="animate-spin" />}
                <span>Save Draft</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Edit Announcement Drawer (Slide-over from Right) */}
      {isEditOpen && selectedAnnouncement && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm animate-fade-in flex justify-end">
          <div
            className="w-full max-w-md dark:bg-neutral-900 bg-surface border-l dark:border-neutral-800 border-border-subtle h-full flex flex-col justify-between shadow-2xl relative animate-slide-left overflow-y-auto"
            style={{ animationDuration: "250ms" }}
          >
            {/* Header */}
            <div className="p-5 border-b dark:border-neutral-850 border-border-subtle flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-lg dark:text-white text-text-primary">Edit Announcement Details</h3>
                <p className="text-[10px] dark:text-neutral-500 text-text-secondary">Notice #{selectedAnnouncement.id.substring(0, 8)} details.</p>
              </div>
              <button
                onClick={() => setIsEditOpen(false)}
                className="p-1 rounded dark:bg-neutral-850 bg-neutral-100 dark:hover:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-400 text-text-secondary dark:hover:text-white hover:text-text-primary transition cursor-pointer border dark:border-neutral-850 border-border-subtle"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleEditAnnouncement} className="p-5 flex-1 space-y-4">
              {editError && (
                <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold">
                  {editError}
                </div>
              )}

              {/* Read Only Scope Indicator */}
              <div className="p-3 dark:bg-neutral-950/60 bg-background border dark:border-neutral-855 border-border-subtle rounded dark:text-neutral-400 text-text-secondary text-[11px] leading-normal space-y-0.5">
                <div>
                  <span className="font-semibold dark:text-white text-text-primary">Target Scope:</span> {selectedAnnouncement.targetAudience}
                </div>
                {selectedAnnouncement.departmentName && (
                  <div>
                    <span className="font-semibold dark:text-white text-text-primary">Department:</span> {selectedAnnouncement.departmentName}
                  </div>
                )}
                {selectedAnnouncement.semester && (
                  <div>
                    <span className="font-semibold dark:text-white text-text-primary">Semester Batch:</span> Semester{" "}
                    {selectedAnnouncement.semester}
                  </div>
                )}
              </div>

              {/* Title */}
              <div>
                <label className="block text-[10px] uppercase font-bold dark:text-neutral-400 text-text-secondary mb-1.5">Bulletin Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Schedule Changes for Autumn Midterm"
                  value={eTitle}
                  onChange={e => setETitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs dark:bg-neutral-955 bg-background border dark:border-neutral-850 border-border-subtle rounded dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition font-semibold"
                />
              </div>

              {/* Content */}
              <div>
                <label className="block text-[10px] uppercase font-bold dark:text-neutral-400 text-text-secondary mb-1.5">Description Content</label>
                <textarea
                  required
                  rows={6}
                  placeholder="Enter notice details..."
                  value={eContent}
                  onChange={e => setEContent(e.target.value)}
                  className="w-full px-3 py-2 text-xs dark:bg-neutral-955 bg-background border dark:border-neutral-855 border-border-subtle rounded dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition resize-none leading-normal"
                />
              </div>

              {/* Priority level */}
              <div>
                <label className="block text-[10px] uppercase font-bold dark:text-neutral-400 text-text-secondary mb-1.5">Priority Level</label>
                <select
                  value={ePriority}
                  onChange={e => setEPriority(e.target.value as any)}
                  className="w-full dark:bg-neutral-955 bg-background border dark:border-neutral-855 border-border-subtle rounded px-3 py-2 text-xs dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold dark:text-neutral-400 text-text-secondary mb-1.5">Publish Date</label>
                  <input
                    type="date"
                    required
                    value={ePublishDate}
                    onChange={e => setEPublishDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs dark:bg-neutral-955 bg-background border dark:border-neutral-855 border-border-subtle rounded dark:text-white text-text-primary font-mono focus:outline-none focus:border-blue-600 transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold dark:text-neutral-400 text-text-secondary mb-1.5">Expiry Date</label>
                  <input
                    type="date"
                    value={eExpiryDate}
                    onChange={e => setEExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs dark:bg-neutral-955 bg-background border dark:border-neutral-855 border-border-subtle rounded dark:text-white text-text-primary font-mono focus:outline-none focus:border-blue-600 transition"
                  />
                </div>
              </div>
            </form>

            {/* Actions */}
            <div className="p-5 border-t dark:border-neutral-855 border-border-subtle flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="flex-1 py-2 text-xs font-semibold rounded dark:bg-neutral-800 bg-neutral-100 dark:hover:bg-neutral-750 hover:bg-neutral-200 dark:text-neutral-300 text-text-primary border dark:border-neutral-800 border-border-subtle cursor-pointer transition text-center select-none"
              >
                Cancel
              </button>
              <button
                type="submit"
                onClick={handleEditAnnouncement}
                disabled={submittingEdit}
                className="flex-1 py-2 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-700 text-white cursor-pointer transition text-center flex items-center justify-center gap-1.5 select-none"
              >
                {submittingEdit && <Loader2 size={12} className="animate-spin" />}
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: View Full Notice preview details (Modal Dialog) */}
      {isDetailsOpen && selectedAnnouncement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-lg dark:bg-neutral-900 bg-surface border dark:border-neutral-800 border-border-subtle rounded-xl p-6 shadow-2xl relative animate-scale-up">
            <button
              onClick={() => setIsDetailsOpen(false)}
              className="absolute right-4 top-4 p-1 rounded dark:bg-neutral-855 bg-neutral-100 dark:hover:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-400 text-text-secondary dark:hover:text-white hover:text-text-primary transition cursor-pointer font-bold border dark:border-neutral-850 border-border-subtle"
            >
              <X size={16} />
            </button>

            <div className="space-y-1.5 pr-8 pb-4 border-b dark:border-neutral-855 border-border-subtle">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded text-[8px] font-bold border uppercase tracking-wider ${getPriorityBadgeStyle(
                    selectedAnnouncement.priority
                  )}`}
                >
                  {selectedAnnouncement.priority} Priority
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[8px] font-bold border uppercase tracking-wider ${getStatusBadgeStyle(
                    selectedAnnouncement.status
                  )}`}
                >
                  {selectedAnnouncement.status}
                </span>
                <span className="px-2 py-0.5 rounded text-[8px] font-bold border dark:border-neutral-800 border-border-subtle dark:bg-neutral-950 bg-background dark:text-neutral-400 text-text-secondary">
                  Target: {selectedAnnouncement.targetAudience}
                </span>
              </div>
              <h3 className="font-display font-bold text-lg dark:text-white text-text-primary leading-tight">
                {selectedAnnouncement.title}
              </h3>
              <div className="text-[10px] dark:text-neutral-500 text-text-muted font-mono">
                AY Context Publish: {selectedAnnouncement.publishDate} • By: {selectedAnnouncement.createdByName}
              </div>
            </div>

            <div className="py-5 max-h-[350px] overflow-y-auto pr-1">
              <p className="text-xs dark:text-neutral-300 text-text-secondary whitespace-pre-wrap leading-relaxed font-sans">
                {selectedAnnouncement.content}
              </p>
            </div>

            <div className="pt-4 border-t dark:border-neutral-850 border-border-subtle flex justify-end">
              <button
                type="button"
                onClick={() => setIsDetailsOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded dark:bg-neutral-800 bg-neutral-100 dark:hover:bg-neutral-750 hover:bg-neutral-200 dark:text-neutral-300 text-text-primary border dark:border-neutral-800 border-border-subtle cursor-pointer transition select-none"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Delete Announcement Confirmation (Modal dialog) */}
      {isDeleteOpen && selectedAnnouncement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-sm dark:bg-neutral-900 bg-surface border dark:border-neutral-800 border-border-subtle rounded-xl p-5 shadow-2xl relative animate-scale-up">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-505">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="font-display font-bold dark:text-white text-text-primary text-base">Delete Announcement</h3>
                <p className="text-[10px] text-rose-600 dark:text-rose-450 mt-0.5">Destructive administrative action.</p>
              </div>
            </div>

            {deleteError && (
              <div className="p-2.5 mb-4 rounded bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold">
                {deleteError}
              </div>
            )}

            <p className="text-xs dark:text-neutral-300 text-text-secondary leading-normal mb-6">
              Are you sure you want to delete the notice <strong className="dark:text-white text-text-primary">&quot;{selectedAnnouncement.title}&quot;</strong>? This will remove the notice from all bulletin boards and databases immediately.
            </p>

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={submittingDelete}
                onClick={() => setIsDeleteOpen(false)}
                className="flex-1 py-2 text-xs font-semibold rounded dark:bg-neutral-800 bg-neutral-100 dark:hover:bg-neutral-750 hover:bg-neutral-200 dark:text-neutral-300 text-text-primary border dark:border-neutral-800 border-border-subtle cursor-pointer transition select-none text-center"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingDelete}
                onClick={handleDeleteAnnouncement}
                className="flex-1 py-2 text-xs font-semibold rounded bg-rose-600 hover:bg-rose-500 text-white cursor-pointer transition text-center flex items-center justify-center gap-1.5 select-none"
              >
                {submittingDelete && <Loader2 size={12} className="animate-spin" />}
                <span>Delete notice</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
