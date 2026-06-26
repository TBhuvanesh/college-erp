import {
  getExamById,
  listExams,
  getFacultySchedule,
  getStudentTimetable,
  createExam,
  updateExam,
  updateExamStatus,
  deleteExam,
} from '../services/examination.service';
import { AppError } from '../errors/AppError';

// ── Database mock ──────────────────────────────────────────────────────────────

const mockQuery = jest.fn();

jest.mock('../config/database', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  withTransaction: jest.fn(),
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

const EXAM_ROW = {
  id: 'exam-uuid-1',
  subject_id: 'sub-uuid-1',
  subject_code: 'CS101',
  subject_name: 'Data Structures',
  department_name: 'Computer Science',
  faculty_id: 'fac-uuid-1',
  faculty_name: 'Dr. Jane Doe',
  semester: 3,
  section: 'A',
  exam_type: 'Mid-1',
  exam_date: '2026-07-15',
  start_time: '09:00',
  end_time: '11:00',
  maximum_marks: '50.00',
  status: 'Scheduled',
  created_at: new Date('2026-06-01'),
  updated_at: new Date('2026-06-01'),
};

const EXAM_LIST_ROW = { ...EXAM_ROW, total_count: '5' };

// ── getExamById ────────────────────────────────────────────────────────────────

describe('getExamById', () => {
  it('returns mapped ExamDetail for a found exam', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [EXAM_ROW] });

    const result = await getExamById('exam-uuid-1');

    expect(result.id).toBe('exam-uuid-1');
    expect(result.subjectCode).toBe('CS101');
    expect(result.facultyName).toBe('Dr. Jane Doe');
    expect(result.maximumMarks).toBe(50);
    expect(result.semester).toBe(3);
    expect(result.startTime).toBe('09:00');
  });

  it('throws 404 when exam is not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await expect(getExamById('missing-uuid')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

// ── listExams ─────────────────────────────────────────────────────────────────

describe('listExams', () => {
  const baseFilters = { page: 1, limit: 20 };

  it('returns paginated exams without filters', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [EXAM_LIST_ROW] });

    const result = await listExams(baseFilters);

    expect(result.exams).toHaveLength(1);
    expect(result.pagination.total).toBe(5);
    expect(result.pagination.totalPages).toBe(1);
  });

  it('returns empty result when no exams match', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await listExams(baseFilters);

    expect(result.exams).toHaveLength(0);
    expect(result.pagination.total).toBe(0);
  });

  it('applies semester and section filters', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [EXAM_LIST_ROW] });

    const result = await listExams({ ...baseFilters, semester: 3, section: 'A' });

    expect(result.exams).toHaveLength(1);
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('e.semester =');
    expect(sql).toContain('e.section =');
  });

  it('applies date range filters', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await listExams({ ...baseFilters, dateFrom: '2026-07-01', dateTo: '2026-07-31' });

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('e.exam_date >=');
    expect(sql).toContain('e.exam_date <=');
  });

  it('applies exact date filter', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await listExams({ ...baseFilters, date: '2026-07-15' });

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('e.exam_date =');
  });

  it('applies status and examType filters', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await listExams({ ...baseFilters, status: 'Scheduled', examType: 'Mid-1' });

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('e.status =');
    expect(sql).toContain('e.exam_type =');
  });
});

// ── getFacultySchedule ────────────────────────────────────────────────────────

describe('getFacultySchedule', () => {
  it('returns the faculty member own exams', async () => {
    // resolveFacultyId
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'fac-uuid-1' }] });
    // main query
    mockQuery.mockResolvedValueOnce({ rows: [EXAM_ROW] });

    const result = await getFacultySchedule('user-uuid-1');

    expect(result).toHaveLength(1);
    expect(result[0].examType).toBe('Mid-1');
  });

  it('throws 403 when no faculty profile exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // no faculty profile

    await expect(getFacultySchedule('user-uuid-1')).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});

// ── getStudentTimetable ───────────────────────────────────────────────────────

