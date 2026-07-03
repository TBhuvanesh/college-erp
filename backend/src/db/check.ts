import { query } from '../config/database';

async function check() {
  try {
    const { rows } = await query(
      `SELECT u.email, f.designation, f.department_id 
       FROM users u 
       JOIN faculty f ON f.user_id = u.id`
    );
    console.log("FACULTY LIST IN DB:", rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

check();
