const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'erp_db',
  password: 'password',
  port: 5432,
});

async function run() {
  try {
    const res = await pool.query(`
      SELECT e.id, e.section AS exam_section, ta.section AS ta_section, e.status
      FROM exams e
      JOIN subjects s ON s.id = e.subject_id
      LEFT JOIN teaching_assignments ta ON ta.subject_id = e.subject_id
      WHERE s.code = 'AM702PC'
    `);
    console.log("Exam and TA sections for AM702PC:");
    console.table(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
