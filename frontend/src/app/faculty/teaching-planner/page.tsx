"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { listMaterials, listAssignments, CourseMaterial, Assignment } from "@/lib/lms";
import {
  listTeachingPlans,
  getCourseProgress,
  createTeachingPlan,
  updateTeachingPlan,
  deleteTeachingPlan,
  completeTeachingPlan,
  rescheduleTeachingPlan,
  TeachingPlan,
  CourseProgress,
  CompletionStatus
} from "@/lib/teachingPlan";
import {
  CalendarDays,
  Plus,
  BookOpen,
  CheckCircle,
  Clock,
  AlertCircle,
  Search,
  Filter,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Trash2,
  ExternalLink,
  Download,
  Calendar,
  X,
  FileText,
  MapPin,
  Clock3
} from "lucide-react";
import { StatsCard } from "@/components/Dashboard/StatsCard";

interface AssignmentDetail {
  id: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  semester: number;
  section: string;
  isActive: boolean;
}

export default function FacultyTeachingPlanner() {
  const { user, accessToken } = useAuth();
  const authFaculty = user?.facultyProfile;

  // Active workload subjects
  const [subjects, setSubjects] = useState<AssignmentDetail[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  // Teaching plans and stats
  const [teachingPlans, setTeachingPlans] = useState<TeachingPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [progressStats, setProgressStats] = useState<CourseProgress | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(false);

  // Subject-specific progress records (mapped for the course progress section)
  const [subjectProgress, setSubjectProgress] = useState<Record<string, CourseProgress & { subjectName: string; subjectCode: string; section: string }>>({});
  const [loadingSubjectProgress, setLoadingSubjectProgress] = useState(false);

  // LMS Attachments (dynamic when selecting subject in form)
  const [lmsMaterials, setLmsMaterials] = useState<CourseMaterial[]>([]);
  const [lmsAssignments, setLmsAssignments] = useState<Assignment[]>([]);
  const [loadingLmsData, setLoadingLmsData] = useState(false);

  // Filters state
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterWeek, setFilterWeek] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Calendar state
  const [calendarView, setCalendarView] = useState<"week" | "month">("week");
  const [currentDate, setCurrentDate] = useState(new Date());

  // Modal controls
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  
  // Selected objects for edit/details
  const [selectedPlan, setSelectedPlan] = useState<TeachingPlan | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    subjectId: "",
    section: "",
    weekNumber: 1,
    lessonDate: new Date().toISOString().split("T")[0],
    topicTitle: "",
    topicDescription: "",
    learningObjectives: "",
    homework: "",
    quizPlanned: false,
    materialId: "",
    assignmentId: ""
  });

  const [rescheduleData, setRescheduleData] = useState({
    newDate: new Date().toISOString().split("T")[0],
    reason: ""
  });

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [notification, setNotification] = useState("");

  const triggerNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(""), 4000);
  };

  // Fetch faculty assigned subjects workload
  const loadAssignedSubjects = useCallback(async () => {
    if (!accessToken) return;
    setLoadingSubjects(true);
    try {
      const res = await apiFetch("/attendance/my-assignments", {}, accessToken);
      if (res.success && res.data?.assignments) {
        const active = res.data.assignments.filter((a: AssignmentDetail) => a.isActive);
        setSubjects(active);
        
        // Auto select first subject in form if empty
        if (active.length > 0 && !formData.subjectId) {
          setFormData(prev => ({
            ...prev,
            subjectId: active[0].subjectId,
            section: active[0].section
          }));
        }
      }
    } catch (err) {
      console.error("Failed to fetch assigned subjects workload", err);
    } finally {
      setLoadingSubjects(false);
    }
  }, [accessToken, formData.subjectId]);

  // Fetch teaching plans
  const loadTeachingPlans = useCallback(async () => {
    if (!accessToken) return;
    setLoadingPlans(true);
    try {
      const res = await listTeachingPlans({ limit: 100 }, accessToken);
      setTeachingPlans(res.teachingPlans || []);
    } catch (err) {
      console.error("Failed to load teaching plans", err);
    } finally {
      setLoadingPlans(false);
    }
  }, [accessToken]);

  // Fetch overall progress statistics
  const loadOverallProgress = useCallback(async () => {
    if (!accessToken) return;
    setLoadingProgress(true);
    try {
      const stats = await getCourseProgress({}, accessToken);
      setProgressStats(stats);
    } catch (err) {
      console.error("Failed to load progress stats", err);
    } finally {
      setLoadingProgress(false);
    }
  }, [accessToken]);

  // Fetch individual progress for each subject in workload
  const loadAllSubjectsProgress = useCallback(async () => {
    if (!accessToken || subjects.length === 0) return;
    setLoadingSubjectProgress(true);
    try {
      const progressMap: typeof subjectProgress = {};
      await Promise.all(
        subjects.map(async (sub) => {
          const stats = await getCourseProgress({ subjectId: sub.subjectId, section: sub.section }, accessToken);
          progressMap[`${sub.subjectId}-${sub.section}`] = {
            ...stats,
            subjectName: sub.subjectName,
            subjectCode: sub.subjectCode,
            section: sub.section
          };
        })
      );
      setSubjectProgress(progressMap);
    } catch (err) {
      console.error("Failed to load subject progress states", err);
    } finally {
      setLoadingSubjectProgress(false);
    }
  }, [accessToken, subjects]);

  // Fetch LMS materials & assignments for the chosen form subject
  const loadLmsOptions = useCallback(async (subjId: string) => {
    if (!accessToken || !subjId) return;
    setLoadingLmsData(true);
    try {
      const [matRes, assignRes] = await Promise.all([
        listMaterials({ subjectId: subjId }, accessToken),
        listAssignments({ subjectId: subjId }, accessToken)
      ]);
      setLmsMaterials(matRes.materials || []);
      setLmsAssignments(assignRes.assignments || []);
    } catch (err) {
      console.error("Failed to fetch LMS resources for planner", err);
    } finally {
      setLoadingLmsData(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadAssignedSubjects();
    loadTeachingPlans();
    loadOverallProgress();
  }, [loadAssignedSubjects, loadTeachingPlans, loadOverallProgress]);

  useEffect(() => {
    if (subjects.length > 0) {
      loadAllSubjectsProgress();
    }
  }, [subjects, loadAllSubjectsProgress]);

  // Load LMS items whenever form subjectId changes
  useEffect(() => {
    if (formData.subjectId) {
      loadLmsOptions(formData.subjectId);
    }
  }, [formData.subjectId, loadLmsOptions]);

  // Form handlers
  const handleSubjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sId = e.target.value;
    const match = subjects.find(sub => sub.subjectId === sId);
    setFormData(prev => ({
      ...prev,
      subjectId: sId,
      section: match ? match.section : ""
    }));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);

    if (!formData.subjectId || !formData.topicTitle || !formData.lessonDate) {
      setFormError("Subject, Topic Title, and Lesson Date are required fields.");
      setSubmitting(false);
      return;
    }

    try {
      const payload = {
        subjectId: formData.subjectId,
        section: formData.section,
        weekNumber: Number(formData.weekNumber),
        lessonDate: formData.lessonDate,
        topicTitle: formData.topicTitle,
        topicDescription: formData.topicDescription || undefined,
        learningObjectives: formData.learningObjectives || undefined,
        homework: formData.homework || undefined,
        quizPlanned: formData.quizPlanned,
        materialId: formData.materialId || undefined,
        assignmentId: formData.assignmentId || undefined
      };

      if (isEditing && selectedPlan) {
        await updateTeachingPlan(selectedPlan.id, {
          weekNumber: payload.weekNumber,
          topicTitle: payload.topicTitle,
          topicDescription: payload.topicDescription,
          learningObjectives: payload.learningObjectives,
          homework: payload.homework || null,
          quizPlanned: payload.quizPlanned,
          materialId: payload.materialId || null,
          assignmentId: payload.assignmentId || null
        }, accessToken!);
        triggerNotification("Lesson plan updated successfully!");
      } else {
        await createTeachingPlan(payload, accessToken!);
        triggerNotification("New lesson plan created successfully!");
      }

      setCreateModalOpen(false);
      setIsEditing(false);
      loadTeachingPlans();
      loadOverallProgress();
      loadAllSubjectsProgress();
      
      // Reset form
      setFormData({
        subjectId: subjects[0]?.subjectId || "",
        section: subjects[0]?.section || "",
        weekNumber: 1,
        lessonDate: new Date().toISOString().split("T")[0],
        topicTitle: "",
        topicDescription: "",
        learningObjectives: "",
        homework: "",
        quizPlanned: false,
        materialId: "",
        assignmentId: ""
      });
    } catch (err: any) {
      setFormError(err.message || "Failed to submit lesson plan.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);

    if (!selectedPlan) return;

    try {
      await rescheduleTeachingPlan(selectedPlan.id, {
        newDate: rescheduleData.newDate,
        reason: rescheduleData.reason || undefined
      }, accessToken!);
      
      triggerNotification("Lesson successfully rescheduled!");
      setRescheduleModalOpen(false);
      loadTeachingPlans();
      loadOverallProgress();
      loadAllSubjectsProgress();
    } catch (err: any) {
      setFormError(err.message || "Failed to reschedule lesson.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkComplete = async (plan: TeachingPlan) => {
    if (!accessToken) return;
    try {
      await completeTeachingPlan(plan.id, accessToken);
      triggerNotification(`Lesson "${plan.topicTitle}" marked Completed!`);
      loadTeachingPlans();
      loadOverallProgress();
      loadAllSubjectsProgress();
      if (selectedPlan && selectedPlan.id === plan.id) {
        // Sync open details card
        setSelectedPlan(prev => prev ? { ...prev, completionStatus: "Completed" } : null);
      }
    } catch (err: any) {
      alert(err.message || "Failed to mark lesson completed");
    }
  };

  const handleCancelLesson = async (plan: TeachingPlan) => {
    if (!accessToken) return;
    if (confirm(`Are you sure you want to cancel the lesson "${plan.topicTitle}"?`)) {
      try {
        await updateTeachingPlan(plan.id, { completionStatus: "Cancelled" }, accessToken);
        triggerNotification(`Lesson "${plan.topicTitle}" cancelled.`);
        loadTeachingPlans();
        loadOverallProgress();
        loadAllSubjectsProgress();
        if (selectedPlan && selectedPlan.id === plan.id) {
          setSelectedPlan(prev => prev ? { ...prev, completionStatus: "Cancelled" } : null);
        }
      } catch (err: any) {
        alert(err.message || "Failed to cancel lesson");
      }
    }
  };

  const handleDeletePlan = async (plan: TeachingPlan) => {
    if (!accessToken) return;
    if (confirm(`Are you sure you want to delete the lesson plan for "${plan.topicTitle}"?`)) {
      try {
        await deleteTeachingPlan(plan.id, accessToken);
        triggerNotification("Lesson plan deleted.");
        setDetailsModalOpen(false);
        loadTeachingPlans();
        loadOverallProgress();
        loadAllSubjectsProgress();
      } catch (err: any) {
        alert(err.message || "Failed to delete lesson plan");
      }
    }
  };

  const handleOpenEdit = (plan: TeachingPlan) => {
    setSelectedPlan(plan);
    setIsEditing(true);
    setFormData({
      subjectId: plan.subjectId,
      section: plan.section,
      weekNumber: plan.weekNumber,
      lessonDate: new Date(plan.lessonDate).toISOString().split("T")[0],
      topicTitle: plan.topicTitle,
      topicDescription: plan.topicDescription || "",
      learningObjectives: plan.learningObjectives || "",
      homework: plan.homework || "",
      quizPlanned: plan.quizPlanned,
      materialId: plan.materialId || "",
      assignmentId: plan.assignmentId || ""
    });
    setDetailsModalOpen(false);
    setCreateModalOpen(true);
  };

  // Helper date generators for calendar view
  const startOfWeek = (date: Date) => {
    const diff = date.getDate() - date.getDay() + (date.getDay() === 0 ? -6 : 1); // adjust when day is sunday
    return new Date(date.setDate(diff));
  };

  const getWeekDays = (date: Date) => {
    const start = startOfWeek(new Date(date));
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(new Date(start.setDate(start.getDate() + (i === 0 ? 0 : 1))));
    }
    return days;
  };

  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);

  // Filters logic
  const filteredPlans = useMemo(() => {
    return teachingPlans.filter((plan) => {
      const matchSearch =
        plan.topicTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        plan.subjectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        plan.subjectCode.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchSubject = filterSubject ? plan.subjectId === filterSubject : true;
      const matchWeek = filterWeek ? plan.weekNumber === Number(filterWeek) : true;
      const matchStatus = filterStatus ? plan.completionStatus === filterStatus : true;

      return matchSearch && matchSubject && matchWeek && matchStatus;
    });
  }, [teachingPlans, searchTerm, filterSubject, filterWeek, filterStatus]);

  // Group lessons by date for monthly/weekly planner grids
  const plansByDate = useMemo(() => {
    const map: Record<string, TeachingPlan[]> = {};
    teachingPlans.forEach(plan => {
      const dStr = new Date(plan.lessonDate).toISOString().split("T")[0];
      if (!map[dStr]) map[dStr] = [];
      map[dStr].push(plan);
    });
    return map;
  }, [teachingPlans]);

  // Navigation callbacks for calendar views
  const handlePrevDateRange = () => {
    if (calendarView === "week") {
      setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() - 7));
    } else {
      setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    }
  };

  const handleNextDateRange = () => {
    if (calendarView === "week") {
      setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 7));
    } else {
      setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    }
  };

  // Status mapping UI class helper
  const getStatusBadge = (status: CompletionStatus) => {
    switch (status) {
      case "Completed":
        return "bg-success-soft text-success border border-success/20";
      case "Rescheduled":
        return "bg-warning-soft text-warning border border-warning/20";
      case "Cancelled":
        return "bg-danger-soft text-danger border border-danger/20";
      default:
        return "bg-accent-blue-soft text-accent-blue border border-accent-blue/20";
    }
  };

  return (
    <div className="space-y-6 pb-12 w-full max-w-7xl mx-auto">
      {/* Header with Title & Notification banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-2xl dark:text-white text-text-primary">Faculty Teaching Planner</h2>
          <p className="text-xs dark:text-neutral-400 text-text-secondary mt-1">
            Plan lessons, map curriculum sequences, link LMS assets, and track overall syllabus progress.
          </p>
        </div>
        
        {/* Dynamic simulation notice or quick info */}
        {authFaculty && (
          <div className="flex items-center gap-1.5 bg-surface border border-border-subtle px-3 py-1.5 rounded-lg text-xs font-semibold text-text-primary">
            <BookOpen size={14} className="text-accent-blue" />
            <span>Profile: {authFaculty.fullName} ({authFaculty.departmentName})</span>
          </div>
        )}
      </div>

      {notification && (
        <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-450 text-xs font-bold flex items-center gap-2 animate-fade-in">
          <CheckCircle size={14} />
          <span>{notification}</span>
        </div>
      )}

      {/* OVERVIEW CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatsCard
          title="Subjects Assigned"
          value={loadingSubjects ? "..." : subjects.length}
          icon={BookOpen}
          description="Allocated workloads"
          iconClass="dark:bg-blue-500/10 bg-blue-50 dark:text-blue-400 text-blue-700 border dark:border-blue-500/20 border-blue-200"
        />
        <StatsCard
          title="Lessons Planned"
          value={loadingProgress ? "..." : progressStats?.totalPlanned ?? 0}
          icon={CalendarDays}
          description="Total planned hours"
          iconClass="dark:bg-indigo-500/10 bg-indigo-50 dark:text-indigo-400 text-indigo-755 border dark:border-indigo-500/20 border-indigo-200"
        />
        <StatsCard
          title="Lessons Completed"
          value={loadingProgress ? "..." : progressStats?.completed ?? 0}
          icon={CheckCircle}
          description="Completed topic targets"
          iconClass="dark:bg-emerald-500/10 bg-emerald-50 dark:text-emerald-400 text-emerald-700 border dark:border-emerald-500/20 border-emerald-200"
        />
        <StatsCard
          title="Lessons Remaining"
          value={loadingProgress ? "..." : progressStats?.remaining ?? 0}
          icon={Clock}
          description="Syllabus items pending"
          iconClass="dark:bg-amber-500/10 bg-amber-50 dark:text-amber-400 text-amber-700 border dark:border-amber-500/20 border-amber-200"
        />
        <StatsCard
          title="Syllabus Completion"
          value={loadingProgress ? "..." : `${progressStats?.completionPercentage ?? 0}%`}
          icon={CheckCircle}
          description="Average semester status"
          iconClass="dark:bg-purple-500/10 bg-purple-50 dark:text-purple-400 text-purple-700 border dark:border-purple-500/20 border-purple-200"
        />
      </div>

      {/* QUICK ACTIONS */}
      <div className="bg-surface border border-border-subtle rounded-xl p-5 shadow-sm">
        <h3 className="font-display font-bold text-text-primary text-xs uppercase tracking-wider mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => {
              setIsEditing(false);
              setFormData({
                subjectId: subjects[0]?.subjectId || "",
                section: subjects[0]?.section || "",
                weekNumber: 1,
                lessonDate: new Date().toISOString().split("T")[0],
                topicTitle: "",
                topicDescription: "",
                learningObjectives: "",
                homework: "",
                quizPlanned: false,
                materialId: "",
                assignmentId: ""
              });
              setCreateModalOpen(true);
            }}
            disabled={subjects.length === 0}
            className="flex flex-col items-center justify-center p-4 rounded-lg border border-border-subtle bg-background/45 hover:bg-surface-elevated/20 dark:hover:border-blue-500/30 hover:border-blue-500/40 transition text-center group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={20} className="text-blue-400 group-hover:scale-110 transition-transform mb-2" />
            <span className="text-xs font-semibold text-text-primary">Create Lesson</span>
            <span className="text-[9px] text-text-muted mt-0.5">Map a new syllabus topic</span>
          </button>

          <Link
            href="/faculty/lms"
            className="flex flex-col items-center justify-center p-4 rounded-lg border border-border-subtle bg-background/45 hover:bg-surface-elevated/20 dark:hover:border-emerald-500/30 hover:border-emerald-500/40 transition text-center group cursor-pointer"
          >
            <Download size={20} className="text-emerald-400 group-hover:scale-110 transition-transform mb-2" />
            <span className="text-xs font-semibold text-text-primary">Upload Material</span>
            <span className="text-[9px] text-text-muted mt-0.5">Add PPTs, PDFs to LMS</span>
          </Link>

          <Link
            href="/faculty/lms"
            className="flex flex-col items-center justify-center p-4 rounded-lg border border-border-subtle bg-background/45 hover:bg-surface-elevated/20 dark:hover:border-indigo-500/30 hover:border-indigo-500/40 transition text-center group cursor-pointer"
          >
            <FileText size={20} className="text-indigo-400 group-hover:scale-110 transition-transform mb-2" />
            <span className="text-xs font-semibold text-text-primary">Create Assignment</span>
            <span className="text-[9px] text-text-muted mt-0.5">Publish new course tasks</span>
          </Link>

          <button
            onClick={() => {
              const el = document.getElementById("planner-section");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            }}
            className="flex flex-col items-center justify-center p-4 rounded-lg border border-border-subtle bg-background/45 hover:bg-surface-elevated/20 dark:hover:border-purple-500/30 hover:border-purple-500/40 transition text-center group cursor-pointer"
          >
            <CalendarDays size={20} className="text-purple-400 group-hover:scale-110 transition-transform mb-2" />
            <span className="text-xs font-semibold text-text-primary">View Weekly Planner</span>
            <span className="text-[9px] text-text-muted mt-0.5">Scroll to weekly calendar</span>
          </button>
        </div>
      </div>

      {/* COURSE PROGRESS GRID */}
      <div className="bg-surface border border-border-subtle rounded-xl p-5 shadow-sm">
        <h3 className="font-display font-bold text-text-primary text-xs uppercase tracking-wider mb-4">Subject Syllabus Progress</h3>
        
        {loadingSubjectProgress ? (
          <div className="flex justify-center py-6">
            <Loader2 className="animate-spin text-accent-blue" size={24} />
          </div>
        ) : Object.keys(subjectProgress).length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(subjectProgress).map(([key, stats]) => (
              <div key={key} className="p-4 rounded-xl border border-border-subtle bg-background/45 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-bold text-sm text-text-primary">{stats.subjectName}</h4>
                      <span className="text-[10px] text-text-muted font-mono block mt-0.5">
                        Code: {stats.subjectCode} &middot; Section: {stats.section}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-accent-blue">{stats.completionPercentage}%</span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-border-subtle rounded-full h-2 mt-2 overflow-hidden">
                    <div
                      className="bg-accent-blue h-2 rounded-full transition-all duration-500"
                      style={{ width: `${stats.completionPercentage}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-border-subtle/50 text-center text-[10px] font-semibold text-text-secondary">
                  <div>
                    <span className="text-text-muted block text-[9px] uppercase">Planned</span>
                    <span className="text-xs font-bold mt-0.5 block">{stats.totalPlanned}</span>
                  </div>
                  <div>
                    <span className="text-text-muted block text-[9px] uppercase text-success">Completed</span>
                    <span className="text-xs font-bold text-success mt-0.5 block">{stats.completed}</span>
                  </div>
                  <div>
                    <span className="text-text-muted block text-[9px] uppercase text-warning">Remaining</span>
                    <span className="text-xs font-bold text-warning mt-0.5 block">{stats.remaining}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-text-muted font-mono text-xs italic">
            No active progress statistics available. Create a lesson plan to begin.
          </div>
        )}
      </div>

      {/* WEEKLY & MONTHLY PLANNER CALENDAR SECTION */}
      <div id="planner-section" className="bg-surface border border-border-subtle rounded-xl p-5 shadow-sm scroll-mt-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <h3 className="font-display font-bold text-lg text-text-primary">Weekly / Monthly Planner</h3>
            
            {/* View switcher */}
            <div className="flex dark:bg-neutral-950 bg-neutral-100 border dark:border-neutral-850 border-border-subtle rounded-lg p-0.5">
              <button
                onClick={() => setCalendarView("week")}
                className={`px-3 py-1 text-[11px] font-bold rounded cursor-pointer transition ${
                  calendarView === "week"
                    ? "bg-accent-blue text-white shadow-md shadow-accent-blue/15"
                    : "dark:text-neutral-400 text-text-secondary hover:text-text-primary"
                }`}
              >
                Week View
              </button>
              <button
                onClick={() => setCalendarView("month")}
                className={`px-3 py-1 text-[11px] font-bold rounded cursor-pointer transition ${
                  calendarView === "month"
                    ? "bg-accent-blue text-white shadow-md shadow-accent-blue/15"
                    : "dark:text-neutral-400 text-text-secondary hover:text-text-primary"
                }`}
              >
                Month View
              </button>
            </div>
          </div>

          {/* Calendar header controls */}
          <div className="flex items-center gap-3 self-end md:self-auto">
            <button
              onClick={handlePrevDateRange}
              className="p-1.5 rounded-lg border border-border-subtle hover:bg-surface-hover transition cursor-pointer text-text-muted hover:text-text-primary"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="font-mono text-xs font-bold text-text-primary tracking-wider min-w-[120px] text-center">
              {calendarView === "week"
                ? `${weekDays[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${weekDays[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                : currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })
              }
            </span>
            <button
              onClick={handleNextDateRange}
              className="p-1.5 rounded-lg border border-border-subtle hover:bg-surface-hover transition cursor-pointer text-text-muted hover:text-text-primary"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* SEARCH AND FILTERS */}
        <div className="glass-card border border-border-subtle rounded-xl p-4 flex flex-col md:flex-row justify-between items-center gap-3 mb-6">
          <div className="w-full md:flex-1 relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 dark:text-neutral-500 text-text-muted" />
            <input
              type="text"
              placeholder="Search plans by subject name, code, or topic..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs dark:bg-neutral-950 bg-surface border dark:border-neutral-850 border-border-subtle rounded dark:text-white text-text-primary focus:outline-none focus:border-accent-blue transition"
            />
          </div>

          <div className="w-full md:w-auto flex flex-wrap items-center gap-2">
            {/* Subject filter */}
            <div className="flex-1 sm:flex-initial flex items-center gap-2 dark:bg-neutral-955 bg-surface border dark:border-neutral-850 border-border-subtle rounded px-2.5 text-xs dark:text-white text-text-primary">
              <Filter size={12} className="dark:text-neutral-500 text-text-muted" />
              <select
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                className="bg-transparent dark:text-white text-text-primary cursor-pointer py-2 focus:outline-none max-w-[150px]"
              >
                <option value="">All Subjects</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.subjectId}>{s.subjectCode}</option>
                ))}
              </select>
            </div>

            {/* Week filter */}
            <div className="flex-1 sm:flex-initial flex items-center gap-2 dark:bg-neutral-955 bg-surface border dark:border-neutral-850 border-border-subtle rounded px-2.5 text-xs dark:text-white text-text-primary">
              <Filter size={12} className="dark:text-neutral-500 text-text-muted" />
              <select
                value={filterWeek}
                onChange={(e) => setFilterWeek(e.target.value)}
                className="bg-transparent dark:text-white text-text-primary cursor-pointer py-2 focus:outline-none"
              >
                <option value="">All Weeks</option>
                {Array.from({ length: 16 }, (_, i) => i + 1).map(w => (
                  <option key={w} value={w}>Week {w}</option>
                ))}
              </select>
            </div>

            {/* Status filter */}
            <div className="flex-1 sm:flex-initial flex items-center gap-2 dark:bg-neutral-955 bg-surface border dark:border-neutral-850 border-border-subtle rounded px-2.5 text-xs dark:text-white text-text-primary">
              <Filter size={12} className="dark:text-neutral-500 text-text-muted" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-transparent dark:text-white text-text-primary cursor-pointer py-2 focus:outline-none"
              >
                <option value="">All Statuses</option>
                <option value="Planned">Planned</option>
                <option value="Completed">Completed</option>
                <option value="Rescheduled">Rescheduled</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        {/* CALENDAR BODY */}
        {loadingPlans ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-muted gap-2">
            <Loader2 className="animate-spin text-accent-blue" size={32} />
            <span className="text-xs font-mono">Loading teaching plans calendar...</span>
          </div>
        ) : calendarView === "week" ? (
          /* WEEK VIEW GRID */
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
            {weekDays.map((day, idx) => {
              const dayStr = day.toISOString().split("T")[0];
              const dayPlans = plansByDate[dayStr] || [];
              
              // Apply active filters on week days
              const filteredDayPlans = dayPlans.filter(p => {
                const matchSearch =
                  p.topicTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  p.subjectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  p.subjectCode.toLowerCase().includes(searchTerm.toLowerCase());
                
                const matchSubject = filterSubject ? p.subjectId === filterSubject : true;
                const matchWeek = filterWeek ? p.weekNumber === Number(filterWeek) : true;
                const matchStatus = filterStatus ? p.completionStatus === filterStatus : true;

                return matchSearch && matchSubject && matchWeek && matchStatus;
              });

              const isToday = new Date().toISOString().split("T")[0] === dayStr;

              return (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border flex flex-col min-h-[220px] transition-colors ${
                    isToday
                      ? "bg-accent-blue/[0.03] border-accent-blue/40"
                      : "bg-background/25 border-border-subtle"
                  }`}
                >
                  {/* Day header */}
                  <div className="flex items-center justify-between pb-2 border-b border-border-subtle mb-3">
                    <span className="text-[10px] font-black text-text-muted uppercase tracking-wider font-mono">
                      {day.toLocaleDateString("en-US", { weekday: "short" })}
                    </span>
                    <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded-full ${
                      isToday ? "bg-accent-blue text-white" : "text-text-primary"
                    }`}>
                      {day.getDate()}
                    </span>
                  </div>

                  {/* Day plans */}
                  <div className="flex-1 space-y-2 overflow-y-auto max-h-[200px] custom-scrollbar">
                    {filteredDayPlans.length > 0 ? (
                      filteredDayPlans.map((plan) => (
                        <div
                          key={plan.id}
                          onClick={() => {
                            setSelectedPlan(plan);
                            setDetailsModalOpen(true);
                          }}
                          className={`p-2.5 rounded-lg border text-left cursor-pointer hover:scale-[1.01] hover:shadow-sm active:scale-[0.99] transition duration-150 ${
                            plan.completionStatus === "Completed"
                              ? "bg-success-soft/20 border-success/30 hover:border-success/50"
                              : plan.completionStatus === "Rescheduled"
                              ? "bg-warning-soft/20 border-warning/30 hover:border-warning/50"
                              : plan.completionStatus === "Cancelled"
                              ? "bg-danger-soft/20 border-danger/30 hover:border-danger/50"
                              : "bg-accent-blue-soft/20 border-accent-blue/30 hover:border-accent-blue/50"
                          }`}
                        >
                          <span className="text-[8px] font-bold text-text-muted uppercase font-mono block">
                            Week {plan.weekNumber} &middot; Sec {plan.section}
                          </span>
                          <h4 className="text-xs font-bold text-text-primary truncate mt-0.5">
                            {plan.topicTitle}
                          </h4>
                          <div className="flex items-center justify-between mt-1 text-[9px] text-text-secondary font-mono">
                            <span className="truncate max-w-[80px] font-semibold">{plan.subjectCode}</span>
                            <span className={`px-1 py-0.2 rounded text-[7px] font-bold font-sans ${
                              plan.completionStatus === "Completed" ? "text-success" :
                              plan.completionStatus === "Rescheduled" ? "text-warning" :
                              plan.completionStatus === "Cancelled" ? "text-danger" : "text-accent-blue"
                            }`}>
                              {plan.completionStatus}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <span className="text-[9px] text-text-muted font-mono italic block text-center mt-6">
                        No sessions
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* MONTH VIEW GRID */
          <div>
            {/* Month Day Headers */}
            <div className="grid grid-cols-7 gap-2 mb-2 text-center">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => (
                <div key={i} className="text-[10px] font-bold text-text-muted uppercase">
                  {d}
                </div>
              ))}
            </div>

            {/* Grid days */}
            <div className="grid grid-cols-7 gap-2">
              {(() => {
                const year = currentDate.getFullYear();
                const month = currentDate.getMonth();
                const totalDays = new Date(year, month + 1, 0).getDate();
                
                // Get day index of the first day of the month (1 for Mon, 7 for Sun)
                let startDay = new Date(year, month, 1).getDay();
                startDay = startDay === 0 ? 6 : startDay - 1; // Align to Mon-Sun index

                const gridDays: (Date | null)[] = [];
                for (let i = 0; i < startDay; i++) {
                  gridDays.push(null);
                }
                for (let i = 1; i <= totalDays; i++) {
                  gridDays.push(new Date(year, month, i));
                }

                // Append empty cells for full rows
                while (gridDays.length % 7 !== 0) {
                  gridDays.push(null);
                }

                return gridDays.map((day, cellIdx) => {
                  if (day === null) {
                    return <div key={`empty-month-${cellIdx}`} className="h-20 bg-background/5 border border-transparent rounded-lg" />;
                  }

                  const dayStr = day.toISOString().split("T")[0];
                  const dayPlans = plansByDate[dayStr] || [];
                  
                  // Filter plans
                  const filteredDayPlans = dayPlans.filter(p => {
                    const matchSearch =
                      p.topicTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      p.subjectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      p.subjectCode.toLowerCase().includes(searchTerm.toLowerCase());
                    
                    const matchSubject = filterSubject ? p.subjectId === filterSubject : true;
                    const matchWeek = filterWeek ? p.weekNumber === Number(filterWeek) : true;
                    const matchStatus = filterStatus ? p.completionStatus === filterStatus : true;

                    return matchSearch && matchSubject && matchWeek && matchStatus;
                  });

                  const isToday = new Date().toISOString().split("T")[0] === dayStr;

                  return (
                    <div
                      key={`day-month-${day.getDate()}`}
                      className={`h-24 p-2 rounded-xl border flex flex-col text-left transition-colors relative overflow-hidden ${
                        isToday
                          ? "bg-accent-blue/[0.03] border-accent-blue/40"
                          : "bg-background/25 border-border-subtle"
                      }`}
                    >
                      <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded ${
                        isToday ? "bg-accent-blue text-white" : "text-text-muted"
                      } absolute top-1.5 right-1.5`}>
                        {day.getDate()}
                      </span>

                      {/* Display lessons (max 2 visible, then "+X more") */}
                      <div className="flex-1 mt-4 space-y-1 overflow-hidden">
                        {filteredDayPlans.slice(0, 2).map((plan) => (
                          <div
                            key={plan.id}
                            onClick={() => {
                              setSelectedPlan(plan);
                              setDetailsModalOpen(true);
                            }}
                            className={`px-1.5 py-0.5 rounded text-[8px] font-bold font-sans cursor-pointer truncate ${
                              plan.completionStatus === "Completed"
                                ? "bg-success-soft text-success border border-success/15"
                                : plan.completionStatus === "Rescheduled"
                                ? "bg-warning-soft text-warning border border-warning/15"
                                : plan.completionStatus === "Cancelled"
                                ? "bg-danger-soft text-danger border border-danger/15"
                                : "bg-accent-blue-soft text-accent-blue border border-accent-blue/15"
                            }`}
                            title={plan.topicTitle}
                          >
                            {plan.subjectCode}: {plan.topicTitle}
                          </div>
                        ))}
                        {filteredDayPlans.length > 2 && (
                          <div className="text-[8px] font-black text-text-muted italic text-center">
                            +{filteredDayPlans.length - 2} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}
      </div>

      {/* RENDER FORM / CREATION MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="glass-card bg-surface w-full max-w-xl rounded-xl border border-border-subtle shadow-2xl overflow-hidden animate-scale-up max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-5 border-b border-border-subtle shrink-0">
              <h3 className="font-display font-bold text-lg text-text-primary">
                {isEditing ? "Edit Lesson Plan" : "Create Semester Lesson Plan"}
              </h3>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
              {formError && (
                <div className="p-3 bg-danger-soft border border-danger/20 text-danger text-xs rounded-lg flex items-center gap-2">
                  <AlertCircle size={14} />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Subject selection */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Subject</label>
                  <select
                    disabled={isEditing}
                    value={formData.subjectId}
                    onChange={handleSubjectChange}
                    className="w-full px-3 py-2 bg-background border border-border-subtle text-xs font-semibold rounded focus:ring-1 focus:ring-accent-blue transition cursor-pointer disabled:opacity-50"
                  >
                    <option value="">Select Assigned Subject</option>
                    {subjects.map(s => (
                      <option key={s.id} value={s.subjectId}>
                        {s.subjectCode} - {s.subjectName} (Sec {s.section})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Section selection */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Section</label>
                  <input
                    type="text"
                    disabled
                    value={formData.section}
                    className="w-full px-3 py-2 bg-surface-hover border border-border-subtle text-xs font-semibold rounded text-text-muted font-mono"
                  />
                </div>

                {/* Week Number */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Week Number</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={16}
                    value={formData.weekNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, weekNumber: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-background border border-border-subtle text-xs font-semibold rounded focus:ring-1 focus:ring-accent-blue transition font-mono"
                  />
                </div>

                {/* Lesson Date */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Lesson Date</label>
                  <input
                    type="date"
                    required
                    value={formData.lessonDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, lessonDate: e.target.value }))}
                    className="w-full px-3 py-2 bg-background border border-border-subtle text-xs font-semibold rounded focus:ring-1 focus:ring-accent-blue transition font-mono"
                  />
                </div>
              </div>

              {/* Topic Title */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Topic Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Introduction to Joins & Subqueries"
                  value={formData.topicTitle}
                  onChange={(e) => setFormData(prev => ({ ...prev, topicTitle: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-border-subtle text-xs font-semibold rounded focus:ring-1 focus:ring-accent-blue transition"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Topic Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Provide brief details on key focus items of the class..."
                  value={formData.topicDescription}
                  onChange={(e) => setFormData(prev => ({ ...prev, topicDescription: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-border-subtle text-xs font-semibold rounded focus:ring-1 focus:ring-accent-blue transition"
                />
              </div>

              {/* Learning Objectives */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Learning Objectives (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="e.g., Define inner/outer joins, Write structured query parameters..."
                  value={formData.learningObjectives}
                  onChange={(e) => setFormData(prev => ({ ...prev, learningObjectives: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-border-subtle text-xs font-semibold rounded focus:ring-1 focus:ring-accent-blue transition"
                />
              </div>

              <div className="border-t border-border-subtle/50 my-4 pt-4 space-y-4">
                <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Evaluation & LMS Mappings</h4>
                
                {/* Homework description */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Homework Assignment (Optional)</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Complete problems 5.1 through 5.8 on textbook chapter 3."
                    value={formData.homework}
                    onChange={(e) => setFormData(prev => ({ ...prev, homework: e.target.value }))}
                    className="w-full px-3 py-2 bg-background border border-border-subtle text-xs font-semibold rounded focus:ring-1 focus:ring-accent-blue transition"
                  />
                </div>

                <div className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    id="quizPlanned"
                    checked={formData.quizPlanned}
                    onChange={(e) => setFormData(prev => ({ ...prev, quizPlanned: e.target.checked }))}
                    className="w-4 h-4 text-accent-blue rounded focus:ring-1 accent-accent-blue bg-background border-border-subtle"
                  />
                  <label htmlFor="quizPlanned" className="text-xs font-bold text-text-primary cursor-pointer select-none">
                    Schedule Evaluation Quiz for this lesson
                  </label>
                </div>

                {/* Attach LMS Material */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Link LMS Material (Optional)</label>
                    <span className="text-[9px] text-text-muted">Must be uploaded under LMS module first</span>
                  </div>
                  <select
                    disabled={loadingLmsData}
                    value={formData.materialId}
                    onChange={(e) => setFormData(prev => ({ ...prev, materialId: e.target.value }))}
                    className="w-full px-3 py-2 bg-background border border-border-subtle text-xs font-semibold rounded focus:ring-1 focus:ring-accent-blue transition cursor-pointer"
                  >
                    <option value="">-- Do Not Link LMS Document --</option>
                    {lmsMaterials.map(m => (
                      <option key={m.id} value={m.id}>{m.title} ({m.fileName})</option>
                    ))}
                  </select>
                </div>

                {/* Attach LMS Assignment */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Link LMS Assignment (Optional)</label>
                    <span className="text-[9px] text-text-muted">Must be active under LMS module first</span>
                  </div>
                  <select
                    disabled={loadingLmsData}
                    value={formData.assignmentId}
                    onChange={(e) => setFormData(prev => ({ ...prev, assignmentId: e.target.value }))}
                    className="w-full px-3 py-2 bg-background border border-border-subtle text-xs font-semibold rounded focus:ring-1 focus:ring-accent-blue transition cursor-pointer"
                  >
                    <option value="">-- Do Not Link LMS Assignment --</option>
                    {lmsAssignments.map(a => (
                      <option key={a.id} value={a.id}>{a.title} (Max: {a.maxMarks})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-border-subtle shrink-0">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 border border-border-subtle text-text-secondary hover:bg-surface-hover text-xs font-bold rounded cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-accent-blue hover:bg-accent-blue/90 text-white text-xs font-bold rounded shadow-md shadow-accent-blue/10 cursor-pointer transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
                  <span>{isEditing ? "Save Changes" : "Publish Lesson"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RENDER DETAILED LESSON INFO MODAL */}
      {detailsModalOpen && selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="glass-card bg-surface w-full max-w-lg rounded-xl border border-border-subtle shadow-2xl overflow-hidden animate-scale-up max-h-[90vh] flex flex-col">
            
            {/* Header */}
            <div className="flex justify-between items-center p-5 border-b border-border-subtle shrink-0">
              <div>
                <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full font-mono ${getStatusBadge(selectedPlan.completionStatus)}`}>
                  {selectedPlan.completionStatus}
                </span>
                <span className="text-[10px] text-text-muted font-mono ml-2">Week {selectedPlan.weekNumber} &middot; Sec {selectedPlan.section}</span>
              </div>
              <button
                onClick={() => setDetailsModalOpen(false)}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Title & Metadata */}
              <div className="space-y-2">
                <span className="text-[9px] uppercase font-black text-accent-blue tracking-widest font-mono">
                  {selectedPlan.subjectCode} &middot; {selectedPlan.subjectName}
                </span>
                <h3 className="font-display font-bold text-xl text-text-primary leading-tight">
                  {selectedPlan.topicTitle}
                </h3>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-text-secondary font-semibold font-mono pt-1">
                  <span className="flex items-center gap-1">
                    <Calendar size={13} className="text-text-muted" />
                    {new Date(selectedPlan.lessonDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={13} className="text-text-muted" />
                    Time Slot: 09:00 AM
                  </span>
                </div>
              </div>

              {/* Description */}
              {selectedPlan.topicDescription && (
                <div className="space-y-1.5">
                  <h4 className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Description</h4>
                  <p className="text-xs text-text-secondary leading-relaxed font-sans bg-background/55 p-3 rounded-lg border border-border-subtle/50">
                    {selectedPlan.topicDescription}
                  </p>
                </div>
              )}

              {/* Objectives */}
              {selectedPlan.learningObjectives && (
                <div className="space-y-1.5">
                  <h4 className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Learning Objectives</h4>
                  <p className="text-xs text-text-secondary leading-relaxed font-sans bg-background/55 p-3 rounded-lg border border-border-subtle/50 whitespace-pre-wrap">
                    {selectedPlan.learningObjectives}
                  </p>
                </div>
              )}

              {/* Homework */}
              {selectedPlan.homework && (
                <div className="space-y-1.5">
                  <h4 className="text-[10px] uppercase font-bold text-warning tracking-wider flex items-center gap-1">
                    <FileText size={12} />
                    <span>Homework Assigned</span>
                  </h4>
                  <p className="text-xs text-text-secondary leading-relaxed font-sans bg-warning-soft/[0.1] p-3 rounded-lg border border-warning/15">
                    {selectedPlan.homework}
                  </p>
                </div>
              )}

              {/* Evaluation Quiz */}
              {selectedPlan.quizPlanned && (
                <div className="p-3.5 rounded-lg bg-danger-soft/[0.15] border border-danger/15 flex items-center gap-3">
                  <AlertCircle className="text-danger shrink-0" size={16} />
                  <div className="text-xs font-semibold">
                    <span className="text-danger block uppercase text-[9px] tracking-wider font-bold">Planned Evaluation</span>
                    <span className="text-text-primary">A short quiz is scheduled based on this lesson topic.</span>
                  </div>
                </div>
              )}

              {/* Attached Material/Assignment */}
              {(selectedPlan.materialId || selectedPlan.assignmentId) && (
                <div className="space-y-2 border-t border-border-subtle/60 pt-4">
                  <h4 className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Linked LMS Assets</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedPlan.materialId && (
                      <div className="p-3 rounded-lg border border-border-subtle bg-background/30 flex flex-col justify-between text-xs">
                        <div>
                          <span className="text-[8px] font-black text-accent-blue uppercase font-mono">LMS Material</span>
                          <h5 className="font-bold text-text-primary mt-1 line-clamp-1">{selectedPlan.materialTitle || "Download Document"}</h5>
                        </div>
                        {selectedPlan.materialDownloadUrl && (
                          <button
                            onClick={async () => {
                              try {
                                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001/api"}${selectedPlan.materialDownloadUrl}`, {
                                  headers: { Authorization: `Bearer ${accessToken}` }
                                });
                                if (!res.ok) throw new Error();
                                const blob = await res.blob();
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = selectedPlan.materialTitle || "document";
                                document.body.appendChild(a);
                                a.click();
                                a.remove();
                              } catch {
                                alert("Failed to download attached document.");
                              }
                            }}
                            className="mt-3 text-[10px] font-bold text-accent-blue hover:underline text-left flex items-center gap-1 cursor-pointer"
                          >
                            <Download size={11} /> Download PDF/Doc
                          </button>
                        )}
                      </div>
                    )}

                    {selectedPlan.assignmentId && (
                      <div className="p-3 rounded-lg border border-border-subtle bg-background/30 flex flex-col justify-between text-xs">
                        <div>
                          <span className="text-[8px] font-black text-indigo-400 uppercase font-mono">LMS Assignment</span>
                          <h5 className="font-bold text-text-primary mt-1 line-clamp-1">{selectedPlan.assignmentTitle || "Linked Task"}</h5>
                        </div>
                        {selectedPlan.assignmentDueDate && (
                          <span className="text-[9px] text-text-muted block font-mono mt-1">
                            Due: {new Date(selectedPlan.assignmentDueDate).toLocaleDateString()}
                          </span>
                        )}
                        <Link
                          href={`/faculty/lms`}
                          className="mt-3 text-[10px] font-bold text-indigo-400 hover:underline flex items-center gap-0.5"
                        >
                          View Submissions <ExternalLink size={10} />
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Operations */}
            <div className="p-5 border-t border-border-subtle bg-background/35 shrink-0 flex flex-wrap gap-2.5 justify-between">
              <div>
                {selectedPlan.completionStatus !== "Completed" && selectedPlan.completionStatus !== "Cancelled" && (
                  <button
                    onClick={() => {
                      setRescheduleData({
                        newDate: new Date(selectedPlan.lessonDate).toISOString().split("T")[0],
                        reason: ""
                      });
                      setDetailsModalOpen(false);
                      setRescheduleModalOpen(true);
                    }}
                    className="px-3.5 py-1.5 rounded bg-warning hover:bg-warning/90 text-white text-[11px] font-bold shadow-sm cursor-pointer transition"
                  >
                    Reschedule
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {selectedPlan.completionStatus !== "Completed" && selectedPlan.completionStatus !== "Cancelled" && (
                  <button
                    onClick={() => handleMarkComplete(selectedPlan)}
                    className="px-3.5 py-1.5 rounded bg-success hover:bg-success/90 text-white text-[11px] font-bold shadow-sm cursor-pointer transition flex items-center gap-1"
                  >
                    <CheckCircle size={12} /> Mark Completed
                  </button>
                )}

                {selectedPlan.completionStatus !== "Cancelled" && selectedPlan.completionStatus !== "Completed" && (
                  <button
                    onClick={() => handleCancelLesson(selectedPlan)}
                    className="p-1.5 rounded border border-danger/25 text-danger hover:bg-danger-soft/[0.1] text-[11px] font-bold cursor-pointer transition"
                    title="Cancel Lesson"
                  >
                    Cancel
                  </button>
                )}

                {selectedPlan.completionStatus !== "Completed" && selectedPlan.completionStatus !== "Cancelled" && (
                  <button
                    onClick={() => handleOpenEdit(selectedPlan)}
                    className="p-1.5 rounded border border-border-subtle text-text-secondary hover:text-text-primary hover:bg-surface-hover cursor-pointer transition"
                    title="Edit Lesson details"
                  >
                    <Edit2 size={13} />
                  </button>
                )}

                <button
                  onClick={() => handleDeletePlan(selectedPlan)}
                  className="p-1.5 rounded border border-danger/20 bg-danger-soft/[0.05] hover:bg-danger-soft/[0.15] text-danger transition cursor-pointer"
                  title="Delete Lesson"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RENDER RESCHEDULE MODAL */}
      {rescheduleModalOpen && selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="glass-card bg-surface w-full max-w-sm rounded-xl border border-border-subtle shadow-2xl overflow-hidden animate-scale-up">
            <div className="flex justify-between items-center p-4 border-b border-border-subtle">
              <h3 className="font-display font-bold text-base text-text-primary">Reschedule Lesson</h3>
              <button
                onClick={() => {
                  setRescheduleModalOpen(false);
                  setDetailsModalOpen(true); // Return to details
                }}
                className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleRescheduleSubmit} className="p-4 space-y-4">
              {formError && (
                <div className="p-2.5 bg-danger-soft border border-danger/20 text-danger text-xs rounded-lg flex items-center gap-1.5">
                  <AlertCircle size={13} />
                  <span>{formError}</span>
                </div>
              )}

              <div className="space-y-1">
                <span className="text-[10px] text-text-muted font-mono uppercase block">Lesson topic</span>
                <span className="text-xs font-bold text-text-primary block">{selectedPlan.topicTitle}</span>
              </div>

              {/* New Date */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-text-muted tracking-wider">New Lesson Date</label>
                <input
                  type="date"
                  required
                  value={rescheduleData.newDate}
                  onChange={(e) => setRescheduleData(prev => ({ ...prev, newDate: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-border-subtle text-xs font-semibold rounded focus:ring-1 focus:ring-accent-blue transition font-mono"
                />
              </div>

              {/* Reason */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Reason for rescheduling</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Provide a reason (e.g. lab block maintenance, public holiday notification)..."
                  value={rescheduleData.reason}
                  onChange={(e) => setRescheduleData(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-border-subtle text-xs font-semibold rounded focus:ring-1 focus:ring-accent-blue transition"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2.5 pt-3 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => {
                    setRescheduleModalOpen(false);
                    setDetailsModalOpen(true);
                  }}
                  className="px-3.5 py-1.5 border border-border-subtle text-text-secondary hover:bg-surface-hover text-xs font-bold rounded cursor-pointer transition"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3.5 py-1.5 bg-warning hover:bg-warning/90 text-white text-xs font-bold rounded shadow-md shadow-warning/10 cursor-pointer transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
                  <span>Reschedule</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
