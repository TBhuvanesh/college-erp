import { z } from 'zod';

export const CreateMentorGroupSchema = z.object({
  mentorId: z.string().uuid('Invalid mentor ID format'),
  departmentId: z.string().uuid('Invalid department ID format'),
  year: z.number().int().min(1).max(4),
  semester: z.number().int().min(1).max(8),
  section: z.string().min(1, 'Section is required').max(10),
  assignmentMethod: z.enum(['range', 'section', 'manual']),
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
  year: z.number().int().min(1).max(4).optional(),
  semester: z.number().int().min(1).max(8).optional(),
  section: z.string().min(1).max(10).optional(),
  assignmentMethod: z.enum(['range', 'section', 'manual']).optional(),
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
  section: string;
  assignmentMethod: 'range' | 'section' | 'manual';
  rollNumberStart: string | null;
  rollNumberEnd: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  studentCount?: number;
}
