"use client";

import React from "react";
import { TeachingAssignmentManager } from "@/components/TeachingAssignment/TeachingAssignmentManager";

// Superseded "Subject Allocation" — Teaching Assignments are now the single
// academic relationship every module (Attendance, Results, LMS, Teaching
// Planner, Feedback, Exam Schedule) resolves through. Route path kept as
// /admin/subject-allocations for backward-compatible bookmarks/sidebar links.
export default function AdminTeachingAssignments() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-bold text-2xl dark:text-white text-text-primary">
          Teaching Assignment Management
        </h2>
        <p className="text-xs dark:text-neutral-400 text-text-secondary mt-1">
          Configure faculty-to-subject-to-section Teaching Assignments — the single relationship every academic
          module (Attendance, Results, LMS, Teaching Planner, Feedback) resolves through.
        </p>
      </div>

      <TeachingAssignmentManager />
    </div>
  );
}
