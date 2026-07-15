"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { usePermission } from "@/context/PermissionContext";
import { Loader2 } from "lucide-react";

interface AccessGuardProps {
  children: React.ReactNode;
}

export const AccessGuard: React.FC<AccessGuardProps> = ({ children }) => {
  const { hasAccess, rbacRole } = usePermission();
  const pathname = usePathname();
  const router = useRouter();
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    if (pathname) {
      const allowed = hasAccess(pathname);
      setAuthorized(allowed);
      if (!allowed) {
        router.push("/unauthorized");
      }
    }
  }, [pathname, hasAccess, router, rbacRole]);

  if (authorized === null) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-neutral-950 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted font-mono">
            Verifying Access Rights...
          </span>
        </div>
      </div>
    );
  }

  if (authorized === false) {
    // Return empty shell while Next.js routes to the unauthorized page
    return <div className="min-h-screen bg-slate-50 dark:bg-neutral-950" />;
  }

  return <>{children}</>;
};
