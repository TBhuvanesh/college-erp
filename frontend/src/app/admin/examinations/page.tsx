"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { 
  Plus, 
  Edit, 
  Trash2, 
  Calendar, 
  Clock, 
  BookOpen, 
  Filter, 
  Loader2, 
  AlertCircle,
  Sparkles,
  X,
  Play,
  CheckSquare,
  Lock,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  GraduationCap,
  Layers,
  Send,
  Building2,
  FileCheck,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  FileText
} from "lucide-react";

interface Department {
  id: string;
  name: string;
  code: string;
}

interface SubjectCard {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  subjectType: string;
  status: 'Pending' | 'Scheduled';
  examId?: string;
  examDate?: string;
  startTime?: string;
  endTime?: string;
  maximumMarks?: number;
  venue?: string;
  instructions?: string;
  sectionSchedules?: Array<{
    section: string;
    examId: string;
    examDate: string;
    startTime: string;
    endTime: string;
    maximumMarks: number;
    venue?: string;
    instructions?: string;
  }>;
}

interface SessionSummary {
  id: string;
  name: string;
  academicYear: string;
  regulation: string;
  departmentId: string;
  departmentName?: string;
  departmentCode?: string;
  year: string;
  semester: number;
  examType: string;
  sections: string[];
  subjectIds: string[];
  status: 'Draft' | 'Scheduling' | 'Ready for Review' | 'Published' | 'Archived';
  scheduledSubjectCount: number;
  totalSubjectCount: number;
  createdAt: string;
  updatedAt: string;
}

interface SessionDetail extends SessionSummary {
  subjects: SubjectCard[];
  warnings?: string[];
}

