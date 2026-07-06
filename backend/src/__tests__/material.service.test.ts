import * as materialService from '../services/material.service';

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
const MATERIAL_ID      = 'mat-0000-0000-0000-000000000001';
const SUBJECT_ID       = 'sub-0000-0000-0000-000000000001';

const mockMaterialRow = {
  id:           MATERIAL_ID,
  title:        'Introduction to Algorithms',
  description:  'Unit 1 notes',
  subject_id:   SUBJECT_ID,
  subject_code: 'CS301',
  subject_name: 'Data Structures',
  faculty_id:   FACULTY_ID,
  faculty_name: 'Dr. Smith',
  file_name:    'unit1.pdf',
  file_path:    '/uploads/lms/abc123.pdf',
  file_type:    'pdf',
  file_size:    '204800',
  created_at:   new Date('2026-06-01'),
  updated_at:   new Date('2026-06-01'),
};

const mockFile = {
  originalname: 'unit1.pdf',
  path:         '/uploads/lms/abc123.pdf',
  size:         204800,
  mimetype:     'application/pdf',
} as Express.Multer.File;

// ── Helpers ────────────────────────────────────────────────────────────────────

function resetMocks() {
  mockQuery.mockReset();
}

// ── createMaterial ─────────────────────────────────────────────────────────────

describe('createMaterial', () => {
  beforeEach(resetMocks);

  it('inserts material and returns detail after resolving faculty and checking assignment', async () => {
    // resolveFacultyId
    mockQuery.mockResolvedValueOnce({ rows: [{ id: FACULTY_ID }], rowCount: 1 } as never);
    // assertFacultyAssignedToSubject
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'fsa-id' }], rowCount: 1 } as never);
    // INSERT → returning id
    mockQuery.mockResolvedValueOnce({ rows: [{ id: MATERIAL_ID }], rowCount: 1 } as never);
    // fetchMaterialRow (re-fetch after insert)
    mockQuery.mockResolvedValueOnce({ rows: [mockMaterialRow], rowCount: 1 } as never);

    const result = await materialService.createMaterial(
      FACULTY_USER_ID,
      { title: 'Introduction to Algorithms', description: 'Unit 1 notes', subjectId: SUBJECT_ID },
      mockFile
    );

    expect(result.id).toBe(MATERIAL_ID);
    expect(result.title).toBe('Introduction to Algorithms');
    expect(result.fileType).toBe('pdf');
    expect(result.downloadUrl).toBe(`/api/lms/materials/${MATERIAL_ID}/download`);

    const insertCall = mockQuery.mock.calls[2];
    expect(insertCall[0]).toMatch(/INSERT INTO course_materials/);
    expect(insertCall[1]).toContain(SUBJECT_ID);
    expect(insertCall[1]).toContain(FACULTY_ID);
  });

  it('throws 404 when faculty profile not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await expect(
      materialService.createMaterial(FACULTY_USER_ID, { title: 'T', subjectId: SUBJECT_ID }, mockFile)
    ).rejects.toMatchObject({ statusCode: 404, message: 'Faculty profile not found' });
  });

  it('throws 403 when faculty is not assigned to the subject', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: FACULTY_ID }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await expect(
      materialService.createMaterial(FACULTY_USER_ID, { title: 'T', subjectId: SUBJECT_ID }, mockFile)
    ).rejects.toMatchObject({ statusCode: 403, message: 'You are not assigned to this subject' });
  });
});

// ── listMaterials ──────────────────────────────────────────────────────────────

describe('listMaterials', () => {
  beforeEach(resetMocks);

  it('admin receives all materials without role filter', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...mockMaterialRow, total_count: '1' }],
      rowCount: 1,
    } as never);

    const result = await materialService.listMaterials(
      'admin-user-id',
      'admin',
      { page: 1, limit: 20 }
    );

    expect(result.total).toBe(1);
    expect(result.materials).toHaveLength(1);
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).not.toMatch(/faculty_subject_assignments/);
    expect(sql).not.toMatch(/program_id/);
  });

  it('faculty query includes faculty_subject_assignments EXISTS filter', async () => {
    // resolveFacultyId
    mockQuery.mockResolvedValueOnce({ rows: [{ id: FACULTY_ID }], rowCount: 1 } as never);
    // list query
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await materialService.listMaterials(FACULTY_USER_ID, 'faculty', { page: 1, limit: 20 });

    const listSql = mockQuery.mock.calls[1][0] as string;
    expect(listSql).toMatch(/faculty_subject_assignments/);
  });

  it('student query filters by program_id and semester', async () => {
    // resolveStudentCtx
    mockQuery.mockResolvedValueOnce({
      rows: [{ program_id: 'prog-1', semester: 3 }],
      rowCount: 1,
    } as never);
    // list query
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    const result = await materialService.listMaterials(STUDENT_USER_ID, 'student', { page: 1, limit: 20 });

    expect(result.total).toBe(0);
    const listSql = mockQuery.mock.calls[1][0] as string;
    expect(listSql).toMatch(/program_id/);
    expect(listSql).toMatch(/semester/);
  });

  it('returns empty result when student profile not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    const result = await materialService.listMaterials(STUDENT_USER_ID, 'student', { page: 1, limit: 20 });

    expect(result.materials).toHaveLength(0);
    expect(result.total).toBe(0);
    // No second query issued
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('respects subjectId filter for admin', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await materialService.listMaterials('admin-id', 'admin', { page: 1, limit: 20, subjectId: SUBJECT_ID });

    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/subject_id/);
    expect(params).toContain(SUBJECT_ID);
  });
});

