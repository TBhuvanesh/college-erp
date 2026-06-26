import { query } from '../config/database';
import { auditLog } from '../utils/audit';
import { AppError } from '../errors/AppError';
import type { Role } from '../types/roles';
import type { ParsedEventType, ParsedEventAudience } from '../types/parsedEvent';
import type {
  AcademicCalendarEvent,
  CalPublishStatus,
  AdminSettablePublishStatus,
  PublishResult,
  UpdateCalendarEventInput,
  ListCalendarEventsQuery,
  PaginatedCalendarEvents,
} from '../types/academicCalendar';

// ── Row types ──────────────────────────────────────────────────────────────────

interface CalendarEventRow {
  id: string;
  parsed_event_id: string;
  source_document_id: string;
  source_document_title: string;
  parsed_event_title: string;
  parsed_event_status: string;
  title: string;
  description: string | null;
  start_date: string;             // TO_CHAR output
  end_date: string | null;
  event_type: ParsedEventType;
  target_audience: ParsedEventAudience;
  department_id: string | null;
  department_name: string | null;
  semester: number | null;
  publish_status: CalPublishStatus;
  is_edited: boolean;
  created_by: string;
  created_by_name: string;
  created_at: Date;
  updated_at: Date;
}

interface CalendarEventListRow extends CalendarEventRow {
  total_count: string;
}

// ── Shared query fragments ─────────────────────────────────────────────────────

const DETAIL_COLS = `
  ace.id,
  ace.parsed_event_id,
  ace.source_document_id,
  doc.title                               AS source_document_title,
  pe.title                                AS parsed_event_title,
  pe.status                               AS parsed_event_status,
  ace.title,
  ace.description,
  TO_CHAR(ace.start_date, 'YYYY-MM-DD')  AS start_date,
  TO_CHAR(ace.end_date,   'YYYY-MM-DD')  AS end_date,
  ace.event_type,
  ace.target_audience,
  ace.department_id,
  dep.name                                AS department_name,
  ace.semester,
  ace.publish_status,
  ace.is_edited,
  ace.created_by,
  u.full_name                             AS created_by_name,
  ace.created_at,
  ace.updated_at
`;

const DETAIL_JOINS = `
  JOIN documents      doc ON doc.id = ace.source_document_id
  JOIN parsed_events  pe  ON pe.id  = ace.parsed_event_id
  LEFT JOIN departments dep ON dep.id = ace.department_id
  JOIN users          u   ON u.id  = ace.created_by
`;

const ORDER_CLAUSE = 'ace.start_date ASC, ace.created_at ASC';

// ── Mapper ─────────────────────────────────────────────────────────────────────

function toCalendarEvent(r: CalendarEventRow): AcademicCalendarEvent {
  return {
    id:                   r.id,
    parsedEventId:        r.parsed_event_id,
    sourceDocumentId:     r.source_document_id,
    sourceDocumentTitle:  r.source_document_title,
    parsedEventTitle:     r.parsed_event_title,
    parsedEventStatus:    r.parsed_event_status,
    title:                r.title,
    description:          r.description,
    startDate:            r.start_date,
    endDate:              r.end_date,
    eventType:            r.event_type,
    targetAudience:       r.target_audience,
    departmentId:         r.department_id,
    departmentName:       r.department_name,
    semester:             r.semester !== null ? Number(r.semester) : null,
    publishStatus:        r.publish_status,
    isEdited:             r.is_edited,
    createdBy:            r.created_by,
    createdByName:        r.created_by_name,
    createdAt:            r.created_at,
    updatedAt:            r.updated_at,
  };
}

// ── Private helpers ────────────────────────────────────────────────────────────

/**
 * Maps a student's current semester to their year-group enum value.
 * Null semester falls back to 'Students' so the student still sees general events.
 */
function semesterToYearGroup(semester: number | null): ParsedEventAudience {
  if (semester === null) return 'Students';
  if (semester <= 2) return 'I Year';
  if (semester <= 4) return 'II Year';
  if (semester <= 6) return 'III Year';
  return 'IV Year';
}

interface FacultyContext { departmentId: string | null; }
interface StudentContext { semester: number | null; departmentId: string | null; }

async function resolveFacultyContext(userId: string): Promise<FacultyContext> {
  const { rows } = await query<{ department_id: string }>(
    'SELECT department_id FROM faculty WHERE user_id = $1 AND deleted_at IS NULL',
    [userId]
  );
  return { departmentId: rows[0]?.department_id ?? null };
}

