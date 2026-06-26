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
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  GraduationCap
} from "lucide-react";

// Types
interface SubjectSummary {
  id: string;
  code: string;
  name: string;
  departmentName: string;
  semester: number;
}

interface FacultySummary {
  id: string;
  employeeNumber: string;
  fullName: string;
  email: string;
  departmentName: string;
  status: string;
}

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

export default function AdminExaminations() {
  const { accessToken } = useAuth();

  // Data lists
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [subjects, setSubjects] = useState<SubjectSummary[]>([]);
  const [faculty, setFaculty] = useState<FacultySummary[]>([]);
  
  // Stats counts
  const [stats, setStats] = useState({
    total: 0,
    scheduled: 0,
    ongoing: 0,
    completed: 0,
    cancelled: 0
  });

  // Filters state
  const [subjectFilter, setSubjectFilter] = useState("ALL");
  const [facultyFilter, setFacultyFilter] = useState("ALL");
  const [semesterFilter, setSemesterFilter] = useState("ALL");
  const [sectionFilter, setSectionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("");

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Loading & error feedback
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDependencies, setLoadingDependencies] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState("");

  // Drawer / modal control states
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamSummary | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [examToDelete, setExamToDelete] = useState<{ id: string; subjectName: string; examType: string } | null>(null);

  // Form Fields
  const [formSubjectId, setFormSubjectId] = useState("");
  const [formFacultyId, setFormFacultyId] = useState("");
  const [formSection, setFormSection] = useState("");
  const [formExamType, setFormExamType] = useState("Mid-1");
  const [formDate, setFormDate] = useState("");
  const [formStartTime, setFormStartTime] = useState("");
  const [formEndTime, setFormEndTime] = useState("");
  const [formMaxMarks, setFormMaxMarks] = useState("50");

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3500);
  };

  // Fetch filter dropdown options and overall statistics
  useEffect(() => {
    if (!accessToken) return;

    const fetchDependencies = async () => {
      setLoadingDependencies(true);
      try {
        const [subRes, facRes, allExamsRes] = await Promise.all([
          apiFetch("/subjects?limit=150", {}, accessToken),
          apiFetch("/faculty?limit=150", {}, accessToken),
          // Fetch high limit for stats calculation
          apiFetch("/examinations?limit=1000", {}, accessToken)
        ]);

        if (subRes.success && subRes.data?.subjects) {
          setSubjects(subRes.data.subjects);
        }
        if (facRes.success && facRes.data?.faculty) {
          setFaculty(facRes.data.faculty);
        }
        if (allExamsRes.success && allExamsRes.data?.exams) {
          const list: ExamSummary[] = allExamsRes.data.exams;
          setStats({
            total: list.length,
            scheduled: list.filter(e => e.status === "Scheduled").length,
            ongoing: list.filter(e => e.status === "Ongoing").length,
            completed: list.filter(e => e.status === "Completed").length,
            cancelled: list.filter(e => e.status === "Cancelled").length
          });
        }
      } catch (err) {
        console.error("Failed to load dependency schemas for examinations admin", err);
      } finally {
        setLoadingDependencies(false);
      }
    };

    fetchDependencies();
  }, [accessToken]);

  // Fetch paginated exams list with filters
  const fetchExams = useCallback(async () => {
    if (!accessToken) return;
    setLoadingList(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });

      if (subjectFilter !== "ALL") queryParams.append("subjectId", subjectFilter);
      if (facultyFilter !== "ALL") queryParams.append("facultyId", facultyFilter);
      if (semesterFilter !== "ALL") queryParams.append("semester", semesterFilter);
      if (sectionFilter.trim()) queryParams.append("section", sectionFilter.trim().toUpperCase());
      if (statusFilter !== "ALL") queryParams.append("status", statusFilter);
      if (dateFilter) queryParams.append("date", dateFilter);

      const res = await apiFetch(`/examinations?${queryParams.toString()}`, {}, accessToken);
      if (res.success && res.data) {
        setExams(res.data.exams || []);
        if (res.data.pagination) {
          setTotalPages(res.data.pagination.totalPages || 1);
          setTotalRecords(res.data.pagination.total || 0);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load examinations schedule logs");
      setExams([]);
    } finally {
      setLoadingList(false);
    }
  }, [page, limit, subjectFilter, facultyFilter, semesterFilter, sectionFilter, statusFilter, dateFilter, accessToken]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchExams();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchExams]);

  // Refresh overall statistics
  const refreshStats = async () => {
    try {
      const res = await apiFetch("/examinations?limit=1000", {}, accessToken);
      if (res.success && res.data?.exams) {
        const list: ExamSummary[] = res.data.exams;
        setStats({
          total: list.length,
          scheduled: list.filter(e => e.status === "Scheduled").length,
          ongoing: list.filter(e => e.status === "Ongoing").length,
          completed: list.filter(e => e.status === "Completed").length,
          cancelled: list.filter(e => e.status === "Cancelled").length
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Open add schedule form
  const openAddDrawer = () => {
    setEditingExam(null);
    setError(null);
    setFormSubjectId(subjects[0]?.id || "");
    setFormFacultyId(faculty[0]?.id || "");
    setFormSection("");
    setFormExamType("Mid-1");
    setFormDate(new Date().toLocaleDateString("en-CA"));
    setFormStartTime("09:30");
    setFormEndTime("11:00");
    setFormMaxMarks("50");
    setDrawerOpen(true);
  };

  // Open edit schedule form
  const openEditDrawer = (exam: ExamSummary) => {
    setEditingExam(exam);
    setError(null);
    // Find matching subject to set form states (Wait, subjectId is from backend detail, but we can set formSubjectId)
    setFormSubjectId(exam.subjectId);
    // Match faculty name to ID from dropdown if possible
    const matchedFaculty = faculty.find(f => f.fullName === exam.facultyName);
    setFormFacultyId(matchedFaculty?.id || "");
    setFormSection(exam.section);
    setFormExamType(exam.examType);
    setFormDate(exam.examDate);
    setFormStartTime(exam.startTime);
    setFormEndTime(exam.endTime);
    setFormMaxMarks(exam.maximumMarks.toString());
    setDrawerOpen(true);
  };

  // Submit form (create / edit)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (!formSubjectId || !formSection || !formDate || !formStartTime || !formEndTime || !formMaxMarks) {
        throw new Error("Please fill in all required fields.");
      }

      if (formEndTime <= formStartTime) {
        throw new Error("End time must be after start time");
      }

      const parsedMaxMarks = Number(formMaxMarks);
      if (isNaN(parsedMaxMarks) || parsedMaxMarks < 1 || parsedMaxMarks > 200) {
        throw new Error("Maximum marks must be a number between 1 and 200");
      }

      if (editingExam) {
        // Edit Mode
        const body = {
          section: formSection.trim().toUpperCase(),
          examDate: formDate,
          startTime: formStartTime,
          endTime: formEndTime,
          maximumMarks: parsedMaxMarks
        };

        const res = await apiFetch(`/examinations/${editingExam.id}`, {
          method: "PATCH",
          body: JSON.stringify(body)
        }, accessToken);

        if (res.success) {
          triggerToast(res.message || "Examination details updated successfully!");
          setDrawerOpen(false);
          fetchExams();
          refreshStats();
        }
      } else {
        // Create Mode
        if (!formFacultyId) {
          throw new Error("Faculty invigilator assignment is required.");
        }

        const body = {
          subjectId: formSubjectId,
          facultyId: formFacultyId,
          section: formSection.trim().toUpperCase(),
          examType: formExamType,
          examDate: formDate,
          startTime: formStartTime,
          endTime: formEndTime,
          maximumMarks: parsedMaxMarks
        };

        const res = await apiFetch("/examinations", {
          method: "POST",
          body: JSON.stringify(body)
        }, accessToken);

        if (res.success) {
          triggerToast(res.message || "New examination scheduled successfully!");
          setDrawerOpen(false);
          fetchExams();
          refreshStats();
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to submit examination details");
    } finally {
      setSubmitting(false);
    }
  };

  // Status transitions
  const transitionStatus = async (examId: string, nextStatus: string) => {
    try {
      const res = await apiFetch(`/examinations/${examId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus })
      }, accessToken);

      if (res.success) {
        triggerToast(`Exam advanced to status ${nextStatus}!`);
        fetchExams();
        refreshStats();
      }
    } catch (err: any) {
      alert(err.message || "Failed to transition examination status");
    }
  };

  // Soft-Delete Examination
  const handleDeleteExam = async () => {
    if (!examToDelete) return;
    try {
      const res = await apiFetch(`/examinations/${examToDelete.id}`, {
        method: "DELETE"
      }, accessToken);

      if (res.success) {
        triggerToast("Examination schedule soft-deleted successfully!");
        setDeleteConfirmOpen(false);
        setExamToDelete(null);
        fetchExams();
        refreshStats();
      }
    } catch (err: any) {
      alert(err.message || "Failed to delete examination schedule");
      setDeleteConfirmOpen(false);
      setExamToDelete(null);
    }
  };

  const handleClearFilters = () => {
    setSubjectFilter("ALL");
    setFacultyFilter("ALL");
    setSemesterFilter("ALL");
    setSectionFilter("");
    setStatusFilter("ALL");
    setDateFilter("");
    setPage(1);
    triggerToast("All directory filters cleared");
  };

  const handleFilterChange = (setter: (v: string) => void, val: string) => {
    setter(val);
    setPage(1);
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "Scheduled": return "text-blue-400 bg-blue-500/10 border-blue-500/20";
      case "Ongoing": return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20 animate-pulse";
      case "Completed": return "text-neutral-400 bg-neutral-500/10 border-neutral-500/20";
      case "Cancelled": return "text-rose-400 bg-rose-500/10 border-rose-500/20";
      default: return "text-neutral-400 bg-neutral-500/10 border-neutral-500/20";
    }
  };

  return (
    <div className="space-y-6 relative">
      
      {/* Toast popup */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-blue-600 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-xl shadow-blue-600/20 border border-blue-400/20 animate-fade-in">
          <Sparkles size={14} className="animate-pulse" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header and create triggers */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-2xl text-white">Examinations Control Center</h2>
          <p className="text-xs text-neutral-400 mt-1">
            Configure examination timetables, assign invigilators, cancel classes, and track evaluation cycles globally.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={openAddDrawer}
            className="px-4 py-2 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition flex items-center gap-1.5"
          >
            <Plus size={14} />
            <span>Create Examination</span>
          </button>
          <button
            onClick={handleClearFilters}
            className="px-4 py-2 text-xs font-semibold rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-355 cursor-pointer transition flex items-center gap-1.5"
          >
            <RefreshCw size={12} />
            <span>Clear Filters</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold rounded-lg flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Statistics dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="glass-card rounded-xl p-4 border border-neutral-800 text-center">
          <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider block">Total Scheduled</span>
          <span className="block text-2xl font-bold text-white mt-1 font-mono">{stats.total}</span>
        </div>
        <div className="glass-card rounded-xl p-4 border border-blue-500/10 bg-blue-500/5 text-center">
          <span className="text-[10px] text-blue-400 uppercase font-bold tracking-wider block">Scheduled</span>
          <span className="block text-2xl font-bold text-blue-400 mt-1 font-mono">{stats.scheduled}</span>
        </div>
        <div className="glass-card rounded-xl p-4 border border-emerald-500/10 bg-emerald-500/5 text-center">
          <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider block">Ongoing</span>
          <span className="block text-2xl font-bold text-emerald-400 mt-1 font-mono">{stats.ongoing}</span>
        </div>
        <div className="glass-card rounded-xl p-4 border border-neutral-800 text-center">
          <span className="text-[10px] text-neutral-400 uppercase font-bold tracking-wider block">Completed</span>
          <span className="block text-2xl font-bold text-neutral-400 mt-1 font-mono">{stats.completed}</span>
        </div>
        <div className="glass-card rounded-xl p-4 border border-rose-500/10 bg-rose-500/5 text-center">
          <span className="text-[10px] text-rose-400 uppercase font-bold tracking-wider block">Cancelled</span>
          <span className="block text-2xl font-bold text-rose-400 mt-1 font-mono">{stats.cancelled}</span>
        </div>
      </div>

      {/* Directory filters panel */}
      <div className="glass-card border border-neutral-800 rounded-xl p-4 space-y-4">
        <div className="flex items-center gap-1.5 text-xs text-neutral-400 pb-2 border-b border-neutral-900">
          <SlidersHorizontal size={14} className="text-blue-500" />
          <span className="font-semibold text-white">Search Filters Panel</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Subject Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-bold text-neutral-500">Subject</label>
            <div className="flex items-center gap-2 bg-neutral-950 border border-neutral-850 rounded px-2.5 text-xs text-white">
              <BookOpen size={12} className="text-neutral-500 shrink-0" />
              <select
                value={subjectFilter}
                onChange={(e) => handleFilterChange(setSubjectFilter, e.target.value)}
                className="bg-transparent text-white cursor-pointer py-2.5 flex-1 focus:outline-none"
                disabled={loadingDependencies}
              >
                <option value="ALL">All Subjects</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.code}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Faculty Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-bold text-neutral-500">Invigilator</label>
            <div className="flex items-center gap-2 bg-neutral-950 border border-neutral-850 rounded px-2.5 text-xs text-white">
              <GraduationCap size={12} className="text-neutral-500 shrink-0" />
              <select
                value={facultyFilter}
                onChange={(e) => handleFilterChange(setFacultyFilter, e.target.value)}
                className="bg-transparent text-white cursor-pointer py-2.5 flex-1 focus:outline-none"
                disabled={loadingDependencies}
              >
                <option value="ALL">All Faculty</option>
                {faculty.map(f => (
                  <option key={f.id} value={f.id}>{f.fullName}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Semester Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-bold text-neutral-500">Semester</label>
            <div className="flex items-center gap-2 bg-neutral-950 border border-neutral-850 rounded px-2.5 text-xs text-white">
              <Filter size={12} className="text-neutral-500 shrink-0" />
              <select
                value={semesterFilter}
                onChange={(e) => handleFilterChange(setSemesterFilter, e.target.value)}
                className="bg-transparent text-white cursor-pointer py-2.5 flex-1 focus:outline-none"
              >
                <option value="ALL">All Semesters</option>
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(sem => (
                  <option key={sem} value={sem.toString()}>Semester {sem}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Section Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-bold text-neutral-500">Section</label>
            <input
              type="text"
              placeholder="e.g. A, B..."
              value={sectionFilter}
              onChange={(e) => handleFilterChange(setSectionFilter, e.target.value)}
              className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-850 rounded text-white focus:outline-none focus:border-neutral-700"
            />
          </div>

          {/* Status Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-bold text-neutral-500">Status</label>
            <div className="flex items-center gap-2 bg-neutral-950 border border-neutral-850 rounded px-2.5 text-xs text-white">
              <Filter size={12} className="text-neutral-500 shrink-0" />
              <select
                value={statusFilter}
                onChange={(e) => handleFilterChange(setStatusFilter, e.target.value)}
                className="bg-transparent text-white cursor-pointer py-2.5 flex-1 focus:outline-none"
              >
                <option value="ALL">All Status</option>
                {["Scheduled", "Ongoing", "Completed", "Cancelled"].map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Date Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-bold text-neutral-500">Exam Date</label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => handleFilterChange(setDateFilter, e.target.value)}
              className="w-full px-3 py-2.5 text-xs bg-neutral-950 border border-neutral-850 rounded text-white focus:outline-none focus:border-neutral-700 font-mono"
            />
          </div>
        </div>
      </div>

      {/* Records table / list grids */}
      <div className="glass-card border border-neutral-800 rounded-xl overflow-hidden">
        
        {/* Desktop View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-neutral-900/50 border-b border-neutral-800 text-neutral-400 font-semibold">
                <th className="px-4 py-3 font-mono">Exam Type</th>
                <th className="px-4 py-3">Subject Course</th>
                <th className="px-4 py-3">Sem & Sec</th>
                <th className="px-4 py-3">Invigilator Faculty</th>
                <th className="px-4 py-3 font-mono">Exam Date</th>
                <th className="px-4 py-3">Time slot</th>
                <th className="px-4 py-3">Max Marks</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900 text-neutral-300">
              {loadingList ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-neutral-500">
                    <Loader2 className="animate-spin text-blue-500 mx-auto mb-2" size={20} />
                    <span className="font-mono text-[10px]">Scanning database logs...</span>
                  </td>
                </tr>
              ) : exams.length > 0 ? (
                exams.map((exam) => {
                  const isTerminal = ["Completed", "Cancelled"].includes(exam.status);
                  return (
                    <tr key={exam.id} className="hover:bg-neutral-900/20 transition">
                      <td className="px-4 py-3 font-mono font-bold text-white text-[10px]">{exam.examType}</td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-white block">{exam.subjectName}</span>
                        <span className="text-[10px] text-neutral-500 font-mono">{exam.subjectCode}</span>
                      </td>
                      <td className="px-4 py-3 font-semibold">Sem {exam.semester} - Section {exam.section}</td>
                      <td className="px-4 py-3 text-neutral-400">{exam.facultyName}</td>
                      <td className="px-4 py-3 font-mono">{exam.examDate}</td>
                      <td className="px-4 py-3 font-mono text-neutral-400">{exam.startTime} - {exam.endTime}</td>
                      <td className="px-4 py-3 font-mono text-center">{exam.maximumMarks}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border capitalize ${getStatusBadgeColor(exam.status)}`}>
                          {exam.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1.5">
                          {/* Reschedule/Edit detail */}
                          {!isTerminal ? (
                            <button
                              onClick={() => openEditDrawer(exam)}
                              title="Edit Schedule details"
                              className="p-1.5 rounded bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 text-neutral-400 hover:text-white cursor-pointer transition"
                            >
                              <Edit size={12} />
                            </button>
                          ) : (
                            <span className="p-1.5 rounded bg-neutral-900/40 border border-neutral-850 text-neutral-600 block cursor-not-allowed">
                              <Lock size={12} />
                            </span>
                          )}

                          {/* Quick Transitions */}
                          {exam.status === "Scheduled" && (
                            <>
                              <button
                                onClick={() => transitionStatus(exam.id, "Ongoing")}
                                title="Advance to Ongoing status"
                                className="p-1.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 cursor-pointer transition"
                              >
                                <Play size={12} />
                              </button>
                              <button
                                onClick={() => transitionStatus(exam.id, "Cancelled")}
                                title="Cancel Examination schedule"
                                className="p-1.5 rounded bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 cursor-pointer transition"
                              >
                                <X size={12} />
                              </button>
                            </>
                          )}

                          {exam.status === "Ongoing" && (
                            <>
                              <button
                                onClick={() => transitionStatus(exam.id, "Completed")}
                                title="Mark cycle Completed"
                                className="p-1.5 rounded bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 cursor-pointer transition"
                              >
                                <CheckSquare size={12} />
                              </button>
                              <button
                                onClick={() => transitionStatus(exam.id, "Cancelled")}
                                title="Cancel active session"
                                className="p-1.5 rounded bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 cursor-pointer transition"
                              >
                                <X size={12} />
                              </button>
                            </>
                          )}

                          {/* Delete schedule (only if not Completed) */}
                          {exam.status !== "Completed" && (
                            <button
                              onClick={() => {
                                setExamToDelete({ id: exam.id, subjectName: exam.subjectName, examType: exam.examType });
                                setDeleteConfirmOpen(true);
                              }}
                              title="Delete examination schedule record"
                              className="p-1.5 rounded bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 text-rose-500 hover:text-rose-400 cursor-pointer transition"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-neutral-500 font-mono">
                    No examination records found in database.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View */}
        <div className="block md:hidden divide-y divide-neutral-900">
          {loadingList ? (
            <div className="text-center py-12 text-neutral-500">
              <Loader2 className="animate-spin text-blue-500 mx-auto mb-2" size={20} />
              <span className="font-mono text-[10px]">Scanning database logs...</span>
            </div>
          ) : exams.length > 0 ? (
            exams.map((exam) => {
              const isTerminal = ["Completed", "Cancelled"].includes(exam.status);
              return (
                <div key={exam.id} className="p-4 flex flex-col gap-2.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-neutral-500 tracking-wider font-mono">{exam.examType}</span>
                      <h4 className="text-sm font-bold text-white leading-tight mt-0.5">{exam.subjectName}</h4>
                      <span className="text-[10px] text-neutral-500 font-mono mt-0.5 block">
                        {exam.subjectCode} / Section {exam.section}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold border capitalize shrink-0 ${getStatusBadgeColor(exam.status)}`}>
                      {exam.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-[10px] text-neutral-350 font-mono pt-2 border-t border-neutral-900">
                    <div>
                      <span className="text-neutral-500 block text-[9px] uppercase font-bold tracking-wider mb-0.5">Invigilator</span>
                      <span className="font-sans text-neutral-200">{exam.facultyName}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500 block text-[9px] uppercase font-bold tracking-wider mb-0.5">Semester</span>
                      <span>Semester {exam.semester}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500 block text-[9px] uppercase font-bold tracking-wider mb-0.5">Date</span>
                      <span>{exam.examDate}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500 block text-[9px] uppercase font-bold tracking-wider mb-0.5">Time slot</span>
                      <span>{exam.startTime} - {exam.endTime}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-neutral-500 block text-[9px] uppercase font-bold tracking-wider mb-0.5">Maximum Marks</span>
                      <span>{exam.maximumMarks} Marks</span>
                    </div>
                  </div>

                  {/* Actions mobile panel */}
                  <div className="flex flex-wrap gap-2 justify-end pt-2 border-t border-neutral-900">
                    {!isTerminal ? (
                      <button
                        onClick={() => openEditDrawer(exam)}
                        className="px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-750 text-neutral-300 border border-neutral-700 text-[10px] font-semibold cursor-pointer transition flex items-center gap-1"
                      >
                        <Edit size={11} />
                        <span>Reschedule</span>
                      </button>
                    ) : (
                      <span className="px-3 py-1.5 rounded bg-neutral-950 text-neutral-600 border border-neutral-900 text-[10px] font-semibold cursor-not-allowed flex items-center gap-1">
                        <Lock size={11} />
                        <span>Locked</span>
                      </span>
                    )}

                    {exam.status === "Scheduled" && (
                      <>
                        <button
                          onClick={() => transitionStatus(exam.id, "Ongoing")}
                          className="px-3 py-1.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold cursor-pointer transition flex items-center gap-1"
                        >
                          <Play size={11} />
                          <span>Start</span>
                        </button>
                        <button
                          onClick={() => transitionStatus(exam.id, "Cancelled")}
                          className="px-3 py-1.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-[10px] font-semibold cursor-pointer transition flex items-center gap-1"
                        >
                          <X size={11} />
                          <span>Cancel</span>
                        </button>
                      </>
                    )}

                    {exam.status === "Ongoing" && (
                      <>
                        <button
                          onClick={() => transitionStatus(exam.id, "Completed")}
                          className="px-3 py-1.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 text-[10px] font-semibold cursor-pointer transition flex items-center gap-1"
                        >
                          <CheckSquare size={11} />
                          <span>Complete</span>
                        </button>
                        <button
                          onClick={() => transitionStatus(exam.id, "Cancelled")}
                          className="px-3 py-1.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-[10px] font-semibold cursor-pointer transition flex items-center gap-1"
                        >
                          <X size={11} />
                          <span>Cancel</span>
                        </button>
                      </>
                    )}

                    {exam.status !== "Completed" && (
                      <button
                        onClick={() => {
                          setExamToDelete({ id: exam.id, subjectName: exam.subjectName, examType: exam.examType });
                          setDeleteConfirmOpen(true);
                        }}
                        className="p-1.5 rounded bg-neutral-800 hover:bg-neutral-750 border border-neutral-750 text-rose-500 hover:text-rose-400 transition"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 text-neutral-500 font-mono text-xs">
              No examination records found in database.
            </div>
          )}
        </div>

        {/* Pagination Block */}
        {!loadingList && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-neutral-850 p-4 bg-neutral-950/30">
            <div className="text-[10px] font-mono text-neutral-500">
              Showing {(page - 1) * limit + 1} - {Math.min(page * limit, totalRecords)} of {totalRecords} exams
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="p-1.5 rounded bg-neutral-905 border border-neutral-850 hover:bg-neutral-800 disabled:opacity-40 text-neutral-400 hover:text-white cursor-pointer disabled:cursor-not-allowed transition"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-[10px] font-mono text-white font-bold px-2">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
                className="p-1.5 rounded bg-neutral-905 border border-neutral-850 hover:bg-neutral-800 disabled:opacity-40 text-neutral-400 hover:text-white cursor-pointer disabled:cursor-not-allowed transition"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit slideover form drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-neutral-950/70 backdrop-blur-sm animate-fade-in">
          {/* Backdrop Click */}
          <div className="absolute inset-0 cursor-default" onClick={() => setDrawerOpen(false)}></div>

          {/* Drawer Panel */}
          <div className="relative w-full max-w-md h-full bg-neutral-900 border-l border-neutral-800 p-6 flex flex-col shadow-2xl z-10 overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4 mb-4">
              <h3 className="font-display font-bold text-white text-lg flex items-center gap-2">
                <Sparkles size={18} className="text-blue-500" />
                <span>{editingExam ? "Edit Examination details" : "Schedule New Examination"}</span>
              </h3>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1 rounded bg-neutral-850 hover:bg-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Error notifications */}
            {error && (
              <div className="p-3 mb-4 rounded bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-semibold">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                
                {/* Subject selection (Read-only if editing) */}
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">Subject Course <span className="text-rose-500">*</span></label>
                  <select
                    required
                    disabled={!!editingExam || subjects.length === 0}
                    value={formSubjectId}
                    onChange={(e) => setFormSubjectId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded text-white disabled:opacity-50 focus:outline-none focus:border-blue-600 transition cursor-pointer"
                  >
                    <option value="">Select Subject</option>
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.code}: {s.name}</option>
                    ))}
                  </select>
                </div>

                {/* Faculty selection (Read-only if editing) */}
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">Invigilator Faculty <span className="text-rose-500">*</span></label>
                  <select
                    required
                    disabled={!!editingExam || faculty.length === 0}
                    value={formFacultyId}
                    onChange={(e) => setFormFacultyId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded text-white disabled:opacity-50 focus:outline-none focus:border-blue-600 transition cursor-pointer"
                  >
                    <option value="">Assign Faculty</option>
                    {faculty.map(f => (
                      <option key={f.id} value={f.id}>{f.fullName} ({f.employeeNumber})</option>
                    ))}
                  </select>
                </div>

                {/* Target Section (Always editable) */}
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">Target Section <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formSection}
                    onChange={(e) => setFormSection(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded text-white focus:outline-none focus:border-blue-600 transition"
                    placeholder="e.g. A"
                  />
                </div>

                {/* Exam Type (Read-only if editing) */}
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">Evaluation Cycle <span className="text-rose-500">*</span></label>
                  <select
                    required
                    disabled={!!editingExam}
                    value={formExamType}
                    onChange={(e) => setFormExamType(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded text-white disabled:opacity-50 focus:outline-none focus:border-blue-600 transition cursor-pointer"
                  >
                    {["Mid-1", "Mid-2", "Lab Exam", "Internal", "End Semester"].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {/* Date Picker */}
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">Exam Date <span className="text-rose-500">*</span></label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded text-white focus:outline-none focus:border-blue-600 transition"
                  />
                </div>

                {/* Time picker selectors */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">Start Time <span className="text-rose-500">*</span></label>
                    <input
                      type="time"
                      required
                      value={formStartTime}
                      onChange={(e) => setFormStartTime(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded text-white focus:outline-none focus:border-blue-600 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">End Time <span className="text-rose-500">*</span></label>
                    <input
                      type="time"
                      required
                      value={formEndTime}
                      onChange={(e) => setFormEndTime(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded text-white focus:outline-none focus:border-blue-600 transition"
                    />
                  </div>
                </div>

                {/* Maximum Marks */}
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">Maximum Marks <span className="text-rose-500">*</span></label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={200}
                    value={formMaxMarks}
                    onChange={(e) => setFormMaxMarks(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded text-white focus:outline-none focus:border-blue-600 transition"
                    placeholder="e.g. 50"
                  />
                </div>

              </div>

              {/* Drawer actions */}
              <div className="flex items-center gap-3 pt-6 border-t border-neutral-800 mt-6">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="flex-1 py-2 text-xs font-semibold rounded bg-neutral-800 hover:bg-neutral-750 text-neutral-300 hover:text-white cursor-pointer transition text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition flex items-center justify-center gap-1.5"
                >
                  {submitting && <Loader2 size={12} className="animate-spin" />}
                  <span>{editingExam ? "Save Changes" : "Create Schedule"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation dialogue modal overlay */}
      {deleteConfirmOpen && examToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-xl max-w-sm w-full mx-4 shadow-2xl animate-scale-up space-y-4">
            <h3 className="font-display font-bold text-white text-base">De-register Examination?</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Are you sure you want to delete the scheduled <strong className="text-white">{examToDelete.examType}</strong> exam for <strong className="text-white">{examToDelete.subjectName}</strong>? This action will clear the schedule from students&apos; rosters and cannot be undone.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setExamToDelete(null);
                }}
                className="flex-1 py-2 rounded bg-neutral-800 hover:bg-neutral-750 text-neutral-300 font-bold text-xs cursor-pointer transition"
              >
                No, Keep
              </button>
              <button
                onClick={handleDeleteExam}
                className="flex-1 py-2 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer transition"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
