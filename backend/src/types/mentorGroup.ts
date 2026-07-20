import { z } from 'zod';

// ── Academic Session — the single derived replacement for independent
// Year/Semester dropdowns. "Invalid combinations must never be possible": the
// only inputs anywhere in this module are departmentId + semester; year is
// always computed as Math.ceil(semester / 2), never accepted as input. ────────

export interface AcademicSession {
  label: string; // "1-1".."4-2"
  year: number;
  semester: number;
}

export const ACADEMIC_SESSIONS: AcademicSession[] = [1, 2, 3, 4, 5, 6, 7, 8].map((semester) => ({
  label: `${Math.ceil(semester / 2)}-${semester % 2 === 0 ? 2 : 1}`,
  year: Math.ceil(semester / 2),
  semester,
}));

export function semesterToYear(semester: number): number {
  return Math.ceil(semester / 2);
}

export function semesterToSessionLabel(semester: number): string {
  return ACADEMIC_SESSIONS.find((s) => s.semester === semester)?.label ?? `${semesterToYear(semester)}-${semester % 2 === 0 ? 2 : 1}`;
}

// ── Assignment method — unchanged enum (backward compatible with historical
// 'section'-method rows); "Recommended Group Size" is a suggestion/preview
// helper that proposes several 'range' groups, not a new stored method. ──────

export const ASSIGNMENT_METHODS = ['range', 'section', 'manual'] as const;
export type AssignmentMethod = (typeof ASSIGNMENT_METHODS)[number];

export const CreateMentorGroupSchema = z.object({
  mentorId: z.string().uuid('Invalid mentor ID format'),
  departmentId: z.string().uuid('Invalid department ID format'),
  semester: z.number().int().min(1).max(8),
  section: z.string().min(1, 'Section is required').max(10),
  assignmentMethod: z.enum(ASSIGNMENT_METHODS),
  rollNumberStart: z.string().optional().nullable(),
  rollNumberEnd: z.string().optional().nullable(),
  studentIds: z.array(z.string().uuid()).optional(),
}).refine((data) => {
  if (data.assignmentMethod === 'range') {
    return !!data.rollNumberStart && !!data.rollNumberEnd;
  }
  return true;
}, {
  message: 'Roll number start and end are required for range assignment method',
  path: ['rollNumberStart'],
});

export const UpdateMentorGroupSchema = z.object({
  mentorId: z.string().uuid('Invalid mentor ID format').optional(),
  departmentId: z.string().uuid('Invalid department ID format').optional(),
  semester: z.number().int().min(1).max(8).optional(),
  section: z.string().min(1).max(10).optional(),
  assignmentMethod: z.enum(ASSIGNMENT_METHODS).optional(),
  rollNumberStart: z.string().optional().nullable(),
  rollNumberEnd: z.string().optional().nullable(),
  studentIds: z.array(z.string().uuid()).optional(),
});

export type CreateMentorGroupInput = z.infer<typeof CreateMentorGroupSchema>;
export type UpdateMentorGroupInput = z.infer<typeof UpdateMentorGroupSchema>;

export interface MentorGroup {
  id: string;
  mentorId: string;
  mentorName?: string;
  departmentId: string;
  departmentName?: string;
  year: number;
  semester: number;
  academicSession: string;
  section: string;
  assignmentMethod: AssignmentMethod;
  rollNumberStart: string | null;
  rollNumberEnd: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  studentCount?: number;
}

export interface ResolvedStudent {
  id: string;
  name: string;
  rollNumber: string;
  department: string;
  semester: number;
  year: number;
  phoneNumber: string | null;
  parentContact: string | null;
  email: string;
}

// ── Conflict / Capacity Engine ───────────────────────────────────────────────

export const MENTOR_GROUP_CONFLICT_TYPES = [
  'invalid_academic_session',
  'empty_group',
  'invalid_roll_range',
  'capacity_exceeded',
  'duplicate_student',
  'duplicate_mentor_assignment',
] as const;
export type MentorGroupConflictType = (typeof MENTOR_GROUP_CONFLICT_TYPES)[number];

export interface MentorGroupConflict {
  type: MentorGroupConflictType;
  severity: 'warning' | 'error';
  message: string;
  context?: Record<string, unknown>;
}

export interface MentorGroupConflictCheckResult {
  hasBlockingConflicts: boolean;
  conflicts: MentorGroupConflict[];
  resolvedCount: number;
}

export const checkConflictsSchema = z.object({
  mentorId: z.string().uuid(),
  departmentId: z.string().uuid(),
  semester: z.number().int().min(1).max(8),
  section: z.string().min(1).max(10),
  assignmentMethod: z.enum(ASSIGNMENT_METHODS),
  rollNumberStart: z.string().optional().nullable(),
  rollNumberEnd: z.string().optional().nullable(),
  studentIds: z.array(z.string().uuid()).optional(),
  excludeGroupId: z.string().uuid().optional(),
});
export type CheckConflictsInput = z.infer<typeof checkConflictsSchema>;

// ── Auto Suggestion Engine ───────────────────────────────────────────────────

export const suggestBalancedGroupsSchema = z.object({
  departmentId: z.string().uuid(),
  semester: z.coerce.number().int().min(1).max(8),
  section: z.string().min(1).max(10),
  targetSize: z.coerce.number().int().positive().optional(),
});
export type SuggestBalancedGroupsInput = z.infer<typeof suggestBalancedGroupsSchema>;

export interface BalancedGroupProposal {
  rollNumberStart: string;
  rollNumberEnd: string;
  studentCount: number;
  studentIds: string[];
}

export interface BalancedGroupsResult {
  section: string;
  totalStudents: number;
  targetSize: number;
  proposals: BalancedGroupProposal[];
}

// ── Mentor (faculty) synchronization — capacity-aware candidate listing ─────

export interface MentorCandidate {
  facultyId: string;
  facultyName: string;
  employeeNumber: string;
  departmentId: string;
  departmentName: string;
  isMentoringHead: boolean;
  status: string;
  currentGroups: number;
  currentStudents: number;
  availableCapacity: number;
  overLimit: boolean;
}

export const listMentorCandidatesQuerySchema = z.object({
  departmentId: z.string().uuid(),
});
export type ListMentorCandidatesQuery = z.infer<typeof listMentorCandidatesQuerySchema>;

// ── Split / Merge ─────────────────────────────────────────────────────────────

export const splitMentorGroupSchema = z.object({
  splitAtRollNumber: z.string().min(1, 'A roll number to split at is required'),
  newMentorId: z.string().uuid('Invalid mentor ID format'),
});
export type SplitMentorGroupInput = z.infer<typeof splitMentorGroupSchema>;

export const mergeMentorGroupsSchema = z.object({
  groupIdA: z.string().uuid(),
  groupIdB: z.string().uuid(),
});
export type MergeMentorGroupsInput = z.infer<typeof mergeMentorGroupsSchema>;

// ── Mentorship Settings (global singleton) ───────────────────────────────────

export interface MentorshipSettings {
  id: string;
  recommendedStudentsPerMentor: number;
  maximumStudents: number;
  allowCrossDepartment: boolean;
  updatedBy: string | null;
  updatedAt: Date;
}

export const updateMentorshipSettingsSchema = z
  .object({
    recommendedStudentsPerMentor: z.number().int().positive().optional(),
    maximumStudents: z.number().int().positive().optional(),
    allowCrossDepartment: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided for update' });
export type UpdateMentorshipSettingsInput = z.infer<typeof updateMentorshipSettingsSchema>;
