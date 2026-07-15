"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { Search, Filter, RotateCcw, ChevronDown, ChevronUp, Calendar } from "lucide-react";

export interface FilterState {
  search: string;
  academicYear?: string;
  semester?: number;
  departmentId?: string;
  facultyId?: string;
  subjectId?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface FilterPanelProps {
  onApplyFilters: (filters: FilterState) => void;
  role: "admin" | "hod" | "faculty" | "student";
}

export const FilterPanel: React.FC<FilterPanelProps> = ({ onApplyFilters, role }) => {
  const { accessToken } = useAuth();
  
  // Toggle advanced filter panel
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Lists for dropdown options
  const [departments, setDepartments] = useState<any[]>([]);
  const [facultyList, setFacultyList] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);

  // Filter form states
  const [search, setSearch] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [semester, setSemester] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [facultyId, setFacultyId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Load select options if user is Admin or HOD
  useEffect(() => {
    if (!accessToken || role === "student") return;

    const fetchOptions = async () => {
      try {
        const [deptRes, facRes, subRes] = await Promise.all([
          apiFetch("/departments?limit=100", {}, accessToken),
          apiFetch("/faculty?limit=500", {}, accessToken),
          apiFetch("/subjects?limit=500", {}, accessToken),
        ]);

        if (deptRes.success && deptRes.data?.departments) {
          setDepartments(deptRes.data.departments);
        }
        if (facRes.success && facRes.data?.faculty) {
          setFacultyList(facRes.data.faculty);
        }
        if (subRes.success && subRes.data?.subjects) {
          setSubjects(subRes.data.subjects);
        }
      } catch (err) {
        console.error("Failed to load filter options", err);
      }
    };

    fetchOptions();
  }, [accessToken, role]);

  const handleApply = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    const filters: FilterState = {
      search,
      academicYear: academicYear || undefined,
      semester: semester ? parseInt(semester) : undefined,
      departmentId: departmentId || undefined,
      facultyId: facultyId || undefined,
      subjectId: subjectId || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    };
    
    onApplyFilters(filters);
  };

  const handleReset = () => {
    setSearch("");
    setAcademicYear("");
    setSemester("");
    setDepartmentId("");
    setFacultyId("");
    setSubjectId("");
    setDateFrom("");
    setDateTo("");
    
    onApplyFilters({ search: "" });
  };

  return (
    <div className="bg-surface rounded-2xl border border-border-subtle p-4 shadow-sm space-y-4">
      {/* Primary Search & Toggle Row */}
      <form onSubmit={handleApply} className="flex flex-col md:flex-row items-center gap-3">
        <div className="relative w-full flex-1">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
            <Search size={15} />
          </span>
          <input
            type="text"
            placeholder="Search by Department, Faculty, Student or Subject..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-xs bg-surface-elevated border border-border-subtle text-text-primary rounded-xl focus:border-accent-blue focus:ring-1 focus:ring-accent-blue focus:outline-none transition-colors"
          />
        </div>

        <div className="flex w-full md:w-auto items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border-subtle bg-surface text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
          >
            <Filter size={14} className="text-text-muted" />
            <span>Filters</span>
            {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          <button
            type="button"
            onClick={handleReset}
            title="Reset Filters"
            className="p-2.5 rounded-xl border border-border-subtle bg-surface hover:bg-surface-hover hover:text-text-primary text-text-muted transition-colors cursor-pointer"
          >
            <RotateCcw size={14} />
          </button>

          <button
            type="submit"
            className="flex-1 md:flex-none inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-accent-blue text-xs font-bold text-white hover:bg-accent-blue/95 transition-all shadow-md shadow-accent-blue/10 cursor-pointer"
          >
            Apply
          </button>
        </div>
      </form>

      {/* Advanced Filter Fields */}
      {showAdvanced && (
        <div className="border-t border-border-subtle pt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-left animate-fade-in">
          {/* Academic Year */}
          <div>
            <label className="text-[10px] uppercase font-bold text-text-muted block mb-1">Academic Year</label>
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-surface-elevated border border-border-subtle text-text-primary rounded-lg focus:border-accent-blue focus:outline-none"
            >
              <option value="">All Batches</option>
              <option value="2026-2027">2026-2027</option>
              <option value="2025-2026">2025-2026</option>
              <option value="2024-2025">2024-2025</option>
            </select>
          </div>

          {/* Semester */}
          <div>
            <label className="text-[10px] uppercase font-bold text-text-muted block mb-1">Semester</label>
            <select
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-surface-elevated border border-border-subtle text-text-primary rounded-lg focus:border-accent-blue focus:outline-none"
            >
              <option value="">All Semesters</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                <option key={s} value={s.toString()}>
                  Semester {s}
                </option>
              ))}
            </select>
          </div>

          {/* Department (Admin only or disabled for HOD/Faculty) */}
          <div>
            <label className="text-[10px] uppercase font-bold text-text-muted block mb-1">Department</label>
            {role === "admin" ? (
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-surface-elevated border border-border-subtle text-text-primary rounded-lg focus:border-accent-blue focus:outline-none"
              >
                <option value="">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name} ({dept.code})
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                disabled
                value={role === "hod" ? "Own Department Scoped" : "Designated Only"}
                className="w-full px-3 py-2 text-xs bg-surface-hover border border-border-subtle text-text-muted rounded-lg outline-none cursor-not-allowed font-medium"
              />
            )}
          </div>

          {/* Faculty (Admin/HOD only) */}
          <div>
            <label className="text-[10px] uppercase font-bold text-text-muted block mb-1">Faculty</label>
            {role === "admin" || role === "hod" ? (
              <select
                value={facultyId}
                onChange={(e) => setFacultyId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-surface-elevated border border-border-subtle text-text-primary rounded-lg focus:border-accent-blue focus:outline-none"
              >
                <option value="">All Instructors</option>
                {facultyList.map((fac) => (
                  <option key={fac.id} value={fac.id}>
                    {fac.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                disabled
                value="Self Assigned Scoped"
                className="w-full px-3 py-2 text-xs bg-surface-hover border border-border-subtle text-text-muted rounded-lg outline-none cursor-not-allowed font-medium"
              />
            )}
          </div>

          {/* Subject */}
          <div>
            <label className="text-[10px] uppercase font-bold text-text-muted block mb-1">Subject</label>
            {role !== "student" ? (
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-surface-elevated border border-border-subtle text-text-primary rounded-lg focus:border-accent-blue focus:outline-none"
              >
                <option value="">All Subjects</option>
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    [{sub.code}] {sub.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                disabled
                value="Own Subjects Only"
                className="w-full px-3 py-2 text-xs bg-surface-hover border border-border-subtle text-text-muted rounded-lg outline-none cursor-not-allowed font-medium"
              />
            )}
          </div>

          {/* Date From */}
          <div>
            <label className="text-[10px] uppercase font-bold text-text-muted block mb-1">Date From</label>
            <div className="relative">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-surface-elevated border border-border-subtle text-text-primary rounded-lg focus:border-accent-blue focus:outline-none"
              />
            </div>
          </div>

          {/* Date To */}
          <div>
            <label className="text-[10px] uppercase font-bold text-text-muted block mb-1">Date To</label>
            <div className="relative">
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-surface-elevated border border-border-subtle text-text-primary rounded-lg focus:border-accent-blue focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
