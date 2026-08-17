import { query } from './src/config/database';
import { hashPassword } from './src/utils/password';
import { v4 as uuidv4 } from 'uuid';

const newFaculty = ['Mr K Vamsi Krishna', 'Mrs T Padmavathi', 'Mr Ch Ravindra'];

async function main() {
  const { rows: deptRows } = await query<{ id: string }>(
    "SELECT id FROM departments WHERE name = 'Artificial Intelligence and Machine Learning'"
  );
  const deptId = deptRows[0].id;

  const { rows: maxRows } = await query<{ employee_number: string }>(
    "SELECT employee_number FROM faculty ORDER BY employee_number DESC LIMIT 1"
  );
  let nextNum = parseInt(maxRows[0].employee_number.replace('SREYAS-FAC-', ''), 10) + 1;

  const passwordHash = await hashPassword('Faculty123');

  for (const rawName of newFaculty) {
    const cleanName = rawName.replace(/^(Dr|Mr|Mrs|Ms)\.?\s+/i, '');
    const email = cleanName.toLowerCase().replace(/[\s.]+/g, '') + '@sreyas.ac.in';
    const uId = uuidv4();
    const fId = uuidv4();
    const empNum = `SREYAS-FAC-${nextNum++}`;

    const { rows: check } = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (check.length > 0) {
      console.log(`Skipping ${email}, already exists`);
      continue;
    }

    await query(
      `INSERT INTO users (id, email, password_hash, role, full_name) VALUES ($1, $2, $3, $4, $5)`,
      [uId, email, passwordHash, 'faculty', cleanName]
    );
    await query(
      `INSERT INTO faculty (id, user_id, employee_number, full_name, department_id, designation, status) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [fId, uId, empNum, cleanName, deptId, 'assistant_professor', 'active']
    );
    console.log(`Added ${cleanName} (${empNum}) to AIML`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error('ERROR', e);
  process.exit(1);
});
