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

export const IMPORT_MODES = ['merge', 'replace'] as const;
export type ImportMode = (typeof IMPORT_MODES)[number];

export const IMPORT_ROW_ACTIONS = ['create', 'update', 'skip'] as const;
export type ImportRowAction = (typeof IMPORT_ROW_ACTIONS)[number];

export interface ImportRowError {
  rowNumber: number;
  identifier: string;
  errors: string[];
}

export type Distribution = Record<string, number>;

export interface ImportSummary {
  total: number;
  valid: number;
  invalid: number;
  duplicate: number;
  toCreate: number;
  toUpdate: number;
  distributions: Record<string, Distribution>;
  ignoredColumns: string[];
}

export interface ImportPreviewResult<TValidRow> {
  jobId: string;
  entityType: ImportEntityType;
  mode: ImportMode;
  validRows: TValidRow[];
  invalidRows: ImportRowError[];
  summary: ImportSummary;
}

export interface ImportCommitResult {
  jobId: string;
  entityType: ImportEntityType;
  mode: ImportMode;
  status: 'completed' | 'failed' | 'rolled_back';
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  deleted?: Record<string, number>;
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
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface ReplaceImpact {
  entityType: ImportEntityType;
  counts: Record<string, number>;
  protectedTables: string[];
}
