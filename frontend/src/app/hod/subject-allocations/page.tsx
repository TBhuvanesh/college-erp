"use client";

import React from "react";
import { TeachingAssignmentManager } from "@/components/TeachingAssignment/TeachingAssignmentManager";

export default function HodTeachingAssignments() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-bold text-2xl dark:text-white text-text-primary">
          Department Teaching Assignments
        </h2>
        <p className="text-xs dark:text-neutral-400 text-text-secondary mt-1">
          Review faculty-to-subject-to-section Teaching Assignments and workloads across your department.
        </p>
      </div>

      <TeachingAssignmentManager />
    </div>
  );
}
