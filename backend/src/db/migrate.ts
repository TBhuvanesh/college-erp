import { readFileSync } from 'fs';
import { join } from 'path';
import { pool } from '../config/database';

const MIGRATIONS_DIR = join(__dirname, 'migrations');

// Ordered list — always append, never reorder
const MIGRATION_FILES = [
  '001_auth_foundation.sql',
  '002_student_management.sql',
  '003_faculty_management.sql',
  '004_subject_management.sql',
  '005_faculty_subject_assignments.sql',
  '006_attendance.sql',
  '007_internal_marks.sql',
  '008_examination_management.sql',
  '009_result_management.sql',
  '010_fee_management.sql',
  '011_announcement_management.sql',
  '012_add_user_full_name.sql',
  '013_document_management.sql',
  '014_parsed_events.sql',
  '015_academic_calendar.sql',
  '016_profile_fields.sql',
  '017_lms.sql',
  '018_opportunity_hub.sql',
  '019_notification_calendar.sql',
  '020_add_hod_designation.sql',
  '021_add_accountant_role.sql',
  '022_add_accountants_table.sql',
  '023_student_mentorship.sql',
  '024_mentor_groups.sql',
  '025_teaching_plans.sql',
  '026_teaching_plan_intelligence.sql',
  '027_academic_feedback.sql',
  '028_faculty_operations_workflow.sql',
  '029_exam_seating_invigilation.sql',
  '030_exam_seating_enterprise.sql',
  '031_exam_synchronization.sql',
  '032_mentorship_settings.sql',
  '033_feedback_campaigns.sql',
  '034_subject_allocation_updates.sql',
  '035_subjects_master_updates.sql',
  '036_subject_credits_decimal.sql',
  '037_subject_credits_check_constraint.sql',
  '038_subjects_curriculum_mappings.sql',
];

async function runMigrations(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version    VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const { rows } = await client.query<{ version: string }>(
      'SELECT version FROM schema_migrations ORDER BY version'
    );
    const applied = new Set(rows.map((r) => r.version));

    const pending = MIGRATION_FILES.filter((f) => !applied.has(f));

    if (pending.length === 0) {
      console.log('All migrations are up to date.');
      return;
    }

    for (const file of pending) {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');
      console.log(`Applying ${file}…`);
      if (file === '020_add_hod_designation.sql') {
        try {
          // Execute enum alteration first
          await client.query("ALTER TYPE faculty_designation ADD VALUE 'hod'");
          console.log('  Enum value "hod" added successfully.');
        } catch (err: any) {
          if (err.message && err.message.includes('already exists')) {
            console.log('  Enum value "hod" already exists, skipping alteration.');
          } else {
            throw err;
          }
        }
        
        // Execute index creation in a separate roundtrip so the enum change is committed
        await client.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_hod_per_dept 
          ON faculty (department_id) 
          WHERE designation = 'hod' AND deleted_at IS NULL
        `);
        console.log('  Index idx_unique_hod_per_dept created.');
        
        await client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1)',
          [file]
        );
      } else if (file === '021_add_accountant_role.sql') {
        try {
          // Execute enum alteration first
          await client.query("ALTER TYPE user_role ADD VALUE 'accountant'");
          console.log('  Enum value "accountant" added successfully.');
        } catch (err: any) {
          if (err.message && err.message.includes('already exists')) {
            console.log('  Enum value "accountant" already exists, skipping alteration.');
          } else {
            throw err;
          }
        }
        
        // Execute the rest of the SQL file (truncations/inserts) in a separate transaction
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1)',
          [file]
        );
        await client.query('COMMIT');
      } else if (file === '026_teaching_plan_intelligence.sql') {
        const enumAdditions = [
          "ALTER TYPE lesson_completion_status ADD VALUE IF NOT EXISTS 'In Progress'",
          "ALTER TYPE lesson_completion_status ADD VALUE IF NOT EXISTS 'Partially Completed'",
        ];
        for (const stmt of enumAdditions) {
          try {
            await client.query(stmt);
            console.log(`  ${stmt}`);
          } catch (err: any) {
            if (err.message && err.message.includes('already exists')) {
              console.log('  Enum value already exists, skipping.');
            } else {
              throw err;
            }
          }
        }

        // Rest of the file (column additions, backfill, indexes) in its own transaction
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1)',
          [file]
        );
        await client.query('COMMIT');
      } else if (file === '031_exam_synchronization.sql') {
        const enumAdditions = [
          "ALTER TYPE workflow_trigger_event ADD VALUE IF NOT EXISTS 'exam_seating.published'",
          "ALTER TYPE exam_session_status ADD VALUE IF NOT EXISTS 'validated' AFTER 'generated'",
          "ALTER TYPE exam_session_status ADD VALUE IF NOT EXISTS 'completed' AFTER 'published'",
        ];
        for (const stmt of enumAdditions) {
          try {
            await client.query(stmt);
            console.log(`  ${stmt}`);
          } catch (err: any) {
            if (err.message && err.message.includes('already exists')) {
              console.log('  Enum value already exists, skipping.');
            } else {
              throw err;
            }
          }
        }

        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1)',
          [file]
        );
        await client.query('COMMIT');
      } else {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1)',
          [file]
        );
        await client.query('COMMIT');
      }
      console.log(`  Applied ${file}`);
    }

    console.log('Migration complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

runMigrations()
  .then(() => pool.end())
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
