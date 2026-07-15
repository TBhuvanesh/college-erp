"use client";

import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { createExamSession, Department, ExamRoom, SeatingPattern } from "@/lib/seating";

const EXAM_TYPES = ["Mid-1", "Mid-2", "Lab Exam", "Internal", "End Semester"];

interface SubjectSummary {
  id: string;
  code: string;
  name: string;
  departmentName: string;
  semester: number;
}

interface FacultySummary {
  id: string;
  fullName: string;
}

interface SessionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  departments: Department[];
  rooms: ExamRoom[];
  patterns: SeatingPattern[];
}

export function SessionFormModal({ isOpen, onClose, onSuccess, departments, rooms, patterns }: SessionFormModalProps) {
  const { accessToken } = useAuth();
  const [subjects, setSubjects] = useState<SubjectSummary[]>([]);
  const [faculty, setFaculty] = useState<FacultySummary[]>([]);

  const [name, setName] = useState("");
  const [examType, setExamType] = useState(EXAM_TYPES[0]);
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [semester, setSemester] = useState("1");
  const [sectionsText, setSectionsText] = useState("A");
  const [examDatesText, setExamDatesText] = useState("");
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [classroomIds, setClassroomIds] = useState<string[]>([]);
  const [invigilatorIds, setInvigilatorIds] = useState<string[]>([]);
  const [seatingPatternId, setSeatingPatternId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !accessToken) return;
    setName("");
    setExamType(EXAM_TYPES[0]);
    setDepartmentIds([]);
    setSemester("1");
    setSectionsText("A");
    setExamDatesText("");
    setSubjectIds([]);
    setClassroomIds([]);
    setInvigilatorIds([]);
    setSeatingPatternId("");
    setError(null);

    (async () => {
      try {
        const [subRes, facRes] = await Promise.all([
          apiFetch("/subjects?limit=200", {}, accessToken),
          apiFetch("/faculty?limit=200", {}, accessToken),
        ]);
        if (subRes.success && subRes.data?.subjects) setSubjects(subRes.data.subjects);
        if (facRes.success && facRes.data?.faculty) setFaculty(facRes.data.faculty);
      } catch {
        /* dropdown data is best-effort */
      }
    })();
  }, [isOpen, accessToken]);

  if (!isOpen) return null;

  const toggle = (arr: string[], setArr: (v: string[]) => void, id: string) => {
    setArr(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
  };

  const filteredSubjects = subjects.filter(
    (s) => s.semester === Number(semester) && (departmentIds.length === 0 || departments.some((d) => departmentIds.includes(d.id) && d.name === s.departmentName))
  );

  const handleSubmit = async () => {
    if (!accessToken) return;
    setSubmitting(true);
    setError(null);
    try {
      const sections = sectionsText.split(",").map((s) => s.trim()).filter(Boolean);
      const examDates = examDatesText.split(",").map((s) => s.trim()).filter(Boolean);
      await createExamSession(
        {
          name,
          examType,
          departmentIds,
          semester: Number(semester),
          sections,
          examDates,
          subjectIds,
          classroomIds,
          invigilatorIds,
          seatingPatternId: seatingPatternId || undefined,
        },
        accessToken
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create exam session.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "w-full bg-background border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-secondary focus:outline-none focus:border-border-hover";
  const chipListClass = "flex flex-wrap gap-1.5 max-h-[110px] overflow-y-auto custom-scrollbar p-2 border border-border-subtle rounded-xl bg-background";

  const chip = (id: string, label: string, active: boolean, onClick: () => void) => (
    <button
      key={id}
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors cursor-pointer ${
        active
          ? "bg-accent-blue text-white border-accent-blue"
          : "bg-surface text-text-secondary border-border-subtle hover:border-border-hover"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-border-subtle bg-surface shadow-xl p-5 space-y-4 max-h-[92vh] overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-sm text-text-primary">New Exam Session</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="text-[11px] text-red-600 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 space-y-1">
            <span className="text-[10px] font-bold text-text-muted uppercase">Session Name *</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="e.g. Mid-1 Examinations — Sem 3" />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-bold text-text-muted uppercase">Exam Type</span>
            <select value={examType} onChange={(e) => setExamType(e.target.value)} className={inputClass}>
              {EXAM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-bold text-text-muted uppercase">Semester</span>
            <input type="number" min={1} max={12} value={semester} onChange={(e) => setSemester(e.target.value)} className={inputClass} />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-bold text-text-muted uppercase">Sections (comma-separated)</span>
            <input value={sectionsText} onChange={(e) => setSectionsText(e.target.value)} className={inputClass} placeholder="A, B" />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-bold text-text-muted uppercase">Exam Dates (YYYY-MM-DD, comma-separated)</span>
            <input value={examDatesText} onChange={(e) => setExamDatesText(e.target.value)} className={inputClass} placeholder="2026-08-10, 2026-08-12" />
          </label>
        </div>

        <div className="space-y-1.5">
          <span className="text-[10px] font-bold text-text-muted uppercase">Departments *</span>
          <div className={chipListClass}>
            {departments.map((d) => chip(d.id, d.code, departmentIds.includes(d.id), () => toggle(departmentIds, setDepartmentIds, d.id)))}
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="text-[10px] font-bold text-text-muted uppercase">Subjects * (semester {semester})</span>
          <div className={chipListClass}>
            {filteredSubjects.length === 0 && <span className="text-[10px] text-text-muted p-1">No subjects match the selected semester/department.</span>}
            {filteredSubjects.map((s) => chip(s.id, s.code, subjectIds.includes(s.id), () => toggle(subjectIds, setSubjectIds, s.id)))}
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="text-[10px] font-bold text-text-muted uppercase">Classrooms</span>
          <div className={chipListClass}>
            {rooms.map((r) => chip(r.id, r.name, classroomIds.includes(r.id), () => toggle(classroomIds, setClassroomIds, r.id)))}
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="text-[10px] font-bold text-text-muted uppercase">Invigilators (optional — auto-balanced if omitted)</span>
          <div className={chipListClass}>
            {faculty.map((f) => chip(f.id, f.fullName, invigilatorIds.includes(f.id), () => toggle(invigilatorIds, setInvigilatorIds, f.id)))}
          </div>
        </div>

        <label className="space-y-1 block">
          <span className="text-[10px] font-bold text-text-muted uppercase">Seating Pattern</span>
          <select value={seatingPatternId} onChange={(e) => setSeatingPatternId(e.target.value)} className={inputClass}>
            <option value="">— Default (interleave by exam) —</option>
            {patterns.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-text-secondary hover:bg-surface-hover cursor-pointer">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !name || departmentIds.length === 0 || subjectIds.length === 0 || !sectionsText.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent-blue text-white text-xs font-bold hover:bg-blue-600 disabled:opacity-50 cursor-pointer"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Create Session
          </button>
        </div>
      </div>
    </div>
  );
}
