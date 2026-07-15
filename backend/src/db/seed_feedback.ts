import { pool } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

async function seedFeedback() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Create a feedback window if not exists
    console.log('Seeding feedback window...');
    const windowId = uuidv4();
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - 1); // Started yesterday
    const windowEnd = new Date();
    windowEnd.setDate(windowEnd.getDate() + 7); // Closes in a week

    const winCheck = await client.query("SELECT id FROM feedback_windows WHERE title = 'Spring Semester 2026 Evaluation'");
    if (winCheck.rowCount === 0) {
      await client.query(
        `INSERT INTO feedback_windows (id, title, academic_year, semester, start_date, end_date, is_active)
         VALUES ($1, 'Spring Semester 2026 Evaluation', '2025-26', 2, $2, $3, true)`,
        [windowId, windowStart.toISOString(), windowEnd.toISOString()]
      );
      console.log('  Feedback window created.');
    } else {
      console.log('  Feedback window already exists.');
    }

    // 2. Create Templates
    console.log('Seeding templates...');
    const templates = [
      { type: 'faculty', title: 'Faculty Performance Evaluation' },
      { type: 'course', title: 'Course Content & Lab Evaluation' },
      { type: 'lms', title: 'LMS Canvas Evaluation' },
      { type: 'erp', title: 'College ERP Suggestion Form' }
    ];

    for (const t of templates) {
      const tCheck = await client.query('SELECT id FROM feedback_templates WHERE type = $1', [t.type]);
      let templateId = '';
      if (tCheck.rowCount === 0) {
        templateId = uuidv4();
        await client.query(
          `INSERT INTO feedback_templates (id, title, type, is_active)
           VALUES ($1, $2, $3, true)`,
          [templateId, t.title, t.type]
        );
        console.log(`  Template ${t.type} created.`);
      } else {
        templateId = tCheck.rows[0].id;
        console.log(`  Template ${t.type} already exists.`);
      }

      // Add Questions for this template
      const qCheck = await client.query('SELECT id FROM feedback_questions WHERE template_id = $1', [templateId]);
      if (qCheck.rowCount === 0) {
        if (t.type === 'faculty') {
          const facultyQuestions = [
            'Subject Knowledge',
            'Teaching Effectiveness',
            'Communication Skills',
            'Classroom Interaction',
            'Doubt Clarification',
            'Punctuality',
            'Overall Satisfaction'
          ];
          for (let i = 0; i < facultyQuestions.length; i++) {
            await client.query(
              `INSERT INTO feedback_questions (id, template_id, text, type, order_index, is_required)
               VALUES ($1, $2, $3, 'rating', $4, true)`,
              [uuidv4(), templateId, facultyQuestions[i], i]
            );
          }
        } else if (t.type === 'course') {
          const courseQuestions = [
            'Syllabus covers the latest technology trends.',
            'Difficulty Level (1-Easy, 5-Hard)',
            'Assignments helped clarify textbook materials.',
            'Were laboratory sessions aligned with theory classes?'
          ];
          await client.query(
            `INSERT INTO feedback_questions (id, template_id, text, type, order_index, is_required)
             VALUES ($1, $2, $3, 'rating', 0, true)`,
            [uuidv4(), templateId, courseQuestions[0], 0]
          );
          await client.query(
            `INSERT INTO feedback_questions (id, template_id, text, type, order_index, is_required)
             VALUES ($1, $2, $3, 'rating', 1, true)`,
            [uuidv4(), templateId, courseQuestions[1], 1]
          );
          await client.query(
            `INSERT INTO feedback_questions (id, template_id, text, type, order_index, is_required)
             VALUES ($1, $2, $3, 'rating', 2, true)`,
            [uuidv4(), templateId, courseQuestions[2], 2]
          );
          await client.query(
            `INSERT INTO feedback_questions (id, template_id, text, type, order_index, is_required, options)
             VALUES ($1, $2, $3, 'mcq', 3, true, $4)`,
            [uuidv4(), templateId, courseQuestions[3], 3, JSON.stringify(['Yes, completely', 'Partially', 'No, not at all'])]
          );
        } else if (t.type === 'lms') {
          const lmsQuestions = [
            'Canvas LMS is easy to navigate.',
            'Are lecture PPTs uploaded on time?',
            'Teaching Planner is kept updated regularly.'
          ];
          await client.query(
            `INSERT INTO feedback_questions (id, template_id, text, type, order_index, is_required)
             VALUES ($1, $2, $3, 'rating', 0, true)`,
            [uuidv4(), templateId, lmsQuestions[0], 0]
          );
          await client.query(
            `INSERT INTO feedback_questions (id, template_id, text, type, order_index, is_required, options)
             VALUES ($1, $2, $3, 'boolean', 1, true, $4)`,
            [uuidv4(), templateId, lmsQuestions[1], 1, JSON.stringify(['Yes', 'No'])]
          );
          await client.query(
            `INSERT INTO feedback_questions (id, template_id, text, type, order_index, is_required, options)
             VALUES ($1, $2, $3, 'boolean', 2, true, $4)`,
            [uuidv4(), templateId, lmsQuestions[2], 2, JSON.stringify(['Yes', 'No'])]
          );
        } else if (t.type === 'erp') {
          await client.query(
            `INSERT INTO feedback_questions (id, template_id, text, type, order_index, is_required)
             VALUES ($1, $2, 'Please list suggestions or bug reports for the ERP system.', 'text', 0, false)`,
            [uuidv4(), templateId]
          );
        }
        console.log(`  Questions for ${t.type} seeded.`);
      }
    }

    await client.query('COMMIT');
    console.log('Seeding completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', err);
  } finally {
    client.release();
    pool.end();
  }
}

seedFeedback();
