import { z } from 'zod';

// ── Enums ──────────────────────────────────────────────────────────────────────

export const DOCUMENT_TYPES = ['Academic Calendar'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_STATUSES = ['Uploaded', 'Processed'] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

// ── Domain interfaces ──────────────────────────────────────────────────────────

/**
 * Returned in list responses — extracted_text excluded to keep payloads small.
 */
export interface DocumentSummary {
  id: string;
  title: string;
  fileName: string;
  filePath: string;
  documentType: DocumentType;
  uploadDate: string;        // YYYY-MM-DD
  uploadedBy: string;        // user UUID — FK anchor for future access controls
  uploadedByName: string;
  status: DocumentStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Returned in detail / single-get responses — includes the raw extracted text.
 * Future phases will derive calendar_events from this field.
 */
export interface DocumentDetail extends DocumentSummary {
  extractedText: string | null;
}

export interface PaginatedDocuments {
  documents: DocumentSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ── Validation schemas ─────────────────────────────────────────────────────────

/**
 * Body fields for POST /api/documents/upload (multipart/form-data).
 * The PDF file itself is validated by the multer middleware.
 */
export const uploadDocumentSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255).trim(),
  documentType: z.enum(DOCUMENT_TYPES),
});

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;

export const listDocumentsQuerySchema = z.object({
  page:         z.coerce.number().int().min(1).default(1),
  limit:        z.coerce.number().int().min(1).max(1000).default(20),
  status:       z.enum(DOCUMENT_STATUSES).optional(),
  documentType: z.enum(DOCUMENT_TYPES).optional(),
  search:       z.string().max(100).trim().optional(),
});

export type ListDocumentsQuery = z.infer<typeof listDocumentsQuerySchema>;
