import ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs';
import { query, withTransaction } from '../config/database';
import { auditLog } from '../utils/audit';
import { AppError } from '../errors/AppError';

export interface ExcelStudentRow {
  rollNumber: string;
  fullName: string;
  email: string;
  year: number;
  semester: number;
  section: string;
  absoluteSemester: number;
  sheetName: string;
  rowNumber: number;
}

export interface SyncReport {
  totalExcelStudents: number;
  matchedCount: number;
  updatedCount: number;
  alreadyCorrectCount: number;
  notInErpCount: number;
  notInExcelCount: number;
  duplicateCount: number;
  invalidCount: number;
  mismatchedStudents: Array<{
    rollNumber: string;
    fullName: string;
    email: string;
    sheetName: string;
    oldSemester: number;
    newSemester: number;
    oldSection: string | null;
    newSection: string;
  }>;
  excelStudentsNotInErp: Array<{
    rollNumber: string;
    fullName: string;
    email: string;
    sheetName: string;
    section: string;
  }>;
  erpStudentsNotInExcel: Array<{
    rollNumber: string;
    fullName: string;
    email: string;
    semester: number;
    section: string | null;
  }>;
  duplicateRollNumbers: string[];
  invalidRows: Array<{
    sheetName: string;
    rowNumber: number;
    errors: string[];
  }>;
}

/**
 * Gets cell value string handles formulas and rich text
 */
function getCellValue(row: ExcelJS.Row, colMap: Record<string, number>, aliases: string[]): string {
  for (const alias of aliases) {
    const colIndex = colMap[alias];
    if (colIndex !== undefined) {
      const cell = row.getCell(colIndex);
      if (cell.value === null || cell.value === undefined) continue;
      if (typeof cell.value === 'object') {
        if ('result' in cell.value && cell.value.result !== undefined && cell.value.result !== null) {
          return String(cell.value.result).trim();
        }
        if ('richText' in cell.value && Array.isArray((cell.value as any).richText)) {
          return (cell.value as any).richText.map((t: any) => t.text).join('').trim();
        }
        if ('text' in cell.value) {
          return String((cell.value as any).text).trim();
        }
      }
      return String(cell.value).trim();
    }
  }
  return '';
}

/**
 * Parses the Excel workbook and extracts students grouped by sheet placement
 */
