"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import {
  Loader2,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  Split,
  Merge,
  Sparkles,
  Search,
  Settings,
  RefreshCw,
  ArrowRight,
  Info,
  Award,
} from "lucide-react";
import * as m from "@/lib/mentorship";
import { listDepartments, type Department } from "@/lib/seating";

type Tab = "create" | "groups" | "workloads" | "settings";

interface StudentLite {
  id: string;
  rollNumber: string;
  fullName: string;
  section?: string;
  status: string;
}

export default function AdminMentorshipConsole() {
  const { accessToken, user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [activeTab, setActiveTab] = useState<Tab>("create");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [groups, setGroups] = useState<m.MentorGroup[]>([]);
  const [workloads, setWorkloads] = useState<m.MentorWorkload[]>([]);
  const [report, setReport] = useState<m.MentorshipReport | null>(null);
  const [settings, setSettings] = useState<m.MentorshipSettings | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastKind, setToastKind] = useState<"success" | "error">("success");

  const triggerToast = (msg: string, kind: "success" | "error" = "success") => {
    setToastMsg(msg);
    setToastKind(kind);
    setTimeout(() => setToastMsg(""), 4000);
  };

  // ── Create Group form state ────────────────────────────────────────────────
  const [formDeptId, setFormDeptId] = useState("");
  const [formSemester, setFormSemester] = useState<number>(1);
  const [formSection, setFormSection] = useState("");
  const [formMethod, setFormMethod] = useState<"range" | "recommended" | "manual">("range");
  const [formMentorId, setFormMentorId] = useState("");
  const [formRollStart, setFormRollStart] = useState("");
  const [formRollEnd, setFormRollEnd] = useState("");
  const [targetSize, setTargetSize] = useState<number>(25);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [studentSearch, setStudentSearch] = useState("");

  const [sections, setSections] = useState<string[]>([]);
  const [sectionRoster, setSectionRoster] = useState<StudentLite[]>([]);
  const [candidates, setCandidates] = useState<m.MentorCandidate[]>([]);
  const [proposals, setProposals] = useState<m.BalancedGroupsResult | null>(null);
  const [conflictResult, setConflictResult] = useState<m.MentorGroupConflictCheckResult | null>(null);
  const [checkingConflicts, setCheckingConflicts] = useState(false);

  const loadStatics = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [deptData, groupsData, workloadsData, reportData, settingsData] = await Promise.all([
        listDepartments(accessToken),
        m.listMentorGroups({}, accessToken),
        m.getMentorWorkloads(accessToken),
        m.getMentorshipReports(accessToken),
        m.getMentorshipSettings(accessToken),
      ]);
      setDepartments(deptData);
      setGroups(groupsData);
      setWorkloads(workloadsData);
      setReport(reportData);
      setSettings(settingsData);
      setTargetSize(settingsData.recommendedStudentsPerMentor);
    } catch (err: any) {
      triggerToast(err.message || "Failed to load mentorship data", "error");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadStatics();
  }, [loadStatics]);

  // ── Dependent cascade: Department -> Academic Session -> Sections ─────────
  useEffect(() => {
    if (!accessToken || !formDeptId) {
      setSections([]);
      return;
    }
    setFormSection("");
    m.listDistinctSections(formDeptId, formSemester, accessToken)
      .then(setSections)
      .catch(() => setSections([]));
  }, [accessToken, formDeptId, formSemester]);

  // Mentor candidates for the selected department (capacity-aware)
  useEffect(() => {
    if (!accessToken || !formDeptId) {
      setCandidates([]);
      return;
    }
    m.listMentorCandidates(formDeptId, accessToken)
      .then(setCandidates)
      .catch(() => setCandidates([]));
  }, [accessToken, formDeptId]);

  // Section roster (Student Synchronization) — active students in dept+semester,
  // filtered to the selected section client-side (no server-side section filter
  // exists on /students, matching the established fetch-then-filter convention).
  useEffect(() => {
    if (!accessToken || !formDeptId || !formSection) {
      setSectionRoster([]);
      return;
    }
    (async () => {
      const res = await apiFetch(
        `/students?departmentId=${formDeptId}&semester=${formSemester}&status=active&limit=1000`,
        {},
        accessToken
      );
      const list: StudentLite[] = (res.data?.students ?? []).filter((s: any) => s.section === formSection);
      setSectionRoster(list);
    })().catch(() => setSectionRoster([]));
  }, [accessToken, formDeptId, formSemester, formSection]);

  // Live preview: resolved roster for range/manual methods
  const resolvedForRange = useMemo(() => {
    if (formMethod !== "range" || !formRollStart || !formRollEnd) return [];
    return sectionRoster.filter((s) => s.rollNumber >= formRollStart && s.rollNumber <= formRollEnd).sort((a, b) => a.rollNumber.localeCompare(b.rollNumber));
  }, [sectionRoster, formMethod, formRollStart, formRollEnd]);

  const filteredManualRoster = useMemo(() => {
    const term = studentSearch.trim().toLowerCase();
    return sectionRoster.filter((s) => !term || s.rollNumber.toLowerCase().includes(term) || s.fullName.toLowerCase().includes(term));
  }, [sectionRoster, studentSearch]);

  const resetCreateForm = () => {
    setFormRollStart("");
    setFormRollEnd("");
    setFormMentorId("");
    setSelectedStudentIds(new Set());
    setProposals(null);
    setConflictResult(null);
  };

  // ── Conflict check before submit ───────────────────────────────────────────
  const buildPayload = (): m.CreateMentorGroupInput | null => {
    if (!formDeptId || !formSection || !formMentorId) return null;
    if (formMethod === "range") {
      if (!formRollStart || !formRollEnd) return null;
      return { mentorId: formMentorId, departmentId: formDeptId, semester: formSemester, section: formSection, assignmentMethod: "range", rollNumberStart: formRollStart, rollNumberEnd: formRollEnd };
    }
    if (formMethod === "manual") {
      if (selectedStudentIds.size === 0) return null;
      return { mentorId: formMentorId, departmentId: formDeptId, semester: formSemester, section: formSection, assignmentMethod: "manual", studentIds: Array.from(selectedStudentIds) };
    }
    return null;
  };

  const runConflictCheck = useCallback(async () => {
    if (!accessToken) return;
    const payload = buildPayload();
    if (!payload) {
      setConflictResult(null);
      return;
    }
    setCheckingConflicts(true);
    try {
      const result = await m.checkMentorGroupConflicts(payload, accessToken);
      setConflictResult(result);
    } catch {
      setConflictResult(null);
    } finally {
      setCheckingConflicts(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, formMentorId, formDeptId, formSemester, formSection, formMethod, formRollStart, formRollEnd, selectedStudentIds]);

  useEffect(() => {
    const t = setTimeout(runConflictCheck, 400);
    return () => clearTimeout(t);
  }, [runConflictCheck]);

  const handleSuggest = async () => {
    if (!accessToken || !formDeptId || !formSection) return;
    setSubmitting(true);
    try {
      const result = await m.suggestBalancedGroups({ departmentId: formDeptId, semester: formSemester, section: formSection, targetSize }, accessToken);
      setProposals(result);
    } catch (err: any) {
      triggerToast(err.message || "Failed to generate suggestions", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const useProposalAsRange = (p: m.BalancedGroupProposal) => {
    setFormMethod("range");
    setFormRollStart(p.rollNumberStart);
    setFormRollEnd(p.rollNumberEnd);
    setProposals(null);
  };

  const createProposalGroup = async (p: m.BalancedGroupProposal, mentorId: string) => {
    if (!accessToken || !mentorId) return;
    setSubmitting(true);
    try {
      await m.createMentorGroup(
        { mentorId, departmentId: formDeptId, semester: formSemester, section: formSection, assignmentMethod: "range", rollNumberStart: p.rollNumberStart, rollNumberEnd: p.rollNumberEnd },
        accessToken
      );
      triggerToast(`Group ${p.rollNumberStart}–${p.rollNumberEnd} created successfully`);
      setProposals((prev) => (prev ? { ...prev, proposals: prev.proposals.filter((x) => x !== p) } : prev));
      loadStatics();
    } catch (err: any) {
      triggerToast(err.message || "Failed to create group", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreate = async () => {
    if (!accessToken) return;
    const payload = buildPayload();
    if (!payload) {
      triggerToast("Please complete all required fields", "error");
      return;
    }
    setSubmitting(true);
    try {
      const group = await m.createMentorGroup(payload, accessToken);
      triggerToast(`Mentor group created (${group.academicSession}, Section ${group.section})`);
      resetCreateForm();
      loadStatics();
    } catch (err: any) {
      triggerToast(err.message || "Failed to create mentor group", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Manage Groups tab ─────────────────────────────────────────────────────
  const [groupFilterDept, setGroupFilterDept] = useState("ALL");
  const [groupFilterMethod, setGroupFilterMethod] = useState("ALL");
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [splitTarget, setSplitTarget] = useState<m.MentorGroup | null>(null);
  const [splitRoll, setSplitRoll] = useState("");
  const [splitNewMentor, setSplitNewMentor] = useState("");

  const filteredGroups = useMemo(() => {
    return groups.filter((g) => (groupFilterDept === "ALL" || g.departmentId === groupFilterDept) && (groupFilterMethod === "ALL" || g.assignmentMethod === groupFilterMethod));
  }, [groups, groupFilterDept, groupFilterMethod]);

  const toggleGroupSelection = (id: string) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 2) next.add(id);
      return next;
    });
  };

  const handleDeleteGroup = async (id: string) => {
    if (!accessToken || !confirm("Delete this mentor group? This cannot be undone.")) return;
    try {
      await m.deleteMentorGroup(id, accessToken);
      triggerToast("Mentor group deleted");
      loadStatics();
    } catch (err: any) {
      triggerToast(err.message || "Failed to delete group", "error");
    }
  };

  const handleSplit = async () => {
    if (!accessToken || !splitTarget || !splitRoll || !splitNewMentor) return;
    try {
      await m.splitMentorGroup(splitTarget.id, { splitAtRollNumber: splitRoll, newMentorId: splitNewMentor }, accessToken);
      triggerToast("Mentor group split successfully");
      setSplitTarget(null);
      setSplitRoll("");
      setSplitNewMentor("");
      loadStatics();
    } catch (err: any) {
      triggerToast(err.message || "Failed to split group", "error");
    }
  };

  const handleMerge = async () => {
    if (!accessToken || selectedGroupIds.size !== 2) return;
    const [a, b] = Array.from(selectedGroupIds);
    try {
      await m.mergeMentorGroups(a, b, accessToken);
      triggerToast("Mentor groups merged successfully");
      setSelectedGroupIds(new Set());
      loadStatics();
    } catch (err: any) {
      triggerToast(err.message || "Failed to merge groups", "error");
    }
  };

  // ── Settings tab ──────────────────────────────────────────────────────────
  const [settingsForm, setSettingsForm] = useState({ recommended: 25, maximum: 30, crossDept: false });
  useEffect(() => {
    if (settings) setSettingsForm({ recommended: settings.recommendedStudentsPerMentor, maximum: settings.maximumStudents, crossDept: settings.allowCrossDepartment });
  }, [settings]);

  const saveSettings = async () => {
    if (!accessToken) return;
    setSubmitting(true);
    try {
      const updated = await m.updateMentorshipSettings(
        { recommendedStudentsPerMentor: settingsForm.recommended, maximumStudents: settingsForm.maximum, allowCrossDepartment: settingsForm.crossDept },
        accessToken
      );
      setSettings(updated);
      triggerToast("Mentorship settings updated");
    } catch (err: any) {
      triggerToast(err.message || "Failed to update settings", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "w-full bg-background border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent-blue";

  if (loading) {
    return (
      <div className="flex h-[350px] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent-blue" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-12 w-full max-w-7xl mx-auto">
      {toastMsg && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-xl animate-fade-in ${toastKind === "success" ? "bg-accent-blue" : "bg-danger"}`}>
          {toastKind === "success" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          <span>{toastMsg}</span>
        </div>
      )}

      <div className="relative overflow-hidden rounded-2xl border border-border-subtle bg-surface p-5 lg:p-6 shadow-sm">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-500" />
        <h1 className="font-display font-bold text-lg text-text-primary leading-none">Mentor Group Management</h1>
        <p className="text-xs text-text-muted mt-1">
          Every selection is derived from Student Management — department, academic session and section drive eligible students automatically.
        </p>
      </div>

      <div className="flex border-b border-border-subtle gap-4 text-xs font-bold text-text-muted">
        {([
          { id: "create", label: "Create Group" },
          { id: "groups", label: "Manage Groups" },
          { id: "workloads", label: "Workloads & Analytics" },
          ...(isAdmin ? [{ id: "settings" as Tab, label: "Settings" }] : []),
        ] as { id: Tab; label: string }[]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-2 border-b-2 transition-all cursor-pointer ${activeTab === tab.id ? "border-accent-blue text-accent-blue" : "border-transparent hover:text-text-primary"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "create" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7 rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm space-y-4">
            <h3 className="font-display font-bold text-xs uppercase text-text-primary">1. Academic Scope</h3>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-[10px] font-bold text-text-muted uppercase">Department</span>
                <select value={formDeptId} onChange={(e) => setFormDeptId(e.target.value)} className={inputClass}>
                  <option value="">Select department…</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-bold text-text-muted uppercase">Academic Session</span>
                <select value={formSemester} onChange={(e) => setFormSemester(Number(e.target.value))} className={inputClass}>
                  {m.ACADEMIC_SESSIONS.map((s) => (
                    <option key={s.semester} value={s.semester}>{s.label} (Year {s.year}, Sem {s.semester})</option>
                  ))}
                </select>
              </label>
              <label className="col-span-2 space-y-1">
                <span className="text-[10px] font-bold text-text-muted uppercase">Section (synced from Student Management)</span>
                <select value={formSection} onChange={(e) => setFormSection(e.target.value)} disabled={!formDeptId} className={inputClass}>
                  <option value="">{formDeptId ? (sections.length ? "Select section…" : "No active sections found") : "Select a department first"}</option>
                  {sections.map((s) => (
                    <option key={s} value={s}>Section {s}</option>
                  ))}
                </select>
              </label>
            </div>

            <h3 className="font-display font-bold text-xs uppercase text-text-primary pt-2 border-t border-border-subtle">2. Assignment Method</h3>
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: "range", label: "Roll Range", desc: "Consecutive roll numbers (default)" },
                { id: "recommended", label: "Recommended Size", desc: "Auto-balanced groups" },
                { id: "manual", label: "Manual Selection", desc: "Search & pick students" },
              ] as { id: typeof formMethod; label: string; desc: string }[]).map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => { setFormMethod(opt.id); resetCreateForm(); }}
                  className={`text-left p-3 rounded-xl border text-xs transition-colors cursor-pointer ${formMethod === opt.id ? "border-accent-blue bg-accent-blue/5" : "border-border-subtle hover:border-border-hover"}`}
                >
                  <p className="font-bold text-text-primary">{opt.label}</p>
                  <p className="text-[10px] text-text-muted mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>

            {formMethod === "range" && (
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-[10px] font-bold text-text-muted uppercase">Start Roll Number</span>
                  <input value={formRollStart} onChange={(e) => setFormRollStart(e.target.value.toUpperCase())} className={inputClass} placeholder="e.g. 23VE1A0501" />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-bold text-text-muted uppercase">End Roll Number</span>
                  <input value={formRollEnd} onChange={(e) => setFormRollEnd(e.target.value.toUpperCase())} className={inputClass} placeholder="e.g. 23VE1A0525" />
                </label>
              </div>
            )}

            {formMethod === "recommended" && (
              <div className="space-y-3">
                <div className="flex items-end gap-2">
                  <label className="space-y-1 flex-1">
                    <span className="text-[10px] font-bold text-text-muted uppercase">Target Students Per Mentor</span>
                    <input type="number" min={1} value={targetSize} onChange={(e) => setTargetSize(Number(e.target.value))} className={inputClass} />
                  </label>
                  <button onClick={handleSuggest} disabled={!formSection || submitting} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent-blue text-white text-xs font-bold hover:bg-blue-600 disabled:opacity-50 cursor-pointer">
                    <Sparkles size={13} /> Generate
                  </button>
                </div>
                {proposals && (
                  <div className="space-y-2">
                    <p className="text-[11px] text-text-muted">{proposals.totalStudents} students → {proposals.proposals.length} proposed group(s)</p>
                    {proposals.proposals.map((p, idx) => (
                      <ProposalRow key={idx} proposal={p} candidates={candidates} onUse={() => useProposalAsRange(p)} onCreate={(mentorId) => createProposalGroup(p, mentorId)} submitting={submitting} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {formMethod === "manual" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Search size={13} className="text-text-muted" />
                  <input value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} placeholder="Search by roll number or name…" className={inputClass} disabled={!formSection} />
                </div>
                <div className="max-h-[220px] overflow-y-auto custom-scrollbar space-y-1 border border-border-subtle rounded-xl p-2 bg-background">
                  {filteredManualRoster.length === 0 && <p className="text-[11px] text-text-muted p-2">No eligible students found.</p>}
                  {filteredManualRoster.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-surface-hover cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={selectedStudentIds.has(s.id)}
                        onChange={(e) => setSelectedStudentIds((prev) => { const next = new Set(prev); if (e.target.checked) next.add(s.id); else next.delete(s.id); return next; })}
                        className="rounded border-border-subtle text-accent-blue"
                      />
                      <span className="font-mono font-bold text-text-primary">{s.rollNumber}</span>
                      <span className="text-text-secondary">{s.fullName}</span>
                    </label>
                  ))}
                </div>
                <p className="text-[10px] text-text-muted">{selectedStudentIds.size} student(s) selected</p>
              </div>
            )}

            {formMethod !== "recommended" && (
              <>
                <h3 className="font-display font-bold text-xs uppercase text-text-primary pt-2 border-t border-border-subtle">3. Mentor</h3>
                <MentorSelect candidates={candidates} value={formMentorId} onChange={setFormMentorId} />

                {conflictResult && conflictResult.conflicts.length > 0 && (
                  <div className="space-y-1.5">
                    {conflictResult.conflicts.map((c, idx) => (
                      <div key={idx} className={`flex items-start gap-2 p-2.5 rounded-lg text-[11px] border ${c.severity === "error" ? "bg-danger-soft border-danger/20 text-danger" : "bg-warning-soft border-warning/20 text-warning"}`}>
                        <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                        <span>{c.message}</span>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={handleCreate}
                  disabled={submitting || checkingConflicts || (conflictResult?.hasBlockingConflicts ?? false) || !buildPayload()}
                  className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-accent-blue text-white text-xs font-bold hover:bg-blue-600 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Create Mentor Group
                </button>
              </>
            )}
          </div>

          {/* Live Preview panel */}
          <div className="lg:col-span-5 rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm space-y-4">
            <h3 className="font-display font-bold text-xs uppercase text-text-primary">Live Preview</h3>
            <div className="grid grid-cols-3 gap-2">
              <PreviewStat label="Eligible" value={sectionRoster.length} />
              <PreviewStat label="Assigned" value={formMethod === "manual" ? selectedStudentIds.size : resolvedForRange.length} accent />
              <PreviewStat label="Remaining" value={Math.max(0, sectionRoster.length - (formMethod === "manual" ? selectedStudentIds.size : resolvedForRange.length))} />
            </div>

            {settings && (
              <div className="p-3 rounded-xl bg-background border border-border-subtle text-[11px] text-text-muted flex items-start gap-2">
                <Info size={13} className="mt-0.5 shrink-0" />
                <span>Recommended {settings.recommendedStudentsPerMentor} / Maximum {settings.maximumStudents} students per mentor.</span>
              </div>
            )}

            <div>
              <h4 className="text-[10px] font-bold text-text-muted uppercase mb-1.5">Resolved Roll Number Range</h4>
              {formMethod === "range" && resolvedForRange.length > 0 ? (
                <div className="max-h-[280px] overflow-y-auto custom-scrollbar space-y-1">
                  {resolvedForRange.map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-2 rounded-lg bg-background border border-border-subtle text-[11px]">
                      <span className="font-mono font-bold text-text-primary">{s.rollNumber}</span>
                      <span className="text-text-secondary">{s.fullName}</span>
                    </div>
                  ))}
                </div>
              ) : formMethod === "manual" && selectedStudentIds.size > 0 ? (
                <p className="text-[11px] text-text-muted">{selectedStudentIds.size} students manually selected — see checklist.</p>
              ) : (
                <p className="text-[11px] text-text-muted">Select a scope and range to preview resolved students.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "groups" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <select value={groupFilterDept} onChange={(e) => setGroupFilterDept(e.target.value)} className={`${inputClass} w-auto`}>
              <option value="ALL">All Departments</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select value={groupFilterMethod} onChange={(e) => setGroupFilterMethod(e.target.value)} className={`${inputClass} w-auto`}>
              <option value="ALL">All Methods</option>
              <option value="range">Range</option>
              <option value="section">Section (legacy)</option>
              <option value="manual">Manual</option>
            </select>
            {selectedGroupIds.size === 2 && (
              <button onClick={handleMerge} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent-purple text-white text-xs font-bold hover:opacity-90 cursor-pointer">
                <Merge size={13} /> Merge Selected
              </button>
            )}
            <button onClick={loadStatics} className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border-subtle text-xs font-bold text-text-secondary hover:border-border-hover cursor-pointer">
              <RefreshCw size={13} /> Refresh
            </button>
          </div>

          <div className="overflow-x-auto border border-border-subtle rounded-xl bg-background">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="bg-neutral-50 dark:bg-neutral-900 border-b border-border-subtle text-text-muted font-bold">
                <tr>
                  <th className="p-3"></th>
                  <th className="p-3">Mentor</th>
                  <th className="p-3">Department</th>
                  <th className="p-3">Session</th>
                  <th className="p-3">Section</th>
                  <th className="p-3">Roll Range</th>
                  <th className="p-3">Students</th>
                  <th className="p-3">Method</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-text-secondary font-medium">
                {filteredGroups.map((g) => (
                  <tr key={g.id} className="hover:bg-surface-hover/30">
                    <td className="p-3">
                      <input type="checkbox" checked={selectedGroupIds.has(g.id)} onChange={() => toggleGroupSelection(g.id)} className="rounded border-border-subtle" />
                    </td>
                    <td className="p-3 font-bold text-text-primary">{g.mentorName}</td>
                    <td className="p-3">{g.departmentName}</td>
                    <td className="p-3 font-mono">{g.academicSession}</td>
                    <td className="p-3">{g.section}</td>
                    <td className="p-3 font-mono text-[10px]">{g.rollNumberStart ? `${g.rollNumberStart}–${g.rollNumberEnd}` : "—"}</td>
                    <td className="p-3 font-bold text-accent-blue">{g.studentCount ?? 0}</td>
                    <td className="p-3 uppercase text-[10px]">{g.assignmentMethod}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {g.assignmentMethod !== "manual" && (
                          <button onClick={() => setSplitTarget(g)} className="text-accent-purple hover:opacity-70 cursor-pointer" title="Split group">
                            <Split size={13} />
                          </button>
                        )}
                        <button onClick={() => handleDeleteGroup(g.id)} className="text-danger hover:opacity-70 cursor-pointer" title="Delete group">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredGroups.length === 0 && (
                  <tr><td colSpan={9} className="p-6 text-center text-text-muted">No mentor groups match the current filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {report && (
            <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm grid grid-cols-3 gap-4">
              <PreviewStat label="Total Students" value={report.summary.totalStudents} />
              <PreviewStat label="Assigned" value={report.summary.assignedStudents} accent />
              <PreviewStat label="Unassigned" value={report.summary.unassignedStudents} />
            </div>
          )}
        </div>
      )}

      {activeTab === "workloads" && (
        <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm space-y-4">
          <h3 className="font-display font-bold text-sm text-text-primary uppercase tracking-wider">Mentor Workloads</h3>
          <div className="overflow-x-auto border border-border-subtle rounded-xl bg-background">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="bg-neutral-50 dark:bg-neutral-900 border-b border-border-subtle text-text-muted font-bold">
                <tr>
                  <th className="p-3">Mentor</th>
                  <th className="p-3">Department</th>
                  <th className="p-3">Mentoring Head</th>
                  <th className="p-3">Active Mentees</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-text-secondary font-medium">
                {workloads.map((w) => (
                  <tr key={w.mentorId} className="hover:bg-surface-hover/30">
                    <td className="p-3 font-bold text-text-primary">{w.mentorName}</td>
                    <td className="p-3">{w.departmentName}</td>
                    <td className="p-3">{w.isMentoringHead ? <Award size={13} className="text-accent-blue" /> : "—"}</td>
                    <td className="p-3 font-bold text-accent-blue">{w.activeMenteesCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "settings" && isAdmin && (
        <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm space-y-4 max-w-lg">
          <h3 className="font-display font-bold text-sm text-text-primary uppercase tracking-wider flex items-center gap-2">
            <Settings size={15} /> Mentorship Settings
          </h3>
          <label className="space-y-1 block">
            <span className="text-[10px] font-bold text-text-muted uppercase">Recommended Students Per Mentor</span>
            <input type="number" min={1} value={settingsForm.recommended} onChange={(e) => setSettingsForm((s) => ({ ...s, recommended: Number(e.target.value) }))} className={inputClass} />
          </label>
          <label className="space-y-1 block">
            <span className="text-[10px] font-bold text-text-muted uppercase">Maximum Students</span>
            <input type="number" min={1} value={settingsForm.maximum} onChange={(e) => setSettingsForm((s) => ({ ...s, maximum: Number(e.target.value) }))} className={inputClass} />
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-text-primary cursor-pointer">
            <input type="checkbox" checked={settingsForm.crossDept} onChange={(e) => setSettingsForm((s) => ({ ...s, crossDept: e.target.checked }))} className="rounded border-border-subtle text-accent-blue" />
            Allow cross-department mentoring
          </label>
          <button onClick={saveSettings} disabled={submitting} className="px-4 py-2 rounded-xl bg-accent-blue text-white text-xs font-bold hover:bg-blue-600 disabled:opacity-50 cursor-pointer">
            Save Settings
          </button>
        </div>
      )}

      {splitTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border-subtle bg-surface shadow-xl p-5 space-y-4">
            <h3 className="font-display font-bold text-sm text-text-primary">Split Mentor Group</h3>
            <p className="text-[11px] text-text-muted">Splitting {splitTarget.rollNumberStart}–{splitTarget.rollNumberEnd} ({splitTarget.mentorName})</p>
            <label className="space-y-1 block">
              <span className="text-[10px] font-bold text-text-muted uppercase">Split At Roll Number</span>
              <input value={splitRoll} onChange={(e) => setSplitRoll(e.target.value.toUpperCase())} className={inputClass} placeholder="First roll number of the new group" />
            </label>
            <label className="space-y-1 block">
              <span className="text-[10px] font-bold text-text-muted uppercase">New Group's Mentor</span>
              <MentorSelect candidates={candidates.length > 0 ? candidates : []} value={splitNewMentor} onChange={setSplitNewMentor} />
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={() => setSplitTarget(null)} className="px-4 py-2 rounded-xl text-xs font-bold text-text-secondary hover:bg-surface-hover cursor-pointer">Cancel</button>
              <button onClick={handleSplit} disabled={!splitRoll || !splitNewMentor} className="px-4 py-2 rounded-xl bg-accent-purple text-white text-xs font-bold disabled:opacity-50 cursor-pointer">Split Group</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PreviewStat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-background p-3 text-center">
      <p className={`text-xl font-black ${accent ? "text-accent-blue" : "text-text-primary"}`}>{value}</p>
      <p className="text-[9px] font-bold text-text-muted uppercase mt-0.5">{label}</p>
    </div>
  );
}

function MentorSelect({ candidates, value, onChange }: { candidates: m.MentorCandidate[]; value: string; onChange: (id: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-background border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent-blue">
      <option value="">Select mentor…</option>
      {candidates.map((c) => (
        <option key={c.facultyId} value={c.facultyId} disabled={c.overLimit}>
          {c.facultyName} — {c.currentGroups} group(s), {c.currentStudents} students {c.overLimit ? "(at capacity)" : `(cap. left: ${c.availableCapacity})`}
        </option>
      ))}
    </select>
  );
}

function ProposalRow({
  proposal,
  candidates,
  onUse,
  onCreate,
  submitting,
}: {
  proposal: m.BalancedGroupProposal;
  candidates: m.MentorCandidate[];
  onUse: () => void;
  onCreate: (mentorId: string) => void;
  submitting: boolean;
}) {
  const [mentorId, setMentorId] = useState("");
  return (
    <div className="p-3 rounded-xl border border-border-subtle bg-background space-y-2">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-mono font-bold text-text-primary">{proposal.rollNumberStart} <ArrowRight size={10} className="inline mx-1" /> {proposal.rollNumberEnd}</span>
        <span className="text-text-muted">{proposal.studentCount} students</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1"><MentorSelect candidates={candidates} value={mentorId} onChange={setMentorId} /></div>
        <button onClick={() => onCreate(mentorId)} disabled={!mentorId || submitting} className="px-3 py-2 rounded-lg bg-accent-blue text-white text-[10px] font-bold disabled:opacity-50 cursor-pointer shrink-0">Accept</button>
        <button onClick={onUse} className="px-3 py-2 rounded-lg border border-border-subtle text-[10px] font-bold text-text-secondary hover:border-border-hover cursor-pointer shrink-0">Modify</button>
      </div>
    </div>
  );
}
