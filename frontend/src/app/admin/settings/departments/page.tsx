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
  color: string | null;
  isActive: boolean;
}

export default function AdminDepartments() {
  const { accessToken } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deptToDelete, setDeptToDelete] = useState<{ id: string; name: string; isActive: boolean } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({ name: "", code: "", color: "" });
  const [formError, setFormError] = useState("");

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/departments", {}, accessToken);
      setDepartments(res.data.departments || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accessToken) fetchDepartments();
  }, [accessToken]);

  const filteredDepts = departments.filter(d => 
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openAddForm = () => {
    setEditingDept(null);
    setFormData({ name: "", code: "", color: "" });
    setFormError("");
    setIsFormOpen(true);
  };

  const openEditForm = (dept: Department) => {
    setEditingDept(dept);
    setFormData({ name: dept.name, code: dept.code, color: dept.color || "" });
    setFormError("");
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.code) {
      setFormError("Name and code are required.");
      return;
    }
    setActionLoading(true);
    setFormError("");
    try {
      if (editingDept) {
        await apiFetch(`/departments/${editingDept.id}`, {
          method: "PUT",
          body: JSON.stringify({ name: formData.name, code: formData.code })
        }, accessToken);
      } else {
        await apiFetch("/departments", {
          method: "POST",
          body: JSON.stringify({ name: formData.name, code: formData.code })
        }, accessToken);
      }
      setIsFormOpen(false);
      fetchDepartments();
    } catch (err: any) {
      setFormError(err.message || "Failed to save department");
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchiveRestore = async () => {
    if (!deptToDelete) return;
    setActionLoading(true);
    try {
      if (deptToDelete.isActive) {
        await apiFetch(`/departments/${deptToDelete.id}`, { method: "DELETE" }, accessToken);
      } else {
        await apiFetch(`/departments/${deptToDelete.id}/restore`, { method: "POST" }, accessToken);
      }
      setDeleteConfirmOpen(false);
      fetchDepartments();
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
            Departments
          </h1>
          <p className="text-text-secondary mt-1">Manage academic departments and codes.</p>
        </div>
        <button 
          onClick={openAddForm}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          <Plus size={18} />
          Add Department
        </button>
      </div>

      <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border-subtle bg-surface-elevated flex gap-4">
          <UnifiedSearchBar 
            value={searchTerm} 
            onChange={setSearchTerm} 
            placeholder="Search departments..." 
          />
        </div>

        {loading ? (
          <div className="p-4"><SkeletonTable cols={4} rows={5} /></div>
        ) : filteredDepts.length === 0 ? (
          <EmptyState 
            icon={<Database className="h-10 w-10 text-neutral-400 dark:text-neutral-500" />}
            title="No Departments Found"
            description="Get started by creating a new department."
            actionButton={
              <button 
                onClick={openAddForm}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
              >
                Add Department
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
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filteredDepts.map(dept => (
                  <tr key={dept.id} className="hover:bg-surface-elevated transition-colors">
                    <td className="px-6 py-4 font-medium text-text-primary">{dept.name}</td>
                    <td className="px-6 py-4 text-text-secondary">{dept.code}</td>
                    <td className="px-6 py-4">
                      {dept.isActive ? (
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
                          onClick={() => openEditForm(dept)}
                          className="p-1.5 text-text-muted hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit size={16} />
                        </button>
                        {dept.isActive ? (
                          <button 
                            onClick={() => { setDeptToDelete({ id: dept.id, name: dept.name, isActive: true }); setDeleteConfirmOpen(true); }}
                            className="p-1.5 text-text-muted hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
                            title="Archive"
                          >
                            <Trash2 size={16} />
                          </button>
                        ) : (
                          <button 
                            onClick={() => { setDeptToDelete({ id: dept.id, name: dept.name, isActive: false }); setDeleteConfirmOpen(true); }}
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
              <h3 className="font-semibold text-lg">{editingDept ? "Edit Department" : "Add Department"}</h3>
              <button onClick={() => setIsFormOpen(false)} className="text-text-muted hover:text-text-primary"><X size={20}/></button>
            </div>
            <div className="p-4 space-y-4">
              {formError && <div className="p-3 bg-rose-50 dark:bg-rose-500/10 text-rose-600 rounded-lg text-sm">{formError}</div>}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Department Name</label>
                <input 
                  type="text" 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-surface text-text-primary"
                  placeholder="e.g. Computer Science"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Code</label>
                <input 
                  type="text" 
                  value={formData.code} 
                  onChange={e => setFormData({...formData, code: e.target.value})}
                  className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-surface text-text-primary"
                  placeholder="e.g. CSE"
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
        title={deptToDelete?.isActive ? "Archive Department" : "Restore Department"}
        message={deptToDelete?.isActive 
          ? `Are you sure you want to archive ${deptToDelete?.name}? It cannot be archived if active students or faculty are assigned to it.`
          : `Are you sure you want to restore ${deptToDelete?.name}?`}
        confirmText={deptToDelete?.isActive ? "Archive" : "Restore"}
        isDestructive={deptToDelete?.isActive}
        isLoading={actionLoading}
      />
    </div>
  );
}
