import * as submissionService from '../services/lmsSubmission.service';

// ── Mock dependencies ──────────────────────────────────────────────────────────

jest.mock('../config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../utils/audit', () => ({
  auditLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  unlinkSync: jest.fn(),
  existsSync: jest.fn().mockReturnValue(true),
}));

import { query } from '../config/database';
const mockQuery = query as jest.MockedFunction<typeof query>;

// ── Test data ──────────────────────────────────────────────────────────────────

const FACULTY_USER_ID  = 'fac-user-0000-0000-000000000001';
const FACULTY_ID       = 'fac-0000-0000-0000-000000000001';
const STUDENT_USER_ID  = 'stu-user-0000-0000-000000000001';
const STUDENT_ID       = 'stu-0000-0000-0000-000000000001';
const ASSIGNMENT_ID    = 'asg-0000-0000-0000-000000000001';
const SUBJECT_ID       = 'sub-0000-0000-0000-000000000001';
const SUBMISSION_ID    = 'sbm-0000-0000-0000-000000000001';

// A future due date so default submissions are on time
const FUTURE_DUE       = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const PAST_DUE         = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);

const mockFile = {
  originalname: 'homework.pdf',
  path:         '/uploads/lms/xyz.pdf',
  size:         102400,
  mimetype:     'application/pdf',
} as Express.Multer.File;

const mockSubmissionRow = {
  id:                    SUBMISSION_ID,
  assignment_id:         ASSIGNMENT_ID,
  assignment_title:      'Week 1 Problem Set',
  assignment_due_date:   FUTURE_DUE,
  assignment_max_marks:  '20',
  student_id:            STUDENT_ID,
  student_roll_number:   '22CS001',
  student_name:          'Alice',
  file_name:             'homework.pdf',
  file_path:             '/uploads/lms/xyz.pdf',
  file_size:             '102400',
  status:                'Submitted',
  marks:                 null,
  feedback:              null,
  submitted_at:          new Date('2026-06-10'),
  updated_at:            new Date('2026-06-10'),
};

function resetMocks() {
  mockQuery.mockReset();
}

// ── submitAssignment ───────────────────────────────────────────────────────────

