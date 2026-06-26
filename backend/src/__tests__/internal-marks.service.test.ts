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

import * as marksService from '../services/internal-marks.service';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FACULTY_USER_ID = '00000000-0000-0000-0000-000000000001';
const FACULTY_ID      = '00000000-0000-0000-0000-000000000002';
const STUDENT_ID      = '00000000-0000-0000-0000-000000000003';
const SUBJECT_ID      = '00000000-0000-0000-0000-000000000004';
const MARKS_RECORD_ID = '00000000-0000-0000-0000-000000000005';
const ADMIN_USER_ID   = '00000000-0000-0000-0000-000000000006';

const baseMarksRow = {
  id: MARKS_RECORD_ID,
  student_id: STUDENT_ID,
  student_name: 'John Doe',
  roll_number: 'CSE2024001',
  faculty_id: FACULTY_ID,
  faculty_name: 'Dr. Jane Smith',
  subject_id: SUBJECT_ID,
  subject_code: 'CS101',
  subject_name: 'Programming Fundamentals',
  section: 'A',
  assessment_type: 'Mid-1' as const,
  maximum_marks: '20.00',
  obtained_marks: '18.50',
  remarks: 'Excellent presentation',
  created_at: new Date(),
  updated_at: new Date(),
};

// ── getMarksById ─────────────────────────────────────────────────────────────

describe('getMarksById', () => {
  it('returns a mapped InternalMarksRecord when found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [baseMarksRow], rowCount: 1 });

    const result = await marksService.getMarksById(MARKS_RECORD_ID);

    expect(result.id).toBe(MARKS_RECORD_ID);
    expect(result.studentName).toBe('John Doe');
    expect(result.maximumMarks).toBe(20.00);
    expect(result.obtainedMarks).toBe(18.50);
    expect(result.assessmentType).toBe('Mid-1');
  });

  it('throws 404 when record does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await expect(marksService.getMarksById(MARKS_RECORD_ID)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Internal marks record not found',
    });
  });
});

// ── getRoster ─────────────────────────────────────────────────────────────────

describe('getRoster', () => {
  it('returns roster with marks details pre-populated', async () => {
    // subject lookup
    mockQuery.mockResolvedValueOnce({
      rows: [{ program_id: 'prog-id', semester: 1 }],
      rowCount: 1,
    });
    // student + marks LEFT JOIN
    mockQuery.mockResolvedValueOnce({
      rows: [
        { student_id: STUDENT_ID, roll_number: 'CSE2024001', full_name: 'John Doe', section: 'A',
          marks_id: MARKS_RECORD_ID, obtained_marks: '18.50', maximum_marks: '20.00', remarks: 'Good work' },
        { student_id: 'student-2', roll_number: 'CSE2024002', full_name: 'Jane Doe', section: 'A',
          marks_id: null, obtained_marks: null, maximum_marks: null, remarks: null },
      ],
      rowCount: 2,
    });

    const roster = await marksService.getRoster(SUBJECT_ID, 'A', 'Mid-1');

    expect(roster).toHaveLength(2);
    expect(roster[0].marksId).toBe(MARKS_RECORD_ID);
    expect(roster[0].obtainedMarks).toBe(18.50);
    expect(roster[0].maximumMarks).toBe(20.00);
    expect(roster[1].marksId).toBeNull();
    expect(roster[1].obtainedMarks).toBeNull();
  });

  it('throws 404 when subject does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await expect(marksService.getRoster(SUBJECT_ID, 'A', 'Mid-1')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Subject not found',
    });
  });
});

// ── bulkEnterMarks ────────────────────────────────────────────────────────────

describe('bulkEnterMarks', () => {
  const input = {
    subjectId: SUBJECT_ID,
    section: 'A',
    assessmentType: 'Mid-1' as const,
    maximumMarks: 20,
    records: [
      { studentId: STUDENT_ID, obtainedMarks: 18.5, remarks: 'Well structured' },
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

  it('records marks and returns inserted/updated counts', async () => {
    // resolveFacultyId
    mockQuery.mockResolvedValueOnce({ rows: [{ id: FACULTY_ID }], rowCount: 1 });
    // isFacultyAssigned
    mockIsFacultyAssigned.mockResolvedValueOnce(true);
    // subject exists
    mockQuery.mockResolvedValueOnce({ rows: [{ id: SUBJECT_ID }], rowCount: 1 });
    // upsert in database (new row: created_at == updated_at)
    const now = new Date();
    mockClient.query.mockResolvedValueOnce({ rows: [{ created_at: now, updated_at: now }], rowCount: 1 });

    const result = await marksService.bulkEnterMarks(input, FACULTY_USER_ID);

    expect(result.inserted).toBe(1);
    expect(result.updated).toBe(0);
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'BULK_ENTER_MARKS' })
    );
  });

  it('counts as "updated" when row existed before (created_at differs from updated_at)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: FACULTY_ID }], rowCount: 1 });
    mockIsFacultyAssigned.mockResolvedValueOnce(true);
    mockQuery.mockResolvedValueOnce({ rows: [{ id: SUBJECT_ID }], rowCount: 1 });
    // existing row: updated_at differs
    const created = new Date('2024-01-15T10:00:00Z');
    const updated = new Date('2024-01-15T10:00:02Z');
    mockClient.query.mockResolvedValueOnce({ rows: [{ created_at: created, updated_at: updated }], rowCount: 1 });

    const result = await marksService.bulkEnterMarks(input, FACULTY_USER_ID);

    expect(result.inserted).toBe(0);
    expect(result.updated).toBe(1);
  });

  it('throws 403 when faculty is not assigned to the subject', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: FACULTY_ID }], rowCount: 1 });
    mockIsFacultyAssigned.mockResolvedValueOnce(false);

    await expect(marksService.bulkEnterMarks(input, FACULTY_USER_ID)).rejects.toMatchObject({
      statusCode: 403,
      code: 'NOT_ASSIGNED',
    });
  });
});

