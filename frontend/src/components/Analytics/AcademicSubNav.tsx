"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSimulation } from "@/context/SimulationContext";
import { LayoutDashboard, BarChart3, FileSpreadsheet } from "lucide-react";

export const AcademicSubNav: React.FC = () => {
  const pathname = usePathname() || "";
  const { currentRole } = useSimulation();

  // Helper to map Simulation Context roles to routing path prefixes
  const getRolePath = () => {
    if (!currentRole) return "student";
    const roleLower = currentRole.toLowerCase();
    if (roleLower === "admin") return "admin";
    if (roleLower === "hod") return "hod";
    if (roleLower === "faculty") return "faculty";
    return "student";
  };

  const rolePath = getRolePath();

  const tabs = [
    {
      name: "Dashboard Overview",
      href: `/${rolePath}/dashboard`,
      icon: LayoutDashboard,
    },
    {
      name: "Academic Analytics",
      href: `/${rolePath}/analytics`,
      icon: BarChart3,
    },
    {
      name: "Report Center",
      href: `/${rolePath}/reports`,
      icon: FileSpreadsheet,
    },
  ];

  return (
    <div className="w-full border-b border-border-subtle bg-surface px-4 py-2 sticky top-0 z-10 backdrop-blur-md bg-surface/90">
      <div className="max-w-7xl mx-auto flex gap-1 sm:gap-2 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = pathname === tab.href;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? "bg-accent-blue/8 text-accent-blue border border-accent-blue/15 shadow-sm"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-hover border border-transparent"
              }`}
            >
              <Icon size={14} className={isActive ? "text-accent-blue" : "text-text-muted"} />
              <span>{tab.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};
