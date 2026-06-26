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

interface Program {
  id: string;
  departmentId: string;
  name: string;
  code: string;
  totalSemesters: number;
  isActive: boolean;
}

interface StudentFormDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  studentId?: string | null; // If provided, we are in Edit Mode
}

export const StudentFormDrawer: React.FC<StudentFormDrawerProps> = ({
  isOpen,
  onClose,
  onSuccess,
  studentId,
}) => {
  const { accessToken } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form Fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [fullName, setFullName] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [programId, setProgramId] = useState("");
  const [semester, setSemester] = useState(1);
  const [section, setSection] = useState("");
  const [academicYear, setAcademicYear] = useState("");

  // Dropdown Options
  const [departments, setDepartments] = useState<Department[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);

  // Fetch departments
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

  // Fetch programs when departmentId changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isOpen || !departmentId) {
        setPrograms([]);
        return;
      }

      const fetchProgs = async () => {
        try {
          const res = await apiFetch(
            `/departments/programs/list?departmentId=${departmentId}`,
            {},
            accessToken
          );
          if (res.success && res.data?.programs) {
            setPrograms(res.data.programs);
          }
        } catch (err: any) {
          setError(err.message || "Failed to load programs");
        }
      };

      fetchProgs();
    }, 0);

    return () => clearTimeout(timer);
  }, [isOpen, departmentId, accessToken]);

  // Fetch student detail if editing
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isOpen || !studentId) {
        // Reset form fields for Add Mode
        setEmail("");
        setPassword("");
        setRollNumber("");
        setFullName("");
        setDepartmentId("");
        setProgramId("");
        setSemester(1);
        setSection("");
        setAcademicYear("");
        setError(null);
        return;
      }

      const fetchStudentDetail = async () => {
        try {
          setLoading(true);
          setError(null);
          const res = await apiFetch(`/students/${studentId}`, {}, accessToken);
          if (res.success && res.data?.student) {
            const s = res.data.student;
            setEmail(s.email || "");
            setRollNumber(s.rollNumber || "");
            setFullName(s.fullName || "");
            setDepartmentId(s.department?.id || "");
            setProgramId(s.program?.id || "");
            setSemester(s.semester || 1);
            setSection(s.section || "");
            setAcademicYear(s.academicYear || "");
          }
        } catch (err: any) {
          setError(err.message || "Failed to fetch student profile");
        } finally {
          setLoading(false);
        }
      };

      fetchStudentDetail();
    }, 0);

    return () => clearTimeout(timer);
  }, [isOpen, studentId, accessToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      // Validate inputs
      if (!fullName || !departmentId || !programId || !semester || !academicYear) {
        throw new Error("Please fill in all required fields.");
      }

      if (!studentId && (!email || !password || !rollNumber)) {
        throw new Error("Please fill in email, password, and roll number.");
      }

      // Format validations
      if (!/^\d{4}-\d{4}$/.test(academicYear)) {
        throw new Error("Academic Year must be in format YYYY-YYYY (e.g. 2024-2025)");
      }

      const [start, end] = academicYear.split("-").map(Number);
      if (end !== start + 1) {
        throw new Error("Academic Year years must be consecutive (e.g. 2024-2025)");
      }

      if (studentId) {
        // Edit Mode
        const payload: any = {
          fullName,
          departmentId,
          programId,
          semester,
          section: section ? section.trim().toUpperCase() : null,
          academicYear,
        };

        const res = await apiFetch(
          `/students/${studentId}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          },
          accessToken
        );

        if (res.success) {
          onSuccess(res.message || "Student updated successfully");
          onClose();
        }
      } else {
        // Add Mode
        const payload = {
          email: email.trim().toLowerCase(),
          password,
          rollNumber: rollNumber.trim().toUpperCase(),
          fullName,
          departmentId,
          programId,
          semester,
          section: section ? section.trim().toUpperCase() : undefined,
          academicYear,
        };

        const res = await apiFetch(
          "/students",
          {
            method: "POST",
            body: JSON.stringify(payload),
          },
          accessToken
        );

        if (res.success) {
          onSuccess(res.message || "Student created successfully");
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
      <div className="relative w-full max-w-md h-full bg-neutral-900 border-l border-neutral-800 p-6 flex flex-col shadow-2xl z-10 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4 mb-4">
          <h3 className="font-display font-bold text-white text-lg flex items-center gap-2">
            <Sparkles size={18} className="text-blue-500" />
            <span>{studentId ? "Edit Student Profile" : "Register Student"}</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded bg-neutral-850 hover:bg-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
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
          <div className="flex-1 flex flex-col items-center justify-center text-neutral-400 text-xs font-mono">
            <Loader2 className="animate-spin text-blue-500 mb-2" size={24} />
            <span>Loading form dependencies...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 flex-1 flex flex-col justify-between">
            <div className="space-y-4">
              {/* If Add Mode: Account credentials */}
              {!studentId && (
                <>
                  <h4 className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">Account Credentials</h4>
                  
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">Email Address <span className="text-rose-500">*</span></label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded text-white focus:outline-none focus:border-blue-600 transition"
                      placeholder="e.g. name@college.erp"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">Password <span className="text-rose-500">*</span></label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded text-white focus:outline-none focus:border-blue-600 transition"
                      placeholder="Min 8 chars, 1 upper, 1 lower, 1 digit"
                    />
                  </div>
                </>
              )}

              <h4 className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">Student Profile details</h4>

              {/* Full Name */}
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">Full Name <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded text-white focus:outline-none focus:border-blue-600 transition"
                  placeholder="e.g. Rahul Sharma"
                />
              </div>

              {/* Roll Number (Readonly in Edit Mode, since Zod schema doesn't permit rollNumber edit) */}
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">Roll Number <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  disabled={!!studentId}
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded text-white disabled:opacity-50 focus:outline-none focus:border-blue-600 transition"
                  placeholder="e.g. S2026-0045"
                />
              </div>

              {/* Department */}
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">Department <span className="text-rose-500">*</span></label>
                <select
                  required
                  value={departmentId}
                  onChange={(e) => {
                    setDepartmentId(e.target.value);
                    setProgramId(""); // Reset program select
                  }}
                  className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded text-white focus:outline-none focus:border-blue-600 transition cursor-pointer"
                >
                  <option value="">Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name} ({dept.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Program */}
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">Program <span className="text-rose-500">*</span></label>
                <select
                  required
                  disabled={!departmentId}
                  value={programId}
                  onChange={(e) => setProgramId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded text-white disabled:opacity-50 focus:outline-none focus:border-blue-600 transition cursor-pointer"
                >
                  <option value="">Select Program</option>
                  {programs.map((prog) => (
                    <option key={prog.id} value={prog.id}>
                      {prog.name} ({prog.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Semester & Section */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">Semester <span className="text-rose-500">*</span></label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={12}
                    value={semester}
                    onChange={(e) => setSemester(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded text-white focus:outline-none focus:border-blue-600 transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">Section</label>
                  <input
                    type="text"
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded text-white focus:outline-none focus:border-blue-600 transition"
                    placeholder="e.g. A"
                  />
                </div>
              </div>

              {/* Academic Year */}
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">Academic Year <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded text-white focus:outline-none focus:border-blue-600 transition"
                  placeholder="e.g. 2026-2027"
                />
                <span className="text-[9px] text-neutral-500 mt-1 block">Must be consecutive years (YYYY-YYYY).</span>
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex items-center gap-3 pt-6 border-t border-neutral-800 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 text-xs font-semibold rounded bg-neutral-800 hover:bg-neutral-750 text-neutral-300 hover:text-white cursor-pointer transition text-center"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition text-center flex items-center justify-center gap-1.5"
              >
                {submitting && <Loader2 size={12} className="animate-spin" />}
                <span>{studentId ? "Save Changes" : "Create Profile"}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
