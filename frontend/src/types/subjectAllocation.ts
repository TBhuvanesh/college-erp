export interface SubjectAllocation {
  id: string;
  facultyId: string;
  facultyName: string;
  employeeNumber: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  departmentId: string;
  departmentName: string;
  semester: number;
  section: string;
  academicYear: string;
  status: 'active' | 'inactive' | 'pending';
  createdBy: string | null;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
  removedBy: string | null;
  removedByName?: string;
  removedAt: string | null;
  removalReason: string | null;
}

export interface WorkloadStatistics {
  totalSubjects: number;
  assignedSubjects: number;
  unassignedSubjects: number;
  facultyWithMaxWorkload: {
    facultyId: string;
    facultyName: string;
    employeeNumber: string;
    count: number;
  } | null;
  facultyWithMinWorkload: {
    facultyId: string;
    facultyName: string;
    employeeNumber: string;
    count: number;
  } | null;
  averageSubjectsPerFaculty: number;
  pendingAllocations: number;
  analytics: {
    subjectsPerFaculty: { facultyName: string; count: number }[];
    departmentDistribution: { departmentName: string; count: number }[];
    semesterDistribution: { semester: number; count: number }[];
  };
}

export interface SubjectProfile {
  id: string;
  code: string;
  name: string;
  departmentName: string;
  programName: string | null;
  semester: number;
  semesterRaw: string | null;
  year: string | null;
  regulation: string;
  lectureHours: number;
  tutorialHours: number;
  practicalHours: number;
  credits: number;
  status: string;
  description: string | null;
  studentsEnrolled: number;
  assignedFaculty: {
    allocationId: string;
    facultyId: string;
    facultyName: string;
    employeeNumber: string;
    section: string;
    status: string;
    academicYear: string;
  }[];
  sections: string[];
  attendanceStatus: string;
  lmsStatus: string;
  internalMarksStatus: string;
}
