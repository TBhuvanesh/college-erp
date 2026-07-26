"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";
import {
  Database,
  Users,
  GraduationCap,
  Clock,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  PlusCircle,
  FileSpreadsheet,
  Download,
  Info,
  Check,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  X,
  Search,
  Filter,
  Loader2,
  FileText,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Trash2,
  Eye,
  ShieldAlert,
  Sparkles,
  ExternalLink
} from "lucide-react";

import {
  ImportEntityType,
  ImportJob,
  ImportPreviewResult,
  ImportCommitResult,
  ImportSummary,
  ImportRowError,
  ReplaceImpact
} from "@/types/academicImport";

export default function AcademicDataImportCenter() {
  const { accessToken } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Navigation / Tabs
  const [activeTab, setActiveTab] = useState<"overview" | "failed" | "history">("overview");
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);

  // Dashboard Stats & Jobs list
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [stats, setStats] = useState({
    studentsImported: 0,
    lastImport: "Never",
    pendingValidation: 0,
    failedImports: 0,
  });

  // Wizard State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [fileMetadata, setFileMetadata] = useState<{
    name: string;
    size: string;
    uploadedTime: string;
  } | null>(null);

  // Import Preview & Validation state
  const [validating, setValidating] = useState(false);
  const [previewResult, setPreviewResult] = useState<ImportPreviewResult<any> | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Step 3: Import Mode
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [replaceImpactData, setReplaceImpactData] = useState<ReplaceImpact | null>(null);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [typedConfirmation, setTypedConfirmation] = useState("");

  // Step 4: Preview Table & Search & Filters
  const [previewPage, setPreviewPage] = useState(1);
  const [previewSearch, setPreviewSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [secFilter, setSecFilter] = useState("ALL");
  const [sessionFilter, setSessionFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  
  // Validation Category Collapse states
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // Ignored Columns Accordion state
  const [ignoredExpanded, setIgnoredExpanded] = useState(false);

  // Sync Settings
  const [syncSettings, setSyncSettings] = useState({
    syncCurriculum: true,
    initAttendance: true,
    enrollLMS: true,
    initInternalMarks: true,
    enableEligibility: true,
    createDashboard: true,
    indexGlobalSearch: true,
  });

  // Commit & Progress simulation states
  const [committing, setCommitting] = useState(false);
  const [commitProgress, setCommitProgress] = useState(0);
  const [commitCurrentStep, setCommitCurrentStep] = useState("");
  const [commitLogs, setCommitLogs] = useState<string[]>([]);
  const [commitResult, setCommitResult] = useState<ImportCommitResult | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);

  // Fetch Import Jobs History
  const fetchImportJobs = useCallback(async () => {
    if (!accessToken) return;
    setLoadingJobs(true);
    try {
      const res = await apiFetch("/academic-import/jobs?limit=50", {}, accessToken);
      if (res.success && res.data?.jobs) {
        const jobsList = res.data.jobs;
        setJobs(jobsList);

        let totalStudents = 0;
        let lastImportDate = "Never";
        let pending = 0;
        let failed = 0;

        jobsList.forEach((j: ImportJob) => {
          if (j.status === "completed") {
            if (j.entityType === "student") {
              totalStudents += j.createdCount;
            }
          }
          if (j.status === "previewed") {
            pending++;
          }
          if (j.status === "failed" || j.status === "rolled_back") {
            failed++;
          }
        });

        const completedJobs = jobsList.filter((j: any) => j.status === "completed" && j.completedAt);
        if (completedJobs.length > 0) {
          lastImportDate = new Date(completedJobs[0].completedAt).toLocaleString();
        }

        setStats({
          studentsImported: totalStudents,
          lastImport: lastImportDate,
          pendingValidation: pending,
          failedImports: failed,
        });
      }
    } catch (err) {
      console.error("Failed to load import history", err);
    } finally {
      setLoadingJobs(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchImportJobs();
  }, [fetchImportJobs]);

  // Helper: Download Template CSV
  const handleDownloadTemplate = () => {
    const headers = [
      "Roll Number",
      "Student Name",
      "Email",
      "Student Mobile",
      "Department",
      "Academic Session",
      "Section",
      "Admission Year",
      "Academic Regulation",
      "Student Status",
      "Gender",
      "Parent Mobile",
      "Father Name",
      "Mother Name"
    ];
    const sampleRow = [
      "2026CSE101",
      "Aditya Vardhan",
      "aditya.v@siet.edu.in",
      "9876543210",
      "CSE",
      "2026-2027",
      "A",
      "2026",
      "R22",
      "Active",
      "Male",
      "9876543211",
      "Ramesh Vardhan",
      "Sunitha Vardhan"
    ];
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), sampleRow.join(",")].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "college_student_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper: Download Error Diagnostic Report
  const handleDownloadDiagnosticReport = () => {
    if (!previewResult || previewResult.invalidRows.length === 0) return;
    const headers = ["Row Number", "Identifier", "Errors"];
    const rows = previewResult.invalidRows.map((r: ImportRowError) => [
      r.rowNumber,
      r.identifier,
      `"${r.errors.join("; ")}"`
    ]);
    const csvContent = "data:text/csv;charset=utf-8,"
      + [headers.join(","), ...rows.map((e: any[]) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `import_diagnostics_report_${previewResult.jobId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setUploadFile(file);
      setFileMetadata({
        name: file.name,
        size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        uploadedTime: new Date().toLocaleTimeString(),
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadFile(file);
      setFileMetadata({
        name: file.name,
        size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        uploadedTime: new Date().toLocaleTimeString(),
      });
    }
  };

  // Step 1 -> Step 2: Validate Spreadsheet
  const handleValidateFile = async () => {
    if (!uploadFile || !accessToken) return;
    setValidating(true);
    setValidationError(null);
    setPreviewResult(null);

    const formData = new FormData();
    formData.append("file", uploadFile);
    formData.append("mode", importMode);

    try {
      const res = await apiFetch(
        `/academic-import/student/preview`,
        {
          method: "POST",
          body: formData,
        },
        accessToken
      );

      if (res.success && res.data) {
        setPreviewResult(res.data);
        setWizardStep(2);
      }
    } catch (err: any) {
      setValidationError(err.message || "Failed to parse and validate spreadsheet.");
    } finally {
      setValidating(false);
    }
  };

  // Fetch Replace Impact when Replace mode chosen
  const fetchReplaceImpact = async () => {
    if (!accessToken) return;
    setLoadingImpact(true);
    try {
      const res = await apiFetch(`/academic-import/student/replace-impact`, {}, accessToken);
      if (res.success && res.data) {
        setReplaceImpactData(res.data);
      }
    } catch (err) {
      console.error("Failed to load replace impact metrics", err);
    } finally {
      setLoadingImpact(false);
    }
  };

  // Switch to Replace/Merge Mode and regenerate preview
  const regeneratePreview = async (mode: "merge" | "replace") => {
    if (!uploadFile || !accessToken) return;
    setValidating(true);
    setValidationError(null);
    const formData = new FormData();
    formData.append("file", uploadFile);
    formData.append("mode", mode);
    try {
      const res = await apiFetch(
        `/academic-import/student/preview`,
        {
          method: "POST",
          body: formData,
        },
        accessToken
      );
      if (res.success && res.data) {
        setPreviewResult(res.data);
        setImportMode(mode);
      }
    } catch (err: any) {
      setValidationError(err.message || `Failed to regenerate preview in ${mode} mode.`);
    } finally {
      setValidating(false);
    }
  };

  const handleSelectMode = (mode: "merge" | "replace") => {
    setImportMode(mode);
    if (mode === "replace") {
      fetchReplaceImpact();
      setConfirmModalOpen(true);
    } else {
      regeneratePreview("merge");
    }
  };

  // Step 4 Categorized validation warnings
  const validationCategories = useMemo(() => {
    if (!previewResult) return null;

    const invalid = previewResult.invalidRows;
    const summary = previewResult.summary;

    const result = {
      validStudents: summary.valid,
      invalidStudents: summary.invalid,
      duplicateRolls: [] as ImportRowError[],
      duplicateEmails: [] as ImportRowError[],
      existingStudents: [] as ImportRowError[],
      unknownDepts: [] as ImportRowError[],
      unknownSections: [] as ImportRowError[],
      missingCurriculum: [] as ImportRowError[],
      missingSession: [] as ImportRowError[],
    };

    invalid.forEach((row) => {
      let isRoll = false;
      let isEmail = false;
      let isExist = false;
      let isDept = false;
      let isSec = false;
      let isCurr = false;
      let isSess = false;

      row.errors.forEach((err) => {
        const e = err.toLowerCase();
        if (e.includes("roll number") && (e.includes("duplicate") || e.includes("already"))) {
          isRoll = true;
        }
        if (e.includes("email") && (e.includes("duplicate") || e.includes("already"))) {
          isEmail = true;
        }
        if (e.includes("already used") || e.includes("exists") || e.includes("existing")) {
          isExist = true;
        }
        if (e.includes("department") && (e.includes("match") || e.includes("exist") || e.includes("unknown"))) {
          isDept = true;
        }
        if (e.includes("section") && (e.includes("match") || e.includes("exist") || e.includes("unknown"))) {
          isSec = true;
        }
        if (e.includes("curriculum") || e.includes("syllabus")) {
          isCurr = true;
        }
        if (e.includes("session") || e.includes("academic session")) {
          isSess = true;
        }
      });

      if (isRoll) result.duplicateRolls.push(row);
      if (isEmail) result.duplicateEmails.push(row);
      if (isExist) result.existingStudents.push(row);
      if (isDept) result.unknownDepts.push(row);
      if (isSec) result.unknownSections.push(row);
      if (isCurr) result.missingCurriculum.push(row);
      if (isSess) result.missingSession.push(row);
    });

    return result;
  }, [previewResult]);

  // Preview Grid filtering
  const filteredValidRows = useMemo(() => {
    if (!previewResult) return [];
    return previewResult.validRows.filter((r: any) => {
      const searchStr = `${r.rollNumber} ${r.fullName} ${r.email}`.toLowerCase();
      if (previewSearch && !searchStr.includes(previewSearch.toLowerCase())) {
        return false;
      }
      if (deptFilter !== "ALL" && r.departmentName !== deptFilter) {
        return false;
      }
      if (secFilter !== "ALL" && r.section !== secFilter) {
        return false;
      }
      if (sessionFilter !== "ALL" && r.academicYear !== sessionFilter) {
        return false;
      }
      return true;
    });
  }, [previewResult, previewSearch, deptFilter, secFilter, sessionFilter]);

  // Sorting
  const [sortField, setSortField] = useState<string>("rollNumber");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const sortedRows = useMemo(() => {
    const list = [...filteredValidRows];
    list.sort((a, b) => {
      const valA = a[sortField] || "";
      const valB = b[sortField] || "";
      if (typeof valA === "string") {
        return sortOrder === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }
      return sortOrder === "asc" ? valA - valB : valB - valA;
    });
    return list;
  }, [filteredValidRows, sortField, sortOrder]);

  // Pagination
  const itemsPerPage = 8;
  const totalPages = Math.ceil(sortedRows.length / itemsPerPage);
  const paginatedRows = useMemo(() => {
    const start = (previewPage - 1) * itemsPerPage;
    return sortedRows.slice(start, start + itemsPerPage);
  }, [sortedRows, previewPage]);

  // Smart Detection metrics
  const smartMetrics = useMemo(() => {
    if (!previewResult) return null;
    const summary = previewResult.summary;
    const depts = Object.keys(summary.distributions.department || {});
    const sessions = Object.keys(summary.distributions.academicYear || summary.distributions.session || {});
    const sections = Object.keys(summary.distributions.section || {});
    return { depts, sessions, sections, totalCount: summary.valid };
  }, [previewResult]);

  // Timeline checkpoints
  const timelineCheckpoints = [
    { key: "uploading", label: "Uploading Spreadsheet", desc: "Pushing Excel rows to secure buffer" },
    { key: "validating", label: "Validating Batch", desc: "Running DB constraint audits" },
    { key: "replaceDemo", label: "Removing Demo Records", desc: "Wiping seed dataset from tables", cond: importMode === "replace" },
    { key: "creating", label: "Creating Official Profiles", desc: "Writing permanent student accounts" },
    { key: "curriculum", label: "Synchronizing Curriculum", desc: "Linking subjects & syllabi", cond: syncSettings.syncCurriculum },
    { key: "lms", label: "Creating LMS Enrollments", desc: "Auto-linking classroom portals", cond: syncSettings.enrollLMS },
    { key: "attendance", label: "Initializing Attendance", desc: "Building attendance registers", cond: syncSettings.initAttendance },
    { key: "marks", label: "Initializing Grading Ledgers", desc: "Preparing internal marks slots", cond: syncSettings.initInternalMarks },
    { key: "eligibility", label: "Configuring Seating Eligibility", desc: "Setting exams checks", cond: syncSettings.enableEligibility },
    { key: "dashboards", label: "Onboarding Dashboards", desc: "Generating dashboards credentials", cond: syncSettings.createDashboard },
    { key: "analytics", label: "Recalculating Metrics", desc: "Recalculating statistics dashboards" },
    { key: "search", label: "Indexing Search", desc: "Pushing to system global search index", cond: syncSettings.indexGlobalSearch },
    { key: "finished", label: "Completed", desc: "Registry updated successfully" }
  ].filter(c => c.cond !== false);

  // Commit transaction logic
  const handleCommitImport = async () => {
    if (!previewResult || !accessToken) return;
    setCommitting(true);
    setCommitError(null);
    setCommitResult(null);
    setWizardStep(5);

    // Call API async in background
    let apiCompleted = false;
    let apiSuccess = false;
    let apiResultData: ImportCommitResult | null = null;
    let apiErrorMsg = "";

    apiFetch(
      `/academic-import/student/commit`,
      {
        method: "POST",
        body: JSON.stringify({
          jobId: previewResult.jobId,
          mode: importMode,
          rows: previewResult.validRows,
          confirmReplace: importMode === "replace" ? true : undefined
        }),
      },
      accessToken
    ).then((res) => {
      apiCompleted = true;
      if (res.success && res.data) {
        apiSuccess = true;
        apiResultData = res.data;
      } else {
        apiErrorMsg = res.message || "Failed to commit import transaction.";
      }
    }).catch((err) => {
      apiCompleted = true;
      apiErrorMsg = err.message || "Network exception during commit.";
    });

    // Run visually stunning live timeline simulation
    const steps = [...timelineCheckpoints];
    let currentIdx = 0;
    
    const runTick = async () => {
      if (currentIdx < steps.length - 1) {
        const step = steps[currentIdx];
        setCommitCurrentStep(step.label);
        setCommitLogs(prev => [...prev, `${step.desc}... Done.`]);
        currentIdx++;
        setCommitProgress(Math.round((currentIdx / steps.length) * 100));
        
        // Wait and tick again
        setTimeout(runTick, 800);
      } else {
        // We reached the second to last step (before finished), wait for API to fully finish
        const checkApi = () => {
          if (apiCompleted) {
            if (apiSuccess && apiResultData) {
              setCommitProgress(100);
              setCommitCurrentStep("Completed");
              setCommitLogs(prev => [...prev, "Onboarding finalized. Refreshing ERP indexes... Complete."]);
              setCommitResult(apiResultData);
              
              // Immediate cache refresh without page reload
              queryClient.invalidateQueries();
              fetchImportJobs();
            } else {
              setCommitProgress(100);
              setCommitCurrentStep("Failed");
              setCommitLogs(prev => [...prev, `CRITICAL ERROR: ${apiErrorMsg}`, "Initiating rollback... Rollback Completed safely."]);
              setCommitError(apiErrorMsg);
            }
            setCommitting(false);
          } else {
            setTimeout(checkApi, 200);
          }
        };
        checkApi();
      }
    };

    runTick();
  };

  const resetWizardState = () => {
    setWizardStep(1);
    setUploadFile(null);
    setFileMetadata(null);
    setPreviewResult(null);
    setValidationError(null);
    setImportMode("merge");
    setConfirmModalOpen(false);
    setTypedConfirmation("");
    setPreviewSearch("");
    setDeptFilter("ALL");
    setSecFilter("ALL");
    setSessionFilter("ALL");
    setExpandedCategory(null);
    setCommitting(false);
    setCommitProgress(0);
    setCommitLogs([]);
    setCommitResult(null);
    setCommitError(null);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in text-text-primary">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b dark:border-neutral-800 border-border-subtle pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-500 uppercase tracking-wider mb-1">
            <Database size={16} />
            <span>Institutional Registry Console</span>
          </div>
          <h2 className="font-display font-bold text-2xl dark:text-white text-text-primary">
            Student Import & Onboarding
          </h2>
          <p className="text-xs dark:text-neutral-400 text-text-secondary mt-0.5">
            Safely onboard official student datasets, replace temporary demo files, map structures, and update downstream ERP registers in real-time.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              resetWizardState();
              setIsWizardOpen(true);
            }}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 cursor-pointer transition flex items-center gap-2"
          >
            <PlusCircle size={15} />
            <span>Launch Import Wizard</span>
          </button>
          
          <button
            onClick={fetchImportJobs}
            className="p-2 rounded-lg dark:bg-neutral-850 bg-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-800 dark:text-neutral-400 text-text-secondary border dark:border-neutral-800 border-border-subtle transition cursor-pointer"
            title="Refresh Import Log"
          >
            <RefreshCw size={14} className={loadingJobs ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* DASHBOARD STATISTICS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="glass-card rounded-xl p-4 space-y-2 border dark:border-neutral-800 border-border-subtle">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold dark:text-neutral-500 text-text-muted font-mono tracking-wider">Students Onboarded</span>
            <Users size={14} className="text-blue-500" />
          </div>
          <div>
            <h3 className="text-2xl font-bold dark:text-white text-text-primary font-mono">{stats.studentsImported}</h3>
            <p className="text-[10px] dark:text-neutral-500 text-text-muted mt-1">Written to core database</p>
          </div>
        </div>

        <div className="glass-card rounded-xl p-4 space-y-2 border dark:border-neutral-800 border-border-subtle">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold dark:text-neutral-500 text-text-muted font-mono tracking-wider">Last Committed Import</span>
            <Clock size={14} className="text-emerald-500" />
          </div>
          <div>
            <h4 className="text-[11px] font-bold dark:text-white text-text-primary line-clamp-1 mt-1 font-mono">{stats.lastImport}</h4>
            <p className="text-[10px] dark:text-neutral-500 text-text-muted mt-1">Audit trail timestamp</p>
          </div>
        </div>

        <div className="glass-card rounded-xl p-4 space-y-2 border dark:border-neutral-800 border-border-subtle">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold dark:text-neutral-500 text-text-muted font-mono tracking-wider">Pending Previews</span>
            <AlertTriangle size={14} className="text-amber-500" />
          </div>
          <div>
            <h3 className="text-2xl font-bold dark:text-white text-text-primary font-mono">{stats.pendingValidation}</h3>
            <p className="text-[10px] dark:text-neutral-500 text-text-muted mt-1">Validated uncommitted jobs</p>
          </div>
        </div>

        <div className="glass-card rounded-xl p-4 space-y-2 border dark:border-neutral-800 border-border-subtle">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold dark:text-neutral-500 text-text-muted font-mono tracking-wider">Rolled Back Runs</span>
            <AlertCircle size={14} className="text-rose-500" />
          </div>
          <div>
            <h3 className="text-2xl font-bold dark:text-white text-text-primary font-mono">{stats.failedImports}</h3>
            <p className="text-[10px] dark:text-neutral-500 text-text-muted mt-1">Safely aborted transactions</p>
          </div>
        </div>

      </div>

      {/* CORE VIEW / HISTORY REGISTRY */}
      <div className="bg-surface dark:bg-neutral-900 border dark:border-neutral-800 border-border-subtle rounded-xl p-5 shadow-sm space-y-4">
        
        {/* Navigation Tabs */}
        <div className="flex items-center gap-4 border-b dark:border-neutral-850 border-border-subtle pb-3">
          <button
            onClick={() => setActiveTab("overview")}
            className={`text-xs font-bold pb-2 transition cursor-pointer ${
              activeTab === "overview"
                ? "text-blue-500 border-b-2 border-blue-500"
                : "dark:text-neutral-400 text-text-secondary hover:text-text-primary"
            }`}
          >
            Import History Log
          </button>
          
          <button
            onClick={() => setActiveTab("failed")}
            className={`text-xs font-bold pb-2 transition cursor-pointer ${
              activeTab === "failed"
                ? "text-rose-500 border-b-2 border-rose-500"
                : "dark:text-neutral-400 text-text-secondary hover:text-text-primary"
            }`}
          >
            Safety Abort Log
          </button>
        </div>

        {/* Tab 1: History Log */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            {loadingJobs ? (
              <div className="py-12 text-center">
                <Loader2 className="animate-spin text-blue-500 mx-auto mb-2" size={24} />
                <span className="font-mono text-xs text-text-muted">Loading import records...</span>
              </div>
            ) : jobs.length === 0 ? (
              <div className="py-12 text-center dark:text-neutral-500 text-text-muted font-mono text-xs">
                No import history exists. Launch the wizard above to begin onboarding cohorts.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b dark:border-neutral-800 border-border-subtle dark:text-neutral-400 text-text-secondary font-mono">
                      <th className="py-3 px-4 font-bold">Import Date</th>
                      <th className="py-3 px-4 font-bold">Import Type</th>
                      <th className="py-3 px-4 font-bold">Imported By</th>
                      <th className="py-3 px-4 font-bold">Mode</th>
                      <th className="py-3 px-4 font-bold text-center">Students Imported</th>
                      <th className="py-3 px-4 font-bold">Duration</th>
                      <th className="py-3 px-4 font-bold">Status</th>
                      <th className="py-3 px-4 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((j) => {
                      const isCompleted = j.status === "completed";
                      const isFailed = j.status === "failed" || j.status === "rolled_back";
                      const isPreview = j.status === "previewed";
                      
                      // Duration computation
                      let durationStr = "—";
                      if (j.startedAt && j.completedAt) {
                        const seconds = Math.round((new Date(j.completedAt).getTime() - new Date(j.startedAt).getTime()) / 1000);
                        durationStr = seconds > 0 ? `${seconds}s` : "< 1s";
                      }

                      return (
                        <tr key={j.id} className="border-b dark:border-neutral-850 border-border-subtle hover:bg-neutral-50 dark:hover:bg-neutral-950/20 font-mono text-[11px]">
                          <td className="py-3.5 px-4 dark:text-white text-text-primary">
                            {new Date(j.createdAt).toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 uppercase text-blue-400 font-bold">
                            {j.entityType}
                          </td>
                          <td className="py-3.5 px-4 dark:text-neutral-400 text-text-secondary">
                            {j.createdByName || "System Admin"}
                          </td>
                          <td className="py-3.5 px-4 capitalize font-semibold dark:text-neutral-300 text-text-secondary">
                            {j.mode || "merge"}
                          </td>
                          <td className="py-3.5 px-4 text-center font-bold dark:text-white text-text-primary">
                            {isCompleted ? j.createdCount : j.validRows}
                          </td>
                          <td className="py-3.5 px-4 dark:text-neutral-450 text-text-muted">
                            {durationStr}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              isCompleted
                                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                : isFailed
                                ? "bg-rose-500/10 text-rose-550 border-rose-500/20"
                                : isPreview
                                ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                : "bg-blue-500/10 text-blue-550 border-blue-500/20"
                            }`}>
                              {j.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => {
                                if (isPreview) {
                                  const mockPreview: ImportPreviewResult<any> = {
                                    jobId: j.id,
                                    entityType: j.entityType,
                                    mode: j.mode,
                                    validRows: [],
                                    invalidRows: [],
                                    summary: j.summary || { total: j.totalRows, valid: j.validRows, invalid: j.invalidRows, duplicate: j.duplicateRows, distributions: {}, toCreate: j.createdCount, toUpdate: j.updatedCount, ignoredColumns: [] },
                                  };
                                  setPreviewResult(mockPreview);
                                  setWizardStep(4);
                                  setIsWizardOpen(true);
                                } else {
                                  alert(`Job Info:\nID: ${j.id}\n${j.errorMessage ? `Error: ${j.errorMessage}` : "Success"}`);
                                }
                              }}
                              className="text-blue-500 hover:underline cursor-pointer"
                            >
                              {isPreview ? "Commit" : "Details"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Safety Abort Log */}
        {activeTab === "failed" && (
          <div className="space-y-4">
            {jobs.filter(j => j.status === "failed" || j.status === "rolled_back").length === 0 ? (
              <div className="py-12 text-center dark:text-neutral-500 text-text-muted font-mono text-xs">
                No failed or rolled back transactions detected. Database integrity is normal.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b dark:border-neutral-800 border-border-subtle dark:text-neutral-400 text-text-secondary font-mono">
                      <th className="py-3 px-4 font-bold">Aborted Date</th>
                      <th className="py-3 px-4 font-bold">Import Type</th>
                      <th className="py-3 px-4 font-bold">File Name</th>
                      <th className="py-3 px-4 font-bold">Mode</th>
                      <th className="py-3 px-4 font-bold">Rollback Reason / Error</th>
                      <th className="py-3 px-4 font-bold text-center">Failed Rows</th>
                      <th className="py-3 px-4 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.filter(j => j.status === "failed" || j.status === "rolled_back").map((j) => (
                      <tr key={j.id} className="border-b dark:border-neutral-850 border-border-subtle hover:bg-neutral-50 dark:hover:bg-neutral-950/20 font-mono text-[11px]">
                        <td className="py-3.5 px-4 dark:text-white text-text-primary">
                          {new Date(j.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 uppercase text-rose-500 font-bold">{j.entityType}</td>
                        <td className="py-3.5 px-4 dark:text-neutral-300 text-text-secondary truncate max-w-[150px]">
                          {j.fileName || "N/A"}
                        </td>
                        <td className="py-3.5 px-4 capitalize font-semibold dark:text-neutral-300 text-text-secondary">
                          {j.mode || "replace"}
                        </td>
                        <td className="py-3.5 px-4 text-rose-455 dark:text-rose-400 font-bold max-w-sm truncate">
                          {j.errorMessage || "Validation or structure failure inside transaction boundary."}
                        </td>
                        <td className="py-3.5 px-4 text-center text-text-muted">{j.invalidRows} rows</td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => {
                              resetWizardState();
                              setIsWizardOpen(true);
                            }}
                            className="px-2.5 py-1 text-[10px] font-bold rounded bg-rose-500/10 text-rose-400 border border-rose-500/25 hover:bg-rose-500/20 transition cursor-pointer"
                          >
                            Retry
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>

      {/* IMPORT CONSOLE WIZARD MODAL */}
      {isWizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/80 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
          <div className="relative w-full max-w-6xl dark:bg-neutral-900 bg-surface border dark:border-neutral-800 border-border-subtle rounded-xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b dark:border-neutral-800 border-border-subtle p-4 shrink-0">
              <div className="flex items-center gap-2">
                <Database className="text-blue-500 animate-pulse" size={18} />
                <h3 className="font-display font-bold text-base dark:text-white text-text-primary">
                  Student Database Import Center
                </h3>
              </div>
              <button
                onClick={() => {
                  if (confirm("Close import console? Uncommitted records will be lost.")) {
                    setIsWizardOpen(false);
                  }
                }}
                className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Stepper Wizard Progress */}
            <div className="px-6 py-4 border-b dark:border-neutral-850 border-border-subtle bg-neutral-50 dark:bg-neutral-950/20 flex justify-between items-center shrink-0 overflow-x-auto select-none gap-2">
              {[
                { s: 1, name: "Upload Excel" },
                { s: 2, name: "Column Detection" },
                { s: 3, name: "Import Mode" },
                { s: 4, name: "Validation & Settings" },
                { s: 5, name: "Synchronization & Status" },
              ].map((stepItem) => {
                const isActive = wizardStep === stepItem.s;
                const isCompleted = wizardStep > stepItem.s;
                return (
                  <div key={stepItem.s} className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition ${
                        isActive 
                          ? "bg-blue-600 text-white border-blue-600 shadow shadow-blue-500/25"
                          : isCompleted
                          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                          : "dark:bg-neutral-850 bg-neutral-100 dark:border-neutral-800 border-border-subtle dark:text-neutral-500 text-text-muted"
                      }`}>
                        {isCompleted ? <Check size={12} /> : stepItem.s}
                      </div>
                      <span className={`text-xs font-bold font-mono tracking-wide truncate max-w-[120px] ${
                        isActive ? "text-blue-500" : isCompleted ? "text-emerald-500" : "dark:text-neutral-500 text-text-muted"
                      }`}>
                        {stepItem.name}
                      </span>
                    </div>
                    {stepItem.s < 5 && <ChevronRight size={14} className="text-neutral-400 dark:text-neutral-600 shrink-0" />}
                  </div>
                );
              })}
            </div>

            {/* Wizard Body */}
            <div className="flex-1 overflow-y-auto p-6 min-h-0">
              
              {validationError && wizardStep !== 5 && (
                <div className="p-4 mb-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-550 text-xs font-semibold flex items-center gap-2 animate-fade-in">
                  <AlertCircle size={16} />
                  <span>{validationError}</span>
                </div>
              )}

              {/* STEP 1: UPLOAD SpreadSheet */}
              {wizardStep === 1 && (
                <div className="space-y-6 max-w-2xl mx-auto py-6 animate-fade-in">
                  <div className="text-center max-w-lg mx-auto">
                    <h4 className="font-display font-bold text-sm dark:text-white text-text-primary mb-1">
                      Upload College Student Dataset
                    </h4>
                    <p className="text-xs dark:text-neutral-400 text-text-secondary leading-relaxed">
                      Upload your official student enrollment spreadsheet. Supported formats: .xlsx, .xls, .csv.
                    </p>
                  </div>
                  
                  {/* Upload Drop Zone */}
                  {!uploadFile ? (
                    <div
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      className="border-2 border-dashed dark:border-neutral-800 border-border-strong rounded-xl p-10 text-center flex flex-col items-center justify-center space-y-4 bg-neutral-50/50 dark:bg-neutral-950/10 hover:border-blue-500/50 transition duration-150"
                    >
                      <div className="w-12 h-12 rounded-full dark:bg-neutral-800 bg-neutral-100 flex items-center justify-center text-blue-500 shadow-inner">
                        <FileSpreadsheet size={20} className="animate-pulse" />
                      </div>

                      <div className="space-y-1">
                        <h4 className="font-bold text-xs dark:text-white text-text-primary">
                          Drag & Drop Excel or CSV file
                        </h4>
                        <p className="text-[10px] dark:text-neutral-500 text-text-muted">
                          Up to 15MB file size allowed.
                        </p>
                      </div>

                      <label className="px-4 py-2 rounded bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-750 text-xs font-semibold cursor-pointer transition select-none">
                        Browse File
                        <input
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="glass-card rounded-xl p-5 border border-blue-500/20 bg-blue-500/5 space-y-4 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-emerald-500/10 text-emerald-500 border border-emerald-500/25 rounded-lg flex items-center justify-center">
                            <FileSpreadsheet size={20} />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold dark:text-white text-text-primary truncate max-w-sm">
                              {fileMetadata?.name}
                            </h4>
                            <div className="text-[10px] dark:text-neutral-500 text-text-muted font-mono mt-0.5">
                              {fileMetadata?.size} · Uploaded: {fileMetadata?.uploadedTime}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <label className="px-3 py-1.5 rounded dark:bg-neutral-850 bg-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-750 border dark:border-neutral-800 border-border-subtle text-[10px] font-bold cursor-pointer transition select-none">
                            Replace File
                            <input
                              type="file"
                              accept=".xlsx,.xls,.csv"
                              onChange={handleFileChange}
                              className="hidden"
                            />
                          </label>
                          
                          <button
                            onClick={() => {
                              setUploadFile(null);
                              setFileMetadata(null);
                            }}
                            className="p-1.5 hover:bg-rose-500/10 text-rose-500 rounded border border-rose-500/20 transition cursor-pointer"
                            title="Remove file"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Template download & instruction banner */}
                  <div className="flex items-center justify-between p-3.5 bg-blue-500/5 border border-blue-500/10 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Info className="text-blue-500 shrink-0" size={16} />
                      <span className="text-[11px] dark:text-neutral-400 text-text-secondary leading-normal">
                        To align with core registrar regulations, please map your columns against our default spreadsheet format.
                      </span>
                    </div>
                    <button
                      onClick={handleDownloadTemplate}
                      className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] cursor-pointer transition flex items-center gap-1 shrink-0 shadow shadow-blue-500/20"
                    >
                      <Download size={10} />
                      <span>Download Template</span>
                    </button>
                  </div>

                </div>
              )}

              {/* STEP 2: COLUMN DETECTION & SMART PANEL */}
              {wizardStep === 2 && previewResult && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
                  
                  {/* Column mappings */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-xs uppercase font-mono tracking-wider dark:text-neutral-450 text-text-secondary">
                        Mapped and Detected Columns
                      </h4>
                    </div>

                    <div className="border dark:border-neutral-800 border-border-subtle rounded-xl overflow-hidden bg-background">
                      <div className="p-3.5 bg-neutral-50 dark:bg-neutral-950/20 border-b dark:border-neutral-850 border-border-subtle flex items-center justify-between">
                        <span className="text-[11px] font-mono font-bold dark:text-neutral-400 text-text-secondary">Expected Schema Columns</span>
                        <span className="text-[10px] font-mono dark:text-neutral-500 text-text-muted">Detected successfully</span>
                      </div>

                      <div className="divide-y dark:divide-neutral-850 divide-border-subtle max-h-96 overflow-y-auto">
                        {[
                          { label: "Roll Number", desc: "Unique student registry identifier" },
                          { label: "Student Name", desc: "Official academic name" },
                          { label: "Department", desc: "Engineering / Arts branch abbreviation" },
                          { label: "Academic Session", desc: "Current academic year division" },
                          { label: "Section", desc: "Classroom division code (A, B, etc.)" },
                          { label: "Email", desc: "Official communication contact" },
                          { label: "Student Mobile", desc: "Student contact number" },
                          { label: "Parent Mobile", desc: "Primary parent contact number" },
                          { label: "Gender", desc: "Gender detail classification" },
                          { label: "Admission Year", desc: "Onboarding cohort year" },
                          { label: "Academic Regulation", desc: "Syllabus board guidelines (e.g. R22)" },
                          { label: "Father Name", desc: "Parent designation identifier" },
                          { label: "Mother Name", desc: "Parent designation identifier" },
                        ].map((col) => (
                          <div key={col.label} className="p-3.5 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-950/10 transition">
                            <div className="space-y-0.5">
                              <span className="text-xs font-bold dark:text-white text-text-primary">{col.label}</span>
                              <p className="text-[10px] dark:text-neutral-500 text-text-muted">{col.desc}</p>
                            </div>
                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-mono">
                              <Check size={10} /> Mapped
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Ignored columns for privacy */}
                    <div className="border dark:border-neutral-800 border-border-subtle rounded-xl overflow-hidden bg-background">
                      <button
                        onClick={() => setIgnoredExpanded(!ignoredExpanded)}
                        className="w-full p-3.5 bg-neutral-50 dark:bg-neutral-950/20 hover:bg-neutral-100 dark:hover:bg-neutral-950/40 flex items-center justify-between text-left transition"
                      >
                        <div className="flex items-center gap-2">
                          <ShieldAlert className="text-amber-500 shrink-0" size={16} />
                          <div>
                            <span className="text-xs font-bold dark:text-white text-text-primary">Ignored columns (Privacy Guard)</span>
                            <p className="text-[10px] dark:text-neutral-500 text-text-muted mt-0.5">Excluded automatically to safeguard sensitive data</p>
                          </div>
                        </div>
                        {ignoredExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>

                      {ignoredExpanded && (
                        <div className="p-4 divide-y dark:divide-neutral-850 divide-border-subtle animate-fade-in">
                          {[
                            { label: "Aadhaar Number", desc: "Government UID number" },
                            { label: "Government ID", desc: "Voter card, PAN details" },
                            { label: "Permanent Address", desc: "Native state coordinates" },
                            { label: "Temporary Address", desc: "Local housing addresses" },
                          ].map((col) => (
                            <div key={col.label} className="py-2.5 flex items-center justify-between">
                              <div className="space-y-0.5">
                                <span className="text-xs font-semibold dark:text-neutral-400 text-text-secondary">{col.label}</span>
                                <p className="text-[10px] dark:text-neutral-550 text-text-muted">{col.desc}</p>
                              </div>
                              <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-mono">
                                Ignored for Privacy
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>

                  {/* Smart Detection Panel */}
                  <div className="space-y-4">
                    <h4 className="font-bold text-xs uppercase font-mono tracking-wider dark:text-neutral-450 text-text-secondary">
                      Smart Detection Panel
                    </h4>

                    {smartMetrics && (
                      <div className="glass-card rounded-xl p-5 border dark:border-neutral-800 border-border-subtle space-y-5 bg-blue-500/5">
                        
                        {/* Total Count */}
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase font-bold dark:text-neutral-500 text-text-muted font-mono tracking-wider">Total Student Records Found</span>
                          <h3 className="text-3xl font-bold text-blue-500 font-mono">{smartMetrics.totalCount}</h3>
                        </div>

                        {/* Departments */}
                        <div className="space-y-2 border-t dark:border-neutral-850 border-border-subtle pt-3.5">
                          <span className="text-[10px] uppercase font-bold dark:text-neutral-500 text-text-muted font-mono tracking-wider block">Departments Detected</span>
                          <div className="flex flex-wrap gap-1.5">
                            {smartMetrics.depts.map((d) => (
                              <span key={d} className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase">
                                {d}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Academic Sessions */}
                        <div className="space-y-2 border-t dark:border-neutral-850 border-border-subtle pt-3.5">
                          <span className="text-[10px] uppercase font-bold dark:text-neutral-500 text-text-muted font-mono tracking-wider block">Academic Sessions Detected</span>
                          <div className="flex flex-wrap gap-1.5">
                            {smartMetrics.sessions.map((s) => (
                              <span key={s} className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Sections */}
                        <div className="space-y-2 border-t dark:border-neutral-850 border-border-subtle pt-3.5">
                          <span className="text-[10px] uppercase font-bold dark:text-neutral-500 text-text-muted font-mono tracking-wider block">Sections Detected</span>
                          <div className="flex flex-wrap gap-1.5">
                            {smartMetrics.sections.map((sec) => (
                              <span key={sec} className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                Section {sec}
                              </span>
                            ))}
                          </div>
                        </div>

                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* STEP 3: IMPORT MODE */}
              {wizardStep === 3 && (
                <div className="space-y-6 max-w-4xl mx-auto py-6 animate-fade-in">
                  <div className="text-center max-w-lg mx-auto">
                    <h4 className="font-display font-bold text-sm dark:text-white text-text-primary mb-1">
                      Choose Database Import Mode
                    </h4>
                    <p className="text-xs dark:text-neutral-400 text-text-secondary leading-relaxed">
                      Select how your uploaded dataset should be integrated with our active registrar databases.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    
                    {/* Merge Mode */}
                    <button
                      onClick={() => handleSelectMode("merge")}
                      className={`text-left rounded-xl p-6 border transition flex flex-col justify-between space-y-4 hover:border-blue-500/50 cursor-pointer ${
                        importMode === "merge"
                          ? "bg-blue-500/5 border-blue-500 shadow-sm"
                          : "dark:border-neutral-800 border-border-subtle bg-surface dark:bg-neutral-900"
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                          <PlusCircle size={20} />
                        </div>
                        <h4 className="font-bold text-sm dark:text-white text-text-primary mt-2">Incremental Merge Mode</h4>
                        <ul className="text-xs dark:text-neutral-400 text-text-secondary space-y-1.5 leading-normal pl-4 list-disc">
                          <li>Appends new student profiles</li>
                          <li>Updates duplicates by matching Roll Number</li>
                          <li>Preserves all current attendance records</li>
                          <li>Safer mode for mid-semester corrections</li>
                        </ul>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-blue-500 flex items-center gap-1">
                        <span>Select Merge Mode</span>
                        <ChevronRight size={10} />
                      </span>
                    </button>

                    {/* Replace Mode */}
                    <button
                      onClick={() => handleSelectMode("replace")}
                      className={`text-left rounded-xl p-6 border transition flex flex-col justify-between space-y-4 hover:border-rose-500/50 cursor-pointer relative ${
                        importMode === "replace"
                          ? "bg-rose-500/5 border-rose-500 shadow-sm"
                          : "dark:border-neutral-800 border-border-subtle bg-surface dark:bg-neutral-900"
                      }`}
                    >
                      <span className="absolute top-4 right-4 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20 font-mono tracking-wider animate-pulse">
                        Recommended
                      </span>

                      <div className="space-y-2">
                        <div className="w-10 h-10 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center">
                          <Trash2 size={20} />
                        </div>
                        <h4 className="font-bold text-sm dark:text-white text-text-primary mt-2">Full Database Replace Mode</h4>
                        <ul className="text-xs dark:text-neutral-400 text-text-secondary space-y-1.5 leading-normal pl-4 list-disc">
                          <li>Deletes temporary demo student profiles</li>
                          <li>Wipes attendance register logs of matched students</li>
                          <li>Clears LMS module enrollments & bookmarks</li>
                          <li>Synchronizes the entire ERP around official dataset</li>
                        </ul>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-rose-500 flex items-center gap-1">
                        <span>Select Replace Mode</span>
                        <ChevronRight size={10} />
                      </span>
                    </button>

                  </div>
                </div>
              )}

              {/* STEP 4: VALIDATION DIAGNOSTICS & PREVIEW GRID */}
              {wizardStep === 4 && previewResult && (
                <div className="space-y-6 animate-fade-in">
                  
                  {/* Validation Verdict & Categories */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Validation Diagnostics List */}
                    <div className="lg:col-span-1 space-y-4">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase font-mono tracking-wider dark:text-neutral-400 text-text-secondary">
                        <ShieldAlert size={14} className="text-blue-500" />
                        <span>Validation Diagnostics Report</span>
                      </div>

                      {validationCategories && (
                        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                          
                          {/* Categories cards */}
                          {[
                            { key: "valid", label: "Valid Student Records", count: validationCategories.validStudents, color: "text-emerald-500 border-emerald-500/25 bg-emerald-500/5", details: null },
                            { key: "invalid", label: "Invalid Records Rejected", count: validationCategories.invalidStudents, color: "text-rose-500 border-rose-500/25 bg-rose-500/5", details: previewResult.invalidRows },
                            { key: "dupHt", label: "Duplicate Roll Numbers", count: validationCategories.duplicateRolls.length, color: "text-amber-500 border-amber-500/25 bg-amber-500/5", details: validationCategories.duplicateRolls },
                            { key: "dupEm", label: "Duplicate Emails", count: validationCategories.duplicateEmails.length, color: "text-amber-500 border-amber-500/25 bg-amber-500/5", details: validationCategories.duplicateEmails },
                            { key: "exist", label: "Existing Students (Updates)", count: validationCategories.existingStudents.length, color: "text-blue-500 border-blue-500/25 bg-blue-500/5", details: validationCategories.existingStudents },
                            { key: "dept", label: "Unknown Departments", count: validationCategories.unknownDepts.length, color: "text-rose-500 border-rose-500/25 bg-rose-500/5", details: validationCategories.unknownDepts },
                            { key: "sec", label: "Unknown Sections", count: validationCategories.unknownSections.length, color: "text-rose-500 border-rose-500/25 bg-rose-500/5", details: validationCategories.unknownSections },
                            { key: "curr", label: "Missing Curriculum Setups", count: validationCategories.missingCurriculum.length, color: "text-rose-500 border-rose-500/25 bg-rose-500/5", details: validationCategories.missingCurriculum },
                            { key: "sess", label: "Missing Academic Sessions", count: validationCategories.missingSession.length, color: "text-rose-500 border-rose-500/25 bg-rose-500/5", details: validationCategories.missingSession }
                          ].map((cat) => (
                            <div key={cat.key} className={`border rounded-lg overflow-hidden transition ${cat.color}`}>
                              
                              <button
                                onClick={() => cat.details && cat.details.length > 0 && setExpandedCategory(expandedCategory === cat.key ? null : cat.key)}
                                className="w-full p-3 flex items-center justify-between text-left text-xs font-bold"
                              >
                                <span>{cat.label}</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-sm">{cat.count}</span>
                                  {cat.details && cat.details.length > 0 && (
                                    expandedCategory === cat.key ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                                  )}
                                </div>
                              </button>

                              {expandedCategory === cat.key && cat.details && (
                                <div className="p-3 border-t border-inherit bg-background/50 divide-y divide-border-subtle max-h-40 overflow-y-auto space-y-1.5">
                                  {cat.details.slice(0, 15).map((row, idx) => (
                                    <div key={idx} className="text-[10px] font-mono py-1.5">
                                      <div className="font-bold">Row {row.rowNumber} ({row.identifier})</div>
                                      <ul className="list-disc pl-3 text-text-muted">
                                        {row.errors.map((e: string, i: number) => <li key={i}>{e}</li>)}
                                      </ul>
                                    </div>
                                  ))}
                                  {cat.details.length > 15 && (
                                    <div className="text-[9px] text-text-muted font-mono pt-1 text-center">
                                      And {cat.details.length - 15} more failures.
                                    </div>
                                  )}
                                </div>
                              )}

                            </div>
                          ))}

                        </div>
                      )}
                    </div>

                    {/* Preview Table & Filtering */}
                    <div className="lg:col-span-2 space-y-4">
                      
                      {/* Filtering row */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <h4 className="font-bold text-xs uppercase font-mono tracking-wider dark:text-neutral-450 text-text-secondary">
                          Live Preview Grid: Valid Rows ({filteredValidRows.length})
                        </h4>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleDownloadDiagnosticReport}
                            disabled={previewResult.invalidRows.length === 0}
                            className="px-2.5 py-1.5 rounded dark:bg-neutral-850 bg-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-750 text-[10px] font-mono font-bold border dark:border-neutral-800 border-border-subtle transition disabled:opacity-40 flex items-center gap-1.5"
                          >
                            <Download size={11} />
                            <span>Download diagnostic CSV</span>
                          </button>
                        </div>
                      </div>

                      {/* Filters grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                        {/* Search */}
                        <div className="relative col-span-1 sm:col-span-2">
                          <Search className="absolute left-2.5 top-2.5 text-text-muted" size={12} />
                          <input
                            type="text"
                            placeholder="Search name, email, roll..."
                            value={previewSearch}
                            onChange={(e) => {
                              setPreviewSearch(e.target.value);
                              setPreviewPage(1);
                            }}
                            className="w-full pl-7 pr-3 py-1.5 rounded dark:bg-neutral-950 bg-background border dark:border-neutral-800 border-border-subtle font-mono text-[10px] text-text-primary"
                          />
                        </div>

                        {/* Dept filter */}
                        <select
                          value={deptFilter}
                          onChange={(e) => {
                            setDeptFilter(e.target.value);
                            setPreviewPage(1);
                          }}
                          className="px-2.5 py-1.5 rounded dark:bg-neutral-950 bg-background border dark:border-neutral-800 border-border-subtle font-mono text-[10px] text-text-primary"
                        >
                          <option value="ALL">All Depts</option>
                          {smartMetrics && smartMetrics.depts.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>

                        {/* Section filter */}
                        <select
                          value={secFilter}
                          onChange={(e) => {
                            setSecFilter(e.target.value);
                            setPreviewPage(1);
                          }}
                          className="px-2.5 py-1.5 rounded dark:bg-neutral-950 bg-background border dark:border-neutral-800 border-border-subtle font-mono text-[10px] text-text-primary"
                        >
                          <option value="ALL">All Sections</option>
                          {smartMetrics && smartMetrics.sections.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>

                      {/* Table */}
                      <div className="border dark:border-neutral-800 border-border-subtle rounded-xl overflow-hidden bg-background">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b dark:border-neutral-850 border-border-subtle bg-neutral-50 dark:bg-neutral-950/20 font-mono text-[9px] uppercase font-bold dark:text-neutral-400 text-text-secondary select-none">
                              {[
                                { key: "rollNumber", label: "Roll Number" },
                                { key: "fullName", label: "Student Name" },
                                { key: "departmentName", label: "Department" },
                                { key: "academicYear", label: "Session" },
                                { key: "section", label: "Sec" },
                                { key: "gender", label: "Gender" },
                                { key: "email", label: "Email" },
                              ].map((h) => (
                                <th
                                  key={h.key}
                                  onClick={() => {
                                    if (sortField === h.key) {
                                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                                    } else {
                                      setSortField(h.key);
                                      setSortOrder("asc");
                                    }
                                  }}
                                  className="py-2.5 px-3 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-850 transition"
                                >
                                  {h.label} {sortField === h.key && (sortOrder === "asc" ? "↑" : "↓")}
                                </th>
                              ))}
                              <th className="py-2.5 px-3">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedRows.length === 0 ? (
                              <tr>
                                <td colSpan={8} className="p-8 text-center text-[10px] dark:text-neutral-500 text-text-muted font-mono">
                                  No records found matching filters.
                                </td>
                              </tr>
                            ) : (
                              paginatedRows.map((r, idx) => (
                                <tr key={idx} className="border-b dark:border-neutral-850 border-border-subtle font-mono text-[11px] hover:bg-neutral-50 dark:hover:bg-neutral-950/25">
                                  <td className="py-2.5 px-3 dark:text-white text-text-primary font-bold">{r.rollNumber}</td>
                                  <td className="py-2.5 px-3 dark:text-neutral-300 text-text-secondary">{r.fullName}</td>
                                  <td className="py-2.5 px-3 dark:text-neutral-400 text-text-secondary">{r.departmentName}</td>
                                  <td className="py-2.5 px-3 dark:text-neutral-400 text-text-secondary">{r.academicYear}</td>
                                  <td className="py-2.5 px-3 font-semibold text-blue-500">{r.section}</td>
                                  <td className="py-2.5 px-3 dark:text-neutral-400 text-text-secondary">{r.gender || "—"}</td>
                                  <td className="py-2.5 px-3 dark:text-neutral-300 text-text-secondary max-w-[120px] truncate" title={r.email}>{r.email}</td>
                                  <td className="py-2.5 px-3">
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                                      r.action === "update"
                                        ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                        : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                    }`}>
                                      {r.action === "update" ? "Match" : "Valid"}
                                    </span>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination Controls */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between border-t dark:border-neutral-850 border-border-subtle pt-3 font-mono text-[10px]">
                          <span className="text-text-muted">
                            Page {previewPage} of {totalPages} ({filteredValidRows.length} items total)
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              disabled={previewPage === 1}
                              onClick={() => setPreviewPage(previewPage - 1)}
                              className="p-1 px-2.5 rounded bg-neutral-100 dark:bg-neutral-850 hover:bg-neutral-200 dark:hover:bg-neutral-800 disabled:opacity-40"
                            >
                              Prev
                            </button>
                            <button
                              disabled={previewPage === totalPages}
                              onClick={() => setPreviewPage(previewPage + 1)}
                              className="p-1 px-2.5 rounded bg-neutral-100 dark:bg-neutral-850 hover:bg-neutral-200 dark:hover:bg-neutral-800 disabled:opacity-40"
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      )}

                    </div>

                  </div>

                  {/* Synchronization settings (checked & disabled because backend requires them) */}
                  <div className="space-y-4 pt-4 border-t dark:border-neutral-800 border-border-subtle">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase font-mono tracking-wider dark:text-neutral-450 text-text-secondary">
                      <CheckSquare size={14} className="text-blue-500" />
                      <span>Downstream Synchronization Options</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-1">
                      {[
                        { key: "syncCurriculum", label: "Synchronize Curriculum" },
                        { key: "initAttendance", label: "Initialize Attendance" },
                        { key: "enrollLMS", label: "Initialize LMS Modules" },
                        { key: "initInternalMarks", label: "Initialize Internal Marks" },
                        { key: "enableEligibility", label: "Initialize Exam Seating Eligibility" },
                        { key: "createDashboard", label: "Create Student Dashboard" },
                        { key: "indexGlobalSearch", label: "Update Global Search Index" }
                      ].map((option) => (
                        <div key={option.key} className="p-3 border dark:border-neutral-850 border-border-subtle bg-background rounded-lg flex items-start gap-2.5 select-none opacity-85">
                          <input
                            type="checkbox"
                            checked={syncSettings[option.key as keyof typeof syncSettings]}
                            disabled={true}
                            className="mt-0.5"
                          />
                          <div className="space-y-0.5">
                            <span className="text-[11px] font-bold dark:text-white text-text-primary block">{option.label}</span>
                            <span className="text-[9px] text-blue-500 font-bold font-mono">Mandatory (Automatic)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )}

              {/* STEP 5: SYNC PROGRESS / RESULTS SUCCESS & FAILURE VIEW */}
              {wizardStep === 5 && (
                <div className="max-w-3xl mx-auto py-6 animate-fade-in space-y-6">
                  
                  {/* Committing Progress Tracker */}
                  {committing && (
                    <div className="space-y-6 text-center">
                      <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                        <div className="absolute inset-0 rounded-full border-4 border-blue-500/10 border-t-blue-500 animate-spin" />
                        <Database className="text-blue-500" size={24} />
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-display font-bold text-sm dark:text-white text-text-primary">
                          {commitCurrentStep}
                        </h4>
                        <div className="w-full bg-neutral-200 dark:bg-neutral-800 h-2 rounded-full overflow-hidden max-w-xs mx-auto">
                          <div className="h-full bg-blue-600 rounded-full transition-all duration-300" style={{ width: `${commitProgress}%` }} />
                        </div>
                        <span className="font-mono text-[10px] dark:text-neutral-500 text-text-muted mt-2 block">
                          {commitProgress}% Completed · Sync in progress
                        </span>
                      </div>

                      {/* Log Terminal */}
                      <div className="bg-neutral-950 border border-neutral-850 rounded-xl p-4 text-left max-w-lg mx-auto space-y-1.5 font-mono text-[10px] text-emerald-400 overflow-y-auto max-h-40">
                        <div>$ initiating transaction batch commit...</div>
                        {commitLogs.map((log, idx) => (
                          <div key={idx}>&gt; {log}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Complete SUCCESS Screen */}
                  {!committing && commitResult && !commitError && (
                    <div className="space-y-6 animate-fade-in">
                      <div className="text-center space-y-2">
                        <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center mx-auto mb-2 animate-bounce">
                          <CheckCircle2 size={24} />
                        </div>
                        <h4 className="font-display font-bold text-base dark:text-white text-text-primary">
                          Import Completed Successfully
                        </h4>
                        <p className="text-xs dark:text-neutral-400 text-text-secondary max-w-md mx-auto">
                          Spreadsheet dataset has been committed successfully to the database. All synchronization checkpoints resolved.
                        </p>
                      </div>

                      {/* Success stats */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="glass-card rounded-lg p-4 text-center border dark:border-neutral-850 border-emerald-250 bg-emerald-500/5">
                          <span className="text-[10px] font-bold dark:text-neutral-400 text-text-secondary uppercase font-mono tracking-wider block">Students Onboarded</span>
                          <h3 className="text-2xl font-bold text-emerald-500 mt-2 font-mono">{commitResult.createdCount}</h3>
                        </div>

                        <div className="glass-card rounded-lg p-4 text-center border dark:border-neutral-850 border-blue-250 bg-blue-500/5">
                          <span className="text-[10px] font-bold dark:text-neutral-400 text-text-secondary uppercase font-mono tracking-wider block">Profiles Updated</span>
                          <h3 className="text-2xl font-bold text-blue-500 mt-2 font-mono">{commitResult.updatedCount}</h3>
                        </div>

                        <div className="glass-card rounded-lg p-4 text-center border dark:border-neutral-850 border-neutral-250 bg-neutral-500/5">
                          <span className="text-[10px] font-bold dark:text-neutral-400 text-text-secondary uppercase font-mono tracking-wider block">Duplicates Skipped</span>
                          <h3 className="text-2xl font-bold dark:text-neutral-500 text-text-muted mt-2 font-mono">{commitResult.skippedCount}</h3>
                        </div>
                      </div>

                      {/* Sync checks */}
                      {smartMetrics && (
                        <div className="glass-card rounded-xl p-5 border dark:border-neutral-850 border-border-subtle space-y-4">
                          <h5 className="text-[10px] font-bold uppercase font-mono dark:text-neutral-500 text-text-muted border-b dark:border-neutral-850 border-border-subtle pb-2">
                            Synchronization successful breakdown
                          </h5>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                            <div className="p-3 rounded-lg dark:bg-neutral-950 bg-neutral-50 border dark:border-neutral-850 border-border-subtle flex items-center justify-between">
                              <span className="text-text-secondary">Departments Synced</span>
                              <span className="text-emerald-500 font-bold">{smartMetrics.depts.length}</span>
                            </div>
                            <div className="p-3 rounded-lg dark:bg-neutral-950 bg-neutral-50 border dark:border-neutral-850 border-border-subtle flex items-center justify-between">
                              <span className="text-text-secondary">Sessions Synced</span>
                              <span className="text-emerald-500 font-bold">{smartMetrics.sessions.length}</span>
                            </div>
                            <div className="p-3 rounded-lg dark:bg-neutral-950 bg-neutral-50 border dark:border-neutral-850 border-border-subtle flex items-center justify-between">
                              <span className="text-text-secondary">Sections Synced</span>
                              <span className="text-emerald-500 font-bold">{smartMetrics.sections.length}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Buttons */}
                      <div className="flex items-center justify-center gap-3 pt-2">
                        <button
                          onClick={() => {
                            setIsWizardOpen(false);
                            router.push("/admin/students");
                          }}
                          className="px-4 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition flex items-center gap-1.5 shadow shadow-blue-500/20"
                        >
                          <ExternalLink size={13} />
                          <span>Go To Student Management</span>
                        </button>
                        
                        <button
                          onClick={() => {
                            setIsWizardOpen(false);
                            setActiveTab("overview");
                          }}
                          className="px-4 py-2 text-xs font-bold rounded-lg border dark:border-neutral-800 border-border-subtle hover:bg-neutral-100 dark:hover:bg-neutral-850 transition"
                        >
                          View Import Logs
                        </button>
                      </div>
                    </div>
                  )}

                  {/* FAILED / Rollback complete Screen */}
                  {!committing && commitError && (
                    <div className="space-y-6 animate-fade-in text-center">
                      <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center mx-auto mb-2">
                        <AlertCircle size={24} />
                      </div>
                      
                      <div className="space-y-2">
                        <h4 className="font-display font-bold text-base dark:text-white text-text-primary">
                          Database Import Failed
                        </h4>
                        <p className="text-xs text-rose-500 font-semibold max-w-md mx-auto">
                          Reason: {commitError}
                        </p>
                        <p className="text-xs dark:text-neutral-400 text-text-secondary max-w-sm mx-auto">
                          Database changes have been fully aborted and rolled back. Zero records were mutated in production.
                        </p>
                      </div>

                      <div className="flex items-center justify-center gap-3 pt-2">
                        <button
                          onClick={() => setWizardStep(1)}
                          className="px-4 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition flex items-center gap-1.5 shadow shadow-blue-500/20"
                        >
                          <RefreshCw size={13} />
                          <span>Retry Import</span>
                        </button>
                        
                        <button
                          onClick={() => {
                            setIsWizardOpen(false);
                            resetWizardState();
                          }}
                          className="px-4 py-2 text-xs font-bold rounded-lg border dark:border-neutral-800 border-border-subtle hover:bg-neutral-100 dark:hover:bg-neutral-850 transition"
                        >
                          Close Console
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              )}

            </div>

            {/* Wizard Actions Footer */}
            <div className="border-t dark:border-neutral-800 border-border-subtle p-4 flex items-center justify-between shrink-0 bg-neutral-50 dark:bg-neutral-950/20">
              
              {/* Back button */}
              <div>
                {wizardStep > 1 && wizardStep < 5 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (wizardStep === 4) {
                        setWizardStep(3);
                      } else {
                        setWizardStep(prev => prev - 1);
                      }
                    }}
                    className="px-4 py-2 text-xs font-semibold rounded-lg dark:bg-neutral-800 bg-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-750 dark:text-neutral-300 text-text-primary border dark:border-neutral-800 border-border-subtle cursor-pointer transition flex items-center gap-1.5"
                  >
                    <ArrowLeft size={14} />
                    <span>Back</span>
                  </button>
                )}
              </div>

              {/* Forward buttons */}
              <div>
                {wizardStep === 1 && (
                  <button
                    type="button"
                    disabled={!uploadFile || validating}
                    onClick={handleValidateFile}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1.5 shadow shadow-blue-500/20"
                  >
                    {validating && <Loader2 size={12} className="animate-spin" />}
                    <span>Validate spreadsheet</span>
                    <ArrowRight size={14} />
                  </button>
                )}

                {wizardStep === 2 && (
                  <button
                    type="button"
                    onClick={() => setWizardStep(3)}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition flex items-center gap-1.5 shadow shadow-blue-500/20"
                  >
                    <span>Proceed to Import Mode</span>
                    <ArrowRight size={14} />
                  </button>
                )}

                {wizardStep === 3 && (
                  <button
                    type="button"
                    onClick={() => setWizardStep(4)}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition flex items-center gap-1.5 shadow shadow-blue-500/20"
                  >
                    <span>Proceed to Verification</span>
                    <ArrowRight size={14} />
                  </button>
                )}

                {wizardStep === 4 && (
                  <button
                    type="button"
                    onClick={handleCommitImport}
                    className="px-5 py-2.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer transition flex items-center gap-1.5 shadow shadow-emerald-500/25 animate-pulse"
                  >
                    <span>Commit Import Transaction</span>
                    <ChevronRight size={14} />
                  </button>
                )}

                {wizardStep === 5 && !committing && (
                  <button
                    type="button"
                    onClick={() => setIsWizardOpen(false)}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition flex items-center gap-1.5 shadow shadow-blue-500/20"
                  >
                    <span>Close Console</span>
                    <Check size={14} />
                  </button>
                )}
              </div>

            </div>

          </div>
        </div>
      )}

      {/* REPLACE IMPACT WARNING CONFIRMATION MODAL */}
      {confirmModalOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-neutral-950/90 backdrop-blur-sm p-4 animate-fade-in">
          <div className="relative w-full max-w-2xl dark:bg-neutral-900 bg-surface border dark:border-neutral-800 border-border-subtle rounded-xl shadow-2xl p-6 space-y-5 text-text-primary">
            
            <div className="flex items-start gap-3">
              <div className="p-2 bg-rose-500/10 text-rose-500 rounded-lg shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div className="space-y-1">
                <h4 className="font-display font-bold text-base text-rose-550 dark:text-rose-455">
                  Irreversible Replace Mode Warning
                </h4>
                <p className="text-xs dark:text-neutral-450 text-text-secondary">
                  Wiping temporary seed dataset is required before committing the official cohort list. Every student profile record and related downstream transaction log will be deleted.
                </p>
              </div>
            </div>

            {loadingImpact ? (
              <div className="py-6 text-center">
                <Loader2 className="animate-spin text-rose-500 mx-auto mb-2" size={20} />
                <span className="font-mono text-xs text-text-muted">Analyzing replace mode impact metrics...</span>
              </div>
            ) : replaceImpactData ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Deleting stats */}
                <div className="p-4 bg-rose-500/5 border border-rose-500/15 rounded-lg space-y-3">
                  <span className="text-[10px] uppercase font-bold text-rose-500 font-mono tracking-wider block">Will be deleted</span>
                  <div className="space-y-1.5 font-mono text-[11px] max-h-40 overflow-y-auto pr-1">
                    {Object.entries(replaceImpactData.counts).map(([label, count]) => (
                      <div key={label} className="flex justify-between border-b dark:border-neutral-850/50 border-border-subtle pb-1">
                        <span className="text-text-secondary truncate max-w-[180px]">{label}</span>
                        <span className="font-bold text-rose-500">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Retaining stats */}
                <div className="p-4 bg-emerald-500/5 border border-emerald-500/15 rounded-lg space-y-3">
                  <span className="text-[10px] uppercase font-bold text-emerald-500 font-mono tracking-wider block">Will NOT be deleted (Protected)</span>
                  <div className="space-y-1.5 font-mono text-[11px] max-h-40 overflow-y-auto pr-1">
                    {replaceImpactData.protectedTables.map((tbl) => (
                      <div key={tbl} className="flex justify-between border-b dark:border-neutral-850/50 border-border-subtle pb-1">
                        <span className="text-text-secondary truncate max-w-[200px]">{tbl}</span>
                        <span className="font-bold text-emerald-500">Protected</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            ) : null}

            <div className="p-4 bg-neutral-50 dark:bg-neutral-950 border dark:border-neutral-850 border-border-subtle rounded-lg space-y-2">
              <span className="text-[10px] font-bold uppercase font-mono text-text-muted tracking-wider block">
                Type &quot;REPLACE&quot; to authorize transactional write
              </span>
              <input
                type="text"
                placeholder="REPLACE"
                value={typedConfirmation}
                onChange={(e) => setTypedConfirmation(e.target.value)}
                className="w-full px-3 py-2 bg-background border dark:border-neutral-800 border-border-subtle font-mono text-xs text-center font-bold tracking-widest uppercase focus:outline-none focus:ring-1 focus:ring-rose-500 rounded"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setImportMode("merge");
                  setConfirmModalOpen(false);
                }}
                className="px-4 py-2 text-xs font-semibold rounded-lg dark:bg-neutral-800 bg-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-750 text-text-primary dark:text-neutral-300 border dark:border-neutral-800 border-border-subtle cursor-pointer transition"
              >
                Cancel
              </button>
              
              <button
                type="button"
                disabled={typedConfirmation !== "REPLACE"}
                onClick={() => {
                  setConfirmModalOpen(false);
                  regeneratePreview("replace");
                }}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-500 text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition shadow shadow-rose-500/25"
              >
                Confirm Destructive Replace
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
