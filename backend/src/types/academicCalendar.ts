import { z } from 'zod';
import {
  PARSED_EVENT_TYPES,
  PARSED_EVENT_AUDIENCES,
} from './parsedEvent';

// ── Publish status ─────────────────────────────────────────────────────────────

export const CAL_PUBLISH_STATUSES = ['Published', 'Updated', 'Archived'] as const;
export type CalPublishStatus = (typeof CAL_PUBLISH_STATUSES)[number];

/**
 * Statuses the admin sets explicitly via the status endpoint.
 * 'Updated' is excluded — it is set automatically when admin edits event fields.
 */
export const ADMIN_SETTABLE_PUBLISH_STATUSES = ['Published', 'Archived'] as const;
export type AdminSettablePublishStatus = (typeof ADMIN_SETTABLE_PUBLISH_STATUSES)[number];

// ── Domain interface ───────────────────────────────────────────────────────────

/**
 * A live Academic Calendar Event — the authoritative public record.
 *
 * Traceability:
 *   parsedEventId      → the candidate event it was promoted from (Phase 2)
 *   sourceDocumentId   → the uploaded PDF (Phase 1)
 *   parsedEventTitle   → the original extracted text before admin edits
 *   isEdited           → true once any post-publication edit has been made
 */
export interface AcademicCalendarEvent {
  id: string;
  parsedEventId: string;
  sourceDocumentId: string;
  sourceDocumentTitle: string;
  parsedEventTitle: string;     // snapshot of the candidate event's title at publish time
  parsedEventStatus: string;    // current status of the backing candidate event
  title: string;
  description: string | null;
  startDate: string;            // YYYY-MM-DD
  endDate: string | null;       // YYYY-MM-DD
  eventType: (typeof PARSED_EVENT_TYPES)[number];
  targetAudience: (typeof PARSED_EVENT_AUDIENCES)[number];
  departmentId: string | null;
  departmentName: string | null;
  semester: number | null;
  publishStatus: CalPublishStatus;
  isEdited: boolean;
  createdBy: string;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedCalendarEvents {
  events: AcademicCalendarEvent[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PublishResult {
  published: number;
  skipped: number;
  errors: string[];
}

// ── Validation schemas ─────────────────────────────────────────────────────────

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .refine((d) => !isNaN(Date.parse(d)), { message: 'Invalid date value' });

/**
 * POST /api/calendar/publish — admin publishes one or more approved candidate events.
 * parsedEventIds: IDs of the parsed_events to promote.
 */
export const publishEventsSchema = z.object({
  parsedEventIds: z
    .array(z.string().uuid('Each ID must be a valid UUID'))
    .min(1, 'At least one event ID must be provided')
    .max(100, 'Cannot publish more than 100 events at once'),
});

export type PublishEventsInput = z.infer<typeof publishEventsSchema>;

/**
 * PATCH /api/calendar/:id — admin edits a published event's content.
 * Any change automatically sets is_edited=true and publish_status='Updated'.
 * Archived events cannot be edited; admin must restore them first.
 */
export const updateCalendarEventSchema = z
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

export type UpdateCalendarEventInput = z.infer<typeof updateCalendarEventSchema>;

/**
 * PATCH /api/calendar/:id/status — admin archives or restores a calendar event.
 * 'Updated' is excluded — it is set automatically by the edit endpoint.
 * Requesting 'Published' on an is_edited=true event restores it as 'Updated'.
 */
export const updateCalendarEventStatusSchema = z.object({
  publishStatus: z.enum(ADMIN_SETTABLE_PUBLISH_STATUSES),
});

export type UpdateCalendarEventStatusInput = z.infer<typeof updateCalendarEventStatusSchema>;

/**
 * GET /api/calendar — shared by admin, faculty, and students.
 * publishStatus filter is honoured for admin only; non-admin always sees Published+Updated.
 */
export const listCalendarEventsQuerySchema = z.object({
  page:             z.coerce.number().int().min(1).default(1),
  limit:            z.coerce.number().int().min(1).max(1000).default(50),
  publishStatus:    z.enum(CAL_PUBLISH_STATUSES).optional(),
  eventType:        z.enum(PARSED_EVENT_TYPES).optional(),
  targetAudience:   z.enum(PARSED_EVENT_AUDIENCES).optional(),
  departmentId:     z.string().uuid().optional(),
  semester:         z.coerce.number().int().min(1).max(12).optional(),
  startDateFrom:    isoDate.optional(),
  startDateTo:      isoDate.optional(),
  search:           z.string().max(200).optional(),
  sourceDocumentId: z.string().uuid().optional(),
});

export type ListCalendarEventsQuery = z.infer<typeof listCalendarEventsQuerySchema>;
