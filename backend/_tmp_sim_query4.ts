import { query } from './src/config/database';
async function main() {
  const { rows } = await query(`
    SELECT s.code, s.deleted_at IS NOT NULL AS is_deleted, scm.semester, scm.deleted_at IS NOT NULL AS mapping_deleted, d.code AS dept
    FROM subjects s
    LEFT JOIN subject_curriculum_mappings scm ON scm.subject_id = s.id
    LEFT JOIN departments d ON d.id = scm.department_id
    WHERE s.code LIKE 'DS%' OR s.code LIKE 'EC%'
    ORDER BY s.code, scm.semester
  `);
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}
main().catch(e=>{console.error(e.message);process.exit(1);});
