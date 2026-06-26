"use client";

import React, { useState, useEffect } from "react";
import { X, Sparkles, Loader2, AlertCircle, ChevronDown } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Opportunity } from "@/types/opportunity";

interface Department {
  id: string;
  name: string;
  code: string;
}

interface OpportunityFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  opportunity: Opportunity | null;
  onSave: (payload: any) => Promise<void>;
  title: string;
  userRole: "Admin" | "Faculty";
}

export const OpportunityFormModal: React.FC<OpportunityFormModalProps> = ({
  isOpen,
  onClose,
  opportunity,
  onSave,
  title,
  userRole
}) => {
  const { accessToken } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [oppTitle, setOppTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("Internship");
  const [departmentId, setDepartmentId] = useState("");
  const [eligibleYears, setEligibleYears] = useState<string[]>([]);
  const [registrationLink, setRegistrationLink] = useState("");
  const [startDate, setStartDate] = useState("");
  const [deadline, setDeadline] = useState("");
  const [location, setLocation] = useState("");
  const [organizer, setOrganizer] = useState("");
  const [status, setStatus] = useState("Active");

  // Options
  const [departments, setDepartments] = useState<Department[]>([]);

  const opportunityTypes = [
    "Internship",
    "Job Opportunity",
    "Workshop",
    "Seminar",
    "Hackathon",
    "Competition",
    "Placement Drive",
    "College Event"
  ];

  const yearGroups = ["I Year", "II Year", "III Year", "IV Year"];

  // Fetch departments
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

  // Pre-fill form when opportunity is loaded
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isOpen) return;
      
      if (!opportunity) {
        // Reset form
        setOppTitle("");
        setDescription("");
        setType("Internship");
        setDepartmentId("");
        setEligibleYears([]);
        setRegistrationLink("");
        setStartDate("");
        setDeadline("");
        setLocation("");
        setOrganizer("");
        setStatus("Active");
        setError(null);
        return;
      }

      setOppTitle(opportunity.title || "");
      setDescription(opportunity.description || "");
      setType(opportunity.type || "Internship");
      setDepartmentId(opportunity.departmentId || "");
      setEligibleYears(opportunity.eligibleYears || []);
      setRegistrationLink(opportunity.registrationLink || "");
      
      // Format dates to YYYY-MM-DD for date picker
      setStartDate(opportunity.startDate ? opportunity.startDate.split("T")[0] : "");
      setDeadline(opportunity.deadline ? opportunity.deadline.split("T")[0] : "");
      
      setLocation(opportunity.location || "");
      setOrganizer(opportunity.organizer || "");
      setStatus(opportunity.status || "Active");
      setError(null);
    }, 0);

    return () => clearTimeout(timer);
  }, [isOpen, opportunity]);

  const handleYearToggle = (year: string) => {
    if (eligibleYears.includes(year)) {
      setEligibleYears(eligibleYears.filter((y) => y !== year));
    } else {
      setEligibleYears([...eligibleYears, year]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (!oppTitle.trim()) {
        throw new Error("Opportunity Title is required.");
      }
      if (registrationLink && !registrationLink.startsWith("http://") && !registrationLink.startsWith("https://")) {
        throw new Error("Registration Link must be a valid URL starting with http:// or https://");
      }

      // Convert date string YYYY-MM-DD to ISO DateTime String for backend validation
      const formattedStartDate = startDate ? new Date(startDate).toISOString() : null;
      const formattedDeadline = deadline ? new Date(deadline).toISOString() : null;

      if (formattedStartDate && formattedDeadline && formattedDeadline < formattedStartDate) {
        throw new Error("Deadline must be on or after the start date.");
      }

      const payload: any = {
        title: oppTitle.trim(),
        description: description.trim() || null,
        type,
        departmentId: departmentId || null,
        eligibleYears: eligibleYears.length > 0 ? eligibleYears : null,
        registrationLink: registrationLink.trim() || null,
        startDate: formattedStartDate,
        deadline: formattedDeadline,
        location: location.trim() || null,
        organizer: organizer.trim() || null,
      };

      // Only add status when editing
      if (opportunity) {
        payload.status = status;
      }

      await onSave(payload);
      onClose();
    } catch (err: any) {
      setError(err.message || "An error occurred while saving the opportunity");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-sm animate-fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0 cursor-default" onClick={onClose}></div>

      {/* Modal Dialog */}
      <div className="relative w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl p-6 overflow-y-auto max-h-[90vh] z-10 flex flex-col justify-between">
        
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
                Opportunity Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={255}
                value={oppTitle}
                onChange={(e) => setOppTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 focus:border-blue-500/50 rounded text-white focus:outline-none transition"
                placeholder="e.g. Summer Internship Program 2027"
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
                maxLength={5000}
                className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 focus:border-blue-500/50 rounded text-white focus:outline-none transition resize-none"
                placeholder="Brief summary of tasks, responsibilities, and schedule details..."
              />
            </div>

            {/* Type & Department */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
                  Type <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    required
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded text-white focus:outline-none focus:border-blue-500/50 transition appearance-none pr-8 cursor-pointer"
                  >
                    {opportunityTypes.map((t) => (
                      <option key={t} value={t}>
                        {t}
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
                  Target Department
                </label>
                <div className="relative">
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded text-white focus:outline-none focus:border-blue-500/50 transition appearance-none pr-8 cursor-pointer"
                  >
                    <option value="">All Departments</option>
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
            </div>

            {/* Eligible Years Checkboxes */}
            <div>
              <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1.5">
                Eligible Years (Leave empty for All Years)
              </label>
              <div className="flex flex-wrap gap-4">
                {yearGroups.map((year) => (
                  <label key={year} className="inline-flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={eligibleYears.includes(year)}
                      onChange={() => handleYearToggle(year)}
                      className="rounded bg-neutral-950 border-neutral-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-neutral-900 focus:ring-1"
                    />
                    <span>{year}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Organizer & Location */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
                  Organizer
                </label>
                <input
                  type="text"
                  maxLength={255}
                  value={organizer}
                  onChange={(e) => setOrganizer(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 focus:border-blue-500/50 rounded text-white focus:outline-none transition"
                  placeholder="e.g. Siemens Healthineers / CS Department"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
                  Location (if applicable)
                </label>
                <input
                  type="text"
                  maxLength={255}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 focus:border-blue-500/50 rounded text-white focus:outline-none transition"
                  placeholder="e.g. Tech Park / Virtual"
                />
              </div>
            </div>

            {/* Start Date & Deadline */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 focus:border-blue-500/50 rounded text-white focus:outline-none transition"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
                  Deadline
                </label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 focus:border-blue-500/50 rounded text-white focus:outline-none transition"
                />
              </div>
            </div>

            {/* Registration Link */}
            <div>
              <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
                Registration / Apply Link
              </label>
              <input
                type="text"
                value={registrationLink}
                onChange={(e) => setRegistrationLink(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 focus:border-blue-500/50 rounded text-white focus:outline-none transition"
                placeholder="https://example.com/apply"
              />
            </div>

            {/* Status (only when editing) */}
            {opportunity && (
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
                  Status
                </label>
                <div className="relative">
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded text-white focus:outline-none focus:border-blue-500/50 transition appearance-none pr-8 cursor-pointer"
                  >
                    <option value="Active">Active</option>
                    {userRole === "Admin" && <option value="Closed">Closed</option>}
                    <option value="Archived">Archived</option>
                  </select>
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500">
                    <ChevronDown size={14} />
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4 border-t border-neutral-800 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 text-xs font-semibold rounded bg-neutral-800 hover:bg-neutral-750 text-neutral-350 hover:text-white cursor-pointer transition text-center border border-neutral-750"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition text-center flex items-center justify-center gap-1.5"
              >
                {submitting && <Loader2 size={12} className="animate-spin" />}
                <span>Save Opportunity</span>
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
};
