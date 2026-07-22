"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import type { SubjectSummary, ImportErrorLog, ImportCommitResult } from "@/types/subject";
import {
  Plus,
  Upload,
  Download,
  Search,
  Filter,
  Trash2,
  Edit,
  Eye,
  Archive,
  Check,
  X,
  AlertCircle,
  Loader2,
  BookOpen,
  Database,
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
  BookOpenCheck,
  Building,
  HelpCircle,
  FileSpreadsheet
} from "lucide-react";

interface SubjectCatalogManagerProps {
  mode: "admin" | "hod";
}

export default function SubjectCatalogManager({ mode }: SubjectCatalogManagerProps) {
  const router = useRouter();
  const { accessToken, user } = useAuth();

  // ── States: Lists and Pagination ──
  const [subjects, setSubjects] = useState<SubjectSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [totalSubjectsCount, setTotalSubjectsCount] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const limit = 15;

  // ── States: Stats Metrics (loaded once across all subjects) ──
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    core: 0,
    lab: 0,
    elective: 0,
    mandatory: 0,
    departmentsCount: 0,
  });

  // ── States: Dropdowns Reference Data ──
  const [departments, setDepartments] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);

  // ── States: Filters ──
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedDept, setSelectedDept] = useState<string>("ALL");
  const [selectedProgram, setSelectedProgram] = useState<string>("ALL");
  const [selectedRegulation, setSelectedRegulation] = useState<string>("ALL");
  const [selectedYear, setSelectedYear] = useState<string>("ALL");
  const [selectedSem, setSelectedSem] = useState<string>("ALL");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");

  // ── States: Modal Modals ──
  const [showAddEditModal, setShowAddEditModal] = useState<boolean>(false);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [showWipeConfirm, setShowWipeConfirm] = useState<boolean>(false);
  const [wipeLoading, setWipeLoading] = useState<boolean>(false);
  const [subjectToDelete, setSubjectToDelete] = useState<SubjectSummary | null>(null);
  const [deleteWarningMessage, setDeleteWarningMessage] = useState<string | null>(null);

  // ── States: Manual Form Inputs ──
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formDeptId, setFormDeptId] = useState("");
  const [formProgId, setFormProgId] = useState("");
  const [formProgramText, setFormProgramText] = useState("");
  const [formRegulation, setFormRegulation] = useState("R22");
  const [formYear, setFormYear] = useState("I");
  const [formSemRaw, setFormSemRaw] = useState("I");
  const [formLectureHours, setFormLectureHours] = useState(3);
  const [formTutorialHours, setFormTutorialHours] = useState(0);
  const [formPracticalHours, setFormPracticalHours] = useState(0);
  const [formCredits, setFormCredits] = useState(3);
  const [formType, setFormType] = useState("core");
  const [formStatus, setFormStatus] = useState("active");
  const [formDescription, setFormDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // ── States: Import spreadsheet ──
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState<boolean>(false);
  const [importPreviewData, setImportPreviewData] = useState<any[]>([]);
  const [importFailedRows, setImportFailedRows] = useState<ImportErrorLog[]>([]);
  const [importSummary, setImportSummary] = useState<any | null>(null);
  const [importResultSummary, setImportResultSummary] = useState<ImportCommitResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Notifications ──
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Fetch Reference Dropdowns ──
  useEffect(() => {
    const fetchRefs = async () => {
      if (!accessToken) return;
      try {
        const [deptRes, progRes] = await Promise.all([
          apiFetch("/departments", {}, accessToken),
          apiFetch("/departments/programs/list", {}, accessToken),
        ]);
        if (deptRes.success) setDepartments(deptRes.data.departments || []);
        if (progRes.success) setPrograms(progRes.data.programs || []);
      } catch (err) {
        console.error("Error loading dropdown data references", err);
      }
    };
    fetchRefs();
  }, [accessToken]);

  // Lock HOD filter
  useEffect(() => {
    if (mode === "hod" && user?.departmentId) {
      setSelectedDept(user.departmentId);
    }
  }, [mode, user]);

  // ── Fetch Main Subjects List ──
  const fetchSubjectsList = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      queryParams.append("page", String(currentPage));
      queryParams.append("limit", String(limit));

      if (selectedDept !== "ALL") queryParams.append("departmentId", selectedDept);
      if (selectedProgram !== "ALL") queryParams.append("program", selectedProgram);
      if (selectedRegulation !== "ALL") queryParams.append("regulation", selectedRegulation);
      if (selectedYear !== "ALL") queryParams.append("year", selectedYear);
      if (selectedSem !== "ALL") queryParams.append("semester", selectedSem);
      if (selectedType !== "ALL") queryParams.append("type", selectedType);
      if (selectedStatus !== "ALL") queryParams.append("status", selectedStatus);
      if (searchQuery.trim() !== "") queryParams.append("search", searchQuery.trim());

      const res = await apiFetch(`/subjects?${queryParams.toString()}`, {}, accessToken);
      if (res.success && res.data) {
        setSubjects(res.data.subjects || []);
        setTotalPages(res.data.pagination?.totalPages || 1);
        setTotalSubjectsCount(res.data.pagination?.total || 0);
      }
    } catch (err) {
      console.error(err);
      showToast("Error retrieving subjects registry.", "error");
    } finally {
      setLoading(false);
    }
  }, [accessToken, currentPage, selectedDept, selectedProgram, selectedRegulation, selectedYear, selectedSem, selectedType, selectedStatus, searchQuery]);

  // ── Fetch Dashboard Summary Stats (Once, or when changes happen) ──
  const fetchDashboardStats = useCallback(async () => {
    if (!accessToken) return;
    try {
      // Query with massive limit to fetch everything and calculate aggregations
      const queryParams = new URLSearchParams();
      queryParams.append("page", "1");
      queryParams.append("limit", "1000"); // safety cap to grab all
      if (mode === "hod" && user?.departmentId) {
        queryParams.append("departmentId", user.departmentId);
      }

      const res = await apiFetch(`/subjects?${queryParams.toString()}`, {}, accessToken);
      if (res.success && res.data?.subjects) {
        const list: SubjectSummary[] = res.data.subjects;
        
        const deptsSet = new Set(list.map(s => s.departmentName));
        
        setStats({
          total: list.length,
          active: list.filter(s => s.status === 'active').length,
          inactive: list.filter(s => s.status === 'inactive').length,
          core: list.filter(s => s.type === 'core').length,
          lab: list.filter(s => s.type === 'lab').length,
          elective: list.filter(s => s.type === 'elective').length,
          mandatory: list.filter(s => s.type === 'mandatory').length,
          departmentsCount: deptsSet.size,
        });
      }
    } catch (err) {
      console.error(err);
    }
  }, [accessToken, mode, user]);

  useEffect(() => {
    fetchSubjectsList();
  }, [fetchSubjectsList]);

  useEffect(() => {
    fetchDashboardStats();
  }, [fetchDashboardStats]);

  const handleResetFilters = () => {
    setSearchQuery("");
    if (mode === "admin") setSelectedDept("ALL");
    setSelectedProgram("ALL");
    setSelectedRegulation("ALL");
    setSelectedYear("ALL");
    setSelectedSem("ALL");
    setSelectedType("ALL");
    setSelectedStatus("ALL");
    setCurrentPage(1);
  };

  // ── Manual Add / Edit Modal Controls ──
  const openAddModal = () => {
    setEditingSubjectId(null);
    setFormCode("");
    setFormName("");
    setFormDeptId(departments[0]?.id || "");
    setFormProgId("");
    setFormProgramText("");
    setFormRegulation("R22");
    setFormYear("I");
    setFormSemRaw("I");
    setFormLectureHours(3);
    setFormTutorialHours(0);
    setFormPracticalHours(0);
    setFormCredits(3);
    setFormType("core");
    setFormStatus("active");
    setFormDescription("");
    setFormError(null);
    setShowAddEditModal(true);
  };

  const openEditModal = async (subjectSummary: SubjectSummary) => {
    setFormError(null);
    setEditingSubjectId(subjectSummary.id);
    try {
      const res = await apiFetch(`/subjects/${subjectSummary.id}`, {}, accessToken);
      if (res.success && res.data?.subject) {
        const s = res.data.subject;
        setFormCode(s.code);
        setFormName(s.name);
        setFormDeptId(s.department.id);
        setFormProgId(s.program?.id || "");
        setFormProgramText(s.programName || "");
        setFormRegulation(s.regulation || "R22");
        setFormYear(s.year || "I");
        setFormSemRaw(s.semesterRaw || "I");
        setFormLectureHours(s.lectureHours || 0);
        setFormTutorialHours(s.tutorialHours || 0);
        setFormPracticalHours(s.practicalHours || 0);
        setFormCredits(s.credits);
        setFormType(s.type);
        setFormStatus(s.status);
        setFormDescription(s.description || "");
        setShowAddEditModal(true);
      } else {
        showToast("Failed to fetch subject details", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error loading subject properties", "error");
    }
  };

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCode.trim()) return setFormError("Subject Code is required");
    if (!formName.trim()) return setFormError("Subject Name is required");
    if (!formDeptId) return setFormError("Department is required");
    if (isNaN(formCredits) || formCredits < 0) return setFormError("Credits must be a number >= 0");

    setFormSubmitting(true);
    setFormError(null);

    const payload = {
      code: formCode.trim().toUpperCase(),
      name: formName.trim(),
      departmentId: formDeptId,
      programId: formProgId || null,
      program: formProgramText.trim() || null,
      regulation: formRegulation.trim(),
      year: formYear,
      semesterRaw: formSemRaw,
      lectureHours: Number(formLectureHours || 0),
      tutorialHours: Number(formTutorialHours || 0),
      practicalHours: Number(formPracticalHours || 0),
      credits: Number(formCredits),
      type: formType,
      status: formStatus,
      description: formDescription.trim() || null,
    };

    try {
      let res;
      if (editingSubjectId) {
        res = await apiFetch(`/subjects/${editingSubjectId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        }, accessToken);
      } else {
        res = await apiFetch("/subjects", {
          method: "POST",
          body: JSON.stringify(payload),
        }, accessToken);
      }

      if (res.success) {
        showToast(editingSubjectId ? "Subject updated successfully" : "Subject created successfully");
        setShowAddEditModal(false);
        fetchSubjectsList();
        fetchDashboardStats();
      } else {
        setFormError(res.message || "Failed to save subject. Check code uniqueness.");
      }
    } catch (err) {
      console.error(err);
      setFormError("Communication error with server.");
    } finally {
      setFormSubmitting(false);
    }
  };

  // ── Archive & Status toggles ──
  const toggleSubjectStatus = async (s: SubjectSummary) => {
    const nextStatus = s.status === "active" ? "inactive" : "active";
    try {
      const res = await apiFetch(`/subjects/${s.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      }, accessToken);
      if (res.success) {
        showToast(`Subject marked as ${nextStatus}`);
        fetchSubjectsList();
        fetchDashboardStats();
      } else {
        showToast(res.message || "Failed to update subject status", "error");
      }
    } catch (err) {
      showToast("Error updating status.", "error");
    }
  };

  // ── Delete Subject (Soft Delete Check) ──
  const initiateDelete = (s: SubjectSummary) => {
    setSubjectToDelete(s);
    setDeleteWarningMessage(null);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteSubject = async () => {
    if (!subjectToDelete) return;
    try {
      const res = await apiFetch(`/subjects/${subjectToDelete.id}`, {
        method: "DELETE",
      }, accessToken);

      if (res.success) {
        showToast("Subject archived successfully.");
        setShowDeleteConfirm(false);
        setSubjectToDelete(null);
        fetchSubjectsList();
        fetchDashboardStats();
      } else {
        // Check if backend returned use-case warning block
        if (res.code === "SUBJECT_IN_USE") {
          setDeleteWarningMessage(res.message || "This subject is currently in use and cannot be deleted. Please mark it as Inactive instead.");
        } else {
          showToast(res.message || "Failed to delete subject.", "error");
        }
      }
    } catch (err) {
      console.error(err);
      showToast("Error executing deletion.", "error");
    }
  };

  const handleWipeAllSubjects = async () => {
    setWipeLoading(true);
    try {
      const res = await apiFetch("/subjects/all/wipe", {
        method: "DELETE",
      }, accessToken);

      if (res.success) {
        showToast(res.message || "Subjects wiped successfully.");
        setShowWipeConfirm(false);
        fetchSubjectsList();
        fetchDashboardStats();
      } else {
        showToast(res.message || "Failed to wipe subjects", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error wiping subjects.", "error");
    } finally {
      setWipeLoading(false);
    }
  };

  // ── Export Catalog Handler ──
  const handleExport = (format: "excel" | "csv" | "pdf") => {
    if (!accessToken) return;
    const queryParams = new URLSearchParams();
    queryParams.append("format", format === "excel" ? "xlsx" : format);
    queryParams.append("token", accessToken);

    if (selectedDept !== "ALL") queryParams.append("departmentId", selectedDept);
    if (selectedProgram !== "ALL") queryParams.append("program", selectedProgram);
    if (selectedRegulation !== "ALL") queryParams.append("regulation", selectedRegulation);
    if (selectedYear !== "ALL") queryParams.append("year", selectedYear);
    if (selectedSem !== "ALL") queryParams.append("semester", selectedSem);
    if (selectedType !== "ALL") queryParams.append("type", selectedType);
    if (selectedStatus !== "ALL") queryParams.append("status", selectedStatus);
    if (searchQuery) queryParams.append("search", searchQuery);

    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
    window.open(`${backendUrl}/subjects/export?${queryParams.toString()}`, "_blank");
  };

  // ── Excel Spreadsheet Imports Preview and commit ──
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setImportLoading(true);
    setImportPreviewData([]);
    setImportFailedRows([]);
    setImportSummary(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"}/subjects/import/preview`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          body: formData,
        }
      );
      const data = await res.json();
      if (data.success && data.data?.preview) {
        const previewObj = data.data.preview;
        setImportPreviewData(previewObj.validRows || []);
        setImportFailedRows(previewObj.failedRows || []);
        setImportSummary(previewObj.summary || null);
      } else {
        showToast(data.message || "Failed to validate file. Check columns structure.", "error");
        setImportFile(null);
      }
    } catch (err) {
      console.error(err);
      showToast("Error transmitting file.", "error");
      setImportFile(null);
    } finally {
      setImportLoading(false);
    }
  };

  const handleCommitImport = async () => {
    if (importPreviewData.length === 0) return;
    setImportLoading(true);
    try {
      const res = await apiFetch("/subjects/import", {
        method: "POST",
        body: JSON.stringify({ rows: importPreviewData }),
      }, accessToken);
      
      if (res.success && res.data) {
        setImportResultSummary(res.data);
        showToast("Excel Import completed successfully!");
        fetchSubjectsList();
        fetchDashboardStats();
      } else {
        showToast(res.message || "Error saving spreadsheet records", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Communication error during import commit.", "error");
    } finally {
      setImportLoading(false);
    }
  };

  const downloadErrorReport = () => {
    if (importFailedRows.length === 0) return;
    const headers = "Row Number,Subject Code,Error\r\n";
    const rows = importFailedRows
      .map(e => `${e.rowNumber},${e.subjectCode},"${e.error.replace(/"/g, '""')}"`)
      .join("\r\n");
    
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `subject_import_errors_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearImportState = () => {
    setImportFile(null);
    setImportPreviewData([]);
    setImportFailedRows([]);
    setImportSummary(null);
    setImportResultSummary(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-lg border text-xs font-semibold shadow-lg transition-all animate-bounce ${
          toast.type === "success" 
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
            : "bg-rose-500/10 border-rose-500/20 text-rose-400"
        }`}>
          <AlertCircle size={16} />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-[9px] uppercase font-bold text-indigo-500 tracking-wider font-mono">
            Academic Operations
          </span>
          <h2 className="font-display font-bold text-xl dark:text-white text-text-primary flex items-center gap-2">
            <BookOpen size={20} className="dark:text-neutral-400 text-text-muted" />
            <span>Subjects Master Catalog</span>
          </h2>
          <p className="text-[10px] dark:text-neutral-400 text-text-secondary">
            Manage course codes, regulations, credits parameters, and import department curricula catalogs.
          </p>
        </div>

        {/* Toolbar primary actions (Admin Only) */}
        {mode === "admin" && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowWipeConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/25 dark:border-neutral-800 dark:bg-neutral-900 bg-white text-rose-500 hover:bg-rose-500/10 transition-all font-semibold text-xs shadow-sm shadow-rose-500/5"
            >
              <Trash2 size={14} className="text-rose-500" />
              <span>Delete All</span>
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border dark:border-neutral-800 border-border-subtle dark:bg-neutral-900 bg-white dark:text-neutral-300 text-text-primary hover:border-indigo-500/30 transition-all font-semibold text-xs"
            >
              <Upload size={14} className="text-indigo-400" />
              <span>Import Subjects</span>
            </button>
            <button
              onClick={openAddModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-all font-semibold text-xs shadow-sm shadow-indigo-600/15"
            >
              <Plus size={14} />
              <span>Add Subject</span>
            </button>
          </div>
        )}
      </div>

      {/* Dashboard Analytics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        
        <div className="glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider block">Total</span>
          <span className="font-display font-bold text-lg dark:text-white text-text-primary mt-2">{stats.total}</span>
        </div>

        <div className="glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">Active</span>
          <span className="font-display font-bold text-lg text-emerald-400 mt-2">{stats.active}</span>
        </div>

        <div className="glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider block">Inactive</span>
          <span className="font-display font-bold text-lg text-rose-400 mt-2">{stats.inactive}</span>
        </div>

        <div className="glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider block">Core</span>
          <span className="font-display font-bold text-lg text-indigo-400 mt-2">{stats.core}</span>
        </div>

        <div className="glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[10px] text-sky-400 font-bold uppercase tracking-wider block">Lab Courses</span>
          <span className="font-display font-bold text-lg text-sky-400 mt-2">{stats.lab}</span>
        </div>

        <div className="glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">Electives</span>
          <span className="font-display font-bold text-lg text-amber-400 mt-2">{stats.elective}</span>
        </div>

        <div className="glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider block">Mandatory</span>
          <span className="font-display font-bold text-lg text-purple-400 mt-2">{stats.mandatory}</span>
        </div>

        <div className="glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider block">Departments</span>
          <span className="font-display font-bold text-lg dark:text-white text-text-primary mt-2">{stats.departmentsCount}</span>
        </div>

      </div>

      {/* Filters Toolbar */}
      <div className="glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl p-4 space-y-4">
        
        {/* Search, Export row */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 text-text-muted" size={16} />
            <input
              type="text"
              placeholder="Search by subject code or subject name..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 border dark:border-neutral-800 border-border-subtle rounded-lg dark:bg-neutral-950/40 bg-background text-xs text-text-primary focus:border-indigo-500 transition-all outline-none"
            />
          </div>

          {/* Export Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-text-muted font-bold uppercase">Export:</span>
            <button
              onClick={() => handleExport("excel")}
              className="px-2.5 py-1 border dark:border-neutral-800 border-border-subtle rounded text-[11px] font-semibold flex items-center gap-1 dark:bg-neutral-900 bg-white text-text-secondary hover:border-indigo-500/30 transition-all"
            >
              <Download size={10} />
              <span>Excel</span>
            </button>
            <button
              onClick={() => handleExport("csv")}
              className="px-2.5 py-1 border dark:border-neutral-800 border-border-subtle rounded text-[11px] font-semibold flex items-center gap-1 dark:bg-neutral-900 bg-white text-text-secondary hover:border-indigo-500/30 transition-all"
            >
              <Download size={10} />
              <span>CSV</span>
            </button>
            <button
              onClick={() => handleExport("pdf")}
              className="px-2.5 py-1 border dark:border-neutral-800 border-border-subtle rounded text-[11px] font-semibold flex items-center gap-1 dark:bg-neutral-900 bg-white text-text-secondary hover:border-indigo-500/30 transition-all"
            >
              <Download size={10} />
              <span>PDF</span>
            </button>
            <button
              onClick={handleResetFilters}
              className="ml-2 text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
            >
              Reset Filters
            </button>
          </div>
        </div>

        {/* Dropdowns filters */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 lg:grid-cols-7 gap-3 text-xs">
          
          {/* Department filter (Admin only, HOD is locked) */}
          <div>
            <label className="text-[10px] text-text-muted uppercase font-bold block mb-1">Department</label>
            <select
              value={selectedDept}
              disabled={mode === "hod"}
              onChange={(e) => {
                setSelectedDept(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full p-2 border dark:border-neutral-800 border-border-subtle rounded-lg dark:bg-neutral-950 bg-background text-text-primary"
            >
              <option value="ALL">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.code}</option>
              ))}
            </select>
          </div>

          {/* Program filter */}
          <div>
            <label className="text-[10px] text-text-muted uppercase font-bold block mb-1">Program</label>
            <select
              value={selectedProgram}
              onChange={(e) => {
                setSelectedProgram(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full p-2 border dark:border-neutral-800 border-border-subtle rounded-lg dark:bg-neutral-950 bg-background text-text-primary"
            >
              <option value="ALL">All Programs</option>
              <option value="BTCS">BTCS</option>
              <option value="BTEC">BTEC</option>
              <option value="BTEE">BTEE</option>
              <option value="BTME">BTME</option>
              <option value="BTCIVIL">BTCIVIL</option>
              <option value="MBA">MBA</option>
              <option value="MCA">MCA</option>
            </select>
          </div>

          {/* Regulation filter */}
          <div>
            <label className="text-[10px] text-text-muted uppercase font-bold block mb-1">Regulation</label>
            <select
              value={selectedRegulation}
              onChange={(e) => {
                setSelectedRegulation(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full p-2 border dark:border-neutral-800 border-border-subtle rounded-lg dark:bg-neutral-950 bg-background text-text-primary"
            >
              <option value="ALL">All Regulations</option>
              <option value="R22">R22</option>
              <option value="R26">R26</option>
              <option value="R28">R28</option>
            </select>
          </div>

          {/* Year filter */}
          <div>
            <label className="text-[10px] text-text-muted uppercase font-bold block mb-1">Year</label>
            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full p-2 border dark:border-neutral-800 border-border-subtle rounded-lg dark:bg-neutral-950 bg-background text-text-primary"
            >
              <option value="ALL">All Years</option>
              <option value="I">Year I</option>
              <option value="II">Year II</option>
              <option value="III">Year III</option>
              <option value="IV">Year IV</option>
            </select>
          </div>

          {/* Semester filter */}
          <div>
            <label className="text-[10px] text-text-muted uppercase font-bold block mb-1">Semester</label>
            <select
              value={selectedSem}
              onChange={(e) => {
                setSelectedSem(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full p-2 border dark:border-neutral-800 border-border-subtle rounded-lg dark:bg-neutral-950 bg-background text-text-primary"
            >
              <option value="ALL">All Semesters</option>
              <option value="1">Sem 1</option>
              <option value="2">Sem 2</option>
              <option value="3">Sem 3</option>
              <option value="4">Sem 4</option>
              <option value="5">Sem 5</option>
              <option value="6">Sem 6</option>
              <option value="7">Sem 7</option>
              <option value="8">Sem 8</option>
            </select>
          </div>

          {/* Subject Type filter */}
          <div>
            <label className="text-[10px] text-text-muted uppercase font-bold block mb-1">Subject Type</label>
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full p-2 border dark:border-neutral-800 border-border-subtle rounded-lg dark:bg-neutral-950 bg-background text-text-primary"
            >
              <option value="ALL">All Types</option>
              <option value="core">Core</option>
              <option value="lab">Laboratory</option>
              <option value="elective">Elective</option>
              <option value="mandatory">Mandatory</option>
              <option value="project">Project</option>
              <option value="workshop">Workshop</option>
            </select>
          </div>

          {/* Status filter */}
          <div>
            <label className="text-[10px] text-text-muted uppercase font-bold block mb-1">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full p-2 border dark:border-neutral-800 border-border-subtle rounded-lg dark:bg-neutral-950 bg-background text-text-primary"
            >
              <option value="ALL">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

        </div>

      </div>

      {/* Main Subjects Table */}
      <div className="glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl overflow-hidden">
        
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <Loader2 className="animate-spin text-indigo-500" size={32} />
            <span className="text-xs text-text-secondary">Loading subject master registry...</span>
          </div>
        ) : subjects.length === 0 ? (
          <div className="py-24 text-center space-y-2">
            <Database className="mx-auto text-text-muted" size={40} />
            <h4 className="font-bold text-sm dark:text-white text-text-primary">No Subjects Found</h4>
            <p className="text-xs text-text-muted max-w-sm mx-auto">No subjects matching your selection were found. Modify your filters or add subjects manually.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b dark:border-neutral-800 border-border-subtle dark:bg-neutral-900/40 bg-neutral-50/50 text-[10px] uppercase font-bold text-text-muted tracking-wider">
                  <th className="p-4">Subject Code</th>
                  <th className="p-4">Subject Name</th>
                  <th className="p-4">Department</th>
                  <th className="p-4">Program</th>
                  <th className="p-4">Regulation</th>
                  <th className="p-4">Year/Sem</th>
                  <th className="p-4 text-center">Credits</th>
                  <th className="p-4 text-center">L - T - P</th>
                  <th className="p-4">Subject Type</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-neutral-800/80 divide-border-subtle">
                {subjects.map((sub) => (
                  <tr key={sub.id} className="hover:dark:bg-neutral-900/20 hover:bg-neutral-50/30 transition-colors">
                    <td className="p-4 font-mono font-bold dark:text-indigo-400 text-indigo-600">{sub.code}</td>
                    <td className="p-4 font-semibold dark:text-white text-text-primary">{sub.name}</td>
                    <td className="p-4 text-text-secondary">
                      {sub.departmentName || (sub.mappings && sub.mappings.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {Array.from(new Set(sub.mappings.map(m => m.departmentCode))).map((code, idx) => (
                            <span key={idx} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase">
                              {code}
                            </span>
                          ))}
                        </div>
                      ) : "—")}
                    </td>
                    <td className="p-4 text-text-secondary font-mono">
                      {sub.programName || (sub.mappings && sub.mappings.length > 0 ? (
                        <span className="text-[10px] bg-neutral-500/10 text-neutral-400 px-1.5 py-0.5 rounded border border-neutral-500/20 font-sans font-bold">
                          {sub.mappings.length} {sub.mappings.length === 1 ? "Mapping" : "Mappings"}
                        </span>
                      ) : "—")}
                    </td>
                    <td className="p-4 font-mono text-text-secondary">
                      {sub.regulation || (sub.mappings && sub.mappings.length > 0 ? Array.from(new Set(sub.mappings.map(m => m.regulation))).join(", ") : "—")}
                    </td>
                    <td className="p-4 text-text-secondary">
                      {sub.year ? (
                        `Year ${sub.year} • Sem ${sub.semesterRaw || "N/A"} (Sem ${sub.semester})`
                      ) : (sub.mappings && sub.mappings.length > 0 ? (
                        <span className="text-[10px] font-semibold text-text-muted">
                          {sub.mappings.length} Curricula
                        </span>
                      ) : "—")}
                    </td>
                    <td className="p-4 text-center font-bold dark:text-neutral-300 text-text-primary">{sub.credits}</td>
                    <td className="p-4 text-center font-mono text-text-muted">
                      {sub.lectureHours}-{sub.tutorialHours}-{sub.practicalHours}
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase dark:bg-neutral-950 bg-neutral-100 dark:text-neutral-400 text-text-secondary border dark:border-neutral-900 border-border-subtle">
                        {sub.type}
                      </span>
                    </td>
                    <td className="p-4">
                      <button
                        disabled={mode === "hod"}
                        onClick={() => toggleSubjectStatus(sub)}
                        className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border transition-all ${
                          sub.status === "active"
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/25"
                            : "bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/25"
                        }`}
                      >
                        {sub.status}
                      </button>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => router.push(`/admin/subjects/${sub.id}`)}
                          title="View Profile Details"
                          className="p-1.5 rounded hover:bg-indigo-500/10 text-indigo-400 transition-colors"
                        >
                          <Eye size={14} />
                        </button>
                        
                        {mode === "admin" && (
                          <>
                            <button
                              onClick={() => openEditModal(sub)}
                              title="Edit Properties"
                              className="p-1.5 rounded hover:bg-amber-500/10 text-amber-400 transition-colors"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => initiateDelete(sub)}
                              title="Delete Subject"
                              className="p-1.5 rounded hover:bg-rose-500/10 text-rose-400 transition-colors"
                            >
                              <Trash2 size={14} />
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

        {/* Paginated Footer */}
        {subjects.length > 0 && (
          <div className="p-4 border-t dark:border-neutral-800 border-border-subtle flex items-center justify-between text-xs text-text-secondary">
            <span>Showing {subjects.length} of {totalSubjectsCount} academic subjects</span>
            
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
                className="p-1 rounded border dark:border-neutral-800 border-border-subtle dark:bg-neutral-900 bg-white hover:border-indigo-500/30 transition-all disabled:opacity-40"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="px-3 font-semibold text-text-primary">Page {currentPage} of {totalPages}</span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => prev + 1)}
                className="p-1 rounded border dark:border-neutral-800 border-border-subtle dark:bg-neutral-900 bg-white hover:border-indigo-500/30 transition-all disabled:opacity-40"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Modal: Add / Edit Subject */}
      {showAddEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl dark:bg-neutral-950 bg-white border dark:border-neutral-800 border-border-subtle rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b dark:border-neutral-800 border-border-subtle flex items-center justify-between">
              <h3 className="font-display font-bold text-base dark:text-white text-text-primary">
                {editingSubjectId ? "Edit Subject Master Record" : "Add New Subject Master Record"}
              </h3>
              <button
                onClick={() => setShowAddEditModal(false)}
                className="p-1 text-text-muted hover:text-text-primary transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveSubject}>
              <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
                
                {formError && (
                  <div className="p-3 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 font-semibold flex items-center gap-2">
                    <AlertCircle size={16} />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Subject Code */}
                  <div>
                    <label className="text-[10px] text-text-muted uppercase font-bold block mb-1">Subject Code *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. CS302"
                      value={formCode}
                      disabled={!!editingSubjectId}
                      onChange={(e) => setFormCode(e.target.value)}
                      className="w-full p-2 border dark:border-neutral-800 border-border-subtle rounded-lg dark:bg-neutral-900 bg-background text-text-primary font-mono"
                    />
                  </div>

                  {/* Subject Name */}
                  <div>
                    <label className="text-[10px] text-text-muted uppercase font-bold block mb-1">Subject Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Database Management Systems"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full p-2 border dark:border-neutral-800 border-border-subtle rounded-lg dark:bg-neutral-900 bg-background text-text-primary font-semibold"
                    />
                  </div>

                  {!editingSubjectId ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t dark:border-neutral-900 border-border-subtle pt-4 col-span-1 sm:col-span-2">
                      <div className="col-span-1 sm:col-span-2 text-[10px] text-indigo-400 font-bold uppercase tracking-wider mb-1">
                        Initial Curriculum Placement Mapping
                      </div>
                      {/* Department */}
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

                      {/* Program / Scheme Selection */}
                      <div>
                        <label className="text-[10px] text-text-muted uppercase font-bold block mb-1">Program (Free-text / DB match)</label>
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

                      {/* Year / Sem raw */}
                      <div>
                        <label className="text-[10px] text-text-muted uppercase font-bold block mb-1">Curriculum Placement (Year / Semester) *</label>
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
                  ) : (
                    <div className="col-span-1 sm:col-span-2 p-3.5 rounded-lg border border-indigo-500/20 bg-indigo-500/5 text-indigo-400 leading-normal flex items-start gap-3">
                      <AlertCircle size={16} className="mt-0.5 shrink-0" />
                      <div>
                        <span className="font-bold">Subject Curriculum Mappings Notice</span>
                        <p className="mt-0.5 text-[11px] opacity-90">
                          Academic departments, regulation, and year/semester placements for this subject can be managed inside the detailed **Subject Profile page**. Click on the view profile eye icon in the catalog table to open it.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* L - T - P Structure */}
                  <div>
                    <label className="text-[10px] text-text-muted uppercase font-bold block mb-1">L - T - P Hours (Lecture - Tutorial - Practical)</label>
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="number"
                        min="0"
                        max="10"
                        placeholder="L"
                        value={formLectureHours}
                        onChange={(e) => setFormLectureHours(Number(e.target.value))}
                        className="p-2 border dark:border-neutral-800 border-border-subtle rounded-lg dark:bg-neutral-900 bg-background text-text-primary text-center font-semibold"
                      />
                      <input
                        type="number"
                        min="0"
                        max="10"
                        placeholder="T"
                        value={formTutorialHours}
                        onChange={(e) => setFormTutorialHours(Number(e.target.value))}
                        className="p-2 border dark:border-neutral-800 border-border-subtle rounded-lg dark:bg-neutral-900 bg-background text-text-primary text-center font-semibold"
                      />
                      <input
                        type="number"
                        min="0"
                        max="10"
                        placeholder="P"
                        value={formPracticalHours}
                        onChange={(e) => setFormPracticalHours(Number(e.target.value))}
                        className="p-2 border dark:border-neutral-800 border-border-subtle rounded-lg dark:bg-neutral-900 bg-background text-text-primary text-center font-semibold"
                      />
                    </div>
                  </div>

                  {/* Credits & Subject Type */}
                  <div>
                    <label className="text-[10px] text-text-muted uppercase font-bold block mb-1">Subject Type / Credits *</label>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={formType}
                        onChange={(e) => setFormType(e.target.value)}
                        className="p-2 border dark:border-neutral-800 border-border-subtle rounded-lg dark:bg-neutral-900 bg-background text-text-primary"
                      >
                        <option value="core">Core</option>
                        <option value="lab">Laboratory</option>
                        <option value="elective">Elective</option>
                        <option value="mandatory">Mandatory</option>
                        <option value="project">Project</option>
                        <option value="workshop">Workshop</option>
                      </select>
                      <input
                        type="number"
                        required
                        min="0"
                        max="10"
                        placeholder="Credits"
                        value={formCredits}
                        onChange={(e) => setFormCredits(Number(e.target.value))}
                        className="p-2 border dark:border-neutral-800 border-border-subtle rounded-lg dark:bg-neutral-900 bg-background text-text-primary font-bold text-center"
                      />
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <label className="text-[10px] text-text-muted uppercase font-bold block mb-1">Status *</label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value)}
                      className="w-full p-2 border dark:border-neutral-800 border-border-subtle rounded-lg dark:bg-neutral-900 bg-background text-text-primary"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="text-[10px] text-text-muted uppercase font-bold block mb-1">Syllabus Overview / Description</label>
                  <textarea
                    rows={4}
                    placeholder="Enter short description of the subject course syllabus..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full p-2 border dark:border-neutral-800 border-border-subtle rounded-lg dark:bg-neutral-900 bg-background text-text-primary outline-none focus:border-indigo-500 leading-relaxed"
                  />
                </div>

              </div>

              <div className="p-5 border-t dark:border-neutral-800 border-border-subtle dark:bg-neutral-900/20 bg-neutral-50/50 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddEditModal(false)}
                  className="px-4 py-2 border dark:border-neutral-800 border-border-subtle rounded-lg text-text-secondary hover:dark:bg-neutral-900 hover:bg-neutral-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-bold shadow flex items-center gap-1.5 disabled:opacity-50"
                >
                  {formSubmitting && <Loader2 className="animate-spin" size={14} />}
                  <span>{editingSubjectId ? "Save Changes" : "Create Subject"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Excel Importer */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-5xl dark:bg-neutral-950 bg-white border dark:border-neutral-800 border-border-subtle rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b dark:border-neutral-800 border-border-subtle flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload size={18} className="text-indigo-400" />
                <h3 className="font-display font-bold text-base dark:text-white text-text-primary">
                  Bulk Curriculum Excel / CSV Import
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  clearImportState();
                }}
                className="p-1 text-text-muted hover:text-text-primary transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-6 max-h-[75vh] overflow-y-auto text-xs">
              
              {importResultSummary ? (
                <div className="space-y-6 py-6 text-center animate-in fade-in duration-200">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center mx-auto text-emerald-400">
                    <Check size={24} />
                  </div>
                  <div>
                    <h4 className="font-display font-bold text-lg dark:text-white text-text-primary">Curriculum Import Completed</h4>
                    <p className="text-xs text-text-muted mt-1">Your academic curriculum spreadsheet has been processed successfully.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 max-w-md mx-auto text-left border dark:border-neutral-800 border-border-subtle rounded-xl p-4 dark:bg-neutral-900/30 bg-neutral-50/50">
                    <div>
                      <span className="text-[10px] text-text-muted uppercase font-bold block">Rows Processed</span>
                      <span className="font-display font-bold text-sm dark:text-white text-text-primary mt-0.5 block">{importResultSummary.rowsProcessed}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-emerald-400 uppercase font-bold block">New Subjects Created</span>
                      <span className="font-display font-bold text-sm text-emerald-400 mt-0.5 block">{importResultSummary.newSubjectsCreated}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-indigo-400 uppercase font-bold block">New Mappings Created</span>
                      <span className="font-display font-bold text-sm text-indigo-400 mt-0.5 block">{importResultSummary.newCurriculumMappings}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-amber-400 uppercase font-bold block">Existing Subjects Reused</span>
                      <span className="font-display font-bold text-sm text-amber-400 mt-0.5 block">{importResultSummary.existingSubjectsReused}</span>
                    </div>
                    <div className="col-span-2 border-t dark:border-neutral-800 border-border-subtle pt-2.5 mt-1 flex justify-between">
                      <div>
                        <span className="text-[10px] text-text-muted uppercase font-bold block">Mappings Skipped (Duplicates)</span>
                        <span className="font-display font-bold text-sm text-amber-400 mt-0.5 block">{importResultSummary.existingMappingsSkipped}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-rose-400 uppercase font-bold block">Failed Rows</span>
                        <span className="font-display font-bold text-sm text-rose-400 mt-0.5 block">{importResultSummary.failedRows}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-center pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowImportModal(false);
                        clearImportState();
                      }}
                      className="px-5 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs shadow-lg shadow-indigo-500/20 transition-all"
                    >
                      Close & Finish
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Uploader Box */}
                  {!importFile ? (
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed dark:border-neutral-800 border-border-subtle hover:border-indigo-500/50 dark:hover:border-indigo-500/50 rounded-xl p-12 text-center cursor-pointer transition-all dark:bg-neutral-950/20 bg-neutral-50/50"
                    >
                      <FileSpreadsheet className="mx-auto text-indigo-400 mb-3" size={40} />
                      <p className="font-semibold text-xs dark:text-white text-text-primary">Select Academic Curriculum Spreadsheet</p>
                      <p className="text-[10px] text-text-muted mt-1">Supports .xlsx, .xls, and .csv formats.</p>
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept=".xlsx,.xls,.csv"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 border dark:border-neutral-800 border-border-subtle rounded-lg dark:bg-neutral-900 bg-neutral-50">
                      <div className="flex items-center gap-2 font-semibold">
                        <FileSpreadsheet size={16} className="text-emerald-400" />
                        <span>{importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)</span>
                      </div>
                      <button
                        onClick={clearImportState}
                        className="text-rose-400 hover:text-rose-300 font-semibold"
                      >
                        Remove File
                      </button>
                    </div>
                  )}

                  {/* Parsing Loading */}
                  {importLoading && (
                    <div className="py-12 flex flex-col items-center justify-center gap-3">
                      <Loader2 className="animate-spin text-indigo-500" size={32} />
                      <span className="font-semibold text-text-secondary">Processing spreadsheet schema and validating rows...</span>
                    </div>
                  )}

                  {/* Validation Results Summaries */}
                  {importSummary && (
                    <div className="space-y-4">
                      
                      {/* Summary Bar */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 dark:bg-neutral-900/40 bg-neutral-50/50 border dark:border-neutral-800 border-border-subtle rounded-xl">
                        <div>
                          <span className="text-[10px] text-text-muted uppercase font-bold block">Total Rows</span>
                          <span className="font-display font-bold text-sm dark:text-white text-text-primary mt-1 block">{importSummary.total}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-emerald-400 uppercase font-bold block">Valid to Import</span>
                          <span className="font-display font-bold text-sm text-emerald-400 mt-1 block">{importSummary.imported}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-amber-400 uppercase font-bold block">Duplicate Skip Warnings</span>
                          <span className="font-display font-bold text-sm text-amber-400 mt-1 block">{importSummary.duplicates}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-rose-400 uppercase font-bold block">Syntax Failures</span>
                          <span className="font-display font-bold text-sm text-rose-400 mt-1 block">{importSummary.failed}</span>
                        </div>
                      </div>

                      {/* Failures Warnings Logs */}
                      {importFailedRows.length > 0 && (
                        <div className="p-4 bg-rose-500/10 border border-rose-500/25 rounded-xl space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-rose-400 flex items-center gap-2">
                              <AlertCircle size={14} />
                              <span>Identified {importFailedRows.length} Syntax Failures</span>
                            </span>
                            <button
                              onClick={downloadErrorReport}
                              className="px-2 py-1 rounded bg-rose-500/20 text-rose-300 font-bold hover:bg-rose-500/35 transition-all text-[10px]"
                            >
                              Download Error Report (CSV)
                            </button>
                          </div>
                          <div className="max-h-28 overflow-y-auto space-y-1 font-mono text-[10px] text-rose-300">
                            {importFailedRows.slice(0, 10).map((err, i) => (
                              <div key={i}>
                                Row {err.rowNumber} (Code: {err.subjectCode}): {err.error}
                              </div>
                            ))}
                            {importFailedRows.length > 10 && (
                              <div className="font-sans italic text-text-muted mt-1">And {importFailedRows.length - 10} other error rows... Download full CSV report for complete logs.</div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Valid Rows Preview Table */}
                      {importPreviewData.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-bold dark:text-white text-text-primary">Valid Curriculum Rows Preview ({importPreviewData.length})</h4>
                          <div className="border dark:border-neutral-800 border-border-subtle rounded-lg overflow-hidden max-h-56 overflow-y-auto">
                            <table className="w-full text-left text-[11px] border-collapse">
                              <thead>
                                <tr className="border-b dark:border-neutral-800 border-border-subtle dark:bg-neutral-900 bg-neutral-100 text-text-muted uppercase font-bold">
                                  <th className="p-2">Code</th>
                                  <th className="p-2">Subject Name</th>
                                  <th className="p-2">Department</th>
                                  <th className="p-2">Program</th>
                                  <th className="p-2">Reg</th>
                                  <th className="p-2">Year/Sem</th>
                                  <th className="p-2 text-center">Cr</th>
                                  <th className="p-2 text-center">L-T-P</th>
                                  <th className="p-2">Type</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y dark:divide-neutral-800/80 divide-border-subtle">
                                {importPreviewData.map((row, idx) => (
                                  <tr key={idx} className="hover:dark:bg-neutral-900/20 hover:bg-neutral-50/20 font-normal">
                                    <td className="p-2 font-mono font-semibold text-indigo-400">{row.code}</td>
                                    <td className="p-2 font-medium text-text-primary">{row.name}</td>
                                    <td className="p-2 text-text-secondary">{row.departmentName}</td>
                                    <td className="p-2 text-text-secondary">{row.program}</td>
                                    <td className="p-2 text-text-secondary">{row.regulation}</td>
                                    <td className="p-2 text-text-secondary">Year {row.year} • Sem {row.semesterRaw}</td>
                                    <td className="p-2 text-center font-bold text-text-primary">{row.credits}</td>
                                    <td className="p-2 text-center text-text-muted">{row.lectureHours}-{row.tutorialHours}-{row.practicalHours}</td>
                                    <td className="p-2 text-text-secondary">{row.type}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                    </div>
                  )}
                </>
              )}

            </div>

            {!importResultSummary && (
              <div className="p-5 border-t dark:border-neutral-800 border-border-subtle dark:bg-neutral-900/20 bg-neutral-50/50 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowImportModal(false);
                    clearImportState();
                  }}
                  className="px-4 py-2 border dark:border-neutral-800 border-border-subtle rounded-lg text-text-secondary hover:dark:bg-neutral-900 hover:bg-neutral-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={importPreviewData.length === 0 || importLoading}
                  onClick={handleCommitImport}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-bold shadow flex items-center gap-1.5 disabled:opacity-50"
                >
                  {importLoading && <Loader2 className="animate-spin" size={14} />}
                  <span>Import {importPreviewData.length} Subjects</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Confirm Delete */}
      {showDeleteConfirm && subjectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md dark:bg-neutral-950 bg-white border dark:border-neutral-800 border-border-subtle rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b dark:border-neutral-800 border-border-subtle flex items-center justify-between">
              <h3 className="font-display font-bold text-base text-rose-400">
                Confirm Subject Deletion
              </h3>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="p-1 text-text-muted hover:text-text-primary transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 text-xs space-y-4">
              
              {deleteWarningMessage ? (
                <div className="p-3.5 rounded bg-rose-500/10 border border-rose-500/25 text-rose-400 space-y-2">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertCircle size={16} />
                    <span>Deletion Blocked</span>
                  </div>
                  <p className="leading-relaxed font-medium">{deleteWarningMessage}</p>
                </div>
              ) : (
                <p className="leading-relaxed dark:text-neutral-300 text-text-primary">
                  Are you sure you want to delete subject <span className="font-bold font-mono text-indigo-400">{subjectToDelete.code}</span> (<strong>{subjectToDelete.name}</strong>)? This will soft-delete the master record.
                </p>
              )}

            </div>

            <div className="p-5 border-t dark:border-neutral-800 border-border-subtle dark:bg-neutral-900/20 bg-neutral-50/50 flex items-center justify-end gap-3">
              {deleteWarningMessage ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 bg-neutral-600 hover:bg-neutral-700 text-white rounded-lg transition-colors font-bold shadow"
                >
                  OK, Close
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-4 py-2 border dark:border-neutral-800 border-border-subtle rounded-lg text-text-secondary hover:dark:bg-neutral-900 hover:bg-neutral-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmDeleteSubject}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors font-bold shadow"
                  >
                    Delete Master Record
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirm Bulk Wipe */}
      {showWipeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md dark:bg-neutral-950 bg-white border dark:border-neutral-800 border-border-subtle rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b dark:border-neutral-800 border-border-subtle flex items-center justify-between">
              <h3 className="font-display font-bold text-base text-rose-400">
                Confirm Bulk Catalog Wipeout
              </h3>
              <button
                onClick={() => setShowWipeConfirm(false)}
                className="p-1 text-text-muted hover:text-text-primary transition-colors"
                disabled={wipeLoading}
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 text-xs space-y-4">
              <div className="p-3.5 rounded bg-rose-500/10 border border-rose-500/25 text-rose-400 space-y-2">
                <div className="flex items-center gap-2 font-bold">
                  <AlertCircle size={16} />
                  <span>Caution: Absolute Wipe Action</span>
                </div>
                <p className="leading-relaxed font-medium">
                  This action will soft-delete ALL subject definitions currently registered in the database catalog, irrespective of their active status or use in other modules.
                </p>
              </div>
              <p className="leading-relaxed dark:text-neutral-300 text-text-primary">
                Are you sure you want to proceed? This will completely clear all course listings from the Subjects Master catalog.
              </p>
            </div>

            <div className="p-5 border-t dark:border-neutral-800 border-border-subtle dark:bg-neutral-900/20 bg-neutral-50/50 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowWipeConfirm(false)}
                className="px-4 py-2 border dark:border-neutral-800 border-border-subtle rounded-lg text-text-secondary hover:dark:bg-neutral-900 hover:bg-neutral-100 transition-colors"
                disabled={wipeLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleWipeAllSubjects}
                disabled={wipeLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors font-bold shadow flex items-center gap-1.5"
              >
                {wipeLoading && <Loader2 className="animate-spin" size={14} />}
                <span>Wipe All Catalog Subjects</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
