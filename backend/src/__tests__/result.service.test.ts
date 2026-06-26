import {
  getResultById,
  listResults,
  getRoster,
  getStudentResults,
  bulkSubmitResults,
  updateResult,
  publishResults,
  deleteResult,
} from '../services/result.service';
import { computeGrade, computeResultStatus } from '../config/grading';

// ── Database mock ──────────────────────────────────────────────────────────────

const mockQuery = jest.fn();
const mockWithTransaction = jest.fn();

jest.mock('../config/database', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  withTransaction: (...args: unknown[]) => mockWithTransaction(...args),
}));

// ── Dependency mocks ──────────────────────────────────────────────────────────

const mockIsFacultyAssigned = jest.fn();

jest.mock('../services/assignment.service', () => ({
  isFacultyAssigned: (...args: unknown[]) => mockIsFacultyAssigned(...args),
}));

jest.mock('../utils/audit', () => ({
  auditLog: jest.fn().mockResolvedValue(undefined),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const RESULT_ROW = {
  id: 'result-uuid-1',
  student_id: 'stu-uuid-1',
  student_name: 'John Doe',
  roll_number: 'CSE2024001',
  subject_id: 'sub-uuid-1',
  subject_code: 'CS101',
  subject_name: 'Data Structures',
  department_name: 'Computer Science',
  faculty_id: 'fac-uuid-1',
  faculty_name: 'Dr. Jane',
  exam_id: null,
  semester: 3,
  section: 'A',
  internal_marks: '25.00',
  internal_max_marks: '30.00',
  external_marks: '60.00',
  external_max_marks: '70.00',
  total_marks: '85.00',
  grade: 'A+',
  result_status: 'Pass',
  publication_status: 'Draft',
  published_at: null,
  remarks: null,
  created_at: new Date('2026-06-01'),
  updated_at: new Date('2026-06-01'),
};

const RESULT_LIST_ROW = { ...RESULT_ROW, total_count: '10' };

// ── Grading computation (pure, no DB) ─────────────────────────────────────────

describe('computeGrade', () => {
  it('returns O for 95%', () => expect(computeGrade(95, 100)).toBe('O'));
  it('returns A+ for 85%', () => expect(computeGrade(85, 100)).toBe('A+'));
  it('returns A for 75%', () => expect(computeGrade(75, 100)).toBe('A'));
  it('returns B+ for 65%', () => expect(computeGrade(65, 100)).toBe('B+'));
  it('returns B for 57%', () => expect(computeGrade(57, 100)).toBe('B'));
  it('returns C for 50%', () => expect(computeGrade(50, 100)).toBe('C'));
  it('returns F for 49%', () => expect(computeGrade(49, 100)).toBe('F'));
  it('returns F when maximum is 0', () => expect(computeGrade(10, 0)).toBe('F'));
  it('returns F for negative obtained', () => expect(computeGrade(-1, 100)).toBe('F'));
});

describe('computeResultStatus', () => {
  it('returns Absent when isAbsent=true regardless of grade', () => {
    expect(computeResultStatus('O', true)).toBe('Absent');
    expect(computeResultStatus('F', true)).toBe('Absent');
  });
  it('returns Pass for passing grades', () => {
    (['O', 'A+', 'A', 'B+', 'B', 'C'] as const).forEach((g) =>
      expect(computeResultStatus(g, false)).toBe('Pass')
    );
  });
  it('returns Fail for grade F', () => expect(computeResultStatus('F', false)).toBe('Fail'));
});

// ── getResultById ─────────────────────────────────────────────────────────────

describe('getResultById', () => {
  it('returns mapped ResultDetail for a found result', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [RESULT_ROW] });
    const result = await getResultById('result-uuid-1');
    expect(result.id).toBe('result-uuid-1');
    expect(result.totalMarks).toBe(85);
    expect(result.grade).toBe('A+');
    expect(result.resultStatus).toBe('Pass');
    expect(result.semester).toBe(3);
  });

  it('throws 404 when result not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(getResultById('missing')).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── listResults ───────────────────────────────────────────────────────────────

describe('listResults', () => {
  const base = { page: 1, limit: 20 };

  it('returns paginated results without filters', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [RESULT_LIST_ROW] });
    const result = await listResults(base);
    expect(result.results).toHaveLength(1);
    expect(result.pagination.total).toBe(10);
  });

  it('returns empty when no results match', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const result = await listResults(base);
    expect(result.results).toHaveLength(0);
    expect(result.pagination.total).toBe(0);
  });

  it('applies facultyId filter', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await listResults({ ...base, facultyId: 'fac-uuid-1' });
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('r.faculty_id =');
  });

  it('applies semester and section filters', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await listResults({ ...base, semester: 3, section: 'A' });
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('r.semester =');
    expect(sql).toContain('r.section =');
  });

  it('applies publicationStatus filter', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await listResults({ ...base, publicationStatus: 'Published' });
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('r.publication_status =');
  });

  it('applies grade filter', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await listResults({ ...base, grade: 'O' });
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('r.grade =');
  });
});

