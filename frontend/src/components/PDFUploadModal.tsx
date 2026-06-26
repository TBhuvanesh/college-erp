"use client";
import React, { useState, useEffect } from "react";
import { X, Upload, Trash2, Eye, Play, Sparkles, Loader2, AlertCircle, FileText, CheckCircle2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export interface DocumentSummary {
  id: string;
  title: string;
  fileName: string;
  filePath: string;
  documentType: string;
  uploadDate: string; // YYYY-MM-DD
  uploadedBy: string;
  uploadedByName: string;
  status: "Uploaded" | "Processed";
  createdAt: string;
}

interface PDFUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExtractionSuccess: (message: string) => void;
}

export const PDFUploadModal: React.FC<PDFUploadModalProps> = ({
  isOpen,
  onClose,
  onExtractionSuccess
}) => {
  const { accessToken } = useAuth();
  
  const [fetching, setFetching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [extractingId, setExtractingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form fields
  const [title, setTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Document list
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchDocuments = async () => {
    if (!accessToken) return;
    try {
      setFetching(true);
      const res = await apiFetch(`/documents?documentType=Academic%20Calendar&page=${page}&limit=5`, {}, accessToken);
      if (res.success && res.data) {
        setDocuments(res.data.documents || []);
        if (res.data.pagination) {
          setTotalPages(res.data.pagination.totalPages || 1);
        }
      }
    } catch (err: any) {
      console.error("Failed to load documents", err);
      setError(err.message || "Failed to load document registry");
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isOpen) {
        fetchDocuments();
      } else {
        // Reset form states
        setTitle("");
        setSelectedFile(null);
        setError(null);
        setSuccessMsg(null);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [isOpen, page, accessToken]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!selectedFile) {
      setError("Please select a PDF file.");
      return;
    }
    if (!title.trim()) {
      setError("Please enter a title for the document.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("title", title.trim());
      formData.append("documentType", "Academic Calendar");

      // API fetch with FormData automatically sets headers
      const res = await apiFetch("/documents/upload", {
        method: "POST",
        body: formData
      }, accessToken);

      if (res.success) {
        setSuccessMsg(res.message || "PDF uploaded and processed successfully.");
        setTitle("");
        setSelectedFile(null);
        // Reset file input element if applicable
        const fileInput = document.getElementById("pdf-file-input") as HTMLInputElement;
        if (fileInput) fileInput.value = "";
        
        setPage(1);
        fetchDocuments();
      }
    } catch (err: any) {
      setError(err.message || "Upload failed. Verify that PDF is under 20MB.");
    } finally {
      setUploading(false);
    }
  };

  const handleExtract = async (documentId: string) => {
    setError(null);
    setSuccessMsg(null);
    setExtractingId(documentId);

    try {
      const res = await apiFetch(`/parsed-events/extract/${documentId}`, {
        method: "POST"
      }, accessToken);

      if (res.success) {
        onExtractionSuccess(
          `Candidate Events Extracted: Created ${res.data?.created || 0} event(s), Replaced ${res.data?.replacedPending || 0} pending event(s).`
        );
        fetchDocuments();
      }
    } catch (err: any) {
      setError(err.message || "Candidate extraction failed. Ensure document text was processed.");
    } finally {
      setExtractingId(null);
    }
  };

  const handleDeleteDoc = async (documentId: string) => {
    if (!confirm("Are you sure you want to delete this PDF and all associated events? This action is irreversible.")) {
      return;
    }

    setError(null);
    setSuccessMsg(null);
    setDeletingId(documentId);

    try {
      const res = await apiFetch(`/documents/${documentId}`, {
        method: "DELETE"
      }, accessToken);

      if (res.success) {
        setSuccessMsg(res.message || "Document deleted successfully.");
        fetchDocuments();
      }
    } catch (err: any) {
      setError(err.message || "Failed to delete document.");
    } finally {
      setDeletingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-sm animate-fade-in">
      {/* Backdrop click close */}
      <div className="absolute inset-0 cursor-default" onClick={onClose}></div>

      {/* Modal Dialog container */}
      <div className="relative w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl p-6 overflow-y-auto max-h-[90vh] z-10 flex flex-col justify-between">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-4">
          <h3 className="font-display font-bold text-white text-base flex items-center gap-2">
            <Upload size={16} className="text-blue-500" />
            <span>PDF Document Center & Extractor</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded bg-neutral-850 hover:bg-neutral-800 text-neutral-450 hover:text-white cursor-pointer transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Notifications */}
        {error && (
          <div className="p-3 mb-4 rounded bg-rose-500/10 border border-rose-500/20 text-rose-450 text-xs font-semibold flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-3 mb-4 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-450 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 size={14} className="shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Upload Form Section */}
        <form onSubmit={handleUploadSubmit} className="glass-card border border-neutral-800 rounded-lg p-4 mb-6 space-y-4">
          <h4 className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Upload New Calendar PDF</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
                Document Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded text-white focus:outline-none focus:border-blue-600 transition"
                placeholder="e.g. JNTUH B.Tech I Year Academic Calendar 2026"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
                Select Calendar PDF <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="pdf-file-input"
                  type="file"
                  required
                  accept="application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="pdf-file-input"
                  className="px-3 py-2 border border-neutral-800 bg-neutral-950 hover:bg-neutral-900 text-neutral-400 hover:text-white rounded text-xs font-semibold cursor-pointer transition flex items-center gap-1.5 flex-1 truncate"
                >
                  <FileText size={14} className="shrink-0" />
                  <span className="truncate">{selectedFile ? selectedFile.name : "Choose PDF File"}</span>
                </label>
                <button
                  type="submit"
                  disabled={uploading || !selectedFile || !title}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-55 disabled:cursor-not-allowed rounded text-xs font-bold text-white transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                >
                  {uploading && <Loader2 size={12} className="animate-spin" />}
                  <span>Upload & Process</span>
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* Existing Documents List */}
        <div className="space-y-3 flex-1 flex flex-col justify-between min-h-[250px]">
          <div>
            <h4 className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-2.5">Uploaded Documents Archive</h4>
            
            {fetching ? (
              <div className="py-8 flex flex-col items-center justify-center text-neutral-500 text-xs font-mono">
                <Loader2 className="animate-spin text-blue-500 mb-1" size={18} />
                <span>Syncing document log...</span>
              </div>
            ) : documents.length > 0 ? (
              <div className="border border-neutral-850 bg-neutral-950/20 rounded-lg divide-y divide-neutral-850">
                {documents.map((doc) => (
                  <div key={doc.id} className="p-3 flex items-center justify-between gap-4 text-xs">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <FileText size={16} className="text-blue-500 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <span className="font-semibold text-white block truncate leading-tight">{doc.title}</span>
                        <span className="text-[10px] text-neutral-500 block truncate font-mono mt-0.5">
                          {doc.fileName} • Uploaded: {doc.uploadDate} by {doc.uploadedByName}
                        </span>
                        
                        {/* Status tags */}
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[8px] font-bold border ${
                              doc.status === "Processed"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            }`}
                          >
                            {doc.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleExtract(doc.id)}
                        disabled={extractingId !== null || doc.status !== "Processed"}
                        title="Extract Candidate Events"
                        className="px-2 py-1.5 rounded bg-neutral-900 border border-neutral-850 text-blue-400 hover:text-blue-300 disabled:opacity-50 hover:bg-neutral-800 transition flex items-center gap-1 text-[10px] font-bold cursor-pointer"
                      >
                        {extractingId === doc.id ? (
                          <Loader2 size={10} className="animate-spin text-blue-500" />
                        ) : (
                          <Play size={10} />
                        )}
                        <span>Extract Events</span>
                      </button>
                      
                      <button
                        onClick={() => handleDeleteDoc(doc.id)}
                        disabled={deletingId !== null}
                        title="Delete Document"
                        className="p-1.5 rounded bg-neutral-900 border border-neutral-850 text-rose-500 hover:text-rose-400 hover:bg-neutral-800 disabled:opacity-50 transition cursor-pointer"
                      >
                        {deletingId === doc.id ? (
                          <Loader2 size={12} className="animate-spin text-rose-500" />
                        ) : (
                          <Trash2 size={12} />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-neutral-600 font-mono text-[10px] bg-neutral-950/20 border border-neutral-850 rounded-lg">
                No Academic Calendar PDFs uploaded yet.
              </div>
            )}
          </div>

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-neutral-900">
              <span className="text-[10px] font-mono text-neutral-500">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="px-2 py-1 bg-neutral-900 hover:bg-neutral-850 text-neutral-450 hover:text-white disabled:opacity-50 border border-neutral-850 text-[10px] font-bold rounded transition cursor-pointer"
                >
                  Prev
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="px-2 py-1 bg-neutral-900 hover:bg-neutral-850 text-neutral-450 hover:text-white disabled:opacity-50 border border-neutral-850 text-[10px] font-bold rounded transition cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