async function resolveStudentContext(userId: string): Promise<StudentContext> {
  const { rows } = await query<{ semester: number; department_id: string }>(
    `SELECT st.semester, p.department_id
     FROM students st
     JOIN programs p ON p.id = st.program_id
     WHERE st.user_id = $1 AND st.deleted_at IS NULL`,
    [userId]
  );
  return {
    semester:     rows[0]?.semester     ?? null,
    departmentId: rows[0]?.department_id ?? null,
  };
}

/**
 * In-memory visibility check for a single already-fetched calendar row.
 *
 * Faculty see: Published/Updated, non-student events, and department-matching events.
 */
function isVisibleToFaculty(
  row: CalendarEventRow,
  departmentId: string | null
): boolean {
  if (row.publish_status === 'Archived') return false;
  if (row.target_audience === 'Students') return false;
  if (row.department_id && departmentId && row.department_id !== departmentId) return false;
  return true;
}

/**
 * Students see: Published/Updated, non-faculty events, matching year-group, and
 * department-matching events.
 */
function isVisibleToStudent(
  row: CalendarEventRow,
  departmentId: string | null,
  yearGroup: ParsedEventAudience
): boolean {
  if (row.publish_status === 'Archived') return false;
  if (row.target_audience === 'Faculty') return false;
  const allowed: ParsedEventAudience[] = ['All', 'Students', yearGroup];
  if (!allowed.includes(row.target_audience)) return false;
  if (row.department_id && departmentId && row.department_id !== departmentId) return false;
  return true;
}

// ── Internal fetch helper ──────────────────────────────────────────────────────

async function fetchCalendarRow(id: string): Promise<CalendarEventRow | null> {
  const { rows } = await query<CalendarEventRow>(
    `SELECT ${DETAIL_COLS}
     FROM academic_calendar_events ace ${DETAIL_JOINS}
     WHERE ace.id = $1 AND ace.deleted_at IS NULL`,
    [id]
  );
  return rows[0] ?? null;
}

// ── Publication ────────────────────────────────────────────────────────────────

/**
 * Promotes one or more Approved candidate events into live calendar entries.
 *
 * Per-event logic:
 *  - parsedEvent not found or not Approved → skipped (with reason in errors[])
 *  - already published (unique constraint match) → skipped silently
 *  - otherwise → INSERT copying all fields; partial success allowed
 */
export async function publishEvents(
  parsedEventIds: string[],
  userId: string
): Promise<PublishResult> {
  let published = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const parsedEventId of parsedEventIds) {
    // Verify the candidate event exists and is Approved
    const { rows: peRows } = await query<{ id: string; status: string }>(
      `SELECT id, status FROM parsed_events
       WHERE id = $1 AND deleted_at IS NULL`,
      [parsedEventId]
    );

    if (!peRows[0]) {
      errors.push(`Candidate event ${parsedEventId} not found`);
      skipped++;
      continue;
    }

    if (peRows[0].status !== 'Approved') {
      errors.push(
        `Candidate event ${parsedEventId} cannot be published — status is '${peRows[0].status}' (must be 'Approved')`
      );
      skipped++;
      continue;
    }

    // Check for an existing live publication of this candidate event
    const { rows: existing } = await query<{ id: string }>(
      `SELECT id FROM academic_calendar_events
       WHERE parsed_event_id = $1 AND deleted_at IS NULL`,
      [parsedEventId]
    );

    if (existing[0]) {
      errors.push(
        `Candidate event ${parsedEventId} is already published (calendar event ${existing[0].id})`
      );
      skipped++;
      continue;
    }

    // Publish: copy all fields from the approved candidate event
    await query(
      `INSERT INTO academic_calendar_events
         (parsed_event_id, source_document_id, title, description,
          start_date, end_date, event_type, target_audience,
          department_id, semester, created_by)
       SELECT
         pe.id, pe.document_id, pe.title, pe.description,
         pe.start_date, pe.end_date, pe.event_type, pe.target_audience,
         pe.department_id, pe.semester, $2::uuid
       FROM parsed_events pe
       WHERE pe.id = $1`,
      [parsedEventId, userId]
    );

    published++;
  }

  await auditLog({
    actorId:    userId,
    action:     'PUBLISH_CALENDAR_EVENTS',
    resource:   'academic_calendar_events',
    changes:    { published, skipped, parsedEventIds },
  });

  return { published, skipped, errors };
}

