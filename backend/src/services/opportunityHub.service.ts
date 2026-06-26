import { query } from '../config/database';
import { auditLog } from '../utils/audit';
import { AppError } from '../errors/AppError';
import type { Role } from '../types/roles';
import type {
  Opportunity,
  OpportunityType,
  OpportunityStatus,
  YearGroup,
  CreateOpportunityInput,
  UpdateOpportunityInput,
  ListOpportunitiesQuery,
  PaginatedOpportunities,
  BookmarkResult,
} from '../types/opportunityHub';
import { FACULTY_SETTABLE_STATUSES } from '../types/opportunityHub';

// ── Row types ──────────────────────────────────────────────────────────────────

interface OpportunityRow {
  id: string;
  title: string;
  description: string | null;
  type: OpportunityType;
  department_id: string | null;
  department_name: string | null;
  eligible_years: string[] | null;
  registration_link: string | null;
  start_date: Date | null;
  deadline: Date | null;
  location: string | null;
  organizer: string | null;
  status: OpportunityStatus;
  created_by: string;
  created_by_name: string;
  is_bookmarked: boolean;
  created_at: Date;
  updated_at: Date;
}

interface OpportunityListRow extends OpportunityRow {
  total_count: string;
}

// ── Shared SQL fragments ───────────────────────────────────────────────────────

const COLS = `
  opp.id,
  opp.title,
  opp.description,
  opp.type,
  opp.department_id,
  d.name          AS department_name,
  opp.eligible_years,
  opp.registration_link,
  opp.start_date,
  opp.deadline,
  opp.location,
  opp.organizer,
  opp.status,
  opp.created_by,
  u.full_name     AS created_by_name,
  opp.created_at,
  opp.updated_at
`;

const JOINS = `
  LEFT JOIN departments d ON d.id = opp.department_id
  JOIN      users       u ON u.id = opp.created_by
`;

// ── Mapper ─────────────────────────────────────────────────────────────────────

