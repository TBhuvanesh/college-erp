import { query } from '../config/database';
import { auditLog } from '../utils/audit';
import { AppError } from '../errors/AppError';
import { emitWorkflowEvent } from './workflowEngine.service';
import { getImportStrategy } from '../import/strategyRegistry';
import { runValidationPipeline } from '../import/ValidationPipeline';
import { commitInChunks } from '../import/ImportTransactionManager';
import type { ActionedRow } from '../import/ImportStrategy';
import type {
  ImportEntityType,
  ImportJob,
  ImportMode,
  ImportPreviewResult,
  ImportCommitResult,
  ImportSummary,
  ListImportJobsQuery,
  ReplaceImpact,
} from '../types/academicImport';

// ── ImportService — the single orchestrator every entity's import flows
// through. Adding a new importer never touches this file: it only needs a
// new ImportStrategy registered in strategyRegistry.ts. ─────────────────────

interface ImportJobRow {
  id: string;
  entity_type: ImportEntityType;
  mode: ImportMode;
  status: ImportJob['status'];
  file_name: string | null;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  duplicate_rows: number;
  created_count: number;
  updated_count: number;
  summary: ImportSummary | null;
  error_message: string | null;
  created_by: string;
  created_by_name: string | null;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
}

function toJob(r: ImportJobRow): ImportJob {
  return {
    id: r.id,
    entityType: r.entity_type,
    mode: r.mode,
    status: r.status,
    fileName: r.file_name,
    totalRows: r.total_rows,
    validRows: r.valid_rows,
    invalidRows: r.invalid_rows,
    duplicateRows: r.duplicate_rows,
    createdCount: r.created_count,
    updatedCount: r.updated_count,
    summary: r.summary,
    errorMessage: r.error_message,
    createdBy: r.created_by,
    createdByName: r.created_by_name ?? undefined,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    createdAt: r.created_at,
  };
}

const JOB_COLS = `
  ij.id, ij.entity_type, ij.mode, ij.status, ij.file_name, ij.total_rows, ij.valid_rows, ij.invalid_rows,
  ij.duplicate_rows, ij.created_count, ij.updated_count, ij.summary, ij.error_message,
  ij.created_by, u.full_name AS created_by_name, ij.started_at, ij.completed_at, ij.created_at
`;

