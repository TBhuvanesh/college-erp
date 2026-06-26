"use client";

import React, { useState, useEffect } from "react";
import { createMaterial, updateMaterial, CourseMaterial } from "@/lib/lms";
import { X, Loader2, FileUp } from "lucide-react";

interface SubjectOption {
  id: string;
  name: string;
  code: string;
}

interface MaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  token: string;
  subjects: SubjectOption[];
  material?: CourseMaterial | null; // If provided, we are in Edit Mode
  defaultSubjectId?: string; // Preselected subject id
}

export const MaterialModal: React.FC<MaterialModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  token,
  subjects,
  material,
  defaultSubjectId,
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isOpen) {
        if (material) {
          setTitle(material.title);
          setDescription(material.description || "");
          setSubjectId(material.subjectId);
          setFile(null);
        } else {
          setTitle("");
          setDescription("");
          setSubjectId(defaultSubjectId || "");
          setFile(null);
        }
        setError(null);
        setProgress(0);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [isOpen, material, defaultSubjectId]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      const ext = selectedFile.name.split(".").pop()?.toLowerCase();
      const allowed = ["pdf", "ppt", "pptx", "doc", "docx"];

      if (!ext || !allowed.includes(ext)) {
        setError("Unsupported file format. Supported: pdf, ppt, pptx, doc, docx");
        setFile(null);
        return;
      }
      setError(null);
      setFile(selectedFile);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!subjectId) {
      setError("Subject selection is required");
      return;
    }
    if (!material && !file) {
      setError("Please select a file to upload");
      return;
    }

    setSubmitting(true);
    setProgress(10);

    // Simulate progress increments for premium visual indicator
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 15;
      });
    }, 150);

    try {
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("description", description.trim());
      formData.append("subjectId", subjectId);
      if (file) {
        formData.append("file", file);
      }

      if (material) {
        // Edit Mode
        await updateMaterial(material.id, formData, token);
        clearInterval(progressInterval);
        setProgress(100);
        setTimeout(() => {
          onSuccess("Course material updated successfully");
          onClose();
        }, 300);
      } else {
        // Create Mode
        await createMaterial(formData, token);
        clearInterval(progressInterval);
        setProgress(100);
        setTimeout(() => {
          onSuccess("Course material uploaded successfully");
          onClose();
        }, 300);
      }
    } catch (err: any) {
      clearInterval(progressInterval);
      setProgress(0);
      setError(err.message || "Failed to save material details.");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/70 backdrop-blur-sm animate-fade-in p-4">
      {/* Drawer Panel */}
      <div className="relative w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-xl p-6 flex flex-col shadow-2xl z-10">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4 mb-4">
          <h3 className="font-display font-bold text-white text-lg flex items-center gap-2">
            <FileUp size={18} className="text-blue-500" />
            <span>{material ? "Edit Learning Resource" : "Upload Learning Resource"}</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded bg-neutral-850 hover:bg-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Error notification */}
        {error && (
          <div className="p-3 mb-4 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
              Resource Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded text-white focus:outline-none focus:border-blue-600 transition"
              placeholder="e.g. Lecture 1: Basics of ML"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded text-white focus:outline-none focus:border-blue-600 transition resize-none"
              placeholder="Provide a brief summary of the contents..."
            />
          </div>

          {/* Subject Dropdown */}
          <div>
            <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
              Subject Module <span className="text-rose-500">*</span>
            </label>
            <select
              required
              disabled={!!material}
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded text-white focus:outline-none focus:border-blue-600 transition cursor-pointer disabled:opacity-50"
            >
              <option value="">Select Subject</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name} ({sub.code})
                </option>
              ))}
            </select>
          </div>

          {/* File Picker */}
          <div>
            <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
              File Attachment {!material && <span className="text-rose-500">*</span>}
            </label>
            <input
              type="file"
              accept=".pdf,.ppt,.pptx,.doc,.docx"
              onChange={handleFileChange}
              className="w-full text-xs text-neutral-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-neutral-800 file:text-neutral-300 hover:file:bg-neutral-750 file:cursor-pointer"
            />
            <span className="text-[9px] text-neutral-500 mt-1 block">
              Supported file types: pdf, ppt, pptx, doc, docx. (Max size 10MB)
            </span>
          </div>

          {/* Upload Progress Bar */}
          {submitting && (
            <div className="space-y-1.5 pt-2">
              <div className="flex items-center justify-between text-[10px] text-neutral-400 font-mono">
                <span>Uploading file...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-neutral-950 h-1.5 rounded-full overflow-hidden border border-neutral-900">
                <div
                  className="bg-blue-600 h-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Action triggers */}
          <div className="flex items-center gap-3 pt-4 border-t border-neutral-850 mt-4">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="flex-1 py-2 text-xs font-semibold rounded bg-neutral-800 hover:bg-neutral-750 text-neutral-300 hover:text-white cursor-pointer transition text-center disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition text-center flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {submitting && <Loader2 size={12} className="animate-spin" />}
              <span>{material ? "Save Changes" : "Upload Material"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
