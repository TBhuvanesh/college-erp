"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Loader2, MapPin, Armchair, BookOpen } from "lucide-react";
import { departmentColorClasses } from "@/lib/seating";
import * as seating from "@/lib/seating";
import type { SeatAllocation } from "@/lib/seating";

export default function StudentSeatingPage() {
  const { accessToken } = useAuth();
  const [seats, setSeats] = useState<SeatAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    (async () => {
      setLoading(true);
      try {
        setSeats(await seating.getMySeating(accessToken));
      } catch (err: any) {
        setError(err.message || "Failed to load your seating assignments.");
      } finally {
        setLoading(false);
      }
    })();
  }, [accessToken]);

  if (loading) {
    return (
      <div className="flex h-[350px] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-12 w-full max-w-3xl mx-auto">
      <div className="relative overflow-hidden rounded-2xl border border-border-subtle bg-surface p-5 lg:p-6 shadow-sm">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-500" />
        <h1 className="font-display font-bold text-lg text-text-primary leading-none">My Exam Seating</h1>
        <p className="text-xs text-text-muted mt-1">Your upcoming seat assignments — check before every exam.</p>
      </div>

      {error && (
        <div className="text-xs text-red-600 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {seats.length === 0 && !error && (
        <div className="text-center py-16 text-text-muted text-xs border border-dashed border-border-subtle rounded-2xl">
          No upcoming exam seating has been published for you yet.
        </div>
      )}

      <div className="space-y-3">
        {seats.map((seat) => {
          const deptClasses = departmentColorClasses(seat.departmentColor);
          return (
            <div key={seat.id} className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen size={16} className="text-accent-blue" />
                  <div>
                    <p className="text-sm font-bold text-text-primary">{seat.subjectCode}</p>
                    <p className="text-[10px] text-text-muted">{seat.examType}</p>
                  </div>
                </div>
                <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${deptClasses}`}>
                  {seat.departmentCode}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-border-subtle bg-background p-3 text-center space-y-1">
                  <MapPin size={14} className="text-accent-blue mx-auto" />
                  <p className="text-[9px] text-text-muted uppercase font-bold">Room</p>
                  <p className="text-xs font-bold text-text-primary">{seat.roomName}</p>
                </div>
                <div className="rounded-xl border border-border-subtle bg-background p-3 text-center space-y-1">
                  <Armchair size={14} className="text-accent-blue mx-auto" />
                  <p className="text-[9px] text-text-muted uppercase font-bold">Bench</p>
                  <p className="text-xs font-bold text-text-primary">{seat.benchNumber ?? seat.seatNumber}</p>
                </div>
                <div className="rounded-xl border border-border-subtle bg-background p-3 text-center space-y-1">
                  <p className="text-[9px] text-text-muted uppercase font-bold pt-1">Position</p>
                  <p className="text-xs font-bold text-text-primary">{seat.seatPosition ?? "—"}</p>
                </div>
                <div className="rounded-xl border border-border-subtle bg-background p-3 text-center space-y-1">
                  <p className="text-[9px] text-text-muted uppercase font-bold pt-1">Seat #</p>
                  <p className="text-xs font-bold text-text-primary">{seat.seatNumber}</p>
                </div>
              </div>

              <div className={`rounded-xl border p-3 text-center text-[11px] font-bold ${deptClasses}`}>
                Your seat: {seat.roomName} — Bench {seat.benchNumber ?? seat.seatNumber}
                {seat.seatPosition ? ` (${seat.seatPosition})` : ""}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
