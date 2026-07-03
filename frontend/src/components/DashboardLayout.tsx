"use client";

import React, { useState } from "react";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { TopHeader } from "./TopHeader";
import Link from "next/link";
import { useSimulation } from "@/context/SimulationContext";
import { useAuth } from "@/context/AuthContext";
import { X, Database, LogOut, User } from "lucide-react";
import { useRouter } from "next/navigation";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { currentRole, resetDatabase } = useSimulation();
  const { logout } = useAuth();
  const router = useRouter();

  const handleReset = () => {
    if (confirm("Reset simulation data to default starting state?")) {
      resetDatabase();
      setMobileMenuOpen(false);
      router.push("/");
    }
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground font-sans">
      {/* Desktop Left Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <TopHeader />

        {/* Dynamic Inner Page Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto pb-24 lg:pb-6 max-w-7xl w-full mx-auto">
          {children}
        </main>

        {/* Mobile Sticky Bottom Nav */}
        <BottomNav onMenuClick={() => setMobileMenuOpen(true)} />
      </div>

      {/* Mobile Slide-up Menu Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity">
          {/* Bottom sheet card */}
          <div className="absolute bottom-0 left-0 right-0 max-h-[70vh] bg-surface border-t border-border-subtle rounded-t-2xl p-5 overflow-y-auto flex flex-col gap-4 animate-slide-up">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex flex-col">
                <span className="text-xs uppercase font-bold text-indigo-400">Simulation settings</span>
                <span className="text-sm font-semibold text-text-primary">Active role: {currentRole}</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-full bg-surface-elevated border border-border-subtle text-text-muted hover:text-text-primary cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content actions */}
            <div className="py-2 space-y-3">
              <p className="text-xs text-text-secondary leading-normal">
                To test the complete Golden Path flow, use the &quot;Switch Role&quot; dropdown in the header to jump between Admin, Faculty, and Student viewports. 
              </p>
              
              <div className="grid grid-cols-1 gap-2.5 pt-2">
                <Link
                  href={`/${currentRole.toLowerCase()}/profile`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full flex items-center justify-center gap-2.5 py-3 rounded-lg border dark:border-blue-500/20 border-blue-200 dark:bg-blue-500/5 bg-blue-50 dark:hover:bg-blue-500/10 hover:bg-blue-100 dark:text-blue-450 text-blue-700 text-sm font-semibold cursor-pointer"
                >
                  <User size={16} />
                  My Profile & Settings
                </Link>

                <button
                  onClick={handleReset}
                  className="w-full flex items-center justify-center gap-2.5 py-3 rounded-lg border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 text-amber-500 text-sm font-semibold cursor-pointer"
                >
                  <Database size={16} />
                  Reset Simulation Data
                </button>

                 <button
                  onClick={async () => {
                    await logout();
                    setMobileMenuOpen(false);
                    router.push("/");
                  }}
                  className="w-full flex items-center justify-center gap-2.5 py-3 rounded-lg border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-rose-500 text-sm font-semibold cursor-pointer"
                >
                  <LogOut size={16} />
                  Log Out / Role Lobby
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
