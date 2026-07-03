"use client";

import React, { useState, useEffect } from "react";
import { X, Sparkles, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

interface Department {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

interface FacultyFormDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  facultyId?: string | null; // If provided, we are in Edit Mode
}

const DESIGNATION_OPTIONS = [
  { value: "professor", label: "Professor" },
  { value: "associate_professor", label: "Associate Professor" },
  { value: "assistant_professor", label: "Assistant Professor" },
  { value: "lecturer", label: "Lecturer" },
  { value: "hod", label: "HOD (Head of Department)" },
];

export const FacultyFormDrawer: React.FC<FacultyFormDrawerProps> = ({
  isOpen,
  onClose,
  onSuccess,
  facultyId,
}) => {
  const { accessToken } = useAuth();

  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form Fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [fullName, setFullName] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [designation, setDesignation] = useState("");

  // Dropdown Options
  const [departments, setDepartments] = useState<Department[]>([]);

  // Fetch departments on open
  useEffect(() => {
    if (!isOpen) return;

    const fetchDepts = async () => {
      try {
        setFetchingData(true);
        const res = await apiFetch("/departments", {}, accessToken);
        if (res.success && res.data?.departments) {
          setDepartments(res.data.departments);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load departments");
      } finally {
        setFetchingData(false);
      }
    };

    fetchDepts();
  }, [isOpen, accessToken]);

  // Fetch faculty detail if editing
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isOpen || !facultyId) {
        // Reset form fields for Add Mode
        setEmail("");
        setPassword("");
        setEmployeeNumber("");
        setFullName("");
        setDepartmentId("");
        setDesignation("");
        setError(null);
        return;
      }

      const fetchFacultyDetail = async () => {
        try {
          setLoading(true);
          setError(null);
          const res = await apiFetch(`/faculty/${facultyId}`, {}, accessToken);
          if (res.success && res.data?.faculty) {
            const f = res.data.faculty;
            setEmail(f.email || "");
            setEmployeeNumber(f.employeeNumber || "");
            setFullName(f.fullName || "");
            setDepartmentId(f.department?.id || "");
            setDesignation(f.designation || "");
          }
        } catch (err: any) {
          setError(err.message || "Failed to fetch faculty profile");
        } finally {
          setLoading(false);
        }
      };

      fetchFacultyDetail();
    }, 0);

    return () => clearTimeout(timer);
  }, [isOpen, facultyId, accessToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      // Basic validation
      if (!fullName || !departmentId || !designation) {
        throw new Error("Please fill in all required fields.");
      }

      if (!facultyId && (!email || !password || !employeeNumber)) {
        throw new Error("Please fill in email, password, and employee number.");
      }

      if (facultyId) {
        // Edit Mode
        const payload = {
          fullName: fullName.trim(),
          departmentId,
          designation,
        };

        const res = await apiFetch(
          `/faculty/${facultyId}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          },
          accessToken
        );

        if (res.success) {
          onSuccess(res.message || "Faculty member updated successfully");
          onClose();
        }
      } else {
        // Add Mode
        const payload = {
          email: email.trim().toLowerCase(),
          password,
          employeeNumber: employeeNumber.trim().toUpperCase(),
          fullName: fullName.trim(),
          departmentId,
          designation,
        };

        const res = await apiFetch(
          "/faculty",
          {
            method: "POST",
            body: JSON.stringify(payload),
          },
          accessToken
        );

        if (res.success) {
          onSuccess(res.message || "Faculty member created successfully");
          onClose();
        }
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-neutral-950/70 backdrop-blur-sm animate-fade-in">
      {/* Backdrop Click */}
      <div className="absolute inset-0 cursor-default" onClick={onClose}></div>

      {/* Drawer Panel */}
      <div className="relative w-full max-w-md h-full dark:bg-neutral-900 bg-surface border-l dark:border-neutral-800 border-border-subtle p-6 flex flex-col shadow-2xl z-10 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b dark:border-neutral-800 border-border-subtle pb-4 mb-4">
          <h3 className="font-display font-bold dark:text-white text-text-primary text-lg flex items-center gap-2">
            <Sparkles size={18} className="text-indigo-500" />
            <span>{facultyId ? "Edit Faculty Profile" : "Register Faculty"}</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded dark:bg-neutral-850 bg-neutral-100 dark:hover:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-400 text-text-secondary dark:hover:text-white hover:text-text-primary cursor-pointer border dark:border-neutral-800 border-border-subtle"
          >
            <X size={18} />
          </button>
        </div>

        {/* Error notification */}
        {error && (
          <div className="p-3 mb-4 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs font-semibold">
            {error}
          </div>
        )}

        {loading || fetchingData ? (
          <div className="flex-1 flex flex-col items-center justify-center dark:text-neutral-400 text-text-secondary text-xs font-mono">
            <Loader2 className="animate-spin text-indigo-500 mb-2" size={24} />
            <span>Loading form dependencies...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 flex-1 flex flex-col justify-between">
            <div className="space-y-4">
              {/* If Add Mode: Account credentials */}
              {!facultyId && (
                <>
                  <h4 className="text-[10px] uppercase font-bold dark:text-neutral-500 text-text-muted tracking-wider">Account Credentials</h4>
                  
                  <div>
                    <label className="block text-[10px] font-bold dark:text-neutral-400 text-text-secondary uppercase mb-1">Email Address <span className="text-rose-500">*</span></label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 text-xs dark:bg-neutral-950 bg-background border dark:border-neutral-800 border-border-subtle rounded dark:text-white text-text-primary focus:outline-none focus:border-indigo-600 transition"
                      placeholder="name@college.erp"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold dark:text-neutral-400 text-text-secondary uppercase mb-1">Password <span className="text-rose-500">*</span></label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3 py-2 text-xs dark:bg-neutral-950 bg-background border dark:border-neutral-800 border-border-subtle rounded dark:text-white text-text-primary focus:outline-none focus:border-indigo-600 transition"
                      placeholder="Min 8 chars, 1 upper, 1 lower, 1 digit"
                    />
                  </div>
                </>
              )}

              <h4 className="text-[10px] uppercase font-bold dark:text-neutral-500 text-text-muted tracking-wider">Faculty details</h4>

              {/* Full Name */}
              <div>
                <label className="block text-[10px] font-bold dark:text-neutral-400 text-text-secondary uppercase mb-1">Full Name <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 text-xs dark:bg-neutral-955 bg-background border dark:border-neutral-800 border-border-subtle rounded dark:text-white text-text-primary focus:outline-none focus:border-indigo-600 transition"
                  placeholder="e.g. Dr. Amit Verma"
                />
              </div>

              {/* Employee Number (Readonly in Edit Mode) */}
              <div>
                <label className="block text-[10px] font-bold dark:text-neutral-400 text-text-secondary uppercase mb-1">Employee Number <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  disabled={!!facultyId}
                  value={employeeNumber}
                  onChange={(e) => setEmployeeNumber(e.target.value)}
                  className="w-full px-3 py-2 text-xs dark:bg-neutral-955 bg-background border dark:border-neutral-800 border-border-subtle rounded dark:text-white text-text-primary disabled:opacity-50 focus:outline-none focus:border-indigo-600 transition"
                  placeholder="e.g. EMP-1045"
                />
              </div>

              {/* Department */}
              <div>
                <label className="block text-[10px] font-bold dark:text-neutral-400 text-text-secondary uppercase mb-1">Department <span className="text-rose-500">*</span></label>
                <select
                  required
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full px-3 py-2 text-xs dark:bg-neutral-955 bg-background border dark:border-neutral-800 border-border-subtle rounded dark:text-white text-text-primary focus:outline-none focus:border-indigo-600 transition cursor-pointer"
                >
                  <option value="">Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name} ({dept.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Designation */}
              <div>
                <label className="block text-[10px] font-bold dark:text-neutral-400 text-text-secondary uppercase mb-1">Designation <span className="text-rose-500">*</span></label>
                <select
                  required
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  className="w-full px-3 py-2 text-xs dark:bg-neutral-955 bg-background border dark:border-neutral-800 border-border-subtle rounded dark:text-white text-text-primary focus:outline-none focus:border-indigo-600 transition cursor-pointer"
                >
                  <option value="">Select Designation</option>
                  {DESIGNATION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex items-center gap-3 pt-6 border-t dark:border-neutral-800 border-border-subtle mt-6">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 text-xs font-semibold rounded dark:bg-neutral-800 bg-neutral-100 dark:hover:bg-neutral-750 hover:bg-neutral-200 dark:text-neutral-300 text-text-primary border dark:border-neutral-800 border-border-subtle cursor-pointer transition text-center"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2 text-xs font-semibold rounded bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer transition text-center flex items-center justify-center gap-1.5"
              >
                {submitting && <Loader2 size={12} className="animate-spin" />}
                <span>{facultyId ? "Save Changes" : "Create Profile"}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
