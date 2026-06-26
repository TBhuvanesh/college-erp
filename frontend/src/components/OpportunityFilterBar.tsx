"use client";

import React from "react";
import { Search, Filter, RotateCcw, Building2, GraduationCap, ShieldCheck } from "lucide-react";

const OPPORTUNITY_TYPES_LIST = [
  "Internship",
  "Job Opportunity",
  "Workshop",
  "Seminar",
  "Hackathon",
  "Competition",
  "Placement Drive",
  "College Event",
];

const YEAR_GROUPS_LIST = ["I Year", "II Year", "III Year", "IV Year"];

const STATUS_LIST = ["Active", "Closed", "Archived"];

interface OpportunityFilterBarProps {
  filters: {
    search: string;
    type: string;
    departmentId: string;
    year: string;
    status: string;
  };
  departments: Array<{ id: string; name: string; code: string }>;
  onFilterChange: (key: string, value: string) => void;
  onClearFilters: () => void;
  showStatusFilter?: boolean;
}

export const OpportunityFilterBar: React.FC<OpportunityFilterBarProps> = ({
  filters,
  departments,
  onFilterChange,
  onClearFilters,
  showStatusFilter = false,
}) => {
  return (
    <div className="glass-card p-5 rounded-xl space-y-4">
      <div className="flex flex-col md:flex-row gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-neutral-500" />
          <input
            type="text"
            placeholder="Search by title, organizer..."
            value={filters.search}
            onChange={(e) => onFilterChange("search", e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-850 focus:border-blue-500/50 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-neutral-500 transition-all outline-none"
          />
        </div>

        {/* Clear Filters Button */}
        <button
          onClick={onClearFilters}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-neutral-850 bg-neutral-950 text-neutral-400 hover:text-white hover:bg-neutral-800 text-xs font-semibold transition cursor-pointer"
        >
          <RotateCcw size={14} />
          <span>Clear Filters</span>
        </button>
      </div>

      {/* Select Filters Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-1">
        {/* Opportunity Type Filter */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">
            Opportunity Type
          </label>
          <div className="flex items-center gap-2 bg-neutral-950 border border-neutral-850 rounded-lg px-2.5 text-xs text-white">
            <Filter size={12} className="text-neutral-500 shrink-0" />
            <select
              value={filters.type}
              onChange={(e) => onFilterChange("type", e.target.value)}
              className="bg-transparent text-white cursor-pointer py-2 flex-1 focus:outline-none font-semibold text-xs min-h-[36px]"
            >
              <option value="">All Types</option>
              {OPPORTUNITY_TYPES_LIST.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Department Filter */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">
            Department
          </label>
          <div className="flex items-center gap-2 bg-neutral-950 border border-neutral-850 rounded-lg px-2.5 text-xs text-white">
            <Building2 size={12} className="text-neutral-500 shrink-0" />
            <select
              value={filters.departmentId}
              onChange={(e) => onFilterChange("departmentId", e.target.value)}
              className="bg-transparent text-white cursor-pointer py-2 flex-1 focus:outline-none font-semibold text-xs min-h-[36px]"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} - {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Year Filter */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">
            Eligible Year
          </label>
          <div className="flex items-center gap-2 bg-neutral-950 border border-neutral-850 rounded-lg px-2.5 text-xs text-white">
            <GraduationCap size={12} className="text-neutral-500 shrink-0" />
            <select
              value={filters.year}
              onChange={(e) => onFilterChange("year", e.target.value)}
              className="bg-transparent text-white cursor-pointer py-2 flex-1 focus:outline-none font-semibold text-xs min-h-[36px]"
            >
              <option value="">All Years</option>
              {YEAR_GROUPS_LIST.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Filter (Optional for Admin/Faculty) */}
        {showStatusFilter && (
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">
              Status
            </label>
            <div className="flex items-center gap-2 bg-neutral-950 border border-neutral-850 rounded-lg px-2.5 text-xs text-white">
              <ShieldCheck size={12} className="text-neutral-500 shrink-0" />
              <select
                value={filters.status}
                onChange={(e) => onFilterChange("status", e.target.value)}
                className="bg-transparent text-white cursor-pointer py-2 flex-1 focus:outline-none font-semibold text-xs min-h-[36px]"
              >
                <option value="">All Statuses</option>
                {STATUS_LIST.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

