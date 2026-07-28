import * as path from 'path';
import * as fs from 'fs';
import { query, pool } from '../config/database';
import { getSyncReport, runPlacementSync } from '../services/studentSync.service';

async function main() {
  const args = process.argv.slice(2);
  const isCommit = args.includes('--commit');
  let filePath: string | undefined;

  const fileIdx = args.indexOf('--file');
  if (fileIdx !== -1 && args[fileIdx + 1]) {
    filePath = args[fileIdx + 1];
  }

  // If specific filePath is provided, read it, otherwise let the service handle default file
  let fileBuffer: Buffer | undefined;
  if (filePath) {
    const fullPath = path.resolve(filePath);
    if (!fs.existsSync(fullPath)) {
      console.error(`Error: File not found at ${fullPath}`);
      process.exit(1);
    }
    fileBuffer = fs.readFileSync(fullPath);
    console.log(`Using Excel file: ${fullPath}`);
  } else {
    console.log(`Using default Excel file from project root: I SEMESTER ROLL LIST WITH FULL DATA.xlsx`);
  }

  // Get admin user ID for audit logging
  const adminRes = await query<{ id: string }>("SELECT id FROM users WHERE email = 'admin@college.erp'");
  const actorId = adminRes.rows[0]?.id;
  if (!actorId) {
    console.error('Error: Admin user not found in database. Cannot execute sync without a valid actor.');
    process.exit(1);
  }

  if (!isCommit) {
    console.log('\n--- RUNNING IN DRY-RUN / PREVIEW MODE ---');
    console.log('No database modifications will be applied.');
    const report = await getSyncReport(fileBuffer);
    
    console.log('\n==================================================');
    console.log('Nominal Rolls Synchronization Preview Report');
    console.log('==================================================');
    console.log(`Total Students in Excel:       ${report.totalExcelStudents}`);
    console.log(`Matched ERP Students:          ${report.matchedCount}`);
    console.log(`Already Correct Placements:    ${report.alreadyCorrectCount}`);
    console.log(`Mismatched Placements:         ${report.updatedCount}`);
    console.log(`Excel Students NOT in ERP:     ${report.notInErpCount}`);
    console.log(`ERP Students NOT in Excel:     ${report.notInExcelCount}`);
    console.log(`Duplicate Roll Numbers:        ${report.duplicateCount}`);
    console.log(`Invalid Rows:                  ${report.invalidCount}`);
    console.log('==================================================\n');

    if (report.updatedCount > 0) {
      console.log('Preview of Mismatched Placements to Correct:');
      report.mismatchedStudents.slice(0, 15).forEach((m, idx) => {
        console.log(`  ${idx + 1}. Roll: ${m.rollNumber.padEnd(12)} Name: ${m.fullName.padEnd(30)} Sheet: ${m.sheetName.padEnd(8)} Placement: Sem ${m.oldSemester} -> Sem ${m.newSemester} (Section: ${m.oldSection || 'None'} -> ${m.newSection})`);
      });
      if (report.updatedCount > 15) {
        console.log(`  ... and ${report.updatedCount - 15} more`);
      }
    }

    if (report.notInErpCount > 0) {
      console.log('\nExcel Students NOT Found in ERP:');
      report.excelStudentsNotInErp.slice(0, 10).forEach((s, idx) => {
        console.log(`  ${idx + 1}. Roll: ${s.rollNumber.padEnd(12)} Name: ${s.fullName.padEnd(30)} Sheet: ${s.sheetName}`);
      });
      if (report.notInErpCount > 10) {
        console.log(`  ... and ${report.notInErpCount - 10} more`);
      }
    }

    if (report.notInExcelCount > 0) {
      console.log('\nERP Students NOT Found in Excel Nominal Rolls:');
      report.erpStudentsNotInExcel.slice(0, 10).forEach((s, idx) => {
        console.log(`  ${idx + 1}. Roll: ${s.rollNumber.padEnd(12)} Name: ${s.fullName.padEnd(30)} Placement: Sem ${s.semester} (Section: ${s.section || 'None'})`);
      });
      if (report.notInExcelCount > 10) {
        console.log(`  ... and ${report.notInExcelCount - 10} more`);
      }
    }

    if (report.duplicateCount > 0) {
      console.log('\nDuplicate Roll Numbers in Excel:');
      report.duplicateRollNumbers.forEach(roll => console.log(`  - ${roll}`));
    }

    if (report.invalidCount > 0) {
      console.log('\nInvalid Rows / Parsing Errors:');
      report.invalidRows.forEach(row => {
        console.log(`  - Sheet: ${row.sheetName}, Row: ${row.rowNumber}, Errors: ${row.errors.join('; ')}`);
      });
    }

    console.log('\nTo apply these updates, run this command with the --commit flag.');
  } else {
    console.log('\n--- RUNNING IN COMMIT MODE ---');
    console.log('Applying student academic placement corrections to database...');
    
    const { report, correctedCount } = await runPlacementSync(actorId, fileBuffer);
    
    console.log('\n==================================================');
    console.log('Nominal Rolls Synchronization Completion Report');
    console.log('==================================================');
    console.log(`Total Students Evaluated:      ${report.totalExcelStudents}`);
    console.log(`Successfully Corrected:        ${correctedCount} student(s)`);
    console.log(`Already Correct Placements:    ${report.alreadyCorrectCount}`);
    console.log(`Excel Students NOT in ERP:     ${report.notInErpCount}`);
    console.log(`ERP Students NOT in Excel:     ${report.notInExcelCount}`);
    console.log('==================================================\n');
  }
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error('Fatal Sync Error:', err);
    pool.end();
    process.exit(1);
  });
