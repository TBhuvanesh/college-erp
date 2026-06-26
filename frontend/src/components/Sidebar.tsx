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
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Database,
  BookOpen,
  FileText,
  Briefcase
} from "lucide-react";

export const Sidebar: React.FC = () => {
  const pathname = usePathname() || "";
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const { logout } = useAuth();
  const {
    currentRole,
    students,
    faculty,
    currentStudentId,
    currentFacultyId,
    resetDatabase
  } = useSimulation();

  // Find current user profile names
  const activeStudent = students.find(s => s.id === currentStudentId);
  const activeFaculty = faculty.find(f => f.id === currentFacultyId);

  const getUserName = () => {
    if (currentRole === "Admin") return "Admin Control";
    if (currentRole === "Faculty") return activeFaculty?.name || "Dr. Amit Verma";
    return activeStudent?.name || "Rahul Sharma";
  };

  const getUserSub = () => {
    if (currentRole === "Admin") return "Super User";
    if (currentRole === "Faculty") return activeFaculty?.employeeId || "EMP-CS203";
    return activeStudent?.rollNo || "2026CSE001";
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

  const navGroups =
    currentRole === "Admin"
      ? adminNav
      : currentRole === "Faculty"
      ? facultyNav
      : studentNav;

  const handleReset = () => {
    if (confirm("Reset simulation database to initial academic state?")) {
      resetDatabase();
      router.push("/");
    }
  };

  return (
    <aside
      className={`hidden lg:flex flex-col border-r border-border-subtle bg-surface/95 backdrop-blur-xl transition-all duration-300 ease-in-out ${
        collapsed ? "w-20" : "w-64"
      } h-screen sticky top-0 text-text-secondary z-30`}
    >
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-border-subtle/50">
        {!collapsed && (
          <div className="flex items-center gap-3 min-w-0 pl-1">
            <img 
              src="/college_logo.jpeg" 
              className="w-7 h-7 rounded-[8px] border border-border-strong object-cover bg-surface shadow-sm shrink-0" 
              alt="SIET logo" 
            />
            <span className="font-semibold text-[13px] text-text-primary tracking-wide truncate">
              SIET PORTAL
            </span>
          </div>
        )}
        {collapsed && (
          <img 
            src="/college_logo.jpeg" 
            className="mx-auto w-7 h-7 rounded-[8px] border border-border-strong object-cover bg-surface shadow-sm" 
            alt="SIET logo" 
          />
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Role Tag & User Info */}
      <div className={`px-4 py-4 ${collapsed ? "items-center" : ""} flex flex-col gap-3 border-b border-border-subtle/50`}>
        {!collapsed ? (
          <div className="flex items-center gap-3 w-full group cursor-pointer hover:bg-surface-hover p-1.5 -ml-1.5 rounded-lg transition-colors">
            <div className="w-9 h-9 rounded-full bg-accent-blue-soft border border-accent-blue/30 flex items-center justify-center font-bold text-accent-blue">
              {getUserName().charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-semibold text-text-primary truncate">
                {getUserName()}
              </h4>
              <p className="text-[10px] text-text-muted truncate mt-0.5">
                {currentRole} • {getUserSub()}
              </p>
            </div>
          </div>
        ) : (
          <div className="w-9 h-9 rounded-full bg-accent-blue-soft border border-accent-blue/30 flex items-center justify-center font-bold text-accent-blue shrink-0 mx-auto">
            {getUserName().charAt(0)}
          </div>
        )}
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 custom-scrollbar space-y-6">
        {navGroups.map((group, groupIdx) => (
          <div key={groupIdx} className="space-y-1">
            {!collapsed && (
              <h3 className="px-3 text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">
                {group.section}
              </h3>
            )}
            <div className="space-y-0.5">
              {group.items.map(link => {
                const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
                const Icon = link.icon;
                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group ${
                      isActive
                        ? "bg-surface-elevated text-accent-blue border border-border-subtle shadow-sm"
                        : "text-text-secondary hover:text-text-primary hover:bg-surface-hover border border-transparent"
                    }`}
                  >
                    <Icon 
                      size={16} 
                      className={`${isActive ? "text-accent-blue" : "text-text-muted group-hover:text-text-secondary"}`} 
                    />
                    {!collapsed && <span>{link.name}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Action triggers */}
      <div className="p-3 border-t border-border-subtle/50 space-y-1">
        <button
          onClick={handleReset}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-hover transition cursor-pointer group"
        >
          <Database size={16} className="text-text-muted group-hover:text-text-secondary" />
          {!collapsed && <span>Reset Database</span>}
        </button>
        
        <button
          onClick={async () => {
            await logout();
            router.push("/");
          }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-text-secondary hover:text-danger hover:bg-danger-soft transition cursor-pointer text-left group"
        >
          <LogOut size={16} className="text-text-muted group-hover:text-danger" />
          {!collapsed && <span>Log Out</span>}
        </button>
      </div>
    </aside>
  );
};
