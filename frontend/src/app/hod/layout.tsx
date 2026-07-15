"use client";

import React from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { AccessGuard } from "@/components/Analytics/AccessGuard";

export default function HODLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();

  // Double check designation is HOD
  React.useEffect(() => {
    if (user && user.designation !== "hod") {
      router.push("/");
    }
  }, [user, router]);

  return (
    <ProtectedRoute allowedRoles={["faculty"]}>
      <AccessGuard>
        <DashboardLayout>{children}</DashboardLayout>
      </AccessGuard>
    </ProtectedRoute>
  );
}

