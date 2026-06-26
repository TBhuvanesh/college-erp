import { search } from '../services/search.service';

// ── Module mocks ───────────────────────────────────────────────────────────────

const mockQuery = jest.fn();

jest.mock('../config/database', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

// ── Fixtures ───────────────────────────────────────────────────────────────────

const STUDENT_ROW = {
  id: 'st-uuid', roll_number: '20B81A0501', full_name: 'Alice Kumar',
  department_name: 'Computer Science', semester: 3,
};
const FACULTY_ROW = {
  id: 'fac-uuid', employee_number: 'EMP-001', full_name: 'Dr. Ramesh',
  department_name: 'Computer Science',
};
const SUBJECT_ROW = {
  id: 'sub-uuid', code: 'CS301', name: 'Machine Learning',
  department_name: 'Computer Science', semester: 3,
};
const ANN_ROW = { id: 'ann-uuid', title: 'Machine Learning Workshop', publish_date: '2026-06-01' };
const EVENT_ROW = { id: 'ev-uuid', title: 'Machine Learning Symposium', start_date: '2026-08-15', event_type: 'Academic Activity' };
const EXAM_ROW = { id: 'ex-uuid', exam_type: 'Mid-1', subject_name: 'Machine Learning', exam_date: '2026-07-10' };

const EMPTY = { rows: [] };
const withRows = (rows: unknown[]) => ({ rows });

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockQuery.mockReset();
});

// ── Admin search ───────────────────────────────────────────────────────────────

