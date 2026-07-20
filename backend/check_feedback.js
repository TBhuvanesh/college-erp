const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_Ovcj24BrEQlM@ep-misty-art-atodzgsw-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
});

async function run() {
  try {
    const res = await pool.query('SELECT full_name, designation, department_id FROM faculty');
    console.log('Faculty details:', res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

run();
