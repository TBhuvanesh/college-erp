require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  try {
    const res = await pool.query(`
      SELECT e.id AS exam_id, e.subject_id, e.semester, ta.id AS teaching_assignment_id, ta.section,
             s.name AS subject_name, e.exam_type, es.academic_year, es.regulation,
             es.department_id, ta.faculty_id, f.user_id AS faculty_user_id,
             e.status AS exam_status, es.status AS session_status, ret.id AS task_id
      FROM exams e
      JOIN examination_sessions es ON es.id = e.session_id
      JOIN subjects s ON s.id = e.subject_id
      JOIN teaching_assignments ta ON ta.subject_id = e.subject_id
           AND ta.section = ANY(string_to_array(replace(e.section, ' ', ''), ','))
           AND ta.deleted_at IS NULL
      JOIN faculty f ON f.id = ta.faculty_id
      LEFT JOIN result_entry_tasks ret ON ret.exam_id = e.id
           AND ret.teaching_assignment_id = ta.id
           AND ret.deleted_at IS NULL
      WHERE e.deleted_at IS NULL
    `);
    console.log("Full Simulation Query Results:");
    console.table(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
