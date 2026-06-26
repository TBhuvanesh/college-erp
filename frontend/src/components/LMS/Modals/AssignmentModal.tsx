"use client";

import React, { useState, useEffect } from "react";
import { createAssignment, updateAssignment, Assignment } from "@/lib/lms";
import { X, Loader2, Calendar } from "lucide-react";

interface SubjectOption {
  id: string;
  name: string;
  code: string;
}

interface AssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  token: string;
  subjects: SubjectOption[];
  assignment?: Assignment | null; // If provided, we are in Edit Mode
  defaultSubjectId?: string; // Preselected subject id
}

export const AssignmentModal: React.FC<AssignmentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  token,
  subjects,
  assignment,
  defaultSubjectId,
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [maxMarks, setMaxMarks] = useState<number>(100);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatDatetimeLocal = (isoStr: string) => {
    if (!isoStr) return "";
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return "";
      const pad = (num: number) => num.toString().padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
        d.getHours()
      )}:${pad(d.getMinutes())}`;
    } catch {
      return "";
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isOpen) {
        if (assignment) {
          setTitle(assignment.title);
          setDescription(assignment.description || "");
          setSubjectId(assignment.subjectId);
          setDueDate(formatDatetimeLocal(assignment.dueDate));
          setMaxMarks(assignment.maxMarks);
        } else {
          setTitle("");
          setDescription("");
          setSubjectId(defaultSubjectId || "");
          setDueDate("");
          setMaxMarks(100);
        }
        setError(null);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [isOpen, assignment, defaultSubjectId]);

  if (!isOpen) return null;

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
    if (!dueDate) {
      setError("Due Date is required");
      return;
    }
    if (maxMarks <= 0 || maxMarks > 1000) {
      setError("Maximum marks must be between 1 and 1000");
      return;
    }

    setSubmitting(true);

    try {
      // Convert HTML datetime-local string to ISO Datetime string for the backend
      const isoDueDate = new Date(dueDate).toISOString();

      if (assignment) {
        // Edit Mode
        await updateAssignment(
          assignment.id,
          {
            title: title.trim(),
            description: description.trim() || undefined,
            dueDate: isoDueDate,
            maxMarks,
          },
          token
        );
        onSuccess("Assignment updated successfully");
      } else {
        // Create Mode
        await createAssignment(
          {
            title: title.trim(),
            description: description.trim() || undefined,
            subjectId,
            dueDate: isoDueDate,
            maxMarks,
          },
          token
        );
        onSuccess("Assignment created successfully");
      }
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save assignment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/70 backdrop-blur-sm animate-fade-in p-4">
      <div className="relative w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-xl p-6 flex flex-col shadow-2xl z-10">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4 mb-4">
          <h3 className="font-display font-bold text-white text-lg flex items-center gap-2">
            <Calendar size={18} className="text-blue-500" />
            <span>{assignment ? "Edit Assignment Task" : "Create Assignment Task"}</span>
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
              Assignment Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded text-white focus:outline-none focus:border-blue-600 transition"
              placeholder="e.g. Lab Assignment 1: Neural Networks"
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
              rows={4}
              className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded text-white focus:outline-none focus:border-blue-600 transition resize-none"
              placeholder="Detail out questions, guidelines, and submission rules..."
            />
          </div>

          {/* Subject Dropdown */}
          <div>
            <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
              Subject Module <span className="text-rose-500">*</span>
            </label>
            <select
              required
              disabled={!!assignment}
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

          {/* Due Date & Maximum Marks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
                Due Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded text-white focus:outline-none focus:border-blue-600 transition cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
                Maximum Marks <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                required
                min={1}
                max={1000}
                value={maxMarks}
                onChange={(e) => setMaxMarks(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded text-white focus:outline-none focus:border-blue-600 transition"
              />
            </div>
          </div>

          {/* Action triggers */}
          <div className="flex items-center gap-3 pt-4 border-t border-neutral-850 mt-6">
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
              <span>{assignment ? "Save Changes" : "Create Task"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