export async function previewImport(
  entityType: ImportEntityType,
  fileBuffer: Buffer,
  fileExtension: string,
  fileName: string,
  mode: ImportMode,
  actorId: string
): Promise<ImportPreviewResult<unknown>> {
  const strategy = getImportStrategy(entityType);

  if (mode === 'replace' && !strategy.deleteForReplace) {
    throw AppError.badRequest(`Replace mode is not supported for entity type '${entityType}'`, 'REPLACE_NOT_SUPPORTED');
  }

  const result = await runValidationPipeline(strategy, fileBuffer, fileExtension, mode);

  const { rows: jobRows } = await query<{ id: string }>(
    `INSERT INTO import_jobs (entity_type, mode, status, file_name, total_rows, valid_rows, invalid_rows, duplicate_rows, summary, created_by)
     VALUES ($1, $2, 'previewed', $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      entityType,
      mode,
      fileName,
      result.totalRows,
      result.validRows.length,
      result.invalidRows.length,
      result.summary.duplicate,
      JSON.stringify(result.summary),
      actorId,
    ]
  );
  const jobId = jobRows[0].id;

  await auditLog({
    actorId,
    action: 'IMPORT_PREVIEWED',
    resource: 'import_jobs',
    resourceId: jobId,
    changes: { entityType, mode, fileName, ...result.summary },
  });

  return {
    jobId,
    entityType,
    mode,
    validRows: result.validRows,
    invalidRows: result.invalidRows,
    summary: result.summary,
  };
}

export async function getReplaceImpact(entityType: ImportEntityType): Promise<ReplaceImpact> {
  const strategy = getImportStrategy(entityType);
  if (!strategy.getReplaceImpact) {
    throw AppError.badRequest(`Replace mode is not supported for entity type '${entityType}'`, 'REPLACE_NOT_SUPPORTED');
  }
  return strategy.getReplaceImpact();
}

export async function commitImport(
  entityType: ImportEntityType,
  jobId: string,
  rows: unknown[],
  mode: ImportMode,
  actorId: string
): Promise<ImportCommitResult> {
  const strategy = getImportStrategy(entityType);

  const { rows: jobRows } = await query<{ id: string; status: string; entity_type: ImportEntityType; mode: ImportMode }>(
    'SELECT id, status, entity_type, mode FROM import_jobs WHERE id = $1',
    [jobId]
  );
  const job = jobRows[0];
  if (!job) throw AppError.notFound('Import job not found');
  if (job.entity_type !== entityType) {
    throw AppError.badRequest('Import job entity type does not match the request', 'IMPORT_ENTITY_MISMATCH');
  }
  if (job.status !== 'previewed') {
    throw AppError.badRequest(`Import job is already '${job.status}' and cannot be committed again`, 'IMPORT_ALREADY_COMMITTED');
  }
  // The mode that matters is the one the preview was actually generated
  // with (it changed how rows were categorized) — reject a mismatched
  // client-supplied mode rather than silently using either one.
  if (job.mode !== mode) {
    throw AppError.badRequest(
      `This import job was previewed in '${job.mode}' mode and cannot be committed as '${mode}'. Preview again with the desired mode.`,
      'IMPORT_MODE_MISMATCH'
    );
  }
  if (rows.length === 0) {
    throw AppError.badRequest('No rows to commit', 'EMPTY_COMMIT');
  }

  await query(`UPDATE import_jobs SET status = 'committing', started_at = NOW() WHERE id = $1`, [jobId]);

  try {
    // Rows are the client-echoed output of the preview response (same
    // trust boundary subjectImport.service.ts's existing commit flow
    // already relies on — the route is admin-only) — cast to the shape the
    // strategy itself produced them in.
    const actionedRows = rows as ActionedRow<unknown>[];
    const commitResult = await commitInChunks(strategy, actionedRows, actorId, mode);

    if (strategy.onJobCompleted) {
      await strategy.onJobCompleted(actionedRows, actorId, jobId);
    }

    await query(
      `UPDATE import_jobs SET status = 'completed', created_count = $1, updated_count = $2, completed_at = NOW() WHERE id = $3`,
      [commitResult.createdCount, commitResult.updatedCount, jobId]
    );

    await auditLog({
      actorId,
      action: 'IMPORT_COMPLETED',
      resource: 'import_jobs',
      resourceId: jobId,
      changes: {
        entityType,
        mode,
        createdCount: commitResult.createdCount,
        updatedCount: commitResult.updatedCount,
        skippedCount: commitResult.skippedCount,
        deleted: commitResult.deleted,
      },
    });

    // One aggregate event per completed job — see migration 046's comment
    // on why this isn't fired per row. Only wired for entity types with a
    // registered DB enum value; future entity types add their own value
    // (and their own trigger, if needed) in their own migration.
    if (entityType === 'student') {
      await emitWorkflowEvent('student_import.completed', actorId, {
        departmentId: '',
        semester: 0,
        title: mode === 'replace' ? 'Student Data Replaced' : 'Student Import Completed',
        message:
          mode === 'replace'
            ? `Demo student data replaced — ${commitResult.createdCount} student(s) imported.`
            : `${commitResult.createdCount} student(s) imported, ${commitResult.updatedCount} updated.`,
        notificationType: 'Announcement',
        sourceId: jobId,
        createdCount: commitResult.createdCount,
        updatedCount: commitResult.updatedCount,
      });
    }

    return {
      jobId,
      entityType,
      mode,
      status: 'completed',
      createdCount: commitResult.createdCount,
      updatedCount: commitResult.updatedCount,
      skippedCount: commitResult.skippedCount,
      deleted: commitResult.deleted,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown import failure';

    // The commit transaction itself already rolled back every row it wrote
    // AND any Replace-mode deletion (ImportTransactionManager wraps the
    // whole job — deletion plus every insert/update chunk — in one
    // withTransaction) — this UPDATE just records that rollback happened,
    // in a fresh query outside the failed transaction.
    await query(
      `UPDATE import_jobs SET status = 'rolled_back', error_message = $1, completed_at = NOW() WHERE id = $2`,
      [errorMessage, jobId]
    );

    await auditLog({
      actorId,
      action: 'IMPORT_ROLLED_BACK',
      resource: 'import_jobs',
      resourceId: jobId,
      changes: { entityType, mode, errorMessage },
    });

    throw AppError.internal(`Import failed and was rolled back: ${errorMessage}`);
  }
}

export async function getImportJob(jobId: string): Promise<ImportJob> {
  const { rows } = await query<ImportJobRow>(
    `SELECT ${JOB_COLS} FROM import_jobs ij LEFT JOIN users u ON u.id = ij.created_by WHERE ij.id = $1`,
    [jobId]
  );
  if (!rows[0]) throw AppError.notFound('Import job not found');
  return toJob(rows[0]);
}

export async function listImportJobs(filters: ListImportJobsQuery): Promise<{ jobs: ImportJob[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  const push = (cond: string, val: unknown) => {
    params.push(val);
    conditions.push(`${cond} $${params.length}`);
  };

  if (filters.entityType) push('ij.entity_type =', filters.entityType);
  if (filters.status) push('ij.status =', filters.status);

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(filters.limit, (filters.page - 1) * filters.limit);

  const { rows } = await query<ImportJobRow & { total_count: string }>(
    `SELECT ${JOB_COLS}, COUNT(*) OVER() AS total_count
     FROM import_jobs ij LEFT JOIN users u ON u.id = ij.created_by
     ${where}
     ORDER BY ij.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const total = rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0;
  return { jobs: rows.map(toJob), total };
}
