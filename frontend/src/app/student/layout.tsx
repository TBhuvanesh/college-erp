"use client";

import React from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AccessGuard } from "@/components/Analytics/AccessGuard";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={["student"]}>
      <AccessGuard>
        <DashboardLayout>{children}</DashboardLayout>
      </AccessGuard>
    </ProtectedRoute>
  );
}

