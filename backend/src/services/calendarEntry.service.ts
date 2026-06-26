import { query } from '../config/database';
import { auditLog } from '../utils/audit';
import { AppError } from '../errors/AppError';
import type { Role } from '../types/roles';
import type {
  CalendarEntry,
  CalendarEventType,
  CalendarVisibility,
  CreateCalendarEntryInput,
  UpdateCalendarEntryInput,
  ListCalendarQuery,
  PaginatedCalendarEntries,
} from '../types/calendarEntry';

// ── Row types ────────────────────────────────────────────────────────────────────

interface CalendarRow {
  id: string;
  title: string;
  description: string | null;
  event_type: CalendarEventType;
  start_date: Date;
  end_date: Date | null;
  visibility: CalendarVisibility;
  source_module: string | null;
  source_id: string | null;
  department_id: string | null;
  department_name: string | null;
  semester: number | null;
  created_by: string;
  created_by_name: string;
  created_at: Date;
  updated_at: Date;
}

interface CalendarListRow extends CalendarRow {
  total_count: string;
}

// ── SQL fragments ────────────────────────────────────────────────────────────────

const COLS = `
  ce.id,
  ce.title,
  ce.description,
  ce.event_type,
  ce.start_date,
  ce.end_date,
  ce.visibility,
  ce.source_module,
  ce.source_id,
  ce.department_id,
  d.name           AS department_name,
  ce.semester,
  ce.created_by,
  u.full_name      AS created_by_name,
  ce.created_at,
  ce.updated_at
`;

const JOINS = `
  LEFT JOIN departments d ON d.id = ce.department_id
  JOIN      users       u ON u.id = ce.created_by
`;

// ── Mapper ───────────────────────────────────────────────────────────────────────

function toCalendarEntry(r: CalendarRow, userId: string): CalendarEntry {
  return {
    id:             r.id,
    title:          r.title,
    description:    r.description,
    eventType:      r.event_type,
    startDate:      r.start_date,
    endDate:        r.end_date,
    visibility:     r.visibility,
    sourceModule:   r.source_module,
    sourceId:       r.source_id,
    departmentId:   r.department_id,
    departmentName: r.department_name,
    semester:       r.semester,
    createdBy:      r.created_by,
    createdByName:  r.created_by_name,
    isOwner:        r.created_by === userId,
    createdAt:      r.created_at,
    updatedAt:      r.updated_at,
  };
}

// ── Source enrichment ────────────────────────────────────────────────────────────

interface SourceData {
  startDate: Date | null;
  endDate:   Date | null;
  eventType: CalendarEventType;
}

async function enrichSourceForCalendar(
  sourceModule: string,
  sourceId: string
): Promise<SourceData | null> {
  switch (sourceModule) {
    case 'academic_calendar': {
      const { rows } = await query<{ start_date: Date; end_date: Date | null }>(
        'SELECT start_date, end_date FROM academic_calendar_events WHERE id = $1 AND deleted_at IS NULL',
        [sourceId]
      );
      if (!rows[0]) return null;
      return {
        startDate: rows[0].start_date,
        endDate:   rows[0].end_date,
        eventType: 'Academic',
      };
    }
    case 'lms_assignment': {
      const { rows } = await query<{ due_date: Date }>(
        'SELECT due_date FROM assignments WHERE id = $1 AND deleted_at IS NULL',
        [sourceId]
      );
      if (!rows[0]) return null;
      return { startDate: rows[0].due_date, endDate: null, eventType: 'Assignment Deadline' };
    }
    case 'opportunity': {
      const { rows } = await query<{ start_date: Date | null; deadline: Date | null }>(
        'SELECT start_date, deadline FROM opportunities WHERE id = $1 AND deleted_at IS NULL',
        [sourceId]
      );
      if (!rows[0]) return null;
      return {
        startDate: rows[0].start_date ?? rows[0].deadline,
        endDate:   rows[0].deadline,
        eventType: 'Opportunity',
      };
    }
    case 'announcement': {
      const { rows } = await query<{ publish_date: Date }>(
        'SELECT publish_date FROM announcements WHERE id = $1 AND deleted_at IS NULL',
        [sourceId]
      );
      if (!rows[0]) return null;
      return { startDate: rows[0].publish_date, endDate: null, eventType: 'Other' };
    }
    default:
      return null;
  }
}

// ── Role context helpers ─────────────────────────────────────────────────────────

interface UserCtx {
  departmentId: string | null;
  semester: number | null;
}

