"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { Loader2, MapPin, Calendar, Clock, ClipboardList, Printer, Search, ChevronDown, ChevronUp } from "lucide-react";
import { SeatingChartGrid } from "@/components/Seating/SeatingChartGrid";
import * as seating from "@/lib/seating";
import type { InvigilationDuty, RoomSeatingChart } from "@/lib/seating";

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().slice(0, 10);
}

export default function FacultyInvigilationPage() {
  const { accessToken } = useAuth();
  const [duties, setDuties] = useState<InvigilationDuty[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDutyId, setExpandedDutyId] = useState<string | null>(null);
  const [chart, setChart] = useState<RoomSeatingChart | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [rollSearch, setRollSearch] = useState("");

  const loadDuties = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await seating.listInvigilationDuties({ limit: 100 }, accessToken);
      setDuties(res.duties);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadDuties();
  }, [loadDuties]);

  const toggleExpand = async (duty: InvigilationDuty) => {
    if (expandedDutyId === duty.id) {
      setExpandedDutyId(null);
      setChart(null);
      return;
    }
    setExpandedDutyId(duty.id);
    setChart(null);
    if (!accessToken) return;
    setChartLoading(true);
    try {
      setChart(await seating.getSeatingByRoom(duty.roomId, duty.dutyDate, accessToken));
    } catch {
      setChart(null);
    } finally {
      setChartLoading(false);
    }
  };

  const handleExport = async (type: seating.SeatingReportType, roomId: string) => {
    if (!accessToken) return;
    try {
      await seating.exportSeatingReport(type, "pdf", { roomId }, accessToken);
    } catch (err: any) {
      alert(err.message || "Export failed.");
    }
  };

  const todaysDuties = duties.filter((d) => isToday(d.dutyDate));
  const upcomingDuties = duties.filter((d) => !isToday(d.dutyDate));

  const filteredSeats = chart?.seats.filter(
    (s) => !rollSearch.trim() || s.rollNumber.toLowerCase().includes(rollSearch.trim().toLowerCase())
  );
  const highlightSeatId = rollSearch.trim() ? filteredSeats?.[0]?.id ?? null : null;

  if (loading) {
    return (
      <div className="flex h-[350px] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-12 w-full max-w-5xl mx-auto">
      <div className="relative overflow-hidden rounded-2xl border border-border-subtle bg-surface p-5 lg:p-6 shadow-sm">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-500" />
        <h1 className="font-display font-bold text-lg text-text-primary leading-none">My Invigilation Duties</h1>
        <p className="text-xs text-text-muted mt-1">Your assigned exam halls, seating rosters, and printable duty sheets.</p>
      </div>

      {todaysDuties.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">Today</h3>
          {todaysDuties.map((duty) => (
            <DutyCard key={duty.id} duty={duty} expanded={expandedDutyId === duty.id} onToggle={() => toggleExpand(duty)} onExport={handleExport} />
          ))}
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">Upcoming</h3>
        {upcomingDuties.length === 0 && todaysDuties.length === 0 && (
          <div className="text-center py-12 text-text-muted text-xs border border-dashed border-border-subtle rounded-xl">
            No invigilation duties assigned yet.
          </div>
        )}
        {upcomingDuties.map((duty) => (
          <DutyCard key={duty.id} duty={duty} expanded={expandedDutyId === duty.id} onToggle={() => toggleExpand(duty)} onExport={handleExport} />
        ))}
      </div>

      {expandedDutyId && (
        <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Search size={14} className="text-text-muted" />
            <input
              value={rollSearch}
              onChange={(e) => setRollSearch(e.target.value)}
              placeholder="Find a student by roll number in this room…"
              className="flex-1 bg-background border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-secondary focus:outline-none focus:border-border-hover"
            />
          </div>

          {chartLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
          ) : chart ? (
            <SeatingChartGrid chart={chart} highlightSeatId={highlightSeatId} />
          ) : (
            <p className="text-center text-text-muted text-xs py-8">No seating found for this room/date yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

function DutyCard({
  duty,
  expanded,
  onToggle,
  onExport,
}: {
  duty: InvigilationDuty;
  expanded: boolean;
  onToggle: () => void;
  onExport: (type: seating.SeatingReportType, roomId: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-surface shadow-sm overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between p-4 text-left cursor-pointer hover:bg-surface-hover/40 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center">
            <MapPin size={15} className="text-accent-blue" />
          </div>
          <div>
            <p className="text-xs font-bold text-text-primary">{duty.roomName}</p>
            <p className="text-[10px] text-text-muted flex items-center gap-2 mt-0.5">
              <span className="flex items-center gap-1"><Calendar size={10} /> {duty.dutyDate}</span>
              <span className="flex items-center gap-1"><Clock size={10} /> {duty.startTime}-{duty.endTime}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
            duty.status === "Assigned" ? "text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-500/10 dark:border-blue-500/20"
            : duty.status === "Completed" ? "text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/20"
            : "text-text-muted bg-neutral-100 border-transparent"
          }`}>
            {duty.status}
          </span>
          {expanded ? <ChevronUp size={14} className="text-text-muted" /> : <ChevronDown size={14} className="text-text-muted" />}
        </div>
      </button>
      {duty.exams.length > 0 && (
        <div className="px-4 pb-3 flex flex-wrap gap-1.5">
          {duty.exams.map((e) => (
            <span key={e.examId} className="text-[9px] font-bold text-text-secondary bg-background border border-border-subtle rounded-full px-2 py-0.5">
              {e.subjectCode} ({e.examType})
            </span>
          ))}
        </div>
      )}
      <div className="px-4 pb-4 flex gap-2 border-t border-border-subtle pt-3">
        <button
          onClick={(e) => { e.stopPropagation(); onExport("invigilator_sheet", duty.roomId); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-subtle text-[10px] font-bold text-text-secondary hover:border-border-hover cursor-pointer"
        >
          <Printer size={11} /> Duty Sheet
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onExport("attendance_sheet", duty.roomId); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-subtle text-[10px] font-bold text-text-secondary hover:border-border-hover cursor-pointer"
        >
          <ClipboardList size={11} /> Attendance Sheet
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onExport("room_seating_chart", duty.roomId); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-subtle text-[10px] font-bold text-text-secondary hover:border-border-hover cursor-pointer"
        >
          <Printer size={11} /> Seating Chart
        </button>
      </div>
    </div>
  );
}
