"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

// Types
export interface Student {
  id: string;
  name: string;
  rollNo: string;
  email: string;
  department: string;
  semester: string;
  status: "Good Standing" | "Warning" | "Detained" | "Archived";
  dateOnboarded: string;
  program: string;
  advisor: string;
  advisorEmail: string;
}

export interface Faculty {
  id: string;
  name: string;
  employeeId: string;
  email: string;
  department: string;
  assignedSubjects: { subjectId: string; subjectName: string; semester: string }[];
  status: "Active" | "Leave" | "Archived";
}

export interface Course {
  id: string;
  name: string;
  department: string;
  semesters: {
    semesterNumber: string;
    subjects: { id: string; name: string; credits: number }[];
  }[];
}

export interface Invoice {
  id: string;
  studentId: string;
  studentName: string;
  studentRollNo: string;
  semester: string;
  type: string;
  amount: number;
  dueDate: string;
  status: "Paid" | "Pending" | "Overdue";
  dateGenerated: string;
}

export interface AttendanceRecord {
  id: string;
  subjectId: string;
  subjectName: string;
  studentId: string;
  studentName: string;
  studentRollNo: string;
  status: "Present" | "Absent" | "Late";
  date: string;
}

export interface GradeRecord {
  id: string;
  subjectId: string;
  subjectName: string;
  studentId: string;
  type: "Midterm" | "Final";
  marks: number;
  maxMarks: number;
  grade: string;
}

export interface Announcement {
  id: string;
  title: string;
  desc: string;
  category: "Exam" | "Holiday" | "Placement" | "Workshop";
  date: string;
}

interface SimulationContextType {
  students: Student[];
  faculty: Faculty[];
  courses: Course[];
  invoices: Invoice[];
  attendanceLogs: AttendanceRecord[];
  grades: GradeRecord[];
  announcements: Announcement[];
  
  // App state
  currentRole: "Admin" | "Faculty" | "Student" | "HOD";
  currentStudentId: string; // The simulated active student
  currentFacultyId: string; // The simulated active faculty
  
  // Setters/Mutations
  setCurrentRole: (role: "Admin" | "Faculty" | "Student" | "HOD") => void;
  setCurrentStudentId: (id: string) => void;
  setCurrentFacultyId: (id: string) => void;
  
  addStudent: (student: Omit<Student, "id" | "dateOnboarded">) => Student;
  addFaculty: (fac: Omit<Faculty, "id">) => Faculty;
  generateInvoice: (invoice: Omit<Invoice, "id" | "dateGenerated" | "status">) => Invoice;
  markInvoiceAsPaid: (invoiceId: string) => void;
  logAttendance: (records: Omit<AttendanceRecord, "id" | "date">[]) => void;
  submitGrades: (records: Omit<GradeRecord, "id" | "grade">[]) => void;
  resetDatabase: () => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
}

const SimulationContext = createContext<SimulationContextType | undefined>(undefined);

// Realistic Academic Data
const INITIAL_COURSES: Course[] = [
  {
    id: "cse-btech",
    name: "B.Tech Computer Science & Engineering",
    department: "CSE",
    semesters: [
      {
        semesterNumber: "Semester 1",
        subjects: [
          { id: "cs-101", name: "CS-101: Introduction to Programming", credits: 4 },
          { id: "ma-101", name: "MA-101: Calculus & Linear Algebra", credits: 4 },
          { id: "ph-101", name: "PH-101: Engineering Physics", credits: 3 }
        ]
      },
      {
        semesterNumber: "Semester 3",
        subjects: [
          { id: "cs-301", name: "CS-301: Database Management Systems", credits: 4 },
          { id: "cs-302", name: "CS-302: Design & Analysis of Algorithms", credits: 4 },
          { id: "cs-303", name: "CS-303: Computer Organization & Architecture", credits: 3 }
        ]
      }
    ]
  }
];

const INITIAL_FACULTY: Faculty[] = [
  {
    id: "fac-amit",
    name: "Dr. Amit Verma",
    employeeId: "EMP-CS203",
    email: "amit.verma@sreyas.ac.in",
    department: "CSE",
    assignedSubjects: [
      { subjectId: "cs-301", subjectName: "CS-301: Database Management Systems", semester: "Semester 3" },
      { subjectId: "cs-302", subjectName: "CS-302: Design & Analysis of Algorithms", semester: "Semester 3" }
    ],
    status: "Active"
  },
  {
    id: "fac-sneha",
    name: "Prof. Sneha Iyer",
    employeeId: "EMP-CS405",
    email: "sneha.iyer@sreyas.ac.in",
    department: "CSE",
    assignedSubjects: [
      { subjectId: "cs-303", subjectName: "CS-303: Computer Organization & Architecture", semester: "Semester 3" }
    ],
    status: "Active"
  }
];

