"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSimulation } from "@/context/SimulationContext";
import { useAuth } from "@/context/AuthContext";
import { ShieldCheck, UserCheck, GraduationCap, ChevronRight, ArrowLeft, Sun, Moon, MapPin, Phone, Mail, User, Lock, Loader2 } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const { theme, toggleTheme, announcements } = useSimulation();
  const { login, user } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      if (user.role === "admin") {
        router.push("/admin/dashboard");
      } else if (user.role === "faculty") {
        router.push("/faculty/dashboard");
      } else if (user.role === "student") {
        router.push("/student/dashboard");
      }
    }
  }, [user, router]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const normalizedUser = username.trim();

    if (!normalizedUser) {
      setError("Please enter a username.");
      return;
    }

    if (!password) {
      setError("Please enter a password.");
      return;
    }

    setSubmitting(true);
    try {
      await login(normalizedUser, password);
    } catch (err: any) {
      setError(err.message || "Failed to authenticate. Please check your credentials.");
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-neutral-950 font-sans relative overflow-hidden">
      {/* Background visual accents */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-blue-900/10 dark:bg-blue-900/5 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-blue-800/10 dark:bg-blue-800/5 blur-[100px] pointer-events-none"></div>

      {/* Floating Theme Toggle */}
      <div className="absolute top-4 right-4 z-20">
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-lg bg-white/60 dark:bg-neutral-900/60 hover:bg-white dark:hover:bg-neutral-800 border border-slate-200 dark:border-neutral-800 text-slate-700 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white cursor-pointer flex items-center justify-center transition shadow-sm"
          title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
        >
          {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
        </button>
      </div>

      {/* Main Grid Container */}
      <main className="flex-1 flex items-center justify-center max-w-6xl w-full mx-auto px-4 py-8 md:py-16 z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch w-full">
          
          {/* Left Column: Sreyas Info, Trust Signals, Campus Showcase */}
          <div className="lg:col-span-6 flex flex-col justify-between space-y-6">
            <div className="space-y-6">
              {/* Logo / Header Branding */}
              <div className="flex items-center gap-4">
                <img 
                  src="/college_logo.jpeg" 
                  alt="Sreyas Institute Emblem Logo" 
                  className="w-16 h-16 rounded-full border border-slate-200 dark:border-neutral-800 object-cover bg-white shadow-md shadow-blue-500/5" 
                />
                <div>
                  <h1 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                    Sreyas Institute of Engineering & Technology
                  </h1>
                  <span className="text-[10px] tracking-wider uppercase font-bold text-neutral-300 block mt-0.5">
                    Affiliated to JNTUH | Approved by AICTE | Accredited by NAAC
                  </span>
                </div>
              </div>

              {/* Campus Showcase Card */}
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-neutral-850 glass-card aspect-[16/10] w-full max-w-lg shadow-xl dark:shadow-none group transition-all duration-300 hover:shadow-blue-500/5 hover:border-slate-300 dark:hover:border-neutral-800">
                <img 
                  src="/college_campus.jpeg" 
                  alt="Sreyas Engineering Campus block" 
                  className="object-cover w-full h-full opacity-90 group-hover:scale-105 transition-transform duration-700 ease-out" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/20 to-transparent flex flex-col justify-end p-5">
                  <span className="text-[9px] uppercase font-bold text-white bg-blue-600 px-2 py-0.5 rounded tracking-wider font-mono self-start">CAMPUS SHOWCASE</span>
                  <h3 className="font-display font-bold text-white-always text-base mt-1">Main Engineering Block & Smart Classrooms</h3>
                  <p className="text-[10px] text-neutral-300-always mt-1 leading-normal max-w-md">
                    Home to cutting-edge research, computing grids, and innovative engineering workshops.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Contact Footer Info */}
            <div className="hidden lg:flex flex-col gap-1.5 text-[10px] text-neutral-500 pt-4 border-t border-slate-200 dark:border-neutral-900">
              <div className="flex items-center gap-1.5">
                <MapPin size={10} className="text-blue-500 shrink-0" />
                <span>Bandlaguda, Nagole, Hyderabad, Telangana 500068</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <Phone size={10} className="text-blue-500 shrink-0" />
                  <span>+91 9246323444</span>
                </div>
                <div className="flex items-center gap-1">
                  <Mail size={10} className="text-blue-500 shrink-0" />
                  <span>info@sreyas.ac.in</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Right Column: Premium Sign In Gate */}
          <div className="lg:col-span-6 flex flex-col justify-center">
            <div className="w-full max-w-md mx-auto">
              
              {/* Top Welcome Title (on Mobile) */}
              <div className="lg:hidden mb-6 text-center">
                <div className="flex justify-center mb-3">
                  <img src="/college_logo.jpeg" className="w-12 h-12 rounded-full border border-slate-200 dark:border-neutral-800 object-cover bg-white shadow-sm" alt="logo" />
                </div>
                <h2 className="font-display font-extrabold text-xl text-white">
                  Sreyas Institute of Engineering and Technology
                </h2>
                <p className="text-[10px] uppercase font-bold text-blue-500 tracking-wider mt-1 font-mono">
                  ACADEMIC INFORMATION SYSTEM (AIS)
                </p>
              </div>

              {/* Sign In Form */}
              <div className="glass-card rounded-xl border border-slate-200 dark:border-neutral-800 p-6 md:p-8 shadow-xl shadow-neutral-950/20 dark:shadow-none transition-all duration-300">
                <div className="mb-6">
                  <h3 className="font-display font-bold text-xl text-white">Academic ERP Portal</h3>
                  <p className="text-xs text-neutral-400 mt-1.5 leading-normal">
                    Enter your academic credentials below to access your courses, registers, and grading dashboards.
                  </p>
                </div>

                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  {error && (
                    <div className="p-3 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-500 animate-pulse">
                      {error}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Username</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                        <User size={14} />
                      </div>
                      <input
                        type="text"
                        required
                        placeholder="e.g., student, faculty, or admin"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 text-slate-800 dark:text-white text-xs font-semibold rounded focus:ring-2 transition-all duration-200"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Password</label>
                      <a 
                        href="#forgot" 
                        onClick={(e) => { e.preventDefault(); alert("Contact college IT helpdesk at helpdesk@sreyas.ac.in to reset credentials."); }} 
                        className="text-[10px] text-blue-500 hover:text-blue-600 transition font-bold"
                      >
                        Forgot Password?
                      </a>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                        <Lock size={14} />
                      </div>
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 text-slate-800 dark:text-white text-xs font-semibold rounded focus:ring-2 transition-all duration-200"
                      />
                    </div>
                  </div>

                   <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded shadow-md shadow-blue-600/10 cursor-pointer mt-5 transition duration-200 active:scale-[0.98] flex items-center justify-center gap-1.5 font-sans disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {submitting ? "Authenticating..." : "Authenticate & Enter Portal"}
                  </button>
                </form>
              </div>

              {/* Dynamic Announcements Bulletin */}
              {announcements && announcements.length > 0 && (
                <div className="mt-6 glass-panel border border-slate-200 dark:border-neutral-800 rounded-xl p-4 shadow-sm transition-all duration-300">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] uppercase font-bold text-blue-500 tracking-wider font-mono">Academic Announcement</span>
                    <span className="text-[9px] text-neutral-500">{announcements[0].date}</span>
                  </div>
                  <div className="mt-2">
                    <span className="font-semibold text-white text-xs block truncate">{announcements[0].title}</span>
                    <span className="text-[10px] text-neutral-400 leading-normal block mt-1 line-clamp-2">
                      {announcements[0].desc}
                    </span>
                  </div>
                </div>
              )}

              {/* Helpdesk Support Link */}
              <div className="mt-4 text-center">
                <a 
                  href="mailto:helpdesk@sreyas.ac.in" 
                  className="text-[10px] text-neutral-500 hover:text-neutral-350 dark:hover:text-neutral-300 transition-colors font-mono"
                >
                  Need assistance? Contact Academic IT Helpdesk
                </a>
              </div>

            </div>
          </div>

        </div>
      </main>

      {/* Footer institutional copyright */}
      <footer className="text-center py-6 border-t border-slate-200 dark:border-neutral-900 text-[10px] text-neutral-500 mt-auto z-10 font-mono">
        © 2026 Sreyas Institute of Engineering and Technology. AIS Single Sign-On Portal.
      </footer>
    </div>
  );
}
