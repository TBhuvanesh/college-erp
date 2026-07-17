"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import {
  listCampaigns,
  publishCampaign,
  closeCampaign,
  archiveCampaign,
  FeedbackCampaign,
  FeedbackTemplate,
  statusBadgeClasses,
  getTemplates,
} from "@/lib/feedback";
import { CampaignForm } from "./CampaignForm";
import { Plus, Loader2, Send, Lock, Archive, Pencil, Users, Calendar } from "lucide-react";

export function CampaignManager({ accessToken }: { accessToken: string }) {
  const [campaigns, setCampaigns] = useState<FeedbackCampaign[]>([]);
  const [templates, setTemplates] = useState<FeedbackTemplate[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [faculties, setFaculties] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<FeedbackCampaign | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [campaignsData, templatesData, deptRes, facRes, subRes] = await Promise.all([
        listCampaigns({}, accessToken),
        getTemplates(accessToken),
        apiFetch("/departments", {}, accessToken),
        apiFetch("/faculty?limit=200", {}, accessToken),
        apiFetch("/subjects?limit=200", {}, accessToken),
      ]);
      setCampaigns(campaignsData);
      setTemplates(templatesData);
      if (deptRes.success) setDepartments(deptRes.data?.departments || []);
      if (facRes.success) setFaculties(facRes.data?.faculty || []);
      if (subRes.success) setSubjects(subRes.data?.subjects || []);
    } catch (err) {
      console.error("Failed to load campaigns", err);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAction = async (id: string, action: "publish" | "close" | "archive") => {
    setActionLoading(id + action);
    try {
      if (action === "publish") await publishCampaign(id, accessToken);
      if (action === "close") await closeCampaign(id, accessToken);
      if (action === "archive") await archiveCampaign(id, accessToken);
      await load();
    } catch (err: any) {
      alert(err.message || `Failed to ${action} campaign`);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-display font-bold text-sm text-text-primary uppercase tracking-wider">
          Feedback Campaigns ({campaigns.length})
        </h2>
        <button
          onClick={() => { setEditingCampaign(null); setShowForm(true); }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all cursor-pointer shadow"
        >
          <Plus size={14} /> Create Campaign
        </button>
      </div>

      {campaigns.length === 0 ? (
        <div className="rounded-2xl border border-border-subtle bg-surface p-10 text-center text-text-muted text-sm">
          No feedback campaigns yet. Create one to start collecting eligibility-driven feedback.
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <div key={c.id} className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display font-bold text-sm text-text-primary">{c.title}</h3>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider border ${statusBadgeClasses(c.effectiveStatus)}`}>
                      {c.effectiveStatus}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded text-text-secondary">
                      {c.templateType}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted">
                    {c.academicYear} · {c.targetDepartmentNames.join(", ") || "All departments"} · Sem {c.targetSemesters.join(", ") || "All"}
                    {c.targetSections.length > 0 && ` · Section ${c.targetSections.join(", ")}`}
                  </p>
                  <p className="flex items-center gap-1 text-[11px] text-text-muted">
                    <Calendar size={11} /> {new Date(c.startDate).toLocaleString()} — {new Date(c.endDate).toLocaleString()}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {c.status === "draft" && (
                    <>
                      <button
                        onClick={() => { setEditingCampaign(c); setShowForm(true); }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-text-secondary border border-border-subtle hover:bg-surface-hover cursor-pointer"
                      >
                        <Pencil size={12} /> Edit
                      </button>
                      <button
                        onClick={() => handleAction(c.id, "publish")}
                        disabled={actionLoading === c.id + "publish"}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 cursor-pointer disabled:opacity-50"
                      >
                        {actionLoading === c.id + "publish" ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Publish
                      </button>
                    </>
                  )}
                  {c.status === "published" && (
                    <button
                      onClick={() => handleAction(c.id, "close")}
                      disabled={actionLoading === c.id + "close"}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer disabled:opacity-50"
                    >
                      {actionLoading === c.id + "close" ? <Loader2 size={12} className="animate-spin" /> : <Lock size={12} />} Close
                    </button>
                  )}
                  {c.status === "closed" && (
                    <button
                      onClick={() => handleAction(c.id, "archive")}
                      disabled={actionLoading === c.id + "archive"}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-text-secondary border border-border-subtle hover:bg-surface-hover cursor-pointer disabled:opacity-50"
                    >
                      {actionLoading === c.id + "archive" ? <Loader2 size={12} className="animate-spin" /> : <Archive size={12} />} Archive
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <CampaignForm
          token={accessToken}
          templates={templates}
          departments={departments}
          faculties={faculties}
          subjects={subjects}
          editingCampaign={editingCampaign}
          onCancel={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}
