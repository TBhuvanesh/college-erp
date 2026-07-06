"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSimulation } from "@/context/SimulationContext";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Calendar,
  CreditCard,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Database,
  BookOpen,
  FileText,
  Briefcase,
  PanelLeft,
} from "lucide-react";

export const Sidebar: React.FC = () => {
  const pathname = usePathname() || "";
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const {
    currentRole,
    students,
    currentStudentId,
    resetDatabase
  } = useSimulation();

  const activeStudent = students.find(s => s.id === currentStudentId);
  const authFaculty = user?.facultyProfile;

  const getUserName = () => {
    if (currentRole === "Admin") return "Admin Control";
    if (currentRole === "Accountant") return "Accounts Office";
    if (currentRole === "Faculty" || currentRole === "HOD") return authFaculty?.fullName || user?.email || "Faculty";
    return activeStudent?.name || "Rahul Sharma";
  };

  const getUserSub = () => {
    if (currentRole === "Admin") return "Super User";
    if (currentRole === "Accountant") return "Chief Accountant";
    if (currentRole === "Faculty" || currentRole === "HOD") return authFaculty?.employeeNumber || "Faculty";
    return activeStudent?.rollNo || "2026CSE001";
  };

  const getRoleBadgeClass = () => {
    if (currentRole === "Admin") return "dark:text-purple-400 text-purple-700 dark:bg-purple-500/10 bg-purple-50 dark:border-purple-500/20 border-purple-200";
    if (currentRole === "Faculty") return "dark:text-blue-400 text-blue-700 dark:bg-blue-500/10 bg-blue-50 dark:border-blue-500/20 border-blue-200";
    if (currentRole === "HOD") return "dark:text-amber-400 text-amber-700 dark:bg-amber-500/10 bg-amber-50 dark:border-amber-500/20 border-amber-200";
    if (currentRole === "Accountant") return "dark:text-indigo-400 text-indigo-700 dark:bg-indigo-500/10 bg-indigo-50 dark:border-indigo-500/20 border-indigo-200";
    return "dark:text-emerald-400 text-emerald-700 dark:bg-emerald-500/10 bg-emerald-50 dark:border-emerald-500/20 border-emerald-200";
  };

  type NavItem = { name: string; href: string; icon: React.ElementType };
  type NavGroup = { section: string; items: NavItem[] };

  const adminNav: NavGroup[] = [
    {
      section: "Overview",
      items: [
        { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
        { name: "Opportunity Hub", href: "/admin/opportunities", icon: Briefcase },
      ]
    },
    {
      section: "People",
      items: [
        { name: "Student Registry", href: "/admin/students", icon: Users },
        { name: "Faculty Roster", href: "/admin/faculty", icon: GraduationCap },
        { name: "Accountant Registry", href: "/admin/accountants", icon: Users },
      ]
    },
    {
      section: "Academics",
      items: [
        { name: "Curriculum Scheme", href: "/admin/courses", icon: BookOpen },
        { name: "Attendance Registry", href: "/admin/attendance", icon: Calendar },
        { name: "Examinations", href: "/admin/examinations", icon: FileText },
        { name: "Results Desk", href: "/admin/results", icon: GraduationCap },
        { name: "Academic Calendar", href: "/admin/calendar", icon: Calendar },
      ]
    },
    {
      section: "Finances",
      items: [
        { name: "Fee Management", href: "/admin/fees", icon: CreditCard },
      ]
    }
  ];

  const facultyNav: NavGroup[] = [
    {
      section: "Overview",
      items: [
        { name: "Dashboard", href: "/faculty/dashboard", icon: LayoutDashboard },
        { name: "Opportunity Hub", href: "/faculty/opportunities", icon: Briefcase },
      ]
    },
    {
      section: "Academics",
      items: [
        { name: "Teaching Workload", href: "/faculty/subjects", icon: BookOpen },
        { name: "Attendance Register", href: "/faculty/attendance", icon: Users },
        { name: "Internal Marks", href: "/faculty/grades", icon: FileText },
        { name: "Examinations", href: "/faculty/examinations", icon: Calendar },
        { name: "Results Entry", href: "/faculty/results", icon: GraduationCap },
        { name: "Academic Calendar", href: "/faculty/calendar", icon: Calendar },
      ]
    }
  ];

  const studentNav: NavGroup[] = [
    {
      section: "Overview",
      items: [
        { name: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard },
        { name: "Opportunity Hub", href: "/student/opportunities", icon: Briefcase },
      ]
    },
    {
      section: "Academics",
      items: [
        { name: "Attendance Logs", href: "/student/attendance", icon: Calendar },
        { name: "Semester Results", href: "/student/results", icon: GraduationCap },
        { name: "Examinations", href: "/student/examinations", icon: Calendar },
        { name: "Academic Calendar", href: "/student/calendar", icon: Calendar },
      ]
    },
    {
      section: "Finances",
      items: [
        { name: "Fee Ledger", href: "/student/fees", icon: CreditCard },
      ]
    }
  ];

  const hodNav: NavGroup[] = [
    {
      section: "Overview",
      items: [
        { name: "Dashboard", href: "/hod/dashboard", icon: LayoutDashboard },
        { name: "Opportunity Hub", href: "/faculty/opportunities", icon: Briefcase },
      ]
    },
    {
      section: "People",
      items: [
        { name: "Student Registry", href: "/hod/students", icon: Users },
        { name: "Faculty Roster", href: "/hod/faculty", icon: GraduationCap },
      ]
    },
    {
      section: "Academics (Admin)",
      items: [
        { name: "Class Schedules", href: "/hod/classes", icon: BookOpen },
        { name: "Attendance Registry", href: "/hod/attendance", icon: Calendar },
      ]
    },
    {
      section: "Teaching Desk",
      items: [
        { name: "Teaching Workload", href: "/faculty/subjects", icon: BookOpen },
        { name: "Attendance Register", href: "/faculty/attendance", icon: Users },
        { name: "Internal Marks", href: "/faculty/grades", icon: FileText },
        { name: "Examinations", href: "/faculty/examinations", icon: Calendar },
        { name: "Results Entry", href: "/faculty/results", icon: GraduationCap },
        { name: "Academic Calendar", href: "/faculty/calendar", icon: Calendar },
      ]
    }
  ];

  const accountantNav: NavGroup[] = [
    {
      section: "Overview",
      items: [
        { name: "Dashboard", href: "/accountant/dashboard", icon: LayoutDashboard },
      ]
    },
    {
      section: "Finances",
      items: [
        { name: "Student Fees", href: "/accountant/fees", icon: CreditCard },
      ]
    }
  ];

  const navGroups =
    currentRole === "Admin" ? adminNav :
    currentRole === "Faculty" ? facultyNav :
    currentRole === "HOD" ? hodNav :
    currentRole === "Accountant" ? accountantNav :
    studentNav;

  const handleReset = () => {
    if (confirm("Reset simulation database to initial academic state?")) {
      resetDatabase();
      router.push("/");
    }
  };

  return (
    <aside className={`hidden lg:flex flex-col border-r border-border-subtle bg-surface/98 backdrop-blur-xl transition-all duration-300 ease-in-out ${
      collapsed ? "w-[68px]" : "w-[232px]"
    } h-screen sticky top-0 z-30`}>

      {/* Brand / Logo */}
      <div className={`flex h-14 items-center border-b border-border-subtle/60 shrink-0 ${collapsed ? "justify-center px-4" : "justify-between px-4"}`}>
        {!collapsed && (
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/college_logo.jpeg"
              className="w-6 h-6 rounded-lg border border-border-strong object-cover bg-surface shadow-sm shrink-0"
              alt="SIET logo"
            />
            <span className="font-semibold text-[12px] text-text-primary tracking-wide truncate">
              SIET PORTAL
            </span>
          </div>
        )}
        {collapsed && (
          <img
            src="/college_logo.jpeg"
            className="w-6 h-6 rounded-lg border border-border-strong object-cover bg-surface shadow-sm"
            alt="SIET logo"
          />
        )}
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors cursor-pointer shrink-0"
            title="Collapse sidebar"
          >
            <PanelLeft size={14} />
          </button>
        )}
      </div>

      {/* Expand button when collapsed */}
      {collapsed && (
        <div className="flex items-center justify-center py-2 border-b border-border-subtle/60">
          <button
            onClick={() => setCollapsed(false)}
            className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
            title="Expand sidebar"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* User profile block */}
      <div className={`px-3 py-3 border-b border-border-subtle/60 shrink-0 ${collapsed ? "flex justify-center" : ""}`}>
        {!collapsed ? (
          <div className="flex items-center gap-2.5 group cursor-pointer hover:bg-surface-hover p-1.5 -mx-1.5 rounded-lg transition-colors">
            <div className="w-8 h-8 rounded-lg bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center font-bold text-sm text-accent-blue shrink-0">
              {getUserName().charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h4 className="text-[12px] font-semibold text-text-primary truncate leading-none">
                  {getUserName()}
                </h4>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider border ${getRoleBadgeClass()}`}>
                  {currentRole}
                </span>
                <span className="text-[10px] text-text-muted truncate font-mono">{getUserSub()}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-8 h-8 rounded-lg bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center font-bold text-sm text-accent-blue cursor-pointer hover:bg-accent-blue/15 transition-colors">
            {getUserName().charAt(0)}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 custom-scrollbar space-y-5">
        {navGroups.map((group, groupIdx) => (
          <div key={groupIdx}>
            {!collapsed && (
              <h3 className="px-2 text-[9px] font-black text-text-muted uppercase tracking-[0.12em] mb-1.5 select-none">
                {group.section}
              </h3>
            )}
            {collapsed && groupIdx > 0 && (
              <div className="mx-auto w-4 h-px bg-border-subtle mb-3" />
            )}
            <div className="space-y-0.5">
              {group.items.map(link => {
                const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
                const Icon = link.icon;
                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    title={collapsed ? link.name : undefined}
                    className={`relative flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 group ${
                      isActive
                        ? "bg-accent-blue/8 text-accent-blue"
                        : "text-text-secondary hover:text-text-primary hover:bg-surface-hover"
                    } ${collapsed ? "justify-center" : ""}`}
                  >
                    {/* Left active bar */}
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-accent-blue" />
                    )}
                    <Icon
                      size={15}
                      strokeWidth={isActive ? 2.5 : 2}
                      className={isActive ? "text-accent-blue shrink-0" : "text-text-muted group-hover:text-text-secondary shrink-0 transition-colors"}
                    />
                    {!collapsed && <span className="truncate">{link.name}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom actions */}
      <div className={`p-2 border-t border-border-subtle/60 space-y-0.5 shrink-0 ${collapsed ? "items-center flex flex-col" : ""}`}>
        <button
          onClick={handleReset}
          title={collapsed ? "Reset Database" : undefined}
          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] font-medium text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors cursor-pointer group w-full ${collapsed ? "justify-center" : ""}`}
        >
          <Database size={14} className="text-text-muted group-hover:text-text-secondary transition-colors shrink-0" />
          {!collapsed && <span>Reset Database</span>}
        </button>

        <button
          onClick={async () => {
            await logout();
            router.push("/");
          }}
          title={collapsed ? "Log Out" : undefined}
          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] font-medium text-text-secondary hover:text-danger hover:bg-danger/5 transition-colors cursor-pointer text-left group w-full ${collapsed ? "justify-center" : ""}`}
        >
          <LogOut size={14} className="text-text-muted group-hover:text-danger transition-colors shrink-0" />
          {!collapsed && <span>Log Out</span>}
        </button>
      </div>
    </aside>
  );
};
