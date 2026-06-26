import {
  publishEvents,
  listCalendarEvents,
  getCalendarEventById,
  updateCalendarEvent,
  updateCalendarEventStatus,
} from '../services/academicCalendar.service';

// ── Module mocks ───────────────────────────────────────────────────────────────

const mockQuery = jest.fn();

jest.mock('../config/database', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

jest.mock('../utils/audit', () => ({
  auditLog: jest.fn().mockResolvedValue(undefined),
}));

// ── Fixtures ───────────────────────────────────────────────────────────────────

const ADMIN_ID  = 'admin-user-uuid';
const PARSED_ID = 'parsed-event-uuid-1';
const CAL_ID    = 'cal-event-uuid-1';
const DOC_ID    = 'document-uuid-1';

const CAL_ROW = {
  id:                   CAL_ID,
  parsed_event_id:      PARSED_ID,
  source_document_id:   DOC_ID,
  source_document_title:'Academic Calendar 2026-27',
  parsed_event_title:   'Commencement of Class Work for II Year B.Tech',
  parsed_event_status:  'Approved',
  title:                'Commencement of Class Work for II Year B.Tech',
  description:          null,
  start_date:           '2026-06-13',
  end_date:             '2026-06-19',
  event_type:           'Class Commencement',
  target_audience:      'II Year',
  department_id:        null,
  department_name:      null,
  semester:             null,
  publish_status:       'Published',
  is_edited:            false,
  created_by:           ADMIN_ID,
  created_by_name:      'Admin User',
  created_at:           new Date('2026-06-19T10:00:00Z'),
  updated_at:           new Date('2026-06-19T10:00:00Z'),
};

const LIST_ROW = { ...CAL_ROW, total_count: '5' };

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockQuery.mockReset();
  jest.clearAllMocks();
});

// ── publishEvents ──────────────────────────────────────────────────────────────

describe('publishEvents', () => {
  it('publishes an Approved candidate event successfully', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: PARSED_ID, status: 'Approved' }] }) // SELECT parsed_events
      .mockResolvedValueOnce({ rows: [] })                                        // SELECT existing cal event
      .mockResolvedValueOnce({ rows: [{ id: CAL_ID }] });                        // INSERT

    const result = await publishEvents([PARSED_ID], ADMIN_ID);

    expect(result.published).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);

    const insertSql = mockQuery.mock.calls[2][0] as string;
    expect(insertSql).toContain('INSERT INTO academic_calendar_events');
  });

  it('skips a non-Approved candidate event', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: PARSED_ID, status: 'Pending' }] });

    const result = await publishEvents([PARSED_ID], ADMIN_ID);

    expect(result.published).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.errors[0]).toContain("status is 'Pending'");
  });

  it('skips a Rejected candidate event', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: PARSED_ID, status: 'Rejected' }] });

    const result = await publishEvents([PARSED_ID], ADMIN_ID);

    expect(result.published).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.errors[0]).toContain("'Rejected'");
  });

  it('skips an event that has already been published', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: PARSED_ID, status: 'Approved' }] })
      .mockResolvedValueOnce({ rows: [{ id: CAL_ID }] }); // already published

    const result = await publishEvents([PARSED_ID], ADMIN_ID);

    expect(result.published).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.errors[0]).toContain('already published');
  });

  it('skips a non-existent candidate event', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await publishEvents(['non-existent-uuid'], ADMIN_ID);

    expect(result.published).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.errors[0]).toContain('not found');
  });

  it('handles partial success across multiple event IDs', async () => {
    const approvedId = 'approved-uuid';
    const pendingId  = 'pending-uuid';

    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: approvedId, status: 'Approved' }] }) // approved event check
      .mockResolvedValueOnce({ rows: [] })                                         // no existing cal event
      .mockResolvedValueOnce({ rows: [{ id: 'new-cal-id' }] })                   // INSERT
      .mockResolvedValueOnce({ rows: [{ id: pendingId, status: 'Pending' }] });  // pending event check

    const result = await publishEvents([approvedId, pendingId], ADMIN_ID);

    expect(result.published).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.errors).toHaveLength(1);
  });

  it('correctly passes userId as the creator in the INSERT', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: PARSED_ID, status: 'Approved' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: CAL_ID }] });

    await publishEvents([PARSED_ID], ADMIN_ID);

    const insertParams = mockQuery.mock.calls[2][1] as unknown[];
    expect(insertParams).toContain(ADMIN_ID);
  });
});

// ── listCalendarEvents ─────────────────────────────────────────────────────────

