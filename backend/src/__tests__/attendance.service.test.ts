// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockQuery = jest.fn();
const mockWithTransaction = jest.fn();
const mockAuditLog = jest.fn().mockResolvedValue(undefined);
const mockIsFacultyAssigned = jest.fn();

jest.mock('../config/database', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  withTransaction: (...args: unknown[]) => mockWithTransaction(...args),
}));

jest.mock('../utils/audit', () => ({
  auditLog: (...args: unknown[]) => mockAuditLog(...args),
}));

jest.mock('../services/assignment.service', () => ({
  isFacultyAssigned: (...args: unknown[]) => mockIsFacultyAssigned(...args),
}));

import * as attendanceService from '../services/attendance.service';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FACULTY_USER_ID = '00000000-0000-0000-0000-000000000001';
const FACULTY_ID      = '00000000-0000-0000-0000-000000000002';
const STUDENT_ID      = '00000000-0000-0000-0000-000000000003';
const SUBJECT_ID      = '00000000-0000-0000-0000-000000000004';
const ATTENDANCE_ID   = '00000000-0000-0000-0000-000000000005';
const ADMIN_USER_ID   = '00000000-0000-0000-0000-000000000006';

const TODAY = new Date().toLocaleDateString('en-CA');
const PAST_DATE = '2024-01-15';

const baseAttendanceRow = {
  id: ATTENDANCE_ID,
  student_id: STUDENT_ID,
  student_name: 'John Doe',
  roll_number: 'CSE2024001',
  faculty_id: FACULTY_ID,
  faculty_name: 'Dr. Jane Smith',
  subject_id: SUBJECT_ID,
  subject_code: 'CS101',
  subject_name: 'Programming Fundamentals',
  section: 'A',
  attendance_date: PAST_DATE,
  status: 'present' as const,
  created_at: new Date(),
  updated_at: new Date(),
};

// ── getAttendanceById ─────────────────────────────────────────────────────────

describe('getAttendanceById', () => {
  it('returns a mapped AttendanceRecord when found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [baseAttendanceRow], rowCount: 1 });

    const result = await attendanceService.getAttendanceById(ATTENDANCE_ID);

    expect(result.id).toBe(ATTENDANCE_ID);
    expect(result.studentName).toBe('John Doe');
    expect(result.attendanceDate).toBe(PAST_DATE);
    expect(result.status).toBe('present');
  });

  it('throws 404 when record does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await expect(attendanceService.getAttendanceById(ATTENDANCE_ID)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Attendance record not found',
    });
  });
});

// ── getRoster ─────────────────────────────────────────────────────────────────

describe('getRoster', () => {
  it('returns roster with attendance status pre-populated', async () => {
    // subject lookup
    mockQuery.mockResolvedValueOnce({
      rows: [{ program_id: 'prog-id', semester: 1 }],
      rowCount: 1,
    });
    // student + attendance LEFT JOIN
    mockQuery.mockResolvedValueOnce({
      rows: [
        { student_id: STUDENT_ID, roll_number: 'CSE2024001', full_name: 'John Doe', section: 'A',
          attendance_id: ATTENDANCE_ID, status: 'present' },
        { student_id: 'student-2', roll_number: 'CSE2024002', full_name: 'Jane Doe', section: 'A',
          attendance_id: null, status: null },
      ],
      rowCount: 2,
    });

    const roster = await attendanceService.getRoster(SUBJECT_ID, 'A', PAST_DATE);

    expect(roster).toHaveLength(2);
    expect(roster[0].attendanceId).toBe(ATTENDANCE_ID);
    expect(roster[0].status).toBe('present');
    expect(roster[1].attendanceId).toBeNull();
    expect(roster[1].status).toBeNull();
  });

  it('returns empty array when no students are enrolled in the section', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ program_id: 'prog-id', semester: 1 }], rowCount: 1 });
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const roster = await attendanceService.getRoster(SUBJECT_ID, 'B', PAST_DATE);

    expect(roster).toHaveLength(0);
  });

  it('throws 404 when subject does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await expect(attendanceService.getRoster(SUBJECT_ID, 'A', PAST_DATE)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Subject not found',
    });
  });
});

// ── markAttendance ────────────────────────────────────────────────────────────