// ── getRoster ─────────────────────────────────────────────────────────────────

describe('getRoster', () => {
  it('returns roster pre-populated with existing results', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ program_id: 'prog-1', semester: 3 }] }) // subject lookup
      .mockResolvedValueOnce({
        rows: [
          {
            student_id: 'stu-1', roll_number: 'CSE001', full_name: 'John',
            section: 'A', result_id: 'result-1',
            internal_marks: '25.00', internal_max_marks: '30.00',
            external_marks: '60.00', external_max_marks: '70.00',
            total_marks: '85.00', grade: 'A+', result_status: 'Pass',
            publication_status: 'Draft', remarks: null,
          },
        ],
      });

    const roster = await getRoster('sub-uuid-1', 'A', 'faculty-user');
    expect(roster).toHaveLength(1);
    expect(roster[0].totalMarks).toBe(85);
    expect(roster[0].grade).toBe('A+');
  });

  it('returns roster with null result fields for students without a result', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ program_id: 'prog-1', semester: 3 }] })
      .mockResolvedValueOnce({
        rows: [
          {
            student_id: 'stu-2', roll_number: 'CSE002', full_name: 'Jane',
            section: 'A', result_id: null,
            internal_marks: null, internal_max_marks: null,
            external_marks: null, external_max_marks: null,
            total_marks: null, grade: null, result_status: null,
            publication_status: null, remarks: null,
          },
        ],
      });

    const roster = await getRoster('sub-uuid-1', 'A', 'faculty-user');
    expect(roster[0].resultId).toBeNull();
    expect(roster[0].totalMarks).toBeNull();
  });

  it('throws 404 when subject not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(getRoster('missing-sub', 'A', 'fac-user')).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── getStudentResults ─────────────────────────────────────────────────────────

describe('getStudentResults', () => {
  it('returns Published results for the student', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        result_id: 'r1', subject_id: 'sub-1', subject_code: 'CS101',
        subject_name: 'DS', semester: 3,
        internal_marks: '25.00', internal_max_marks: '30.00',
        external_marks: '60.00', external_max_marks: '70.00',
        total_marks: '85.00', grade: 'A+', result_status: 'Pass',
        published_at: new Date('2026-07-01'),
      }],
    });

    const results = await getStudentResults('user-uuid-1');
    expect(results).toHaveLength(1);
    expect(results[0].grade).toBe('A+');

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain("publication_status = 'Published'");
  });

  it('applies optional semester filter', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await getStudentResults('user-uuid-1', 3);
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('r.semester =');
  });

  it('returns empty array when student has no published results', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const results = await getStudentResults('user-uuid-1');
    expect(results).toHaveLength(0);
  });
});

// ── bulkSubmitResults ─────────────────────────────────────────────────────────

