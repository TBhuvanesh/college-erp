import { z } from 'zod';

export type MentorAssignmentStatus = 'active' | 'reassigned' | 'completed';

export interface MentorAssignment {
  id: string;
  mentorId: string;
  studentId: string;
  assignedBy: string;
  assignedDate: Date;
  status: MentorAssignmentStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface MentoringNote {
  id: string;
  mentorId: string;
  studentId: string;
  title: string;
  remarks: string;
  meetingDate: Date;
  followUpDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// Zod Validation Schemas
export const assignMentorSchema = z.object({
  mentorId: z.string().uuid('Invalid mentor ID'),
  studentId: z.string().uuid('Invalid student ID'),
});

export const reassignMentorSchema = z.object({
  mentorId: z.string().uuid('Invalid mentor ID'),
  studentId: z.string().uuid('Invalid student ID'),
});

export const createMentoringNoteSchema = z.object({
  studentId: z.string().uuid('Invalid student ID'),
  title: z.string().min(1, 'Title is required').max(255),
  remarks: z.string().min(1, 'Remarks are required'),
  meetingDate: z.preprocess((arg) => {
    if (typeof arg === 'string' || arg instanceof Date) return new Date(arg);
    return arg;
  }, z.date({ invalid_type_error: 'Invalid meeting date' })),
  followUpDate: z.preprocess((arg) => {
    if (!arg) return null;
    if (typeof arg === 'string' || arg instanceof Date) return new Date(arg);
    return arg;
  }, z.date({ invalid_type_error: 'Invalid follow-up date' }).nullable().optional()),
});

export const updateMentoringNoteSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255).optional(),
  remarks: z.string().min(1, 'Remarks are required').optional(),
  meetingDate: z.preprocess((arg) => {
    if (typeof arg === 'string' || arg instanceof Date) return new Date(arg);
    return arg;
  }, z.date({ invalid_type_error: 'Invalid meeting date' })).optional(),
  followUpDate: z.preprocess((arg) => {
    if (arg === null || arg === '') return null;
    if (typeof arg === 'string' || arg instanceof Date) return new Date(arg);
    return arg;
  }, z.date({ invalid_type_error: 'Invalid follow-up date' }).nullable().optional()),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});

export type AssignMentorInput = z.infer<typeof assignMentorSchema>;
export type ReassignMentorInput = z.infer<typeof reassignMentorSchema>;
export type CreateMentoringNoteInput = z.infer<typeof createMentoringNoteSchema>;
export type UpdateMentoringNoteInput = z.infer<typeof updateMentoringNoteSchema>;
