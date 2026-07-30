"use client";
import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Info,
  BookOpen,
  Printer
} from "lucide-react";

interface ScheduleSlot {
  id: string;
  startTime: string;
  endTime: string;
  sequenceOrder: number;
  slotType: string;
}

interface ScheduleEntry {
  id: string;
  timetableId: string;
  academicYear: string;
  departmentCode: string;
  semester: number;
  section: string;
  roomNumber: string | null;
  dayOfWeek: string;
  classType: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  subjectAbbreviation: string | null;
  slots: ScheduleSlot[];
}

interface FacultySchedule {
  faculty: {
    id: string;
    fullName: string;
    employeeNumber: string;
  };
  schedule: Record<string, ScheduleEntry[]>;
}

export default function FacultyTimetable() {
  const { accessToken } = useAuth();
  const [scheduleData, setScheduleData] = useState<FacultySchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    const fetchSchedule = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch("/timetables/faculty/schedule", {}, accessToken);
        if (res.success && res.data) {
          setScheduleData(res.data);
        } else {
          setScheduleData(null);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load faculty weekly schedule");
      } finally {
        setLoading(false);
      }
    };
    fetchSchedule();
  }, [accessToken]);

  const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5 no-print">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <Calendar className="w-8 h-8 text-sky-500" />
            My Lecture Schedule
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            View your combined weekly workload and room allocations across all branches and sections.
          </p>
        </div>
        {scheduleData && (
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-semibold flex items-center gap-2 border border-slate-200 dark:border-slate-700 transition"
          >
            <Printer className="w-4 h-4" /> Print Workload
          </button>
        )}
      </div>

      {loading ? (
        <div className="h-96 flex flex-col items-center justify-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-2xl p-6">
          <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></span>
          <p className="text-sm font-semibold text-slate-500">Compiling teaching workload schedule...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 p-5 rounded-2xl text-center space-y-3">
          <Info className="w-8 h-8 text-rose-500 mx-auto" />
          <h3 className="text-lg font-bold text-rose-800 dark:text-rose-400">Schedule Compilation Failed</h3>
          <p className="text-sm text-rose-700 dark:text-rose-350">{error}</p>
        </div>
      ) : !scheduleData || Object.values(scheduleData.schedule).flat().length === 0 ? (
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-2xl text-center space-y-4 max-w-lg mx-auto">
          <Calendar className="w-12 h-12 text-slate-400 mx-auto" />
          <h3 className="text-xl font-bold text-slate-850 dark:text-slate-150">No Assigned Workload</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            You do not have any teaching sessions mapped in any published timetables for this semester.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Faculty Header */}
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex items-center justify-between">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-350">
              Instructor: {scheduleData.faculty.fullName} ({scheduleData.faculty.employeeNumber})
            </span>
            <span className="text-xs bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-400 px-3 py-1 rounded-full font-bold uppercase">
              Total Lectures: {Object.values(scheduleData.schedule).flat().length} / week
            </span>
          </div>

          {/* Weekly Schedule list grouped by day */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 schedule-list">
            {daysOfWeek.map((day) => {
              const entries = scheduleData.schedule[day] || [];
              const sorted = [...entries].sort(
                (a, b) => (a.slots[0]?.startTime || "").localeCompare(b.slots[0]?.startTime || "")
              );

              return (
                <div
                  key={day}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-2xl p-5 shadow-sm flex flex-col min-h-[300px]"
                >
                  <h3 className="text-lg font-extrabold text-slate-800 dark:text-slate-250 border-b dark:border-slate-800 pb-3 mb-4 flex items-center justify-between">
                    <span>{day}</span>
                    <span className="text-xs text-slate-400">{sorted.length} Session{sorted.length !== 1 ? "s" : ""}</span>
                  </h3>

                  {sorted.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center border border-dashed border-slate-200 dark:border-slate-850 rounded-xl p-4">
                      <p className="text-xs text-slate-400 italic">No scheduled lectures today</p>
                    </div>
                  ) : (
                    <div className="space-y-4 flex-1">
                      {sorted.map((entry) => {
                        const start = entry.slots[0]?.startTime.slice(0, 5) || "";
                        const end = entry.slots[entry.slots.length - 1]?.endTime.slice(0, 5) || "";

                        return (
                          <div
                            key={entry.id}
                            className="p-4 bg-slate-50 dark:bg-slate-850/30 border border-slate-200 dark:border-slate-800/80 rounded-xl relative hover:border-slate-350 dark:hover:border-slate-700 transition"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-sky-100 text-sky-850 dark:bg-sky-950/40 dark:text-sky-400 font-extrabold">
                                {entry.subjectAbbreviation || entry.subjectCode}
                              </span>
                              <span className="text-[10px] text-slate-400 uppercase font-semibold">
                                {entry.classType}
                              </span>
                            </div>

                            <h4 className="font-extrabold text-slate-850 dark:text-slate-200 text-sm mt-2 truncate">
                              {entry.subjectName}
                            </h4>

                            <div className="mt-4 space-y-2 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200/50 dark:border-slate-800/50 pt-3">
                              <div className="flex items-center gap-2">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                <span className="font-semibold">{start} - {end}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Users className="w-3.5 h-3.5 text-slate-400" />
                                <span>{entry.departmentCode} Sem {entry.semester}-{entry.section}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                <span>Room No: {entry.roomNumber || "N/A"}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
