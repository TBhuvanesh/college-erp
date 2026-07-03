"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import {
  CreditCard,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  Loader2,
  DollarSign
} from "lucide-react";

interface FeePaymentEntry {
  id: string;
  feeId: string;
  amount: number;
  paymentDate: string;
  paymentMode: string;
  transactionRef: string | null;
  recordedByName: string;
  remarks: string | null;
  createdAt: string;
}

interface FeeSummary {
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

interface FeeDetail extends FeeSummary {
  remarks: string | null;
  payments: FeePaymentEntry[];
  createdAt: string;
  updatedAt: string;
}

export default function StudentFees() {
  const { accessToken } = useAuth();

  // Filter States
  const [academicYearFilter, setAcademicYearFilter] = useState("ALL");
  const [semesterFilter, setSemesterFilter] = useState("ALL");
  const [feeTypeFilter, setFeeTypeFilter] = useState("ALL");

  // Data & UI States
  const [fees, setFees] = useState<FeeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Expanded Fee Details state
  const [expandedFeeId, setExpandedFeeId] = useState<string | null>(null);
  const [feeDetails, setFeeDetails] = useState<Record<string, FeeDetail>>({});
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);

  // Fetch fees based on filters
  const fetchFees = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (academicYearFilter !== "ALL") {
        queryParams.append("academicYear", academicYearFilter);
      }
      if (semesterFilter !== "ALL") {
        queryParams.append("semester", semesterFilter);
      }
      if (feeTypeFilter !== "ALL") {
        queryParams.append("feeType", feeTypeFilter);
      }

