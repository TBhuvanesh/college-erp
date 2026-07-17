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
  averageMentorLoad: number;
  unassignedStudents: number;
  unassignedSections: number;
  overloadedMentors: number;
  departmentDistribution: Array<{ departmentId: string; departmentName: string; groupCount: number; studentCount: number }>;
  studentsPerMentor: Array<{ mentorId: string; mentorName: string; studentCount: number }>;
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

export interface FeedbackAnalytics {
  totalCampaigns: number;
  activeCampaigns: number;
  eligibleStudents: number;
  submitted: number;
  pending: number;
  completionPercent: number;
  statusBreakdown: Record<string, number>;
}

export interface AdminAnalyticsResponse {
  institutionOverview: InstitutionOverview;
  academicAnalytics: AcademicAnalytics;
  teachingAnalytics: TeachingAnalytics;
  lmsAnalytics: LmsAnalytics;
  mentorshipAnalytics: MentorshipAnalytics;
  opportunityAnalytics: OpportunityAnalytics;
  notificationAnalytics: NotificationAnalytics;
  feedbackAnalytics: FeedbackAnalytics;
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
  feedbackAnalytics: FeedbackAnalytics;
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
  feedbackAnalytics: {
    activeCampaigns: number;
    campaigns: Array<{ campaignId: string; title: string; status: string; eligibleStudents: number; submittedCount: number; completionPercent: number }>;
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
