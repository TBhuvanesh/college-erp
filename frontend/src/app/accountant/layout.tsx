"use client";

import React from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function AccountantLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={["accountant"]}>
      <DashboardLayout>{children}</DashboardLayout>
    </ProtectedRoute>
  );
}
