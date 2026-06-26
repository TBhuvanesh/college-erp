"use client";
import React, { useState, useEffect } from "react";
import { X, Sparkles, Loader2, AlertCircle, ChevronDown } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

interface Department {
  id: string;
  name: string;
  code: string;
}

interface EventFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Can be ParsedEvent or AcademicCalendarEvent
  event: any | null; 
  onSave: (payload: any) => Promise<void>;
  title: string;
}

export const EventFormModal: React.FC<EventFormModalProps> = ({
  isOpen,
  onClose,
  event,
  onSave,
  title
}) => {
  const { accessToken } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [eventTitle, setEventTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [eventType, setEventType] = useState("Other");
  const [targetAudience, setTargetAudience] = useState("All");
  const [departmentId, setDepartmentId] = useState("");
  const [semester, setSemester] = useState("");

  // Options
  const [departments, setDepartments] = useState<Department[]>([]);

  // Event types matching the backend enum
  const eventTypes = [
    "Class Commencement",
    "Mid-Term Examination",
    "End Semester Examination",
    "Lab Examination",
    "Internal Assessment",
    "Holiday",
    "Supplementary Examination",
    "Academic Activity",
    "Other"
  ];

  // Target audiences matching backend enum
  const targetAudiences = [
    "All",
    "Students",
    "Faculty",
    "I Year",
    "II Year",
    "III Year",
    "IV Year"
  ];

  // Load departments
  useEffect(() => {
    if (!isOpen) return;

    const fetchDepts = async () => {
      try {
        setLoading(true);
        const res = await apiFetch("/departments", {}, accessToken);
        if (res.success && res.data?.departments) {
          setDepartments(res.data.departments);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load departments");
      } finally {
        setLoading(false);
      }
    };

    fetchDepts();
  }, [isOpen, accessToken]);

  // Pre-fill form when event is loaded
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isOpen || !event) {
        // Reset fields
        setEventTitle("");
        setDescription("");
        setStartDate("");
        setEndDate("");
        setEventType("Other");
        setTargetAudience("All");
        setDepartmentId("");
        setSemester("");
        setError(null);
        return;
      }

      setEventTitle(event.title || "");
      setDescription(event.description || "");
      setStartDate(event.startDate || "");
      setEndDate(event.endDate || "");
      setEventType(event.eventType || "Other");
      setTargetAudience(event.targetAudience || "All");
      setDepartmentId(event.departmentId || "");
      setSemester(event.semester !== null && event.semester !== undefined ? event.semester.toString() : "");
      setError(null);
    }, 0);

    return () => clearTimeout(timer);
  }, [isOpen, event]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (!eventTitle.trim()) {
        throw new Error("Title is required.");
      }
      if (!startDate) {
        throw new Error("Start date is required.");
      }
      if (endDate && endDate < startDate) {
        throw new Error("End date must be on or after start date.");
      }

      // Format payload
      const payload: any = {
        title: eventTitle.trim(),
        description: description.trim() || null,
        startDate,
        endDate: endDate || null,
        eventType,
        targetAudience,
        departmentId: departmentId || null,
        semester: semester ? parseInt(semester, 10) : null
      };

      await onSave(payload);
      onClose();
    } catch (err: any) {
      setError(err.message || "An error occurred while saving the event");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-sm animate-fade-in">
      {/* Backdrop click close */}
      <div className="absolute inset-0 cursor-default" onClick={onClose}></div>

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl p-6 overflow-y-auto max-h-[90vh] z-10 flex flex-col justify-between">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-4">
          <h3 className="font-display font-bold text-white text-base flex items-center gap-2">
            <Sparkles size={16} className="text-blue-500" />
            <span>{title}</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded bg-neutral-850 hover:bg-neutral-800 text-neutral-450 hover:text-white cursor-pointer transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="p-3 mb-4 rounded bg-rose-500/10 border border-rose-500/20 text-rose-450 text-xs font-semibold flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-neutral-500 text-xs font-mono">
            <Loader2 className="animate-spin text-blue-500 mb-2" size={24} />
            <span>Loading dependencies...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Title */}
            <div>
              <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
                Event Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={500}
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded text-white focus:outline-none focus:border-blue-600 transition"
                placeholder="e.g. Commencement of B.Tech II Sem Instruction"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
                Description / Details
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={2000}
                className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded text-white focus:outline-none focus:border-blue-600 transition resize-none"
                placeholder="Details about locations, regulations, syllabus coverage..."
              />
            </div>

            {/* Dates Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
                  Start Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded text-white focus:outline-none focus:border-blue-600 transition"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded text-white focus:outline-none focus:border-blue-600 transition"
                />
              </div>
            </div>

            {/* Event Type & Target Audience */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
                  Event Category (DB) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    required
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded text-white focus:outline-none focus:border-blue-600 transition appearance-none pr-8 cursor-pointer"
                  >
                    {eventTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500">
                    <ChevronDown size={14} />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
                  Target Audience <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    required
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded text-white focus:outline-none focus:border-blue-600 transition appearance-none pr-8 cursor-pointer"
                  >
                    {targetAudiences.map((aud) => (
                      <option key={aud} value={aud}>
                        {aud}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500">
                    <ChevronDown size={14} />
                  </div>
                </div>
              </div>
            </div>

            {/* Department & Semester */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
                  Department Specificity
                </label>
                <div className="relative">
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded text-white focus:outline-none focus:border-blue-600 transition appearance-none pr-8 cursor-pointer"
                  >
                    <option value="">Institution-Wide (All)</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name} ({dept.code})
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500">
                    <ChevronDown size={14} />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
                  Semester Specificity
                </label>
                <div className="relative">
                  <select
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded text-white focus:outline-none focus:border-blue-600 transition appearance-none pr-8 cursor-pointer"
                  >
                    <option value="">All Semesters</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((sem) => (
                      <option key={sem} value={sem.toString()}>
                        Semester {sem}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500">
                    <ChevronDown size={14} />
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4 border-t border-neutral-800 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 text-xs font-semibold rounded bg-neutral-800 hover:bg-neutral-750 text-neutral-350 hover:text-white cursor-pointer transition text-center"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition text-center flex items-center justify-center gap-1.5"
              >
                {submitting && <Loader2 size={12} className="animate-spin" />}
                <span>Save Event</span>
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
};
