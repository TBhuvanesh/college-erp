import type { PoolClient } from 'pg';
import type { ImportEntityType, ImportRowError, ImportSummary, ImportMode, ImportRowAction, ReplaceImpact } from '../types/academicImport';
import type { ParsedSheet } from './ExcelParser';

// Every future importer (Faculty, Subjects, Curriculum, Teaching Assignments,
// Departments, Classrooms, Timetable, Examination Schedule) implements only
// this interface — ImportService, ValidationPipeline, and
// ImportTransactionManager are entity-agnostic and never change.

/** A validated row tagged with what the commit phase will do with it. */
export type ActionedRow<TValidRow> = TValidRow & { action: ImportRowAction };

export interface ValidateRowsResult<TValidRow> {
  validRows: ActionedRow<TValidRow>[]; // action = 'create' | 'update'
  invalidRows: ImportRowError[];
  duplicateCount: number;
  toCreateCount: number;
  toUpdateCount: number;
}

export interface CommitBatchResult {
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  /** Optional per-row output (e.g. generated credentials) surfaced to the API caller. */
  details?: unknown[];
}

export interface ImportStrategy<TValidRow> {
  readonly entityType: ImportEntityType;

  /**
   * Required header labels (with accepted alias spellings) — used both to
   * reject a spreadsheet missing a mandatory column before row-by-row
   * parsing starts, and to build the strategy's own row cell reads.
   */
  readonly requiredHeaders: Array<{ label: string; aliases: string[] }>;

  /**
   * Header aliases this strategy recognizes but deliberately never imports
   * (Aadhaar/Government ID/Address, etc.) — surfaced in preview as
   * "Ignored for Privacy" rather than silently dropped without explanation.
   */
  readonly ignoredHeaders: Array<{ label: string; aliases: string[] }>;

  /**
   * Parses + validates every row of an already-parsed sheet against this
   * entity's business rules (mandatory fields, data types, FK existence,
   * in-file duplicates, DB duplicates, and — for Students specifically —
   * curriculum resolution). Runs entirely against the read-only `query()`
   * helper; nothing is written here.
   *
   * `mode` changes only how an existing-DB-match is categorized: 'merge'
   * tags it `action: 'update'`; 'replace' tags it `action: 'create'` (the
   * existing row will no longer exist by the time commit runs — see
   * deleteForReplace) instead of rejecting it as a duplicate.
   */
  validateRows(sheet: ParsedSheet, mode: ImportMode): Promise<ValidateRowsResult<TValidRow>>;

  /**
   * Builds the distribution breakdowns (department/session/section/etc.)
   * shown in preview mode, keyed by whatever axes make sense for this
   * entity type.
   */
  buildDistributions(validRows: ActionedRow<TValidRow>[]): Record<string, Record<string, number>>;

  /**
   * Inserts/updates one already-validated chunk of rows inside the
   * caller-managed transaction (`client`), branching on each row's
   * `action`. Must not open its own transaction — chunking and the overall
   * commit/rollback boundary are owned by ImportTransactionManager.
   */
  commitChunk(client: PoolClient, rows: ActionedRow<TValidRow>[], actorId: string): Promise<CommitBatchResult>;

  /** Optional hook fired once BEFORE starting the transaction (runs outside transaction) */
  preCommit?(rows: ActionedRow<TValidRow>[]): Promise<void>;

  /** Optional hook fired once after every chunk in the job has committed successfully. */
  onJobCompleted?(rows: ActionedRow<TValidRow>[], actorId: string, jobId: string): Promise<void>;

  /**
   * Read-only counts of what Replace mode would delete for this entity —
   * powers the confirmation dialog. Must not mutate anything.
   */
  getReplaceImpact?(): Promise<ReplaceImpact>;

  /**
   * Deletes this entity's existing data (and only the tables named in
   * getReplaceImpact — never master data) inside the same transaction the
   * subsequent commitChunk calls run in, so a later failure rolls back the
   * deletion too. Returns the actual per-table delete counts for the audit
   * trail and commit response.
   */
  deleteForReplace?(client: PoolClient, actorId: string): Promise<Record<string, number>>;
}

export function summarize<TValidRow>(
  total: number,
  result: ValidateRowsResult<TValidRow>,
  distributions: Record<string, Record<string, number>>,
  ignoredColumns: string[]
): ImportSummary {
  return {
    total,
    valid: result.validRows.length,
    invalid: result.invalidRows.length,
    duplicate: result.duplicateCount,
    toCreate: result.toCreateCount,
    toUpdate: result.toUpdateCount,
    distributions,
    ignoredColumns,
  };
}
