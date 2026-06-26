import {
  uploadDocument,
  getDocumentById,
  listDocuments,
  deleteDocument,
} from '../services/document.service';

// ── Module mocks ───────────────────────────────────────────────────────────────

const mockQuery = jest.fn();

jest.mock('../config/database', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

jest.mock('../utils/audit', () => ({
  auditLog: jest.fn().mockResolvedValue(undefined),
}));

// fs is used in the service for readFileSync (extraction) and unlinkSync (delete)
jest.mock('fs', () => ({
  readFileSync: jest.fn().mockReturnValue(Buffer.from('fake pdf bytes')),
  unlinkSync:   jest.fn(),
}));

// pdf-parse is dynamically required inside extractPdfText
jest.mock('pdf-parse', () =>
  jest.fn().mockResolvedValue({ text: 'Academic Calendar\nSemester I starts June 15' })
);

// ── Fixtures ───────────────────────────────────────────────────────────────────

const DOC_ROW = {
  id:               'doc-uuid-1',
  title:            'Academic Calendar 2026-27',
  file_name:        'calendar.pdf',
  file_path:        '/uploads/documents/uuid-calendar.pdf',
  document_type:    'Academic Calendar',
  extracted_text:   'Academic Calendar\nSemester I starts June 15',
  upload_date:      '2026-06-19',
  uploaded_by:      'admin-user-uuid',
  uploaded_by_name: 'Admin User',
  status:           'Processed',
  created_at:       new Date('2026-06-19'),
  updated_at:       new Date('2026-06-19'),
};

const DOC_ROW_UPLOADED = { ...DOC_ROW, status: 'Uploaded', extracted_text: null };

const DOC_LIST_ROW = { ...DOC_ROW, total_count: '5' };

beforeEach(() => {
  mockQuery.mockReset();
  jest.clearAllMocks();
});

// ── uploadDocument ─────────────────────────────────────────────────────────────

describe('uploadDocument', () => {
  const INPUT = { title: 'Academic Calendar 2026-27', documentType: 'Academic Calendar' as const };

  it('inserts record, extracts text, updates to Processed, returns DocumentDetail', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'doc-uuid-1' }] })  // INSERT
      .mockResolvedValueOnce({ rows: [] })                        // UPDATE extracted_text
      .mockResolvedValueOnce({ rows: [DOC_ROW] });               // getDocumentById SELECT

    const result = await uploadDocument(
      INPUT,
      '/uploads/documents/uuid-calendar.pdf',
      'calendar.pdf',
      'admin-user-uuid'
    );

    expect(result.status).toBe('Processed');
    expect(result.extractedText).toBe('Academic Calendar\nSemester I starts June 15');
    expect(result.documentType).toBe('Academic Calendar');

    // INSERT SQL should use 'Academic Calendar' document type
    const insertSql = mockQuery.mock.calls[0][0] as string;
    expect(insertSql).toContain('INSERT INTO documents');

    // UPDATE SQL should set extracted_text and status='Processed'
    const updateSql = mockQuery.mock.calls[1][0] as string;
    expect(updateSql).toContain("status = 'Processed'");
    expect(updateSql).toContain('extracted_text');
  });

  it('stores the original filename provided by multer', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'doc-uuid-1' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [DOC_ROW] });

    await uploadDocument(INPUT, '/uploads/uuid.pdf', 'my-calendar.pdf', 'admin-user-uuid');

    const insertParams = mockQuery.mock.calls[0][1] as unknown[];
    // Params: [title, fileName, filePath, documentType, userId]
    expect(insertParams[1]).toBe('my-calendar.pdf');
    expect(insertParams[2]).toBe('/uploads/uuid.pdf');
  });

  it('keeps status Uploaded when pdf-parse fails', async () => {
    // Override pdf-parse mock to throw for this test
    const pdfParse = require('pdf-parse') as jest.Mock;
    pdfParse.mockRejectedValueOnce(new Error('Encrypted PDF'));

    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'doc-uuid-1' }] })  // INSERT
      // no UPDATE because extraction failed
      .mockResolvedValueOnce({ rows: [DOC_ROW_UPLOADED] });      // getDocumentById

    const result = await uploadDocument(INPUT, '/uploads/uuid.pdf', 'calendar.pdf', 'admin-uuid');

    // No UPDATE call — only INSERT then SELECT
    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(result.status).toBe('Uploaded');
    expect(result.extractedText).toBeNull();
  });

  it('keeps status Uploaded when readFileSync fails', async () => {
    const fs = require('fs') as { readFileSync: jest.Mock };
    fs.readFileSync.mockImplementationOnce(() => { throw new Error('ENOENT'); });

    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'doc-uuid-1' }] })
      .mockResolvedValueOnce({ rows: [DOC_ROW_UPLOADED] });

    const result = await uploadDocument(INPUT, '/bad/path.pdf', 'calendar.pdf', 'admin-uuid');

    expect(result.status).toBe('Uploaded');
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });
});

