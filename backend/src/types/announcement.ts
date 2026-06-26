import { z } from 'zod';

// ── Enums ─────────────────────────────────────────────────────────────────────

export const ANNOUNCEMENT_AUDIENCES = [
  'All',
  'Students',
  'Faculty',
  'Admin',
  'Department Specific',
  'Semester Specific',
] as const;
export type AnnouncementAudience = (typeof ANNOUNCEMENT_AUDIENCES)[number];

export const ANNOUNCEMENT_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'] as const;
export type AnnouncementPriority = (typeof ANNOUNCEMENT_PRIORITIES)[number];

export const ANNOUNCEMENT_STATUSES = ['Draft', 'Published', 'Expired'] as const;
export type AnnouncementStatus = (typeof ANNOUNCEMENT_STATUSES)[number];

// ── Domain interface ──────────────────────────────────────────────────────────

/**
 * Full announcement record — used for both list and detail responses.
 * Content is always included so consumers do not need a second round-trip.
 * Future: a separate AnnouncementSummary (truncated content) can be introduced
 * when pagination performance warrants it.
 */
export interface Announcement {
  id: string;
  title: string;
  content: string;
  targetAudience: AnnouncementAudience;
  departmentId: string | null;
  departmentName: string | null;
  semester: number | null;
  priority: AnnouncementPriority;
  status: AnnouncementStatus;
  publishDate: string;        // YYYY-MM-DD
  expiryDate: string | null;  // YYYY-MM-DD
  createdBy: string;          // user UUID — FK anchor for future read receipts
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedAnnouncements {
  announcements: Announcement[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ── Validation schemas ────────────────────────────────────────────────────────

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .refine((d) => !isNaN(Date.parse(d)), { message: 'Invalid date value' });

/**
 * POST /api/announcements — admin creates an announcement.
 * targetAudience drives conditional requirements:
 *   • 'Department Specific' → departmentId required
 *   • 'Semester Specific'   → semester required
 * Audience and targeting fields are immutable after creation; to change them
 * admin must create a new announcement.
 */
export const createAnnouncementSchema = z
  .object({
    title: z.string().min(1, 'Title is required').max(255).trim(),
    content: z.string().min(1, 'Content is required').max(10000).trim(),
    targetAudience: z.enum(ANNOUNCEMENT_AUDIENCES),
    departmentId: z.string().uuid('Invalid department ID').optional(),
    semester: z.coerce.number().int().min(1).max(12).optional(),
    priority: z.enum(ANNOUNCEMENT_PRIORITIES).default('Medium'),
    publishDate: isoDate,
    expiryDate: isoDate.optional(),
  })
  .refine(
    (d) => d.targetAudience !== 'Department Specific' || d.departmentId !== undefined,
    { message: 'departmentId is required when targetAudience is "Department Specific"', path: ['departmentId'] }
  )
  .refine(
    (d) => d.targetAudience !== 'Semester Specific' || d.semester !== undefined,
    { message: 'semester is required when targetAudience is "Semester Specific"', path: ['semester'] }
  )
  .refine(
    (d) => !d.expiryDate || d.expiryDate >= d.publishDate,
    { message: 'expiryDate must be on or after publishDate', path: ['expiryDate'] }
  );

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;

/**
 * PATCH /api/announcements/:id — admin updates content/schedule fields.
 * targetAudience, departmentId, and semester are intentionally excluded;
 * audience changes require a new announcement to avoid confusing users who
 * have already received it.
 */
export const updateAnnouncementSchema = z
  .object({
    title: z.string().min(1).max(255).trim().optional(),
    content: z.string().min(1).max(10000).trim().optional(),
    priority: z.enum(ANNOUNCEMENT_PRIORITIES).optional(),
    publishDate: isoDate.optional(),
    expiryDate: isoDate.nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'At least one field must be provided' });

export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;

export const updateAnnouncementStatusSchema = z.object({
  status: z.enum(ANNOUNCEMENT_STATUSES),
});

export type UpdateAnnouncementStatusInput = z.infer<typeof updateAnnouncementStatusSchema>;

export const listAnnouncementsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(20),
  status: z.enum(ANNOUNCEMENT_STATUSES).optional(),
  priority: z.enum(ANNOUNCEMENT_PRIORITIES).optional(),
  targetAudience: z.enum(ANNOUNCEMENT_AUDIENCES).optional(),
  departmentId: z.string().uuid().optional(),
  semester: z.coerce.number().int().min(1).max(12).optional(),
  publishDateFrom: isoDate.optional(),
  publishDateTo: isoDate.optional(),
  search: z.string().max(100).trim().optional(),
});

export type ListAnnouncementsQuery = z.infer<typeof listAnnouncementsQuerySchema>;
