import * as calendarService from '../services/calendarEntry.service';

// ── Mock dependencies ──────────────────────────────────────────────────────────

jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../utils/audit',    () => ({ auditLog: jest.fn().mockResolvedValue(undefined) }));

import { query } from '../config/database';
const mockQuery = query as jest.MockedFunction<typeof query>;

// ── Test data ──────────────────────────────────────────────────────────────────

const ADMIN_ID     = 'adm-0000-0000-0000-000000000001';
const FACULTY_ID   = 'fac-0000-0000-0000-000000000001';
const STUDENT_ID   = 'stu-0000-0000-0000-000000000001';
const ENTRY_ID     = 'cal-0000-0000-0000-000000000001';
const DEPT_ID      = 'dpt-0000-0000-0000-000000000001';
const ASSIGN_ID    = 'asg-0000-0000-0000-000000000001';
const OTHER_USER   = 'oth-0000-0000-0000-000000000001';

const mockEntryRow = {
  id:              ENTRY_ID,
  title:           'Semester Exams',
  description:     null,
  event_type:      'Academic',
  start_date:      new Date('2026-11-01'),
  end_date:        new Date('2026-11-20'),
  visibility:      'institution_wide',
  source_module:   null,
  source_id:       null,
  department_id:   null,
  department_name: null,
  semester:        null,
  created_by:      ADMIN_ID,
  created_by_name: 'Admin User',
  created_at:      new Date('2026-06-01'),
  updated_at:      new Date('2026-06-01'),
};

const mockFacultyCtx = { department_id: DEPT_ID };
const mockStudentCtx = { department_id: DEPT_ID, semester: 5 };

function resetMocks() {
  mockQuery.mockReset();
}

// ── createCalendarEntry ────────────────────────────────────────────────────────

