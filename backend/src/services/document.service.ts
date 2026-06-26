import fs from 'fs';
import { query } from '../config/database';
import { auditLog } from '../utils/audit';
import { AppError } from '../errors/AppError';
import type {
  DocumentDetail,
  DocumentSummary,
  DocumentType,
  DocumentStatus,
  UploadDocumentInput,
  ListDocumentsQuery,
  PaginatedDocuments,
} from '../types/document';

// ── Row types ──────────────────────────────────────────────────────────────────

interface DocumentRow {
  id: string;
  title: string;
  file_name: string;
  file_path: string;
  document_type: DocumentType;
  extracted_text: string | null;
  upload_date: string;          // TO_CHAR output
  uploaded_by: string;
  uploaded_by_name: string;
  status: DocumentStatus;
  created_at: Date;
  updated_at: Date;
}

interface DocumentListRow extends DocumentRow {
  total_count: string;
}

// ── Shared query fragments ─────────────────────────────────────────────────────

const SUMMARY_COLS = `
  d.id,
  d.title,
  d.file_name,
  d.file_path,
  d.document_type,
  TO_CHAR(d.upload_date, 'YYYY-MM-DD') AS upload_date,
  d.uploaded_by,
  u.full_name                           AS uploaded_by_name,
  d.status,
  d.created_at,
  d.updated_at
`;

const DETAIL_COLS = `${SUMMARY_COLS}, d.extracted_text`;

const BASE_JOIN = `JOIN users u ON u.id = d.uploaded_by`;

// ── PDF text extraction ────────────────────────────────────────────────────────

/**
 * Extracts raw text from a PDF file using pdf-parse.
 * Returns null on any failure (password-protected, corrupt, or empty PDF)
 * so the upload is never blocked by extraction errors.
 */
async function extractPdfText(filePath: string): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;
    const buffer = fs.readFileSync(filePath);
    const { text } = await pdfParse(buffer);
    const trimmed = text?.trim();
    return trimmed || null;
  } catch {
    return null;
  }
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function toSummary(r: DocumentRow): DocumentSummary {
  return {
    id:             r.id,
    title:          r.title,
    fileName:       r.file_name,
    filePath:       r.file_path,
    documentType:   r.document_type,
    uploadDate:     r.upload_date,
    uploadedBy:     r.uploaded_by,
    uploadedByName: r.uploaded_by_name,
    status:         r.status,
    createdAt:      r.created_at,
    updatedAt:      r.updated_at,
  };
}

function toDetail(r: DocumentRow): DocumentDetail {
  return { ...toSummary(r), extractedText: r.extracted_text };
}

// ── Read operations ────────────────────────────────────────────────────────────

export async function getDocumentById(id: string): Promise<DocumentDetail> {
  const { rows } = await query<DocumentRow>(
    `SELECT ${DETAIL_COLS}
     FROM documents d ${BASE_JOIN}
     WHERE d.id = $1 AND d.deleted_at IS NULL`,
    [id]
  );
  if (!rows[0]) throw AppError.notFound('Document not found');
  return toDetail(rows[0]);
}

export async function listDocuments(filters: ListDocumentsQuery): Promise<PaginatedDocuments> {
  const conditions: string[] = ['d.deleted_at IS NULL'];
  const params: unknown[] = [];

  if (filters.status) {
    params.push(filters.status);
    conditions.push(`d.status = $${params.length}`);
  }
  if (filters.documentType) {
    params.push(filters.documentType);
    conditions.push(`d.document_type = $${params.length}`);
  }
  if (filters.search) {
    params.push(`%${filters.search}%`);
    conditions.push(`d.title ILIKE $${params.length}`);
  }

  const offset = (filters.page - 1) * filters.limit;
  params.push(filters.limit, offset);

  const { rows } = await query<DocumentListRow>(
    `SELECT ${SUMMARY_COLS}, COUNT(*) OVER() AS total_count
     FROM documents d ${BASE_JOIN}
     WHERE ${conditions.join(' AND ')}
     ORDER BY d.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const total = rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0;

  return {
    documents: rows.map(toSummary),
    pagination: {
      page:       filters.page,
      limit:      filters.limit,
      total,
      totalPages: Math.ceil(total / filters.limit),
    },
  };
}

// ── Write operations ───────────────────────────────────────────────────────────

/**
 * Persists an uploaded PDF and attempts immediate text extraction.
 *
 * Flow:
 *  1. INSERT with status='Uploaded' (ensures the record exists even if extraction fails)
 *  2. Run pdf-parse on the saved file
 *  3. If extraction succeeds → UPDATE status='Processed' and store extracted_text
 *  4. Return the full DocumentDetail via getDocumentById
 *
 * Extraction failures are silent: the document remains at status='Uploaded' and
 * extracted_text stays NULL. Phase 2 can re-attempt extraction on Uploaded records.
 */
export async function uploadDocument(
  data: UploadDocumentInput,
  filePath: string,
  fileName: string,
  userId: string
): Promise<DocumentDetail> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO documents (title, file_name, file_path, document_type, uploaded_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [data.title, fileName, filePath, data.documentType, userId]
  );
  const id = rows[0].id;

  const extractedText = await extractPdfText(filePath);

  if (extractedText !== null) {
    await query(
      `UPDATE documents
       SET extracted_text = $1, status = 'Processed', updated_at = NOW()
       WHERE id = $2`,
      [extractedText, id]
    );
  }

  await auditLog({
    actorId:    userId,
    action:     'UPLOAD_DOCUMENT',
    resource:   'documents',
    resourceId: id,
    changes:    { title: data.title, documentType: data.documentType, fileName },
  });

  return getDocumentById(id);
}

/**
 * Soft-deletes the document record and removes the physical PDF from disk.
 * Disk removal happens after the DB update so the record is always consistent.
 * A missing physical file (already cleaned up externally) is not treated as an error.
 */
export async function deleteDocument(id: string, userId: string): Promise<void> {
  const { rows } = await query<{ id: string; file_path: string }>(
    'SELECT id, file_path FROM documents WHERE id = $1 AND deleted_at IS NULL',
    [id]
  );
  if (!rows[0]) throw AppError.notFound('Document not found');

  const { file_path: physicalPath } = rows[0];

  await query(
    'UPDATE documents SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1',
    [id]
  );

  try {
    fs.unlinkSync(physicalPath);
  } catch {
    // Physical file already gone — DB record is the source of truth
  }

  await auditLog({
    actorId:    userId,
    action:     'DELETE_DOCUMENT',
    resource:   'documents',
    resourceId: id,
    changes:    {},
  });
}
