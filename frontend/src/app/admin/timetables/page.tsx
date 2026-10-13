"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import type { CreateTimetableInput } from "@/types/timetable";
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  FileText,
  Printer,
  ChevronDown,
  Save,
  Check,
  ArrowRight,
  Info,
  User,
  BookOpen
} from "lucide-react";

interface Department {
  id: string;
  name: string;
  code: string;
}

interface Subject {
  id: string;
  code: string;
  name: string;
  abbreviation: string | null;
}

interface Faculty {
  id: string;
  fullName: string;
  employeeNumber: string;
  isAllocated?: boolean;
}

interface TeachingAssignment {
  id: string;
  facultyId: string;
  subjectId: string;
  section: string;
  academicYear: string;
}

interface TimetableSlot {
  id?: string;
  startTime: string;
  endTime: string;
  slotType: "TEACHING" | "BREAK" | "LUNCH";
  sequenceOrder: number;
}

interface TimetableEntry {
  id?: string;
  dayOfWeek: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";
  subjectId: string;
  subjectCode?: string;
  subjectName?: string;
  subjectAbbreviation?: string | null;
  classType: "Theory" | "Lab" | "Project" | "Elective" | "Tutorial" | "Other";
  slotSequenceOrders: number[];
  facultyIds: string[];
  faculties?: Array<{ id: string; fullName: string }>;
}

interface ValidationError {
  type: "error" | "warning";
  code: string;
  message: string;
  meta?: any;
}

