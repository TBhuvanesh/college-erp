import {
  getAnnouncementById,
  listAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  updateAnnouncementStatus,
  deleteAnnouncement,
} from '../services/announcement.service';

// ── Database mock ──────────────────────────────────────────────────────────────

const mockQuery = jest.fn();

jest.mock('../config/database', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  withTransaction: jest.fn(),
}));

jest.mock('../utils/audit', () => ({
  auditLog: jest.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  mockQuery.mockReset();
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ANN_ROW = {
  id: 'ann-uuid-1',
  title: 'Exam Schedule Released',
  content: 'Mid semester examinations begin on July 15th.',
  target_audience: 'All',
  department_id: null,
  department_name: null,
  semester: null,
  priority: 'High',
  status: 'Published',
  publish_date: '2026-06-01',
  expiry_date: '2026-07-31',
  created_by: 'admin-user-uuid',
  created_by_name: 'Admin User',
  created_at: new Date('2026-06-01'),
  updated_at: new Date('2026-06-01'),
};

const ANN_DEPT_ROW = {
  ...ANN_ROW,
  id: 'ann-uuid-2',
  target_audience: 'Department Specific',
  department_id: 'dept-uuid-1',
  department_name: 'Computer Science',
};

const ANN_SEM_ROW = {
  ...ANN_ROW,
  id: 'ann-uuid-3',
  target_audience: 'Semester Specific',
  semester: 3,
  status: 'Published',
};

const ANN_DRAFT_ROW = { ...ANN_ROW, id: 'ann-uuid-4', status: 'Draft' };
const ANN_LIST_ROW = { ...ANN_ROW, total_count: '8' };

// ── getAnnouncementById ────────────────────────────────────────────────────────

describe('getAnnouncementById', () => {
  it('admin can view any announcement including Draft', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [ANN_DRAFT_ROW] });
    const result = await getAnnouncementById('ann-uuid-4', 'admin-user', 'admin');
    expect(result.id).toBe('ann-uuid-4');
    expect(result.status).toBe('Draft');
  });

  it('faculty can view Published All-audience announcements', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [ANN_ROW] })                  // main query
      .mockResolvedValueOnce({ rows: [{ department_id: 'dept-1' }] }); // resolveFacultyContext

    const result = await getAnnouncementById('ann-uuid-1', 'faculty-user', 'faculty');
    expect(result.title).toBe('Exam Schedule Released');
  });

  it('faculty can view Department Specific announcements for their department', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [ANN_DEPT_ROW] })
      .mockResolvedValueOnce({ rows: [{ department_id: 'dept-uuid-1' }] }); // same dept

    const result = await getAnnouncementById('ann-uuid-2', 'faculty-user', 'faculty');
    expect(result.departmentName).toBe('Computer Science');
  });

  it('faculty cannot view Department Specific announcements for a different department', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [ANN_DEPT_ROW] })
      .mockResolvedValueOnce({ rows: [{ department_id: 'dept-uuid-OTHER' }] }); // different dept

    await expect(
      getAnnouncementById('ann-uuid-2', 'faculty-user', 'faculty')
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('faculty cannot view Semester Specific announcements', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [ANN_SEM_ROW] })
      .mockResolvedValueOnce({ rows: [{ department_id: 'dept-1' }] });

    await expect(
      getAnnouncementById('ann-uuid-3', 'faculty-user', 'faculty')
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('faculty cannot view Draft announcements', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [ANN_DRAFT_ROW] });

    await expect(
      getAnnouncementById('ann-uuid-4', 'faculty-user', 'faculty')
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('student can view Semester Specific announcements matching their semester', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [ANN_SEM_ROW] })
      .mockResolvedValueOnce({ rows: [{ semester: 3, department_id: 'dept-1' }] }); // semester matches

    const result = await getAnnouncementById('ann-uuid-3', 'student-user', 'student');
    expect(result.semester).toBe(3);
  });

  it('student cannot view Semester Specific announcements for a different semester', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [ANN_SEM_ROW] })
      .mockResolvedValueOnce({ rows: [{ semester: 5, department_id: 'dept-1' }] }); // different semester

    await expect(
      getAnnouncementById('ann-uuid-3', 'student-user', 'student')
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('student cannot view Faculty-targeted announcements', async () => {
    const facultyAnn = { ...ANN_ROW, target_audience: 'Faculty' };
    mockQuery
      .mockResolvedValueOnce({ rows: [facultyAnn] })
      .mockResolvedValueOnce({ rows: [{ semester: 3, department_id: 'dept-1' }] });

    await expect(
      getAnnouncementById('ann-uuid-1', 'student-user', 'student')
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 404 when announcement does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(
      getAnnouncementById('missing', 'admin-user', 'admin')
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── listAnnouncements ─────────────────────────────────────────────────────────

describe('listAnnouncements', () => {
  const base = { page: 1, limit: 20 };

  it('admin: runs auto-expire then returns all announcements with pagination', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })             // UPDATE expired
      .mockResolvedValueOnce({ rows: [ANN_LIST_ROW] }); // SELECT

    const result = await listAnnouncements(base, 'admin-user', 'admin');
    expect(result.announcements).toHaveLength(1);
    expect(result.pagination.total).toBe(8);

    const expireSql = mockQuery.mock.calls[0][0] as string;
    expect(expireSql).toContain("status = 'Expired'");
    expect(expireSql).toContain('expiry_date < CURRENT_DATE');
  });

  it('admin: does not add status restriction — can see Draft, Published, Expired', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await listAnnouncements(base, 'admin-user', 'admin');

    const listSql = mockQuery.mock.calls[1][0] as string;
    // Admin query should NOT hardcode "status = 'Published'"
    expect(listSql).not.toContain("a.status = 'Published'");
  });

  it('faculty: restricts to Published and visible audiences', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })                               // auto-expire
      .mockResolvedValueOnce({ rows: [{ department_id: 'dept-1' }] })   // resolveFacultyContext
      .mockResolvedValueOnce({ rows: [ANN_LIST_ROW] });                  // SELECT

    const result = await listAnnouncements(base, 'faculty-user', 'faculty');
    expect(result.announcements).toHaveLength(1);

    const listSql = mockQuery.mock.calls[2][0] as string;
    expect(listSql).toContain("a.status = 'Published'");
    expect(listSql).toContain("a.target_audience = 'Faculty'");
  });

  it('student: restricts to Published and includes Semester Specific', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })                                           // auto-expire
      .mockResolvedValueOnce({ rows: [{ semester: 3, department_id: 'dept-1' }] })  // resolveStudentContext
      .mockResolvedValueOnce({ rows: [] });                                           // SELECT

    await listAnnouncements(base, 'student-user', 'student');

    const listSql = mockQuery.mock.calls[2][0] as string;
    expect(listSql).toContain("a.status = 'Published'");
    expect(listSql).toContain("a.target_audience = 'Students'");
    expect(listSql).toContain("target_audience = 'Semester Specific'");
  });

  it('applies priority filter for all roles', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await listAnnouncements({ ...base, priority: 'Urgent' }, 'admin-user', 'admin');

    const listSql = mockQuery.mock.calls[1][0] as string;
    expect(listSql).toContain('a.priority =');
  });

  it('applies title search filter', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await listAnnouncements({ ...base, search: 'exam' }, 'admin-user', 'admin');

    const listSql = mockQuery.mock.calls[1][0] as string;
    expect(listSql).toContain('ILIKE');
  });

  it('orders by priority (Urgent first)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await listAnnouncements(base, 'admin-user', 'admin');

    const listSql = mockQuery.mock.calls[1][0] as string;
    expect(listSql).toContain("WHEN 'Urgent' THEN 1");
  });

  it('returns empty result when no announcements match', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await listAnnouncements(base, 'admin-user', 'admin');
    expect(result.announcements).toHaveLength(0);
    expect(result.pagination.total).toBe(0);
  });
});