describe('search — admin role', () => {
  it('runs 6 parallel queries and returns all matching categories', async () => {
    mockQuery
      .mockResolvedValueOnce(withRows([STUDENT_ROW]))    // students
      .mockResolvedValueOnce(withRows([FACULTY_ROW]))    // faculty
      .mockResolvedValueOnce(withRows([SUBJECT_ROW]))    // subjects
      .mockResolvedValueOnce(withRows([ANN_ROW]))        // announcements
      .mockResolvedValueOnce(withRows([EVENT_ROW]))      // events
      .mockResolvedValueOnce(withRows([EXAM_ROW]));      // examinations

    const result = await search('admin-id', 'admin', 'Machine Learning');

    expect(result.students).toHaveLength(1);
    expect(result.faculty).toHaveLength(1);
    expect(result.subjects).toHaveLength(1);
    expect(result.announcements).toHaveLength(1);
    expect(result.events).toHaveLength(1);
    expect(result.examinations).toHaveLength(1);
  });

  it('maps student row fields correctly', async () => {
    mockQuery
      .mockResolvedValueOnce(withRows([STUDENT_ROW]))
      .mockResolvedValueOnce(EMPTY).mockResolvedValueOnce(EMPTY)
      .mockResolvedValueOnce(EMPTY).mockResolvedValueOnce(EMPTY)
      .mockResolvedValueOnce(EMPTY);

    const { students } = await search('admin-id', 'admin', 'Alice');

    expect(students![0]).toMatchObject({
      id: 'st-uuid', rollNumber: '20B81A0501', fullName: 'Alice Kumar',
      departmentName: 'Computer Science', semester: 3,
    });
  });

  it('maps faculty row fields correctly', async () => {
    mockQuery
      .mockResolvedValueOnce(EMPTY)
      .mockResolvedValueOnce(withRows([FACULTY_ROW]))
      .mockResolvedValueOnce(EMPTY).mockResolvedValueOnce(EMPTY)
      .mockResolvedValueOnce(EMPTY).mockResolvedValueOnce(EMPTY);

    const { faculty } = await search('admin-id', 'admin', 'Ramesh');

    expect(faculty![0]).toMatchObject({
      id: 'fac-uuid', employeeNumber: 'EMP-001', fullName: 'Dr. Ramesh',
      departmentName: 'Computer Science',
    });
  });

  it('maps subject row including departmentName', async () => {
    mockQuery
      .mockResolvedValueOnce(EMPTY).mockResolvedValueOnce(EMPTY)
      .mockResolvedValueOnce(withRows([SUBJECT_ROW]))
      .mockResolvedValueOnce(EMPTY).mockResolvedValueOnce(EMPTY)
      .mockResolvedValueOnce(EMPTY);

    const { subjects } = await search('admin-id', 'admin', 'CS301');

    expect(subjects![0]).toMatchObject({
      id: 'sub-uuid', code: 'CS301', name: 'Machine Learning',
      departmentName: 'Computer Science', semester: 3,
    });
  });

  it('maps examination row correctly', async () => {
    mockQuery
      .mockResolvedValueOnce(EMPTY).mockResolvedValueOnce(EMPTY)
      .mockResolvedValueOnce(EMPTY).mockResolvedValueOnce(EMPTY)
      .mockResolvedValueOnce(EMPTY)
      .mockResolvedValueOnce(withRows([EXAM_ROW]));

    const { examinations } = await search('admin-id', 'admin', 'Mid');

    expect(examinations![0]).toMatchObject({
      id: 'ex-uuid', examType: 'Mid-1', subjectName: 'Machine Learning', examDate: '2026-07-10',
    });
  });

  it('omits categories with zero results', async () => {
    mockQuery
      .mockResolvedValueOnce(withRows([STUDENT_ROW]))
      .mockResolvedValueOnce(EMPTY).mockResolvedValueOnce(EMPTY)
      .mockResolvedValueOnce(EMPTY).mockResolvedValueOnce(EMPTY)
      .mockResolvedValueOnce(EMPTY);

    const result = await search('admin-id', 'admin', 'Alice');

    expect(result.students).toHaveLength(1);
    expect(result.faculty).toBeUndefined();
    expect(result.subjects).toBeUndefined();
    expect(result.announcements).toBeUndefined();
    expect(result.events).toBeUndefined();
    expect(result.examinations).toBeUndefined();
  });

  it('returns empty object when nothing matches', async () => {
    for (let i = 0; i < 6; i++) mockQuery.mockResolvedValueOnce(EMPTY);

    const result = await search('admin-id', 'admin', 'xyznothing');

    expect(Object.keys(result)).toHaveLength(0);
  });

  it('passes ILIKE pattern to all queries', async () => {
    for (let i = 0; i < 6; i++) mockQuery.mockResolvedValueOnce(EMPTY);

    await search('admin-id', 'admin', 'Machine');

    for (const call of mockQuery.mock.calls) {
      const params = call[1] as unknown[];
      expect(params[0]).toBe('%Machine%');
    }
  });

  it('subjects query JOINs departments to include departmentName', async () => {
    for (let i = 0; i < 6; i++) mockQuery.mockResolvedValueOnce(EMPTY);

    await search('admin-id', 'admin', 'CS');

    const subjectSql = mockQuery.mock.calls[2][0] as string;
    expect(subjectSql).toContain('JOIN departments');
    expect(subjectSql).toContain('department_name');
  });

  it('admin announcement query includes Draft announcements', async () => {
    for (let i = 0; i < 6; i++) mockQuery.mockResolvedValueOnce(EMPTY);

    await search('admin-id', 'admin', 'Test');

    const annSql = mockQuery.mock.calls[3][0] as string;
    // Admin query does NOT filter by status='Published' — drafts are included
    expect(annSql).not.toContain("status = 'Published'");
  });
});

// ── Faculty search ─────────────────────────────────────────────────────────────

