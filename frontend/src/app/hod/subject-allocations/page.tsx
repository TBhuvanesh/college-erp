"use client";

import React from "react";
import { AllocationManager } from "@/components/SubjectAllocation/AllocationManager";

export default function HodSubjectAllocations() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-bold text-2xl dark:text-white text-text-primary">
          Department Subject Allocations
        </h2>
        <p className="text-xs dark:text-neutral-400 text-text-secondary mt-1">
          Review subject-to-faculty classroom mappings and teaching load workloads across your department.
        </p>
      </div>

      <AllocationManager />
    </div>
  );
}