export default function AdminExaminations() {
  const { accessToken } = useAuth();

  // Active View Mode: 'sessions_list' | 'builder_workspace'
  const [viewMode, setViewMode] = useState<'sessions_list' | 'builder_workspace'>('sessions_list');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<SessionDetail | null>(null);

  // Data lists
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  // Filters state
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit] = useState(12);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Loading & error states
  const [loadingList, setLoadingList] = useState(true);
  const [loadingSession, setLoadingSession] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState("");

  // Stage 1 Create Session Drawer state
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formAcademicYear, setFormAcademicYear] = useState("2026-27");
  const [formRegulation, setFormRegulation] = useState("R22");
  const [formDepartmentId, setFormDepartmentId] = useState("");
  const [formYear, setFormYear] = useState("III");
  const [formSemester, setFormSemester] = useState("I");
  const [formExamType, setFormExamType] = useState("Mid-1");
  const [formSections, setFormSections] = useState<string[]>(["A", "B"]);
  const [availableSubjects, setAvailableSubjects] = useState<any[]>([]);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  // Stage 2 Subject Schedule Drawer state
  const [scheduleDrawerOpen, setScheduleDrawerOpen] = useState(false);
  const [editingSubjectCard, setEditingSubjectCard] = useState<SubjectCard | null>(null);
  
  // Single Theory Schedule Form state
  const [schedExamDate, setSchedExamDate] = useState("");
  const [schedStartTime, setSchedStartTime] = useState("09:30");
  const [schedEndTime, setSchedEndTime] = useState("11:00");
  const [schedMaxMarks, setSchedMaxMarks] = useState("50");
  const [schedVenue, setSchedVenue] = useState("");
  const [schedInstructions, setSchedInstructions] = useState("");
  const [schedScope, setSchedScope] = useState("Entire Batch");

  // Per-Section Lab Schedule Form state
  const [labSectionSchedules, setLabSectionSchedules] = useState<Record<string, {
    examDate: string;
    startTime: string;
    endTime: string;
    maximumMarks: string;
    venue: string;
    instructions: string;
  }>>({});

  // Publish Modal state
  const [publishModalOpen, setPublishModalOpen] = useState(false);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3500);
  };

  // Fetch departments & initial dependencies
  useEffect(() => {
    if (!accessToken) return;
    const fetchDependencies = async () => {
      try {
        const res = await apiFetch("/departments?limit=100", {}, accessToken);
        if (res.success && res.data?.departments) {
          setDepartments(res.data.departments);
        }
      } catch (err) {
        console.error("Failed to load departments", err);
      }
    };
    fetchDependencies();
  }, [accessToken]);

  // Fetch Sessions List
  const fetchSessions = useCallback(async () => {
    if (!accessToken) return;
    setLoadingList(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams();
      queryParams.set("page", page.toString());
      queryParams.set("limit", limit.toString());
      if (deptFilter !== "ALL") queryParams.set("departmentId", deptFilter);
      if (statusFilter !== "ALL") queryParams.set("status", statusFilter);

      const res = await apiFetch(`/examinations/sessions?${queryParams.toString()}`, {}, accessToken);
      if (res.success && res.data) {
        setSessions(res.data.sessions || []);
        setTotalPages(res.data.pagination?.totalPages || 1);
        setTotalRecords(res.data.pagination?.total || 0);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load examination sessions");
    } finally {
      setLoadingList(false);
    }
  }, [accessToken, page, limit, deptFilter, statusFilter]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Fetch Session Detail for Stage 2 Schedule Builder
  const fetchSessionDetail = useCallback(async (sessionId: string) => {
    if (!accessToken) return;
    setLoadingSession(true);
    try {
      const res = await apiFetch(`/examinations/sessions/${sessionId}`, {}, accessToken);
      if (res.success && res.data?.session) {
        setActiveSession(res.data.session);
      }
    } catch (err: any) {
      triggerToast(err.message || "Failed to load session details");
    } finally {
      setLoadingSession(false);
    }
  }, [accessToken]);

  const openBuilderWorkspace = (session: SessionSummary) => {
    setSelectedSessionId(session.id);
    setViewMode('builder_workspace');
    fetchSessionDetail(session.id);
  };

  // Stage 1: Fetch subjects dynamically based on Dept, Regulation, Year, Semester
  useEffect(() => {
    if (!accessToken || !createDrawerOpen || !formDepartmentId || !formYear || !formSemester) {
      setAvailableSubjects([]);
      return;
    }

    const yearIdx = ["I", "II", "III", "IV"].indexOf(formYear);
    const semIdx = ["I", "II"].indexOf(formSemester);
    if (yearIdx === -1 || semIdx === -1) return;
    const semesterNum = yearIdx * 2 + semIdx + 1;

    const loadMappedSubjects = async () => {
      setLoadingSubjects(true);
      try {
        const res = await apiFetch(
          `/subjects?limit=200&departmentId=${formDepartmentId}&regulation=${formRegulation}&year=${formYear}&semester=${semesterNum}`,
          {},
          accessToken
        );
        if (res.success && res.data?.subjects) {
          setAvailableSubjects(res.data.subjects);
          // Default select all mapped subjects
          setSelectedSubjectIds(res.data.subjects.map((s: any) => s.id));
        } else {
          setAvailableSubjects([]);
          setSelectedSubjectIds([]);
        }
      } catch (err) {
        console.warn("Failed to load curriculum subjects for session creation", err);
      } finally {
        setLoadingSubjects(false);
      }
    };

    loadMappedSubjects();
  }, [accessToken, createDrawerOpen, formDepartmentId, formRegulation, formYear, formSemester]);

  // Handle Stage 1 Session Creation
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formDepartmentId || selectedSubjectIds.length === 0) {
      setError("Please fill in all required fields and select at least one subject.");
      return;
    }
    setError(null);
    setSubmitting(true);

    const yearIdx = ["I", "II", "III", "IV"].indexOf(formYear);
    const semIdx = ["I", "II"].indexOf(formSemester);
    const semesterNum = yearIdx * 2 + semIdx + 1;

    try {
      const payload = {
        name: formName.trim(),
        academicYear: formAcademicYear,
        regulation: formRegulation,
        departmentId: formDepartmentId,
        year: formYear,
        semester: semesterNum,
        examType: formExamType,
        sections: formSections,
        subjectIds: selectedSubjectIds
      };

      const res = await apiFetch("/examinations/sessions", {
        method: "POST",
        body: JSON.stringify(payload)
      }, accessToken);

      if (res.success && res.data?.session) {
        triggerToast("Examination Session created successfully!");
        setCreateDrawerOpen(false);
        fetchSessions();
        // Immediately open Stage 2 Schedule Builder
        openBuilderWorkspace(res.data.session);
      }
    } catch (err: any) {
      setError(err.message || "Failed to create examination session");
    } finally {
      setSubmitting(false);
    }
  };

  // Open Stage 2 Subject Schedule Drawer
  const openSubjectScheduleDrawer = (card: SubjectCard) => {
    setEditingSubjectCard(card);
    setError(null);

    const isLab = card.subjectType === "Practical" || card.subjectType === "Lab";
    if (isLab && activeSession) {
      const initialMap: Record<string, any> = {};
      const secList = card.sectionSchedules && card.sectionSchedules.length > 0
        ? card.sectionSchedules
        : activeSession.sections.map(s => ({ section: s, examDate: "", startTime: "09:30", endTime: "11:00", maximumMarks: 50, venue: "", instructions: "" }));

      secList.forEach(item => {
        initialMap[item.section] = {
          examDate: item.examDate || new Date().toLocaleDateString("en-CA"),
          startTime: item.startTime || "09:30",
          endTime: item.endTime || "11:00",
          maximumMarks: item.maximumMarks ? item.maximumMarks.toString() : "50",
          venue: item.venue || "",
          instructions: item.instructions || ""
        };
      });
      setLabSectionSchedules(initialMap);
    } else {
      setSchedExamDate(card.examDate || new Date().toLocaleDateString("en-CA"));
      setSchedStartTime(card.startTime || "09:30");
      setSchedEndTime(card.endTime || "11:00");
      setSchedMaxMarks(card.maximumMarks ? card.maximumMarks.toString() : "50");
      setSchedVenue(card.venue || "");
      setSchedInstructions(card.instructions || "");
      setSchedScope("Entire Batch");
    }

    setScheduleDrawerOpen(true);
  };

  // Save Subject Schedule Configuration
  const handleSaveSubjectSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession || !editingSubjectCard) return;
    setError(null);
    setSubmitting(true);

    const isLab = editingSubjectCard.subjectType === "Practical" || editingSubjectCard.subjectType === "Lab";

    try {
      let payload: any = {
        subjectId: editingSubjectCard.subjectId
      };

      if (isLab) {
        const secArray = Object.entries(labSectionSchedules).map(([sec, vals]) => ({
          section: sec,
          examDate: vals.examDate,
          startTime: vals.startTime,
          endTime: vals.endTime,
          maximumMarks: Number(vals.maximumMarks),
          venue: vals.venue,
          instructions: vals.instructions
        }));

        payload.sectionSchedules = secArray;
      } else {
        if (!schedExamDate || !schedStartTime || !schedEndTime) {
          throw new Error("Date, start time, and end time are required.");
        }
        if (schedEndTime <= schedStartTime) {
          throw new Error("End time must be after start time.");
        }

        payload.examDate = schedExamDate;
        payload.startTime = schedStartTime;
        payload.endTime = schedEndTime;
        payload.maximumMarks = Number(schedMaxMarks);
        payload.venue = schedVenue;
        payload.instructions = schedInstructions;
      }

      const res = await apiFetch(`/examinations/sessions/${activeSession.id}/schedule-subject`, {
        method: "POST",
        body: JSON.stringify(payload)
      }, accessToken);

      if (res.success && res.data?.session) {
        triggerToast("Subject schedule configured successfully!");
        setScheduleDrawerOpen(false);
        setActiveSession(res.data.session);
        fetchSessions();
      }
    } catch (err: any) {
      setError(err.message || "Failed to configure subject schedule");
    } finally {
      setSubmitting(false);
    }
  };

  // Publish Examination Session
  const handlePublishSession = async () => {
    if (!activeSession) return;
    setSubmitting(true);
    try {
      const res = await apiFetch(`/examinations/sessions/${activeSession.id}/publish`, {
        method: "POST"
      }, accessToken);

      if (res.success && res.data?.session) {
        triggerToast("Examination Session published successfully! Calendar events and notifications generated.");
        setPublishModalOpen(false);
        setActiveSession(res.data.session);
        fetchSessions();
      }
    } catch (err: any) {
      triggerToast(err.message || "Failed to publish examination session");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Session
  const handleDeleteSession = async (id: string) => {
    if (!confirm("Are you sure you want to delete this examination session?")) return;
    try {
      const res = await apiFetch(`/examinations/sessions/${id}`, {
        method: "DELETE"
      }, accessToken);
      if (res.success) {
        triggerToast("Session deleted successfully.");
        if (selectedSessionId === id) {
          setViewMode('sessions_list');
        }
        fetchSessions();
      }
    } catch (err: any) {
      alert(err.message || "Failed to delete session");
    }
  };

  // Filtered Sessions
  const filteredSessions = sessions.filter(s => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = s.name.toLowerCase().includes(q);
      const matchDept = (s.departmentName || "").toLowerCase().includes(q) || (s.departmentCode || "").toLowerCase().includes(q);
      if (!matchName && !matchDept) return false;
    }
    return true;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      
      {/* Toast Feedback */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2 animate-bounce">
          <CheckCircle2 size={16} />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b dark:border-neutral-800 border-border-subtle pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-500 uppercase tracking-wider mb-1">
            <GraduationCap size={16} />
            <span>University Examinations Cell</span>
          </div>
          <h2 className="font-display font-bold text-2xl dark:text-white text-text-primary">
            {viewMode === 'builder_workspace' ? "Stage 2: Visual Exam Schedule Builder" : "Examination Sessions Console"}
          </h2>
          <p className="text-xs dark:text-neutral-400 text-text-secondary mt-0.5">
            {viewMode === 'builder_workspace' 
              ? "Configure independent dates, times, venues, and section timetables for session subjects before publishing."
              : "Create examination sessions, select mapped batch subjects, and build systematic exam schedules."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {viewMode === 'builder_workspace' ? (
            <button
              onClick={() => setViewMode('sessions_list')}
              className="px-4 py-2 text-xs font-semibold rounded-lg dark:bg-neutral-800 bg-neutral-100 dark:hover:bg-neutral-750 hover:bg-neutral-200 dark:text-white text-text-primary border dark:border-neutral-750 border-border-subtle cursor-pointer transition flex items-center gap-1.5"
            >
              <ChevronLeft size={14} />
              <span>Back to Sessions</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setError(null);
                setFormName("");
                setFormDepartmentId(departments[0]?.id || "");
                setCreateDrawerOpen(true);
              }}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 cursor-pointer transition flex items-center gap-2"
            >
              <Plus size={16} />
              <span>Create Examination Session</span>
            </button>
          )}

          <button
            onClick={fetchSessions}
            className="p-2 rounded-lg dark:bg-neutral-850 bg-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-800 dark:text-neutral-400 text-text-secondary dark:hover:text-white border dark:border-neutral-800 border-border-subtle transition cursor-pointer"
            title="Refresh Sessions List"
          >
            <RefreshCw size={14} className={loadingList ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* MODE 1: SESSIONS REGISTRY LIST & OVERVIEW */}
      {viewMode === 'sessions_list' && (
        <div className="space-y-6">

          {/* Search and Filters Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-surface dark:bg-neutral-900/60 p-4 rounded-xl border dark:border-neutral-800 border-border-subtle shadow-sm">
            {/* Search Box */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-text-muted dark:text-neutral-500" size={14} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search session name or department..."
                className="w-full pl-9 pr-3 py-2 text-xs dark:bg-neutral-950 bg-background border dark:border-neutral-800 border-border-subtle rounded-lg dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition"
              />
            </div>

            {/* Department Filter */}
            <select
              value={deptFilter}
              onChange={(e) => { setDeptFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 text-xs dark:bg-neutral-950 bg-background border dark:border-neutral-800 border-border-subtle rounded-lg dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition cursor-pointer"
            >
              <option value="ALL">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 text-xs dark:bg-neutral-950 bg-background border dark:border-neutral-800 border-border-subtle rounded-lg dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              {["Draft", "Scheduling", "Ready for Review", "Published", "Archived"].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Sessions Grid */}
          {loadingList ? (
            <div className="py-20 text-center">
              <Loader2 className="animate-spin text-blue-500 mx-auto mb-3" size={24} />
              <p className="text-xs text-text-muted dark:text-neutral-400 font-mono">Loading examination sessions registry...</p>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="py-20 text-center bg-surface dark:bg-neutral-900/30 rounded-xl border dark:border-neutral-800 border-border-subtle p-8">
              <Layers size={32} className="text-text-muted dark:text-neutral-600 mx-auto mb-3" />
              <h4 className="font-bold text-sm dark:text-white text-text-primary mb-1">No Examination Sessions Found</h4>
              <p className="text-xs text-text-muted dark:text-neutral-400 max-w-sm mx-auto mb-4">
                No active examination sessions match the selected filters. Click below to create a new session.
              </p>
              <button
                onClick={() => {
                  setError(null);
                  setFormName("");
                  setFormDepartmentId(departments[0]?.id || "");
                  setCreateDrawerOpen(true);
                }}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition"
              >
                Create Examination Session
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredSessions.map(session => {
                const isPublished = session.status === "Published";
                const isScheduling = session.status === "Scheduling";
                const isDraft = session.status === "Draft";
                const progressPct = session.totalSubjectCount > 0 
                  ? Math.round((session.scheduledSubjectCount / session.totalSubjectCount) * 100)
                  : 0;

                return (
                  <div
                    key={session.id}
                    className="bg-surface dark:bg-neutral-900 border dark:border-neutral-800 border-border-subtle rounded-xl p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      {/* Status & Exam Type Badge */}
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-blue-500/10 text-blue-500 border border-blue-500/20">
                          {session.examType}
                        </span>
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                          isPublished
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                            : isScheduling
                            ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                            : "bg-neutral-500/10 text-neutral-400 border-neutral-500/20"
                        }`}>
                          {session.status}
                        </span>
                      </div>

                      {/* Title & Department info */}
                      <div>
                        <h3 className="font-display font-bold text-base dark:text-white text-text-primary line-clamp-1">
                          {session.name}
                        </h3>
                        <p className="text-xs dark:text-neutral-400 text-text-secondary mt-0.5 flex items-center gap-1.5">
                          <Building2 size={12} className="text-text-muted" />
                          <span>{session.departmentName} ({session.departmentCode})</span>
                        </p>
                      </div>

                      {/* Tags Bar */}
                      <div className="flex flex-wrap gap-2 text-[10px] font-mono text-text-secondary dark:text-neutral-400">
                        <span className="bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded">Year {session.year}</span>
                        <span className="bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded">Sem {session.semester}</span>
                        <span className="bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded">Reg {session.regulation}</span>
                        <span className="bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded">Sec {session.sections.join(', ')}</span>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="dark:text-neutral-400 text-text-muted">Scheduling Progress</span>
                          <span className="font-bold dark:text-white text-text-primary">{session.scheduledSubjectCount} / {session.totalSubjectCount} Subjects</span>
                        </div>
                        <div className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${isPublished ? "bg-emerald-500" : "bg-blue-600"}`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="pt-3 border-t dark:border-neutral-800 border-border-subtle flex items-center justify-between gap-2">
                      <button
                        onClick={() => openBuilderWorkspace(session)}
                        className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-blue-600/10 hover:bg-blue-600/20 text-blue-500 dark:text-blue-400 border border-blue-500/20 cursor-pointer transition text-center flex items-center justify-center gap-1.5"
                      >
                        <Calendar size={13} />
                        <span>Schedule Builder</span>
                      </button>

                      {!isPublished && (
                        <button
                          onClick={() => handleDeleteSession(session.id)}
                          className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition border border-transparent hover:border-rose-500/20 cursor-pointer"
                          title="Delete Session"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {!loadingList && totalPages > 1 && (
            <div className="flex items-center justify-between border-t dark:border-neutral-800 border-border-subtle pt-4">
              <span className="text-xs font-mono text-text-muted dark:text-neutral-500">
                Showing page {page} of {totalPages} ({totalRecords} total sessions)
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(p - 1, 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded dark:bg-neutral-850 bg-neutral-100 border dark:border-neutral-800 border-border-subtle disabled:opacity-40"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded dark:bg-neutral-850 bg-neutral-100 border dark:border-neutral-800 border-border-subtle disabled:opacity-40"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODE 2: STAGE 2 VISUAL EXAM SCHEDULE BUILDER WORKSPACE */}
      {viewMode === 'builder_workspace' && (
        <div className="space-y-6 animate-fade-in">
          {loadingSession ? (
            <div className="py-20 text-center">
              <Loader2 className="animate-spin text-blue-500 mx-auto mb-3" size={24} />
              <p className="text-xs text-text-muted dark:text-neutral-400 font-mono">Loading examination schedule workspace...</p>
            </div>
          ) : activeSession ? (
            <>
              {/* Session Overview Header */}
              <div className="bg-surface dark:bg-neutral-900 border dark:border-neutral-800 border-border-subtle rounded-xl p-6 shadow-sm space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">
                        {activeSession.examType}
                      </span>
                      <span className={`text-xs font-bold px-3 py-0.5 rounded-full border ${
                        activeSession.status === "Published"
                          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                      }`}>
                        {activeSession.status}
                      </span>
                    </div>
                    <h2 className="font-display font-bold text-xl dark:text-white text-text-primary">
                      {activeSession.name}
                    </h2>
                    <p className="text-xs text-text-secondary dark:text-neutral-400">
                      Department: <strong className="dark:text-white text-text-primary">{activeSession.departmentName} ({activeSession.departmentCode})</strong> | Year {activeSession.year} | Semester {activeSession.semester} | Regulation {activeSession.regulation} | Sections: {activeSession.sections.join(', ')}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3">
                    {activeSession.status !== "Published" && (
                      <button
                        onClick={() => setPublishModalOpen(true)}
                        className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-500/20 cursor-pointer transition flex items-center gap-2"
                      >
                        <Send size={14} />
                        <span>Publish Schedule</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress Indicator */}
                <div className="pt-2 border-t dark:border-neutral-800 border-border-subtle grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-neutral-50 dark:bg-neutral-950/50 p-3 rounded-lg border dark:border-neutral-850 border-border-subtle">
                    <span className="text-[10px] text-text-muted dark:text-neutral-500 font-mono uppercase block">Total Session Subjects</span>
                    <span className="text-base font-bold dark:text-white text-text-primary">{activeSession.totalSubjectCount}</span>
                  </div>
                  <div className="bg-neutral-50 dark:bg-neutral-950/50 p-3 rounded-lg border dark:border-neutral-850 border-border-subtle">
                    <span className="text-[10px] text-text-muted dark:text-neutral-500 font-mono uppercase block">Configured Schedules</span>
                    <span className="text-base font-bold text-emerald-500">{activeSession.scheduledSubjectCount}</span>
                  </div>
                  <div className="bg-neutral-50 dark:bg-neutral-950/50 p-3 rounded-lg border dark:border-neutral-850 border-border-subtle">
                    <span className="text-[10px] text-text-muted dark:text-neutral-500 font-mono uppercase block">Pending Schedules</span>
                    <span className="text-base font-bold text-amber-500">{activeSession.totalSubjectCount - activeSession.scheduledSubjectCount}</span>
                  </div>
                </div>
              </div>

              {/* Warnings Banner */}
              {activeSession.warnings && activeSession.warnings.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl text-amber-500 text-xs space-y-1">
                  <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-[10px]">
                    <AlertTriangle size={14} />
                    <span>Scheduling Conflict Warnings</span>
                  </div>
                  {activeSession.warnings.map((w, idx) => (
                    <p key={idx} className="font-mono text-[11px] pl-5">{w}</p>
                  ))}
                </div>
              )}

              {/* Subject Cards Grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm dark:text-white text-text-primary uppercase tracking-wider font-mono">
                    Subject Timetable Cards ({activeSession.subjects.length})
                  </h3>
                  <span className="text-xs text-text-muted">Click any subject card to configure its schedule</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeSession.subjects.map(card => {
                    const isScheduled = card.status === "Scheduled";
                    const isLab = card.subjectType === "Practical" || card.subjectType === "Lab";

                    return (
                      <div
                        key={card.subjectId}
                        onClick={() => activeSession.status !== "Published" && openSubjectScheduleDrawer(card)}
                        className={`bg-surface dark:bg-neutral-900 border rounded-xl p-5 shadow-sm transition flex flex-col justify-between space-y-4 ${
                          activeSession.status !== "Published" ? "cursor-pointer hover:border-blue-500/50" : ""
                        } ${isScheduled ? "dark:border-emerald-500/30 border-emerald-500/40" : "dark:border-neutral-800 border-border-subtle"}`}
                      >
                        <div className="space-y-3">
                          {/* Subject Header */}
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <span className="text-[10px] font-mono font-bold text-blue-500">{card.subjectCode}</span>
                              <h4 className="font-display font-bold text-base dark:text-white text-text-primary">
                                {card.subjectName}
                              </h4>
                            </div>

                            <div className="flex flex-col items-end gap-1">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                isLab ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                              }`}>
                                {isLab ? "Practical Lab" : "Theory Course"}
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isScheduled ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
                              }`}>
                                {isScheduled ? "Scheduled" : "Pending Date"}
                              </span>
                            </div>
                          </div>

                          {/* Schedule Details */}
                          {isLab && card.sectionSchedules && card.sectionSchedules.length > 0 ? (
                            <div className="space-y-2 pt-2 border-t dark:border-neutral-800 border-border-subtle">
                              <span className="text-[10px] font-mono text-text-muted uppercase block font-bold">Section Timetables</span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {card.sectionSchedules.map(secItem => (
                                  <div key={secItem.section} className="bg-neutral-50 dark:bg-neutral-950/60 p-2.5 rounded-lg text-xs space-y-1 border dark:border-neutral-850 border-border-subtle">
                                    <div className="font-bold dark:text-white text-text-primary flex items-center justify-between">
                                      <span>Section {secItem.section}</span>
                                      <span className="text-[10px] text-text-muted font-mono">{secItem.maximumMarks} Marks</span>
                                    </div>
                                    <div className="text-[11px] dark:text-neutral-400 text-text-secondary flex items-center gap-1 font-mono">
                                      <Calendar size={11} className="text-blue-500" />
                                      <span>{secItem.examDate || "Not Set"}</span>
                                    </div>
                                    <div className="text-[11px] dark:text-neutral-400 text-text-secondary flex items-center gap-1 font-mono">
                                      <Clock size={11} className="text-blue-500" />
                                      <span>{secItem.startTime ? `${secItem.startTime} - ${secItem.endTime}` : "Not Set"}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-3 py-2 border-y dark:border-neutral-800 border-border-subtle text-xs">
                              <div>
                                <span className="text-[10px] text-text-muted font-mono uppercase block">Exam Date</span>
                                <span className="font-semibold dark:text-white text-text-primary font-mono">
                                  {card.examDate || "Not Assigned"}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] text-text-muted font-mono uppercase block">Time & Marks</span>
                                <span className="font-semibold dark:text-white text-text-primary font-mono">
                                  {card.startTime ? `${card.startTime} - ${card.endTime} (${card.maximumMarks}M)` : "Not Assigned"}
                                </span>
                              </div>
                            </div>
                          )}

                          {card.venue && (
                            <p className="text-xs text-text-secondary dark:text-neutral-400 flex items-center gap-1.5 font-mono">
                              <MapPin size={12} className="text-rose-500" />
                              <span>Venue: {card.venue}</span>
                            </p>
                          )}
                        </div>

                        {activeSession.status !== "Published" && (
                          <div className="pt-2 text-right">
                            <span className="text-xs font-semibold text-blue-500 hover:underline">
                              {isScheduled ? "Modify Schedule →" : "Configure Schedule →"}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* STAGE 1 DRAWER: CREATE EXAMINATION SESSION */}
      {createDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-neutral-950/70 backdrop-blur-sm animate-fade-in">
          <div className="absolute inset-0 cursor-default" onClick={() => setCreateDrawerOpen(false)} />
          <div className="relative w-full max-w-xl h-full dark:bg-neutral-900 bg-surface border-l dark:border-neutral-800 border-border-subtle p-6 flex flex-col shadow-2xl z-10 overflow-y-auto">
            
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b dark:border-neutral-800 border-border-subtle pb-4 mb-4">
              <div>
                <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Stage 1 Workflow</span>
                <h3 className="font-display font-bold dark:text-white text-text-primary text-lg">
                  Create Examination Session
                </h3>
              </div>
              <button
                onClick={() => setCreateDrawerOpen(false)}
                className="p-1 rounded dark:bg-neutral-850 bg-neutral-100 dark:hover:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-400 text-text-secondary"
              >
                <X size={18} />
              </button>
            </div>

            {error && (
              <div className="p-3 mb-4 rounded bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-semibold">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateSession} className="space-y-4 flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                
                {/* Session Name */}
                <div>
                  <label className="block text-[10px] font-bold dark:text-neutral-400 text-text-secondary uppercase mb-1">
                    Examination Session Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Mid-I Examinations Nov 2026"
                    className="w-full px-3 py-2 text-xs dark:bg-neutral-950 bg-background border dark:border-neutral-800 border-border-subtle rounded-lg dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition"
                  />
                </div>

                {/* Academic Year & Regulation */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold dark:text-neutral-400 text-text-secondary uppercase mb-1">Academic Year</label>
                    <select
                      value={formAcademicYear}
                      onChange={(e) => setFormAcademicYear(e.target.value)}
                      className="w-full px-3 py-2 text-xs dark:bg-neutral-950 bg-background border dark:border-neutral-800 border-border-subtle rounded-lg dark:text-white text-text-primary"
                    >
                      {["2025-26", "2026-27", "2027-28"].map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold dark:text-neutral-400 text-text-secondary uppercase mb-1">Regulation</label>
                    <select
                      value={formRegulation}
                      onChange={(e) => setFormRegulation(e.target.value)}
                      className="w-full px-3 py-2 text-xs dark:bg-neutral-950 bg-background border dark:border-neutral-800 border-border-subtle rounded-lg dark:text-white text-text-primary"
                    >
                      {["R22", "R26"].map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Department */}
                <div>
                  <label className="block text-[10px] font-bold dark:text-neutral-400 text-text-secondary uppercase mb-1">
                    Department / Branch <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={formDepartmentId}
                    onChange={(e) => setFormDepartmentId(e.target.value)}
                    className="w-full px-3 py-2 text-xs dark:bg-neutral-950 bg-background border dark:border-neutral-800 border-border-subtle rounded-lg dark:text-white text-text-primary"
                  >
                    <option value="">Select Department</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                    ))}
                  </select>
                </div>

                {/* Year, Semester & Exam Type */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold dark:text-neutral-400 text-text-secondary uppercase mb-1">Year</label>
                    <select
                      value={formYear}
                      onChange={(e) => setFormYear(e.target.value)}
                      className="w-full px-3 py-2 text-xs dark:bg-neutral-950 bg-background border dark:border-neutral-800 border-border-subtle rounded-lg dark:text-white text-text-primary"
                    >
                      {["I", "II", "III", "IV"].map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold dark:text-neutral-400 text-text-secondary uppercase mb-1">Semester</label>
                    <select
                      value={formSemester}
                      onChange={(e) => setFormSemester(e.target.value)}
                      className="w-full px-3 py-2 text-xs dark:bg-neutral-950 bg-background border dark:border-neutral-800 border-border-subtle rounded-lg dark:text-white text-text-primary"
                    >
                      {["I", "II"].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold dark:text-neutral-400 text-text-secondary uppercase mb-1">Exam Type</label>
                    <select
                      value={formExamType}
                      onChange={(e) => setFormExamType(e.target.value)}
                      className="w-full px-3 py-2 text-xs dark:bg-neutral-950 bg-background border dark:border-neutral-800 border-border-subtle rounded-lg dark:text-white text-text-primary"
                    >
                      {["Mid-1", "Mid-2", "Internal Assessment", "Semester End Examination", "Practical / Laboratory Exam", "Viva", "Improvement Exam", "Supplementary Exam"].map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Applicable Sections */}
                <div>
                  <label className="block text-[10px] font-bold dark:text-neutral-400 text-text-secondary uppercase mb-1">Applicable Sections</label>
                  <div className="flex items-center gap-4 py-1">
                    {["A", "B", "C", "D"].map(sec => (
                      <label key={sec} className="flex items-center gap-1.5 text-xs dark:text-white text-text-primary cursor-pointer font-mono">
                        <input
                          type="checkbox"
                          value={sec}
                          checked={formSections.includes(sec)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormSections([...formSections, sec]);
                            } else {
                              setFormSections(formSections.filter(x => x !== sec));
                            }
                          }}
                        />
                        <span>Section {sec}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Subject Selection Cards Checklist */}
                <div className="pt-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-bold dark:text-neutral-400 text-text-secondary uppercase">
                      Curriculum Subjects ({selectedSubjectIds.length} Selected)
                    </label>
                    {availableSubjects.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedSubjectIds.length === availableSubjects.length) {
                            setSelectedSubjectIds([]);
                          } else {
                            setSelectedSubjectIds(availableSubjects.map(s => s.id));
                          }
                        }}
                        className="text-[10px] text-blue-500 font-semibold hover:underline cursor-pointer"
                      >
                        {selectedSubjectIds.length === availableSubjects.length ? "Deselect All" : "Select All"}
                      </button>
                    )}
                  </div>

                  {loadingSubjects ? (
                    <div className="py-6 text-center text-xs text-blue-500 flex items-center justify-center gap-2">
                      <Loader2 size={14} className="animate-spin" />
                      <span>Fetching mapped curriculum subjects...</span>
                    </div>
                  ) : availableSubjects.length === 0 ? (
                    <div className="p-4 text-center text-xs dark:text-neutral-400 text-text-muted bg-neutral-50 dark:bg-neutral-950/40 rounded-lg border dark:border-neutral-800 border-border-subtle">
                      Select Department, Year, and Semester above to load curriculum subjects.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto p-1">
                      {availableSubjects.map(sub => {
                        const checked = selectedSubjectIds.includes(sub.id);
                        return (
                          <div
                            key={sub.id}
                            onClick={() => {
                              if (checked) {
                                setSelectedSubjectIds(selectedSubjectIds.filter(id => id !== sub.id));
                              } else {
                                setSelectedSubjectIds([...selectedSubjectIds, sub.id]);
                              }
                            }}
                            className={`p-3 rounded-lg border text-xs cursor-pointer transition flex items-start gap-2.5 ${
                              checked 
                                ? "bg-blue-500/10 dark:border-blue-500/40 border-blue-500/50" 
                                : "bg-neutral-50 dark:bg-neutral-950/40 dark:border-neutral-800 border-border-subtle opacity-70"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {}}
                              className="mt-0.5 cursor-pointer"
                            />
                            <div>
                              <span className="font-mono text-[10px] font-bold text-blue-500 block">{sub.code}</span>
                              <span className="font-bold dark:text-white text-text-primary block line-clamp-1">{sub.name}</span>
                              <span className="text-[10px] text-text-muted dark:text-neutral-500 font-mono">
                                {sub.type || "Theory"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>

              {/* Drawer Actions */}
              <div className="flex items-center gap-3 pt-4 border-t dark:border-neutral-800 border-border-subtle mt-4">
                <button
                  type="button"
                  onClick={() => setCreateDrawerOpen(false)}
                  className="flex-1 py-2 text-xs font-semibold rounded-lg dark:bg-neutral-800 bg-neutral-100 dark:hover:bg-neutral-750 hover:bg-neutral-200 dark:text-neutral-300 text-text-primary border dark:border-neutral-800 border-border-subtle cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition flex items-center justify-center gap-1.5"
                >
                  {submitting && <Loader2 size={12} className="animate-spin" />}
                  <span>Create Session & Build Schedule</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STAGE 2 SUBJECT SCHEDULE DRAWER */}
      {scheduleDrawerOpen && editingSubjectCard && (
        <div className="fixed inset-0 z-50 flex justify-end bg-neutral-950/70 backdrop-blur-sm animate-fade-in">
          <div className="absolute inset-0 cursor-default" onClick={() => setScheduleDrawerOpen(false)} />
          <div className="relative w-full max-w-lg h-full dark:bg-neutral-900 bg-surface border-l dark:border-neutral-800 border-border-subtle p-6 flex flex-col shadow-2xl z-10 overflow-y-auto">
            
            <div className="flex items-center justify-between border-b dark:border-neutral-800 border-border-subtle pb-4 mb-4">
              <div>
                <span className="text-[10px] font-bold text-blue-500 font-mono">{editingSubjectCard.subjectCode}</span>
                <h3 className="font-display font-bold dark:text-white text-text-primary text-lg">
                  Configure Schedule: {editingSubjectCard.subjectName}
                </h3>
              </div>
              <button
                onClick={() => setScheduleDrawerOpen(false)}
                className="p-1 rounded dark:bg-neutral-850 bg-neutral-100 dark:hover:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-400"
              >
                <X size={18} />
              </button>
            </div>

            {error && (
              <div className="p-3 mb-4 rounded bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-semibold">
                {error}
              </div>
            )}

            <form onSubmit={handleSaveSubjectSchedule} className="space-y-4 flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                
                {/* PRACTICAL / LAB PER-SECTION TIMETABLE SCHEDULER */}
                {(editingSubjectCard.subjectType === "Practical" || editingSubjectCard.subjectType === "Lab") ? (
                  <div className="space-y-4">
                    <p className="text-xs text-amber-500 font-mono bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
                      Laboratory Practical exams support separate date and time schedules for each section.
                    </p>

                    {Object.entries(labSectionSchedules).map(([sec, vals]) => (
                      <div key={sec} className="bg-neutral-50 dark:bg-neutral-950/60 p-4 rounded-xl border dark:border-neutral-800 border-border-subtle space-y-3">
                        <h4 className="font-bold text-xs dark:text-white text-text-primary flex items-center justify-between">
                          <span>Section {sec} Timetable</span>
                        </h4>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold dark:text-neutral-400 text-text-secondary uppercase mb-1">Exam Date</label>
                            <input
                              type="date"
                              required
                              value={vals.examDate}
                              onChange={(e) => setLabSectionSchedules({
                                ...labSectionSchedules,
                                [sec]: { ...vals, examDate: e.target.value }
                              })}
                              className="w-full px-2.5 py-1.5 text-xs dark:bg-neutral-900 bg-background border dark:border-neutral-800 border-border-subtle rounded-lg dark:text-white"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold dark:text-neutral-400 text-text-secondary uppercase mb-1">Max Marks</label>
                            <input
                              type="number"
                              required
                              value={vals.maximumMarks}
                              onChange={(e) => setLabSectionSchedules({
                                ...labSectionSchedules,
                                [sec]: { ...vals, maximumMarks: e.target.value }
                              })}
                              className="w-full px-2.5 py-1.5 text-xs dark:bg-neutral-900 bg-background border dark:border-neutral-800 border-border-subtle rounded-lg dark:text-white"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold dark:text-neutral-400 text-text-secondary uppercase mb-1">Start Time</label>
                            <input
                              type="time"
                              required
                              value={vals.startTime}
                              onChange={(e) => setLabSectionSchedules({
                                ...labSectionSchedules,
                                [sec]: { ...vals, startTime: e.target.value }
                              })}
                              className="w-full px-2.5 py-1.5 text-xs dark:bg-neutral-900 bg-background border dark:border-neutral-800 border-border-subtle rounded-lg dark:text-white"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold dark:text-neutral-400 text-text-secondary uppercase mb-1">End Time</label>
                            <input
                              type="time"
                              required
                              value={vals.endTime}
                              onChange={(e) => setLabSectionSchedules({
                                ...labSectionSchedules,
                                [sec]: { ...vals, endTime: e.target.value }
                              })}
                              className="w-full px-2.5 py-1.5 text-xs dark:bg-neutral-900 bg-background border dark:border-neutral-800 border-border-subtle rounded-lg dark:text-white"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold dark:text-neutral-400 text-text-secondary uppercase mb-1">Exam Venue / Lab Hall</label>
                          <input
                            type="text"
                            value={vals.venue}
                            onChange={(e) => setLabSectionSchedules({
                              ...labSectionSchedules,
                              [sec]: { ...vals, venue: e.target.value }
                            })}
                            placeholder="e.g. AI Lab 204"
                            className="w-full px-2.5 py-1.5 text-xs dark:bg-neutral-900 bg-background border dark:border-neutral-800 border-border-subtle rounded-lg dark:text-white"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* THEORY EXAM SINGLE / BATCH SCHEDULER */
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold dark:text-neutral-400 text-text-secondary uppercase mb-1">Exam Scope</label>
                      <select
                        value={schedScope}
                        onChange={(e) => setSchedScope(e.target.value)}
                        className="w-full px-3 py-2 text-xs dark:bg-neutral-950 bg-background border dark:border-neutral-800 border-border-subtle rounded-lg dark:text-white"
                      >
                        <option value="Entire Batch">Entire Batch (All Sections)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold dark:text-neutral-400 text-text-secondary uppercase mb-1">Exam Date <span className="text-rose-500">*</span></label>
                      <input
                        type="date"
                        required
                        value={schedExamDate}
                        onChange={(e) => setSchedExamDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs dark:bg-neutral-950 bg-background border dark:border-neutral-800 border-border-subtle rounded-lg dark:text-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold dark:text-neutral-400 text-text-secondary uppercase mb-1">Start Time <span className="text-rose-500">*</span></label>
                        <input
                          type="time"
                          required
                          value={schedStartTime}
                          onChange={(e) => setSchedStartTime(e.target.value)}
                          className="w-full px-3 py-2 text-xs dark:bg-neutral-950 bg-background border dark:border-neutral-800 border-border-subtle rounded-lg dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold dark:text-neutral-400 text-text-secondary uppercase mb-1">End Time <span className="text-rose-500">*</span></label>
                        <input
                          type="time"
                          required
                          value={schedEndTime}
                          onChange={(e) => setSchedEndTime(e.target.value)}
                          className="w-full px-3 py-2 text-xs dark:bg-neutral-950 bg-background border dark:border-neutral-800 border-border-subtle rounded-lg dark:text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold dark:text-neutral-400 text-text-secondary uppercase mb-1">Maximum Marks <span className="text-rose-500">*</span></label>
                      <input
                        type="number"
                        required
                        min={1}
                        max={200}
                        value={schedMaxMarks}
                        onChange={(e) => setSchedMaxMarks(e.target.value)}
                        className="w-full px-3 py-2 text-xs dark:bg-neutral-950 bg-background border dark:border-neutral-800 border-border-subtle rounded-lg dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold dark:text-neutral-400 text-text-secondary uppercase mb-1">Exam Venue (Optional)</label>
                      <input
                        type="text"
                        value={schedVenue}
                        onChange={(e) => setSchedVenue(e.target.value)}
                        placeholder="e.g. Main Auditorium / Exam Hall 101"
                        className="w-full px-3 py-2 text-xs dark:bg-neutral-950 bg-background border dark:border-neutral-800 border-border-subtle rounded-lg dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold dark:text-neutral-400 text-text-secondary uppercase mb-1">Instructions (Optional)</label>
                      <textarea
                        rows={2}
                        value={schedInstructions}
                        onChange={(e) => setSchedInstructions(e.target.value)}
                        placeholder="e.g. Non-programmable scientific calculators permitted."
                        className="w-full px-3 py-2 text-xs dark:bg-neutral-950 bg-background border dark:border-neutral-800 border-border-subtle rounded-lg dark:text-white"
                      />
                    </div>
                  </div>
                )}

              </div>

              <div className="flex items-center gap-3 pt-4 border-t dark:border-neutral-800 border-border-subtle mt-4">
                <button
                  type="button"
                  onClick={() => setScheduleDrawerOpen(false)}
                  className="flex-1 py-2 text-xs font-semibold rounded-lg dark:bg-neutral-800 bg-neutral-100 dark:hover:bg-neutral-750 hover:bg-neutral-200 dark:text-neutral-300 border dark:border-neutral-800 border-border-subtle cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition flex items-center justify-center gap-1.5"
                >
                  {submitting && <Loader2 size={12} className="animate-spin" />}
                  <span>Save Subject Schedule</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PUBLISH CONFIRMATION MODAL */}
      {publishModalOpen && activeSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/70 backdrop-blur-sm animate-fade-in">
          <div className="dark:bg-neutral-900 bg-surface border dark:border-neutral-800 border-border-subtle p-6 rounded-xl max-w-md w-full mx-4 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-emerald-500">
              <Send size={24} />
              <h3 className="font-display font-bold dark:text-white text-text-primary text-lg">
                Publish Examination Schedule?
              </h3>
            </div>
            
            <p className="text-xs dark:text-neutral-400 text-text-secondary leading-relaxed">
              You are about to publish the examination schedule for <strong className="dark:text-white text-text-primary">{activeSession.name}</strong>.
            </p>

            <ul className="text-xs text-text-secondary dark:text-neutral-400 space-y-1.5 font-mono bg-neutral-50 dark:bg-neutral-955 p-3 rounded-lg border dark:border-neutral-850 border-border-subtle">
              <li>• Official Academic Calendar events will be created.</li>
              <li>• Target notifications sent to enrolled students in {activeSession.departmentCode} (Year {activeSession.year}, Sem {activeSession.semester}).</li>
              <li>• Notifications sent to assigned subject faculty.</li>
            </ul>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setPublishModalOpen(false)}
                className="flex-1 py-2 rounded-lg dark:bg-neutral-800 bg-neutral-100 hover:bg-neutral-200 dark:text-neutral-300 font-semibold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handlePublishSession}
                disabled={submitting}
                className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs cursor-pointer flex items-center justify-center gap-1.5"
              >
                {submitting && <Loader2 size={12} className="animate-spin" />}
                <span>Confirm & Publish</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
