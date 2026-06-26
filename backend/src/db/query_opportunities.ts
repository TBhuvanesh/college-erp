import { query, pool } from '../config/database';

async function main() {
  try {
    const res = await query('SELECT * FROM opportunities');
    console.log('Opportunities count:', res.rows.length);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error('Error querying database:', err);
  } finally {
    await pool.end();
  }
}

main();
