import { AppError } from '../errors/AppError';

// ── Mocks (must be hoisted before importing the module under test) ─────────────

const mockQuery = jest.fn();
const mockWithTransaction = jest.fn();
const mockHashPassword = jest.fn().mockResolvedValue('$2b$10$hashed');
const mockAuditLog = jest.fn().mockResolvedValue(undefined);

jest.mock('../config/database', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  withTransaction: (...args: unknown[]) => mockWithTransaction(...args),
}));

jest.mock('../utils/password', () => ({
  hashPassword: (...args: unknown[]) => mockHashPassword(...args),
}));

jest.mock('../utils/audit', () => ({
  auditLog: (...args: unknown[]) => mockAuditLog(...args),
}));

// Import AFTER mocks are registered
import * as facultyService from '../services/faculty.service';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DEPT_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '22222222-2222-2222-2222-222222222222';
const FACULTY_ID = '33333333-3333-3333-3333-333333333333';
const ACTOR_ID = '44444444-4444-4444-4444-444444444444';

const detailRow = {
  id: FACULTY_ID,
  user_id: USER_ID,
  employee_number: 'FAC2024001',
  full_name: 'Dr. Jane Smith',
  email: 'jane@college.erp',
  department_id: DEPT_ID,
  department_name: 'Computer Science & Engineering',
  department_code: 'CSE',
  designation: 'professor' as const,
  status: 'active' as const,
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-01'),
};

const expectedDetail = {
  id: FACULTY_ID,
  userId: USER_ID,
  employeeNumber: 'FAC2024001',
  fullName: 'Dr. Jane Smith',
  email: 'jane@college.erp',
  department: {
    id: DEPT_ID,
    name: 'Computer Science & Engineering',
    code: 'CSE',
  },
  designation: 'professor',
  status: 'active',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

// ── getFacultyById ────────────────────────────────────────────────────────────

describe('getFacultyById', () => {
  it('returns a mapped FacultyDetail when the record exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [detailRow], rowCount: 1 });

    const result = await facultyService.getFacultyById(FACULTY_ID);

    expect(result).toEqual(expectedDetail);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('WHERE f.id = $1'),
      [FACULTY_ID]
    );
  });

  it('throws 404 when the faculty member does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await expect(facultyService.getFacultyById(FACULTY_ID)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Faculty member not found',
    });
  });
});

// ── getFacultyByUserId ────────────────────────────────────────────────────────

describe('getFacultyByUserId', () => {
  it('returns the faculty profile for the given user', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [detailRow], rowCount: 1 });

    const result = await facultyService.getFacultyByUserId(USER_ID);

    expect(result).toEqual(expectedDetail);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('WHERE f.user_id = $1'),
      [USER_ID]
    );
  });

  it('throws 404 when no profile is linked to the user', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await expect(facultyService.getFacultyByUserId(USER_ID)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Faculty profile not found',
    });
  });
});

// ── listFaculty ───────────────────────────────────────────────────────────────

describe('listFaculty', () => {
  it('returns paginated results with no filters', async () => {
    const listRow = { ...detailRow, total_count: '2' };
    mockQuery.mockResolvedValueOnce({ rows: [listRow, listRow], rowCount: 2 });

    const result = await facultyService.listFaculty({
      page: 1,
      limit: 20,
    });

    expect(result.pagination).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1 });
    expect(result.faculty).toHaveLength(2);
    expect(result.faculty[0]).toMatchObject({
      id: FACULTY_ID,
      employeeNumber: 'FAC2024001',
      fullName: 'Dr. Jane Smith',
      designation: 'professor',
      status: 'active',
    });
  });

  it('applies departmentId filter', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const result = await facultyService.listFaculty({
      page: 1,
      limit: 20,
      departmentId: DEPT_ID,
    });

    expect(result.pagination.total).toBe(0);
    expect(result.faculty).toHaveLength(0);

    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('f.department_id =');
    expect(params).toContain(DEPT_ID);
  });

  it('applies designation filter', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await facultyService.listFaculty({ page: 1, limit: 20, designation: 'professor' });

    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('f.designation =');
    expect(params).toContain('professor');
  });

  it('applies status filter', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await facultyService.listFaculty({ page: 1, limit: 20, status: 'on_leave' });

    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('f.status =');
    expect(params).toContain('on_leave');
  });

  it('applies ILIKE search on name and employee number', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await facultyService.listFaculty({ page: 1, limit: 20, search: 'Jane' });

    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('ILIKE');
    expect(params).toContain('%Jane%');
  });

  it('returns totalPages: 0 when result set is empty', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const result = await facultyService.listFaculty({ page: 1, limit: 20 });

    expect(result.pagination.total).toBe(0);
    expect(result.pagination.totalPages).toBe(0);
  });

  it('calculates correct offset for page 2', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await facultyService.listFaculty({ page: 2, limit: 10 });

    const [, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    // offset = (page - 1) * limit = 10
    expect(params).toContain(10); // offset
    expect(params).toContain(10); // limit
  });
});