describe('createCalendarEntry', () => {
  beforeEach(resetMocks);

  it('admin creates institution_wide entry with explicit startDate', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: ENTRY_ID }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [mockEntryRow], rowCount: 1 } as never);

    const result = await calendarService.createCalendarEntry(ADMIN_ID, 'admin', {
      title:      'Semester Exams',
      eventType:  'Academic',
      startDate:  '2026-11-01T00:00:00.000Z',
      endDate:    '2026-11-20T00:00:00.000Z',
      visibility: 'institution_wide',
    });

    expect(result.id).toBe(ENTRY_ID);
    expect(result.isOwner).toBe(true);   // admin === created_by

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toMatch(/INSERT INTO calendar_entries/);
    const params = mockQuery.mock.calls[0][1] as unknown[];
    expect(params).toContain('institution_wide');
    expect(params).toContain(ADMIN_ID);
  });

  it('student can create personal entry', async () => {
    // resolveUserCtx
    mockQuery.mockResolvedValueOnce({ rows: [mockStudentCtx], rowCount: 1 } as never);
    // INSERT
    mockQuery.mockResolvedValueOnce({ rows: [{ id: ENTRY_ID }], rowCount: 1 } as never);
    // SELECT
    mockQuery.mockResolvedValueOnce({ rows: [{ ...mockEntryRow, visibility: 'personal', created_by: STUDENT_ID }], rowCount: 1 } as never);

    const result = await calendarService.createCalendarEntry(STUDENT_ID, 'student', {
      title:      'Study Session',
      eventType:  'Reminder',
      startDate:  '2026-07-10T09:00:00.000Z',
      visibility: 'personal',
    });

    expect(result.isOwner).toBe(true);
  });

  it('student cannot create non-personal entry', async () => {
    await expect(
      calendarService.createCalendarEntry(STUDENT_ID, 'student', {
        title:      'Hackathon',
        eventType:  'Other',
        startDate:  '2026-08-01T00:00:00.000Z',
        visibility: 'student',
      })
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('faculty cannot create institution_wide entry', async () => {
    await expect(
      calendarService.createCalendarEntry(FACULTY_ID, 'faculty', {
        title:      'College Event',
        eventType:  'Academic',
        startDate:  '2026-08-01T00:00:00.000Z',
        visibility: 'institution_wide',
      })
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('auto-fills startDate and eventType from lms_assignment source', async () => {
    const dueDate = new Date('2026-07-25T23:59:00.000Z');
    // enrichSourceForCalendar
    mockQuery.mockResolvedValueOnce({ rows: [{ due_date: dueDate }], rowCount: 1 } as never);
    // INSERT
    mockQuery.mockResolvedValueOnce({ rows: [{ id: ENTRY_ID }], rowCount: 1 } as never);
    // SELECT
    mockQuery.mockResolvedValueOnce({ rows: [mockEntryRow], rowCount: 1 } as never);

    await calendarService.createCalendarEntry(ADMIN_ID, 'admin', {
      title:        'OS Assignment Deadline',
      visibility:   'institution_wide',
      sourceModule: 'lms_assignment',
      sourceId:     ASSIGN_ID,
      // no startDate — should come from source
    });

    const insertParams = mockQuery.mock.calls[1][1] as unknown[];
    // eventType should be 'Assignment Deadline' (from source)
    expect(insertParams).toContain('Assignment Deadline');
    // startDate should be the due_date from source
    expect(insertParams).toContainEqual(dueDate);
  });

  it('auto-fills from academic_calendar source', async () => {
    const startDate = new Date('2026-11-01');
    const endDate   = new Date('2026-11-20');
    mockQuery.mockResolvedValueOnce({
      rows: [{ start_date: startDate, end_date: endDate }],
      rowCount: 1,
    } as never);
    mockQuery.mockResolvedValueOnce({ rows: [{ id: ENTRY_ID }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [mockEntryRow], rowCount: 1 } as never);

    await calendarService.createCalendarEntry(ADMIN_ID, 'admin', {
      title:        'Mid-Sem',
      visibility:   'institution_wide',
      sourceModule: 'academic_calendar',
      sourceId:     'ace-0000-0000-0000-000000000001',
    });

    const insertParams = mockQuery.mock.calls[1][1] as unknown[];
    expect(insertParams).toContain('Academic');
    expect(insertParams).toContainEqual(startDate);
    expect(insertParams).toContainEqual(endDate);
  });

  it('throws 400 when source not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await expect(
      calendarService.createCalendarEntry(ADMIN_ID, 'admin', {
        title:        'Missing',
        visibility:   'personal',
        sourceModule: 'lms_assignment',
        sourceId:     ASSIGN_ID,
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 when no startDate and no source', async () => {
    await expect(
      calendarService.createCalendarEntry(ADMIN_ID, 'admin', {
        title:      'No Date',
        visibility: 'personal',
        // no startDate, no sourceModule
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 when endDate is before startDate', async () => {
    await expect(
      calendarService.createCalendarEntry(ADMIN_ID, 'admin', {
        title:      'Backwards',
        visibility: 'personal',
        startDate:  '2026-08-10T00:00:00.000Z',
        endDate:    '2026-08-01T00:00:00.000Z',
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('faculty department is auto-set regardless of provided departmentId', async () => {
    const OTHER_DEPT = 'dpt-other-000-0000-000000000002';
    // resolveUserCtx (faculty)
    mockQuery.mockResolvedValueOnce({ rows: [mockFacultyCtx], rowCount: 1 } as never);
    // INSERT
    mockQuery.mockResolvedValueOnce({ rows: [{ id: ENTRY_ID }], rowCount: 1 } as never);
    // SELECT
    mockQuery.mockResolvedValueOnce({ rows: [mockEntryRow], rowCount: 1 } as never);

    await calendarService.createCalendarEntry(FACULTY_ID, 'faculty', {
      title:        'Dept Meeting',
      visibility:   'department',
      startDate:    '2026-07-15T10:00:00.000Z',
      departmentId: OTHER_DEPT,  // should be overridden by faculty's own dept
    });

    const insertParams = mockQuery.mock.calls[1][1] as unknown[];
    // should use DEPT_ID (faculty's own), not OTHER_DEPT
    expect(insertParams).toContain(DEPT_ID);
    expect(insertParams).not.toContain(OTHER_DEPT);
  });
});

// ── listCalendarEntries ────────────────────────────────────────────────────────

describe('listCalendarEntries', () => {
  beforeEach(resetMocks);

  it('admin receives all entries without visibility filter', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...mockEntryRow, total_count: '5' }],
      rowCount: 1,
    } as never);

    const result = await calendarService.listCalendarEntries(
      ADMIN_ID, 'admin', { page: 1, limit: 20 }
    );

    expect(result.total).toBe(5);
    const sql = mockQuery.mock.calls[0][0] as string;
    // Admin SQL should NOT contain visibility conditions
    expect(sql).not.toMatch(/ce\.visibility = 'personal'/);
  });

  it('faculty query includes personal + faculty + institution_wide + dept conditions', async () => {
    // resolveUserCtx
    mockQuery.mockResolvedValueOnce({ rows: [mockFacultyCtx], rowCount: 1 } as never);
    // list query
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await calendarService.listCalendarEntries(
      FACULTY_ID, 'faculty', { page: 1, limit: 10 }
    );

    const sql = mockQuery.mock.calls[1][0] as string;
    expect(sql).toMatch(/visibility = 'personal'/);
    expect(sql).toMatch(/visibility = 'faculty'/);
    expect(sql).toMatch(/visibility = 'institution_wide'/);
    expect(sql).toMatch(/visibility = 'department'/);
    // student visibility should NOT appear for faculty
    expect(sql).not.toMatch(/visibility = 'student'/);
  });

  it('student query includes personal + student + institution_wide + dept + semester conditions', async () => {
    // resolveUserCtx
    mockQuery.mockResolvedValueOnce({ rows: [mockStudentCtx], rowCount: 1 } as never);
    // list query
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await calendarService.listCalendarEntries(
      STUDENT_ID, 'student', { page: 1, limit: 10 }
    );

    const sql    = mockQuery.mock.calls[1][0] as string;
    const params = mockQuery.mock.calls[1][1] as unknown[];

    expect(sql).toMatch(/visibility = 'personal'/);
    expect(sql).toMatch(/visibility = 'student'/);
    expect(sql).toMatch(/visibility = 'institution_wide'/);
    expect(sql).toMatch(/visibility = 'semester'/);
    expect(sql).toMatch(/visibility = 'department'/);
    expect(params).toContain(DEPT_ID);
    expect(params).toContain(5);   // semester
  });

  it('applies eventType filter', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await calendarService.listCalendarEntries(
      ADMIN_ID, 'admin', { page: 1, limit: 10, eventType: 'Academic' }
    );

    const sql    = mockQuery.mock.calls[0][0] as string;
    const params = mockQuery.mock.calls[0][1] as unknown[];
    expect(sql).toMatch(/ce\.event_type = \$/);
    expect(params).toContain('Academic');
  });

  it('applies date range filters', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await calendarService.listCalendarEntries(
      ADMIN_ID, 'admin', {
        page:  1,
        limit: 10,
        from:  '2026-07-01T00:00:00.000Z',
        to:    '2026-07-31T23:59:59.000Z',
      }
    );

    const sql    = mockQuery.mock.calls[0][0] as string;
    const params = mockQuery.mock.calls[0][1] as unknown[];
    expect(sql).toMatch(/ce\.start_date >= \$/);
    expect(sql).toMatch(/ce\.start_date <= \$/);
    expect(params).toContain('2026-07-01T00:00:00.000Z');
    expect(params).toContain('2026-07-31T23:59:59.000Z');
  });

  it('isOwner is true for entries created by the requesting user', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...mockEntryRow, created_by: STUDENT_ID, total_count: '1' }],
      rowCount: 1,
    } as never);

    const result = await calendarService.listCalendarEntries(
      STUDENT_ID, 'admin', { page: 1, limit: 10 }
    );

    expect(result.entries[0].isOwner).toBe(true);
  });

  it('isOwner is false for entries created by a different user', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...mockEntryRow, created_by: ADMIN_ID, total_count: '1' }],
      rowCount: 1,
    } as never);

    const result = await calendarService.listCalendarEntries(
      STUDENT_ID, 'admin', { page: 1, limit: 10 }
    );

    expect(result.entries[0].isOwner).toBe(false);
  });

  it('returns paginated structure', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    const result = await calendarService.listCalendarEntries(
      ADMIN_ID, 'admin', { page: 2, limit: 5 }
    );

    expect(result.page).toBe(2);
    expect(result.limit).toBe(5);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
  });
});

