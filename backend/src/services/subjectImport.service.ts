import ExcelJS from 'exceljs';
import { query } from '../config/database';
import { auditLog } from '../utils/audit';
import type { SubjectType, SubjectStatus } from '../types/subject';
import { mapYearSemToSemester } from './subject.service';
import { Readable } from 'stream';

export interface ImportRowError {
  rowNumber: number;
  subjectCode: string;
  error: string;
}

export interface ImportPreviewResult {
  validRows: any[];
  failedRows: ImportRowError[];
  summary: {
    imported: number;
    duplicates: number;
    failed: number;
    total: number;
  };
}

// Helper to normalize subject types from raw Excel values to db enum values
function normalizeSubjectType(typeStr: string): SubjectType | null {
  const t = typeStr.trim().toLowerCase();
  if (t === 'core') return 'core';
  if (t === 'laboratory' || t === 'lab') return 'lab';
  if (t === 'elective') return 'elective';
  if (t === 'mandatory') return 'mandatory';
  if (t === 'project') return 'project';
  if (t === 'workshop') return 'workshop';
  return null;
}

// Helper to parse cell values safely
function getCellValueString(cell: ExcelJS.Cell): string {
  if (cell.value === null || cell.value === undefined) return '';
  if (typeof cell.value === 'object') {
    if ('richText' in cell.value) {
      return cell.value.richText.map(t => t.text).join('').trim();
    }
    if ('text' in cell.value) {
      return String(cell.value.text).trim();
    }
  }
  return String(cell.value).trim();
}

function findDepartmentByAlias(allDepts: { id: string; name: string; code: string }[], deptStr: string) {
  const s = deptStr.trim().toLowerCase();
  
  // 1. Direct matches on name or code
  let matched = allDepts.find(
    d => d.name.toLowerCase() === s || d.code.toLowerCase() === s
  );
  if (matched) return matched;

  // 2. Common aliases mappings
  if (['ai & ml', 'ai/ml', 'artificial intelligence and machine learning', 'aiml', 'ai & ml engineering', 'ai and ml'].includes(s)) {
    matched = allDepts.find(d => d.code.toUpperCase() === 'AIML');
    if (matched) return matched;
  }
  
  if (['cse', 'computer science & engineering', 'computer science and engineering', 'computer science'].includes(s)) {
    matched = allDepts.find(d => d.code.toUpperCase() === 'CSE');
    if (matched) return matched;
  }

  if (['ds', 'data science', 'aids', 'ai & ds', 'artificial intelligence and data science'].includes(s)) {
    matched = allDepts.find(d => d.code.toUpperCase() === 'DS');
    if (matched) return matched;
  }

  if (['ece', 'electronics & communication engineering', 'electronics and communication engineering', 'electronics'].includes(s)) {
    matched = allDepts.find(d => d.code.toUpperCase() === 'ECE');
    if (matched) return matched;
  }

  // 3. Substring matching fallback
  return allDepts.find(
    d => d.name.toLowerCase().includes(s) || s.includes(d.name.toLowerCase()) ||
         d.code.toLowerCase().includes(s) || s.includes(d.code.toLowerCase())
  );
}