// ── getMaterialById ────────────────────────────────────────────────────────────

describe('getMaterialById', () => {
  beforeEach(resetMocks);

  it('returns material for admin without access check', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockMaterialRow], rowCount: 1 } as never);

    const result = await materialService.getMaterialById('admin-id', 'admin', MATERIAL_ID);

    expect(result.id).toBe(MATERIAL_ID);
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('throws 404 when material does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await expect(
      materialService.getMaterialById('admin-id', 'admin', MATERIAL_ID)
    ).rejects.toMatchObject({ statusCode: 404, message: 'Material not found' });
  });

  it('throws 403 for faculty not assigned to the material subject', async () => {
    // fetchMaterialRow
    mockQuery.mockResolvedValueOnce({ rows: [mockMaterialRow], rowCount: 1 } as never);
    // resolveFacultyId
    mockQuery.mockResolvedValueOnce({ rows: [{ id: FACULTY_ID }], rowCount: 1 } as never);
    // faculty_subject_assignments check → not found
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await expect(
      materialService.getMaterialById(FACULTY_USER_ID, 'faculty', MATERIAL_ID)
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws 403 for student whose semester does not match material subject', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockMaterialRow], rowCount: 1 } as never);
    // student ctx
    mockQuery.mockResolvedValueOnce({ rows: [{ program_id: 'prog-1', semester: 5 }], rowCount: 1 } as never);
    // subject check → no match
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await expect(
      materialService.getMaterialById(STUDENT_USER_ID, 'student', MATERIAL_ID)
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

// ── updateMaterial ─────────────────────────────────────────────────────────────

describe('updateMaterial', () => {
  beforeEach(resetMocks);

  it('updates title without touching the file', async () => {
    // resolveFacultyId
    mockQuery.mockResolvedValueOnce({ rows: [{ id: FACULTY_ID }], rowCount: 1 } as never);
    // fetchMaterialRow
    mockQuery.mockResolvedValueOnce({ rows: [mockMaterialRow], rowCount: 1 } as never);
    // UPDATE
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    // re-fetch
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...mockMaterialRow, title: 'Updated Title' }],
      rowCount: 1,
    } as never);

    const result = await materialService.updateMaterial(
      FACULTY_USER_ID,
      MATERIAL_ID,
      { title: 'Updated Title' },
      null
    );

    expect(result.title).toBe('Updated Title');
    const updateSql = mockQuery.mock.calls[2][0] as string;
    expect(updateSql).toMatch(/UPDATE course_materials/);
    expect(updateSql).not.toMatch(/file_name/);
  });

  it('throws 403 when faculty does not own the material', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'other-faculty-id' }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [mockMaterialRow], rowCount: 1 } as never);

    await expect(
      materialService.updateMaterial(FACULTY_USER_ID, MATERIAL_ID, { title: 'X' }, null)
    ).rejects.toMatchObject({ statusCode: 403, message: 'You do not own this material' });
  });

  it('throws 400 when no fields provided and no file', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: FACULTY_ID }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [mockMaterialRow], rowCount: 1 } as never);

    await expect(
      materialService.updateMaterial(FACULTY_USER_ID, MATERIAL_ID, {}, null)
    ).rejects.toMatchObject({ statusCode: 400, message: 'No fields to update' });
  });
});

// ── deleteMaterial ─────────────────────────────────────────────────────────────

describe('deleteMaterial', () => {
  beforeEach(resetMocks);

  it('soft-deletes DB record and removes file from disk', async () => {
    const fs = require('fs') as { unlinkSync: jest.Mock };

    mockQuery.mockResolvedValueOnce({ rows: [{ id: FACULTY_ID }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [mockMaterialRow], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);

    await materialService.deleteMaterial(FACULTY_USER_ID, MATERIAL_ID);

    const deleteSql = mockQuery.mock.calls[2][0] as string;
    expect(deleteSql).toMatch(/UPDATE course_materials SET deleted_at/);
    expect(fs.unlinkSync).toHaveBeenCalledWith(mockMaterialRow.file_path);
  });

  it('throws 403 when faculty does not own the material', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'other-id' }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [mockMaterialRow], rowCount: 1 } as never);

    await expect(
      materialService.deleteMaterial(FACULTY_USER_ID, MATERIAL_ID)
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws 404 when material does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: FACULTY_ID }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await expect(
      materialService.deleteMaterial(FACULTY_USER_ID, MATERIAL_ID)
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
