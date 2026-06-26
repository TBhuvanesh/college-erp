import { z } from 'zod';

// ── Enums ──────────────────────────────────────────────────────────────────────

export const PARSED_EVENT_TYPES = [
  'Class Commencement',
  'Mid-Term Examination',
  'End Semester Examination',
  'Lab Examination',
  'Internal Assessment',
  'Holiday',
  'Supplementary Examination',
  'Academic Activity',
  'Other',
] as const;
export type ParsedEventType = (typeof PARSED_EVENT_TYPES)[number];

export const PARSED_EVENT_AUDIENCES = [
  'All', 'Students', 'Faculty',
  'I Year', 'II Year', 'III Year', 'IV Year',
] as const;
export type ParsedEventAudience = (typeof PARSED_EVENT_AUDIENCES)[number];

export const PARSED_EVENT_STATUSES = ['Pending', 'Approved', 'Edited', 'Rejected'] as const;
export type ParsedEventStatus = (typeof PARSED_EVENT_STATUSES)[number];

/**
 * Statuses the admin sets explicitly via the status endpoint.
 * 'Edited' is excluded — it is set automatically when admin modifies event fields.
 */
export const ADMIN_SETTABLE_STATUSES = ['Approved', 'Rejected', 'Pending'] as const;
export type AdminSettableStatus = (typeof ADMIN_SETTABLE_STATUSES)[number];

// ── Domain interface ───────────────────────────────────────────────────────────

/**
 * Full ParsedEvent record — same shape used for list and detail responses.
 * documentTitle is included so the admin review UI can show the source PDF
 * without a second round-trip.
 */
export interface ParsedEvent {
  id: string;
  documentId: string;
  documentTitle: string;
  title: string;
  description: string | null;
  startDate: string;            // YYYY-MM-DD
  endDate: string | null;       // YYYY-MM-DD
  eventType: ParsedEventType;
  targetAudience: ParsedEventAudience;
  departmentId: string | null;
  departmentName: string | null;
  semester: number | null;
  status: ParsedEventStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedParsedEvents {
  events: ParsedEvent[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ParseResult {
  created: number;
  replacedPending: number;
}

// ── Validation schemas ─────────────────────────────────────────────────────────

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .refine((d) => !isNaN(Date.parse(d)), { message: 'Invalid date value' });

/**
 * PATCH /api/parsed-events/:id — admin edits extracted fields.
 * targetAudience is editable (unlike announcements) because extraction may
 * mis-classify; admin needs to be able to correct all fields.
 * Editing auto-transitions status to 'Edited' regardless of current status.
 */
export const updateParsedEventSchema = z
  .object({
    title:          z.string().min(1).max(500).trim().optional(),
    description:    z.string().max(2000).trim().nullable().optional(),
    startDate:      isoDate.optional(),
    endDate:        isoDate.nullable().optional(),
    eventType:      z.enum(PARSED_EVENT_TYPES).optional(),
    targetAudience: z.enum(PARSED_EVENT_AUDIENCES).optional(),
    departmentId:   z.string().uuid('Invalid department ID').nullable().optional(),
    semester:       z.coerce.number().int().min(1).max(12).nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'At least one field must be provided' })
  .refine(
    (d) => !d.startDate || !d.endDate || d.endDate >= d.startDate,
    { message: 'endDate must be on or after startDate', path: ['endDate'] }
  );

export type UpdateParsedEventInput = z.infer<typeof updateParsedEventSchema>;

/**
 * PATCH /api/parsed-events/:id/status — explicit admin status change.
 * 'Edited' is excluded — it is set automatically by the edit endpoint.
 */
export const updateParsedEventStatusSchema = z.object({
  status: z.enum(ADMIN_SETTABLE_STATUSES),
});

export type UpdateParsedEventStatusInput = z.infer<typeof updateParsedEventStatusSchema>;

export const listParsedEventsQuerySchema = z.object({
  page:           z.coerce.number().int().min(1).default(1),
  limit:          z.coerce.number().int().min(1).max(1000).default(50),
  documentId:     z.string().uuid().optional(),
  status:         z.enum(PARSED_EVENT_STATUSES).optional(),
  eventType:      z.enum(PARSED_EVENT_TYPES).optional(),
  targetAudience: z.enum(PARSED_EVENT_AUDIENCES).optional(),
  startDateFrom:  isoDate.optional(),
  startDateTo:    isoDate.optional(),
});

export type ListParsedEventsQuery = z.infer<typeof listParsedEventsQuerySchema>;
