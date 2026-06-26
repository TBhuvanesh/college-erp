import { Pool, PoolClient } from 'pg';
import type { QueryResultRow } from 'pg';
import { env } from './env';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 15_000,
  ssl: env.DATABASE_URL.includes('sslmode=') || env.DATABASE_URL.includes('neon.tech')
    ? { rejectUnauthorized: false }
    : undefined,
});

pool.on('error', (err) => {
  console.error('Idle database client error:', err);
  process.exit(1);
});

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
) {
  const start = Date.now();
  const result = await pool.query<T>(text, params as unknown[]);
  if (env.NODE_ENV === 'development') {
    const duration = Date.now() - start;
    console.debug('query', { sql: text.slice(0, 80).replace(/\s+/g, ' '), duration, rows: result.rowCount });
  }
  return result;
}

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
