"use client";

import { useState, useMemo } from "react";
import { X, Loader2, AlertTriangle, CheckCircle2, Search } from "lucide-react";
import {
  createCampaign,
  updateCampaign,
  previewEligibility,
  FeedbackCampaign,
  FeedbackTemplate,
  CampaignConflict,
} from "@/lib/feedback";
import { ACADEMIC_SESSIONS } from "@/lib/mentorship";

interface DeptOption { id: string; name: string }
interface FacultyOption { id: string; full_name: string; department_id?: string; department?: { id: string } }
interface SubjectOption { id: string; code: string; name: string; semester: number; departmentId?: string; department?: { id: string } }

interface CampaignFormProps {
  token: string;
  templates: FeedbackTemplate[];
  departments: DeptOption[];
  faculties: FacultyOption[];
  subjects: SubjectOption[];
  editingCampaign?: FeedbackCampaign | null;
  onSaved: () => void;
  onCancel: () => void;
}

function toLocalDatetimeInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CampaignForm({ token, templates, departments, faculties, subjects, editingCampaign, onSaved, onCancel }: CampaignFormProps) {
  const isEdit = !!editingCampaign;

  const [title, setTitle] = useState(editingCampaign?.title ?? "");
  const [academicYear, setAcademicYear] = useState(editingCampaign?.academicYear ?? "");
  const [templateId, setTemplateId] = useState(editingCampaign?.templateId ?? templates[0]?.id ?? "");
  const [targetDepartmentIds, setTargetDepartmentIds] = useState<string[]>(editingCampaign?.targetDepartmentIds ?? []);
  const [targetSemesters, setTargetSemesters] = useState<number[]>(editingCampaign?.targetSemesters ?? []);
  const [targetSections, setTargetSections] = useState(editingCampaign?.targetSections.join(", ") ?? "");
  const [targetSubjectIds, setTargetSubjectIds] = useState<string[]>(editingCampaign?.targetSubjectIds ?? []);
  const [targetFacultyIds, setTargetFacultyIds] = useState<string[]>(editingCampaign?.targetFacultyIds ?? []);
  const [startDate, setStartDate] = useState(toLocalDatetimeInput(editingCampaign?.startDate));
  const [endDate, setEndDate] = useState(toLocalDatetimeInput(editingCampaign?.endDate));

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [checking, setChecking] = useState(false);
  const [preview, setPreview] = useState<{ eligibleCount: number; conflicts: CampaignConflict[]; hasBlockingConflicts: boolean } | null>(null);

  const selectedTemplate = templates.find((t) => t.id === templateId);
  const isSubjectScoped = selectedTemplate?.type === "faculty" || selectedTemplate?.type === "course";

  const toggle = (list: string[], value: string, setter: (v: string[]) => void) => {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
    setPreview(null);
  };
  const toggleSem = (value: number) => {
    setTargetSemesters(targetSemesters.includes(value) ? targetSemesters.filter((v) => v !== value) : [...targetSemesters, value]);
    setPreview(null);
  };

  const parsedSections = useMemo(
    () => targetSections.split(",").map((s) => s.trim()).filter(Boolean),
    [targetSections]
  );

  const buildTargetPayload = () => ({
    templateId,
    targetDepartmentIds,
    targetSemesters,
    targetSections: parsedSections,
    targetSubjectIds: isSubjectScoped ? targetSubjectIds : [],
    targetFacultyIds: isSubjectScoped ? targetFacultyIds : [],
  });

  const handlePreview = async () => {
    setError(null);
    setChecking(true);
    try {
      const result = await previewEligibility(
        {
          ...buildTargetPayload(),
          startDate: startDate ? new Date(startDate).toISOString() : undefined,
          endDate: endDate ? new Date(endDate).toISOString() : undefined,
          excludeCampaignId: editingCampaign?.id,
        },
        token
      );
      setPreview(result);
    } catch (err: any) {
      setError(err.message || "Failed to check eligibility");
    } finally {
      setChecking(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (targetDepartmentIds.length === 0) return setError("Select at least one target department.");
    if (targetSemesters.length === 0) return setError("Select at least one target academic session.");
    if (!templateId) return setError("Select a feedback form template.");

    setSaving(true);
    try {
      const payload = {
        title,
        academicYear,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        ...buildTargetPayload(),
      };
      if (isEdit && editingCampaign) {
        await updateCampaign(editingCampaign.id, payload, token);
      } else {
        await createCampaign(payload, token);
      }
      onSaved();
    } catch (err: any) {
      setError(err.message || "Failed to save campaign");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-border-subtle bg-surface shadow-xl flex flex-col max-h-[92vh]">
        <div className="flex justify-between items-center p-5 border-b border-border-subtle">
          <h3 className="font-display font-bold text-lg text-text-primary">
            {isEdit ? "Edit Campaign (Draft)" : "New Feedback Campaign"}
          </h3>
          <button onClick={onCancel} className="text-text-muted hover:text-text-primary transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto custom-scrollbar">
          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs font-semibold text-red-500">{error}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-[10px] font-bold uppercase text-text-muted">Campaign Name</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. End Semester Faculty Evaluation — CSE Sem 1"
                className="w-full rounded-lg border border-border-subtle bg-background px-3 py-2 text-sm text-text-primary focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-text-muted">Academic Year</label>
              <input
                type="text"
                required
                placeholder="2026-2027"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="w-full rounded-lg border border-border-subtle bg-background px-3 py-2 text-sm text-text-primary focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-text-muted">Feedback Form</label>
              <select
                required
                value={templateId}
                onChange={(e) => { setTemplateId(e.target.value); setPreview(null); }}
                className="w-full rounded-lg border border-border-subtle bg-background px-3 py-2 text-sm text-text-primary focus:border-blue-500 focus:outline-none"
              >
                <option value="">Select a template...</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.title} ({t.type})</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-text-muted">Open Date</label>
              <input
                type="datetime-local"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-border-subtle bg-background px-3 py-2 text-sm text-text-primary focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-text-muted">Close Date</label>
              <input
                type="datetime-local"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-border-subtle bg-background px-3 py-2 text-sm text-text-primary focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="border-t border-border-subtle pt-4 space-y-3">
            <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">Target Audience</h4>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-text-muted">Departments</label>
              <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border border-border-subtle bg-background max-h-24 overflow-y-auto">
                {departments.map((d) => (
                  <button
                    type="button"
                    key={d.id}
                    onClick={() => toggle(targetDepartmentIds, d.id, setTargetDepartmentIds)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                      targetDepartmentIds.includes(d.id)
                        ? "bg-blue-600 text-white border-blue-600"
                        : "border-border-subtle text-text-secondary hover:bg-surface-hover"
                    }`}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-text-muted">Academic Sessions</label>
              <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border border-border-subtle bg-background">
                {ACADEMIC_SESSIONS.map((s) => (
                  <button
                    type="button"
                    key={s.semester}
                    onClick={() => toggleSem(s.semester)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                      targetSemesters.includes(s.semester)
                        ? "bg-blue-600 text-white border-blue-600"
                        : "border-border-subtle text-text-secondary hover:bg-surface-hover"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-text-muted">Sections (comma separated, blank = all)</label>
              <input
                type="text"
                value={targetSections}
                onChange={(e) => { setTargetSections(e.target.value); setPreview(null); }}
                placeholder="e.g. A, B"
                className="w-full rounded-lg border border-border-subtle bg-background px-3 py-2 text-sm text-text-primary focus:border-blue-500 focus:outline-none"
              />
            </div>

            {isSubjectScoped && (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-text-muted">
                    Subjects (blank = all subjects taught in scope)
                  </label>
                  <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border border-border-subtle bg-background max-h-28 overflow-y-auto">
                    {subjects.map((s) => (
                      <button
                        type="button"
                        key={s.id}
                        onClick={() => toggle(targetSubjectIds, s.id, setTargetSubjectIds)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                          targetSubjectIds.includes(s.id)
                            ? "bg-blue-600 text-white border-blue-600"
                            : "border-border-subtle text-text-secondary hover:bg-surface-hover"
                        }`}
                      >
                        {s.code}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-text-muted">
                    Faculty (blank = all faculty teaching in scope)
                  </label>
                  <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border border-border-subtle bg-background max-h-28 overflow-y-auto">
                    {faculties.map((f) => (
                      <button
                        type="button"
                        key={f.id}
                        onClick={() => toggle(targetFacultyIds, f.id, setTargetFacultyIds)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                          targetFacultyIds.includes(f.id)
                            ? "bg-blue-600 text-white border-blue-600"
                            : "border-border-subtle text-text-secondary hover:bg-surface-hover"
                        }`}
                      >
                        {f.full_name}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Eligibility preview */}
          <div className="border-t border-border-subtle pt-4 space-y-3">
            <button
              type="button"
              onClick={handlePreview}
              disabled={checking}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {checking ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Preview Eligible Students
            </button>

            {preview && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-display font-bold text-2xl text-text-primary">{preview.eligibleCount}</span>
                  <span className="text-xs text-text-muted">eligible student{preview.eligibleCount === 1 ? "" : "s"} resolved from Student Management + Faculty Assignment</span>
                </div>
                {preview.conflicts.map((c, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start gap-2 rounded-lg p-2.5 text-xs font-medium ${
                      c.severity === "error"
                        ? "bg-red-500/10 text-red-600 border border-red-500/20"
                        : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                    }`}
                  >
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <span>{c.message}</span>
                  </div>
                ))}
                {preview.conflicts.length === 0 && (
                  <div className="flex items-center gap-2 rounded-lg p-2.5 text-xs font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                    <CheckCircle2 size={14} /> No conflicts detected.
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-border-subtle">
            <button type="button" onClick={onCancel} className="px-4 py-2 text-xs font-bold text-text-secondary bg-surface border border-border-subtle hover:bg-surface-hover rounded-xl transition-all cursor-pointer">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              {isEdit ? "Save Changes" : "Save as Draft"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
