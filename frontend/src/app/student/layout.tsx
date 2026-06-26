"use client";

import React from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={["student"]}>
      <DashboardLayout>{children}</DashboardLayout>
    </ProtectedRoute>
  );
}
