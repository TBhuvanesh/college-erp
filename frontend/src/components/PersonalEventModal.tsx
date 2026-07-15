"use client";

import React, { useState, useEffect } from "react";
import { X, Sparkles, Loader2, AlertCircle, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

interface Department {
  id: string;
  name: string;
  code: string;
}

interface PersonalEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  // If set, we are editing this existing event
  eventToEdit?: any | null; 
  onSaveSuccess: () => void;
  role: "admin" | "faculty" | "student";
}

export const PersonalEventModal: React.FC<PersonalEventModalProps> = ({
  isOpen,
  onClose,
  eventToEdit,
  onSaveSuccess,
  role,
}) => {
  const { accessToken } = useAuth();
  
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deptsLoading, setDeptsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [eventType, setEventType] = useState("Reminder");
  const [customTypeLabel, setCustomTypeLabel] = useState("");
  const [visibility, setVisibility] = useState("personal");
  const [departmentId, setDepartmentId] = useState("");
  const [semester, setSemester] = useState("");

  // Student categories mapping
  const studentTypes = [
    { label: "Study Reminder", value: "Reminder" },
    { label: "Project Deadline", value: "Reminder" },
    { label: "Personal Task", value: "Other" },
  ];

  // Faculty categories mapping
  const facultyTypes = [
    { label: "Evaluation Deadline", value: "Reminder" },
    { label: "Meeting Reminder", value: "Meeting" },
    { label: "Teaching Task", value: "Reminder" },
    { label: "Other", value: "Other" },
  ];

  // Admin categories mapping
  const adminTypes = [
    { label: "Admin Task", value: "Reminder" },
    { label: "Meeting", value: "Meeting" },
    { label: "Deadline", value: "Reminder" },
    { label: "Other", value: "Other" },
  ];

  const getTypesList = () => {
    if (role === "student") return studentTypes;
    if (role === "admin") return adminTypes;
    return facultyTypes;
  };

  // Load departments (for faculty scoping)
  useEffect(() => {
    if (!isOpen || role === "student") return;

    const fetchDepts = async () => {
      try {
        setDeptsLoading(true);
        const res = await apiFetch("/departments", {}, accessToken);
        if (res.success && res.data?.departments) {
          setDepartments(res.data.departments);
        }
      } catch (err: any) {
        console.error("Failed to load departments", err);
      } finally {
        setDeptsLoading(false);
      }
    };

    fetchDepts();
  }, [isOpen, role, accessToken]);

  // Pre-fill form when event is editing
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isOpen) return;

      if (eventToEdit) {
        setTitle(eventToEdit.title || "");
        setDescription(eventToEdit.description || "");
        
        // Convert UTC date to local datetime-local format (YYYY-MM-DDTHH:MM)
        if (eventToEdit.startDate) {
          const d = new Date(eventToEdit.startDate);
          const localISO = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
          setStartDate(localISO);
        } else {
          setStartDate("");
        }

        if (eventToEdit.endDate) {
          const d = new Date(eventToEdit.endDate);
          const localISO = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
          setEndDate(localISO);
        } else {
          setEndDate("");
        }

        setEventType(eventToEdit.eventType || "Reminder");
        setVisibility(eventToEdit.visibility || "personal");
        setDepartmentId(eventToEdit.departmentId || "");
        setSemester(eventToEdit.semester !== null && eventToEdit.semester !== undefined ? eventToEdit.semester.toString() : "");
        
        // Parse custom type label if hidden in description or matching standard
        setCustomTypeLabel("");
      } else {
        // Reset defaults
        setTitle("");
        setDescription("");
        
        // Set default start time to today next hour
        const now = new Date();
        now.setMinutes(0);
        now.setHours(now.getHours() + 1);
        const localISO = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        setStartDate(localISO);
        setEndDate("");
        
        const defaultTypes = getTypesList();
        setEventType(defaultTypes[0]?.value || "Reminder");
        setCustomTypeLabel(defaultTypes[0]?.label || "");
        setVisibility("personal");
        setDepartmentId("");
        setSemester("");
      }
      setError(null);
    }, 0);

    return () => clearTimeout(timer);
  }, [isOpen, eventToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!startDate) {
      setError("Start date & time are required.");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      // Setup dates (convert local input to full ISO UTC string for API validation)
      const startIso = new Date(startDate).toISOString();
      const endIso = endDate ? new Date(endDate).toISOString() : null;

      if (endDate && endDate < startDate) {
        throw new Error("End date must be on or after start date.");
      }

      // Format payload matching CreateCalendarEntryInput schema
      const payload: any = {
        title: customTypeLabel ? `[${customTypeLabel}] ${title.trim()}` : title.trim(),
        description: description.trim() || null,
        startDate: startIso,
        endDate: endIso,
        eventType,
        visibility: role === "student" ? "personal" : visibility,
        departmentId: role === "faculty" && (visibility === "department" || visibility === "semester") ? (departmentId || null) : null,
        semester: role === "faculty" && visibility === "semester" ? (semester ? parseInt(semester, 10) : null) : null,
      };

      let res;
      if (eventToEdit) {
        res = await apiFetch(`/calendar-entries/${eventToEdit.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        }, accessToken);
      } else {
        res = await apiFetch("/calendar-entries", {
          method: "POST",
          body: JSON.stringify(payload),
        }, accessToken);
      }

      if (res.success) {
        onSaveSuccess();
        onClose();
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while saving the event.");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete handler
  const handleDelete = async () => {
    if (!eventToEdit) return;
    if (!confirm("Are you sure you want to delete this event? This action cannot be undone.")) return;

    setError(null);
    setSubmitting(true);

    try {
      const res = await apiFetch(`/calendar-entries/${eventToEdit.id}`, {
        method: "DELETE",
      }, accessToken);

      if (res.success) {
        onSaveSuccess();
        onClose();
      }
    } catch (err: any) {
      setError(err.message || "Failed to delete the event.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-955/80 dark:bg-neutral-950/80 backdrop-blur-sm animate-fade-in">
      <div className="absolute inset-0 cursor-default" onClick={onClose}></div>

      <div className="relative w-full max-w-md dark:bg-neutral-900 bg-surface border dark:border-neutral-800 border-border-subtle rounded-xl shadow-2xl p-5 z-10 flex flex-col justify-between max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b dark:border-neutral-800 border-border-subtle pb-3 mb-4">
          <h3 className="font-display font-bold dark:text-white text-text-primary text-sm flex items-center gap-2">
            <Sparkles size={15} className="text-blue-500" />
            <span>{eventToEdit ? "Edit Calendar Task" : "Add Personal Task / Reminder"}</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded dark:bg-neutral-850 bg-neutral-100 dark:hover:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-450 text-text-secondary dark:hover:text-white hover:text-text-primary cursor-pointer border dark:border-neutral-850 border-border-subtle transition"
          >
            <X size={15} />
          </button>
        </div>

        {/* Errors */}
        {error && (
          <div className="p-3 mb-4 rounded bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs font-semibold flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Custom label type selector */}
          <div>
            <label className="block text-[10px] font-bold dark:text-neutral-450 text-text-secondary uppercase mb-1">
              Event Subcategory <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {getTypesList().map((t) => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => {
                    setEventType(t.value);
                    setCustomTypeLabel(t.label);
                  }}
                  className={`py-1.5 px-2.5 rounded text-[10px] font-bold border transition text-center cursor-pointer ${
                    customTypeLabel === t.label
                      ? "bg-blue-600 border-blue-500 text-white font-extrabold"
                      : "dark:bg-neutral-950 bg-background dark:border-neutral-800 border-border-subtle dark:text-neutral-400 text-text-secondary dark:hover:text-neutral-200 hover:text-text-primary"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-[10px] font-bold dark:text-neutral-450 text-text-secondary uppercase mb-1">
              Event Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Midterm prep, grading deadline, project checkin"
              value={title.replace(/^\[.*?\]\s*/, "")} // Remove prefixed label if editing
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs dark:bg-neutral-950 bg-background border dark:border-neutral-800 border-border-subtle rounded dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] font-bold dark:text-neutral-450 text-text-secondary uppercase mb-1">
              Description / Notes
            </label>
            <textarea
              rows={2}
              placeholder="Add details, links, room numbers, etc."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-xs dark:bg-neutral-950 bg-background border dark:border-neutral-800 border-border-subtle rounded dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition resize-none"
            />
          </div>

          {/* Start and End Date-time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold dark:text-neutral-450 text-text-secondary uppercase mb-1">
                Start Date & Time <span className="text-rose-500">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs dark:bg-neutral-950 bg-background border dark:border-neutral-800 border-border-subtle rounded dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold dark:text-neutral-450 text-text-secondary uppercase mb-1">
                End Date & Time
              </label>
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs dark:bg-neutral-950 bg-background border dark:border-neutral-800 border-border-subtle rounded dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition"
              />
            </div>
          </div>

          {/* Faculty/Admin scopes (Visibility / Semester / Dept) */}
          {(role === "faculty" || role === "admin") && (
            <div className="space-y-3.5 border-t dark:border-neutral-850 border-border-subtle pt-3">
              <div>
                <label className="block text-[10px] font-bold dark:text-neutral-450 text-text-secondary uppercase mb-1">
                  Scope Visibility
                </label>
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs dark:bg-neutral-950 bg-background border dark:border-neutral-800 border-border-subtle rounded dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition"
                >
                  <option value="personal">Only Me (Personal)</option>
                  <option value="faculty">All Faculty Members</option>
                  <option value="student">All Students</option>
                  {role === "admin" && <option value="institution_wide">Institution Wide</option>}
                  {role === "faculty" && <option value="department">My Department Specific</option>}
                  {role === "faculty" && <option value="semester">Semester & Department Specific</option>}
                </select>
              </div>

              {role === "faculty" && visibility === "semester" && (
                <div>
                  <label className="block text-[10px] font-bold dark:text-neutral-455 text-text-secondary uppercase mb-1">
                    Target Semester
                  </label>
                  <select
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    required
                    className="w-full px-2.5 py-1.5 text-xs dark:bg-neutral-955 bg-background border dark:border-neutral-800 border-border-subtle rounded dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition"
                  >
                    <option value="">Select Semester</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <option key={s} value={s.toString()}>
                        Semester {s}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Action triggers */}
          <div className="flex items-center justify-between border-t dark:border-neutral-800 border-border-subtle pt-4 mt-4">
            {eventToEdit ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={submitting}
                className="px-3 py-2 rounded bg-rose-500/10 border border-rose-500/20 text-rose-450 hover:bg-rose-600 hover:text-white transition text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Trash2 size={13} />
                <span>Delete</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-3 py-2 rounded dark:bg-neutral-950 bg-neutral-100 dark:hover:bg-neutral-800 hover:bg-neutral-200 border dark:border-neutral-850 border-border-subtle dark:text-neutral-400 text-text-primary transition text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white transition text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-600/15"
              >
                {submitting && <Loader2 size={13} className="animate-spin" />}
                <span>{eventToEdit ? "Save Changes" : "Create Event"}</span>
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};
