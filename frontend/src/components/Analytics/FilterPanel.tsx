"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Search, Filter, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import { useDepartments, useFaculty, useSubjects, useAcademicSessions } from "@/hooks/useRegistry";

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

  // Filter form states
  const [search, setSearch] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [semester, setSemester] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [facultyId, setFacultyId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Use dynamic query hooks for filter options
  const { data: academicSessions = [] } = useAcademicSessions();
  const { data: departments = [] } = useDepartments();
  
  const { data: facultyRes } = useFaculty({ limit: 500, status: "ACTIVE" });
  const facultyList = facultyRes?.faculty || [];
  
  const { data: subjectsRes } = useSubjects({ limit: 500, status: "ACTIVE" });
  const subjects = subjectsRes?.subjects || [];

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
    <div className="glass-card dark:border-neutral-800 border-border-subtle bg-surface rounded-xl p-5 shadow-sm space-y-4">
      {/* Search Bar & Primary Actions */}
      <form onSubmit={handleApply} className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search query string..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-surface-elevated border border-border-subtle text-text-primary rounded-lg focus:border-accent-blue focus:outline-none placeholder:text-text-muted"
          />
        </div>
        
        <div className="flex gap-2">
          <button
            type="submit"
            className="px-4 py-2 bg-accent-blue hover:bg-accent-blue-hover text-white text-xs font-semibold rounded-lg transition shadow-md shadow-accent-blue/10 cursor-pointer flex items-center gap-1.5"
          >
            <Filter size={14} />
            <span>Apply</span>
          </button>
          
          <button
            type="button"
            onClick={handleReset}
            className="p-2 border border-border-subtle hover:bg-surface-hover text-text-secondary rounded-lg transition cursor-pointer flex items-center justify-center"
            title="Reset Filters"
          >
            <RotateCcw size={14} />
          </button>
          
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="px-3 py-2 border border-border-subtle hover:bg-surface-hover text-text-secondary text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1"
          >
            <span>Filters</span>
            {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
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
              {academicSessions.map((session) => (
                <option key={session} value={session}>{session}</option>
              ))}
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
                {departments.map((dept: any) => (
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
                {facultyList.map((fac: any) => (
                  <option key={fac.id} value={fac.id}>
                    {fac.fullName || fac.name}
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
                {subjects.map((sub: any) => (
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