async function resolveUserCtx(userId: string, role: Role): Promise<UserCtx> {
  if (role === 'faculty') {
    const { rows } = await query<{ department_id: string }>(
      'SELECT department_id FROM faculty WHERE user_id = $1 AND deleted_at IS NULL',
      [userId]
    );
    return { departmentId: rows[0]?.department_id ?? null, semester: null };
  }
  if (role === 'student') {
    const { rows } = await query<{ department_id: string; semester: number }>(
      'SELECT department_id, semester FROM students WHERE user_id = $1 AND deleted_at IS NULL',
      [userId]
    );
    if (!rows[0]) throw AppError.notFound('Student profile not found');
    return { departmentId: rows[0].department_id, semester: rows[0].semester };
  }
  return { departmentId: null, semester: null };
}

// ── Visibility guard ─────────────────────────────────────────────────────────────

function assertVisibilityPermission(role: Role, visibility: CalendarVisibility): void {
  if (role === 'student' && visibility !== 'personal') {
    throw AppError.forbidden('Students can only create personal calendar entries');
  }
  if (role === 'faculty' && visibility === 'institution_wide') {
    throw AppError.forbidden('Only admin can create institution-wide calendar entries');
  }
}

// ── Exports ──────────────────────────────────────────────────────────────────────

export async function createCalendarEntry(
  userId: string,
  role: Role,
  data: CreateCalendarEntryInput
): Promise<CalendarEntry> {
  const visibility = data.visibility ?? 'personal';
  assertVisibilityPermission(role, visibility);

  const userCtx = await resolveUserCtx(userId, role);

  let startDate: Date | null = data.startDate ? new Date(data.startDate) : null;
  let endDate:   Date | null = data.endDate   ? new Date(data.endDate)   : null;
  let eventType: CalendarEventType = data.eventType ?? 'Other';

  // Auto-enrich from source if linked
  if (data.sourceModule && data.sourceId) {
    const enriched = await enrichSourceForCalendar(data.sourceModule, data.sourceId);
    if (!enriched) {
      throw AppError.badRequest(`Source ${data.sourceModule}:${data.sourceId} not found`);
    }
    if (!startDate && enriched.startDate) startDate = enriched.startDate;
    if (!endDate   && enriched.endDate)   endDate   = enriched.endDate;
    if (eventType === 'Other')            eventType = enriched.eventType;
  }

  if (!startDate) {
    throw AppError.badRequest('startDate is required (provide directly or via sourceModule/sourceId)');
  }

  if (endDate && endDate < startDate) {
    throw AppError.badRequest('endDate must be on or after startDate');
  }

  // Faculty: always use their own departmentId for dept/semester-scoped entries
  const departmentId =
    role === 'faculty' ? userCtx.departmentId : (data.departmentId ?? null);

  const { rows } = await query<{ id: string }>(
    `INSERT INTO calendar_entries
       (title, description, event_type, start_date, end_date, visibility,
        source_module, source_id, department_id, semester, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id`,
    [
      data.title,
      data.description ?? null,
      eventType,
      startDate,
      endDate,
      visibility,
      data.sourceModule ?? null,
      data.sourceId     ?? null,
      departmentId,
      data.semester ?? null,
      userId,
    ]
  );

  await auditLog({
    actorId:    userId,
    action:     'CREATE',
    resource:   'calendar_entry',
    resourceId: rows[0].id,
  });

  const { rows: created } = await query<CalendarRow>(
    `SELECT ${COLS} FROM calendar_entries ce ${JOINS}
     WHERE ce.id = $1 AND ce.deleted_at IS NULL`,
    [rows[0].id]
  );
  return toCalendarEntry(created[0], userId);
}

