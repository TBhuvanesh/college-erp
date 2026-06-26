"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { 
  Check, 
  X, 
  Users, 
  BookOpen, 
  Sparkles, 
  Loader2, 
  AlertCircle, 
  Calendar, 
  Search, 
  Lock, 
  History,
  CheckCircle,
  XCircle,
  Filter
} from "lucide-react";

interface AssignmentDetail {
  id: string;
  facultyId: string;
  facultyName: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  departmentName: string;
  semester: number;
  academicYear: string;
  section: string;
  isActive: boolean;
}

interface RosterEntry {
  studentId: string;
  rollNumber: string;
  fullName: string;
  section: string;
  attendanceId: string | null;
  status: "present" | "absent" | null;
}

interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  section: string;
  attendanceDate: string;
  status: "present" | "absent";
}

interface GroupedSession {
  key: string;
  date: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  section: string;
  present: number;
  absent: number;
  total: number;
}

export default function FacultyAttendance() {
  const { accessToken } = useAuth();

  // Loading states
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Error/Success feedback states
  const [error, setError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState("");

  // Data states
  const [assignments, setAssignments] = useState<AssignmentDetail[]>([]);
  const [selectedSubjId, setSelectedSubjId] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD local format
  });
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [previousSessions, setPreviousSessions] = useState<GroupedSession[]>([]);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  };

  const todayStr = new Date().toLocaleDateString("en-CA");
  const isTodaySelected = selectedDate === todayStr;

  // 1. Fetch faculty subject assignments
  useEffect(() => {
    const fetchAssignments = async () => {
      setLoadingAssignments(true);
      setError(null);
      try {
        const res = await apiFetch("/attendance/my-assignments", {}, accessToken);
        if (res.success && res.data?.assignments) {
          const activeAssignments = res.data.assignments.filter((a: AssignmentDetail) => a.isActive);
          setAssignments(activeAssignments);
          
          if (activeAssignments.length > 0) {
            // Auto select the first assigned subject and section
            const first = activeAssignments[0];
            setSelectedSubjId(first.subjectId);
            setSelectedSection(first.section);
          }
        }
      } catch (err: any) {
        setError(err.message || "Failed to load subject assignments");
      } finally {
        setLoadingAssignments(false);
      }
    };

    fetchAssignments();
  }, [accessToken]);

  // Derive unique subjects for the Subject dropdown
  const uniqueSubjects = Array.from(
    new Map(assignments.map(a => [a.subjectId, { id: a.subjectId, name: a.subjectName, code: a.subjectCode }])).values()
  );

  // Derive sections taught for the selected subject
  const sectionsForSelectedSubject = assignments
    .filter(a => a.subjectId === selectedSubjId)
    .map(a => a.section);

  // Update selected section if it is no longer valid for the selected subject
  useEffect(() => {
    const timer = setTimeout(() => {
      if (selectedSubjId) {
        const sections = assignments.filter(a => a.subjectId === selectedSubjId).map(a => a.section);
        if (sections.length > 0 && !sections.includes(selectedSection)) {
          setSelectedSection(sections[0]);
        }
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [selectedSubjId, assignments, selectedSection]);

  // 2. Fetch roster for selected subject, section, and date
  const fetchRoster = useCallback(async () => {
    if (!selectedSubjId || !selectedSection || !selectedDate) return;
    setLoadingRoster(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams({
        subjectId: selectedSubjId,
        section: selectedSection,
        date: selectedDate
      });
      const res = await apiFetch(`/attendance/roster?${queryParams.toString()}`, {}, accessToken);
      if (res.success && res.data) {
        // Map backend present/absent to roster structure
        const fetchedRoster = (res.data.roster || []).map((r: any) => ({
          studentId: r.studentId,
          rollNumber: r.rollNumber,
          fullName: r.fullName,
          section: r.section,
          attendanceId: r.attendanceId,
          status: r.status // "present" | "absent" | null
        }));
        
        // If not marked yet and it is today, default to "present"
        const finalRoster = fetchedRoster.map((r: RosterEntry) => ({
          ...r,
          status: r.status === null && isTodaySelected ? ("present" as const) : r.status
        }));

        setRoster(finalRoster);
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch student roster");
      setRoster([]);
    } finally {
      setLoadingRoster(false);
    }
  }, [selectedSubjId, selectedSection, selectedDate, isTodaySelected, accessToken]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRoster();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchRoster]);

  // 3. Fetch past sessions marked by this faculty to display history
  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      // Fetch recent records marked by faculty (limit 100 for grouping)
      const res = await apiFetch("/attendance?limit=100", {}, accessToken);
      if (res.success && res.data?.records) {
        const records: AttendanceRecord[] = res.data.records;
        
        // Group individual student records into unique sessions (Date + Subject + Section)
        const groups: Record<string, GroupedSession> = {};
        
        records.forEach((rec) => {
          const key = `${rec.attendanceDate}_${rec.subjectId}_${rec.section}`;
          if (!groups[key]) {
            groups[key] = {
              key,
              date: rec.attendanceDate,
              subjectId: rec.subjectId,
              subjectCode: rec.subjectCode,
              subjectName: rec.subjectName,
              section: rec.section,
              present: 0,
              absent: 0,
              total: 0
            };
          }
          groups[key].total += 1;
          if (rec.status === "present") {
            groups[key].present += 1;
          } else {
            groups[key].absent += 1;
          }
        });

        // Convert object to array sorted by date descending
        const sortedSessions = Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));
        setPreviousSessions(sortedSessions);
      }
    } catch (err) {
      console.error("Failed to load attendance history", err);
    } finally {
      setLoadingHistory(false);
    }
  }, [accessToken]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchHistory();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchHistory]);

  const handleStatusChange = (studId: string, newStatus: "present" | "absent") => {
    if (!isTodaySelected) return; // Prevent modifying previous days
    setRoster(prev =>
      prev.map(item => (item.studentId === studId ? { ...item, status: newStatus } : item))
    );
  };

  const handleMarkAllPresent = () => {
    if (!isTodaySelected) return;
    setRoster(prev => prev.map(item => ({ ...item, status: "present" })));
  };

  const handleMarkAllAbsent = () => {
    if (!isTodaySelected) return;
    setRoster(prev => prev.map(item => ({ ...item, status: "absent" })));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubjId || !selectedSection || !isTodaySelected) return;

    // Validate that all students have a selected status
    const unmarked = roster.some(r => r.status === null);
    if (unmarked) {
      setError("Please mark attendance status for all students before submitting");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const recordsToPost = roster.map(r => ({
        studentId: r.studentId,
        status: r.status as "present" | "absent"
      }));

      const body = {
        subjectId: selectedSubjId,
        section: selectedSection,
        date: selectedDate,
        records: recordsToPost
      };

      const res = await apiFetch("/attendance/sessions", {
        method: "POST",
        body: JSON.stringify(body)
      }, accessToken);

      if (res.success) {
        triggerToast("Daily attendance register saved successfully!");
        fetchRoster();
        fetchHistory();
      }
    } catch (err: any) {
      setError(err.message || "Failed to submit attendance roll register");
    } finally {
      setSubmitting(false);
    }
  };

  const loadPastSession = (session: GroupedSession) => {
    setSelectedSubjId(session.subjectId);
    setSelectedSection(session.section);
    setSelectedDate(session.date);
    triggerToast(`Loaded session logs for ${session.date}`);
  };

  // Roster filtering based on search
  const filteredRoster = roster.filter(student =>
    student.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.rollNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Statistics counters
  const totalRoster = roster.length;
  const presentCount = roster.filter(r => r.status === "present").length;
  const absentCount = roster.filter(r => r.status === "absent").length;
  const unmarkedCount = roster.filter(r => r.status === null).length;

  if (loadingAssignments) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
        <Loader2 className="animate-spin text-blue-500 mb-3" size={30} />
        <span className="font-mono text-xs">Loading faculty workload mappings...</span>
      </div>
    );
  }

  return (
    <div className="relative">
      
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-emerald-600 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-xl shadow-emerald-600/20 border border-emerald-400/20 animate-fade-in">
          <Sparkles size={14} className="animate-pulse" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header and Selectors */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="font-display font-bold text-2xl text-white">Attendance Register</h2>
          <p className="text-xs text-neutral-400 mt-1">
            Record class attendance rolls. Current day edits are submitted to databases instantly.
          </p>
        </div>

        {/* Date Selector */}
        <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded px-2.5 text-xs text-white self-start">
          <Calendar size={12} className="text-blue-400" />
          <span className="text-neutral-400">Date:</span>
          <input
            type="date"
            max={todayStr}
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-transparent text-white cursor-pointer py-2 focus:outline-none font-bold"
          />
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold rounded-lg mb-6 flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid splits content: Roster (Left 70%) / Chronological History (Right 30%) */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        
        {/* Roster column */}
        <div className="flex-1 w-full space-y-6">
          
          {/* Class Selectors & Search bar */}
          <div className="glass-card border border-neutral-800 rounded-xl p-4 flex flex-col md:flex-row gap-3">
            {/* Subject Select */}
            <div className="flex-1 flex items-center gap-2 bg-neutral-950 border border-neutral-850 rounded px-3 text-xs text-white">
              <BookOpen size={12} className="text-neutral-500 shrink-0" />
              <span className="text-neutral-500 whitespace-nowrap">Subject:</span>
              {uniqueSubjects.length > 0 ? (
                <select
                  value={selectedSubjId}
                  onChange={(e) => setSelectedSubjId(e.target.value)}
                  className="bg-transparent text-white cursor-pointer py-2.5 flex-1 focus:outline-none font-semibold"
                >
                  {uniqueSubjects.map(sub => (
                    <option key={sub.id} value={sub.id}>
                      {sub.code}: {sub.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="py-2.5 text-neutral-500 font-mono">No Subject Assigned</span>
              )}
            </div>

            {/* Section Select */}
            <div className="w-full md:w-40 flex items-center gap-2 bg-neutral-950 border border-neutral-850 rounded px-3 text-xs text-white">
              <Filter size={12} className="text-neutral-500 shrink-0" />
              <span className="text-neutral-500">Sec:</span>
              {sectionsForSelectedSubject.length > 0 ? (
                <select
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="bg-transparent text-white cursor-pointer py-2.5 flex-1 focus:outline-none font-bold"
                >
                  {sectionsForSelectedSubject.map(sec => (
                    <option key={sec} value={sec}>
                      Section {sec}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="py-2.5 text-neutral-500 font-mono">N/A</span>
              )}
            </div>

            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 w-4 h-4 text-neutral-500" />
              <input
                type="text"
                placeholder="Search by name or roll number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-xs bg-neutral-950 border border-neutral-850 rounded text-white focus:outline-none focus:border-neutral-700"
              />
            </div>
          </div>

          {/* Roster Controls and locked state indicator */}
          <div className="glass-card border border-neutral-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 bg-neutral-900/40">
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <Users size={14} className="text-blue-400" />
              <span>Enrolled Students: <strong className="text-white">{totalRoster}</strong></span>
              {!isTodaySelected && (
                <span className="ml-2 flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/25 rounded px-2 py-0.5 text-[10px] font-semibold">
                  <Lock size={10} />
                  <span>View Only (Past Date)</span>
                </span>
              )}
            </div>
            
            {isTodaySelected && totalRoster > 0 && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleMarkAllPresent}
                  className="flex-1 sm:flex-none px-3 py-1.5 rounded border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold text-xs cursor-pointer transition"
                >
                  All Present
                </button>
                <button
                  type="button"
                  onClick={handleMarkAllAbsent}
                  className="flex-1 sm:flex-none px-3 py-1.5 rounded border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-xs cursor-pointer transition"
                >
                  All Absent
                </button>
              </div>
            )}
          </div>

          {/* Student roster roll entries list */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              {loadingRoster ? (
                <div className="text-center py-16 text-neutral-500">
                  <Loader2 className="animate-spin text-blue-500 mx-auto mb-2" size={24} />
                  <span className="font-mono text-xs">Pulling class roster from archives...</span>
                </div>
              ) : filteredRoster.length > 0 ? (
                filteredRoster.map(student => (
                  <div 
                    key={student.studentId} 
                    className="glass-card border border-neutral-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-neutral-700 transition"
                  >
                    {/* Student Info */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-neutral-850 border border-neutral-800 flex items-center justify-center font-bold text-blue-400 shrink-0">
                        {student.fullName.charAt(0)}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white leading-tight">{student.fullName}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-neutral-500 font-mono select-all" title="Student ID">
                            ID: {student.studentId.substring(0, 8)}...
                          </span>
                          <span className="text-neutral-700">•</span>
                          <span className="text-[10px] text-neutral-400 font-mono font-semibold">
                            Roll: {student.rollNumber}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Roster Marking Controls */}
                    <div className="flex items-center gap-2 self-start sm:self-center">
                      {isTodaySelected ? (
                        <>
                          {/* Present Button */}
                          <button
                            type="button"
                            onClick={() => handleStatusChange(student.studentId, "present")}
                            className={`px-4 py-2 rounded-lg border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                              student.status === "present"
                                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400 shadow-md shadow-emerald-500/5"
                                : "bg-neutral-950 border-neutral-900 text-neutral-500 hover:text-neutral-400"
                            }`}
                          >
                            <Check size={13} />
                            <span>Present</span>
                          </button>

                          {/* Absent Button */}
                          <button
                            type="button"
                            onClick={() => handleStatusChange(student.studentId, "absent")}
                            className={`px-4 py-2 rounded-lg border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                              student.status === "absent"
                                ? "bg-rose-500/20 border-rose-500/40 text-rose-400 shadow-md shadow-rose-500/5"
                                : "bg-neutral-950 border-neutral-900 text-neutral-500 hover:text-neutral-400"
                            }`}
                          >
                            <X size={13} />
                            <span>Absent</span>
                          </button>
                        </>
                      ) : (
                        // View Only Mode (Render Status Badges)
                        <div className="flex items-center">
                          {student.status === "present" ? (
                            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3.5 py-1.5">
                              <CheckCircle size={12} />
                              <span>Present</span>
                            </span>
                          ) : student.status === "absent" ? (
                            <span className="flex items-center gap-1.5 text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3.5 py-1.5">
                              <XCircle size={12} />
                              <span>Absent</span>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-xs font-bold text-neutral-500 bg-neutral-950 border border-neutral-900 rounded-lg px-3.5 py-1.5 font-mono">
                              No Record
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center glass-card border border-neutral-800 text-neutral-500 font-mono text-xs">
                  {searchTerm ? "No students match your query." : "No students found. Verify subject assignment parameters."}
                </div>
              )}
            </div>

            {/* Sticky/Bottom Submission Stats Panel */}
            {totalRoster > 0 && (
              <div className="glass-card border border-neutral-850 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 bg-neutral-950/60 sticky bottom-20 lg:bottom-4 z-15 shadow-2xl">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-neutral-400">
                  <span className="flex items-center gap-1">
                    <CheckCircle size={14} className="text-emerald-400" />
                    <span>Present: <strong className="text-white font-mono">{presentCount}</strong></span>
                  </span>
                  <span className="flex items-center gap-1">
                    <XCircle size={14} className="text-rose-400" />
                    <span>Absent: <strong className="text-white font-mono">{absentCount}</strong></span>
                  </span>
                  {unmarkedCount > 0 && (
                    <span className="flex items-center gap-1">
                      <AlertCircle size={14} className="text-amber-500" />
                      <span>Unmarked: <strong className="text-amber-500 font-mono">{unmarkedCount}</strong></span>
                    </span>
                  )}
                </div>

                {isTodaySelected ? (
                  <button
                    type="submit"
                    disabled={submitting || unmarkedCount > 0}
                    className="w-full sm:w-auto px-6 py-2.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold text-xs shadow-lg shadow-blue-600/25 cursor-pointer disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5"
                  >
                    {submitting && <Loader2 size={12} className="animate-spin" />}
                    <span>Submit Attendance Register</span>
                  </button>
                ) : (
                  <div className="text-[10px] text-amber-500 font-mono flex items-center gap-1 font-semibold">
                    <Lock size={12} />
                    <span>Correction window closed for past sessions</span>
                  </div>
                )}
              </div>
            )}
          </form>
        </div>

        {/* Previous Sessions (Right 30%) */}
        <div className="w-full lg:w-80 glass-card border border-neutral-800 rounded-xl p-4 shrink-0 space-y-4">
          <div className="flex items-center gap-1.5 border-b border-neutral-800 pb-2 text-white">
            <History size={16} className="text-blue-400" />
            <h3 className="font-display font-bold text-sm">Previous Sessions</h3>
          </div>

          <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
            {loadingHistory ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="animate-spin text-blue-500" size={20} />
              </div>
            ) : previousSessions.length > 0 ? (
              previousSessions.map((session) => {
                const isSelected = selectedDate === session.date && 
                                   selectedSubjId === session.subjectId && 
                                   selectedSection === session.section;
                return (
                  <div
                    key={session.key}
                    onClick={() => loadPastSession(session)}
                    className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                      isSelected 
                        ? "bg-blue-600/10 border-blue-500/40" 
                        : "bg-neutral-950/40 border-neutral-900 hover:border-neutral-800 hover:bg-neutral-950"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-mono text-neutral-400">{session.date}</span>
                      <span className="text-[9px] bg-neutral-800 border border-neutral-700 text-neutral-300 font-bold px-1.5 py-0.5 rounded uppercase font-mono">
                        Sec {session.section}
                      </span>
                    </div>
                    
                    <h4 className="text-xs font-bold text-white leading-tight truncate" title={session.subjectName}>
                      {session.subjectCode}: {session.subjectName}
                    </h4>

                    <div className="flex items-center gap-3 mt-2 text-[9px] text-neutral-500 font-mono">
                      <span className="text-emerald-400">P: {session.present}</span>
                      <span>•</span>
                      <span className="text-rose-400">A: {session.absent}</span>
                      <span>•</span>
                      <span>Total: {session.total}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-[10px] text-neutral-500 font-mono italic text-center py-6">
                No previous sessions logged by this profile.
              </p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
