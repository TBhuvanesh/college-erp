import type { PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { query } from '../../config/database';

import { auditLog } from '../../utils/audit';
import { findDepartmentByAlias } from '../../services/subjectImport.service';
import { getAllCurriculumKeys } from '../../registries/curriculumRegistry.service';
import { cell } from '../ExcelParser';
import type { ParsedSheet } from '../ExcelParser';
import type { ImportStrategy, ValidateRowsResult, CommitBatchResult, ActionedRow } from '../ImportStrategy';
import type { ImportRowError, ImportMode, ReplaceImpact } from '../../types/academicImport';


// ── Student Import Strategy ──────────────────────────────────────────────────
//
// Upgraded to match the official college Excel export rather than a
// hand-designed template: columns are detected by header name (any order),
// Program/Semester are inferred when the sheet doesn't carry them, and two
// import modes are supported — Merge (create-or-update by Roll Number) and
// Replace (wipe existing student-linked data first, then import fresh).
//
// "Do NOT import subjects directly" — this strategy never touches subjects,
// course_materials, attendance, internal_marks, or exams tables for the
// *import* itself. Every downstream module this spec asks to "synchronize"
// (Attendance, LMS, Internal Marks, Examination eligibility, Teaching
// Assignments) already resolves its roster by joining students on
// (department_id, program_id, semester, section) at query time — confirmed
// in attendance.service.ts's getRoster, internal-marks.service.ts's
// getRoster, examination.service.ts's exam roster resolution, and
// lmsAssignment.service.ts's listAssignments. There is no enrollments table
// anywhere in this schema to populate. The moment a student row exists with
// a valid department_id/program_id/semester/section, they are already
// enrolled in every subject Curriculum maps to that combination, eligible
// for every matching exam, and visible on every matching Teaching
// Assignment roster — zero rows written beyond the student itself.
// "Curriculum Located → Subjects Automatically Linked" is a *validation*
// step here (does at least one subject_curriculum_mappings row exist for
// this student's department+regulation+semester?), not a write step.

const REQUIRED_HEADERS: Array<{ label: string; aliases: string[] }> = [
  { label: 'Roll Number', aliases: ['rollnumber', 'roll', 'htno', 'hallticketnumber', 'rollno'] },
  { label: 'Student Name', aliases: ['studentname', 'name', 'fullname'] },
  { label: 'Email', aliases: ['email', 'emailaddress', 'studentemail', 'emailid'] },
  { label: 'Student Mobile', aliases: ['studentmobile', 'mobilenumber', 'mobile', 'phone', 'phonenumber', 'studentphone', 'studentmobileno'] },
  { label: 'Department', aliases: ['department', 'dept', 'branch', 'yrbrsc'] },
  { label: 'Section', aliases: ['section', 'sec', 'ectio', 'yrbrsc'] },
];

// Detected automatically when present, never required — the official sheet
// may or may not carry these, and the ERP can derive sensible defaults.
const OPTIONAL_HEADER_ALIASES = {
  program: ['program', 'course', 'branchprogram'],
  yrSem: ['yrsem', 'yearsemester'],
  semester: ['semester', 'sem', 'currentsemester'],
  year: ['year', 'academicyear2', 'yearofstudy'],
  gender: ['gender', 'sex'],
  parentMobile: ['parentmobile', 'parentcontact', 'fathermobile', 'guardianmobile', 'guardiancontact'],
  fatherName: ['fathername', 'father', 'fathersname'],
  motherName: ['mothername', 'mother', 'mothersname'],
};

// Recognized by name but deliberately never imported — the official sheet
// often carries these; the ERP has no fields for them today and importing
// them would be exactly the kind of extra PII this spec calls out.
const IGNORED_HEADERS: Array<{ label: string; aliases: string[] }> = [
  { label: 'Aadhaar Number', aliases: ['aadhaarnumber', 'aadhaar', 'aadharnumber', 'aadhar', 'aadharno'] },
  { label: 'Government ID', aliases: ['governmentid', 'govtid', 'govid'] },
  { label: 'Permanent Address', aliases: ['permanentaddress'] },
  { label: 'Temporary Address', aliases: ['temporaryaddress', 'currentaddress'] },
  { label: 'Address', aliases: ['address'] },
  { label: 'Blood Group', aliases: ['bloodgroup'] },
];

export interface ValidatedStudentRow {
  rowNumber: number;
  rollNumber: string;
  fullName: string;
  email: string;
  mobileNumber: string;
  departmentId: string;
  departmentName: string;
  programId: string;
  programName: string;
  academicYear: string;
  semester: number;
  section: string;
  admissionYear: number;
  regulation: string;
  status: 'active' | 'graduated' | 'suspended' | 'inactive';
  gender: string | null;
  parentMobile: string | null;
  fatherName: string | null;
  motherName: string | null;
  /** Present only on rows tagged action:'update' (merge mode, existing Roll Number). */
  existingStudentId?: string;
  existingUserId?: string;
  temporaryPassword?: string;
  passwordHash?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_RE = /^[0-9+\-\s]{10,15}$/;
const ACADEMIC_YEAR_RE = /^\d{4}-\d{4}$/;
const STATUS_VALUES = ['active', 'graduated', 'suspended', 'inactive'] as const;
const YEAR_ROMAN: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6 };

function findProgramByAlias(
  programs: { id: string; name: string; code: string; department_id: string; total_semesters: number }[],
  departmentId: string,
  programStr: string
) {
  const s = programStr.trim().toLowerCase();
  const inDept = programs.filter((p) => p.department_id === departmentId);
  return (
    inDept.find((p) => p.name.toLowerCase() === s || p.code.toLowerCase() === s) ??
    inDept.find((p) => p.name.toLowerCase().includes(s) || s.includes(p.name.toLowerCase()))
  );
}

/**
 * Resolves the student's semester when the sheet doesn't carry an explicit
 * Semester column — the official format doesn't list one. Preference order:
 * explicit Semester cell → explicit Year cell (assumes the first/odd
 * semester of that year) → derived from Admission Year vs. the Academic
 * Session's starting year (also assumes odd semester — the common case for
 * a start-of-year bulk onboarding import), clamped to the program's
 * total_semesters.
 */
function parseRomanOrArabic(val: string): number | null {
  if (!val) return null;
  const n = parseInt(val, 10);
  if (Number.isInteger(n)) return n;
  return YEAR_ROMAN[val.toUpperCase()] || null;
}

function resolveSemester(
  yrSemStr: string,
  semesterStr: string,
  yearStr: string,
  admissionYear: number,
  academicYear: string,
  totalSemesters: number
): number | null {
  if (yrSemStr) {
    const match = yrSemStr.trim().match(/^([IV1-4]+)[\/\-]([IV1-2]+)$/i);
    if (match) {
      const yr = parseRomanOrArabic(match[1]);
      const sem = parseRomanOrArabic(match[2]);
      if (yr && sem) {
        const calculatedSem = (yr - 1) * 2 + sem;
        if (calculatedSem >= 1 && calculatedSem <= totalSemesters) {
          return calculatedSem;
        }
      }
    }
  }
  if (semesterStr) {
    const n = Number(semesterStr);
    if (Number.isInteger(n) && n >= 1 && n <= totalSemesters) return n;
    return null;
  }
  if (yearStr) {
    const y = YEAR_ROMAN[yearStr.toUpperCase()];
    if (y) return Math.min((y - 1) * 2 + 1, totalSemesters);
  }
  const sessionStartYear = Number(academicYear.split('-')[0]);
  if (Number.isInteger(sessionStartYear) && Number.isInteger(admissionYear)) {
    const derived = (sessionStartYear - admissionYear) * 2 + 1;
    return Math.min(Math.max(derived, 1), totalSemesters);
  }
  return null;
}



async function validateRows(sheet: ParsedSheet, mode: ImportMode): Promise<ValidateRowsResult<ValidatedStudentRow>> {
  const validRows: ActionedRow<ValidatedStudentRow>[] = [];
  const invalidRows: ImportRowError[] = [];
  let duplicateCount = 0;
  let toCreateCount = 0;
  let toUpdateCount = 0;

  // ── Bulk-fetch everything needed to resolve/validate rows — one query
  // each, never per-row, however many rows are in the file (3,000-5,000+). ──
  const [{ rows: departments }, { rows: programs }, curriculumSet, { rows: existingStudents }] = await Promise.all([
    query<{ id: string; name: string; code: string }>('SELECT id, name, code FROM departments WHERE deleted_at IS NULL'),
    query<{ id: string; name: string; code: string; department_id: string; total_semesters: number }>(
      'SELECT id, name, code, department_id, total_semesters FROM programs WHERE is_active = TRUE AND deleted_at IS NULL'
    ),
    getAllCurriculumKeys(),
    query<{ id: string; user_id: string; roll_number: string; email: string }>(
      `SELECT s.id, s.user_id, s.roll_number, u.email
       FROM students s JOIN users u ON u.id = s.user_id
       WHERE s.deleted_at IS NULL`
    ),
  ]);

  const dbStudentByRoll = new Map(existingStudents.map((s) => [s.roll_number.toUpperCase(), s]));
  const dbRollByEmail = new Map(existingStudents.map((s) => [s.email.toLowerCase(), s.roll_number.toUpperCase()]));

  const seenRollNumbers = new Set<string>();
  const seenEmails = new Set<string>();

  for (const row of sheet.rows) {
    const errors: string[] = [];

    const rollNumber = cell(row, ['rollnumber', 'roll', 'htno', 'hallticketnumber', 'rollno']).toUpperCase();
    const fullName = cell(row, ['studentname', 'name', 'fullname']);
    const email = cell(row, ['email', 'emailaddress', 'studentemail', 'emailid']).toLowerCase();
    const mobileNumber = cell(row, ['studentmobile', 'mobilenumber', 'mobile', 'phone', 'phonenumber', 'studentphone', 'studentmobileno']);
    const deptStr = cell(row, ['department', 'dept', 'branch']);
    const academicYear = cell(row, ['academicsession', 'academicyear', 'session']);
    const section = cell(row, ['section', 'sec']).toUpperCase();
    const admissionYearStr = cell(row, ['admissionyear', 'admityear', 'yearofadmission']);
    const regulation = cell(row, ['academicregulation', 'regulation', 'reg']) || 'R22';
    const statusStr = (cell(row, ['studentstatus', 'status']) || 'Active').toLowerCase();

    const programStr = cell(row, OPTIONAL_HEADER_ALIASES.program);
    const yrSemStr = cell(row, OPTIONAL_HEADER_ALIASES.yrSem);
    const semesterStr = cell(row, OPTIONAL_HEADER_ALIASES.semester);
    const yearStr = cell(row, OPTIONAL_HEADER_ALIASES.year);
    const gender = cell(row, OPTIONAL_HEADER_ALIASES.gender) || null;
    const parentMobile = cell(row, OPTIONAL_HEADER_ALIASES.parentMobile) || null;
    const fatherName = cell(row, OPTIONAL_HEADER_ALIASES.fatherName) || null;
    const motherName = cell(row, OPTIONAL_HEADER_ALIASES.motherName) || null;

    // ── Smart Fallbacks & Inferences ──
    
    // 1. Resolve Department (from 'deptStr' or 'Yr/Br/Sc' or Roll Number)
    let resolvedDept = deptStr;
    if (!resolvedDept) {
      const yrBrSc = cell(row, ['yrbrsc', 'yrbrscsection']);
      if (yrBrSc) {
        const parts = yrBrSc.split(/[\/\-_]/);
        if (parts.length >= 2) {
          resolvedDept = parts[1].trim();
        }
      }
    }
    if (!resolvedDept && rollNumber) {
      const match = rollNumber.match(/\d{2,4}([A-Za-z]+)\d+/);
      if (match) {
        resolvedDept = match[1];
      }
    }

    // 2. Resolve Section (from 'section' or 'Yr/Br/Sc')
    let resolvedSection = section;
    if (!resolvedSection) {
      const yrBrSc = cell(row, ['yrbrsc', 'yrbrscsection']);
      if (yrBrSc) {
        const parts = yrBrSc.split(/[\/\-_]/);
        if (parts.length >= 3) {
          resolvedSection = parts[2].trim().toUpperCase();
        }
      }
    }

    // 3. Resolve Academic Session (default to '2026-2027')
    let resolvedAcademicYear = academicYear || '2026-2027';
    if (resolvedAcademicYear === '2026-27') {
      resolvedAcademicYear = '2026-2027'; // normalize format
    }

    // 4. Resolve Admission Year (from 'admissionYearStr' or Roll Number or Academic Session)
    let resolvedAdmissionYearStr = admissionYearStr;
    if (!resolvedAdmissionYearStr) {
      if (rollNumber) {
        const year4Match = rollNumber.match(/^(20\d{2})/);
        if (year4Match) {
          resolvedAdmissionYearStr = year4Match[1];
        } else {
          const year2Match = rollNumber.match(/^(\d{2})/);
          if (year2Match) {
            resolvedAdmissionYearStr = `20${year2Match[1]}`;
          }
        }
      }
    }
    if (!resolvedAdmissionYearStr) {
      const sessMatch = resolvedAcademicYear.match(/^(20\d{2})/);
      if (sessMatch) {
        resolvedAdmissionYearStr = sessMatch[1];
      }
    }

    // ── Mandatory fields ──
    if (!rollNumber) errors.push('Roll Number is required.');
    if (!fullName) errors.push('Student Name is required.');
    if (!email) errors.push('Email is required.');
    if (!mobileNumber) errors.push('Student Mobile is required.');
    if (!resolvedDept) errors.push('Department is required.');
    if (!resolvedAcademicYear) errors.push('Academic Session is required.');
    if (!resolvedSection) errors.push('Section is required.');
    if (!resolvedAdmissionYearStr) errors.push('Admission Year is required.');

    if (errors.length > 0) {
      invalidRows.push({ rowNumber: row.rowNumber, identifier: rollNumber || `row ${row.rowNumber}`, errors });
      continue;
    }

    // ── Data type / format validation ──
    if (!EMAIL_RE.test(email)) errors.push(`Invalid email format: '${email}'.`);
    if (!MOBILE_RE.test(mobileNumber)) errors.push(`Invalid Student Mobile format: '${mobileNumber}'.`);
    if (!ACADEMIC_YEAR_RE.test(resolvedAcademicYear)) errors.push(`Academic Session must be in YYYY-YYYY format, got '${resolvedAcademicYear}'.`);

    const admissionYear = Number(resolvedAdmissionYearStr);
    const currentYear = new Date().getFullYear();
    if (!Number.isInteger(admissionYear) || admissionYear < 2000 || admissionYear > currentYear + 1) {
      errors.push(`Admission Year must be a valid year, got '${resolvedAdmissionYearStr}'.`);
    }

    const status = STATUS_VALUES.includes(statusStr as (typeof STATUS_VALUES)[number])
      ? (statusStr as ValidatedStudentRow['status'])
      : null;
    if (!status) errors.push(`Student Status must be one of ${STATUS_VALUES.join(', ')}, got '${statusStr}'.`);

    // ── Department / Program resolution ──
    const matchedDept = findDepartmentByAlias(departments, resolvedDept);
    if (!matchedDept) errors.push(`Department '${resolvedDept}' does not match any registered department.`);

    let matchedProgram: (typeof programs)[number] | undefined;
    if (matchedDept) {
      const deptPrograms = programs.filter((p) => p.department_id === matchedDept.id);
      if (programStr) {
        matchedProgram = findProgramByAlias(programs, matchedDept.id, programStr);
        if (!matchedProgram) errors.push(`Program '${programStr}' does not match any program in department '${matchedDept.name}'.`);
      } else if (deptPrograms.length === 1) {
        // Smart detection: the official sheet has no Program column — when a
        // department maps to exactly one program (the common case), infer it.
        matchedProgram = deptPrograms[0];
      } else if (deptPrograms.length === 0) {
        errors.push(`Department '${matchedDept.name}' has no active program configured.`);
      } else {
        errors.push(`Department '${matchedDept.name}' has multiple programs — add a 'Program' column to disambiguate.`);
      }
    }

    // ── Semester resolution (smart-detected when not in the sheet) ──
    let semester: number | null = null;
    if (matchedProgram) {
      semester = resolveSemester(yrSemStr, semesterStr, yearStr, admissionYear, resolvedAcademicYear, matchedProgram.total_semesters);
      if (semester === null) {
        errors.push(
          `Could not determine Semester for Roll Number '${rollNumber}' — add a 'Semester' or 'Year' column, or verify Admission Year/Academic Session.`
        );
      }
    }

    // ── Missing Curriculum / Missing Regulation ──
    if (matchedDept && semester !== null) {
      const key = `${matchedDept.id}::${regulation}::${semester}`;
      if (!curriculumSet.has(key)) {
        errors.push(
          `No curriculum found for department '${matchedDept.name}', regulation '${regulation}', semester ${semester}. ` +
            `Import subjects/curriculum for this combination first.`
        );
      }
    }

    if (errors.length > 0) {
      invalidRows.push({ rowNumber: row.rowNumber, identifier: rollNumber, errors });
      continue;
    }

    // ── In-file duplicate detection — always rejected regardless of mode ──
    if (seenRollNumbers.has(rollNumber) || seenEmails.has(email)) {
      duplicateCount++;
      continue;
    }
    seenRollNumbers.add(rollNumber);
    seenEmails.add(email);

    const baseRow: ValidatedStudentRow = {
      rowNumber: row.rowNumber,
      rollNumber,
      fullName,
      email,
      mobileNumber,
      departmentId: matchedDept!.id,
      departmentName: matchedDept!.name,
      programId: matchedProgram!.id,
      programName: matchedProgram!.name,
      academicYear: resolvedAcademicYear,
      semester: semester!,
      section: resolvedSection,
      admissionYear,
      regulation,
      status: status!,
      gender,
      parentMobile,
      fatherName,
      motherName,
    };

    if (mode === 'replace') {
      // Existing DB rows are wiped before commit (deleteForReplace) — never
      // reject a row here for colliding with data that won't exist anymore.
      validRows.push({ ...baseRow, action: 'create' });
      toCreateCount++;
      continue;
    }

    // mode === 'merge'
    const existing = dbStudentByRoll.get(rollNumber);
    const emailOwnerRoll = dbRollByEmail.get(email);

    if (emailOwnerRoll && emailOwnerRoll !== rollNumber) {
      invalidRows.push({
        rowNumber: row.rowNumber,
        identifier: rollNumber,
        errors: [`Email '${email}' is already used by a different existing student (Roll Number ${emailOwnerRoll}).`],
      });
      continue;
    }

    if (existing) {
      validRows.push({ ...baseRow, existingStudentId: existing.id, existingUserId: existing.user_id, action: 'update' });
      toUpdateCount++;
    } else {
      validRows.push({ ...baseRow, action: 'create' });
      toCreateCount++;
    }
  }

  return { validRows, invalidRows, duplicateCount, toCreateCount, toUpdateCount };
}

function buildDistributions(validRows: ActionedRow<ValidatedStudentRow>[]): Record<string, Record<string, number>> {
  const department: Record<string, number> = {};
  const academicSession: Record<string, number> = {};
  const section: Record<string, number> = {};

  for (const r of validRows) {
    department[r.departmentName] = (department[r.departmentName] ?? 0) + 1;
    academicSession[r.academicYear] = (academicSession[r.academicYear] ?? 0) + 1;
    section[r.section] = (section[r.section] ?? 0) + 1;
  }

  return { department, academicSession, section };
}

export interface CreatedStudentCredential {
  rollNumber: string;
  email: string;
  temporaryPassword: string;
}

async function preCommit(rows: ActionedRow<ValidatedStudentRow>[]): Promise<void> {
  const toCreate = rows.filter((r) => r.action === 'create');
  if (toCreate.length === 0) return;

  const defaultPassword = "Student123";
  const defaultHash = await bcrypt.hash(defaultPassword, 4);

  toCreate.forEach((row) => {
    row.temporaryPassword = defaultPassword;
    row.passwordHash = defaultHash;
  });
}

async function commitChunk(
  client: PoolClient,
  rows: ActionedRow<ValidatedStudentRow>[],
  _actorId: string
): Promise<CommitBatchResult> {
  if (rows.length === 0) return { createdCount: 0, updatedCount: 0, skippedCount: 0 };

  const toCreate = rows.filter((r) => r.action === 'create');
  const toUpdate = rows.filter((r) => r.action === 'update');
  const details: CreatedStudentCredential[] = [];

  // ── CREATE: bulk INSERT users + students + fees (one statement per table
  // for the whole sub-chunk, not one per row) ──
  if (toCreate.length > 0) {
    const userIds = toCreate.map(() => uuidv4());

    const userValues: string[] = [];
    const userParams: unknown[] = [];
    toCreate.forEach((row, i) => {
      const base = i * 4;
      userValues.push(`($${base + 1}, $${base + 2}, $${base + 3}, 'student', $${base + 4})`);
      const rollEmail = `${row.rollNumber.toLowerCase()}@college.erp`;
      userParams.push(userIds[i], rollEmail, row.passwordHash!, row.fullName);
    });
    await client.query(`INSERT INTO users (id, email, password_hash, role, full_name) VALUES ${userValues.join(', ')}`, userParams);

    const studentIds = toCreate.map(() => uuidv4());
    const studentValues: string[] = [];
    const studentParams: unknown[] = [];
    toCreate.forEach((row, i) => {
      const base = i * 13;
      studentValues.push(
        `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, $${base + 13})`
      );
      studentParams.push(
        studentIds[i],
        userIds[i],
        row.rollNumber,
        row.fullName,
        row.departmentId,
        row.programId,
        row.semester,
        row.section,
        row.academicYear,
        row.mobileNumber,
        row.gender,
        row.parentMobile,
        row.status
      );
    });
    await client.query(
      `INSERT INTO students (id, user_id, roll_number, full_name, department_id, program_id, semester, section, academic_year,
                             mobile_number, gender, parent_contact, status)
       VALUES ${studentValues.join(', ')}`,
      studentParams
    );

    // father_name/mother_name inserted separately to keep the primary
    // students INSERT's column list matching the pre-existing single-row
    // createStudent() shape as closely as possible; still one bulk
    // statement, not one per row.
    const nameValues: string[] = [];
    const nameParams: unknown[] = [];
    toCreate.forEach((row, i) => {
      const base = i * 3;
      nameValues.push(`($${base + 1}::uuid, $${base + 2}, $${base + 3})`);
      nameParams.push(studentIds[i], row.fatherName, row.motherName);
    });
    await client.query(
      `UPDATE students AS s SET father_name = v.father_name, mother_name = v.mother_name
       FROM (VALUES ${nameValues.join(', ')}) AS v(id, father_name, mother_name)
       WHERE s.id = v.id`,
      nameParams
    );

    // Same auto-generated Tuition Fee row createStudent() creates for a
    // single student — reused here so bulk-imported students aren't
    // missing fee records the rest of the Fees module expects.
    const dueDate = new Date();
    dueDate.setMonth(dueDate.getMonth() + 1);
    const dueDateStr = dueDate.toISOString().split('T')[0];

    const feeValues: string[] = [];
    const feeParams: unknown[] = [];
    toCreate.forEach((row, i) => {
      const base = i * 5;
      feeValues.push(
        `(uuid_generate_v4(), $${base + 1}, $${base + 2}, $${base + 3}, 'Tuition Fee', 106000.00, 0.00, 106000.00, $${base + 4}, 'Pending', $${base + 5})`
      );
      feeParams.push(studentIds[i], row.academicYear, row.semester, dueDateStr, 'Initial Tuition Fee Allocation (Bulk Import)');
    });
    await client.query(
      `INSERT INTO fees (id, student_id, academic_year, semester, fee_type, total_amount, paid_amount, pending_amount, due_date, payment_status, remarks)
       VALUES ${feeValues.join(', ')}`,
      feeParams
    );



    toCreate.forEach((row) => {
      const rollEmail = `${row.rollNumber.toLowerCase()}@college.erp`;
      details.push({ rollNumber: row.rollNumber, email: rollEmail, temporaryPassword: row.temporaryPassword! });
    });
  }

  // ── UPDATE (merge mode, existing Roll Number): bulk UPDATE students, then
  // bulk UPDATE users.full_name/email — one statement per table, not one
  // UPDATE per row. ──
  if (toUpdate.length > 0) {
    const studentValues: string[] = [];
    const studentParams: unknown[] = [];
    toUpdate.forEach((row, i) => {
      const base = i * 13;
      studentValues.push(
        `($${base + 1}::uuid, $${base + 2}, $${base + 3}::uuid, $${base + 4}::uuid, $${base + 5}::smallint, $${base + 6}, $${base + 7}, ` +
          `$${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}::student_status, $${base + 13})`
      );
      studentParams.push(
        row.existingStudentId,
        row.fullName,
        row.departmentId,
        row.programId,
        row.semester,
        row.section,
        row.academicYear,
        row.mobileNumber,
        row.gender,
        row.parentMobile,
        row.fatherName,
        row.status,
        row.motherName
      );
    });
    await client.query(
      `UPDATE students AS s SET
         full_name = v.full_name, department_id = v.department_id, program_id = v.program_id,
         semester = v.semester, section = v.section, academic_year = v.academic_year,
         mobile_number = v.mobile_number, gender = v.gender, parent_contact = v.parent_contact,
         father_name = v.father_name, status = v.status, mother_name = v.mother_name,
         updated_at = NOW()
       FROM (VALUES ${studentValues.join(', ')})
         AS v(id, full_name, department_id, program_id, semester, section, academic_year,
              mobile_number, gender, parent_contact, father_name, status, mother_name)
       WHERE s.id = v.id`,
      studentParams
    );

    const userValues: string[] = [];
    const userParams: unknown[] = [];
    toUpdate.forEach((row, i) => {
      const base = i * 3;
      userValues.push(`($${base + 1}::uuid, $${base + 2}, $${base + 3})`);
      userParams.push(row.existingUserId, row.email, row.fullName);
    });
    await client.query(
      `UPDATE users AS u SET email = v.email, full_name = v.full_name
       FROM (VALUES ${userValues.join(', ')}) AS v(id, email, full_name)
       WHERE u.id = v.id`,
      userParams
    );


  }

  return { createdCount: toCreate.length, updatedCount: toUpdate.length, skippedCount: 0, details };
}

// No module-level mutable state (this strategy object is a singleton reused
// across concurrent requests — anything shared across imports would race).
// Instead, re-resolve exactly which users were just created/updated for this
// job by roll number, in one bulk query, after the commit transaction
// succeeds.
async function onJobCompleted(rows: ActionedRow<ValidatedStudentRow>[], actorId: string, jobId: string): Promise<void> {
  const created = rows.filter((r) => r.action === 'create');
  const rollNumbers = created.map((r) => r.rollNumber);
  if (rollNumbers.length > 0) {
    const { rows: createdUsers } = await query<{ user_id: string; roll_number: string; department_id: string; semester: number }>(
      `SELECT user_id, roll_number, department_id, semester FROM students WHERE roll_number = ANY($1) AND deleted_at IS NULL`,
      [rollNumbers]
    );

    const notificationValues: string[] = [];
    const notificationParams: unknown[] = [];
    createdUsers.forEach((c, idx) => {
      const base = idx * 5;
      notificationValues.push(
        `(uuid_generate_v4(), 'Welcome to the Student Portal', $${base + 1}, 'Announcement', 'student', $${base + 2}, $${base + 3}, true, $${base + 4}, $${base + 5})`
      );
      const message = `Your student account for ${c.roll_number} has been created. Please log in and change your temporary password.`;
      notificationParams.push(message, c.department_id, c.semester, actorId, c.user_id);
    });

    const chunkSize = 200;
    for (let idx = 0; idx < notificationValues.length; idx += chunkSize) {
      const chunkValues = notificationValues.slice(idx, idx + chunkSize);
      const chunkParams = notificationParams.slice(idx * 5, (idx + chunkSize) * 5);
      
      const mappedValues = chunkValues.map((val) => {
        return val.replace(/\$(\d+)/g, (_, num) => {
          const originalIndex = parseInt(num) - 1 - (idx * 5);
          return `$${originalIndex + 1}`;
        });
      });

      await query(
        `INSERT INTO notifications (id, title, message, type, target_role, department_id, semester, is_important, created_by, recipient_user_id)
         VALUES ${mappedValues.join(', ')}`,
        chunkParams
      );
    }
  }

  await auditLog({
    actorId,
    action: 'STUDENT_IMPORT_COMPLETED',
    resource: 'import_jobs',
    resourceId: jobId,
    changes: { studentsCreated: created.length, studentsUpdated: rows.length - created.length },
  });
}

// ── Replace mode: delete only student-linked data, never master data ────────
// Deletion order respects every FK from these tables to students(id)/
// users(id) (see migrations 006, 007, 009, 010, 017, 018, 023, 024, 027, 029)
// — children deleted before students, students before users. Departments,
// Subjects, Curriculum, Faculty, Teaching Assignments, Classrooms, System
// Settings, Workflow Configuration, RBAC, and Admin Accounts are never
// touched by any statement in this function.

const REPLACE_TABLE_LABELS: Record<string, string> = {
  exam_seat_allocations: 'Exam Eligibility (Seat Allocations)',
  feedback_submission_tracking: 'Feedback Submission Tracking',
  mentor_group_students: 'Mentorship Assignments (Groups)',
  mentoring_notes: 'Mentorship Assignments (Notes)',
  mentor_assignments: 'Mentorship Assignments',
  opportunity_bookmarks: 'Opportunity Bookmarks',
  assignment_submissions: 'LMS Enrollments (Assignment Submissions)',
  fee_payments: 'Student Fee Payments Ledger',
  fees: 'Student Fee Records',
  results: 'Results (linked to demo students)',
  internal_marks: 'Internal Marks',
  attendance: 'Attendance Records',
  notifications: 'Student Notifications',
  students: 'Students / Student Profiles',
  users: 'Student User Accounts',
};

async function getReplaceImpact(): Promise<ReplaceImpact> {
  const { rows } = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM students WHERE deleted_at IS NULL`);
  const studentCount = Number(rows[0].count);

  if (studentCount === 0) {
    const counts: Record<string, number> = {};
    for (const key of Object.keys(REPLACE_TABLE_LABELS)) counts[REPLACE_TABLE_LABELS[key]] = 0;
    return { entityType: 'student', counts, protectedTables: PROTECTED_MASTER_DATA };
  }

  const countQueries: Array<[string, string]> = [
    ['exam_seat_allocations', `SELECT COUNT(*)::text AS count FROM exam_seat_allocations WHERE student_id IN (SELECT id FROM students)`],
    ['feedback_submission_tracking', `SELECT COUNT(*)::text AS count FROM feedback_submission_tracking WHERE student_id IN (SELECT id FROM students)`],
    ['mentor_group_students', `SELECT COUNT(*)::text AS count FROM mentor_group_students WHERE student_id IN (SELECT id FROM students)`],
    ['mentoring_notes', `SELECT COUNT(*)::text AS count FROM mentoring_notes WHERE student_id IN (SELECT id FROM students)`],
    ['mentor_assignments', `SELECT COUNT(*)::text AS count FROM mentor_assignments WHERE student_id IN (SELECT id FROM students)`],
    ['opportunity_bookmarks', `SELECT COUNT(*)::text AS count FROM opportunity_bookmarks WHERE student_id IN (SELECT id FROM students)`],
    ['assignment_submissions', `SELECT COUNT(*)::text AS count FROM assignment_submissions WHERE student_id IN (SELECT id FROM students)`],
    ['fee_payments', `SELECT COUNT(*)::text AS count FROM fee_payments WHERE fee_id IN (SELECT id FROM fees WHERE student_id IN (SELECT id FROM students))`],
    ['fees', `SELECT COUNT(*)::text AS count FROM fees WHERE student_id IN (SELECT id FROM students)`],
    ['results', `SELECT COUNT(*)::text AS count FROM results WHERE student_id IN (SELECT id FROM students)`],
    ['internal_marks', `SELECT COUNT(*)::text AS count FROM internal_marks WHERE student_id IN (SELECT id FROM students)`],
    ['attendance', `SELECT COUNT(*)::text AS count FROM attendance WHERE student_id IN (SELECT id FROM students)`],
    ['notifications', `SELECT COUNT(*)::text AS count FROM notifications WHERE recipient_user_id IN (SELECT user_id FROM students)`],
  ];

  const results = await Promise.all(countQueries.map(([, sql]) => query<{ count: string }>(sql)));
  const counts: Record<string, number> = {};
  countQueries.forEach(([key], i) => {
    counts[REPLACE_TABLE_LABELS[key]] = Number(results[i].rows[0].count);
  });
  counts[REPLACE_TABLE_LABELS.students] = studentCount;
  counts[REPLACE_TABLE_LABELS.users] = studentCount;

  return { entityType: 'student', counts, protectedTables: PROTECTED_MASTER_DATA };
}

const PROTECTED_MASTER_DATA = [
  'Departments',
  'Subjects',
  'Curriculum',
  'Faculty',
  'Teaching Assignments',
  'Academic Sessions',
  'Classrooms',
  'System Settings',
  'Workflow Configuration',
  'RBAC / Roles',
  'Admin Accounts',
];

async function deleteForReplace(client: PoolClient, actorId: string): Promise<Record<string, number>> {
  const { rows: studentRows } = await client.query<{ id: string; user_id: string }>(
    `SELECT id, user_id FROM students`
  );
  const studentIds = studentRows.map((s) => s.id);
  const userIds = studentRows.map((s) => s.user_id);
  const deleted: Record<string, number> = {};

  if (studentIds.length === 0) {
    for (const label of Object.values(REPLACE_TABLE_LABELS)) deleted[label] = 0;
    return deleted;
  }

  const del = async (key: keyof typeof REPLACE_TABLE_LABELS, sql: string, params: unknown[]) => {
    const result = await client.query(sql, params);
    deleted[REPLACE_TABLE_LABELS[key]] = result.rowCount ?? 0;
  };

  // Children of students first (FK order), then students, then users.
  await del('exam_seat_allocations', `DELETE FROM exam_seat_allocations WHERE student_id = ANY($1)`, [studentIds]);
  await del('feedback_submission_tracking', `DELETE FROM feedback_submission_tracking WHERE student_id = ANY($1)`, [studentIds]);
  await del('mentor_group_students', `DELETE FROM mentor_group_students WHERE student_id = ANY($1)`, [studentIds]);
  await del('mentoring_notes', `DELETE FROM mentoring_notes WHERE student_id = ANY($1)`, [studentIds]);
  await del('mentor_assignments', `DELETE FROM mentor_assignments WHERE student_id = ANY($1)`, [studentIds]);
  await del('opportunity_bookmarks', `DELETE FROM opportunity_bookmarks WHERE student_id = ANY($1)`, [studentIds]);
  await del('assignment_submissions', `DELETE FROM assignment_submissions WHERE student_id = ANY($1)`, [studentIds]);
  await del('fee_payments', `DELETE FROM fee_payments WHERE fee_id IN (SELECT id FROM fees WHERE student_id = ANY($1))`, [studentIds]);
  await del('fees', `DELETE FROM fees WHERE student_id = ANY($1)`, [studentIds]);
  await del('results', `DELETE FROM results WHERE student_id = ANY($1)`, [studentIds]);
  await del('internal_marks', `DELETE FROM internal_marks WHERE student_id = ANY($1)`, [studentIds]);
  await del('attendance', `DELETE FROM attendance WHERE student_id = ANY($1)`, [studentIds]);
  await del('notifications', `DELETE FROM notifications WHERE recipient_user_id = ANY($1)`, [userIds]);

  // audit_logs.actor_id has no ON DELETE clause — a student who ever
  // performed an audited self-service action (e.g. submitting feedback)
  // would otherwise block deleting their user row. Null it out rather than
  // deleting the audit rows themselves, preserving the historical record.
  await client.query(`UPDATE audit_logs SET actor_id = NULL WHERE actor_id = ANY($1)`, [userIds]);

  await del('students', `DELETE FROM students WHERE id = ANY($1)`, [studentIds]);
  await del('users', `DELETE FROM users WHERE id = ANY($1)`, [userIds]);

  await auditLog({
    actorId,
    action: 'STUDENT_REPLACE_DELETE',
    resource: 'students',
    changes: { ...deleted },
  });

  return deleted;
}

export const studentImportStrategy: ImportStrategy<ValidatedStudentRow> = {
  entityType: 'student',
  requiredHeaders: REQUIRED_HEADERS,
  ignoredHeaders: IGNORED_HEADERS,
  validateRows,
  buildDistributions,
  preCommit,
  commitChunk,
  onJobCompleted,
  getReplaceImpact,
  deleteForReplace,
};
// Trigger rebuild
