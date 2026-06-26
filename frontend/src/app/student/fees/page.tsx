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
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "Partially Paid":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "Overdue":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse";
      default:
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
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
        <h2 className="font-display font-bold text-2xl text-white">Academic Fee Ledger</h2>
        <p className="text-xs text-neutral-400 mt-1">
          Review active semester fee structures, billing invoices, and transaction history.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Billed */}
        <div className="glass-card rounded-xl p-4 border border-neutral-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-neutral-500">Total Billed</span>
            <h3 className="text-xl font-bold font-sans text-white mt-1">₹{totalBilled.toLocaleString("en-IN")}</h3>
          </div>
          <div className="w-8 h-8 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-400">
            <CreditCard size={16} />
          </div>
        </div>

        {/* Total Paid */}
        <div className="glass-card rounded-xl p-4 border border-neutral-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-neutral-500">Total Settled</span>
            <h3 className="text-xl font-bold font-sans text-emerald-400 mt-1">₹{totalPaid.toLocaleString("en-IN")}</h3>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 size={16} />
          </div>
        </div>

        {/* Outstanding Dues */}
        <div className="glass-card rounded-xl p-4 border border-rose-950/30 flex items-center justify-between bg-rose-500/[0.01]">
          <div>
            <span className="text-[10px] uppercase font-bold text-neutral-500">Outstanding Dues</span>
            <h3 className="text-xl font-bold font-sans text-rose-500 mt-1">₹{totalPending.toLocaleString("en-IN")}</h3>
          </div>
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <AlertTriangle size={16} />
          </div>
        </div>
      </div>

      {/* Interactive Filters Panel */}
      <div className="glass-card border border-neutral-800 rounded-xl p-4 flex flex-col sm:flex-row gap-3">
        {/* Academic Year Filter */}
        <div className="flex-1">
          <label className="block text-[9px] uppercase font-bold text-neutral-500 mb-1.5">Academic Year</label>
          <select
            value={academicYearFilter}
            onChange={(e) => setAcademicYearFilter(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-600 transition"
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
          <label className="block text-[9px] uppercase font-bold text-neutral-500 mb-1.5">Semester</label>
          <select
            value={semesterFilter}
            onChange={(e) => setSemesterFilter(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-600 transition"
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
          <label className="block text-[9px] uppercase font-bold text-neutral-500 mb-1.5">Fee Category</label>
          <select
            value={feeTypeFilter}
            onChange={(e) => setFeeTypeFilter(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-600 transition"
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
        <h3 className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Fee Records</h3>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 glass-card border border-neutral-850 rounded-xl">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-xs text-neutral-500 mt-2 font-mono">Syncing financial ledger accounts...</p>
          </div>
        ) : error ? (
          <div className="p-6 text-center glass-card border border-rose-950/20 bg-rose-500/[0.02] rounded-xl">
            <AlertTriangle className="w-8 h-8 mx-auto text-rose-500 mb-2" />
            <p className="text-xs text-rose-400 font-semibold">{error}</p>
            <button
              onClick={fetchFees}
              className="mt-3 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-neutral-800 hover:bg-neutral-750 text-white rounded transition"
            >
              Retry Sync
            </button>
          </div>
        ) : fees.length === 0 ? (
          <div className="p-8 text-center glass-card border border-neutral-800 rounded-xl">
            <Info className="w-8 h-8 mx-auto text-neutral-600 mb-2" />
            <p className="text-xs text-neutral-500 font-mono">No academic fee invoices logged in system.</p>
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
                      ? "border-rose-950/50 hover:border-rose-900 bg-rose-500/[0.005]"
                      : fee.paymentStatus === "Paid"
                      ? "border-neutral-850 hover:border-neutral-800"
                      : "border-neutral-800 hover:border-neutral-750"
                  }`}
                >
                  {/* Card Main Block */}
                  <div
                    onClick={() => handleToggleExpand(fee.id)}
                    className="p-5 cursor-pointer flex flex-col md:flex-row justify-between gap-4 select-none items-stretch md:items-center"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[9px] uppercase font-bold tracking-wider font-mono text-neutral-500">
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
                      <h4 className="text-base font-bold text-white leading-tight">{fee.feeType}</h4>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-neutral-400 font-mono">
                        <span>AY: {fee.academicYear}</span>
                        <span className="text-neutral-700">•</span>
                        <span>Semester: {fee.semester}</span>
                        <span className="text-neutral-700">•</span>
                        <span className="flex items-center gap-1">
                          <Calendar size={11} className="text-neutral-500" />
                          <span>Due: {fee.dueDate}</span>
                        </span>
                      </div>
                    </div>

                    {/* Financial Figures */}
                    <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 border-neutral-900 pt-3 md:pt-0">
                      <div className="text-left md:text-right">
                        <span className="text-[9px] text-neutral-500 uppercase font-bold tracking-wide block">
                          Outstanding
                        </span>
                        <span
                          className={`text-lg font-bold font-sans block ${
                            fee.pendingAmount > 0 ? "text-white" : "text-emerald-400"
                          }`}
                        >
                          ₹{fee.pendingAmount.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] text-neutral-500 uppercase font-bold tracking-wide block">
                          Total Billed
                        </span>
                        <span className="text-sm font-semibold text-neutral-400 font-sans block">
                          ₹{fee.totalAmount.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="text-neutral-400 hover:text-white transition">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>
                  </div>

                  {/* Progress Indicator */}
                  <div className="h-[2px] bg-neutral-950 w-full relative">
                    <div
                      className={`h-full transition-all duration-500 ${getProgressColorClass(fee.paymentStatus)}`}
                      style={{ width: `${paidPercent}%` }}
                    />
                  </div>

                  {/* Expanded payment entries / details */}
                  {isExpanded && (
                    <div className="bg-neutral-950/60 border-t border-neutral-900 p-5 space-y-4 font-sans text-xs">
                      {loadingDetailId === fee.id ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className="w-5 h-5 animate-spin text-neutral-500" />
                        </div>
                      ) : details ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {/* Details Metadata */}
                          <div className="md:col-span-1 space-y-3 pr-0 md:pr-4 border-b md:border-b-0 md:border-r border-neutral-900 pb-4 md:pb-0">
                            <h5 className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                              Breakdown Details
                            </h5>
                            <div className="space-y-1.5 text-neutral-300">
                              <div className="flex justify-between">
                                <span className="text-neutral-500">Paid Amount:</span>
                                <span className="font-mono text-emerald-400 font-semibold">
                                  ₹{details.paidAmount.toLocaleString("en-IN")}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-neutral-500">Pending Amount:</span>
                                <span className="font-mono text-neutral-300">
                                  ₹{details.pendingAmount.toLocaleString("en-IN")}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-neutral-500">Created Date:</span>
                                <span className="text-neutral-400">
                                  {new Date(details.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                              {details.remarks && (
                                <div className="pt-2">
                                  <span className="text-neutral-500 block mb-1">Remarks / Details:</span>
                                  <p className="p-2 rounded bg-neutral-900 text-neutral-400 italic text-[11px] leading-normal">
                                    {details.remarks}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Receipts / Payment Entries */}
                          <div className="md:col-span-2 space-y-3">
                            <h5 className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                              Payment Log & Receipts
                            </h5>
                            {details.payments.length === 0 ? (
                              <div className="p-4 bg-neutral-900/50 rounded-lg text-center text-neutral-500 italic font-mono text-[11px]">
                                No payment transaction logs recorded for this ledger entry.
                              </div>
                            ) : (
                              <div className="space-y-2.5">
                                {details.payments.map((payment) => (
                                  <div
                                    key={payment.id}
                                    className="p-3 bg-neutral-900/60 border border-neutral-850 rounded-lg flex flex-col sm:flex-row justify-between gap-3"
                                  >
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1.5">
                                        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold border border-neutral-700 bg-neutral-800 text-neutral-300 font-mono">
                                          {payment.paymentMode}
                                        </span>
                                        {payment.transactionRef && (
                                          <span className="text-[10px] text-neutral-400 font-mono">
                                            Ref: {payment.transactionRef}
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[10px] text-neutral-500 font-mono flex items-center gap-1 mt-1">
                                        <span>Date: {payment.paymentDate}</span>
                                        <span>•</span>
                                        <span>Logged by: {payment.recordedByName}</span>
                                      </div>
                                      {payment.remarks && (
                                        <p className="text-[10px] text-neutral-400 italic mt-1 leading-normal">
                                          &quot;{payment.remarks}&quot;
                                        </p>
                                      )}
                                    </div>
                                    <div className="text-left sm:text-right shrink-0">
                                      <span className="text-[9px] text-neutral-500 uppercase font-bold block">
                                        Amount Credited
                                      </span>
                                      <span className="text-xs font-bold text-emerald-400 font-mono">
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
                        <p className="text-neutral-500 font-mono italic text-center py-2">
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
      <div className="p-4 rounded-xl border border-blue-500/15 bg-blue-500/5 space-y-2">
        <div className="flex items-center gap-2 text-blue-400">
          <Info size={15} />
          <h4 className="text-xs font-bold font-display">University Cashier Notice</h4>
        </div>
        <p className="text-[10px] text-neutral-400 leading-normal">
          Direct online payment gateways (Stripe/Razorpay/UPI) are disabled. Dues must be paid physically at the college accounts office.
        </p>
        <p className="text-[10px] text-neutral-500 leading-normal font-sans">
          Provide your roll number and the invoice number to the accounts officer. Once they record the payment in the admin portal, it will instantly reconcile and reflect here as a cleared receipt.
        </p>
      </div>
    </div>
  );
}
