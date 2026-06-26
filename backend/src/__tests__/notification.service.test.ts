import * as notificationService from '../services/notification.service';

// ── Mock dependencies ──────────────────────────────────────────────────────────

jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../utils/audit',    () => ({ auditLog: jest.fn().mockResolvedValue(undefined) }));

import { query } from '../config/database';
const mockQuery = query as jest.MockedFunction<typeof query>;

// ── Test data ──────────────────────────────────────────────────────────────────

const ADMIN_ID   = 'adm-0000-0000-0000-000000000001';
const FACULTY_ID = 'fac-0000-0000-0000-000000000001';
const STUDENT_ID = 'stu-0000-0000-0000-000000000001';
const NOTIF_ID   = 'ntf-0000-0000-0000-000000000001';
const DEPT_ID    = 'dpt-0000-0000-0000-000000000001';
const ASSIGN_ID  = 'asg-0000-0000-0000-000000000001';

const mockNotifRow = {
  id:              NOTIF_ID,
  title:           'Campus Placement Drive',
  message:         'TCS is coming for placements on July 10.',
  type:            'Placement Drive',
  source_module:   null,
  source_id:       null,
  target_role:     'all',
  department_id:   null,
  department_name: null,
  semester:        null,
  is_important:    false,
  is_read:         false,
  created_by:      ADMIN_ID,
  created_by_name: 'Admin User',
  created_at:      new Date('2026-06-20'),
};

const mockFacultyRow = { department_id: DEPT_ID };
const mockStudentRow = { department_id: DEPT_ID, semester: 5 };

function resetMocks() {
  mockQuery.mockReset();
}

// ── createNotification ─────────────────────────────────────────────────────────

