// ── Mocks (hoisted before the module under test) ──────────────────────────────

const mockQuery = jest.fn().mockImplementation((sql) => {
  console.log('Fallback query called with:', sql);
  return { rows: [], rowCount: 0 };
});
const mockAuditLog = jest.fn().mockResolvedValue(undefined);

jest.mock('../config/database', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

jest.mock('../utils/audit', () => ({
  auditLog: (...args: unknown[]) => mockAuditLog(...args),
}));

import * as subjectService from '../services/subject.service';
import { CreateSubjectInput } from '../types/subject';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DEPT_ID    = '11111111-1111-1111-1111-111111111111';
const PROG_ID    = '22222222-2222-2222-2222-222222222222';
const SUBJECT_ID = '33333333-3333-3333-3333-333333333333';
const ACTOR_ID   = '44444444-4444-4444-4444-444444444444';

const subjectMasterRow = {
  id: SUBJECT_ID,
  code: 'CS301',
  name: 'Data Structures',
  credits: 4,
  type: 'core' as const,
  status: 'active' as const,
  lecture_hours: 0,
  tutorial_hours: 0,
  practical_hours: 0,
  description: null,
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-01'),
};

const curriculumMappingRow = {
  id: 'mapping-uuid-1',
  subject_id: SUBJECT_ID,
  department_id: DEPT_ID,
  department_name: 'Computer Science & Engineering',
  department_code: 'CSE',
  program_id: PROG_ID,
  program_name: 'B.Tech Computer Science',
  program_code: 'BTCSE',
  program: 'B.Tech Computer Science',
  regulation: 'R22',
  year: 'II',
  semester: 3,
  semester_raw: 'I',
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-01'),
};

const expectedDetail = {
  id: SUBJECT_ID,
  code: 'CS301',
  name: 'Data Structures',
  credits: 4,
  type: 'core',
  status: 'active',
  lectureHours: 0,
  tutorialHours: 0,
  practicalHours: 0,
  description: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  mappings: [
    {
      id: 'mapping-uuid-1',
      subjectId: SUBJECT_ID,
      departmentId: DEPT_ID,
      departmentName: 'Computer Science & Engineering',
      departmentCode: 'CSE',
      programId: PROG_ID,
      programName: 'B.Tech Computer Science',
      programCode: 'BTCSE',
      program: 'B.Tech Computer Science',
      regulation: 'R22',
      year: 'II',
      semester: 3,
      semesterRaw: 'I',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    }
  ],
};

beforeEach(() => {
  mockQuery.mockReset();
  mockAuditLog.mockReset();
  mockAuditLog.mockResolvedValue(undefined);
});

// ── getSubjectById ────────────────────────────────────────────────────────────

describe('getSubjectById', () => {
  it('returns a mapped SubjectDetail when the record exists', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [subjectMasterRow], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [curriculumMappingRow], rowCount: 1 });

    const result = await subjectService.getSubjectById(SUBJECT_ID);

    expect(result).toEqual(expectedDetail);
    expect(mockQuery).toHaveBeenNthCalledWith(1,
      expect.stringContaining('FROM subjects'),
      [SUBJECT_ID]
    );
    expect(mockQuery).toHaveBeenNthCalledWith(2,
      expect.stringContaining('FROM subject_curriculum_mappings'),
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
    const listRow = {
      id: SUBJECT_ID,
      code: 'CS301',
      name: 'Data Structures',
      credits: 4,
      type: 'core',
      status: 'active',
      lecture_hours: 0,
      tutorial_hours: 0,
      practical_hours: 0,
      mappings_json: [
        {
          id: 'mapping-uuid-1',
          departmentId: DEPT_ID,
          departmentName: 'Computer Science & Engineering',
          departmentCode: 'CSE',
          programId: PROG_ID,
          programName: 'B.Tech Computer Science',
          regulation: 'R22',
          year: 'II',
          semester: 3,
          semesterRaw: 'I',
        }
      ],
      total_count: '3'
    };

    mockQuery.mockResolvedValueOnce({ rows: [listRow, listRow, listRow], rowCount: 3 });

    const result = await subjectService.listSubjects({ page: 1, limit: 20 });

    expect(result.pagination).toEqual({ page: 1, limit: 20, total: 3, totalPages: 1 });
    expect(result.subjects).toHaveLength(3);
    expect(result.subjects[0]).toMatchObject({
      id: SUBJECT_ID,
      code: 'CS301',
      name: 'Data Structures',
      credits: 4,
      type: 'core',
      status: 'active',
      mappings: expect.arrayContaining([
        expect.objectContaining({ semester: 3 })
      ]),
    });
  });

  it('applies departmentId filter', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await subjectService.listSubjects({ page: 1, limit: 20, departmentId: DEPT_ID });

    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('department_id =');
    expect(params).toContain(DEPT_ID);
  });

  it('applies programId filter', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await subjectService.listSubjects({ page: 1, limit: 20, programId: PROG_ID });

    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('program_id =');
    expect(params).toContain(PROG_ID);
  });

  it('applies semester filter', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await subjectService.listSubjects({ page: 1, limit: 20, semester: 3 });

    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('semester =');
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

    const result = await subjectService.listSubjects({ page: 3, limit: 10 });

    const [, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(params).toContain(20); // offset = (3-1) * 10 = 20
    expect(params).toContain(10); // limit
  });
});

