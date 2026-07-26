import { z } from 'zod';

// 'verified' (migration 045) is an optional stage between submitted_for_approval
// and published, gated by teaching_load_settings.require_result_verification —
// installs that don't opt in keep publishing straight from draft_saved/
// submitted_for_approval exactly as before.
export const RESULT_ENTRY_TASK_STATUSES = ['open', 'draft_saved', 'submitted_for_approval', 'verified', 'published', 'closed'] as const;
export type ResultEntryTaskStatus = (typeof RESULT_ENTRY_TASK_STATUSES)[number];

export interface ResultEntryTask {
  id: string;
  examId: string;
  teachingAssignmentId: string;
  facultyId: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  section: string;
  examType: string;
  status: ResultEntryTaskStatus;
  windowOpensAt: Date;
  windowClosesAt: Date | null;
  submittedAt: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
}

export const listResultEntryTasksQuerySchema = z.object({
  status: z.enum(RESULT_ENTRY_TASK_STATUSES).optional(),
});
export type ListResultEntryTasksQuery = z.infer<typeof listResultEntryTasksQuerySchema>;
