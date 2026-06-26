import { z } from 'zod';

// ── Enums ──────────────────────────────────────────────────────────────────────

export const OPPORTUNITY_TYPES = [
  'Internship',
  'Job Opportunity',
  'Workshop',
  'Seminar',
  'Hackathon',
  'Competition',
  'Placement Drive',
  'College Event',
] as const;
export type OpportunityType = (typeof OPPORTUNITY_TYPES)[number];

export const OPPORTUNITY_STATUSES = ['Active', 'Closed', 'Archived'] as const;
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];

export const YEAR_GROUPS = ['I Year', 'II Year', 'III Year', 'IV Year'] as const;
export type YearGroup = (typeof YEAR_GROUPS)[number];

// ── Interfaces ─────────────────────────────────────────────────────────────────

export interface Opportunity {
  id: string;
  title: string;
  description: string | null;
  type: OpportunityType;
  departmentId: string | null;
  departmentName: string | null;    // denormalized for display
  eligibleYears: YearGroup[] | null; // null = all years
  registrationLink: string | null;
  startDate: Date | null;
  deadline: Date | null;
  location: string | null;
  organizer: string | null;
  status: OpportunityStatus;
  createdBy: string;
  createdByName: string;
  isBookmarked: boolean;             // always false for admin/faculty
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedOpportunities {
  opportunities: Opportunity[];
  total:         number;
  page:          number;
  limit:         number;
  totalPages:    number;
}

export interface BookmarkResult {
  bookmarked: boolean;
  opportunityId: string;
}

// ── Zod schemas ────────────────────────────────────────────────────────────────

export const createOpportunitySchema = z.object({
  title:            z.string().trim().min(1).max(255),
  description:      z.string().trim().max(5000).optional().nullable(),
  type:             z.enum(OPPORTUNITY_TYPES),
  departmentId:     z.string().uuid('Invalid department ID').optional().nullable(),
  eligibleYears:    z.array(z.enum(YEAR_GROUPS)).min(1).optional().nullable(),
  registrationLink: z.string().url('Must be a valid URL').optional().nullable(),
  startDate:        z.string().datetime().optional().nullable(),
  deadline:         z.string().datetime().optional().nullable(),
  location:         z.string().trim().max(255).optional().nullable(),
  organizer:        z.string().trim().max(255).optional().nullable(),
});
export type CreateOpportunityInput = z.infer<typeof createOpportunitySchema>;

export const updateOpportunitySchema = z.object({
  title:            z.string().trim().min(1).max(255).optional(),
  description:      z.string().trim().max(5000).optional().nullable(),
  type:             z.enum(OPPORTUNITY_TYPES).optional(),
  departmentId:     z.string().uuid().optional().nullable(),
  eligibleYears:    z.array(z.enum(YEAR_GROUPS)).min(1).optional().nullable(),
  registrationLink: z.string().url().optional().nullable(),
  startDate:        z.string().datetime().optional().nullable(),
  deadline:         z.string().datetime().optional().nullable(),
  location:         z.string().trim().max(255).optional().nullable(),
  organizer:        z.string().trim().max(255).optional().nullable(),
  status:           z.enum(OPPORTUNITY_STATUSES).optional(),
});
export type UpdateOpportunityInput = z.infer<typeof updateOpportunitySchema>;

export const listOpportunitiesQuerySchema = z.object({
  type:         z.enum(OPPORTUNITY_TYPES).optional(),
  status:       z.enum(OPPORTUNITY_STATUSES).optional(),
  departmentId: z.string().uuid().optional(),
  page:         z.coerce.number().int().min(1).default(1),
  limit:        z.coerce.number().int().min(1).max(100).default(20),
});
export type ListOpportunitiesQuery = z.infer<typeof listOpportunitiesQuerySchema>;

// ── Role-based status permissions ──────────────────────────────────────────────

// Faculty may only archive their own; only admin may close or re-activate.
export const FACULTY_SETTABLE_STATUSES: ReadonlyArray<OpportunityStatus> = ['Archived'] as const;
