import { pool, query } from '../config/database';

async function test() {
  try {
    const res = await query('SELECT role, email, full_name FROM users ORDER BY role LIMIT 20');
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

test();