// ── updateCalendarEntry ────────────────────────────────────────────────────────

describe('updateCalendarEntry', () => {
  beforeEach(resetMocks);

  it('creator can update their entry', async () => {
    // fetch existing
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: ENTRY_ID, created_by: FACULTY_ID, start_date: new Date('2026-07-10'), end_date: null }],
      rowCount: 1,
    } as never);
    // UPDATE
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    // SELECT
    mockQuery.mockResolvedValueOnce({ rows: [{ ...mockEntryRow, created_by: FACULTY_ID }], rowCount: 1 } as never);

    const result = await calendarService.updateCalendarEntry(FACULTY_ID, 'faculty', ENTRY_ID, {
      title: 'Updated Title',
    });

    expect(result).toBeDefined();
    const updateSql = mockQuery.mock.calls[1][0] as string;
    expect(updateSql).toMatch(/UPDATE calendar_entries/);
  });

  it('admin can update any entry', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: ENTRY_ID, created_by: FACULTY_ID, start_date: new Date('2026-07-10'), end_date: null }],
      rowCount: 1,
    } as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [mockEntryRow], rowCount: 1 } as never);

    await expect(
      calendarService.updateCalendarEntry(ADMIN_ID, 'admin', ENTRY_ID, { title: 'Admin Edit' })
    ).resolves.toBeDefined();
  });

  it('non-creator non-admin throws 403', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: ENTRY_ID, created_by: FACULTY_ID, start_date: new Date('2026-07-10'), end_date: null }],
      rowCount: 1,
    } as never);

    await expect(
      calendarService.updateCalendarEntry(OTHER_USER, 'faculty', ENTRY_ID, { title: 'Hijack' })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws 404 when entry does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await expect(
      calendarService.updateCalendarEntry(ADMIN_ID, 'admin', ENTRY_ID, { title: 'X' })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 400 when endDate becomes before startDate', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: ENTRY_ID,
        created_by: ADMIN_ID,
        start_date: new Date('2026-08-10'),
        end_date:   null,
      }],
      rowCount: 1,
    } as never);

    await expect(
      calendarService.updateCalendarEntry(ADMIN_ID, 'admin', ENTRY_ID, {
        endDate: '2026-08-01T00:00:00.000Z',  // before start_date
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 when no update fields provided', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: ENTRY_ID,
        created_by: ADMIN_ID,
        start_date: new Date('2026-08-10'),
        end_date:   null,
      }],
      rowCount: 1,
    } as never);

    await expect(
      calendarService.updateCalendarEntry(ADMIN_ID, 'admin', ENTRY_ID, {})
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

// ── deleteCalendarEntry ────────────────────────────────────────────────────────

describe('deleteCalendarEntry', () => {
  beforeEach(resetMocks);

  it('creator can soft-delete their entry', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: ENTRY_ID, created_by: STUDENT_ID }],
      rowCount: 1,
    } as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);

    await calendarService.deleteCalendarEntry(STUDENT_ID, 'student', ENTRY_ID);

    const deleteSql = mockQuery.mock.calls[1][0] as string;
    expect(deleteSql).toMatch(/UPDATE calendar_entries SET deleted_at = NOW/);
  });

  it('admin can delete any entry', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: ENTRY_ID, created_by: FACULTY_ID }],
      rowCount: 1,
    } as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);

    await expect(
      calendarService.deleteCalendarEntry(ADMIN_ID, 'admin', ENTRY_ID)
    ).resolves.toBeUndefined();
  });

  it('non-creator non-admin throws 403', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: ENTRY_ID, created_by: FACULTY_ID }],
      rowCount: 1,
    } as never);

    await expect(
      calendarService.deleteCalendarEntry(OTHER_USER, 'student', ENTRY_ID)
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws 404 when entry does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await expect(
      calendarService.deleteCalendarEntry(ADMIN_ID, 'admin', ENTRY_ID)
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