describe('submitAssignment', () => {
  beforeEach(resetMocks);

  function setupInitialSubmit(dueDate: Date = FUTURE_DUE) {
    // resolveStudentId
    mockQuery.mockResolvedValueOnce({ rows: [{ id: STUDENT_ID }], rowCount: 1 } as never);
    // fetch assignment
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: ASSIGNMENT_ID, subject_id: SUBJECT_ID, due_date: dueDate, faculty_id: FACULTY_ID }],
      rowCount: 1,
    } as never);
    // student ctx (program + semester)
    mockQuery.mockResolvedValueOnce({
      rows: [{ program_id: 'prog-1', semester: 3 }],
      rowCount: 1,
    } as never);
    // subject enrollment check
    mockQuery.mockResolvedValueOnce({ rows: [{ id: SUBJECT_ID }], rowCount: 1 } as never);
    // existing submission check → none
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    // INSERT returning id
    mockQuery.mockResolvedValueOnce({ rows: [{ id: SUBMISSION_ID }], rowCount: 1 } as never);
    // fetchSubmissionRow after insert
    mockQuery.mockResolvedValueOnce({ rows: [mockSubmissionRow], rowCount: 1 } as never);
  }

  it('creates submission with Submitted status when before deadline', async () => {
    setupInitialSubmit(FUTURE_DUE);

    const result = await submissionService.submitAssignment(STUDENT_USER_ID, ASSIGNMENT_ID, mockFile);

    expect(result.id).toBe(SUBMISSION_ID);
    expect(result.status).toBe('Submitted');

    const insertSql = mockQuery.mock.calls[5][0] as string;
    expect(insertSql).toMatch(/INSERT INTO assignment_submissions/);
    const insertParams = mockQuery.mock.calls[5][1] as unknown[];
    expect(insertParams).toContain('Submitted');
  });

  it('creates submission with Late Submission status when past deadline', async () => {
    setupInitialSubmit(PAST_DUE);

    // For this test, override the submission row to show Late Submission
    const lateRow = { ...mockSubmissionRow, status: 'Late Submission' };
    // Overwrite the last fetchSubmissionRow mock
    mockQuery.mockReset();
    mockQuery.mockResolvedValueOnce({ rows: [{ id: STUDENT_ID }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: ASSIGNMENT_ID, subject_id: SUBJECT_ID, due_date: PAST_DUE, faculty_id: FACULTY_ID }],
      rowCount: 1,
    } as never);
    mockQuery.mockResolvedValueOnce({ rows: [{ program_id: 'prog-1', semester: 3 }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [{ id: SUBJECT_ID }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [{ id: SUBMISSION_ID }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [lateRow], rowCount: 1 } as never);

    const result = await submissionService.submitAssignment(STUDENT_USER_ID, ASSIGNMENT_ID, mockFile);

    const insertParams = mockQuery.mock.calls[5][1] as unknown[];
    expect(insertParams).toContain('Late Submission');
    expect(result.status).toBe('Late Submission');
  });

  it('handles resubmission: deletes old file and updates existing record', async () => {
    const fs = require('fs') as { unlinkSync: jest.Mock };

    const existingPath = '/uploads/lms/old.pdf';
    // resolveStudentId
    mockQuery.mockResolvedValueOnce({ rows: [{ id: STUDENT_ID }], rowCount: 1 } as never);
    // assignment
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: ASSIGNMENT_ID, subject_id: SUBJECT_ID, due_date: FUTURE_DUE, faculty_id: FACULTY_ID }],
      rowCount: 1,
    } as never);
    // student ctx
    mockQuery.mockResolvedValueOnce({ rows: [{ program_id: 'prog-1', semester: 3 }], rowCount: 1 } as never);
    // enrollment
    mockQuery.mockResolvedValueOnce({ rows: [{ id: SUBJECT_ID }], rowCount: 1 } as never);
    // existing submission → found (Submitted status)
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: SUBMISSION_ID, status: 'Submitted', file_path: existingPath }],
      rowCount: 1,
    } as never);
    // UPDATE
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    // fetchSubmissionRow
    mockQuery.mockResolvedValueOnce({ rows: [mockSubmissionRow], rowCount: 1 } as never);

    await submissionService.submitAssignment(STUDENT_USER_ID, ASSIGNMENT_ID, mockFile);

    expect(fs.unlinkSync).toHaveBeenCalledWith(existingPath);
    const updateSql = mockQuery.mock.calls[5][0] as string;
    expect(updateSql).toMatch(/UPDATE assignment_submissions/);
    expect(updateSql).toMatch(/submitted_at = NOW\(\)/);
  });

  it('throws conflict when trying to resubmit an evaluated submission', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: STUDENT_ID }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: ASSIGNMENT_ID, subject_id: SUBJECT_ID, due_date: FUTURE_DUE, faculty_id: FACULTY_ID }],
      rowCount: 1,
    } as never);
    mockQuery.mockResolvedValueOnce({ rows: [{ program_id: 'prog-1', semester: 3 }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [{ id: SUBJECT_ID }], rowCount: 1 } as never);
    // Existing submission with Evaluated status
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: SUBMISSION_ID, status: 'Evaluated', file_path: '/uploads/lms/old.pdf' }],
      rowCount: 1,
    } as never);

    await expect(
      submissionService.submitAssignment(STUDENT_USER_ID, ASSIGNMENT_ID, mockFile)
    ).rejects.toMatchObject({ statusCode: 409, code: 'ALREADY_EVALUATED' });
  });

  it('throws 403 when student is not enrolled in the assignment subject', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: STUDENT_ID }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: ASSIGNMENT_ID, subject_id: SUBJECT_ID, due_date: FUTURE_DUE, faculty_id: FACULTY_ID }],
      rowCount: 1,
    } as never);
    mockQuery.mockResolvedValueOnce({ rows: [{ program_id: 'prog-2', semester: 5 }], rowCount: 1 } as never);
    // enrollment check → not enrolled
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await expect(
      submissionService.submitAssignment(STUDENT_USER_ID, ASSIGNMENT_ID, mockFile)
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws 404 when assignment does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: STUDENT_ID }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await expect(
      submissionService.submitAssignment(STUDENT_USER_ID, ASSIGNMENT_ID, mockFile)
    ).rejects.toMatchObject({ statusCode: 404, message: 'Assignment not found' });
  });
});

// ── listSubmissions ────────────────────────────────────────────────────────────