describe('markAttendance', () => {
  const input = {
    subjectId: SUBJECT_ID,
    section: 'A',
    date: PAST_DATE,
    records: [
      { studentId: STUDENT_ID, status: 'present' as const },
    ],
  };

  interface MockClient {
    query: jest.Mock;
  }

  let mockClient: MockClient;

  beforeEach(() => {
    mockClient = { query: jest.fn() };
    mockWithTransaction.mockImplementation(
      async (fn: (client: MockClient) => Promise<unknown>) => fn(mockClient)
    );
  });

  it('marks attendance and returns inserted/updated counts', async () => {
    // resolveFacultyId
    mockQuery.mockResolvedValueOnce({ rows: [{ id: FACULTY_ID }], rowCount: 1 });
    // isFacultyAssigned
    mockIsFacultyAssigned.mockResolvedValueOnce(true);
    // subject exists
    mockQuery.mockResolvedValueOnce({ rows: [{ id: SUBJECT_ID }], rowCount: 1 });
    // upsert inside transaction (new row: created_at == updated_at)
    const now = new Date();
    mockClient.query.mockResolvedValueOnce({ rows: [{ created_at: now, updated_at: now }], rowCount: 1 });

    const result = await attendanceService.markAttendance(input, FACULTY_USER_ID);

    expect(result.inserted).toBe(1);
    expect(result.updated).toBe(0);
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'MARK_ATTENDANCE_SESSION' })
    );
  });

  it('counts as "updated" when row existed before (created_at differs from updated_at)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: FACULTY_ID }], rowCount: 1 });
    mockIsFacultyAssigned.mockResolvedValueOnce(true);
    mockQuery.mockResolvedValueOnce({ rows: [{ id: SUBJECT_ID }], rowCount: 1 });
    // existing row: updated_at is 2 seconds after created_at
    const created = new Date('2024-01-15T10:00:00Z');
    const updated = new Date('2024-01-15T10:00:02Z');
    mockClient.query.mockResolvedValueOnce({ rows: [{ created_at: created, updated_at: updated }], rowCount: 1 });

    const result = await attendanceService.markAttendance(input, FACULTY_USER_ID);

    expect(result.inserted).toBe(0);
    expect(result.updated).toBe(1);
  });

  it('throws 403 when faculty is not assigned to the subject', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: FACULTY_ID }], rowCount: 1 });
    mockIsFacultyAssigned.mockResolvedValueOnce(false);

    await expect(attendanceService.markAttendance(input, FACULTY_USER_ID)).rejects.toMatchObject({
      statusCode: 403,
      code: 'NOT_ASSIGNED',
    });
  });

  it('throws 400 when date is in the future', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: FACULTY_ID }], rowCount: 1 });
    mockIsFacultyAssigned.mockResolvedValueOnce(true);

    const futureInput = { ...input, date: '2099-12-31' };

    await expect(attendanceService.markAttendance(futureInput, FACULTY_USER_ID)).rejects.toMatchObject({
      statusCode: 400,
      code: 'FUTURE_DATE',
    });
  });

  it('throws 404 when subject does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: FACULTY_ID }], rowCount: 1 });
    mockIsFacultyAssigned.mockResolvedValueOnce(true);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // subject not found

    await expect(attendanceService.markAttendance(input, FACULTY_USER_ID)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Subject not found',
    });
  });

  it('throws 403 when no faculty profile is linked to the user', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // resolveFacultyId fails

    await expect(attendanceService.markAttendance(input, FACULTY_USER_ID)).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});

// ── updateAttendance ──────────────────────────────────────────────────────────

describe('updateAttendance', () => {
  it('admin can update any record on any date', async () => {
    // no faculty resolution for admin
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // UPDATE
    mockQuery.mockResolvedValueOnce({ rows: [baseAttendanceRow], rowCount: 1 }); // getById

    const result = await attendanceService.updateAttendance(
      ATTENDANCE_ID,
      { status: 'absent' },
      ADMIN_USER_ID,
      'admin'
    );

    expect(result.status).toBe('present'); // fixture has 'present' — mock returns the same row
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UPDATE_ATTENDANCE', changes: { status: 'absent' } })
    );
  });

  it('faculty can update their own record on the same day', async () => {
    // resolveFacultyId
    mockQuery.mockResolvedValueOnce({ rows: [{ id: FACULTY_ID }], rowCount: 1 });
    // ownership + date check
    mockQuery.mockResolvedValueOnce({
      rows: [{ faculty_id: FACULTY_ID, attendance_date: TODAY }],
      rowCount: 1,
    });
    // UPDATE
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    // getById
    mockQuery.mockResolvedValueOnce({ rows: [{ ...baseAttendanceRow, attendance_date: TODAY, status: 'absent' }], rowCount: 1 });

    const result = await attendanceService.updateAttendance(
      ATTENDANCE_ID,
      { status: 'absent' },
      FACULTY_USER_ID,
      'faculty'
    );

    expect(result.status).toBe('absent');
  });

  it('throws 403 when faculty tries to update another faculty\'s record', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: FACULTY_ID }], rowCount: 1 });
    mockQuery.mockResolvedValueOnce({
      rows: [{ faculty_id: 'other-faculty-id', attendance_date: TODAY }],
      rowCount: 1,
    });

    await expect(
      attendanceService.updateAttendance(ATTENDANCE_ID, { status: 'absent' }, FACULTY_USER_ID, 'faculty')
    ).rejects.toMatchObject({ statusCode: 403, code: 'NOT_RECORD_OWNER' });
  });

  it('throws 403 when faculty tries to update a past-date record', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: FACULTY_ID }], rowCount: 1 });
    mockQuery.mockResolvedValueOnce({
      rows: [{ faculty_id: FACULTY_ID, attendance_date: PAST_DATE }],
      rowCount: 1,
    });

    await expect(
      attendanceService.updateAttendance(ATTENDANCE_ID, { status: 'absent' }, FACULTY_USER_ID, 'faculty')
    ).rejects.toMatchObject({ statusCode: 403, code: 'CORRECTION_WINDOW_CLOSED' });
  });

  it('throws 404 when record does not exist (admin path)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // UPDATE rowCount = 0

    await expect(
      attendanceService.updateAttendance(ATTENDANCE_ID, { status: 'absent' }, ADMIN_USER_ID, 'admin')
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── listAttendance ────────────────────────────────────────────────────────────

describe('listAttendance', () => {
  it('returns paginated results with no filters', async () => {
    const listRow = { ...baseAttendanceRow, total_count: '5' };
    mockQuery.mockResolvedValueOnce({ rows: [listRow, listRow], rowCount: 2 });

    const result = await attendanceService.listAttendance({ page: 1, limit: 50 });

    expect(result.pagination.total).toBe(5);
    expect(result.records).toHaveLength(2);
  });

  it('applies studentId, subjectId, and date filters', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await attendanceService.listAttendance({
      page: 1, limit: 50,
      studentId: STUDENT_ID,
      subjectId: SUBJECT_ID,
      date: PAST_DATE,
    });

    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('a.student_id =');
    expect(sql).toContain('a.subject_id =');
    expect(params).toContain(STUDENT_ID);
    expect(params).toContain(SUBJECT_ID);
    expect(params).toContain(PAST_DATE);
  });

  it('applies dateFrom and dateTo range filters', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await attendanceService.listAttendance({
      page: 1, limit: 50,
      dateFrom: '2024-01-01',
      dateTo: '2024-01-31',
    });

    const [sql] = mockQuery.mock.calls[0] as [string];
    expect(sql).toContain('attendance_date >=');
    expect(sql).toContain('attendance_date <=');
  });
});

