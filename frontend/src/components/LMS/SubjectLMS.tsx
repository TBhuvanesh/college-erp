"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import {
  listMaterials,
  deleteMaterial,
  listAssignments,
  deleteAssignment,
  listSubmissions,
  downloadLmsFile,
  CourseMaterial,
  Assignment,
  Submission,
} from "@/lib/lms";
import { MaterialModal } from "./Modals/MaterialModal";
import { AssignmentModal } from "./Modals/AssignmentModal";
import { SubmissionModal } from "./Modals/SubmissionModal";
import { GradingModal } from "./Modals/GradingModal";
import {
  FileText,
  Calendar,
  ClipboardList,
  Plus,
  Edit2,
  Trash2,
  Download,
  Upload,
  Search,
  Filter,
  Loader2,
  AlertCircle,
  FileCheck,
  CheckCircle,
  Clock,
  ExternalLink,
  CalendarDays,
  CheckCircle2,
  Clock3,
  X,
} from "lucide-react";
import {
  listTeachingPlans,
  getCourseProgress,
  completeTeachingPlan,
  rescheduleTeachingPlan,
  deleteTeachingPlan,
  updateTeachingPlan,
  TeachingPlan,
  CourseProgress,
} from "@/lib/teachingPlan";

interface SubjectLMSProps {
  subjectId: string;
}