describe('getStudentTimetable', () => {
  const STUDENT_ROW = { program_id: 'prog-uuid-1', semester: 3, section: 'A' };

  it('returns timetable excluding cancelled exams by default', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [STUDENT_ROW] });
    mockQuery.mockResolvedValueOnce({ rows: [EXAM_ROW] });

    const result = await getStudentTimetable('user-uuid-1');

    expect(result).toHaveLength(1);
    const sql = mockQuery.mock.calls[1][0] as string;
    expect(sql).toContain("status != 'Cancelled'");
  });

  it('filters upcoming exams by date and active statuses', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [STUDENT_ROW] });
    mockQuery.mockResolvedValueOnce({ rows: [EXAM_ROW] });

    await getStudentTimetable('user-uuid-1', 'upcoming');

    const sql = mockQuery.mock.calls[1][0] as string;
    expect(sql).toContain('CURRENT_DATE');
    expect(sql).toContain("status IN ('Scheduled', 'Ongoing')");
  });

  it('throws 403 when no student profile exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await expect(getStudentTimetable('user-uuid-1')).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});

// ── createExam ────────────────────────────────────────────────────────────────

describe('createExam', () => {
  const BASE_INPUT = {
    subjectId: 'sub-uuid-1',
    facultyId: 'fac-uuid-1',
    section: 'A',
    examType: 'Mid-1' as const,
    examDate: '2026-07-15',
    startTime: '09:00',
    endTime: '11:00',
    maximumMarks: 50,
  };

  it('admin creates an exam without assignment check', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ semester: 3 }] })          // subject lookup
      .mockResolvedValueOnce({ rows: [{ id: 'fac-uuid-1' }] })     // faculty lookup
      .mockResolvedValueOnce({ rows: [{ id: 'exam-uuid-1' }] })    // INSERT
      .mockResolvedValueOnce({ rows: [EXAM_ROW] });                 // getExamById

    const result = await createExam(BASE_INPUT, 'admin-user-uuid', 'admin');

    expect(result.id).toBe('exam-uuid-1');
    expect(mockIsFacultyAssigned).not.toHaveBeenCalled();
  });

  it('faculty creates an exam after assignment check passes', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'fac-uuid-1' }] })     // resolveFacultyId
      .mockResolvedValueOnce({ rows: [{ semester: 3 }] })          // subject lookup
      .mockResolvedValueOnce({ rows: [{ id: 'fac-uuid-1' }] })     // faculty lookup
      .mockResolvedValueOnce({ rows: [{ id: 'exam-uuid-1' }] })    // INSERT
      .mockResolvedValueOnce({ rows: [EXAM_ROW] });                 // getExamById

    mockIsFacultyAssigned.mockResolvedValueOnce(true);

    const result = await createExam(BASE_INPUT, 'faculty-user-uuid', 'faculty');

    expect(result.id).toBe('exam-uuid-1');
    expect(mockIsFacultyAssigned).toHaveBeenCalledWith('fac-uuid-1', 'sub-uuid-1', 'A');
  });

  it('throws 403 when faculty is not assigned to the subject', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'fac-uuid-1' }] }); // resolveFacultyId
    mockIsFacultyAssigned.mockResolvedValueOnce(false);

    await expect(
      createExam(BASE_INPUT, 'faculty-user-uuid', 'faculty')
    ).rejects.toMatchObject({ statusCode: 403, code: 'NOT_ASSIGNED' });
  });

  it('throws 400 when faculty schedules an exam in the past', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'fac-uuid-1' }] }); // resolveFacultyId
    mockIsFacultyAssigned.mockResolvedValueOnce(true);

    const pastInput = { ...BASE_INPUT, examDate: '2020-01-01' };

    await expect(
      createExam(pastInput, 'faculty-user-uuid', 'faculty')
    ).rejects.toMatchObject({ statusCode: 400, code: 'PAST_EXAM_DATE' });
  });

  it('throws 404 when subject is not found', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] }); // subject lookup returns nothing

    await expect(
      createExam(BASE_INPUT, 'admin-user-uuid', 'admin')
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── updateExam ────────────────────────────────────────────────────────────────

describe('updateExam', () => {
  it('admin updates an exam that is not in a terminal state', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ faculty_id: 'fac-uuid-1', status: 'Scheduled' }] }) // fetch
      .mockResolvedValueOnce({ rows: [] })                                                    // UPDATE
      .mockResolvedValueOnce({ rows: [EXAM_ROW] });                                           // getExamById

    const result = await updateExam(
      'exam-uuid-1',
      { examDate: '2026-07-20' },
      'admin-user-uuid',
      'admin'
    );

    expect(result.id).toBe('exam-uuid-1');
  });

  it('throws 400 when trying to update a completed exam', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ faculty_id: 'fac-uuid-1', status: 'Completed' }],
    });

    await expect(
      updateExam('exam-uuid-1', { maximumMarks: 60 }, 'admin-user-uuid', 'admin')
    ).rejects.toMatchObject({ statusCode: 400, code: 'EXAM_TERMINAL_STATUS' });
  });

  it('throws 400 when trying to update a cancelled exam', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ faculty_id: 'fac-uuid-1', status: 'Cancelled' }],
    });

    await expect(
      updateExam('exam-uuid-1', { section: 'B' }, 'admin-user-uuid', 'admin')
    ).rejects.toMatchObject({ statusCode: 400, code: 'EXAM_TERMINAL_STATUS' });
  });

  it('throws 403 when faculty tries to update another faculty exam', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ faculty_id: 'fac-uuid-OTHER', status: 'Scheduled' }] }) // fetch exam
      .mockResolvedValueOnce({ rows: [{ id: 'fac-uuid-1' }] });                                 // resolveFacultyId

    await expect(
      updateExam('exam-uuid-1', { examDate: '2026-07-20' }, 'faculty-user-uuid', 'faculty')
    ).rejects.toMatchObject({ statusCode: 403, code: 'NOT_EXAM_OWNER' });
  });

  it('throws 404 when exam does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await expect(
      updateExam('missing-uuid', { maximumMarks: 60 }, 'admin-user-uuid', 'admin')
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── updateExamStatus ──────────────────────────────────────────────────────────

describe('updateExamStatus', () => {
  it('admin transitions Scheduled → Ongoing', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ faculty_id: 'fac-uuid-1', status: 'Scheduled' }] })
      .mockResolvedValueOnce({ rows: [] })                          // UPDATE
      .mockResolvedValueOnce({ rows: [{ ...EXAM_ROW, status: 'Ongoing' }] }); // getExamById

    const result = await updateExamStatus('exam-uuid-1', 'Ongoing', 'admin-uuid', 'admin');

    expect(result.status).toBe('Ongoing');
  });

  it('admin transitions Scheduled → Cancelled', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ faculty_id: 'fac-uuid-1', status: 'Scheduled' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...EXAM_ROW, status: 'Cancelled' }] });

    const result = await updateExamStatus('exam-uuid-1', 'Cancelled', 'admin-uuid', 'admin');

    expect(result.status).toBe('Cancelled');
  });

  it('throws 400 when transitioning from Completed (terminal)', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ faculty_id: 'fac-uuid-1', status: 'Completed' }],
    });

    await expect(
      updateExamStatus('exam-uuid-1', 'Scheduled', 'admin-uuid', 'admin')
    ).rejects.toMatchObject({ statusCode: 400, code: 'EXAM_TERMINAL_STATUS' });
  });

  it('throws 400 when transitioning from Cancelled (terminal)', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ faculty_id: 'fac-uuid-1', status: 'Cancelled' }],
    });

    await expect(
      updateExamStatus('exam-uuid-1', 'Scheduled', 'admin-uuid', 'admin')
    ).rejects.toMatchObject({ statusCode: 400, code: 'EXAM_TERMINAL_STATUS' });
  });

  it('throws 400 when admin uses an invalid transition (Scheduled → Completed)', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ faculty_id: 'fac-uuid-1', status: 'Scheduled' }],
    });

    await expect(
      updateExamStatus('exam-uuid-1', 'Completed', 'admin-uuid', 'admin')
    ).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_TRANSITION' });
  });

  it('faculty can advance Scheduled → Ongoing on own exam', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ faculty_id: 'fac-uuid-1', status: 'Scheduled' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'fac-uuid-1' }] })     // resolveFacultyId
      .mockResolvedValueOnce({ rows: [] })                          // UPDATE
      .mockResolvedValueOnce({ rows: [{ ...EXAM_ROW, status: 'Ongoing' }] });

    const result = await updateExamStatus('exam-uuid-1', 'Ongoing', 'fac-user-uuid', 'faculty');

    expect(result.status).toBe('Ongoing');
  });

  it('throws 403 when faculty tries to cancel an exam', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ faculty_id: 'fac-uuid-1', status: 'Scheduled' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'fac-uuid-1' }] }); // resolveFacultyId

    await expect(
      updateExamStatus('exam-uuid-1', 'Cancelled', 'fac-user-uuid', 'faculty')
    ).rejects.toMatchObject({ statusCode: 403, code: 'INVALID_TRANSITION' });
  });

  it('throws 403 when faculty tries to update another faculty exam status', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ faculty_id: 'fac-uuid-OTHER', status: 'Scheduled' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'fac-uuid-1' }] }); // resolveFacultyId

    await expect(
      updateExamStatus('exam-uuid-1', 'Ongoing', 'fac-user-uuid', 'faculty')
    ).rejects.toMatchObject({ statusCode: 403, code: 'NOT_EXAM_OWNER' });
  });
});

// ── deleteExam ────────────────────────────────────────────────────────────────

describe('deleteExam', () => {
  it('soft-deletes a Scheduled exam', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ status: 'Scheduled' }] }) // fetch
      .mockResolvedValueOnce({ rows: [] });                        // UPDATE deleted_at

    await expect(deleteExam('exam-uuid-1', 'admin-uuid')).resolves.toBeUndefined();
  });

  it('throws 404 when exam does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await expect(deleteExam('missing-uuid', 'admin-uuid')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('throws 400 when trying to delete a Completed exam', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ status: 'Completed' }] });

    await expect(deleteExam('exam-uuid-1', 'admin-uuid')).rejects.toMatchObject({
      statusCode: 400,
      code: 'EXAM_COMPLETED',
    });
  });

  it('allows deleting a Cancelled exam', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ status: 'Cancelled' }] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(deleteExam('exam-uuid-1', 'admin-uuid')).resolves.toBeUndefined();
  });
});