export async function listCalendarEntries(
  userId: string,
  role: Role,
  filters: ListCalendarQuery
): Promise<PaginatedCalendarEntries> {
  const { page, limit, eventType, from, to } = filters;
  const offset = (page - 1) * limit;
  const params: unknown[] = [];
  const conditions: string[] = ['ce.deleted_at IS NULL'];

  // ── Visibility-based scope ─────────────────────────────────────────────────

  if (role === 'admin') {
    // Admin sees all entries — no visibility filter
  } else if (role === 'faculty') {
    const ctx = await resolveUserCtx(userId, role);
    params.push(userId);
    const userN  = params.length;
    let visExpr = `(
      (ce.visibility = 'personal'          AND ce.created_by = $${userN})
      OR ce.visibility = 'institution_wide'
      OR ce.visibility = 'faculty'`;
    if (ctx.departmentId) {
      params.push(ctx.departmentId);
      visExpr += `
      OR (ce.visibility = 'department' AND (ce.department_id IS NULL OR ce.department_id = $${params.length}))`;
    }
    visExpr += '\n    )';
    conditions.push(visExpr);
  } else {
    // Student
    const ctx = await resolveUserCtx(userId, role);
    params.push(userId, ctx.departmentId, ctx.semester);
    const [userN, deptN, semN] = [params.length - 2, params.length - 1, params.length];
    conditions.push(`(
      (ce.visibility = 'personal'          AND ce.created_by = $${userN})
      OR ce.visibility = 'institution_wide'
      OR ce.visibility = 'student'
      OR (ce.visibility = 'department' AND (ce.department_id IS NULL OR ce.department_id = $${deptN}))
      OR (ce.visibility = 'semester'   AND ce.semester = $${semN}
          AND (ce.department_id IS NULL OR ce.department_id = $${deptN}))
    )`);
  }

  // ── Optional filters ───────────────────────────────────────────────────────

  if (eventType) {
    params.push(eventType);
    conditions.push(`ce.event_type = $${params.length}`);
  }
  if (from) {
    params.push(from);
    conditions.push(`ce.start_date >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    conditions.push(`ce.start_date <= $${params.length}`);
  }

  params.push(limit, offset);
  const limitN  = params.length - 1;
  const offsetN = params.length;

  const { rows } = await query<CalendarListRow>(
    `SELECT ${COLS}, COUNT(*) OVER() AS total_count
     FROM calendar_entries ce ${JOINS}
     WHERE ${conditions.join(' AND ')}
     ORDER BY ce.start_date ASC
     LIMIT $${limitN} OFFSET $${offsetN}`,
    params
  );

  const total = rows[0] ? Number(rows[0].total_count) : 0;
  return {
    entries:    rows.map((r) => toCalendarEntry(r, userId)),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function updateCalendarEntry(
  userId: string,
  role: Role,
  id: string,
  data: UpdateCalendarEntryInput
): Promise<CalendarEntry> {
  const { rows: existing } = await query<{ id: string; created_by: string; start_date: Date; end_date: Date | null }>(
    'SELECT id, created_by, start_date, end_date FROM calendar_entries WHERE id = $1 AND deleted_at IS NULL',
    [id]
  );
  if (!existing[0]) throw AppError.notFound('Calendar entry not found');
  if (role !== 'admin' && existing[0].created_by !== userId) {
    throw AppError.forbidden('You can only edit calendar entries you created');
  }

  // Date consistency check
  const finalStart = data.startDate ? new Date(data.startDate) : existing[0].start_date;
  const finalEnd   = data.endDate !== undefined
    ? (data.endDate ? new Date(data.endDate) : null)
    : existing[0].end_date;
  if (finalEnd && finalEnd < finalStart) {
    throw AppError.badRequest('endDate must be on or after startDate');
  }

  const sets:      string[]  = [];
  const sqlParams: unknown[] = [];

  const push = (col: string, val: unknown) => {
    sqlParams.push(val);
    sets.push(`${col} = $${sqlParams.length}`);
  };

  if (data.title       !== undefined) push('title',       data.title);
  if ('description'     in data)      push('description', data.description ?? null);
  if (data.eventType   !== undefined) push('event_type',  data.eventType);
  if (data.startDate   !== undefined) push('start_date',  data.startDate);
  if ('endDate'         in data)      push('end_date',    data.endDate ?? null);
  if (data.visibility  !== undefined) push('visibility',  data.visibility);
  if ('semester'        in data)      push('semester',    data.semester ?? null);

  if (sets.length === 0) throw AppError.badRequest('No fields to update');

  sqlParams.push(id);
  await query(
    `UPDATE calendar_entries SET ${sets.join(', ')} WHERE id = $${sqlParams.length}`,
    sqlParams
  );

  await auditLog({
    actorId:    userId,
    action:     'UPDATE',
    resource:   'calendar_entry',
    resourceId: id,
    changes:    data as Record<string, unknown>,
  });

  const { rows: updated } = await query<CalendarRow>(
    `SELECT ${COLS} FROM calendar_entries ce ${JOINS}
     WHERE ce.id = $1 AND ce.deleted_at IS NULL`,
    [id]
  );
  return toCalendarEntry(updated[0], userId);
}

export async function deleteCalendarEntry(
  userId: string,
  role: Role,
  id: string
): Promise<void> {
  const { rows: existing } = await query<{ id: string; created_by: string }>(
    'SELECT id, created_by FROM calendar_entries WHERE id = $1 AND deleted_at IS NULL',
    [id]
  );
  if (!existing[0]) throw AppError.notFound('Calendar entry not found');
  if (role !== 'admin' && existing[0].created_by !== userId) {
    throw AppError.forbidden('You can only delete calendar entries you created');
  }

  await query('UPDATE calendar_entries SET deleted_at = NOW() WHERE id = $1', [id]);
  await auditLog({ actorId: userId, action: 'DELETE', resource: 'calendar_entry', resourceId: id });
}
