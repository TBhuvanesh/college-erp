import { query } from './src/config/database';
async function main() {
  const { rows } = await query(`SELECT ta.section, ta.academic_year, s.code FROM teaching_assignments ta JOIN subject_curriculum_mappings scm ON scm.id=ta.subject_curriculum_mapping_id JOIN subjects s ON s.id=scm.subject_id WHERE scm.subject_id IN ($1,$2,$3,$4) AND ta.deleted_at IS NULL`, ['8e1e0b37-442c-46c7-8b06-0ea0f4f395a8','230dc4c5-fcd3-40eb-8dbb-e38930db7ae7','c23a2c22-7982-40cd-8be5-bb5133c13314','c8c87fdf-9917-4145-a522-889b88f1c112']);
  console.log('existing TAs for our subjects', JSON.stringify(rows));
  const { rows: secs } = await query(`SELECT DISTINCT section FROM students WHERE department_id=$1 AND semester=3`, ['96cd0231-c968-4ec5-bec4-a178aec81f8b']);
  console.log('CSE sem3 sections in use', JSON.stringify(secs));
  const { rows: secs2 } = await query(`SELECT DISTINCT section FROM students WHERE department_id=$1 AND semester=5`, ['4dd2904c-7c90-4fc3-b3df-36049d22e680']);
  console.log('AIML sem5 sections in use', JSON.stringify(secs2));
  process.exit(0);
}
main().catch(e=>{console.error(e.message);process.exit(1);});
