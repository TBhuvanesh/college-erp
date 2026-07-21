export type RbacRole =
  | "Super Admin"
  | "College Admin"
  | "HOD"
  | "Academic Coordinator"
  | "Placement Officer"
  | "Mentoring Head"
  | "Faculty"
  | "Student";

// Helper to resolve user roles and designations into detailed RBAC roles
export function getRbacRole(
  role: string | undefined | null,
  designation: string | undefined | null,
  email: string | undefined | null
): RbacRole {
  if (!role) return "Student";
  const r = role.toLowerCase();
  const d = designation?.toLowerCase() || "";
  const e = email?.toLowerCase() || "";

  if (r === "admin") {
    // Super Admin check
    if (d === "super_admin" || d === "system_administrator" || e === "admin@college.erp") {
      return "Super Admin";
    }
    return "College Admin";
  }

  if (r === "faculty") {
    if (d === "hod") return "HOD";
    if (d === "academic_coordinator" || d === "academic coordinator") return "Academic Coordinator";
    if (d === "placement_officer" || d === "placement officer") return "Placement Officer";
    if (d === "mentoring_head" || d === "mentoring head") return "Mentoring Head";
    
    // Check email fallback just in case simulation profile designations are empty
    if (e === "amit.sharma@college.erp") return "HOD";
    
    return "Faculty";
  }

  if (r === "student") {
    return "Student";
  }

  return "Student";
}

// Sidebar / Module access check
export function hasAccessToPath(role: RbacRole, path: string): boolean {
  const p = path.toLowerCase();

  // Student Access Rules
  if (role === "Student") {
    return (
      p.startsWith("/student/") || 
      p === "/student/dashboard" || 
      p === "/student/opportunities" || 
      p === "/student/mentorship" ||
      p === "/student/attendance" ||
      p === "/student/results" ||
      p === "/student/examinations" ||
      p === "/student/calendar" ||
      p === "/student/fees" ||
      p === "/student/lms" ||
      p === "/student/analytics" ||
      p === "/student/reports" ||
      p === "/student/profile" ||
      p === "/student/notifications"
    );
  }

  // Super Admin: unlimited access to all admin routes
  if (role === "Super Admin") {
    return p.startsWith("/admin/") || p === "/admin/dashboard";
  }

  // College Admin Access Rules (No maintenance/configuration/users endpoints)
  if (role === "College Admin") {
    if (
      p.includes("/accountants") ||
      p.includes("/database") ||
      p.includes("/config") ||
      p.includes("/settings") ||
      p.includes("/roles")
    ) {
      return false;
    }
    return p.startsWith("/admin/") || p === "/admin/dashboard";
  }

  // HOD Access Rules: department pages + standard workloads/planners
  if (role === "HOD") {
    if (p.startsWith("/hod/")) return true;
    if (
      p === "/faculty/dashboard" ||
      p === "/faculty/subjects" ||
      p === "/faculty/attendance" ||
      p === "/faculty/grades" ||
      p === "/faculty/examinations" ||
      p === "/faculty/results" ||
      p === "/faculty/calendar" ||
      p === "/faculty/teaching-planner" ||
      p === "/faculty/opportunities" ||
      p === "/faculty/mentorship" ||
      p === "/faculty/analytics" ||
      p === "/faculty/reports" ||
      p === "/faculty/invigilation" ||
      p === "/faculty/lms" ||
      p.startsWith("/faculty/lms/")
    ) {
      return true;
    }
    return false;
  }

  // Academic Coordinator Access Rules
  if (role === "Academic Coordinator") {
    return (
      p === "/faculty/dashboard" ||
      p === "/faculty/calendar" ||
      p === "/faculty/teaching-planner" ||
      p === "/faculty/examinations" ||
      p === "/faculty/analytics" ||
      p === "/faculty/reports" ||
      p === "/faculty/lms" ||
      p.startsWith("/faculty/lms/")
    );
  }

  // Placement Officer Access Rules
  if (role === "Placement Officer") {
    return (
      p === "/faculty/dashboard" ||
      p === "/faculty/opportunities" ||
      p === "/faculty/analytics" ||
      p === "/faculty/reports" ||
      p === "/faculty/lms" ||
      p.startsWith("/faculty/lms/")
    );
  }

  // Mentoring Head Access Rules
  if (role === "Mentoring Head") {
    return (
      p === "/faculty/dashboard" ||
      p === "/faculty/mentorship" ||
      p === "/faculty/analytics" ||
      p === "/faculty/reports" ||
      p === "/faculty/lms" ||
      p.startsWith("/faculty/lms/")
    );
  }

  // Faculty Access Rules (Standard teaching workload, grades, attendance, calendar)
  if (role === "Faculty") {
    return (
      p === "/faculty/dashboard" ||
      p === "/faculty/teaching-planner" ||
      p === "/faculty/subjects" ||
      p === "/faculty/attendance" ||
      p === "/faculty/grades" ||
      p === "/faculty/examinations" ||
      p === "/faculty/results" ||
      p === "/faculty/calendar" ||
      p === "/faculty/mentorship" ||
      p === "/faculty/analytics" ||
      p === "/faculty/reports" ||
      p === "/faculty/invigilation" ||
      p === "/faculty/lms" ||
      p.startsWith("/faculty/lms/")
    );
  }

  return false;
}

// Dashboard Widgets Scoping Check
export function hasAccessToWidget(role: RbacRole, widgetName: string): boolean {
  const w = widgetName.toLowerCase();

  // Student should not see administrative management blocks
  if (role === "Student") {
    return (
      w === "assignments" ||
      w === "calendar" ||
      w === "notifications" ||
      w === "events" ||
      w === "opportunities" ||
      w === "grades" ||
      w === "dues"
    );
  }

  // Faculty should not see billing/finances or department admin configs
  if (role === "Faculty" || role === "Academic Coordinator" || role === "Placement Officer" || role === "Mentoring Head") {
    if (w === "fees" || w === "department_settings" || w === "user_management") {
      return false;
    }
    
    // Coordinators specific
    if (role === "Academic Coordinator") {
      return w === "calendar" || w === "events" || w === "teaching_planner" || w === "exams" || w === "notifications";
    }

    // Placement Officers specific
    if (role === "Placement Officer") {
      return w === "opportunities" || w === "notifications" || w === "calendar" || w === "events";
    }

    // Mentoring Heads specific
    if (role === "Mentoring Head") {
      return w === "mentorship" || w === "notifications" || w === "calendar" || w === "events";
    }

    return true; // Standard faculty widgets
  }

  // Admin roles should not see student homework alerts or class workloads
  if (role === "Super Admin" || role === "College Admin") {
    if (w === "today_lesson" || w === "student_homework" || w === "assignment_submission_alerts") {
      return false;
    }
    
    // College Admin cannot access maintenance settings
    if (role === "College Admin") {
      return w !== "database_maintenance" && w !== "system_configuration";
    }
    
    return true;
  }

  return true;
}
