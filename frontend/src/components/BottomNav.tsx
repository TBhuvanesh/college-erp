"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSimulation } from "@/context/SimulationContext";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  CreditCard,
  Menu,
  Calendar,
  Briefcase
} from "lucide-react";

interface BottomNavProps {
  onMenuClick: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ onMenuClick }) => {
  const pathname = usePathname() || "";
  const { currentRole } = useSimulation();

  const getLinks = () => {
    if (currentRole === "Admin") {
      return [
        { name: "Home", href: "/admin/dashboard", icon: LayoutDashboard },
        { name: "Students", href: "/admin/students", icon: Users },
        { name: "Attendance", href: "/admin/attendance", icon: Calendar },
        { name: "Opportunities", href: "/admin/opportunities", icon: Briefcase }
      ];
    }
    if (currentRole === "Faculty") {
      return [
        { name: "Home", href: "/faculty/dashboard", icon: LayoutDashboard },
        { name: "Attendance", href: "/faculty/attendance", icon: Users },
        { name: "Opportunities", href: "/faculty/opportunities", icon: Briefcase },
        { name: "Grades", href: "/faculty/grades", icon: GraduationCap }
      ];
    }
    // Student
    return [
      { name: "Home", href: "/student/dashboard", icon: LayoutDashboard },
      { name: "Attendance", href: "/student/attendance", icon: Calendar },
      { name: "Opportunities", href: "/student/opportunities", icon: Briefcase },
      { name: "Results", href: "/student/results", icon: GraduationCap },
      { name: "Fees", href: "/student/fees", icon: CreditCard }
    ];
  };

  const links = getLinks();

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 border-t border-neutral-800 bg-neutral-900/90 backdrop-blur-md flex items-center justify-around px-2 pb-safe z-30">
      {links.map(link => {
        const isActive = pathname === link.href;
        const Icon = link.icon;
        return (
          <Link
            key={link.name}
            href={link.href}
            className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all ${
              isActive ? "text-indigo-400 font-semibold" : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <Icon size={20} className={isActive ? "text-indigo-400" : "text-neutral-400"} />
            <span className="text-[10px] tracking-tight">{link.name}</span>
          </Link>
        );
      })}
      
      {/* Menu / Switcher Button */}
      <button
        onClick={onMenuClick}
        className="flex flex-col items-center justify-center flex-1 h-full gap-1 text-neutral-400 hover:text-neutral-200 cursor-pointer"
      >
        <Menu size={20} />
        <span className="text-[10px] tracking-tight">More</span>
      </button>
    </div>
  );
};