// ── updateMarks ───────────────────────────────────────────────────────────────

describe('updateMarks', () => {
  it('admin can update any marks record', async () => {
    // fetch current record
    mockQuery.mockResolvedValueOnce({
      rows: [{ faculty_id: FACULTY_ID, maximum_marks: '20.00', obtained_marks: '18.00' }],
      rowCount: 1,
    });
    // UPDATE
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    // getById
    mockQuery.mockResolvedValueOnce({ rows: [baseMarksRow], rowCount: 1 });

    const result = await marksService.updateMarks(
      MARKS_RECORD_ID,
      { obtainedMarks: 19 },
      ADMIN_USER_ID,
      'admin'
    );

    expect(result.id).toBe(MARKS_RECORD_ID);
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UPDATE_MARKS_RECORD', changes: { obtainedMarks: 19 } })
    );
  });

  it('faculty can update their own record', async () => {
    // fetch current record
    mockQuery.mockResolvedValueOnce({
      rows: [{ faculty_id: FACULTY_ID, maximum_marks: '20.00', obtained_marks: '18.00' }],
      rowCount: 1,
    });
    // resolveFacultyId
    mockQuery.mockResolvedValueOnce({ rows: [{ id: FACULTY_ID }], rowCount: 1 });
    // UPDATE
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    // getById
    mockQuery.mockResolvedValueOnce({ rows: [{ ...baseMarksRow, obtained_marks: '19.00' }], rowCount: 1 });

    const result = await marksService.updateMarks(
      MARKS_RECORD_ID,
      { obtainedMarks: 19 },
      FACULTY_USER_ID,
      'faculty'
    );

    expect(result.obtainedMarks).toBe(19);
  });

  it('throws 403 when faculty tries to update another faculty\'s record', async () => {
    // fetch current record
    mockQuery.mockResolvedValueOnce({
      rows: [{ faculty_id: 'other-faculty-id', maximum_marks: '20.00', obtained_marks: '18.00' }],
      rowCount: 1,
    });
    // resolveFacultyId
    mockQuery.mockResolvedValueOnce({ rows: [{ id: FACULTY_ID }], rowCount: 1 });

    await expect(
      marksService.updateMarks(MARKS_RECORD_ID, { obtainedMarks: 19 }, FACULTY_USER_ID, 'faculty')
    ).rejects.toMatchObject({ statusCode: 403, code: 'NOT_RECORD_OWNER' });
  });

  it('throws 400 when obtained marks exceed maximum marks', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ faculty_id: FACULTY_ID, maximum_marks: '20.00', obtained_marks: '18.00' }],
      rowCount: 1,
    });

    await expect(
      marksService.updateMarks(MARKS_RECORD_ID, { obtainedMarks: 25 }, ADMIN_USER_ID, 'admin')
    ).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_MARKS_RELATION' });
  });
});

// ── listMarks ─────────────────────────────────────────────────────────────────

describe('listMarks', () => {
  it('returns paginated list records with no filters', async () => {
    const listRow = { ...baseMarksRow, total_count: '12' };
    mockQuery.mockResolvedValueOnce({ rows: [listRow], rowCount: 1 });

    const result = await marksService.listMarks({ page: 1, limit: 10 });

    expect(result.pagination.total).toBe(12);
    expect(result.records).toHaveLength(1);
  });
});

// ── getStudentSummary ─────────────────────────────────────────────────────────

describe('getStudentSummary', () => {
  it('calculates totals and percentage for student summary', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { subject_id: SUBJECT_ID, subject_code: 'CS101', subject_name: 'Prog', semester: 1,
          assessment_type: 'Mid-1', obtained_marks: '18.50', maximum_marks: '20.00', remarks: 'Well done' },
        { subject_id: SUBJECT_ID, subject_code: 'CS101', subject_name: 'Prog', semester: 1,
          assessment_type: 'Mid-2', obtained_marks: '15.00', maximum_marks: '20.00', remarks: null },
      ],
      rowCount: 2,
    });

    const summary = await marksService.getStudentSummary(STUDENT_ID);

    expect(summary.subjects[0].totalObtained).toBe(33.5);
    expect(summary.subjects[0].totalMaximum).toBe(40.0);
    expect(summary.overall.percentage).toBe(83.75);
  });
});
