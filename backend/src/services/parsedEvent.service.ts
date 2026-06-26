import { query, withTransaction } from '../config/database';
import { auditLog } from '../utils/audit';
import { AppError } from '../errors/AppError';
import { extractCandidateEvents } from '../utils/calendarExtractor';
import type {
  ParsedEvent,
  ParsedEventType,
  ParsedEventAudience,
  ParsedEventStatus,
  AdminSettableStatus,
  UpdateParsedEventInput,
  ListParsedEventsQuery,
  PaginatedParsedEvents,
  ParseResult,
} from '../types/parsedEvent';

// ── Row types ──────────────────────────────────────────────────────────────────

interface ParsedEventRow {
  id: string;
  document_id: string;
  document_title: string;
  title: string;
  description: string | null;
  start_date: string;    // TO_CHAR output
  end_date: string | null;
  event_type: ParsedEventType;
  target_audience: ParsedEventAudience;
  department_id: string | null;
  department_name: string | null;
  semester: number | null;
  status: ParsedEventStatus;
  created_at: Date;
  updated_at: Date;
}

interface ParsedEventListRow extends ParsedEventRow {
  total_count: string;
}

// ── Shared fragments ───────────────────────────────────────────────────────────

const DETAIL_COLS = `
  pe.id,
  pe.document_id,
  doc.title                              AS document_title,
  pe.title,
  pe.description,
  TO_CHAR(pe.start_date, 'YYYY-MM-DD')   AS start_date,
  TO_CHAR(pe.end_date,   'YYYY-MM-DD')   AS end_date,
  pe.event_type,
  pe.target_audience,
  pe.department_id,
  dep.name                               AS department_name,
  pe.semester,
  pe.status,
  pe.created_at,
  pe.updated_at
`;

const BASE_JOINS = `
  JOIN  documents    doc ON doc.id  = pe.document_id
  LEFT JOIN departments dep ON dep.id  = pe.department_id
`;

// ── Mapper ────────────────────────────────────────────────────────────────────

function toParsedEvent(r: ParsedEventRow): ParsedEvent {
  return {
    id:             r.id,
    documentId:     r.document_id,
    documentTitle:  r.document_title,
    title:          r.title,
    description:    r.description,
    startDate:      r.start_date,
    endDate:        r.end_date,
    eventType:      r.event_type,
    targetAudience: r.target_audience,
    departmentId:   r.department_id,
    departmentName: r.department_name,
    semester:       r.semester !== null ? Number(r.semester) : null,
    status:         r.status,
    createdAt:      r.created_at,
    updatedAt:      r.updated_at,
  };
}

// ── Read operations ────────────────────────────────────────────────────────────

export async function getParsedEventById(id: string): Promise<ParsedEvent> {
  const { rows } = await query<ParsedEventRow>(
    `SELECT ${DETAIL_COLS}
     FROM parsed_events pe ${BASE_JOINS}
     WHERE pe.id = $1 AND pe.deleted_at IS NULL`,
    [id]
  );
  if (!rows[0]) throw AppError.notFound('Parsed event not found');
  return toParsedEvent(rows[0]);
}

