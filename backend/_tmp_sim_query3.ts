import { query } from './src/config/database';
async function main() {
  const { rows } = await query(`
    SELECT d.code AS dept, scm.semester, s.code, s.name, s.deleted_at
    FROM subject_curriculum_mappings scm
    JOIN departments d ON d.id = scm.department_id
    JOIN subjects s ON s.id = scm.subject_id
    WHERE d.code IN ('DS','ECE') AND scm.semester IN (3,5,7) AND scm.deleted_at IS NULL AND s.deleted_at IS NULL
    ORDER BY d.code, scm.semester, s.code
  `);
  console.log('LIVE DS/ECE subjects for sem 3,5,7:', JSON.stringify(rows, null, 2));

  // broader: any live subject at all for DS/ECE regardless of semester
  const { rows: any } = await query(`
    SELECT d.code AS dept, scm.semester, s.code
    FROM subject_curriculum_mappings scm
    JOIN departments d ON d.id = scm.department_id
    JOIN subjects s ON s.id = scm.subject_id
    WHERE d.code IN ('DS','ECE') AND scm.deleted_at IS NULL AND s.deleted_at IS NULL
    ORDER BY d.code, scm.semester, s.code
  `);
  console.log('ALL LIVE DS/ECE subjects any semester:', JSON.stringify(any, null, 2));
  process.exit(0);
}
main().catch(e=>{console.error(e.message);process.exit(1);});
