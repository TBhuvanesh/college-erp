"use client";

import { useState, useEffect } from "react";
import { X, Loader2, ArrowUp, ArrowDown, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { createSeatingPattern, SeatingPatternType, Department } from "@/lib/seating";

interface PatternFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  departments: Department[];
}

export function PatternFormModal({ isOpen, onClose, onSuccess, departments }: PatternFormModalProps) {
  const { accessToken } = useAuth();
  const [name, setName] = useState("");
  const [patternType, setPatternType] = useState<SeatingPatternType>("custom");
  const [sequence, setSequence] = useState<string[]>([]);
  const [isDefault, setIsDefault] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setName("");
    setPatternType("custom");
    setSequence([]);
    setIsDefault(false);
    setError(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const availableDepartments = departments.filter((d) => !sequence.includes(d.id));

  const move = (idx: number, dir: -1 | 1) => {
    setSequence((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!accessToken) return;
    setSubmitting(true);
    setError(null);
    try {
      await createSeatingPattern(
        { name, patternType, departmentSequence: patternType === "random" ? [] : sequence, isDefault },
        accessToken
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create seating pattern.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "w-full bg-background border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-secondary focus:outline-none focus:border-border-hover";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-border-subtle bg-surface shadow-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-sm text-text-primary">New Seating Pattern</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="text-[11px] text-red-600 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <label className="space-y-1 block">
          <span className="text-[10px] font-bold text-text-muted uppercase">Pattern Name *</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="e.g. Mid Examination Pattern" />
        </label>

        <label className="space-y-1 block">
          <span className="text-[10px] font-bold text-text-muted uppercase">Type</span>
          <select value={patternType} onChange={(e) => setPatternType(e.target.value as SeatingPatternType)} className={inputClass}>
            <option value="mid">Mid Examination</option>
            <option value="semester">Semester Examination</option>
            <option value="random">Random</option>
            <option value="custom">Custom</option>
          </select>
        </label>

        {patternType !== "random" && (
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-text-muted uppercase">Department Sequence (cycled in this order)</span>
            <div className="space-y-1.5">
              {sequence.map((deptId, idx) => {
                const dept = departments.find((d) => d.id === deptId);
                return (
                  <div key={deptId} className="flex items-center justify-between px-3 py-2 rounded-xl border border-border-subtle bg-background text-xs font-semibold text-text-primary">
                    <span>{idx + 1}. {dept?.code ?? deptId}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => move(idx, -1)} className="text-text-muted hover:text-text-primary cursor-pointer"><ArrowUp size={12} /></button>
                      <button onClick={() => move(idx, 1)} className="text-text-muted hover:text-text-primary cursor-pointer"><ArrowDown size={12} /></button>
                      <button onClick={() => setSequence((prev) => prev.filter((id) => id !== deptId))} className="text-red-500 hover:text-red-700 cursor-pointer"><Trash2 size={12} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
            {availableDepartments.length > 0 && (
              <select
                value=""
                onChange={(e) => e.target.value && setSequence((prev) => [...prev, e.target.value])}
                className={inputClass}
              >
                <option value="">+ Add department to sequence…</option>
                {availableDepartments.map((d) => (
                  <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
                ))}
              </select>
            )}
          </div>
        )}

        <label className="flex items-center gap-2 text-xs font-semibold text-text-primary cursor-pointer">
          <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="rounded border-border-subtle text-accent-blue focus:ring-accent-blue" />
          Set as default for this exam type
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-text-secondary hover:bg-surface-hover cursor-pointer">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !name || (patternType !== "random" && sequence.length === 0)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent-blue text-white text-xs font-bold hover:bg-blue-600 disabled:opacity-50 cursor-pointer"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Create Pattern
          </button>
        </div>
      </div>
    </div>
  );
}