// ── createAnnouncement ────────────────────────────────────────────────────────

describe('createAnnouncement', () => {
  const BASE_INPUT = {
    title: 'Mid Exam Schedule',
    content: 'Exams begin July 15th.',
    targetAudience: 'All' as const,
    priority: 'High' as const,
    publishDate: '2026-07-01',
  };

  it('creates an announcement with Draft status', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'ann-uuid-1' }] })  // INSERT
      .mockResolvedValueOnce({ rows: [ANN_ROW] });               // getAnnouncementById (reread)

    const result = await createAnnouncement(BASE_INPUT, 'admin-user');
    expect(result.id).toBe('ann-uuid-1');

    const insertSql = mockQuery.mock.calls[0][0] as string;
    expect(insertSql).toContain("'Draft'");
  });

  it('validates department existence for Department Specific announcements', async () => {
    const deptInput = { ...BASE_INPUT, targetAudience: 'Department Specific' as const, departmentId: 'dept-uuid-1' };

    mockQuery
      .mockResolvedValueOnce({ rows: [] });  // department check fails

    await expect(
      createAnnouncement(deptInput, 'admin-user')
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('creates Department Specific announcement when department exists', async () => {
    const deptInput = { ...BASE_INPUT, targetAudience: 'Department Specific' as const, departmentId: 'dept-uuid-1' };

    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'dept-uuid-1' }] })  // department check
      .mockResolvedValueOnce({ rows: [{ id: 'ann-uuid-2' }] })   // INSERT
      .mockResolvedValueOnce({ rows: [ANN_DEPT_ROW] });           // getAnnouncementById

    const result = await createAnnouncement(deptInput, 'admin-user');
    expect(result.targetAudience).toBe('Department Specific');
  });
});

