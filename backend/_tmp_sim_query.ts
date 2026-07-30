import { query } from './src/config/database';
async function main() {
  console.log('=== Curriculum subjects per dept for semesters 3,5,7 ===');
  const { rows } = await query(`
    SELECT d.code AS dept, scm.semester, s.id, s.code, s.name
    FROM subject_curriculum_mappings scm
    JOIN subjects s ON s.id = scm.subject_id AND s.deleted_at IS NULL
    JOIN departments d ON d.id = scm.department_id
    WHERE scm.semester IN (3,5,7) AND scm.deleted_at IS NULL
    ORDER BY d.code, scm.semester, s.code
  `);
  const byDeptSem: Record<string, any[]> = {};
  for (const r of rows) {
    const key = `${r.dept}-${r.semester}`;
    (byDeptSem[key] ||= []).push({ id: r.id, code: r.code });
  }
  for (const k of Object.keys(byDeptSem)) console.log(k, byDeptSem[k].length, byDeptSem[k].map((x:any)=>x.code).join(','));

  console.log('=== Real (non-demo) sections per dept+semester ===');
  const { rows: sections } = await query(`
    SELECT d.code AS dept, s.semester, s.section, COUNT(*)::int c
    FROM students s JOIN departments d ON d.id = s.department_id
    WHERE s.deleted_at IS NULL AND s.section NOT IN ('X','Y','Z') AND s.semester IN (3,5,7)
    GROUP BY d.code, s.semester, s.section
    HAVING COUNT(*) >= 5
    ORDER BY d.code, s.semester, s.section
  `);
  console.log(JSON.stringify(sections, null, 2));
  console.log('total real sections (>=5 students):', sections.length);

  process.exit(0);
}
main().catch(e=>{console.error(e.message);process.exit(1);});
