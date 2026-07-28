import { query } from './src/config/database';

async function main() {
  const { rows: fac } = await query<{ id: string; user_id: string }>(`SELECT id, user_id FROM faculty WHERE employee_number LIKE 'DEMOFAC%'`);
  const { rows: stu } = await query<{ id: string; user_id: string }>(`SELECT id, user_id FROM students WHERE roll_number LIKE '26DM1A%'`);
  const facIds = fac.map((f) => f.id);
  const facUserIds = fac.map((f) => f.user_id);
  const stuIds = stu.map((s) => s.id);
  const stuUserIds = stu.map((s) => s.user_id);
  console.log('faculty', facIds.length, 'students', stuIds.length);
  if (facIds.length === 0 && stuIds.length === 0) {
    console.log('Nothing to clean up.');
    process.exit(0);
  }

  const tablesByFaculty = ['attendance', 'teaching_plans', 'course_materials', 'assignments', 'internal_marks', 'exams', 'results', 'mentor_assignments', 'mentoring_notes', 'teaching_assignments'];
  const tablesByStudent = ['attendance', 'assignment_submissions', 'internal_marks', 'results', 'mentor_assignments', 'mentoring_notes', 'feedback_submissions'];

  if (facIds.length > 0) {
    // assignment_submissions references assignments by faculty -> delete via assignment ids first
    const { rows: asg } = await query<{ id: string }>(`SELECT id FROM assignments WHERE faculty_id = ANY($1::uuid[])`, [facIds]);
    const asgIds = asg.map((a) => a.id);
    if (asgIds.length) await query(`DELETE FROM assignment_submissions WHERE assignment_id = ANY($1::uuid[])`, [asgIds]);

    for (const t of tablesByFaculty) {
      await query(`DELETE FROM ${t} WHERE faculty_id = ANY($1::uuid[])`, [facIds]);
    }
    await query(`DELETE FROM notifications WHERE recipient_user_id = ANY($1::uuid[])`, [facUserIds]);
    await query(`DELETE FROM calendar_entries WHERE created_by = ANY($1::uuid[])`, [facUserIds]);
    await query(`DELETE FROM feedback_campaigns WHERE created_by = ANY($1::uuid[])`, [facUserIds]);
  }
  if (stuIds.length > 0) {
    for (const t of tablesByStudent) {
      await query(`DELETE FROM ${t} WHERE student_id = ANY($1::uuid[])`, [stuIds]);
    }
    await query(`DELETE FROM notifications WHERE recipient_user_id = ANY($1::uuid[])`, [stuUserIds]);
    await query(`DELETE FROM fees WHERE student_id = ANY($1::uuid[])`, [stuIds]);
  }

  await query(`DELETE FROM feedback_questions WHERE template_id IN (SELECT id FROM feedback_templates WHERE title = 'Faculty Teaching Feedback — Demo')`);
  await query(`DELETE FROM feedback_templates WHERE title = 'Faculty Teaching Feedback — Demo'`);
  await query(`DELETE FROM audit_logs WHERE actor_id = ANY($1::uuid[])`, [[...facUserIds, ...stuUserIds]]);

  if (stuIds.length) await query(`DELETE FROM students WHERE id = ANY($1::uuid[])`, [stuIds]);
  if (facIds.length) await query(`DELETE FROM faculty WHERE id = ANY($1::uuid[])`, [facIds]);
  if (stuUserIds.length) await query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [stuUserIds]);
  if (facUserIds.length) await query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [facUserIds]);

  console.log('Cleanup complete.');
  process.exit(0);
}
main().catch((e) => { console.error('CLEANUP FAILED:', e.message); process.exit(1); });
