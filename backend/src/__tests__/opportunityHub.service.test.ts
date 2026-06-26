import * as opportunityService from '../services/opportunityHub.service';

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

const ADMIN_USER_ID   = 'adm-user-0000-0000-000000000001';
const FACULTY_USER_ID = 'fac-user-0000-0000-000000000001';
const STUDENT_USER_ID = 'stu-user-0000-0000-000000000001';
const STUDENT_ID      = 'stu-0000-0000-0000-000000000001';
const DEPT_ID         = 'dpt-0000-0000-0000-000000000001';
const OPP_ID          = 'opp-0000-0000-0000-000000000001';

const mockOppRow = {
  id:                OPP_ID,
  title:             'Summer Internship at TechCorp',
  description:       'Backend internship',
  type:              'Internship',
  department_id:     null,
  department_name:   null,
  eligible_years:    null,
  registration_link: 'https://example.com/apply',
  start_date:        null,
  deadline:          new Date('2026-08-01'),
  location:          'Hyderabad',
  organizer:         'TechCorp',
  status:            'Active',
  created_by:        ADMIN_USER_ID,
  created_by_name:   'Admin User',
  is_bookmarked:     false,
  created_at:        new Date('2026-06-01'),
  updated_at:        new Date('2026-06-01'),
};

const mockStudentRow = {
  id:            STUDENT_ID,
  department_id: DEPT_ID,
  semester:      5,    // → 'III Year'
};

function resetMocks() {
  mockQuery.mockReset();
}

// ── createOpportunity ──────────────────────────────────────────────────────────

describe('createOpportunity', () => {
  beforeEach(resetMocks);

  it('inserts opportunity and returns detail', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: OPP_ID }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [mockOppRow], rowCount: 1 } as never);

    const result = await opportunityService.createOpportunity(ADMIN_USER_ID, {
      title:    'Summer Internship at TechCorp',
      type:     'Internship',
      deadline: '2026-08-01T00:00:00.000Z',
    });

    expect(result.id).toBe(OPP_ID);
    expect(result.type).toBe('Internship');
    expect(result.isBookmarked).toBe(false);

    const insertSql = mockQuery.mock.calls[0][0] as string;
    expect(insertSql).toMatch(/INSERT INTO opportunities/);
    const insertParams = mockQuery.mock.calls[0][1] as unknown[];
    expect(insertParams).toContain('Internship');
    expect(insertParams).toContain(ADMIN_USER_ID);
  });

  it('throws 400 when startDate is after deadline', async () => {
    await expect(
      opportunityService.createOpportunity(ADMIN_USER_ID, {
        title:     'Test',
        type:      'Workshop',
        startDate: '2026-09-01T00:00:00.000Z',
        deadline:  '2026-08-01T00:00:00.000Z',
      })
    ).rejects.toMatchObject({ statusCode: 400, message: 'start_date must be on or before deadline' });

    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('stores null for missing optional fields', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: OPP_ID }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [mockOppRow], rowCount: 1 } as never);

    await opportunityService.createOpportunity(FACULTY_USER_ID, {
      title: 'Hackathon',
      type:  'Hackathon',
    });

    const insertParams = mockQuery.mock.calls[0][1] as unknown[];
    // departmentId, eligibleYears, registrationLink, startDate, deadline, location, organizer → all null
    const nullCount = insertParams.filter(p => p === null).length;
    expect(nullCount).toBeGreaterThanOrEqual(5);
  });
});

// ── listOpportunities ──────────────────────────────────────────────────────────

