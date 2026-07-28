import { query } from './src/config/database';
async function main() {
  const { rows } = await query(`SELECT roll_number, academic_year, section FROM students WHERE department_id=$1 AND semester=3 ORDER BY roll_number LIMIT 5`, ['96cd0231-c968-4ec5-bec4-a178aec81f8b']);
  console.log(JSON.stringify(rows));
  const { rows: r2 } = await query(`SELECT roll_number, academic_year, section FROM students WHERE department_id=$1 AND semester=5 ORDER BY roll_number LIMIT 5`, ['4dd2904c-7c90-4fc3-b3df-36049d22e680']);
  console.log(JSON.stringify(r2));
  process.exit(0);
}
main().catch(e=>{console.error(e.message);process.exit(1);});