export async function listParsedEvents(
  filters: ListParsedEventsQuery
): Promise<PaginatedParsedEvents> {
  const conditions: string[] = ['pe.deleted_at IS NULL'];
  const params: unknown[] = [];

  if (filters.documentId) {
    params.push(filters.documentId);
    conditions.push(`pe.document_id = $${params.length}`);
  }
  if (filters.status) {
    params.push(filters.status);
    conditions.push(`pe.status = $${params.length}`);
  }
  if (filters.eventType) {
    params.push(filters.eventType);
    conditions.push(`pe.event_type = $${params.length}`);
  }
  if (filters.targetAudience) {
    params.push(filters.targetAudience);
    conditions.push(`pe.target_audience = $${params.length}`);
  }
  if (filters.startDateFrom) {
    params.push(filters.startDateFrom);
    conditions.push(`pe.start_date >= $${params.length}`);
  }
  if (filters.startDateTo) {
    params.push(filters.startDateTo);
    conditions.push(`pe.start_date <= $${params.length}`);
  }

  const offset = (filters.page - 1) * filters.limit;
  params.push(filters.limit, offset);

  const { rows } = await query<ParsedEventListRow>(
    `SELECT ${DETAIL_COLS}, COUNT(*) OVER() AS total_count
     FROM parsed_events pe ${BASE_JOINS}
     WHERE ${conditions.join(' AND ')}
     ORDER BY pe.start_date ASC, pe.created_at ASC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const total = rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0;

  return {
    events: rows.map(toParsedEvent),
    pagination: {
      page:       filters.page,
      limit:      filters.limit,
      total,
      totalPages: Math.ceil(total / filters.limit),
    },
  };
}

// ── Extraction ────────────────────────────────────────────────────────────────

/**
 * Runs rule-based extraction on the document's extracted_text.
 *
 * Transactional steps:
 *  1. Soft-delete all existing Pending events for this document (re-extraction).
 *  2. Bulk-insert newly extracted candidates.
 *
 * Approved / Edited / Rejected events are preserved intentionally — admin
 * decisions should not be discarded by a re-run.
 */
export async function parseDocument(
  documentId: string,
  userId: string
): Promise<ParseResult> {
  const { rows: docRows } = await query<{ id: string; extracted_text: string | null }>(
    'SELECT id, extracted_text FROM documents WHERE id = $1 AND deleted_at IS NULL',
    [documentId]
  );
  if (!docRows[0]) throw AppError.notFound('Document not found');
  if (!docRows[0].extracted_text) {
    throw AppError.badRequest(
      'Document has no extracted text. Re-upload the PDF to trigger extraction.',
      'NO_EXTRACTED_TEXT'
    );
  }

  const candidates = extractCandidateEvents(docRows[0].extracted_text);

  let created = 0;
  let replacedPending = 0;

  await withTransaction(async (client) => {
    // Soft-delete existing Pending events so re-extraction is idempotent
    const delResult = await client.query(
      `UPDATE parsed_events
       SET deleted_at = NOW(), updated_at = NOW()
       WHERE document_id = $1
         AND status = 'Pending'
         AND deleted_at IS NULL`,
      [documentId]
    );
    replacedPending = delResult.rowCount ?? 0;

    if (candidates.length === 0) return;

    // Bulk insert: build one multi-row VALUES clause for efficiency
    const params: unknown[] = [];
    const valuePlaceholders: string[] = [];

    candidates.forEach((c) => {
      const o = params.length;
      params.push(
        documentId, c.title, c.description,
        c.startDate, c.endDate,
        c.eventType, c.targetAudience, c.semester
      );
      valuePlaceholders.push(
        `($${o+1},$${o+2},$${o+3},$${o+4},$${o+5},$${o+6},$${o+7},$${o+8})`
      );
    });

    await client.query(
      `INSERT INTO parsed_events
         (document_id, title, description, start_date, end_date,
          event_type, target_audience, semester)
       VALUES ${valuePlaceholders.join(',')}`,
      params
    );

    created = candidates.length;
  });

  await auditLog({
    actorId:    userId,
    action:     'PARSE_DOCUMENT',
    resource:   'documents',
    resourceId: documentId,
    changes:    { created, replacedPending },
  });

  return { created, replacedPending };
}

// ── Write operations ───────────────────────────────────────────────────────────

/**
 * Admin edits extracted fields.
 * Any field change auto-transitions status to 'Edited' (including from 'Approved'),
 * signalling that the event needs re-review before Phase 3 publication.
 */
export async function updateParsedEvent(
  id: string,
  data: UpdateParsedEventInput,
  userId: string
): Promise<ParsedEvent> {
  const { rows: current } = await query<{ id: string; start_date: string; end_date: string | null }>(
    'SELECT id, TO_CHAR(start_date,\'YYYY-MM-DD\') AS start_date, TO_CHAR(end_date,\'YYYY-MM-DD\') AS end_date FROM parsed_events WHERE id = $1 AND deleted_at IS NULL',
    [id]
  );
  if (!current[0]) throw AppError.notFound('Parsed event not found');

  // Cross-field date range validation using combined new+existing values
  const resolvedStart = data.startDate ?? current[0].start_date;
  const resolvedEnd   = data.endDate !== undefined ? data.endDate : current[0].end_date;
  if (resolvedEnd && resolvedEnd < resolvedStart) {
    throw AppError.badRequest('endDate must be on or after startDate', 'INVALID_DATE_RANGE');
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  const pushUpdate = (col: string, val: unknown) => {
    params.push(val);
    updates.push(`${col} = $${params.length}`);
  };

  if (data.title          !== undefined) pushUpdate('title',          data.title);
  if (data.description    !== undefined) pushUpdate('description',    data.description);
  if (data.startDate      !== undefined) pushUpdate('start_date',     data.startDate);
  if (data.endDate        !== undefined) pushUpdate('end_date',       data.endDate);
  if (data.eventType      !== undefined) pushUpdate('event_type',     data.eventType);
  if (data.targetAudience !== undefined) pushUpdate('target_audience',data.targetAudience);
  if (data.departmentId   !== undefined) pushUpdate('department_id',  data.departmentId);
  if (data.semester       !== undefined) pushUpdate('semester',       data.semester);

  // Status auto-transitions to 'Edited' on any field change
  pushUpdate('status', 'Edited');

  params.push(id);
  await query(
    `UPDATE parsed_events SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`,
    params
  );

  await auditLog({
    actorId:    userId,
    action:     'UPDATE_PARSED_EVENT',
    resource:   'parsed_events',
    resourceId: id,
    changes:    data as Record<string, unknown>,
  });

  return getParsedEventById(id);
}

/**
 * Admin explicitly sets status to Approved, Rejected, or Pending (reset for re-review).
 * 'Edited' is excluded from the allowed set — it is set automatically by updateParsedEvent.
 */
export async function updateParsedEventStatus(
  id: string,
  newStatus: AdminSettableStatus,
  userId: string
): Promise<ParsedEvent> {
  const { rows } = await query<{ status: ParsedEventStatus }>(
    'SELECT status FROM parsed_events WHERE id = $1 AND deleted_at IS NULL',
    [id]
  );
  if (!rows[0]) throw AppError.notFound('Parsed event not found');

  const currentStatus = rows[0].status;
  if (currentStatus === newStatus) {
    throw AppError.badRequest(
      `Event is already in ${newStatus} status`,
      'ALREADY_IN_STATUS'
    );
  }

  await query(
    'UPDATE parsed_events SET status = $1, updated_at = NOW() WHERE id = $2',
    [newStatus, id]
  );

  await auditLog({
    actorId:    userId,
    action:     'UPDATE_PARSED_EVENT_STATUS',
    resource:   'parsed_events',
    resourceId: id,
    changes:    { from: currentStatus, to: newStatus },
  });

  return getParsedEventById(id);
}

export async function deleteParsedEvent(id: string, userId: string): Promise<void> {
  const { rows } = await query<{ id: string }>(
    'SELECT id FROM parsed_events WHERE id = $1 AND deleted_at IS NULL',
    [id]
  );
  if (!rows[0]) throw AppError.notFound('Parsed event not found');

  await query(
    'UPDATE parsed_events SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1',
    [id]
  );

  await auditLog({
    actorId:    userId,
    action:     'DELETE_PARSED_EVENT',
    resource:   'parsed_events',
    resourceId: id,
    changes:    {},
  });
}
