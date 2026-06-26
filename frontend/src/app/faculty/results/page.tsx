"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { 
  Check, 
  X, 
  Users, 
  BookOpen, 
  Sparkles, 
  Loader2, 
  AlertCircle, 
  Search, 
  Lock, 
  Unlock, 
  Save, 
  Settings,
  AlertTriangle,
  Info
} from "lucide-react";

interface AssignmentDetail {
  id: string;
  facultyId: string;
  facultyName: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  departmentName: string;
  semester: number;
  academicYear: string;
  section: string;
  isActive: boolean;
}

interface RosterRecord {
  studentId: string;
  rollNumber: string;
  fullName: string;
  internalMarks: string;
  externalMarks: string;
  isAbsent: boolean;
  remarks: string;
  publicationStatus: "Draft" | "Published" | null;
}

export default function FacultyResults() {
  const { accessToken } = useAuth();

  // Loaders
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Messages
  const [error, setError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState("");

  // Workloads
  const [assignments, setAssignments] = useState<AssignmentDetail[]>([]);
  const [selectedSubjId, setSelectedSubjId] = useState("");
  const [selectedSection, setSelectedSection] = useState("");

  // Configurable Max Marks
  const [internalMax, setInternalMax] = useState("30");
  const [externalMax, setExternalMax] = useState("70");

  // Marks roster list
  const [records, setRecords] = useState<RosterRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  };

  // 1. Fetch assigned subjects
  useEffect(() => {
    const fetchAssignments = async () => {
      setLoadingAssignments(true);
      setError(null);
      try {
        const res = await apiFetch("/attendance/my-assignments", {}, accessToken);
        if (res.success && res.data?.assignments) {
          const activeAssignments = res.data.assignments.filter(
            (a: AssignmentDetail) => a.isActive
          );
          setAssignments(activeAssignments);
          
          if (activeAssignments.length > 0) {
            const first = activeAssignments[0];
            setSelectedSubjId(first.subjectId);
            setSelectedSection(first.section);
          }
        }
      } catch (err: any) {
        setError(err.message || "Failed to load workload assignments.");
      } finally {
        setLoadingAssignments(false);
      }
    };
    fetchAssignments();
  }, [accessToken]);

  // Unique subjects for selection
  const uniqueSubjects = React.useMemo(() => {
    const map = new Map();
    assignments.forEach((a) => {
      map.set(a.subjectId, { id: a.subjectId, name: a.subjectName, code: a.subjectCode });
    });
    return Array.from(map.values());
  }, [assignments]);

  // Unique sections for selected subject
  const sectionsForSelectedSubject = React.useMemo(() => {
    return assignments
      .filter((a) => a.subjectId === selectedSubjId)
      .map((a) => a.section);
  }, [assignments, selectedSubjId]);

  // Adjust section if subject changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (selectedSubjId) {
        const sections = assignments
          .filter((a) => a.subjectId === selectedSubjId)
          .map((a) => a.section);
        if (sections.length > 0 && !sections.includes(selectedSection)) {
          setSelectedSection(sections[0]);
        }
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [selectedSubjId, assignments, selectedSection]);

  // 2. Fetch roster
  const fetchRoster = useCallback(async () => {
    if (!selectedSubjId || !selectedSection) return;
    setLoadingRoster(true);
    setError(null);
    try {
      const res = await apiFetch(
        `/results/roster?subjectId=${selectedSubjId}&section=${selectedSection}`,
        {},
        accessToken
      );
      if (res.success && res.data?.roster) {
        const rosterData = res.data.roster;

        // Auto resolve max marks from first student record if it exists
        const firstWithMax = rosterData.find((r: any) => r.internalMaxMarks !== null);
        if (firstWithMax) {
          setInternalMax(firstWithMax.internalMaxMarks.toString());
          setExternalMax(firstWithMax.externalMaxMarks.toString());
        } else {
          setInternalMax("30");
          setExternalMax("70");
        }

        // Map roster to workspace state
        const initialRecords = rosterData.map((r: any) => ({
          studentId: r.studentId,
          rollNumber: r.rollNumber,
          fullName: r.fullName,
          internalMarks: r.internalMarks !== null ? r.internalMarks.toString() : "0",
          externalMarks: r.externalMarks !== null ? r.externalMarks.toString() : "0",
          isAbsent: r.resultStatus === "Absent",
          remarks: r.remarks || "",
          publicationStatus: r.publicationStatus // "Draft" | "Published" | null
        }));

        setRecords(initialRecords);
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch section results roster.");
      setRecords([]);
    } finally {
      setLoadingRoster(false);
    }
  }, [selectedSubjId, selectedSection, accessToken]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRoster();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchRoster]);

  // Form field changes helper
  const handleRecordChange = (
    studentId: string,
    field: keyof RosterRecord,
    value: any
  ) => {
    setRecords((prev) =>
      prev.map((r) => {
        if (r.studentId !== studentId) return r;
        const updated = { ...r, [field]: value };
        if (field === "isAbsent" && value === true) {
          updated.externalMarks = "0"; // Clear external marks if absent
        }
        return updated;
      })
    );
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubjId || !selectedSection) return;

    setError(null);
    setSubmitting(true);

    const intMaxNum = parseFloat(internalMax);
    const extMaxNum = parseFloat(externalMax);

    if (isNaN(intMaxNum) || intMaxNum <= 0) {
      setError("Internal max marks must be a valid positive number.");
      setSubmitting(false);
      return;
    }
    if (isNaN(extMaxNum) || extMaxNum <= 0) {
      setError("External max marks must be a valid positive number.");
      setSubmitting(false);
      return;
    }

    // Validate student records
    const validationErrors: string[] = [];
    const formattedRecords = records.map((r) => {
      const intMarksNum = parseFloat(r.internalMarks || "0");
      const extMarksNum = parseFloat(r.externalMarks || "0");

      if (isNaN(intMarksNum) || intMarksNum < 0) {
        validationErrors.push(`Invalid internal marks for ${r.fullName}`);
      }
      if (intMarksNum > intMaxNum) {
        validationErrors.push(`Internal marks for ${r.fullName} cannot exceed ${intMaxNum}`);
      }

      if (!r.isAbsent) {
        if (isNaN(extMarksNum) || extMarksNum < 0) {
          validationErrors.push(`Invalid external marks for ${r.fullName}`);
        }
        if (extMarksNum > extMaxNum) {
          validationErrors.push(`External marks for ${r.fullName} cannot exceed ${extMaxNum}`);
        }
      }

      return {
        studentId: r.studentId,
        internalMarks: intMarksNum,
        externalMarks: r.isAbsent ? 0 : extMarksNum,
        isAbsent: r.isAbsent,
        remarks: r.remarks.trim() || undefined
      };
    });

    if (validationErrors.length > 0) {
      setError(validationErrors[0]); // Display first error
      setSubmitting(false);
      return;
    }

    try {
      const body = {
        subjectId: selectedSubjId,
        section: selectedSection,
        internalMaxMarks: intMaxNum,
        externalMaxMarks: extMaxNum,
        records: formattedRecords
      };

      const res = await apiFetch("/results/sessions", {
        method: "POST",
        body: JSON.stringify(body)
      }, accessToken);

      if (res.success) {
        triggerToast("Marks records saved as Draft successfully!");
        fetchRoster();
      }
    } catch (err: any) {
      setError(err.message || "Failed to submit marks session.");
    } finally {
      setSubmitting(false);
    }
  };

  // Filter roster based on search text
  const filteredRecords = React.useMemo(() => {
    return records.filter(
      (r) =>
        r.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.rollNumber.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [records, searchTerm]);

  // Statistics counters
  const stats = React.useMemo(() => {
    const total = records.length;
    const published = records.filter((r) => r.publicationStatus === "Published").length;
    const draft = records.filter((r) => r.publicationStatus === "Draft").length;
    const absents = records.filter((r) => r.isAbsent).length;
    return { total, published, draft, absents };
  }, [records]);

  if (loadingAssignments) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
        <Loader2 className="animate-spin text-blue-500 mb-3" size={30} />
        <span className="font-mono text-xs">Loading faculty workload mappings...</span>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-emerald-600 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-xl shadow-emerald-600/20 border border-emerald-400/20 animate-fade-in">
          <Sparkles size={14} className="animate-pulse" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h2 className="font-display font-bold text-2xl text-white">Results Marks Workspace</h2>
        <p className="text-xs text-neutral-400 mt-1">
          Input and update student internal and external marks. Submitted rosters are saved as drafts until published.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold rounded-lg mb-6 flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Workspace Form (Left 75%) */}
        <div className="flex-1 w-full space-y-6">
          {/* Workload Assignment selectors and Form settings */}
          <div className="glass-card border border-neutral-800 rounded-xl p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Subject Select */}
              <div className="flex items-center gap-2 bg-neutral-950 border border-neutral-850 rounded px-3 text-xs text-white">
                <BookOpen size={12} className="text-neutral-500 shrink-0" />
                <span className="text-neutral-500 whitespace-nowrap">Subject:</span>
                {uniqueSubjects.length > 0 ? (
                  <select
                    value={selectedSubjId}
                    onChange={(e) => setSelectedSubjId(e.target.value)}
                    className="bg-transparent text-white cursor-pointer py-2.5 flex-1 focus:outline-none font-semibold"
                  >
                    {uniqueSubjects.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.code}: {sub.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="py-2.5 text-neutral-500 font-mono">No Subject Assigned</span>
                )}
              </div>

              {/* Section Select */}
              <div className="flex items-center gap-2 bg-neutral-950 border border-neutral-850 rounded px-3 text-xs text-white">
                <Users size={12} className="text-neutral-500 shrink-0" />
                <span className="text-neutral-500">Section:</span>
                {sectionsForSelectedSubject.length > 0 ? (
                  <select
                    value={selectedSection}
                    onChange={(e) => setSelectedSection(e.target.value)}
                    className="bg-transparent text-white cursor-pointer py-2.5 flex-1 focus:outline-none font-bold"
                  >
                    {sectionsForSelectedSubject.map((sec) => (
                      <option key={sec} value={sec}>
                        Section {sec}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="py-2.5 text-neutral-500 font-mono">N/A</span>
                )}
              </div>

              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-neutral-500" />
                <input
                  type="text"
                  placeholder="Search by name or roll..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 text-xs bg-neutral-950 border border-neutral-850 rounded text-white focus:outline-none focus:border-neutral-700"
                />
              </div>
            </div>

            {/* Max Marks configuration inputs */}
            <div className="pt-3 border-t border-neutral-900 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] uppercase font-bold text-neutral-500 flex items-center gap-1">
                  <Settings size={10} />
                  <span>Internal Max Marks</span>
                </label>
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="200"
                    value={internalMax}
                    onChange={(e) => setInternalMax(e.target.value)}
                    className="w-24 bg-neutral-950 border border-neutral-850 rounded px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-neutral-700"
                  />
                  <span className="text-[10px] text-neutral-500">Recommended Theory: 30, Lab: 50</span>
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-neutral-500 flex items-center gap-1">
                  <Settings size={10} />
                  <span>External Max Marks</span>
                </label>
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="200"
                    value={externalMax}
                    onChange={(e) => setExternalMax(e.target.value)}
                    className="w-24 bg-neutral-950 border border-neutral-850 rounded px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-neutral-700"
                  />
                  <span className="text-[10px] text-neutral-500">Recommended Theory: 70, Lab: 50</span>
                </div>
              </div>
            </div>
          </div>

          {/* Roster form sheet */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              {loadingRoster ? (
                <div className="text-center py-16 text-neutral-500">
                  <Loader2 className="animate-spin text-blue-500 mx-auto mb-2" size={24} />
                  <span className="font-mono text-xs">Pulling class roster from database...</span>
                </div>
              ) : filteredRecords.length > 0 ? (
                filteredRecords.map((student) => {
                  const isPublished = student.publicationStatus === "Published";
                  
                  return (
                    <div 
                      key={student.studentId}
                      className={`glass-card border rounded-xl p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4 transition ${
                        isPublished 
                          ? "border-neutral-900 bg-neutral-950/20" 
                          : "border-neutral-800 hover:border-neutral-700"
                      }`}
                    >
                      {/* Left: Info */}
                      <div className="flex items-center gap-3 min-w-[240px]">
                        <div className="w-9 h-9 rounded-full bg-neutral-900 border border-neutral-850 flex items-center justify-center font-bold text-blue-400 shrink-0">
                          {student.fullName.charAt(0)}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-white leading-tight">{student.fullName}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] text-neutral-500 font-mono">Roll: {student.rollNumber}</span>
                            <span className="text-neutral-700">•</span>
                            {isPublished ? (
                              <span className="flex items-center gap-0.5 text-[8px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-1">
                                <Lock size={8} /> Published
                              </span>
                            ) : student.publicationStatus === "Draft" ? (
                              <span className="flex items-center gap-0.5 text-[8px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded px-1">
                                <Unlock size={8} /> Draft Saved
                              </span>
                            ) : (
                              <span className="text-[8px] text-neutral-600 italic">No entry</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Inputs Grid */}
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end sm:items-center">
                        {/* Internal Marks Input */}
                        <div>
                          <label className="text-[9px] text-neutral-500 uppercase font-bold block sm:hidden">Internal Marks</label>
                          <div className="flex items-center gap-1.5 mt-1 sm:mt-0">
                            <input
                              type="number"
                              disabled={isPublished}
                              value={student.internalMarks}
                              min="0"
                              max={internalMax}
                              onChange={(e) =>
                                handleRecordChange(student.studentId, "internalMarks", e.target.value)
                              }
                              className="w-16 bg-neutral-950 border border-neutral-850 disabled:bg-neutral-900 disabled:text-neutral-600 rounded px-2 py-1 text-xs text-white font-mono text-center focus:outline-none focus:border-neutral-700"
                            />
                            <span className="text-[10px] text-neutral-600">/ {internalMax}</span>
                          </div>
                        </div>

                        {/* External Marks Input */}
                        <div>
                          <label className="text-[9px] text-neutral-500 uppercase font-bold block sm:hidden">External Marks</label>
                          <div className="flex items-center gap-1.5 mt-1 sm:mt-0">
                            <input
                              type="number"
                              disabled={isPublished || student.isAbsent}
                              value={student.externalMarks}
                              min="0"
                              max={externalMax}
                              onChange={(e) =>
                                handleRecordChange(student.studentId, "externalMarks", e.target.value)
                              }
                              className="w-16 bg-neutral-950 border border-neutral-850 disabled:bg-neutral-900 disabled:text-neutral-600 rounded px-2 py-1 text-xs text-white font-mono text-center focus:outline-none focus:border-neutral-700"
                            />
                            <span className="text-[10px] text-neutral-600">/ {externalMax}</span>
                          </div>
                        </div>

                        {/* Absent Toggle */}
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`absent-${student.studentId}`}
                            disabled={isPublished}
                            checked={student.isAbsent}
                            onChange={(e) =>
                              handleRecordChange(student.studentId, "isAbsent", e.target.checked)
                            }
                            className="bg-neutral-950 border border-neutral-850 rounded text-blue-600 focus:ring-0 focus:ring-offset-0 disabled:opacity-40"
                          />
                          <label
                            htmlFor={`absent-${student.studentId}`}
                            className={`text-xs select-none cursor-pointer ${
                              student.isAbsent ? "text-amber-500 font-bold" : "text-neutral-400"
                            } ${isPublished ? "pointer-events-none opacity-40" : ""}`}
                          >
                            Mark Absent
                          </label>
                        </div>

                        {/* Remarks */}
                        <div>
                          <input
                            type="text"
                            placeholder="Add remarks..."
                            disabled={isPublished}
                            value={student.remarks}
                            onChange={(e) =>
                              handleRecordChange(student.studentId, "remarks", e.target.value)
                            }
                            className="w-full bg-neutral-950 border border-neutral-850 disabled:bg-neutral-900 disabled:text-neutral-600 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-neutral-700 placeholder-neutral-700"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-12 text-center glass-card border border-neutral-800 text-neutral-500 font-mono text-xs">
                  {searchTerm
                    ? "No students match your query."
                    : "No students registered in workload section. Verify assignment details."}
                </div>
              )}
            </div>

            {/* Submission / Bottom Bar */}
            {records.length > 0 && (
              <div className="glass-card border border-neutral-850 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 bg-neutral-950/60 sticky bottom-20 lg:bottom-4 z-15 shadow-2xl">
                <div className="text-xs text-neutral-400">
                  Total Students: <strong className="text-white font-mono">{stats.total}</strong> • 
                  Draft: <strong className="text-blue-400 font-mono">{stats.draft}</strong> • 
                  Published: <strong className="text-emerald-400 font-mono">{stats.published}</strong> • 
                  Absent: <strong className="text-amber-500 font-mono">{stats.absents}</strong>
                </div>

                {stats.published === stats.total ? (
                  <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-1.5 font-semibold bg-emerald-500/5 border border-emerald-500/10 rounded p-2">
                    <Lock size={12} />
                    <span>All marks for this section are published and locked.</span>
                  </div>
                ) : (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full sm:w-auto px-6 py-2.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold text-xs shadow-lg shadow-blue-600/25 cursor-pointer disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5"
                  >
                    {submitting ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Save size={12} />
                    )}
                    <span>Save Marks Session</span>
                  </button>
                )}
              </div>
            )}
          </form>
        </div>

        {/* Sidebar Info (Right 25%) */}
        <div className="w-full lg:w-80 space-y-4 shrink-0">
          <div className="glass-card border border-neutral-800 rounded-xl p-4 space-y-3">
            <h3 className="font-display font-bold text-white text-sm flex items-center gap-1.5">
              <Info size={14} className="text-blue-400" />
              <span>Marks Policy Guide</span>
            </h3>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              Standard institutions configure different grids for evaluation:
            </p>
            <ul className="text-[11px] text-neutral-400 space-y-1.5 list-disc list-inside">
              <li>
                <strong className="text-white">Theory subjects</strong>: Usually 30 marks internal and 70 marks external.
              </li>
              <li>
                <strong className="text-white">Lab evaluations</strong>: Usually 50 marks internal and 50 marks external.
              </li>
              <li>
                Exceeded marks are rejected automatically by the database API schema.
              </li>
              <li>
                Checking <strong className="text-amber-500">Absent</strong> sets the external obtained marks to 0 and tags the student status accordingly.
              </li>
            </ul>
          </div>

          {stats.published > 0 && (
            <div className="glass-card border border-neutral-800 rounded-xl p-4 bg-amber-500/5 border-amber-500/10 text-amber-500 space-y-2">
              <h4 className="text-xs font-bold flex items-center gap-1">
                <AlertTriangle size={13} />
                <span>Partial Locks Active</span>
              </h4>
              <p className="text-[10px] text-neutral-400 leading-normal">
                {stats.published} student records are locked because they have already been published by the academic administrator desk.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
