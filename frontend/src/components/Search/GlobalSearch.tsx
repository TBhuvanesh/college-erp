"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import {
  searchErp,
  SearchResult,
  StudentResult,
  FacultyResult,
  SubjectResult,
  AnnouncementResult,
  EventResult,
} from "@/lib/search";
import {
  Search,
  X,
  Loader2,
  AlertCircle,
  Inbox,
  User,
  GraduationCap,
  BookOpen,
  Bell,
  Calendar,
  ArrowRight,
} from "lucide-react";

export const GlobalSearch: React.FC = () => {
  const { user, accessToken } = useAuth();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce query input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
    return () => clearTimeout(handler);
  }, [query]);

  // Execute search API request
  const performSearch = useCallback(async (searchTerm: string) => {
    if (!accessToken) return;
    if (searchTerm.length < 2) {
      setResults(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await searchErp(searchTerm, accessToken);
      setResults(data);
    } catch (err: any) {
      console.error("Global search failed:", err);
      setError(err.message || "Failed to fetch search results.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (debouncedQuery.length >= 2) {
        performSearch(debouncedQuery);
      } else {
        setResults(null);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [debouncedQuery, performSearch]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close dropdown on Escape press
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleClear = () => {
    setQuery("");
    setDebouncedQuery("");
    setResults(null);
    setError(null);
  };

  const getRoleRedirectUrl = (category: string, item: any) => {
    if (!user) return "#";
    const role = user.role.toLowerCase();

    switch (category) {
      case "students":
        return `/admin/students`; // Only admin can access student registry
      case "faculty":
        return `/admin/faculty`; // Only admin can access faculty roster
      case "subjects":
        if (role === "admin") return `/admin/courses`;
        if (role === "faculty") return `/faculty/subjects`;
        return `/student/attendance`; // Students view attendance/subjects
      case "announcements":
        return `/${role}/announcements`;
      case "events":
        return `/${role}/calendar`;
      default:
        return `/${role}/dashboard`;
    }
  };

  const hasResults =
    results &&
    (results.students?.length > 0 ||
      results.faculty?.length > 0 ||
      results.subjects?.length > 0 ||
      results.announcements?.length > 0 ||
      results.events?.length > 0);

  return (
    <div ref={containerRef} className="relative w-full max-w-xs md:max-w-md mx-auto">
      {/* Search Input Bar */}
      <div className="relative">
        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-neutral-500 pointer-events-none">
          <Search size={14} />
        </span>
        <input
          type="text"
          placeholder="Search ERP (students, courses, notices...)"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="w-full pl-9 pr-9 py-2 text-xs dark:bg-neutral-955 bg-surface border dark:border-neutral-800 border-border-subtle rounded-lg dark:text-white text-text-primary placeholder-neutral-500 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center dark:text-neutral-500 text-text-muted dark:hover:text-white hover:text-text-primary cursor-pointer"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Floating Dropdown Results Panel */}
      {isOpen && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 mt-2 max-h-[420px] overflow-y-auto rounded-xl border dark:border-neutral-850 border-border-subtle dark:bg-neutral-900/95 bg-surface/95 backdrop-blur-md shadow-2xl p-4 z-50 flex flex-col gap-4 scrollbar-thin">
          
          {/* Loading State */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-8 dark:text-neutral-400 text-text-secondary text-xs font-mono">
              <Loader2 className="animate-spin text-blue-500 mb-2" size={20} />
              <span>Searching ERP Registry...</span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-455 text-xs font-semibold leading-normal">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && !hasResults && (
            <div className="flex flex-col items-center justify-center py-10 text-neutral-500 text-center">
              <Inbox size={24} className="text-neutral-600 mb-2" />
              <p className="text-xs font-mono">No matching records found for &quot;{query}&quot;</p>
              <span className="text-[10px] text-neutral-600 mt-1 leading-normal">
                Refine spelling or search terms.
              </span>
            </div>
          )}

          {/* Results Grid / Categorized Lists */}
          {!loading && !error && hasResults && results && (
            <div className="space-y-4">
              {/* Category: Students */}
              {results.students && results.students.length > 0 && (
                <div>
                  <h4 className="text-[9px] uppercase font-bold text-neutral-500 tracking-wider mb-2 border-b border-neutral-850 pb-1 flex items-center gap-1.5">
                    <User size={12} className="text-blue-400" />
                    <span>Students ({results.students.length})</span>
                  </h4>
                  <div className="grid grid-cols-1 gap-1.5">
                    {results.students.map((student) => (
                      <Link
                        key={student.id}
                        href={getRoleRedirectUrl("students", student)}
                        onClick={() => setIsOpen(false)}
                        className="p-2.5 dark:bg-neutral-955 bg-background dark:hover:bg-neutral-800/40 hover:bg-neutral-100/50 border dark:border-neutral-900 border-border-subtle rounded flex justify-between items-center text-xs group transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="font-bold dark:text-white text-text-primary group-hover:text-blue-500 transition-colors">
                            {student.fullName}
                          </p>
                          <span className="text-[10px] dark:text-neutral-450 text-text-secondary font-mono mt-0.5 block">
                            Roll: {student.rollNumber} • {student.departmentName}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[9px] dark:bg-blue-500/10 bg-blue-50 dark:text-blue-400 text-blue-750 border dark:border-blue-500/20 border-blue-200 px-1.5 py-0.5 rounded font-semibold font-mono">
                            Semester {student.semester}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Category: Faculty */}
              {results.faculty && results.faculty.length > 0 && (
                <div>
                  <h4 className="text-[9px] uppercase font-bold text-neutral-500 tracking-wider mb-2 border-b dark:border-neutral-850 border-border-subtle pb-1 flex items-center gap-1.5">
                    <GraduationCap size={12} className="text-emerald-400" />
                    <span>Faculty ({results.faculty.length})</span>
                  </h4>
                  <div className="grid grid-cols-1 gap-1.5">
                    {results.faculty.map((fac) => (
                      <Link
                        key={fac.id}
                        href={getRoleRedirectUrl("faculty", fac)}
                        onClick={() => setIsOpen(false)}
                        className="p-2.5 dark:bg-neutral-955 bg-background dark:hover:bg-neutral-800/40 hover:bg-neutral-100/50 border dark:border-neutral-900 border-border-subtle rounded flex justify-between items-center text-xs group transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="font-bold dark:text-white text-text-primary group-hover:text-emerald-500 transition-colors">
                            {fac.fullName}
                          </p>
                          <span className="text-[10px] dark:text-neutral-450 text-text-secondary font-mono mt-0.5 block">
                            ID: {fac.employeeNumber} • {fac.departmentName}
                          </span>
                        </div>
                        <ArrowRight size={12} className="dark:text-neutral-600 text-text-muted group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Category: Subjects */}
              {results.subjects && results.subjects.length > 0 && (
                <div>
                  <h4 className="text-[9px] uppercase font-bold text-neutral-500 tracking-wider mb-2 border-b dark:border-neutral-850 border-border-subtle pb-1 flex items-center gap-1.5">
                    <BookOpen size={12} className="text-indigo-400" />
                    <span>Subjects ({results.subjects.length})</span>
                  </h4>
                  <div className="grid grid-cols-1 gap-1.5">
                    {results.subjects.map((sub) => (
                      <Link
                        key={sub.id}
                        href={getRoleRedirectUrl("subjects", sub)}
                        onClick={() => setIsOpen(false)}
                        className="p-2.5 dark:bg-neutral-955 bg-background dark:hover:bg-neutral-800/40 hover:bg-neutral-100/50 border dark:border-neutral-900 border-border-subtle rounded flex justify-between items-center text-xs group transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-bold dark:text-white text-text-primary group-hover:text-indigo-500 transition-colors">
                            {sub.name}
                          </p>
                          <span className="text-[10px] dark:text-neutral-450 text-text-secondary font-mono mt-0.5 block">
                            Code: {sub.code}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[9px] dark:bg-indigo-500/10 bg-indigo-50 dark:text-indigo-400 text-indigo-750 border dark:border-indigo-500/20 border-indigo-200 px-1.5 py-0.5 rounded font-semibold font-mono">
                            Semester {sub.semester}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Category: Announcements */}
              {results.announcements && results.announcements.length > 0 && (
                <div>
                  <h4 className="text-[9px] uppercase font-bold text-neutral-500 tracking-wider mb-2 border-b dark:border-neutral-850 border-border-subtle pb-1 flex items-center gap-1.5">
                    <Bell size={12} className="text-amber-400" />
                    <span>Announcements ({results.announcements.length})</span>
                  </h4>
                  <div className="grid grid-cols-1 gap-1.5">
                    {results.announcements.map((ann) => (
                      <Link
                        key={ann.id}
                        href={getRoleRedirectUrl("announcements", ann)}
                        onClick={() => setIsOpen(false)}
                        className="p-2.5 dark:bg-neutral-955 bg-background dark:hover:bg-neutral-800/40 hover:bg-neutral-100/50 border dark:border-neutral-900 border-border-subtle rounded flex justify-between items-center text-xs group transition-colors animate-fade-in"
                      >
                        <div className="min-w-0 flex-1 pr-4">
                          <p className="font-bold dark:text-white text-text-primary group-hover:text-amber-500 transition-colors truncate">
                            {ann.title}
                          </p>
                          <span className="text-[10px] dark:text-neutral-500 text-text-muted font-mono mt-0.5 block">
                            Published: {ann.publishDate}
                          </span>
                        </div>
                        <ArrowRight size={12} className="dark:text-neutral-600 text-text-muted group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Category: Events */}
              {results.events && results.events.length > 0 && (
                <div>
                  <h4 className="text-[9px] uppercase font-bold text-neutral-500 tracking-wider mb-2 border-b dark:border-neutral-850 border-border-subtle pb-1 flex items-center gap-1.5">
                    <Calendar size={12} className="text-rose-455" />
                    <span>Academic Events ({results.events.length})</span>
                  </h4>
                  <div className="grid grid-cols-1 gap-1.5">
                    {results.events.map((ev) => (
                      <Link
                        key={ev.id}
                        href={getRoleRedirectUrl("events", ev)}
                        onClick={() => setIsOpen(false)}
                        className="p-2.5 dark:bg-neutral-955 bg-background dark:hover:bg-neutral-800/40 hover:bg-neutral-100/50 border dark:border-neutral-900 border-border-subtle rounded flex justify-between items-center text-xs group transition-colors animate-fade-in"
                      >
                        <div className="min-w-0 flex-1 pr-4">
                          <p className="font-bold dark:text-white text-text-primary group-hover:text-rose-455 transition-colors truncate">
                            {ev.title}
                          </p>
                          <span className="text-[10px] dark:text-neutral-500 text-text-muted font-mono mt-0.5 block">
                            Date: {ev.startDate}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[9px] dark:bg-rose-500/10 bg-rose-50 dark:text-rose-400 text-rose-750 border dark:border-rose-500/20 border-rose-200 px-1.5 py-0.5 rounded font-semibold font-mono uppercase tracking-wider">
                            {ev.eventType}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
