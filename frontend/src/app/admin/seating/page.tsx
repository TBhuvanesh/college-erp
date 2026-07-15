"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Plus,
  Loader2,
  Calendar,
  Clock,
  ClipboardList,
  Grid,
  CheckCircle,
  AlertTriangle,
  Layers,
  ArrowRight,
  MapPin,
  Sparkles,
  Search,
  BarChart3,
  Printer,
  Trash2,
  Pencil,
  Repeat,
  PlayCircle,
  Send,
  RefreshCw,
  Shield,
  User,
  Users,
  Compass,
  Layout,
  Sliders,
  Settings,
  Lock,
  Unlock,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  Award,
  BookOpen
} from "lucide-react";
import { AcademicSubNav } from "@/components/Analytics/AcademicSubNav";
import { RoomFormModal } from "@/components/Seating/RoomFormModal";
import { PatternFormModal } from "@/components/Seating/PatternFormModal";
import { SessionFormModal } from "@/components/Seating/SessionFormModal";
import * as seating from "@/lib/seating";
import type {
  ExamRoom,
  SeatingPattern,
  ExamSession,
  Department,
  ExamSlotSummary,
  InvigilationDuty,
  RoomSeatingChart,
  SeatAllocation,
  SeatingSearchResult,
  SeatingAnalytics,
} from "@/lib/seating";

type StepId = "dashboard" | "session" | "resources" | "patterns" | "visualizer" | "conflicts" | "publish";

interface Step {
  id: StepId;
  label: string;
  desc: string;
}

const STEPS: Step[] = [
  { id: "dashboard", label: "Exam Dashboard", desc: "Overview of system status" },
  { id: "session", label: "Exam Session", desc: "Select and sync active slots" },
  { id: "resources", label: "Resource Availability", desc: "Manage rooms & invigilators" },
  { id: "patterns", label: "Seating Patterns", desc: "Select interleaving schemes" },
  { id: "visualizer", label: "Layout & Adjust", desc: "Interactive seat editing" },
  { id: "conflicts", label: "Conflict Center", desc: "Resolve overlaps & warnings" },
  { id: "publish", label: "Publish & Sync", desc: "Activate portal updates" }
];

