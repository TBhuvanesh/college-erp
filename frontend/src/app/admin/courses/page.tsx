"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import type { SubjectSummary } from "@/types/subject";
import type { SubjectAllocation } from "@/types/subjectAllocation";
import { 
  BookOpen, 
  FolderOpen, 
  Calendar, 
  HelpCircle, 
  AlertCircle, 
  Users, 
  ChevronRight, 
  User, 
  CheckCircle2, 
  Layers, 
  BookOpenCheck,
  RefreshCw
} from "lucide-react";

interface ProgramRef {
  id: string;
  name: string;
  code: string;
  departmentId: string;
}

export default function AdminCourses() {
  const { accessToken } = useAuth();

  // ── Reference States ────────────────────────────────────────────────────────
  const [programs, setPrograms] = useState<ProgramRef[]>([]);
  const [subjects, setSubjects] = useState<SubjectSummary[]>([]);
  const [allocations, setAllocations] = useState<SubjectAllocation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── Filter States ──────────────────────────────────────────────────────────
  const [selectedProgramId, setSelectedProgramId] = useState<string>("");
  const [selectedRegulation, setSelectedRegulation] = useState<string>("R22");

  // ── Load data dynamically ───────────────────────────────────────────────────
  const fetchCurriculumData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const [progRes, subRes, allocRes] = await Promise.all([
        apiFetch("/departments/programs/list", {}, accessToken),
        apiFetch("/subjects?limit=1000", {}, accessToken),
        apiFetch("/subject-allocations?limit=1000", {}, accessToken)
      ]);

      if (progRes.success && progRes.data?.programs) {
        const progList = progRes.data.programs;
        setPrograms(progList);
        // Default select first program if none selected
        if (progList.length > 0 && !selectedProgramId) {
          setSelectedProgramId(progList[0].id);
        }
      }
      if (subRes.success && subRes.data?.subjects) {
        setSubjects(subRes.data.subjects);
      }
      if (allocRes.success && allocRes.data?.allocations) {
        setAllocations(allocRes.data.allocations);
      }
    } catch (err) {
      console.error("Error loading curriculum configurator metrics", err);
      setErrorMessage("Failed to load curriculum scheme metrics from database.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, selectedProgramId]);

  useEffect(() => {
    fetchCurriculumData();
  }, [fetchCurriculumData]);

  // Extract unique regulations from subjects master
  const uniqueRegulations = Array.from(new Set(subjects.map(s => s.regulation).filter(Boolean)));
  if (uniqueRegulations.length === 0 && selectedRegulation === "R22") {
    uniqueRegulations.push("R22");
  }

  // Filter subjects based on program and regulation
  const selectedProgObj = programs.find(p => p.id === selectedProgramId);
  const filteredSubjects = subjects.filter(s => {
    // 1. Program matching
    let matchesProgram = false;
    if (selectedProgramId) {
      matchesProgram = s.programId === selectedProgramId;
      if (!matchesProgram && selectedProgObj && s.programName) {
        matchesProgram = 
          selectedProgObj.name.toLowerCase().includes(s.programName.toLowerCase()) ||
          selectedProgObj.code.toLowerCase().includes(s.programName.toLowerCase()) ||
          s.programName.toLowerCase().includes(selectedProgObj.name.toLowerCase()) ||
          s.programName.toLowerCase().includes(selectedProgObj.code.toLowerCase());
      }
    } else {
      matchesProgram = true; // Show all if no program constraint
    }

    // 2. Regulation matching
    const matchesReg = !selectedRegulation || s.regulation === selectedRegulation;

    return matchesProgram && matchesReg;
  });

  const getSubjectsByYear = (semesters: number[]) => {
    return filteredSubjects.filter(s => s.semester !== undefined && semesters.includes(s.semester));
  };

  const yearsConfig = [
    { name: "Year I", semesters: [1, 2], semesterLabels: ["Semester 1", "Semester 2"] },
    { name: "Year II", semesters: [3, 4], semesterLabels: ["Semester 3", "Semester 4"] },
    { name: "Year III", semesters: [5, 6], semesterLabels: ["Semester 5", "Semester 6"] },
    { name: "Year IV", semesters: [7, 8], semesterLabels: ["Semester 7", "Semester 8"] }
  ];

  // Helper to find allocated faculty for a subject
  const getSubjectAllocation = (subjectId: string) => {
    return allocations.find(
      a => a.subjectId === subjectId && a.status === "active"
    );
  };

  const getSubjectTypeStyles = (type: string) => {
    switch (type?.toLowerCase()) {
      case "core":
        return "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
      case "lab":
      case "laboratory":
        return "bg-sky-500/10 text-sky-400 border-sky-500/20";
      case "elective":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "mandatory":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      default:
        return "bg-neutral-500/10 text-text-secondary border-neutral-500/20";
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-[9px] uppercase font-bold text-indigo-500 tracking-wider font-mono">
            Academic Configurations
          </span>
          <h2 className="font-display font-bold text-xl dark:text-white text-text-primary flex items-center gap-2">
            <Layers size={20} className="dark:text-neutral-400 text-text-muted" />
            <span>Curriculum Schemes Manager</span>
          </h2>
          <p className="text-[10px] dark:text-neutral-400 text-text-secondary">
            Sync course catalogs, dynamic semester credit schemas, regulations, and active teaching faculty assignments.
          </p>
        </div>

        <button
          onClick={fetchCurriculumData}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border dark:border-neutral-800 border-border-subtle dark:bg-neutral-900 bg-white dark:text-neutral-300 text-text-primary hover:border-indigo-500/30 transition-all font-semibold text-xs self-start sm:self-center"
        >
          <RefreshCw size={13} />
          <span>Sync Data</span>
        </button>
      </div>

      {errorMessage && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/35 text-rose-400 text-xs rounded-xl flex items-center gap-3">
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Control Filter Bar */}
      <div className="glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Program Tabs Selection */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
          {programs.map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedProgramId(p.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                selectedProgramId === p.id
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/10"
                  : "border dark:border-neutral-800 border-border-subtle hover:bg-neutral-800/10 dark:hover:bg-neutral-800/40 dark:text-neutral-300 text-text-secondary"
              }`}
            >
              {p.code} - {p.name.replace("B.Tech ", "")}
            </button>
          ))}
        </div>

        {/* Regulation Select */}
        <div className="flex items-center gap-2 self-end md:self-auto">
          <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Regulation</span>
          <select
            value={selectedRegulation}
            onChange={(e) => setSelectedRegulation(e.target.value)}
            className="px-3 py-1.5 rounded-lg border dark:border-neutral-800 border-border-subtle bg-surface text-xs font-semibold focus:outline-none focus:border-indigo-500"
          >
            {uniqueRegulations.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

      </div>

      {/* Core Dynamic Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Main Curriculum Grid */}
        <div className="lg:col-span-3 space-y-6">
          {loading ? (
            <div className="p-24 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
              <span className="text-xs text-text-secondary">Generating live curriculum schema view...</span>
            </div>
          ) : filteredSubjects.length === 0 ? (
            <div className="p-20 text-center glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl max-w-md mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-neutral-500/10 border border-neutral-500/25 flex items-center justify-center text-text-muted mx-auto mb-4">
                <BookOpen size={20} />
              </div>
              <h4 className="font-display font-bold text-sm dark:text-white text-text-primary">No Curriculum Mapped</h4>
              <p className="text-[11px] text-text-secondary mt-1.5 leading-relaxed">
                We couldn't locate any dynamic subjects mapped under program <strong>{selectedProgObj?.code}</strong> for regulation <strong>{selectedRegulation}</strong>. Use the Subjects catalog to import or add entries.
              </p>
            </div>
          ) : (
            yearsConfig.map(year => {
              const yearSubjects = getSubjectsByYear(year.semesters);
              if (yearSubjects.length === 0) return null;

              return (
                <div key={year.name} className="glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl p-5 space-y-6">
                  
                  {/* Year Header */}
                  <div className="flex items-center gap-3 border-b dark:border-neutral-800 border-border-subtle pb-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400">
                      <FolderOpen size={15} />
                    </div>
                    <div>
                      <h3 className="font-display font-bold dark:text-white text-text-primary text-sm leading-tight">
                        {year.name} Curriculum Structure
                      </h3>
                      <span className="text-[9px] dark:text-neutral-500 text-text-muted font-semibold uppercase tracking-wider block mt-0.5">
                        {selectedProgObj?.name} • Reg {selectedRegulation}
                      </span>
                    </div>
                  </div>

                  {/* Semesters under this Year */}
                  <div className="space-y-6">
                    {year.semesters.map((semNum, idx) => {
                      const semSubjects = yearSubjects.filter(s => s.semester === semNum);
                      if (semSubjects.length === 0) return null;

                      return (
                        <div key={semNum} className="border-l-2 border-indigo-500/30 pl-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <Calendar size={12} className="text-indigo-400" />
                            <h4 className="text-xs font-bold dark:text-white text-text-primary uppercase tracking-wider">
                              {year.semesterLabels[idx]}
                            </h4>
                            <span className="text-[9px] text-text-muted font-mono bg-neutral-500/10 px-2 py-0.5 rounded">
                              {semSubjects.length} subjects
                            </span>
                          </div>

                          {/* Grid of dynamic subject cards */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {semSubjects.map(sub => {
                              const alloc = getSubjectAllocation(sub.id);

                              return (
                                <Link
                                  key={sub.id}
                                  href={`/admin/subjects/${sub.id}`}
                                  className="p-4 dark:bg-neutral-950/40 bg-background border dark:border-neutral-900 border-border-subtle rounded-xl flex flex-col justify-between hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-600/5 transition-all duration-200 block space-y-4"
                                >
                                  {/* Subject Code / Name */}
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="space-y-1">
                                      <span className="text-[10px] text-text-muted font-mono font-bold block">
                                        {sub.code}
                                      </span>
                                      <h5 className="font-semibold dark:text-white text-text-primary text-xs leading-tight">
                                        {sub.name}
                                      </h5>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${getSubjectTypeStyles(sub.type)}`}>
                                      {sub.type}
                                    </span>
                                  </div>

                                  {/* L-T-P parameters & Credits */}
                                  <div className="flex items-center justify-between border-t dark:border-neutral-900 border-neutral-100 pt-3 text-[10px]">
                                    <span className="text-text-muted font-mono">
                                      L-T-P: {sub.lectureHours}-{sub.tutorialHours}-{sub.practicalHours}
                                    </span>
                                    <span className="font-bold dark:text-indigo-400 text-indigo-600 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md font-mono">
                                      {sub.credits} credits
                                    </span>
                                  </div>

                                  {/* Assigned Faculty details (Synced with Allocation Module) */}
                                  <div className="border-t dark:border-neutral-900 border-neutral-100 pt-3 flex items-center justify-between gap-2">
                                    {alloc ? (
                                      <div className="flex items-center gap-1.5 text-emerald-400">
                                        <CheckCircle2 size={12} className="flex-shrink-0" />
                                        <span className="text-[9px] font-semibold truncate max-w-[150px]">
                                          {alloc.facultyName}
                                        </span>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1.5 text-amber-500">
                                        <AlertCircle size={12} className="flex-shrink-0" />
                                        <span className="text-[9px] font-semibold truncate max-w-[150px]">
                                          Unassigned Faculty
                                        </span>
                                      </div>
                                    )}
                                    
                                    <div className="flex items-center gap-1 text-[9px] text-text-muted hover:text-indigo-400 transition-colors font-bold">
                                      <span>Configure</span>
                                      <ChevronRight size={10} />
                                    </div>
                                  </div>

                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                </div>
              );
            })
          )}
        </div>

        {/* Informational Guidelines Panel */}
        <div className="space-y-4">
          <div className="glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl p-5">
            <h4 className="font-display font-bold dark:text-white text-text-primary text-sm flex items-center gap-2 mb-3">
              <BookOpenCheck size={16} className="text-indigo-400" />
              <span>Curriculum Guidelines</span>
            </h4>
            <div className="space-y-3 text-xs dark:text-neutral-400 text-text-secondary leading-normal">
              <p>
                All student academic profiles dynamically inherit these curriculum templates based on active scheme selections.
              </p>
              <ul className="list-disc pl-4 space-y-1.5 text-[10px] dark:text-neutral-500 text-text-muted">
                <li>Subjects are mapped to standard course codes.</li>
                <li>Allocations sync automatically with the Faculty Workload registry.</li>
                <li>Modifying subject parameters updates grading thresholds across active student exam cards.</li>
              </ul>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