describe('bulkSubmitResults', () => {
  const BASE_DATA = {
    subjectId: 'sub-uuid-1',
    section: 'A',
    internalMaxMarks: 30,
    externalMaxMarks: 70,
    records: [
      { studentId: 'stu-1', internalMarks: 25, externalMarks: 60, isAbsent: false },
    ],
  };

  const mockClient = {
    query: jest.fn(),
  };

  beforeEach(() => {
    mockWithTransaction.mockImplementation(async (fn: (client: typeof mockClient) => Promise<void>) =>
      fn(mockClient)
    );
  });

  it('submits results and computes grade A+ for 85%', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'fac-uuid-1' }] })     // resolveFacultyId
      .mockResolvedValueOnce({ rows: [{ id: 'sub-uuid-1', semester: 3 }] }) // subject
      .mockResolvedValueOnce({ rows: [] });                          // published check

    const now = new Date();
    mockClient.query.mockResolvedValueOnce({
      rows: [{ created_at: now, updated_at: now }],
    });

    mockIsFacultyAssigned.mockResolvedValueOnce(true);

    const result = await bulkSubmitResults(BASE_DATA, 'faculty-user');
    expect(result.inserted).toBe(1);
    expect(result.updated).toBe(0);

    // Verify grade was computed and passed to insert
    const insertCall = mockClient.query.mock.calls[0];
    const params = insertCall[1] as unknown[];
    expect(params).toContain('A+'); // grade
    expect(params).toContain('Pass'); // result_status
    expect(params).toContain(85); // totalMarks = 25 + 60
  });

  it('records existing row as updated when timestamps differ', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'fac-uuid-1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'sub-uuid-1', semester: 3 }] })
      .mockResolvedValueOnce({ rows: [] });

    const createdAt = new Date('2026-06-01T10:00:00Z');
    const updatedAt = new Date('2026-06-05T12:00:00Z');
    mockClient.query.mockResolvedValueOnce({ rows: [{ created_at: createdAt, updated_at: updatedAt }] });

    mockIsFacultyAssigned.mockResolvedValueOnce(true);

    const result = await bulkSubmitResults(BASE_DATA, 'faculty-user');
    expect(result.inserted).toBe(0);
    expect(result.updated).toBe(1);
  });

  it('sets grade=F and status=Absent for absent students', async () => {
    const absentData = {
      ...BASE_DATA,
      records: [{ studentId: 'stu-1', internalMarks: 20, externalMarks: 0, isAbsent: true }],
    };

    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'fac-uuid-1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'sub-uuid-1', semester: 3 }] })
      .mockResolvedValueOnce({ rows: [] });

    const now = new Date();
    mockClient.query.mockResolvedValueOnce({ rows: [{ created_at: now, updated_at: now }] });
    mockIsFacultyAssigned.mockResolvedValueOnce(true);

    await bulkSubmitResults(absentData, 'faculty-user');

    const params = mockClient.query.mock.calls[0][1] as unknown[];
    expect(params).toContain('F');
    expect(params).toContain('Absent');
    expect(params).toContain(0); // effectiveExternalMarks forced to 0
  });

  it('throws 403 when faculty is not assigned to the subject', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'fac-uuid-1' }] });
    mockIsFacultyAssigned.mockResolvedValueOnce(false);

    await expect(bulkSubmitResults(BASE_DATA, 'faculty-user')).rejects.toMatchObject({
      statusCode: 403,
      code: 'NOT_ASSIGNED',
    });
  });

  it('throws 400 when any target student has a Published result', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'fac-uuid-1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'sub-uuid-1', semester: 3 }] })
      .mockResolvedValueOnce({ rows: [{ student_id: 'stu-1' }] }); // published check returns hit

    mockIsFacultyAssigned.mockResolvedValueOnce(true);

    await expect(bulkSubmitResults(BASE_DATA, 'faculty-user')).rejects.toMatchObject({
      statusCode: 400,
      code: 'RESULTS_ALREADY_PUBLISHED',
    });
  });

  it('throws 404 when subject is not found', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'fac-uuid-1' }] })
      .mockResolvedValueOnce({ rows: [] }); // subject not found

    mockIsFacultyAssigned.mockResolvedValueOnce(true);

    await expect(bulkSubmitResults(BASE_DATA, 'faculty-user')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

// ── updateResult ──────────────────────────────────────────────────────────────

describe('updateResult', () => {
  const CURRENT_ROW = {
    faculty_id: 'fac-uuid-1',
    publication_status: 'Draft',
    internal_marks: '25.00',
    internal_max_marks: '30.00',
    external_marks: '60.00',
    external_max_marks: '70.00',
    result_status: 'Pass',
  };

  it('admin updates externalMarks and grade is recomputed', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [CURRENT_ROW] })               // fetch
      .mockResolvedValueOnce({ rows: [] })                           // UPDATE
      .mockResolvedValueOnce({ rows: [{ ...RESULT_ROW, external_marks: '63.00', total_marks: '88.00', grade: 'A+' }] }); // getResultById

    const result = await updateResult('result-uuid-1', { externalMarks: 63 }, 'admin-user', 'admin');
    expect(result.grade).toBe('A+');
  });

  it('sets grade=F and status=Absent when isAbsent=true', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [CURRENT_ROW] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...RESULT_ROW, external_marks: '0.00', total_marks: '25.00', grade: 'F', result_status: 'Absent' }] });

    const result = await updateResult('result-uuid-1', { isAbsent: true }, 'admin-user', 'admin');
    expect(result.resultStatus).toBe('Absent');
    expect(result.grade).toBe('F');
  });

  it('throws 400 when internalMarks exceeds internalMaxMarks', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [CURRENT_ROW] });

    await expect(
      updateResult('result-uuid-1', { internalMarks: 35 }, 'admin-user', 'admin')
    ).rejects.toMatchObject({ statusCode: 400, code: 'INTERNAL_MARKS_EXCEED_MAX' });
  });

  it('throws 403 when faculty updates a result they did not submit', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ ...CURRENT_ROW, faculty_id: 'other-fac' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'fac-uuid-1' }] }); // resolveFacultyId

    await expect(
      updateResult('result-uuid-1', { externalMarks: 55 }, 'faculty-user', 'faculty')
    ).rejects.toMatchObject({ statusCode: 403, code: 'NOT_RESULT_OWNER' });
  });

  it('throws 403 when faculty tries to update a Published result', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ ...CURRENT_ROW, publication_status: 'Published' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'fac-uuid-1' }] }); // resolveFacultyId

    await expect(
      updateResult('result-uuid-1', { externalMarks: 55 }, 'faculty-user', 'faculty')
    ).rejects.toMatchObject({ statusCode: 403, code: 'RESULT_ALREADY_PUBLISHED' });
  });

  it('throws 404 when result does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(
      updateResult('missing', { externalMarks: 60 }, 'admin-user', 'admin')
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── publishResults ────────────────────────────────────────────────────────────

describe('publishResults', () => {
  it('publishes all Draft results for a subject+section', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }] });

    const result = await publishResults({ subjectId: 'sub-uuid-1', section: 'A' }, 'admin-user');
    expect(result.published).toBe(3);

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain("publication_status = 'Published'");
    expect(sql).toContain("publication_status  = 'Draft'");
  });

  it('returns 0 when no Draft results exist for the criteria', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const result = await publishResults({ subjectId: 'sub-uuid-1', section: 'B' }, 'admin-user');
    expect(result.published).toBe(0);
  });
});

// ── deleteResult ──────────────────────────────────────────────────────────────

describe('deleteResult', () => {
  it('soft-deletes an existing result', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'result-uuid-1' }] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(deleteResult('result-uuid-1', 'admin-user')).resolves.toBeUndefined();
  });

  it('throws 404 when result does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(deleteResult('missing', 'admin-user')).rejects.toMatchObject({ statusCode: 404 });
  });
});