// ── createSubject ─────────────────────────────────────────────────────────────

describe('createSubject', () => {
  const input: CreateSubjectInput = {
    code: 'CS301',
    name: 'Data Structures',
    departmentId: DEPT_ID,
    programId: PROG_ID,
    semester: 3,
    credits: 4,
    type: 'core' as const,
    regulation: 'R22',
    status: 'active',
    lectureHours: 0,
    tutorialHours: 0,
    practicalHours: 0,
  };

  it('creates a subject and returns full detail', async () => {
    const customDept = 'a0000000-0000-0000-0000-000000000001';
    const customProg = 'b0000000-0000-0000-0000-000000000001';
    // 1. getDepartment (department check)
    mockQuery.mockResolvedValueOnce({ rows: [{ id: customDept }], rowCount: 1 });
    // 2. validateProgramPlacement (belongs to dept, 8 semesters)
    mockQuery.mockResolvedValueOnce({ rows: [{ department_id: customDept, total_semesters: 8 }], rowCount: 1 });
    // 3. SELECT id FROM subjects checks duplicate code
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    // 4. INSERT INTO subjects
    mockQuery.mockResolvedValueOnce({ rows: [{ id: SUBJECT_ID }], rowCount: 1 });
    // 5. INSERT INTO subject_curriculum_mappings
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'mapping-uuid-1' }], rowCount: 1 });
    // 6. getSubjectById -> select subject
    mockQuery.mockResolvedValueOnce({ rows: [subjectMasterRow], rowCount: 1 });
    // 7. getSubjectById -> select mappings
    mockQuery.mockResolvedValueOnce({ rows: [curriculumMappingRow], rowCount: 1 });

    const result = await subjectService.createSubject({
      ...input,
      departmentId: customDept,
      programId: customProg,
    }, ACTOR_ID);

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
    const customDept = 'a0000000-0000-0000-0000-000000000002';
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // dept not found

    await expect(
      subjectService.createSubject({ ...input, departmentId: customDept }, ACTOR_ID)
    ).rejects.toMatchObject({
      statusCode: 404,
      message: 'Department not found',
    });

    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('throws 404 when program does not exist', async () => {
    const customDept = 'a0000000-0000-0000-0000-000000000003';
    const customProg = 'b0000000-0000-0000-0000-000000000003';
    mockQuery.mockResolvedValueOnce({ rows: [{ id: customDept }], rowCount: 1 }); // dept ok
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // program not found

    await expect(
      subjectService.createSubject({ ...input, departmentId: customDept, programId: customProg }, ACTOR_ID)
    ).rejects.toMatchObject({
      statusCode: 404,
      message: 'Program not found',
    });
  });

  it('throws 400 when program does not belong to the given department', async () => {
    const customDept = 'a0000000-0000-0000-0000-000000000004';
    const customProg = 'b0000000-0000-0000-0000-000000000004';
    mockQuery.mockResolvedValueOnce({ rows: [{ id: customDept }], rowCount: 1 });
    mockQuery.mockResolvedValueOnce({
      rows: [{ department_id: 'different-dept-id', total_semesters: 8 }],
      rowCount: 1,
    });

    await expect(
      subjectService.createSubject({ ...input, departmentId: customDept, programId: customProg }, ACTOR_ID)
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'PROGRAM_DEPT_MISMATCH',
    });
  });

  it('throws 400 when semester exceeds program total_semesters', async () => {
    const customDept = 'a0000000-0000-0000-0000-000000000005';
    const customProg = 'b0000000-0000-0000-0000-000000000005';
    mockQuery.mockResolvedValueOnce({ rows: [{ id: customDept }], rowCount: 1 });
    mockQuery.mockResolvedValueOnce({
      rows: [{ department_id: customDept, total_semesters: 2 }], // only 2 semesters
      rowCount: 1,
    });

    await expect(
      subjectService.createSubject({ ...input, departmentId: customDept, programId: customProg, semester: 3 }, ACTOR_ID)
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'SEMESTER_OUT_OF_RANGE',
    });
  });

  it('propagates database errors (e.g. duplicate code) from the insert', async () => {
    const customDept = 'a0000000-0000-0000-0000-000000000006';
    const customProg = 'b0000000-0000-0000-0000-000000000006';
    mockQuery.mockResolvedValueOnce({ rows: [{ id: customDept }], rowCount: 1 });
    mockQuery.mockResolvedValueOnce({ rows: [{ department_id: customDept, total_semesters: 8 }], rowCount: 1 });
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // existing code check returns nothing
    const pgDuplicateError = Object.assign(new Error('duplicate key'), { code: '23505' });
    mockQuery.mockRejectedValueOnce(pgDuplicateError);

    await expect(
      subjectService.createSubject({ ...input, departmentId: customDept, programId: customProg }, ACTOR_ID)
    ).rejects.toMatchObject({
      code: '23505',
    });
  });
});

