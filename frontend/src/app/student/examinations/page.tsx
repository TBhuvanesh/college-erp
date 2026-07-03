"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { 
  Calendar, 
  Clock, 
  MapPin, 
  BookOpen, 
  Filter, 
  Loader2, 
  AlertCircle,
  FileText,
  CheckCircle2,
  ListFilter
} from "lucide-react";

interface ExamSummary {
  id: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  facultyName: string;
  semester: number;
  section: string;
  examType: string;
  examDate: string;
  startTime: string;
  endTime: string;
  maximumMarks: number;
  status: string;
}

export default function StudentExaminations() {
  const { accessToken } = useAuth();

  // Tab state: "upcoming" | "all" | "completed"
  const [activeTab, setActiveTab] = useState<"upcoming" | "all" | "completed">("upcoming");
  
  // Data lists
  const [timetable, setTimetable] = useState<ExamSummary[]>([]);
  const [upcoming, setUpcoming] = useState<ExamSummary[]>([]);
  
  // Loading & error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [subjectFilter, setSubjectFilter] = useState("ALL");
  const [semesterFilter, setSemesterFilter] = useState("ALL");

  const fetchData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      // Fetch both timetable and upcoming exams
      const [timetableRes, upcomingRes] = await Promise.all([
        apiFetch("/examinations/timetable", {}, accessToken),
        apiFetch("/examinations/upcoming", {}, accessToken)
      ]);

      if (timetableRes.success) {
        setTimetable(timetableRes.data?.exams || []);
      }
      if (upcomingRes.success) {
        setUpcoming(upcomingRes.data?.exams || []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch examination schedules.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchData]);

  // Derive available filter subjects from the timetable list
  const uniqueSubjects = Array.from(
    new Map(timetable.map(e => [e.subjectId, { id: e.subjectId, code: e.subjectCode, name: e.subjectName }])).values()
  );

  // Derive unique semesters from the timetable list (though typically it's the student's current semester)
  const uniqueSemesters = Array.from(new Set(timetable.map(e => e.semester))).sort();

  // Filter lists based on selected criteria
  const getFilteredExams = () => {
    let baseList: ExamSummary[] = [];
    if (activeTab === "upcoming") {
      baseList = upcoming;
    } else if (activeTab === "completed") {
      baseList = timetable.filter(e => e.status === "Completed");
    } else {
      baseList = timetable; // Shows all including cancelled and scheduled
    }

    return baseList.filter(e => {
      const matchSubject = subjectFilter === "ALL" || e.subjectId === subjectFilter;
      const matchSemester = semesterFilter === "ALL" || e.semester.toString() === semesterFilter;
      return matchSubject && matchSemester;
    });
  };

  const filteredExams = getFilteredExams();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Scheduled":
        return "dark:bg-blue-500/10 bg-blue-50 dark:text-blue-400 text-blue-700 dark:border-blue-500/20 border-blue-200";
      case "Ongoing":
        return "dark:bg-emerald-500/10 bg-emerald-50 dark:text-emerald-400 text-emerald-700 dark:border-emerald-500/20 border-emerald-200 animate-pulse";
      case "Completed":
        return "dark:bg-neutral-500/10 bg-neutral-100 dark:text-neutral-400 text-text-secondary dark:border-neutral-500/20 border-border-subtle";
      case "Cancelled":
        return "dark:bg-rose-500/10 bg-rose-50 dark:text-rose-400 text-rose-700 dark:border-rose-500/20 border-rose-200";
      default:
        return "dark:bg-neutral-500/10 bg-neutral-100 dark:text-neutral-400 text-text-secondary dark:border-neutral-500/20 border-border-subtle";
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div>
        <h2 className="font-display font-bold text-2xl dark:text-white text-text-primary">Examinations Desk</h2>
        <p className="text-xs dark:text-neutral-400 text-text-secondary mt-1">
          Review upcoming schedules, seat allocations placeholder details, and verify mid-term & end-semester calendars.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold rounded-lg flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs Menu */}
      <div className="flex border-b dark:border-neutral-800 border-border-subtle gap-4">
        <button
          onClick={() => setActiveTab("upcoming")}
          className={`pb-3 text-xs font-bold transition-all relative cursor-pointer ${
            activeTab === "upcoming" ? "text-blue-500 font-semibold" : "dark:text-neutral-400 text-text-secondary dark:hover:text-white hover:text-text-primary"
          }`}
        >
          Upcoming Examinations
          {activeTab === "upcoming" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full"></span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("all")}
          className={`pb-3 text-xs font-bold transition-all relative cursor-pointer ${
            activeTab === "all" ? "text-blue-500 font-semibold" : "dark:text-neutral-400 text-text-secondary dark:hover:text-white hover:text-text-primary"
          }`}
        >
          Examination Timetable
          {activeTab === "all" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full"></span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("completed")}
          className={`pb-3 text-xs font-bold transition-all relative cursor-pointer ${
            activeTab === "completed" ? "text-blue-500 font-semibold" : "dark:text-neutral-400 text-text-secondary dark:hover:text-white hover:text-text-primary"
          }`}
        >
          Completed Examinations
          {activeTab === "completed" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full"></span>
          )}
        </button>
      </div>

      {/* Filters Area */}
      <div className="glass-card border dark:border-neutral-800 border-border-subtle rounded-xl p-4 flex flex-col sm:flex-row gap-3">
        {/* Subject Filter */}
        <div className="flex-1 flex items-center gap-2 dark:bg-neutral-950 bg-surface border dark:border-neutral-850 border-border-subtle rounded px-3 text-xs dark:text-white text-text-primary">
          <BookOpen size={12} className="dark:text-neutral-500 text-text-muted shrink-0" />
          <span className="dark:text-neutral-500 text-text-muted whitespace-nowrap">Subject:</span>
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="bg-transparent dark:text-white text-text-primary cursor-pointer py-2.5 flex-1 focus:outline-none font-semibold"
          >
            <option value="ALL">All Subjects</option>
            {uniqueSubjects.map(sub => (
              <option key={sub.id} value={sub.id}>
                {sub.code}: {sub.name}
              </option>
            ))}
          </select>
        </div>

        {/* Semester Filter */}
        <div className="w-full sm:w-48 flex items-center gap-2 dark:bg-neutral-950 bg-surface border dark:border-neutral-850 border-border-subtle rounded px-3 text-xs dark:text-white text-text-primary">
          <ListFilter size={12} className="dark:text-neutral-500 text-text-muted shrink-0" />
          <span className="dark:text-neutral-500 text-text-muted">Sem:</span>
          <select
            value={semesterFilter}
            onChange={(e) => setSemesterFilter(e.target.value)}
            className="bg-transparent dark:text-white text-text-primary cursor-pointer py-2.5 flex-1 focus:outline-none font-bold"
          >
            <option value="ALL">All Semesters</option>
            {uniqueSemesters.map(sem => (
              <option key={sem} value={sem.toString()}>
                Semester {sem}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content View (Table on desktop, Cards on mobile) */}
      <div>
        {loading ? (
          <div className="text-center py-20 dark:text-neutral-400 text-text-secondary">
            <Loader2 className="animate-spin text-blue-500 mx-auto mb-3" size={30} />
            <span className="font-mono text-xs">Accessing examination records database...</span>
          </div>
        ) : filteredExams.length > 0 ? (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block glass-card border dark:border-neutral-800 border-border-subtle rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="dark:bg-neutral-900/50 bg-surface border-b dark:border-neutral-800 border-border-subtle dark:text-neutral-400 text-text-secondary font-semibold">
                    <th className="px-4 py-3">Subject</th>
                    <th className="px-4 py-3 font-mono">Exam Type</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Maximum Marks</th>
                    <th className="px-4 py-3">Venue</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-neutral-900 divide-border-subtle dark:text-neutral-300 text-text-secondary">
                  {filteredExams.map((exam) => (
                    <tr key={exam.id} className="dark:hover:bg-neutral-900/30 hover:bg-surface-hover transition">
                      <td className="px-4 py-3">
                        <span className="font-semibold dark:text-white text-text-primary block">{exam.subjectName}</span>
                        <span className="text-[10px] dark:text-neutral-500 text-text-muted font-mono">{exam.subjectCode}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[10px] font-bold dark:text-neutral-200 text-text-primary">
                        {exam.examType}
                      </td>
                      <td className="px-4 py-3 font-mono dark:text-neutral-300 text-text-secondary">
                        {new Date(exam.examDate).toLocaleDateString("en-US", {
                          weekday: "short",
                          year: "numeric",
                          month: "short",
                          day: "numeric"
                        })}
                      </td>
                      <td className="px-4 py-3 font-mono dark:text-neutral-400 text-text-secondary">
                        {exam.startTime} - {exam.endTime}
                      </td>
                      <td className="px-4 py-3 font-mono dark:text-neutral-400 text-text-secondary text-center">
                        {exam.maximumMarks}
                      </td>
                      <td className="px-4 py-3 dark:text-neutral-400 text-text-secondary">
                        <span className="flex items-center gap-1">
                          <MapPin size={12} className="dark:text-neutral-500 text-text-muted shrink-0" />
                          <span>Main Campus Block</span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border capitalize ${getStatusBadge(exam.status)}`}>
                          {exam.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="block md:hidden space-y-3">
              {filteredExams.map((exam) => (
                <div key={exam.id} className="glass-card border dark:border-neutral-800 border-border-subtle rounded-xl p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-bold dark:text-white text-text-primary leading-tight">{exam.subjectName}</h4>
                      <span className="text-[10px] dark:text-neutral-500 text-text-muted font-mono mt-0.5 block">{exam.subjectCode}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border capitalize shrink-0 ${getStatusBadge(exam.status)}`}>
                      {exam.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-[10px] dark:text-neutral-300 text-text-secondary font-mono pt-2 border-t dark:border-neutral-900 border-border-subtle">
                    <div>
                      <span className="dark:text-neutral-500 text-text-muted block text-[9px] uppercase font-bold tracking-wider mb-0.5">Exam Type</span>
                      <span className="font-semibold dark:text-neutral-200 text-text-primary">{exam.examType}</span>
                    </div>
                    <div>
                      <span className="dark:text-neutral-500 text-text-muted block text-[9px] uppercase font-bold tracking-wider mb-0.5">Max Marks</span>
                      <span>{exam.maximumMarks} Marks</span>
                    </div>
                    <div>
                      <span className="dark:text-neutral-500 text-text-muted block text-[9px] uppercase font-bold tracking-wider mb-0.5">Date</span>
                      <span>{exam.examDate}</span>
                    </div>
                    <div>
                      <span className="dark:text-neutral-500 text-text-muted block text-[9px] uppercase font-bold tracking-wider mb-0.5">Time Slot</span>
                      <span>{exam.startTime} - {exam.endTime}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="dark:text-neutral-500 text-text-muted block text-[9px] uppercase font-bold tracking-wider mb-0.5">Venue Location</span>
                      <span className="flex items-center gap-1 font-sans dark:text-neutral-400 text-text-secondary">
                        <MapPin size={10} className="dark:text-neutral-500 text-text-muted shrink-0" />
                        <span>Main Campus Block (Placeholder)</span>
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-16 glass-card border dark:border-neutral-800 border-border-subtle rounded-xl dark:text-neutral-500 text-text-muted font-mono text-xs flex flex-col items-center justify-center gap-2">
            <FileText size={20} className="dark:text-neutral-600 text-text-muted" />
            <span>
              {subjectFilter !== "ALL" || semesterFilter !== "ALL"
                ? "No examinations match the selected filter parameters."
                : activeTab === "upcoming"
                ? "No upcoming examinations scheduled."
                : activeTab === "completed"
                ? "No completed examinations recorded."
                : "No examination schedules found in timetable."}
            </span>
          </div>
        )}
      </div>

    </div>
  );
}
