import * as assignmentService from '../services/lmsAssignment.service';

// ── Mock dependencies ──────────────────────────────────────────────────────────

jest.mock('../config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../utils/audit', () => ({
  auditLog: jest.fn().mockResolvedValue(undefined),
}));

import { query } from '../config/database';
const mockQuery = query as jest.MockedFunction<typeof query>;

// ── Test data ──────────────────────────────────────────────────────────────────

const FACULTY_USER_ID = 'fac-user-0000-0000-000000000001';
const FACULTY_ID      = 'fac-0000-0000-0000-000000000001';
const STUDENT_USER_ID = 'stu-user-0000-0000-000000000001';
const ASSIGNMENT_ID   = 'asg-0000-0000-0000-000000000001';
const SUBJECT_ID      = 'sub-0000-0000-0000-000000000001';

const DUE_DATE = '2026-09-01T23:59:59.000Z';

const mockAssignmentRow = {
  id:           ASSIGNMENT_ID,
  title:        'Week 1 Problem Set',
  description:  'Solve all problems',
  subject_id:   SUBJECT_ID,
  subject_code: 'CS301',
  subject_name: 'Data Structures',
  faculty_id:   FACULTY_ID,
  faculty_name: 'Dr. Smith',
  due_date:     new Date(DUE_DATE),
  max_marks:    '20',
  created_at:   new Date('2026-06-01'),
  updated_at:   new Date('2026-06-01'),
};

function resetMocks() {
  mockQuery.mockReset();
}

// ── createAssignment ───────────────────────────────────────────────────────────

describe('createAssignment', () => {
  beforeEach(resetMocks);

  it('creates assignment and returns detail', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: FACULTY_ID }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'fsa-id' }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [{ id: ASSIGNMENT_ID }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [mockAssignmentRow], rowCount: 1 } as never);

    const result = await assignmentService.createAssignment(FACULTY_USER_ID, {
      title:     'Week 1 Problem Set',
      subjectId: SUBJECT_ID,
      dueDate:   DUE_DATE,
      maxMarks:  20,
    });

    expect(result.id).toBe(ASSIGNMENT_ID);
    expect(result.maxMarks).toBe(20);
    expect(result.facultyId).toBe(FACULTY_ID);

    const insertSql = mockQuery.mock.calls[2][0] as string;
    expect(insertSql).toMatch(/INSERT INTO assignments/);
  });

  it('throws 404 when faculty profile not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await expect(
      assignmentService.createAssignment(FACULTY_USER_ID, {
        title: 'T', subjectId: SUBJECT_ID, dueDate: DUE_DATE, maxMarks: 10,
      })
    ).rejects.toMatchObject({ statusCode: 404, message: 'Faculty profile not found' });
  });

  it('throws 403 when faculty is not assigned to the subject', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: FACULTY_ID }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await expect(
      assignmentService.createAssignment(FACULTY_USER_ID, {
        title: 'T', subjectId: SUBJECT_ID, dueDate: DUE_DATE, maxMarks: 10,
      })
    ).rejects.toMatchObject({ statusCode: 403, message: 'You are not assigned to this subject' });
  });
});

// ── listAssignments ────────────────────────────────────────────────────────────

describe('listAssignments', () => {
  beforeEach(resetMocks);

  it('admin receives all assignments without role filter', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...mockAssignmentRow, total_count: '1' }],
      rowCount: 1,
    } as never);

    const result = await assignmentService.listAssignments('admin-id', 'admin', { page: 1, limit: 20 });

    expect(result.total).toBe(1);
    expect(result.assignments[0].maxMarks).toBe(20);
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).not.toMatch(/faculty_subject_assignments/);
  });

  it('faculty query includes EXISTS filter on faculty_subject_assignments', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: FACULTY_ID }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await assignmentService.listAssignments(FACULTY_USER_ID, 'faculty', { page: 1, limit: 20 });

    const listSql = mockQuery.mock.calls[1][0] as string;
    expect(listSql).toMatch(/faculty_subject_assignments/);
  });

  it('student query filters by program_id and semester', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ program_id: 'prog-1', semester: 3 }],
      rowCount: 1,
    } as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await assignmentService.listAssignments(STUDENT_USER_ID, 'student', { page: 1, limit: 20 });

    const listSql = mockQuery.mock.calls[1][0] as string;
    expect(listSql).toMatch(/program_id/);
  });

  it('returns empty when student profile not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    const result = await assignmentService.listAssignments(
      STUDENT_USER_ID, 'student', { page: 1, limit: 20 }
    );

    expect(result.assignments).toHaveLength(0);
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });
});

// ── getAssignmentById ──────────────────────────────────────────────────────────

describe('getAssignmentById', () => {
  beforeEach(resetMocks);

  it('returns assignment for admin with a single query', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockAssignmentRow], rowCount: 1 } as never);

    const result = await assignmentService.getAssignmentById('admin-id', 'admin', ASSIGNMENT_ID);

    expect(result.id).toBe(ASSIGNMENT_ID);
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('throws 404 when assignment not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await expect(
      assignmentService.getAssignmentById('admin-id', 'admin', ASSIGNMENT_ID)
    ).rejects.toMatchObject({ statusCode: 404, message: 'Assignment not found' });
  });

  it('throws 403 for student not enrolled in the assignment subject', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockAssignmentRow], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [{ program_id: 'prog-1', semester: 5 }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await expect(
      assignmentService.getAssignmentById(STUDENT_USER_ID, 'student', ASSIGNMENT_ID)
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

// ── updateAssignment ───────────────────────────────────────────────────────────

describe('updateAssignment', () => {
  beforeEach(resetMocks);

  it('updates due_date and returns updated assignment', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: FACULTY_ID }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [mockAssignmentRow], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...mockAssignmentRow, due_date: new Date('2026-10-01') }],
      rowCount: 1,
    } as never);

    const result = await assignmentService.updateAssignment(
      FACULTY_USER_ID, ASSIGNMENT_ID, { dueDate: '2026-10-01T23:59:59.000Z' }
    );

    const updateSql = mockQuery.mock.calls[2][0] as string;
    expect(updateSql).toMatch(/UPDATE assignments SET due_date/);
    expect(result).toBeDefined();
  });

  it('throws 403 when faculty does not own the assignment', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'other-faculty' }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [mockAssignmentRow], rowCount: 1 } as never);

    await expect(
      assignmentService.updateAssignment(FACULTY_USER_ID, ASSIGNMENT_ID, { title: 'X' })
    ).rejects.toMatchObject({ statusCode: 403, message: 'You do not own this assignment' });
  });

  it('throws 400 when no fields provided', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: FACULTY_ID }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [mockAssignmentRow], rowCount: 1 } as never);

    await expect(
      assignmentService.updateAssignment(FACULTY_USER_ID, ASSIGNMENT_ID, {})
    ).rejects.toMatchObject({ statusCode: 400, message: 'No fields to update' });
  });
});

// ── deleteAssignment ───────────────────────────────────────────────────────────

describe('deleteAssignment', () => {
  beforeEach(resetMocks);

  it('soft-deletes assignment', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: FACULTY_ID }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [mockAssignmentRow], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);

    await assignmentService.deleteAssignment(FACULTY_USER_ID, ASSIGNMENT_ID);

    const deleteSql = mockQuery.mock.calls[2][0] as string;
    expect(deleteSql).toMatch(/UPDATE assignments SET deleted_at/);
  });

  it('throws 404 when assignment does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: FACULTY_ID }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await expect(
      assignmentService.deleteAssignment(FACULTY_USER_ID, ASSIGNMENT_ID)
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