// ── getStudentSummary ─────────────────────────────────────────────────────────

describe('getStudentSummary', () => {
  it('calculates correct percentage for each subject and overall', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { subject_id: SUBJECT_ID, subject_code: 'CS101', subject_name: 'Prog', semester: 1,
          total_classes: '10', attended_classes: '8' },
        { subject_id: 'sub-2', subject_code: 'CS102', subject_name: 'Math', semester: 1,
          total_classes: '10', attended_classes: '5' },
      ],
      rowCount: 2,
    });

    const summary = await attendanceService.getStudentSummary(FACULTY_USER_ID);

    expect(summary.subjects[0].percentage).toBe(80);
    expect(summary.subjects[1].percentage).toBe(50);
    expect(summary.overall.totalClasses).toBe(20);
    expect(summary.overall.attendedClasses).toBe(13);
    expect(summary.overall.percentage).toBe(65);
  });

  it('returns 0% when no classes have been held yet', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { subject_id: SUBJECT_ID, subject_code: 'CS101', subject_name: 'Prog', semester: 1,
          total_classes: '0', attended_classes: '0' },
      ],
      rowCount: 1,
    });

    const summary = await attendanceService.getStudentSummary(FACULTY_USER_ID);

    expect(summary.subjects[0].percentage).toBe(0);
    expect(summary.overall.percentage).toBe(0);
  });

  it('returns empty subjects array when student has no enrolled subjects', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const summary = await attendanceService.getStudentSummary(FACULTY_USER_ID);

    expect(summary.subjects).toHaveLength(0);
    expect(summary.overall.totalClasses).toBe(0);
  });
});

// ── getStudentHistory ─────────────────────────────────────────────────────────

describe('getStudentHistory', () => {
  it('returns paginated attendance history for a student', async () => {
    const historyRow = {
      id: ATTENDANCE_ID,
      subject_id: SUBJECT_ID,
      subject_code: 'CS101',
      subject_name: 'Programming Fundamentals',
      section: 'A',
      attendance_date: PAST_DATE,
      status: 'present' as const,
      marked_by: 'Dr. Jane Smith',
      updated_at: new Date(),
      total_count: '10',
    };
    mockQuery.mockResolvedValueOnce({ rows: [historyRow], rowCount: 1 });

    const result = await attendanceService.getStudentHistory(FACULTY_USER_ID, { page: 1, limit: 30 });

    expect(result.pagination.total).toBe(10);
    expect(result.records).toHaveLength(1);
    expect(result.records[0].markedBy).toBe('Dr. Jane Smith');
    expect(result.records[0].attendanceDate).toBe(PAST_DATE);
  });

  it('applies subjectId filter', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await attendanceService.getStudentHistory(FACULTY_USER_ID, { page: 1, limit: 30, subjectId: SUBJECT_ID });

    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('a.subject_id =');
    expect(params).toContain(SUBJECT_ID);
  });

  it('returns empty result when student has no history', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const result = await attendanceService.getStudentHistory(FACULTY_USER_ID, { page: 1, limit: 30 });

    expect(result.records).toHaveLength(0);
    expect(result.pagination.total).toBe(0);
    expect(result.pagination.totalPages).toBe(0);
  });
});