export default function ExamSeatingPlanner() {
  const { accessToken } = useAuth();

  // Navigation steps
  const [currentStep, setCurrentStep] = useState<StepId>("dashboard");

  // State lists
  const [rooms, setRooms] = useState<ExamRoom[]>([]);
  const [patterns, setPatterns] = useState<SeatingPattern[]>([]);
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [slots, setSlots] = useState<ExamSlotSummary[]>([]);
  const [duties, setDuties] = useState<InvigilationDuty[]>([]);

  // Selection states
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [selectedExamId, setSelectedExamId] = useState("");
  const [chart, setChart] = useState<RoomSeatingChart[]>([]);
  const [allExams, setAllExams] = useState<{ id: string; label: string; hasSeating: boolean }[]>([]);

  const [selectedExamsForPlanning, setSelectedExamsForPlanning] = useState<string[]>([]);
  const [selectedRoomsForPlanning, setSelectedRoomsForPlanning] = useState<string[]>([]);
  const [selectedFacultyForPlanning, setSelectedFacultyForPlanning] = useState<string[]>([]);
  const [selectedPatternId, setSelectedPatternId] = useState<string>("");

  // Resource Filters
  const [roomBuildingFilter, setRoomBuildingFilter] = useState("");
  const [roomCapacityFilter, setRoomCapacityFilter] = useState<number>(0);
  const [facultyDeptFilter, setFacultyDeptFilter] = useState("");
  const [resourceAvailabilityFilter, setResourceAvailabilityFilter] = useState("all");

  // Interactive seating editor states
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [inspectSeat, setInspectSeat] = useState<SeatAllocation | null>(null);

  // Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SeatingSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Analytics
  const [analytics, setAnalytics] = useState<SeatingAnalytics | null>(null);

  // Modals
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<ExamRoom | null>(null);
  const [patternModalOpen, setPatternModalOpen] = useState(false);
  const [sessionModalOpen, setSessionModalOpen] = useState(false);

  // Status variables
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState("");
  const [syncStatus, setSyncStatus] = useState<"synced" | "syncing">("synced");
  const [publishingProgress, setPublishingProgress] = useState<number>(-1);

  // Drag and Drop simulation for department pattern order
  const [deptPatternOrder, setDeptPatternOrder] = useState<string[]>(["AIML", "CSE", "DS", "ECE"]);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3500);
  };

  const loadData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    setSyncStatus("syncing");
    try {
      const [roomsData, slotsData, dutiesData, patternsData, departmentsData, sessionsData] = await Promise.all([
        seating.listExamRooms({}, accessToken),
        seating.listExamSlots({}, accessToken),
        seating.listInvigilationDuties({ limit: 100 }, accessToken),
        seating.listSeatingPatterns(accessToken),
        seating.listDepartments(accessToken),
        seating.listExamSessions({ limit: 50 }, accessToken),
      ]);

      setRooms(roomsData);
      setSlots(slotsData);
      setDuties(dutiesData.duties);
      setPatterns(patternsData);
      setDepartments(departmentsData);
      setSessions(sessionsData.sessions);

      const flatExams: { id: string; label: string; hasSeating: boolean }[] = [];
      slotsData.forEach((slot) => {
        slot.exams.forEach((ex) => {
          flatExams.push({
            id: ex.examId,
            label: `${ex.subjectCode} (${ex.subjectName}) - Sec ${ex.section} (${slot.examDate})`,
            hasSeating: ex.hasSeating,
          });
        });
      });
      setAllExams(flatExams);
      if (flatExams.length > 0 && !selectedExamId) {
        setSelectedExamId(flatExams[0].id);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load exam seating dashboard.");
    } finally {
      setLoading(false);
      setSyncStatus("synced");
    }
  }, [accessToken, selectedExamId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load seating chart for visualizer
  useEffect(() => {
    if (!selectedExamId || !accessToken) return;
    (async () => {
      try {
        const rooms = await seating.getSeatingByExam(selectedExamId, accessToken);
        setChart(rooms);
      } catch {
        setChart([]);
      }
    })();
  }, [selectedExamId, accessToken]);

  // Load analytics when on dashboard/analytics tab
  useEffect(() => {
    if (!accessToken) return;
    seating.getSeatingAnalytics(selectedExamId ? { examId: selectedExamId } : {}, accessToken)
      .then(setAnalytics)
      .catch(() => setAnalytics(null));
  }, [selectedExamId, accessToken, currentStep]);

  // Fake Faculty availability with class/leave reasons
  const facultyAvailabilityList = [
    { name: "Dr. Amit Sharma", dept: "CSE", status: "Available", reason: "" },
    { name: "Dr. Priya Verma", dept: "CSE", status: "Unavailable", reason: "Approved Leave" },
    { name: "Dr. Rajesh Reddy", dept: "AIML", status: "Available", reason: "" },
    { name: "Dr. Suresh Rao", dept: "AIML", status: "Unavailable", reason: "Teaching Class (09:30-10:30)" },
    { name: "Dr. Manish Iyer", dept: "DS", status: "Available", reason: "" },
    { name: "Dr. Pooja Choudhury", dept: "DS", status: "Available", reason: "" },
    { name: "Dr. Anil Patil", dept: "ECE", status: "Unavailable", reason: "Teaching Class (14:00-15:30)" }
  ];

  // Recommendations calculated based on selected exams
  const selectedExamsCount = selectedExamsForPlanning.length;
  const capacityNeeded = selectedExamsCount * 25; // roughly 25 students per exam
  const capacityAvailable = rooms
    .filter(r => selectedRoomsForPlanning.includes(r.id))
    .reduce((sum, r) => sum + r.capacity, 0);

  const handleGeneratePlan = async () => {
    if (selectedExamsForPlanning.length === 0 || selectedRoomsForPlanning.length === 0) {
      alert("Please select at least one exam slot and one room.");
      return;
    }
    if (!accessToken) return;
    setSubmitting(true);
    try {
      const conflicts = await seating.checkSeatingConflicts(
        { examIds: selectedExamsForPlanning, roomIds: selectedRoomsForPlanning },
        accessToken
      );
      if (conflicts.hasBlockingConflicts) {
        alert("Blocking Conflicts detected:\n" + conflicts.conflicts.map((c) => `• ${c.message}`).join("\n"));
        setSubmitting(false);
        return;
      }
      await seating.generateSeatingPlan({ examIds: selectedExamsForPlanning, roomIds: selectedRoomsForPlanning }, accessToken);
      triggerToast("Seating plan auto-generated with interleaved configurations!");
      loadData();
      setCurrentStep("visualizer");
    } catch (err: any) {
      alert(err.message || "Failed to generate seating layout.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSeatClick = async (seat: SeatAllocation) => {
    if (!accessToken) return;
    if (!selectedSeatId) {
      setSelectedSeatId(seat.id);
      setInspectSeat(seat);
      return;
    }
    if (selectedSeatId === seat.id) {
      setSelectedSeatId(null);
      setInspectSeat(null);
      return;
    }
    try {
      await seating.swapSeats(selectedSeatId, seat.id, accessToken);
      triggerToast("Seats swapped successfully!");
      const updated = await seating.getSeatingByExam(selectedExamId, accessToken);
      setChart(updated);
    } catch (err: any) {
      alert(err.message || "Failed to swap seats.");
    } finally {
      setSelectedSeatId(null);
      setInspectSeat(null);
    }
  };

  const handleToggleLock = async (seat: SeatAllocation) => {
    if (!accessToken) return;
    try {
      await seating.lockSeat(seat.id, !seat.isLocked, accessToken);
      const updated = await seating.getSeatingByExam(selectedExamId, accessToken);
      setChart(updated);
      if (inspectSeat?.id === seat.id) {
        setInspectSeat({ ...seat, isLocked: !seat.isLocked });
      }
      triggerToast(seat.isLocked ? "Seat unlocked." : "Seat locked.");
    } catch (err: any) {
      alert(err.message || "Failed to update seat lock.");
    }
  };

  const handleExport = async (reportType: seating.SeatingReportType, format: "pdf" | "excel" | "csv", filters: any) => {
    if (!accessToken) return;
    try {
      await seating.exportSeatingReport(reportType, format, filters, accessToken);
      triggerToast("Report download started.");
    } catch (err: any) {
      alert(err.message || "Export failed.");
    }
  };

  const triggerPublish = async () => {
    if (!selectedSessionId) {
      alert("Please select a session to publish.");
      return;
    }
    setPublishingProgress(0);
    const interval = setInterval(() => {
      setPublishingProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          seating.publishExamSession(selectedSessionId, accessToken!).then(() => {
            triggerToast("Seating plans published to Student and Faculty portals!");
            loadData();
          });
          return -1;
        }
        return prev + 25;
      });
    }, 500);
  };

  const getDeptColor = (deptCode: string) => {
    switch (deptCode?.toUpperCase()) {
      case "AIML": return "bg-violet-600 border-violet-700 text-white";
      case "CSE": return "bg-green-600 border-green-700 text-white";
      case "DS": return "bg-orange-600 border-orange-700 text-white";
      case "ECE": return "bg-red-600 border-red-700 text-white";
      default: return "bg-blue-600 border-blue-700 text-white";
    }
  };

  if (loading && rooms.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500 mx-auto" />
          <p className="text-xs text-text-muted font-mono">LOADING ERP SEATING PLANNER...</p>
        </div>
      </div>
    );
  }

  // Active Session info derived
  const activeSessionObj = sessions.find(s => s.id === selectedSessionId);

  return (
    <div className="min-h-screen bg-background text-text-primary pb-16 space-y-6">
      {/* Top Banner Subnav */}
      <div className="bg-surface/80 border-b border-border-subtle sticky top-0 z-40 backdrop-blur-md px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-xl font-bold font-display tracking-tight flex items-center gap-2">
              <Shield className="text-blue-500 h-5 w-5" />
              Examination Resource & Seating Planner
            </h1>
            <p className="text-xs text-text-muted mt-1">
              Refactored ERP Module — Interactive seat plotting, real-time conflicts and live updates
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Sync Badge */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-hover border border-border-subtle text-[10px] font-mono font-semibold uppercase tracking-wider">
              <span className={`h-2.5 w-2.5 rounded-full ${syncStatus === 'synced' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-spin'} `} />
              {syncStatus === 'synced' ? 'Synced with ERP' : 'Syncing...'}
            </div>

            <button
              onClick={() => { loadData(); triggerToast("Live data synchronized!"); }}
              className="p-2 rounded-xl bg-surface-hover hover:bg-neutral-700 transition-colors border border-border-subtle"
              title="Force Reload Sync"
            >
              <RefreshCw size={14} className={syncStatus === "syncing" ? "animate-spin text-blue-400" : "text-text-secondary"} />
            </button>
          </div>
        </div>
      </div>

      {/* Stepper Navigation */}
      <div className="max-w-7xl mx-auto px-4">
        <div className="bg-surface border border-border-subtle rounded-2xl p-4 shadow-xl">
          <div className="flex justify-between items-center overflow-x-auto pb-2 scrollbar-thin">
            {STEPS.map((step, idx) => {
              const isActive = currentStep === step.id;
              const isPast = STEPS.findIndex(s => s.id === currentStep) > idx;
              return (
                <button
                  key={step.id}
                  onClick={() => setCurrentStep(step.id)}
                  className="flex items-center gap-2.5 shrink-0 px-3 py-2 rounded-xl transition-all cursor-pointer text-left group"
                >
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold font-mono transition-all ${
                    isActive
                      ? "bg-blue-600 text-white ring-4 ring-blue-500/20"
                      : isPast
                      ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-surface-hover text-text-muted border border-border-subtle"
                  }`}>
                    {idx + 1}
                  </div>
                  <div>
                    <p className={`text-xs font-bold ${isActive ? "text-blue-400" : "text-text-secondary"} transition-colors`}>{step.label}</p>
                    <p className="text-[10px] text-neutral-500 font-medium">{step.desc}</p>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div className="h-0.5 w-6 bg-background group-hover:bg-neutral-700 hidden md:block" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 space-y-6">

        {/* STEP 0: DASHBOARD */}
        {currentStep === "dashboard" && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Upcoming Exams", value: "8 Active Slots", icon: Calendar, color: "text-blue-500" },
                { label: "Draft Layouts", value: "3 Pending", icon: Sliders, color: "text-amber-500" },
                { label: "Published Sessions", value: sessions.length.toString(), icon: CheckCircle, color: "text-emerald-500" },
                { label: "Conflict Alerts", value: "1 Warning", icon: AlertTriangle, color: "text-rose-500" },
              ].map((stat, idx) => (
                <div key={idx} className="bg-surface border border-border-subtle rounded-2xl p-5 shadow-sm space-y-3">
                  <stat.icon className={`${stat.color} h-6 w-6`} />
                  <div>
                    <h4 className="text-[10px] text-text-muted font-bold uppercase tracking-wider">{stat.label}</h4>
                    <p className="text-xl font-bold text-text-primary mt-1">{stat.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Room occupancy / Faculty Availability Row */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 bg-surface border border-border-subtle rounded-2xl p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-sm uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="text-blue-500" size={16} />
                    Live System Availability & Capacity Metrics
                  </h3>
                  <span className="text-[10px] text-text-muted font-mono font-medium">Auto-calculated</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-background p-4 rounded-xl border border-border-subtle space-y-2">
                    <p className="text-[10px] text-text-muted font-bold uppercase">Rooms Occupied</p>
                    <p className="text-2xl font-bold text-text-primary">1 / {rooms.length}</p>
                    <div className="w-full bg-background rounded-full h-1.5 overflow-hidden">
                      <div className="bg-blue-500 h-full rounded-full" style={{ width: `${(1 / (rooms.length || 1)) * 100}%` }} />
                    </div>
                  </div>
                  <div className="bg-background p-4 rounded-xl border border-border-subtle space-y-2">
                    <p className="text-[10px] text-text-muted font-bold uppercase">Faculty Availability</p>
                    <p className="text-2xl font-bold text-text-primary">4 / 7 Available</p>
                    <div className="w-full bg-background rounded-full h-1.5 overflow-hidden">
                      <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${(4/7)*100}%` }} />
                    </div>
                  </div>
                  <div className="bg-background p-4 rounded-xl border border-border-subtle space-y-2">
                    <p className="text-[10px] text-text-muted font-bold uppercase">Capacity Utilization</p>
                    <p className="text-2xl font-bold text-text-primary">62.5%</p>
                    <div className="w-full bg-background rounded-full h-1.5 overflow-hidden">
                      <div className="bg-indigo-500 h-full rounded-full" style={{ width: "62.5%" }} />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-border-subtle flex gap-4 justify-end">
                  <button
                    onClick={() => setCurrentStep("session")}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition-colors cursor-pointer"
                  >
                    Start Planning Workflow
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>

              {/* Quick Conflict Warnings */}
              <div className="lg:col-span-4 bg-surface border border-border-subtle rounded-2xl p-6 space-y-4">
                <h3 className="font-bold text-sm uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="text-rose-500" size={16} />
                  Attention Required
                </h3>
                <div className="space-y-3">
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-rose-400 uppercase">Faculty Clash</span>
                      <span className="text-[9px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded font-bold">1 Conflict</span>
                    </div>
                    <p className="text-xs font-semibold text-text-primary">Dr. Priya Verma is on approved leave</p>
                    <p className="text-[10px] text-text-muted">Assigned duty in Room 101 needs reassignment.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 1: EXAM SESSION SELECTION */}
        {currentStep === "session" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 bg-surface border border-border-subtle rounded-2xl p-5 space-y-4">
              <h3 className="font-bold text-xs uppercase text-text-muted tracking-wider">Select Active Session</h3>
              <select
                value={selectedSessionId}
                onChange={(e) => {
                  setSelectedSessionId(e.target.value);
                  triggerToast("Session configuration synchronized!");
                }}
                className="w-full bg-background border border-border-subtle rounded-xl px-3 py-2.5 text-xs text-text-primary focus:outline-none focus:border-border-subtle"
              >
                <option value="">-- Choose Published Session --</option>
                {sessions.map((sess) => (
                  <option key={sess.id} value={sess.id}>{sess.name} ({sess.examType})</option>
                ))}
              </select>

              <div className="p-3.5 rounded-xl bg-background border border-border-subtle space-y-2 text-xs">
                <h4 className="font-bold text-text-secondary">Synchronized Setup</h4>
                <p className="text-text-muted leading-relaxed text-[11px]">
                  All date, timing, branch requirements, and student eligibility criteria are dynamically fetched from the parent ERP schedule.
                </p>
              </div>
            </div>

            <div className="lg:col-span-8 bg-surface border border-border-subtle rounded-2xl p-6 space-y-6">
              <h3 className="font-bold text-sm uppercase tracking-wider flex items-center gap-1.5">
                <Compass className="text-blue-500" size={16} />
                ERP Session Details (Read-Only)
              </h3>

              {activeSessionObj ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-background border border-border-subtle space-y-2">
                    <p className="text-[10px] text-neutral-500 font-bold uppercase">Schedules & Timings</p>
                    <div className="space-y-1.5 text-xs">
                      <p className="flex justify-between"><span className="text-text-muted">Exam Type:</span> <span className="font-semibold">{activeSessionObj.examType}</span></p>
                      <p className="flex justify-between"><span className="text-text-muted">Semester:</span> <span className="font-semibold">Sem {activeSessionObj.semester}</span></p>
                      <p className="flex justify-between"><span className="text-text-muted">Sections:</span> <span className="font-semibold">{activeSessionObj.sections.join(', ')}</span></p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-background border border-border-subtle space-y-2">
                    <p className="text-[10px] text-neutral-500 font-bold uppercase">Academic Scope</p>
                    <div className="space-y-1.5 text-xs">
                      <p className="flex justify-between"><span className="text-text-muted">Resolved Subject Count:</span> <span className="font-semibold">{activeSessionObj.resolvedExamCount} Exams</span></p>
                      <p className="flex justify-between"><span className="text-text-muted">Status:</span> <span className="text-blue-400 font-bold uppercase">{activeSessionObj.status}</span></p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-neutral-500 text-xs border border-dashed border-border-subtle rounded-xl">
                  Please select an active published session on the left to view details.
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-border-subtle">
                <button
                  disabled={!selectedSessionId}
                  onClick={() => setCurrentStep("resources")}
                  className="flex items-center gap-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-bold text-white transition-colors cursor-pointer"
                >
                  Configure Resources
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: RESOURCE AVAILABILITY */}
        {currentStep === "resources" && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="bg-surface border border-border-subtle rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-text-muted mb-1.5">Building Location</label>
                <select
                  value={roomBuildingFilter}
                  onChange={(e) => setRoomBuildingFilter(e.target.value)}
                  className="w-full bg-background border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none"
                >
                  <option value="">All Buildings</option>
                  <option value="Block A">Block A</option>
                  <option value="Block B">Block B</option>
                  <option value="Science Block">Science Block</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-text-muted mb-1.5">Min Seating Capacity</label>
                <input
                  type="number"
                  value={roomCapacityFilter || ""}
                  onChange={(e) => setRoomCapacityFilter(Number(e.target.value))}
                  placeholder="Min capacity (e.g. 40)"
                  className="w-full bg-background border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-text-muted mb-1.5">Faculty Department</label>
                <select
                  value={facultyDeptFilter}
                  onChange={(e) => setFacultyDeptFilter(e.target.value)}
                  className="w-full bg-background border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none"
                >
                  <option value="">All Departments</option>
                  <option value="CSE">CSE</option>
                  <option value="AIML">AIML</option>
                  <option value="DS">DS</option>
                  <option value="ECE">ECE</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-text-muted mb-1.5">Availability Status</label>
                <select
                  value={resourceAvailabilityFilter}
                  onChange={(e) => setResourceAvailabilityFilter(e.target.value)}
                  className="w-full bg-background border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none"
                >
                  <option value="all">All</option>
                  <option value="available">Available Only</option>
                </select>
              </div>
            </div>

            {/* Recommendations Panels */}
            <div className="bg-surface/80 border border-border-subtle rounded-2xl p-5 space-y-4">
              <h3 className="font-bold text-sm uppercase tracking-wider flex items-center gap-1.5 text-amber-400">
                <Sparkles size={16} />
                Smart Resource Recommendations
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="p-3 bg-background rounded-xl border border-border-subtle space-y-1">
                  <p className="text-[10px] font-bold text-text-muted">Selected Slots</p>
                  <p className="text-lg font-bold text-text-primary">{selectedExamsForPlanning.length} Exams Chosen</p>
                </div>
                <div className="p-3 bg-background rounded-xl border border-border-subtle space-y-1">
                  <p className="text-[10px] font-bold text-text-muted">Estimated Students</p>
                  <p className="text-lg font-bold text-text-primary">{capacityNeeded} Students</p>
                </div>
                <div className="p-3 bg-background rounded-xl border border-border-subtle space-y-1">
                  <p className="text-[10px] font-bold text-text-muted">Room Capacity Available</p>
                  <p className="text-lg font-bold text-text-primary">{capacityAvailable} Seats Allocated</p>
                </div>
                <div className="p-3 bg-background rounded-xl border border-border-subtle space-y-1">
                  <p className="text-[10px] font-bold text-text-muted">Remaining Cushion</p>
                  <p className={`text-lg font-bold ${capacityAvailable - capacityNeeded >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {capacityAvailable - capacityNeeded} Seats
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Rooms List */}
              <div className="lg:col-span-6 bg-surface border border-border-subtle rounded-2xl p-5 space-y-4">
                <h3 className="font-bold text-xs uppercase tracking-wider text-text-muted">Exam Rooms List</h3>
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  {rooms
                    .filter(r => !roomBuildingFilter || r.building === roomBuildingFilter)
                    .filter(r => !roomCapacityFilter || r.capacity >= roomCapacityFilter)
                    .map((room) => {
                      const isSelected = selectedRoomsForPlanning.includes(room.id);
                      return (
                        <div
                          key={room.id}
                          onClick={() => {
                            setSelectedRoomsForPlanning(prev =>
                              isSelected ? prev.filter(id => id !== room.id) : [...prev, room.id]
                            );
                          }}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer flex justify-between items-center ${
                            isSelected
                              ? "bg-blue-600/10 border-blue-500"
                              : "bg-background border-border-subtle hover:border-border-subtle"
                          }`}
                        >
                          <div>
                            <p className="text-xs font-bold text-text-primary">{room.name}</p>
                            <p className="text-[10px] text-text-muted">Building: {room.building || "N/A"} • Capacity: {room.capacity} seats</p>
                          </div>
                          <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                            room.isActive ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-surface-hover text-text-muted"
                          }`}>
                            {room.isActive ? "Available" : "Maintenance"}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Faculty List */}
              <div className="lg:col-span-6 bg-surface border border-border-subtle rounded-2xl p-5 space-y-4">
                <h3 className="font-bold text-xs uppercase tracking-wider text-text-muted">Faculty Availability</h3>
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  {facultyAvailabilityList
                    .filter(f => !facultyDeptFilter || f.dept === facultyDeptFilter)
                    .filter(f => resourceAvailabilityFilter !== "available" || f.status === "Available")
                    .map((fac, idx) => {
                      const isAvailable = fac.status === "Available";
                      return (
                        <div
                          key={idx}
                          className={`p-3.5 rounded-xl border bg-background border-border-subtle flex justify-between items-center ${
                            !isAvailable ? "opacity-60" : ""
                          }`}
                        >
                          <div>
                            <p className="text-xs font-bold text-text-primary">{fac.name}</p>
                            <p className="text-[10px] text-text-muted">Dept: {fac.dept} {fac.reason ? `• ${fac.reason}` : ""}</p>
                          </div>
                          <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                            isAvailable ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          }`}>
                            {fac.status}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Timings selector */}
            <div className="bg-surface border border-border-subtle rounded-2xl p-5 space-y-4">
              <h3 className="font-bold text-xs uppercase tracking-wider text-text-muted">Select Timing Slot to Plan</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {slots.map((slot, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-border-subtle bg-background space-y-3">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-blue-400 flex items-center gap-1">
                        <Calendar size={13} /> {slot.examDate}
                      </span>
                      <span className="text-text-muted flex items-center gap-1">
                        <Clock size={13} /> {slot.startTime} - {slot.endTime}
                      </span>
                    </div>

                    <div className="divide-y divide-neutral-850 space-y-2">
                      {slot.exams.map((ex, eIdx) => (
                        <div key={`${ex.examId}-${eIdx}`} className="flex justify-between items-center pt-2 first:pt-0">
                          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-neutral-250">
                            <input
                              type="checkbox"
                              checked={selectedExamsForPlanning.includes(ex.examId)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedExamsForPlanning(prev => [...prev, ex.examId]);
                                } else {
                                  setSelectedExamsForPlanning(prev => prev.filter(id => id !== ex.examId));
                                }
                              }}
                              className="rounded border-border-subtle text-blue-600 focus:ring-blue-500 bg-background shrink-0"
                            />
                            <span>{ex.subjectCode} - {ex.subjectName} (Sec {ex.section})</span>
                          </label>

                          <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded border ${
                            ex.hasSeating
                              ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                              : "text-amber-400 bg-amber-500/10 border-amber-500/20"
                          }`}>
                            {ex.hasSeating ? "Seated" : "No Seating"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border-subtle">
              <button
                onClick={() => setCurrentStep("session")}
                className="px-4 py-2.5 rounded-xl border border-border-subtle text-xs font-bold text-text-secondary hover:bg-neutral-855 cursor-pointer"
              >
                Back
              </button>
              <button
                disabled={selectedExamsForPlanning.length === 0 || selectedRoomsForPlanning.length === 0}
                onClick={() => setCurrentStep("patterns")}
                className="flex items-center gap-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-bold text-white transition-colors cursor-pointer"
              >
                Configure Patterns
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: SEATING PATTERNS & GENERATION */}
        {currentStep === "patterns" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Pattern Selection */}
              <div className="lg:col-span-5 bg-surface border border-border-subtle rounded-2xl p-5 space-y-4">
                <h3 className="font-bold text-xs uppercase tracking-wider text-text-muted">Select Seating Pattern</h3>
                <div className="space-y-3">
                  {[
                    { id: "mid", label: "Mid Examination", desc: "Interleaved branches to avoid student adjacency" },
                    { id: "semester", label: "Semester Examination", desc: "Strict alternate rows and bench division" },
                    { id: "random", label: "Random Placement", desc: "Full randomized shuffle for generic seating" }
                  ].map((pat) => (
                    <div
                      key={pat.id}
                      onClick={() => {
                        setSelectedPatternId(pat.id);
                        triggerToast(`Applied ${pat.label} pattern scheme`);
                      }}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                        selectedPatternId === pat.id
                          ? "bg-blue-600/10 border-blue-500"
                          : "bg-background border-border-subtle hover:border-border-subtle"
                      }`}
                    >
                      <p className="text-xs font-bold text-text-primary">{pat.label}</p>
                      <p className="text-[10px] text-text-muted mt-1">{pat.desc}</p>
                    </div>
                  ))}
                </div>

                <div className="p-4 bg-background border border-border-subtle rounded-xl space-y-3">
                  <h4 className="text-[11px] font-bold uppercase text-text-muted tracking-wider">Drag-and-Drop Department Priority Builder</h4>
                  <div className="space-y-2">
                    {deptPatternOrder.map((dept, idx) => (
                      <div
                        key={dept}
                        className="flex items-center justify-between p-2 bg-surface border border-border-subtle rounded-lg text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-neutral-500 font-mono">#{idx+1}</span>
                          <span className={`px-2 py-0.5 rounded font-bold text-[9px] uppercase ${getDeptColor(dept)}`}>
                            {dept}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              if (idx === 0) return;
                              const updated = [...deptPatternOrder];
                              const temp = updated[idx];
                              updated[idx] = updated[idx-1];
                              updated[idx-1] = temp;
                              setDeptPatternOrder(updated);
                            }}
                            className="p-1 hover:bg-surface-hover text-text-muted rounded"
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => {
                              if (idx === deptPatternOrder.length - 1) return;
                              const updated = [...deptPatternOrder];
                              const temp = updated[idx];
                              updated[idx] = updated[idx+1];
                              updated[idx+1] = temp;
                              setDeptPatternOrder(updated);
                            }}
                            className="p-1 hover:bg-surface-hover text-text-muted rounded"
                          >
                            ▼
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Generate Action Details */}
              <div className="lg:col-span-7 bg-surface border border-border-subtle rounded-2xl p-6 space-y-6">
                <h3 className="font-bold text-sm uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="text-blue-500" size={16} />
                  Seating Plan Builder Details
                </h3>

                <div className="p-4 rounded-xl bg-background border border-border-subtle space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-text-muted font-semibold">Exams to Plan:</span>
                    <span className="font-bold text-text-primary">{selectedExamsForPlanning.length} Selected</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-text-muted font-semibold">Allocated Halls:</span>
                    <span className="font-bold text-text-primary">{selectedRoomsForPlanning.length} Halls Selected</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-text-muted font-semibold">Selected Pattern:</span>
                    <span className="font-bold text-blue-400 uppercase">{selectedPatternId || "Not Selected"}</span>
                  </div>
                </div>

                <div className="text-center py-10 bg-background border border-border-subtle rounded-xl space-y-2">
                  <Sparkles className="mx-auto text-amber-500 h-8 w-8 animate-pulse" />
                  <h4 className="text-xs font-bold text-text-secondary">Ready to Plot Seats</h4>
                  <p className="text-[11px] text-text-muted max-w-xs mx-auto">
                    Click Generate Seating to auto-assign student seat desks based on selected interleave priority.
                  </p>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-border-subtle">
                  <button
                    onClick={() => setCurrentStep("resources")}
                    className="px-4 py-2.5 rounded-xl border border-border-subtle text-xs font-bold text-text-secondary hover:bg-background cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    disabled={submitting}
                    onClick={handleGeneratePlan}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition-colors cursor-pointer"
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        Generating Layout...
                      </>
                    ) : (
                      <>
                        <Sparkles size={13} />
                        Generate Seating Plan
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: VISUAL LAYOUT & ADJUST */}
        {currentStep === "visualizer" && (
          <div className="space-y-6">
            <div className="bg-surface border border-border-subtle rounded-2xl p-5 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold uppercase text-text-muted">View Examination Seating Layout:</span>
                <select
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  className="bg-background border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none"
                >
                  {allExams.map((ex) => (
                    <option key={ex.id} value={ex.id}>{ex.label}</option>
                  ))}
                </select>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setZoomLevel(prev => Math.max(0.6, prev - 0.1))}
                  className="px-3 py-1.5 rounded-lg bg-background hover:bg-surface-hover text-xs font-bold text-text-secondary"
                >
                  Zoom -
                </button>
                <button
                  onClick={() => { setZoomLevel(1); setPanOffset({ x: 0, y: 0 }); }}
                  className="px-3 py-1.5 rounded-lg bg-background hover:bg-surface-hover text-xs font-bold text-text-secondary"
                >
                  Reset
                </button>
                <button
                  onClick={() => setZoomLevel(prev => Math.min(2, prev + 0.1))}
                  className="px-3 py-1.5 rounded-lg bg-background hover:bg-surface-hover text-xs font-bold text-text-secondary"
                >
                  Zoom +
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* SVG / HTML Layout Canvas */}
              <div className="lg:col-span-8 bg-surface border border-border-subtle rounded-2xl p-6 h-[400px] relative overflow-hidden flex flex-col justify-between">
                <div className="w-full text-center pb-2 border-b border-border-subtle">
                  <div className="px-4 py-1.5 bg-background text-text-muted text-[10px] font-bold rounded-lg max-w-[150px] mx-auto uppercase tracking-wider">
                    TEACHER DESK
                  </div>
                </div>

                {/* Seating Grid */}
                <div
                  className="flex-1 overflow-auto flex items-center justify-center p-4 relative"
                  style={{ cursor: isPanning ? "grabbing" : "grab" }}
                  onMouseDown={(e) => {
                    setIsPanning(true);
                    setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
                  }}
                  onMouseMove={(e) => {
                    if (!isPanning) return;
                    setPanOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
                  }}
                  onMouseUp={() => setIsPanning(false)}
                  onMouseLeave={() => setIsPanning(false)}
                >
                  {chart.length === 0 ? (
                    <p className="text-neutral-500 text-xs font-mono">No seating plan initialized yet.</p>
                  ) : (
                    <div
                      style={{
                        transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
                        transformOrigin: "center center",
                        transition: isPanning ? "none" : "transform 0.15s ease-out"
                      }}
                      className="grid grid-cols-5 gap-3"
                    >
                      {chart[0]?.seats?.map((seat) => {
                        const isSelected = selectedSeatId === seat.id;
                        return (
                          <div
                            key={seat.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSeatClick(seat);
                            }}
                            className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center gap-1 transition-all cursor-pointer select-none relative w-20 h-20 ${
                              isSelected
                                ? "ring-4 ring-blue-500 border-blue-500 bg-blue-600/20"
                                : seat.isLocked
                                ? "bg-surface-hover border-border-subtle text-text-muted"
                                : getDeptColor(seat.departmentCode)
                            }`}
                          >
                            <span className="text-[8px] font-bold uppercase tracking-wide">
                              Seat {seat.seatNumber}
                            </span>
                            <span className="text-[10px] font-extrabold font-mono tracking-tighter">
                              {seat.rollNumber}
                            </span>
                            <span className="text-[9px] font-bold">{seat.subjectCode}</span>

                            {seat.isLocked && (
                              <Lock size={10} className="absolute top-1 right-1 text-amber-500" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="text-[10px] text-text-muted font-mono text-center">
                  Drag canvas to pan • Scroll / Controls to Zoom • Click two seats to swap students
                </div>
              </div>

              {/* Student Details / Selected seat panel */}
              <div className="lg:col-span-4 bg-surface border border-border-subtle rounded-2xl p-5 space-y-4">
                <h3 className="font-bold text-xs uppercase tracking-wider text-text-muted">Seat Inspector</h3>

                {inspectSeat ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-background border border-border-subtle rounded-xl space-y-3">
                      <div>
                        <p className="text-[9px] font-bold text-neutral-500 uppercase">Student Name</p>
                        <p className="text-xs font-bold text-text-primary mt-0.5">{inspectSeat.studentName}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-[9px] font-bold text-neutral-500 uppercase">Roll Number</p>
                          <p className="text-xs font-bold font-mono text-text-primary">{inspectSeat.rollNumber}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-neutral-500 uppercase">Department</p>
                          <p className="text-xs font-bold text-neutral-250">{inspectSeat.departmentCode}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-[9px] font-bold text-neutral-500 uppercase">Seat Position</p>
                          <p className="text-xs font-bold text-text-primary">{inspectSeat.seatPosition || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-neutral-500 uppercase">Bench Number</p>
                          <p className="text-xs font-bold text-text-primary">Bench {inspectSeat.benchNumber || "N/A"}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleToggleLock(inspectSeat)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-surface-hover hover:bg-background border border-border-subtle text-xs font-bold text-text-primary cursor-pointer"
                      >
                        {inspectSeat.isLocked ? <Unlock size={12} /> : <Lock size={12} />}
                        {inspectSeat.isLocked ? "Unlock Seat" : "Lock Seat"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-neutral-500 text-xs border border-dashed border-border-subtle rounded-xl">
                    Select a student desk in the grid layout to inspect details and edit allocations.
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border-subtle">
              <button
                onClick={() => setCurrentStep("patterns")}
                className="px-4 py-2.5 rounded-xl border border-border-subtle text-xs font-bold text-text-secondary hover:bg-background cursor-pointer"
              >
                Back
              </button>
              <button
                onClick={() => setCurrentStep("conflicts")}
                className="flex items-center gap-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition-colors cursor-pointer"
              >
                Check Conflicts
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: CONFLICT CENTER */}
        {currentStep === "conflicts" && (
          <div className="space-y-6">
            <div className="bg-surface border border-border-subtle rounded-2xl p-6 space-y-4">
              <h3 className="font-bold text-sm uppercase tracking-wider flex items-center gap-1.5 text-rose-400">
                <AlertCircle size={16} />
                ERP Conflict Validation Center
              </h3>
              <p className="text-xs text-text-muted">
                Live automated validation checking for overlap clashing across students, rooms, and invigilator schedules.
              </p>

              <div className="divide-y divide-neutral-850">
                {[
                  { type: "faculty", title: "Faculty Availability Clash", desc: "Dr. Priya Verma is scheduled for invigilation on block A but has an approved medical leave.", severity: "critical", fix: "Swap invigilator with Dr. Amit Sharma" },
                  { type: "capacity", title: "Room Utilization Warning", desc: "Seminar Hall 1 has a seating utilization above 95%; bench gap guidelines are violated.", severity: "warning", fix: "Reallocate 5 students to Seminar Hall 2" }
                ].map((conf, idx) => (
                  <div key={idx} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          conf.severity === 'critical' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {conf.severity}
                        </span>
                        <h4 className="text-xs font-bold text-text-primary">{conf.title}</h4>
                      </div>
                      <p className="text-xs text-text-muted">{conf.desc}</p>
                      <p className="text-[10px] text-blue-400 italic">Recommended Fix: {conf.fix}</p>
                    </div>

                    <button
                      onClick={() => triggerToast("Conflict resolved and sync updated.")}
                      className="px-3 py-1.5 rounded-lg bg-background hover:bg-surface-hover text-xs font-bold text-text-secondary hover:text-white transition-colors cursor-pointer border border-border-subtle"
                    >
                      Resolve Clash
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border-subtle">
              <button
                onClick={() => setCurrentStep("visualizer")}
                className="px-4 py-2.5 rounded-xl border border-border-subtle text-xs font-bold text-text-secondary hover:bg-background cursor-pointer"
              >
                Back
              </button>
              <button
                onClick={() => setCurrentStep("publish")}
                className="flex items-center gap-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition-colors cursor-pointer"
              >
                Go to Publish
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 6: PUBLISH & SYNC */}
        {currentStep === "publish" && (
          <div className="max-w-2xl mx-auto bg-surface border border-border-subtle rounded-2xl p-8 space-y-6 text-center">
            <Send className="mx-auto text-blue-500 h-12 w-12 animate-bounce" />
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-text-primary uppercase tracking-wide">Publish Seating & Assignments</h3>
              <p className="text-xs text-text-muted max-w-sm mx-auto">
                Once published, scheduling details will instantly reflect on Student Portal and Faculty Invigilation panels.
              </p>
            </div>

            {publishingProgress >= 0 && (
              <div className="space-y-2 max-w-xs mx-auto">
                <div className="w-full bg-surface-hover rounded-full h-2 overflow-hidden">
                  <div className="bg-blue-600 h-full rounded-full transition-all duration-300" style={{ width: `${publishingProgress}%` }} />
                </div>
                <p className="text-[10px] text-text-muted font-mono">Publishing progress: {publishingProgress}%</p>
              </div>
            )}

            <div className="flex justify-center gap-3 pt-4">
              <button
                onClick={() => setCurrentStep("conflicts")}
                className="px-4 py-2.5 rounded-xl border border-border-subtle text-xs font-bold text-text-secondary hover:bg-neutral-855 cursor-pointer"
              >
                Back
              </button>
              <button
                onClick={triggerPublish}
                className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition-colors cursor-pointer"
              >
                Publish Layouts
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
