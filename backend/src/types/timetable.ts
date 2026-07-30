import { z } from 'zod';

export const TIMETABLE_SLOT_TYPES = ['TEACHING', 'BREAK', 'LUNCH'] as const;
export type TimetableSlotType = typeof TIMETABLE_SLOT_TYPES[number];

export const TIMETABLE_STATUSES = ['draft', 'validated', 'published', 'archived'] as const;
export type TimetableStatus = typeof TIMETABLE_STATUSES[number];

export const CLASS_TYPES = ['Theory', 'Lab', 'Project', 'Elective', 'Tutorial', 'Other'] as const;
export type ClassType = typeof CLASS_TYPES[number];

// Schema for individual slot configuration when creating timetable
export const timetableSlotConfigSchema = z.object({
  startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Invalid start time format (HH:MM or HH:MM:SS)'),
  endTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Invalid end time format (HH:MM or HH:MM:SS)'),
  slotType: z.enum(TIMETABLE_SLOT_TYPES),
  sequenceOrder: z.number().int().min(1),
});

export type TimetableSlotConfig = z.infer<typeof timetableSlotConfigSchema>;

// Schema for entries when building / updating timetable
export const timetableEntryConfigSchema = z.object({
  dayOfWeek: z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']),
  subjectId: z.string().uuid('Invalid subject ID'),
  classType: z.enum(CLASS_TYPES),
  slotSequenceOrders: z.array(z.number().int()).min(1, 'At least one slot is required'), // list of sequence orders mapping this class entry to slots
  facultyIds: z.array(z.string().uuid()).min(1, 'At least one faculty is required'), // list of faculty ids assigned to this session
});

export type TimetableEntryConfig = z.infer<typeof timetableEntryConfigSchema>;

// Schema to create/save a timetable draft
export const createTimetableSchema = z.object({
  academicYear: z.string().regex(/^\d{4}-\d{4}$/, 'Academic year must match YYYY-YYYY format'),
  departmentId: z.string().uuid('Invalid department ID'),
  programId: z.string().uuid('Invalid program ID').optional().nullable(),
  year: z.enum(['I', 'II', 'III', 'IV']),
  semester: z.number().int().min(1).max(12),
  section: z.string().min(1).max(10).trim(),
  roomNumber: z.string().max(50).trim().optional().nullable(),
  workingDays: z.array(z.string()).min(1),
  slots: z.array(timetableSlotConfigSchema).min(1, 'At least one slot configuration is required'),
  entries: z.array(timetableEntryConfigSchema).default([]),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional().nullable(),
});

export type CreateTimetableInput = z.infer<typeof createTimetableSchema>;

// Schema to update a timetable
export const updateTimetableSchema = z.object({
  roomNumber: z.string().max(50).trim().optional().nullable(),
  workingDays: z.array(z.string()).optional(),
  slots: z.array(timetableSlotConfigSchema).optional(),
  entries: z.array(timetableEntryConfigSchema).optional(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional().nullable(),
  status: z.enum(TIMETABLE_STATUSES).optional(),
});

export type UpdateTimetableInput = z.infer<typeof updateTimetableSchema>;

export interface TimetableDetail {
  id: string;
  academicYear: string;
  departmentId: string;
  departmentName: string;
  departmentCode: string;
  programId: string | null;
  programName: string | null;
  year: string;
  semester: number;
  section: string;
  roomNumber: string | null;
  status: TimetableStatus;
  workingDays: string[];
  version: number;
  effectiveFrom: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  slots: Array<{
    id: string;
    startTime: string;
    endTime: string;
    slotType: TimetableSlotType;
    sequenceOrder: number;
  }>;
  entries: Array<{
    id: string;
    dayOfWeek: string;
    subjectId: string;
    subjectCode: string;
    subjectName: string;
    subjectAbbreviation: string | null;
    classType: ClassType;
    slots: Array<{
      id: string;
      startTime: string;
      endTime: string;
      sequenceOrder: number;
      slotType: TimetableSlotType;
    }>;
    faculties: Array<{
      id: string;
      fullName: string;
      employeeNumber: string;
    }>;
  }>;
}
