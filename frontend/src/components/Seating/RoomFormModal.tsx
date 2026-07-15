"use client";

import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { createExamRoom, updateExamRoom, ExamRoom, BenchType } from "@/lib/seating";

interface RoomFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  room?: ExamRoom | null;
}

export function RoomFormModal({ isOpen, onClose, onSuccess, room }: RoomFormModalProps) {
  const { accessToken } = useAuth();
  const [name, setName] = useState("");
  const [building, setBuilding] = useState("");
  const [floor, setFloor] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [capacity, setCapacity] = useState("40");
  const [rows, setRows] = useState("");
  const [columns, setColumns] = useState("");
  const [benchType, setBenchType] = useState<BenchType | "">("");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setName(room?.name ?? "");
    setBuilding(room?.building ?? "");
    setFloor(room?.floor ?? "");
    setRoomNumber(room?.roomNumber ?? "");
    setCapacity(String(room?.capacity ?? 40));
    setRows(room?.rows ? String(room.rows) : "");
    setColumns(room?.columns ? String(room.columns) : "");
    setBenchType(room?.benchType ?? "");
    setNotes(room?.notes ?? "");
    setIsActive(room?.isActive ?? true);
    setError(null);
  }, [isOpen, room]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!accessToken) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name,
        building: building || undefined,
        floor: floor || undefined,
        roomNumber: roomNumber || undefined,
        capacity: Number(capacity),
        rows: rows ? Number(rows) : undefined,
        columns: columns ? Number(columns) : undefined,
        benchType: benchType || undefined,
        notes: notes || undefined,
        isActive,
      };
      if (room) {
        await updateExamRoom(room.id, payload, accessToken);
      } else {
        await createExamRoom(payload as any, accessToken);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save classroom.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "w-full bg-background border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-secondary focus:outline-none focus:border-border-hover";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border-subtle bg-surface shadow-xl p-5 space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-sm text-text-primary">
            {room ? "Edit Classroom" : "New Classroom"}
          </h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="text-[11px] text-red-600 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 space-y-1">
            <span className="text-[10px] font-bold text-text-muted uppercase">Room Name *</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="e.g. Block A - Room 101" />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-bold text-text-muted uppercase">Building</span>
            <input value={building} onChange={(e) => setBuilding(e.target.value)} className={inputClass} />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-bold text-text-muted uppercase">Floor</span>
            <input value={floor} onChange={(e) => setFloor(e.target.value)} className={inputClass} />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-bold text-text-muted uppercase">Room Number</span>
            <input value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} className={inputClass} />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-bold text-text-muted uppercase">Capacity *</span>
            <input type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} className={inputClass} />
          </label>
        </div>

        <div className="pt-2 border-t border-border-subtle space-y-1">
          <span className="text-[10px] font-bold text-text-muted uppercase">Bench Layout (optional — enables visual seating chart)</span>
          <div className="grid grid-cols-3 gap-3 pt-1">
            <label className="space-y-1">
              <span className="text-[9px] text-text-muted">Rows</span>
              <input type="number" min={1} value={rows} onChange={(e) => setRows(e.target.value)} className={inputClass} />
            </label>
            <label className="space-y-1">
              <span className="text-[9px] text-text-muted">Columns</span>
              <input type="number" min={1} value={columns} onChange={(e) => setColumns(e.target.value)} className={inputClass} />
            </label>
            <label className="space-y-1">
              <span className="text-[9px] text-text-muted">Bench Type</span>
              <select value={benchType} onChange={(e) => setBenchType(e.target.value as BenchType | "")} className={inputClass}>
                <option value="">— None —</option>
                <option value="single">Single</option>
                <option value="double">Double</option>
                <option value="triple">Triple</option>
              </select>
            </label>
          </div>
          <p className="text-[9px] text-text-muted pt-1">
            All three fields must be filled together, and rows × columns × bench-seats must be ≥ capacity.
          </p>
        </div>

        <label className="space-y-1 block">
          <span className="text-[10px] font-bold text-text-muted uppercase">Notes</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputClass} min-h-[60px]`} />
        </label>

        <label className="flex items-center gap-2 text-xs font-semibold text-text-primary cursor-pointer">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded border-border-subtle text-accent-blue focus:ring-accent-blue" />
          Active
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-text-secondary hover:bg-surface-hover cursor-pointer">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !name || !capacity}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent-blue text-white text-xs font-bold hover:bg-blue-600 disabled:opacity-50 cursor-pointer"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {room ? "Save Changes" : "Create Classroom"}
          </button>
        </div>
      </div>
    </div>
  );
}