describe('createNotification', () => {
  beforeEach(resetMocks);

  it('admin creates notification without source', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: NOTIF_ID }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [mockNotifRow], rowCount: 1 } as never);

    const result = await notificationService.createNotification(ADMIN_ID, 'admin', {
      title:      'Campus Placement Drive',
      message:    'TCS is coming for placements on July 10.',
      type:       'Placement Drive',
      targetRole: 'all',
      isImportant: false,
    });

    expect(result.id).toBe(NOTIF_ID);
    expect(result.isRead).toBe(false);

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toMatch(/INSERT INTO notifications/);
    const params = mockQuery.mock.calls[0][1] as unknown[];
    expect(params).toContain('Placement Drive');
    expect(params).toContain(ADMIN_ID);
  });

  it('throws 403 when faculty targets admin role', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockFacultyRow], rowCount: 1 } as never);

    await expect(
      notificationService.createNotification(FACULTY_ID, 'faculty', {
        title:      'Admin Alert',
        message:    'Some admin message',
        type:       'Announcement',
        targetRole: 'admin',
        isImportant: false,
      })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws 403 when faculty sets isImportant=true', async () => {
    await expect(
      notificationService.createNotification(FACULTY_ID, 'faculty', {
        title:       'Important!',
        message:     'Very important',
        type:        'Announcement',
        targetRole:  'student',
        isImportant: true,
      })
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('auto-sets departmentId to faculty department', async () => {
    // resolveFacultyDept
    mockQuery.mockResolvedValueOnce({ rows: [mockFacultyRow], rowCount: 1 } as never);
    // INSERT
    mockQuery.mockResolvedValueOnce({ rows: [{ id: NOTIF_ID }], rowCount: 1 } as never);
    // SELECT after insert
    mockQuery.mockResolvedValueOnce({ rows: [{ ...mockNotifRow, department_id: DEPT_ID }], rowCount: 1 } as never);

    await notificationService.createNotification(FACULTY_ID, 'faculty', {
      title:      'Assignment Released',
      message:    'Check your assignments',
      type:       'Assignment',
      targetRole: 'student',
      isImportant: false,
    });

    const insertParams = mockQuery.mock.calls[1][1] as unknown[];
    expect(insertParams).toContain(DEPT_ID);
  });

  it('enriches title and message from lms_assignment source', async () => {
    const dueDate = new Date('2026-07-15');
    // enrichSource query
    mockQuery.mockResolvedValueOnce({ rows: [{ title: 'Unit Test Assignment', due_date: dueDate }], rowCount: 1 } as never);
    // INSERT
    mockQuery.mockResolvedValueOnce({ rows: [{ id: NOTIF_ID }], rowCount: 1 } as never);
    // SELECT
    mockQuery.mockResolvedValueOnce({ rows: [mockNotifRow], rowCount: 1 } as never);

    await notificationService.createNotification(ADMIN_ID, 'admin', {
      title:        'Assignment Reminder',
      type:         'Assignment',
      targetRole:   'student',
      isImportant:  false,
      sourceModule: 'lms_assignment',
      sourceId:     ASSIGN_ID,
    });

    const insertParams = mockQuery.mock.calls[1][1] as unknown[];
    // message should be auto-filled from source (no message provided in input)
    const message = insertParams[1] as string;
    expect(message).toMatch(/due on/i);
  });

  it('throws 400 when source is not found', async () => {
    // enrichSource returns empty
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await expect(
      notificationService.createNotification(ADMIN_ID, 'admin', {
        title:        'Missing Source',
        type:         'Event',
        targetRole:   'all',
        isImportant:  false,
        sourceModule: 'lms_assignment',
        sourceId:     ASSIGN_ID,
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 when no message and no source', async () => {
    await expect(
      notificationService.createNotification(ADMIN_ID, 'admin', {
        title:       'Empty',
        type:        'Reminder',
        targetRole:  'all',
        isImportant: false,
        // no message, no sourceModule
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

// ── listNotifications ──────────────────────────────────────────────────────────

describe('listNotifications', () => {
  beforeEach(resetMocks);

  it('admin query has no role scope — only limit and offset params', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...mockNotifRow, total_count: '3' }],
      rowCount: 1,
    } as never);

    const result = await notificationService.listNotifications(
      ADMIN_ID, 'admin', { page: 1, limit: 20 }
    );

    expect(result.total).toBe(3);
    const params = mockQuery.mock.calls[0][1] as unknown[];
    // $1=userId for the LEFT JOIN, then limit and offset — 3 total for admin
    expect(params[params.length - 2]).toBe(20);   // limit
    expect(params[params.length - 1]).toBe(0);    // offset
  });

  it('faculty query fetches department and scopes by target_role', async () => {
    // resolveFacultyDept
    mockQuery.mockResolvedValueOnce({ rows: [mockFacultyRow], rowCount: 1 } as never);
    // list query
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await notificationService.listNotifications(
      FACULTY_ID, 'faculty', { page: 1, limit: 10 }
    );

    const sql = mockQuery.mock.calls[1][0] as string;
    expect(sql).toMatch(/target_role IN \('all', 'faculty'\)/);
    const params = mockQuery.mock.calls[1][1] as unknown[];
    expect(params).toContain(DEPT_ID);
  });

  it('student query scopes by target_role + dept + semester', async () => {
    // resolveStudentCtx
    mockQuery.mockResolvedValueOnce({ rows: [mockStudentRow], rowCount: 1 } as never);
    // list query
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await notificationService.listNotifications(
      STUDENT_ID, 'student', { page: 1, limit: 10 }
    );

    const sql = mockQuery.mock.calls[1][0] as string;
    expect(sql).toMatch(/target_role IN \('all', 'student'\)/);
    const params = mockQuery.mock.calls[1][1] as unknown[];
    expect(params).toContain(DEPT_ID);
    expect(params).toContain(5);   // semester
  });

  it('student not found throws 404', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await expect(
      notificationService.listNotifications(STUDENT_ID, 'student', { page: 1, limit: 10 })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('type filter is added to query', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await notificationService.listNotifications(
      ADMIN_ID, 'admin', { page: 1, limit: 10, type: 'Assignment' }
    );

    const sql    = mockQuery.mock.calls[0][0] as string;
    const params = mockQuery.mock.calls[0][1] as unknown[];
    expect(sql).toMatch(/n\.type = \$/);
    expect(params).toContain('Assignment');
  });

  it('isRead=false adds nr.id IS NULL condition', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await notificationService.listNotifications(
      ADMIN_ID, 'admin', { page: 1, limit: 10, isRead: 'false' }
    );

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toMatch(/nr\.id IS NULL/);
  });

  it('isRead=true adds nr.id IS NOT NULL condition', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await notificationService.listNotifications(
      ADMIN_ID, 'admin', { page: 1, limit: 10, isRead: 'true' }
    );

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toMatch(/nr\.id IS NOT NULL/);
  });

  it('returns paginated structure', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { ...mockNotifRow, is_read: false, total_count: '5' },
        { ...mockNotifRow, id: 'ntf-2', is_read: true, total_count: '5' },
      ],
      rowCount: 2,
    } as never);

    const result = await notificationService.listNotifications(
      ADMIN_ID, 'admin', { page: 1, limit: 2 }
    );

    expect(result.notifications).toHaveLength(2);
    expect(result.total).toBe(5);
    expect(result.totalPages).toBe(3);
    expect(result.notifications[0].isRead).toBe(false);
    expect(result.notifications[1].isRead).toBe(true);
  });
});

