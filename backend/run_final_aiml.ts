import { autoGenerateTeachingAssignments } from './src/services/academicPlanning.service';
import { pool } from './src/config/database';

async function main() {
  const { rows } = await pool.query("SELECT id, name FROM departments WHERE name = 'Artificial Intelligence and Machine Learning'");
  const dept = rows[0];
  const { rows: adminRows } = await pool.query("SELECT id FROM users WHERE role='admin' LIMIT 1");
  const actorId = adminRows[0].id;

  const live = await autoGenerateTeachingAssignments('2026-2027', undefined, dept.id, false, actorId);
  console.log('LIVE (with new faculty): proposed=%d created=%d skipped=%d', live.proposed, live.created, live.skipped.length);
  console.log('created:', JSON.stringify(live.assignments, null, 2));
  console.log('still-skipped:', JSON.stringify(live.skipped, null, 2));
  process.exit(0);
}
main().catch((e) => { console.error('ERROR', e); process.exit(1); });
