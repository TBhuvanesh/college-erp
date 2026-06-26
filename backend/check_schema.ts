import { pool } from './src/config/database';

async function check() {
  try {
    const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'");
    console.log('Columns in users table:', res.rows.map(r => r.column_name));
    
    const res2 = await pool.query("SELECT * FROM schema_migrations");
    console.log('Applied migrations:', res2.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

check();