// ── getNotificationCount ───────────────────────────────────────────────────────

describe('getNotificationCount', () => {
  beforeEach(resetMocks);

  it('returns total and unread for admin', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ total: '10', unread: '4' }],
      rowCount: 1,
    } as never);

    const result = await notificationService.getNotificationCount(ADMIN_ID, 'admin');

    expect(result.total).toBe(10);
    expect(result.unread).toBe(4);

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toMatch(/COUNT\(\*\) FILTER \(WHERE nr\.id IS NULL\)/);
  });

  it('returns zeros when no notifications', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    const result = await notificationService.getNotificationCount(ADMIN_ID, 'admin');

    expect(result.total).toBe(0);
    expect(result.unread).toBe(0);
  });

  it('faculty count query includes faculty scope conditions', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockFacultyRow], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [{ total: '3', unread: '1' }], rowCount: 1 } as never);

    const result = await notificationService.getNotificationCount(FACULTY_ID, 'faculty');

    expect(result.total).toBe(3);
    const sql = mockQuery.mock.calls[1][0] as string;
    expect(sql).toMatch(/target_role IN \('all', 'faculty'\)/);
  });
});

// ── markAsRead ─────────────────────────────────────────────────────────────────

describe('markAsRead', () => {
  beforeEach(resetMocks);

  it('inserts read record with ON CONFLICT DO NOTHING', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: NOTIF_ID }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await notificationService.markAsRead(STUDENT_ID, NOTIF_ID);

    const insertSql = mockQuery.mock.calls[1][0] as string;
    expect(insertSql).toMatch(/INSERT INTO notification_reads/);
    expect(insertSql).toMatch(/ON CONFLICT.*DO NOTHING/);

    const params = mockQuery.mock.calls[1][1] as unknown[];
    expect(params).toContain(NOTIF_ID);
    expect(params).toContain(STUDENT_ID);
  });

  it('throws 404 when notification does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await expect(
      notificationService.markAsRead(STUDENT_ID, NOTIF_ID)
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── markAsUnread ───────────────────────────────────────────────────────────────

describe('markAsUnread', () => {
  beforeEach(resetMocks);

  it('deletes read record', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: NOTIF_ID }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await notificationService.markAsUnread(STUDENT_ID, NOTIF_ID);

    const deleteSql = mockQuery.mock.calls[1][0] as string;
    expect(deleteSql).toMatch(/DELETE FROM notification_reads/);

    const params = mockQuery.mock.calls[1][1] as unknown[];
    expect(params).toContain(NOTIF_ID);
    expect(params).toContain(STUDENT_ID);
  });

  it('throws 404 when notification does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await expect(
      notificationService.markAsUnread(STUDENT_ID, NOTIF_ID)
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── source enrichment (indirect via createNotification) ────────────────────────

describe('source enrichment', () => {
  beforeEach(resetMocks);

  it('enriches from academic_calendar source', async () => {
    const startDate = new Date('2026-07-01');
    mockQuery.mockResolvedValueOnce({
      rows: [{ title: 'Mid-Sem Exam', event_type: 'Examination', start_date: startDate }],
      rowCount: 1,
    } as never);
    mockQuery.mockResolvedValueOnce({ rows: [{ id: NOTIF_ID }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [mockNotifRow], rowCount: 1 } as never);

    await notificationService.createNotification(ADMIN_ID, 'admin', {
      title:        'Exam Reminder',
      type:         'Event',
      targetRole:   'student',
      isImportant:  false,
      sourceModule: 'academic_calendar',
      sourceId:     'cal-0000-0000-0000-000000000001',
    });

    const insertParams = mockQuery.mock.calls[1][1] as unknown[];
    const message = insertParams[1] as string;
    expect(message).toMatch(/Examination/);
  });

  it('enriches from opportunity source', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ title: 'Google Internship', type: 'Internship', deadline: new Date('2026-08-01') }],
      rowCount: 1,
    } as never);
    mockQuery.mockResolvedValueOnce({ rows: [{ id: NOTIF_ID }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [mockNotifRow], rowCount: 1 } as never);

    await notificationService.createNotification(ADMIN_ID, 'admin', {
      title:        'Internship Alert',
      type:         'Internship',
      targetRole:   'student',
      isImportant:  false,
      sourceModule: 'opportunity',
      sourceId:     'opp-0000-0000-0000-000000000001',
    });

    const insertParams = mockQuery.mock.calls[1][1] as unknown[];
    const message = insertParams[1] as string;
    expect(message).toMatch(/Internship opportunity/);
    expect(message).toMatch(/Deadline/);
  });
});
