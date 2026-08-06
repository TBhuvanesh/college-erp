require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  try {
    const { rows: assignments } = await pool.query(`
      SELECT ta.id, ta.section, ta.subject_curriculum_mapping_id, scm.program_id, scm.department_id, scm.semester
      FROM teaching_assignments ta
      LEFT JOIN subject_curriculum_mappings scm ON scm.id = ta.subject_curriculum_mapping_id
      WHERE ta.subject_id = (SELECT id FROM subjects WHERE name = 'Nature Inspired Computing' LIMIT 1) AND ta.section = 'A'
    `);
    console.log("Teaching Assignments:", assignments);
    
    if (assignments.length > 0) {
      const { semester, section, department_id } = assignments[0];
      
      const { rows: students } = await pool.query(`
        SELECT id, roll_number, full_name, program_id, department_id, semester, section
        FROM students
        WHERE semester = $1 AND section = $2 AND department_id = $3
      `, [semester, section, department_id]);
      console.log(`Matching Students (by dept, sem, sec) = ${students.length}:`, students.slice(0, 5));
    }

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
