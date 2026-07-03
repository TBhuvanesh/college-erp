"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { 
  Plus, 
  Edit, 
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
  Search
} from "lucide-react";

// Domain structures
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

interface FacultyProfile {
  id: string;
  fullName: string;
  employeeId: string;
  departmentId: string;
}

export default function FacultyExaminations() {
  const { accessToken } = useAuth();

  // Data states
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [assignments, setAssignments] = useState<AssignmentDetail[]>([]);
  const [profile, setProfile] = useState<FacultyProfile | null>(null);

  // Filter states
  const [selectedSubject, setSelectedSubject] = useState("ALL");
  const [selectedSection, setSelectedSection] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  // Loading & error feedback
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState("");

  // Drawer / form modal states
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamSummary | null>(null);

  // Form Fields
  const [formSubjectId, setFormSubjectId] = useState("");
  const [formSection, setFormSection] = useState("");
  const [formExamType, setFormExamType] = useState("Mid-1");
  const [formDate, setFormDate] = useState("");
  const [formStartTime, setFormStartTime] = useState("");
  const [formEndTime, setFormEndTime] = useState("");
  const [formMaxMarks, setFormMaxMarks] = useState("50");

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  };

  // 1. Fetch Schedule
  const fetchSchedule = useCallback(async () => {
    if (!accessToken) return;
    setLoadingSchedule(true);
    try {
      const res = await apiFetch("/examinations/my-schedule", {}, accessToken);
      if (res.success && res.data?.exams) {
        setExams(res.data.exams);
      }
    } catch (err: any) {
      console.error("Failed to fetch exams schedule", err);
    } finally {
      setLoadingSchedule(false);
    }
  }, [accessToken]);

  // 2. Fetch Assignments & Profile
  useEffect(() => {
    if (!accessToken) return;
    
    const fetchWorkloadAndProfile = async () => {
      setLoadingAssignments(true);
      setError(null);
      try {
        const [assignmentsRes, profileRes] = await Promise.all([
          apiFetch("/attendance/my-assignments", {}, accessToken),
          apiFetch("/faculty/me", {}, accessToken)
        ]);

        if (assignmentsRes.success && assignmentsRes.data?.assignments) {
          const activeAssignments = assignmentsRes.data.assignments.filter((a: AssignmentDetail) => a.isActive);
          setAssignments(activeAssignments);
        }
        if (profileRes.success && profileRes.data?.profile) {
          setProfile(profileRes.data.profile);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load subjects workload data");
      } finally {
        setLoadingAssignments(false);
      }
    };

    const timer = setTimeout(() => {
      fetchWorkloadAndProfile();
      fetchSchedule();
    }, 0);
    return () => clearTimeout(timer);
  }, [accessToken, fetchSchedule]);

  // Handle drawer open for Add mode
  const openAddDrawer = () => {
    setEditingExam(null);
    setError(null);
    
    // Default form fields
    if (assignments.length > 0) {
      setFormSubjectId(assignments[0].subjectId);
      setFormSection(assignments[0].section);
    } else {
      setFormSubjectId("");
      setFormSection("");
    }
    setFormExamType("Mid-1");
    setFormDate(new Date().toLocaleDateString("en-CA")); // today YYYY-MM-DD
    setFormStartTime("09:30");
    setFormEndTime("11:00");
    setFormMaxMarks("50");
    setDrawerOpen(true);
  };

  // Handle drawer open for Edit mode
  const openEditDrawer = (exam: ExamSummary) => {
    setEditingExam(exam);
    setError(null);
    setFormSubjectId(exam.subjectId);
    setFormSection(exam.section);
    setFormExamType(exam.examType);
    setFormDate(exam.examDate);
    setFormStartTime(exam.startTime);
    setFormEndTime(exam.endTime);
    setFormMaxMarks(exam.maximumMarks.toString());
    setDrawerOpen(true);
  };

  // Submit create or edit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (!formSubjectId || !formSection || !formDate || !formStartTime || !formEndTime || !formMaxMarks) {
        throw new Error("Please fill in all fields.");
      }

      if (formEndTime <= formStartTime) {
        throw new Error("End time must be after start time");
      }

      const parsedMaxMarks = Number(formMaxMarks);
      if (isNaN(parsedMaxMarks) || parsedMaxMarks < 1 || parsedMaxMarks > 200) {
        throw new Error("Maximum marks must be a number between 1 and 200");
      }

      const todayStr = new Date().toLocaleDateString("en-CA");

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
          fetchSchedule();
        }
      } else {
        // Add Mode
        // Determine the facultyId to pass
        const resolvedFacultyId = profile?.id || assignments[0]?.facultyId;
        if (!resolvedFacultyId) {
          throw new Error("Unable to resolve faculty profile ID. Try logging in again.");
        }

        if (formDate < todayStr) {
          throw new Error("Examination date cannot be in the past");
        }

        const body = {
          subjectId: formSubjectId,
          facultyId: resolvedFacultyId,
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
          triggerToast(res.message || "Examination scheduled successfully!");
          setDrawerOpen(false);
          fetchSchedule();
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to submit examination form");
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
        triggerToast(`Exam status advanced to ${nextStatus}!`);
        fetchSchedule();
      }
    } catch (err: any) {
      alert(err.message || "Failed to update exam status");
    }
  };

  // Filters mapping
  const uniqueSubjects = Array.from(
    new Map(assignments.map(a => [a.subjectId, { id: a.subjectId, code: a.subjectCode, name: a.subjectName }])).values()
  );

  const sectionsForSelectedSubject = assignments
    .filter(a => selectedSubject === "ALL" || a.subjectId === selectedSubject)
    .map(a => a.section);

  const uniqueSections = Array.from(new Set(sectionsForSelectedSubject)).sort();

  // Filter exam schedule
  const filteredExams = exams.filter(e => {
    const matchSub = selectedSubject === "ALL" || e.subjectId === selectedSubject;
    const matchSec = selectedSection === "ALL" || e.section === selectedSection;
    const matchSearch = searchTerm.trim() === "" || 
      e.subjectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.subjectCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.examType.toLowerCase().includes(searchTerm.toLowerCase());
    return matchSub && matchSec && matchSearch;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Scheduled": return "dark:text-blue-400 text-blue-700 dark:bg-blue-500/10 bg-blue-50 border dark:border-blue-500/20 border-blue-200";
      case "Ongoing": return "dark:text-emerald-400 text-emerald-700 dark:bg-emerald-500/10 bg-emerald-50 border dark:border-emerald-500/20 border-emerald-200 animate-pulse";
      case "Completed": return "dark:text-neutral-400 text-text-secondary dark:bg-neutral-500/10 bg-neutral-100 border dark:border-neutral-500/20 border-border-subtle";
      case "Cancelled": return "dark:text-rose-400 text-rose-700 dark:bg-rose-500/10 bg-rose-50 border dark:border-rose-500/20 border-rose-200";
      default: return "dark:text-neutral-400 text-text-secondary dark:bg-neutral-500/10 bg-neutral-100 border dark:border-neutral-500/20 border-border-subtle";
    }
  };

  return (
    <div className="relative">
      
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-emerald-600 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-xl shadow-emerald-600/20 border border-emerald-400/20 animate-fade-in">
          <Sparkles size={14} className="animate-pulse" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="font-display font-bold text-2xl dark:text-white text-text-primary">Examinations Workspace</h2>
          <p className="text-xs dark:text-neutral-400 text-text-secondary mt-1">
            Schedule evaluations, manage active class exam checklists, and track upcoming invigilation slots.
          </p>
        </div>

        <button
          onClick={openAddDrawer}
          className="px-4 py-2 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition flex items-center gap-1.5 self-start md:self-auto"
        >
          <Plus size={14} />
          <span>Schedule Examination</span>
        </button>
      </div>

      {/* Filters & search bars */}
      <div className="glass-card border border-border-subtle rounded-xl p-4 mb-6 flex flex-col md:flex-row gap-3">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-4 h-4 dark:text-neutral-500 text-text-muted" />
          <input
            type="text"
            placeholder="Search exams by subject or type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-xs dark:bg-neutral-950 bg-surface border dark:border-neutral-800 border-border-subtle rounded dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition"
          />
        </div>

        {/* Subject Filter */}
        <div className="w-full md:w-56 flex items-center gap-2 dark:bg-neutral-950 bg-surface border dark:border-neutral-800 border-border-subtle rounded px-2 text-xs dark:text-white text-text-primary">
          <BookOpen size={12} className="dark:text-neutral-500 text-text-muted" />
          <span className="dark:text-neutral-500 text-text-muted">Subject:</span>
          <select
            value={selectedSubject}
            onChange={(e) => {
              setSelectedSubject(e.target.value);
              setSelectedSection("ALL");
            }}
            className="bg-transparent dark:text-white text-text-primary cursor-pointer py-2.5 flex-1 focus:outline-none font-semibold"
          >
            <option value="ALL">All Subjects</option>
            {uniqueSubjects.map(sub => (
              <option key={sub.id} value={sub.id}>
                {sub.code}
              </option>
            ))}
          </select>
        </div>

        {/* Section Filter */}
        <div className="w-full md:w-36 flex items-center gap-2 dark:bg-neutral-950 bg-surface border dark:border-neutral-800 border-border-subtle rounded px-2 text-xs dark:text-white text-text-primary">
          <Filter size={12} className="dark:text-neutral-500 text-text-muted" />
          <span className="dark:text-neutral-500 text-text-muted">Sec:</span>
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            className="bg-transparent dark:text-white text-text-primary cursor-pointer py-2.5 flex-1 focus:outline-none font-bold"
          >
            <option value="ALL">All Sec</option>
            {uniqueSections.map(sec => (
              <option key={sec} value={sec}>
                Section {sec}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Grid: Workload (Left 30%) and Schedules (Right 70%) */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        
        {/* Left Column: Workload Assigned Subjects */}
        <div className="w-full lg:w-80 glass-card border border-border-subtle rounded-xl p-4 shrink-0 space-y-4">
          <div className="flex items-center gap-1.5 border-b border-border-subtle pb-2 dark:text-white text-text-primary">
            <BookOpen size={16} className="text-blue-400" />
            <h3 className="font-display font-bold text-sm">Your Academic Workload</h3>
          </div>

          <div className="space-y-2.5">
            {loadingAssignments ? (
              <div className="py-6 flex justify-center">
                <Loader2 className="animate-spin text-blue-500" size={20} />
              </div>
            ) : assignments.length > 0 ? (
              assignments.map((asg) => {
                // Count exams scheduled for this assignment
                const examCount = exams.filter(e => e.subjectId === asg.subjectId && e.section === asg.section).length;
                return (
                  <div key={asg.id} className="p-3 rounded-lg border border-border-subtle dark:bg-neutral-955 bg-surface space-y-1">
                    <h4 className="text-xs font-bold dark:text-white text-text-primary leading-tight">{asg.subjectName}</h4>
                    <p className="text-[10px] dark:text-neutral-500 text-text-muted font-mono">Code: {asg.subjectCode} / Sem: {asg.semester}</p>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-border-subtle text-[9px] dark:text-neutral-400 text-text-secondary font-mono">
                      <span>Section: <strong className="dark:text-white text-text-primary">{asg.section}</strong></span>
                      <span className="dark:bg-neutral-800 bg-neutral-100 dark:text-neutral-300 text-text-secondary px-1.5 py-0.5 rounded">
                        {examCount} scheduled
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-[10px] dark:text-neutral-500 text-text-muted font-mono italic text-center py-6">
                No teaching workload assignments found.
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Schedules List */}
        <div className="flex-1 w-full space-y-4">
          {loadingSchedule ? (
            <div className="text-center py-16 dark:text-neutral-500 text-text-muted glass-card border border-border-subtle rounded-xl">
              <Loader2 className="animate-spin text-blue-500 mx-auto mb-2" size={24} />
              <span className="font-mono text-xs">Accessing exams schedule registry...</span>
            </div>
          ) : filteredExams.length > 0 ? (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block glass-card border border-border-subtle rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="dark:bg-neutral-900/50 bg-neutral-100/50 border-b border-border-subtle dark:text-neutral-400 text-text-secondary font-semibold">
                      <th className="px-4 py-3 font-mono">Exam Type</th>
                      <th className="px-4 py-3">Subject</th>
                      <th className="px-4 py-3">Sec</th>
                      <th className="px-4 py-3">Sem</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Time</th>
                      <th className="px-4 py-3">Max Marks</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-neutral-900 divide-border-subtle dark:text-neutral-300 text-text-secondary">
                    {filteredExams.map((exam) => {
                      const isTerminal = ["Completed", "Cancelled"].includes(exam.status);
                      return (
                        <tr key={exam.id} className="dark:hover:bg-neutral-900/30 hover:bg-neutral-100/50 transition">
                          <td className="px-4 py-3 font-mono font-bold dark:text-white text-text-primary text-[10px]">
                            {exam.examType}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-semibold dark:text-white text-text-primary block">{exam.subjectName}</span>
                            <span className="text-[10px] dark:text-neutral-500 text-text-muted font-mono">{exam.subjectCode}</span>
                          </td>
                          <td className="px-4 py-3 font-mono font-bold">{exam.section}</td>
                          <td className="px-4 py-3 font-mono">Sem {exam.semester}</td>
                          <td className="px-4 py-3 font-mono">{exam.examDate}</td>
                          <td className="px-4 py-3 font-mono dark:text-neutral-400 text-text-secondary">{exam.startTime} - {exam.endTime}</td>
                          <td className="px-4 py-3 font-mono text-center">{exam.maximumMarks}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border capitalize ${getStatusColor(exam.status)}`}>
                              {exam.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-1.5">
                              {/* Edit details */}
                              {!isTerminal ? (
                                <button
                                  onClick={() => openEditDrawer(exam)}
                                  title="Edit Schedule details"
                                  className="p-1.5 rounded dark:bg-neutral-800 bg-surface dark:hover:bg-neutral-750 hover:bg-surface-hover border border-border-subtle dark:text-neutral-400 text-text-secondary hover:text-text-primary cursor-pointer transition"
                                >
                                  <Edit size={12} />
                                </button>
                              ) : (
                                <span className="p-1.5 rounded dark:bg-neutral-900/40 bg-neutral-105/45 border border-border-subtle text-neutral-400 block cursor-not-allowed">
                                  <Lock size={12} />
                                </span>
                              )}

                              {/* Start Exam action */}
                              {exam.status === "Scheduled" && (
                                <button
                                  onClick={() => transitionStatus(exam.id, "Ongoing")}
                                  title="Start Exam Session"
                                  className="p-1.5 rounded dark:bg-emerald-500/10 bg-emerald-50 dark:hover:bg-emerald-500/20 hover:bg-emerald-100 border dark:border-emerald-500/30 border-emerald-200 text-emerald-700 cursor-pointer transition"
                                >
                                  <Play size={12} />
                                </button>
                              )}

                              {/* Complete Exam action */}
                              {exam.status === "Ongoing" && (
                                <button
                                  onClick={() => transitionStatus(exam.id, "Completed")}
                                  title="Complete Exam Session"
                                  className="p-1.5 rounded dark:bg-blue-500/10 bg-blue-50 dark:hover:bg-blue-500/20 hover:bg-blue-100 border dark:border-blue-500/30 border-blue-200 text-blue-700 cursor-pointer transition"
                                >
                                  <CheckSquare size={12} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="block md:hidden space-y-3">
                {filteredExams.map((exam) => {
                  const isTerminal = ["Completed", "Cancelled"].includes(exam.status);
                  return (
                    <div key={exam.id} className="glass-card border border-border-subtle rounded-xl p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[9px] uppercase font-bold dark:text-neutral-500 text-text-muted tracking-wider font-mono">{exam.examType}</span>
                          <h4 className="text-sm font-bold dark:text-white text-text-primary leading-tight mt-0.5">{exam.subjectName}</h4>
                          <span className="text-[10px] dark:text-neutral-500 text-text-muted font-mono mt-0.5 block">
                            {exam.subjectCode} / Section {exam.section}
                          </span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold border capitalize shrink-0 ${getStatusColor(exam.status)}`}>
                          {exam.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-[10px] dark:text-neutral-350 text-text-secondary font-mono pt-2 border-t border-border-subtle">
                        <div>
                          <span className="dark:text-neutral-500 text-text-muted block text-[9px] uppercase font-bold tracking-wider mb-0.5">Semester</span>
                          <span>Semester {exam.semester}</span>
                        </div>
                        <div>
                          <span className="dark:text-neutral-500 text-text-muted block text-[9px] uppercase font-bold tracking-wider mb-0.5">Max Marks</span>
                          <span>{exam.maximumMarks} Marks</span>
                        </div>
                        <div>
                          <span className="dark:text-neutral-500 text-text-muted block text-[9px] uppercase font-bold tracking-wider mb-0.5">Exam Date</span>
                          <span>{exam.examDate}</span>
                        </div>
                        <div>
                          <span className="dark:text-neutral-500 text-text-muted block text-[9px] uppercase font-bold tracking-wider mb-0.5">Time slot</span>
                          <span>{exam.startTime} - {exam.endTime}</span>
                        </div>
                      </div>

                      {/* Mobile Action buttons */}
                      <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
                        {!isTerminal ? (
                          <button
                            onClick={() => openEditDrawer(exam)}
                            className="px-3 py-1.5 rounded dark:bg-neutral-800 bg-surface dark:hover:bg-neutral-750 hover:bg-surface-hover dark:text-neutral-300 text-text-secondary border border-border-subtle text-[10px] font-semibold cursor-pointer transition flex items-center gap-1"
                          >
                            <Edit size={11} />
                            <span>Reschedule</span>
                          </button>
                        ) : (
                          <span className="px-3 py-1.5 rounded dark:bg-neutral-950 bg-neutral-100 dark:text-neutral-600 text-neutral-400 border border-border-subtle text-[10px] font-semibold cursor-not-allowed flex items-center gap-1">
                            <Lock size={11} />
                            <span>Locked</span>
                          </span>
                        )}

                        {exam.status === "Scheduled" && (
                          <button
                            onClick={() => transitionStatus(exam.id, "Ongoing")}
                            className="px-3 py-1.5 rounded dark:bg-emerald-500/10 bg-emerald-50 dark:hover:bg-emerald-500/20 hover:bg-emerald-100 dark:text-emerald-400 text-emerald-700 border border-emerald-500/20 text-[10px] font-semibold cursor-pointer transition flex items-center gap-1"
                          >
                            <Play size={11} />
                            <span>Start Exam</span>
                          </button>
                        )}

                        {exam.status === "Ongoing" && (
                          <button
                            onClick={() => transitionStatus(exam.id, "Completed")}
                            className="px-3 py-1.5 rounded dark:bg-blue-500/10 bg-blue-50 dark:hover:bg-blue-500/20 hover:bg-blue-100 dark:text-blue-400 text-blue-700 border border-blue-500/20 text-[10px] font-semibold cursor-pointer transition flex items-center gap-1"
                          >
                            <CheckSquare size={11} />
                            <span>Mark Completed</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="p-12 text-center glass-card border border-border-subtle rounded-xl dark:text-neutral-500 text-text-muted font-mono text-xs">
              No scheduled examinations found in records.
            </div>
          )}
        </div>

      </div>

      {/* Slide-out Scheduling/Rescheduling Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end dark:bg-neutral-950/70 bg-neutral-800/40 backdrop-blur-sm animate-fade-in">
          {/* Backdrop Click */}
          <div className="absolute inset-0 cursor-default" onClick={() => setDrawerOpen(false)}></div>

          {/* Drawer Sheet */}
          <div className="relative w-full max-w-md h-full dark:bg-neutral-900 bg-surface border-l dark:border-neutral-800 border-border-subtle p-6 flex flex-col shadow-2xl z-10 overflow-y-auto">
            
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b dark:border-neutral-800 border-border-subtle pb-4 mb-4">
              <h3 className="font-display font-bold dark:text-white text-text-primary text-lg flex items-center gap-2">
                <Sparkles size={18} className="text-blue-500" />
                <span>{editingExam ? "Edit Examination Schedule" : "Schedule New Examination"}</span>
              </h3>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1 rounded dark:bg-neutral-850 bg-neutral-105 hover:bg-neutral-200 dark:hover:bg-neutral-800 dark:text-neutral-400 text-text-secondary cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Inline Error messages */}
            {error && (
              <div className="p-3 mb-4 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs font-semibold">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                
                {/* Subject Mappings (Read-only if editing) */}
                <div>
                  <label className="block text-[10px] font-bold dark:text-neutral-400 text-text-secondary uppercase mb-1">Assigned Subject <span className="text-rose-500">*</span></label>
                  <select
                    required
                    disabled={!!editingExam || assignments.length === 0}
                    value={formSubjectId}
                    onChange={(e) => {
                      setFormSubjectId(e.target.value);
                      // Default section to first mapped section for that subject
                      const matched = assignments.find(a => a.subjectId === e.target.value);
                      if (matched) setFormSection(matched.section);
                    }}
                    className="w-full px-3 py-2 text-xs dark:bg-neutral-950 bg-background border dark:border-neutral-800 border-border-subtle rounded dark:text-white text-text-primary disabled:opacity-60 focus:outline-none focus:border-blue-600 transition cursor-pointer"
                  >
                    <option value="">Select Subject</option>
                    {uniqueSubjects.map(sub => (
                      <option key={sub.id} value={sub.id}>
                        {sub.code}: {sub.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Section selection (Read-only if editing, because it maps to identity constraints) */}
                <div>
                  <label className="block text-[10px] font-bold dark:text-neutral-400 text-text-secondary uppercase mb-1">Target Section <span className="text-rose-500">*</span></label>
                  {editingExam ? (
                    <input
                      type="text"
                      required
                      value={formSection}
                      onChange={(e) => setFormSection(e.target.value)}
                      className="w-full px-3 py-2 text-xs dark:bg-neutral-950 bg-background border dark:border-neutral-800 border-border-subtle rounded dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition"
                      placeholder="e.g. A"
                    />
                  ) : (
                    <select
                      required
                      disabled={!formSubjectId}
                      value={formSection}
                      onChange={(e) => setFormSection(e.target.value)}
                      className="w-full px-3 py-2 text-xs dark:bg-neutral-950 bg-background border dark:border-neutral-800 border-border-subtle rounded dark:text-white text-text-primary disabled:opacity-60 focus:outline-none focus:border-blue-600 transition cursor-pointer"
                    >
                      <option value="">Select Section</option>
                      {assignments
                        .filter(a => a.subjectId === formSubjectId)
                        .map(a => (
                          <option key={a.id} value={a.section}>
                            Section {a.section} (Sem {a.semester})
                          </option>
                        ))}
                    </select>
                  )}
                </div>

                {/* Exam Type selection (Read-only if editing) */}
                <div>
                  <label className="block text-[10px] font-bold dark:text-neutral-400 text-text-secondary uppercase mb-1">Evaluation Cycle <span className="text-rose-500">*</span></label>
                  <select
                    required
                    disabled={!!editingExam}
                    value={formExamType}
                    onChange={(e) => setFormExamType(e.target.value)}
                    className="w-full px-3 py-2 text-xs dark:bg-neutral-950 bg-background border dark:border-neutral-800 border-border-subtle rounded dark:text-white text-text-primary disabled:opacity-60 focus:outline-none focus:border-blue-600 transition cursor-pointer"
                  >
                    {["Mid-1", "Mid-2", "Lab Exam", "Internal", "End Semester"].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {/* Exam Datepicker */}
                <div>
                  <label className="block text-[10px] font-bold dark:text-neutral-400 text-text-secondary uppercase mb-1">Exam Date <span className="text-rose-500">*</span></label>
                  <input
                    type="date"
                    required
                    min={editingExam ? undefined : new Date().toLocaleDateString("en-CA")}
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs dark:bg-neutral-950 bg-background border dark:border-neutral-800 border-border-subtle rounded dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition"
                  />
                </div>

                {/* Time Slots */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold dark:text-neutral-400 text-text-secondary uppercase mb-1">Start Time <span className="text-rose-500">*</span></label>
                    <input
                      type="time"
                      required
                      value={formStartTime}
                      onChange={(e) => setFormStartTime(e.target.value)}
                      className="w-full px-3 py-2 text-xs dark:bg-neutral-950 bg-background border dark:border-neutral-800 border-border-subtle rounded dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold dark:text-neutral-400 text-text-secondary uppercase mb-1">End Time <span className="text-rose-500">*</span></label>
                    <input
                      type="time"
                      required
                      value={formEndTime}
                      onChange={(e) => setFormEndTime(e.target.value)}
                      className="w-full px-3 py-2 text-xs dark:bg-neutral-950 bg-background border dark:border-neutral-800 border-border-subtle rounded dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition"
                    />
                  </div>
                </div>

                {/* Maximum Marks */}
                <div>
                  <label className="block text-[10px] font-bold dark:text-neutral-400 text-text-secondary uppercase mb-1">Maximum Marks <span className="text-rose-500">*</span></label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={200}
                    value={formMaxMarks}
                    onChange={(e) => setFormMaxMarks(e.target.value)}
                    className="w-full px-3 py-2 text-xs dark:bg-neutral-950 bg-background border dark:border-neutral-800 border-border-subtle rounded dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition"
                    placeholder="e.g. 50"
                  />
                  <span className="text-[9px] dark:text-neutral-500 text-text-muted mt-1 block">Maximum limits: 200 marks.</span>
                </div>

              </div>

              {/* Drawer actions */}
              <div className="flex items-center gap-3 pt-6 border-t dark:border-neutral-800 border-border-subtle mt-6">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="flex-1 py-2 text-xs font-semibold rounded dark:bg-neutral-800 bg-neutral-100 dark:hover:bg-neutral-750 hover:bg-neutral-200 dark:text-neutral-300 text-text-primary cursor-pointer transition text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition text-center flex items-center justify-center gap-1.5"
                >
                  {submitting && <Loader2 size={12} className="animate-spin" />}
                  <span>{editingExam ? "Save Changes" : "Schedule Exam"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