describe('listCalendarEvents', () => {
  const base = { page: 1, limit: 50 };

  it('admin — returns Published and Updated events by default (not Archived)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [LIST_ROW] });

    const result = await listCalendarEvents(base, ADMIN_ID, 'admin');

    expect(result.events).toHaveLength(1);
    expect(result.pagination.total).toBe(5);

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain("'Archived'");
    expect(sql).not.toContain("publish_status = $"); // no explicit status filter
  });

  it('admin — applies publishStatus filter when provided', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await listCalendarEvents({ ...base, publishStatus: 'Archived' }, ADMIN_ID, 'admin');

    const sql    = mockQuery.mock.calls[0][0] as string;
    const params = mockQuery.mock.calls[0][1] as unknown[];
    expect(sql).toContain('ace.publish_status = $');
    expect(params).toContain('Archived');
  });

  it('admin — applies eventType filter', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await listCalendarEvents({ ...base, eventType: 'Holiday' }, ADMIN_ID, 'admin');

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('ace.event_type = $');
  });

  it('admin — applies sourceDocumentId filter', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await listCalendarEvents({ ...base, sourceDocumentId: DOC_ID }, ADMIN_ID, 'admin');

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('ace.source_document_id = $');
  });

  it('admin — applies date range filters', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await listCalendarEvents({ ...base, startDateFrom: '2026-06-01', startDateTo: '2026-06-30' }, ADMIN_ID, 'admin');

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('ace.start_date >=');
    expect(sql).toContain('ace.start_date <=');
  });

  it('faculty — queries faculty department and excludes Students-only events', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ department_id: 'dept-uuid' }] }) // faculty context
      .mockResolvedValueOnce({ rows: [LIST_ROW] });                        // list query

    const result = await listCalendarEvents(base, 'faculty-user-id', 'faculty');

    expect(result.events).toHaveLength(1);

    const listSql = mockQuery.mock.calls[1][0] as string;
    expect(listSql).toContain("ace.target_audience != 'Students'");
    expect(listSql).toContain("ace.publish_status IN ('Published', 'Updated')");
  });

  it('faculty — does not filter by publishStatus param (non-admin restriction)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ department_id: null }] })
      .mockResolvedValueOnce({ rows: [] });

    // Even if publishStatus filter is passed, faculty sees Published+Updated only
    await listCalendarEvents({ ...base, publishStatus: 'Archived' }, 'faculty-id', 'faculty');

    const listSql = mockQuery.mock.calls[1][0] as string;
    expect(listSql).toContain("ace.publish_status IN ('Published', 'Updated')");
  });

  it('student — queries student context and excludes Faculty-only events', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ semester: 3, department_id: 'dept-uuid' }] }) // student ctx
      .mockResolvedValueOnce({ rows: [LIST_ROW] });

    const result = await listCalendarEvents(base, 'student-user-id', 'student');

    expect(result.events).toHaveLength(1);

    const listSql = mockQuery.mock.calls[1][0] as string;
    expect(listSql).toContain("ace.target_audience != 'Faculty'");
    // Semester 3 → 'II Year' — student should see II Year events
    const listParams = mockQuery.mock.calls[1][1] as unknown[];
    expect(listParams).toContain('II Year');
  });

  it('student with semester 1-2 — maps to I Year audience', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ semester: 1, department_id: null }] })
      .mockResolvedValueOnce({ rows: [] });

    await listCalendarEvents(base, 'student-id', 'student');

    const params = mockQuery.mock.calls[1][1] as unknown[];
    expect(params).toContain('I Year');
  });

  it('student with semester 7+ — maps to IV Year audience', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ semester: 8, department_id: null }] })
      .mockResolvedValueOnce({ rows: [] });

    await listCalendarEvents(base, 'student-id', 'student');

    const params = mockQuery.mock.calls[1][1] as unknown[];
    expect(params).toContain('IV Year');
  });

  it('returns empty list with zero total when no events match', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await listCalendarEvents(base, ADMIN_ID, 'admin');

    expect(result.events).toHaveLength(0);
    expect(result.pagination.total).toBe(0);
    expect(result.pagination.totalPages).toBe(0);
  });

  it('orders results by start_date ASC', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await listCalendarEvents(base, ADMIN_ID, 'admin');

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('start_date ASC');
  });
});

// ── getCalendarEventById ───────────────────────────────────────────────────────

