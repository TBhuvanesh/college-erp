"use client";

import React from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <DashboardLayout>{children}</DashboardLayout>
    </ProtectedRoute>
  );
}
