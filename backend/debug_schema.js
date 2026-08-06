require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  try {
    const { rows: examsSchema } = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'exams'");
    console.table(examsSchema);
    
    const { rows: resultsSchema } = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'results'");
    console.table(resultsSchema);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
