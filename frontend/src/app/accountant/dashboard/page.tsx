"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import {
  Users,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  FileSpreadsheet,
  ArrowUpRight,
  TrendingDown,
  Loader2,
  CalendarDays
} from "lucide-react";

interface AccountantMetrics {
  totalStudents: number;
  totalCollected: number;
  totalPending: number;
  fullyPaidStudents: number;
  partialPaidStudents: number;
}

interface RecentTransaction {
  id: string;
  amount: number;
  paymentDate: string;
  paymentMode: string;
  studentName: string;
  rollNumber: string;
}

interface DashboardData {
  metrics: AccountantMetrics;
  recentTransactions: RecentTransaction[];
}

export default function AccountantDashboard() {
  const { accessToken } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/dashboard/accountant", {}, accessToken);
      if (res.success && res.data) {
        setData(res.data);
      } else {
        throw new Error(res.message || "Failed to load financials");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load financial stats.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchDashboardStats();
  }, [fetchDashboardStats]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
        <p className="text-xs text-text-muted mt-2 font-mono">Syncing general ledger balances...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 text-center max-w-lg mx-auto glass-card border border-rose-500/25 bg-rose-500/[0.02] rounded-xl mt-12">
        <AlertCircle className="w-8 h-8 mx-auto text-rose-500 mb-2" />
        <p className="text-xs text-rose-600 dark:text-rose-450 font-semibold">{error || "Data load failed"}</p>
        <button
          onClick={fetchDashboardStats}
          className="mt-3 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider dark:bg-neutral-800 bg-surface-elevated hover:bg-surface-hover border dark:border-transparent border-border-subtle rounded transition cursor-pointer"
        >
          Reload Dashboard
        </button>
      </div>
    );
  }

  const { metrics, recentTransactions } = data;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <h2 className="font-display font-bold text-2xl dark:text-white text-text-primary">Finance Console</h2>
        <p className="text-xs dark:text-neutral-400 text-text-secondary mt-1">
          Real-time summary of student invoices, payment collections, and institutional receivables.
        </p>
      </div>

      {/* Grid Cards metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Students */}
        <div className="glass-card rounded-xl p-4 border border-border-subtle flex items-center justify-between shadow-sm bg-surface">
          <div>
            <span className="text-[10px] uppercase font-bold text-text-muted">Total Students</span>
            <h3 className="text-xl font-bold font-sans dark:text-white text-text-primary mt-1">
              {metrics.totalStudents}
            </h3>
          </div>
          <div className="w-8 h-8 rounded-lg dark:bg-neutral-800 bg-neutral-100 flex items-center justify-center dark:text-neutral-400 text-text-secondary">
            <Users size={16} />
          </div>
        </div>

        {/* Total Collected */}
        <div className="glass-card rounded-xl p-4 border border-border-subtle flex items-center justify-between shadow-sm bg-surface">
          <div>
            <span className="text-[10px] uppercase font-bold text-text-muted">Total Collected</span>
            <h3 className="text-xl font-bold font-sans dark:text-emerald-400 text-emerald-700 mt-1">
              ₹{metrics.totalCollected.toLocaleString("en-IN")}
            </h3>
          </div>
          <div className="w-8 h-8 rounded-lg dark:bg-emerald-500/10 bg-emerald-50 border border-emerald-500/20 flex items-center justify-center dark:text-emerald-400 text-emerald-700">
            <TrendingUp size={16} />
          </div>
        </div>

        {/* Total Pending */}
        <div className="glass-card rounded-xl p-4 border border-border-subtle flex items-center justify-between shadow-sm bg-surface">
          <div>
            <span className="text-[10px] uppercase font-bold text-text-muted">Outstanding</span>
            <h3 className="text-xl font-bold font-sans dark:text-rose-500 text-rose-700 mt-1">
              ₹{metrics.totalPending.toLocaleString("en-IN")}
            </h3>
          </div>
          <div className="w-8 h-8 rounded-lg dark:bg-rose-500/10 bg-rose-50 border border-rose-500/20 flex items-center justify-center dark:text-rose-500 text-rose-750">
            <TrendingDown size={16} />
          </div>
        </div>

        {/* Fully Paid */}
        <div className="glass-card rounded-xl p-4 border border-border-subtle flex items-center justify-between shadow-sm bg-surface">
          <div>
            <span className="text-[10px] uppercase font-bold text-text-muted">Accounts Paid</span>
            <h3 className="text-xl font-bold font-sans dark:text-blue-400 text-blue-700 mt-1">
              {metrics.fullyPaidStudents}
            </h3>
          </div>
          <div className="w-8 h-8 rounded-lg dark:bg-blue-500/10 bg-blue-50 border border-blue-500/20 flex items-center justify-center dark:text-blue-400 text-blue-700">
            <CheckCircle size={16} />
          </div>
        </div>

        {/* Partially Paid */}
        <div className="glass-card rounded-xl p-4 border border-border-subtle flex items-center justify-between shadow-sm bg-surface">
          <div>
            <span className="text-[10px] uppercase font-bold text-text-muted">Partial Paid</span>
            <h3 className="text-xl font-bold font-sans dark:text-amber-400 text-amber-700 mt-1">
              {metrics.partialPaidStudents}
            </h3>
          </div>
          <div className="w-8 h-8 rounded-lg dark:bg-amber-500/10 bg-amber-50 border border-amber-500/20 flex items-center justify-center dark:text-amber-400 text-amber-700">
            <FileSpreadsheet size={16} />
          </div>
        </div>
      </div>

      {/* Main Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Recent Transactions */}
        <div className="lg:col-span-2 glass-card rounded-xl border border-border-subtle p-5 shadow-sm bg-surface flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold dark:text-white text-text-primary">Recent Transactions Ledger</h4>
              <span className="text-[10px] dark:text-neutral-500 text-text-secondary font-mono">Latest payments</span>
            </div>

            <div className="divide-y dark:divide-neutral-900 divide-border-subtle">
              {recentTransactions.length === 0 ? (
                <p className="text-center py-12 text-xs text-text-muted italic font-mono">
                  No payment logs found.
                </p>
              ) : (
                recentTransactions.map((tx) => (
                  <div key={tx.id} className="py-3 flex items-center justify-between gap-4 first:pt-0 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <h5 className="font-semibold text-xs dark:text-white text-text-primary truncate">
                        {tx.studentName}
                      </h5>
                      <div className="flex items-center gap-2 text-[10px] dark:text-neutral-500 text-text-secondary font-mono mt-0.5">
                        <span>{tx.rollNumber}</span>
                        <span>•</span>
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold border dark:border-neutral-700 border-border-subtle bg-surface-elevated font-mono">
                          {tx.paymentMode}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-mono font-bold dark:text-emerald-400 text-emerald-700 block text-xs">
                        + ₹{tx.amount.toLocaleString("en-IN")}
                      </span>
                      <span className="text-[9px] text-text-muted font-mono block">
                        {tx.paymentDate}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Information & Actions */}
        <div className="space-y-4">
          {/* Quick Actions */}
          <div className="glass-card rounded-xl border border-border-subtle p-5 bg-surface shadow-sm space-y-4">
            <h4 className="text-sm font-bold dark:text-white text-text-primary">Financial Tasks</h4>
            <div className="space-y-2">
              <Link
                href="/accountant/fees"
                className="w-full flex items-center justify-between p-3 rounded-lg dark:bg-neutral-900/60 bg-neutral-50 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 border dark:border-neutral-850 border-border-subtle text-xs dark:text-neutral-300 text-text-secondary transition group font-semibold"
              >
                <span>Record New Student Payment</span>
                <ArrowUpRight size={14} className="text-text-muted group-hover:text-text-primary transition-colors" />
              </Link>
              <Link
                href="/accountant/fees"
                className="w-full flex items-center justify-between p-3 rounded-lg dark:bg-neutral-900/60 bg-neutral-50 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 border dark:border-neutral-850 border-border-subtle text-xs dark:text-neutral-300 text-text-secondary transition group font-semibold"
              >
                <span>Search Due Receivables</span>
                <ArrowUpRight size={14} className="text-text-muted group-hover:text-text-primary transition-colors" />
              </Link>
            </div>
          </div>

          {/* Cashier Notice */}
          <div className="p-4 rounded-xl border dark:border-blue-500/15 border-blue-200 dark:bg-blue-500/5 bg-blue-50/50 space-y-2">
            <div className="flex items-center gap-2 dark:text-blue-400 text-blue-700">
              <CalendarDays size={15} />
              <h4 className="text-xs font-bold font-display">Daily Reconcile Notice</h4>
            </div>
            <p className="text-[10px] dark:text-neutral-400 text-text-secondary leading-normal">
              Verify receipt journals at the end of the cashier shift. Keep payment receipts catalogued chronologically.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
