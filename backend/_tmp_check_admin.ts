import { query } from './src/config/database';
async function main() {
  const { rows } = await query(`SELECT id, email, role FROM users WHERE role='admin' LIMIT 3`);
  console.log(JSON.stringify(rows));
  const { rows: sub1 } = await query(`SELECT s.id, s.code, s.name, scm.department_id, scm.program_id, scm.semester, scm.regulation FROM subjects s JOIN subject_curriculum_mappings scm ON scm.subject_id=s.id WHERE scm.department_id=$1 AND scm.semester=3 AND scm.regulation='R22' AND s.type='core' ORDER BY s.code LIMIT 5`, ['96cd0231-c968-4ec5-bec4-a178aec81f8b']);
  console.log('CSE sem3 core subjects', JSON.stringify(sub1));
  const { rows: sub2 } = await query(`SELECT s.id, s.code, s.name, scm.department_id, scm.program_id, scm.semester, scm.regulation FROM subjects s JOIN subject_curriculum_mappings scm ON scm.subject_id=s.id WHERE scm.department_id=$1 AND scm.semester=5 AND scm.regulation='R22' AND s.type='core' ORDER BY s.code LIMIT 5`, ['4dd2904c-7c90-4fc3-b3df-36049d22e680']);
  console.log('AIML sem5 core subjects', JSON.stringify(sub2));
  process.exit(0);
}
main().catch(e=>{console.error(e.message);process.exit(1);});
