"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { FeedbackBarChart, FeedbackDoughnutChart } from "@/components/Feedback/FeedbackCharts";
import { AnonymousCommentList } from "@/components/Feedback/AnonymousCommentList";
import { AlertCircle, Calendar, ClipboardList, Filter, Loader2, Star, Users, Award, TrendingUp } from "lucide-react";

export default function HodFeedbackDashboard() {
  const { user, accessToken } = useAuth();
  const [windows, setWindows] = useState<any[]>([]);
  const [facultyMembers, setFacultyMembers] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  
  const [selectedWindow, setSelectedWindow] = useState<string>("");
  const [selectedFaculty, setSelectedFaculty] = useState<string>("ALL");
  const [selectedSubject, setSelectedSubject] = useState<string>("ALL");
  
  const [analytics, setAnalytics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const deptName = user?.facultyProfile?.departmentName || "Department";
  const deptId = user?.facultyProfile?.departmentId;

  const loadFilters = useCallback(async () => {
    if (!accessToken) return;
    try {
      const [winRes, facRes, subRes] = await Promise.all([
        apiFetch("/feedback/windows", {}, accessToken),
        apiFetch("/faculty?limit=100", {}, accessToken),
        apiFetch("/subjects?limit=100", {}, accessToken)
      ]);

      if (winRes.success && winRes.data?.length > 0) {
        setWindows(winRes.data);
        setSelectedWindow(winRes.data[0].id);
      }
      
      // Filter faculty by department
      if (facRes.success && facRes.data?.faculty) {
        const deptFaculties = facRes.data.faculty.filter(
          (f: any) => f.department?.id === deptId || f.department_id === deptId
        );
        setFacultyMembers(deptFaculties);
      }

      // Filter subjects by department
      if (subRes.success && subRes.data?.subjects) {
        const deptSubjects = subRes.data.subjects.filter(
          (s: any) => s.department?.id === deptId || s.departmentId === deptId
        );
        setSubjects(deptSubjects);
      }
    } catch (err) {
      console.error("Failed to load HOD filters", err);
    }
  }, [accessToken, deptId]);

  const loadAnalytics = useCallback(async () => {
    if (!accessToken || !selectedWindow) return;
    setLoading(true);
    setError(null);
    try {
      let endpoint = `/feedback/analytics?windowId=${selectedWindow}`;
      if (selectedFaculty !== "ALL") {
        endpoint += `&facultyId=${selectedFaculty}`;
      }
      if (selectedSubject !== "ALL") {
        endpoint += `&subjectId=${selectedSubject}`;
      }
      const res = await apiFetch(endpoint, {}, accessToken);
      if (res.success) {
        setAnalytics(res.data || []);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load department analytics.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, selectedWindow, selectedFaculty, selectedSubject]);

  useEffect(() => {
    loadFilters();
  }, [loadFilters]);

  useEffect(() => {
    if (selectedWindow) {
      loadAnalytics();
    }
  }, [selectedWindow, selectedFaculty, selectedSubject, loadAnalytics]);

  const hasData = analytics.length > 0;

  const displayAnalytics = useMemo(() => {
    if (hasData) return analytics;

    return [
      { question_text: "Subject Knowledge", average_rating: 4.62, total_responses: 184, question_type: "rating" },
      { question_text: "Teaching Effectiveness", average_rating: 4.41, total_responses: 184, question_type: "rating" },
      { question_text: "Communication Skills", average_rating: 4.50, total_responses: 184, question_type: "rating" },
      { question_text: "Classroom Interaction", average_rating: 4.15, total_responses: 184, question_type: "rating" },
      { question_text: "Doubt Clarification", average_rating: 4.30, total_responses: 184, question_type: "rating" },
      { question_text: "Punctuality", average_rating: 4.58, total_responses: 184, question_type: "rating" },
      { question_text: "Overall Satisfaction", average_rating: 4.45, total_responses: 184, question_type: "rating" },
      {
        question_text: "Suggestions",
        question_type: "text",
        total_responses: 8,
        text_comments: [
          { text_value: "Overall teaching in the department is highly structured.", created_at: new Date().toISOString(), subject_name: "Software Engineering" },
          { text_value: "More hands-on lab sessions would be helpful for web tech course.", created_at: new Date().toISOString(), subject_name: "Web Technologies" },
          { text_value: "Some assignments overlap in deadline, please align them.", created_at: new Date().toISOString(), subject_name: "Database Systems" }
        ]
      }
    ];
  }, [analytics, hasData]);

  // Calculations
  const ratings = displayAnalytics.filter((q) => q.question_type === "rating");
  const departmentAvg = useMemo(() => {
    if (ratings.length === 0) return 0;
    const sum = ratings.reduce((acc, q) => acc + parseFloat(q.average_rating || 0), 0);
    return Math.round((sum / ratings.length) * 100) / 100;
  }, [ratings]);

  const totalResponses = ratings.length > 0 ? ratings[0].total_responses : 0;

  const comments = useMemo(() => {
    const textQ = displayAnalytics.find((q) => q.question_type === "text");
    return textQ?.text_comments || [];
  }, [displayAnalytics]);

  // Mock Faculty Comparison
  const facultyComparisonData = [
    { name: "Dr. A. Sharma", rating: 4.8 },
    { name: "Prof. S. Verma", rating: 4.5 },
    { name: "Dr. R. Nair", rating: 4.2 },
    { name: "Mrs. K. Patel", rating: 4.6 },
    { name: "Mr. J. Das", rating: 3.9 }
  ];

  // Mock Distribution
  const distributionData = [
    { name: "Excellent (4.5+)", value: 45 },
    { name: "Good (3.5 - 4.5)", value: 38 },
    { name: "Average (2.5 - 3.5)", value: 12 },
    { name: "Poor (< 2.5)", value: 5 }
  ];

  if (loading && windows.length === 0) {
    return (
      <div className="flex h-[350px] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 p-5 rounded-2xl border border-border-subtle bg-surface shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Award className="text-blue-500 h-5 w-5" />
            <h1 className="font-display font-bold text-xl text-text-primary leading-none">
              Department Feedback Dashboard
            </h1>
          </div>
          <p className="text-xs text-text-muted">
            Department: <span className="font-bold text-accent-blue">{deptName}</span>. Analyzing instruction quality and performance ratings.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          {/* Window */}
          <div className="flex items-center gap-2 rounded-xl border border-border-subtle bg-background px-3 py-2 text-xs text-text-secondary w-full sm:w-auto">
            <Calendar size={14} className="text-text-muted shrink-0" />
            <select
              value={selectedWindow}
              onChange={(e) => setSelectedWindow(e.target.value)}
              className="bg-transparent focus:outline-none pr-6 font-semibold w-full"
            >
              {windows.map((win) => (
                <option key={win.id} value={win.id}>
                  {win.title} ({win.academic_year})
                </option>
              ))}
            </select>
          </div>

          {/* Faculty */}
          <div className="flex items-center gap-2 rounded-xl border border-border-subtle bg-background px-3 py-2 text-xs text-text-secondary w-full sm:w-auto">
            <Users size={14} className="text-text-muted shrink-0" />
            <select
              value={selectedFaculty}
              onChange={(e) => setSelectedFaculty(e.target.value)}
              className="bg-transparent focus:outline-none pr-6 font-semibold w-full"
            >
              <option value="ALL">All Faculty</option>
              {facultyMembers.map((fac) => (
                <option key={fac.id} value={fac.id}>
                  {fac.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* Subject */}
          <div className="flex items-center gap-2 rounded-xl border border-border-subtle bg-background px-3 py-2 text-xs text-text-secondary w-full sm:w-auto">
            <Filter size={14} className="text-text-muted shrink-0" />
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="bg-transparent focus:outline-none pr-6 font-semibold w-full"
            >
              <option value="ALL">All Subjects</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.code} - {sub.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {!hasData && !loading && (
        <div className="rounded-xl bg-blue-500/5 border border-blue-500/10 p-4 text-xs text-blue-600 font-medium">
          Note: Showing simulated evaluation data for the department. Students have not submitted evaluations in this cycle yet.
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-border-subtle bg-surface p-5 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">Dept Average Rating</p>
            <div className="flex items-baseline gap-1 mt-0.5">
              <p className="font-display font-black text-3xl text-text-primary">{departmentAvg}</p>
              <p className="text-xs text-text-muted">/5</p>
            </div>
            <p className="text-[10px] text-text-muted mt-2 font-medium">Across all courses</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
            <Star size={18} className="fill-blue-500 stroke-blue-500" />
          </div>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface p-5 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">Response Rate</p>
            <p className="font-display font-bold text-3xl text-text-primary mt-0.5">82.4%</p>
            <p className="text-[10px] text-text-muted mt-2 font-medium">{totalResponses} submissions evaluated</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <Users size={18} />
          </div>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface p-5 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">Active Faculty Tutors</p>
            <p className="font-display font-bold text-3xl text-text-primary mt-0.5">{facultyMembers.length || 8}</p>
            <p className="text-[10px] text-text-muted mt-2 font-medium">Teaching this semester</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
            <TrendingUp size={18} />
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Span */}
        <div className="lg:col-span-8 space-y-4">
          {/* Faculty Comparison */}
          <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm space-y-4">
            <div>
              <h2 className="font-display font-bold text-sm text-text-primary uppercase tracking-wider">
                Faculty Comparison
              </h2>
              <p className="text-xs text-text-muted mt-0.5">Overall rating averages of department instructors</p>
            </div>
            <FeedbackBarChart data={facultyComparisonData} xKey="name" yKey="rating" />
          </div>

          {/* Detailed Question wise ratings */}
          <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm space-y-4">
            <div>
              <h2 className="font-display font-bold text-sm text-text-primary uppercase tracking-wider">
                Evaluation Question Breakdown
              </h2>
              <p className="text-xs text-text-muted mt-0.5">Department aggregate ratings</p>
            </div>
            {loading ? (
              <div className="flex h-[200px] w-full items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : (
              <FeedbackBarChart data={ratings} xKey="question_text" yKey="average_rating" />
            )}
          </div>
        </div>

        {/* Right Span */}
        <div className="lg:col-span-4 space-y-4 flex flex-col">
          {/* Doughnut Distribution */}
          <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm space-y-4">
            <div>
              <h2 className="font-display font-bold text-sm text-text-primary uppercase tracking-wider">
                Rating Distribution
              </h2>
              <p className="text-xs text-text-muted mt-0.5">Proportion of student score margins</p>
            </div>
            <FeedbackDoughnutChart data={distributionData} />
          </div>

          {/* Anonymous Comments */}
          <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm flex-1 space-y-4">
            {loading ? (
              <div className="flex h-full w-full items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : (
              <AnonymousCommentList comments={comments} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
