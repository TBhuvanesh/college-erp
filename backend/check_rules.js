require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  try {
    const res = await pool.query(`SELECT id, name, trigger_event, is_active FROM workflow_rules WHERE trigger_event = 'exam.completed'`);
    console.log("Workflow rules for exam.completed:");
    console.table(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
