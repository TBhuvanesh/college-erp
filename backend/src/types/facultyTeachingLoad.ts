// Part 1: Faculty Teaching Load — one row per faculty (not per assignment),
// expandable to show the assignments/subjects/labs/tutorials that make it up.
// This is a read model built on top of teaching_assignments + subjects; it
// introduces no new tables of its own.

export interface FacultyTeachingLoadSubject {
  teachingAssignmentId: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  subjectType: string; // core | elective | lab | project | seminar
  section: string;
  semester: number;
  academicYear: string;
  lectureHours: number;
  tutorialHours: number;
  practicalHours: number;
  equivalentLoad: number;
}

export interface FacultyTeachingLoadRow {
  facultyId: string;
  facultyName: string;
  employeeNumber: string;
  departmentName: string;
  academicYear: string;
  theoryCount: number;
  labCount: number;
  tutorialCount: number;
  sections: string[];
  mentorGroupsCount: number;
  weeklyTeachingHoursConfigured: number | null; // sum of teaching_assignments.weekly_teaching_hours where set
  equivalentTeachingLoad: number; // computed from L-T-P hours × configured weights
  maxAllowedLoad: number;
  minAllowedLoad: number | null;
  status: 'Under Minimum' | 'Balanced' | 'Overloaded';
  subjects: FacultyTeachingLoadSubject[];
}

export interface FacultyWorkloadOverview {
  academicYear: string;
  rows: FacultyTeachingLoadRow[];
}
