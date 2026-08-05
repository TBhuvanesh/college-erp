const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_Ovcj24BrEQlM@ep-misty-art-atodzgsw-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require' });

pool.query("SELECT roll_number, semester FROM students WHERE roll_number = '24VE5A6604'")
  .then(res => {
    console.log("Nandu record:", res.rows);
    pool.end();
  })
  .catch(err => {
    console.error(err);
    pool.end();
  });
