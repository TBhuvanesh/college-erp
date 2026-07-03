"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { 
  GraduationCap, 
  Award, 
  BookOpen, 
  AlertCircle, 
  TrendingUp, 
  Percent, 
  CheckCircle2, 
  XCircle,
  Loader2,
  Calendar,
  Filter
} from "lucide-react";

interface StudentResultEntry {
  resultId: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  semester: number;
  internalMarks: number;
  internalMaxMarks: number;
  externalMarks: number;
  externalMaxMarks: number;
  totalMarks: number;
  grade: string;
  resultStatus: "Pass" | "Fail" | "Absent";
  publishedAt: string;
}

interface SubjectSummary {
  id: string;
  code: string;
  name: string;
  credits: number;
}

export default function StudentResults() {
  const { accessToken } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [results, setResults] = useState<StudentResultEntry[]>([]);
  const [subjects, setSubjects] = useState<SubjectSummary[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<string>("ALL");

  // Fetch results and subject credits mapping
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch subjects to resolve credits
      const subRes = await apiFetch("/subjects?limit=100", {}, accessToken);
      if (subRes.success && subRes.data?.subjects) {
        setSubjects(subRes.data.subjects);
      }

      // 2. Fetch student results
      const resVal = await apiFetch("/results/my-results", {}, accessToken);
      if (resVal.success && resVal.data?.results) {
        setResults(resVal.data.results);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load academic results.");
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

  // Create lookup for subject credits
  const subjectCreditsMap = React.useMemo(() => {
    const map: Record<string, number> = {};
    subjects.forEach((sub) => {
      map[sub.id] = sub.credits;
    });
    return map;
  }, [subjects]);

  // Filter results based on semester selection
  const filteredResults = React.useMemo(() => {
    if (selectedSemester === "ALL") {
      return results;
    }
    const semNum = parseInt(selectedSemester, 10);
    return results.filter((r) => r.semester === semNum);
  }, [results, selectedSemester]);

  // Unique list of semesters present in the results to construct filter dynamically
  const semesterOptions = React.useMemo(() => {
    const sems = new Set<number>();
    results.forEach((r) => sems.add(r.semester));
    return Array.from(sems).sort((a, b) => a - b);
  }, [results]);

  // Calculate statistics for the filtered results
  const stats = React.useMemo(() => {
    let passed = 0;
    let failed = 0;
    let absent = 0;
    let totalCredits = 0;
    let totalPercentageSum = 0;
    let validPercentageCount = 0;

    filteredResults.forEach((r) => {
      const credits = subjectCreditsMap[r.subjectId] || 4; // Default to 4 if not resolved

      if (r.resultStatus === "Pass") {
        passed += 1;
        totalCredits += credits;
      } else if (r.resultStatus === "Fail") {
        failed += 1;
      } else if (r.resultStatus === "Absent") {
        absent += 1;
        failed += 1; // Absent counts towards a non-pass/failed status in term stats
      }

      // Calculate percentage obtained in subject
      const maxMarks = r.internalMaxMarks + r.externalMaxMarks;
      if (maxMarks > 0 && r.resultStatus !== "Absent") {
        totalPercentageSum += (r.totalMarks / maxMarks) * 100;
        validPercentageCount += 1;
      }
    });

    const averagePercentage = validPercentageCount > 0 
      ? Math.round(totalPercentageSum / validPercentageCount) 
      : 0;

    const totalSubjects = passed + failed;
    const passRate = totalSubjects > 0 
      ? Math.round((passed / totalSubjects) * 100) 
      : 0;

    return {
      passed,
      failed,
      absent,
      totalCredits,
      averagePercentage,
      passRate
    };
  }, [filteredResults, subjectCreditsMap]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
        <Loader2 className="animate-spin text-blue-500 mb-3" size={30} />
        <span className="font-mono text-xs">Accessing semester report archives...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-2xl dark:text-white text-text-primary">Semester Results</h2>
          <p className="text-xs dark:text-neutral-400 text-text-secondary mt-1">
            Academic gradecard ledger. View registered course credits and final grade sheets.
          </p>
        </div>

        {/* Semester Filter */}
        <div className="w-full sm:w-60 flex items-center gap-2 dark:bg-neutral-900 bg-surface border dark:border-neutral-800 border-border-subtle rounded px-2.5 text-xs dark:text-white text-text-primary">
          <Filter size={12} className="dark:text-neutral-500 text-text-muted shrink-0" />
          <span className="dark:text-neutral-500 text-text-muted">Term:</span>
          <select
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(e.target.value)}
            className="bg-transparent dark:text-white text-text-primary cursor-pointer py-2 flex-1 focus:outline-none font-bold"
          >
            <option value="ALL">All Semesters</option>
            {semesterOptions.map((sem) => (
              <option key={sem} value={sem.toString()}>
                Semester {sem}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold rounded-lg flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Subjects Passed */}
        <div className="glass-card rounded-xl p-5 border border-border-subtle flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-text-muted">Subjects Passed</span>
            <h3 className="text-2xl font-display font-bold dark:text-emerald-400 text-emerald-700 mt-1">{stats.passed} Courses</h3>
            <span className="text-[9px] text-text-muted block mt-0.5">Cleared examinations count</span>
          </div>
          <div className="w-10 h-10 rounded-lg dark:bg-emerald-500/10 bg-emerald-50 dark:text-emerald-400 text-emerald-700 border dark:border-emerald-500/20 border-emerald-200 flex items-center justify-center">
            <CheckCircle2 size={18} />
          </div>
        </div>

        {/* Subjects Failed */}
        <div className="glass-card rounded-xl p-5 border border-border-subtle flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-text-muted">Subjects Backlog</span>
            <h3 className={`text-2xl font-display font-bold mt-1 ${stats.failed > 0 ? "dark:text-rose-500 text-rose-750" : "dark:text-neutral-400 text-text-secondary"}`}>
              {stats.failed} {stats.failed === 1 ? "Course" : "Courses"}
            </h3>
            <span className="text-[9px] text-text-muted block mt-0.5">Re-examinations required</span>
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${
            stats.failed > 0 
              ? "dark:bg-rose-500/10 bg-rose-50 dark:text-rose-455 text-rose-700 dark:border-rose-500/20 border-rose-200" 
              : "dark:bg-neutral-800 bg-surface-elevated dark:text-neutral-500 text-text-muted border dark:border-neutral-700 border-border-subtle"
          }`}>
            <XCircle size={18} />
          </div>
        </div>

        {/* Credits Earned */}
        <div className="glass-card rounded-xl p-5 border border-border-subtle flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-text-muted">Total Credits Earned</span>
            <h3 className="text-2xl font-display font-bold dark:text-blue-400 text-blue-700 mt-1">{stats.totalCredits} Units</h3>
            <span className="text-[9px] text-text-muted block mt-0.5">Academic weight units secured</span>
          </div>
          <div className="w-10 h-10 rounded-lg dark:bg-blue-500/10 bg-blue-50 dark:text-blue-400 text-blue-700 border dark:border-blue-500/20 border-blue-200 flex items-center justify-center">
            <GraduationCap size={18} />
          </div>
        </div>

        {/* Avg Performance */}
        <div className="glass-card rounded-xl p-5 border border-border-subtle flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-text-muted">Avg Percent / Pass Rate</span>
            <h3 className="text-2xl font-display font-bold dark:text-white text-text-primary mt-1">
              {stats.averagePercentage}% / {stats.passRate}%
            </h3>
            <span className="text-[9px] text-text-muted block mt-0.5">Aggregate evaluation scoring</span>
          </div>
          <div className="w-10 h-10 rounded-lg dark:bg-amber-500/10 bg-amber-50 dark:text-amber-400 text-amber-700 border dark:border-amber-500/20 border-amber-200 flex items-center justify-center">
            <Percent size={18} />
          </div>
        </div>
      </div>

      {/* Grade Details Table Ledger */}
      <div className="glass-card border dark:border-neutral-800 border-border-subtle rounded-xl p-5">
        <h3 className="font-display font-bold dark:text-white text-text-primary text-sm flex items-center gap-2 mb-4">
          <Award size={14} className="text-blue-400" />
          <span>{"Semester Examination Gradecard & Marks Record"}</span>
        </h3>

        {filteredResults.length > 0 ? (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="dark:bg-neutral-955 bg-surface-elevated border-b dark:border-neutral-900 border-border-subtle dark:text-neutral-400 text-text-secondary font-semibold">
                    <th className="px-4 py-3 font-mono">Code</th>
                    <th className="px-4 py-3">Subject Name</th>
                    <th className="px-4 py-3 text-center">Semester</th>
                    <th className="px-4 py-3 text-center">Internal Marks</th>
                    <th className="px-4 py-3 text-center">External Marks</th>
                    <th className="px-4 py-3 text-center">Total Marks</th>
                    <th className="px-4 py-3 text-center">Grade</th>
                    <th className="px-4 py-3 text-center">Credits</th>
                    <th className="px-4 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-neutral-900 divide-border-subtle dark:text-neutral-300 text-text-secondary">
                  {filteredResults.map((r) => {
                    const credits = subjectCreditsMap[r.subjectId] || 4;
                    const isPass = r.resultStatus === "Pass";
                    const isAbsent = r.resultStatus === "Absent";

                    return (
                      <tr key={r.resultId} className="dark:hover:bg-neutral-900/10 hover:bg-surface-hover transition-colors">
                        <td className="px-4 py-3.5 font-mono text-[11px] dark:text-neutral-400 text-text-secondary">{r.subjectCode}</td>
                        <td className="px-4 py-3.5 font-semibold dark:text-white text-text-primary">{r.subjectName}</td>
                        <td className="px-4 py-3.5 text-center font-mono dark:text-neutral-400 text-text-secondary">{r.semester}</td>
                        <td className="px-4 py-3.5 text-center font-mono">
                          {r.internalMarks} <span className="text-[10px] dark:text-neutral-600 text-text-muted">/ {r.internalMaxMarks}</span>
                        </td>
                        <td className="px-4 py-3.5 text-center font-mono">
                          {isAbsent ? (
                            <span className="text-amber-500 italic">Ab</span>
                          ) : (
                            <>
                              {r.externalMarks} <span className="text-[10px] dark:text-neutral-600 text-text-muted">/ {r.externalMaxMarks}</span>
                            </>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-center font-mono font-bold dark:text-white text-text-primary">
                          {isAbsent ? "—" : `${r.totalMarks} / ${r.internalMaxMarks + r.externalMaxMarks}`}
                        </td>
                        <td className="px-4 py-3.5 text-center font-mono">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border font-mono ${
                            isPass 
                              ? "dark:bg-blue-500/15 bg-blue-50 dark:text-blue-400 text-blue-700 dark:border-blue-500/20 border-blue-200" 
                              : isAbsent
                              ? "dark:bg-amber-500/15 bg-amber-50 dark:text-amber-400 text-amber-700 dark:border-amber-500/20 border-amber-200"
                              : "dark:bg-rose-500/15 bg-rose-50 dark:text-rose-455 text-rose-700 dark:border-rose-500/20 border-rose-200"
                          }`}>
                            {r.grade}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center font-mono font-semibold dark:text-neutral-400 text-text-secondary">{credits} U</td>
                        <td className="px-4 py-3.5 text-right">
                          <span className={`px-2.5 py-0.5 rounded text-[9px] font-bold border ${
                            isPass
                              ? "dark:bg-emerald-500/10 bg-emerald-50 dark:text-emerald-400 text-emerald-700 dark:border-emerald-500/20 border-emerald-200"
                              : isAbsent
                              ? "dark:bg-amber-500/10 bg-amber-50 dark:text-amber-400 text-amber-700 dark:border-amber-500/20 border-amber-200"
                              : "dark:bg-rose-500/10 bg-rose-50 dark:text-rose-400 text-rose-700 dark:border-rose-500/20 border-rose-200"
                          }`}>
                            {r.resultStatus}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View */}
            <div className="block md:hidden space-y-3">
              {filteredResults.map((r) => {
                const credits = subjectCreditsMap[r.subjectId] || 4;
                const isPass = r.resultStatus === "Pass";
                const isAbsent = r.resultStatus === "Absent";
                return (
                  <div key={r.resultId} className="p-4 dark:bg-neutral-950/40 bg-surface border dark:border-neutral-900 border-border-subtle rounded-xl space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-xs font-bold dark:text-white text-text-primary leading-tight">{r.subjectName}</h4>
                        <span className="text-[9px] dark:text-neutral-500 text-text-muted mt-0.5 font-mono block">
                          Code: {r.subjectCode} • Semester {r.semester} • Credits: {credits} U
                        </span>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded text-[9px] font-bold border ${
                        isPass
                          ? "dark:bg-emerald-500/10 bg-emerald-50 dark:text-emerald-400 text-emerald-700 dark:border-emerald-500/20 border-emerald-200"
                          : isAbsent
                          ? "dark:bg-amber-500/10 bg-amber-50 dark:text-amber-400 text-amber-700 dark:border-amber-500/20 border-amber-200"
                          : "dark:bg-rose-500/10 bg-rose-50 dark:text-rose-455 text-rose-700 dark:border-rose-500/20 border-rose-200"
                      }`}>
                        {r.resultStatus}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 dark:bg-neutral-900/30 bg-surface rounded border dark:border-neutral-900/60 border-border-subtle/60 p-2.5 text-center">
                      <div>
                        <span className="text-[8px] dark:text-neutral-500 text-text-muted uppercase font-bold block">Internal</span>
                        <span className="text-xs font-mono font-semibold dark:text-white text-text-primary">{r.internalMarks}</span>
                        <span className="text-[8px] dark:text-neutral-600 text-text-muted block">/ {r.internalMaxMarks}</span>
                      </div>
                      <div>
                        <span className="text-[8px] dark:text-neutral-500 text-text-muted uppercase font-bold block">External</span>
                        <span className="text-xs font-mono font-semibold dark:text-white text-text-primary">
                          {isAbsent ? <span className="text-amber-500 font-normal">Ab</span> : r.externalMarks}
                        </span>
                        <span className="text-[8px] dark:text-neutral-600 text-text-muted block">/ {r.externalMaxMarks}</span>
                      </div>
                      <div>
                        <span className="text-[8px] dark:text-neutral-500 text-text-muted uppercase font-bold block">Grade Obtained</span>
                        <span className={`inline-block text-xs font-mono font-bold dark:text-blue-400 text-blue-700 px-1.5 py-0.5 rounded dark:bg-blue-500/10 bg-blue-50 dark:border-blue-500/20 border-blue-200 mt-0.5`}>
                          {r.grade}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="p-10 text-center text-neutral-500 font-mono text-xs">
            No published examination results found.
          </div>
        )}
      </div>
    </div>
  );
}
