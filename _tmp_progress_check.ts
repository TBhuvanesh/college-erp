import { query } from './src/config/database';
async function main() {
  const { rows: f } = await query(`SELECT employee_number FROM faculty WHERE employee_number LIKE 'DEMOFAC%'`);
  console.log('faculty', JSON.stringify(f));
  const { rows: s } = await query(`SELECT roll_number FROM students WHERE roll_number LIKE '26DM1A%' ORDER BY roll_number`);
  console.log('students', s.length, JSON.stringify(s.map((r:any)=>r.roll_number)));
  const { rows: ta } = await query(`SELECT count(*)::int c FROM teaching_assignments ta JOIN faculty f ON f.id=ta.faculty_id WHERE f.employee_number LIKE 'DEMOFAC%'`);
  console.log('teaching assignments', ta[0].c);
  const { rows: att } = await query(`SELECT count(*)::int c FROM attendance a JOIN faculty f ON f.id=a.faculty_id WHERE f.employee_number LIKE 'DEMOFAC%'`);
  console.log('attendance rows', att[0].c);
  process.exit(0);
}
main().catch(e=>{console.error(e.message);process.exit(1);});
