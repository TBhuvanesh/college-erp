import { z } from 'zod';

// ── Query schemas ────────────────────────────────────────────────────────────────

export const adminAnalyticsQuerySchema = z.object({
  departmentId: z.string().uuid().optional(),
});
export type AdminAnalyticsQuery = z.infer<typeof adminAnalyticsQuerySchema>;

export const studentAnalyticsQuerySchema = z.object({});
export type StudentAnalyticsQuery = z.infer<typeof studentAnalyticsQuerySchema>;

// ── Response shapes ──────────────────────────────────────────────────────────────

export interface InstitutionOverview {
  totalStudents: number;
  totalFaculty: number;
  totalDepartments: number;
  totalSubjects: number;
}

export interface AcademicAnalytics {
  averageAttendance: number;
  averageCGPA: number;
  passPercentage: number;
  failPercentage: number;
  subjectCompletionRate: number;
}

export interface TeachingAnalytics {
  syllabusCompletion: number;
  lessonsPlanned: number;
  lessonsCompleted: number;
  lessonsRemaining: number;
  facultyTeachingProgress: Array<{
    facultyId: string;
    facultyName: string;
    lessonsPlanned: number;
    lessonsCompleted: number;
    completionPercentage: number;
  }>;
}

export interface LmsAnalytics {
  totalMaterialsUploaded: number;
  totalAssignments: number;
  submissionPercentage: number;
  lateSubmissionPercentage: number;
}

export interface MentorshipAnalytics {
  totalMentorGroups: number;
  activeMentors: number;
  studentsAtRisk: number;
}

export interface OpportunityAnalytics {
  activeOpportunities: number;
  internships: number;
  jobs: number;
  workshops: number;
  studentApplications: number;
}

export interface NotificationAnalytics {
  notificationsSent: number;
  readPercentage: number;
}

export interface AdminAnalyticsResponse {
  institutionOverview: InstitutionOverview;
  academicAnalytics: AcademicAnalytics;
  teachingAnalytics: TeachingAnalytics;
  lmsAnalytics: LmsAnalytics;
  mentorshipAnalytics: MentorshipAnalytics;
  opportunityAnalytics: OpportunityAnalytics;
  notificationAnalytics: NotificationAnalytics;
}

export interface HodAnalyticsResponse {
  departmentId: string;
  departmentName: string;
  departmentStudents: number;
  facultyCount: number;
  subjectCount: number;
  departmentAttendance: number;
  departmentCGPA: number;
  passPercentage: number;
  feePendingStudents: number;
  teachingProgress: {
    lessonsPlanned: number;
    lessonsCompleted: number;
    lessonsRemaining: number;
    completionPercentage: number;
  };
  mentorshipStatistics: {
    totalMentorGroups: number;
    activeMentors: number;
  };
  placementOpportunities: {
    total: number;
    internships: number;
    jobs: number;
    workshops: number;
  };
}

export interface FacultyAnalyticsResponse {
  teachingOverview: {
    subjectsAssigned: number;
    lessonsPlanned: number;
    lessonsCompleted: number;
    syllabusCompletion: number;
    assignmentsCreated: number;
    assignmentSubmissionPercentage: number;
    studentAttendance: number;
    averageInternalMarks: number;
  };
  mentorDashboard: {
    studentsAtRisk: number;
    lowAttendance: number;
    feePending: number;
    assignmentPending: number;
    mentees: unknown[];
  };
}

export interface StudentAnalyticsResponse {
  attendanceTrend: unknown;
  cgpaTrend: Array<{ semester: number; sgpa: number }>;
  internalMarksTrend: unknown;
  assignmentCompletionPercentage: number;
  learningProgress: unknown;
  feeStatus: unknown;
  opportunityParticipation: number;
}
