"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSimulation } from "@/context/SimulationContext";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { 
  Search, 
  Filter, 
  X, 
  Mail,
  Sparkles,
  Plus,
  Edit,
  Trash2,
  Loader2,
  CheckCircle,
  Shield,
  Phone,
  Key,
  Calendar,
  AlertCircle
} from "lucide-react";

interface AccountantSummary {
  id: string;
  employeeNumber: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  isActive: boolean;
  createdAt: string;
}

export default function AdminAccountants() {
  const { accessToken } = useAuth();
  const { 
    accountants: simAccountants,
    addAccountant: simAddAccountant,
    updateAccountant: simUpdateAccountant,
    deleteAccountant: simDeleteAccountant,
    toggleAccountantStatus: simToggleAccountantStatus
  } = useSimulation();

  // Lists & config state
  const [accountants, setAccountants] = useState<AccountantSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Form Drawer & Modal states
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    employeeNumber: "",
    phoneNumber: "",
    password: "",
    confirmPassword: ""
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Password reset state
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetId, setResetId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  // Toast notifications
  const [toastMsg, setToastMsg] = useState("");

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  };

  // Sync / Fetch list
  const fetchAccountants = useCallback(async () => {
    if (!accessToken) {
      // Simulation mode
      let list = simAccountants.map(a => ({
        id: a.id,
        employeeNumber: a.employeeId,
        fullName: a.name,
        email: a.email,
        phoneNumber: a.phoneNumber,
        isActive: a.status === "Active",
        createdAt: new Date().toISOString()
      }));

      // Apply search term filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        list = list.filter(a => 
          a.fullName.toLowerCase().includes(query) || 
          a.employeeNumber.toLowerCase().includes(query) || 
          a.email.toLowerCase().includes(query)
        );
      }

      // Apply status filter
      if (statusFilter !== "ALL") {
        const targetActive = statusFilter === "ACTIVE";
        list = list.filter(a => a.isActive === targetActive);
      }

      setAccountants(list);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.append("search", searchTerm.trim());
      if (statusFilter !== "ALL") {
        params.append("isActive", statusFilter === "ACTIVE" ? "true" : "false");
      }

      const res = await apiFetch(`/accountants?${params.toString()}`, {}, accessToken);
      if (res.success && res.data?.accountants) {
        setAccountants(res.data.accountants);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load accountants registry.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, simAccountants, searchTerm, statusFilter]);

  useEffect(() => {
    fetchAccountants();
  }, [fetchAccountants]);

  // Form actions
  const openCreateDrawer = () => {
    setEditingId(null);
    setFormData({
      fullName: "",
      email: "",
      employeeNumber: `EMP-ACC0${simAccountants.length + 1}`,
      phoneNumber: "",
      password: "",
      confirmPassword: ""
    });
    setFormError(null);
    setDrawerOpen(true);
  };

  const openEditDrawer = (acc: AccountantSummary) => {
    setEditingId(acc.id);
    setFormData({
      fullName: acc.fullName,
      email: acc.email,
      employeeNumber: acc.employeeNumber,
      phoneNumber: acc.phoneNumber || "",
      password: "",
      confirmPassword: ""
    });
    setFormError(null);
    setDrawerOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Basic Validation
    if (!formData.fullName.trim() || !formData.email.trim() || !formData.employeeNumber.trim()) {
      setFormError("Please fill in all required fields.");
      return;
    }

    if (!editingId) {
      if (!formData.password) {
        setFormError("Password is required for registration.");
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setFormError("Passwords do not match.");
        return;
      }
    }

    setFormSubmitting(true);

    if (!accessToken) {
      // Simulation mode mutations
      if (editingId) {
        simUpdateAccountant(editingId, {
          name: formData.fullName,
          email: formData.email,
          employeeId: formData.employeeNumber,
          phoneNumber: formData.phoneNumber
        });
        triggerToast("Accountant profile updated.");
      } else {
        simAddAccountant({
          name: formData.fullName,
          email: formData.email,
          employeeId: formData.employeeNumber,
          phoneNumber: formData.phoneNumber
        });
        triggerToast("Accountant registered successfully.");
      }
      setFormSubmitting(false);
      setDrawerOpen(false);
      return;
    }

    try {
      if (editingId) {
        // Edit Accountant Profile
        const updatePayload: any = {
          fullName: formData.fullName,
          email: formData.email,
          employeeNumber: formData.employeeNumber,
          phoneNumber: formData.phoneNumber || undefined
        };
        const res = await apiFetch(`/accountants/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(updatePayload)
        }, accessToken);

        if (res.success) {
          triggerToast("Accountant updated successfully.");
          fetchAccountants();
          setDrawerOpen(false);
        }
      } else {
        // Create Accountant Profile
        const createPayload = {
          fullName: formData.fullName,
          email: formData.email,
          employeeNumber: formData.employeeNumber,
          phoneNumber: formData.phoneNumber || undefined,
          password: formData.password
        };

        const res = await apiFetch(`/accountants`, {
          method: "POST",
          body: JSON.stringify(createPayload)
        }, accessToken);

        if (res.success) {
          triggerToast("Accountant registered successfully.");
          fetchAccountants();
          setDrawerOpen(false);
        }
      }
    } catch (err: any) {
      setFormError(err.message || "Operation failed.");
    } finally {
      setFormSubmitting(false);
    }
  };

  // Toggle account active status
  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    if (!accessToken) {
      simToggleAccountantStatus(id);
      triggerToast("Accountant status toggled.");
      return;
    }

    try {
      const res = await apiFetch(`/accountants/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !currentStatus })
      }, accessToken);

      if (res.success) {
        triggerToast(`Accountant status updated.`);
        fetchAccountants();
      }
    } catch (err: any) {
      triggerToast(err.message || "Failed to update status.");
    }
  };

  // Password reset action
  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);

    if (resetPassword !== resetConfirm) {
      setResetError("Passwords do not match.");
      return;
    }

    if (resetPassword.length < 8) {
      setResetError("Password must be at least 8 characters.");
      return;
    }

    setResetSubmitting(true);

    if (!accessToken) {
      triggerToast("Simulation: Password reset completed.");
      setResetModalOpen(false);
      setResetSubmitting(false);
      return;
    }

    try {
      const res = await apiFetch(`/accountants/${resetId}`, {
        method: "PATCH",
        body: JSON.stringify({ password: resetPassword })
      }, accessToken);

      if (res.success) {
        triggerToast("Password reset successfully.");
        setResetModalOpen(false);
      }
    } catch (err: any) {
      setResetError(err.message || "Password reset failed.");
    } finally {
      setResetSubmitting(false);
    }
  };

  // Delete Accountant profile
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to deactivate and remove this accountant profile?")) {
      return;
    }

    if (!accessToken) {
      simDeleteAccountant(id);
      triggerToast("Accountant profile deleted.");
      return;
    }

    try {
      const res = await apiFetch(`/accountants/${id}`, { method: "DELETE" }, accessToken);
      if (res.success) {
        triggerToast("Accountant profile deleted.");
        fetchAccountants();
      }
    } catch (err: any) {
      triggerToast(err.message || "Delete failed.");
    }
  };

  return (
    <div className="relative">
      {/* Toast Alert */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-indigo-600 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-xl shadow-indigo-600/20 border border-indigo-400/20 animate-fade-in">
          <Sparkles size={14} className="animate-pulse" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="font-display font-bold text-2xl dark:text-white text-text-primary">Accountants Registry</h2>
          <p className="text-xs dark:text-neutral-400 text-text-secondary mt-1">
            Manage accountant user accounts, access permissions, and account statuses.
          </p>
        </div>
        <button
          onClick={openCreateDrawer}
          className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2.5 rounded-lg shadow-lg hover:shadow-indigo-600/20 transition-all cursor-pointer font-sans"
        >
          <Plus size={14} />
          <span>Register Accountant</span>
        </button>
      </div>

      {/* Filter and search actions bar */}
      <div className="glass-card border border-border-subtle rounded-xl p-4 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 dark:text-neutral-500 text-text-muted shrink-0" size={14} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, email or employee ID..."
            className="w-full pl-9 pr-4 py-2 dark:bg-neutral-900 bg-surface border border-border-subtle rounded-lg text-xs dark:text-white text-text-primary focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <div className="flex items-center gap-2 dark:bg-neutral-900 bg-surface border border-border-subtle rounded-lg px-3 text-xs dark:text-white text-text-primary w-full md:w-auto">
            <Filter size={12} className="dark:text-neutral-500 text-text-muted" />
            <span className="dark:text-neutral-500 text-text-muted">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent dark:text-white text-text-primary cursor-pointer py-2 focus:outline-none font-bold"
            >
              <option value="ALL">All Accounts</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Deactivated</option>
            </select>
          </div>
        </div>
      </div>

      {/* Database Error Alert */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-455 text-xs font-semibold rounded-lg flex items-center gap-2 mb-6">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Data Table */}
      <div className="glass-card border border-border-subtle rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
            <Loader2 className="animate-spin text-indigo-500 mb-3" size={30} />
            <span className="font-mono text-xs">Querying accountants accounts...</span>
          </div>
        ) : accountants.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="dark:bg-neutral-955 bg-surface-elevated border-b border-border-subtle dark:text-neutral-400 text-text-secondary font-semibold">
                  <th className="px-6 py-3 font-mono">Employee ID</th>
                  <th className="px-6 py-3">Full Name</th>
                  <th className="px-6 py-3">Email Address</th>
                  <th className="px-6 py-3">Phone Number</th>
                  <th className="px-6 py-3 text-center">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle dark:text-neutral-300 text-text-secondary">
                {accountants.map((acc) => (
                  <tr key={acc.id} className="dark:hover:bg-neutral-900/10 hover:bg-surface-hover transition-colors">
                    <td className="px-6 py-4 font-mono text-[11px] font-bold dark:text-indigo-400 text-indigo-700">
                      {acc.employeeNumber}
                    </td>
                    <td className="px-6 py-4 font-semibold dark:text-white text-text-primary">
                      {acc.fullName}
                    </td>
                    <td className="px-6 py-4 flex items-center gap-2">
                      <Mail size={12} className="dark:text-neutral-500 text-text-muted" />
                      <span>{acc.email}</span>
                    </td>
                    <td className="px-6 py-4">
                      {acc.phoneNumber ? (
                        <span className="flex items-center gap-1.5">
                          <Phone size={12} className="dark:text-neutral-500 text-text-muted" />
                          <span>{acc.phoneNumber}</span>
                        </span>
                      ) : (
                        <span className="dark:text-neutral-600 text-text-muted italic">Not Configured</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleToggleStatus(acc.id, acc.isActive)}
                        className={`px-2.5 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                          acc.isActive
                            ? "dark:bg-emerald-500/10 bg-emerald-50 dark:text-emerald-400 text-emerald-700 dark:border-emerald-500/25 border-emerald-250 hover:bg-emerald-500/20"
                            : "dark:bg-rose-500/10 bg-rose-50 dark:text-rose-455 text-rose-700 dark:border-rose-500/25 border-rose-250 hover:bg-rose-500/20"
                        }`}
                      >
                        {acc.isActive ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2.5">
                        <button
                          onClick={() => {
                            setResetId(acc.id);
                            setResetPassword("");
                            setResetConfirm("");
                            setResetError(null);
                            setResetModalOpen(true);
                          }}
                          title="Reset Password"
                          className="p-1.5 rounded-lg dark:hover:bg-neutral-800 hover:bg-surface-elevated text-neutral-500 hover:text-indigo-400 transition-colors cursor-pointer"
                        >
                          <Key size={13} />
                        </button>
                        <button
                          onClick={() => openEditDrawer(acc)}
                          title="Edit Profile"
                          className="p-1.5 rounded-lg dark:hover:bg-neutral-800 hover:bg-surface-elevated text-neutral-500 hover:text-blue-400 transition-colors cursor-pointer"
                        >
                          <Edit size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(acc.id)}
                          title="Delete Account"
                          className="p-1.5 rounded-lg dark:hover:bg-neutral-800 hover:bg-surface-elevated text-neutral-500 hover:text-rose-400 transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center dark:text-neutral-500 text-text-muted font-mono text-xs">
            No registered accountants found.
          </div>
        )}
      </div>

      {/* Add / Edit Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-fade-in">
          <div
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 cursor-pointer"
          />
          <div className="relative w-full max-w-md h-full dark:bg-neutral-950 bg-white border-l border-border-subtle shadow-2xl p-6 flex flex-col justify-between animate-slide-in">
            <div>
              <div className="flex items-center justify-between border-b border-border-subtle pb-4 mb-6">
                <div>
                  <h3 className="font-display font-bold text-lg dark:text-white text-text-primary">
                    {editingId ? "Edit Accountant Profile" : "Register Accountant"}
                  </h3>
                  <p className="text-[10px] dark:text-neutral-400 text-text-secondary mt-0.5">
                    {editingId ? "Modify staff credentials and designations." : "Create new administrative staff user credentials."}
                  </p>
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-1 rounded-lg dark:hover:bg-neutral-900 hover:bg-surface-elevated dark:text-neutral-400 text-text-secondary transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {formError && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-455 text-xs font-semibold rounded-lg flex items-center gap-2 mb-4">
                  <AlertCircle size={14} />
                  <span>{formError}</span>
                </div>
              )}

              <form id="accountant-form" onSubmit={handleFormSubmit} className="space-y-4">
                {/* Employee ID */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-text-muted mb-1.5">
                    Employee ID <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.employeeNumber}
                    onChange={(e) => setFormData({ ...formData, employeeNumber: e.target.value })}
                    className="w-full px-3.5 py-2.5 dark:bg-neutral-900 bg-surface border border-border-subtle rounded-lg text-xs dark:text-white text-text-primary focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. EMP-ACC001"
                  />
                </div>

                {/* Full Name */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-text-muted mb-1.5">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full px-3.5 py-2.5 dark:bg-neutral-900 bg-surface border border-border-subtle rounded-lg text-xs dark:text-white text-text-primary focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. Amit Sharma"
                  />
                </div>

                {/* Email Address */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-text-muted mb-1.5">
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 dark:bg-neutral-900 bg-surface border border-border-subtle rounded-lg text-xs dark:text-white text-text-primary focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. name@college.erp"
                  />
                </div>

                {/* Phone Number */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-text-muted mb-1.5">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    className="w-full px-3.5 py-2.5 dark:bg-neutral-900 bg-surface border border-border-subtle rounded-lg text-xs dark:text-white text-text-primary focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. +91 9876543210"
                  />
                </div>

                {/* Passwords (only on create) */}
                {!editingId && (
                  <>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-text-muted mb-1.5">
                        Password <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="password"
                        required
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full px-3.5 py-2.5 dark:bg-neutral-900 bg-surface border border-border-subtle rounded-lg text-xs dark:text-white text-text-primary focus:outline-none focus:border-indigo-500"
                        placeholder="••••••••"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-text-muted mb-1.5">
                        Confirm Password <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="password"
                        required
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        className="w-full px-3.5 py-2.5 dark:bg-neutral-900 bg-surface border border-border-subtle rounded-lg text-xs dark:text-white text-text-primary focus:outline-none focus:border-indigo-500"
                        placeholder="••••••••"
                      />
                    </div>
                  </>
                )}
              </form>
            </div>

            <div className="border-t border-border-subtle pt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="flex-1 px-4 py-2.5 border border-border-subtle rounded-lg text-xs dark:text-white text-text-primary hover:bg-surface-hover transition-colors font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="accountant-form"
                disabled={formSubmitting}
                className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-lg hover:shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {formSubmitting ? (
                  <>
                    <Loader2 className="animate-spin" size={14} />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>{editingId ? "Save Changes" : "Register Account"}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {resetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="relative w-full max-w-sm dark:bg-neutral-950 bg-white border border-border-subtle rounded-xl shadow-2xl p-6 animate-scale-in">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3.5 mb-4">
              <h3 className="font-display font-bold text-sm dark:text-white text-text-primary flex items-center gap-2">
                <Shield size={14} className="text-indigo-400" />
                <span>Reset Accountant Password</span>
              </h3>
              <button
                onClick={() => setResetModalOpen(false)}
                className="p-1 rounded-lg dark:hover:bg-neutral-900 hover:bg-surface-elevated text-text-muted hover:text-text-primary transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {resetError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-455 text-[10px] font-semibold rounded-lg flex items-center gap-2 mb-4">
                <AlertCircle size={14} />
                <span>{resetError}</span>
              </div>
            )}

            <form onSubmit={handlePasswordResetSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-text-muted mb-1.5">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 dark:bg-neutral-900 bg-surface border border-border-subtle rounded-lg text-xs dark:text-white text-text-primary focus:outline-none focus:border-indigo-500"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-text-muted mb-1.5">
                  Confirm Password
                </label>
                <input
                  type="password"
                  required
                  value={resetConfirm}
                  onChange={(e) => setResetConfirm(e.target.value)}
                  className="w-full px-3.5 py-2.5 dark:bg-neutral-900 bg-surface border border-border-subtle rounded-lg text-xs dark:text-white text-text-primary focus:outline-none focus:border-indigo-500"
                  placeholder="••••••••"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetModalOpen(false)}
                  className="flex-1 px-3.5 py-2 border border-border-subtle rounded-lg text-xs font-semibold dark:text-white text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetSubmitting}
                  className="flex-1 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-lg hover:shadow-indigo-600/25 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {resetSubmitting ? (
                    <Loader2 className="animate-spin" size={12} />
                  ) : (
                    <span>Reset Password</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
