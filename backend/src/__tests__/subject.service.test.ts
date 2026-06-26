// ── Mocks (hoisted before the module under test) ──────────────────────────────

const mockQuery = jest.fn();
const mockAuditLog = jest.fn().mockResolvedValue(undefined);

jest.mock('../config/database', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

jest.mock('../utils/audit', () => ({
  auditLog: (...args: unknown[]) => mockAuditLog(...args),
}));

import * as subjectService from '../services/subject.service';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DEPT_ID    = '11111111-1111-1111-1111-111111111111';
const PROG_ID    = '22222222-2222-2222-2222-222222222222';
const SUBJECT_ID = '33333333-3333-3333-3333-333333333333';
const ACTOR_ID   = '44444444-4444-4444-4444-444444444444';

const detailRow = {
  id: SUBJECT_ID,
  code: 'CS301',
  name: 'Data Structures',
  department_id: DEPT_ID,
  department_name: 'Computer Science & Engineering',
  department_code: 'CSE',
  program_id: PROG_ID,
  program_name: 'B.Tech Computer Science',
  program_code: 'BTCSE',
  semester: 3,
  credits: 4,
  type: 'core' as const,
  status: 'active' as const,
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-01'),
};

const expectedDetail = {
  id: SUBJECT_ID,
  code: 'CS301',
  name: 'Data Structures',
  department: { id: DEPT_ID, name: 'Computer Science & Engineering', code: 'CSE' },
  program:    { id: PROG_ID, name: 'B.Tech Computer Science', code: 'BTCSE' },
  semester: 3,
  credits: 4,
  type: 'core',
  status: 'active',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

// ── getSubjectById ────────────────────────────────────────────────────────────

describe('getSubjectById', () => {
  it('returns a mapped SubjectDetail when the record exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [detailRow], rowCount: 1 });

    const result = await subjectService.getSubjectById(SUBJECT_ID);

    expect(result).toEqual(expectedDetail);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('WHERE s.id = $1'),
      [SUBJECT_ID]
    );
  });

  it('throws 404 when the subject does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await expect(subjectService.getSubjectById(SUBJECT_ID)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Subject not found',
    });
  });
});

// ── listSubjects ──────────────────────────────────────────────────────────────

describe('listSubjects', () => {
  it('returns paginated results with no filters', async () => {
    const listRow = { ...detailRow, total_count: '3' };
    mockQuery.mockResolvedValueOnce({ rows: [listRow, listRow, listRow], rowCount: 3 });

    const result = await subjectService.listSubjects({ page: 1, limit: 20 });

    expect(result.pagination).toEqual({ page: 1, limit: 20, total: 3, totalPages: 1 });
    expect(result.subjects).toHaveLength(3);
    expect(result.subjects[0]).toMatchObject({
      id: SUBJECT_ID,
      code: 'CS301',
      name: 'Data Structures',
      semester: 3,
      credits: 4,
      type: 'core',
      status: 'active',
    });
  });

  it('applies departmentId filter', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await subjectService.listSubjects({ page: 1, limit: 20, departmentId: DEPT_ID });

    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('s.department_id =');
    expect(params).toContain(DEPT_ID);
  });

  it('applies programId filter', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await subjectService.listSubjects({ page: 1, limit: 20, programId: PROG_ID });

    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('s.program_id =');
    expect(params).toContain(PROG_ID);
  });

  it('applies semester filter', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await subjectService.listSubjects({ page: 1, limit: 20, semester: 3 });

    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('s.semester =');
    expect(params).toContain(3);
  });

  it('applies type filter', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await subjectService.listSubjects({ page: 1, limit: 20, type: 'lab' });

    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('s.type =');
    expect(params).toContain('lab');
  });

  it('applies status filter', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await subjectService.listSubjects({ page: 1, limit: 20, status: 'inactive' });

    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('s.status =');
    expect(params).toContain('inactive');
  });

  it('applies ILIKE search on name and code', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await subjectService.listSubjects({ page: 1, limit: 20, search: 'data' });

    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('ILIKE');
    expect(params).toContain('%data%');
  });

  it('returns totalPages: 0 when result set is empty', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const result = await subjectService.listSubjects({ page: 1, limit: 20 });

    expect(result.pagination.total).toBe(0);
    expect(result.pagination.totalPages).toBe(0);
  });

  it('calculates correct offset for page 3', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await subjectService.listSubjects({ page: 3, limit: 10 });

    const [, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(params).toContain(20); // offset = (3-1) * 10 = 20
    expect(params).toContain(10); // limit
  });
});