function toOpportunity(r: OpportunityRow): Opportunity {
  return {
    id:               r.id,
    title:            r.title,
    description:      r.description,
    type:             r.type,
    departmentId:     r.department_id,
    departmentName:   r.department_name,
    eligibleYears:    r.eligible_years as YearGroup[] | null,
    registrationLink: r.registration_link,
    startDate:        r.start_date,
    deadline:         r.deadline,
    location:         r.location,
    organizer:        r.organizer,
    status:           r.status,
    createdBy:        r.created_by,
    createdByName:    r.created_by_name,
    isBookmarked:     r.is_bookmarked ?? false,
    createdAt:        r.created_at,
    updatedAt:        r.updated_at,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function semesterToYearGroup(semester: number): YearGroup {
  if (semester <= 2) return 'I Year';
  if (semester <= 4) return 'II Year';
  if (semester <= 6) return 'III Year';
  return 'IV Year';
}

interface StudentCtx {
  studentId: string;
  departmentId: string;
  yearGroup: YearGroup;
}

async function resolveStudentCtx(userId: string): Promise<StudentCtx> {
  const { rows } = await query<{ id: string; department_id: string; semester: number }>(
    'SELECT id, department_id, semester FROM students WHERE user_id = $1 AND deleted_at IS NULL',
    [userId]
  );
  if (!rows[0]) throw AppError.notFound('Student profile not found');
  return {
    studentId:    rows[0].id,
    departmentId: rows[0].department_id,
    yearGroup:    semesterToYearGroup(rows[0].semester),
  };
}

async function fetchOpportunityRow(id: string): Promise<OpportunityRow | null> {
  const { rows } = await query<OpportunityRow>(
    `SELECT ${COLS}, FALSE AS is_bookmarked
     FROM opportunities opp ${JOINS}
     WHERE opp.id = $1 AND opp.deleted_at IS NULL`,
    [id]
  );
  return rows[0] ?? null;
}

// ── Exports ────────────────────────────────────────────────────────────────────

export async function createOpportunity(
  userId: string,
  data: CreateOpportunityInput
): Promise<Opportunity> {
  if (data.startDate && data.deadline && new Date(data.startDate) > new Date(data.deadline)) {
    throw AppError.badRequest('start_date must be on or before deadline');
  }

  const { rows } = await query<{ id: string }>(
    `INSERT INTO opportunities
       (title, description, type, department_id, eligible_years,
        registration_link, start_date, deadline, location, organizer, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id`,
    [
      data.title,
      data.description ?? null,
      data.type,
      data.departmentId ?? null,
      data.eligibleYears ?? null,
      data.registrationLink ?? null,
      data.startDate ?? null,
      data.deadline ?? null,
      data.location ?? null,
      data.organizer ?? null,
      userId,
    ]
  );

  await auditLog({ actorId: userId, action: 'CREATE', resource: 'opportunity', resourceId: rows[0].id });

  const row = await fetchOpportunityRow(rows[0].id);
  return toOpportunity(row!);
}

export async function listOpportunities(
  userId: string,
  role: Role,
  filters: ListOpportunitiesQuery
): Promise<PaginatedOpportunities> {
  const { page, limit, type, status, departmentId } = filters;
  const offset = (page - 1) * limit;
  const conditions: string[] = ['opp.deleted_at IS NULL'];
  const params: unknown[] = [];

  // ── Role-based visibility scope ────────────────────────────────────────────

  // Resolve student context once so it can be used for both scope and bookmark join
  let studentCtx: StudentCtx | null = null;

  if (role === 'student') {
    studentCtx = await resolveStudentCtx(userId);
    conditions.push(`opp.status = 'Active'`);
    params.push(studentCtx.departmentId, studentCtx.yearGroup);
    conditions.push(
      `(opp.department_id IS NULL OR opp.department_id = $${params.length - 1})`,
      `(opp.eligible_years IS NULL OR $${params.length} = ANY(opp.eligible_years))`
    );
  } else if (role === 'faculty') {
    // Faculty sees all Active + any they created (regardless of status)
    params.push(userId);
    conditions.push(`(opp.status = 'Active' OR opp.created_by = $${params.length})`);
  }
  // Admin: no scope restriction

  // ── Optional query filters ─────────────────────────────────────────────────

  if (type) {
    params.push(type);
    conditions.push(`opp.type = $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`opp.status = $${params.length}`);
  }
  if (departmentId) {
    params.push(departmentId);
    conditions.push(`(opp.department_id = $${params.length} OR opp.department_id IS NULL)`);
  }

  // ── Bookmark join (students only) ──────────────────────────────────────────

  let bookmarkJoin = '';
  let bookmarkCol  = 'FALSE AS is_bookmarked';

  if (role === 'student' && studentCtx) {
    params.push(studentCtx.studentId);
    bookmarkJoin = `LEFT JOIN opportunity_bookmarks ob ON ob.opportunity_id = opp.id AND ob.student_id = $${params.length}`;
    bookmarkCol  = 'CASE WHEN ob.id IS NOT NULL THEN TRUE ELSE FALSE END AS is_bookmarked';
  }

  // ── Pagination ─────────────────────────────────────────────────────────────

  params.push(limit, offset);
  const limitN  = params.length - 1;
  const offsetN = params.length;

  const { rows } = await query<OpportunityListRow>(
    `SELECT ${COLS}, ${bookmarkCol}, COUNT(*) OVER() AS total_count
     FROM opportunities opp ${JOINS} ${bookmarkJoin}
     WHERE ${conditions.join(' AND ')}
     ORDER BY
       CASE WHEN opp.status = 'Active' THEN 0 ELSE 1 END,
       opp.deadline ASC NULLS LAST,
       opp.created_at DESC
     LIMIT $${limitN} OFFSET $${offsetN}`,
    params
  );

  const total = rows[0] ? Number(rows[0].total_count) : 0;
  return {
    opportunities: rows.map(toOpportunity),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getOpportunityById(
  userId: string,
  role: Role,
  id: string
): Promise<Opportunity> {
  const params: unknown[] = [id];
  let bookmarkJoin = '';
  let bookmarkCol  = 'FALSE AS is_bookmarked';

  if (role === 'student') {
    const { studentId } = await resolveStudentCtx(userId);
    params.push(studentId);
    bookmarkJoin = `LEFT JOIN opportunity_bookmarks ob ON ob.opportunity_id = opp.id AND ob.student_id = $${params.length}`;
    bookmarkCol  = 'CASE WHEN ob.id IS NOT NULL THEN TRUE ELSE FALSE END AS is_bookmarked';
  }

  const { rows } = await query<OpportunityRow>(
    `SELECT ${COLS}, ${bookmarkCol}
     FROM opportunities opp ${JOINS} ${bookmarkJoin}
     WHERE opp.id = $1 AND opp.deleted_at IS NULL`,
    params
  );

  if (!rows[0]) throw AppError.notFound('Opportunity not found');

  // Students and faculty have restricted visibility
  if (role === 'student' && rows[0].status !== 'Active') {
    throw AppError.notFound('Opportunity not found');
  }
  if (role === 'faculty' && rows[0].status !== 'Active' && rows[0].created_by !== userId) {
    throw AppError.notFound('Opportunity not found');
  }

  return toOpportunity(rows[0]);
}

export async function updateOpportunity(
  userId: string,
  role: Role,
  id: string,
  data: UpdateOpportunityInput
): Promise<Opportunity> {
  const existing = await fetchOpportunityRow(id);
  if (!existing) throw AppError.notFound('Opportunity not found');

  // Faculty ownership and status-change restrictions
  if (role === 'faculty') {
    if (existing.created_by !== userId) {
      throw AppError.forbidden('You can only edit opportunities you created');
    }
    if (
      data.status !== undefined &&
      !FACULTY_SETTABLE_STATUSES.includes(data.status as (typeof FACULTY_SETTABLE_STATUSES)[number])
    ) {
      throw AppError.forbidden(
        `Faculty can only set status to: ${FACULTY_SETTABLE_STATUSES.join(', ')}`
      );
    }
  }

  // Validate combined date consistency
  const finalStart = data.startDate !== undefined
    ? (data.startDate ? new Date(data.startDate) : null)
    : existing.start_date;
  const finalDeadline = data.deadline !== undefined
    ? (data.deadline ? new Date(data.deadline) : null)
    : existing.deadline;
  if (finalStart && finalDeadline && finalStart > finalDeadline) {
    throw AppError.badRequest('start_date must be on or before deadline');
  }

  const sets: string[] = [];
  const sqlParams: unknown[] = [];

  const push = (col: string, val: unknown) => {
    sqlParams.push(val);
    sets.push(`${col} = $${sqlParams.length}`);
  };

  if (data.title            !== undefined) push('title',             data.title);
  if ('description'          in data)      push('description',       data.description ?? null);
  if (data.type             !== undefined) push('type',              data.type);
  if ('departmentId'         in data)      push('department_id',     data.departmentId ?? null);
  if ('eligibleYears'        in data)      push('eligible_years',    data.eligibleYears ?? null);
  if ('registrationLink'     in data)      push('registration_link', data.registrationLink ?? null);
  if ('startDate'            in data)      push('start_date',        data.startDate ?? null);
  if ('deadline'             in data)      push('deadline',          data.deadline ?? null);
  if ('location'             in data)      push('location',          data.location ?? null);
  if ('organizer'            in data)      push('organizer',         data.organizer ?? null);
  if (data.status           !== undefined) push('status',            data.status);

  if (sets.length === 0) throw AppError.badRequest('No fields to update');

  sqlParams.push(id);
  await query(
    `UPDATE opportunities SET ${sets.join(', ')} WHERE id = $${sqlParams.length}`,
    sqlParams
  );

  await auditLog({
    actorId:    userId,
    action:     'UPDATE',
    resource:   'opportunity',
    resourceId: id,
    changes:    data as Record<string, unknown>,
  });

  const updated = await fetchOpportunityRow(id);
  return toOpportunity(updated!);
}

export async function deleteOpportunity(userId: string, id: string): Promise<void> {
  const existing = await fetchOpportunityRow(id);
  if (!existing) throw AppError.notFound('Opportunity not found');

  await query('UPDATE opportunities SET deleted_at = NOW() WHERE id = $1', [id]);

  await auditLog({ actorId: userId, action: 'DELETE', resource: 'opportunity', resourceId: id });
}

export async function toggleBookmark(userId: string, opportunityId: string): Promise<BookmarkResult> {
  const { rows: opp } = await query<{ status: OpportunityStatus }>(
    'SELECT status FROM opportunities WHERE id = $1 AND deleted_at IS NULL',
    [opportunityId]
  );
  if (!opp[0] || opp[0].status !== 'Active') {
    throw AppError.notFound('Opportunity not found');
  }

  const { studentId } = await resolveStudentCtx(userId);

  const { rows: existing } = await query<{ id: string }>(
    'SELECT id FROM opportunity_bookmarks WHERE student_id = $1 AND opportunity_id = $2',
    [studentId, opportunityId]
  );

  if (existing[0]) {
    await query(
      'DELETE FROM opportunity_bookmarks WHERE student_id = $1 AND opportunity_id = $2',
      [studentId, opportunityId]
    );
    return { bookmarked: false, opportunityId };
  }

  await query(
    'INSERT INTO opportunity_bookmarks (student_id, opportunity_id) VALUES ($1, $2)',
    [studentId, opportunityId]
  );
  return { bookmarked: true, opportunityId };
}

export async function listBookmarks(
  userId: string,
  filters: Pick<ListOpportunitiesQuery, 'page' | 'limit'>
): Promise<PaginatedOpportunities> {
  const { page, limit } = filters;
  const offset = (page - 1) * limit;

  const { studentId } = await resolveStudentCtx(userId);

  const { rows } = await query<OpportunityListRow>(
    `SELECT ${COLS}, TRUE AS is_bookmarked, COUNT(*) OVER() AS total_count
     FROM opportunity_bookmarks ob
     JOIN opportunities opp ON opp.id = ob.opportunity_id AND opp.deleted_at IS NULL
     ${JOINS}
     WHERE ob.student_id = $1
     ORDER BY ob.created_at DESC
     LIMIT $2 OFFSET $3`,
    [studentId, limit, offset]
  );

  const total = rows[0] ? Number(rows[0].total_count) : 0;
  return {
    opportunities: rows.map(toOpportunity),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