export default function AdminTimetables() {
  const { accessToken } = useAuth();

  // Academic Context Selection
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState("");
  const [selectedYear, setSelectedYear] = useState<"I" | "II" | "III" | "IV">("I");
  const [selectedSemester, setSelectedSemester] = useState(1);
  const [selectedSection, setSelectedSection] = useState("A");
  const [academicYear, setAcademicYear] = useState("2023-2024");

  // Loaders & Errors
  const [deptsLoading, setDeptsLoading] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [teachingAssignments, setTeachingAssignments] = useState<TeachingAssignment[]>([]);

  // Active Timetable State
  const [activeTimetable, setActiveTimetable] = useState<any | null>(null);
  const [ttLoading, setTtLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  // Builder configuration states
  const [roomNumber, setRoomNumber] = useState("");
  const [workingDays, setWorkingDays] = useState<string[]>(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]);
  const [slots, setSlots] = useState<TimetableSlot[]>([
    { startTime: "09:00:00", endTime: "10:00:00", slotType: "TEACHING", sequenceOrder: 1 },
    { startTime: "10:00:00", endTime: "11:00:00", slotType: "TEACHING", sequenceOrder: 2 },
    { startTime: "11:00:00", endTime: "11:10:00", slotType: "BREAK", sequenceOrder: 3 },
    { startTime: "11:10:00", endTime: "12:10:00", slotType: "TEACHING", sequenceOrder: 4 },
    { startTime: "12:10:00", endTime: "13:10:00", slotType: "TEACHING", sequenceOrder: 5 },
    { startTime: "13:10:00", endTime: "13:55:00", slotType: "LUNCH", sequenceOrder: 6 },
    { startTime: "13:55:00", endTime: "14:55:00", slotType: "TEACHING", sequenceOrder: 7 },
    { startTime: "14:55:00", endTime: "15:55:00", slotType: "TEACHING", sequenceOrder: 8 },
  ]);
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [effectiveFrom, setEffectiveFrom] = useState("");

  const [isConfiguringTimings, setIsConfiguringTimings] = useState(false);
  const [tempSlots, setTempSlots] = useState<TimetableSlot[]>([]);
  const [timingErrors, setTimingErrors] = useState<string[]>([]);

  const DEFAULT_TIMINGS: TimetableSlot[] = [
    { startTime: "09:00:00", endTime: "10:00:00", slotType: "TEACHING", sequenceOrder: 1 },
    { startTime: "10:00:00", endTime: "11:00:00", slotType: "TEACHING", sequenceOrder: 2 },
    { startTime: "11:00:00", endTime: "11:10:00", slotType: "BREAK", sequenceOrder: 3 },
    { startTime: "11:10:00", endTime: "12:10:00", slotType: "TEACHING", sequenceOrder: 4 },
    { startTime: "12:10:00", endTime: "13:10:00", slotType: "TEACHING", sequenceOrder: 5 },
    { startTime: "13:10:00", endTime: "13:55:00", slotType: "LUNCH", sequenceOrder: 6 },
    { startTime: "13:55:00", endTime: "14:55:00", slotType: "TEACHING", sequenceOrder: 7 },
    { startTime: "14:55:00", endTime: "15:55:00", slotType: "TEACHING", sequenceOrder: 8 },
  ];

  const handleApplyTimings = () => {
    const errors: string[] = [];
    const sorted = [...tempSlots].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
    
    for (const slot of sorted) {
      const start = slot.startTime.slice(0, 5);
      const end = slot.endTime.slice(0, 5);
      if (start >= end) {
        const label = slot.slotType === "TEACHING" ? `Period ${slot.sequenceOrder}` : slot.slotType;
        errors.push(`${label}: End time (${end}) must be after start time (${start})`);
      }
    }
    
    const rangesOverlapStr = (s1Start: string, s1End: string, s2Start: string, s2End: string) => {
      const start1 = s1Start.slice(0, 5);
      const end1 = s1End.slice(0, 5);
      const start2 = s2Start.slice(0, 5);
      const end2 = s2End.slice(0, 5);
      return start1 < end2 && start2 < end1;
    };
    
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        if (rangesOverlapStr(sorted[i].startTime, sorted[i].endTime, sorted[j].startTime, sorted[j].endTime)) {
          const label1 = sorted[i].slotType === "TEACHING" ? `Period ${sorted[i].sequenceOrder}` : sorted[i].slotType;
          const label2 = sorted[j].slotType === "TEACHING" ? `Period ${sorted[j].sequenceOrder}` : sorted[j].slotType;
          errors.push(`Overlap detected: ${label1} (${sorted[i].startTime.slice(0, 5)}-${sorted[i].endTime.slice(0, 5)}) overlaps with ${label2} (${sorted[j].startTime.slice(0, 5)}-${sorted[j].endTime.slice(0, 5)})`);
        }
      }
    }
    
    if (errors.length > 0) {
      setTimingErrors(errors);
      return;
    }
    
    setSlots(sorted);
    setIsConfiguringTimings(false);
    showToast("Timetable slot timings applied! Remember to save draft.", "success");
  };

  const handleResetTimings = () => {
    setTempSlots(JSON.parse(JSON.stringify(DEFAULT_TIMINGS)));
    setTimingErrors([]);
  };

  // Validation Results
  const [validationResults, setValidationResults] = useState<ValidationError[]>([]);
  const [validatedSuccessfully, setValidatedSuccessfully] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  // Assign Popover State
  const [editingCell, setEditingCell] = useState<{ day: string; seq: number } | null>(null);
  const [assignSubjectId, setAssignSubjectId] = useState("");
  const [assignClassType, setAssignClassType] = useState<any>("Theory");
  const [assignFacultyIds, setAssignFacultyIds] = useState<string[]>([]);
  const [mergeCount, setMergeCount] = useState(1);

  // Toast / Status Message
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "warning" } | null>(null);
  const showToast = (message: string, type: "success" | "error" | "warning" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  // 1. Fetch departments and global data
  useEffect(() => {
    if (!accessToken) return;
    const loadGlobals = async () => {
      setDeptsLoading(true);
      try {
        const deptRes = await apiFetch("/departments", {}, accessToken);
        if (deptRes.success && deptRes.data?.departments) {
          const depts = deptRes.data.departments;
          setDepartments(depts);
          if (depts.length > 0) {
            setSelectedDeptId(depts[0].id);
          }
        }
        const facRes = await apiFetch("/faculty?limit=200", {}, accessToken);
        if (facRes.success && facRes.data?.faculty) {
          setFaculties(facRes.data.faculty);
        }
      } catch (err: any) {
        showToast(err.message || "Failed to load core filters", "error");
      } finally {
        setDeptsLoading(false);
      }
    };
    loadGlobals();
  }, [accessToken]);

  // 2. Fetch context-specific details (subjects, assignments, and check existing timetable)
  const fetchContextData = useCallback(async () => {
    if (!accessToken || !selectedDeptId) return;
    setTtLoading(true);
    setValidationResults([]);
    setValidatedSuccessfully(false);
    try {
      // Fetch subjects mapped to this context
      const subRes = await apiFetch(
        `/subjects?limit=200&departmentId=${selectedDeptId}&semester=${selectedSemester}`,
        {},
        accessToken
      );
      if (subRes.success && subRes.data?.subjects) {
        setSubjects(subRes.data.subjects);
      }

      // Fetch teaching assignments
      const assignRes = await apiFetch(
        `/teaching-assignments?academicYear=${academicYear}&section=${selectedSection}`,
        {},
        accessToken
      );
      if (assignRes.success && assignRes.data) {
        setTeachingAssignments(assignRes.data);
      }

      // Check existing timetable
      const ttListRes = await apiFetch(
        `/timetables?academicYear=${academicYear}&departmentId=${selectedDeptId}&year=${selectedYear}&semester=${selectedSemester}&section=${selectedSection}`,
        {},
        accessToken
      );
      if (ttListRes.success && ttListRes.data && ttListRes.data.length > 0) {
        // Load the latest version
        const latest = ttListRes.data[0];
        const detailRes = await apiFetch(`/timetables/${latest.id}`, {}, accessToken);
        if (detailRes.success && detailRes.data) {
          const tt = detailRes.data;
          setActiveTimetable(tt);
          setRoomNumber(tt.roomNumber || "");
          setWorkingDays(tt.workingDays || []);
          setSlots(tt.slots || []);
          setEffectiveFrom(tt.effectiveFrom || "");
          setEntries(
            tt.entries.map((e: any) => ({
              id: e.id,
              dayOfWeek: e.dayOfWeek,
              subjectId: e.subjectId,
              subjectCode: e.subjectCode,
              subjectName: e.subjectName,
              subjectAbbreviation: e.subjectAbbreviation,
              classType: e.classType,
              slotSequenceOrders: e.slots.map((s: any) => s.sequenceOrder),
              facultyIds: e.faculties.map((f: any) => f.id),
              faculties: e.faculties,
            }))
          );
          showToast("Existing timetable loaded successfully!");
        }
      } else {
        // No timetable found, reset to template state
        setActiveTimetable(null);
        setEntries([]);
        setRoomNumber("");
        setEffectiveFrom("");
        setSlots(DEFAULT_TIMINGS);
        showToast("No active timetable found for this context. You can build a new one below.", "warning");
      }
    } catch (err: any) {
      showToast(err.message || "Error fetching timetable context details", "error");
    } finally {
      setTtLoading(false);
    }
  }, [accessToken, selectedDeptId, selectedYear, selectedSemester, selectedSection, academicYear]);

  useEffect(() => {
    fetchContextData();
  }, [selectedDeptId, selectedYear, selectedSemester, selectedSection, academicYear, fetchContextData]);

  // Subjects dropdown helper
  const subjectOptions = useMemo(() => {
    return subjects.map((s) => ({
      id: s.id,
      label: `${s.abbreviation || s.code} - ${s.name}`,
      abbreviation: s.abbreviation || s.code,
    }));
  }, [subjects]);

  // Faculty mapping helper based on selected subject and allocations
  const filteredFacultyOptions = useMemo(() => {
    if (!assignSubjectId) return faculties;
    // Find faculty officially allocated via teaching assignments first
    const allocatedFacIds = teachingAssignments
      .filter((ta) => ta.subjectId === assignSubjectId)
      .map((ta) => ta.facultyId);
    
    // Sort faculties to put allocated ones first, with a star prefix or info
    return faculties.map((f) => ({
      ...f,
      isAllocated: allocatedFacIds.includes(f.id),
    })).sort((a, b) => (b.isAllocated ? 1 : 0) - (a.isAllocated ? 1 : 0));
  }, [assignSubjectId, faculties, teachingAssignments]);

  // Grid builder cells helper
  const gridMap = useMemo(() => {
    const map: Record<string, Record<number, { entry: TimetableEntry; isMergedChild: boolean }>> = {};
    workingDays.forEach((day) => {
      map[day] = {};
    });

    entries.forEach((entry) => {
      if (!map[entry.dayOfWeek]) return;
      const sortedSeqs = [...entry.slotSequenceOrders].sort((a, b) => a - b);
      sortedSeqs.forEach((seq, idx) => {
        map[entry.dayOfWeek][seq] = {
          entry,
          isMergedChild: idx > 0,
        };
      });
    });

    return map;
  }, [entries, workingDays]);

  // Click handler on slot cell
  const handleCellClick = (day: string, seq: number) => {
    // If it's a break or lunch slot, ignore
    const slot = slots.find((s) => s.sequenceOrder === seq);
    if (slot?.slotType !== "TEACHING") return;

    // Check if slot has an entry
    const existing = gridMap[day]?.[seq];
    if (existing) {
      if (existing.isMergedChild) return; // click parent cell
      const entry = existing.entry;
      setEditingCell({ day, seq });
      setAssignSubjectId(entry.subjectId);
      setAssignClassType(entry.classType);
      setAssignFacultyIds(entry.facultyIds);
      setMergeCount(entry.slotSequenceOrders.length);
    } else {
      setEditingCell({ day, seq });
      setAssignSubjectId("");
      setAssignClassType("Theory");
      setAssignFacultyIds([]);
      setMergeCount(1);
    }
  };

  // Save the class assignment
  const saveAssignment = () => {
    if (!editingCell || !assignSubjectId) return;

    const { day, seq } = editingCell;

    // Determine slots to be occupied
    const slotSeqs: number[] = [];
    let currentSeq = seq;
    for (let i = 0; i < mergeCount; i++) {
      const targetSlot = slots.find((s) => s.sequenceOrder === currentSeq);
      if (targetSlot && targetSlot.slotType === "TEACHING") {
        slotSeqs.push(currentSeq);
      }
      currentSeq++;
    }

    // Check if slotSeqs collide with existing entries (excluding the one being edited)
    const collisions = entries.filter((e) => {
      if (e.dayOfWeek !== day) return false;
      // Skip current cell
      const currentCellEntry = gridMap[day]?.[seq]?.entry;
      if (currentCellEntry && e === currentCellEntry) return false;

      return e.slotSequenceOrders.some((s) => slotSeqs.includes(s));
    });

    if (collisions.length > 0) {
      showToast("Cannot merge slots: overlaps with existing classes. Clear them first.", "error");
      return;
    }

    // Resolve subject code and name for local state display
    const selectedSub = subjects.find((s) => s.id === assignSubjectId);
    const resolvedFacs = faculties.filter((f) => assignFacultyIds.includes(f.id));

    const newEntry: TimetableEntry = {
      dayOfWeek: day as any,
      subjectId: assignSubjectId,
      subjectCode: selectedSub?.code,
      subjectName: selectedSub?.name,
      subjectAbbreviation: selectedSub?.abbreviation || selectedSub?.code,
      classType: assignClassType,
      slotSequenceOrders: slotSeqs,
      facultyIds: assignFacultyIds,
      faculties: resolvedFacs.map((f) => ({ id: f.id, fullName: f.fullName })),
    };

    // Remove old entry from same cell if present
    let updated = entries.filter((e) => {
      const match = e.dayOfWeek === day && e.slotSequenceOrders.includes(seq);
      return !match;
    });

    updated.push(newEntry);
    setEntries(updated);
    setEditingCell(null);
    setValidatedSuccessfully(false);
  };

  // Clear class assignment
  const clearCell = (day: string, seq: number) => {
    const entry = gridMap[day]?.[seq]?.entry;
    if (!entry) return;

    setEntries(entries.filter((e) => e !== entry));
    setEditingCell(null);
    setValidatedSuccessfully(false);
  };

  // Run database checks
  const runValidation = async () => {
    setIsValidating(true);
    setValidationResults([]);
    setValidatedSuccessfully(false);

    const payload: CreateTimetableInput = {
      academicYear,
      departmentId: selectedDeptId,
      year: selectedYear,
      semester: selectedSemester,
      section: selectedSection,
      roomNumber,
      workingDays,
      slots: slots.map((s) => ({
        startTime: s.startTime,
        endTime: s.endTime,
        slotType: s.slotType,
        sequenceOrder: s.sequenceOrder,
      })),
      entries: entries.map((e) => ({
        dayOfWeek: e.dayOfWeek,
        subjectId: e.subjectId,
        classType: e.classType,
        slotSequenceOrders: e.slotSequenceOrders,
        facultyIds: e.facultyIds,
      })),
      effectiveFrom: effectiveFrom || null,
    };

    try {
      const url = activeTimetable
        ? `/timetables/validate-input?excludeId=${activeTimetable.id}`
        : "/timetables/validate-input";
      const res = await apiFetch(url, {
        method: "POST",
        body: JSON.stringify(payload),
      }, accessToken);

      if (res.success && Array.isArray(res.data)) {
        setValidationResults(res.data);
        if (res.data.filter((e: any) => e.type === "error").length === 0) {
          setValidatedSuccessfully(true);
          showToast("Timetable passed all conflict checks!", "success");
        } else {
          showToast("Conflict errors detected in this timetable layout.", "error");
        }
      }
    } catch (err: any) {
      showToast(err.message || "Failed to validate timetable layout", "error");
    } finally {
      setIsValidating(false);
    }
  };

  // Save changes as Draft
  const saveDraft = async () => {
    setSaveLoading(true);
    const payload = {
      roomNumber,
      workingDays,
      slots: slots.map((s) => ({
        startTime: s.startTime,
        endTime: s.endTime,
        slotType: s.slotType,
        sequenceOrder: s.sequenceOrder,
      })),
      entries: entries.map((e) => ({
        dayOfWeek: e.dayOfWeek,
        subjectId: e.subjectId,
        classType: e.classType,
        slotSequenceOrders: e.slotSequenceOrders,
        facultyIds: e.facultyIds,
      })),
      effectiveFrom: effectiveFrom || null,
    };

    try {
      if (activeTimetable) {
        // Update draft or create version
        const res = await apiFetch(`/timetables/${activeTimetable.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        }, accessToken);
        if (res.success) {
          showToast("Timetable updated successfully!");
          fetchContextData();
        }
      } else {
        // Create new
        const createPayload = {
          academicYear,
          departmentId: selectedDeptId,
          year: selectedYear,
          semester: selectedSemester,
          section: selectedSection,
          ...payload,
        };
        const res = await apiFetch("/timetables", {
          method: "POST",
          body: JSON.stringify(createPayload),
        }, accessToken);
        if (res.success) {
          showToast("Draft saved successfully!");
          fetchContextData();
        }
      }
    } catch (err: any) {
      showToast(err.message || "Failed to save timetable", "error");
    } finally {
      setSaveLoading(false);
    }
  };

  // Publish timetable
  const publishTimetable = async () => {
    if (!activeTimetable) return;
    if (!effectiveFrom) {
      showToast("Please supply an 'Effective From' date to publish.", "error");
      return;
    }

    setSaveLoading(true);
    try {
      const res = await apiFetch(`/timetables/${activeTimetable.id}/publish`, {
        method: "POST",
        body: JSON.stringify({ effectiveFrom }),
      }, accessToken);
      if (res.success) {
        showToast("Timetable published successfully! It is now live for students and faculty.");
        fetchContextData();
      }
    } catch (err: any) {
      showToast(err.message || "Publish failed. Double-check for conflicts.", "error");
    } finally {
      setSaveLoading(false);
    }
  };

  // Trigger browser print
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 z-50 p-4 rounded-xl shadow-2xl flex items-center gap-3 border animate-in fade-in slide-in-from-bottom-5 duration-300 ${
            toast.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : toast.type === "error"
              ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
              : "bg-amber-500/10 border-amber-500/30 text-amber-400"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertTriangle className="w-5 h-5" />
          )}
          <span className="font-medium text-sm text-slate-800 dark:text-slate-100">{toast.message}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5 no-print">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <Calendar className="w-8 h-8 text-sky-500" />
            Timetable Work Desk
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Build, validate, version and publish academic timetables. Overlap and conflict checks are performed in real-time.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setTempSlots(JSON.parse(JSON.stringify(slots)));
              setTimingErrors([]);
              setIsConfiguringTimings(true);
            }}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-semibold flex items-center gap-2 border border-slate-200 dark:border-slate-700 transition"
          >
            <Clock className="w-4 h-4 text-sky-500" /> Configure Timings
          </button>
          <button
            onClick={handlePrint}
            disabled={!activeTimetable}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-semibold flex items-center gap-2 border border-slate-200 dark:border-slate-700 transition"
          >
            <Printer className="w-4 h-4" /> Print / PDF
          </button>
          <button
            onClick={runValidation}
            disabled={entries.length === 0 || isValidating}
            className="px-4 py-2 bg-sky-550 hover:bg-sky-600 dark:bg-sky-600 dark:hover:bg-sky-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition"
          >
            {isValidating ? "Checking..." : "Verify Layout"}
          </button>
          <button
            onClick={saveDraft}
            disabled={saveLoading}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-950 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 rounded-lg text-sm font-semibold flex items-center gap-2 transition"
          >
            <Save className="w-4 h-4" /> Save Draft
          </button>
        </div>
      </div>

      {/* Filter Options */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 p-5 rounded-xl shadow-sm space-y-4 no-print">
        <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-indigo-500" /> Academic Context Filters
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Academic Year
            </label>
            <input
              type="text"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-750 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Department
            </label>
            <select
              value={selectedDeptId}
              onChange={(e) => setSelectedDeptId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-750 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              {deptsLoading ? (
                <option>Loading...</option>
              ) : (
                departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} - {d.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Year Group
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value as any)}
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-750 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="I">I Year</option>
              <option value="II">II Year</option>
              <option value="III">III Year</option>
              <option value="IV">IV Year</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Semester
            </label>
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(Number(e.target.value))}
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-750 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                <option key={s} value={s}>
                  Sem {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Section
            </label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-750 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              {["A", "B", "C", "D"].map((sec) => (
                <option key={sec} value={sec}>
                  Section {sec}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Room Number
            </label>
            <input
              type="text"
              placeholder="e.g. IB-317"
              value={roomNumber}
              onChange={(e) => setRoomNumber(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-750 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>
      </div>

      {/* Validations Drawer/Widget */}
      {validationResults.length > 0 && (
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-xl space-y-3 no-print animate-in slide-in-from-top-4 duration-300">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" /> Conflict Checking Analysis
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {validationResults.map((err, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg border text-sm flex gap-3 ${
                  err.type === "error"
                    ? "bg-rose-50 border-rose-100 text-rose-800 dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400"
                    : "bg-amber-50 border-amber-100 text-amber-800 dark:bg-amber-950/20 dark:border-amber-900/30 dark:text-amber-400"
                }`}
              >
                <span
                  className={`px-2 py-0.5 rounded text-xs font-bold uppercase h-fit ${
                    err.type === "error" ? "bg-rose-250 text-white" : "bg-amber-250 text-white"
                  }`}
                >
                  {err.type}
                </span>
                <p className="font-medium">{err.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Effective From / Publish Controls */}
      {activeTimetable && (
        <div className="bg-indigo-50/50 dark:bg-slate-900 border border-indigo-100 dark:border-slate-800 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3">
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                activeTimetable.status === "published"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/25 dark:text-emerald-400"
                  : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {activeTimetable.status}
            </span>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Active Layout: Version {activeTimetable.version}
            </span>
            {activeTimetable.effectiveFrom && (
              <span className="text-xs text-slate-500">
                (Effective from {new Date(activeTimetable.effectiveFrom).toLocaleDateString()})
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Effective From:
              </label>
              <input
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <button
              onClick={publishTimetable}
              disabled={!validatedSuccessfully || !effectiveFrom || saveLoading}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold text-white transition ${
                validatedSuccessfully && effectiveFrom
                  ? "bg-emerald-555 hover:bg-emerald-600"
                  : "bg-slate-300 dark:bg-slate-800 text-slate-500 dark:text-slate-600 cursor-not-allowed"
              }`}
            >
              Publish Layout
            </button>
          </div>
        </div>
      )}

      {/* Main Timetable Builder Workspace */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-2xl shadow-sm overflow-hidden p-6 relative">
        {/* Printable timetable layout header */}
        <div className="print-only hidden text-center mb-6 border-b pb-4">
          <h2 className="text-2xl font-bold uppercase tracking-wide">
            {departments.find((d) => d.id === selectedDeptId)?.name} Department
          </h2>
          <h3 className="text-lg font-bold text-slate-700 mt-1">
            Weekly Timetable — B.Tech {selectedYear} Year, Sem {selectedSemester} (Sec {selectedSection})
          </h3>
          <div className="flex justify-center gap-6 mt-2 text-sm text-slate-500">
            <span>Academic Year: {academicYear}</span>
            <span>Room No: {roomNumber || "N/A"}</span>
            {effectiveFrom && <span>w.e.f: {new Date(effectiveFrom).toLocaleDateString()}</span>}
          </div>
        </div>

        {/* Timetable Interactive Grid */}
        {ttLoading ? (
          <div className="h-96 flex flex-col items-center justify-center gap-3">
            <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></span>
            <p className="text-sm font-semibold text-slate-500">Loading timetable grid layout...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-slate-200 dark:border-slate-800 text-center text-sm min-w-[900px] timetable-grid">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50">
                  <th className="border border-slate-200 dark:border-slate-800 p-3 font-extrabold text-slate-700 dark:text-slate-300 w-24">
                    Day / Slot
                  </th>
                  {slots.map((slot) => (
                    <th
                      key={slot.sequenceOrder}
                      className="border border-slate-200 dark:border-slate-800 p-3 font-extrabold text-slate-700 dark:text-slate-300"
                    >
                      <div className="flex flex-col items-center">
                        <span className="text-xs uppercase tracking-wider text-slate-400">Period {slot.sequenceOrder}</span>
                        <span className="text-sm font-bold mt-0.5">
                          {slot.startTime.slice(0, 5)} - {slot.endTime.slice(0, 5)}
                        </span>
                        {slot.slotType !== "TEACHING" && (
                          <span className="mt-1 text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-400 font-extrabold">
                            {slot.slotType}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {workingDays.map((day) => (
                  <tr key={day} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/10">
                    <td className="border border-slate-200 dark:border-slate-800 p-4 font-bold text-slate-700 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-800/20">
                      {day}
                    </td>
                    {slots.map((slot) => {
                      const state = gridMap[day]?.[slot.sequenceOrder];
                      if (state?.isMergedChild) return null; // skipped cell due to colspan merge

                      const isTeaching = slot.slotType === "TEACHING";

                      if (!isTeaching) {
                        return (
                          <td
                            key={slot.sequenceOrder}
                            className="border border-slate-200 dark:border-slate-800 p-3 bg-slate-100/50 dark:bg-slate-850/40 text-slate-400 font-extrabold select-none italic text-xs tracking-wider"
                          >
                            {slot.slotType}
                          </td>
                        );
                      }

                      const entry = state?.entry;
                      const colSpan = entry ? entry.slotSequenceOrders.length : 1;

                      return (
                        <td
                          key={slot.sequenceOrder}
                          colSpan={colSpan}
                          onClick={() => handleCellClick(day, slot.sequenceOrder)}
                          className={`border border-slate-200 dark:border-slate-800 p-3 transition relative group cursor-pointer duration-200 ${
                            entry
                              ? "bg-sky-50/40 hover:bg-sky-100/40 dark:bg-sky-950/20 dark:hover:bg-sky-950/30"
                              : "hover:bg-slate-50 dark:hover:bg-slate-800/20"
                          }`}
                        >
                          {entry ? (
                            <div className="flex flex-col items-center" title={entry.faculties && entry.faculties.length > 0 ? `Faculty: ${entry.faculties.map((f) => f.fullName).join(", ")}` : undefined}>
                              <span className="font-extrabold text-sky-700 dark:text-sky-400 text-sm tracking-wide">
                                {entry.subjectAbbreviation || entry.subjectCode}
                              </span>
                              <span className="text-[10px] text-slate-400 uppercase mt-0.5">
                                {entry.classType}
                              </span>
                              
                              {/* Clear cell button on hover */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  clearCell(day, slot.sequenceOrder);
                                }}
                                className="absolute top-1 right-1 p-1 bg-rose-500/90 text-white rounded opacity-0 group-hover:opacity-100 hover:bg-rose-600 transition duration-150 no-print"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-300 dark:text-slate-650 group-hover:text-slate-400 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition no-print font-bold">
                              <Plus className="w-3.5 h-3.5" /> Assign
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footnote details (Subject abbreviations/faculty mapping) */}
        {entries.length > 0 && (
          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4">
              Subject Faculty Allocations Footnote Mapping
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from(new Map(entries.map((e) => [e.subjectId, e])).values()).map((entry) => (
                <div
                  key={entry.subjectId}
                  className="p-3 bg-slate-50 dark:bg-slate-800/30 border border-slate-200/50 dark:border-slate-800/50 rounded-xl flex flex-col justify-between"
                >
                  <div>
                    <span className="inline-block px-2.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/30 text-indigo-650 dark:text-indigo-400 font-extrabold text-xs">
                      {entry.subjectAbbreviation || entry.subjectCode}
                    </span>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-2 truncate">
                      {entry.subjectName}
                    </h4>
                  </div>
                  <div className="mt-3 flex items-center gap-2 border-t border-slate-200/40 dark:border-slate-800/40 pt-2 text-xs text-slate-500 dark:text-slate-400">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-semibold truncate">
                      {entry.faculties?.map((f) => f.fullName).join(", ") || "No Faculty assigned"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Editing Assign Cell Modal */}
      {editingCell && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 relative animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-sky-500" />
              Configure Period ({editingCell.day})
            </h3>
            
            <div className="space-y-4">
              {/* Subject */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Select Subject
                </label>
                <select
                  value={assignSubjectId}
                  onChange={(e) => setAssignSubjectId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="">-- Choose Subject --</option>
                  {subjectOptions.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Class Type */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Session Type
                </label>
                <select
                  value={assignClassType}
                  onChange={(e) => setAssignClassType(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="Theory">Theory Lecture</option>
                  <option value="Lab">Laboratory Session (Lab)</option>
                  <option value="Project">Project Stage Session</option>
                  <option value="Elective">Elective Session</option>
                  <option value="Tutorial">Tutorial Session</option>
                  <option value="Other">Other Session</option>
                </select>
              </div>

              {/* Faculty selection */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Assign Faculty Member(s)
                </label>
                <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg p-2 space-y-1.5 bg-slate-50 dark:bg-slate-850">
                  {filteredFacultyOptions.map((fac) => {
                    const isChecked = assignFacultyIds.includes(fac.id);
                    return (
                      <label
                        key={fac.id}
                        className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition select-none ${
                          isChecked
                            ? "bg-sky-500/10 text-sky-700 dark:text-sky-400 font-semibold"
                            : "hover:bg-slate-100/50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-350"
                        }`}
                      >
                        <div className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setAssignFacultyIds([...assignFacultyIds, fac.id]);
                              } else {
                                setAssignFacultyIds(assignFacultyIds.filter((id) => id !== fac.id));
                              }
                            }}
                            className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                          />
                          <span>{fac.fullName}</span>
                        </div>
                        {fac.isAllocated && (
                          <span className="text-[10px] bg-sky-200 text-sky-800 dark:bg-sky-900/50 dark:text-sky-400 px-2 py-0.5 rounded font-extrabold">
                            Allocated
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Merging periods */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Consecutive Merged Periods
                </label>
                <div className="flex items-center gap-3">
                  <select
                    value={mergeCount}
                    onChange={(e) => setMergeCount(Number(e.target.value))}
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    {[1, 2, 3, 4].map((n) => (
                      <option key={n} value={n}>
                        {n} period{n > 1 ? "s" : ""}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-slate-400">
                    Use 2-3 periods for Labs/Projects.
                  </span>
                </div>
              </div>
            </div>

            {/* Modal actions */}
            <div className="flex justify-end gap-3 mt-6 border-t dark:border-slate-850 pt-4">
              <button
                onClick={() => setEditingCell(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={saveAssignment}
                disabled={!assignSubjectId || assignFacultyIds.length === 0}
                className="px-4 py-2 bg-sky-500 hover:bg-sky-600 dark:bg-sky-600 dark:hover:bg-sky-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Block
              </button>
            </div>
          </div>
        </div>
      )}

      {isConfiguringTimings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 no-print">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative flex flex-col max-h-[90vh]">
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2 mb-2">
              <Clock className="w-6 h-6 text-sky-500" />
              Configure Timetable Slot Timings
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
              Update the start and end times for each period, break, and lunch slot. Overlapping slots are not allowed.
            </p>

            {timingErrors.length > 0 && (
              <div className="mb-4 p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-rose-700 dark:text-rose-400 rounded-xl space-y-1">
                <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-500" /> Please correct validation errors:
                </h4>
                <ul className="list-disc pl-5 text-xs space-y-1">
                  {timingErrors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex-1 overflow-y-auto pr-1 space-y-4">
              <div className="grid grid-cols-3 gap-4 border-b dark:border-slate-800 pb-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <div>Slot Description</div>
                <div>Start Time</div>
                <div>End Time</div>
              </div>

              {tempSlots.map((slot, idx) => {
                const label = slot.slotType === "TEACHING" ? `Period ${slot.sequenceOrder}` : slot.slotType;
                return (
                  <div key={slot.sequenceOrder} className="grid grid-cols-3 gap-4 items-center border-b border-slate-50 dark:border-slate-850/50 pb-3">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-350">
                      {label}
                    </span>
                    <input
                      type="time"
                      value={slot.startTime.slice(0, 5)}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) return;
                        const updated = [...tempSlots];
                        updated[idx] = { ...updated[idx], startTime: val + ":00" };
                        setTempSlots(updated);
                      }}
                      className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <input
                      type="time"
                      value={slot.endTime.slice(0, 5)}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) return;
                        const updated = [...tempSlots];
                        updated[idx] = { ...updated[idx], endTime: val + ":00" };
                        setTempSlots(updated);
                      }}
                      className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 mt-6 border-t dark:border-slate-850 pt-4">
              <button
                onClick={handleResetTimings}
                className="px-4 py-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" /> Reset to Default
              </button>
              <div className="flex gap-3 justify-end w-full sm:w-auto">
                <button
                  onClick={() => setIsConfiguringTimings(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyTimings}
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-600 dark:bg-sky-600 dark:hover:bg-sky-700 text-white rounded-lg text-sm font-bold transition shadow-sm"
                >
                  Apply Timings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
