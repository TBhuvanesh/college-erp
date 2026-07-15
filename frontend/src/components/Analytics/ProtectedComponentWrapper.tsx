"use client";

import React from "react";
import { usePermission } from "@/context/PermissionContext";
import { RbacRole } from "@/lib/permissions";

interface ProtectedComponentWrapperProps {
  children: React.ReactNode;
  allowedRoles?: RbacRole[];
  widgetName?: string;
  fallback?: React.ReactNode;
}

export const ProtectedComponentWrapper: React.FC<ProtectedComponentWrapperProps> = ({
  children,
  allowedRoles,
  widgetName,
  fallback = null,
}) => {
  const { rbacRole, hasWidget } = usePermission();

  // 1. Check specific allowed roles list if provided
  if (allowedRoles && !allowedRoles.includes(rbacRole)) {
    return <>{fallback}</>;
  }

  // 2. Check widget visibility registry if provided
  if (widgetName && !hasWidget(widgetName)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
