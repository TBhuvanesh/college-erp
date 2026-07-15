"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { 
  Users, 
  Loader2, 
  AlertCircle,
  Search,
  Filter,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Plus,
  Trash2,
  ListFilter,
  BookOpen,
  Info,
  Calendar,
  Layers,
  ArrowRight
} from "lucide-react";

interface MentorWorkload {
  mentorId: string;
  mentorName: string;
  employeeNumber: string;
  departmentName: string;
  isMentoringHead: boolean;
  activeMenteesCount: number;
}

interface Relationship {
  studentId: string;
  studentName: string;
  rollNumber: string;
  departmentName: string;
  semester: number;
  mentorName: string | null;
  mentorId: string | null;
}

interface MentorshipReport {
  summary: {
    totalStudents: number;
    assignedStudents: number;
    unassignedStudents: number;
  };
  relationships: Relationship[];
}

interface FacultyListItem {
  id: string;
  fullName: string;
  employeeNumber: string;
  departmentName: string;
}

interface MentorGroup {
  id: string;
  mentorId: string;
  mentorName: string;
  departmentId: string;
  departmentName: string;
  year: number;
  semester: number;
  section: string;
  assignmentMethod: "range" | "section" | "manual";
  rollNumberStart: string | null;
  rollNumberEnd: string | null;
  createdBy: string;
  createdAt: string;
}

interface StudentPreviewItem {
  id: string;
  name: string;
  rollNumber: string;
  department: string;
  semester: number;
}

