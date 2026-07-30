import { query } from './src/config/database';
async function main() {
  const { rows } = await query(`SELECT code, name, deleted_at FROM subjects WHERE (code LIKE '%DS%' OR code LIKE '%EC%') AND deleted_at IS NULL ORDER BY code`);
  console.log('Live subjects matching DS/EC pattern:', JSON.stringify(rows, null, 2));

  // Check all subjects' delete status distribution overall
  const { rows: stats } = await query(`SELECT (deleted_at IS NOT NULL) AS is_deleted, COUNT(*)::int c FROM subjects GROUP BY 1`);
  console.log('overall subject deletion stats:', JSON.stringify(stats));

  // Check exact same-timestamp bulk delete scope
  const { rows: bulk } = await query(`SELECT code, deleted_at FROM subjects WHERE deleted_at = '2026-07-21T05:13:43.102Z' ORDER BY code`);
  console.log('subjects deleted at that exact bulk timestamp:', bulk.length, JSON.stringify(bulk.map((r:any)=>r.code)));
  process.exit(0);
}
main().catch(e=>{console.error(e.message);process.exit(1);});