export async function parseExcelSyncFile(fileBuffer?: Buffer): Promise<{
  excelStudents: ExcelStudentRow[];
  duplicateRolls: string[];
  invalidRows: Array<{ sheetName: string; rowNumber: number; errors: string[] }>;
  sheetNamesDetected: string[];
}> {
  const workbook = new ExcelJS.Workbook();
  if (fileBuffer) {
    await workbook.xlsx.load(fileBuffer as any);
  } else {
    const xlsxPath = path.join(__dirname, '../../../../I SEMESTER ROLL LIST WITH FULL DATA.xlsx');
    if (!fs.existsSync(xlsxPath)) {
      throw AppError.notFound('Nominal rolls Excel workbook not found in project root.');
    }
    await workbook.xlsx.readFile(xlsxPath);
  }

  const excelStudents: ExcelStudentRow[] = [];
  const seenRolls = new Map<string, { sheetName: string; rowNumber: number }>();
  const duplicateRolls = new Set<string>();
  const invalidRows: Array<{ sheetName: string; rowNumber: number; errors: string[] }> = [];
  const sheetNamesDetected: string[] = [];

  workbook.worksheets.forEach((sheet) => {
    sheetNamesDetected.push(sheet.name);
    
    // Check if sheet name represents academic group, e.g. "2-1A", "3-1B", "4-1C"
    const match = sheet.name.trim().match(/^(\d)-(\d)([A-Z])$/);
    if (!match) return;

    const year = parseInt(match[1], 10);
    const semester = parseInt(match[2], 10);
    const section = match[3];
    const absoluteSemester = (year - 1) * 2 + semester;

    // Detect header row by scanning first 5 rows
    let headerRowIndex = 1;
    let colMap: Record<string, number> = {};
    const HTNO_ALIASES = ['HTNO', 'ROLLNUMBER', 'ROLLNO', 'HALLTICKETNUMBER'];

    for (let r = 1; r <= Math.min(sheet.rowCount, 5); r++) {
      const row = sheet.getRow(r);
      let foundHeader = false;
      row.eachCell((cell) => {
        const val = String(cell.value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (HTNO_ALIASES.includes(val)) {
          foundHeader = true;
        }
      });
      if (foundHeader) {
        headerRowIndex = r;
        break;
      }
    }

    const headerRow = sheet.getRow(headerRowIndex);
    headerRow.eachCell((cell, colNumber) => {
      const val = String(cell.value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (val) {
        colMap[val] = colNumber;
      }
    });

    // Check header requirements
    const rollNoCol = HTNO_ALIASES.find(alias => colMap[alias] !== undefined);
    if (!rollNoCol) {
      invalidRows.push({
        sheetName: sheet.name,
        rowNumber: headerRowIndex,
        errors: [`Could not find Roll Number header (e.g. H.T.NO) in sheet ${sheet.name}`]
      });
      return;
    }

    // Parse data rows
    for (let r = headerRowIndex + 1; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const rollNumberRaw = getCellValue(row, colMap, HTNO_ALIASES);
      const rollNumber = rollNumberRaw.trim().toUpperCase().replace(/\s+/g, '');
      
      if (!rollNumber) {
        // Skip empty row or log as invalid if it has other cell values
        let hasData = false;
        row.eachCell(() => { hasData = true; });
        if (hasData) {
          invalidRows.push({ sheetName: sheet.name, rowNumber: r, errors: ['Roll number is empty'] });
        }
        continue;
      }

      const fullName = getCellValue(row, colMap, ['STUDENTNAME', 'NAME', 'FULLNAME']);
      const email = getCellValue(row, colMap, ['MAILID', 'EMAILID', 'EMAIL', 'EMAILADDRESS']).toLowerCase();

      if (!fullName) {
        invalidRows.push({ sheetName: sheet.name, rowNumber: r, errors: [`Student name is missing for roll number ${rollNumber}`] });
        continue;
      }

      // Check duplicates in Excel
      if (seenRolls.has(rollNumber)) {
        duplicateRolls.add(rollNumber);
        continue;
      }
      seenRolls.set(rollNumber, { sheetName: sheet.name, rowNumber: r });

      excelStudents.push({
        rollNumber,
        fullName,
        email,
        year,
        semester,
        section,
        absoluteSemester,
        sheetName: sheet.name,
        rowNumber: r
      });
    }
  });

  return {
    excelStudents,
    duplicateRolls: Array.from(duplicateRolls),
    invalidRows,
    sheetNamesDetected
  };
}

/**
 * Evaluates the synchronization status between Excel Nominal Rolls and ERP database
 */
export async function getSyncReport(fileBuffer?: Buffer): Promise<SyncReport> {
  const { excelStudents, duplicateRolls, invalidRows } = await parseExcelSyncFile(fileBuffer);

  // Fetch all active, non-deleted ERP students
  const { rows: dbStudents } = await query<{
    id: string;
    roll_number: string;
    full_name: string;
    email: string;
    semester: number;
    section: string | null;
  }>(`
    SELECT s.id, s.roll_number, s.full_name, u.email, s.semester, s.section
    FROM students s
    JOIN users u ON u.id = s.user_id
    WHERE s.deleted_at IS NULL AND s.status = 'active'
  `);

  const dbStudentMap = new Map<string, typeof dbStudents[number]>();
  for (const s of dbStudents) {
    dbStudentMap.set(s.roll_number.trim().toUpperCase(), s);
  }

  const mismatchedStudents: SyncReport['mismatchedStudents'] = [];
  const excelStudentsNotInErp: SyncReport['excelStudentsNotInErp'] = [];
  const matchedExcelRolls = new Set<string>();

  let alreadyCorrectCount = 0;

  for (const excelStud of excelStudents) {
    const dbStud = dbStudentMap.get(excelStud.rollNumber);
    if (dbStud) {
      matchedExcelRolls.add(excelStud.rollNumber);
      
      const isSemesterMatch = dbStud.semester === excelStud.absoluteSemester;
      const isSectionMatch = dbStud.section === excelStud.section;

      if (isSemesterMatch && isSectionMatch) {
        alreadyCorrectCount++;
      } else {
        mismatchedStudents.push({
          rollNumber: excelStud.rollNumber,
          fullName: excelStud.fullName,
          email: excelStud.email || dbStud.email,
          sheetName: excelStud.sheetName,
          oldSemester: dbStud.semester,
          newSemester: excelStud.absoluteSemester,
          oldSection: dbStud.section,
          newSection: excelStud.section
        });
      }
    } else {
      excelStudentsNotInErp.push({
        rollNumber: excelStud.rollNumber,
        fullName: excelStud.fullName,
        email: excelStud.email,
        sheetName: excelStud.sheetName,
        section: excelStud.section
      });
    }
  }

  // Find ERP students not in the Excel sheets
  const erpStudentsNotInExcel: SyncReport['erpStudentsNotInExcel'] = [];
  for (const dbStud of dbStudents) {
    if (!matchedExcelRolls.has(dbStud.roll_number.trim().toUpperCase())) {
      erpStudentsNotInExcel.push({
        rollNumber: dbStud.roll_number,
        fullName: dbStud.full_name,
        email: dbStud.email,
        semester: dbStud.semester,
        section: dbStud.section
      });
    }
  }

  return {
    totalExcelStudents: excelStudents.length,
    matchedCount: dbStudents.length - erpStudentsNotInExcel.length,
    updatedCount: mismatchedStudents.length,
    alreadyCorrectCount,
    notInErpCount: excelStudentsNotInErp.length,
    notInExcelCount: erpStudentsNotInExcel.length,
    duplicateCount: duplicateRolls.length,
    invalidCount: invalidRows.length,
    mismatchedStudents,
    excelStudentsNotInErp,
    erpStudentsNotInExcel,
    duplicateRollNumbers: duplicateRolls,
    invalidRows
  };
}

/**
 * Commits updates to corrected placement mismatch rows inside a transaction
 */
export async function runPlacementSync(actorId: string, fileBuffer?: Buffer): Promise<{
  report: SyncReport;
  correctedCount: number;
}> {
  const report = await getSyncReport(fileBuffer);
  
  if (report.mismatchedStudents.length === 0) {
    return { report, correctedCount: 0 };
  }

  let correctedCount = 0;

  await withTransaction(async (client) => {
    for (const student of report.mismatchedStudents) {
      const { rowCount } = await client.query(
        `UPDATE students
         SET semester = $1, section = $2, updated_at = NOW()
         WHERE roll_number = $3 AND deleted_at IS NULL`,
        [student.newSemester, student.newSection, student.rollNumber]
      );

      if (rowCount && rowCount > 0) {
        correctedCount++;

        // Fetch student ID for audit log
        const { rows } = await client.query<{ id: string }>('SELECT id FROM students WHERE roll_number = $1', [student.rollNumber]);
        const sId = rows[0]?.id;

        if (sId) {
          await auditLog({
            actorId,
            action: 'STUDENT_PLACEMENT_SYNC_UPDATE',
            resource: 'students',
            resourceId: sId,
            changes: {
              oldSemester: student.oldSemester,
              newSemester: student.newSemester,
              oldSection: student.oldSection,
              newSection: student.newSection,
              source: 'Excel Nominal Rolls Sync'
            }
          });
        }
      }
    }

    // Log sync run activity
    await auditLog({
      actorId,
      action: 'STUDENT_PLACEMENT_SYNC_RUN',
      resource: 'import_jobs',
      changes: {
        totalExcel: report.totalExcelStudents,
        mismatchedUpdated: correctedCount,
        alreadyCorrect: report.alreadyCorrectCount,
        notInErp: report.notInErpCount,
        notInExcel: report.notInExcelCount
      }
    });
  });

  return { report, correctedCount };
}