// ── createSubject ─────────────────────────────────────────────────────────────

describe('createSubject', () => {
  const input = {
    code: 'CS301',
    name: 'Data Structures',
    departmentId: DEPT_ID,
    programId: PROG_ID,
    semester: 3,
    credits: 4,
    type: 'core' as const,
  };

  it('creates a subject and returns full detail', async () => {
    // dept exists
    mockQuery.mockResolvedValueOnce({ rows: [{ id: DEPT_ID }], rowCount: 1 });
    // program validation: belongs to dept, 8 semesters, semester 3 is valid
    mockQuery.mockResolvedValueOnce({ rows: [{ department_id: DEPT_ID, total_semesters: 8 }], rowCount: 1 });
    // insert subject
    mockQuery.mockResolvedValueOnce({ rows: [{ id: SUBJECT_ID }], rowCount: 1 });
    // getSubjectById
    mockQuery.mockResolvedValueOnce({ rows: [detailRow], rowCount: 1 });

    const result = await subjectService.createSubject(input, ACTOR_ID);

    expect(result).toEqual(expectedDetail);
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE_SUBJECT',
        resource: 'subjects',
        resourceId: SUBJECT_ID,
      })
    );
  });

  it('throws 404 when department does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // dept not found

    await expect(subjectService.createSubject(input, ACTOR_ID)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Department not found',
    });

    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('throws 404 when program does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: DEPT_ID }], rowCount: 1 }); // dept ok
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // program not found

    await expect(subjectService.createSubject(input, ACTOR_ID)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Program not found',
    });
  });

  it('throws 400 when program does not belong to the given department', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: DEPT_ID }], rowCount: 1 });
    mockQuery.mockResolvedValueOnce({
      rows: [{ department_id: 'different-dept-id', total_semesters: 8 }],
      rowCount: 1,
    });

    await expect(subjectService.createSubject(input, ACTOR_ID)).rejects.toMatchObject({
      statusCode: 400,
      code: 'PROGRAM_DEPT_MISMATCH',
    });
  });

  it('throws 400 when semester exceeds program total_semesters', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: DEPT_ID }], rowCount: 1 });
    mockQuery.mockResolvedValueOnce({
      rows: [{ department_id: DEPT_ID, total_semesters: 2 }], // only 2 semesters
      rowCount: 1,
    });

    await expect(
      subjectService.createSubject({ ...input, semester: 3 }, ACTOR_ID)
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'SEMESTER_OUT_OF_RANGE',
    });
  });

  it('propagates database errors (e.g. duplicate code) from the insert', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: DEPT_ID }], rowCount: 1 });
    mockQuery.mockResolvedValueOnce({ rows: [{ department_id: DEPT_ID, total_semesters: 8 }], rowCount: 1 });
    const pgDuplicateError = Object.assign(new Error('duplicate key'), { code: '23505' });
    mockQuery.mockRejectedValueOnce(pgDuplicateError);

    await expect(subjectService.createSubject(input, ACTOR_ID)).rejects.toMatchObject({
      code: '23505',
    });
  });
});

// ── updateSubject ─────────────────────────────────────────────────────────────

