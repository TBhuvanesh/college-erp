"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { GraduationCap, BookOpen, AlertCircle, FileText, Sparkles, Loader2 } from "lucide-react";

type AssessmentType = "Mid-1" | "Mid-2" | "Assignment" | "Lab" | "Internal";

interface AssignmentDetail {
  id: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  semester: number;
  section: string;
  isActive: boolean;
}

interface RosterEntry {
  studentId: string;
  fullName: string;
  rollNumber: string;
  obtainedMarks: number | null;
}

export default function FacultyGrades() {
  const { accessToken } = useAuth();

  const [assignments, setAssignments] = useState<AssignmentDetail[]>([]);
  const [selectedSubjId, setSelectedSubjId] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [examType, setExamType] = useState<AssessmentType>("Mid-1");
  const [maxMarks, setMaxMarks] = useState(100);
  const [roster, setRoster] = useState<{ studentId: string; name: string; rollNo: string; marks: string }[]>([]);
  const [toastMsg, setToastMsg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  };

  useEffect(() => {
    const fetchAssignments = async () => {
      if (!accessToken) return;
      setLoadingAssignments(true);
      setError(null);
      try {
        const res = await apiFetch("/attendance/my-assignments", {}, accessToken);
        const activeAssignments: AssignmentDetail[] = res.success && res.data?.assignments
          ? res.data.assignments.filter((a: AssignmentDetail) => a.isActive)
          : [];
        setAssignments(activeAssignments);
        if (activeAssignments.length > 0) {
          setSelectedSubjId(activeAssignments[0].subjectId);
          setSelectedSection(activeAssignments[0].section);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load workload assignments.");
      } finally {
        setLoadingAssignments(false);
      }
    };

    const timer = setTimeout(fetchAssignments, 0);
    return () => clearTimeout(timer);
  }, [accessToken]);

  const subjects = useMemo(() => {
    const map = new Map<string, { subjectId: string; subjectName: string; subjectCode: string }>();
    assignments.forEach((assignment) => {
      map.set(assignment.subjectId, {
        subjectId: assignment.subjectId,
        subjectName: assignment.subjectName,
        subjectCode: assignment.subjectCode,
      });
    });
    return Array.from(map.values());
  }, [assignments]);

  const sectionsForSelectedSubject = useMemo(
    () => assignments.filter((a) => a.subjectId === selectedSubjId).map((a) => a.section),
    [assignments, selectedSubjId]
  );

  const activeSubject = subjects.find(s => s.subjectId === selectedSubjId);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (selectedSubjId && sectionsForSelectedSubject.length > 0 && !sectionsForSelectedSubject.includes(selectedSection)) {
        setSelectedSection(sectionsForSelectedSubject[0]);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [selectedSubjId, selectedSection, sectionsForSelectedSubject]);

  const fetchRoster = useCallback(async () => {
    if (!accessToken || !selectedSubjId || !selectedSection) return;
    setLoadingRoster(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        subjectId: selectedSubjId,
        section: selectedSection,
        assessmentType: examType,
      });
      const res = await apiFetch(`/internal-marks/roster?${params.toString()}`, {}, accessToken);
      const rosterData: RosterEntry[] = res.success && res.data?.roster ? res.data.roster : [];
      const firstWithMax = (res.data?.roster || []).find((r: any) => r.maximumMarks !== null);
      if (firstWithMax) setMaxMarks(Number(firstWithMax.maximumMarks));
      setRoster(
        rosterData.map((student) => ({
          studentId: student.studentId,
          name: student.fullName,
          rollNo: student.rollNumber,
          marks: student.obtainedMarks !== null ? student.obtainedMarks.toString() : "",
        }))
      );
    } catch (err: any) {
      setError(err.message || "Failed to load internal marks roster.");
      setRoster([]);
    } finally {
      setLoadingRoster(false);
    }
  }, [accessToken, selectedSubjId, selectedSection, examType]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRoster();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchRoster]);

  const handleMarksChange = (studId: string, val: string) => {
    setRoster(prev =>
      prev.map(item => (item.studentId === studId ? { ...item, marks: val } : item))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSubject || !selectedSection || !accessToken) return;

    const invalid = roster.some(item => {
      const parsed = parseFloat(item.marks);
      return isNaN(parsed) || parsed < 0 || parsed > maxMarks;
    });

    if (invalid) {
      alert(`Please ensure all fields are filled with scores between 0 and ${maxMarks}.`);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch("/internal-marks/sessions", {
        method: "POST",
        body: JSON.stringify({
          subjectId: activeSubject.subjectId,
          section: selectedSection,
          assessmentType: examType,
          maximumMarks: maxMarks,
          records: roster.map(item => ({
            studentId: item.studentId,
            obtainedMarks: parseFloat(item.marks),
          })),
        }),
      }, accessToken);

      if (res.success) {
        triggerToast(`Internal marks published for ${activeSubject.subjectName} (${examType})!`);
        fetchRoster();
      }
    } catch (err: any) {
      setError(err.message || "Failed to save internal marks.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingAssignments) {
    return (
      <div className="flex flex-col items-center justify-center py-20 dark:text-neutral-400 text-text-secondary">
        <Loader2 className="animate-spin text-blue-500 mb-3" size={30} />
        <span className="font-mono text-xs">Loading faculty workload mappings...</span>
      </div>
    );
  }

  return (
    <div className="relative">
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-emerald-600 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-xl shadow-emerald-600/20 border border-emerald-400/20 animate-fade-in">
          <Sparkles size={14} className="animate-pulse" />
          <span>{toastMsg}</span>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="font-display font-bold text-2xl dark:text-white text-text-primary">Internal Marks Register</h2>
          <p className="text-xs dark:text-neutral-400 text-text-secondary mt-1">Upload raw evaluation marks for student midterms and finals. Released marks convert to letter grades instantly.</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold rounded-lg mb-6 flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="glass-card border border-border-subtle rounded-xl p-4 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex items-center gap-2 dark:bg-neutral-955 bg-surface border dark:border-neutral-850 border-border-subtle rounded px-2 text-xs dark:text-white text-text-primary">
          <BookOpen size={12} className="text-blue-400" />
          <span className="dark:text-neutral-500 text-text-muted">Subject:</span>
          <select
            value={selectedSubjId}
            onChange={e => setSelectedSubjId(e.target.value)}
            className="bg-transparent dark:text-white text-text-primary cursor-pointer py-2.5 flex-1 focus:outline-none font-bold"
          >
            {subjects.map(sub => (
              <option key={sub.subjectId} value={sub.subjectId} className="dark:bg-neutral-950 bg-surface dark:text-white text-text-primary">
                {sub.subjectCode}: {sub.subjectName}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 dark:bg-neutral-955 bg-surface border dark:border-neutral-855 border-border-subtle rounded px-2 text-xs dark:text-white text-text-primary">
          <FileText size={12} className="text-blue-400" />
          <span className="dark:text-neutral-505 text-text-muted">Evaluation:</span>
          <select
            value={examType}
            onChange={e => setExamType(e.target.value as AssessmentType)}
            className="bg-transparent dark:text-white text-text-primary cursor-pointer py-2.5 flex-1 focus:outline-none font-bold"
          >
            <option value="Mid-1">Midterm Examination 1</option>
            <option value="Mid-2">Midterm Examination 2</option>
            <option value="Assignment">Assignment</option>
            <option value="Lab">Lab</option>
            <option value="Internal">Internal</option>
          </select>
        </div>

        <div className="flex items-center gap-2 dark:bg-neutral-955 bg-surface border dark:border-neutral-855 border-border-subtle rounded px-2.5 text-xs dark:text-white text-text-primary">
          <GraduationCap size={12} className="text-blue-400" />
          <span className="dark:text-neutral-505 text-text-muted">Max Score:</span>
          <input
            type="number"
            value={maxMarks}
            onChange={e => setMaxMarks(parseInt(e.target.value) || 100)}
            className="bg-transparent dark:text-white text-text-primary font-bold w-16 focus:outline-none text-center"
          />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="glass-card border border-border-subtle rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="dark:bg-neutral-900/50 bg-neutral-100/50 border-b border-border-subtle dark:text-neutral-400 text-text-secondary font-semibold">
                <th className="px-4 py-3">Student Name</th>
                <th className="px-4 py-3 font-mono">Roll Number</th>
                <th className="px-4 py-3">Maximum Marks</th>
                <th className="px-4 py-3">Obtained Marks</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-neutral-900 divide-border-subtle dark:text-neutral-300 text-text-secondary">
              {loadingRoster ? (
                <tr>
                  <td colSpan={4} className="text-center py-10 dark:text-neutral-500 text-text-muted font-mono text-xs">
                    Loading internal marks roster...
                  </td>
                </tr>
              ) : roster.length > 0 ? (
                roster.map(student => {
                  const val = parseFloat(student.marks);
                  const isErr = student.marks !== "" && (isNaN(val) || val < 0 || val > maxMarks);
                  return (
                    <tr key={student.studentId} className="dark:hover:bg-neutral-900/30 hover:bg-neutral-100/50 transition">
                      <td className="px-4 py-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full dark:bg-neutral-800 bg-neutral-100 border dark:border-neutral-700 border-border-subtle flex items-center justify-center font-bold text-blue-400">
                          {student.name.charAt(0)}
                        </div>
                        <span className="font-semibold dark:text-white text-text-primary">{student.name}</span>
                      </td>
                      <td className="px-4 py-3 font-mono">{student.rollNo}</td>
                      <td className="px-4 py-3 dark:text-neutral-500 text-text-muted">{maxMarks}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            placeholder="Score"
                            value={student.marks}
                            onChange={e => handleMarksChange(student.studentId, e.target.value)}
                            className={`w-24 px-2 py-1 dark:bg-neutral-950 bg-background border dark:text-white text-text-primary rounded text-xs font-semibold focus:outline-none ${
                              isErr ? "border-rose-500 ring-1 ring-rose-500/25" : "dark:border-neutral-850 border-border-subtle"
                            }`}
                          />
                          {isErr && (
                            <span className="text-[10px] text-rose-500 flex items-center gap-0.5">
                              <AlertCircle size={10} />
                              <span>Over max!</span>
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4} className="text-center py-10 dark:text-neutral-500 text-text-muted font-mono text-xs">
                    No students registered in this workload section.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {roster.length > 0 && (
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs shadow-lg shadow-blue-600/25 cursor-pointer transition"
            >
              {submitting ? "Saving..." : "Publish Internal Marks"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
