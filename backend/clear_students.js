const { Pool } = require('pg');

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_Ovcj24BrEQlM@ep-misty-art-atodzgsw-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
});

async function clearStudents() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    console.log('Truncating students table with CASCADE...');
    await client.query('TRUNCATE TABLE students CASCADE');
    console.log('Successfully truncated students and all referencing data.');

    console.log('Deleting notifications linked to students...');
    await client.query("DELETE FROM notifications WHERE recipient_user_id IN (SELECT id FROM users WHERE role = 'student')");

    // Add another catch-all if audit_logs or something else is linked
    // await client.query("DELETE FROM audit_logs WHERE actor_id IN (SELECT id FROM users WHERE role = 'student')"); 
    // Usually audit_logs set actor_id ON DELETE SET NULL, but if not we can handle it later.

    console.log('Deleting student user accounts...');
    const res = await client.query("DELETE FROM users WHERE role = 'student'");
    console.log(`Deleted ${res.rowCount} student user accounts.`);

    await client.query('COMMIT');
    console.log('All student data removed successfully.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Error removing student data:', e);
  } finally {
    client.release();
    pool.end();
  }
}

clearStudents();
