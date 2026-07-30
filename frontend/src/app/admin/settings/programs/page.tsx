"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { 
  Plus, Edit, Trash2, X, Database, Undo 
} from "lucide-react";
import { SkeletonTable } from "@/components/UX/SkeletonLoaders";
import { EmptyState } from "@/components/UX/EmptyState";
import { UnifiedSearchBar } from "@/components/UX/UnifiedSearchBar";
import { ConfirmationDialog } from "@/components/UX/ConfirmationDialog";

interface Department {
  id: string;
  name: string;
  code: string;
}

interface Program {
  id: string;
  departmentId: string;
  name: string;
  code: string;
  totalSemesters: number;
  isActive: boolean;
}

export default function AdminPrograms() {
  const { accessToken } = useAuth();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDeptId, setSelectedDeptId] = useState<string>("ALL");
  
  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProg, setEditingProg] = useState<Program | null>(null);
  
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [progToDelete, setProgToDelete] = useState<{ id: string; name: string; isActive: boolean } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({ departmentId: "", name: "", code: "", totalSemesters: 8 });
  const [formError, setFormError] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const [deptRes, progRes] = await Promise.all([
        apiFetch("/departments", {}, accessToken),
        apiFetch("/departments/programs/list", {}, accessToken)
      ]);
      setDepartments(deptRes.data.departments || []);
      setPrograms(progRes.data.programs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accessToken) fetchData();
  }, [accessToken]);

  const filteredPrograms = programs.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = selectedDeptId === "ALL" || p.departmentId === selectedDeptId;
    return matchesSearch && matchesDept;
  });

  const getDeptName = (id: string) => departments.find(d => d.id === id)?.name || id;

  const openAddForm = () => {
    setEditingProg(null);
    setFormData({ departmentId: departments[0]?.id || "", name: "", code: "", totalSemesters: 8 });
    setFormError("");
    setIsFormOpen(true);
  };

  const openEditForm = (prog: Program) => {
    setEditingProg(prog);
    setFormData({ departmentId: prog.departmentId, name: prog.name, code: prog.code, totalSemesters: prog.totalSemesters });
    setFormError("");
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.code || !formData.departmentId) {
      setFormError("Name, code, and department are required.");
      return;
    }
    setActionLoading(true);
    setFormError("");
    try {
      if (editingProg) {
        await apiFetch(`/departments/programs/${editingProg.id}`, {
          method: "PUT",
          body: JSON.stringify(formData)
        }, accessToken);
      } else {
        await apiFetch("/departments/programs", {
          method: "POST",
          body: JSON.stringify(formData)
        }, accessToken);
      }
      setIsFormOpen(false);
      fetchData();
    } catch (err: any) {
      setFormError(err.message || "Failed to save program");
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchiveRestore = async () => {
    if (!progToDelete) return;
    setActionLoading(true);
    try {
      if (progToDelete.isActive) {
        await apiFetch(`/departments/programs/${progToDelete.id}`, { method: "DELETE" }, accessToken);
      } else {
        await apiFetch(`/departments/programs/${progToDelete.id}/restore`, { method: "POST" }, accessToken);
      }
      setDeleteConfirmOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.message || "Failed to process request");
      setDeleteConfirmOpen(false);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            <Database className="text-blue-500" />
            Programs
          </h1>
          <p className="text-text-secondary mt-1">Manage academic degree programs and courses.</p>
        </div>
        <button 
          onClick={openAddForm}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          <Plus size={18} />
          Add Program
        </button>
      </div>

      <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border-subtle bg-surface-elevated flex flex-col sm:flex-row gap-4">
          <UnifiedSearchBar 
            value={searchTerm} 
            onChange={setSearchTerm} 
            placeholder="Search programs..." 
          />
          <select 
            value={selectedDeptId}
            onChange={e => setSelectedDeptId(e.target.value)}
            className="px-3 py-2 border border-border-subtle rounded-lg bg-surface text-sm"
          >
            <option value="ALL">All Departments</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="p-4"><SkeletonTable cols={5} rows={5} /></div>
        ) : filteredPrograms.length === 0 ? (
          <EmptyState 
            icon={<Database className="h-10 w-10 text-neutral-400 dark:text-neutral-500" />}
            title="No Programs Found"
            description="Get started by creating a new program."
            actionButton={
              <button 
                onClick={openAddForm}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
              >
                Add Program
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-elevated text-text-secondary text-xs uppercase tracking-wider border-b border-border-subtle">
                  <th className="px-6 py-3 font-semibold">Name</th>
                  <th className="px-6 py-3 font-semibold">Code</th>
                  <th className="px-6 py-3 font-semibold">Department</th>
                  <th className="px-6 py-3 font-semibold">Semesters</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filteredPrograms.map(prog => (
                  <tr key={prog.id} className="hover:bg-surface-elevated transition-colors">
                    <td className="px-6 py-4 font-medium text-text-primary">{prog.name}</td>
                    <td className="px-6 py-4 text-text-secondary">{prog.code}</td>
                    <td className="px-6 py-4 text-text-secondary">{getDeptName(prog.departmentId)}</td>
                    <td className="px-6 py-4 text-text-secondary">{prog.totalSemesters}</td>
                    <td className="px-6 py-4">
                      {prog.isActive ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-500/10 dark:text-green-400">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-500/10 dark:text-gray-400">
                          Archived
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => openEditForm(prog)}
                          className="p-1.5 text-text-muted hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit size={16} />
                        </button>
                        {prog.isActive ? (
                          <button 
                            onClick={() => { setProgToDelete({ id: prog.id, name: prog.name, isActive: true }); setDeleteConfirmOpen(true); }}
                            className="p-1.5 text-text-muted hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
                            title="Archive"
                          >
                            <Trash2 size={16} />
                          </button>
                        ) : (
                          <button 
                            onClick={() => { setProgToDelete({ id: prog.id, name: prog.name, isActive: false }); setDeleteConfirmOpen(true); }}
                            className="p-1.5 text-text-muted hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10 rounded-lg transition-colors"
                            title="Restore"
                          >
                            <Undo size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-xl shadow-xl max-w-md w-full border border-border-subtle overflow-hidden animate-slide-up">
            <div className="flex justify-between items-center p-4 border-b border-border-subtle">
              <h3 className="font-semibold text-lg">{editingProg ? "Edit Program" : "Add Program"}</h3>
              <button onClick={() => setIsFormOpen(false)} className="text-text-muted hover:text-text-primary"><X size={20}/></button>
            </div>
            <div className="p-4 space-y-4">
              {formError && <div className="p-3 bg-rose-50 dark:bg-rose-500/10 text-rose-600 rounded-lg text-sm">{formError}</div>}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Department</label>
                <select 
                  value={formData.departmentId} 
                  onChange={e => setFormData({...formData, departmentId: e.target.value})}
                  className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-surface text-text-primary"
                >
                  <option value="" disabled>Select Department</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Program Name</label>
                <input 
                  type="text" 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-surface text-text-primary"
                  placeholder="e.g. B.Tech Computer Science"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Code</label>
                <input 
                  type="text" 
                  value={formData.code} 
                  onChange={e => setFormData({...formData, code: e.target.value})}
                  className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-surface text-text-primary"
                  placeholder="e.g. BTCS"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Total Semesters</label>
                <input 
                  type="number" 
                  min="1" max="12"
                  value={formData.totalSemesters} 
                  onChange={e => setFormData({...formData, totalSemesters: parseInt(e.target.value) || 8})}
                  className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-surface text-text-primary"
                />
              </div>
            </div>
            <div className="p-4 border-t border-border-subtle bg-surface-elevated flex justify-end gap-3">
              <button onClick={() => setIsFormOpen(false)} className="px-4 py-2 font-medium text-text-secondary hover:bg-black/5 rounded-lg">Cancel</button>
              <button onClick={handleSave} disabled={actionLoading} className="px-4 py-2 font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {actionLoading ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleArchiveRestore}
        title={progToDelete?.isActive ? "Archive Program" : "Restore Program"}
        message={progToDelete?.isActive 
          ? `Are you sure you want to archive ${progToDelete?.name}? It cannot be archived if active students or curriculum are assigned to it.`
          : `Are you sure you want to restore ${progToDelete?.name}?`}
        confirmText={progToDelete?.isActive ? "Archive" : "Restore"}
        isDestructive={progToDelete?.isActive}
        isLoading={actionLoading}
      />
    </div>
  );
}