// ── updateAnnouncement ────────────────────────────────────────────────────────

describe('updateAnnouncement', () => {
  it('updates title and priority on any announcement', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'ann-uuid-1' }] })   // exists check
      .mockResolvedValueOnce({ rows: [] })                         // UPDATE
      .mockResolvedValueOnce({ rows: [{ ...ANN_ROW, title: 'Updated Title' }] }); // reread

    const result = await updateAnnouncement(
      'ann-uuid-1',
      { title: 'Updated Title', priority: 'Urgent' },
      'admin-user'
    );
    expect(result.title).toBe('Updated Title');
  });

  it('throws 404 when announcement does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await expect(
      updateAnnouncement('missing', { title: 'x' }, 'admin-user')
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── updateAnnouncementStatus ──────────────────────────────────────────────────

describe('updateAnnouncementStatus', () => {
  it('transitions Draft → Published', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ status: 'Draft' }] })
      .mockResolvedValueOnce({ rows: [] })                          // UPDATE
      .mockResolvedValueOnce({ rows: [{ ...ANN_ROW, status: 'Published' }] }); // reread

    const result = await updateAnnouncementStatus('ann-uuid-1', 'Published', 'admin-user');
    expect(result.status).toBe('Published');
  });

  it('transitions Published → Expired', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ status: 'Published' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...ANN_ROW, status: 'Expired' }] });

    const result = await updateAnnouncementStatus('ann-uuid-1', 'Expired', 'admin-user');
    expect(result.status).toBe('Expired');
  });

  it('transitions Expired → Published (republish)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ status: 'Expired' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...ANN_ROW, status: 'Published' }] });

    const result = await updateAnnouncementStatus('ann-uuid-1', 'Published', 'admin-user');
    expect(result.status).toBe('Published');
  });

  it('transitions Published → Draft (unpublish)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ status: 'Published' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [ANN_DRAFT_ROW] });

    const result = await updateAnnouncementStatus('ann-uuid-1', 'Draft', 'admin-user');
    expect(result.status).toBe('Draft');
  });

  it('throws 400 when announcement is already in the target status', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ status: 'Published' }] });

    await expect(
      updateAnnouncementStatus('ann-uuid-1', 'Published', 'admin-user')
    ).rejects.toMatchObject({ statusCode: 400, code: 'ALREADY_IN_STATUS' });
  });

  it('throws 404 when announcement does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await expect(
      updateAnnouncementStatus('missing', 'Published', 'admin-user')
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── deleteAnnouncement ────────────────────────────────────────────────────────

describe('deleteAnnouncement', () => {
  it('soft-deletes an existing announcement', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'ann-uuid-1' }] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(deleteAnnouncement('ann-uuid-1', 'admin-user')).resolves.toBeUndefined();

    const deleteSql = mockQuery.mock.calls[1][0] as string;
    expect(deleteSql).toContain('deleted_at = NOW()');
  });

  it('throws 404 when announcement does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await expect(deleteAnnouncement('missing', 'admin-user')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
