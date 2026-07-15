import { pool, query } from '../src/config/database';

async function run() {
  try {
    const res = await query(`
      SELECT f.id, f.designation, u.email 
      FROM faculty f 
      JOIN users u ON u.id = f.user_id
    `);
    console.log("Faculty list from DB:", res.rows);
    
    // Ensure at least one HOD exists so we can test the HOD features
    const hasHod = res.rows.some(r => r.designation === 'hod');
    if (!hasHod) {
      console.log("No HOD found in DB, updating amit.sharma@college.erp to hod...");
      await query(`
        UPDATE faculty 
        SET designation = 'hod' 
        WHERE user_id = (SELECT id FROM users WHERE email = 'amit.sharma@college.erp')
      `);
      console.log("Successfully designated amit.sharma@college.erp as HOD.");
    }
  } catch (err) {
    console.error("Failed to query/update faculty", err);
  } finally {
    await pool.end();
  }
}

run();
