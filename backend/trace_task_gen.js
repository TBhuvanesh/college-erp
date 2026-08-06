require('dotenv').config();
const { query } = require('./src/db/client');
const { ensureCompletedExamsHaveTasks } = require('./src/services/examination.service');

async function run() {
  try {
    const { rows: missingTasks } = await query(`
      SELECT e.id, e.subject_id, e.semester, ta.id AS teaching_assignment_id, ta.section,
             s.name AS subject_name, e.exam_type, es.academic_year, es.regulation,
             es.department_id, ta.faculty_id, f.user_id AS faculty_user_id
      FROM exams e
      JOIN examination_sessions es ON es.id = e.session_id
      JOIN subjects s ON s.id = e.subject_id
      JOIN teaching_assignments ta ON ta.subject_id = e.subject_id
           AND ta.section = ANY(string_to_array(e.section, ','))
           AND ta.deleted_at IS NULL
      JOIN faculty f ON f.id = ta.faculty_id
      LEFT JOIN result_entry_tasks ret ON ret.exam_id = e.id
           AND ret.teaching_assignment_id = ta.id
           AND ret.deleted_at IS NULL
      WHERE e.deleted_at IS NULL
        AND e.status = 'Completed'
        AND es.status = 'Published'
        AND ret.id IS NULL
    `);
    
    console.log("Missing tasks found by ensureCompletedExamsHaveTasks:", missingTasks.length);
    if (missingTasks.length > 0) {
      console.table(missingTasks);
    } else {
      console.log("No missing tasks found! Checking exams with status = 'Completed'...");
      const { rows: completedExams } = await query(`SELECT id, status, section FROM exams WHERE status = 'Completed'`);
      console.table(completedExams);
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
