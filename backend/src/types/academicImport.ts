import { z } from 'zod';

// ── Shared, entity-agnostic import types ────────────────────────────────────────
// Every future importer (Faculty, Subjects, Curriculum, Teaching Assignments,
// Departments, Classrooms, Timetable, Examination Schedule) reuses these same
// shapes — only a new ImportStrategy implementation is required, never a new
// pipeline, transaction manager, or API surface.

export const IMPORT_ENTITY_TYPES = [
  'student',
  'faculty',
  'subject',
  'curriculum',
  'teaching_assignment',
  'department',
  'classroom',
  'timetable',
  'examination_schedule',
] as const;
export type ImportEntityType = (typeof IMPORT_ENTITY_TYPES)[number];

export const IMPORT_JOB_STATUSES = ['previewed', 'committing', 'completed', 'failed', 'rolled_back'] as const;
export type ImportJobStatus = (typeof IMPORT_JOB_STATUSES)[number];

// 'merge' keeps existing rows and updates matches by natural key (roll
// number for students); 'replace' wipes the entity's existing data first
// (see ImportStrategy.deleteForReplace) — both share the same parse/
// validate/preview/commit pipeline, only row categorization and the
// pre-commit deletion step differ.
export const IMPORT_MODES = ['merge', 'replace'] as const;
export type ImportMode = (typeof IMPORT_MODES)[number];

export const IMPORT_ROW_ACTIONS = ['create', 'update', 'skip'] as const;
export type ImportRowAction = (typeof IMPORT_ROW_ACTIONS)[number];

/** One validation failure attached to a specific source row. */
export interface ImportRowError {
  rowNumber: number;
  identifier: string; // human-readable row key (roll number, employee number, subject code, ...)
  errors: string[];
}

/** Distribution breakdown used by preview summaries (Part "PREVIEW MODE"). */
export type Distribution = Record<string, number>;

export interface ImportSummary {
  total: number;
  valid: number;
  invalid: number;
  duplicate: number;
  toCreate: number;
  toUpdate: number;
  distributions: Record<string, Distribution>;
  /** Recognized-but-unused source columns (e.g. Aadhaar, Address) — "Ignored for Privacy". */
  ignoredColumns: string[];
}

/** Result of the parse+validate phase — nothing is written to the DB yet. */
export interface ImportPreviewResult<TValidRow> {
  jobId: string;
  entityType: ImportEntityType;
  mode: ImportMode;
  validRows: TValidRow[]; // rows to create or update (see each row's `action`)
  invalidRows: ImportRowError[];
  summary: ImportSummary;
}

/** Result of the commit phase. */
export interface ImportCommitResult {
  jobId: string;
  entityType: ImportEntityType;
  mode: ImportMode;
  status: Extract<ImportJobStatus, 'completed' | 'failed' | 'rolled_back'>;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  deleted?: Record<string, number>; // populated for mode='replace'
  errorMessage?: string;
}

export interface ImportJob {
  id: string;
  entityType: ImportEntityType;
  mode: ImportMode;
  status: ImportJobStatus;
  fileName: string | null;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  createdCount: number;
  updatedCount: number;
  summary: ImportSummary | null;
  errorMessage: string | null;
  createdBy: string;
  createdByName?: string;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

export const commitImportSchema = z
  .object({
    jobId: z.string().uuid('Invalid import job ID'),
    mode: z.enum(IMPORT_MODES).default('merge'),
    rows: z.array(z.record(z.string(), z.unknown())).min(1, 'No rows to commit'),
    // Required (and must literally be true) when mode === 'replace' — the
    // backend re-validates this rather than trusting the frontend dialog,
    // since this triggers irreversible deletion of existing student data.
    confirmReplace: z.boolean().optional(),
  })
  .refine((data) => data.mode !== 'replace' || data.confirmReplace === true, {
    message: 'Replace mode requires explicit confirmReplace: true',
    path: ['confirmReplace'],
  });
export type CommitImportInput = z.infer<typeof commitImportSchema>;

export const listImportJobsQuerySchema = z.object({
  entityType: z.enum(IMPORT_ENTITY_TYPES).optional(),
  status: z.enum(IMPORT_JOB_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListImportJobsQuery = z.infer<typeof listImportJobsQuerySchema>;

/** Read-only counts shown in the Replace-mode confirmation dialog before any deletion happens. */
export interface ReplaceImpact {
  entityType: ImportEntityType;
  counts: Record<string, number>;
  protectedTables: string[];
}