// ── createFaculty ─────────────────────────────────────────────────────────────

describe('createFaculty', () => {
  const input = {
    email: 'jane@college.erp',
    password: 'Secret@123',
    employeeNumber: 'FAC2024001',
    fullName: 'Dr. Jane Smith',
    departmentId: DEPT_ID,
    designation: 'professor' as const,
  };

  beforeEach(() => {
    // withTransaction calls its callback with a mock client
    mockWithTransaction.mockImplementation(async (fn: (client: MockClient) => Promise<unknown>) => {
      return fn(mockClient);
    });
  });

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

  it('creates user and faculty profile in a transaction and returns detail', async () => {
    // dept exists
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: DEPT_ID }], rowCount: 1 });
    // insert user
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: USER_ID }], rowCount: 1 });
    // insert faculty
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: FACULTY_ID }], rowCount: 1 });
    // fetch full detail
    mockClient.query.mockResolvedValueOnce({ rows: [detailRow], rowCount: 1 });

    const result = await facultyService.createFaculty(input, ACTOR_ID);

    expect(result).toEqual(expectedDetail);
    expect(mockHashPassword).toHaveBeenCalledWith('Secret@123');
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE_FACULTY',
        resource: 'faculty',
        resourceId: FACULTY_ID,
      })
    );
  });

  it('throws 404 when the department does not exist', async () => {
    mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // dept not found

    await expect(facultyService.createFaculty(input, ACTOR_ID)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Department not found',
    });

    // user insert must NOT have been called
    expect(mockClient.query).toHaveBeenCalledTimes(1);
  });

  it('propagates database errors (e.g. duplicate email) out of the transaction', async () => {
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: DEPT_ID }], rowCount: 1 }); // dept ok
    const pgDuplicateError = Object.assign(new Error('duplicate key'), { code: '23505' });
    mockClient.query.mockRejectedValueOnce(pgDuplicateError); // user insert fails

    await expect(facultyService.createFaculty(input, ACTOR_ID)).rejects.toMatchObject({
      code: '23505',
    });
  });
});

// ── updateFaculty ─────────────────────────────────────────────────────────────

describe('updateFaculty', () => {
  it('updates provided fields and returns the refreshed detail', async () => {
    // UPDATE succeeds
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    // getFacultyById for return value
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...detailRow, full_name: 'Dr. Jane Doe' }],
      rowCount: 1,
    });

    const result = await facultyService.updateFaculty(
      FACULTY_ID,
      { fullName: 'Dr. Jane Doe' },
      ACTOR_ID
    );

    expect(result.fullName).toBe('Dr. Jane Doe');
    expect(mockQuery.mock.calls[0][0]).toContain('UPDATE faculty');
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UPDATE_FACULTY' })
    );
  });

  it('updates designation without touching other fields', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    mockQuery.mockResolvedValueOnce({ rows: [detailRow], rowCount: 1 });

    await facultyService.updateFaculty(FACULTY_ID, { designation: 'lecturer' }, ACTOR_ID);

    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('designation = ');
    expect(params).toContain('lecturer');
    expect(sql).not.toContain('full_name');
  });

  it('throws 404 when the faculty member does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await expect(
      facultyService.updateFaculty(FACULTY_ID, { fullName: 'Nobody' }, ACTOR_ID)
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── updateFacultyStatus ───────────────────────────────────────────────────────

describe('updateFacultyStatus', () => {
  it('updates status and returns the refreshed detail', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    mockQuery.mockResolvedValueOnce({ rows: [{ ...detailRow, status: 'on_leave' }], rowCount: 1 });

    const result = await facultyService.updateFacultyStatus(
      FACULTY_ID,
      { status: 'on_leave' },
      ACTOR_ID
    );

    expect(result.status).toBe('on_leave');
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPDATE_FACULTY_STATUS',
        changes: { status: 'on_leave' },
      })
    );
  });

  it('throws 404 when the faculty member does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await expect(
      facultyService.updateFacultyStatus(FACULTY_ID, { status: 'retired' }, ACTOR_ID)
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── deleteFaculty ─────────────────────────────────────────────────────────────

describe('deleteFaculty', () => {
  it('soft-deletes the faculty record and deactivates the user account', async () => {
    // UPDATE faculty (soft-delete)
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    // UPDATE users (deactivate)
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await facultyService.deleteFaculty(FACULTY_ID, ACTOR_ID);

    const [softDeleteSql] = mockQuery.mock.calls[0] as [string];
    expect(softDeleteSql).toContain('deleted_at = NOW()');
    expect(softDeleteSql).toContain("status = 'resigned'");

    const [deactivateSql] = mockQuery.mock.calls[1] as [string];
    expect(deactivateSql).toContain('is_active = FALSE');

    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DELETE_FACULTY', resourceId: FACULTY_ID })
    );
  });

  it('throws 404 when the faculty member does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await expect(facultyService.deleteFaculty(FACULTY_ID, ACTOR_ID)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Faculty member not found',
    });

    // deactivate user must NOT have been called
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });
});
