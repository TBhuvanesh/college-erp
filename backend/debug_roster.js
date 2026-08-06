require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  try {
    // 1. Get Subject
    const { rows: subjects } = await pool.query(`SELECT id, name FROM subjects WHERE name = 'Nature Inspired Computing'`);
    if (subjects.length === 0) {
      console.log("Subject not found!");
      return;
    }
    const subjectId = subjects[0].id;
    console.log("Subject ID:", subjectId);

    // 2. Get Teaching Assignment and Curriculum Mapping
    const { rows: assignments } = await pool.query(`
      SELECT ta.id, ta.section, ta.subject_curriculum_mapping_id, scm.program_id, scm.semester
      FROM teaching_assignments ta
      LEFT JOIN subject_curriculum_mappings scm ON scm.id = ta.subject_curriculum_mapping_id
      WHERE ta.subject_id = $1 AND ta.section = 'A'
    `, [subjectId]);
    console.log("Teaching Assignments:", assignments);
    
    if (assignments.length > 0 && assignments[0].program_id) {
      const { program_id, semester, section } = assignments[0];
      
      // 3. Find matching students
      const { rows: students } = await pool.query(`
        SELECT id, roll_number, full_name, program_id, semester, section, status
        FROM students
        WHERE program_id = $1 AND semester = $2 AND section = $3
      `, [program_id, semester, section]);
      console.log("Matching Students:", students.length);
      if (students.length > 0) {
        console.table(students.slice(0, 5));
      } else {
        console.log("NO STUDENTS MATCHING THIS PROGRAM/SEMESTER/SECTION.");
        
        // Let's see what students DO exist for this section
        const { rows: anyStudents } = await pool.query(`
          SELECT id, roll_number, full_name, program_id, semester, section, status
          FROM students
          WHERE section = $1 LIMIT 5
        `, [section]);
        console.log("Any students in section A:", anyStudents);
      }
    }

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
