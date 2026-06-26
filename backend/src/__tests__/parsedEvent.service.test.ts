import {
  parseDocument,
  getParsedEventById,
  listParsedEvents,
  updateParsedEvent,
  updateParsedEventStatus,
  deleteParsedEvent,
} from '../services/parsedEvent.service';
import type { CandidateEvent } from '../utils/calendarExtractor';

// ── Module mocks ───────────────────────────────────────────────────────────────

const mockQuery = jest.fn();
const mockWithTransaction = jest.fn();

jest.mock('../config/database', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  withTransaction: (fn: unknown) => mockWithTransaction(fn),
}));

jest.mock('../utils/audit', () => ({
  auditLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../utils/calendarExtractor', () => ({
  extractCandidateEvents: jest.fn(),
}));

// ── Fixtures ───────────────────────────────────────────────────────────────────

const EVENT_ROW = {
  id:               'event-uuid-1',
  document_id:      'doc-uuid-1',
  document_title:   'Academic Calendar 2026-27',
  title:            'Commencement of Class Work for II Year B.Tech',
  description:      null,
  start_date:       '2026-06-13',
  end_date:         '2026-06-19',
  event_type:       'Class Commencement',
  target_audience:  'II Year',
  department_id:    null,
  department_name:  null,
  semester:         null,
  status:           'Pending',
  created_at:       new Date('2026-06-19'),
  updated_at:       new Date('2026-06-19'),
};

const LIST_ROW = { ...EVENT_ROW, total_count: '3' };

const CANDIDATE: CandidateEvent = {
  title:          'Commencement of Class Work for II Year B.Tech',
  description:    null,
  startDate:      '2026-06-13',
  endDate:        '2026-06-19',
  eventType:      'Class Commencement',
  targetAudience: 'II Year',
  semester:       null,
};

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockQuery.mockReset();
  mockWithTransaction.mockReset();
  jest.clearAllMocks();

  // Default transaction: execute the callback with a client that delegates to mockQuery
  mockWithTransaction.mockImplementation(
    (fn: (client: { query: typeof mockQuery }) => Promise<void>) =>
      fn({ query: mockQuery })
  );
});

// ── parseDocument ─────────────────────────────────────────────────────────────

describe('parseDocument', () => {
  const { extractCandidateEvents } = jest.requireMock('../utils/calendarExtractor') as {
    extractCandidateEvents: jest.Mock;
  };

  it('extracts events, soft-deletes existing Pending events, and bulk-inserts new ones', async () => {
    extractCandidateEvents.mockReturnValue([CANDIDATE]);

    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'doc-uuid-1', extracted_text: 'raw calendar text' }] })  // document SELECT
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })   // soft-delete Pending (inside tx)
      .mockResolvedValueOnce({ rows: [] });               // bulk INSERT (inside tx)

    const result = await parseDocument('doc-uuid-1', 'admin-uuid');

    expect(result.created).toBe(1);
    expect(result.replacedPending).toBe(0);

    const insertSql = mockQuery.mock.calls[2][0] as string;
    expect(insertSql).toContain('INSERT INTO parsed_events');
    expect(insertSql).toContain('start_date');
  });

  it('replaces existing Pending events on re-extraction', async () => {
    extractCandidateEvents.mockReturnValue([CANDIDATE]);

    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'doc-uuid-1', extracted_text: 'text' }] })
      .mockResolvedValueOnce({ rowCount: 3, rows: [] })   // 3 Pending events soft-deleted
      .mockResolvedValueOnce({ rows: [] });

    const result = await parseDocument('doc-uuid-1', 'admin-uuid');

    expect(result.replacedPending).toBe(3);
    expect(result.created).toBe(1);
  });

  it('returns created=0 when extractor finds no candidate events', async () => {
    extractCandidateEvents.mockReturnValue([]);

    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'doc-uuid-1', extracted_text: 'no dates here' }] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] }); // soft-delete (nothing found)

    const result = await parseDocument('doc-uuid-1', 'admin-uuid');

    expect(result.created).toBe(0);
  });

  it('throws 404 when document does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await expect(parseDocument('missing', 'admin-uuid')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('throws 400 when document has no extracted text', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'doc-uuid-1', extracted_text: null }] });

    await expect(parseDocument('doc-uuid-1', 'admin-uuid')).rejects.toMatchObject({
      statusCode: 400,
      code:       'NO_EXTRACTED_TEXT',
    });
  });

  it('preserves Approved and Rejected events during re-extraction', async () => {
    extractCandidateEvents.mockReturnValue([CANDIDATE]);

    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'doc-uuid-1', extracted_text: 'text' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await parseDocument('doc-uuid-1', 'admin-uuid');

    // The soft-delete SQL should only target 'Pending' events
    const softDeleteSql = mockQuery.mock.calls[1][0] as string;
    expect(softDeleteSql).toContain("status = 'Pending'");
    expect(softDeleteSql).not.toContain('Approved');
    expect(softDeleteSql).not.toContain('Rejected');
  });
});

// ── getParsedEventById ────────────────────────────────────────────────────────

