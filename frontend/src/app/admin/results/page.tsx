"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { 
  Award, 
  BookOpen, 
  Filter, 
  Trash2, 
  Edit, 
  CheckCircle2, 
  XCircle, 
  Plus, 
  Search, 
  Loader2, 
  AlertCircle, 
  Sparkles, 
  Clock,
  Layers,
  Send,
  UserCheck,
  AlertTriangle
} from "lucide-react";

interface ResultSummary {
  id: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  subjectCode: string;
  subjectName: string;
  semester: number;
  section: string;
  internalMarks: number;
  internalMaxMarks: number;
  externalMarks: number;
  externalMaxMarks: number;
  totalMarks: number;
  grade: string;
  resultStatus: "Pass" | "Fail" | "Absent";
  publicationStatus: "Draft" | "Published";
}

interface SubjectSummary {
  id: string;
  code: string;
  name: string;
  semester: number;
}

interface FacultySummary {
  id: string;
  fullName: string;
  employeeNumber: string;
}

export default function AdminResults() {
  const { accessToken } = useAuth();

  // Loading States
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [submittingPublish, setSubmittingPublish] = useState(false);
  const [submittingOverride, setSubmittingOverride] = useState(false);

  // Messages
  const [error, setError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState("");

  // Metadata dropdowns
  const [subjects, setSubjects] = useState<SubjectSummary[]>([]);
  const [faculty, setFaculty] = useState<FacultySummary[]>([]);

  // Filtering States
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedSemester, setSelectedSemester] = useState("ALL");
  const [selectedSection, setSelectedSection] = useState("ALL");
  const [selectedFacultyId, setSelectedFacultyId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedPubStatus, setSelectedPubStatus] = useState("ALL");

  // Results list pagination
  const [results, setResults] = useState<ResultSummary[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Batch Publish target
  const [publishSubjectId, setPublishSubjectId] = useState("");
  const [publishSection, setPublishSection] = useState("A");

  // Edit Override Drawer / Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingResult, setEditingResult] = useState<ResultSummary | null>(null);
  const [overrideInternal, setOverrideInternal] = useState("0");
  const [overrideExternal, setOverrideExternal] = useState("0");
  const [overrideAbsent, setOverrideAbsent] = useState(false);
  const [overrideRemarks, setOverrideRemarks] = useState("");
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Delete confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [resultToDelete, setResultToDelete] = useState<ResultSummary | null>(null);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  };

  // Fetch metadata dropdown values (subjects & faculty)
  useEffect(() => {
    const fetchMetadata = async () => {
      setLoadingMeta(true);
      try {
        const subRes = await apiFetch("/subjects?limit=100", {}, accessToken);
        if (subRes.success && subRes.data?.subjects) {
          setSubjects(subRes.data.subjects);
          if (subRes.data.subjects.length > 0) {
            setPublishSubjectId(subRes.data.subjects[0].id);
          }
        }
        
        const facRes = await apiFetch("/faculty?limit=100", {}, accessToken);
        if (facRes.success && facRes.data?.faculty) {
          setFaculty(facRes.data.faculty);
        }
      } catch (err) {
        console.error("Failed to load metadata dropdowns", err);
      } finally {
        setLoadingMeta(false);
      }
    };
    fetchMetadata();
  }, [accessToken]);

  // Fetch results list
  const fetchResults = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });

      if (selectedSubjectId) params.append("subjectId", selectedSubjectId);
      if (selectedSemester !== "ALL") params.append("semester", selectedSemester);
      if (selectedSection !== "ALL") params.append("section", selectedSection);
      if (selectedFacultyId) params.append("facultyId", selectedFacultyId);
      if (selectedStatus !== "ALL") params.append("resultStatus", selectedStatus);
      if (selectedPubStatus !== "ALL") params.append("publicationStatus", selectedPubStatus);

      const res = await apiFetch(`/results?${params.toString()}`, {}, accessToken);
      if (res.success && res.data) {
        setResults(res.data.results || []);
        if (res.data.pagination) {
          setTotalPages(res.data.pagination.totalPages || 1);
          setTotalRecords(res.data.pagination.total || 0);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load examination results.");
      setResults([]);
    } finally {
      setLoadingList(false);
    }
  }, [
    page,
    limit,
    selectedSubjectId,
    selectedSemester,
    selectedSection,
    selectedFacultyId,
    selectedStatus,
    selectedPubStatus,
    accessToken
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchResults();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchResults]);

  // Reset to page 1 on filter modifications
  const handleFilterChange = (fieldSetter: (val: string) => void, val: string) => {
    fieldSetter(val);
    setPage(1);
  };

  // 3. Publish batch handler
  const handlePublishBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publishSubjectId || !publishSection) return;

    setSubmittingPublish(true);
    setError(null);
    try {
      const body = {
        subjectId: publishSubjectId,
        section: publishSection.toUpperCase().trim()
      };

      const res = await apiFetch("/results/publish", {
        method: "POST",
        body: JSON.stringify(body)
      }, accessToken);

      if (res.success) {
        triggerToast(res.message || "Results published successfully!");
        fetchResults();
      }
    } catch (err: any) {
      setError(err.message || "Failed to publish draft results batch.");
    } finally {
      setSubmittingPublish(false);
    }
  };

  // Open Override dialog
  const openOverrideModal = async (result: ResultSummary) => {
    setEditingResult(result);
    setOverrideInternal(result.internalMarks.toString());
    setOverrideExternal(result.externalMarks.toString());
    setOverrideAbsent(result.resultStatus === "Absent");
    setOverrideRemarks("");
    setOverrideError(null);
    setEditModalOpen(true);
    setLoadingDetail(true);

    try {
      const res = await apiFetch(`/results/${result.id}`, {}, accessToken);
      if (res.success && res.data?.record) {
        setOverrideRemarks(res.data.record.remarks || "");
      }
    } catch (err) {
      console.error("Failed to load result remarks", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Submit Override handler
  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingResult) return;

    setOverrideError(null);
    setSubmittingOverride(true);

    const intVal = parseFloat(overrideInternal);
    const extVal = parseFloat(overrideExternal);

    if (isNaN(intVal) || intVal < 0 || intVal > editingResult.internalMaxMarks) {
      setOverrideError(`Internal marks must be between 0 and ${editingResult.internalMaxMarks}.`);
      setSubmittingOverride(false);
      return;
    }

    if (!overrideAbsent) {
      if (isNaN(extVal) || extVal < 0 || extVal > editingResult.externalMaxMarks) {
        setOverrideError(`External marks must be between 0 and ${editingResult.externalMaxMarks}.`);
        setSubmittingOverride(false);
        return;
      }
    }

    try {
      const body = {
        internalMarks: intVal,
        externalMarks: overrideAbsent ? 0 : extVal,
        isAbsent: overrideAbsent,
        remarks: overrideRemarks.trim() || null
      };

      const res = await apiFetch(`/results/${editingResult.id}`, {
        method: "PATCH",
        body: JSON.stringify(body)
      }, accessToken);

      if (res.success) {
        triggerToast("Marks override saved and scorecards updated!");
        setEditModalOpen(false);
        setEditingResult(null);
        fetchResults();
      }
    } catch (err: any) {
      setOverrideError(err.message || "Failed to save result override.");
    } finally {
      setSubmittingOverride(false);
    }
  };

  // Soft delete handler
  const handleDeleteResult = async () => {
    if (!resultToDelete) return;

    try {
      const res = await apiFetch(`/results/${resultToDelete.id}`, {
        method: "DELETE"
      }, accessToken);

      if (res.success) {
        triggerToast("Result sheet record deleted successfully!");
        setDeleteConfirmOpen(false);
        setResultToDelete(null);
        fetchResults();
      }
    } catch (err: any) {
      triggerToast(err.message || "Failed to delete result sheet.");
    }
  };

  // Calculated overall statistics from active list/total results
  // Note: Using page state for real-time overview counts
  const stats = React.useMemo(() => {
    let passes = 0;
    let fails = 0;
    let drafts = 0;

    results.forEach((r) => {
      if (r.resultStatus === "Pass") passes += 1;
      if (r.resultStatus === "Fail" || r.resultStatus === "Absent") fails += 1;
      if (r.publicationStatus === "Draft") drafts += 1;
    });

    const activeTotal = results.length;
    const passRate = activeTotal > 0 ? Math.round((passes / activeTotal) * 100) : 0;

    return {
      total: totalRecords,
      passRate,
      fails,
      drafts
    };
  }, [results, totalRecords]);

  return (
    <div className="relative space-y-6">
      
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-emerald-600 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-xl shadow-emerald-600/20 border border-emerald-400/20 animate-fade-in">
          <Sparkles size={14} className="animate-pulse" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div>
        <h2 className="font-display font-bold text-2xl dark:text-white text-text-primary">Results Desk Control</h2>
        <p className="text-xs dark:text-neutral-400 text-text-secondary mt-1">
          Publish examinations results and perform admin scorecards overrides. All overrides re-evaluate grades automatically.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold rounded-lg flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Summary Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Results */}
        <div className="glass-card rounded-xl p-5 dark:border-neutral-800 border-border-subtle bg-surface flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold dark:text-neutral-500 text-text-muted">Overall Results Records</span>
            <h3 className="text-2xl font-display font-bold dark:text-white text-text-primary mt-1">{stats.total} Entries</h3>
            <span className="text-[9px] dark:text-neutral-500 text-text-muted block mt-0.5 font-mono">Aggregated DB logs</span>
          </div>
          <div className="w-10 h-10 rounded-lg dark:bg-neutral-800 bg-neutral-100 dark:text-neutral-500 text-text-secondary border dark:border-neutral-700 border-border-subtle flex items-center justify-center">
            <Layers size={18} />
          </div>
        </div>

        {/* Pass Rate */}
        <div className="glass-card rounded-xl p-5 dark:border-neutral-800 border-border-subtle bg-surface flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold dark:text-neutral-500 text-text-muted">Pass Rate (Active Page)</span>
            <h3 className="text-2xl font-display font-bold text-emerald-500 dark:text-emerald-400 mt-1">{stats.passRate}% Pass</h3>
            <span className="text-[9px] dark:text-neutral-500 text-text-muted block mt-0.5">Successful score ratio</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
            <CheckCircle2 size={18} />
          </div>
        </div>

        {/* Failed Count */}
        <div className="glass-card rounded-xl p-5 dark:border-neutral-800 border-border-subtle bg-surface flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold dark:text-neutral-500 text-text-muted">Fails / Absents (Page)</span>
            <h3 className="text-2xl font-display font-bold text-rose-600 dark:text-rose-500 mt-1">{stats.fails} Sheets</h3>
            <span className="text-[9px] dark:text-neutral-500 text-text-muted block mt-0.5">Re-evaluations required</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-rose-500/10 text-rose-450 border border-rose-500/20 flex items-center justify-center">
            <XCircle size={18} />
          </div>
        </div>

        {/* Pending Drafts */}
        <div className="glass-card rounded-xl p-5 dark:border-neutral-800 border-border-subtle bg-surface flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold dark:text-neutral-500 text-text-muted">Pending Drafts (Page)</span>
            <h3 className={`text-2xl font-display font-bold mt-1 ${stats.drafts > 0 ? "text-amber-500" : "dark:text-neutral-400 text-text-secondary"}`}>
              {stats.drafts} Sheets
            </h3>
            <span className="text-[9px] dark:text-neutral-500 text-text-muted block mt-0.5">Unpublished marks rolls</span>
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${
            stats.drafts > 0 
              ? "bg-amber-500/10 text-amber-400 border-amber-500/20" 
              : "dark:bg-neutral-850 bg-neutral-100 dark:text-neutral-600 text-text-muted dark:border-neutral-800 border-border-subtle"
          }`}>
            <Clock size={18} />
          </div>
        </div>
      </div>

      {/* Main split: Roster + Filters (Left) / Publish Tools Batch (Right) */}
      <div className="flex flex-col xl:flex-row gap-6 items-start">
        
        {/* Results roster + Filters (Left 70%) */}
        <div className="flex-1 w-full space-y-6">
          
          {/* Filters Dashboard Panel */}
          <div className="glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-1.5 pb-2 border-b dark:border-neutral-900 border-border-subtle dark:text-white text-text-primary">
              <Filter size={14} className="text-blue-500" />
              <span className="text-xs font-bold font-display uppercase tracking-wide">Roster Filter Parameters</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {/* Subject Filter */}
              <div className="flex items-center gap-2 dark:bg-neutral-950 bg-background border dark:border-neutral-850 border-border-subtle rounded px-2.5 text-xs dark:text-white text-text-primary">
                <span className="dark:text-neutral-550 text-text-secondary">Subject:</span>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => handleFilterChange(setSelectedSubjectId, e.target.value)}
                  className="bg-transparent dark:text-white text-text-primary cursor-pointer py-2.5 flex-1 focus:outline-none"
                >
                  <option value="">All Subjects</option>
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.code}: {sub.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Semester Filter */}
              <div className="flex items-center gap-2 dark:bg-neutral-950 bg-background border dark:border-neutral-850 border-border-subtle rounded px-2.5 text-xs dark:text-white text-text-primary">
                <span className="dark:text-neutral-550 text-text-secondary">Semester:</span>
                <select
                  value={selectedSemester}
                  onChange={(e) => handleFilterChange(setSelectedSemester, e.target.value)}
                  className="bg-transparent dark:text-white text-text-primary cursor-pointer py-2.5 flex-1 focus:outline-none"
                >
                  <option value="ALL">All Semesters</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                    <option key={sem} value={sem.toString()}>
                      Semester {sem}
                    </option>
                  ))}
                </select>
              </div>

              {/* Section Filter */}
              <div className="flex items-center gap-2 dark:bg-neutral-950 bg-background border dark:border-neutral-850 border-border-subtle rounded px-2.5 text-xs dark:text-white text-text-primary">
                <span className="dark:text-neutral-550 text-text-secondary">Section:</span>
                <select
                  value={selectedSection}
                  onChange={(e) => handleFilterChange(setSelectedSection, e.target.value)}
                  className="bg-transparent dark:text-white text-text-primary cursor-pointer py-2.5 flex-1 focus:outline-none"
                >
                  <option value="ALL">All Sections</option>
                  {["A", "B", "C", "D"].map((sec) => (
                    <option key={sec} value={sec}>
                      Section {sec}
                    </option>
                  ))}
                </select>
              </div>

              {/* Faculty Filter */}
              <div className="flex items-center gap-2 dark:bg-neutral-950 bg-background border dark:border-neutral-850 border-border-subtle rounded px-2.5 text-xs dark:text-white text-text-primary">
                <span className="dark:text-neutral-550 text-text-secondary">Faculty:</span>
                <select
                  value={selectedFacultyId}
                  onChange={(e) => handleFilterChange(setSelectedFacultyId, e.target.value)}
                  className="bg-transparent dark:text-white text-text-primary cursor-pointer py-2.5 flex-1 focus:outline-none"
                >
                  <option value="">All Faculty</option>
                  {faculty.map((fac) => (
                    <option key={fac.id} value={fac.id}>
                      {fac.fullName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Result Status Filter */}
              <div className="flex items-center gap-2 dark:bg-neutral-950 bg-background border dark:border-neutral-850 border-border-subtle rounded px-2.5 text-xs dark:text-white text-text-primary">
                <span className="dark:text-neutral-550 text-text-secondary">Status:</span>
                <select
                  value={selectedStatus}
                  onChange={(e) => handleFilterChange(setSelectedStatus, e.target.value)}
                  className="bg-transparent dark:text-white text-text-primary cursor-pointer py-2.5 flex-1 focus:outline-none font-bold"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="Pass">Pass</option>
                  <option value="Fail">Fail</option>
                  <option value="Absent">Absent</option>
                </select>
              </div>

              {/* Publication Status Filter */}
              <div className="flex items-center gap-2 dark:bg-neutral-950 bg-background border dark:border-neutral-850 border-border-subtle rounded px-2.5 text-xs dark:text-white text-text-primary">
                <span className="dark:text-neutral-550 text-text-secondary">Publish:</span>
                <select
                  value={selectedPubStatus}
                  onChange={(e) => handleFilterChange(setSelectedPubStatus, e.target.value)}
                  className="bg-transparent dark:text-white text-text-primary cursor-pointer py-2.5 flex-1 focus:outline-none font-bold"
                >
                  <option value="ALL">All States</option>
                  <option value="Draft">Draft</option>
                  <option value="Published">Published</option>
                </select>
              </div>
            </div>
          </div>

          {/* Results Overview Table */}
          <div className="glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl p-5">
            <h3 className="font-display font-bold dark:text-white text-text-primary text-sm flex items-center gap-2 mb-4">
              <Award size={14} className="text-blue-500" />
              <span>Academic Result Sheets</span>
            </h3>

            {loadingList ? (
              <div className="text-center py-16 dark:text-neutral-500 text-text-muted">
                <Loader2 className="animate-spin text-blue-500 mx-auto mb-2" size={24} />
                <span className="font-mono text-xs">Accessing scorecard register database...</span>
              </div>
            ) : results.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="dark:bg-neutral-950 bg-neutral-100 border-b dark:border-neutral-900 border-border-subtle dark:text-neutral-400 text-text-secondary font-semibold font-sans">
                        <th className="px-4 py-3">Student details</th>
                        <th className="px-4 py-3">Subject / Sem</th>
                        <th className="px-4 py-3 text-center">Score details</th>
                        <th className="px-4 py-3 text-center">Grade</th>
                        <th className="px-4 py-3 text-center font-bold">Status</th>
                        <th className="px-4 py-3 text-center">State</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-neutral-900 divide-border-subtle dark:text-neutral-305 text-text-secondary">
                      {results.map((r) => {
                        const isPass = r.resultStatus === "Pass";
                        const isAbsent = r.resultStatus === "Absent";
                        const isPublished = r.publicationStatus === "Published";

                        return (
                          <tr key={r.id} className="dark:hover:bg-neutral-900/10 hover:bg-neutral-100/50 transition-colors">
                            {/* Student details */}
                            <td className="px-4 py-3.5">
                              <h4 className="font-bold dark:text-white text-text-primary">{r.studentName}</h4>
                              <p className="text-[9px] dark:text-neutral-500 text-text-muted font-mono mt-0.5">
                                Roll: {r.rollNumber} • Sec {r.section}
                              </p>
                            </td>

                            {/* Subject Code */}
                            <td className="px-4 py-3.5">
                              <span className="font-semibold dark:text-white text-text-primary block">{r.subjectCode}</span>
                              <span className="text-[9px] dark:text-neutral-500 text-text-muted block truncate max-w-[150px]" title={r.subjectName}>
                                {r.subjectName} (Sem {r.semester})
                              </span>
                            </td>

                            {/* Score info */}
                            <td className="px-4 py-3.5 text-center font-mono">
                              <div>
                                <span className="font-semibold dark:text-white text-text-primary">I: {r.internalMarks}</span>
                                <span className="text-[10px] dark:text-neutral-600 text-text-muted">/{r.internalMaxMarks}</span>
                              </div>
                              <div className="mt-0.5 dark:text-neutral-400 text-text-secondary">
                                {isAbsent ? (
                                  <span className="text-amber-500 italic text-[10px]">Absent</span>
                                ) : (
                                  <>
                                    <span>E: {r.externalMarks}</span>
                                    <span className="text-[10px] dark:text-neutral-600 text-text-muted">/{r.externalMaxMarks}</span>
                                  </>
                                )}
                              </div>
                            </td>

                            {/* Grade */}
                            <td className="px-4 py-3.5 text-center font-mono font-bold dark:text-white text-text-primary">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] border ${
                                isPass 
                                  ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20" 
                                  : isAbsent 
                                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                  : "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20"
                              }`}>
                                {r.grade}
                              </span>
                            </td>

                            {/* Status */}
                            <td className="px-4 py-3.5 text-center">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                                isPass
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                  : isAbsent
                                  ? "bg-amber-500/10 text-amber-650 dark:text-amber-500 border-amber-500/20"
                                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                              }`}>
                                {r.resultStatus}
                              </span>
                            </td>

                            {/* Pub State */}
                            <td className="px-4 py-3.5 text-center font-mono">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                                isPublished 
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" 
                                  : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                              }`}>
                                {r.publicationStatus}
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="px-4 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => openOverrideModal(r)}
                                  className="p-1.5 rounded dark:bg-neutral-900 bg-neutral-100 dark:hover:bg-neutral-800 hover:bg-neutral-200 border dark:border-neutral-800 border-border-subtle dark:text-neutral-400 text-text-secondary dark:hover:text-white hover:text-text-primary transition cursor-pointer"
                                  title="Edit Override Marks"
                                >
                                  <Edit size={12} />
                                </button>
                                <button
                                  onClick={() => {
                                    setResultToDelete(r);
                                    setDeleteConfirmOpen(true);
                                  }}
                                  className="p-1.5 rounded dark:bg-neutral-900 bg-neutral-105 dark:hover:bg-rose-950 hover:bg-rose-50 border dark:border-neutral-800 border-border-subtle dark:hover:border-rose-900 hover:border-rose-300 dark:text-neutral-500 text-text-muted dark:hover:text-rose-450 hover:text-rose-600 transition cursor-pointer"
                                  title="Delete Result"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination footer controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t dark:border-neutral-900 border-border-subtle pt-4 mt-4 text-[11px] font-mono dark:text-neutral-500 text-text-muted">
                    <div>
                      Showing {(page - 1) * limit + 1} - {Math.min(page * limit, totalRecords)} of {totalRecords} records
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPage((p) => Math.max(p - 1, 1))}
                        disabled={page === 1}
                        className="px-2.5 py-1 rounded dark:bg-neutral-900 bg-neutral-100 border dark:border-neutral-850 border-border-subtle dark:hover:bg-neutral-800 hover:bg-neutral-200 disabled:opacity-40 dark:text-neutral-400 text-text-secondary dark:hover:text-white hover:text-text-primary cursor-pointer disabled:cursor-not-allowed transition"
                      >
                        Prev
                      </button>
                      <span className="dark:text-white text-text-primary font-bold">{page} / {totalPages}</span>
                      <button
                        onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                        disabled={page === totalPages}
                        className="px-2.5 py-1 rounded dark:bg-neutral-900 bg-neutral-100 border dark:border-neutral-850 border-border-subtle dark:hover:bg-neutral-800 hover:bg-neutral-200 disabled:opacity-40 dark:text-neutral-400 text-text-secondary dark:hover:text-white hover:text-text-primary cursor-pointer disabled:cursor-not-allowed transition"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="p-12 text-center dark:text-neutral-500 text-text-muted font-mono text-xs">
                No examination result sheets matched current filters.
              </div>
            )}
          </div>
        </div>

        {/* Publish Tools Batch (Right 30%) */}
        <div className="w-full xl:w-80 glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl p-4 shrink-0 space-y-4">
          <div className="flex items-center gap-1.5 border-b dark:border-neutral-800 border-border-subtle pb-2 dark:text-white text-text-primary">
            <Send size={16} className="text-emerald-400 animate-pulse" />
            <h3 className="font-display font-bold text-sm">Publish Results Batch</h3>
          </div>

          <p className="text-[11px] dark:text-neutral-400 text-text-secondary leading-relaxed">
            Choose a subject and section code to publish draft results entered by faculty to student scorecards.
          </p>

          <form onSubmit={handlePublishBatch} className="space-y-3 pt-2">
            {/* Subject Select */}
            <div className="space-y-1">
              <label className="text-[10px] dark:text-neutral-500 text-text-muted uppercase font-bold block">Target Subject</label>
              <select
                value={publishSubjectId}
                onChange={(e) => setPublishSubjectId(e.target.value)}
                className="w-full dark:bg-neutral-955 bg-background border dark:border-neutral-850 border-border-subtle rounded px-2.5 py-2 text-xs dark:text-white text-text-primary focus:outline-none focus:border-neutral-700"
              >
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.code}: {sub.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Section Input */}
            <div className="space-y-1">
              <label className="text-[10px] dark:text-neutral-500 text-text-muted uppercase font-bold block">Target Section</label>
              <input
                type="text"
                maxLength={2}
                placeholder="A"
                value={publishSection}
                onChange={(e) => setPublishSection(e.target.value)}
                className="w-full dark:bg-neutral-955 bg-background border dark:border-neutral-850 border-border-subtle rounded px-2.5 py-2 text-xs dark:text-white text-text-primary focus:outline-none focus:border-neutral-700 uppercase"
              />
            </div>

            <button
              type="submit"
              disabled={submittingPublish || !publishSubjectId || !publishSection}
              className="w-full py-2.5 rounded bg-emerald-650 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs shadow-lg shadow-emerald-600/25 cursor-pointer disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5"
            >
              {submittingPublish && <Loader2 size={12} className="animate-spin" />}
              <span>Publish Batch Scorecards</span>
            </button>
          </form>

          {/* Audit Alert */}
          <div className="p-3 dark:bg-neutral-900 bg-background border dark:border-neutral-850 border-border-subtle rounded-lg text-[10px] dark:text-neutral-400 text-text-secondary space-y-1.5">
            <span className="font-bold dark:text-neutral-350 text-text-primary flex items-center gap-1">
              <UserCheck size={12} className="text-blue-500" />
              <span>Audit Logging Enabled</span>
            </span>
            <p className="leading-normal">
              Any overrides or batches published are recorded on database audit registers. Double-check scores before pushing live updates.
            </p>
          </div>
        </div>

      </div>

      {/* Override Edit Modal overlay */}
      {editModalOpen && editingResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/70 backdrop-blur-sm animate-fade-in">
          <div className="dark:bg-neutral-900 bg-surface border dark:border-neutral-800 border-border-subtle p-6 rounded-xl max-w-md w-full mx-4 shadow-2xl animate-scale-up space-y-4">
            <div>
              <h3 className="font-display font-bold dark:text-white text-text-primary text-base">{"Override Student Scorecard"}</h3>
              <p className="text-[11px] dark:text-neutral-400 text-text-secondary mt-1">
                Editing: <strong className="dark:text-white text-text-primary">{editingResult.studentName} ({editingResult.rollNumber})</strong>
              </p>
              <p className="text-[10px] dark:text-neutral-500 text-text-muted mt-0.5">
                Subject: {editingResult.subjectCode} - {editingResult.subjectName}
              </p>
            </div>

            {overrideError && (
              <div className="p-2 bg-rose-500/10 border border-rose-500/20 text-rose-450 text-[10px] font-semibold rounded flex items-center gap-1">
                <AlertCircle size={12} />
                <span>{overrideError}</span>
              </div>
            )}

            <form onSubmit={handleSaveOverride} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {/* Internal Marks */}
                <div>
                  <label className="text-[10px] dark:text-neutral-500 text-text-muted uppercase font-bold block mb-1">
                    Internal Obtained
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max={editingResult.internalMaxMarks}
                      value={overrideInternal}
                      onChange={(e) => setOverrideInternal(e.target.value)}
                      className="w-full dark:bg-neutral-955 bg-background border dark:border-neutral-850 border-border-subtle rounded px-2 py-1.5 text-xs dark:text-white text-text-primary font-mono text-center focus:outline-none focus:border-neutral-700"
                    />
                    <span className="text-[11px] dark:text-neutral-600 text-text-muted">/ {editingResult.internalMaxMarks}</span>
                  </div>
                </div>

                {/* External Marks */}
                <div>
                  <label className="text-[10px] dark:text-neutral-500 text-text-muted uppercase font-bold block mb-1">
                    External Obtained
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max={editingResult.externalMaxMarks}
                      disabled={overrideAbsent}
                      value={overrideExternal}
                      onChange={(e) => setOverrideExternal(e.target.value)}
                      className="w-full dark:bg-neutral-955 bg-background border dark:border-neutral-850 border-border-subtle disabled:bg-neutral-800 disabled:text-neutral-600 rounded px-2 py-1.5 text-xs dark:text-white text-text-primary font-mono text-center focus:outline-none focus:border-neutral-700"
                    />
                    <span className="text-[11px] dark:text-neutral-600 text-text-muted">/ {editingResult.externalMaxMarks}</span>
                  </div>
                </div>
              </div>

              {/* Absent check */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="override-absent"
                  checked={overrideAbsent}
                  onChange={(e) => setOverrideAbsent(e.target.checked)}
                  className="bg-neutral-950 border border-neutral-850 rounded text-blue-650 focus:ring-0 focus:ring-offset-0"
                />
                <label
                  htmlFor="override-absent"
                  className={`text-xs select-none cursor-pointer ${
                    overrideAbsent ? "text-amber-500 font-bold" : "dark:text-neutral-400 text-text-secondary"
                  }`}
                >
                  Student was Absent for Examination
                </label>
              </div>

              {/* Remarks */}
              <div className="space-y-1">
                <label className="text-[10px] dark:text-neutral-500 text-text-muted uppercase font-bold block flex items-center justify-between">
                  <span>Override Reasons / Audit Remarks</span>
                  {loadingDetail && <span className="text-[9px] text-blue-500 font-mono">Loading...</span>}
                </label>
                <input
                  type="text"
                  placeholder={loadingDetail ? "Loading remarks..." : "e.g. Recounting correction override"}
                  required
                  disabled={loadingDetail}
                  value={overrideRemarks}
                  onChange={(e) => setOverrideRemarks(e.target.value)}
                  className="w-full dark:bg-neutral-950 bg-background border dark:border-neutral-850 border-border-subtle rounded px-2.5 py-1.5 text-xs dark:text-white text-text-primary focus:outline-none focus:border-neutral-700 dark:placeholder-neutral-700 placeholder-neutral-450 disabled:opacity-50"
                />
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditModalOpen(false);
                    setEditingResult(null);
                  }}
                  className="flex-1 py-2 rounded dark:bg-neutral-800 bg-neutral-100 dark:hover:bg-neutral-750 hover:bg-neutral-200 dark:text-neutral-300 text-text-primary border dark:border-neutral-800 border-border-subtle font-bold text-xs cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingOverride}
                  className="flex-1 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold text-xs cursor-pointer transition flex items-center justify-center gap-1"
                >
                  {submittingOverride && <Loader2 size={10} className="animate-spin" />}
                  <span>Save Override</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirmOpen && resultToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/70 backdrop-blur-sm animate-fade-in">
          <div className="dark:bg-neutral-900 bg-surface border dark:border-neutral-800 border-border-subtle p-6 rounded-xl max-w-sm w-full mx-4 shadow-2xl animate-scale-up space-y-4">
            <h3 className="font-display font-bold dark:text-white text-text-primary text-base">Delete Scorecard Record?</h3>
            <p className="text-xs dark:text-neutral-400 text-text-secondary leading-relaxed">
              Are you sure you want to delete the result entry for <strong className="dark:text-white text-text-primary">{resultToDelete.studentName}</strong> in <strong className="dark:text-white text-text-primary">{resultToDelete.subjectCode}</strong>? This will remove the record entirely from student report files and cannot be undone.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setResultToDelete(null);
                }}
                className="flex-1 py-2 rounded dark:bg-neutral-800 bg-neutral-100 hover:bg-neutral-200 dark:text-neutral-300 text-text-primary border dark:border-neutral-800 border-border-subtle font-bold text-xs cursor-pointer transition"
              >
                No, Keep
              </button>
              <button
                onClick={handleDeleteResult}
                className="flex-1 py-2 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer transition"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
