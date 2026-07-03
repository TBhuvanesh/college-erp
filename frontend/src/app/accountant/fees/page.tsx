"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import {
  Search,
  Filter,
  CreditCard,
  Calendar,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Plus,
  ArrowLeft,
  Printer,
  FileText,
  DollarSign,
  User,
  X
} from "lucide-react";

interface StudentFeeSummary {
  id: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  programName: string;
  academicYear: string;
  semester: number;
  feeType: string;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  dueDate: string;
  paymentStatus: "Pending" | "Partially Paid" | "Paid" | "Overdue";
}

interface FeePayment {
  id: string;
  amount: number;
  paymentDate: string;
  paymentMode: string;
  transactionRef: string | null;
  recordedByName: string;
  remarks: string | null;
  createdAt: string;
}

interface FeeDetail extends StudentFeeSummary {
  remarks: string | null;
  payments: FeePayment[];
}

export default function AccountantFees() {
  const { accessToken } = useAuth();

  // Registry List States
  const [fees, setFees] = useState<StudentFeeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [semesterFilter, setSemesterFilter] = useState("ALL");

  // Selection & Detail Drawer
  const [selectedFeeId, setSelectedFeeId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<FeeDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Record Payment Modal State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMode, setPayMode] = useState("Cash");
  const [payDate, setPayDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [txnRef, setTxnRef] = useState("");
  const [payRemarks, setPayRemarks] = useState("");
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Receipt Modal State (For print preview)
  const [activeReceipt, setActiveReceipt] = useState<{
    studentName: string;
    rollNumber: string;
    feeType: string;
    academicYear: string;
    semester: number;
    payment: FeePayment;
  } | null>(null);

  const fetchFees = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/fees", {}, accessToken);
      if (res.success && res.data?.fees) {
        setFees(res.data.fees);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load fee records.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchFees();
  }, [fetchFees]);

  const fetchDetail = useCallback(async (feeId: string) => {
    setLoadingDetail(true);
    try {
      const res = await apiFetch(`/fees/${feeId}`, {}, accessToken);
      if (res.success && res.data?.fee) {
        setSelectedDetail(res.data.fee);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingDetail(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (selectedFeeId) {
      fetchDetail(selectedFeeId);
    } else {
      setSelectedDetail(null);
    }
  }, [selectedFeeId, fetchDetail]);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDetail) return;

    setPaymentError(null);
    const amountNum = parseFloat(payAmount);

    if (isNaN(amountNum) || amountNum <= 0) {
      setPaymentError("Please enter a valid payment amount greater than ₹0.");
      return;
    }

    if (amountNum > selectedDetail.pendingAmount) {
      setPaymentError(`Payment amount cannot exceed the pending due of ₹${selectedDetail.pendingAmount.toLocaleString("en-IN")}.`);
      return;
    }

    setSubmittingPayment(true);
    try {
      const res = await apiFetch(
        `/fees/${selectedDetail.id}/payments`,
        {
          method: "POST",
          body: JSON.stringify({
            amount: amountNum,
            paymentMode: payMode,
            paymentDate: payDate,
            transactionRef: txnRef.trim() || undefined,
            remarks: payRemarks.trim() || undefined,
          }),
        },
        accessToken
      );

      if (res.success) {
        // Clear Form Modal
        setPayAmount("");
        setPayRemarks("");
        setTxnRef("");
        setPaymentModalOpen(false);

        // Reload data
        await fetchDetail(selectedDetail.id);
        await fetchFees();
      } else {
        throw new Error(res.message || "Payment submission failed");
      }
    } catch (err: any) {
      setPaymentError(err.message || "Something went wrong.");
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handlePrintReceipt = (payment: FeePayment) => {
    if (!selectedDetail) return;
    setActiveReceipt({
      studentName: selectedDetail.studentName,
      rollNumber: selectedDetail.rollNumber,
      feeType: selectedDetail.feeType,
      academicYear: selectedDetail.academicYear,
      semester: selectedDetail.semester,
      payment,
    });
  };

  // Filter logic
  const filteredFees = fees.filter((fee) => {
    const matchesSearch =
      fee.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fee.rollNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || fee.paymentStatus === statusFilter;
    const matchesSemester = semesterFilter === "ALL" || fee.semester.toString() === semesterFilter;
    return matchesSearch && matchesStatus && matchesSemester;
  });

  const getStatusBadgeStyles = (status: string) => {
    switch (status) {
      case "Paid":
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
      case "Partially Paid":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
      case "Overdue":
        return "bg-rose-500/10 text-rose-600 dark:text-rose-450 border-rose-500/20";
      default:
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
    }
  };

  return (
    <div className="space-y-6 pb-12 relative">
      {/* Print receipt dialog layout */}
      {activeReceipt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white text-neutral-900 rounded-xl max-w-lg w-full p-6 shadow-2xl relative border border-neutral-200 printable-receipt-box animate-scale-up">
            <button
              onClick={() => setActiveReceipt(null)}
              className="absolute top-4 right-4 text-neutral-450 hover:text-neutral-700 cursor-pointer no-print"
            >
              <X size={18} />
            </button>

            {/* Receipt Content */}
            <div className="space-y-6" id="printable-receipt">
              <div className="text-center border-b pb-4 border-dashed border-neutral-300">
                <img
                  src="/college_logo.jpeg"
                  className="w-12 h-12 rounded-full mx-auto object-cover bg-white border mb-1"
                  alt="SIET logo"
                />
                <h3 className="font-display font-extrabold text-sm tracking-wide uppercase">
                  Sreyas Institute of Engineering &amp; Technology
                </h3>
                <span className="text-[9px] text-neutral-500 block">Bandlaguda, Nagole, Hyderabad 500068</span>
                <h4 className="font-mono text-[10px] font-black uppercase text-neutral-600 mt-2 bg-neutral-100 py-1 rounded inline-block px-3">
                  Official Payment Receipt
                </h4>
              </div>

              {/* Receipt Body */}
              <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-neutral-500 block uppercase font-bold">Student Name</span>
                  <span className="font-bold">{activeReceipt.studentName}</span>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-500 block uppercase font-bold">Roll Number</span>
                  <span className="font-bold">{activeReceipt.rollNumber}</span>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-500 block uppercase font-bold">Fee Category</span>
                  <span>{activeReceipt.feeType}</span>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-500 block uppercase font-bold">AY / Semester</span>
                  <span>
                    {activeReceipt.academicYear} / Sem {activeReceipt.semester}
                  </span>
                </div>
                <div className="col-span-2 border-t border-dashed border-neutral-200 my-1"></div>
                <div>
                  <span className="text-[10px] text-neutral-500 block uppercase font-bold">Receipt ID</span>
                  <span className="text-[10px] select-all font-mono font-semibold">{activeReceipt.payment.id}</span>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-500 block uppercase font-bold">Payment Date</span>
                  <span>{activeReceipt.payment.paymentDate}</span>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-500 block uppercase font-bold">Payment Mode</span>
                  <span className="font-bold">{activeReceipt.payment.paymentMode}</span>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-500 block uppercase font-bold">Txn Reference</span>
                  <span>{activeReceipt.payment.transactionRef || "N/A"}</span>
                </div>
                <div className="col-span-2 border-t border-dashed border-neutral-200 pt-3">
                  <div className="flex items-center justify-between p-3 bg-neutral-50 border rounded-lg">
                    <span className="font-bold text-neutral-600 uppercase text-[10px]">Credited Amount</span>
                    <span className="text-sm font-extrabold text-neutral-900">
                      ₹{activeReceipt.payment.amount.toLocaleString("en-IN")}.00
                    </span>
                  </div>
                </div>
              </div>

              {/* Receipt Footer */}
              <div className="pt-6 border-t border-dashed border-neutral-300 flex items-end justify-between text-[10px] font-mono">
                <div>
                  <p className="text-neutral-500">Collected By: {activeReceipt.payment.recordedByName}</p>
                  <p className="text-neutral-450 italic mt-0.5">&quot;Thank you for your payment.&quot;</p>
                </div>
                <div className="text-center pr-2">
                  <div className="w-24 h-px bg-neutral-300 mb-1"></div>
                  <span className="text-[8px] text-neutral-500 uppercase tracking-widest block font-bold">
                    Accounts Cashier
                  </span>
                </div>
              </div>
            </div>

            {/* Print receipt CTA button */}
            <div className="mt-6 flex justify-end gap-3 no-print">
              <button
                onClick={() => setActiveReceipt(null)}
                className="px-4 py-2 border rounded-lg text-xs font-semibold hover:bg-neutral-50 cursor-pointer"
              >
                Close Receipt
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-neutral-900 text-white rounded-lg text-xs font-semibold hover:bg-neutral-800 flex items-center gap-1.5 cursor-pointer shadow"
              >
                <Printer size={13} />
                <span>Print Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Form Modal */}
      {paymentModalOpen && selectedDetail && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card bg-surface-elevated border border-border-strong rounded-xl max-w-md w-full p-6 shadow-2xl relative animate-scale-up">
            <button
              onClick={() => {
                setPaymentModalOpen(false);
                setPaymentError(null);
              }}
              className="absolute top-4 right-4 text-text-muted hover:text-text-primary cursor-pointer"
            >
              <X size={16} />
            </button>

            <h3 className="font-display font-bold text-lg dark:text-white text-text-primary">Record Payment Entry</h3>
            <p className="text-[11px] text-text-muted mt-1 leading-normal">
              Enter the cash, cheque, or electronic credit amount against the pending tuition fees ledger of{" "}
              <strong className="dark:text-neutral-200 text-text-primary">{selectedDetail.studentName}</strong>.
            </p>

            <form onSubmit={handleRecordPayment} className="space-y-4 mt-4">
              {paymentError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-xs text-rose-500 rounded font-semibold">
                  {paymentError}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Payment Amount (INR)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted font-bold">
                    ₹
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder={`Max: ${selectedDetail.pendingAmount}`}
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 bg-background border border-border-subtle rounded text-xs focus:outline-none focus:border-blue-500/50"
                  />
                </div>
                <span className="text-[9px] text-text-muted font-mono block mt-1">
                  Remaining Dues: ₹{selectedDetail.pendingAmount.toLocaleString("en-IN")}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Payment Mode</label>
                  <select
                    value={payMode}
                    onChange={(e) => setPayMode(e.target.value)}
                    className="w-full bg-background border border-border-subtle rounded px-2.5 py-1.8 text-xs focus:outline-none"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Online">Online Transfer</option>
                    <option value="DD">Demand Draft (DD)</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Payment Date</label>
                  <input
                    type="date"
                    required
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full bg-background border border-border-subtle rounded px-2.5 py-1.5 text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Txn Reference (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g., UTR, bank transfer ID, cheque number"
                  value={txnRef}
                  onChange={(e) => setTxnRef(e.target.value)}
                  className="w-full bg-background border border-border-subtle rounded px-2.5 py-1.8 text-xs focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Remarks / Notes</label>
                <textarea
                  placeholder="Cashier notes..."
                  value={payRemarks}
                  onChange={(e) => setPayRemarks(e.target.value)}
                  rows={2}
                  className="w-full bg-background border border-border-subtle rounded px-2.5 py-1.5 text-xs focus:outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentModalOpen(false);
                    setPaymentError(null);
                  }}
                  className="px-4 py-2 border rounded-lg text-xs font-semibold hover:bg-surface-hover cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submittingPayment && <Loader2 size={12} className="animate-spin" />}
                  <span>Save Transaction</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Page Title */}
      <div>
        <h2 className="font-display font-bold text-2xl dark:text-white text-text-primary">Tuition Fees Registry</h2>
        <p className="text-xs dark:text-neutral-400 text-text-secondary mt-1">
          Manage student financial accounts, collect payments, and generate immutably logged cashier receipts.
        </p>
      </div>

      {/* Filters Bar */}
      <div className="glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl p-4 flex flex-col md:flex-row gap-3 shadow-sm">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 dark:text-neutral-500 text-text-muted" />
          <input
            type="text"
            placeholder="Search by student name or roll number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs dark:bg-neutral-955 bg-background border dark:border-neutral-850 border-border-subtle rounded dark:text-white text-text-primary focus:outline-none focus:border-blue-500/50 transition font-semibold"
          />
        </div>

        {/* Semester Filter */}
        <div className="w-full md:w-40 flex items-center gap-2 dark:bg-neutral-955 bg-background border dark:border-neutral-850 border-border-subtle rounded px-2 text-xs dark:text-white text-text-primary">
          <Filter size={12} className="dark:text-neutral-500 text-text-muted shrink-0" />
          <span className="dark:text-neutral-500 text-text-secondary">Sem:</span>
          <select
            value={semesterFilter}
            onChange={(e) => setSemesterFilter(e.target.value)}
            className="bg-transparent dark:text-white text-text-primary cursor-pointer py-2 flex-1 focus:outline-none text-xs font-semibold"
          >
            <option value="ALL">All</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
              <option key={s} value={s.toString()}>Sem {s}</option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="w-full md:w-48 flex items-center gap-2 dark:bg-neutral-955 bg-background border dark:border-neutral-850 border-border-subtle rounded px-2 text-xs dark:text-white text-text-primary">
          <Filter size={12} className="dark:text-neutral-500 text-text-muted shrink-0" />
          <span className="dark:text-neutral-500 text-text-secondary">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-transparent dark:text-white text-text-primary cursor-pointer py-2 flex-1 focus:outline-none text-xs font-semibold"
          >
            <option value="ALL">All Statuses</option>
            <option value="Paid">Paid</option>
            <option value="Partially Paid">Partially Paid</option>
            <option value="Pending">Pending</option>
            <option value="Overdue">Overdue</option>
          </select>
        </div>
      </div>

      {/* Main Grid View */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Table container */}
        <div className="flex-1 w-full glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl overflow-hidden shadow-sm">
          {error && (
            <div className="p-4 bg-rose-500/10 border-b dark:border-neutral-800 border-border-subtle text-rose-600 dark:text-rose-450 text-xs font-semibold font-mono">
              Error: {error}
            </div>
          )}

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="dark:bg-neutral-900/50 bg-neutral-100 border-b dark:border-neutral-800 border-border-subtle dark:text-neutral-400 text-text-secondary font-semibold">
                  <th className="px-4 py-3 font-mono">Roll Number</th>
                  <th className="px-4 py-3">Student Name</th>
                  <th className="px-4 py-3 font-mono">Semester</th>
                  <th className="px-4 py-3">Tuition Total</th>
                  <th className="px-4 py-3">Outstanding</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-neutral-900 divide-border-subtle dark:text-neutral-300 text-text-secondary">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 dark:text-neutral-500 text-text-muted">
                      <Loader2 className="animate-spin text-indigo-500 mx-auto mb-2" size={20} />
                      <span className="font-mono text-[10px]">Accessing student finance records...</span>
                    </td>
                  </tr>
                ) : filteredFees.length > 0 ? (
                  filteredFees.map((fee) => (
                    <tr
                      key={fee.id}
                      className={`dark:hover:bg-neutral-900/30 hover:bg-neutral-100/50 transition cursor-pointer ${
                        selectedFeeId === fee.id ? "dark:bg-indigo-600/10 bg-indigo-50 border-l-2 border-l-indigo-600 dark:text-indigo-300 text-indigo-750" : ""
                      }`}
                      onClick={() => setSelectedFeeId(fee.id)}
                    >
                      <td className="px-4 py-3 font-mono dark:text-neutral-300 text-text-primary font-bold">{fee.rollNumber}</td>
                      <td className="px-4 py-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full dark:bg-neutral-800 bg-neutral-200 border dark:border-neutral-700 border-border-subtle flex items-center justify-center font-bold text-indigo-550 dark:text-indigo-400 shrink-0">
                          {fee.studentName.charAt(0)}
                        </div>
                        <div>
                          <span className="font-semibold dark:text-white text-text-primary block">{fee.studentName}</span>
                          <span className="text-[10px] dark:text-neutral-500 text-text-secondary">{fee.programName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono dark:text-neutral-300 text-text-primary">Sem {fee.semester}</td>
                      <td className="px-4 py-3 font-mono dark:text-neutral-300 text-text-primary">₹{fee.totalAmount.toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3 font-mono dark:text-neutral-300 text-text-primary font-semibold">₹{fee.pendingAmount.toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2.5 py-0.5 rounded text-[10px] font-bold border capitalize ${getStatusBadgeStyles(
                            fee.paymentStatus
                          )}`}
                        >
                          {fee.paymentStatus}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-12 dark:text-neutral-500 text-text-muted font-mono">
                      No matching student financial records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="block md:hidden divide-y dark:divide-neutral-900 divide-border-subtle">
            {loading ? (
              <div className="text-center py-12 text-text-muted">
                <Loader2 className="animate-spin text-indigo-500 mx-auto mb-2" size={20} />
                <span className="font-mono text-[10px]">Accessing student finance records...</span>
              </div>
            ) : filteredFees.length > 0 ? (
              filteredFees.map((fee) => (
                <div
                  key={fee.id}
                  className={`p-4 dark:hover:bg-neutral-900/10 hover:bg-neutral-100/50 transition cursor-pointer flex flex-col gap-2.5 ${
                    selectedFeeId === fee.id ? "dark:bg-indigo-600/5 bg-indigo-50/30 border-l-2 border-l-indigo-600" : ""
                  }`}
                  onClick={() => setSelectedFeeId(fee.id)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-text-muted font-bold">{fee.rollNumber}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[9px] font-bold border capitalize ${getStatusBadgeStyles(
                        fee.paymentStatus
                      )}`}
                    >
                      {fee.paymentStatus}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full dark:bg-neutral-800 bg-neutral-200 border dark:border-neutral-700 border-border-subtle flex items-center justify-center font-bold text-indigo-550 dark:text-indigo-400 text-xs shrink-0">
                      {fee.studentName.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-semibold text-text-primary text-xs leading-normal">{fee.studentName}</h4>
                      <p className="text-[10px] text-text-muted mt-0.5">Outstanding: ₹{fee.pendingAmount.toLocaleString("en-IN")}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 dark:text-neutral-500 text-text-muted font-mono text-xs">
                No matching student financial records found.
              </div>
            )}
          </div>
        </div>

        {/* Right side Details Drawer */}
        {selectedFeeId && (
          <div className="w-full lg:w-96 glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl p-5 shadow-2xl relative animate-scale-up shrink-0">
            {/* Header close */}
            <div className="flex items-center justify-between border-b dark:border-neutral-800 border-border-subtle pb-3 mb-4">
              <h3 className="font-display font-bold dark:text-white text-text-primary text-base">Student Ledger Card</h3>
              <button
                onClick={() => setSelectedFeeId(null)}
                className="p-1 rounded dark:bg-neutral-850 bg-neutral-100 dark:hover:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-400 text-text-secondary dark:hover:text-white hover:text-text-primary cursor-pointer border dark:border-neutral-800 border-border-subtle"
              >
                <X size={14} />
              </button>
            </div>

            {loadingDetail ? (
              <div className="py-20 flex flex-col items-center justify-center dark:text-neutral-500 text-text-muted">
                <Loader2 className="animate-spin text-indigo-500 mb-2" size={20} />
                <span className="font-mono text-[9px]">Fetching ledger card...</span>
              </div>
            ) : selectedDetail ? (
              <div className="space-y-5">
                {/* Profile Brief */}
                <div className="flex items-center gap-4 p-3 rounded-lg dark:bg-neutral-955/50 bg-background border dark:border-neutral-900 border-border-subtle">
                  <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center font-bold text-indigo-400 text-lg">
                    {selectedDetail.studentName.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold dark:text-white text-text-primary truncate">{selectedDetail.studentName}</h4>
                    <p className="text-[10px] dark:text-neutral-500 text-text-secondary font-mono mt-0.5">
                      {selectedDetail.rollNumber}
                    </p>
                    <span className="text-[9px] dark:text-neutral-605 text-text-muted font-mono mt-0.5 block">
                      Sem {selectedDetail.semester} • {selectedDetail.programName}
                    </span>
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="p-4 rounded-lg dark:bg-neutral-950/40 bg-neutral-50 border dark:border-neutral-900 border-border-subtle space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="dark:text-neutral-500 text-text-muted">Total Academic Fee:</span>
                    <span className="font-mono font-bold dark:text-white text-text-primary">
                      ₹{selectedDetail.totalAmount.toLocaleString("en-IN")}.00
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="dark:text-neutral-500 text-text-muted">Settled Amount:</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      ₹{selectedDetail.paidAmount.toLocaleString("en-IN")}.00
                    </span>
                  </div>
                  <div className="h-px dark:bg-neutral-900 bg-neutral-200 my-1"></div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="dark:text-neutral-500 text-text-muted uppercase font-bold text-[10px]">Outstanding Balance:</span>
                    <span className="font-mono font-extrabold dark:text-rose-500 text-rose-700 text-sm">
                      ₹{selectedDetail.pendingAmount.toLocaleString("en-IN")}.00
                    </span>
                  </div>
                </div>

                {/* Record Button */}
                {selectedDetail.pendingAmount > 0 ? (
                  <button
                    onClick={() => setPaymentModalOpen(true)}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow transition"
                  >
                    <Plus size={14} />
                    <span>Record Tuition Payment</span>
                  </button>
                ) : (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold rounded text-center font-mono">
                    Ledger Paid in Full
                  </div>
                )}

                {/* Transactions Ledger Log */}
                <div className="space-y-2">
                  <h4 className="text-[10px] uppercase font-bold dark:text-neutral-400 text-text-secondary tracking-wider">
                    Receipt Transaction Logs
                  </h4>
                  {selectedDetail.payments.length === 0 ? (
                    <div className="p-4 dark:bg-neutral-900/50 bg-background border border-border-subtle rounded-lg text-center dark:text-neutral-500 text-text-muted italic font-mono text-[10px]">
                      No recorded payments found.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                      {selectedDetail.payments.map((p) => (
                        <div
                          key={p.id}
                          className="p-3 dark:bg-neutral-900/70 bg-background border dark:border-neutral-850 border-border-subtle rounded-lg space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="font-mono font-bold text-xs dark:text-white text-text-primary">
                                ₹{p.amount.toLocaleString("en-IN")}.00
                              </span>
                              <span className="text-[9px] dark:text-neutral-500 text-text-muted font-mono block">
                                {p.paymentDate} • {p.paymentMode}
                              </span>
                            </div>
                            <button
                              onClick={() => handlePrintReceipt(p)}
                              title="Print Receipt"
                              className="p-1 rounded bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-750 dark:text-neutral-300 text-text-secondary border dark:border-neutral-700 border-border-subtle cursor-pointer transition flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider"
                            >
                              <Printer size={10} />
                              <span>Receipt</span>
                            </button>
                          </div>
                          {p.remarks && (
                            <p className="text-[10px] dark:text-neutral-400 text-text-muted italic leading-normal border-t dark:border-neutral-850 border-border-subtle/50 pt-1.5">
                              &quot;{p.remarks}&quot;
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