export async function parseSubjectSpreadsheet(
  buffer: Buffer,
  fileExtension: string
): Promise<ImportPreviewResult> {
  const workbook = new ExcelJS.Workbook();
  
  if (fileExtension === 'csv') {
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);
    await workbook.csv.read(stream);
  } else {
    await workbook.xlsx.load(buffer as any);
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('Spreadsheet does not contain any worksheets.');
  }

  // 1. Parse header row case-insensitively
  const headerRow = worksheet.getRow(1);
  const colMap: Record<string, number> = {};
  
  headerRow.eachCell((cell, colNumber) => {
    const val = getCellValueString(cell).toLowerCase().replace(/\s+/g, '');
    colMap[val] = colNumber;
  });

  // Expected columns mapping (case-insensitive and spaceless headers)
  const codeIdx = colMap['subjectcode'] || colMap['code'] || colMap['subcode'];
  const nameIdx = colMap['subjectname'] || colMap['name'] || colMap['subname'];
  const deptIdx = colMap['department'] || colMap['dept'];
  const progIdx = colMap['program'] || colMap['prog'];
  const regIdx = colMap['regulation'] || colMap['reg'];
  const yearIdx = colMap['year'] || colMap['yr'];
  const semIdx = colMap['semester'] || colMap['sem'];
  const lIdx = colMap['l'] || colMap['lecturehours'] || colMap['lecture'];
  const tIdx = colMap['t'] || colMap['tutorialhours'] || colMap['tutorial'];
  const pIdx = colMap['p'] || colMap['practicalhours'] || colMap['practical'];
  const creditsIdx = colMap['credits'] || colMap['credit'];
  const typeIdx = colMap['subjecttype'] || colMap['type'];
  const statusIdx = colMap['status'];

  // Check required header presence
  const missingHeaders: string[] = [];
  if (!codeIdx) missingHeaders.push('Subject Code');
  if (!nameIdx) missingHeaders.push('Subject Name');
  if (!deptIdx) missingHeaders.push('Department');
  if (!progIdx) missingHeaders.push('Program');
  if (!regIdx) missingHeaders.push('Regulation');
  if (!yearIdx) missingHeaders.push('Year');
  if (!semIdx) missingHeaders.push('Semester');
  if (!creditsIdx) missingHeaders.push('Credits');
  if (!typeIdx) missingHeaders.push('Subject Type');

  if (missingHeaders.length > 0) {
    throw new Error(`Invalid Spreadsheet Template. Missing required column headers: ${missingHeaders.join(', ')}`);
  }

  const validRows: any[] = [];
  const failedRows: ImportRowError[] = [];
  let duplicatesCount = 0;

  // Track unique codes inside this file to catch internal duplicate rows
  const seenCodesInFile = new Set<string>();

  // Fetch all departments in DB to quickly look them up
  const { rows: allDepts } = await query<{ id: string; name: string; code: string }>(
    'SELECT id, name, code FROM departments WHERE deleted_at IS NULL'
  );

  // 2. Iterate row by row (starting at row 2)
  for (let r = 2; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    // Skip completely empty rows
    let hasValues = false;
    row.eachCell((cell) => {
      if (getCellValueString(cell) !== '') {
        hasValues = true;
      }
    });
    if (!hasValues) {
      continue;
    }

    const code = getCellValueString(row.getCell(codeIdx)).toUpperCase();
    const name = getCellValueString(row.getCell(nameIdx));
    const deptStr = getCellValueString(row.getCell(deptIdx));
    const progStr = getCellValueString(row.getCell(progIdx));
    const regStr = getCellValueString(row.getCell(regIdx)) || 'R22';
    const yearStr = getCellValueString(row.getCell(yearIdx)).toUpperCase();
    const semStr = getCellValueString(row.getCell(semIdx)).toUpperCase();
    const lStr = lIdx ? getCellValueString(row.getCell(lIdx)) : '0';
    const tStr = tIdx ? getCellValueString(row.getCell(tIdx)) : '0';
    const pStr = pIdx ? getCellValueString(row.getCell(pIdx)) : '0';
    const creditsStr = getCellValueString(row.getCell(creditsIdx));
    const typeStr = getCellValueString(row.getCell(typeIdx));
    const statusStr = statusIdx ? getCellValueString(row.getCell(statusIdx)) : 'Active';

    // ── Required field validations ──
    const rowErrors: string[] = [];

    if (!code) rowErrors.push('Subject Code is required.');
    if (!name) rowErrors.push('Subject Name is required.');
    if (!deptStr) rowErrors.push('Department name is required.');
    if (!progStr) rowErrors.push('Program is required.');
    if (!regStr) rowErrors.push('Regulation is required.');
    if (!yearStr) rowErrors.push('Year is required.');
    if (!semStr) rowErrors.push('Semester is required.');
    if (!creditsStr) rowErrors.push('Credits count is required.');
    if (!typeStr) rowErrors.push('Subject Type is required.');

    if (rowErrors.length > 0) {
      failedRows.push({ rowNumber: r, subjectCode: code || 'UNKNOWN', error: rowErrors.join(' ') });
      continue;
    }

    // ── Numeric constraints validations ──
    const credits = Number(creditsStr);
    const lectureHours = Number(lStr || 0);
    const tutorialHours = Number(tStr || 0);
    const practicalHours = Number(pStr || 0);

    if (isNaN(credits) || credits < 0 || credits > 10) {
      rowErrors.push('Credits must be a numeric value between 0 and 10.');
    }
    if (isNaN(lectureHours) || lectureHours < 0) {
      rowErrors.push('Lecture Hours (L) must be a non-negative number.');
    }
    if (isNaN(tutorialHours) || tutorialHours < 0) {
      rowErrors.push('Tutorial Hours (T) must be a non-negative number.');
    }
    if (isNaN(practicalHours) || practicalHours < 0) {
      rowErrors.push('Practical Hours (P) must be a non-negative number.');
    }

    // ── Enums validations ──
    if (!['I', 'II', 'III', 'IV'].includes(yearStr)) {
      rowErrors.push("Year must be one of 'I', 'II', 'III', 'IV'.");
    }
    if (!['I', 'II'].includes(semStr)) {
      rowErrors.push("Semester must be one of 'I', 'II'.");
    }

    const type = normalizeSubjectType(typeStr);
    if (!type) {
      rowErrors.push("Subject Type must be 'Core', 'Laboratory', 'Elective', 'Mandatory', 'Project', or 'Workshop'.");
    }

    const normalizedStatus = statusStr.toLowerCase();
    const status: SubjectStatus = normalizedStatus === 'inactive' ? 'inactive' : 'active';

    if (rowErrors.length > 0) {
      failedRows.push({ rowNumber: r, subjectCode: code, error: rowErrors.join(' ') });
      continue;
    }

    // ── Department Matching ──
    const matchedDept = findDepartmentByAlias(allDepts, deptStr);
    if (!matchedDept) {
      failedRows.push({
        rowNumber: r,
        subjectCode: code,
        error: `Department '${deptStr}' does not match any registered departments in the database.`
      });
      continue;
    }

    // ── Duplicate Subject Code Handling ──
    if (seenCodesInFile.has(code)) {
      duplicatesCount++;
      continue; // Skip silently inside the file
    }

    const { rows: dbDup } = await query(
      'SELECT id FROM subjects WHERE code = $1 AND deleted_at IS NULL LIMIT 1',
      [code]
    );
    if (dbDup[0]) {
      seenCodesInFile.add(code);
      duplicatesCount++;
      continue; // Skip duplicate code as requested
    }

    // Record verified valid row details
    seenCodesInFile.add(code);
    const calculatedSemester = mapYearSemToSemester(yearStr, semStr);

    validRows.push({
      code,
      name,
      departmentId: matchedDept.id,
      departmentName: matchedDept.name,
      program: progStr,
      regulation: regStr,
      year: yearStr,
      semesterRaw: semStr,
      semester: calculatedSemester,
      lectureHours,
      tutorialHours,
      practicalHours,
      credits,
      type,
      status
    });
  }

  const total = validRows.length + failedRows.length + duplicatesCount;
  return {
    validRows,
    failedRows,
    summary: {
      imported: validRows.length,
      duplicates: duplicatesCount,
      failed: failedRows.length,
      total
    }
  };
}

export async function commitImportedSubjects(
  validRows: any[],
  actorId: string
): Promise<number> {
  let count = 0;
  for (const row of validRows) {
    await query(
      `INSERT INTO subjects (
        code, name, department_id, program_id, semester, credits, type, status,
        regulation, year, semester_raw, lecture_hours, tutorial_hours, practical_hours, program
      ) VALUES ($1, $2, $3, NULL, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (code) DO NOTHING`,
      [
        row.code,
        row.name,
        row.departmentId,
        row.semester,
        row.credits,
        row.type,
        row.status,
        row.regulation,
        row.year,
        row.semesterRaw,
        row.lectureHours,
        row.tutorialHours,
        row.practicalHours,
        row.program
      ]
    );

    // Get inserted ID for auditing
    const { rows } = await query<{ id: string }>('SELECT id FROM subjects WHERE code = $1 LIMIT 1', [row.code]);
    if (rows[0]) {
      await auditLog({
        actorId,
        action: 'IMPORT_SUBJECT',
        resource: 'subjects',
        resourceId: rows[0].id,
        changes: { code: row.code, name: row.name, regulation: row.regulation }
      });
      count++;
    }
  }

  return count;
}
