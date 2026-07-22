"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import {
  BookOpen,
  Users,
  Layers,
  ArrowLeft,
  Calendar,
  FileText,
  Bookmark,
  CheckCircle,
  HelpCircle,
  AlertCircle,
  Plus,
  Edit,
  Trash2,
  X,
  Loader2,
  Building,
  Check
} from "lucide-react";

export default function SubjectProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const { accessToken, user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Mappings Form / Modal States
  const [departments, setDepartments] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [showMappingModal, setShowMappingModal] = useState<boolean>(false);
  const [editingMappingId, setEditingMappingId] = useState<string | null>(null);
  const [formDeptId, setFormDeptId] = useState("");
  const [formProgId, setFormProgId] = useState("");
  const [formProgramText, setFormProgramText] = useState("");
  const [formRegulation, setFormRegulation] = useState("R22");
  const [formYear, setFormYear] = useState("I");
  const [formSemRaw, setFormSemRaw] = useState("I");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchProfile = async () => {
    if (!id || !accessToken) return;
    try {
      const res = await apiFetch(`/subject-allocations/subject/${id}/profile`, {}, accessToken);
      if (res.success && res.data?.profile) {
        setProfile(res.data.profile);
      } else {
        setError(res.message || "Failed to load subject details.");
      }
    } catch (err: any) {
      setError("Error loading subject profile.");
    } finally {
      setLoading(false);
    }
  };

  const fetchDeptsAndProgs = async () => {
    if (!accessToken) return;
    try {
      const [deptRes, progRes] = await Promise.all([
        apiFetch("/departments", {}, accessToken),
        apiFetch("/programs", {}, accessToken),
      ]);
      if (deptRes.success) setDepartments(deptRes.data?.departments || []);
      if (progRes.success) setPrograms(progRes.data?.programs || []);
    } catch (err) {
      console.error("Error loading dropdown data:", err);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchProfile();
    fetchDeptsAndProgs();
  }, [id, accessToken]);

  const openAddMappingModal = () => {
    setEditingMappingId(null);
    setFormDeptId(departments[0]?.id || "");
    setFormProgId("");
    setFormProgramText("");
    setFormRegulation("R22");
    setFormYear("I");
    setFormSemRaw("I");
    setFormError(null);
    setShowMappingModal(true);
  };

  const openEditMappingModal = (mapping: any) => {
    setEditingMappingId(mapping.id);
    setFormDeptId(mapping.departmentId);
    setFormProgId(mapping.programId || "");
    setFormProgramText(mapping.program || "");
    setFormRegulation(mapping.regulation || "R22");
    setFormYear(mapping.year || "I");
    setFormSemRaw(mapping.semesterRaw || "I");
    setFormError(null);
    setShowMappingModal(true);
  };

  const handleSaveMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDeptId) return setFormError("Department is required");
    setFormSubmitting(true);
    setFormError(null);

    const payload = {
      departmentId: formDeptId,
      programId: formProgId || null,
      program: formProgramText.trim() || null,
      regulation: formRegulation.trim(),
      year: formYear,
      semesterRaw: formSemRaw,
    };

    try {
      let res;
      if (editingMappingId) {
        res = await apiFetch(`/subjects/mappings/${editingMappingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        }, accessToken);
      } else {
        res = await apiFetch(`/subjects/${id}/mappings`, {
          method: "POST",
          body: JSON.stringify(payload),
        }, accessToken);
      }

      if (res.success && res.data?.subject) {
        showToast(editingMappingId ? "Curriculum mapping updated" : "Curriculum mapping added");
        setShowMappingModal(false);
        // Refresh profile data
        fetchProfile();
      } else {
        setFormError(res.message || "Failed to save curriculum mapping.");
      }
    } catch (err) {
      console.error(err);
      setFormError("Server error occurred.");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleRemoveMapping = async (mappingId: string) => {
    if (!confirm("Are you sure you want to remove this curriculum mapping? This will dissociate the subject from this department's curriculum list.")) return;
    try {
      const res = await apiFetch(`/subjects/mappings/${mappingId}`, {
        method: "DELETE",
      }, accessToken);
      if (res.success) {
        showToast("Curriculum mapping removed successfully");
        fetchProfile();
      } else {
        showToast(res.message || "Failed to remove mapping", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Server error during removal.", "error");
    }
  };

  if (loading) {
    return (
      <div className="p-20 flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-indigo-500" size={32} />
        <span className="text-xs text-text-secondary">Loading subject profile metrics...</span>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-all font-semibold"
        >
          <ArrowLeft size={14} />
          <span>Go Back</span>
        </button>
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-xl flex items-center gap-3">
          <AlertCircle size={16} />
          <span>{error || "Unable to display subject profile details."}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-lg border text-xs font-semibold shadow-lg transition-all animate-bounce ${
          toast.type === "success" 
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
            : "bg-rose-500/10 border-rose-500/20 text-rose-400"
        }`}>
          {toast.type === "success" ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header back bar */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-all font-semibold"
      >
        <ArrowLeft size={14} />
        <span>Back to Catalog Dashboard</span>
      </button>

      {/* Title */}
      <div>
        <span className="text-[9px] uppercase font-bold text-indigo-500 tracking-wider font-mono">
          Course Catalog Profile
        </span>
        <h2 className="font-display font-bold text-2xl dark:text-white text-text-primary mt-1">
          {profile.name}
        </h2>
        <p className="text-xs dark:text-neutral-400 text-text-secondary mt-0.5 font-mono">
          Code: {profile.code} • System ID: {profile.id.toUpperCase()}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Details and Sections (2 Columns) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Details Overview Card */}
          <div className="glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl p-5 space-y-6">
            <h3 className="font-display font-bold text-sm dark:text-white text-text-primary flex items-center gap-2 border-b dark:border-neutral-800 border-border-subtle pb-3">
              <Bookmark size={14} className="text-indigo-400" />
              <span>Academic Parameters</span>
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-xs">
              <div>
                <span className="text-[10px] text-text-muted uppercase font-bold block">L - T - P Structure</span>
                <span className="font-semibold text-text-primary block mt-1.5">
                  {profile.lectureHours} - {profile.tutorialHours} - {profile.practicalHours}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-text-muted uppercase font-bold block">Academic Credits</span>
                <span className="font-semibold text-text-primary block mt-1.5">{profile.credits} Credits</span>
              </div>
              <div>
                <span className="text-[10px] text-text-muted uppercase font-bold block">Enrolled Students</span>
                <span className="font-semibold text-text-primary block mt-1.5">{profile.studentsEnrolled} Enrolled</span>
              </div>
              <div>
                <span className="text-[10px] text-text-muted uppercase font-bold block">Catalog Status</span>
                <span className={`inline-flex px-2 py-0.5 rounded text-[9px] mt-1.5 font-bold uppercase border ${
                  profile.status === "active"
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                }`}>
                  {profile.status}
                </span>
              </div>
            </div>

            {profile.description && (
              <div className="border-t dark:border-neutral-800 border-border-subtle pt-4 text-xs text-text-secondary leading-relaxed">
                <span className="text-[10px] text-text-muted uppercase font-bold block mb-1">Subject Syllabus Description</span>
                <p className="dark:text-neutral-300 text-text-primary font-normal">{profile.description}</p>
              </div>
            )}
          </div>

          {/* Curriculum Mappings Section */}
          <div className="glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b dark:border-neutral-800 border-border-subtle pb-3">
              <h3 className="font-display font-bold text-sm dark:text-white text-text-primary flex items-center gap-2">
                <Layers size={14} className="text-indigo-400" />
                <span>Curriculum Mappings ({profile.mappings?.length || 0})</span>
              </h3>
              {isAdmin && (
                <button
                  onClick={openAddMappingModal}
                  className="px-2.5 py-1 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold uppercase hover:bg-indigo-500/25 transition-all flex items-center gap-1"
                >
                  <Plus size={10} />
                  <span>Add Mapping</span>
                </button>
              )}
            </div>

            {!profile.mappings || profile.mappings.length === 0 ? (
              <div className="py-6 text-center text-xs text-text-muted border border-dashed dark:border-neutral-800 border-border-subtle rounded-lg">
                This subject has no academic department curriculum mappings. Mappings are required to assign instructors or log parameters.
              </div>
            ) : (
              <div className="overflow-hidden border dark:border-neutral-800 border-border-subtle rounded-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b dark:border-neutral-800 border-border-subtle dark:bg-neutral-900 bg-neutral-50 text-[10px] uppercase font-bold text-text-muted">
                      <th className="p-3">Department</th>
                      <th className="p-3">Program / Scheme</th>
                      <th className="p-3">Regulation</th>
                      <th className="p-3">Placement (Year/Sem)</th>
                      {isAdmin && <th className="p-3 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-neutral-800/80 divide-border-subtle">
                    {profile.mappings.map((m: any) => (
                      <tr key={m.id} className="hover:dark:bg-neutral-900/10 hover:bg-neutral-50/20">
                        <td className="p-3 font-semibold dark:text-white text-text-primary">
                          {m.departmentName} ({m.departmentCode})
                        </td>
                        <td className="p-3 font-mono text-text-secondary">
                          {m.programName || "—"}
                        </td>
                        <td className="p-3 font-mono text-text-secondary">{m.regulation}</td>
                        <td className="p-3 text-text-secondary">
                          Year {m.year} • Sem {m.semesterRaw || "N/A"} (Sem {m.semester})
                        </td>
                        {isAdmin && (
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => openEditMappingModal(m)}
                                className="p-1 rounded hover:bg-amber-500/10 text-amber-400"
                                title="Edit Mapping"
                              >
                                <Edit size={12} />
                              </button>
                              <button
                                onClick={() => handleRemoveMapping(m.id)}
                                className="p-1 rounded hover:bg-rose-500/10 text-rose-400"
                                title="Remove Mapping"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Assigned Faculty list */}
          <div className="glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl p-5">
            <h3 className="font-display font-bold text-sm dark:text-white text-text-primary mb-4 flex items-center gap-2">
              <Users size={14} className="text-indigo-400" />
              <span>Assigned Teaching Faculty</span>
            </h3>

            {profile.assignedFaculty.length === 0 ? (
              <div className="py-6 text-center text-xs text-text-muted border border-dashed dark:border-neutral-800 border-border-subtle rounded-lg">
                No faculty allocations are mapped to this subject. Assign instructors in the Subject Allocation dashboard.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {profile.assignedFaculty.map((f: any) => (
                  <div
                    key={f.allocationId}
                    className="p-4 border dark:border-neutral-800 border-border-subtle dark:bg-neutral-950/40 bg-neutral-50/50 rounded-lg flex items-center justify-between hover:border-indigo-500/30 transition-all"
                  >
                    <div>
                      <span className="font-bold text-xs dark:text-white text-text-primary">{f.facultyName}</span>
                      <p className="text-[10px] text-text-secondary mt-0.5 font-mono">ID: {f.employeeNumber}</p>
                      <p className="text-[10px] text-text-muted mt-1">Session: {f.academicYear}</p>
                    </div>
                    <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full px-2.5 py-0.5 font-bold uppercase">
                      Section {f.section}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Integration Statuses (1 Column) */}
        <div className="space-y-6">
          
          <div className="glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl p-5">
            <h3 className="font-display font-bold text-sm dark:text-white text-text-primary mb-4 flex items-center gap-2">
              <Layers size={14} className="text-indigo-400" />
              <span>Module Integrations</span>
            </h3>

            <div className="space-y-4">
              
              {/* Attendance Integration */}
              <div className="p-3 border dark:border-neutral-800 border-border-subtle dark:bg-neutral-900/30 bg-neutral-50/20 rounded-lg">
                <div className="flex items-center gap-2 text-xs">
                  <Calendar size={14} className="text-text-muted" />
                  <span className="font-semibold text-text-secondary">Attendance Logs</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px]">
                  <span className="text-text-muted">Ledger State</span>
                  <span className="font-bold dark:text-white text-text-primary">{profile.attendanceStatus}</span>
                </div>
              </div>

              {/* LMS Integration */}
              <div className="p-3 border dark:border-neutral-800 border-border-subtle dark:bg-neutral-900/30 bg-neutral-50/20 rounded-lg">
                <div className="flex items-center gap-2 text-xs">
                  <BookOpen size={14} className="text-text-muted" />
                  <span className="font-semibold text-text-secondary">LMS Classroom Materials</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px]">
                  <span className="text-text-muted">Classroom Space</span>
                  <span className="font-bold dark:text-white text-text-primary">{profile.lmsStatus}</span>
                </div>
              </div>

              {/* Internal Marks Integration */}
              <div className="p-3 border dark:border-neutral-800 border-border-subtle dark:bg-neutral-900/30 bg-neutral-50/20 rounded-lg">
                <div className="flex items-center gap-2 text-xs">
                  <FileText size={14} className="text-text-muted" />
                  <span className="font-semibold text-text-secondary">Internal Grades Ledger</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px]">
                  <span className="text-text-muted">Gradebook Status</span>
                  <span className="font-bold dark:text-white text-text-primary">{profile.internalMarksStatus}</span>
                </div>
              </div>

            </div>

          </div>

        </div>

      </div>

      {/* Modal: Add/Edit Curriculum Mapping */}
      {showMappingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md dark:bg-neutral-950 bg-white border dark:border-neutral-800 border-border-subtle rounded-xl shadow-2xl overflow-hidden text-xs">
            <div className="p-5 border-b dark:border-neutral-800 border-border-subtle flex items-center justify-between">
              <h3 className="font-display font-bold text-base dark:text-white text-text-primary">
                {editingMappingId ? "Edit Curriculum Mapping" : "Add Curriculum Mapping"}
              </h3>
              <button
                onClick={() => setShowMappingModal(false)}
                className="p-1 text-text-muted hover:text-text-primary transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveMapping}>
              <div className="p-5 space-y-4">
                {formError && (
                  <div className="p-3 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 font-semibold flex items-center gap-2">
                    <AlertCircle size={14} />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Department Selection */}
                <div>
                  <label className="text-[10px] text-text-muted uppercase font-bold block mb-1">Department *</label>
                  <select
                    value={formDeptId}
                    required
                    onChange={(e) => setFormDeptId(e.target.value)}
                    className="w-full p-2 border dark:border-neutral-800 border-border-subtle rounded-lg dark:bg-neutral-900 bg-background text-text-primary"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                    ))}
                  </select>
                </div>

                {/* Program match */}
                <div>
                  <label className="text-[10px] text-text-muted uppercase font-bold block mb-1">Program / Scheme Name</label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={formProgId}
                      onChange={(e) => {
                        setFormProgId(e.target.value);
                        const progObj = programs.find(p => p.id === e.target.value);
                        if (progObj) setFormProgramText(progObj.code);
                      }}
                      className="p-2 border dark:border-neutral-800 border-border-subtle rounded-lg dark:bg-neutral-900 bg-background text-text-primary text-[11px]"
                    >
                      <option value="">Database Match</option>
                      {programs.map((p) => (
                        <option key={p.id} value={p.id}>{p.code}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Or type free-text..."
                      value={formProgramText}
                      onChange={(e) => setFormProgramText(e.target.value)}
                      className="p-2 border dark:border-neutral-800 border-border-subtle rounded-lg dark:bg-neutral-900 bg-background text-text-primary"
                    />
                  </div>
                </div>

                {/* Regulation */}
                <div>
                  <label className="text-[10px] text-text-muted uppercase font-bold block mb-1">Regulation *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. R22"
                    value={formRegulation}
                    onChange={(e) => setFormRegulation(e.target.value)}
                    className="w-full p-2 border dark:border-neutral-800 border-border-subtle rounded-lg dark:bg-neutral-900 bg-background text-text-primary font-semibold"
                  />
                </div>

                {/* Year / Semester */}
                <div>
                  <label className="text-[10px] text-text-muted uppercase font-bold block mb-1">Placement (Year / Semester) *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={formYear}
                      onChange={(e) => setFormYear(e.target.value)}
                      className="p-2 border dark:border-neutral-800 border-border-subtle rounded-lg dark:bg-neutral-900 bg-background text-text-primary"
                    >
                      <option value="I">Year I</option>
                      <option value="II">Year II</option>
                      <option value="III">Year III</option>
                      <option value="IV">Year IV</option>
                    </select>
                    <select
                      value={formSemRaw}
                      onChange={(e) => setFormSemRaw(e.target.value)}
                      className="p-2 border dark:border-neutral-800 border-border-subtle rounded-lg dark:bg-neutral-900 bg-background text-text-primary"
                    >
                      <option value="I">Semester I</option>
                      <option value="II">Semester II</option>
                    </select>
                  </div>
                </div>

              </div>

              <div className="p-5 border-t dark:border-neutral-800 border-border-subtle dark:bg-neutral-900/20 bg-neutral-50/50 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowMappingModal(false)}
                  className="px-4 py-2 border dark:border-neutral-800 border-border-subtle rounded-lg text-text-secondary hover:dark:bg-neutral-900 hover:bg-neutral-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-bold shadow flex items-center gap-1.5"
                >
                  {formSubmitting && <Loader2 className="animate-spin" size={14} />}
                  <span>{editingMappingId ? "Save Changes" : "Add Mapping"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
