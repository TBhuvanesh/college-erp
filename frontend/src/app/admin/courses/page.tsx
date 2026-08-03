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
  ChevronDown,
  User, 
  CheckCircle2, 
  Layers, 
  BookOpenCheck,
  RefreshCw,
  Search,
  Building2,
  Tag,
  BookMarked,
  Award,
  ArrowUpRight,
  Info,
  ArrowRight,
  UserCheck,
  X
} from "lucide-react";

interface ProgramRef {
  id: string;
  name: string;
  code: string;
  departmentId: string;
}

interface DepartmentRef {
  id: string;
  name: string;
  code: string;
}

export default function AdminCourses() {
  const { accessToken } = useAuth();

  // ── Reference States ────────────────────────────────────────────────────────
  const [departments, setDepartments] = useState<DepartmentRef[]>([]);
  const [programs, setPrograms] = useState<ProgramRef[]>([]);
  const [subjects, setSubjects] = useState<SubjectSummary[]>([]);
  const [allocations, setAllocations] = useState<SubjectAllocation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── Filter States ──────────────────────────────────────────────────────────
  const [selectedDeptId, setSelectedDeptId] = useState<string>("");
  const [selectedProgramId, setSelectedProgramId] = useState<string>("");
  const [selectedRegulation, setSelectedRegulation] = useState<string>("R22");
  const [selectedYear, setSelectedYear] = useState<string>("All Years");
  const [selectedSemester, setSelectedSemester] = useState<string>("All Semesters");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // ── Expand/Collapse States ──────────────────────────────────────────────────
  const [expandedYears, setExpandedYears] = useState<Record<string, boolean>>({
    "I": true,
    "II": true,
    "III": true,
    "IV": true
  });
  const [expandedSemesters, setExpandedSemesters] = useState<Record<number, boolean>>({
    1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true
  });

  // ── Details Modal State ─────────────────────────────────────────────────────
  const [viewingSubject, setViewingSubject] = useState<SubjectSummary | null>(null);

  // ── Initial Reference Data Loading ─────────────────────────────────────────
  useEffect(() => {
    const loadRefs = async () => {
      if (!accessToken) return;
      try {
        const [deptRes, progRes] = await Promise.all([
          apiFetch("/departments", {}, accessToken),
          apiFetch("/departments/programs/list", {}, accessToken)
        ]);
        if (deptRes.success && deptRes.data?.departments) {
          const deptList = deptRes.data.departments || [];
          setDepartments(deptList);
          if (deptList.length > 0) {
            setSelectedDeptId(deptList[0].id);
          }
        }
        if (progRes.success && progRes.data?.programs) {
          setPrograms(progRes.data.programs);
        }
      } catch (err) {
        console.error("Failed to load department reference records", err);
      }
    };
    loadRefs();
  }, [accessToken]);

  // ── Load subjects dynamically based on active filters ──────────────────────
  const fetchCurriculumData = useCallback(async () => {
    if (!accessToken || !selectedDeptId) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const [subRes, allocRes] = await Promise.all([
        apiFetch(`/subjects?limit=10000&departmentId=${selectedDeptId}&regulation=${selectedRegulation}`, {}, accessToken),
        apiFetch("/subject-allocations?limit=10000", {}, accessToken)
      ]);

      if (subRes.success && subRes.data?.subjects) {
        setSubjects(subRes.data.subjects);
      }
      if (allocRes.success && allocRes.data?.allocations) {
        setAllocations(allocRes.data.allocations);
      }
    } catch (err) {
      console.error("Error loading subjects data", err);
      setErrorMessage("Failed to load subjects or allocations from database.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, selectedDeptId, selectedRegulation]);

  useEffect(() => {
    if (selectedDeptId && selectedRegulation) {
      fetchCurriculumData();
    }
  }, [selectedDeptId, selectedRegulation, fetchCurriculumData]);

  // Extract unique regulations from subjects master
  const uniqueRegulations = Array.from(new Set(subjects.map(s => s.regulation).filter(Boolean)));
  if (uniqueRegulations.length === 0 && selectedRegulation === "R22") {
    uniqueRegulations.push("R22");
  }

  // Filter programs based on selected department
  const filteredPrograms = programs.filter(p => !selectedDeptId || p.departmentId === selectedDeptId);

  // Synchronize program selection when department changes
  useEffect(() => {
    if (selectedDeptId) {
      const deptsPrograms = programs.filter(p => p.departmentId === selectedDeptId);
      if (deptsPrograms.length > 0) {
        if (!deptsPrograms.some(p => p.id === selectedProgramId)) {
          setSelectedProgramId(deptsPrograms[0].id);
        }
      } else {
        setSelectedProgramId("");
      }
    }
  }, [selectedDeptId, programs, selectedProgramId]);

  // Filter subjects dynamically
  const filteredSubjects = subjects.filter(s => {
    if (selectedProgramId && s.programId && s.programId !== selectedProgramId) return false;
    
    const logicalYear = s.semester ? (
      s.semester <= 2 ? "I" :
      s.semester <= 4 ? "II" :
      s.semester <= 6 ? "III" : "IV"
    ) : "Unknown";
    
    if (selectedYear !== "All Years" && logicalYear !== selectedYear) return false;
    if (selectedSemester !== "All Semesters" && String(s.semester) !== selectedSemester) return false;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const codeMatch = s.code?.toLowerCase().includes(term);
      const nameMatch = s.name?.toLowerCase().includes(term);
      if (!codeMatch && !nameMatch) return false;
    }
    
    return true;
  });

  const toggleYear = (yr: string) => {
    setExpandedYears(prev => ({ ...prev, [yr]: !prev[yr] }));
  };

  const toggleSemester = (sem: number) => {
    setExpandedSemesters(prev => ({ ...prev, [sem]: !prev[sem] }));
  };

  // ── Curriculum Summary Computations ──────────────────────────────────────────
  const totalSubjects = filteredSubjects.length;
  const totalCredits = filteredSubjects.reduce((acc, s) => acc + (s.credits || 0), 0);
  
  const subjectsYear1 = filteredSubjects.filter(s => s.year === "I").length;
  const subjectsYear2 = filteredSubjects.filter(s => s.year === "II").length;
  const subjectsYear3 = filteredSubjects.filter(s => s.year === "III").length;
  const subjectsYear4 = filteredSubjects.filter(s => s.year === "IV").length;

  const coreCount = filteredSubjects.filter(s => s.type?.toLowerCase() === "core").length;
  const labCount = filteredSubjects.filter(s => s.type?.toLowerCase() === "lab" || s.type?.toLowerCase() === "laboratory").length;
  const mandatoryCount = filteredSubjects.filter(s => s.type?.toLowerCase() === "mandatory").length;
  const electiveCount = filteredSubjects.filter(s => s.type?.toLowerCase() === "elective").length;

  const yearsConfig = [
    { name: "I", label: "Year 1", semesters: [1, 2], semesterLabels: ["Semester 1", "Semester 2"] },
    { name: "II", label: "Year 2", semesters: [3, 4], semesterLabels: ["Semester 3", "Semester 4"] },
    { name: "III", label: "Year 3", semesters: [5, 6], semesterLabels: ["Semester 5", "Semester 6"] },
    { name: "IV", label: "Year 4", semesters: [7, 8], semesterLabels: ["Semester 7", "Semester 8"] }
  ];

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
        return "bg-neutral-500/10 text-neutral-400 border-neutral-500/20";
    }
  };

  const activeDeptObj = departments.find(d => d.id === selectedDeptId);
  const activeProgObj = programs.find(p => p.id === selectedProgramId);

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-[9px] uppercase font-bold text-indigo-500 tracking-wider font-mono">
            Academic Configurations
          </span>
          <h2 className="font-display font-bold text-xl dark:text-white text-text-primary flex items-center gap-2">
            <Layers size={20} className="text-indigo-500" />
            <span>Curriculum Scheme Manager</span>
          </h2>
          <p className="text-xs dark:text-neutral-400 text-text-secondary mt-0.5">
            Dynamic academic curriculum registry constructed in real-time from the master Subjects catalog.
          </p>
        </div>

        <button
          onClick={fetchCurriculumData}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg border dark:border-neutral-800 border-border-subtle dark:bg-neutral-900 bg-white dark:text-neutral-300 text-text-primary hover:border-indigo-500/30 transition-all font-semibold text-xs self-start sm:self-center cursor-pointer"
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
      <div className="glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5" /> Filters and Configurations
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          {/* Department Select */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Department</label>
            <select
              value={selectedDeptId}
              onChange={(e) => setSelectedDeptId(e.target.value)}
              className="px-3 py-2 rounded-lg border dark:border-neutral-800 border-border-subtle bg-surface text-xs font-semibold focus:outline-none focus:border-indigo-500"
            >
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.code} - {d.name}</option>
              ))}
            </select>
          </div>

          {/* Program Select */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Program</label>
            <select
              value={selectedProgramId}
              onChange={(e) => setSelectedProgramId(e.target.value)}
              className="px-3 py-2 rounded-lg border dark:border-neutral-800 border-border-subtle bg-surface text-xs font-semibold focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Programs</option>
              {filteredPrograms.map(p => (
                <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
              ))}
            </select>
          </div>

          {/* Regulation Select */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Regulation</label>
            <select
              value={selectedRegulation}
              onChange={(e) => setSelectedRegulation(e.target.value)}
              className="px-3 py-2 rounded-lg border dark:border-neutral-800 border-border-subtle bg-surface text-xs font-semibold focus:outline-none focus:border-indigo-500"
            >
              {uniqueRegulations.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Year Select */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-3 py-2 rounded-lg border dark:border-neutral-800 border-border-subtle bg-surface text-xs font-semibold focus:outline-none focus:border-indigo-500"
            >
              <option value="All Years">All Years</option>
              <option value="I">Year 1</option>
              <option value="II">Year 2</option>
              <option value="III">Year 3</option>
              <option value="IV">Year 4</option>
            </select>
          </div>

          {/* Semester Select */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Semester</label>
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="px-3 py-2 rounded-lg border dark:border-neutral-800 border-border-subtle bg-surface text-xs font-semibold focus:outline-none focus:border-indigo-500"
            >
              <option value="All Semesters">All Semesters</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                <option key={s} value={String(s)}>Semester {s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Text Search Bar */}
        <div className="relative pt-2">
          <Search className="absolute left-3 top-5 w-4 h-4 dark:text-neutral-500 text-text-muted" />
          <input
            type="text"
            placeholder="Search subjects in this scheme by code or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs dark:bg-neutral-950 bg-surface border dark:border-neutral-850 border-border-subtle rounded-lg dark:text-white text-text-primary focus:outline-none focus:border-indigo-500 transition"
          />
        </div>
      </div>

      {/* Curriculum Summary Panel */}
      {!loading && filteredSubjects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl p-4 flex flex-col justify-between">
            <div>
              <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider block">Total Credits</span>
              <span className="text-3xl font-extrabold text-indigo-500 font-mono mt-1 block">{totalCredits}</span>
            </div>
            <span className="text-[10px] text-text-secondary mt-2 block">
              Across <strong className="dark:text-white text-text-primary font-mono">{totalSubjects}</strong> registered subjects
            </span>
          </div>

          <div className="glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl p-4">
            <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider block">Subjects by Year</span>
            <div className="grid grid-cols-4 gap-2 mt-2 text-center">
              <div className="bg-neutral-500/5 p-1.5 rounded border border-neutral-500/10">
                <span className="text-[9px] text-text-muted block">Y1</span>
                <span className="text-sm font-bold dark:text-white text-text-primary font-mono">{subjectsYear1}</span>
              </div>
              <div className="bg-neutral-500/5 p-1.5 rounded border border-neutral-500/10">
                <span className="text-[9px] text-text-muted block">Y2</span>
                <span className="text-sm font-bold dark:text-white text-text-primary font-mono">{subjectsYear2}</span>
              </div>
              <div className="bg-neutral-500/5 p-1.5 rounded border border-neutral-500/10">
                <span className="text-[9px] text-text-muted block">Y3</span>
                <span className="text-sm font-bold dark:text-white text-text-primary font-mono">{subjectsYear3}</span>
              </div>
              <div className="bg-neutral-500/5 p-1.5 rounded border border-neutral-500/10">
                <span className="text-[9px] text-text-muted block">Y4</span>
                <span className="text-sm font-bold dark:text-white text-text-primary font-mono">{subjectsYear4}</span>
              </div>
            </div>
          </div>

          <div className="glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl p-4 md:col-span-2">
            <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider block">Subject Type Breakdown</span>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-indigo-500/5 text-indigo-400 border border-indigo-500/25">
                Core: <strong className="font-mono">{coreCount}</strong>
              </span>
              <span className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-sky-500/5 text-sky-400 border border-sky-500/25">
                Labs: <strong className="font-mono">{labCount}</strong>
              </span>
              <span className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-rose-500/5 text-rose-400 border border-rose-500/25">
                Mandatory: <strong className="font-mono">{mandatoryCount}</strong>
              </span>
              <span className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-amber-500/5 text-amber-400 border border-amber-500/25">
                Electives: <strong className="font-mono">{electiveCount}</strong>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Layout */}
      <div className="space-y-6">
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
              We couldn't locate any dynamic subjects mapped under program <strong>{activeProgObj?.code || "All Programs"}</strong> for regulation <strong>{selectedRegulation}</strong>. Use the Subjects catalog to import or add entries.
            </p>
          </div>
        ) : (
          yearsConfig.map(year => {
            const isYearExpanded = expandedYears[year.name];
            // Filter configuration to match selected filter constraints
            if (selectedYear !== "All Years" && selectedYear !== year.name) return null;

            const yearSubjects = filteredSubjects.filter(s => year.semesters.includes(s.semester || 0));
            if (yearSubjects.length === 0) return null;

            // Calculate total year credits
            const yearCredits = yearSubjects.reduce((sum, s) => sum + (s.credits || 0), 0);

            return (
              <div key={year.name} className="glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl p-5 space-y-4">
                
                {/* Year Header Accordion */}
                <button
                  onClick={() => toggleYear(year.name)}
                  className="w-full flex items-center justify-between border-b dark:border-neutral-850 border-border-subtle pb-3 cursor-pointer text-left focus:outline-none"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400">
                      <FolderOpen size={15} />
                    </div>
                    <div>
                      <h3 className="font-display font-bold dark:text-white text-text-primary text-sm leading-tight flex items-center gap-2">
                        <span>{year.label} Curriculum Structure</span>
                        <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md font-mono font-bold">
                          {yearCredits} Credits
                        </span>
                      </h3>
                      <span className="text-[9px] dark:text-slate-500 text-text-muted font-bold uppercase tracking-wider block mt-0.5">
                        {activeDeptObj?.name} • Reg {selectedRegulation}
                      </span>
                    </div>
                  </div>
                  {isYearExpanded ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
                </button>

                {/* Semesters list under this Year */}
                {isYearExpanded && (
                  <div className="space-y-6 pt-2">
                    {year.semesters.map((semNum, idx) => {
                      const isSemExpanded = expandedSemesters[semNum];
                      if (selectedSemester !== "All Semesters" && selectedSemester !== String(semNum)) return null;

                      const semSubjects = yearSubjects.filter(s => s.semester === semNum);
                      if (semSubjects.length === 0) return null;

                      const semCredits = semSubjects.reduce((sum, s) => sum + (s.credits || 0), 0);

                      return (
                        <div key={semNum} className="border-l-2 border-indigo-500/30 pl-4 space-y-3">
                          {/* Semester Header Accordion */}
                          <button
                            onClick={() => toggleSemester(semNum)}
                            className="flex items-center gap-2.5 cursor-pointer text-left focus:outline-none"
                          >
                            <Calendar size={12} className="text-indigo-400" />
                            <h4 className="text-xs font-bold dark:text-white text-text-primary uppercase tracking-wider flex items-center gap-2">
                              <span>{year.semesterLabels[idx]}</span>
                              <span className="text-[9px] text-text-muted font-mono bg-neutral-500/10 px-2 py-0.5 rounded">
                                {semSubjects.length} subjects • {semCredits} credits
                              </span>
                            </h4>
                            {isSemExpanded ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
                          </button>

                          {/* Grid of dynamic subject cards */}
                          {isSemExpanded && (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pt-1">
                              {semSubjects.map(sub => {
                                return (
                                  <div
                                    key={sub.id}
                                    className="p-4 dark:bg-neutral-950/40 bg-background border dark:border-neutral-900 border-border-subtle rounded-xl flex flex-col justify-between hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-600/5 transition-all duration-200 space-y-3.5"
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
                                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border shrink-0 ${getSubjectTypeStyles(sub.type)}`}>
                                        {sub.type}
                                      </span>
                                    </div>

                                    {/* Mappings Metadata */}
                                    <div className="text-[10px] space-y-1 dark:text-neutral-500 text-text-muted border-t dark:border-neutral-900 border-neutral-100 pt-2.5">
                                      <div className="flex justify-between">
                                        <span>Regulation:</span>
                                        <span className="font-semibold text-text-primary dark:text-neutral-300">{sub.regulation}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>Program:</span>
                                        <span className="font-semibold text-text-primary dark:text-neutral-300 truncate max-w-[150px]">{sub.programName || "General"}</span>
                                      </div>
                                    </div>

                                    {/* L-T-P parameters & Credits */}
                                    <div className="flex items-center justify-between border-t dark:border-neutral-900 border-neutral-100 pt-2.5 text-[10px]">
                                      <span className="text-text-muted font-mono">
                                        L-T-P: {sub.lectureHours}-{sub.tutorialHours}-{sub.practicalHours}
                                      </span>
                                      <span className="font-bold dark:text-indigo-400 text-indigo-600 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md font-mono">
                                        {sub.credits} credits
                                      </span>
                                    </div>

                                    {/* Summary Stats: Faculty / Student Count */}
                                    <div className="border-t dark:border-neutral-900 border-neutral-100 pt-2.5 flex items-center justify-between gap-2 text-[10px]">
                                      <div className="flex items-center gap-3">
                                        <span className="flex items-center gap-1 text-[10px] dark:text-neutral-400 text-text-secondary font-mono">
                                          <Users className="w-3.5 h-3.5 text-blue-400" />
                                          <span>Students: <strong>{sub.studentCount || 0}</strong></span>
                                        </span>
                                        <span className="flex items-center gap-1 text-[10px] dark:text-neutral-400 text-text-secondary font-mono">
                                          <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                                          <span>Faculties: <strong>{sub.facultyCount || 0}</strong></span>
                                        </span>
                                      </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="border-t dark:border-neutral-900 border-neutral-100 pt-2.5 flex items-center justify-between gap-2">
                                      <button
                                        onClick={() => setViewingSubject(sub)}
                                        className="text-[10px] font-bold text-indigo-500 hover:text-indigo-400 transition flex items-center gap-1 cursor-pointer"
                                      >
                                        <Info size={11} />
                                        <span>View Details</span>
                                      </button>

                                      <Link
                                        href="/admin/subjects"
                                        className="text-[10px] font-bold text-neutral-500 hover:text-neutral-400 transition flex items-center gap-0.5"
                                      >
                                        <span>Subject Catalog</span>
                                        <ArrowUpRight size={11} />
                                      </Link>
                                    </div>

                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

              </div>
            );
          })
        )}
      </div>

      {/* Dynamic Details Viewing Modal */}
      {viewingSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative flex flex-col max-h-[85vh]">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b dark:border-slate-800 pb-3 mb-4">
              <div>
                <span className="text-[10px] text-indigo-400 font-mono font-bold tracking-wider uppercase block">{viewingSubject.code}</span>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white leading-tight mt-0.5">
                  {viewingSubject.name}
                </h3>
              </div>
              <button
                onClick={() => setViewingSubject(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content Scroll Area */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-4">
              
              {/* Description */}
              <div className="space-y-1">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Subject Description</h4>
                <p className="text-xs text-slate-700 dark:text-slate-350 leading-relaxed bg-slate-50 dark:bg-slate-850 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                  {viewingSubject.description || "No catalog description available for this subject."}
                </p>
              </div>

              {/* Subject Parameters */}
              <div className="grid grid-cols-2 gap-3.5 text-xs">
                <div className="bg-slate-50 dark:bg-slate-850 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                  <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider">Subject Type</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block capitalize">{viewingSubject.type}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-850 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                  <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider">Credits Mapping</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block font-mono">{viewingSubject.credits} Credits</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-850 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                  <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider">L-T-P Parameters</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block font-mono">
                    L: {viewingSubject.lectureHours} | T: {viewingSubject.tutorialHours} | P: {viewingSubject.practicalHours}
                  </span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-850 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                  <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider">Status</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block capitalize">{viewingSubject.status}</span>
                </div>
              </div>

              {/* Curriculum Placement Mapping */}
              <div className="space-y-1.5 border-t dark:border-slate-800 pt-3">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Curriculum Mappings</h4>
                <div className="bg-slate-50 dark:bg-slate-850 p-3 rounded-lg border border-slate-100 dark:border-slate-800 space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                  <div className="flex justify-between">
                    <span>Department:</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{viewingSubject.departmentName || "N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Regulation Scheme:</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{viewingSubject.regulation}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Target Program:</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{viewingSubject.programName || "General / Core"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Academic Year / Sem:</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">Year {viewingSubject.year} • Semester {viewingSubject.semester}</span>
                  </div>
                </div>
              </div>

              {/* Dynamic Enrolled Metrics */}
              <div className="grid grid-cols-2 gap-3.5 border-t dark:border-slate-800 pt-3">
                <div className="bg-blue-500/5 p-2.5 rounded-lg border border-blue-500/20 text-center">
                  <span className="text-[9px] text-blue-400 block uppercase font-bold tracking-wider">Enrolled Students</span>
                  <span className="text-xl font-extrabold text-blue-500 font-mono mt-0.5 block">{viewingSubject.studentCount || 0}</span>
                </div>
                <div className="bg-emerald-500/5 p-2.5 rounded-lg border border-emerald-500/20 text-center">
                  <span className="text-[9px] text-emerald-400 block uppercase font-bold tracking-wider">Assigned Faculty Count</span>
                  <span className="text-xl font-extrabold text-emerald-500 font-mono mt-0.5 block">{viewingSubject.facultyCount || 0}</span>
                </div>
              </div>

              {/* Active Allocated Faculty Members List */}
              {viewingSubject.facultyCount && viewingSubject.facultyCount > 0 ? (
                <div className="space-y-1.5 border-t dark:border-slate-800 pt-3">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Allocated Faculty Roster</h4>
                  <div className="max-h-24 overflow-y-auto border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 rounded-lg p-2 space-y-1">
                    {allocations
                      .filter(a => a.subjectId === viewingSubject.id && a.status === "active")
                      .map((a, idx) => (
                        <div key={idx} className="text-xs text-slate-700 dark:text-slate-350 flex items-center justify-between bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded border border-slate-100 dark:border-slate-800">
                          <span className="font-semibold">{a.facultyName}</span>
                          <span className="text-[9px] font-mono bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">Sec {a.section}</span>
                        </div>
                      ))}
                  </div>
                </div>
              ) : null}

            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-3 mt-5 border-t dark:border-slate-800 pt-4 shrink-0">
              <Link
                href="/admin/subjects"
                onClick={() => setViewingSubject(null)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 dark:bg-indigo-650 dark:hover:bg-indigo-600 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <span>Edit Parameters in Catalog</span>
                <ArrowRight size={12} />
              </Link>
              <button
                onClick={() => setViewingSubject(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                Close View
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