describe('listSubmissions', () => {
  beforeEach(resetMocks);

  it('admin receives all submissions without role filter', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...mockSubmissionRow, total_count: '1' }],
      rowCount: 1,
    } as never);

    const result = await submissionService.listSubmissions('admin-id', 'admin', { page: 1, limit: 20 });

    expect(result.total).toBe(1);
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).not.toMatch(/faculty_id\s*=\s*\$/);
    expect(sql).not.toMatch(/student_id\s*=\s*\$/);
  });

  it('faculty query includes a.faculty_id filter', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: FACULTY_ID }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await submissionService.listSubmissions(FACULTY_USER_ID, 'faculty', { page: 1, limit: 20 });

    const listSql = mockQuery.mock.calls[1][0] as string;
    expect(listSql).toMatch(/a\.faculty_id\s*=\s*\$/);
  });

  it('student query restricts to their own student_id', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: STUDENT_ID }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await submissionService.listSubmissions(STUDENT_USER_ID, 'student', { page: 1, limit: 20 });

    const listSql = mockQuery.mock.calls[1][0] as string;
    const listParams = mockQuery.mock.calls[1][1] as unknown[];
    expect(listSql).toMatch(/asub\.student_id\s*=\s*\$/);
    expect(listParams).toContain(STUDENT_ID);
  });

  it('accepts assignmentId and status filters', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await submissionService.listSubmissions('admin-id', 'admin', {
      page: 1, limit: 20,
      assignmentId: ASSIGNMENT_ID,
      status: 'Evaluated',
    });

    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/assignment_id\s*=\s*\$/);
    expect(sql).toMatch(/status\s*=\s*\$/);
    expect(params).toContain(ASSIGNMENT_ID);
    expect(params).toContain('Evaluated');
  });
});

// ── getSubmissionById ──────────────────────────────────────────────────────────

describe('getSubmissionById', () => {
  beforeEach(resetMocks);

  it('returns submission for admin with one query', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockSubmissionRow], rowCount: 1 } as never);

    const result = await submissionService.getSubmissionById('admin-id', 'admin', SUBMISSION_ID);

    expect(result.id).toBe(SUBMISSION_ID);
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('throws 404 when submission not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await expect(
      submissionService.getSubmissionById('admin-id', 'admin', SUBMISSION_ID)
    ).rejects.toMatchObject({ statusCode: 404, message: 'Submission not found' });
  });

  it('throws 403 when student tries to access another student submission', async () => {
    const otherStudentRow = { ...mockSubmissionRow, student_id: 'other-student-id' };
    mockQuery.mockResolvedValueOnce({ rows: [otherStudentRow], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [{ id: STUDENT_ID }], rowCount: 1 } as never);

    await expect(
      submissionService.getSubmissionById(STUDENT_USER_ID, 'student', SUBMISSION_ID)
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws 403 when faculty tries to access submission for another faculty assignment', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockSubmissionRow], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'other-faculty-id' }], rowCount: 1 } as never);
    // assignment.faculty_id = FACULTY_ID, resolved faculty = other-faculty-id → mismatch
    mockQuery.mockResolvedValueOnce({ rows: [{ faculty_id: FACULTY_ID }], rowCount: 1 } as never);

    await expect(
      submissionService.getSubmissionById(FACULTY_USER_ID, 'faculty', SUBMISSION_ID)
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

// ── gradeSubmission ────────────────────────────────────────────────────────────

describe('gradeSubmission', () => {
  beforeEach(resetMocks);

  it('grades submission with marks and feedback, sets status to Evaluated', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: FACULTY_ID }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [mockSubmissionRow], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({
      rows: [{ faculty_id: FACULTY_ID, max_marks: '20' }],
      rowCount: 1,
    } as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...mockSubmissionRow, status: 'Evaluated', marks: '18', feedback: 'Good work' }],
      rowCount: 1,
    } as never);

    const result = await submissionService.gradeSubmission(
      FACULTY_USER_ID,
      SUBMISSION_ID,
      { marks: 18, feedback: 'Good work' }
    );

    const updateSql = mockQuery.mock.calls[3][0] as string;
    expect(updateSql).toMatch(/status = 'Evaluated'/);
    expect(result.status).toBe('Evaluated');
    expect(result.marks).toBe(18);
  });

  it('throws 400 when marks exceed assignment max_marks', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: FACULTY_ID }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [mockSubmissionRow], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({
      rows: [{ faculty_id: FACULTY_ID, max_marks: '20' }],
      rowCount: 1,
    } as never);

    await expect(
      submissionService.gradeSubmission(FACULTY_USER_ID, SUBMISSION_ID, { marks: 25 })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 403 when faculty does not own the assignment', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'other-faculty' }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [mockSubmissionRow], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({
      rows: [{ faculty_id: FACULTY_ID, max_marks: '20' }],
      rowCount: 1,
    } as never);

    await expect(
      submissionService.gradeSubmission(FACULTY_USER_ID, SUBMISSION_ID, { marks: 15 })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws 404 when submission not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: FACULTY_ID }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await expect(
      submissionService.gradeSubmission(FACULTY_USER_ID, SUBMISSION_ID, { marks: 10 })
    ).rejects.toMatchObject({ statusCode: 404, message: 'Submission not found' });
  });
});
