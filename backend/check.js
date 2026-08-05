const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_Ovcj24BrEQlM@ep-misty-art-atodzgsw-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require' });

async function check() {
  const res = await pool.query("SELECT * FROM subjects WHERE code = 'AM702PC'");
  console.log('Subject:', res.rows);
  if (res.rows.length > 0) {
    const scm = await pool.query("SELECT * FROM subject_curriculum_mappings WHERE subject_id = $1", [res.rows[0].id]);
    console.log('Mappings:', scm.rows);
  }
  pool.end();
}
check();
