"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import {
  CreditCard,
  Search,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Filter,
  Plus,
  Edit,
  Trash2,
  Eye,
  Loader2,
  X,
  ArrowRight,
  TrendingUp,
  Info,
  Sparkles
} from "lucide-react";

interface Program {
  id: string;
  name: string;
  code: string;
}

interface StudentSummary {
  id: string;
  rollNumber: string;
  fullName: string;
  email: string;
  programName: string;
  semester: number;
}

interface FeeSummary {
  id: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  programName: string;
  academicYear: string;
  semester: number;
  feeType: "Tuition Fee" | "Examination Fee" | "Laboratory Fee" | "Miscellaneous Fee";
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  dueDate: string;
  paymentStatus: "Pending" | "Partially Paid" | "Paid" | "Overdue";
}

interface FeePaymentEntry {
  id: string;
  feeId: string;
  amount: number;
  paymentDate: string;
  paymentMode: "Cash" | "DD" | "Cheque" | "Online";
  transactionRef: string | null;
  recordedByName: string;
  remarks: string | null;
  createdAt: string;
}

interface FeeDetail extends FeeSummary {
  remarks: string | null;
  payments: FeePaymentEntry[];
  createdAt: string;
  updatedAt: string;
}

export default function AdminFees() {
  const { accessToken } = useAuth();

  // main ledger data
  const [fees, setFees] = useState<FeeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState("");

  // Pagination states
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Filters state
  const [academicYearFilter, setAcademicYearFilter] = useState("ALL");
  const [semesterFilter, setSemesterFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [feeTypeFilter, setFeeTypeFilter] = useState("ALL");

  // Student Search filter (autocomplete)
  const [studentSearchInput, setStudentSearchInput] = useState("");
  const [studentSearchResults, setStudentSearchResults] = useState<StudentSummary[]>([]);
  const [loadingStudentSearch, setLoadingStudentSearch] = useState(false);
  const [selectedStudentFilter, setSelectedStudentFilter] = useState<StudentSummary | null>(null);
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const studentSearchRef = useRef<HTMLDivElement>(null);

  // Form states & parameters
  const [programs, setPrograms] = useState<Program[]>([]);

  // Drawer / Modals visibility
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createTab, setCreateTab] = useState<"single" | "bulk">("single");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Active records for forms
  const [selectedFee, setSelectedFee] = useState<FeeSummary | null>(null);
  const [activeDetails, setActiveDetails] = useState<FeeDetail | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Drawer / Modal Form Fields
  // 1. Create Form
  const [cStudentSearch, setCStudentSearch] = useState("");
  const [cStudentResults, setCStudentResults] = useState<StudentSummary[]>([]);
  const [cSelectedStudent, setCSelectedStudent] = useState<StudentSummary | null>(null);
  const [cLoadingStudent, setCLoadingStudent] = useState(false);
  const [cShowDropdown, setCShowDropdown] = useState(false);
  const cStudentSearchRef = useRef<HTMLDivElement>(null);

  const [cAcademicYear, setCAcademicYear] = useState("2026-2027");
  const [cSemester, setCSemester] = useState(1);
  const [cFeeType, setCFeeType] = useState<string>("Tuition Fee");
  const [cTotalAmount, setCTotalAmount] = useState("");
  const [cDueDate, setCDueDate] = useState("");
  const [cRemarks, setCRemarks] = useState("");
  const [cProgramId, setCProgramId] = useState(""); // for bulk

  const [submittingCreate, setSubmittingCreate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // 2. Edit Form
  const [eTotalAmount, setETotalAmount] = useState("");
  const [eDueDate, setEDueDate] = useState("");
  const [eRemarks, setERemarks] = useState("");
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // 3. Payment Form
  const [pAmount, setPAmount] = useState("");
  const [pPaymentDate, setPPaymentDate] = useState(() => new Date().toLocaleDateString("en-CA")); // YYYY-MM-DD
  const [pPaymentMode, setPPaymentMode] = useState<"Cash" | "DD" | "Cheque" | "Online">("Cash");
  const [pTransactionRef, setPTransactionRef] = useState("");
  const [pRemarks, setPRemarks] = useState("");
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // 4. Delete Form
  const [submittingDelete, setSubmittingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Trigger brief alert feedback
  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (studentSearchRef.current && !studentSearchRef.current.contains(event.target as Node)) {
        setShowStudentDropdown(false);
      }
      if (cStudentSearchRef.current && !cStudentSearchRef.current.contains(event.target as Node)) {
        setCShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Live Student search for filtering
  useEffect(() => {
    if (!studentSearchInput.trim()) {
      const timer = setTimeout(() => {
        setStudentSearchResults([]);
      }, 0);
      return () => clearTimeout(timer);
    }
    const delayDebounceFn = setTimeout(async () => {
      setLoadingStudentSearch(true);
      try {
        const res = await apiFetch(`/students?search=${encodeURIComponent(studentSearchInput)}&limit=5`, {}, accessToken);
        if (res.success && res.data?.students) {
          setStudentSearchResults(res.data.students);
        }
      } catch (err) {
        console.error("Error searching students:", err);
      } finally {
        setLoadingStudentSearch(false);
      }
    }, 350);

    return () => clearTimeout(delayDebounceFn);
  }, [studentSearchInput, accessToken]);

  // Live Student search for creation drawer
  useEffect(() => {
    if (!cStudentSearch.trim()) {
      const timer = setTimeout(() => {
        setCStudentResults([]);
      }, 0);
      return () => clearTimeout(timer);
    }
    const delayDebounceFn = setTimeout(async () => {
      setCLoadingStudent(true);
      try {
        const res = await apiFetch(`/students?search=${encodeURIComponent(cStudentSearch)}&limit=5`, {}, accessToken);
        if (res.success && res.data?.students) {
          setCStudentResults(res.data.students);
        }
      } catch (err) {
        console.error("Error searching students for creation:", err);
      } finally {
        setCLoadingStudent(false);
      }
    }, 350);

    return () => clearTimeout(delayDebounceFn);
  }, [cStudentSearch, accessToken]);

  // Load programs options for bulk assignments
  useEffect(() => {
    const loadPrograms = async () => {
      try {
        const res = await apiFetch("/departments/programs/list", {}, accessToken);
        if (res.success && res.data?.programs) {
          setPrograms(res.data.programs);
          if (res.data.programs.length > 0) {
            setCProgramId(res.data.programs[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load programs for bulk assignments:", err);
      }
    };
    if (accessToken) {
      loadPrograms();
    }
  }, [accessToken]);

  // Load main fee record list
  const fetchFees = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (selectedStudentFilter) {
        queryParams.append("studentId", selectedStudentFilter.id);
      }
      if (academicYearFilter !== "ALL") {
        queryParams.append("academicYear", academicYearFilter);
      }
      if (semesterFilter !== "ALL") {
        queryParams.append("semester", semesterFilter);
      }
      if (statusFilter !== "ALL") {
        queryParams.append("paymentStatus", statusFilter);
      }
      if (feeTypeFilter !== "ALL") {
        queryParams.append("feeType", feeTypeFilter);
      }

      const res = await apiFetch(`/fees?${queryParams.toString()}`, {}, accessToken);
      if (res.success && res.data) {
        setFees(res.data.fees || []);
        if (res.data.pagination) {
          setTotalPages(res.data.pagination.totalPages || 1);
          setTotalRecords(res.data.pagination.total || 0);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load academic fees register.");
    } finally {
      setLoading(false);
    }
  }, [page, limit, selectedStudentFilter, academicYearFilter, semesterFilter, statusFilter, feeTypeFilter, accessToken]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchFees();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchFees]);

  // Load specific details and transaction history
  const fetchDetails = useCallback(async (feeId: string) => {
    setLoadingDetails(true);
    try {
      const res = await apiFetch(`/fees/${feeId}`, {}, accessToken);
      if (res.success && res.data?.fee) {
        setActiveDetails(res.data.fee);
      }
    } catch (err: any) {
      triggerToast(err.message || "Failed to retrieve transaction breakdown logs.");
    } finally {
      setLoadingDetails(false);
    }
  }, [accessToken]);

  // Form Handlers
  // 1. Create Fee Submission
  const handleCreateFee = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setSubmittingCreate(true);

    try {
      if (createTab === "single") {
        if (!cSelectedStudent) {
          throw new Error("Please select an enrolled student profile.");
        }
        if (!cAcademicYear.match(/^\d{4}-\d{4}$/)) {
          throw new Error("Academic Year must be in YYYY-YYYY format (e.g. 2026-2027).");
        }
        if (!cTotalAmount || isNaN(Number(cTotalAmount)) || Number(cTotalAmount) <= 0) {
          throw new Error("Please provide a valid total billing amount.");
        }
        if (!cDueDate) {
          throw new Error("Please choose a valid payment due date.");
        }

        const payload = {
          studentId: cSelectedStudent.id,
          academicYear: cAcademicYear,
          semester: Number(cSemester),
          feeType: cFeeType,
          totalAmount: Number(cTotalAmount),
          dueDate: cDueDate,
          remarks: cRemarks || undefined,
        };

        const res = await apiFetch("/fees", { method: "POST", body: JSON.stringify(payload) }, accessToken);
        if (res.success) {
          triggerToast("Tuition ledger record created successfully.");
          setIsCreateOpen(false);
          // Reset create fields
          setCSelectedStudent(null);
          setCStudentSearch("");
          setCTotalAmount("");
          setCDueDate("");
          setCRemarks("");
          fetchFees();
        }
      } else {
        // Bulk Cohort Assignment
        if (!cProgramId) {
          throw new Error("Please select a valid academic program.");
        }
        if (!cAcademicYear.match(/^\d{4}-\d{4}$/)) {
          throw new Error("Academic Year must be in YYYY-YYYY format (e.g. 2026-2027).");
        }
        if (!cTotalAmount || isNaN(Number(cTotalAmount)) || Number(cTotalAmount) <= 0) {
          throw new Error("Please provide a valid total billing amount.");
        }
        if (!cDueDate) {
          throw new Error("Please choose a valid payment due date.");
        }

        const payload = {
          programId: cProgramId,
          academicYear: cAcademicYear,
          semester: Number(cSemester),
          feeType: cFeeType,
          totalAmount: Number(cTotalAmount),
          dueDate: cDueDate,
          remarks: cRemarks || undefined,
        };

        const res = await apiFetch("/fees/bulk", { method: "POST", body: JSON.stringify(payload) }, accessToken);
        if (res.success) {
          triggerToast(`${res.message || "Bulk cohort billing applied successfully."}`);
          setIsCreateOpen(false);
          setCTotalAmount("");
          setCDueDate("");
          setCRemarks("");
          fetchFees();
        }
      }
    } catch (err: any) {
      setCreateError(err.message || "Ledger transaction creation failed.");
    } finally {
      setSubmittingCreate(false);
    }
  };

  // 2. Edit Fee Submission
  const handleEditFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFee) return;
    setEditError(null);
    setSubmittingEdit(true);

    try {
      if (!eTotalAmount || isNaN(Number(eTotalAmount)) || Number(eTotalAmount) <= 0) {
        throw new Error("Please specify a valid total billing amount.");
      }
      if (Number(eTotalAmount) < selectedFee.paidAmount) {
        throw new Error(`Total amount cannot be reduced below already paid receipts (₹${selectedFee.paidAmount}).`);
      }
      if (!eDueDate) {
        throw new Error("Please select a valid payment due date.");
      }

      const payload = {
        totalAmount: Number(eTotalAmount),
        dueDate: eDueDate,
        remarks: eRemarks || null,
      };

      const res = await apiFetch(`/fees/${selectedFee.id}`, { method: "PATCH", body: JSON.stringify(payload) }, accessToken);
      if (res.success) {
        triggerToast("Ledger details revised successfully.");
        setIsEditOpen(false);
        fetchFees();
      }
    } catch (err: any) {
      setEditError(err.message || "Failed to update ledger records.");
    } finally {
      setSubmittingEdit(false);
    }
  };

  // 3. Record Payment Submission
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFee) return;
    setPaymentError(null);
    setSubmittingPayment(true);

    try {
      if (!pAmount || isNaN(Number(pAmount)) || Number(pAmount) <= 0) {
        throw new Error("Please input a valid credit receipt amount.");
      }
      if (Number(pAmount) > selectedFee.pendingAmount) {
        throw new Error(`Credit amount (₹${pAmount}) exceeds the pending balance (₹${selectedFee.pendingAmount}).`);
      }
      if (!pPaymentDate) {
        throw new Error("Please provide a valid clearance date.");
      }

      const payload = {
        amount: Number(pAmount),
        paymentDate: pPaymentDate,
        paymentMode: pPaymentMode,
        transactionRef: pTransactionRef || undefined,
        remarks: pRemarks || undefined,
      };

      const res = await apiFetch(`/fees/${selectedFee.id}/payments`, { method: "POST", body: JSON.stringify(payload) }, accessToken);
      if (res.success) {
        triggerToast("Cashier credit receipt processed successfully.");
        setIsPaymentOpen(false);
        // Reset fields
        setPAmount("");
        setPTransactionRef("");
        setPRemarks("");
        fetchFees();
      }
    } catch (err: any) {
      setPaymentError(err.message || "Clearance registration failed.");
    } finally {
      setSubmittingPayment(false);
    }
  };

  // 4. Soft Delete Submission
  const handleDeleteFee = async () => {
    if (!selectedFee) return;
    setDeleteError(null);
    setSubmittingDelete(true);

    try {
      const res = await apiFetch(`/fees/${selectedFee.id}`, { method: "DELETE" }, accessToken);
      if (res.success) {
        triggerToast("Ledger record deleted successfully.");
        setIsDeleteOpen(false);
        fetchFees();
      }
    } catch (err: any) {
      setDeleteError(err.message || "Deactivation operation failed.");
    } finally {
      setSubmittingDelete(false);
    }
  };

  // Modal open setup helpers
  const openEditDrawer = (fee: FeeSummary) => {
    setSelectedFee(fee);
    setETotalAmount(fee.totalAmount.toString());
    setEDueDate(fee.dueDate);
    setERemarks("");
    setEditError(null);
    setIsEditOpen(true);
    // Fetch detailed object to pre-populate remarks if any
    setLoadingDetails(true);
    apiFetch(`/fees/${fee.id}`, {}, accessToken)
      .then((res) => {
        if (res.success && res.data?.fee) {
          setERemarks(res.data.fee.remarks || "");
        }
      })
      .finally(() => setLoadingDetails(false));
  };

  const openPaymentModal = (fee: FeeSummary) => {
    setSelectedFee(fee);
    setPAmount(fee.pendingAmount.toString());
    setPPaymentDate(new Date().toLocaleDateString("en-CA"));
    setPPaymentMode("Cash");
    setPTransactionRef("");
    setPRemarks("");
    setPaymentError(null);
    setIsPaymentOpen(true);
  };

  const openDetailsDrawer = (fee: FeeSummary) => {
    setSelectedFee(fee);
    setActiveDetails(null);
    setIsDetailsOpen(true);
    fetchDetails(fee.id);
  };

  const openDeleteModal = (fee: FeeSummary) => {
    setSelectedFee(fee);
    setDeleteError(null);
    setIsDeleteOpen(true);
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case "Paid":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "Partially Paid":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "Overdue":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse";
      default:
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    }
  };

  // Compute page-level filtered totals
  const totalBilledFiltered = fees.reduce((acc, f) => acc + f.totalAmount, 0);
  const totalPaidFiltered = fees.reduce((acc, f) => acc + f.paidAmount, 0);
  const totalPendingFiltered = fees.reduce((acc, f) => acc + f.pendingAmount, 0);

  return (
    <div className="space-y-6">
      {/* Toast Alert Banner */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 dark:bg-neutral-900 bg-surface border border-blue-500/30 dark:text-blue-400 text-blue-750 text-xs font-semibold px-4 py-3 rounded-lg shadow-2xl animate-slide-in">
          <Sparkles size={14} className="animate-pulse" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-2xl dark:text-white text-text-primary">Semester Fees Ledger</h2>
          <p className="text-xs text-neutral-400 mt-1">
            Monitor billing invoices, record cashier fee collections, and reconcile outstanding student dues.
          </p>
        </div>
        <button
          onClick={() => {
            setCAcademicYear("2026-2027");
            setCSemester(1);
            setCFeeType("Tuition Fee");
            setCTotalAmount("");
            setCDueDate("");
            setCRemarks("");
            setCSelectedStudent(null);
            setCStudentSearch("");
            setCreateError(null);
            setIsCreateOpen(true);
          }}
          className="px-3.5 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer transition flex items-center gap-1.5 text-xs shadow-lg shadow-blue-600/15 justify-center"
        >
          <Plus size={14} />
          <span>Create Fee Ledger</span>
        </button>
      </div>

      {/* Aggregate Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Billed */}
        <div className="glass-card rounded-xl p-4 dark:border-neutral-800 border-border-subtle bg-surface flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold dark:text-neutral-500 text-text-muted">Collected Dues</span>
            <h3 className="text-xl font-bold font-sans text-emerald-500 dark:text-emerald-400 mt-1">
              ₹{totalPaidFiltered.toLocaleString("en-IN")}
            </h3>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
            <CheckCircle2 size={16} />
          </div>
        </div>

        {/* Outstanding Dues */}
        <div className="glass-card rounded-xl p-4 dark:border-neutral-800 border-border-subtle bg-surface flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold dark:text-neutral-500 text-text-muted">Outstanding Balances</span>
            <h3 className="text-xl font-bold font-sans text-rose-600 dark:text-rose-500 mt-1">
              ₹{totalPendingFiltered.toLocaleString("en-IN")}
            </h3>
          </div>
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center">
            <AlertTriangle size={16} />
          </div>
        </div>

        {/* Realization Rate */}
        <div className="glass-card rounded-xl p-4 dark:border-neutral-800 border-border-subtle bg-surface flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold dark:text-neutral-500 text-text-muted">Bursar Realization Rate</span>
            <h3 className="text-xl font-bold font-sans dark:text-white text-text-primary mt-1">
              {totalBilledFiltered > 0 ? ((totalPaidFiltered / totalBilledFiltered) * 100).toFixed(0) : "100"}%
            </h3>
          </div>
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
            <TrendingUp size={16} />
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl p-4 flex flex-col gap-3">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="relative md:col-span-2" ref={studentSearchRef}>
            <label className="block text-[9px] uppercase font-bold dark:text-neutral-500 text-text-secondary mb-1">Search Student</label>
            {selectedStudentFilter ? (
              <div className="flex items-center justify-between dark:bg-neutral-950 bg-background border border-blue-500/30 rounded px-2.5 py-1.5 text-xs dark:text-white text-text-primary">
                <span className="truncate">
                  {selectedStudentFilter.fullName} ({selectedStudentFilter.rollNumber})
                </span>
                <button
                  onClick={() => {
                    setSelectedStudentFilter(null);
                    setStudentSearchInput("");
                    setPage(1);
                  }}
                  className="dark:text-neutral-500 text-text-secondary dark:hover:text-white hover:text-text-primary shrink-0 ml-1.5"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-2 w-3.5 h-3.5 dark:text-neutral-500 text-text-muted" />
                  <input
                    type="text"
                    placeholder="Search name, roll no..."
                    value={studentSearchInput}
                    onFocus={() => setShowStudentDropdown(true)}
                    onChange={(e) => {
                      setStudentSearchInput(e.target.value);
                      setShowStudentDropdown(true);
                    }}
                    className="w-full pl-8 pr-4 py-1.5 text-xs dark:bg-neutral-955 bg-background border dark:border-neutral-850 border-border-subtle rounded dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition"
                  />
                  {loadingStudentSearch && (
                    <Loader2 className="absolute right-2.5 top-2.5 w-3 h-3 animate-spin dark:text-neutral-500 text-text-muted" />
                  )}
                </div>
                {showStudentDropdown && studentSearchResults.length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 z-30 max-h-48 overflow-y-auto dark:bg-neutral-900 bg-surface border dark:border-neutral-850 border-border-subtle rounded shadow-2xl divide-y dark:divide-neutral-850 divide-border-subtle">
                    {studentSearchResults.map((student) => (
                      <button
                        key={student.id}
                        onClick={() => {
                          setSelectedStudentFilter(student);
                          setShowStudentDropdown(false);
                          setPage(1);
                        }}
                        className="w-full text-left px-3 py-2 dark:hover:bg-neutral-800 hover:bg-neutral-100 text-xs dark:text-neutral-300 text-text-secondary transition flex items-center justify-between border-none"
                      >
                        <span className="font-semibold dark:text-white text-text-primary truncate">{student.fullName}</span>
                        <span className="font-mono text-[10px] dark:text-neutral-500 text-text-muted shrink-0 ml-1">
                          {student.rollNumber}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <div>
            <label className="block text-[9px] uppercase font-bold dark:text-neutral-500 text-text-secondary mb-1">Academic Year</label>
            <select
              value={academicYearFilter}
              onChange={(e) => {
                setAcademicYearFilter(e.target.value);
                setPage(1);
              }}
              className="w-full dark:bg-neutral-955 bg-background border dark:border-neutral-850 border-border-subtle rounded px-2 py-1.5 text-xs dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition"
            >
              <option value="ALL">All AY</option>
              <option value="2023-2024">2023-2024</option>
              <option value="2024-2025">2024-2025</option>
              <option value="2025-2026">2025-2026</option>
              <option value="2026-2027">2026-2027</option>
            </select>
          </div>
          <div>
            <label className="block text-[9px] uppercase font-bold dark:text-neutral-500 text-text-secondary mb-1">Semester</label>
            <select
              value={semesterFilter}
              onChange={(e) => {
                setSemesterFilter(e.target.value);
                setPage(1);
              }}
              className="w-full dark:bg-neutral-955 bg-background border dark:border-neutral-850 border-border-subtle rounded px-2 py-1.5 text-xs dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition"
            >
              <option value="ALL">All Semesters</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                <option key={sem} value={sem.toString()}>
                  Sem {sem}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[9px] uppercase font-bold dark:text-neutral-500 text-text-secondary mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full dark:bg-neutral-955 bg-background border dark:border-neutral-850 border-border-subtle rounded px-2 py-1.5 text-xs dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition"
            >
              <option value="ALL">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Partially Paid">Partially Paid</option>
              <option value="Paid">Paid</option>
              <option value="Overdue">Overdue</option>
            </select>
          </div>
        </div>

        {(selectedStudentFilter ||
          academicYearFilter !== "ALL" ||
          semesterFilter !== "ALL" ||
          statusFilter !== "ALL" ||
          feeTypeFilter !== "ALL") && (
          <div className="flex justify-end pt-1">
            <button
              onClick={() => {
                setSelectedStudentFilter(null);
                setStudentSearchInput("");
                setAcademicYearFilter("ALL");
                setSemesterFilter("ALL");
                setStatusFilter("ALL");
                setFeeTypeFilter("ALL");
                setPage(1);
              }}
              className="text-[10px] font-bold text-blue-500 hover:text-blue-400 uppercase tracking-wider flex items-center gap-1 transition"
            >
              <X size={10} />
              <span>Reset Active Filters</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Ledger Table Registry */}
      <div className="glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-xs dark:text-neutral-500 text-text-muted mt-3 font-mono">Loading bursar academic fees registry...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center bg-rose-500/[0.01]">
            <AlertTriangle className="w-8 h-8 mx-auto text-rose-500 mb-2" />
            <p className="text-xs text-rose-450 font-semibold">{error}</p>
            <button
              onClick={fetchFees}
              className="mt-3 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-neutral-800 hover:bg-neutral-750 text-white rounded transition"
            >
              Retry Sync
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto relative">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="dark:bg-neutral-900/50 bg-neutral-100 border-b dark:border-neutral-800 border-border-subtle dark:text-neutral-400 text-text-secondary font-semibold sticky top-0 backdrop-blur-md z-10 select-none">
                  <th className="px-4 py-3 text-[10px] uppercase font-bold dark:text-neutral-550 text-text-secondary">Student Info</th>
                  <th className="px-4 py-3 text-[10px] uppercase font-bold dark:text-neutral-550 text-text-secondary">Semester details</th>
                  <th className="px-4 py-3 text-[10px] uppercase font-bold dark:text-neutral-550 text-text-secondary">Fee Category</th>
                  <th className="px-4 py-3 text-[10px] uppercase font-bold dark:text-neutral-550 text-text-secondary">Total Billed</th>
                  <th className="px-4 py-3 text-[10px] uppercase font-bold dark:text-neutral-550 text-text-secondary">Dues Pending</th>
                  <th className="px-4 py-3 text-[10px] uppercase font-bold dark:text-neutral-550 text-text-secondary">Status</th>
                  <th className="px-4 py-3 text-[10px] uppercase font-bold dark:text-neutral-550 text-text-secondary">Due Date</th>
                  <th className="px-4 py-3 text-right text-[10px] uppercase font-bold dark:text-neutral-550 text-text-secondary">Ledger Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-neutral-900 divide-border-subtle dark:text-neutral-300 text-text-secondary">
                {fees.length > 0 ? (
                  fees.map((fee) => (
                    <tr key={fee.id} className="hover:bg-neutral-900/30 transition duration-150 group">
                      <td className="px-4 py-3.5">
                        <div>
                          <div className="font-semibold text-white leading-tight">{fee.studentName}</div>
                          <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-neutral-500 font-mono">
                            <span>{fee.rollNumber}</span>
                            <span>•</span>
                            <span className="truncate max-w-[120px]">{fee.programName}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-[10px] text-neutral-400">
                        Semester {fee.semester}
                        <div className="text-[9px] text-neutral-600">AY: {fee.academicYear}</div>
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-neutral-200">{fee.feeType}</td>
                      <td className="px-4 py-3.5 font-sans font-bold text-white">
                        ₹{fee.totalAmount.toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3.5 font-sans font-bold">
                        {fee.pendingAmount > 0 ? (
                          <span className="text-white">₹{fee.pendingAmount.toLocaleString("en-IN")}</span>
                        ) : (
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            Cleared
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[8px] font-bold border uppercase tracking-wider ${getStatusClass(
                            fee.paymentStatus
                          )}`}
                        >
                          {fee.paymentStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 mt-0.5 text-neutral-400 font-mono text-[10px]">
                          <Calendar size={11} className="text-neutral-500" />
                          <span>{fee.dueDate}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openDetailsDrawer(fee)}
                            title="View Payments Ledger"
                            className="p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition cursor-pointer"
                          >
                            <Eye size={12} />
                          </button>

                          {fee.paymentStatus !== "Paid" && (
                            <button
                              onClick={() => openPaymentModal(fee)}
                              title="Process Receipt"
                              className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold cursor-pointer transition flex items-center gap-0.5 text-[10px]"
                            >
                              <DollarSign size={10} />
                              <span>Pay</span>
                            </button>
                          )}

                          <button
                            onClick={() => openEditDrawer(fee)}
                            title="Edit Details"
                            className="p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition cursor-pointer"
                          >
                            <Edit size={12} />
                          </button>

                          <button
                            onClick={() => openDeleteModal(fee)}
                            disabled={fee.paidAmount > 0}
                            title={fee.paidAmount > 0 ? "Cannot delete fee with payments" : "Remove Ledger"}
                            className={`p-1.5 rounded transition ${
                              fee.paidAmount > 0
                                ? "text-neutral-700 cursor-not-allowed"
                                : "hover:bg-neutral-800 text-neutral-500 hover:text-rose-400 cursor-pointer"
                            }`}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-neutral-500 font-mono">
                      No matching fee invoices logged in system.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="px-4 py-3 bg-neutral-950/80 border-t border-neutral-900 flex items-center justify-between select-none">
            <span className="text-[10px] text-neutral-500 font-mono">
              Showing Page {page} of {totalPages} ({totalRecords} records)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                className="p-1.5 rounded bg-neutral-900 border border-neutral-850 hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition text-neutral-300"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                className="p-1.5 rounded bg-neutral-900 border border-neutral-850 hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition text-neutral-300"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal 1: Create Fee (Slide-over Drawer from Right) */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm animate-fade-in flex justify-end">
          <div
            className="w-full max-w-md dark:bg-neutral-900 bg-surface border-l dark:border-neutral-800 border-border-subtle h-full flex flex-col justify-between shadow-2xl relative animate-slide-left overflow-y-auto"
            style={{ animationDuration: "250ms" }}
          >
            {/* Header */}
            <div className="p-5 border-b dark:border-neutral-850 border-border-subtle flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-lg dark:text-white text-text-primary">Create Academic Fee</h3>
                <p className="text-[10px] dark:text-neutral-500 text-text-secondary">Record single or cohort billing invoice templates.</p>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1 rounded dark:bg-neutral-850 bg-neutral-100 dark:hover:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-400 text-text-secondary dark:hover:text-white hover:text-text-primary transition cursor-pointer border dark:border-neutral-850 border-border-subtle"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content Form */}
            <form onSubmit={handleCreateFee} className="p-5 flex-1 space-y-4">
              {/* Tab Selector */}
              <div className="flex border dark:border-neutral-800 border-border-subtle rounded dark:bg-neutral-950/60 bg-background p-0.5 select-none animate-fade-in">
                <button
                  type="button"
                  onClick={() => {
                    setCreateTab("single");
                    setCreateError(null);
                  }}
                  className={`flex-1 py-1.5 text-center text-xs font-semibold rounded cursor-pointer transition ${
                    createTab === "single" ? "dark:bg-neutral-800 bg-surface dark:text-white text-text-primary font-bold shadow-sm border border-border-subtle" : "dark:text-neutral-500 text-text-secondary dark:hover:text-white hover:text-text-primary"
                  }`}
                >
                  Single Student
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreateTab("bulk");
                    setCreateError(null);
                  }}
                  className={`flex-1 py-1.5 text-center text-xs font-semibold rounded cursor-pointer transition ${
                    createTab === "bulk" ? "dark:bg-neutral-800 bg-surface dark:text-white text-text-primary font-bold shadow-sm border border-border-subtle" : "dark:text-neutral-500 text-text-secondary dark:hover:text-white hover:text-text-primary"
                  }`}
                >
                  Cohort Bulk Assign
                </button>
              </div>

              {createError && (
                <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold">
                  {createError}
                </div>
              )}

              {createTab === "single" ? (
                /* SINGLE STUDENT FORM FIELDS */
                <div className="space-y-4">
                  {/* Student Selection Autocomplete */}
                  <div className="relative" ref={cStudentSearchRef}>
                    <label className="block text-[10px] uppercase font-bold dark:text-neutral-400 text-text-secondary mb-1.5">
                      Select Student
                    </label>
                    {cSelectedStudent ? (
                      <div className="flex items-center justify-between dark:bg-neutral-950 bg-background border dark:border-blue-500/20 border-blue-500/40 rounded p-2.5 text-xs dark:text-white text-text-primary">
                        <div>
                          <div className="font-semibold dark:text-white text-text-primary">{cSelectedStudent.fullName}</div>
                          <div className="text-[10px] dark:text-neutral-500 text-text-muted font-mono mt-0.5">
                            {cSelectedStudent.rollNumber} • {cSelectedStudent.programName}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setCSelectedStudent(null);
                            setCStudentSearch("");
                          }}
                          className="p-1 rounded dark:bg-neutral-800 bg-neutral-100 dark:text-neutral-400 text-text-secondary dark:hover:text-white hover:text-text-primary border dark:border-neutral-800 border-border-subtle transition shrink-0 ml-2"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="relative">
                          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 dark:text-neutral-500 text-text-muted" />
                          <input
                            type="text"
                            placeholder="Type student name or roll no..."
                            value={cStudentSearch}
                            onFocus={() => setCShowDropdown(true)}
                            onChange={(e) => {
                              setCStudentSearch(e.target.value);
                              setCShowDropdown(true);
                            }}
                            className="w-full pl-9 pr-4 py-2 text-xs dark:bg-neutral-950 bg-background border dark:border-neutral-850 border-border-subtle rounded dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition"
                          />
                          {cLoadingStudent && (
                            <Loader2 className="absolute right-2.5 top-2.5 w-3.5 h-3.5 animate-spin dark:text-neutral-500 text-text-muted" />
                          )}
                        </div>

                        {cShowDropdown && cStudentResults.length > 0 && (
                          <div className="absolute left-0 right-0 mt-1 z-30 max-h-48 overflow-y-auto dark:bg-neutral-950 bg-surface border dark:border-neutral-850 border-border-subtle rounded shadow-2xl divide-y dark:divide-neutral-900 divide-border-subtle">
                            {cStudentResults.map((student) => (
                              <button
                                type="button"
                                key={student.id}
                                onClick={() => {
                                  setCSelectedStudent(student);
                                  setCShowDropdown(false);
                                }}
                                className="w-full text-left px-3 py-2 dark:hover:bg-neutral-900 hover:bg-neutral-100 text-xs dark:text-neutral-300 text-text-secondary transition flex items-center justify-between border-none"
                              >
                                <span className="font-semibold dark:text-white text-text-primary">{student.fullName}</span>
                                <span className="font-mono text-[10px] dark:text-neutral-500 text-text-muted">
                                  {student.rollNumber}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ) : (
                /* BULK COHORT ASSIGNMENT FIELDS */
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] uppercase font-bold dark:text-neutral-400 text-text-secondary mb-1.5">
                      Academic Program
                    </label>
                    <select
                      value={cProgramId}
                      onChange={(e) => setCProgramId(e.target.value)}
                      className="w-full dark:bg-neutral-950 bg-background border dark:border-neutral-850 border-border-subtle rounded px-3 py-2 text-xs dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition"
                    >
                      {programs.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* SHARED FIELDS */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold dark:text-neutral-400 text-text-secondary mb-1.5">
                    Academic Year
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 2026-2027"
                    value={cAcademicYear}
                    onChange={(e) => setCAcademicYear(e.target.value)}
                    className="w-full px-3 py-2 text-xs dark:bg-neutral-950 bg-background border dark:border-neutral-850 border-border-subtle rounded dark:text-white text-text-primary font-mono focus:outline-none focus:border-blue-600 transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold dark:text-neutral-400 text-text-secondary mb-1.5">Semester</label>
                  <select
                    value={cSemester}
                    onChange={(e) => setCSemester(Number(e.target.value))}
                    className="w-full dark:bg-neutral-950 bg-background border dark:border-neutral-850 border-border-subtle rounded px-3 py-2 text-xs dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                      <option key={sem} value={sem}>
                        Semester {sem}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold dark:text-neutral-400 text-text-secondary mb-1.5">Fee Category</label>
                <select
                  value={cFeeType}
                  onChange={(e) => setCFeeType(e.target.value)}
                  className="w-full dark:bg-neutral-955 bg-background border dark:border-neutral-850 border-border-subtle rounded px-3 py-2 text-xs dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition"
                >
                  <option value="Tuition Fee">Tuition Fee</option>
                  <option value="Examination Fee">Examination Fee</option>
                  <option value="Laboratory Fee">Laboratory Fee</option>
                  <option value="Miscellaneous Fee">Miscellaneous Fee</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold dark:text-neutral-400 text-text-secondary mb-1.5">
                    Total Amount (INR)
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 45000"
                    value={cTotalAmount}
                    onChange={(e) => setCTotalAmount(e.target.value)}
                    className="w-full px-3 py-2 text-xs dark:bg-neutral-955 bg-background border dark:border-neutral-855 border-border-subtle rounded dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold dark:text-neutral-400 text-text-secondary mb-1.5">Due Date</label>
                  <input
                    type="date"
                    required
                    value={cDueDate}
                    onChange={(e) => setCDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs dark:bg-neutral-955 bg-background border dark:border-neutral-855 border-border-subtle rounded dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold dark:text-neutral-400 text-text-secondary mb-1.5">
                  Remarks / Description
                </label>
                <textarea
                  placeholder="Additional context or remarks details..."
                  value={cRemarks}
                  rows={3}
                  onChange={(e) => setCRemarks(e.target.value)}
                  className="w-full px-3 py-2 text-xs dark:bg-neutral-955 bg-background border dark:border-neutral-855 border-border-subtle rounded dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition leading-normal resize-none"
                />
              </div>
            </form>

            {/* Form Actions Footer */}
            <div className="p-5 border-t dark:border-neutral-850 border-border-subtle flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="flex-1 py-2 text-xs font-semibold rounded dark:bg-neutral-800 bg-neutral-100 dark:hover:bg-neutral-750 hover:bg-neutral-200 dark:text-neutral-300 text-text-primary border dark:border-neutral-800 border-border-subtle cursor-pointer transition text-center select-none"
              >
                Cancel
              </button>
              <button
                type="submit"
                onClick={handleCreateFee}
                disabled={submittingCreate}
                className="flex-1 py-2 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-700 text-white cursor-pointer transition text-center flex items-center justify-center gap-1.5 select-none"
              >
                {submittingCreate && <Loader2 size={12} className="animate-spin" />}
                <span>Assign Dues</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Edit Fee Detail (Modal Dialog) */}
      {isEditOpen && selectedFee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-sm dark:bg-neutral-900 bg-surface border dark:border-neutral-800 border-border-subtle rounded-xl p-5 shadow-2xl relative animate-scale-up">
            <h3 className="font-display font-bold dark:text-white text-text-primary text-base">Edit Fee Ledger Record</h3>
            <p className="text-[10px] dark:text-neutral-500 text-text-secondary mt-0.5 mb-4">
              Update billing details for #{selectedFee.id.substring(0, 8)}.
            </p>

            {editError && (
              <div className="p-2.5 mb-4 rounded bg-rose-500/10 border border-rose-500/20 text-rose-605 dark:text-rose-400 text-xs font-semibold">
                {editError}
              </div>
            )}

            <form onSubmit={handleEditFee} className="space-y-4">
              {loadingDetails ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin dark:text-neutral-500 text-text-muted" />
                </div>
              ) : (
                <>
                  <div className="p-2.5 rounded dark:bg-neutral-950/60 bg-background border dark:border-neutral-850 border-border-subtle text-[11px] dark:text-neutral-400 text-text-secondary leading-normal space-y-0.5">
                    <div>
                      <span className="font-semibold dark:text-white text-text-primary">Student:</span> {selectedFee.studentName}
                    </div>
                    <div>
                      <span className="font-semibold dark:text-white text-text-primary">Roll Number:</span> {selectedFee.rollNumber}
                    </div>
                    <div>
                      <span className="font-semibold dark:text-white text-text-primary">Fee Category:</span> {selectedFee.feeType}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold dark:text-neutral-450 text-text-secondary mb-1">
                      Total Billed (INR)
                    </label>
                    <input
                      type="number"
                      required
                      min={selectedFee.paidAmount}
                      value={eTotalAmount}
                      onChange={(e) => setETotalAmount(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs dark:bg-neutral-955 bg-background border dark:border-neutral-850 border-border-subtle rounded dark:text-white text-text-primary focus:outline-none focus:border-blue-600 font-mono transition"
                    />
                    <span className="text-[9px] dark:text-neutral-500 text-text-muted mt-1 block">
                      Paid receipts are ₹{selectedFee.paidAmount.toLocaleString("en-IN")}. Cannot reduce below this.
                    </span>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold dark:text-neutral-455 text-text-secondary mb-1">Due Date</label>
                    <input
                      type="date"
                      required
                      value={eDueDate}
                      onChange={(e) => setEDueDate(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs dark:bg-neutral-955 bg-background border dark:border-neutral-850 border-border-subtle rounded dark:text-white text-text-primary focus:outline-none focus:border-blue-600 font-mono transition"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold dark:text-neutral-455 text-text-secondary mb-1">Remarks</label>
                    <textarea
                      rows={2}
                      value={eRemarks}
                      onChange={(e) => setERemarks(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs dark:bg-neutral-955 bg-background border dark:border-neutral-850 border-border-subtle rounded dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition resize-none leading-normal"
                    />
                  </div>
                </>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="flex-1 py-2 text-xs font-semibold rounded dark:bg-neutral-800 bg-neutral-100 dark:hover:bg-neutral-750 hover:bg-neutral-200 dark:text-neutral-300 text-text-primary border dark:border-neutral-800 border-border-subtle cursor-pointer transition select-none"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit || loadingDetails}
                  className="flex-1 py-2 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-700 text-white cursor-pointer transition flex items-center justify-center gap-1.5 select-none"
                >
                  {submittingEdit && <Loader2 size={12} className="animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Process Clearance Receipt (Modal Dialog) */}
      {isPaymentOpen && selectedFee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-sm dark:bg-neutral-900 bg-surface border dark:border-neutral-800 border-border-subtle rounded-xl p-5 shadow-2xl relative animate-scale-up">
            <h3 className="font-display font-bold dark:text-white text-text-primary text-base">Record Cashier Payment</h3>
            <p className="text-[10px] dark:text-neutral-500 text-text-secondary mt-0.5 mb-4">
              Clear outstanding dues balance for #{selectedFee.id.substring(0, 8)}.
            </p>

            {paymentError && (
              <div className="p-2.5 mb-4 rounded bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold">
                {paymentError}
              </div>
            )}

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div className="p-2.5 rounded dark:bg-neutral-950/60 bg-background border dark:border-neutral-850 border-border-subtle text-[11px] dark:text-neutral-400 text-text-secondary space-y-0.5">
                <div>
                  <span className="font-semibold dark:text-white text-text-primary">Student:</span> {selectedFee.studentName}
                </div>
                <div>
                  <span className="font-semibold dark:text-white text-text-primary">Total Pending:</span> ₹
                  {selectedFee.pendingAmount.toLocaleString("en-IN")}
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold dark:text-neutral-450 text-text-secondary mb-1">
                  Credit Amount (INR)
                </label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0.01"
                  max={selectedFee.pendingAmount}
                  value={pAmount}
                  onChange={(e) => setPAmount(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs dark:bg-neutral-955 bg-background border dark:border-neutral-855 border-border-subtle rounded dark:text-white text-text-primary focus:outline-none focus:border-blue-600 font-mono transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold dark:text-neutral-455 text-text-secondary mb-1">Payment Mode</label>
                  <select
                    value={pPaymentMode}
                    onChange={(e) => setPPaymentMode(e.target.value as any)}
                    className="w-full dark:bg-neutral-955 bg-background border dark:border-neutral-855 border-border-subtle rounded px-2.5 py-1.5 text-xs dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition"
                  >
                    <option value="Cash">Cash</option>
                    <option value="DD">Demand Draft</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Online">Online Transfer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold dark:text-neutral-455 text-text-secondary mb-1">Clearance Date</label>
                  <input
                    type="date"
                    required
                    value={pPaymentDate}
                    onChange={(e) => setPPaymentDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs dark:bg-neutral-955 bg-background border dark:border-neutral-855 border-border-subtle rounded dark:text-white text-text-primary focus:outline-none focus:border-blue-600 font-mono transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold dark:text-neutral-455 text-text-secondary mb-1">
                  Transaction Ref / Receipt No.
                </label>
                <input
                  type="text"
                  placeholder="e.g. TXN-928372"
                  value={pTransactionRef}
                  onChange={(e) => setPTransactionRef(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs dark:bg-neutral-955 bg-background border dark:border-neutral-855 border-border-subtle rounded dark:text-white text-text-primary focus:outline-none focus:border-blue-600 font-mono transition"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold dark:text-neutral-455 text-text-secondary mb-1">Remarks</label>
                <textarea
                  rows={2}
                  value={pRemarks}
                  onChange={(e) => setPRemarks(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs dark:bg-neutral-955 bg-background border dark:border-neutral-855 border-border-subtle rounded dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition resize-none leading-normal"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPaymentOpen(false)}
                  className="flex-1 py-2 text-xs font-semibold rounded dark:bg-neutral-800 bg-neutral-100 dark:hover:bg-neutral-750 hover:bg-neutral-200 dark:text-neutral-300 text-text-primary border dark:border-neutral-800 border-border-subtle cursor-pointer transition select-none"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="flex-1 py-2 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-700 text-white cursor-pointer transition flex items-center justify-center gap-1.5 select-none"
                >
                  {submittingPayment && <Loader2 size={12} className="animate-spin" />}
                  <span>Reconcile & Clear</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: View Ledger Breakdown Details (Slide-over Drawer) */}
      {isDetailsOpen && selectedFee && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm animate-fade-in flex justify-end">
          <div
            className="w-full max-w-md dark:bg-neutral-900 bg-surface border-l dark:border-neutral-800 border-border-subtle h-full flex flex-col justify-between shadow-2xl relative animate-slide-left overflow-y-auto"
            style={{ animationDuration: "250ms" }}
          >
            {/* Header */}
            <div className="p-5 border-b dark:border-neutral-850 border-border-subtle flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-lg dark:text-white text-text-primary">Ledger Breakdown Details</h3>
                <p className="text-[10px] dark:text-neutral-500 text-text-secondary">Invoice #{selectedFee.id.substring(0, 8)} ledger cards.</p>
              </div>
              <button
                onClick={() => setIsDetailsOpen(false)}
                className="p-1 rounded dark:bg-neutral-855 bg-neutral-100 dark:hover:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-400 text-text-secondary dark:hover:text-white hover:text-text-primary transition cursor-pointer border dark:border-neutral-850 border-border-subtle"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content list */}
            <div className="p-5 flex-1 space-y-6 overflow-y-auto font-sans text-xs">
              {loadingDetails ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  <p className="text-[10px] dark:text-neutral-500 text-text-muted mt-2 font-mono">Retrieving transactional logs...</p>
                </div>
              ) : activeDetails ? (
                <>
                  {/* General details Card */}
                  <div className="space-y-3">
                    <h4 className="text-[10px] uppercase font-bold dark:text-neutral-400 text-text-secondary tracking-wider">Student Profile</h4>
                    <div className="p-4 rounded-lg dark:bg-neutral-950 bg-background border dark:border-neutral-850 border-border-subtle space-y-2">
                      <div className="flex justify-between">
                        <span className="dark:text-neutral-500 text-text-secondary">Student Name:</span>
                        <span className="dark:text-white text-text-primary font-semibold">{activeDetails.studentName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="dark:text-neutral-500 text-text-secondary">Roll Number:</span>
                        <span className="dark:text-white text-text-primary font-mono">{activeDetails.rollNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="dark:text-neutral-500 text-text-secondary">Academic Program:</span>
                        <span className="dark:text-neutral-400 text-text-secondary truncate max-w-[200px]" title={activeDetails.programName}>
                          {activeDetails.programName}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="dark:text-neutral-500 text-text-secondary">AY / Semester:</span>
                        <span className="dark:text-neutral-400 text-text-secondary font-mono">
                          AY {activeDetails.academicYear} • Sem {activeDetails.semester}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Financial Breakdown */}
                  <div className="space-y-3">
                    <h4 className="text-[10px] uppercase font-bold dark:text-neutral-400 text-text-secondary tracking-wider">
                      Financial Account Summary
                    </h4>
                    <div className="p-4 rounded-lg dark:bg-neutral-955 bg-background border dark:border-neutral-850 border-border-subtle space-y-2.5">
                      <div className="flex justify-between">
                        <span className="dark:text-neutral-500 text-text-secondary">Fee Category:</span>
                        <span className="dark:text-white text-text-primary font-semibold">{activeDetails.feeType}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="dark:text-neutral-500 text-text-secondary">Billed Total:</span>
                        <span className="dark:text-white text-text-primary font-semibold font-mono">
                          ₹{activeDetails.totalAmount.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="dark:text-neutral-500 text-text-secondary">Credit Settled:</span>
                        <span className="text-emerald-500 dark:text-emerald-400 font-semibold font-mono">
                          ₹{activeDetails.paidAmount.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="flex justify-between border-t dark:border-neutral-900 border-border-subtle pt-2">
                        <span className="dark:text-neutral-500 text-text-secondary">Net Outstanding:</span>
                        <span
                          className={`font-semibold font-mono ${
                            activeDetails.pendingAmount > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-500 dark:text-emerald-400"
                          }`}
                        >
                          ₹{activeDetails.pendingAmount.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="dark:text-neutral-500 text-text-secondary">Ledger Status:</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[8px] font-bold border uppercase tracking-wider ${getStatusClass(
                            activeDetails.paymentStatus
                          )}`}
                        >
                          {activeDetails.paymentStatus}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="dark:text-neutral-500 text-text-secondary">Payment Due:</span>
                        <span className="dark:text-neutral-450 text-text-secondary font-mono">{activeDetails.dueDate}</span>
                      </div>
                      {activeDetails.remarks && (
                        <div className="pt-2 border-t dark:border-neutral-900 border-border-subtle">
                          <span className="dark:text-neutral-500 text-text-secondary block mb-1">Remarks:</span>
                          <p className="p-2.5 rounded dark:bg-neutral-900 bg-neutral-100 dark:text-neutral-400 text-text-secondary italic text-[11px] leading-normal">
                            {activeDetails.remarks}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Payment chronological list */}
                  <div className="space-y-3">
                    <h4 className="text-[10px] uppercase font-bold dark:text-neutral-400 text-text-secondary tracking-wider">
                      Clearance Credits Logs
                    </h4>
                    {activeDetails.payments.length === 0 ? (
                      <div className="p-4 dark:bg-neutral-950 bg-background border dark:border-neutral-850 border-border-subtle rounded-lg text-center dark:text-neutral-500 text-text-muted italic font-mono text-[10px]">
                        No payment log transactions found for this invoice.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {activeDetails.payments.map((p) => (
                          <div key={p.id} className="p-3 dark:bg-neutral-955 bg-background border dark:border-neutral-850 border-border-subtle rounded-lg space-y-2">
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-bold border dark:border-neutral-800 border-border-subtle dark:bg-neutral-900 bg-neutral-100 dark:text-neutral-400 text-text-secondary font-mono">
                                  {p.paymentMode}
                                </span>
                                {p.transactionRef && (
                                  <span className="text-[10px] dark:text-neutral-400 text-text-secondary font-mono ml-2">
                                    Ref: {p.transactionRef}
                                  </span>
                                )}
                              </div>
                              <span className="text-xs font-bold text-emerald-550 dark:text-emerald-400 font-mono">
                                + ₹{p.amount.toLocaleString("en-IN")}
                              </span>
                            </div>
                            <div className="text-[10px] dark:text-neutral-500 text-text-muted font-mono flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span>Clearance: {p.paymentDate}</span>
                              <span>•</span>
                              <span>Cashier: {p.recordedByName}</span>
                            </div>
                            {p.remarks && (
                              <p className="text-[10px] dark:text-neutral-400 text-text-secondary italic leading-normal border-t dark:border-neutral-900 border-border-subtle pt-1.5">
                                &quot;{p.remarks}&quot;
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="p-4 text-center text-rose-500 border border-rose-500/10 rounded-lg">
                  Failed to load transaction details.
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-5 border-t dark:border-neutral-855 border-border-subtle">
              <button
                type="button"
                onClick={() => setIsDetailsOpen(false)}
                className="w-full py-2 text-xs font-semibold rounded dark:bg-neutral-800 bg-neutral-100 dark:hover:bg-neutral-750 hover:bg-neutral-200 dark:text-neutral-300 text-text-primary border dark:border-neutral-800 border-border-subtle cursor-pointer transition text-center select-none"
              >
                Close Ledger Card
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 5: Delete Confirmation (Modal dialog) */}
      {isDeleteOpen && selectedFee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-sm dark:bg-neutral-900 bg-surface border dark:border-neutral-800 border-border-subtle rounded-xl p-5 shadow-2xl relative animate-scale-up">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="font-display font-bold dark:text-white text-text-primary text-base">Delete Fee Ledger Card</h3>
                <p className="text-[10px] text-rose-550 dark:text-rose-400 mt-0.5">Destructive administrative action.</p>
              </div>
            </div>

            {deleteError && (
              <div className="p-2.5 mb-4 rounded bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold">
                {deleteError}
              </div>
            )}

            <p className="text-xs dark:text-neutral-300 text-text-secondary leading-normal mb-6">
              Are you sure you want to delete the academic fee ledger card for{" "}
              <strong className="dark:text-white text-text-primary">{selectedFee.studentName}</strong> (₹
              {selectedFee.totalAmount.toLocaleString("en-IN")} - {selectedFee.feeType})? This action is irreversible.
            </p>

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={submittingDelete}
                onClick={() => setIsDeleteOpen(false)}
                className="flex-1 py-2 text-xs font-semibold rounded dark:bg-neutral-800 bg-neutral-100 dark:hover:bg-neutral-750 hover:bg-neutral-200 dark:text-neutral-300 text-text-primary border dark:border-neutral-800 border-border-subtle cursor-pointer transition text-center select-none"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingDelete}
                onClick={handleDeleteFee}
                className="flex-1 py-2 text-xs font-semibold rounded bg-rose-600 hover:bg-rose-700 text-white cursor-pointer transition text-center flex items-center justify-center gap-1.5 select-none"
              >
                {submittingDelete && <Loader2 size={12} className="animate-spin" />}
                <span>Delete Ledger</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
