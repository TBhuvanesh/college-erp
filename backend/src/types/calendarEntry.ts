import { z } from 'zod';

export const CALENDAR_EVENT_TYPES = [
  'Academic',
  'Assignment Deadline',
  'Examination',
  'Opportunity',
  'Reminder',
  'Meeting',
  'Other',
] as const;

export const CALENDAR_VISIBILITIES = [
  'personal',
  'department',
  'semester',
  'faculty',
  'student',
  'institution_wide',
] as const;

export type CalendarEventType  = (typeof CALENDAR_EVENT_TYPES)[number];
export type CalendarVisibility = (typeof CALENDAR_VISIBILITIES)[number];

export interface CalendarEntry {
  id: string;
  title: string;
  description: string | null;
  eventType: CalendarEventType;
  startDate: Date;
  endDate: Date | null;
  visibility: CalendarVisibility;
  sourceModule: string | null;
  sourceId: string | null;
  departmentId: string | null;
  departmentName: string | null;
  semester: number | null;
  createdBy: string;
  createdByName: string;
  isOwner: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedCalendarEntries {
  entries: CalendarEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ── Zod schemas ──────────────────────────────────────────────────────────────────

export const createCalendarEntrySchema = z.object({
  title:        z.string().min(1).max(255),
  description:  z.string().optional().nullable(),
  eventType:    z.enum(CALENDAR_EVENT_TYPES).default('Other'),
  startDate:    z.string().datetime().optional(),
  endDate:      z.string().datetime().optional().nullable(),
  visibility:   z.enum(CALENDAR_VISIBILITIES).default('personal'),
  departmentId: z.string().uuid().optional().nullable(),
  semester:     z.coerce.number().int().min(1).max(12).optional().nullable(),
  sourceModule: z.enum(['announcement', 'academic_calendar', 'lms_assignment', 'opportunity'] as const).optional(),
  sourceId:     z.string().uuid().optional(),
});

export const updateCalendarEntrySchema = z.object({
  title:       z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  eventType:   z.enum(CALENDAR_EVENT_TYPES).optional(),
  startDate:   z.string().datetime().optional(),
  endDate:     z.string().datetime().optional().nullable(),
  visibility:  z.enum(CALENDAR_VISIBILITIES).optional(),
  semester:    z.coerce.number().int().min(1).max(12).optional().nullable(),
});

export const listCalendarQuerySchema = z.object({
  eventType: z.enum(CALENDAR_EVENT_TYPES).optional(),
  from:      z.string().datetime().optional(),
  to:        z.string().datetime().optional(),
  page:      z.coerce.number().int().min(1).default(1),
  limit:     z.coerce.number().int().min(1).max(100).default(20),
});

// z.input preserves optional fields where .default() is used, so callers can omit them
export type CreateCalendarEntryInput = z.input<typeof createCalendarEntrySchema>;
export type UpdateCalendarEntryInput = z.infer<typeof updateCalendarEntrySchema>;
export type ListCalendarQuery        = z.infer<typeof listCalendarQuerySchema>;
