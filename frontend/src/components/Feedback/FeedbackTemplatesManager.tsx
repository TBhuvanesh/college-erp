"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { Plus, Edit2, Trash2, ChevronDown, ChevronUp, Loader2, Save, X, AlignLeft, List, CheckSquare, MessageSquare, Star } from "lucide-react";

interface Question {
  id: string;
  text: string;
  type: "rating" | "text" | "mcq" | "boolean";
  options?: string[] | null;
  order_index: number;
  is_required: boolean;
}

interface Template {
  id: string;
  title: string;
  type: string;
  questions: Question[];
}

export function FeedbackTemplatesManager({ accessToken }: { accessToken: string }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);

  // Modals state
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);

  // Form state
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [templateForm, setTemplateForm] = useState({ title: "", type: "faculty" });

  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [activeTemplateId, setActiveTemplateId] = useState<string>("");
  const [questionForm, setQuestionForm] = useState<{
    text: string;
    type: "rating" | "text" | "mcq" | "boolean";
    options: string;
    order_index: number;
    is_required: boolean;
  }>({
    text: "",
    type: "rating",
    options: "",
    order_index: 0,
    is_required: true,
  });

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/feedback/templates", {}, accessToken);
      if (res.success) {
        setTemplates(res.data || []);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // --- TEMPLATE HANDLERS ---
  const handleOpenTemplateModal = (template?: Template) => {
    if (template) {
      setEditingTemplate(template);
      setTemplateForm({ title: template.title, type: template.type });
    } else {
      setEditingTemplate(null);
      setTemplateForm({ title: "", type: "faculty" });
    }
    setIsTemplateModalOpen(true);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingTemplate) {
        await apiFetch(`/feedback/templates/${editingTemplate.id}`, {
          method: "PUT",
          body: JSON.stringify({ ...templateForm, isActive: true })
        }, accessToken);
      } else {
        await apiFetch(`/feedback/templates`, {
          method: "POST",
          body: JSON.stringify(templateForm)
        }, accessToken);
      }
      setIsTemplateModalOpen(false);
      fetchTemplates();
    } catch (err) {
      console.error(err);
      alert("Failed to save template");
    }
  };

  // --- QUESTION HANDLERS ---
  const handleOpenQuestionModal = (templateId: string, question?: Question) => {
    setActiveTemplateId(templateId);
    if (question) {
      setEditingQuestion(question);
      setQuestionForm({
        text: question.text,
        type: question.type,
        options: question.options ? question.options.join(", ") : "",
        order_index: question.order_index,
        is_required: question.is_required
      });
    } else {
      setEditingQuestion(null);
      // default order index
      const tmpl = templates.find(t => t.id === templateId);
      const nextIndex = tmpl ? tmpl.questions.length : 0;
      setQuestionForm({
        text: "",
        type: "rating",
        options: "",
        order_index: nextIndex,
        is_required: true
      });
    }
    setIsQuestionModalOpen(true);
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    const optionsArray = questionForm.type === "mcq" 
      ? questionForm.options.split(",").map(s => s.trim()).filter(Boolean)
      : null;

    const payload = {
      templateId: activeTemplateId,
      text: questionForm.text,
      type: questionForm.type,
      options: optionsArray,
      orderIndex: questionForm.order_index,
      isRequired: questionForm.is_required
    };

    try {
      if (editingQuestion) {
        await apiFetch(`/feedback/questions/${editingQuestion.id}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        }, accessToken);
      } else {
        await apiFetch(`/feedback/questions`, {
          method: "POST",
          body: JSON.stringify(payload)
        }, accessToken);
      }
      setIsQuestionModalOpen(false);
      fetchTemplates();
    } catch (err) {
      console.error(err);
      alert("Failed to save question");
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    if (!confirm("Are you sure you want to delete this question?")) return;
    try {
      await apiFetch(`/feedback/questions/${id}`, { method: "DELETE" }, accessToken);
      fetchTemplates();
    } catch (err) {
      console.error(err);
      alert("Failed to delete question");
    }
  };

  const getTypeIcon = (type: string) => {
    switch(type) {
      case "rating": return <Star className="h-4 w-4 text-amber-500" />;
      case "mcq": return <List className="h-4 w-4 text-blue-500" />;
      case "boolean": return <CheckSquare className="h-4 w-4 text-emerald-500" />;
      case "text": return <AlignLeft className="h-4 w-4 text-purple-500" />;
      default: return <MessageSquare className="h-4 w-4 text-neutral-500" />;
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
    <div className="space-y-4 max-w-4xl">
      <div className="flex justify-between items-center">
        <h2 className="font-display font-bold text-sm text-text-primary uppercase tracking-wider">
          Evaluation Templates
        </h2>
        <button
          onClick={() => handleOpenTemplateModal()}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all cursor-pointer shadow"
        >
          <Plus size={14} /> Create Template
        </button>
      </div>

      <div className="space-y-4">
        {templates.map(tmpl => {
          const isExpanded = expandedTemplate === tmpl.id;
          return (
            <div key={tmpl.id} className="rounded-2xl border border-border-subtle bg-surface overflow-hidden shadow-sm hover:border-border-hover transition-all">
              <div 
                className="p-5 flex items-center justify-between cursor-pointer select-none"
                onClick={() => setExpandedTemplate(isExpanded ? null : tmpl.id)}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-bold text-sm text-text-primary">{tmpl.title}</h3>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded text-text-secondary">
                      {tmpl.type}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted">{tmpl.questions.length} Questions configured</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleOpenTemplateModal(tmpl); }}
                    className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-text-secondary transition-colors"
                  >
                    <Edit2 size={14} />
                  </button>
                  {isExpanded ? <ChevronUp size={18} className="text-text-muted" /> : <ChevronDown size={18} className="text-text-muted" />}
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-border-subtle bg-neutral-50/50 dark:bg-neutral-900/50 p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-text-primary">Questions Layout</h4>
                    <button
                      onClick={() => handleOpenQuestionModal(tmpl.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 transition-all cursor-pointer"
                    >
                      <Plus size={12} /> Add Question
                    </button>
                  </div>

                  {tmpl.questions.length === 0 ? (
                    <div className="text-center py-6 text-xs text-text-muted">
                      No questions configured for this template.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {tmpl.questions.map((q, idx) => (
                        <div key={q.id} className="flex items-start justify-between gap-4 p-3 rounded-xl border border-border-subtle bg-surface hover:shadow-sm transition-all group">
                          <div className="flex gap-3">
                            <div className="mt-0.5 flex flex-col items-center justify-center w-6 h-6 rounded bg-neutral-100 dark:bg-neutral-800 text-[10px] font-bold text-text-secondary shrink-0">
                              {q.order_index}
                            </div>
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                {getTypeIcon(q.type)}
                                <span className="text-xs font-bold text-text-primary leading-tight">{q.text}</span>
                                {q.is_required && <span className="text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-500/10 px-1.5 rounded">Req</span>}
                              </div>
                              {q.type === "mcq" && q.options && (
                                <div className="flex gap-1 flex-wrap mt-1">
                                  {q.options.map((opt, i) => (
                                    <span key={i} className="text-[10px] bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 px-1.5 py-0.5 rounded border border-blue-100 dark:border-blue-500/20">
                                      {opt}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button
                              onClick={() => handleOpenQuestionModal(tmpl.id, q)}
                              className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-text-secondary transition-colors"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteQuestion(q.id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* --- TEMPLATE MODAL --- */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border-subtle bg-surface shadow-xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-5 border-b border-border-subtle">
              <h3 className="font-display font-bold text-lg text-text-primary">
                {editingTemplate ? "Edit Template" : "Create Template"}
              </h3>
              <button onClick={() => setIsTemplateModalOpen(false)} className="text-text-muted hover:text-text-primary transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveTemplate} className="p-5 space-y-4 overflow-y-auto custom-scrollbar">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-text-muted">Template Title</label>
                <input
                  type="text"
                  required
                  value={templateForm.title}
                  onChange={(e) => setTemplateForm({...templateForm, title: e.target.value})}
                  className="w-full rounded-xl border border-border-subtle bg-background px-3 py-2 text-sm text-text-primary focus:border-blue-500 focus:outline-none"
                  placeholder="e.g. Laboratory Evaluation"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-text-muted">Context Type</label>
                <select
                  value={templateForm.type}
                  onChange={(e) => setTemplateForm({...templateForm, type: e.target.value})}
                  className="w-full rounded-xl border border-border-subtle bg-background px-3 py-2 text-sm text-text-primary focus:border-blue-500 focus:outline-none"
                >
                  <option value="faculty">Faculty</option>
                  <option value="course">Course</option>
                  <option value="lms">LMS</option>
                  <option value="erp">ERP</option>
                </select>
                <p className="text-[10px] text-text-muted leading-tight mt-1">Context type determines when this template is presented to the user during the feedback cycle.</p>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsTemplateModalOpen(false)} className="px-4 py-2 text-xs font-bold text-text-secondary bg-surface border border-border-subtle hover:bg-surface-hover rounded-xl transition-all">Cancel</button>
                <button type="submit" className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all">Save Template</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- QUESTION MODAL --- */}
      {isQuestionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border-subtle bg-surface shadow-xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-5 border-b border-border-subtle">
              <h3 className="font-display font-bold text-lg text-text-primary">
                {editingQuestion ? "Edit Question" : "Add Question"}
              </h3>
              <button onClick={() => setIsQuestionModalOpen(false)} className="text-text-muted hover:text-text-primary transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveQuestion} className="p-5 space-y-4 overflow-y-auto custom-scrollbar">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-text-muted">Question Text</label>
                <textarea
                  required
                  rows={2}
                  value={questionForm.text}
                  onChange={(e) => setQuestionForm({...questionForm, text: e.target.value})}
                  className="w-full rounded-xl border border-border-subtle bg-background px-3 py-2 text-sm text-text-primary focus:border-blue-500 focus:outline-none resize-none"
                  placeholder="e.g. How effective was the course structure?"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-text-muted">Input Type</label>
                  <select
                    value={questionForm.type}
                    onChange={(e) => setQuestionForm({...questionForm, type: e.target.value as any})}
                    className="w-full rounded-xl border border-border-subtle bg-background px-3 py-2 text-sm text-text-primary focus:border-blue-500 focus:outline-none"
                  >
                    <option value="rating">Rating (1-5 Stars)</option>
                    <option value="mcq">Multiple Choice (MCQ)</option>
                    <option value="boolean">Yes/No</option>
                    <option value="text">Text / Comment</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-text-muted">Sort Order</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={questionForm.order_index}
                    onChange={(e) => setQuestionForm({...questionForm, order_index: parseInt(e.target.value)})}
                    className="w-full rounded-xl border border-border-subtle bg-background px-3 py-2 text-sm text-text-primary focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {questionForm.type === "mcq" && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-text-muted">Options (Comma separated)</label>
                  <input
                    type="text"
                    required
                    value={questionForm.options}
                    onChange={(e) => setQuestionForm({...questionForm, options: e.target.value})}
                    className="w-full rounded-xl border border-border-subtle bg-background px-3 py-2 text-sm text-text-primary focus:border-blue-500 focus:outline-none"
                    placeholder="e.g. Excellent, Good, Average, Poor"
                  />
                  <p className="text-[10px] text-text-muted leading-tight mt-1">Separate options with commas. Example: Option 1, Option 2, Option 3</p>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isRequired"
                  checked={questionForm.is_required}
                  onChange={(e) => setQuestionForm({...questionForm, is_required: e.target.checked})}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="isRequired" className="text-xs font-bold text-text-primary select-none cursor-pointer">
                  Require an answer for this question
                </label>
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-border-subtle">
                <button type="button" onClick={() => setIsQuestionModalOpen(false)} className="px-4 py-2 text-xs font-bold text-text-secondary bg-surface border border-border-subtle hover:bg-surface-hover rounded-xl transition-all">Cancel</button>
                <button type="submit" className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all">
                  <Save size={14} /> Save Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