// ── updateSubject ─────────────────────────────────────────────────────────────

describe('updateSubject', () => {
  it('updates provided fields and returns the refreshed detail', async () => {
    // 1. UPDATE subjects
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    // 2 & 3. getSubjectById (return value)
    mockQuery.mockResolvedValueOnce({ rows: [{ ...subjectMasterRow, name: 'Advanced Data Structures', credits: 5 }], rowCount: 1 });
    mockQuery.mockResolvedValueOnce({ rows: [curriculumMappingRow], rowCount: 1 });

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

  it('throws 404 when the subject does not exist', async () => {
    // 1. UPDATE subjects → 404
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await expect(
      subjectService.updateSubject(SUBJECT_ID, { name: 'Ghost' }, ACTOR_ID)
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── updateSubjectStatus ───────────────────────────────────────────────────────

describe('updateSubjectStatus', () => {
  it('updates status and returns the refreshed detail', async () => {
    // 1. UPDATE subjects
    mockQuery.mockResolvedValueOnce({ rows: [{ id: SUBJECT_ID }], rowCount: 1 });
    // 2 & 3. getSubjectById
    mockQuery.mockResolvedValueOnce({ rows: [{ ...subjectMasterRow, status: 'inactive' }], rowCount: 1 });
    mockQuery.mockResolvedValueOnce({ rows: [curriculumMappingRow], rowCount: 1 });

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
    // 7 check queries: FSA, Attendance, course_materials, assignments, internal_marks, results, teaching_plans
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    // UPDATE query
    mockQuery.mockResolvedValueOnce({ rows: [{ id: SUBJECT_ID }], rowCount: 1 });

    await subjectService.deleteSubject(SUBJECT_ID, ACTOR_ID);

    // 8th call must be the UPDATE query
    const [sql, params] = mockQuery.mock.calls[7] as [string, unknown[]];
    expect(sql).toContain('deleted_at = NOW()');
    expect(sql).toContain("status = 'archived'");
    expect(params).toContain(SUBJECT_ID);

    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DELETE_SUBJECT', resourceId: SUBJECT_ID })
    );
  });

  it('throws 404 when the subject does not exist', async () => {
    // 7 check queries: FSA, Attendance, course_materials, assignments, internal_marks, results, teaching_plans
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    // UPDATE query returns 0 rows
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await expect(subjectService.deleteSubject(SUBJECT_ID, ACTOR_ID)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Subject not found',
    });
  });
});
