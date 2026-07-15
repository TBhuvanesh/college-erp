"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import { 
  User, 
  Mail, 
  Phone, 
  Calendar, 
  BookOpen, 
  Clock, 
  ArrowLeft,
  Loader2, 
  AlertCircle,
  MessageSquare,
  Plus,
  Edit2,
  Trash2,
  Percent,
  TrendingUp,
  CreditCard,
  FileText,
  BookmarkCheck
} from "lucide-react";

interface StudentProfile {
  id: string;
  name: string;
  rollNumber: string;
  department: string;
  semester: number;
  year: number;
  phoneNumber: string | null;
  parentContact: string | null;
  email: string;
}

interface StudentSummary {
  attendancePercentage: number;
  latestCGPA: number;
  internalMarksSummary: string;
  feeStatus: string;
  assignmentStatus: string;
}

interface StudentAlerts {
  attendanceBelow75: boolean;
  feePending: boolean;
  assignmentOverdue: boolean;
  failedSubjects: boolean;
  lowInternalMarks: boolean;
}

interface MenteeDashboardRow {
  profile: StudentProfile;
  summary: StudentSummary;
  alerts: StudentAlerts;
}

interface MentoringNote {
  id: string;
  mentorId: string;
  studentId: string;
  title: string;
  remarks: string;
  meetingDate: string;
  followUpDate: string | null;
  createdAt: string;
}