// ── Read operations ────────────────────────────────────────────────────────────

export async function getCalendarEventById(
  id: string,
  userId: string,
  userRole: Role
): Promise<AcademicCalendarEvent> {
  const row = await fetchCalendarRow(id);
  if (!row) throw AppError.notFound('Calendar event not found');

  if (userRole === 'admin') return toCalendarEvent(row);

  if (userRole === 'faculty') {
    const { departmentId } = await resolveFacultyContext(userId);
    if (!isVisibleToFaculty(row, departmentId)) throw AppError.notFound('Calendar event not found');
  } else {
    const { semester, departmentId } = await resolveStudentContext(userId);
    const yearGroup = semesterToYearGroup(semester);
    if (!isVisibleToStudent(row, departmentId, yearGroup)) {
      throw AppError.notFound('Calendar event not found');
    }
  }

  return toCalendarEvent(row);
}

export async function listCalendarEvents(
  filters: ListCalendarEventsQuery,
  userId: string,
  userRole: Role
): Promise<PaginatedCalendarEvents> {
  const conditions: string[] = ['ace.deleted_at IS NULL'];
  const params: unknown[] = [];

  // Role-based visibility
  if (userRole === 'admin') {
    // Admin default: exclude Archived unless explicitly requested
    if (filters.publishStatus) {
      params.push(filters.publishStatus);
      conditions.push(`ace.publish_status = $${params.length}`);
    } else {
      conditions.push("ace.publish_status != 'Archived'");
    }
  } else if (userRole === 'faculty') {
    const { departmentId } = await resolveFacultyContext(userId);
    conditions.push("ace.publish_status IN ('Published', 'Updated')");
    conditions.push("ace.target_audience != 'Students'");
    params.push(departmentId);
    conditions.push(
      `($${params.length}::uuid IS NULL OR ace.department_id IS NULL OR ace.department_id = $${params.length}::uuid)`
    );
  } else {
    // Student
    const { semester, departmentId } = await resolveStudentContext(userId);
    const yearGroup = semesterToYearGroup(semester);
    conditions.push("ace.publish_status IN ('Published', 'Updated')");
    conditions.push("ace.target_audience != 'Faculty'");
    params.push(yearGroup);
    conditions.push(
      `(ace.target_audience = 'All' OR ace.target_audience = 'Students' OR ace.target_audience = $${params.length})`
    );
    params.push(departmentId);
    conditions.push(
      `($${params.length}::uuid IS NULL OR ace.department_id IS NULL OR ace.department_id = $${params.length}::uuid)`
    );
  }

  // Shared filters (applied after visibility, available to all roles)
  if (filters.eventType) {
    params.push(filters.eventType);
    conditions.push(`ace.event_type = $${params.length}`);
  }
  if (filters.targetAudience) {
    params.push(filters.targetAudience);
    conditions.push(`ace.target_audience = $${params.length}`);
  }
  if (filters.semester) {
    params.push(filters.semester);
    conditions.push(`ace.semester = $${params.length}`);
  }
  if (filters.startDateFrom) {
    params.push(filters.startDateFrom);
    conditions.push(`ace.start_date >= $${params.length}`);
  }
  if (filters.startDateTo) {
    params.push(filters.startDateTo);
    conditions.push(`ace.start_date <= $${params.length}`);
  }
  if (filters.search) {
    params.push(`%${filters.search}%`);
    conditions.push(`ace.title ILIKE $${params.length}`);
  }

  // Admin-only filters
  if (userRole === 'admin') {
    if (filters.departmentId) {
      params.push(filters.departmentId);
      conditions.push(`ace.department_id = $${params.length}`);
    }
    if (filters.sourceDocumentId) {
      params.push(filters.sourceDocumentId);
      conditions.push(`ace.source_document_id = $${params.length}`);
    }
  }

  const offset = (filters.page - 1) * filters.limit;
  params.push(filters.limit, offset);

  const { rows } = await query<CalendarEventListRow>(
    `SELECT ${DETAIL_COLS}, COUNT(*) OVER() AS total_count
     FROM academic_calendar_events ace ${DETAIL_JOINS}
     WHERE ${conditions.join(' AND ')}
     ORDER BY ${ORDER_CLAUSE}
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const total = rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0;

  return {
    events: rows.map(toCalendarEvent),
    pagination: {
      page:       filters.page,
      limit:      filters.limit,
      total,
      totalPages: Math.ceil(total / filters.limit),
    },
  };
}

// ── Write operations ───────────────────────────────────────────────────────────

/**
 * Edits a Published or Updated calendar event.
 * Archived events must be restored before editing.
 * Any field change sets is_edited=true and transitions publish_status to 'Updated'.
 */
export async function updateCalendarEvent(
  id: string,
  data: UpdateCalendarEventInput,
  userId: string
): Promise<AcademicCalendarEvent> {
  const { rows } = await query<{ id: string; publish_status: CalPublishStatus; start_date: string; end_date: string | null }>(
    `SELECT id, publish_status, TO_CHAR(start_date, 'YYYY-MM-DD') AS start_date,
            TO_CHAR(end_date, 'YYYY-MM-DD') AS end_date
     FROM academic_calendar_events WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  if (!rows[0]) throw AppError.notFound('Calendar event not found');

  if (rows[0].publish_status === 'Archived') {
    throw AppError.badRequest(
      'Cannot edit an Archived event — restore it to Published first',
      'EVENT_ARCHIVED'
    );
  }

  // Cross-field date validation: merge requested dates with current values
  const effectiveStart = data.startDate ?? rows[0].start_date;
  const effectiveEnd   = data.endDate !== undefined ? data.endDate : rows[0].end_date;
  if (effectiveEnd && effectiveEnd < effectiveStart) {
    throw AppError.badRequest('endDate must be on or after startDate', 'INVALID_DATE_RANGE');
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  const push = (col: string, val: unknown) => {
    params.push(val);
    updates.push(`${col} = $${params.length}`);
  };

  if (data.title          !== undefined) push('title',          data.title);
  if (data.description    !== undefined) push('description',    data.description);
  if (data.startDate      !== undefined) push('start_date',     data.startDate);
  if (data.endDate        !== undefined) push('end_date',       data.endDate);
  if (data.eventType      !== undefined) push('event_type',     data.eventType);
  if (data.targetAudience !== undefined) push('target_audience', data.targetAudience);
  if (data.departmentId   !== undefined) push('department_id',  data.departmentId);
  if (data.semester       !== undefined) push('semester',       data.semester);

  // Always set is_edited and publish_status on any field change
  push('publish_status', 'Updated');
  push('is_edited', true);

  params.push(id);
  await query(
    `UPDATE academic_calendar_events
     SET ${updates.join(', ')}, updated_at = NOW()
     WHERE id = $${params.length}`,
    params
  );

  await auditLog({
    actorId:    userId,
    action:     'UPDATE_CALENDAR_EVENT',
    resource:   'academic_calendar_events',
    resourceId: id,
    changes:    data,
  });

  const updated = await fetchCalendarRow(id);
  return toCalendarEvent(updated!);
}

/**
 * Archives or restores a calendar event.
 *
 * Requesting 'Published' on an event where is_edited=true restores it to 'Updated'
 * (not 'Published') to preserve the signal that content was modified.
 * The stored publish_status is what actually gets returned; the requested status
 * is the intent ("restore from archive"), not necessarily the literal target.
 */
export async function updateCalendarEventStatus(
  id: string,
  requestedStatus: AdminSettablePublishStatus,
  userId: string
): Promise<AcademicCalendarEvent> {
  const { rows } = await query<{ publish_status: CalPublishStatus; is_edited: boolean }>(
    `SELECT publish_status, is_edited FROM academic_calendar_events
     WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  if (!rows[0]) throw AppError.notFound('Calendar event not found');

  const current = rows[0].publish_status;

  // Determine the actual target status for 'Published' restore requests
  const targetStatus: CalPublishStatus =
    requestedStatus === 'Published' && rows[0].is_edited ? 'Updated' : requestedStatus;

  if (current === targetStatus) {
    throw AppError.badRequest(
      `Calendar event is already in ${current} status`,
      'ALREADY_IN_STATUS'
    );
  }

  // Additional guard: prevent archiving an already-archived event via the same-status check above
  await query(
    `UPDATE academic_calendar_events
     SET publish_status = $1, updated_at = NOW()
     WHERE id = $2`,
    [targetStatus, id]
  );

  await auditLog({
    actorId:    userId,
    action:     'UPDATE_CALENDAR_EVENT_STATUS',
    resource:   'academic_calendar_events',
    resourceId: id,
    changes:    { from: current, to: targetStatus, requested: requestedStatus },
  });

  const updated = await fetchCalendarRow(id);
  return toCalendarEvent(updated!);
}