const INITIAL_STUDENTS: Student[] = [
  {
    id: "stud-rahul",
    name: "Rahul Sharma",
    rollNo: "2026CSE001",
    email: "rahul.sharma@sreyas.ac.in",
    department: "CSE",
    semester: "Semester 3",
    status: "Good Standing",
    dateOnboarded: "2026-06-01",
    program: "B.Tech CSE",
    advisor: "Dr. Amit Verma",
    advisorEmail: "amit.verma@sreyas.ac.in"
  },
  {
    id: "stud-priya",
    name: "Priya Patel",
    rollNo: "2026CSE002",
    email: "priya.patel@sreyas.ac.in",
    department: "CSE",
    semester: "Semester 3",
    status: "Good Standing",
    dateOnboarded: "2026-06-01",
    program: "B.Tech CSE",
    advisor: "Dr. Amit Verma",
    advisorEmail: "amit.verma@sreyas.ac.in"
  },
  {
    id: "stud-arjun",
    name: "Arjun Mehta",
    rollNo: "2026CSE003",
    email: "arjun.mehta@sreyas.ac.in",
    department: "CSE",
    semester: "Semester 3",
    status: "Warning",
    dateOnboarded: "2026-06-02",
    program: "B.Tech CSE",
    advisor: "Dr. Amit Verma",
    advisorEmail: "amit.verma@sreyas.ac.in"
  }
];

const INITIAL_INVOICES: Invoice[] = [
  {
    id: "inv-AUT26-01",
    studentId: "stud-rahul",
    studentName: "Rahul Sharma",
    studentRollNo: "2026CSE001",
    semester: "Semester 3",
    type: "Academic Tuition Fee",
    amount: 106000,
    dueDate: "2026-07-15",
    status: "Paid",
    dateGenerated: "2026-06-02"
  },
  {
    id: "inv-AUT26-02",
    studentId: "stud-priya",
    studentName: "Priya Patel",
    studentRollNo: "2026CSE002",
    semester: "Semester 3",
    type: "Academic Tuition Fee",
    amount: 106000,
    dueDate: "2026-07-15",
    status: "Pending",
    dateGenerated: "2026-06-02"
  },
  {
    id: "inv-AUT26-03",
    studentId: "stud-arjun",
    studentName: "Arjun Mehta",
    studentRollNo: "2026CSE003",
    semester: "Semester 3",
    type: "Academic Tuition Fee",
    amount: 106000,
    dueDate: "2026-07-15",
    status: "Pending",
    dateGenerated: "2026-06-02"
  }
];

const INITIAL_ATTENDANCE: AttendanceRecord[] = [
  {
    id: "att-1",
    subjectId: "cs-301",
    subjectName: "CS-301: Database Management Systems",
    studentId: "stud-rahul",
    studentName: "Rahul Sharma",
    studentRollNo: "2026CSE001",
    status: "Present",
    date: "2026-06-15"
  },
  {
    id: "att-2",
    subjectId: "cs-301",
    subjectName: "CS-301: Database Management Systems",
    studentId: "stud-priya",
    studentName: "Priya Patel",
    studentRollNo: "2026CSE002",
    status: "Absent",
    date: "2026-06-15"
  },
  {
    id: "att-3",
    subjectId: "cs-301",
    subjectName: "CS-301: Database Management Systems",
    studentId: "stud-arjun",
    studentName: "Arjun Mehta",
    studentRollNo: "2026CSE003",
    status: "Present",
    date: "2026-06-15"
  }
];

const INITIAL_GRADES: GradeRecord[] = [
  {
    id: "gr-1",
    subjectId: "cs-301",
    subjectName: "CS-301: Database Management Systems",
    studentId: "stud-rahul",
    type: "Midterm",
    marks: 88,
    maxMarks: 100,
    grade: "A"
  },
  {
    id: "gr-2",
    subjectId: "cs-301",
    subjectName: "CS-301: Database Management Systems",
    studentId: "stud-priya",
    type: "Midterm",
    marks: 95,
    maxMarks: 100,
    grade: "A+"
  }
];

