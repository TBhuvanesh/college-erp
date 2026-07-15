"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSimulation } from "@/context/SimulationContext";
import { getRbacRole, RbacRole, hasAccessToPath, hasAccessToWidget } from "@/lib/permissions";

interface PermissionContextType {
  rbacRole: RbacRole;
  hasAccess: (path: string) => boolean;
  hasWidget: (widgetName: string) => boolean;
  isSuperAdmin: boolean;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export const PermissionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { currentRole } = useSimulation();
  const [rbacRole, setRbacRole] = useState<RbacRole>("Student");

  useEffect(() => {
    // Determine active RBAC role based on both simulation context selector and authenticating user profile
    if (!user) {
      setRbacRole("Student");
      return;
    }

    const baseRole = user.role;
    const designation = user.facultyProfile?.designation || user.designation;
    const email = user.email;

    // Use simulated role if it is active, otherwise default to user profile role
    if (currentRole) {
      const simRole = currentRole.toLowerCase();
      if (simRole === "student") {
        setRbacRole("Student");
      } else if (simRole === "hod") {
        setRbacRole("HOD");
      } else if (simRole === "admin") {
        if (designation === "super_admin" || email === "admin@college.erp") {
          setRbacRole("Super Admin");
        } else {
          setRbacRole("College Admin");
        }
      } else if (simRole === "faculty") {
        // Map to specialized faculty designations if user matches
        if (designation === "academic_coordinator") setRbacRole("Academic Coordinator");
        else if (designation === "placement_officer") setRbacRole("Placement Officer");
        else if (designation === "mentoring_head") setRbacRole("Mentoring Head");
        else setRbacRole("Faculty");
      } else {
        // Fallback for accountant, etc.
        setRbacRole(getRbacRole(baseRole, designation, email));
      }
    } else {
      setRbacRole(getRbacRole(baseRole, designation, email));
    }
  }, [user, currentRole]);

  const hasAccess = (path: string) => {
    return hasAccessToPath(rbacRole, path);
  };

  const hasWidget = (widgetName: string) => {
    return hasAccessToWidget(rbacRole, widgetName);
  };

  const isSuperAdmin = rbacRole === "Super Admin";

  return (
    <PermissionContext.Provider value={{ rbacRole, hasAccess, hasWidget, isSuperAdmin }}>
      {children}
    </PermissionContext.Provider>
  );
};

export const usePermission = () => {
  const context = useContext(PermissionContext);
  if (context === undefined) {
    throw new Error("usePermission must be used within a PermissionProvider");
  }
  return context;
};
