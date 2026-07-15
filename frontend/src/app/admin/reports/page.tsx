"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { AcademicSubNav } from "@/components/Analytics/AcademicSubNav";
import { FilterPanel, FilterState } from "@/components/Analytics/FilterPanel";
import { ExportDialog } from "@/components/Analytics/ExportDialog";
import {
  LineChartComponent,
  BarChartComponent,
  PieChartComponent,
  AreaChartComponent,
} from "@/components/Analytics/AnalyticsCharts";
import {
  Download,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Database,
  Printer,
  Sparkles,
} from "lucide-react";

type ReportCategory =
  | "attendance"
  | "results"
  | "fees"
  | "lms"
  | "mentorship"
  | "department"
  | "opportunities"
  | "teaching"
  | "student";

export default function AdminReportCenter() {
  const { accessToken } = useAuth();
  
  // Active report category
  const [reportType, setReportType] = useState<ReportCategory>("attendance");

  // API States
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active filters and pagination
  const [filters, setFilters] = useState<FilterState>({ search: "" });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Export Modal state
  const [exportOpen, setExportOpen] = useState(false);

  // Load report data
  const fetchReport = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      // Build query parameters
      const queryParams = new URLSearchParams();
      queryParams.append("page", currentPage.toString());
      queryParams.append("limit", itemsPerPage.toString());

      // Append active filters
      Object.entries(filters).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== "") {
          queryParams.append(key, String(val));
        }
      });

      const endpoint = `/reports/${reportType}?${queryParams.toString()}`;
      const res = await apiFetch(endpoint, {}, accessToken);

      if (res.success && res.data) {
        setReportData(res.data);
      } else {
        setError(res.message || "Failed to load report data.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error fetching report data.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, reportType, filters, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [reportType, filters]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleApplyFilters = (newFilters: FilterState) => {
    setFilters(newFilters);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= (reportData?.totalPages || 1)) {
      setCurrentPage(newPage);
    }
  };

  // Render chart wrapper dynamically based on backend instructions
  const renderDynamicChart = (chart: any) => {
    const chartSeries = chart.series.map((s: any) => ({
      label: s.label || chart.title,
      data: s.data || [],
    }));

    return (
      <div key={chart.title} className="bg-surface rounded-2xl border border-border-subtle p-5 shadow-sm space-y-3 text-left">
        <h4 className="text-xs font-bold text-text-primary flex items-center gap-1.5 uppercase tracking-wider">
          <Sparkles size={13} className="text-accent-purple" />
          {chart.title}
        </h4>
        {chart.type === "line" && (
          <LineChartComponent labels={chart.labels} series={chartSeries} height={200} />
        )}
        {chart.type === "bar" && (
          <BarChartComponent labels={chart.labels} series={chartSeries} height={200} />
        )}
        {(chart.type === "pie" || chart.type === "donut") && (
          <PieChartComponent
            labels={chart.labels}
            series={chartSeries}
            height={200}
            isDoughnut={chart.type === "donut"}
          />
        )}
        {chart.type === "area" && (
          <AreaChartComponent labels={chart.labels} series={chartSeries} height={200} />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      <AcademicSubNav />

      <div className="max-w-7xl mx-auto px-4 space-y-6 text-left">
        {/* Header Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-text-primary">Professional Report Center</h2>
            <p className="text-xs text-text-secondary">
              Generate, query, filter and download print-ready academic registers.
            </p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportCategory)}
              className="px-3.5 py-2 text-xs bg-surface border border-border-subtle text-text-primary rounded-xl focus:border-accent-blue focus:outline-none flex-1 sm:flex-initial"
            >
              <option value="attendance">Attendance Ledger</option>
              <option value="results">Examination Results</option>
              <option value="fees">Fee Collections</option>
              <option value="lms">LMS Student Workload</option>
              <option value="mentorship">Mentorship Assignments</option>
              <option value="department">Department Performance</option>
              <option value="opportunities">Opportunity participation</option>
              <option value="teaching">Teaching Progress</option>
              <option value="student">Student Performance Profiles</option>
            </select>

            <button
              onClick={() => setExportOpen(true)}
              disabled={loading || !reportData}
              className="inline-flex items-center gap-2 px-4 py-2 bg-accent-blue text-white rounded-xl text-xs font-semibold hover:bg-accent-blue/95 transition-all shadow-md shadow-accent-blue/10 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
            >
              <Download size={14} />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        <FilterPanel onApplyFilters={handleApplyFilters} role="admin" />

        {/* Dynamic Charts returned by the report response */}
        {reportData?.charts && reportData.charts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {reportData.charts.map((c: any) => renderDynamicChart(c))}
          </div>
        )}

        {/* Main Report Table Container */}
        <div className="bg-surface border border-border-subtle rounded-2xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center text-text-muted">
              <Loader2 className="animate-spin text-accent-blue mb-3" size={28} />
              <span className="font-mono text-xs">Retrieving database registers...</span>
            </div>
          ) : error ? (
            <div className="py-16 px-6 text-center text-text-muted">
              <AlertCircle size={28} className="text-danger mx-auto mb-3" />
              <span className="text-sm font-semibold text-text-primary block">Failed to generate report</span>
              <p className="text-xs text-text-secondary mt-1 max-w-md mx-auto">{error}</p>
            </div>
          ) : !reportData || reportData.rows.length === 0 ? (
            <div className="py-20 text-center text-text-muted font-mono text-xs space-y-2">
              <Database size={24} className="mx-auto text-text-muted opacity-50" />
              <p>No matching academic records found in active registries.</p>
            </div>
          ) : (
            <div className="w-full">
              {/* Report Title */}
              <div className="px-5 py-4 border-b border-border-subtle bg-surface-elevated/40 flex justify-between items-center">
                <span className="text-xs font-bold text-text-primary uppercase tracking-wider">
                  {reportData.title || "Academic Records Ledger"}
                </span>
                <span className="text-[10px] font-mono text-text-muted">
                  Total Records: {reportData.total || 0}
                </span>
              </div>

              {/* Responsive Table wrapper */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border-subtle bg-surface-elevated/20 text-text-secondary select-none font-bold uppercase text-[10px] tracking-wider">
                      {reportData.columns?.map((col: any) => (
                        <th key={col.key} className="px-5 py-3 font-semibold">
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle/40">
                    {reportData.rows.map((row: any, rIdx: number) => (
                      <tr
                        key={rIdx}
                        className="hover:bg-surface-hover/60 transition-colors text-text-primary"
                      >
                        {reportData.columns?.map((col: any) => {
                          const val = row[col.key];
                          return (
                            <td key={col.key} className="px-5 py-3 font-medium">
                              {typeof val === "number" && col.key.toLowerCase().includes("amount")
                                ? `₹${val.toLocaleString("en-IN")}`
                                : typeof val === "number" && col.key.toLowerCase().includes("percentage")
                                ? `${val}%`
                                : val !== null && val !== undefined
                                ? String(val)
                                : "—"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary Drawer Row if summary exists */}
              {reportData.summary && Object.keys(reportData.summary).length > 0 && (
                <div className="border-t border-border-subtle bg-surface-elevated/50 p-4 flex flex-wrap gap-x-8 gap-y-2 text-xs">
                  <span className="font-bold text-text-primary shrink-0 uppercase tracking-wide">
                    Report Summaries:
                  </span>
                  <div className="flex flex-wrap gap-x-6 gap-y-1">
                    {Object.entries(reportData.summary).map(([key, val]: [string, any]) => {
                      // Formatting labels
                      const label = key
                        .replace(/([A-Z])/g, " $1")
                        .replace(/^./, (str) => str.toUpperCase());
                      const formattedVal =
                        typeof val === "number" && key.toLowerCase().includes("amount")
                          ? `₹${val.toLocaleString("en-IN")}`
                          : typeof val === "number" && key.toLowerCase().includes("percentage")
                          ? `${val}%`
                          : typeof val === "number" && key.toLowerCase().includes("rate")
                          ? `${val}%`
                          : String(val);

                      return (
                        <div key={key} className="flex gap-2">
                          <span className="text-text-muted font-medium">{label}:</span>
                          <span className="font-bold text-text-primary">{formattedVal}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Pagination controls */}
              <div className="border-t border-border-subtle px-5 py-4 flex items-center justify-between">
                <span className="text-[10px] font-semibold text-text-muted">
                  Showing Page {currentPage} of {reportData.totalPages || 1}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage <= 1}
                    className="p-1.5 rounded-lg border border-border-subtle hover:bg-surface-hover text-text-secondary disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= (reportData.totalPages || 1)}
                    className="p-1.5 rounded-lg border border-border-subtle hover:bg-surface-hover text-text-secondary disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Export Dialog Overlay */}
      <ExportDialog
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        reportType={reportType}
        filters={filters}
      />
    </div>
  );
}
