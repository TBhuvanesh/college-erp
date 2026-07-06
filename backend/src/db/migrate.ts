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