describe('getParsedEventById', () => {
  it('returns ParsedEvent with documentTitle and all fields', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [EVENT_ROW] });

    const result = await getParsedEventById('event-uuid-1');

    expect(result.id).toBe('event-uuid-1');
    expect(result.documentTitle).toBe('Academic Calendar 2026-27');
    expect(result.eventType).toBe('Class Commencement');
    expect(result.startDate).toBe('2026-06-13');
    expect(result.endDate).toBe('2026-06-19');
  });

  it('throws 404 when event does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await expect(getParsedEventById('missing')).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── listParsedEvents ──────────────────────────────────────────────────────────

describe('listParsedEvents', () => {
  const base = { page: 1, limit: 50 };

  it('returns paginated events ordered by start_date ASC', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [LIST_ROW] });

    const result = await listParsedEvents(base);

    expect(result.events).toHaveLength(1);
    expect(result.pagination.total).toBe(3);

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('start_date ASC');
  });

  it('applies documentId filter', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await listParsedEvents({ ...base, documentId: 'doc-uuid-1' });

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('pe.document_id =');
  });

  it('applies status filter', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await listParsedEvents({ ...base, status: 'Approved' });

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('pe.status =');
  });

  it('applies eventType filter', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await listParsedEvents({ ...base, eventType: 'Holiday' });

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('pe.event_type =');
  });

  it('applies startDateFrom and startDateTo filters', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await listParsedEvents({ ...base, startDateFrom: '2026-06-01', startDateTo: '2026-06-30' });

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('pe.start_date >=');
    expect(sql).toContain('pe.start_date <=');
  });

  it('returns zero total when no events match', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await listParsedEvents(base);

    expect(result.events).toHaveLength(0);
    expect(result.pagination.total).toBe(0);
  });

  it('includes documentTitle in each event', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [LIST_ROW] });

    const result = await listParsedEvents(base);

    expect(result.events[0].documentTitle).toBe('Academic Calendar 2026-27');
  });
});

// ── updateParsedEvent ─────────────────────────────────────────────────────────

describe('updateParsedEvent', () => {
  it('updates fields and auto-transitions status to Edited', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'event-uuid-1', start_date: '2026-06-13', end_date: '2026-06-19' }] }) // current state
      .mockResolvedValueOnce({ rows: [] })                                                                          // UPDATE
      .mockResolvedValueOnce({ rows: [{ ...EVENT_ROW, status: 'Edited', title: 'Updated Title' }] });              // reread

    const result = await updateParsedEvent('event-uuid-1', { title: 'Updated Title' }, 'admin-uuid');

    expect(result.status).toBe('Edited');
    expect(result.title).toBe('Updated Title');

    // 'Edited' is passed as a query parameter, not embedded in the SQL string
    const updateParams = mockQuery.mock.calls[1][1] as unknown[];
    expect(updateParams).toContain('Edited');
  });

  it('throws 404 when event does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await expect(
      updateParsedEvent('missing', { title: 'x' }, 'admin-uuid')
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 400 when endDate is before startDate', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'event-uuid-1', start_date: '2026-06-20', end_date: null }],
    });

    await expect(
      updateParsedEvent('event-uuid-1', { endDate: '2026-06-10' }, 'admin-uuid')
    ).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_DATE_RANGE' });
  });

  it('allows admin to set departmentId during review', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'event-uuid-1', start_date: '2026-06-13', end_date: null }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [EVENT_ROW] });

    await updateParsedEvent('event-uuid-1', { departmentId: 'dept-uuid-1' }, 'admin-uuid');

    const updateSql = mockQuery.mock.calls[1][0] as string;
    expect(updateSql).toContain('department_id');
  });
});

// ── updateParsedEventStatus ────────────────────────────────────────────────────

describe('updateParsedEventStatus', () => {
  it('transitions Pending → Approved', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ status: 'Pending' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...EVENT_ROW, status: 'Approved' }] });

    const result = await updateParsedEventStatus('event-uuid-1', 'Approved', 'admin-uuid');

    expect(result.status).toBe('Approved');
  });

  it('transitions Pending → Rejected', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ status: 'Pending' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...EVENT_ROW, status: 'Rejected' }] });

    const result = await updateParsedEventStatus('event-uuid-1', 'Rejected', 'admin-uuid');

    expect(result.status).toBe('Rejected');
  });

  it('transitions Approved → Rejected', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ status: 'Approved' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...EVENT_ROW, status: 'Rejected' }] });

    const result = await updateParsedEventStatus('event-uuid-1', 'Rejected', 'admin-uuid');

    expect(result.status).toBe('Rejected');
  });

  it('transitions Edited → Approved', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ status: 'Edited' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...EVENT_ROW, status: 'Approved' }] });

    const result = await updateParsedEventStatus('event-uuid-1', 'Approved', 'admin-uuid');

    expect(result.status).toBe('Approved');
  });

  it('resets any status back to Pending for re-review', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ status: 'Approved' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...EVENT_ROW, status: 'Pending' }] });

    const result = await updateParsedEventStatus('event-uuid-1', 'Pending', 'admin-uuid');

    expect(result.status).toBe('Pending');
  });

  it('throws 400 when event is already in the requested status', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ status: 'Approved' }] });

    await expect(
      updateParsedEventStatus('event-uuid-1', 'Approved', 'admin-uuid')
    ).rejects.toMatchObject({ statusCode: 400, code: 'ALREADY_IN_STATUS' });
  });

  it('throws 404 when event does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await expect(
      updateParsedEventStatus('missing', 'Approved', 'admin-uuid')
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── deleteParsedEvent ──────────────────────────────────────────────────────────

describe('deleteParsedEvent', () => {
  it('soft-deletes an existing event', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'event-uuid-1' }] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(deleteParsedEvent('event-uuid-1', 'admin-uuid')).resolves.toBeUndefined();

    const deleteSql = mockQuery.mock.calls[1][0] as string;
    expect(deleteSql).toContain('deleted_at = NOW()');
  });

  it('throws 404 when event does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await expect(deleteParsedEvent('missing', 'admin-uuid')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
