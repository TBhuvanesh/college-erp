"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { listTeachingPlans, getCourseProgress, TeachingPlan, CourseProgress, CompletionStatus } from "@/lib/teachingPlan";
import {
  CalendarDays,
  CheckCircle,
  Clock,
  Loader2,
  Search,
  Filter,
  Users,
  BookOpen,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  SlidersHorizontal
} from "lucide-react";
import { StatsCard } from "@/components/Dashboard/StatsCard";

export default function AdminTeachingPlanner() {
  const { accessToken } = useAuth();

  // All plans and stats
  const [plans, setPlans] = useState<TeachingPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [globalProgress, setGlobalProgress] = useState<CourseProgress | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(false);

  // Pagination & Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterSemester, setFilterSemester] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterFaculty, setFilterFaculty] = useState("");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Departments list (to filter)
  const [departments, setDepartments] = useState<any[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(false);

  // Load departments
  const loadDepartments = useCallback(async () => {
    if (!accessToken) return;
    setLoadingDepts(true);
    try {
      const res = await apiFetch("/departments", {}, accessToken);
      if (res.success && res.data?.departments) {
        setDepartments(res.data.departments);
      }
    } catch (err) {
      console.error("Failed to load departments in admin planner", err);
    } finally {
      setLoadingDepts(false);
    }
  }, [accessToken]);

  // Load all plans (with high limit or filters applied directly)
  const loadPlans = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const filters: any = {
        page,
        limit: 20
      };
      if (filterSemester) filters.semester = Number(filterSemester);
      if (filterStatus) filters.completionStatus = filterStatus as CompletionStatus;

      const res = await listTeachingPlans(filters, accessToken);
      setPlans(res.teachingPlans || []);
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      console.error("Failed to load teaching plans for admin overview", err);
    } finally {
      setLoading(false);
    }
  }, [accessToken, page, filterSemester, filterStatus]);

  // Load global summary progress stats
  const loadGlobalProgress = useCallback(async () => {
    if (!accessToken) return;
    setLoadingProgress(true);
    try {
      const stats = await getCourseProgress({}, accessToken);
      setGlobalProgress(stats);
    } catch (err) {
      console.error("Failed to load global progress stats", err);
    } finally {
      setLoadingProgress(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadDepartments();
    loadGlobalProgress();
  }, [loadDepartments, loadGlobalProgress]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  // Fetch a larger set in memory to construct the Faculty progress comparison table
  const [allPlansForGrouping, setAllPlansForGrouping] = useState<TeachingPlan[]>([]);
  const [loadingGrouping, setLoadingGrouping] = useState(false);

  const loadAllPlansForGrouping = useCallback(async () => {
    if (!accessToken) return;
    setLoadingGrouping(true);
    try {
      // Load 100 items to cover current workload assignments (backend limit max is 100)
      const res = await listTeachingPlans({ limit: 100 }, accessToken);
      setAllPlansForGrouping(res.teachingPlans || []);
    } catch (err) {
      console.error("Failed to load plans for statistics grouping", err);
    } finally {
      setLoadingGrouping(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadAllPlansForGrouping();
  }, [loadAllPlansForGrouping]);

  // In-memory grouping of plans to build faculty course progress comparison
  const facultyWorkloadProgress = useMemo(() => {
    const map: Record<string, {
      facultyName: string;
      subjectCode: string;
      subjectName: string;
      semester: number;
      section: string;
      planned: number;
      completed: number;
      remaining: number;
      completionPercentage: number;
    }> = {};

    allPlansForGrouping.forEach(plan => {
      const groupKey = `${plan.facultyId}-${plan.subjectId}-${plan.section}`;
      if (!map[groupKey]) {
        map[groupKey] = {
          facultyName: plan.facultyName,
          subjectCode: plan.subjectCode,
          subjectName: plan.subjectName,
          semester: plan.semester,
          section: plan.section,
          planned: 0,
          completed: 0,
          remaining: 0,
          completionPercentage: 0
        };
      }

      const grp = map[groupKey];
      if (plan.completionStatus !== "Cancelled") {
        grp.planned += 1;
        if (plan.completionStatus === "Completed") grp.completed += 1;
      }
    });

    // Calculate percentages and convert to array
    return Object.values(map).map(grp => {
      grp.remaining = grp.planned - grp.completed;
      grp.completionPercentage = grp.planned > 0 ? Math.round((grp.completed / grp.planned) * 100) : 0;
      return grp;
    });
  }, [allPlansForGrouping]);

  // Apply frontend search filters on plans feed & groupings
  const filteredPlans = useMemo(() => {
    return plans.filter(p => {
      const matchSearch =
        p.topicTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.subjectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.facultyName.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchFaculty = filterFaculty ? p.facultyId === filterFaculty : true;
      const matchDept = filterDept ? p.departmentId === filterDept : true;

      return matchSearch && matchFaculty && matchDept;
    });
  }, [plans, searchTerm, filterFaculty, filterDept]);

  const filteredFacultyProgress = useMemo(() => {
    return facultyWorkloadProgress.filter(grp => {
      const matchSearch =
        grp.facultyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        grp.subjectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        grp.subjectCode.toLowerCase().includes(searchTerm.toLowerCase());

      const matchSemester = filterSemester ? grp.semester === Number(filterSemester) : true;

      return matchSearch && matchSemester;
    });
  }, [facultyWorkloadProgress, searchTerm, filterSemester]);

  // Mappers for statuses
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

  // Get unique faculty members for filters
  const uniqueFaculty = useMemo(() => {
    const map: Record<string, string> = {};
    allPlansForGrouping.forEach(p => {
      map[p.facultyId] = p.facultyName;
    });
    return Object.entries(map);
  }, [allPlansForGrouping]);

  return (
    <div className="space-y-6 pb-12 w-full max-w-7xl mx-auto">
      {/* Title block */}
      <div>
        <h2 className="font-display font-bold text-2xl dark:text-white text-text-primary">Teaching Planner Registrar Office</h2>
        <p className="text-xs dark:text-neutral-400 text-text-secondary mt-1">
          Monitor course structures, check faculty syllabus progression rates, and verify academic planning compliance (Read-only).
        </p>
      </div>

      {/* OVERVIEW STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Planned Lessons"
          value={loadingProgress ? "..." : globalProgress?.totalPlanned ?? 0}
          icon={CalendarDays}
          description="Planned semester periods"
          iconClass="dark:bg-blue-500/10 bg-blue-50 dark:text-blue-400 text-blue-700 border dark:border-blue-500/20 border-blue-200"
        />
        <StatsCard
          title="Completed Lessons"
          value={loadingProgress ? "..." : globalProgress?.completed ?? 0}
          icon={CheckCircle}
          description="Syllabus items taught"
          iconClass="dark:bg-emerald-500/10 bg-emerald-50 dark:text-emerald-400 text-emerald-700 border dark:border-emerald-500/20 border-emerald-200"
        />
        <StatsCard
          title="Remaining Lessons"
          value={loadingProgress ? "..." : globalProgress?.remaining ?? 0}
          icon={Clock}
          description="Hours remaining to schedule"
          iconClass="dark:bg-amber-500/10 bg-amber-50 dark:text-amber-400 text-amber-700 border dark:border-amber-500/20 border-amber-200"
        />
        <StatsCard
          title="Avg Syllabus Completion"
          value={loadingProgress ? "..." : `${globalProgress?.completionPercentage ?? 0}%`}
          icon={TrendingUp}
          description="ERP aggregate completion rate"
          iconClass="dark:bg-purple-500/10 bg-purple-50 dark:text-purple-400 text-purple-755 border dark:border-purple-500/20 border-purple-200"
        />
      </div>

      {/* FILTER BAR */}
      <div className="glass-card border border-border-subtle rounded-xl p-4 flex flex-col md:flex-row justify-between items-center gap-3">
        {/* Search */}
        <div className="w-full md:flex-1 relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 dark:text-neutral-500 text-text-muted" />
          <input
            type="text"
            placeholder="Search plans by faculty name, subject code, or topic title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs dark:bg-neutral-950 bg-surface border dark:border-neutral-850 border-border-subtle rounded dark:text-white text-text-primary focus:outline-none focus:border-accent-blue transition"
          />
        </div>

        {/* Filters */}
        <div className="w-full md:w-auto flex flex-wrap items-center gap-2">
          {/* Department filter */}
          <div className="flex-1 sm:flex-initial flex items-center gap-2 dark:bg-neutral-955 bg-surface border dark:border-neutral-850 border-border-subtle rounded px-2.5 text-xs dark:text-white text-text-primary">
            <SlidersHorizontal size={12} className="dark:text-neutral-500 text-text-muted" />
            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className="bg-transparent dark:text-white text-text-primary cursor-pointer py-2 focus:outline-none max-w-[130px]"
            >
              <option value="">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.code}</option>
              ))}
            </select>
          </div>

          {/* Semester filter */}
          <div className="flex-1 sm:flex-initial flex items-center gap-2 dark:bg-neutral-955 bg-surface border dark:border-neutral-850 border-border-subtle rounded px-2.5 text-xs dark:text-white text-text-primary">
            <SlidersHorizontal size={12} className="dark:text-neutral-500 text-text-muted" />
            <select
              value={filterSemester}
              onChange={(e) => setFilterSemester(e.target.value)}
              className="bg-transparent dark:text-white text-text-primary cursor-pointer py-2 focus:outline-none"
            >
              <option value="">All Semesters</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                <option key={s} value={s}>Semester {s}</option>
              ))}
            </select>
          </div>

          {/* Faculty filter */}
          <div className="flex-1 sm:flex-initial flex items-center gap-2 dark:bg-neutral-955 bg-surface border dark:border-neutral-850 border-border-subtle rounded px-2.5 text-xs dark:text-white text-text-primary">
            <SlidersHorizontal size={12} className="dark:text-neutral-500 text-text-muted" />
            <select
              value={filterFaculty}
              onChange={(e) => setFilterFaculty(e.target.value)}
              className="bg-transparent dark:text-white text-text-primary cursor-pointer py-2 focus:outline-none max-w-[150px]"
            >
              <option value="">All Faculty</option>
              {uniqueFaculty.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div className="flex-1 sm:flex-initial flex items-center gap-2 dark:bg-neutral-955 bg-surface border dark:border-neutral-850 border-border-subtle rounded px-2.5 text-xs dark:text-white text-text-primary">
            <SlidersHorizontal size={12} className="dark:text-neutral-500 text-text-muted" />
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

      {/* COMPARISON WORKLOAD TABLE */}
      <div className="bg-surface border border-border-subtle rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-border-subtle flex justify-between items-center bg-background/25">
          <div className="flex items-center gap-2">
            <Users className="text-accent-blue" size={18} />
            <h3 className="font-display font-bold text-text-primary">Faculty Completion Matrix</h3>
          </div>
          <span className="text-[10px] text-text-muted font-mono font-bold uppercase">Aggregate Workload Track</span>
        </div>

        {loadingGrouping ? (
          <div className="flex flex-col items-center justify-center py-12 text-text-muted gap-2">
            <Loader2 className="animate-spin text-accent-blue" size={24} />
            <span className="text-xs font-mono">Assembling matrix data...</span>
          </div>
        ) : filteredFacultyProgress.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="dark:bg-neutral-950 bg-neutral-150 dark:text-neutral-400 text-text-secondary uppercase text-[9px] font-bold font-mono tracking-wider border-b dark:border-neutral-850 border-border-subtle">
                <tr>
                  <th className="p-4">Faculty Member</th>
                  <th className="p-4">Subject</th>
                  <th className="p-4">Semester</th>
                  <th className="p-4">Section</th>
                  <th className="p-4 text-center">Planned Hours</th>
                  <th className="p-4 text-center">Completed</th>
                  <th className="p-4 text-center">Remaining</th>
                  <th className="p-4 text-right">Completion Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-neutral-900 divide-border-subtle bg-surface/50">
                {filteredFacultyProgress.map((grp, idx) => (
                  <tr key={idx} className="dark:hover:bg-neutral-800/10 hover:bg-neutral-100/30 transition-colors">
                    <td className="p-4 font-bold dark:text-white text-text-primary">{grp.facultyName}</td>
                    <td className="p-4">
                      <span className="font-semibold text-text-primary block">{grp.subjectName}</span>
                      <span className="text-[9px] text-text-muted font-mono">{grp.subjectCode}</span>
                    </td>
                    <td className="p-4 font-mono font-semibold">Semester {grp.semester}</td>
                    <td className="p-4 font-mono text-text-secondary font-bold">Sec {grp.section}</td>
                    <td className="p-4 text-center font-mono">{grp.planned}</td>
                    <td className="p-4 text-center font-mono text-success font-semibold">{grp.completed}</td>
                    <td className="p-4 text-center font-mono text-warning font-semibold">{grp.remaining}</td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-bold font-mono dark:text-white text-text-primary">{grp.completionPercentage}%</span>
                        <div className="w-16 bg-border-subtle rounded-full h-1.5 overflow-hidden hidden sm:block">
                          <div
                            className={`h-1.5 rounded-full ${grp.completionPercentage >= 75 ? "bg-success" : grp.completionPercentage >= 40 ? "bg-warning" : "bg-danger"}`}
                            style={{ width: `${grp.completionPercentage}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-10 text-center dark:text-neutral-500 text-text-muted font-mono text-xs italic">
            No course progression data found.
          </div>
        )}
      </div>

      {/* ALL PLANS MASTER LIST (READ-ONLY FEED) */}
      <div className="bg-surface border border-border-subtle rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-border-subtle bg-background/25">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-text-primary text-base">Comprehensive Lesson Schedule</h3>
            <span className="text-[10px] text-text-muted font-mono">Master Feed</span>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-muted gap-2">
            <Loader2 className="animate-spin text-accent-blue" size={24} />
            <span className="text-xs font-mono">Syncing planner sheets...</span>
          </div>
        ) : filteredPlans.length > 0 ? (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="dark:bg-neutral-950 bg-neutral-150 dark:text-neutral-400 text-text-secondary uppercase text-[9px] font-bold font-mono tracking-wider border-b dark:border-neutral-850 border-border-subtle">
                  <tr>
                    <th className="p-4">Week</th>
                    <th className="p-4">Date</th>
                    <th className="p-4">Faculty Member</th>
                    <th className="p-4">Subject</th>
                    <th className="p-4">Topic Title</th>
                    <th className="p-4">Homework / Quiz</th>
                    <th className="p-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-neutral-900 divide-border-subtle bg-surface/50">
                  {filteredPlans.map((plan) => (
                    <tr key={plan.id} className="dark:hover:bg-neutral-800/10 hover:bg-neutral-100/30 transition-colors">
                      <td className="p-4 font-mono font-bold">Week {plan.weekNumber}</td>
                      <td className="p-4 font-mono text-text-secondary">
                        {new Date(plan.lessonDate).toLocaleDateString()}
                      </td>
                      <td className="p-4 font-semibold text-text-primary">{plan.facultyName}</td>
                      <td className="p-4">
                        <span className="font-bold text-text-primary block">{plan.subjectCode}</span>
                        <span className="text-[9px] text-text-muted font-mono">Sec {plan.section}</span>
                      </td>
                      <td className="p-4">
                        <span className="font-semibold text-text-primary block">{plan.topicTitle}</span>
                        {plan.topicDescription && (
                          <span className="text-[10px] text-text-muted line-clamp-1 mt-0.5 max-w-xs">{plan.topicDescription}</span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="space-y-1 text-[10px]">
                          {plan.homework && (
                            <span className="bg-warning-soft text-warning border border-warning/10 px-1.5 py-0.2 rounded font-semibold block w-fit truncate max-w-[120px]">
                              HW: {plan.homework}
                            </span>
                          )}
                          {plan.quizPlanned && (
                            <span className="bg-danger-soft text-danger border border-danger/10 px-1.5 py-0.2 rounded font-semibold block w-fit">
                              Quiz Scheduled
                            </span>
                          )}
                          {!plan.homework && !plan.quizPlanned && (
                            <span className="text-text-muted font-mono italic">—</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[8px] font-bold uppercase font-mono ${getStatusBadge(plan.completionStatus)}`}>
                          {plan.completionStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-border-subtle flex justify-between items-center bg-background/10 font-mono text-xs">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(p - 1, 1))}
                  className="px-3 py-1 border border-border-subtle rounded hover:bg-surface-hover transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-text-muted">
                  Page {page} of {totalPages}
                </span>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                  className="px-3 py-1 border border-border-subtle rounded hover:bg-surface-hover transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="p-10 text-center dark:text-neutral-500 text-text-muted font-mono text-xs italic">
            No lesson schedule plans match selection.
          </div>
        )}
      </div>
    </div>
  );
}