export default function StudentMentorshipProfilePage() {
  const { accessToken } = useAuth();
  const params = useParams();
  const router = useRouter();
  const groupId = params.groupId as string;
  const studentId = params.studentId as string;

  // Page states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menteeData, setMenteeData] = useState<MenteeDashboardRow | null>(null);
  const [notes, setNotes] = useState<MentoringNote[]>([]);

  // Note Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  
  // Note Form fields
  const [noteTitle, setNoteTitle] = useState("");
  const [noteRemarks, setNoteRemarks] = useState("");
  const [noteMeetingDate, setNoteMeetingDate] = useState("");
  const [noteFollowUpDate, setNoteFollowUpDate] = useState("");
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!accessToken || !studentId) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch mentee profile and dashboard stats
      const dashRes = await apiFetch("/mentorship/dashboard", {}, accessToken);
      if (dashRes.success && dashRes.data) {
        const found = (dashRes.data as MenteeDashboardRow[]).find(row => row.profile.id === studentId);
        if (found) {
          setMenteeData(found);
        } else {
          // If not in dashboard, fetch the student directly from student API
          try {
            const studentRes = await apiFetch(`/students/${studentId}`, {}, accessToken);
            if (studentRes.success && studentRes.data?.student) {
              const s = studentRes.data.student;
              setMenteeData({
                profile: {
                  id: s.id,
                  name: s.fullName,
                  rollNumber: s.rollNumber,
                  department: s.departmentName || s.department?.name || "CSE",
                  semester: s.semester,
                  year: Math.ceil(s.semester / 2),
                  phoneNumber: s.phoneNumber || null,
                  parentContact: s.parentContact || null,
                  email: s.email
                },
                summary: {
                  attendancePercentage: 100,
                  latestCGPA: 0,
                  internalMarksSummary: "N/A",
                  feeStatus: "Paid",
                  assignmentStatus: "0/0"
                },
                alerts: {
                  attendanceBelow75: false,
                  feePending: false,
                  assignmentOverdue: false,
                  failedSubjects: false,
                  lowInternalMarks: false
                }
              });
            }
          } catch (stdErr) {
            throw new Error("Student mentee not found in your assigned logs");
          }
        }
      }

      // 2. Fetch mentoring notes
      const notesRes = await apiFetch(`/mentorship/notes/student/${studentId}`, {}, accessToken);
      if (notesRes.success && notesRes.data) {
        setNotes(notesRes.data);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load mentee profile details");
    } finally {
      setLoading(false);
    }
  }, [accessToken, studentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open Add Modal
  const handleOpenAddModal = () => {
    setModalMode("add");
    setNoteTitle("Regular Mentorship Meeting");
    setNoteRemarks("");
    setNoteMeetingDate(new Date().toLocaleDateString('en-CA')); // YYYY-MM-DD local format
    setNoteFollowUpDate("");
    setEditingNoteId(null);
    setModalError(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (note: MentoringNote) => {
    setModalMode("edit");
    setNoteTitle(note.title);
    setNoteRemarks(note.remarks);
    setNoteMeetingDate(new Date(note.meetingDate).toLocaleDateString('en-CA'));
    setNoteFollowUpDate(note.followUpDate ? new Date(note.followUpDate).toLocaleDateString('en-CA') : "");
    setEditingNoteId(note.id);
    setModalError(null);
    setIsModalOpen(true);
  };

  // Save Note (Add or Edit)
  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    if (!noteTitle || !noteRemarks || !noteMeetingDate) {
      setModalError("Please fill out Title, Remarks, and Meeting Date.");
      return;
    }

    setModalSubmitting(true);
    setModalError(null);

    try {
      if (modalMode === "add") {
        const res = await apiFetch("/mentorship/notes", {
          method: "POST",
          body: JSON.stringify({
            studentId,
            title: noteTitle,
            remarks: noteRemarks,
            meetingDate: noteMeetingDate,
            followUpDate: noteFollowUpDate || null
          })
        }, accessToken);
        if (res.success) {
          setIsModalOpen(false);
          loadData();
        }
      } else {
        const res = await apiFetch(`/mentorship/notes/${editingNoteId}`, {
          method: "PUT",
          body: JSON.stringify({
            title: noteTitle,
            remarks: noteRemarks,
            meetingDate: noteMeetingDate,
            followUpDate: noteFollowUpDate || null
          })
        }, accessToken);
        if (res.success) {
          setIsModalOpen(false);
          loadData();
        }
      }
    } catch (err: any) {
      setModalError(err.message || "An error occurred while saving the mentoring note");
    } finally {
      setModalSubmitting(false);
    }
  };

  // Delete Note
  const handleDeleteNote = async (id: string) => {
    if (!accessToken) return;
    if (!confirm("Are you sure you want to permanently delete this mentoring note? This action cannot be undone.")) {
      return;
    }

    try {
      const res = await apiFetch(`/mentorship/notes/${id}`, {
        method: "DELETE"
      }, accessToken);
      if (res.success) {
        loadData();
      }
    } catch (err: any) {
      alert(err.message || "Failed to delete note");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 text-accent-blue animate-spin" />
        <p className="text-text-secondary text-sm">Loading student profile data...</p>
      </div>
    );
  }

  if (error || !menteeData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 p-6 max-w-md mx-auto text-center">
        <AlertCircle className="w-12 h-12 text-danger" />
        <h3 className="text-lg font-bold text-text-primary">Failed to Load Profile</h3>
        <p className="text-text-secondary text-sm leading-normal">{error || "Student details not found."}</p>
        <button 
          onClick={() => router.push(`/faculty/mentorship/${groupId}`)}
          className="mt-2 px-4 py-2 bg-accent-blue hover:bg-accent-blue/90 text-white rounded-lg text-sm font-semibold cursor-pointer inline-flex items-center gap-1"
        >
          <ArrowLeft size={14} /> Back to group
        </button>
      </div>
    );
  }

  const { profile, summary, alerts } = menteeData;
  const isAtRisk = 
    alerts.attendanceBelow75 || 
    alerts.failedSubjects || 
    alerts.assignmentOverdue || 
    alerts.lowInternalMarks;

  return (
    <div className="space-y-6">
      {/* Back button and profile title */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push(`/faculty/mentorship/${groupId}`)}
          className="p-1.5 rounded-lg border border-border-subtle bg-surface hover:bg-surface-hover text-text-secondary hover:text-text-primary cursor-pointer transition-colors"
          title="Back to Group"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <span className="text-xs uppercase font-bold text-accent-blue">Mentorship File</span>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">{profile.name}</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Student Details Cards */}
        <div className="lg:col-span-1 space-y-6">
          {/* Profile Details */}
          <div className="bg-surface border border-border-subtle rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
              <User size={16} className="text-text-muted" />
              Personal Profile
            </h2>
            
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center font-bold text-lg text-accent-blue">
                {profile.name.charAt(0)}
              </div>
              <div>
                <h3 className="font-semibold text-text-primary leading-snug">{profile.name}</h3>
                <p className="text-xs font-mono text-text-muted">{profile.rollNumber}</p>
              </div>
            </div>

            <hr className="border-border-subtle/70" />

            <div className="space-y-3 text-sm">
              <div>
                <label className="text-[10px] uppercase font-bold text-text-muted block">Department</label>
                <span className="text-text-primary font-medium">{profile.department}</span>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase font-bold text-text-muted block">Year</label>
                  <span className="text-text-primary font-medium">Year {profile.year}</span>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-text-muted block">Semester</label>
                  <span className="text-text-primary font-medium">Semester {profile.semester}</span>
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-text-muted block">Email Address</label>
                <a href={`mailto:${profile.email}`} className="text-accent-blue hover:underline text-xs break-all block">
                  {profile.email}
                </a>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-text-muted block">Phone Number</label>
                <span className="text-text-secondary">{profile.phoneNumber || "N/A"}</span>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-text-muted block">Parent Contact Info</label>
                <span className="text-text-secondary">{profile.parentContact || "N/A"}</span>
              </div>
            </div>
          </div>

          {/* Academic Info */}
          <div className="bg-surface border border-border-subtle rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
              <BookmarkCheck size={16} className="text-text-muted" />
              Academic Status
            </h2>

            <div className="space-y-3 text-xs sm:text-sm">
              {/* Attendance */}
              <div className="flex items-center justify-between py-1.5 border-b border-border-subtle/50">
                <span className="flex items-center gap-1.5 text-text-secondary">
                  <Percent size={14} className="text-text-muted" /> Attendance
                </span>
                <span className={`font-semibold ${summary.attendancePercentage < 75 ? 'text-danger font-bold' : 'text-text-primary'}`}>
                  {summary.attendancePercentage}%
                </span>
              </div>

              {/* CGPA */}
              <div className="flex items-center justify-between py-1.5 border-b border-border-subtle/50">
                <span className="flex items-center gap-1.5 text-text-secondary">
                  <TrendingUp size={14} className="text-text-muted" /> Latest CGPA
                </span>
                <span className="font-semibold text-text-primary font-mono">
                  {summary.latestCGPA > 0 ? summary.latestCGPA.toFixed(2) : "N/A"}
                </span>
              </div>

              {/* Internals */}
              <div className="flex items-center justify-between py-1.5 border-b border-border-subtle/50">
                <span className="flex items-center gap-1.5 text-text-secondary">
                  <FileText size={14} className="text-text-muted" /> Internal Marks
                </span>
                <span className="font-semibold text-text-primary truncate max-w-[150px]">
                  {summary.internalMarksSummary}
                </span>
              </div>

              {/* Fees */}
              <div className="flex items-center justify-between py-1.5 border-b border-border-subtle/50">
                <span className="flex items-center gap-1.5 text-text-secondary">
                  <CreditCard size={14} className="text-text-muted" /> Fee Status
                </span>
                <span className={`font-semibold ${alerts.feePending ? 'text-warning font-bold' : 'text-success'}`}>
                  {summary.feeStatus}
                </span>
              </div>

              {/* LMS */}
              <div className="flex items-center justify-between py-1.5">
                <span className="flex items-center gap-1.5 text-text-secondary">
                  <FileText size={14} className="text-text-muted" /> LMS Assignments
                </span>
                <span className={`font-semibold ${alerts.assignmentOverdue ? 'text-danger font-bold' : 'text-text-primary'}`}>
                  {summary.assignmentStatus}
                </span>
              </div>
            </div>

            {/* Alert Banner if At Risk */}
            {isAtRisk && (
              <div className="bg-danger-soft border border-danger/25 text-danger rounded-lg p-3 text-xs space-y-1.5">
                <span className="font-bold uppercase tracking-wider block">⚠️ Active Risk Alerts:</span>
                <ul className="list-disc list-inside space-y-0.5">
                  {alerts.attendanceBelow75 && <li>Attendance is below 75%</li>}
                  {alerts.feePending && <li>Student has pending fee invoices</li>}
                  {alerts.failedSubjects && <li>One or more failed subjects</li>}
                  {alerts.assignmentOverdue && <li>Overdue LMS assignments</li>}
                  {alerts.lowInternalMarks && <li>Low internal marks averages</li>}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Mentorship Notes Timeline */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-surface border border-border-subtle rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3 mb-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-text-muted flex items-center gap-2">
                <MessageSquare size={16} className="text-text-muted" />
                Mentoring Notes & Counselling Records
              </h2>
              
              <button
                onClick={handleOpenAddModal}
                className="px-3 py-1.5 bg-accent-blue hover:bg-accent-blue/90 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus size={14} /> Add new note
              </button>
            </div>

            {notes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Clock className="w-12 h-12 text-text-muted/60 mb-2" />
                <p className="text-text-primary text-sm font-semibold">No Notes Found</p>
                <p className="text-text-muted text-xs mt-1 max-w-sm">
                  There are no counselling records or mentoring meeting logs on file for this student. Click the button above to log your first session.
                </p>
              </div>
            ) : (
              <div className="relative border-l border-border-strong pl-6 ml-3 space-y-6 py-2">
                {notes.map((note) => (
                  <div key={note.id} className="relative group">
                    {/* Timeline Node dot */}
                    <span className="absolute -left-[31px] top-1.5 w-2.5 h-2.5 rounded-full bg-accent-blue ring-4 dark:ring-neutral-950 ring-slate-50 transition-transform group-hover:scale-125" />
                    
                    <div className="bg-surface-elevated border border-border-subtle hover:border-border-strong rounded-lg p-4 transition-all shadow-xs space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <h3 className="font-semibold text-text-primary text-sm leading-tight">
                            {note.title}
                          </h3>
                          <div className="text-[10px] text-text-muted font-semibold flex items-center gap-1">
                            <Calendar size={11} />
                            {new Date(note.meetingDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                          </div>
                        </div>

                        {/* Note Actions */}
                        <div className="flex items-center gap-1.5 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleOpenEditModal(note)}
                            className="p-1 rounded hover:bg-surface border border-border-subtle hover:border-border-strong text-text-secondary hover:text-accent-blue cursor-pointer transition-colors"
                            title="Edit Note"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            className="p-1 rounded hover:bg-danger-soft border border-border-subtle hover:border-danger/35 text-text-secondary hover:text-danger cursor-pointer transition-colors"
                            title="Delete Note"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      <p className="text-text-secondary text-sm whitespace-pre-line leading-relaxed">
                        {note.remarks}
                      </p>

                      {note.followUpDate && (
                        <div className="pt-3 border-t border-border-subtle/50 flex items-center justify-between text-xs text-warning">
                          <span className="font-semibold flex items-center gap-1.5">
                            <Clock size={13} />
                            Scheduled Follow-up
                          </span>
                          <span className="font-mono bg-warning-soft px-2 py-0.5 rounded border border-warning/15">
                            {new Date(note.followUpDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Note Dialog Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-surface border border-border-strong rounded-xl w-full max-w-lg shadow-xl overflow-hidden animate-slide-up">
            <div className="p-4 border-b border-border-subtle bg-surface-elevated/40 flex items-center justify-between">
              <h3 className="font-bold text-text-primary text-base">
                {modalMode === "add" ? "Add Mentoring Record" : "Edit Mentoring Record"}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-text-muted hover:text-text-primary text-lg font-semibold cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveNote} className="p-5 space-y-4">
              {modalError && (
                <div className="p-3 bg-danger-soft border border-danger/20 text-danger text-xs rounded-lg flex items-center gap-2">
                  <AlertCircle size={14} />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="text-xs font-bold text-text-secondary block mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="e.g. Performance Review Meeting"
                  className="w-full text-sm bg-background border border-border-subtle focus:border-accent-blue focus:outline-hidden py-2 px-3 rounded-lg text-text-primary placeholder:text-text-muted"
                />
              </div>

              {/* Remarks */}
              <div>
                <label className="text-xs font-bold text-text-secondary block mb-1">Counselling Remarks / Notes</label>
                <textarea
                  required
                  rows={4}
                  value={noteRemarks}
                  onChange={(e) => setNoteRemarks(e.target.value)}
                  placeholder="Enter detailed counseling remarks, observations, and recommendations..."
                  className="w-full text-sm bg-background border border-border-subtle focus:border-accent-blue focus:outline-hidden py-2 px-3 rounded-lg text-text-primary placeholder:text-text-muted resize-y"
                />
              </div>

              {/* Dates Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-text-secondary block mb-1">Meeting Date</label>
                  <input
                    type="date"
                    required
                    value={noteMeetingDate}
                    onChange={(e) => setNoteMeetingDate(e.target.value)}
                    className="w-full text-sm bg-background border border-border-subtle focus:border-accent-blue focus:outline-hidden py-2 px-3 rounded-lg text-text-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-text-secondary block mb-1">Follow-up Date (Optional)</label>
                  <input
                    type="date"
                    value={noteFollowUpDate}
                    onChange={(e) => setNoteFollowUpDate(e.target.value)}
                    className="w-full text-sm bg-background border border-border-subtle focus:border-accent-blue focus:outline-hidden py-2 px-3 rounded-lg text-text-primary"
                  />
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border-subtle mt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-border-subtle hover:bg-surface-hover text-text-secondary rounded-lg text-sm font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="px-4 py-2 bg-accent-blue hover:bg-accent-blue/90 text-white rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
                >
                  {modalSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