describe('listOpportunities', () => {
  beforeEach(resetMocks);

  it('admin receives all without role scope filter', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...mockOppRow, total_count: '1' }],
      rowCount: 1,
    } as never);

    const result = await opportunityService.listOpportunities(
      ADMIN_USER_ID, 'admin', { page: 1, limit: 20 }
    );

    expect(result.total).toBe(1);
    // Admin has no scope parameters — only limit and offset are bound
    const params = mockQuery.mock.calls[0][1] as unknown[];
    expect(params).toHaveLength(2);
    expect(params[0]).toBe(20);   // limit
    expect(params[1]).toBe(0);    // offset (page 1)
  });

  it('faculty query includes OR created_by filter', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await opportunityService.listOpportunities(
      FACULTY_USER_ID, 'faculty', { page: 1, limit: 20 }
    );

    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/created_by\s*=\s*\$/);
    expect(params).toContain(FACULTY_USER_ID);
  });

  it('student query filters by Active status, department, and year group', async () => {
    // resolveStudentCtx
    mockQuery.mockResolvedValueOnce({ rows: [mockStudentRow], rowCount: 1 } as never);
    // list query
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await opportunityService.listOpportunities(
      STUDENT_USER_ID, 'student', { page: 1, limit: 20 }
    );

    const listSql = mockQuery.mock.calls[1][0] as string;
    expect(listSql).toMatch(/status = 'Active'/);
    expect(listSql).toMatch(/department_id IS NULL OR opp\.department_id/);
    expect(listSql).toMatch(/eligible_years IS NULL OR .* = ANY/);
    expect(listSql).toMatch(/opportunity_bookmarks ob/);   // bookmark join present
  });

  it('student receives III Year yearGroup derived from semester 5', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockStudentRow], rowCount: 1 } as never);  // resolveStudentCtx
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await opportunityService.listOpportunities(
      STUDENT_USER_ID, 'student', { page: 1, limit: 20 }
    );

    const listParams = mockQuery.mock.calls[1][1] as unknown[];
    expect(listParams).toContain('III Year');
    expect(listParams).toContain(DEPT_ID);
    expect(listParams).toContain(STUDENT_ID);
  });

  it('applies type filter for admin', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await opportunityService.listOpportunities(
      ADMIN_USER_ID, 'admin', { page: 1, limit: 20, type: 'Internship' }
    );

    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/opp\.type\s*=\s*\$/);
    expect(params).toContain('Internship');
  });

  it('applies status filter for admin', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await opportunityService.listOpportunities(
      ADMIN_USER_ID, 'admin', { page: 1, limit: 20, status: 'Archived' }
    );

    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/opp\.status\s*=\s*\$/);
    expect(params).toContain('Archived');
  });

  it('computes totalPages correctly', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: Array(5).fill({ ...mockOppRow, total_count: '23' }),
      rowCount: 5,
    } as never);

    const result = await opportunityService.listOpportunities(
      ADMIN_USER_ID, 'admin', { page: 2, limit: 10 }
    );

    expect(result.total).toBe(23);
    expect(result.totalPages).toBe(3);
    expect(result.page).toBe(2);
  });
});

// ── getOpportunityById ─────────────────────────────────────────────────────────

