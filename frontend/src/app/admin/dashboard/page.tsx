"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSimulation } from "@/context/SimulationContext";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import {
  Users,
  GraduationCap,
  Percent,
  DollarSign,
  PlusCircle,
  FileSpreadsheet,
  Activity,
  CheckCircle,
  Clock,
  Sparkles,
  ClipboardList,
  Bell,
  BookOpen,
  CalendarDays,
  Calendar,
  AlertCircle,
  Loader2,
  ArrowRight
} from "lucide-react";

// Import Reusable Dashboard Widgets
import { StatsCard } from "@/components/Dashboard/StatsCard";
import { ActivityFeed, ActivityItem } from "@/components/Dashboard/ActivityFeed";
import { UpcomingEventsWidget } from "@/components/Dashboard/UpcomingEventsWidget";
import { AssignmentWidget, FacultyAssignmentData } from "@/components/Dashboard/AssignmentWidget";
import { NotificationWidget } from "@/components/Dashboard/NotificationWidget";
import { CalendarWidget } from "@/components/Dashboard/CalendarWidget";
import { UnifiedEvent } from "@/components/CalendarView";

const BASE_DASHBOARD_TIME = Date.now();

export default function AdminDashboard() {
  const { accessToken } = useAuth();
  const {
    students,
    faculty,
    addStudent,
    addFaculty,
    generateInvoice
  } = useSimulation();

  // Modals state
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [facultyModalOpen, setFacultyModalOpen] = useState(false);
  
  // Success notifications
  const [toastMsg, setToastMsg] = useState("");

  // API Integration States
  const [apiStudents, setApiStudents] = useState<any[]>([]);
  const [apiFaculty, setApiFaculty] = useState<any[]>([]);
  const [apiSubjects, setApiSubjects] = useState<any[]>([]);
  const [apiAttendance, setApiAttendance] = useState<any[]>([]);
  const [apiFees, setApiFees] = useState<any[]>([]);
  const [apiExams, setApiExams] = useState<any[]>([]);
  const [apiAnnouncements, setApiAnnouncements] = useState<any[]>([]);
  const [apiEvents, setApiEvents] = useState<any[]>([]);
  const [apiLmsAssignments, setApiLmsAssignments] = useState<any[]>([]);
  const [apiSubmissions, setApiSubmissions] = useState<any[]>([]);
  const [apiNotifications, setApiNotifications] = useState<any[]>([]);
  const [apiPersonalEntries, setApiPersonalEntries] = useState<any[]>([]);
  const [apiOpportunities, setApiOpportunities] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(false);

  // Sync / Fetch function
  const loadAdminData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [studRes, facRes, subRes, attRes, feeRes, examRes, annRes, calRes, lmsRes, subLmsRes, notifRes, oppRes, persRes] = await Promise.all([
        apiFetch("/students?limit=500", {}, accessToken),
        apiFetch("/faculty?limit=500", {}, accessToken),
        apiFetch("/subjects?limit=500", {}, accessToken),
        apiFetch("/attendance?limit=1000", {}, accessToken),
        apiFetch("/fees?limit=1000", {}, accessToken),
        apiFetch("/examinations?limit=500", {}, accessToken),
        apiFetch("/announcements?limit=20", {}, accessToken),
        apiFetch("/calendar?limit=50", {}, accessToken),
        apiFetch("/lms/assignments?limit=50", {}, accessToken),
        apiFetch("/lms/submissions?limit=100", {}, accessToken),
        apiFetch("/notifications?limit=20", {}, accessToken),
        apiFetch("/opportunities?limit=50", {}, accessToken),
        apiFetch("/calendar-entries?limit=100", {}, accessToken)
      ]);

      if (studRes.success && studRes.data?.students) setApiStudents(studRes.data.students);
      if (facRes.success && facRes.data?.faculty) setApiFaculty(facRes.data.faculty);
      if (subRes.success && subRes.data?.subjects) setApiSubjects(subRes.data.subjects);
      if (attRes.success && attRes.data?.records) setApiAttendance(attRes.data.records);
      if (feeRes.success && feeRes.data?.fees) setApiFees(feeRes.data.fees);
      if (examRes.success && examRes.data?.exams) setApiExams(examRes.data.exams);
      if (annRes.success && annRes.data?.announcements) setApiAnnouncements(annRes.data.announcements);
      if (calRes.success && calRes.data?.events) setApiEvents(calRes.data.events);
      if (lmsRes.success && lmsRes.data?.assignments) setApiLmsAssignments(lmsRes.data.assignments);
      if (subLmsRes.success && subLmsRes.data?.submissions) setApiSubmissions(subLmsRes.data.submissions);
      if (notifRes.success && notifRes.data?.notifications) setApiNotifications(notifRes.data.notifications);
      if (oppRes.success && oppRes.data?.opportunities) setApiOpportunities(oppRes.data.opportunities);
      if (persRes.success && persRes.data?.entries) setApiPersonalEntries(persRes.data.entries);
    } catch (err) {
      console.error("Admin dashboard failed to load API data", err);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadAdminData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadAdminData]);

  // Form states
  const [studentForm, setStudentForm] = useState({
    name: "",
    rollNo: "",
    email: "",
    department: "CSE",
    semester: "Semester 3",
  });

  const [invoiceForm, setInvoiceForm] = useState({
    studentId: "",
    type: "Academic Tuition Fee",
    amount: "106000",
    dueDate: "2026-07-15",
  });

  const [facultyForm, setFacultyForm] = useState({
    name: "",
    employeeId: "",
    email: "",
    department: "CSE",
    subjectId: "cs-301",
    semester: "Semester 3",
  });

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  };

  // Mark notification read
  const handleMarkNotificationRead = async (id: string) => {
    if (!accessToken) return;
    try {
      const res = await apiFetch(`/notifications/${id}/read`, { method: "PUT" }, accessToken);
      if (res.success) {
        setApiNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
        );
        window.dispatchEvent(new Event("notificationUpdate"));
      }
    } catch (err) {
      console.error("Failed to mark notification as read", err);
    }
  };

  // 1. Math metrics counts
  const totalStudents = apiStudents.length;
  const activeFaculty = apiFaculty.length;
  const totalSubjects = apiSubjects.length;
  
  // 2. Fee Collection Summary
  const totalTarget = apiFees.reduce((acc, curr) => acc + (curr.totalAmount || curr.amount || 0), 0);
  const totalCollected = apiFees.reduce((acc, curr) => acc + (curr.paidAmount || (curr.status === "Paid" ? curr.amount : 0)), 0);
  const outstandingFees = apiFees.reduce((acc, curr) => acc + (curr.pendingAmount || (curr.status !== "Paid" ? curr.amount : 0)), 0);

  // 3. Average Attendance
  const avgAttendance = (() => {
    if (apiAttendance.length === 0) return "0.0";
    const present = apiAttendance.filter(att => att.status === "present" || att.status === "Present" || att.status === "Late").length;
    return ((present / apiAttendance.length) * 100).toFixed(1);
  })();

  // 4. Examination Statistics
  const examStats = (() => {
    const scheduled = apiExams.filter(ex => ex.status === "Scheduled").length;
    const ongoing = apiExams.filter(ex => ex.status === "Ongoing").length;
    const completed = apiExams.filter(ex => ex.status === "Completed").length;
    return { scheduled, ongoing, completed, total: apiExams.length };
  })();

  // 5. Activity Feed Generation
  const activitiesList: ActivityItem[] = React.useMemo(() => {
    const list: ActivityItem[] = [];

    // Admissions
    apiStudents.slice(-10).forEach((stud) => {
      list.push({
        id: `stud-${stud.id}`,
        title: "Student Registered",
        description: `${stud.name} (${stud.rollNo}) registered under ${stud.department} department.`,
        timestamp: stud.createdAt || new Date(BASE_DASHBOARD_TIME - 3600000 * 4).toISOString(),
        type: "registration",
        meta: stud.semester
      });
    });

    // Faculty Onboarding
    apiFaculty.slice(-10).forEach((fac) => {
      list.push({
        id: `fac-${fac.id}`,
        title: "Faculty Onboarded",
        description: `Professor ${fac.name} added to ${fac.department} staff rolls.`,
        timestamp: fac.createdAt || new Date(BASE_DASHBOARD_TIME - 3600000 * 8).toISOString(),
        type: "faculty"
      });
    });

    // LMS submissions
    apiSubmissions.slice(-15).forEach((sub) => {
      list.push({
        id: `sub-${sub.id}`,
        title: "Assignment Submissions",
        description: `Student ${sub.studentName} uploaded homework for ${sub.assignmentTitle || "Coursework"}.`,
        timestamp: sub.submittedAt || new Date(BASE_DASHBOARD_TIME - 3600000 * 2).toISOString(),
        type: "submission",
        meta: sub.status
      });
    });

    // Sort by timestamp descending
    return list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [apiStudents, apiFaculty, apiSubmissions]);

  // 6. Unified events for Calendar/Upcoming widgets
  const mappedAcademicEvents = apiEvents.map((ev: any) => ({
    id: ev.id,
    title: ev.title,
    description: ev.description,
    startDate: ev.startDate,
    endDate: ev.endDate,
    eventType: ev.eventType === "Holiday" ? "Holiday" : "Academic Event",
    sourceModule: "academic_calendar" as const,
    sourceLabel: "Academic Desk",
    departmentId: ev.departmentId,
    departmentName: ev.departmentName,
    semester: ev.semester,
    targetAudience: ev.targetAudience,
    rawEvent: ev
  }));

  const mappedLmsEvents = apiLmsAssignments.map((a: any) => ({
    id: a.id,
    title: a.title,
    description: a.description || null,
    startDate: a.dueDate,
    endDate: null,
    eventType: "Assignment Deadline",
    sourceModule: "lms_assignment" as const,
    sourceLabel: "LMS Desk",
    departmentId: null,
    departmentName: null,
    semester: a.semester || null
  }));

  const mappedOpportunityEvents = apiOpportunities.map((o: any) => ({
    id: o.id,
    title: o.title,
    description: o.description,
    startDate: o.startDate || o.deadline,
    endDate: o.deadline,
    eventType: o.type === "Placement Drive" ? "Placement Drive" : "Internship Deadline",
    sourceModule: "opportunity" as const,
    sourceLabel: "Opportunity Hub",
    departmentId: o.departmentId,
    departmentName: o.departmentName,
    semester: null
  }));

  const mappedPersonalEvents = apiPersonalEntries.map((e: any) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    startDate: e.startDate,
    endDate: e.endDate,
    eventType: e.eventType === "Meeting" ? "Workshop" : e.eventType === "Reminder" ? "Personal Reminder" : "Personal Reminder",
    sourceModule: "personal_calendar" as const,
    sourceLabel: e.isOwner ? "Personal" : "Department Desk",
    departmentId: e.departmentId,
    departmentName: e.departmentName,
    semester: e.semester,
    isOwner: e.isOwner,
    rawEvent: e
  }));

  const unifiedEvents: UnifiedEvent[] = [
    ...mappedAcademicEvents,
    ...mappedLmsEvents,
    ...mappedOpportunityEvents,
    ...mappedPersonalEvents
  ];

  // 7. LMS Assignments summary
  const facultyAssignmentData: FacultyAssignmentData[] = apiLmsAssignments.map((a: any) => {
    const submissionsForAssignment = apiSubmissions.filter((s: any) => s.assignmentId === a.id);
    const totalSubmissions = submissionsForAssignment.length;
    const pendingEvaluations = submissionsForAssignment.filter((s: any) => s.status === "Submitted" || s.status === "Late Submission").length;
    
    return {
      id: a.id,
      title: a.title,
      subjectName: a.subjectName,
      dueDate: a.dueDate,
      pendingEvaluations,
      totalSubmissions
    };
  });

  // Mock Pending Maker-Checker Approvals
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);

  // Form Submissions
  const handleAddStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentForm.name || !studentForm.rollNo || !studentForm.email) {
      alert("Please enter all fields");
      return;
    }
    const created = addStudent({
      ...studentForm,
      status: "Good Standing",
      program: "B.Tech CSE",
      advisor: "Dr. Amit Verma",
      advisorEmail: "amit.verma@sreyas.ac.in"
    });
    setStudentForm({
      name: "",
      rollNo: "",
      email: "",
      department: "CSE",
      semester: "Semester 3"
    });
    setStudentModalOpen(false);
    triggerToast(`Student ${created.name} successfully registered in registry!`);
    loadAdminData();
  };

  const handleGenerateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceForm.studentId) {
      alert("Please select a student");
      return;
    }
    const targetStud = apiStudents.find(s => s.id === invoiceForm.studentId) || students.find(s => s.id === invoiceForm.studentId);
    if (!targetStud) return;

    const created = generateInvoice({
      studentId: invoiceForm.studentId,
      studentName: targetStud.name,
      studentRollNo: targetStud.rollNo,
      semester: targetStud.semester,
      type: invoiceForm.type,
      amount: parseFloat(invoiceForm.amount) || 106000,
      dueDate: invoiceForm.dueDate
    });

    setInvoiceModalOpen(false);
    triggerToast(`Fee Invoice generated for ${created.studentName}: ₹${created.amount.toLocaleString('en-IN')}`);
    loadAdminData();
  };

  const handleAddFaculty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!facultyForm.name || !facultyForm.employeeId || !facultyForm.email) {
      alert("Please enter all fields");
      return;
    }
    
    const subjName = facultyForm.subjectId === "cs-301" 
      ? "CS-301: Database Management Systems" 
      : "CS-302: Design & Analysis of Algorithms";

    const created = addFaculty({
      name: facultyForm.name,
      employeeId: facultyForm.employeeId,
      email: facultyForm.email,
      department: facultyForm.department,
      assignedSubjects: [
        { subjectId: facultyForm.subjectId, subjectName: subjName, semester: facultyForm.semester }
      ],
      status: "Active"
    });

    setFacultyForm({
      name: "",
      employeeId: "",
      email: "",
      department: "CSE",
      subjectId: "cs-301",
      semester: "Semester 3"
    });
    setFacultyModalOpen(false);
    triggerToast(`Faculty ${created.name} onboarded and subject allocated successfully!`);
    loadAdminData();
  };

  const handleApprove = (id: string) => {
    setPendingApprovals(prev => prev.filter(app => app.id !== id));
    triggerToast(`Approval request successfully authorized (Checker action).`);
  };

  return (
    <div className="space-y-6 relative pb-12">
      {/* Toast Alert */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-blue-600 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-xl shadow-blue-600/20 border border-blue-400/20 animate-fade-in">
          <Sparkles size={14} className="animate-pulse" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Banner Message */}
      <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-blue-400">Institutional ERP Administration Module</h2>
          <p className="text-xs text-neutral-400 mt-1 max-w-xl">
            You are operating the administrative backend engine. Navigate sidebar routes or use the quick links below to manage student directories, faculty workload rosters, curricula, tuition billing, and exam schedules.
          </p>
        </div>
        <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 rounded-md px-2 py-1 text-[10px] text-blue-400 font-mono">
          <Activity size={10} className="animate-pulse" />
          <span>ACADEMIC YEAR: 2026-27</span>
        </div>
      </div>

      {loading && (
        <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-mono rounded-lg flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Syncing real-time database records...</span>
        </div>
      )}

      {/* Stats Cards Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatsCard
          title="Total Students"
          value={loading ? "..." : totalStudents}
          icon={Users}
          description="Enrolled student catalog"
          iconClass="bg-blue-500/10 text-blue-400 border border-blue-500/20"
        />
        <StatsCard
          title="Total Faculty"
          value={loading ? "..." : activeFaculty}
          icon={GraduationCap}
          description="Academic staff roster"
          iconClass="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
        />
        <StatsCard
          title="Syllabus Subjects"
          value={loading ? "..." : totalSubjects}
          icon={BookOpen}
          description="Courses catalogue list"
          iconClass="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
        />
        <StatsCard
          title="Average Attendance"
          value={loading ? "..." : `${avgAttendance}%`}
          icon={Percent}
          description="Daily campus attendance"
          iconClass="bg-amber-500/10 text-amber-400 border border-amber-500/20"
        />
        <StatsCard
          title="Outstanding Fees"
          value={loading ? "..." : `₹${outstandingFees.toLocaleString('en-IN')}`}
          icon={DollarSign}
          description={`Target: ₹${totalTarget.toLocaleString('en-IN')}`}
          iconClass="bg-rose-500/10 text-rose-400 border border-rose-500/20"
        />
      </div>

      {/* Quick Action Navigation Grid */}
      <div className="glass-card border border-neutral-800 rounded-xl p-5">
        <h3 className="font-display font-bold text-white text-xs uppercase tracking-wider mb-4">Directories & Management Desks</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          <Link
            href="/admin/students"
            className="flex flex-col items-center justify-center p-4 rounded-lg border border-neutral-800 bg-neutral-950/45 hover:bg-neutral-800/10 hover:border-blue-500/25 transition text-center group cursor-pointer"
          >
            <Users size={20} className="text-blue-400 group-hover:scale-110 transition-transform mb-2" />
            <span className="text-xs font-bold text-white">Students</span>
            <span className="text-[9px] text-neutral-500 mt-0.5">Manage directory</span>
          </Link>

          <Link
            href="/admin/faculty"
            className="flex flex-col items-center justify-center p-4 rounded-lg border border-neutral-800 bg-neutral-950/45 hover:bg-neutral-800/10 hover:border-emerald-500/25 transition text-center group cursor-pointer"
          >
            <GraduationCap size={20} className="text-emerald-400 group-hover:scale-110 transition-transform mb-2" />
            <span className="text-xs font-bold text-white">Faculty</span>
            <span className="text-[9px] text-neutral-500 mt-0.5">Manage staff rolls</span>
          </Link>

          <Link
            href="/admin/courses"
            className="flex flex-col items-center justify-center p-4 rounded-lg border border-neutral-800 bg-neutral-950/45 hover:bg-neutral-800/10 hover:border-indigo-500/25 transition text-center group cursor-pointer"
          >
            <BookOpen size={20} className="text-indigo-400 group-hover:scale-110 transition-transform mb-2" />
            <span className="text-xs font-bold text-white">Curriculum</span>
            <span className="text-[9px] text-neutral-500 mt-0.5">Configure subjects</span>
          </Link>

          <Link
            href="/admin/fees"
            className="flex flex-col items-center justify-center p-4 rounded-lg border border-neutral-800 bg-neutral-950/45 hover:bg-neutral-800/10 hover:border-rose-500/25 transition text-center group cursor-pointer"
          >
            <DollarSign size={20} className="text-rose-400 group-hover:scale-110 transition-transform mb-2" />
            <span className="text-xs font-bold text-white">Manage Fees</span>
            <span className="text-[9px] text-neutral-500 mt-0.5">Billing accounts</span>
          </Link>

          <Link
            href="/admin/calendar"
            className="flex flex-col items-center justify-center p-4 rounded-lg border border-neutral-800 bg-neutral-950/45 hover:bg-neutral-800/10 hover:border-amber-500/25 transition text-center group cursor-pointer"
          >
            <CalendarDays size={20} className="text-amber-400 group-hover:scale-110 transition-transform mb-2" />
            <span className="text-xs font-bold text-white">Calendar</span>
            <span className="text-[9px] text-neutral-500 mt-0.5">Manage schedules</span>
          </Link>

          <Link
            href="/admin/announcements"
            className="flex flex-col items-center justify-center p-4 rounded-lg border border-neutral-800 bg-neutral-950/45 hover:bg-neutral-800/10 hover:border-rose-500/25 transition text-center group cursor-pointer"
          >
            <Bell size={20} className="text-rose-400 group-hover:scale-110 transition-transform mb-2" />
            <span className="text-xs font-bold text-white">Notices Desk</span>
            <span className="text-[9px] text-neutral-500 mt-0.5">Post bulletins</span>
          </Link>

          <Link
            href="/admin/lms"
            className="flex flex-col items-center justify-center p-4 rounded-lg border border-neutral-800 bg-neutral-950/45 hover:bg-neutral-800/10 hover:border-indigo-500/25 transition text-center group cursor-pointer"
          >
            <BookOpen size={20} className="text-indigo-450 group-hover:scale-110 transition-transform mb-2" />
            <span className="text-xs font-bold text-white">LMS Portal</span>
            <span className="text-[9px] text-neutral-500 mt-0.5">View Courseware</span>
          </Link>
        </div>
      </div>

      {/* Main Grid Command Centers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Calendar selector & Roadmap */}
        <div className="space-y-6 lg:col-span-1">
          <CalendarWidget
            events={unifiedEvents}
            loading={loading}
            role="admin"
          />
          <UpcomingEventsWidget
            events={unifiedEvents}
            loading={loading}
            role="admin"
          />
        </div>

        {/* Center/Right Column: Live Activity Feed, Notifications, LMS & charts */}
        <div className="space-y-6 lg:col-span-2">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <NotificationWidget
              notifications={apiNotifications}
              loading={loading}
              onMarkRead={handleMarkNotificationRead}
              role="admin"
            />
            <AssignmentWidget
              facultyData={facultyAssignmentData}
              loading={loading}
              role="admin"
            />
          </div>

          <ActivityFeed
            activities={activitiesList}
            loading={loading}
            maxItems={6}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Quick Registration Actions */}
            <div className="glass-card rounded-xl border border-neutral-800 p-5 space-y-4">
              <h3 className="font-display font-bold text-white text-base">Quick Workflows</h3>
              <div className="space-y-3">
                <button
                  onClick={() => setStudentModalOpen(true)}
                  className="w-full flex items-center gap-3 p-3.5 rounded-lg border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 text-blue-400 transition text-left cursor-pointer group"
                >
                  <PlusCircle size={20} className="group-hover:scale-110 transition-transform" />
                  <div>
                    <h4 className="text-xs font-bold text-white leading-tight">Onboard Student</h4>
                    <p className="text-[9px] text-neutral-400 mt-0.5">Register new profile</p>
                  </div>
                </button>

                <button
                  onClick={() => setFacultyModalOpen(true)}
                  className="w-full flex items-center gap-3 p-3.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-400 transition text-left cursor-pointer group"
                >
                  <PlusCircle size={20} className="group-hover:scale-110 transition-transform" />
                  <div>
                    <h4 className="text-xs font-bold text-white leading-tight">Onboard Faculty</h4>
                    <p className="text-[9px] text-neutral-400 mt-0.5">Onboard staff & allocate</p>
                  </div>
                </button>

                <button
                  onClick={() => setInvoiceModalOpen(true)}
                  className="w-full flex items-center gap-3 p-3.5 rounded-lg border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 text-amber-400 transition text-left cursor-pointer group"
                >
                  <PlusCircle size={20} className="group-hover:scale-110 transition-transform" />
                  <div>
                    <h4 className="text-xs font-bold text-white leading-tight">Issue Fee Invoice</h4>
                    <p className="text-[9px] text-neutral-400 mt-0.5">Generate student bill</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Fee Collection Chart & Checker queue */}
            <div className="glass-card rounded-xl border border-neutral-800 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-white text-base">Collections Summary</h3>
                <span className="text-[9px] text-neutral-450 font-mono">Billed: ₹{totalTarget.toLocaleString('en-IN')}</span>
              </div>
              
              <div className="w-full h-24 bg-neutral-950/50 rounded-lg p-2 flex items-end justify-between border border-neutral-900">
                <div className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                  <div 
                    className="w-8 bg-neutral-800 rounded-t relative group cursor-help transition-all"
                    style={{ height: `${(totalTarget > 0 ? (totalTarget / totalTarget) * 100 : 0) * 0.6}%` }}
                  >
                    <span className="absolute hidden group-hover:block bottom-full left-1/2 transform -translate-x-1/2 mb-1 bg-neutral-900 border border-neutral-800 text-[8px] font-mono p-1 rounded text-white whitespace-nowrap z-10">
                      Target: ₹{totalTarget.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <span className="text-[8px] font-mono text-neutral-500">Target</span>
                </div>

                <div className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                  <div 
                    className="w-8 bg-emerald-600 rounded-t relative group cursor-help transition-all shadow shadow-emerald-600/15"
                    style={{ height: `${(totalTarget > 0 ? (totalCollected / totalTarget) * 100 : 0) * 0.6}%` }}
                  >
                    <span className="absolute hidden group-hover:block bottom-full left-1/2 transform -translate-x-1/2 mb-1 bg-neutral-900 border border-neutral-800 text-[8px] font-mono p-1 rounded text-white whitespace-nowrap z-10">
                      Received: ₹{totalCollected.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <span className="text-[8px] font-mono text-emerald-450 font-bold">Received</span>
                </div>

                <div className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                  <div 
                    className="w-8 bg-rose-600 rounded-t relative group cursor-help transition-all shadow shadow-rose-600/15"
                    style={{ height: `${(totalTarget > 0 ? (outstandingFees / totalTarget) * 100 : 0) * 0.6}%` }}
                  >
                    <span className="absolute hidden group-hover:block bottom-full left-1/2 transform -translate-x-1/2 mb-1 bg-neutral-900 border border-neutral-800 text-[8px] font-mono p-1 rounded text-white whitespace-nowrap z-10">
                      Unpaid: ₹{outstandingFees.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <span className="text-[8px] font-mono text-rose-440 font-bold">Unpaid</span>
                </div>
              </div>

              {/* Pending authorization alerts */}
              <div className="border-t border-neutral-900 pt-3">
                <div className="flex items-center gap-1 text-[11px] text-neutral-400">
                  <ClipboardList size={12} className="text-amber-500" />
                  <span className="font-bold text-white">Checker Approvals:</span>
                  {pendingApprovals.length > 0 ? (
                    <span className="text-amber-500 font-semibold">{pendingApprovals.length} pending authorization</span>
                  ) : (
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">Queue clear</span>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* ================= MODAL DIALOGS ================= */}

      {/* 1. Onboard Student Modal */}
      {studentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-850 rounded-xl p-5 shadow-2xl animate-scale-up">
            <h3 className="font-display font-bold text-lg text-white mb-3 text-left">Onboard Student Profile</h3>
            <form onSubmit={handleAddStudent} className="space-y-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-neutral-400 block text-left">Student Name</label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={studentForm.name}
                  onChange={e => setStudentForm({ ...studentForm, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 text-white rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 text-left">
                <div>
                  <label className="text-[10px] uppercase font-bold text-neutral-400 block">Roll Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 2026CSE004"
                    value={studentForm.rollNo}
                    onChange={e => setStudentForm({ ...studentForm, rollNo: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 text-white rounded focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-neutral-400 block">Department</label>
                  <select
                    value={studentForm.department}
                    onChange={e => setStudentForm({ ...studentForm, department: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 text-white rounded focus:border-blue-500 focus:outline-none"
                  >
                    <option value="CSE">CSE (Computer Science)</option>
                    <option value="ECE">ECE (Electronics)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-neutral-400 block text-left">Email Address</label>
                <input
                  type="email"
                  placeholder="name@sreyas.ac.in"
                  value={studentForm.email}
                  onChange={e => setStudentForm({ ...studentForm, email: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 text-white rounded focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-neutral-400 block text-left">Semester Batch</label>
                <select
                  value={studentForm.semester}
                  onChange={e => setStudentForm({ ...studentForm, semester: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 text-white rounded focus:border-blue-500 focus:outline-none"
                >
                  <option value="Semester 1">Semester 1 (Autumn)</option>
                  <option value="Semester 3">Semester 3 (Autumn)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-850">
                <button
                  type="button"
                  onClick={() => setStudentModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-400 bg-neutral-800 hover:bg-neutral-750 rounded transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded transition shadow-lg shadow-blue-600/20 cursor-pointer"
                >
                  Register Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Issue Invoice Modal */}
      {invoiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-850 rounded-xl p-5 shadow-2xl animate-scale-up">
            <h3 className="font-display font-bold text-lg text-white mb-3 text-left">Issue Tuition Invoice</h3>
            <form onSubmit={handleGenerateInvoice} className="space-y-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-neutral-400 block text-left">Select Enrolled Student</label>
                <select
                  value={invoiceForm.studentId}
                  onChange={e => setInvoiceForm({ ...invoiceForm, studentId: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 text-white rounded focus:border-blue-500 focus:outline-none"
                >
                  <option value="">-- Choose Student --</option>
                  {apiStudents.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.rollNo}) - {s.semester}
                    </option>
                  ))}
                  {/* simulation fallback */}
                  {apiStudents.length === 0 && students.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.rollNo}) - {s.semester}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 text-left">
                <div>
                  <label className="text-[10px] uppercase font-bold text-neutral-400 block">Invoice Type</label>
                  <select
                    value={invoiceForm.type}
                    onChange={e => setInvoiceForm({ ...invoiceForm, type: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 text-white rounded focus:border-blue-500 focus:outline-none"
                  >
                    <option value="Academic Tuition Fee">Academic Tuition Fee</option>
                    <option value="Lab Fee">Lab Fee</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-neutral-400 block">Billing Amount (₹)</label>
                  <input
                    type="number"
                    placeholder="106000"
                    value={invoiceForm.amount}
                    onChange={e => setInvoiceForm({ ...invoiceForm, amount: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 text-white rounded focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-neutral-400 block text-left">Due Date</label>
                <input
                  type="date"
                  value={invoiceForm.dueDate}
                  onChange={e => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 text-white rounded focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-850">
                <button
                  type="button"
                  onClick={() => setInvoiceModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-400 bg-neutral-800 hover:bg-neutral-750 rounded transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded transition shadow-lg shadow-blue-600/20 cursor-pointer"
                >
                  Generate Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Onboard Faculty Modal */}
      {facultyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-850 rounded-xl p-5 shadow-2xl animate-scale-up">
            <h3 className="font-display font-bold text-lg text-white mb-3 text-left">Onboard Faculty & Allocation</h3>
            <form onSubmit={handleAddFaculty} className="space-y-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-neutral-400 block text-left">Faculty Name</label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Robert Finch"
                  value={facultyForm.name}
                  onChange={e => setFacultyForm({ ...facultyForm, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 text-white rounded focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 text-left">
                <div>
                  <label className="text-[10px] uppercase font-bold text-neutral-400 block">Employee ID</label>
                  <input
                    type="text"
                    placeholder="e.g. EMP-CS509"
                    value={facultyForm.employeeId}
                    onChange={e => setFacultyForm({ ...facultyForm, employeeId: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 text-white rounded focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-neutral-400 block">Department</label>
                  <select
                    value={facultyForm.department}
                    onChange={e => setFacultyForm({ ...facultyForm, department: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 text-white rounded focus:border-blue-500 focus:outline-none"
                  >
                    <option value="CSE">CSE (Computer Science)</option>
                    <option value="ECE">ECE (Electronics)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-neutral-400 block text-left">Email Address</label>
                <input
                  type="email"
                  placeholder="name@sreyas.ac.in"
                  value={facultyForm.email}
                  onChange={e => setFacultyForm({ ...facultyForm, email: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 text-white rounded focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 text-left">
                <div>
                  <label className="text-[10px] uppercase font-bold text-neutral-400 block">Allocated Subject</label>
                  <select
                    value={facultyForm.subjectId}
                    onChange={e => setFacultyForm({ ...facultyForm, subjectId: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 text-white rounded focus:border-blue-500 focus:outline-none"
                  >
                    <option value="cs-301">CS-301 Database Systems</option>
                    <option value="cs-302">CS-302 Design & Algorithms</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-neutral-400 block">Semester Batch</label>
                  <select
                    value={facultyForm.semester}
                    onChange={e => setFacultyForm({ ...facultyForm, semester: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 text-white rounded focus:border-blue-500 focus:outline-none"
                  >
                    <option value="Semester 3">Semester 3</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-850">
                <button
                  type="button"
                  onClick={() => setFacultyModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-400 bg-neutral-800 hover:bg-neutral-750 rounded transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded transition shadow-lg shadow-blue-600/20 cursor-pointer"
                >
                  Onboard Faculty
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
