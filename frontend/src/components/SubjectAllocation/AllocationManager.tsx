"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { usePermission } from "@/context/PermissionContext";
import { apiFetch } from "@/lib/api";
import type { SubjectAllocation, WorkloadStatistics } from "@/types/subjectAllocation";
import {
  BookOpen,
  Users,
  Layers,
  AlertCircle,
  Plus,
  Search,
  SlidersHorizontal,
  ChevronDown,
  RefreshCw,
  Edit2,
  Trash2,
  Share2,
  Eye,
  CheckCircle,
  XCircle,
  HelpCircle
} from "lucide-react";

export const AllocationManager: React.FC = () => {
  const { accessToken } = useAuth();
  const { rbacRole } = usePermission();

  const isAdmin = rbacRole === "Super Admin" || rbacRole === "College Admin";
  const isHod = rbacRole === "HOD";

  // ── States ──────────────────────────────────────────────────────────────────
  const [allocations, setAllocations] = useState<SubjectAllocation[]>([]);
  const [stats, setStats] = useState<WorkloadStatistics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [statsLoading, setStatsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Metadata dropdowns
  const [departments, setDepartments] = useState<any[]>([]);
  const [faculty, setFaculty] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);

  // Filter States
  const [selectedDept, setSelectedDept] = useState<string>("ALL");
  const [selectedSemester, setSelectedSemester] = useState<string>("ALL");
  const [selectedSection, setSelectedSection] = useState<string>("ALL");
  const [selectedSubject, setSelectedSubject] = useState<string>("ALL");
  const [selectedFaculty, setSelectedFaculty] = useState<string>("ALL");
  const [selectedYear, setSelectedYear] = useState<string>("2026-2027");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modals visibility
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showTransferModal, setShowTransferModal] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [showViewModal, setShowViewModal] = useState<boolean>(false);

  // Selected item for action
  const [selectedAlloc, setSelectedAlloc] = useState<SubjectAllocation | null>(null);

  // Action Form Inputs
  const [formDept, setFormDept] = useState<string>("");
  const [formProgram, setFormProgram] = useState<string>("");
  const [formSemester, setFormSemester] = useState<number>(1);
  const [formSection, setFormSection] = useState<string>("A");
  const [formSubject, setFormSubject] = useState<string>("");
  const [formFaculty, setFormFaculty] = useState<string>("");
  const [formStatus, setFormStatus] = useState<'active' | 'inactive' | 'pending'>('active');
  const [formNotes, setFormNotes] = useState<string>("");
  const [formReason, setFormReason] = useState<string>("");
  
  // Workload and validation warnings
  const [workloadWarning, setWorkloadWarning] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // ── Data Fetching ────────────────────────────────────────────────────────────

  const fetchAllocations = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const queryParams = new URLSearchParams();
      if (selectedDept !== "ALL") queryParams.append("departmentId", selectedDept);
      if (selectedSemester !== "ALL") queryParams.append("semester", selectedSemester);
      if (selectedSection !== "ALL") queryParams.append("section", selectedSection);
      if (selectedSubject !== "ALL") queryParams.append("subjectId", selectedSubject);
      if (selectedFaculty !== "ALL") queryParams.append("facultyId", selectedFaculty);
      if (selectedStatus !== "ALL") queryParams.append("status", selectedStatus);
      if (selectedYear) queryParams.append("academicYear", selectedYear);
      if (searchQuery) queryParams.append("search", searchQuery);

      const res = await apiFetch(`/subject-allocations?${queryParams.toString()}`, {}, accessToken);
      if (res.success && res.data?.allocations) {
        setAllocations(res.data.allocations);
      } else {
        setErrorMessage(res.message || "Failed to load subject allocations");
      }
    } catch (err: any) {
      setErrorMessage("Error fetching subject allocations");
    } finally {
      setLoading(false);
    }
  }, [accessToken, selectedDept, selectedSemester, selectedSection, selectedSubject, selectedFaculty, selectedYear, selectedStatus, searchQuery]);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await apiFetch(`/subject-allocations/statistics?academicYear=${selectedYear}`, {}, accessToken);
      if (res.success && res.data?.statistics) {
        setStats(res.data.statistics);
      }
    } catch (err) {
      console.error("Error loading statistics", err);
    } finally {
      setStatsLoading(false);
    }
  }, [accessToken, selectedYear]);

  const fetchMetadata = useCallback(async () => {
    try {
      const [deptRes, facRes, subRes, progRes] = await Promise.all([
        apiFetch("/departments", {}, accessToken),
        apiFetch("/faculty?limit=1000", {}, accessToken),
        apiFetch("/subjects?limit=1000", {}, accessToken),
        apiFetch("/departments/programs/list", {}, accessToken)
      ]);

      if (deptRes.success && deptRes.data?.departments) setDepartments(deptRes.data.departments);
      if (facRes.success && facRes.data?.faculty) setFaculty(facRes.data.faculty);
      if (subRes.success && subRes.data?.subjects) setSubjects(subRes.data.subjects);
      if (progRes.success && progRes.data?.programs) setPrograms(progRes.data.programs);
    } catch (err) {
      console.error("Error loading dropdown metadata", err);
    }
  }, [accessToken]);

  // Initial and reactive load
  useEffect(() => {
    fetchAllocations();
    fetchStats();
  }, [fetchAllocations, fetchStats]);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  // ── Modals / Forms Operations ────────────────────────────────────────────────

  // Check workload count of selected faculty in real time inside Create / Edit modal
  useEffect(() => {
    if (!formFaculty) {
      setWorkloadWarning(null);
      return;
    }
    const currentYearAllocations = allocations.filter(
      a => a.facultyId === formFaculty && a.academicYear === selectedYear && a.status === 'active'
    );
    if (currentYearAllocations.length >= 3) {
      setWorkloadWarning(`Workload Alert: Selected faculty member is already teaching ${currentYearAllocations.length} subjects in ${selectedYear}.`);
    } else {
      setWorkloadWarning(null);
    }
  }, [formFaculty, selectedYear, allocations]);

  // Validate department compatibility in real time
  useEffect(() => {
    if (!formFaculty || !formSubject) {
      setValidationError(null);
      return;
    }

    const selectedFacultyObj = faculty.find(f => f.id === formFaculty);
    const selectedSubjectObj = subjects.find(s => s.id === formSubject);

    if (selectedFacultyObj && selectedSubjectObj) {
      const facDeptId = selectedFacultyObj.departmentId || selectedFacultyObj.department?.id;
      
      const hasMapping = selectedSubjectObj.mappings?.some((m: any) => m.departmentId === facDeptId);

      if (facDeptId && selectedSubjectObj.mappings && !hasMapping) {
        setValidationError("Department Mismatch: Selected subject is not mapped to this faculty member's department curriculum.");
      } else {
        setValidationError(null);
      }
    } else {
      setValidationError(null);
    }
  }, [formFaculty, formSubject, faculty, subjects]);

  // Actions trigger handlers
  const handleOpenCreate = () => {
    setFormDept("");
    setFormProgram("");
    setFormSemester(1);
    setFormSection("A");
    setFormSubject("");
    setFormFaculty("");
    setFormStatus("active");
    setFormNotes("");
    setValidationError(null);
    setWorkloadWarning(null);
    setShowCreateModal(true);
  };

  const handleOpenEdit = (alloc: SubjectAllocation) => {
    setSelectedAlloc(alloc);
    setFormSemester(alloc.semester);
    setFormSection(alloc.section);
    setFormSubject(alloc.subjectId);
    setFormFaculty(alloc.facultyId);
    setFormStatus(alloc.status);
    setFormNotes(alloc.removalReason || "");
    setValidationError(null);
    setWorkloadWarning(null);
    setShowEditModal(true);
  };

  const handleOpenTransfer = (alloc: SubjectAllocation) => {
    setSelectedAlloc(alloc);
    setFormFaculty("");
    setValidationError(null);
    setWorkloadWarning(null);
    setShowTransferModal(true);
  };

  const handleOpenDelete = (alloc: SubjectAllocation) => {
    setSelectedAlloc(alloc);
    setFormReason("");
    setShowDeleteModal(true);
  };

  const handleOpenView = (alloc: SubjectAllocation) => {
    setSelectedAlloc(alloc);
    setShowViewModal(true);
  };

  // Submit methods
  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validationError) return;

    try {
      const res = await apiFetch("/subject-allocations", {
        method: "POST",
        body: JSON.stringify({
          facultyId: formFaculty,
          subjectId: formSubject,
          section: formSection,
          academicYear: selectedYear,
          status: formStatus,
          notes: formNotes
        })
      }, accessToken);

      if (res.success) {
        setSuccessMessage(res.data?.warning || "Subject allocation created successfully");
        setShowCreateModal(false);
        fetchAllocations();
        fetchStats();
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        setErrorMessage(res.message || "Failed to create subject allocation");
        setTimeout(() => setErrorMessage(null), 5000);
      }
    } catch (err) {
      setErrorMessage("Error submitting create request");
    }
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlloc || validationError) return;

    try {
      const res = await apiFetch(`/subject-allocations/${selectedAlloc.id}`, {
        method: "PUT",
        body: JSON.stringify({
          facultyId: formFaculty,
          subjectId: formSubject,
          section: formSection,
          status: formStatus
        })
      }, accessToken);

      if (res.success) {
        setSuccessMessage(res.data?.warning || "Subject allocation updated successfully");
        setShowEditModal(false);
        fetchAllocations();
        fetchStats();
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        setErrorMessage(res.message || "Failed to update subject allocation");
      }
    } catch (err) {
      setErrorMessage("Error updating subject allocation");
    }
  };

  const submitTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlloc || validationError) return;

    try {
      const res = await apiFetch(`/subject-allocations/${selectedAlloc.id}/transfer`, {
        method: "POST",
        body: JSON.stringify({
          facultyId: formFaculty
        })
      }, accessToken);

      if (res.success) {
        setSuccessMessage(res.data?.warning || "Subject allocation transferred successfully");
        setShowTransferModal(false);
        fetchAllocations();
        fetchStats();
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        setErrorMessage(res.message || "Failed to transfer subject allocation");
      }
    } catch (err) {
      setErrorMessage("Error transferring subject allocation");
    }
  };

  const submitDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlloc || !formReason) return;

    try {
      const res = await apiFetch(`/subject-allocations/${selectedAlloc.id}`, {
        method: "DELETE",
        body: JSON.stringify({
          reason: formReason
        })
      }, accessToken);

      if (res.success) {
        setSuccessMessage("Subject allocation removed successfully");
        setShowDeleteModal(false);
        fetchAllocations();
        fetchStats();
        setTimeout(() => setSuccessMessage(null), 4000);
      } else {
        setErrorMessage(res.message || "Failed to remove subject allocation");
      }
    } catch (err) {
      setErrorMessage("Error removing subject allocation");
    }
  };

  // Get subjects matching the program / department selected in modal
  const filteredModalSubjects = subjects.filter(s => {
    if (formDept) {
      const hasDeptMapping = s.mappings?.some((m: any) => m.departmentId === formDept);
      if (!hasDeptMapping) return false;
    }
    if (formProgram) {
      const selectedProg = programs.find(p => p.id === formProgram);
      const matchesId = s.mappings?.some((m: any) => m.programId === formProgram);
      const matchesName = selectedProg && s.mappings?.some((m: any) => m.programName && (
        selectedProg.name.toLowerCase().includes(m.programName.toLowerCase()) ||
        selectedProg.code.toLowerCase().includes(m.programName.toLowerCase()) ||
        m.programName.toLowerCase().includes(selectedProg.name.toLowerCase()) ||
        m.programName.toLowerCase().includes(selectedProg.code.toLowerCase())
      ));
      if (!matchesId && !matchesName) return false;
    }
    if (formSemester) {
      const hasSemMapping = s.mappings?.some((m: any) => Number(m.semester) === Number(formSemester));
      if (!hasSemMapping) return false;
    }
    return true;
  });

  // Get faculty matching department selected in modal
  const filteredModalFaculty = faculty.filter(f => {
    if (formDept && f.departmentId !== formDept && f.department?.id !== formDept) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      
      {/* Messages */}
      {successMessage && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs flex items-center gap-3">
          <CheckCircle size={16} />
          <span>{successMessage}</span>
        </div>
      )}
      
      {errorMessage && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-xs flex items-center gap-3">
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ── Statistics Cards Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Total & Allocated Subjects */}
        <div className="glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Subject Coverage</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <BookOpen size={14} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="font-display font-bold text-2xl dark:text-white text-text-primary">
              {statsLoading ? "..." : `${stats?.assignedSubjects} / ${stats?.totalSubjects}`}
            </h3>
            <p className="text-[10px] text-text-secondary mt-1">
              Active assigned subjects of total curriculum.
            </p>
          </div>
        </div>

        {/* Unassigned Subjects */}
        <div className="glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Unassigned Courses</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <AlertCircle size={14} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="font-display font-bold text-2xl dark:text-white text-text-primary">
              {statsLoading ? "..." : stats?.unassignedSubjects}
            </h3>
            <p className="text-[10px] text-text-secondary mt-1">
              Active curriculum schemes lacking allocated teaching faculty.
            </p>
          </div>
        </div>

        {/* Average Workload & Min/Max Workload */}
        <div className="glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Avg Workload Load</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Layers size={14} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="font-display font-bold text-2xl dark:text-white text-text-primary">
              {statsLoading ? "..." : `${stats?.averageSubjectsPerFaculty} subjects`}
            </h3>
            <p className="text-[10px] text-text-secondary mt-1">
              Average allocated load per active department instructor.
            </p>
          </div>
        </div>

        {/* Extremes (Max Workload Faculty) */}
        <div className="glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Highest Load Peak</span>
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
              <Users size={14} />
            </div>
          </div>
          <div className="mt-3">
            {statsLoading ? (
              <h3 className="font-display font-bold text-2xl dark:text-white text-text-primary">...</h3>
            ) : stats?.facultyWithMaxWorkload ? (
              <div>
                <h4 className="font-bold text-sm dark:text-white text-text-primary truncate">{stats.facultyWithMaxWorkload.facultyName}</h4>
                <p className="text-[10px] text-text-secondary mt-0.5 truncate">
                  ID: {stats.facultyWithMaxWorkload.employeeNumber} • Load: {stats.facultyWithMaxWorkload.count} subjects
                </p>
              </div>
            ) : (
              <span className="text-xs text-text-muted">No allocations</span>
            )}
          </div>
        </div>

      </div>

      {/* ── Filter Controls & Search bar ── */}
      <div className="glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl p-5 space-y-4">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b dark:border-neutral-800 border-border-subtle pb-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={14} className="text-text-muted" />
            <h4 className="font-display font-bold text-sm dark:text-white text-text-primary">Enterprise Filter Controls</h4>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-3 py-1.5 rounded-lg border dark:border-neutral-800 border-border-subtle bg-surface text-xs font-semibold focus:outline-none focus:border-indigo-500"
            >
              <option value="2024-2025">2024-2025</option>
              <option value="2025-2026">2025-2026</option>
              <option value="2026-2027">2026-2027</option>
              <option value="2027-2028">2027-2028</option>
            </select>

            <button
              onClick={() => { fetchAllocations(); fetchStats(); }}
              className="p-1.5 rounded-lg border dark:border-neutral-800 border-border-subtle hover:bg-neutral-800/10 dark:hover:bg-neutral-800/50 flex items-center justify-center text-text-muted"
            >
              <RefreshCw size={14} />
            </button>

            {isAdmin && (
              <button
                onClick={handleOpenCreate}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Plus size={14} />
                <span>Create Allocation</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          
          {/* Department Filter (Disabled for HOD since they only view their dept) */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Department</label>
            <select
              value={selectedDept}
              disabled={isHod}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg border dark:border-neutral-800 border-border-subtle bg-surface text-xs focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Departments</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>

          {/* Semester Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Semester</label>
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg border dark:border-neutral-800 border-border-subtle bg-surface text-xs focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Semesters</option>
              {[1,2,3,4,5,6,7,8].map((sem) => (
                <option key={sem} value={sem}>{sem}</option>
              ))}
            </select>
          </div>

          {/* Section Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Section</label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg border dark:border-neutral-800 border-border-subtle bg-surface text-xs focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Sections</option>
              {["A", "B", "C", "D"].map((sec) => (
                <option key={sec} value={sec}>{sec}</option>
              ))}
            </select>
          </div>

          {/* Subject Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Subject</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg border dark:border-neutral-800 border-border-subtle bg-surface text-xs focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Subjects</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>{sub.code} - {sub.name}</option>
              ))}
            </select>
          </div>

          {/* Faculty Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Faculty</label>
            <select
              value={selectedFaculty}
              onChange={(e) => setSelectedFaculty(e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg border dark:border-neutral-800 border-border-subtle bg-surface text-xs focus:outline-none focus:border-indigo-500 block truncate"
            >
              <option value="ALL">All Faculty</option>
              {faculty.map((f) => (
                <option key={f.id} value={f.id}>{f.fullName || f.full_name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg border dark:border-neutral-800 border-border-subtle bg-surface text-xs focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          {/* Search bar */}
          <div className="space-y-1 Sm:col-span-2 md:col-span-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Search Query</label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                placeholder="Fuzzy search..."
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-7 pr-2 py-1.5 rounded-lg border dark:border-neutral-800 border-border-subtle bg-surface text-xs focus:outline-none focus:border-indigo-500"
              />
              <Search size={12} className="absolute left-2.5 top-2.5 text-text-muted" />
            </div>
          </div>

        </div>

      </div>

      {/* ── Main Allocations List Table ── */}
      <div className="glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl overflow-hidden shadow-sm">
        
        {loading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
            <span className="text-xs text-text-secondary">Loading subject allocations registry...</span>
          </div>
        ) : allocations.length === 0 ? (
          <div className="p-20 flex flex-col items-center justify-center text-center max-w-sm mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-neutral-500/10 border border-neutral-500/25 flex items-center justify-center text-text-muted mb-4">
              <BookOpen size={20} />
            </div>
            <h4 className="font-display font-bold text-sm dark:text-white text-text-primary">No Allocations Found</h4>
            <p className="text-[11px] text-text-secondary mt-1.5 leading-relaxed">
              We couldn't locate any active subject-to-faculty allocations matching your active filters. Try adjusting your query parameters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b dark:border-neutral-800 border-border-subtle dark:bg-neutral-900/50 bg-neutral-50 font-bold uppercase tracking-wider text-text-muted text-[10px]">
                  <th className="px-5 py-4">Faculty Name / ID</th>
                  <th className="px-4 py-4">Department</th>
                  <th className="px-4 py-4">Subject Info</th>
                  <th className="px-4 py-4 text-center">Semester / Section</th>
                  <th className="px-4 py-4 text-center">Academic Year</th>
                  <th className="px-4 py-4 text-center">Status</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allocations.map((alloc) => (
                  <tr
                    key={alloc.id}
                    className="border-b dark:border-neutral-800/60 border-border-subtle hover:bg-neutral-800/[0.02] dark:hover:bg-neutral-800/10 transition-colors"
                  >
                    {/* Faculty Profile Info */}
                    <td className="px-5 py-4">
                      <div className="font-semibold dark:text-white text-text-primary text-[13px]">{alloc.facultyName}</div>
                      <div className="text-[10px] text-text-muted font-mono mt-0.5">ID: {alloc.employeeNumber}</div>
                    </td>

                    {/* Department */}
                    <td className="px-4 py-4">
                      <span className="px-2 py-0.5 bg-neutral-500/10 text-text-secondary rounded-full font-medium text-[11px]">
                        {alloc.departmentName}
                      </span>
                    </td>

                    {/* Subject Details */}
                    <td className="px-4 py-4">
                      <div className="font-semibold dark:text-neutral-200 text-text-primary text-[12px]">{alloc.subjectName}</div>
                      <div className="text-[10px] text-text-muted font-mono mt-0.5">Code: {alloc.subjectCode}</div>
                    </td>

                    {/* Semester & Section */}
                    <td className="px-4 py-4 text-center">
                      <div className="font-bold dark:text-white text-text-primary">Sem {alloc.semester}</div>
                      <div className="text-[10px] text-text-secondary mt-0.5 font-semibold uppercase">Sec {alloc.section}</div>
                    </td>

                    {/* Academic Year */}
                    <td className="px-4 py-4 text-center font-semibold text-text-secondary">
                      {alloc.academicYear}
                    </td>

                    {/* Status Badge */}
                    <td className="px-4 py-4 text-center">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        alloc.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : alloc.status === 'pending'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-neutral-500/10 text-text-muted border-neutral-500/20'
                      }`}>
                        {alloc.status}
                      </span>
                    </td>

                    {/* Actions Trigger Grid */}
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        
                        <button
                          onClick={() => handleOpenView(alloc)}
                          title="View Details"
                          className="p-1 rounded-lg border dark:border-neutral-800 border-border-subtle hover:bg-neutral-800/10 dark:hover:bg-neutral-800/40 text-text-muted hover:text-indigo-400 flex items-center justify-center transition-all"
                        >
                          <Eye size={12} />
                        </button>

                        {isAdmin && (
                          <>
                            <button
                              onClick={() => handleOpenEdit(alloc)}
                              title="Edit Allocation"
                              className="p-1 rounded-lg border dark:border-neutral-800 border-border-subtle hover:bg-neutral-800/10 dark:hover:bg-neutral-800/40 text-text-muted hover:text-indigo-400 flex items-center justify-center transition-all"
                            >
                              <Edit2 size={12} />
                            </button>

                            <button
                              onClick={() => handleOpenTransfer(alloc)}
                              title="Transfer Allocation"
                              className="p-1 rounded-lg border dark:border-neutral-800 border-border-subtle hover:bg-neutral-800/10 dark:hover:bg-neutral-800/40 text-text-muted hover:text-violet-400 flex items-center justify-center transition-all"
                            >
                              <Share2 size={12} />
                            </button>

                            <button
                              onClick={() => handleOpenDelete(alloc)}
                              title="Remove Allocation"
                              className="p-1 rounded-lg border dark:border-neutral-800 border-border-subtle hover:bg-neutral-800/10 dark:hover:bg-neutral-800/40 text-text-muted hover:text-rose-400 flex items-center justify-center transition-all"
                            >
                              <Trash2 size={12} />
                            </button>
                          </>
                        )}

                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* ── CREATE ALLOCATION MODAL ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b dark:border-neutral-800 border-border-subtle flex items-center justify-between">
              <h3 className="font-display font-bold text-base dark:text-white text-text-primary">Create Subject Allocation</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-text-muted hover:text-white text-lg">×</button>
            </div>
            
            <form onSubmit={submitCreate} className="p-6 space-y-4">
              
              {/* Warnings & Real-time validation feedback */}
              {validationError && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/35 text-rose-400 text-xs rounded-lg flex items-start gap-2.5">
                  <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              {workloadWarning && !validationError && (
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/35 text-amber-400 text-xs rounded-lg flex items-start gap-2.5">
                  <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                  <span>{workloadWarning}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                
                {/* Department */}
                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Department</label>
                  <select
                    required
                    value={formDept}
                    onChange={(e) => {
                      setFormDept(e.target.value);
                      setFormSubject("");
                      setFormFaculty("");
                    }}
                    className="w-full px-3 py-2 rounded-lg border dark:border-neutral-800 border-border-subtle bg-surface text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Select Department</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                </div>

                {/* Program/Curriculum */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Curriculum Program</label>
                  <select
                    required
                    value={formProgram}
                    onChange={(e) => setFormProgram(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border dark:border-neutral-800 border-border-subtle bg-surface text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Select Program</option>
                    {programs
                      .filter(p => !formDept || p.departmentId === formDept || p.department?.id === formDept)
                      .map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                  </select>
                </div>

                {/* Semester */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Semester</label>
                  <select
                    required
                    value={formSemester}
                    onChange={(e) => setFormSemester(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border dark:border-neutral-800 border-border-subtle bg-surface text-xs focus:outline-none focus:border-indigo-500"
                  >
                    {[1,2,3,4,5,6,7,8].map((s) => (
                      <option key={s} value={s}>Semester {s}</option>
                    ))}
                  </select>
                </div>

                {/* Subject Selector */}
                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Subject</label>
                  <select
                    required
                    value={formSubject}
                    disabled={!formDept}
                    onChange={(e) => setFormSubject(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border dark:border-neutral-800 border-border-subtle bg-surface text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Select Subject</option>
                    {filteredModalSubjects.map((sub) => (
                      <option key={sub.id} value={sub.id}>{sub.code} - {sub.name}</option>
                    ))}
                  </select>
                  {!formDept && (
                    <span className="text-[9px] text-text-muted block mt-0.5">Please select a department first to narrow subject list.</span>
                  )}
                </div>

                {/* Section */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Section</label>
                  <select
                    required
                    value={formSection}
                    onChange={(e) => setFormSection(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border dark:border-neutral-800 border-border-subtle bg-surface text-xs focus:outline-none focus:border-indigo-500"
                  >
                    {["A", "B", "C", "D"].map((s) => (
                      <option key={s} value={s}>Section {s}</option>
                    ))}
                  </select>
                </div>

                {/* Status */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Initial Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border dark:border-neutral-800 border-border-subtle bg-surface text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                {/* Faculty Selector */}
                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Faculty Member</label>
                  <select
                    required
                    value={formFaculty}
                    disabled={!formDept}
                    onChange={(e) => setFormFaculty(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border dark:border-neutral-800 border-border-subtle bg-surface text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Select Faculty Member</option>
                    {filteredModalFaculty.map((f) => (
                      <option key={f.id} value={f.id}>{f.fullName || f.full_name} ({f.employeeNumber})</option>
                    ))}
                  </select>
                </div>

                {/* Notes */}
                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Notes (Optional)</label>
                  <textarea
                    rows={2}
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="Enter additional remarks..."
                    className="w-full px-3 py-2 rounded-lg border dark:border-neutral-800 border-border-subtle bg-surface text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 border-t dark:border-neutral-800 border-border-subtle pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border dark:border-neutral-800 border-border-subtle rounded-lg text-xs font-semibold hover:bg-neutral-800/10 dark:hover:bg-neutral-800/30"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!!validationError}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirm Allocation
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ── EDIT ALLOCATION MODAL ── */}
      {showEditModal && selectedAlloc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b dark:border-neutral-800 border-border-subtle flex items-center justify-between">
              <h3 className="font-display font-bold text-base dark:text-white text-text-primary">Edit Allocation Profile</h3>
              <button onClick={() => setShowEditModal(false)} className="text-text-muted hover:text-white text-lg">×</button>
            </div>
            
            <form onSubmit={submitEdit} className="p-6 space-y-4">
              
              {validationError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[11px] rounded-lg flex items-start gap-2">
                  <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              {workloadWarning && !validationError && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] rounded-lg flex items-start gap-2">
                  <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                  <span>{workloadWarning}</span>
                </div>
              )}

              <div className="space-y-4">
                
                {/* Details summary */}
                <div className="p-3 dark:bg-neutral-900 bg-neutral-50 rounded-lg space-y-1.5 text-xs text-text-secondary border dark:border-neutral-800 border-border-subtle">
                  <div>Subject: <span className="font-bold text-text-primary">{selectedAlloc.subjectName} ({selectedAlloc.subjectCode})</span></div>
                  <div>Year: <span className="font-bold text-text-primary">{selectedAlloc.academicYear}</span></div>
                </div>

                {/* Faculty */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Assigned Faculty</label>
                  <select
                    value={formFaculty}
                    onChange={(e) => setFormFaculty(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border dark:border-neutral-800 border-border-subtle bg-surface text-xs focus:outline-none"
                  >
                    {faculty
                      .filter(f => f.departmentId === selectedAlloc.departmentId || f.department?.id === selectedAlloc.departmentId)
                      .map((f) => (
                        <option key={f.id} value={f.id}>{f.fullName || f.full_name} ({f.employeeNumber})</option>
                      ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  
                  {/* Section */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Section</label>
                    <select
                      value={formSection}
                      onChange={(e) => setFormSection(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border dark:border-neutral-800 border-border-subtle bg-surface text-xs focus:outline-none"
                    >
                      {["A", "B", "C", "D"].map((s) => (
                        <option key={s} value={s}>Section {s}</option>
                      ))}
                    </select>
                  </div>

                  {/* Status */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Status</label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-lg border dark:border-neutral-800 border-border-subtle bg-surface text-xs focus:outline-none"
                    >
                      <option value="active">Active</option>
                      <option value="pending">Pending</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>

                </div>

              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 border-t dark:border-neutral-800 border-border-subtle pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border dark:border-neutral-800 border-border-subtle rounded-lg text-xs font-semibold hover:bg-neutral-800/10 dark:hover:bg-neutral-800/30"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!!validationError}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow-sm"
                >
                  Save Changes
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ── TRANSFER ALLOCATION MODAL ── */}
      {showTransferModal && selectedAlloc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl shadow-2xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b dark:border-neutral-800 border-border-subtle flex items-center justify-between">
              <h3 className="font-display font-bold text-base dark:text-white text-text-primary">Transfer Subject</h3>
              <button onClick={() => setShowTransferModal(false)} className="text-text-muted hover:text-white text-lg">×</button>
            </div>
            
            <form onSubmit={submitTransfer} className="p-6 space-y-4">
              
              {validationError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[11px] rounded-lg flex items-start gap-2">
                  <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              {workloadWarning && !validationError && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] rounded-lg flex items-start gap-2">
                  <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                  <span>{workloadWarning}</span>
                </div>
              )}

              <div className="space-y-4">
                
                {/* Allocation detail mapping */}
                <div className="p-3.5 bg-neutral-500/5 border dark:border-neutral-800/80 border-border-subtle rounded-lg text-xs space-y-1.5 text-text-secondary">
                  <div>Subject Code: <span className="font-bold text-text-primary">{selectedAlloc.subjectCode}</span></div>
                  <div>Subject Name: <span className="font-semibold text-text-primary">{selectedAlloc.subjectName}</span></div>
                  <div>Section: <span className="font-semibold text-text-primary">{selectedAlloc.section}</span></div>
                  <div>Current Faculty: <span className="font-semibold text-text-primary">{selectedAlloc.facultyName}</span></div>
                </div>

                {/* Target Faculty */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Target Faculty Member</label>
                  <select
                    required
                    value={formFaculty}
                    onChange={(e) => setFormFaculty(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border dark:border-neutral-800 border-border-subtle bg-surface text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Select New Faculty</option>
                    {faculty
                      .filter(f => f.id !== selectedAlloc.facultyId && (f.departmentId === selectedAlloc.departmentId || f.department?.id === selectedAlloc.departmentId))
                      .map((f) => (
                        <option key={f.id} value={f.id}>{f.fullName || f.full_name} ({f.employeeNumber})</option>
                      ))}
                  </select>
                </div>

              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 border-t dark:border-neutral-800 border-border-subtle pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 border dark:border-neutral-800 border-border-subtle rounded-lg text-xs font-semibold hover:bg-neutral-800/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!formFaculty || !!validationError}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow-sm"
                >
                  Transfer Subject
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ── REMOVE ALLOCATION MODAL (Soft Delete) ── */}
      {showDeleteModal && selectedAlloc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl shadow-2xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b dark:border-neutral-800 border-border-subtle flex items-center justify-between">
              <h3 className="font-display font-bold text-base text-rose-500 flex items-center gap-1.5">
                <Trash2 size={16} />
                <span>Remove Allocation</span>
              </h3>
              <button onClick={() => setShowDeleteModal(false)} className="text-text-muted hover:text-white text-lg">×</button>
            </div>
            
            <form onSubmit={submitDelete} className="p-6 space-y-4">
              
              <p className="text-xs text-text-secondary leading-relaxed">
                You are about to soft-delete the allocation for <span className="font-bold text-text-primary">{selectedAlloc.subjectName} (Sec {selectedAlloc.section})</span> assigned to <span className="font-bold text-text-primary">{selectedAlloc.facultyName}</span>.
              </p>
              
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-[10px] text-rose-400 font-medium leading-relaxed rounded-lg">
                WARNING: Deactivating this allocation will restrict the faculty member from entering attendance, uploading materials, or posting test grades for this section immediately.
              </div>

              {/* Reason */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Reason for Removal</label>
                <textarea
                  required
                  rows={3}
                  value={formReason}
                  placeholder="e.g. Workload reallocation, faculty reassigned..."
                  onChange={(e) => setFormReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border dark:border-neutral-800 border-border-subtle bg-surface text-xs focus:outline-none focus:border-rose-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 border-t dark:border-neutral-800 border-border-subtle pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 border dark:border-neutral-800 border-border-subtle rounded-lg text-xs font-semibold hover:bg-neutral-800/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!formReason}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg shadow-sm"
                >
                  Remove Subject
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ── VIEW ALLOCATION DETAIL MODAL ── */}
      {showViewModal && selectedAlloc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b dark:border-neutral-800 border-border-subtle flex items-center justify-between">
              <h3 className="font-display font-bold text-base dark:text-white text-text-primary">Allocation Audit details</h3>
              <button onClick={() => setShowViewModal(false)} className="text-text-muted hover:text-white text-lg">×</button>
            </div>
            
            <div className="p-6 space-y-4 text-xs text-text-secondary">
              
              <div className="grid grid-cols-2 gap-4 pb-4 border-b dark:border-neutral-800 border-border-subtle">
                <div>
                  <div className="text-[10px] font-bold text-text-muted uppercase">Faculty Member</div>
                  <div className="font-bold text-text-primary mt-0.5">{selectedAlloc.facultyName}</div>
                  <div className="text-[10px] text-text-muted">ID: {selectedAlloc.employeeNumber}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-text-muted uppercase">Subject Details</div>
                  <div className="font-bold text-text-primary mt-0.5">{selectedAlloc.subjectName}</div>
                  <div className="text-[10px] text-text-muted">Code: {selectedAlloc.subjectCode}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pb-4 border-b dark:border-neutral-800 border-border-subtle">
                <div>
                  <div className="text-[10px] font-bold text-text-muted uppercase">Semester & Section</div>
                  <div className="font-bold text-text-primary mt-0.5">Semester {selectedAlloc.semester} • Section {selectedAlloc.section}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-text-muted uppercase">Academic Session</div>
                  <div className="font-bold text-text-primary mt-0.5">{selectedAlloc.academicYear}</div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-text-muted uppercase">Audit History</h4>
                
                <div className="p-3 dark:bg-neutral-900 bg-neutral-50 rounded-lg border dark:border-neutral-800 border-border-subtle space-y-2">
                  <div>
                    <span className="text-text-muted">Created:</span> {new Date(selectedAlloc.createdAt).toLocaleString()} 
                    {selectedAlloc.createdByName && ` by ${selectedAlloc.createdByName}`}
                  </div>
                  <div>
                    <span className="text-text-muted">Last Updated:</span> {new Date(selectedAlloc.updatedAt).toLocaleString()}
                  </div>
                  {selectedAlloc.status === 'inactive' && selectedAlloc.removedAt && (
                    <div className="text-rose-400 border-t dark:border-neutral-800 border-border-subtle pt-2 mt-2">
                      <div className="font-semibold">Soft-Removed Details:</div>
                      <div>Date: {new Date(selectedAlloc.removedAt).toLocaleString()}</div>
                      {selectedAlloc.removedByName && <div>Actor: {selectedAlloc.removedByName}</div>}
                      {selectedAlloc.removalReason && <div className="mt-1 italic">Reason: "{selectedAlloc.removalReason}"</div>}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end border-t dark:border-neutral-800 border-border-subtle pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowViewModal(false)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow-sm"
                >
                  Dismiss Window
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};