describe('getCalendarEventById', () => {
  it('admin — returns any event including Archived', async () => {
    const archivedRow = { ...CAL_ROW, publish_status: 'Archived' };
    mockQuery.mockResolvedValueOnce({ rows: [archivedRow] });

    const result = await getCalendarEventById(CAL_ID, ADMIN_ID, 'admin');

    expect(result.id).toBe(CAL_ID);
    expect(result.publishStatus).toBe('Archived');
  });

  it('admin — returns full traceability fields', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [CAL_ROW] });

    const result = await getCalendarEventById(CAL_ID, ADMIN_ID, 'admin');

    expect(result.parsedEventId).toBe(PARSED_ID);
    expect(result.sourceDocumentId).toBe(DOC_ID);
    expect(result.sourceDocumentTitle).toBe('Academic Calendar 2026-27');
    expect(result.parsedEventTitle).toBe('Commencement of Class Work for II Year B.Tech');
    expect(result.isEdited).toBe(false);
  });

  it('faculty — sees a Published, non-student event in own department', async () => {
    const facultyRow = { ...CAL_ROW, target_audience: 'Faculty', department_id: 'dept-uuid' };
    mockQuery
      .mockResolvedValueOnce({ rows: [facultyRow] })
      .mockResolvedValueOnce({ rows: [{ department_id: 'dept-uuid' }] }); // faculty context

    const result = await getCalendarEventById(CAL_ID, 'faculty-id', 'faculty');

    expect(result.id).toBe(CAL_ID);
  });

  it('faculty — cannot see a Students-only event', async () => {
    const studentsOnlyRow = { ...CAL_ROW, target_audience: 'Students' };
    mockQuery
      .mockResolvedValueOnce({ rows: [studentsOnlyRow] })
      .mockResolvedValueOnce({ rows: [{ department_id: 'dept-uuid' }] });

    await expect(
      getCalendarEventById(CAL_ID, 'faculty-id', 'faculty')
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('faculty — cannot see an Archived event', async () => {
    const archivedRow = { ...CAL_ROW, publish_status: 'Archived' };
    mockQuery
      .mockResolvedValueOnce({ rows: [archivedRow] })
      .mockResolvedValueOnce({ rows: [{ department_id: null }] });

    await expect(
      getCalendarEventById(CAL_ID, 'faculty-id', 'faculty')
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('student — can see an All-audience Published event', async () => {
    const allRow = { ...CAL_ROW, target_audience: 'All' };
    mockQuery
      .mockResolvedValueOnce({ rows: [allRow] })
      .mockResolvedValueOnce({ rows: [{ semester: 3, department_id: null }] }); // student ctx

    const result = await getCalendarEventById(CAL_ID, 'student-id', 'student');

    expect(result.id).toBe(CAL_ID);
  });

  it('student — cannot see a Faculty-only event', async () => {
    const facultyRow = { ...CAL_ROW, target_audience: 'Faculty' };
    mockQuery
      .mockResolvedValueOnce({ rows: [facultyRow] })
      .mockResolvedValueOnce({ rows: [{ semester: 3, department_id: null }] });

    await expect(
      getCalendarEventById(CAL_ID, 'student-id', 'student')
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('student — can see an event matching their year group', async () => {
    const iiYearRow = { ...CAL_ROW, target_audience: 'II Year' };
    mockQuery
      .mockResolvedValueOnce({ rows: [iiYearRow] })
      .mockResolvedValueOnce({ rows: [{ semester: 3, department_id: null }] }); // semester 3 → II Year

    const result = await getCalendarEventById(CAL_ID, 'student-id', 'student');

    expect(result.id).toBe(CAL_ID);
  });

  it('student — cannot see an event for a different year group', async () => {
    const ivYearRow = { ...CAL_ROW, target_audience: 'IV Year' };
    mockQuery
      .mockResolvedValueOnce({ rows: [ivYearRow] })
      .mockResolvedValueOnce({ rows: [{ semester: 3, department_id: null }] }); // semester 3 → II Year

    await expect(
      getCalendarEventById(CAL_ID, 'student-id', 'student')
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 404 when event does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await expect(
      getCalendarEventById('missing-id', ADMIN_ID, 'admin')
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── updateCalendarEvent ────────────────────────────────────────────────────────

describe('updateCalendarEvent', () => {
  it('updates title and sets is_edited=true, publish_status=Updated', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: CAL_ID, publish_status: 'Published', start_date: '2026-06-13', end_date: '2026-06-19' }],
      })
      .mockResolvedValueOnce({ rows: [] })          // UPDATE
      .mockResolvedValueOnce({ rows: [{ ...CAL_ROW, title: 'New Title', publish_status: 'Updated', is_edited: true }] }); // re-fetch

    const result = await updateCalendarEvent(CAL_ID, { title: 'New Title' }, ADMIN_ID);

    expect(result.publishStatus).toBe('Updated');
    expect(result.isEdited).toBe(true);
    expect(result.title).toBe('New Title');

    const updateParams = mockQuery.mock.calls[1][1] as unknown[];
    expect(updateParams).toContain('Updated');
    expect(updateParams).toContain(true);
  });

  it('throws 400 when trying to edit an Archived event', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: CAL_ID, publish_status: 'Archived', start_date: '2026-06-13', end_date: null }],
    });

    await expect(
      updateCalendarEvent(CAL_ID, { title: 'x' }, ADMIN_ID)
    ).rejects.toMatchObject({ statusCode: 400, code: 'EVENT_ARCHIVED' });
  });

  it('throws 400 when endDate is before startDate', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: CAL_ID, publish_status: 'Published', start_date: '2026-06-13', end_date: null }],
    });

    await expect(
      updateCalendarEvent(CAL_ID, { endDate: '2026-06-10' }, ADMIN_ID)
    ).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_DATE_RANGE' });
  });

  it('throws 404 when event does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await expect(
      updateCalendarEvent('missing', { title: 'x' }, ADMIN_ID)
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('accepts endDate=null to clear an existing end date', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: CAL_ID, publish_status: 'Published', start_date: '2026-06-13', end_date: '2026-06-19' }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [CAL_ROW] });

    await updateCalendarEvent(CAL_ID, { endDate: null }, ADMIN_ID);

    const updateSql = mockQuery.mock.calls[1][0] as string;
    expect(updateSql).toContain('end_date');
  });

  it('an Updated event can be edited again', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: CAL_ID, publish_status: 'Updated', start_date: '2026-06-13', end_date: null }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [CAL_ROW] });

    await expect(
      updateCalendarEvent(CAL_ID, { description: 'New description' }, ADMIN_ID)
    ).resolves.toBeDefined();
  });
});

