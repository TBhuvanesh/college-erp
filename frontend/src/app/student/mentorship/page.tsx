"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { getProfile } from "@/lib/profile";
import { 
  User, 
  Mail, 
  Phone, 
  Calendar, 
  BookOpen, 
  Loader2, 
  AlertCircle,
  MessageSquare,
  Clock,
  ArrowRight,
  ShieldAlert
} from "lucide-react";

interface MentorDetails {
  assignmentId: string;
  assignedDate: string;
  status: string;
  mentorId: string;
  mentorName: string;
  employeeNumber: string;
  departmentName: string;
  mentorEmail: string;
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

export default function StudentMentorshipPage() {
  const { accessToken } = useAuth();
  
  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [mentor, setMentor] = useState<MentorDetails | null>(null);
  const [notes, setNotes] = useState<MentoringNote[]>([]);

  const loadMentorshipData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch profile to resolve database student ID
      const profile = await getProfile(accessToken);
      if (profile.role !== "student") {
        setError("Only students can view this page");
        setLoading(false);
        return;
      }
      const sId = (profile as any).id;
      setStudentId(sId);

      if (!sId) {
        throw new Error("Student profile ID not found");
      }

      // 2. Fetch mentor information
      try {
        const mentorRes = await apiFetch(`/mentorship/student/${sId}`, {}, accessToken);
        if (mentorRes.success && mentorRes.data) {
          setMentor(mentorRes.data);
        }
      } catch (err: any) {
        if (!err.message?.includes("not found")) {
          throw err;
        }
      }

      // 3. Fetch mentoring notes
      const notesRes = await apiFetch(`/mentorship/notes/student/${sId}`, {}, accessToken);
      if (notesRes.success && notesRes.data) {
        setNotes(notesRes.data);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load mentorship information");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadMentorshipData();
  }, [loadMentorshipData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 text-accent-blue animate-spin" />
        <p className="text-text-secondary text-sm">Loading mentorship details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 p-6 max-w-md mx-auto text-center">
        <AlertCircle className="w-12 h-12 text-danger" />
        <h3 className="text-lg font-bold text-text-primary">Failed to Load Mentorship</h3>
        <p className="text-text-secondary text-sm leading-normal">{error}</p>
        <button 
          onClick={loadMentorshipData}
          className="mt-2 px-4 py-2 bg-accent-blue hover:bg-accent-blue/90 text-white rounded-lg text-sm font-semibold cursor-pointer"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">My Mentorship Portal</h1>
        <p className="text-text-secondary text-sm mt-1">
          Stay connected with your assigned mentor, review counselling history, and check upcoming follow-ups.
        </p>
      </div>

      {/* Mentor Information Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 flex flex-col gap-6">
          <div className="bg-surface border border-border-subtle rounded-xl p-5 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-text-muted mb-4">Assigned Mentor</h2>
            {mentor ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center font-bold text-lg text-accent-blue">
                    {mentor.mentorName.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-text-primary">{mentor.mentorName}</h3>
                    <p className="text-xs text-text-muted font-mono">{mentor.employeeNumber}</p>
                  </div>
                </div>

                <hr className="border-border-subtle" />

                <div className="space-y-2.5 text-sm">
                  <div className="flex items-center gap-2.5 text-text-secondary">
                    <BookOpen size={16} className="text-text-muted" />
                    <span>{mentor.departmentName} Department</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-text-secondary">
                    <Mail size={16} className="text-text-muted" />
                    <a href={`mailto:${mentor.mentorEmail}`} className="hover:text-accent-blue underline">
                      {mentor.mentorEmail}
                    </a>
                  </div>
                  <div className="flex items-center gap-2.5 text-text-secondary">
                    <Calendar size={16} className="text-text-muted" />
                    <span>Assigned: {new Date(mentor.assignedDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <ShieldAlert className="w-10 h-10 text-warning mb-2" />
                <p className="text-text-primary text-sm font-semibold">No Mentor Assigned</p>
                <p className="text-text-muted text-xs mt-1 leading-normal max-w-xs">
                  An academic mentor has not been assigned to you yet. Please check back later or contact your Mentoring Head / HOD.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Notes & Counselling Timeline */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-surface border border-border-subtle rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3 mb-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-text-muted flex items-center gap-2">
                <MessageSquare size={16} className="text-text-muted" />
                Mentoring History & Remarks
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-accent-blue-soft border border-accent-blue/15 text-accent-blue font-semibold">
                {notes.length} {notes.length === 1 ? 'Record' : 'Records'}
              </span>
            </div>

            {notes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Clock className="w-12 h-12 text-text-muted/60 mb-2" />
                <p className="text-text-primary text-sm font-semibold">No History Found</p>
                <p className="text-text-muted text-xs mt-1 max-w-sm">
                  You do not have any logged mentoring meetings or counselling remarks yet. Once you meet with your mentor, notes will show here.
                </p>
              </div>
            ) : (
              <div className="relative border-l border-border-strong pl-6 ml-3 space-y-6 py-2">
                {notes.map((note) => (
                  <div key={note.id} className="relative group">
                    {/* Timeline Node dot */}
                    <span className="absolute -left-[31px] top-1.5 w-2.5 h-2.5 rounded-full bg-accent-blue ring-4 dark:ring-neutral-950 ring-slate-50 transition-transform group-hover:scale-125" />
                    
                    <div className="bg-surface-elevated border border-border-subtle hover:border-border-strong rounded-lg p-4 transition-all shadow-xs">
                      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                        <h3 className="font-semibold text-text-primary text-sm sm:text-base leading-tight">
                          {note.title}
                        </h3>
                        <div className="text-[11px] text-text-muted font-semibold flex items-center gap-1 shrink-0 bg-surface px-2 py-0.5 rounded-md border border-border-subtle">
                          <Calendar size={12} />
                          {new Date(note.meetingDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                        </div>
                      </div>

                      <p className="text-text-secondary text-sm whitespace-pre-line leading-relaxed">
                        {note.remarks}
                      </p>

                      {note.followUpDate && (
                        <div className="mt-3.5 pt-3 border-t border-border-subtle/50 flex items-center justify-between text-xs text-warning">
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
    </div>
  );
}