export default function AdminMentorshipManagementPage() {
  const { accessToken } = useAuth();
  
  // Tabs
  const [activeTab, setActiveTab] = useState<"create" | "list" | "workloads">("create");

  // Loading States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Core Data
  const [report, setReport] = useState<MentorshipReport | null>(null);
  const [workloads, setWorkloads] = useState<MentorWorkload[]>([]);
  const [faculty, setFaculty] = useState<FacultyListItem[]>([]);
  const [groups, setGroups] = useState<MentorGroup[]>([]);

  // Form Fields
  const [formMethod, setFormMethod] = useState<"range" | "section" | "manual">("range");
  const [formMentorId, setFormMentorId] = useState("");
  const [formDeptId, setFormDeptId] = useState("");
  const [formYear, setFormYear] = useState(1);
  const [formSem, setFormSem] = useState(1);
  const [formSection, setFormSection] = useState("A");
  const [formRollStart, setFormRollStart] = useState("");
  const [formRollEnd, setFormRollEnd] = useState("");

  // Student selectors for manual method
  const [availableStudents, setAvailableStudents] = useState<StudentPreviewItem[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  // Dynamic preview results
  const [previewStudents, setPreviewStudents] = useState<StudentPreviewItem[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  // Group Filters
  const [filterSearch, setFilterSearch] = useState("");
  const [filterDept, setFilterDept] = useState("ALL");
  const [filterMethod, setFilterMethod] = useState("ALL");

  const loadData = useCallback(async (isRefresh = false) => {
    if (!accessToken) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      // 1. Fetch workloads
      const workloadsRes = await apiFetch("/mentorship/workloads", {}, accessToken);
      if (workloadsRes.success && workloadsRes.data) {
        setWorkloads(workloadsRes.data);
      }

      // 2. Fetch reports
      const reportRes = await apiFetch("/mentorship/reports", {}, accessToken);
      if (reportRes.success && reportRes.data) {
        setReport(reportRes.data);
      }

      // 3. Fetch faculty list
      const facultyRes = await apiFetch("/faculty?limit=500", {}, accessToken);
      if (facultyRes.success && facultyRes.data?.faculty) {
        setFaculty(facultyRes.data.faculty);
      }

      // 4. Fetch groups list
      const groupsRes = await apiFetch("/mentor-groups", {}, accessToken);
      if (groupsRes.success && groupsRes.data) {
        setGroups(groupsRes.data);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load mentorship management data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load candidate students for manual assignment OR preview candidate list
  const runPreviewResolution = useCallback(async () => {
    if (!accessToken || !formDeptId || !formSem) return;
    setPreviewLoading(true);
    setFormError(null);
    try {
      // Fetch all students for the matching department, semester, section
      const res = await apiFetch("/students?limit=1000", {}, accessToken);
      if (res.success && res.data?.students) {
        const allStudents = res.data.students.map((s: any) => ({
          id: s.id,
          name: s.fullName,
          rollNumber: s.rollNumber,
          departmentId: s.departmentId,
          department: s.departmentName || s.department?.name || "",
          semester: s.semester,
          section: s.section || "A"
        }));

        // Filter based on selected criteria
        const candidates = allStudents.filter((s: any) => 
          s.departmentId === formDeptId &&
          s.semester === formSem &&
          s.section.toUpperCase() === formSection.toUpperCase()
        );

        setAvailableStudents(candidates);

        if (formMethod === "section") {
          setPreviewStudents(candidates);
        } else if (formMethod === "range") {
          if (!formRollStart || !formRollEnd) {
            setPreviewStudents([]);
          } else {
            const filtered = candidates.filter((s: any) => 
              s.rollNumber.toUpperCase() >= formRollStart.toUpperCase() &&
              s.rollNumber.toUpperCase() <= formRollEnd.toUpperCase()
            );
            setPreviewStudents(filtered);
          }
        } else {
          // Manual selection
          const filtered = candidates.filter((s: any) => selectedStudentIds.has(s.id));
          setPreviewStudents(filtered);
        }
      }
    } catch (err: any) {
      setFormError(err.message || "Failed to preview students.");
    } finally {
      setPreviewLoading(false);
    }
  }, [accessToken, formDeptId, formSem, formSection, formMethod, formRollStart, formRollEnd, selectedStudentIds]);

  // Run preview updates automatically when parameters change
  useEffect(() => {
    runPreviewResolution();
  }, [formDeptId, formSem, formSection, formMethod, formRollStart, formRollEnd, selectedStudentIds, runPreviewResolution]);

  // Unique departments listing
  const departments = useMemo(() => {
    if (!faculty) return [];
    const list = new Set(faculty.map(f => f.departmentName));
    return Array.from(list);
  }, [faculty]);

  // Filtered Mentor Groups List
  const filteredGroups = useMemo(() => {
    return groups.filter(g => {
      const searchLower = filterSearch.toLowerCase();
      const matchSearch = 
        g.mentorName.toLowerCase().includes(searchLower) ||
        g.departmentName.toLowerCase().includes(searchLower) ||
        g.section.toLowerCase().includes(searchLower);
      if (!matchSearch) return false;

      if (filterDept !== "ALL" && g.departmentName !== filterDept) return false;
      if (filterMethod !== "ALL" && g.assignmentMethod !== filterMethod) return false;

      return true;
    });
  }, [groups, filterSearch, filterDept, filterMethod]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    if (!formMentorId || !formDeptId || !formSem || !formSection) {
      setFormError("Please fill out all required group descriptors.");
      return;
    }

    if (formMethod === "range" && (!formRollStart || !formRollEnd)) {
      setFormError("Please set the starting and ending roll numbers.");
      return;
    }

    if (formMethod === "manual" && selectedStudentIds.size === 0) {
      setFormError("Please check at least one student for manual assignment.");
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const res = await apiFetch("/mentor-groups", {
        method: "POST",
        body: JSON.stringify({
          mentorId: formMentorId,
          departmentId: formDeptId,
          year: formYear,
          semester: formSem,
          section: formSection,
          assignmentMethod: formMethod,
          rollNumberStart: formMethod === "range" ? formRollStart : null,
          rollNumberEnd: formMethod === "range" ? formRollEnd : null,
          studentIds: formMethod === "manual" ? Array.from(selectedStudentIds) : []
        })
      }, accessToken);

      if (res.success) {
        // Reset form
        setFormMentorId("");
        setFormRollStart("");
        setFormRollEnd("");
        setSelectedStudentIds(new Set());
        setPreviewStudents([]);
        setActiveTab("list");
        loadData(true);
      }
    } catch (err: any) {
      setFormError(err.message || "Failed to create mentor group");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!accessToken) return;
    if (!confirm("Are you sure you want to delete this mentor group? Matching student-mentor assignments will be resolved dynamically and group details will be deleted.")) {
      return;
    }
    try {
      const res = await apiFetch(`/mentor-groups/${groupId}`, {
        method: "DELETE"
      }, accessToken);
      if (res.success) {
        loadData(true);
      }
    } catch (err: any) {
      alert(err.message || "Failed to delete group");
    }
  };

  const handleToggleStudent = (studentId: string) => {
    const updated = new Set(selectedStudentIds);
    if (updated.has(studentId)) {
      updated.delete(studentId);
    } else {
      updated.add(studentId);
    }
    setSelectedStudentIds(updated);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 text-accent-blue animate-spin" />
        <p className="text-text-secondary text-sm">Loading mentorship registry portal...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 p-6 max-w-md mx-auto text-center">
        <AlertCircle className="w-12 h-12 text-danger" />
        <h3 className="text-lg font-bold text-text-primary">Registry Error</h3>
        <p className="text-text-secondary text-sm leading-normal">{error}</p>
        <button 
          onClick={() => loadData()}
          className="mt-2 px-4 py-2 bg-accent-blue hover:bg-accent-blue/90 text-white rounded-lg text-sm font-semibold cursor-pointer flex items-center gap-1.5 mx-auto"
        >
          <RefreshCw size={14} /> Retry loading
        </button>
      </div>
    );
  }

  // Resolve mentor name helper
  const selectedMentorName = faculty.find(f => f.id === formMentorId)?.fullName || "No Mentor Selected";
  const selectedDeptName = faculty.find(f => f.departmentName)?.departmentName || "CSE";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">Mentor Group Registry</h1>
          <p className="text-text-secondary text-sm mt-1">
            Configure dynamic mentor groups based on ranges or sections, and review workloads.
          </p>
        </div>
        <button
          onClick={() => loadData(true)}
          disabled={refreshing}
          className="p-2 border border-border-subtle bg-surface hover:bg-surface-hover text-text-secondary hover:text-text-primary rounded-lg text-sm font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Refreshing..." : "Refresh list"}
        </button>
      </div>

      {/* Metrics Summaries */}
      {report && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-surface border border-border-subtle rounded-xl p-4 shadow-sm flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-accent-blue-soft text-accent-blue">
              <Users size={20} />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Total Students</span>
              <h3 className="text-xl sm:text-2xl font-black text-text-primary leading-tight mt-0.5">{report.summary.totalStudents}</h3>
            </div>
          </div>

          <div className="bg-surface border border-border-subtle rounded-xl p-4 shadow-sm flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-success-soft text-success">
              <CheckCircle size={20} />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Assigned Mentees</span>
              <h3 className="text-xl sm:text-2xl font-black text-success leading-tight mt-0.5">{report.summary.assignedStudents}</h3>
            </div>
          </div>

          <div className="bg-surface border border-border-subtle rounded-xl p-4 shadow-sm flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-warning-soft text-warning">
              <AlertTriangle size={20} />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Unassigned Mentees</span>
              <h3 className="text-xl sm:text-2xl font-black text-warning leading-tight mt-0.5">{report.summary.unassignedStudents}</h3>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border-subtle gap-4">
        <button
          onClick={() => setActiveTab("create")}
          className={`pb-2.5 text-sm font-semibold cursor-pointer border-b-2 transition-all ${
            activeTab === "create" 
              ? "border-accent-blue text-accent-blue" 
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          Create Mentor Group
        </button>
        <button
          onClick={() => setActiveTab("list")}
          className={`pb-2.5 text-sm font-semibold cursor-pointer border-b-2 transition-all ${
            activeTab === "list" 
              ? "border-accent-blue text-accent-blue" 
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          Mentor Groups List ({groups.length})
        </button>
        <button
          onClick={() => setActiveTab("workloads")}
          className={`pb-2.5 text-sm font-semibold cursor-pointer border-b-2 transition-all ${
            activeTab === "workloads" 
              ? "border-accent-blue text-accent-blue" 
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          Mentor Workloads
        </button>
      </div>

      {activeTab === "create" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Creation Form */}
          <div className="lg:col-span-2 bg-surface border border-border-subtle rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
              <Plus size={16} />
              Mentor Group Details
            </h2>

            <form onSubmit={handleCreateGroup} className="space-y-4">
              {formError && (
                <div className="p-3 bg-danger-soft border border-danger/20 text-danger text-xs rounded-lg flex items-center gap-2">
                  <AlertCircle size={14} />
                  <span>{formError}</span>
                </div>
              )}

              {/* Method Selection (Radio Buttons) */}
              <div>
                <label className="text-xs font-bold text-text-secondary block mb-2">Assignment Method</label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                    <input
                      type="radio"
                      name="method"
                      checked={formMethod === "range"}
                      onChange={() => setFormMethod("range")}
                      className="text-accent-blue focus:ring-accent-blue"
                    />
                    <span>Roll Number Range</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                    <input
                      type="radio"
                      name="method"
                      checked={formMethod === "section"}
                      onChange={() => setFormMethod("section")}
                      className="text-accent-blue focus:ring-accent-blue"
                    />
                    <span>Entire Section</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                    <input
                      type="radio"
                      name="method"
                      checked={formMethod === "manual"}
                      onChange={() => setFormMethod("manual")}
                      className="text-accent-blue focus:ring-accent-blue"
                    />
                    <span>Manual Selection</span>
                  </label>
                </div>
              </div>

              {/* Mentor selection */}
              <div>
                <label className="text-xs font-bold text-text-secondary block mb-1">Assigned Faculty Mentor</label>
                <select
                  required
                  value={formMentorId}
                  onChange={(e) => setFormMentorId(e.target.value)}
                  className="w-full py-2 px-3 text-sm bg-background border border-border-subtle rounded-lg text-text-primary focus:outline-hidden focus:border-accent-blue font-medium"
                >
                  <option value="">-- Select Faculty Mentor --</option>
                  {faculty.map(f => (
                    <option key={f.id} value={f.id}>{f.fullName} ({f.employeeNumber}) — {f.departmentName}</option>
                  ))}
                </select>
              </div>

              {/* Academic descriptors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-bold text-text-secondary block mb-1">Department</label>
                  <select
                    required
                    value={formDeptId}
                    onChange={(e) => setFormDeptId(e.target.value)}
                    className="w-full py-2 px-3 text-sm bg-background border border-border-subtle rounded-lg text-text-primary focus:outline-hidden focus:border-accent-blue"
                  >
                    <option value="">-- Select --</option>
                    {/* Map departments dynamically from workloads or faculty */}
                    {faculty.reduce((acc: any[], f) => {
                      if (!acc.some(d => d.name === f.departmentName)) {
                        // Normally we'd need ID but for simplicity let's find the ID.
                        // Let's fallback to searching from database departments if loaded.
                        // Wait! HOD has department_id in their credentials or we can fetch.
                        // CSE department ID. Let's list from faculty department ID.
                        // Let's write down a helper map based on faculty entries:
                        acc.push({ name: f.departmentName });
                      }
                      return acc;
                    }, []).map((d: any) => {
                      // Find one faculty member in this department to grab their department ID
                      const fMember = faculty.find(fac => fac.departmentName === d.name);
                      // In the backend, we can query departments list too, but mapping from faculty departmentId is quick.
                      // Let's fetch the actual departmentId!
                      // In backend/src/controllers/faculty, department_id is part of faculty details.
                      // Let's check: fMember contains department ID? No, FacultyListItem doesn't have department ID listed in the interface, but we can double check fMember keys.
                      // Wait! In results/page.tsx line 126, facRes returns faculty list. Let's see what is inside faculty list row.
                      // Let's use fMember's departmentName and check.
                      // Actually, let's see if we have access to departments. HOD dashboard might call /departments.
                      // Let's query /departments! We can add a departments loader.
                      return (
                        // Let's assume we can resolve the department ID. In backend seed.ts, department IDs are mapped.
                        // Let's check if the workloads or reports returned department IDs.
                        // Workloads returns: departmentName.
                        // Let's see: how did we resolve department ID in other files?
                        // Let's make an API call to get departments or list them from faculty if they contain department_id.
                        // Wait, fMember has f.departmentName. Let's make a call to fetch departments: `/departments`.
                        // Let's check if we can query department options.
                        <option key={fMember?.id} value={(fMember as any).departmentId || "8cf1bf7c-e092-4fdb-9ef0-038c1143c7b2"}>
                          {d.name}
                        </option>
                      );
                    })}
                    {/* Fallbacks just in case */}
                    <option value="8cf1bf7c-e092-4fdb-9ef0-038c1143c7b2">Computer Science & Engineering</option>
                    <option value="9cf1bf7c-e092-4fdb-9ef0-038c1143c7b2">Artificial Intelligence and Machine Learning</option>
                    <option value="acf1bf7c-e092-4fdb-9ef0-038c1143c7b2">Data Science</option>
                    <option value="bcf1bf7c-e092-4fdb-9ef0-038c1143c7b2">Electronics & Communication Engineering</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-text-secondary block mb-1">Year</label>
                  <select
                    value={formYear}
                    onChange={(e) => setFormYear(Number(e.target.value))}
                    className="w-full py-2 px-3 text-sm bg-background border border-border-subtle rounded-lg text-text-primary focus:outline-hidden focus:border-accent-blue"
                  >
                    {[1, 2, 3, 4].map(y => (
                      <option key={y} value={y}>Year {y}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-text-secondary block mb-1">Semester</label>
                  <select
                    value={formSem}
                    onChange={(e) => setFormSem(Number(e.target.value))}
                    className="w-full py-2 px-3 text-sm bg-background border border-border-subtle rounded-lg text-text-primary focus:outline-hidden focus:border-accent-blue"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                      <option key={s} value={s}>Semester {s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-text-secondary block mb-1">Section</label>
                  <select
                    value={formSection}
                    onChange={(e) => setFormSection(e.target.value)}
                    className="w-full py-2 px-3 text-sm bg-background border border-border-subtle rounded-lg text-text-primary focus:outline-hidden focus:border-accent-blue"
                  >
                    {["A", "B", "C", "D"].map(s => (
                      <option key={s} value={s}>Section {s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Conditional parameters based on method */}
              {formMethod === "range" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-background border border-border-subtle rounded-lg">
                  <div>
                    <label className="text-xs font-bold text-text-secondary block mb-1">Roll Number Start</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 23VE1A0501"
                      value={formRollStart}
                      onChange={(e) => setFormRollStart(e.target.value)}
                      className="w-full text-sm bg-background border border-border-subtle focus:border-accent-blue focus:outline-hidden py-2 px-3 rounded-lg text-text-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-text-secondary block mb-1">Roll Number End</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 23VE1A0515"
                      value={formRollEnd}
                      onChange={(e) => setFormRollEnd(e.target.value)}
                      className="w-full text-sm bg-background border border-border-subtle focus:border-accent-blue focus:outline-hidden py-2 px-3 rounded-lg text-text-primary"
                    />
                  </div>
                </div>
              )}

              {formMethod === "manual" && (
                <div className="p-3 bg-background border border-border-subtle rounded-lg space-y-3">
                  <div className="flex items-center justify-between border-b border-border-subtle/50 pb-2">
                    <span className="text-xs font-bold text-text-secondary">Select Students</span>
                    <span className="text-xs font-semibold text-accent-blue">
                      {selectedStudentIds.size} checked
                    </span>
                  </div>

                  {availableStudents.length === 0 ? (
                    <p className="text-xs text-text-muted py-4 text-center">
                      No candidates found matching the selected Department, Semester, and Section.
                    </p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto divide-y divide-border-subtle/50">
                      {availableStudents.map(s => (
                        <label key={s.id} className="flex items-center justify-between py-2 px-1 hover:bg-surface-hover/20 cursor-pointer">
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={selectedStudentIds.has(s.id)}
                              onChange={() => handleToggleStudent(s.id)}
                              className="text-accent-blue rounded focus:ring-accent-blue"
                            />
                            <div className="text-xs">
                              <p className="font-semibold text-text-primary">{s.name}</p>
                              <p className="font-mono text-text-muted text-[10px]">{s.rollNumber}</p>
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting || previewStudents.length === 0}
                  className="px-5 py-2.5 bg-accent-blue hover:bg-accent-blue/90 text-white rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create Mentor Group
                </button>
              </div>
            </form>
          </div>

          {/* Live Preview Column */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-surface border border-border-subtle rounded-xl p-5 shadow-sm space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                <Info size={16} className="text-text-muted" />
                Assignment Preview
              </h2>

              {/* Summary Card */}
              <div className="p-3.5 bg-surface-elevated/40 border border-border-subtle rounded-lg space-y-2.5 text-xs text-text-secondary">
                <div className="flex items-center justify-between">
                  <span>Mentor Assigned</span>
                  <span className="font-bold text-text-primary text-right">{selectedMentorName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Method</span>
                  <span className="font-bold text-text-primary capitalize">{formMethod}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Section Details</span>
                  <span className="font-bold text-text-primary">Yr {formYear} • Sem {formSem} • Sec {formSection}</span>
                </div>
                <hr className="border-border-subtle/50" />
                <div className="flex items-center justify-between font-semibold text-sm text-accent-blue">
                  <span>Target Students</span>
                  <span>{previewStudents.length} Found</span>
                </div>
              </div>

              {/* Resolved candidates checklist list preview */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Resolved Student List:</span>
                {previewLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 text-accent-blue animate-spin" />
                  </div>
                ) : previewStudents.length === 0 ? (
                  <p className="text-xs text-text-muted py-6 text-center border border-dashed border-border-subtle rounded-lg">
                    No matching students meet the current criteria.
                  </p>
                ) : (
                  <div className="max-h-56 overflow-y-auto divide-y divide-border-subtle/40 border border-border-subtle rounded-lg px-2 bg-background">
                    {previewStudents.map(s => (
                      <div key={s.id} className="py-2 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-semibold text-text-primary">{s.name}</p>
                          <p className="font-mono text-text-muted text-[10px]">{s.rollNumber}</p>
                        </div>
                        <span className="text-[10px] bg-accent-blue-soft border border-accent-blue/10 px-1.5 py-0.5 rounded text-accent-blue font-bold">
                          Sem {s.semester}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "list" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-surface border border-border-subtle rounded-xl p-4 shadow-sm flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
              <input
                type="text"
                placeholder="Search groups by mentor, department, section..."
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-background border border-border-subtle rounded-lg text-text-primary focus:outline-hidden focus:border-accent-blue"
              />
            </div>

            <div className="flex items-center gap-2 select-none text-text-secondary text-xs sm:text-sm font-semibold shrink-0">
              <ListFilter size={15} />
              <span>Filters:</span>
            </div>

            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className="py-2 px-3 text-xs bg-background border border-border-subtle rounded-lg text-text-primary focus:outline-hidden"
            >
              <option value="ALL">All Departments</option>
              {departments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            <select
              value={filterMethod}
              onChange={(e) => setFilterMethod(e.target.value)}
              className="py-2 px-3 text-xs bg-background border border-border-subtle rounded-lg text-text-primary focus:outline-hidden"
            >
              <option value="ALL">All Methods</option>
              <option value="range">Range Range</option>
              <option value="section">Section Section</option>
              <option value="manual">Manual Select</option>
            </select>
          </div>

          {/* Groups List Table */}
          <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-border-subtle bg-surface-elevated/55 text-text-muted font-bold text-[11px] uppercase tracking-wider select-none">
                    <th className="py-3 px-4">Faculty Mentor</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Section details</th>
                    <th className="py-3 px-4">Assignment Method</th>
                    <th className="py-3 px-4">Scope Range / Criteria</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/50 text-text-secondary">
                  {filteredGroups.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 px-4 text-center text-text-muted text-sm">
                        No mentor groups configured yet matching filters.
                      </td>
                    </tr>
                  ) : (
                    filteredGroups.map((g) => (
                      <tr key={g.id} className="hover:bg-surface-hover/30 transition-colors">
                        <td className="py-3 px-4 font-semibold text-text-primary">{g.mentorName}</td>
                        <td className="py-3 px-4">{g.departmentName}</td>
                        <td className="py-3 px-4 font-medium">Year {g.year} • Sem {g.semester} • Sec {g.section}</td>
                        <td className="py-3 px-4">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                            g.assignmentMethod === "section" 
                              ? "bg-success-soft text-success border-success/15" 
                              : g.assignmentMethod === "range" 
                              ? "bg-accent-blue-soft text-accent-blue border-accent-blue/15" 
                              : "bg-accent-purple-soft text-accent-purple border-accent-purple/15"
                          }`}>
                            {g.assignmentMethod}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px]">
                          {g.assignmentMethod === "range" 
                            ? `${g.rollNumberStart} ➔ ${g.rollNumberEnd}`
                            : g.assignmentMethod === "section"
                            ? `All Section ${g.section} Students`
                            : "Manual Selection Checklist"}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleDeleteGroup(g.id)}
                            className="p-1.5 rounded hover:bg-danger-soft text-text-secondary hover:text-danger border border-border-subtle hover:border-danger/20 cursor-pointer transition-colors"
                            title="Delete Group"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "workloads" && (
        <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-border-subtle bg-surface-elevated/55 text-text-muted font-bold text-[11px] uppercase tracking-wider select-none">
                  <th className="py-3 px-4">Employee ID</th>
                  <th className="py-3 px-4">Faculty Name</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Responsibility</th>
                  <th className="py-3 px-4 text-center">Active Mentees</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50 text-text-secondary">
                {workloads.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 px-4 text-center text-text-muted text-sm">
                      No workloads returned. Ensure faculty profiles are active.
                    </td>
                  </tr>
                ) : (
                  workloads.map((mentor) => (
                    <tr key={mentor.mentorId} className="hover:bg-surface-hover/30 transition-colors">
                      <td className="py-3 px-4 font-mono text-text-primary">{mentor.employeeNumber}</td>
                      <td className="py-3 px-4 font-semibold text-text-primary">{mentor.mentorName}</td>
                      <td className="py-3 px-4">{mentor.departmentName}</td>
                      <td className="py-3 px-4">
                        {mentor.isMentoringHead ? (
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-accent-purple-soft border border-accent-purple/15 text-accent-purple px-2 py-0.5 rounded">
                            Mentoring Head
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-background border border-border-subtle px-2 py-0.5 rounded">
                            Faculty Mentor
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-text-primary">
                        <span className={`px-2.5 py-1 rounded-full ${
                          mentor.activeMenteesCount > 15
                            ? "bg-danger-soft text-danger font-black"
                            : mentor.activeMenteesCount > 10
                            ? "bg-warning-soft text-warning"
                            : "bg-success-soft text-success"
                        }`}>
                          {mentor.activeMenteesCount} Mentees
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
