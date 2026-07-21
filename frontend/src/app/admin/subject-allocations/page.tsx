"use client";

import React from "react";
import { AllocationManager } from "@/components/SubjectAllocation/AllocationManager";

export default function AdminSubjectAllocations() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-bold text-2xl dark:text-white text-text-primary">
          Subject Allocation Registry
        </h2>
        <p className="text-xs dark:text-neutral-400 text-text-secondary mt-1">
          Configure instructor-to-subject course maps, monitor active section coverage, and analyze faculty teaching loads.
        </p>
      </div>

      <AllocationManager />
    </div>
  );
}