// ── getDocumentById ────────────────────────────────────────────────────────────

describe('getDocumentById', () => {
  it('returns DocumentDetail with extractedText', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [DOC_ROW] });

    const result = await getDocumentById('doc-uuid-1');

    expect(result.id).toBe('doc-uuid-1');
    expect(result.extractedText).toBe('Academic Calendar\nSemester I starts June 15');
    expect(result.status).toBe('Processed');

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('extracted_text');
  });

  it('returns document with null extractedText when not yet processed', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [DOC_ROW_UPLOADED] });

    const result = await getDocumentById('doc-uuid-1');

    expect(result.status).toBe('Uploaded');
    expect(result.extractedText).toBeNull();
  });

  it('throws 404 when document does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await expect(getDocumentById('missing-id')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

// ── listDocuments ──────────────────────────────────────────────────────────────

describe('listDocuments', () => {
  const base = { page: 1, limit: 20 };

  it('returns paginated summary list (no extractedText column)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [DOC_LIST_ROW] });

    const result = await listDocuments(base);

    expect(result.documents).toHaveLength(1);
    expect(result.pagination.total).toBe(5);
    expect(result.pagination.totalPages).toBe(1);

    // Summary columns — extractedText should NOT be in the list query SELECT
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).not.toContain('d.extracted_text');
  });

  it('applies status filter', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await listDocuments({ ...base, status: 'Processed' });

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('d.status =');
  });

  it('applies documentType filter', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await listDocuments({ ...base, documentType: 'Academic Calendar' });

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('d.document_type =');
  });

  it('applies title search filter with ILIKE', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await listDocuments({ ...base, search: '2026' });

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('ILIKE');

    const params = mockQuery.mock.calls[0][1] as unknown[];
    expect(params).toContain('%2026%');
  });

  it('orders results by created_at DESC', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await listDocuments(base);

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('created_at DESC');
  });

  it('returns zero total when no documents match', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await listDocuments(base);

    expect(result.documents).toHaveLength(0);
    expect(result.pagination.total).toBe(0);
  });

  it('computes correct pagination offset for page 2', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await listDocuments({ page: 2, limit: 10 });

    const params = mockQuery.mock.calls[0][1] as unknown[];
    // limit=$N-1, offset=$N → last two params are [10, 10]
    expect(params[params.length - 2]).toBe(10);  // limit
    expect(params[params.length - 1]).toBe(10);  // offset (page-1)*limit = (2-1)*10
  });
});

// ── deleteDocument ─────────────────────────────────────────────────────────────

describe('deleteDocument', () => {
  it('soft-deletes DB record and removes physical file', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'doc-uuid-1', file_path: '/uploads/uuid.pdf' }] })
      .mockResolvedValueOnce({ rows: [] });

    await deleteDocument('doc-uuid-1', 'admin-user-uuid');

    // DB soft-delete
    const updateSql = mockQuery.mock.calls[1][0] as string;
    expect(updateSql).toContain('deleted_at = NOW()');

    // Physical file removed
    const fs = require('fs') as { unlinkSync: jest.Mock };
    expect(fs.unlinkSync).toHaveBeenCalledWith('/uploads/uuid.pdf');
  });

  it('throws 404 when document does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await expect(deleteDocument('missing', 'admin-uuid')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('does not propagate error when physical file is already missing', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'doc-uuid-1', file_path: '/uploads/gone.pdf' }] })
      .mockResolvedValueOnce({ rows: [] });

    const fs = require('fs') as { unlinkSync: jest.Mock };
    fs.unlinkSync.mockImplementationOnce(() => { throw new Error('ENOENT'); });

    // Should resolve without throwing even though unlinkSync failed
    await expect(deleteDocument('doc-uuid-1', 'admin-uuid')).resolves.toBeUndefined();
  });
});