describe('getOpportunityById', () => {
  beforeEach(resetMocks);

  it('returns opportunity for admin', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockOppRow], rowCount: 1 } as never);

    const result = await opportunityService.getOpportunityById(
      ADMIN_USER_ID, 'admin', OPP_ID
    );

    expect(result.id).toBe(OPP_ID);
  });

  it('throws 404 when opportunity not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await expect(
      opportunityService.getOpportunityById(ADMIN_USER_ID, 'admin', OPP_ID)
    ).rejects.toMatchObject({ statusCode: 404, message: 'Opportunity not found' });
  });

  it('student gets 404 for non-Active opportunity', async () => {
    // resolveStudentCtx
    mockQuery.mockResolvedValueOnce({ rows: [mockStudentRow], rowCount: 1 } as never);
    // opportunity is Archived
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...mockOppRow, status: 'Archived', is_bookmarked: false }],
      rowCount: 1,
    } as never);

    await expect(
      opportunityService.getOpportunityById(STUDENT_USER_ID, 'student', OPP_ID)
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('student gets isBookmarked flag in response', async () => {
    // resolveStudentCtx
    mockQuery.mockResolvedValueOnce({ rows: [mockStudentRow], rowCount: 1 } as never);
    // opportunity with bookmark
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...mockOppRow, is_bookmarked: true }],
      rowCount: 1,
    } as never);

    const result = await opportunityService.getOpportunityById(
      STUDENT_USER_ID, 'student', OPP_ID
    );

    expect(result.isBookmarked).toBe(true);
    const getQuery = mockQuery.mock.calls[1][0] as string;
    expect(getQuery).toMatch(/opportunity_bookmarks ob/);
  });

  it('faculty can see their own Archived opportunity', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...mockOppRow, status: 'Archived', created_by: FACULTY_USER_ID, is_bookmarked: false }],
      rowCount: 1,
    } as never);

    const result = await opportunityService.getOpportunityById(
      FACULTY_USER_ID, 'faculty', OPP_ID
    );

    expect(result.status).toBe('Archived');
  });

  it('faculty gets 404 for Archived opportunity owned by someone else', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...mockOppRow, status: 'Archived', created_by: ADMIN_USER_ID, is_bookmarked: false }],
      rowCount: 1,
    } as never);

    await expect(
      opportunityService.getOpportunityById(FACULTY_USER_ID, 'faculty', OPP_ID)
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── updateOpportunity ──────────────────────────────────────────────────────────

describe('updateOpportunity', () => {
  beforeEach(resetMocks);

  it('admin can update any field including status', async () => {
    // fetchOpportunityRow
    mockQuery.mockResolvedValueOnce({ rows: [mockOppRow], rowCount: 1 } as never);
    // UPDATE
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    // re-fetch
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...mockOppRow, status: 'Closed', title: 'Updated Title' }],
      rowCount: 1,
    } as never);

    const result = await opportunityService.updateOpportunity(
      ADMIN_USER_ID, 'admin', OPP_ID, { title: 'Updated Title', status: 'Closed' }
    );

    const updateSql = mockQuery.mock.calls[1][0] as string;
    expect(updateSql).toMatch(/UPDATE opportunities SET/);
    expect(result.status).toBe('Closed');
  });

  it('faculty can archive their own opportunity', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...mockOppRow, created_by: FACULTY_USER_ID }],
      rowCount: 1,
    } as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...mockOppRow, created_by: FACULTY_USER_ID, status: 'Archived' }],
      rowCount: 1,
    } as never);

    const result = await opportunityService.updateOpportunity(
      FACULTY_USER_ID, 'faculty', OPP_ID, { status: 'Archived' }
    );

    expect(result.status).toBe('Archived');
  });

  it('throws 403 when faculty tries to set status to Closed', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...mockOppRow, created_by: FACULTY_USER_ID }],
      rowCount: 1,
    } as never);

    await expect(
      opportunityService.updateOpportunity(
        FACULTY_USER_ID, 'faculty', OPP_ID, { status: 'Closed' }
      )
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws 403 when faculty tries to edit another users opportunity', async () => {
    // opportunity owned by ADMIN, not FACULTY
    mockQuery.mockResolvedValueOnce({ rows: [mockOppRow], rowCount: 1 } as never);

    await expect(
      opportunityService.updateOpportunity(
        FACULTY_USER_ID, 'faculty', OPP_ID, { title: 'Hacked' }
      )
    ).rejects.toMatchObject({ statusCode: 403, message: 'You can only edit opportunities you created' });
  });

  it('throws 400 when updated dates are inconsistent', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockOppRow], rowCount: 1 } as never);

    await expect(
      opportunityService.updateOpportunity(
        ADMIN_USER_ID, 'admin', OPP_ID, {
          startDate: '2026-12-01T00:00:00.000Z',
          deadline:  '2026-11-01T00:00:00.000Z',
        }
      )
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 when no fields provided', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockOppRow], rowCount: 1 } as never);

    await expect(
      opportunityService.updateOpportunity(ADMIN_USER_ID, 'admin', OPP_ID, {})
    ).rejects.toMatchObject({ statusCode: 400, message: 'No fields to update' });
  });

  it('throws 404 when opportunity does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await expect(
      opportunityService.updateOpportunity(ADMIN_USER_ID, 'admin', OPP_ID, { title: 'X' })
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── deleteOpportunity ──────────────────────────────────────────────────────────

describe('deleteOpportunity', () => {
  beforeEach(resetMocks);

  it('soft-deletes an opportunity', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockOppRow], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);

    await opportunityService.deleteOpportunity(ADMIN_USER_ID, OPP_ID);

    const deleteSql = mockQuery.mock.calls[1][0] as string;
    expect(deleteSql).toMatch(/UPDATE opportunities SET deleted_at/);
    expect(mockQuery.mock.calls[1][1]).toContain(OPP_ID);
  });

  it('throws 404 when opportunity does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await expect(
      opportunityService.deleteOpportunity(ADMIN_USER_ID, OPP_ID)
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── toggleBookmark ─────────────────────────────────────────────────────────────

describe('toggleBookmark', () => {
  beforeEach(resetMocks);

  it('adds a bookmark when none exists', async () => {
    // opportunity check
    mockQuery.mockResolvedValueOnce({ rows: [{ status: 'Active' }], rowCount: 1 } as never);
    // resolveStudentCtx
    mockQuery.mockResolvedValueOnce({ rows: [mockStudentRow], rowCount: 1 } as never);
    // existing bookmark check → none
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    // INSERT bookmark
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);

    const result = await opportunityService.toggleBookmark(STUDENT_USER_ID, OPP_ID);

    expect(result.bookmarked).toBe(true);
    expect(result.opportunityId).toBe(OPP_ID);
    const insertSql = mockQuery.mock.calls[3][0] as string;
    expect(insertSql).toMatch(/INSERT INTO opportunity_bookmarks/);
  });

  it('removes a bookmark when one already exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ status: 'Active' }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [mockStudentRow], rowCount: 1 } as never);
    // existing bookmark → found
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'bkm-001' }], rowCount: 1 } as never);
    // DELETE
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);

    const result = await opportunityService.toggleBookmark(STUDENT_USER_ID, OPP_ID);

    expect(result.bookmarked).toBe(false);
    const deleteSql = mockQuery.mock.calls[3][0] as string;
    expect(deleteSql).toMatch(/DELETE FROM opportunity_bookmarks/);
  });

  it('throws 404 when opportunity is not Active', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ status: 'Archived' }], rowCount: 1 } as never);

    await expect(
      opportunityService.toggleBookmark(STUDENT_USER_ID, OPP_ID)
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 404 when opportunity does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await expect(
      opportunityService.toggleBookmark(STUDENT_USER_ID, OPP_ID)
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── listBookmarks ──────────────────────────────────────────────────────────────

describe('listBookmarks', () => {
  beforeEach(resetMocks);

  it('returns bookmarked opportunities for the authenticated student', async () => {
    // resolveStudentCtx
    mockQuery.mockResolvedValueOnce({ rows: [mockStudentRow], rowCount: 1 } as never);
    // list query
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...mockOppRow, is_bookmarked: true, total_count: '2' }],
      rowCount: 1,
    } as never);

    const result = await opportunityService.listBookmarks(STUDENT_USER_ID, { page: 1, limit: 20 });

    expect(result.total).toBe(2);
    expect(result.opportunities[0].isBookmarked).toBe(true);

    const [sql, params] = mockQuery.mock.calls[1] as [string, unknown[]];
    // bookmarks query leads with FROM opportunity_bookmarks ob
    expect(sql).toMatch(/opportunity_bookmarks ob/);
    expect(params).toContain(STUDENT_ID);
  });

  it('returns empty result when no bookmarks exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockStudentRow], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    const result = await opportunityService.listBookmarks(STUDENT_USER_ID, { page: 1, limit: 20 });

    expect(result.total).toBe(0);
    expect(result.opportunities).toHaveLength(0);
  });
});

// ── semesterToYearGroup (via observable behavior) ──────────────────────────────

describe('year group derivation', () => {
  beforeEach(resetMocks);

  it.each([
    [1, 'I Year'], [2, 'I Year'],
    [3, 'II Year'], [4, 'II Year'],
    [5, 'III Year'], [6, 'III Year'],
    [7, 'IV Year'], [8, 'IV Year'],
  ])('semester %i maps to %s in student list query', async (semester, expectedYear) => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: STUDENT_ID, department_id: DEPT_ID, semester }],
      rowCount: 1,
    } as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await opportunityService.listOpportunities(
      STUDENT_USER_ID, 'student', { page: 1, limit: 20 }
    );

    const listParams = mockQuery.mock.calls[1][1] as unknown[];
    expect(listParams).toContain(expectedYear);
  });
});