// ── updateCalendarEventStatus ──────────────────────────────────────────────────

describe('updateCalendarEventStatus', () => {
  it('archives a Published event', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ publish_status: 'Published', is_edited: false }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...CAL_ROW, publish_status: 'Archived' }] });

    const result = await updateCalendarEventStatus(CAL_ID, 'Archived', ADMIN_ID);

    expect(result.publishStatus).toBe('Archived');

    const updateParams = mockQuery.mock.calls[1][1] as unknown[];
    expect(updateParams[0]).toBe('Archived');
  });

  it('archives an Updated event', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ publish_status: 'Updated', is_edited: true }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...CAL_ROW, publish_status: 'Archived' }] });

    const result = await updateCalendarEventStatus(CAL_ID, 'Archived', ADMIN_ID);

    expect(result.publishStatus).toBe('Archived');
  });

  it('restores an Archived event (never edited) to Published', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ publish_status: 'Archived', is_edited: false }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...CAL_ROW, publish_status: 'Published' }] });

    await updateCalendarEventStatus(CAL_ID, 'Published', ADMIN_ID);

    const updateParams = mockQuery.mock.calls[1][1] as unknown[];
    expect(updateParams[0]).toBe('Published');
  });

  it('restores an Archived event (previously edited) to Updated, not Published', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ publish_status: 'Archived', is_edited: true }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...CAL_ROW, publish_status: 'Updated', is_edited: true }] });

    const result = await updateCalendarEventStatus(CAL_ID, 'Published', ADMIN_ID);

    // Service upgrades 'Published' to 'Updated' when is_edited=true
    const updateParams = mockQuery.mock.calls[1][1] as unknown[];
    expect(updateParams[0]).toBe('Updated');
    expect(result.publishStatus).toBe('Updated');
  });

  it('throws 400 when event is already in the resolved target status', async () => {
    // Published event that has never been edited → target is 'Published' → same as current
    mockQuery.mockResolvedValueOnce({ rows: [{ publish_status: 'Published', is_edited: false }] });

    await expect(
      updateCalendarEventStatus(CAL_ID, 'Published', ADMIN_ID)
    ).rejects.toMatchObject({ statusCode: 400, code: 'ALREADY_IN_STATUS' });
  });

  it('throws 400 when Archived event is re-archived', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ publish_status: 'Archived', is_edited: false }] });

    await expect(
      updateCalendarEventStatus(CAL_ID, 'Archived', ADMIN_ID)
    ).rejects.toMatchObject({ statusCode: 400, code: 'ALREADY_IN_STATUS' });
  });

  it('throws 404 when event does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await expect(
      updateCalendarEventStatus('missing', 'Archived', ADMIN_ID)
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
