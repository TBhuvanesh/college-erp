"use client";
import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import {
  Calendar,
  Clock,
  Printer,
  Info,
  User,
  MapPin,
  HelpCircle,
  FileText
} from "lucide-react";

interface TimetableSlot {
  id: string;
  startTime: string;
  endTime: string;
  slotType: "TEACHING" | "BREAK" | "LUNCH";
  sequenceOrder: number;
}

interface TimetableEntry {
  id: string;
  dayOfWeek: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  subjectAbbreviation: string | null;
  classType: "Theory" | "Lab" | "Project" | "Elective" | "Tutorial" | "Other";
  slots: Array<{
    id: string;
    startTime: string;
    endTime: string;
    sequenceOrder: number;
    slotType: string;
  }>;
  faculties: Array<{
    id: string;
    fullName: string;
    employeeNumber: string;
  }>;
}

interface TimetableDetail {
  id: string;
  academicYear: string;
  departmentName: string;
  departmentCode: string;
  year: string;
  semester: number;
  section: string;
  roomNumber: string | null;
  status: string;
  workingDays: string[];
  version: number;
  effectiveFrom: string | null;
  slots: TimetableSlot[];
  entries: TimetableEntry[];
}

export default function StudentTimetable() {
  const { accessToken } = useAuth();
  const [timetable, setTimetable] = useState<TimetableDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    const fetchTimetable = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch("/timetables/student/active", {}, accessToken);
        if (res.success && res.data) {
          setTimetable(res.data);
        } else {
          setTimetable(null);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load active student timetable");
      } finally {
        setLoading(false);
      }
    };
    fetchTimetable();
  }, [accessToken]);

  // Grid builder cells helper
  const gridMap = useMemo(() => {
    if (!timetable) return {};
    const map: Record<string, Record<number, { entry: TimetableEntry; isMergedChild: boolean }>> = {};
    
    timetable.workingDays.forEach((day) => {
      map[day] = {};
    });

    timetable.entries.forEach((entry) => {
      if (!map[entry.dayOfWeek]) return;
      const sortedSeqs = entry.slots.map((s) => s.sequenceOrder).sort((a, b) => a - b);
      sortedSeqs.forEach((seq, idx) => {
        map[entry.dayOfWeek][seq] = {
          entry,
          isMergedChild: idx > 0,
        };
      });
    });

    return map;
  }, [timetable]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5 no-print">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <Calendar className="w-8 h-8 text-indigo-500" />
            My Weekly Timetable
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Displaying your officially published section timetable, timings, rooms, and assigned faculty members.
          </p>
        </div>
        {timetable && (
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-semibold flex items-center gap-2 border border-slate-200 dark:border-slate-700 transition"
          >
            <Printer className="w-4 h-4" /> Print Timetable
          </button>
        )}
      </div>

      {loading ? (
        <div className="h-96 flex flex-col items-center justify-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-2xl p-6">
          <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></span>
          <p className="text-sm font-semibold text-slate-500">Compiling your section timetable...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 p-5 rounded-2xl text-center space-y-3">
          <Info className="w-8 h-8 text-rose-500 mx-auto" />
          <h3 className="text-lg font-bold text-rose-800 dark:text-rose-400">Timetable Retrieval Failed</h3>
          <p className="text-sm text-rose-700 dark:text-rose-350">{error}</p>
        </div>
      ) : !timetable ? (
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-2xl text-center space-y-4 max-w-lg mx-auto">
          <Calendar className="w-12 h-12 text-slate-400 mx-auto" />
          <h3 className="text-xl font-bold text-slate-850 dark:text-slate-150">No Published Timetable</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            A timetable has not yet been published for your branch/semester group. Please contact your academic administrator.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-2xl shadow-sm overflow-hidden p-6 relative">
          
          {/* Printable timetable layout header */}
          <div className="text-center mb-6 border-b dark:border-slate-800 pb-4">
            <span className="text-xs font-bold bg-indigo-50 dark:bg-indigo-950/30 text-indigo-650 dark:text-indigo-400 px-3 py-1 rounded-full uppercase tracking-wider">
              {timetable.departmentCode} · Semester {timetable.semester}
            </span>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mt-3">
              Weekly Timetable schedule (Sec {timetable.section})
            </h2>
            <div className="flex justify-center flex-wrap gap-x-6 gap-y-2 mt-3 text-sm text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-slate-400" /> Room: {timetable.roomNumber || "N/A"}</span>
              <span>Academic Year: {timetable.academicYear}</span>
              {timetable.effectiveFrom && (
                <span>w.e.f: {new Date(timetable.effectiveFrom).toLocaleDateString()}</span>
              )}
              <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-850 rounded">Ver. {timetable.version}</span>
            </div>
          </div>

          {/* Timetable grid representation */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-slate-200 dark:border-slate-800 text-center text-sm min-w-[900px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50">
                  <th className="border border-slate-200 dark:border-slate-800 p-3 font-extrabold text-slate-700 dark:text-slate-300 w-24">
                    Day / Slot
                  </th>
                  {timetable.slots.map((slot) => (
                    <th
                      key={slot.id}
                      className="border border-slate-200 dark:border-slate-800 p-3 font-extrabold text-slate-700 dark:text-slate-300"
                    >
                      <div className="flex flex-col items-center">
                        <span className="text-xs uppercase tracking-wider text-slate-400">Period {slot.sequenceOrder}</span>
                        <span className="text-sm font-bold mt-0.5">
                          {slot.startTime.slice(0, 5)} - {slot.endTime.slice(0, 5)}
                        </span>
                        {slot.slotType !== "TEACHING" && (
                          <span className="mt-1 text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-400 font-extrabold">
                            {slot.slotType}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timetable.workingDays.map((day) => (
                  <tr key={day} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/10">
                    <td className="border border-slate-200 dark:border-slate-800 p-4 font-bold text-slate-700 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-800/20">
                      {day}
                    </td>
                    {timetable.slots.map((slot) => {
                      const state = gridMap[day]?.[slot.sequenceOrder];
                      if (state?.isMergedChild) return null; // skipped cell due to colspan merge

                      const isTeaching = slot.slotType === "TEACHING";

                      if (!isTeaching) {
                        return (
                          <td
                            key={slot.id}
                            className="border border-slate-200 dark:border-slate-800 p-3 bg-slate-100/50 dark:bg-slate-850/40 text-slate-400 font-extrabold select-none italic text-xs tracking-wider"
                          >
                            {slot.slotType}
                          </td>
                        );
                      }

                      const entry = state?.entry;
                      const colSpan = entry ? entry.slots.length : 1;

                      return (
                        <td
                          key={slot.id}
                          colSpan={colSpan}
                          className={`border border-slate-200 dark:border-slate-800 p-4 transition relative duration-200 ${
                            entry
                              ? "bg-indigo-50/20 dark:bg-indigo-950/10"
                              : ""
                          }`}
                        >
                          {entry ? (
                            <div className="flex flex-col items-center" title={entry.faculties && entry.faculties.length > 0 ? `Faculty: ${entry.faculties.map((f) => f.fullName).join(", ")}` : undefined}>
                              <span className="font-extrabold text-indigo-700 dark:text-indigo-400 text-sm tracking-wide">
                                {entry.subjectAbbreviation || entry.subjectCode}
                              </span>
                              <span className="text-[10px] text-slate-450 dark:text-slate-400 uppercase mt-0.5 font-semibold">
                                {entry.classType}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-350 dark:text-slate-700 italic text-xs">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footnote details */}
          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4">
              Subject Faculty Reference
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from(new Map(timetable.entries.map((e) => [e.subjectId, e])).values()).map((entry) => (
                <div
                  key={entry.subjectId}
                  className="p-3.5 bg-slate-50 dark:bg-slate-800/30 border border-slate-200/50 dark:border-slate-800/50 rounded-xl flex flex-col justify-between"
                >
                  <div>
                    <span className="inline-block px-2.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 font-extrabold text-xs">
                      {entry.subjectAbbreviation || entry.subjectCode}
                    </span>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-2 truncate">
                      {entry.subjectName}
                    </h4>
                  </div>
                  <div className="mt-3 flex items-center gap-2 border-t border-slate-200/40 dark:border-slate-800/40 pt-2 text-xs text-slate-500 dark:text-slate-400">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-semibold truncate">
                      {entry.faculties.map((f) => f.fullName).join(", ")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