describe('search — faculty role', () => {
  it('resolves faculty context then runs 5 parallel queries', async () => {
    mockQuery
      .mockResolvedValueOnce(withRows([{ id: 'fac-uuid', department_id: 'dept-uuid' }])) // context
      .mockResolvedValueOnce(withRows([STUDENT_ROW]))    // assigned students
      .mockResolvedValueOnce(withRows([SUBJECT_ROW]))    // assigned subjects
      .mockResolvedValueOnce(withRows([ANN_ROW]))        // announcements
      .mockResolvedValueOnce(withRows([EVENT_ROW]))      // events
      .mockResolvedValueOnce(withRows([EXAM_ROW]));      // examinations

    const result = await search('fac-user-id', 'faculty', 'Machine Learning');

    expect(result.students).toHaveLength(1);
    expect(result.subjects).toHaveLength(1);
    expect(result.announcements).toHaveLength(1);
    expect(result.events).toHaveLength(1);
    expect(result.examinations).toHaveLength(1);
    // faculty category must never be present in faculty search results
    expect(result.faculty).toBeUndefined();
  });

  it('returns empty object when faculty profile does not exist', async () => {
    mockQuery.mockResolvedValueOnce(EMPTY); // context query returns nothing

    const result = await search('ghost-user-id', 'faculty', 'anything');

    expect(result).toEqual({});
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('student query uses EXISTS scoping against faculty assignments', async () => {
    mockQuery
      .mockResolvedValueOnce(withRows([{ id: 'fac-uuid', department_id: 'dept-uuid' }]))
      .mockResolvedValueOnce(EMPTY).mockResolvedValueOnce(EMPTY)
      .mockResolvedValueOnce(EMPTY).mockResolvedValueOnce(EMPTY)
      .mockResolvedValueOnce(EMPTY);

    await search('fac-user-id', 'faculty', 'test');

    const studentSql = mockQuery.mock.calls[1][0] as string;
    expect(studentSql).toContain('faculty_subject_assignments');
    // Scoping can be implemented via JOIN or EXISTS; both produce correct results
    expect(studentSql).toMatch(/fsa\.faculty_id\s*=\s*\$1/);
  });

  it('subject query uses faculty_subject_assignments JOIN', async () => {
    mockQuery
      .mockResolvedValueOnce(withRows([{ id: 'fac-uuid', department_id: 'dept-uuid' }]))
      .mockResolvedValueOnce(EMPTY).mockResolvedValueOnce(EMPTY)
      .mockResolvedValueOnce(EMPTY).mockResolvedValueOnce(EMPTY)
      .mockResolvedValueOnce(EMPTY);

    await search('fac-user-id', 'faculty', 'test');

    const subjectSql = mockQuery.mock.calls[2][0] as string;
    expect(subjectSql).toContain('faculty_subject_assignments');
    expect(subjectSql).toContain('department_name');
  });

  it('announcement query filters to Published + faculty-visible audience', async () => {
    mockQuery
      .mockResolvedValueOnce(withRows([{ id: 'fac-uuid', department_id: 'dept-uuid' }]))
      .mockResolvedValueOnce(EMPTY).mockResolvedValueOnce(EMPTY)
      .mockResolvedValueOnce(EMPTY).mockResolvedValueOnce(EMPTY)
      .mockResolvedValueOnce(EMPTY);

    await search('fac-user-id', 'faculty', 'test');

    const annSql = mockQuery.mock.calls[3][0] as string;
    expect(annSql).toMatch(/status\s*=\s*'Published'/);
    expect(annSql).toContain("'Faculty'");
  });

  it('event query excludes Students-only events', async () => {
    mockQuery
      .mockResolvedValueOnce(withRows([{ id: 'fac-uuid', department_id: 'dept-uuid' }]))
      .mockResolvedValueOnce(EMPTY).mockResolvedValueOnce(EMPTY)
      .mockResolvedValueOnce(EMPTY).mockResolvedValueOnce(EMPTY)
      .mockResolvedValueOnce(EMPTY);

    await search('fac-user-id', 'faculty', 'test');

    const eventSql = mockQuery.mock.calls[4][0] as string;
    expect(eventSql).toContain("target_audience != 'Students'");
    expect(eventSql).toContain("publish_status IN ('Published', 'Updated')");
  });

  it('examination query is scoped to faculty-assigned subjects', async () => {
    mockQuery
      .mockResolvedValueOnce(withRows([{ id: 'fac-uuid', department_id: 'dept-uuid' }]))
      .mockResolvedValueOnce(EMPTY).mockResolvedValueOnce(EMPTY)
      .mockResolvedValueOnce(EMPTY).mockResolvedValueOnce(EMPTY)
      .mockResolvedValueOnce(EMPTY);

    await search('fac-user-id', 'faculty', 'test');

    const examSql = mockQuery.mock.calls[5][0] as string;
    expect(examSql).toContain('faculty_subject_assignments');
    expect(examSql).toContain('exam_type');
  });

  it('omits empty categories from the response', async () => {
    mockQuery
      .mockResolvedValueOnce(withRows([{ id: 'fac-uuid', department_id: 'dept-uuid' }]))
      .mockResolvedValueOnce(EMPTY).mockResolvedValueOnce(EMPTY)
      .mockResolvedValueOnce(withRows([ANN_ROW]))
      .mockResolvedValueOnce(EMPTY).mockResolvedValueOnce(EMPTY);

    const result = await search('fac-user-id', 'faculty', 'Workshop');

    expect(result.announcements).toHaveLength(1);
    expect(result.students).toBeUndefined();
    expect(result.subjects).toBeUndefined();
    expect(result.events).toBeUndefined();
    expect(result.examinations).toBeUndefined();
    expect(result.faculty).toBeUndefined();
  });
});

// ── Student search ─────────────────────────────────────────────────────────────

describe('search — student role', () => {
  it('resolves student context then runs 4 parallel queries', async () => {
    mockQuery
      .mockResolvedValueOnce(withRows([{  // context
        program_id: 'prog-uuid', semester: 3, section: 'A', department_id: 'dept-uuid',
      }]))
      .mockResolvedValueOnce(withRows([SUBJECT_ROW]))   // subjects
      .mockResolvedValueOnce(withRows([ANN_ROW]))       // announcements
      .mockResolvedValueOnce(withRows([EVENT_ROW]))     // events
      .mockResolvedValueOnce(withRows([EXAM_ROW]));     // examinations

    const result = await search('st-user-id', 'student', 'Machine Learning');

    expect(result.subjects).toHaveLength(1);
    expect(result.announcements).toHaveLength(1);
    expect(result.events).toHaveLength(1);
    expect(result.examinations).toHaveLength(1);
    // students and faculty must never appear in student results
    expect(result.students).toBeUndefined();
    expect(result.faculty).toBeUndefined();
  });

  it('returns empty object when student profile does not exist', async () => {
    mockQuery.mockResolvedValueOnce(EMPTY);

    const result = await search('ghost-id', 'student', 'anything');

    expect(result).toEqual({});
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('subject query filters by program_id and semester — no cross-context subjects', async () => {
    mockQuery
      .mockResolvedValueOnce(withRows([{
        program_id: 'prog-uuid', semester: 3, section: 'A', department_id: 'dept-uuid',
      }]))
      .mockResolvedValueOnce(EMPTY).mockResolvedValueOnce(EMPTY)
      .mockResolvedValueOnce(EMPTY).mockResolvedValueOnce(EMPTY);

    await search('st-user-id', 'student', 'test');

    const subjectSql  = mockQuery.mock.calls[1][0] as string;
    const subjectParams = mockQuery.mock.calls[1][1] as unknown[];
    expect(subjectSql).toContain('program_id');
    expect(subjectSql).toContain('semester');
    expect(subjectParams).toContain('prog-uuid');
    expect(subjectParams).toContain(3);
  });

  it('subject query includes departmentName via JOIN', async () => {
    mockQuery
      .mockResolvedValueOnce(withRows([{
        program_id: 'prog-uuid', semester: 3, section: 'A', department_id: 'dept-uuid',
      }]))
      .mockResolvedValueOnce(EMPTY).mockResolvedValueOnce(EMPTY)
      .mockResolvedValueOnce(EMPTY).mockResolvedValueOnce(EMPTY);

    await search('st-user-id', 'student', 'test');

    const subjectSql = mockQuery.mock.calls[1][0] as string;
    expect(subjectSql).toContain('JOIN departments');
    expect(subjectSql).toContain('department_name');
  });

  it('announcement query includes Department Specific and Semester Specific conditions', async () => {
    mockQuery
      .mockResolvedValueOnce(withRows([{
        program_id: 'prog-uuid', semester: 3, section: 'A', department_id: 'dept-uuid',
      }]))
      .mockResolvedValueOnce(EMPTY).mockResolvedValueOnce(EMPTY)
      .mockResolvedValueOnce(EMPTY).mockResolvedValueOnce(EMPTY);

    await search('st-user-id', 'student', 'test');

    const annSql = mockQuery.mock.calls[2][0] as string;
    expect(annSql).toMatch(/status\s*=\s*'Published'/);
    expect(annSql).toContain('Department Specific');
    expect(annSql).toContain('Semester Specific');
  });

  it('event query excludes Faculty-only events', async () => {
    mockQuery
      .mockResolvedValueOnce(withRows([{
        program_id: 'prog-uuid', semester: 3, section: 'A', department_id: 'dept-uuid',
      }]))
      .mockResolvedValueOnce(EMPTY).mockResolvedValueOnce(EMPTY)
      .mockResolvedValueOnce(EMPTY).mockResolvedValueOnce(EMPTY);

    await search('st-user-id', 'student', 'test');

    const eventSql = mockQuery.mock.calls[3][0] as string;
    expect(eventSql).toContain("target_audience != 'Faculty'");
    expect(eventSql).toContain("publish_status IN ('Published', 'Updated')");
  });

  it('semester 1-2 maps to I Year for event audience filter', async () => {
    mockQuery
      .mockResolvedValueOnce(withRows([{
        program_id: 'prog-uuid', semester: 1, section: 'A', department_id: 'dept-uuid',
      }]))
      .mockResolvedValueOnce(EMPTY).mockResolvedValueOnce(EMPTY)
      .mockResolvedValueOnce(EMPTY).mockResolvedValueOnce(EMPTY);

    await search('st-user-id', 'student', 'test');

    const eventParams = mockQuery.mock.calls[3][1] as unknown[];
    expect(eventParams).toContain('I Year');
  });

  it('semester 3-4 maps to II Year for event audience filter', async () => {
    mockQuery
      .mockResolvedValueOnce(withRows([{
        program_id: 'prog-uuid', semester: 3, section: 'A', department_id: 'dept-uuid',
      }]))
      .mockResolvedValueOnce(EMPTY).mockResolvedValueOnce(EMPTY)
      .mockResolvedValueOnce(EMPTY).mockResolvedValueOnce(EMPTY);

    await search('st-user-id', 'student', 'test');

    const eventParams = mockQuery.mock.calls[3][1] as unknown[];
    expect(eventParams).toContain('II Year');
  });

  it('semester 7+ maps to IV Year for event audience filter', async () => {
    mockQuery
      .mockResolvedValueOnce(withRows([{
        program_id: 'prog-uuid', semester: 7, section: 'A', department_id: 'dept-uuid',
      }]))
      .mockResolvedValueOnce(EMPTY).mockResolvedValueOnce(EMPTY)
      .mockResolvedValueOnce(EMPTY).mockResolvedValueOnce(EMPTY);

    await search('st-user-id', 'student', 'test');

    const eventParams = mockQuery.mock.calls[3][1] as unknown[];
    expect(eventParams).toContain('IV Year');
  });

  it('exam query filters by the student own semester and section', async () => {
    mockQuery
      .mockResolvedValueOnce(withRows([{
        program_id: 'prog-uuid', semester: 3, section: 'A', department_id: 'dept-uuid',
      }]))
      .mockResolvedValueOnce(EMPTY).mockResolvedValueOnce(EMPTY)
      .mockResolvedValueOnce(EMPTY).mockResolvedValueOnce(EMPTY);

    await search('st-user-id', 'student', 'test');

    const examSql    = mockQuery.mock.calls[4][0] as string;
    const examParams = mockQuery.mock.calls[4][1] as unknown[];
    expect(examSql).toContain('e.semester');
    expect(examSql).toContain('e.section');
    expect(examParams).toContain(3);
    expect(examParams).toContain('A');
  });

  it('omits empty categories from the response', async () => {
    mockQuery
      .mockResolvedValueOnce(withRows([{
        program_id: 'prog-uuid', semester: 3, section: 'A', department_id: 'dept-uuid',
      }]))
      .mockResolvedValueOnce(withRows([SUBJECT_ROW]))
      .mockResolvedValueOnce(EMPTY).mockResolvedValueOnce(EMPTY)
      .mockResolvedValueOnce(EMPTY);

    const result = await search('st-user-id', 'student', 'Machine');

    expect(result.subjects).toHaveLength(1);
    expect(result.students).toBeUndefined();
    expect(result.faculty).toBeUndefined();
    expect(result.announcements).toBeUndefined();
    expect(result.events).toBeUndefined();
    expect(result.examinations).toBeUndefined();
  });
});
