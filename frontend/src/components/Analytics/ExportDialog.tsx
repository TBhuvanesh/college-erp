"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { FileText, FileSpreadsheet, Download, Loader2, CheckCircle, AlertCircle, X } from "lucide-react";

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  reportType: string;
  filters: any;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001/api";

export const ExportDialog: React.FC<ExportDialogProps> = ({
  isOpen,
  onClose,
  reportType,
  filters,
}) => {
  const { accessToken } = useAuth();
  const [format, setFormat] = useState<"pdf" | "excel" | "csv" | null>(null);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [status, setStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!isOpen) {
      // Reset state on close
      setFormat(null);
      setExporting(false);
      setProgress(0);
      setProgressText("");
      setStatus("idle");
      setErrorMessage("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle Export Trigger
  const handleExport = async (selectedFormat: "pdf" | "excel" | "csv") => {
    if (!accessToken) return;
    setFormat(selectedFormat);
    setExporting(true);
    setStatus("running");
    setProgress(5);
    setProgressText("Initializing export request...");

    // Build URL query string
    const queryParams = new URLSearchParams();
    queryParams.append("reportType", reportType);
    
    // Add all filters
    Object.entries(filters).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== "") {
        queryParams.append(key, String(val));
      }
    });

    const formatPath = selectedFormat === "excel" ? "excel" : selectedFormat === "csv" ? "csv" : "pdf";
    const downloadUrl = `${API_URL}/reports/export/${formatPath}?${queryParams.toString()}`;

    // Slow progressive updates to the progress bar for rich visual experience
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        
        // Progress stage labels
        const nextProgress = prev + Math.floor(Math.random() * 15) + 5;
        if (nextProgress < 30) {
          setProgressText("Querying academic database records...");
        } else if (nextProgress < 60) {
          setProgressText("Compiling schemas and assembling tabular layout...");
        } else if (nextProgress < 85) {
          setProgressText("Applying styling rules and document formatting...");
        } else {
          setProgressText("Generating output bytes and packaging download...");
        }
        return nextProgress;
      });
    }, 450);

    try {
      const response = await fetch(downloadUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Export failed. Server returned status code: ${response.status}`);
      }

      // Convert to blob
      const blob = await response.blob();
      
      // Complete progress bar
      clearInterval(progressInterval);
      setProgress(100);
      setProgressText("Ready! Initiating browser download...");
      
      // Delay slightly for visual feedback before download triggers
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Trigger file download
      const downloadLink = document.createElement("a");
      downloadLink.href = window.URL.createObjectURL(blob);
      
      // Determine file extension
      const ext = selectedFormat === "excel" ? "xlsx" : selectedFormat;
      downloadLink.download = `${reportType}_report_${new Date().toISOString().slice(0, 10)}.${ext}`;
      
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      window.URL.revokeObjectURL(downloadLink.href);

      setStatus("success");
      setExporting(false);
    } catch (err: any) {
      console.error(err);
      clearInterval(progressInterval);
      setStatus("error");
      setErrorMessage(err.message || "Failed to download document from the server.");
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-surface border border-border-subtle rounded-2xl p-6 shadow-2xl animate-scale-up relative text-left">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={exporting}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <X size={15} />
        </button>

        <h3 className="font-display font-bold text-base text-text-primary mb-1">
          Export Document Desk
        </h3>
        <p className="text-xs text-text-secondary mb-4 leading-relaxed">
          Generate print-ready downloads of the active report. All current filters will be preserved.
        </p>

        {status === "idle" && (
          <div className="space-y-3">
            <button
              onClick={() => handleExport("pdf")}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-border-subtle bg-surface-elevated hover:bg-surface-hover hover:border-border-strong transition-all cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-lg dark:bg-rose-500/10 bg-rose-50 dark:text-rose-400 text-rose-700 flex items-center justify-center shrink-0">
                <FileText size={20} />
              </div>
              <div className="flex-1 text-left">
                <h4 className="text-xs font-bold text-text-primary">Portable Document Format (PDF)</h4>
                <p className="text-[10px] text-text-muted mt-0.5">Optimized for distribution, printing and viewing</p>
              </div>
              <Download size={14} className="text-text-muted group-hover:text-text-primary transition-colors" />
            </button>

            <button
              onClick={() => handleExport("excel")}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-border-subtle bg-surface-elevated hover:bg-surface-hover hover:border-border-strong transition-all cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-lg dark:bg-emerald-500/10 bg-emerald-50 dark:text-emerald-400 text-emerald-700 flex items-center justify-center shrink-0">
                <FileSpreadsheet size={20} />
              </div>
              <div className="flex-1 text-left">
                <h4 className="text-xs font-bold text-text-primary">Excel Worksheet (XLSX)</h4>
                <p className="text-[10px] text-text-muted mt-0.5">Includes full summary rows and column formatting</p>
              </div>
              <Download size={14} className="text-text-muted group-hover:text-text-primary transition-colors" />
            </button>

            <button
              onClick={() => handleExport("csv")}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-border-subtle bg-surface-elevated hover:bg-surface-hover hover:border-border-strong transition-all cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-lg dark:bg-blue-500/10 bg-blue-50 dark:text-accent-blue text-blue-700 flex items-center justify-center shrink-0">
                <FileSpreadsheet size={20} />
              </div>
              <div className="flex-1 text-left">
                <h4 className="text-xs font-bold text-text-primary">Comma Separated Values (CSV)</h4>
                <p className="text-[10px] text-text-muted mt-0.5">Raw spreadsheet data fit for database imports</p>
              </div>
              <Download size={14} className="text-text-muted group-hover:text-text-primary transition-colors" />
            </button>
          </div>
        )}

        {status === "running" && (
          <div className="py-6 space-y-4 text-center">
            <div className="flex justify-center">
              <Loader2 className="animate-spin text-accent-blue" size={32} />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-text-primary">Exporting {format?.toUpperCase()} format...</p>
              <p className="text-[10px] text-text-muted font-mono">{progressText}</p>
            </div>
            <div className="w-full bg-surface-hover rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-accent-blue h-1.5 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs font-mono font-bold text-text-secondary block">{progress}%</span>
          </div>
        )}

        {status === "success" && (
          <div className="py-6 space-y-4 text-center animate-fade-in">
            <div className="flex justify-center text-success">
              <CheckCircle size={40} className="stroke-[1.5]" />
            </div>
            <div>
              <p className="text-xs font-bold text-text-primary">Document Export Completed</p>
              <p className="text-[10px] text-text-muted mt-1">Your report has been successfully generated and sent to your browser.</p>
            </div>
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-surface-elevated border border-border-subtle hover:bg-surface-hover text-xs font-semibold text-text-primary transition cursor-pointer inline-block"
            >
              Dismiss
            </button>
          </div>
        )}

        {status === "error" && (
          <div className="py-6 space-y-4 text-center animate-fade-in">
            <div className="flex justify-center text-danger">
              <AlertCircle size={40} className="stroke-[1.5]" />
            </div>
            <div>
              <p className="text-xs font-bold text-text-primary">Document Generation Failed</p>
              <p className="text-[10px] text-danger mt-1 leading-relaxed">{errorMessage}</p>
            </div>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => setStatus("idle")}
                className="px-5 py-2.5 rounded-xl bg-accent-blue hover:bg-accent-blue/90 text-xs font-semibold text-white transition cursor-pointer shadow-md shadow-accent-blue/10"
              >
                Try Again
              </button>
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-surface-elevated border border-border-subtle hover:bg-surface-hover text-xs font-semibold text-text-primary transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