const INITIAL_ANNOUNCEMENTS: Announcement[] = [
  {
    id: "ann-1",
    title: "Mid-Semester Examinations Timetable published",
    desc: "The mid-semester evaluation cycle starting July 5 has been published. Roster maps are available in the Examinations panel.",
    category: "Exam",
    date: "2026-06-12"
  },
  {
    id: "ann-2",
    title: "Institutional Holiday Notification",
    desc: "The campus will remain closed on June 22 in observance of the foundation day. Online academic databases will remain active.",
    category: "Holiday",
    date: "2026-06-14"
  },
  {
    id: "ann-3",
    title: "On-Campus Placement Drive by TechCorp",
    desc: "TechCorp will host an eligibility assessment drive for B.Tech Semester 3/5 students on June 28. Standard CGPA cut-off: 7.50.",
    category: "Placement",
    date: "2026-06-15"
  }
];

const calculateLetterGrade = (marks: number, max: number): string => {
  const percentage = (marks / max) * 100;
  if (percentage >= 90) return "A+";
  if (percentage >= 80) return "A";
  if (percentage >= 70) return "B";
  if (percentage >= 60) return "C";
  if (percentage >= 50) return "D";
  return "F";
};

export const SimulationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("erp_theme") as "light" | "dark") || "light";
    }
    return "light";
  });

  const [students, setStudents] = useState<Student[]>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("erp_students");
      return stored ? JSON.parse(stored) : INITIAL_STUDENTS;
    }
    return INITIAL_STUDENTS;
  });

  const [faculty, setFaculty] = useState<Faculty[]>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("erp_faculty");
      return stored ? JSON.parse(stored) : INITIAL_FACULTY;
    }
    return INITIAL_FACULTY;
  });

  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("erp_invoices");
      return stored ? JSON.parse(stored) : INITIAL_INVOICES;
    }
    return INITIAL_INVOICES;
  });

  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceRecord[]>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("erp_attendance");
      return stored ? JSON.parse(stored) : INITIAL_ATTENDANCE;
    }
    return INITIAL_ATTENDANCE;
  });

  const [grades, setGrades] = useState<GradeRecord[]>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("erp_grades");
      return stored ? JSON.parse(stored) : INITIAL_GRADES;
    }
    return INITIAL_GRADES;
  });

  const [currentRole, setCurrentRole] = useState<"Admin" | "Faculty" | "Student" | "HOD">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("erp_current_role") as "Admin" | "Faculty" | "Student" | "HOD") || "Admin";
    }
    return "Admin";
  });

  const [currentStudentId, setCurrentStudentId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("erp_current_student_id") || "stud-rahul";
    }
    return "stud-rahul";
  });

  const [currentFacultyId, setCurrentFacultyId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("erp_current_faculty_id") || "fac-amit";
    }
    return "fac-amit";
  });

  const [courses] = useState<Course[]>(INITIAL_COURSES);
  const [announcements] = useState<Announcement[]>(INITIAL_ANNOUNCEMENTS);
  const [initialized, setInitialized] = useState(false);

  // Apply theme class and flag initialization
  useEffect(() => {
    if (typeof window !== "undefined") {
      const root = window.document.documentElement;
      if (theme === "dark") {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
      const timer = setTimeout(() => {
        setInitialized(true);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [theme]);

  // Save to local storage when state changes
  useEffect(() => {
    if (initialized) {
      localStorage.setItem("erp_students", JSON.stringify(students));
    }
  }, [students, initialized]);

  useEffect(() => {
    if (initialized) {
      localStorage.setItem("erp_faculty", JSON.stringify(faculty));
    }
  }, [faculty, initialized]);

  useEffect(() => {
    if (initialized) {
      localStorage.setItem("erp_invoices", JSON.stringify(invoices));
    }
  }, [invoices, initialized]);

  useEffect(() => {
    if (initialized) {
      localStorage.setItem("erp_attendance", JSON.stringify(attendanceLogs));
    }
  }, [attendanceLogs, initialized]);

  useEffect(() => {
    if (initialized) {
      localStorage.setItem("erp_grades", JSON.stringify(grades));
    }
  }, [grades, initialized]);

  const handleSetRole = (role: "Admin" | "Faculty" | "Student" | "HOD") => {
    setCurrentRole(role);
    if (typeof window !== "undefined") {
      localStorage.setItem("erp_current_role", role);
    }
  };

  const handleSetStudentId = (id: string) => {
    setCurrentStudentId(id);
    if (typeof window !== "undefined") {
      localStorage.setItem("erp_current_student_id", id);
    }
  };

  const handleSetFacultyId = (id: string) => {
    setCurrentFacultyId(id);
    if (typeof window !== "undefined") {
      localStorage.setItem("erp_current_faculty_id", id);
    }
  };

  // Mutations
  const addStudent = (studData: Omit<Student, "id" | "dateOnboarded">): Student => {
    const newStudent: Student = {
      ...studData,
      id: `stud-${Math.random().toString(36).substr(2, 9)}`,
      dateOnboarded: new Date().toISOString().split("T")[0]
    };
    setStudents(prev => [...prev, newStudent]);
    return newStudent;
  };

  const addFaculty = (facData: Omit<Faculty, "id">): Faculty => {
    const newFac: Faculty = {
      ...facData,
      id: `fac-${Math.random().toString(36).substr(2, 9)}`
    };
    setFaculty(prev => [...prev, newFac]);
    return newFac;
  };

  const generateInvoice = (invData: Omit<Invoice, "id" | "dateGenerated" | "status">): Invoice => {
    const newInvoice: Invoice = {
      ...invData,
      id: `inv-AUT26-${Math.random().toString(36).substr(2, 2).toUpperCase()}`,
      status: "Pending",
      dateGenerated: new Date().toISOString().split("T")[0]
    };
    setInvoices(prev => [...prev, newInvoice]);
    return newInvoice;
  };

  const markInvoiceAsPaid = (invoiceId: string) => {
    setInvoices(prev =>
      prev.map(inv => (inv.id === invoiceId ? { ...inv, status: "Paid" } : inv))
    );
  };

  const logAttendance = (records: Omit<AttendanceRecord, "id" | "date">[]) => {
    const todayStr = new Date().toISOString().split("T")[0];
    const newRecords: AttendanceRecord[] = records.map(rec => ({
      ...rec,
      id: `att-${Math.random().toString(36).substr(2, 9)}`,
      date: todayStr
    }));

    setAttendanceLogs(prev => {
      const filtered = prev.filter(
        item =>
          !(
            item.date === todayStr &&
            item.subjectId === records[0]?.subjectId &&
            records.some(r => r.studentId === item.studentId)
          )
      );
      return [...filtered, ...newRecords];
    });
  };

  const submitGrades = (records: Omit<GradeRecord, "id" | "grade">[]) => {
    const newGrades: GradeRecord[] = records.map(rec => ({
      ...rec,
      id: `gr-${Math.random().toString(36).substr(2, 9)}`,
      grade: calculateLetterGrade(rec.marks, rec.maxMarks)
    }));

    setGrades(prev => {
      const filtered = prev.filter(
        item =>
          !(
            item.subjectId === records[0]?.subjectId &&
            item.type === records[0]?.type &&
            records.some(r => r.studentId === item.studentId)
          )
      );
      return [...filtered, ...newGrades];
    });
  };

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    if (typeof window !== "undefined") {
      localStorage.setItem("erp_theme", nextTheme);
      const root = window.document.documentElement;
      if (nextTheme === "dark") {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    }
  };

  const resetDatabase = () => {
    setStudents(INITIAL_STUDENTS);
    setFaculty(INITIAL_FACULTY);
    setInvoices(INITIAL_INVOICES);
    setAttendanceLogs(INITIAL_ATTENDANCE);
    setGrades(INITIAL_GRADES);
    setCurrentRole("Admin");
    setCurrentStudentId("stud-rahul");
    setCurrentFacultyId("fac-amit");
    if (typeof window !== "undefined") {
      localStorage.clear();
      localStorage.setItem("erp_theme", theme);
    }
  };

  return (
    <SimulationContext.Provider
      value={{
        students,
        faculty,
        courses,
        invoices,
        attendanceLogs,
        grades,
        announcements,
        currentRole,
        currentStudentId,
        currentFacultyId,
        setCurrentRole: handleSetRole,
        setCurrentStudentId: handleSetStudentId,
        setCurrentFacultyId: handleSetFacultyId,
        addStudent,
        addFaculty,
        generateInvoice,
        markInvoiceAsPaid,
        logAttendance,
        submitGrades,
        resetDatabase,
        theme,
        toggleTheme
      }}
    >
      {children}
    </SimulationContext.Provider>
  );
};

export const useSimulation = () => {
  const context = useContext(SimulationContext);
  if (context === undefined) {
    throw new Error("useSimulation must be used within a SimulationProvider");
  }
  return context;
};
