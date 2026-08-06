require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    const { rows } = await pool.query("SELECT id FROM users WHERE role = 'faculty'");
    const userIds = rows.map(r => r.id);
    
    if (userIds.length > 0) {
       console.log(`Found ${userIds.length} faculty users, clearing dependent logs...`);
       await pool.query("DELETE FROM workflow_logs WHERE actor_id = ANY($1)", [userIds]);
       await pool.query("DELETE FROM audit_logs WHERE actor_id = ANY($1)", [userIds]);
       await pool.query("DELETE FROM notifications WHERE recipient_user_id = ANY($1)", [userIds]);
       await pool.query("DELETE FROM password_reset_tokens WHERE user_id = ANY($1)", [userIds]).catch(() => {});
       
       const res = await pool.query("DELETE FROM users WHERE role = 'faculty'");
       console.log('Successfully deleted ' + res.rowCount + ' faculty user accounts.');
    } else {
       console.log('No faculty user accounts found.');
    }
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}

run();
