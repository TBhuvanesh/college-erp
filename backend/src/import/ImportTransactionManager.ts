import { withTransaction } from '../config/database';
import type { ImportStrategy, CommitBatchResult, ActionedRow } from './ImportStrategy';
import type { ImportMode } from '../types/academicImport';

// Entity-agnostic chunked-commit orchestrator. Wraps the ENTIRE job (the
// optional Replace-mode deletion, plus every insert/update chunk) in exactly
// one `withTransaction` — chunking exists purely to keep individual SQL
// statements a sane size for 5,000+ rows, not to create multiple commit
// points. If any chunk (or the deletion step) throws, `withTransaction`
// rolls back everything already done in this job — "No partial imports" /
// "if synchronization fails, rollback everything", guaranteed by Postgres
// rather than by application-level compensating deletes.

const DEFAULT_CHUNK_SIZE = 500;

export interface CommitJobResult extends CommitBatchResult {
  deleted?: Record<string, number>;
}

export async function commitInChunks<TValidRow>(
  strategy: ImportStrategy<TValidRow>,
  rows: ActionedRow<TValidRow>[],
  actorId: string,
  mode: ImportMode,
  chunkSize: number = DEFAULT_CHUNK_SIZE
): Promise<CommitJobResult> {
  if (strategy.preCommit) {
    await strategy.preCommit(rows);
  }
  return withTransaction(async (client) => {
    let deleted: Record<string, number> | undefined;

    if (mode === 'replace') {
      if (!strategy.deleteForReplace) {
        throw new Error(`Replace mode is not supported for entity type '${strategy.entityType}'`);
      }
      deleted = await strategy.deleteForReplace(client, actorId);
    }

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const details: unknown[] = [];

    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const result = await strategy.commitChunk(client, chunk, actorId);
      createdCount += result.createdCount;
      updatedCount += result.updatedCount;
      skippedCount += result.skippedCount;
      if (result.details) details.push(...result.details);
    }

    return { createdCount, updatedCount, skippedCount, details, deleted };
  });
}
