"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ("admin" | "faculty" | "student" | "accountant")[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
}) => {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/");
      } else if (allowedRoles && !allowedRoles.includes(user.role)) {
        // Logged in but unauthorized for this specific section, redirect back to lobby
        router.push("/");
      }
    }
  }, [user, loading, allowedRoles, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-neutral-950 text-neutral-100 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
          <span className="text-xs font-semibold uppercase tracking-widest text-neutral-500 font-mono">
            Verifying Identity Session...
          </span>
        </div>
      </div>
    );
  }

  // If loading is finished and user matches required roles, render children
  if (user && (!allowedRoles || allowedRoles.includes(user.role))) {
    return <>{children}</>;
  }

  // Return a placeholder during redirect transition
  return (
    <div className="flex min-h-screen bg-neutral-950" />
  );
};