      const res = await apiFetch(`/fees/my-fees?${queryParams.toString()}`, {}, accessToken);
      if (res.success && res.data) {
        setFees(res.data.fees || []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load academic fee ledger.");
    } finally {
      setLoading(false);
    }
  }, [academicYearFilter, semesterFilter, feeTypeFilter, accessToken]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchFees();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchFees]);

  // Fetch details for an expanded fee record
  const handleToggleExpand = async (feeId: string) => {
    if (expandedFeeId === feeId) {
      setExpandedFeeId(null);
      return;
    }

    setExpandedFeeId(feeId);

    // If details already cached, don't fetch again
    if (feeDetails[feeId]) return;

    setLoadingDetailId(feeId);
    try {
      const res = await apiFetch(`/fees/${feeId}`, {}, accessToken);
      if (res.success && res.data?.fee) {
        setFeeDetails((prev) => ({
          ...prev,
          [feeId]: res.data.fee,
        }));
      }
    } catch (err: any) {
      console.error(`Failed to load details for invoice ${feeId}:`, err);
    } finally {
      setLoadingDetailId(null);
    }
  };

  // Compute overall summary metrics from current visible/filtered fees
  const totalBilled = fees.reduce((acc, f) => acc + f.totalAmount, 0);
  const totalPaid = fees.reduce((acc, f) => acc + f.paidAmount, 0);
  const totalPending = fees.reduce((acc, f) => acc + f.pendingAmount, 0);

  const getStatusBadgeStyles = (status: string) => {
    switch (status) {
      case "Paid":
        return "dark:bg-emerald-500/10 bg-emerald-50 dark:text-emerald-400 text-emerald-700 dark:border-emerald-500/20 border-emerald-200";
      case "Partially Paid":
        return "dark:bg-amber-500/10 bg-amber-50 dark:text-amber-400 text-amber-700 dark:border-amber-500/20 border-amber-200";
      case "Overdue":
        return "dark:bg-rose-500/10 bg-rose-50 dark:text-rose-400 text-rose-700 dark:border-rose-500/20 border-rose-200 animate-pulse";
      default:
        return "dark:bg-blue-500/10 bg-blue-50 dark:text-blue-400 text-blue-700 dark:border-blue-500/20 border-blue-200";
    }
  };

  const getProgressColorClass = (status: string) => {
    switch (status) {
      case "Paid":
        return "bg-emerald-500";
      case "Partially Paid":
        return "bg-amber-500";
      case "Overdue":
        return "bg-rose-500";
      default:
        return "bg-blue-500";
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Page Header */}
      <div>
        <h2 className="font-display font-bold text-2xl dark:text-white text-text-primary">Academic Fee Ledger</h2>
        <p className="text-xs dark:text-neutral-400 text-text-secondary mt-1">
          Review active semester fee structures, billing invoices, and transaction history.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Billed */}
        <div className="glass-card rounded-xl p-4 border border-border-subtle flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-text-muted">Total Billed</span>
            <h3 className="text-xl font-bold font-sans dark:text-white text-text-primary mt-1">₹{totalBilled.toLocaleString("en-IN")}</h3>
          </div>
          <div className="w-8 h-8 rounded-lg dark:bg-neutral-800 bg-surface-elevated border dark:border-neutral-700 border-border-subtle flex items-center justify-center dark:text-neutral-400 text-text-secondary">
            <CreditCard size={16} />
          </div>
        </div>

        {/* Total Paid */}
        <div className="glass-card rounded-xl p-4 border border-border-subtle flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-text-muted">Total Settled</span>
            <h3 className="text-xl font-bold font-sans dark:text-emerald-400 text-emerald-700 mt-1">₹{totalPaid.toLocaleString("en-IN")}</h3>
          </div>
          <div className="w-8 h-8 rounded-lg dark:bg-emerald-500/10 bg-emerald-50 dark:border-emerald-500/20 border-emerald-200 flex items-center justify-center dark:text-emerald-400 text-emerald-700">
            <CheckCircle2 size={16} />
          </div>
        </div>

        {/* Outstanding Dues */}
        <div className="glass-card rounded-xl p-4 border dark:border-rose-950/30 border-rose-500/20 flex items-center justify-between bg-rose-500/[0.01]">
          <div>
            <span className="text-[10px] uppercase font-bold text-text-muted">Outstanding Dues</span>
            <h3 className="text-xl font-bold font-sans dark:text-rose-500 text-rose-700 mt-1">₹{totalPending.toLocaleString("en-IN")}</h3>
          </div>
          <div className="w-8 h-8 rounded-lg dark:bg-rose-500/10 bg-rose-50 dark:border-rose-500/20 border-rose-200 flex items-center justify-center dark:text-rose-450 text-rose-700">
            <AlertTriangle size={16} />
          </div>
        </div>
      </div>

      {/* Interactive Filters Panel */}
      <div className="glass-card border border-border-subtle rounded-xl p-4 flex flex-col sm:flex-row gap-3">
        {/* Academic Year Filter */}
        <div className="flex-1">
          <label className="block text-[9px] uppercase font-bold text-text-muted mb-1.5">Academic Year</label>
          <select
            value={academicYearFilter}
            onChange={(e) => setAcademicYearFilter(e.target.value)}
            className="w-full dark:bg-neutral-950 bg-surface border border-border-subtle rounded px-2.5 py-1.5 text-xs dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition"
          >
            <option value="ALL">All Academic Years</option>
            <option value="2023-2024">2023-2024</option>
            <option value="2024-2025">2024-2025</option>
            <option value="2025-2026">2025-2026</option>
            <option value="2026-2027">2026-2027</option>
          </select>
        </div>

        {/* Semester Filter */}
        <div className="flex-1">
          <label className="block text-[9px] uppercase font-bold text-text-muted mb-1.5">Semester</label>
          <select
            value={semesterFilter}
            onChange={(e) => setSemesterFilter(e.target.value)}
            className="w-full dark:bg-neutral-950 bg-surface border border-border-subtle rounded px-2.5 py-1.5 text-xs dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition"
          >
            <option value="ALL">All Semesters</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
              <option key={sem} value={sem.toString()}>
                Semester {sem}
              </option>
            ))}
          </select>
        </div>

        {/* Fee Type Filter */}
        <div className="flex-1">
          <label className="block text-[9px] uppercase font-bold text-text-muted mb-1.5">Fee Category</label>
          <select
            value={feeTypeFilter}
            onChange={(e) => setFeeTypeFilter(e.target.value)}
            className="w-full dark:bg-neutral-950 bg-surface border border-border-subtle rounded px-2.5 py-1.5 text-xs dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition"
          >
            <option value="ALL">All Fee Types</option>
            <option value="Tuition Fee">Tuition Fee</option>
            <option value="Examination Fee">Examination Fee</option>
            <option value="Laboratory Fee">Laboratory Fee</option>
            <option value="Miscellaneous Fee">Miscellaneous Fee</option>
          </select>
        </div>
      </div>

      {/* Main List Section */}
      <div className="space-y-4">
        <h3 className="text-[10px] uppercase font-bold text-text-secondary tracking-wider">Fee Records</h3>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 glass-card border border-border-subtle rounded-xl">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-xs text-text-muted mt-2 font-mono">Syncing financial ledger accounts...</p>
          </div>
        ) : error ? (
          <div className="p-6 text-center glass-card border dark:border-rose-955/20 border-rose-500/20 bg-rose-505/[0.02] rounded-xl">
            <AlertTriangle className="w-8 h-8 mx-auto text-rose-500 mb-2" />
            <p className="text-xs dark:text-rose-400 text-rose-700 font-semibold">{error}</p>
            <button
              onClick={fetchFees}
              className="mt-3 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider dark:bg-neutral-800 bg-surface-elevated hover:bg-surface-hover dark:text-white text-text-primary border dark:border-transparent border-border-subtle rounded transition"
            >
              Retry Sync
            </button>
          </div>
        ) : fees.length === 0 ? (
          <div className="p-8 text-center glass-card border border-border-subtle rounded-xl">
            <Info className="w-8 h-8 mx-auto text-text-muted mb-2" />
            <p className="text-xs text-text-muted font-mono">No academic fee invoices logged in system.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {fees.map((fee) => {
              const paidPercent = fee.totalAmount > 0 ? Math.round((fee.paidAmount / fee.totalAmount) * 100) : 100;
              const isExpanded = expandedFeeId === fee.id;
              const details = feeDetails[fee.id];

              return (
                <div
                  key={fee.id}
                  className={`glass-card border rounded-xl overflow-hidden transition-all duration-200 ${
                    fee.paymentStatus === "Overdue"
                      ? "dark:border-rose-950/50 border-rose-300 hover:border-rose-400 bg-rose-505/[0.005]"
                      : fee.paymentStatus === "Paid"
                      ? "dark:border-neutral-850 border-border-subtle hover:border-neutral-800 hover:border-border-strong"
                      : "dark:border-neutral-800 border-border-subtle hover:border-neutral-750 hover:border-border-strong"
                  }`}
                >
                  {/* Card Main Block */}
                  <div
                    onClick={() => handleToggleExpand(fee.id)}
                    className="p-5 cursor-pointer flex flex-col md:flex-row justify-between gap-4 select-none items-stretch md:items-center"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[9px] uppercase font-bold tracking-wider font-mono text-text-muted">
                          #{fee.id.substring(0, 8)}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[8px] font-bold border uppercase tracking-wider ${getStatusBadgeStyles(
                            fee.paymentStatus
                          )}`}
                        >
                          {fee.paymentStatus}
                        </span>
                      </div>
                      <h4 className="text-base font-bold dark:text-white text-text-primary leading-tight">{fee.feeType}</h4>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] dark:text-neutral-400 text-text-secondary font-mono">
                        <span>AY: {fee.academicYear}</span>
                        <span className="dark:text-neutral-700 text-text-muted">•</span>
                        <span>Semester: {fee.semester}</span>
                        <span className="dark:text-neutral-700 text-text-muted">•</span>
                        <span className="flex items-center gap-1">
                          <Calendar size={11} className="dark:text-neutral-500 text-text-muted" />
                          <span>Due: {fee.dueDate}</span>
                        </span>
                      </div>
                    </div>

                    {/* Financial Figures */}
                    <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 dark:border-neutral-900 border-border-subtle pt-3 md:pt-0">
                      <div className="text-left md:text-right">
                        <span className="text-[9px] dark:text-neutral-500 text-text-muted uppercase font-bold tracking-wide block">
                          Outstanding
                        </span>
                        <span
                          className={`text-lg font-bold font-sans block ${
                            fee.pendingAmount > 0 ? "dark:text-white text-text-primary" : "dark:text-emerald-400 text-emerald-700"
                          }`}
                        >
                          ₹{fee.pendingAmount.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] dark:text-neutral-500 text-text-muted uppercase font-bold tracking-wide block">
                          Total Billed
                        </span>
                        <span className="text-sm font-semibold dark:text-neutral-400 text-text-secondary font-sans block">
                          ₹{fee.totalAmount.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="dark:text-neutral-400 text-text-secondary dark:hover:text-white hover:text-text-primary transition">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>
                  </div>

                  {/* Progress Indicator */}
                  <div className="h-[2px] dark:bg-neutral-950 bg-neutral-100 w-full relative">
                    <div
                      className={`h-full transition-all duration-505 ${getProgressColorClass(fee.paymentStatus)}`}
                      style={{ width: `${paidPercent}%` }}
                    />
                  </div>

                  {/* Expanded payment entries / details */}
                  {isExpanded && (
                    <div className="dark:bg-neutral-950/60 bg-surface-elevated border-t dark:border-neutral-900 border-border-subtle p-5 space-y-4 font-sans text-xs">
                      {loadingDetailId === fee.id ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
                        </div>
                      ) : details ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {/* Details Metadata */}
                          <div className="md:col-span-1 space-y-3 pr-0 md:pr-4 border-b md:border-b-0 md:border-r dark:border-neutral-900 border-border-subtle pb-4 md:pb-0">
                            <h5 className="text-[10px] uppercase font-bold dark:text-neutral-400 text-text-secondary tracking-wider">
                              Breakdown Details
                            </h5>
                            <div className="space-y-1.5 dark:text-neutral-300 text-text-secondary">
                              <div className="flex justify-between">
                                <span className="dark:text-neutral-500 text-text-muted">Paid Amount:</span>
                                <span className="font-mono dark:text-emerald-400 text-emerald-705 font-semibold">
                                  ₹{details.paidAmount.toLocaleString("en-IN")}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="dark:text-neutral-500 text-text-muted">Pending Amount:</span>
                                <span className="font-mono dark:text-neutral-300 text-text-secondary">
                                  ₹{details.pendingAmount.toLocaleString("en-IN")}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="dark:text-neutral-500 text-text-muted">Created Date:</span>
                                <span className="dark:text-neutral-400 text-text-secondary">
                                  {new Date(details.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                              {details.remarks && (
                                <div className="pt-2">
                                  <span className="dark:text-neutral-500 text-text-muted block mb-1">Remarks / Details:</span>
                                  <p className="p-2 rounded dark:bg-neutral-900 bg-surface dark:text-neutral-400 text-text-muted italic text-[11px] leading-normal border dark:border-transparent border-border-subtle">
                                    {details.remarks}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Receipts / Payment Entries */}
                          <div className="md:col-span-2 space-y-3">
                            <h5 className="text-[10px] uppercase font-bold dark:text-neutral-400 text-text-secondary tracking-wider">
                              Payment Log & Receipts
                            </h5>
                            {details.payments.length === 0 ? (
                              <div className="p-4 dark:bg-neutral-900/50 bg-surface border border-border-subtle rounded-lg text-center dark:text-neutral-500 text-text-muted italic font-mono text-[11px]">
                                No payment transaction logs recorded for this ledger entry.
                              </div>
                            ) : (
                              <div className="space-y-2.5">
                                {details.payments.map((payment) => (
                                  <div
                                    key={payment.id}
                                    className="p-3 dark:bg-neutral-900/60 bg-surface border dark:border-neutral-850 border-border-subtle rounded-lg flex flex-col sm:flex-row justify-between gap-3"
                                  >
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1.5">
                                        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold border dark:border-neutral-700 border-border-subtle dark:bg-neutral-800 bg-surface-elevated dark:text-neutral-300 text-text-secondary font-mono">
                                          {payment.paymentMode}
                                        </span>
                                        {payment.transactionRef && (
                                          <span className="text-[10px] dark:text-neutral-400 text-text-secondary font-mono">
                                            Ref: {payment.transactionRef}
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[10px] dark:text-neutral-500 text-text-muted font-mono flex items-center gap-1 mt-1">
                                        <span>Date: {payment.paymentDate}</span>
                                        <span>•</span>
                                        <span>Logged by: {payment.recordedByName}</span>
                                      </div>
                                      {payment.remarks && (
                                        <p className="text-[10px] dark:text-neutral-400 text-text-secondary italic mt-1 leading-normal">
                                          &quot;{payment.remarks}&quot;
                                        </p>
                                      )}
                                    </div>
                                    <div className="text-left sm:text-right shrink-0">
                                      <span className="text-[9px] dark:text-neutral-500 text-text-muted uppercase font-bold block">
                                        Amount Credited
                                      </span>
                                      <span className="text-xs font-bold dark:text-emerald-400 text-emerald-700 font-mono">
                                        + ₹{payment.amount.toLocaleString("en-IN")}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <p className="dark:text-neutral-500 text-text-muted font-mono italic text-center py-2">
                          Error loading breakdown details.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info Block */}
      <div className="p-4 rounded-xl border dark:border-blue-500/15 border-blue-200 dark:bg-blue-500/5 bg-blue-50/50 space-y-2">
        <div className="flex items-center gap-2 dark:text-blue-400 text-blue-700">
          <Info size={15} />
          <h4 className="text-xs font-bold font-display">University Cashier Notice</h4>
        </div>
        <p className="text-[10px] dark:text-neutral-400 text-text-secondary leading-normal">
          Direct online payment gateways (Stripe/Razorpay/UPI) are disabled. Dues must be paid physically at the college accounts office.
        </p>
        <p className="text-[10px] dark:text-neutral-500 text-text-muted leading-normal font-sans">
          Provide your roll number and the invoice number to the accounts officer. Once they record the payment in the admin portal, it will instantly reconcile and reflect here as a cleared receipt.
        </p>
      </div>
    </div>
  );
}