export const SubjectLMS: React.FC<SubjectLMSProps> = ({ subjectId }) => {
  const { user, accessToken } = useAuth();
  const role = user?.role || "student";
  const isAdmin = role === "admin";
  const isFaculty = role === "faculty";
  const isStudent = role === "student";

  // Navigation tab
  const [activeTab, setActiveTab] = useState<"materials" | "assignments" | "submissions" | "planner">("planner");

  // Domain state
  const [subject, setSubject] = useState<any>(null);
  const [materials, setMaterials] = useState<CourseMaterial[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]); // For student own submissions OR faculty list

  // Loading states
  const [loadingSubject, setLoadingSubject] = useState(true);
  const [loadingContent, setLoadingContent] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter states
  const [matSearch, setMatSearch] = useState("");
  const [assignSearch, setAssignSearch] = useState("");
  const [assignStatusFilter, setAssignStatusFilter] = useState("ALL");
  
  // Faculty/Admin Submissions Tab filter
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [submissionStatusFilter, setSubmissionStatusFilter] = useState("ALL");

  // Modals management
  const [matModalOpen, setMatModalOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<CourseMaterial | null>(null);

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);

  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  
  const [gradeModalOpen, setGradeModalOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);

  // Planner state
  const [plans, setPlans] = useState<TeachingPlan[]>([]);
  const [plannerProgress, setPlannerProgress] = useState<CourseProgress | null>(null);
  const [loadingPlanner, setLoadingPlanner] = useState(true);
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<TeachingPlan | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);

  const [notification, setNotification] = useState<string | null>(null);

  const triggerNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  // Fetch subject details
  const fetchSubject = useCallback(async () => {
    if (!accessToken) return;
    setLoadingSubject(true);
    try {
      const res = await apiFetch(`/subjects/${subjectId}`, {}, accessToken);
      if (res.success && res.data?.subject) {
        setSubject(res.data.subject);
      }
    } catch (err: any) {
      console.error("Failed to load subject", err);
      setError("Subject code module not found.");
    } finally {
      setLoadingSubject(false);
    }
  }, [subjectId, accessToken]);

  // Fetch materials & assignments
  const fetchContent = useCallback(async () => {
    if (!accessToken) return;
    setLoadingContent(true);
    try {
      const [matRes, assignRes] = await Promise.all([
        listMaterials({ subjectId }, accessToken),
        listAssignments({ subjectId }, accessToken),
      ]);
      setMaterials(matRes.materials || []);
      setAssignments(assignRes.assignments || []);

      if (isStudent) {
        const subRes = await listSubmissions({ page: 1, limit: 100 }, accessToken);
        setSubmissions(subRes.submissions || []);
      }
    } catch (err: any) {
      console.error("Failed to load LMS records", err);
    } finally {
      setLoadingContent(false);
    }
  }, [subjectId, accessToken, isStudent]);

  // Fetch teaching plans and course progress
  const fetchPlanner = useCallback(async () => {
    if (!accessToken || !subjectId) return;
    setLoadingPlanner(true);
    try {
      const [planRes, progressRes] = await Promise.all([
        listTeachingPlans({ subjectId }, accessToken),
        getCourseProgress({ subjectId }, accessToken)
      ]);
      setPlans(planRes.teachingPlans || []);
      setPlannerProgress(progressRes);
    } catch (err) {
      console.error("Failed to fetch teaching planner", err);
    } finally {
      setLoadingPlanner(false);
    }
  }, [subjectId, accessToken]);

  // Faculty Complete Lesson Action inside LMS Subject page
  const handleMarkComplete = async (plan: TeachingPlan) => {
    if (!accessToken) return;
    try {
      await completeTeachingPlan(plan.id, accessToken);
      triggerNotification(`Lesson "${plan.topicTitle}" marked Completed!`);
      fetchPlanner();
    } catch (err: any) {
      alert(err.message || "Failed to mark completed");
    }
  };

  // Faculty Cancel / Delete actions inside LMS Subject page
  const handleDeletePlan = async (plan: TeachingPlan) => {
    if (!accessToken) return;
    if (confirm(`Are you sure you want to delete the lesson plan for "${plan.topicTitle}"?`)) {
      try {
        await deleteTeachingPlan(plan.id, accessToken);
        triggerNotification("Lesson plan deleted.");
        fetchPlanner();
      } catch (err: any) {
        alert(err.message || "Failed to delete plan");
      }
    }
  };

  // Fetch submissions (Faculty/Admin tab)
  const fetchSubmissionsList = useCallback(async () => {
    if (!accessToken || !selectedAssignmentId || isStudent) return;
    setLoadingContent(true);
    try {
      const subRes = await listSubmissions({ assignmentId: selectedAssignmentId }, accessToken);
      setSubmissions(subRes.submissions || []);
    } catch (err) {
      console.error("Failed to load submissions list", err);
    } finally {
      setLoadingContent(false);
    }
  }, [selectedAssignmentId, accessToken, isStudent]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSubject();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchSubject]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchContent();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchContent]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPlanner();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchPlanner]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (selectedAssignmentId) {
        fetchSubmissionsList();
      } else {
        setSubmissions([]);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [selectedAssignmentId, fetchSubmissionsList]);

  // Materials crud
  const handleDeleteMaterial = async (id: string) => {
    if (confirm("Are you sure you want to delete this learning resource?")) {
      try {
        await deleteMaterial(id, accessToken!);
        triggerNotification("Material deleted successfully");
        fetchContent();
      } catch (err: any) {
        alert(err.message || "Failed to delete material");
      }
    }
  };

  const handleDownloadMaterial = async (mat: CourseMaterial) => {
    try {
      await downloadLmsFile(mat.downloadUrl, mat.fileName, accessToken!);
    } catch {
      alert("Download failed.");
    }
  };

  // Assignments crud
  const handleDeleteAssignment = async (id: string) => {
    if (confirm("Are you sure you want to delete this assignment? All associated student submissions will be lost.")) {
      try {
        await deleteAssignment(id, accessToken!);
        triggerNotification("Assignment deleted successfully");
        fetchContent();
        if (selectedAssignmentId === id) setSelectedAssignmentId("");
      } catch (err: any) {
        alert(err.message || "Failed to delete assignment");
      }
    }
  };

  // Deadlines status mappers for students
  const getDeadlineStatus = (assign: Assignment) => {
    const studentSub = submissions.find((sub) => sub.assignmentId === assign.id);
    
    if (studentSub) {
      return studentSub.status === "Evaluated"
        ? { label: "Evaluated", style: "dark:bg-emerald-500/10 bg-emerald-50 dark:text-emerald-400 text-emerald-750 dark:border-emerald-500/20 border-emerald-205" }
        : { label: "Submitted", style: "dark:bg-blue-500/10 bg-blue-50 dark:text-blue-400 text-blue-750 dark:border-blue-500/20 border-blue-205" };
    }

    const due = new Date(assign.dueDate);
    const now = new Date();
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffTime < 0) {
      return { label: "Closed", style: "dark:bg-rose-500/10 bg-rose-50 dark:text-rose-400 text-rose-755 dark:border-rose-500/20 border-rose-205" };
    }
    if (diffDays <= 2) {
      return { label: "Due Soon", style: "dark:bg-amber-500/10 bg-amber-50 dark:text-amber-400 text-amber-750 dark:border-amber-500/20 border-amber-205 animate-pulse" };
    }
    return { label: "Open", style: "dark:bg-neutral-800 bg-surface-elevated dark:text-neutral-400 text-text-secondary dark:border-neutral-700 border-border-subtle" };
  };

  const getSubStatusBadge = (status: string) => {
    switch (status) {
      case "Evaluated":
        return "dark:bg-emerald-500/10 bg-emerald-50 dark:text-emerald-400 text-emerald-750 dark:border-emerald-500/20 border-emerald-205";
      case "Late Submission":
        return "dark:bg-amber-500/10 bg-amber-50 dark:text-amber-400 text-amber-750 dark:border-amber-500/20 border-amber-205";
      default:
        return "dark:bg-blue-500/10 bg-blue-50 dark:text-blue-400 text-blue-750 dark:border-blue-500/20 border-blue-205";
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  // Filters logic
  const filteredMaterials = materials.filter((mat) =>
    mat.title.toLowerCase().includes(matSearch.toLowerCase())
  );

  const filteredAssignments = assignments.filter((assign) => {
    const matchSearch = assign.title.toLowerCase().includes(assignSearch.toLowerCase());
    if (!matchSearch) return false;

    if (assignStatusFilter === "ALL") return true;
    const statusObj = getDeadlineStatus(assign);
    return statusObj.label === assignStatusFilter;
  });

  const filteredSubmissions = submissions.filter((sub) => {
    if (submissionStatusFilter === "ALL") return true;
    return sub.status === submissionStatusFilter;
  });

  if (loadingSubject) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-neutral-400 font-mono text-xs">
        <Loader2 className="animate-spin text-blue-500 mb-2" size={32} />
        <span>Loading course syllabus...</span>
      </div>
    );
  }

  if (error || !subject) {
    return (
      <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-455 text-xs font-semibold text-center my-10">
        {error || "Unable to load curriculum page."}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="p-5 rounded-xl border dark:border-neutral-800 border-border-subtle dark:bg-neutral-900/60 bg-surface backdrop-blur-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <span className="text-[9px] uppercase font-bold text-blue-500 tracking-wider font-mono">
            {subject.code} • Sem {subject.semester}
          </span>
          <h2 className="font-display font-bold text-xl dark:text-white text-text-primary">
            {subject.name}
          </h2>
          <p className="text-xs dark:text-neutral-400 text-text-secondary">
            Enrolled program: <strong className="dark:text-neutral-350 text-text-primary">{subject.programName}</strong>
          </p>
        </div>

        {/* Tab switch buttons */}
        <div className="flex dark:bg-neutral-950 bg-neutral-100 border dark:border-neutral-850 border-border-subtle rounded-lg p-1 shrink-0 self-stretch sm:self-auto justify-between sm:justify-start">
          <button
            onClick={() => setActiveTab("planner")}
            className={`px-3 py-1.5 text-xs font-bold rounded cursor-pointer transition flex items-center gap-1.5 ${
              activeTab === "planner"
                ? "bg-blue-600 text-white font-extrabold shadow-md shadow-blue-600/15"
                : "dark:text-neutral-400 text-text-secondary dark:hover:text-neutral-200 hover:text-text-primary"
            }`}
          >
            <CalendarDays size={14} />
            <span>Syllabus & Planner</span>
          </button>
          <button
            onClick={() => setActiveTab("materials")}
            className={`px-3 py-1.5 text-xs font-bold rounded cursor-pointer transition flex items-center gap-1.5 ${
              activeTab === "materials"
                ? "bg-blue-600 text-white font-extrabold shadow-md shadow-blue-600/15"
                : "dark:text-neutral-400 text-text-secondary dark:hover:text-neutral-200 hover:text-text-primary"
            }`}
          >
            <FileText size={14} />
            <span>Materials</span>
          </button>
          <button
            onClick={() => setActiveTab("assignments")}
            className={`px-3 py-1.5 text-xs font-bold rounded cursor-pointer transition flex items-center gap-1.5 ${
              activeTab === "assignments"
                ? "bg-blue-600 text-white font-extrabold shadow-md shadow-blue-600/15"
                : "dark:text-neutral-400 text-text-secondary dark:hover:text-neutral-200 hover:text-text-primary"
            }`}
          >
            <Calendar size={14} />
            <span>Assignments</span>
          </button>
          {!isStudent && (
            <button
              onClick={() => {
                setActiveTab("submissions");
                // Preselect first assignment if none selected
                if (!selectedAssignmentId && assignments.length > 0) {
                  setSelectedAssignmentId(assignments[0].id);
                }
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded cursor-pointer transition flex items-center gap-1.5 ${
                activeTab === "submissions"
                  ? "bg-blue-600 text-white font-extrabold shadow-md shadow-blue-600/15"
                  : "dark:text-neutral-400 text-text-secondary dark:hover:text-neutral-200 hover:text-text-primary"
              }`}
            >
              <ClipboardList size={14} />
              <span>Submissions</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications banner */}
      {notification && (
        <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center gap-2 animate-fade-in">
          <CheckCircle size={14} />
          <span>{notification}</span>
        </div>
      )}

      {/* TAB: PLANNER */}
      {activeTab === "planner" && (
        <div className="space-y-6 animate-fade-in">
          {/* Progress Banner & Today's Topic Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Progress Card */}
            <div className="lg:col-span-1 glass-card border border-border-subtle rounded-xl p-5 flex flex-col justify-between shadow-sm">
              <div>
                <span className="text-[9px] uppercase font-black text-text-muted tracking-widest font-mono">Syllabus Progress</span>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="font-display font-black text-4xl text-text-primary">
                    {loadingPlanner ? "..." : `${plannerProgress?.completionPercentage ?? 0}%`}
                  </span>
                  <span className="text-xs text-text-muted">Completed</span>
                </div>
                <div className="w-full bg-border-subtle rounded-full h-2 mt-3 overflow-hidden">
                  <div
                    className="bg-success h-2 rounded-full transition-all duration-500"
                    style={{ width: `${plannerProgress?.completionPercentage ?? 0}%` }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-border-subtle/50 text-xs font-semibold text-text-secondary">
                <div>
                  <span className="text-text-muted block text-[9px] uppercase">Completed Lessons</span>
                  <span className="text-sm font-bold text-success mt-0.5 block">
                    {loadingPlanner ? "..." : plannerProgress?.completed}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted block text-[9px] uppercase">Remaining Lessons</span>
                  <span className="text-sm font-bold text-warning mt-0.5 block">
                    {loadingPlanner ? "..." : plannerProgress?.remaining}
                  </span>
                </div>
              </div>
            </div>

            {/* Today's Topic Card */}
            <div className="lg:col-span-2 glass-card border border-border-subtle rounded-xl p-5 flex flex-col justify-between shadow-sm">
              <div>
                <span className="text-[9px] uppercase font-black text-accent-blue tracking-widest font-mono">Today's Topic</span>
                {(() => {
                  const todayStr = new Date().toISOString().split("T")[0];
                  const todayLesson = plans.find(
                    (p) => new Date(p.lessonDate).toISOString().split("T")[0] === todayStr
                  );
                  if (loadingPlanner) {
                    return (
                      <div className="flex items-center gap-2 py-4">
                        <Loader2 className="animate-spin text-accent-blue" size={16} />
                        <span className="text-xs text-text-muted">Retrieving today's agenda...</span>
                      </div>
                    );
                  }
                  if (!todayLesson) {
                    return (
                      <div className="py-4 text-xs text-text-muted font-mono italic">
                        No lesson scheduled for today. Check upcoming sessions below.
                      </div>
                    );
                  }
                  return (
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-text-primary text-base">{todayLesson.topicTitle}</h4>
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-accent-blue-soft text-accent-blue font-bold">Week {todayLesson.weekNumber}</span>
                      </div>
                      {todayLesson.topicDescription && (
                        <p className="text-xs text-text-secondary line-clamp-2">{todayLesson.topicDescription}</p>
                      )}
                    </div>
                  );
                })()}
              </div>
              <div className="border-t border-border-subtle/50 pt-3 mt-4 flex items-center justify-between text-[10px] text-text-muted font-mono">
                <span>Date: {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                <span className="flex items-center gap-1 font-sans font-bold text-accent-blue">
                  <Clock3 size={11} /> 09:00 AM - 10:30 AM
                </span>
              </div>
            </div>
          </div>

          {/* Timeline & Detail List Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Side: Timeline (4 cols) */}
            <div className="lg:col-span-4 space-y-4">
              <div className="glass-card border border-border-subtle rounded-xl p-5 shadow-sm">
                <h4 className="font-display font-bold text-text-primary text-xs uppercase tracking-wider mb-4">Syllabus Timeline</h4>
                {loadingPlanner ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="animate-spin text-accent-blue" size={20} />
                  </div>
                ) : plans.length > 0 ? (
                  <div className="space-y-4 relative pl-4 border-l border-border-subtle">
                    {plans.map((p) => {
                      const isCompleted = p.completionStatus === "Completed";
                      const isCancelled = p.completionStatus === "Cancelled";
                      const isRescheduled = p.completionStatus === "Rescheduled";
                      
                      let dotColor = "bg-accent-blue ring-accent-blue-soft";
                      if (isCompleted) dotColor = "bg-success ring-success-soft";
                      if (isRescheduled) dotColor = "bg-warning ring-warning-soft";
                      if (isCancelled) dotColor = "bg-danger ring-danger-soft";

                      return (
                        <div key={p.id} className="relative group text-left">
                          {/* Dot marker */}
                          <div className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full ring-4 ${dotColor}`} />
                          
                          <div className="text-[9px] font-bold text-text-muted font-mono leading-none">Week {p.weekNumber}</div>
                          <h5 className="text-xs font-bold text-text-primary truncate mt-0.5 group-hover:text-accent-blue transition-colors">
                            {p.topicTitle}
                          </h5>
                          <span className="text-[9px] text-text-muted font-mono">
                            {new Date(p.lessonDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6 text-text-muted font-mono text-xs italic">
                    No syllabus items planned.
                  </div>
                )}
              </div>

              {/* Homework and Quiz Widgets */}
              <div className="glass-card border border-border-subtle rounded-xl p-5 shadow-sm space-y-4">
                <h4 className="font-display font-bold text-text-primary text-xs uppercase tracking-wider">Evaluation Alerts</h4>
                
                {/* Quizzes */}
                <div className="space-y-2">
                  <span className="text-[9px] uppercase font-bold text-text-muted block">Scheduled Quizzes</span>
                  {plans.filter(p => p.quizPlanned).length > 0 ? (
                    <div className="space-y-2">
                      {plans.filter(p => p.quizPlanned).map(p => (
                        <div key={p.id} className="p-2.5 bg-danger-soft/10 border border-danger/15 rounded-lg text-xs space-y-1">
                          <span className="font-bold text-text-primary block truncate">{p.topicTitle}</span>
                          <span className="text-[8px] text-text-muted font-mono block">Week {p.weekNumber} &middot; Date: {new Date(p.lessonDate).toLocaleDateString()}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[10px] text-text-muted font-mono italic">No quizzes scheduled.</div>
                  )}
                </div>

                {/* Homework */}
                <div className="space-y-2 border-t border-border-subtle/50 pt-3">
                  <span className="text-[9px] uppercase font-bold text-text-muted block">Homework Tasks</span>
                  {plans.filter(p => p.homework).length > 0 ? (
                    <div className="space-y-2">
                      {plans.filter(p => p.homework).map(p => (
                        <div key={p.id} className="p-2.5 bg-warning-soft/10 border border-warning/15 rounded-lg text-xs space-y-1">
                          <span className="font-bold text-text-primary block truncate">{p.topicTitle}</span>
                          <p className="text-[10px] text-text-secondary italic line-clamp-1">{p.homework}</p>
                          <span className="text-[8px] text-text-muted font-mono block">Week {p.weekNumber}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[10px] text-text-muted font-mono italic">No homework assigned.</div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Side: Detailed Lesson Cards (8 cols) */}
            <div className="lg:col-span-8 space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-display font-bold text-text-primary text-sm">Detailed Lesson Feed</h4>
                {isFaculty && (
                  <Link
                    href="/faculty/teaching-planner"
                    className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center gap-1 shadow-sm font-sans"
                  >
                    <Plus size={12} />
                    <span>Manage All</span>
                  </Link>
                )}
              </div>

              {loadingPlanner ? (
                <div className="flex flex-col items-center justify-center py-12 text-text-muted gap-2">
                  <Loader2 className="animate-spin text-accent-blue" size={24} />
                  <span className="text-xs font-mono">Loading syllabus details...</span>
                </div>
              ) : plans.length > 0 ? (
                <div className="space-y-4">
                  {plans.map((p) => (
                    <div
                      key={p.id}
                      className="glass-card border border-border-subtle rounded-xl p-5 flex flex-col justify-between gap-4 shadow-sm"
                    >
                      <div className="space-y-2 text-left">
                        <div className="flex justify-between items-start flex-wrap gap-2">
                          <div>
                            <span className="text-[8px] font-bold text-text-muted uppercase font-mono block">
                              Week {p.weekNumber} &middot; Section {p.section}
                            </span>
                            <h4 className="text-base font-bold text-text-primary mt-1">
                              {p.topicTitle}
                            </h4>
                          </div>
                          <span
                            className={`text-[8px] border px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                              p.completionStatus === "Completed" ? "bg-success-soft text-success border-success/15" :
                              p.completionStatus === "Rescheduled" ? "bg-warning-soft text-warning border-warning/15" :
                              p.completionStatus === "Cancelled" ? "bg-danger-soft text-danger border-danger/15" :
                              "bg-accent-blue-soft text-accent-blue border-accent-blue/15"
                            }`}
                          >
                            {p.completionStatus}
                          </span>
                        </div>

                        {p.topicDescription && (
                          <p className="text-xs text-text-secondary leading-normal font-sans">
                            {p.topicDescription}
                          </p>
                        )}

                        {p.learningObjectives && (
                          <div className="text-xs text-text-secondary leading-normal font-sans pl-3 border-l-2 border-border-subtle mt-2">
                            <span className="text-[9px] uppercase font-bold text-text-muted block mb-0.5">Objectives</span>
                            <p className="whitespace-pre-wrap">{p.learningObjectives}</p>
                          </div>
                        )}

                        {p.homework && (
                          <div className="p-3 bg-warning-soft/10 border border-warning/15 rounded-lg text-xs space-y-1 mt-2">
                            <span className="font-bold text-warning block uppercase text-[9px] tracking-wider">Homework Assigned</span>
                            <p className="text-text-secondary italic">{p.homework}</p>
                          </div>
                        )}

                        {p.quizPlanned && (
                          <div className="p-2.5 bg-danger-soft/10 border border-danger/15 rounded-lg text-xs flex items-center gap-2 mt-2">
                            <AlertCircle className="text-danger shrink-0" size={13} />
                            <span className="font-semibold text-text-primary">Evaluation Quiz Planned</span>
                          </div>
                        )}
                      </div>

                      {/* Footer Actions / Attached Materials */}
                      <div className="border-t border-border-subtle pt-4 mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
                        <div className="text-[10px] text-text-muted font-mono">
                          Date Scheduled: {new Date(p.lessonDate).toLocaleDateString()}
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5">
                          {p.materialId && (
                            <button
                              onClick={async () => {
                                try {
                                  await downloadLmsFile(p.materialDownloadUrl || "", p.materialTitle || "document", accessToken!);
                                } catch {
                                  alert("Download failed.");
                                }
                              }}
                              className="py-1.5 px-3 rounded dark:bg-neutral-850 bg-surface border dark:border-neutral-800 border-border-subtle dark:text-white text-text-primary text-[10px] font-bold dark:hover:bg-neutral-800 hover:bg-surface-hover flex items-center gap-1 cursor-pointer transition"
                            >
                              <Download size={11} />
                              <span className="truncate max-w-[80px]">{p.materialTitle || "Notes"}</span>
                            </button>
                          )}

                          {p.assignmentId && (
                            <button
                              onClick={() => {
                                if (isStudent) {
                                  setActiveTab("assignments");
                                } else {
                                  setActiveTab("submissions");
                                  setSelectedAssignmentId(p.assignmentId || "");
                                }
                              }}
                              className="py-1.5 px-3 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer transition"
                            >
                              <ExternalLink size={11} />
                              <span>{p.assignmentTitle || "Assignment"}</span>
                            </button>
                          )}

                          {/* Faculty inline overrides */}
                          {isFaculty && (
                            <div className="flex items-center gap-1.5 border-l border-border-subtle pl-2.5 ml-1">
                              {p.completionStatus !== "Completed" && p.completionStatus !== "Cancelled" && (
                                <>
                                  <button
                                    onClick={() => handleMarkComplete(p)}
                                    className="p-1.5 rounded bg-success-soft text-success border border-success/20 hover:bg-success-soft/20 transition cursor-pointer"
                                    title="Mark Completed"
                                  >
                                    <CheckCircle size={12} />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedPlan(p);
                                      setRescheduleDate(new Date(p.lessonDate).toISOString().split("T")[0]);
                                      setRescheduleReason("");
                                      setRescheduleModalOpen(true);
                                    }}
                                    className="p-1.5 rounded bg-warning-soft text-warning border border-warning/20 hover:bg-warning-soft/20 transition cursor-pointer"
                                    title="Reschedule Lesson"
                                  >
                                    <Calendar size={12} />
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => handleDeletePlan(p)}
                                className="p-1.5 rounded bg-danger-soft text-danger border border-danger/20 hover:bg-danger-soft/20 transition cursor-pointer"
                                title="Delete Lesson Plan"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-10 text-center glass-card border border-border-subtle rounded-xl dark:text-neutral-500 text-text-muted font-mono text-xs">
                  No detailed lesson sheets published for this subject.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB: MATERIALS */}
      {activeTab === "materials" && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="glass-card border border-border-subtle rounded-xl p-4 flex flex-col sm:flex-row justify-between items-center gap-3">
            {/* Search filter */}
            <div className="w-full sm:flex-1 relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 dark:text-neutral-500 text-text-muted" />
              <input
                type="text"
                placeholder="Search resources by title..."
                value={matSearch}
                onChange={(e) => setMatSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs dark:bg-neutral-950 bg-surface border dark:border-neutral-850 border-border-subtle rounded dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition"
              />
            </div>

            {/* Faculty actions */}
            {isFaculty && (
              <button
                onClick={() => {
                  setSelectedMaterial(null);
                  setMatModalOpen(true);
                }}
                className="w-full sm:w-auto py-2 px-4 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition"
              >
                <Plus size={14} />
                <span>Upload Material</span>
              </button>
            )}
          </div>

          {/* List display */}
          {loadingContent ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-blue-500" size={24} />
            </div>
          ) : filteredMaterials.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredMaterials.map((mat) => (
                <div
                  key={mat.id}
                  className="glass-card border border-border-subtle rounded-xl p-5 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <h4 className="text-sm font-bold dark:text-white text-text-primary leading-tight">
                        {mat.title}
                      </h4>
                      <span className="text-[9px] dark:bg-indigo-500/10 bg-indigo-50 dark:text-indigo-400 text-indigo-700 dark:border-indigo-500/20 border-indigo-200 px-2 py-0.5 rounded font-bold font-mono uppercase tracking-wider">
                        {mat.fileType}
                      </span>
                    </div>
                    {mat.description && (
                      <p className="text-xs dark:text-neutral-400 text-text-secondary leading-normal line-clamp-3">
                        {mat.description}
                      </p>
                    )}
                  </div>

                  <div className="border-t dark:border-neutral-950 border-border-subtle pt-4 mt-6 flex justify-between items-center">
                    <div className="text-[9px] dark:text-neutral-505 text-text-muted space-y-0.5 font-mono">
                      <p>By: {mat.facultyName}</p>
                      <p>Date: {formatDate(mat.createdAt)}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDownloadMaterial(mat)}
                        className="py-1.5 px-3 rounded dark:bg-neutral-800 bg-surface border dark:border-neutral-700 border-border-subtle dark:text-white text-text-primary text-[10px] font-bold dark:hover:bg-neutral-755 hover:bg-surface-hover flex items-center gap-1 cursor-pointer transition"
                      >
                        <Download size={12} />
                        <span>Download</span>
                      </button>

                      {isFaculty && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedMaterial(mat);
                              setMatModalOpen(true);
                            }}
                            className="p-1.5 rounded dark:bg-neutral-850 bg-surface border dark:border-neutral-800 border-border-subtle dark:text-neutral-450 text-text-secondary dark:hover:text-white hover:text-text-primary transition cursor-pointer"
                            title="Edit metadata"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteMaterial(mat.id)}
                            className="p-1.5 rounded bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/20 text-rose-550 transition cursor-pointer"
                            title="Delete file"
                          >
                            <Trash2 size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-10 text-center glass-card border border-border-subtle rounded-xl dark:text-neutral-500 text-text-muted font-mono text-xs">
              No learning resources uploaded matching filter criteria.
            </div>
          )}
        </div>
      )}

      {/* TAB: ASSIGNMENTS */}
      {activeTab === "assignments" && (
        <div className="space-y-6">
          {/* Controls Bar */}          <div className="glass-card border border-border-subtle rounded-xl p-4 flex flex-col sm:flex-row gap-3">
            {/* Title search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 dark:text-neutral-500 text-text-muted" />
              <input
                type="text"
                placeholder="Search assignments by title..."
                value={assignSearch}
                onChange={(e) => setAssignSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs dark:bg-neutral-950 bg-surface border dark:border-neutral-850 border-border-subtle rounded dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition"
              />
            </div>

            {/* Status filter (Student view only) */}
            {isStudent && (
              <div className="w-full sm:w-48 flex items-center gap-2 dark:bg-neutral-955 bg-surface border dark:border-neutral-850 border-border-subtle rounded px-2.5 text-xs dark:text-white text-text-primary">
                <Filter size={12} className="dark:text-neutral-500 text-text-muted" />
                <span className="dark:text-neutral-500 text-text-muted">Status:</span>
                <select
                  value={assignStatusFilter}
                  onChange={(e) => setAssignStatusFilter(e.target.value)}
                  className="bg-transparent dark:text-white text-text-primary cursor-pointer py-2 flex-1 focus:outline-none"
                >
                  <option value="ALL">All States</option>
                  <option value="Open">Open</option>
                  <option value="Due Soon">Due Soon</option>
                  <option value="Closed">Closed</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Evaluated">Evaluated</option>
                </select>
              </div>
            )}

            {/* Faculty actions */}
            {isFaculty && (
              <button
                onClick={() => {
                  setSelectedAssignment(null);
                  setAssignModalOpen(true);
                }}
                className="w-full sm:w-auto py-2 px-4 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition shrink-0"
              >
                <Plus size={14} />
                <span>Create Assignment</span>
              </button>
            )}
          </div>

          {/* List display */}
          {loadingContent ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-blue-500" size={24} />
            </div>
          ) : filteredAssignments.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {filteredAssignments.map((assign) => {
                const statusObj = getDeadlineStatus(assign);
                const studentSub = submissions.find((sub) => sub.assignmentId === assign.id);
                const isClosed = new Date() > new Date(assign.dueDate);

                return (
                  <div
                    key={assign.id}
                    className="glass-card border border-border-subtle rounded-xl p-5 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-2">
                      <div className="flex justify-between items-start flex-wrap gap-2">
                        <div>
                          <h4 className="text-base font-bold dark:text-white text-text-primary leading-tight">
                            {assign.title}
                          </h4>
                          <span className="text-[9px] dark:text-neutral-500 text-text-muted font-mono mt-0.5 block">
                            Max marks: {assign.maxMarks} • Uploaded by: {assign.facultyName}
                          </span>
                        </div>
                        <span
                          className={`text-[8px] border px-2 py-0.5 rounded font-bold uppercase tracking-wider ${statusObj.style}`}
                        >
                          {statusObj.label}
                        </span>
                      </div>
                      {assign.description && (
                        <p className="text-xs dark:text-neutral-400 text-text-secondary leading-normal font-sans whitespace-pre-wrap">
                          {assign.description}
                        </p>
                      )}
                    </div>

                    {/* Footer / Actions based on role */}
                    <div className="border-t dark:border-neutral-950 border-border-subtle pt-4 mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="text-[10px] dark:text-neutral-505 text-text-muted font-mono flex items-center gap-1">
                        <Clock size={12} className="dark:text-neutral-600 text-text-muted" />
                        <span>Deadline: {formatDate(assign.dueDate)}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5">
                        {/* Student actions */}
                        {isStudent && (
                          <>
                            {studentSub && (
                              <div className="text-xs mr-2 font-mono">
                                <span className="dark:text-neutral-550 text-text-muted">Grade: </span>
                                <strong className="dark:text-white text-text-primary">
                                  {studentSub.marks !== null
                                    ? `${studentSub.marks}/${assign.maxMarks}`
                                    : "Pending Review"}
                                </strong>
                              </div>
                            )}

                            {!isClosed && (
                              <button
                                onClick={() => {
                                  setSelectedAssignment(assign);
                                  setSubmitModalOpen(true);
                                }}
                                className="py-1.5 px-3 rounded bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer transition"
                              >
                                <Upload size={12} />
                                <span>{studentSub ? "Resubmit File" : "Submit File"}</span>
                              </button>
                            )}
                          </>
                        )}

                        {/* Faculty actions */}
                        {isFaculty && (
                          <>
                            <button
                              onClick={() => {
                                setSelectedAssignment(assign);
                                setSelectedAssignmentId(assign.id);
                                setActiveTab("submissions");
                              }}
                              className="py-1.5 px-3 rounded dark:bg-neutral-800 bg-surface border dark:border-neutral-700 border-border-subtle dark:text-white text-text-primary text-[10px] font-bold dark:hover:bg-neutral-755 hover:bg-surface-hover flex items-center gap-1 cursor-pointer transition"
                            >
                              <ClipboardList size={12} />
                              <span>View Submissions</span>
                            </button>
                            <button
                              onClick={() => {
                                setSelectedAssignment(assign);
                                setAssignModalOpen(true);
                              }}
                              className="p-1.5 rounded dark:bg-neutral-850 bg-surface border dark:border-neutral-800 border-border-subtle dark:text-neutral-450 text-text-secondary dark:hover:text-white hover:text-text-primary transition cursor-pointer"
                              title="Edit assignment details"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              onClick={() => handleDeleteAssignment(assign.id)}
                              className="p-1.5 rounded bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/20 text-rose-550 transition cursor-pointer"
                              title="Delete assignment"
                            >
                              <Trash2 size={12} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Student Feedback display */}
                    {isStudent && studentSub && (studentSub.feedback || studentSub.marks !== null) && (
                      <div className="dark:bg-neutral-950/60 bg-surface border dark:border-neutral-900 border-border-subtle rounded-lg p-3 space-y-1.5 mt-1">
                        <span className="text-[9px] uppercase font-bold dark:text-neutral-500 text-text-muted flex items-center gap-1.5">
                          <FileCheck size={12} className="text-emerald-455" />
                          <span>Faculty Evaluation & Feedback</span>
                        </span>
                        {studentSub.feedback ? (
                          <p className="text-xs dark:text-neutral-300 text-text-secondary leading-normal italic">
                            &quot;{studentSub.feedback}&quot;
                          </p>
                        ) : (
                          <p className="text-xs dark:text-neutral-500 text-text-muted leading-normal italic">
                            No review comments logged.
                          </p>
                        )}
                        <span className="text-[8px] dark:text-neutral-505 text-text-muted block font-mono">
                          Evaluation date: {formatDate(studentSub.updatedAt)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-10 text-center glass-card border border-border-subtle rounded-xl dark:text-neutral-500 text-text-muted font-mono text-xs">
              No assignments found matching filter criteria.
            </div>
          )}
        </div>
      )}
      {/* TAB: SUBMISSIONS (Faculty/Admin only) */}
      {activeTab === "submissions" && !isStudent && (
        <div className="space-y-6 animate-fade-in">
          {/* Submissions Control Options */}
          <div className="glass-card border border-border-subtle rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Choose Assignment Dropdown */}
            <div className="flex flex-col gap-1">
              <label className="text-[9px] uppercase font-bold dark:text-neutral-500 text-text-muted tracking-wider">
                Select Assignment Task
              </label>
              <select
                value={selectedAssignmentId}
                onChange={(e) => setSelectedAssignmentId(e.target.value)}
                className="w-full px-3 py-2 text-xs dark:bg-neutral-950 bg-surface border dark:border-neutral-850 border-border-subtle rounded dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition cursor-pointer"
              >
                <option value="">Choose Assignment</option>
                {assignments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter by Status */}
            <div className="flex flex-col gap-1">
              <label className="text-[9px] uppercase font-bold dark:text-neutral-500 text-text-muted tracking-wider">
                Submission Status
              </label>
              <select
                disabled={!selectedAssignmentId}
                value={submissionStatusFilter}
                onChange={(e) => setSubmissionStatusFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs dark:bg-neutral-950 bg-surface border dark:border-neutral-850 border-border-subtle rounded dark:text-white text-text-primary focus:outline-none focus:border-blue-600 transition cursor-pointer disabled:opacity-50"
              >
                <option value="ALL">All Submissions</option>
                <option value="Submitted">Submitted (Pending Review)</option>
                <option value="Late Submission">Late Submission</option>
                <option value="Evaluated">Evaluated</option>
              </select>
            </div>
          </div>

          {/* Submissions Feed list */}
          {loadingContent ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-blue-500" size={24} />
            </div>
          ) : !selectedAssignmentId ? (
            <div className="p-10 text-center glass-card border border-border-subtle rounded-xl dark:text-neutral-500 text-text-muted font-mono text-xs">
              Please choose an assignment task above to retrieve student submission sheets.
            </div>
          ) : filteredSubmissions.length > 0 ? (
            <div className="glass-card border border-border-subtle rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="dark:bg-neutral-950 bg-neutral-100 dark:text-neutral-400 text-text-secondary uppercase text-[9px] font-bold font-mono tracking-wider border-b dark:border-neutral-850 border-border-subtle">
                    <tr>
                      <th className="p-4">Student</th>
                      <th className="p-4">Roll Number</th>
                      <th className="p-4">Submitted At</th>
                      <th className="p-4">File</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Score</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-neutral-900 divide-border-subtle dark:bg-neutral-900/30 bg-surface">
                    {filteredSubmissions.map((sub) => (
                      <tr key={sub.id} className="dark:hover:bg-neutral-800/20 hover:bg-neutral-100/50 transition-colors">
                        <td className="p-4 font-bold dark:text-white text-text-primary">{sub.studentName}</td>
                        <td className="p-4 font-mono dark:text-neutral-400 text-text-secondary">{sub.studentRollNumber}</td>
                        <td className="p-4 dark:text-neutral-400 text-text-secondary font-mono">{formatDate(sub.submittedAt)}</td>
                        <td className="p-4">
                          <button
                            onClick={async () => {
                              try {
                                await downloadLmsFile(sub.downloadUrl, sub.fileName, accessToken!);
                              } catch {
                                alert("Failed to download student file.");
                              }
                            }}
                            className="text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                          >
                            <Download size={12} />
                            <span className="truncate max-w-[120px]">{sub.fileName}</span>
                          </button>
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2 py-0.5 border text-[8px] font-bold uppercase rounded font-mono ${getSubStatusBadge(
                              sub.status
                            )}`}
                          >
                            {sub.status}
                          </span>
                        </td>
                        <td className="p-4 font-semibold dark:text-white text-text-primary">
                          {sub.marks !== null ? `${sub.marks}/${sub.assignmentMaxMarks}` : "—"}
                        </td>
                        <td className="p-4 text-right">
                          {isFaculty ? (
                            <button
                              onClick={() => {
                                setSelectedSubmission(sub);
                                setGradeModalOpen(true);
                              }}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-[10px] uppercase transition cursor-pointer"
                            >
                              Grade
                            </button>
                          ) : (
                            <span className="text-[10px] dark:text-neutral-500 text-text-muted italic">Read-only</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="p-10 text-center glass-card border border-border-subtle rounded-xl dark:text-neutral-500 text-text-muted font-mono text-xs">
              No submissions match filter selection.
            </div>
          )}
        </div>
      )}

      {/* RENDER MODALS */}
      {matModalOpen && (
        <MaterialModal
          isOpen={matModalOpen}
          onClose={() => {
            setMatModalOpen(false);
            setSelectedMaterial(null);
          }}
          onSuccess={(msg) => {
            triggerNotification(msg);
            fetchContent();
          }}
          token={accessToken!}
          subjects={
            subject ? [{ id: subject.id, name: subject.name, code: subject.code }] : []
          }
          material={selectedMaterial}
          defaultSubjectId={subjectId}
        />
      )}

      {assignModalOpen && (
        <AssignmentModal
          isOpen={assignModalOpen}
          onClose={() => {
            setAssignModalOpen(false);
            setSelectedAssignment(null);
          }}
          onSuccess={(msg) => {
            triggerNotification(msg);
            fetchContent();
          }}
          token={accessToken!}
          subjects={
            subject ? [{ id: subject.id, name: subject.name, code: subject.code }] : []
          }
          assignment={selectedAssignment}
          defaultSubjectId={subjectId}
        />
      )}

      {submitModalOpen && selectedAssignment && (
        <SubmissionModal
          isOpen={submitModalOpen}
          onClose={() => {
            setSubmitModalOpen(false);
            setSelectedAssignment(null);
          }}
          onSuccess={(msg) => {
            triggerNotification(msg);
            fetchContent();
          }}
          token={accessToken!}
          assignment={selectedAssignment}
          existingSubmission={submissions.find(
            (sub) => sub.assignmentId === selectedAssignment.id
          )}
        />
      )}

      {gradeModalOpen && selectedSubmission && (
        <GradingModal
          isOpen={gradeModalOpen}
          onClose={() => {
            setGradeModalOpen(false);
            setSelectedSubmission(null);
          }}
          onSuccess={(msg) => {
            triggerNotification(msg);
            if (selectedAssignmentId) fetchSubmissionsList();
            fetchContent();
          }}
          token={accessToken!}
          submission={selectedSubmission}
        />
      )}

      {/* RESCHEDULE LESSON MODAL */}
      {rescheduleModalOpen && selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="glass-card bg-surface w-full max-w-sm rounded-xl border border-border-subtle shadow-2xl overflow-hidden text-left">
            <div className="flex justify-between items-center p-4 border-b border-border-subtle">
              <h3 className="font-display font-bold text-base text-text-primary">Reschedule Lesson</h3>
              <button
                onClick={() => setRescheduleModalOpen(false)}
                className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setRescheduleSubmitting(true);
                try {
                  await rescheduleTeachingPlan(selectedPlan.id, {
                    newDate: rescheduleDate,
                    reason: rescheduleReason || undefined
                  }, accessToken!);
                  triggerNotification("Lesson rescheduled successfully!");
                  setRescheduleModalOpen(false);
                  fetchPlanner();
                } catch (err: any) {
                  alert(err.message || "Failed to reschedule lesson");
                } finally {
                  setRescheduleSubmitting(false);
                }
              }}
              className="p-4 space-y-4"
            >
              <div className="space-y-1">
                <span className="text-[10px] text-text-muted font-mono uppercase block">Lesson topic</span>
                <span className="text-xs font-bold text-text-primary block">{selectedPlan.topicTitle}</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-text-muted tracking-wider">New Lesson Date</label>
                <input
                  type="date"
                  required
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border-subtle text-xs font-semibold rounded focus:ring-1 focus:ring-accent-blue transition font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Reason for Rescheduling</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Provide reschedule reasoning..."
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border-subtle text-xs font-semibold rounded focus:ring-1 focus:ring-accent-blue transition"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setRescheduleModalOpen(false)}
                  className="px-3.5 py-1.5 border border-border-subtle text-text-secondary hover:bg-surface-hover text-xs font-bold rounded cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rescheduleSubmitting}
                  className="px-3.5 py-1.5 bg-warning hover:bg-warning/90 text-white text-xs font-bold rounded shadow-md shadow-warning/10 cursor-pointer transition flex items-center gap-1.5"
                >
                  {rescheduleSubmitting && <Loader2 className="h-3 w-3 animate-spin" />}
                  <span>Reschedule</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
