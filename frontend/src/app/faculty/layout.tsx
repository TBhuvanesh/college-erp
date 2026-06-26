"use client";

import React from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function FacultyLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={["faculty"]}>
      <DashboardLayout>{children}</DashboardLayout>
    </ProtectedRoute>
  );
}