describe('updateSubject', () => {
  it('updates provided fields and returns the refreshed detail', async () => {
    // getSubjectById (current state)
    mockQuery.mockResolvedValueOnce({ rows: [detailRow], rowCount: 1 });
    // UPDATE subjects
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    // getSubjectById (return value)
    mockQuery.mockResolvedValueOnce({ rows: [{ ...detailRow, name: 'Advanced Data Structures', credits: 5 }], rowCount: 1 });

    const result = await subjectService.updateSubject(
      SUBJECT_ID,
      { name: 'Advanced Data Structures', credits: 5 },
      ACTOR_ID
    );

    expect(result.name).toBe('Advanced Data Structures');
    expect(result.credits).toBe(5);
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UPDATE_SUBJECT' })
    );
  });

  it('validates program placement when semester changes', async () => {
    // getSubjectById (current state)
    mockQuery.mockResolvedValueOnce({ rows: [detailRow], rowCount: 1 });
    // validateProgramPlacement → program query
    mockQuery.mockResolvedValueOnce({ rows: [{ department_id: DEPT_ID, total_semesters: 8 }], rowCount: 1 });
    // UPDATE subjects
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    // getSubjectById (return value)
    mockQuery.mockResolvedValueOnce({ rows: [{ ...detailRow, semester: 4 }], rowCount: 1 });

    const result = await subjectService.updateSubject(SUBJECT_ID, { semester: 4 }, ACTOR_ID);

    expect(result.semester).toBe(4);
  });

  it('rejects when new semester exceeds program total_semesters', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [detailRow], rowCount: 1 });
    mockQuery.mockResolvedValueOnce({ rows: [{ department_id: DEPT_ID, total_semesters: 4 }], rowCount: 1 });

    await expect(
      subjectService.updateSubject(SUBJECT_ID, { semester: 5 }, ACTOR_ID)
    ).rejects.toMatchObject({ statusCode: 400, code: 'SEMESTER_OUT_OF_RANGE' });
  });

  it('throws 404 when the subject does not exist', async () => {
    // getSubjectById (current state fetch) → 404
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await expect(
      subjectService.updateSubject(SUBJECT_ID, { name: 'Ghost' }, ACTOR_ID)
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('skips placement validation when no academic fields change', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [detailRow], rowCount: 1 }); // current state
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });           // UPDATE
    mockQuery.mockResolvedValueOnce({ rows: [detailRow], rowCount: 1 }); // return

    await subjectService.updateSubject(SUBJECT_ID, { credits: 3 }, ACTOR_ID);

    // Only 3 queries: getById, UPDATE, getById — no program validation query
    expect(mockQuery).toHaveBeenCalledTimes(3);
  });
});

// ── updateSubjectStatus ───────────────────────────────────────────────────────

describe('updateSubjectStatus', () => {
  it('updates status and returns the refreshed detail', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    mockQuery.mockResolvedValueOnce({ rows: [{ ...detailRow, status: 'inactive' }], rowCount: 1 });

    const result = await subjectService.updateSubjectStatus(
      SUBJECT_ID,
      { status: 'inactive' },
      ACTOR_ID
    );

    expect(result.status).toBe('inactive');
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPDATE_SUBJECT_STATUS',
        changes: { status: 'inactive' },
      })
    );
  });

  it('throws 404 when the subject does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await expect(
      subjectService.updateSubjectStatus(SUBJECT_ID, { status: 'archived' }, ACTOR_ID)
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── deleteSubject ─────────────────────────────────────────────────────────────

describe('deleteSubject', () => {
  it('soft-deletes the subject and sets status to archived', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await subjectService.deleteSubject(SUBJECT_ID, ACTOR_ID);

    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('deleted_at = NOW()');
    expect(sql).toContain("status = 'archived'");
    expect(params).toContain(SUBJECT_ID);

    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DELETE_SUBJECT', resourceId: SUBJECT_ID })
    );
  });

  it('throws 404 when the subject does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await expect(subjectService.deleteSubject(SUBJECT_ID, ACTOR_ID)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Subject not found',
    });
  });
});
