import { query } from './src/config/database';
async function main() {
  const { rows } = await query(`
    SELECT d.code AS dept, scm.semester, scm.subject_id, s.id AS subj_exists, s.code, s.deleted_at AS subj_deleted
    FROM subject_curriculum_mappings scm
    JOIN departments d ON d.id = scm.department_id
    LEFT JOIN subjects s ON s.id = scm.subject_id
    WHERE d.code IN ('DS','ECE') AND scm.semester IN (3,5,7) AND scm.deleted_at IS NULL
    ORDER BY d.code, scm.semester
  `);
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}
main().catch(e=>{console.error(e.message);process.exit(1);});
