require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const cseDeptId = '8c862b34-10e3-4a5a-97f4-a81dd8cc0ff1';
const aimlDeptId = '709aaf26-62bc-46a9-ab45-8208d44751f6';

async function run() {
  try {
    console.log("Updating department allocations from CSE to AIML...");
    
    // Update subject curriculum mappings
    const scmUpdate = await pool.query(
      "UPDATE subject_curriculum_mappings SET department_id = $1 WHERE department_id = $2",
      [aimlDeptId, cseDeptId]
    );
    console.log(`Updated department for ${scmUpdate.rowCount} subject curriculum mappings.`);

    // Update teaching assignments
    const taUpdate = await pool.query(
      "UPDATE teaching_assignments SET department_id = $1 WHERE department_id = $2",
      [aimlDeptId, cseDeptId]
    );
    console.log(`Updated department for ${taUpdate.rowCount} teaching assignments.`);

    console.log("Department updates completed successfully!");
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}

run();
