import { pool, query } from '../config/database';

async function test() {
  try {
    const res = await query(
      "SELECT id, roll_number, full_name, semester, section, academic_year, status FROM students WHERE roll_number = '24VE5A6604'"
    );
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

test();
