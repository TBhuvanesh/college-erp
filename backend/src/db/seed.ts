/**
 * Comprehensive Database Seed Script for College ERP
 * Seeds highly realistic data for departments, programs, faculty, students,
 * subjects, faculty assignments, attendance logs, marks, results, fees,
 * announcements, and academic calendars.
 *
 * Runs completely locally in under 5 seconds by pre-hashing passwords once
 * and performing chunked bulk inserts.
 *
 * Usage: npm run seed
 */

import { pool, query } from '../config/database';
import { hashPassword } from '../utils/password';
import { v4 as uuidv4 } from 'uuid';

// ── Indian Naming Combinatorics ─────────────────────────────────────────────
const INDIAN_FIRST_NAMES_MALE = [
  'Rahul', 'Amit', 'Rohan', 'Vikram', 'Sanjay', 'Aditya', 'Karan', 'Abhishek', 'Arjun', 'Kunal',
  'Manish', 'Rohit', 'Varun', 'Vivek', 'Sandeep', 'Gaurav', 'Kartik', 'Deepak', 'Nilesh', 'Harish',
  'Manoj', 'Priyansh', 'Sai', 'Yash', 'Tushar', 'Aniket', 'Aarav', 'Dev', 'Kabir', 'Rudra'
];

const INDIAN_FIRST_NAMES_FEMALE = [
  'Priya', 'Anjali', 'Sneha', 'Neha', 'Riya', 'Divya', 'Pooja', 'Aditi', 'Kavita', 'Shreya',
  'Tanvi', 'Kirti', 'Megha', 'Swati', 'Preeti', 'Payal', 'Komal', 'Aarti', 'Shruti', 'Rashmi',
  'Deepika', 'Nehal', 'Pallavi', 'Ritu', 'Sakshi', 'Isha', 'Kavya', 'Riddhi', 'Diya', 'Nisha'
];

const INDIAN_LAST_NAMES = [
  'Sharma', 'Verma', 'Gupta', 'Iyer', 'Reddy', 'Rao', 'Patel', 'Joshi', 'Nair', 'Mehta',
  'Singh', 'Kumar', 'Sen', 'Roy', 'Bose', 'Das', 'Mishra', 'Pandey', 'Choudhury', 'Kulkarni',
  'Deshmukh', 'Patil', 'Bhat', 'Prasad', 'Dubey', 'Trivedi', 'Jha', 'Narang', 'Saxena'
];

function generateIndianName(index: number): string {
  const firstList = index % 2 === 0 ? INDIAN_FIRST_NAMES_MALE : INDIAN_FIRST_NAMES_FEMALE;
  const firstName = firstList[index % firstList.length];
  const lastName = INDIAN_LAST_NAMES[(index * 7) % INDIAN_LAST_NAMES.length];
  return `${firstName} ${lastName}`;
}

// Helper to format JNTUH Roll Numbers
// YYVE1A[BranchCode][Sequence] e.g. 23VE1A0515
function getRollNumber(entryYear: number, branchCode: string, sequence: number): string {
  let seqStr = '';
  if (sequence <= 99) {
    seqStr = sequence.toString().padStart(2, '0');
  } else {
    const letterIndex = Math.floor((sequence - 100) / 10);
    const digitIndex = (sequence - 100) % 10;
    const char = String.fromCharCode(65 + letterIndex); // A = 65, B = 66...
    seqStr = `${char}${digitIndex}`;
  }
  return `${entryYear}VE1A${branchCode}${seqStr}`.toUpperCase();
}

// Dynamic bulk insert helper to speed up db execution
async function bulkInsert(
  tableName: string,
  columns: string[],
  rows: any[][]
): Promise<void> {
  if (rows.length === 0) return;
  const batchSize = 100;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const valuePlaceholders: string[] = [];
    const flatValues: any[] = [];
    let paramIndex = 1;

    for (const rowData of batch) {
      const rowPlaceholders: string[] = [];
      for (const val of rowData) {
        rowPlaceholders.push(`$${paramIndex++}`);
        flatValues.push(val);
      }
      valuePlaceholders.push(`(${rowPlaceholders.join(', ')})`);
    }

    const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${valuePlaceholders.join(', ')}`;
    await query(sql, flatValues);
  }
}

// Logger utility
function logStep(label: string, count: number): void {
  console.log(`  + Seeded ${count.toString().padStart(5)} ${label}`);
}

async function seed(): Promise<void> {
  console.log('\n[1/12] Resetting database tables (Truncate Cascade)...');
  await query(`
    TRUNCATE TABLE 
      users, departments, programs, subjects, faculty, students, 
      faculty_subject_assignments, attendance, internal_marks, exams, 
      results, fees, fee_payments, announcements, documents, 
      parsed_events, academic_calendar_events, refresh_tokens, audit_logs 
    CASCADE;
  `);
  console.log('  ~ Truncation completed successfully.');

  // ── Pre-hashing Passwords ──────────────────────────────────────────────────
  console.log('\n[2/12] Pre-generating security credentials...');
  const adminHash = await hashPassword('Admin@12345');
  const facultyHash = await hashPassword('Faculty@12345');
  const studentHash = await hashPassword('Student@12345');
  console.log('  ~ Password hashes pre-generated.');

  // ── Departments & Programs ─────────────────────────────────────────────────
  console.log('\n[3/12] Seeding departments and degree programs...');
  
  const DEPARTMENTS = [
    { id: uuidv4(), name: 'Computer Science & Engineering', code: 'CSE', branchCode: '05' },
    { id: uuidv4(), name: 'Artificial Intelligence and Machine Learning', code: 'AIML', branchCode: '66' },
    { id: uuidv4(), name: 'Data Science', code: 'DS', branchCode: '67' },
    { id: uuidv4(), name: 'Electronics & Communication Engineering', code: 'ECE', branchCode: '04' }
  ];

  for (const dept of DEPARTMENTS) {
    await query(
      `INSERT INTO departments (id, name, code) VALUES ($1, $2, $3)`,
      [dept.id, dept.name, dept.code]
    );
  }
  logStep('departments', DEPARTMENTS.length);

  const PROGRAMS = [
    { id: uuidv4(), department_id: DEPARTMENTS[0].id, name: 'B.Tech Computer Science', code: 'BTCSE' },
    { id: uuidv4(), department_id: DEPARTMENTS[1].id, name: 'B.Tech Artificial Intelligence & Machine Learning', code: 'BTAIML' },
    { id: uuidv4(), department_id: DEPARTMENTS[2].id, name: 'B.Tech Data Science', code: 'BTDS' },
    { id: uuidv4(), department_id: DEPARTMENTS[3].id, name: 'B.Tech Electronics', code: 'BTECE' }
  ];

  for (const prog of PROGRAMS) {
    await query(
      `INSERT INTO programs (id, department_id, name, code, total_semesters) VALUES ($1, $2, $3, $4, 8)`,
      [prog.id, prog.department_id, prog.name, prog.code]
    );
  }
  logStep('programs', PROGRAMS.length);

  // ── Admin User ─────────────────────────────────────────────────────────────
  const adminUserId = uuidv4();
  await query(
    `INSERT INTO users (id, email, password_hash, role, full_name) VALUES ($1, $2, $3, $4, $5)`,
    [adminUserId, 'admin@college.erp', adminHash, 'admin', 'System Administrator']
  );
  logStep('admin user', 1);

  // ── Accountant User ────────────────────────────────────────────────────────
  const accountantHash = await hashPassword('Accountant@12345');
  const accountantUserId = uuidv4();
  await query(
    `INSERT INTO users (id, email, password_hash, role, full_name) VALUES ($1, $2, $3, $4, $5)`,
    [accountantUserId, 'accountant@college.erp', accountantHash, 'accountant', 'Chief Accountant']
  );
  logStep('accountant user', 1);

  // ── Faculty Staff ──────────────────────────────────────────────────────────
  console.log('\n[4/12] Seeding faculty members and accounts...');

  interface FacultySeed {
    fullName: string;
    deptCode: string;
    designation: 'professor' | 'associate_professor' | 'assistant_professor' | 'lecturer';
  }

  const FACULTY_LIST: FacultySeed[] = [
    // CSE (5)
    { fullName: 'Dr. Amit Sharma', deptCode: 'CSE', designation: 'professor' },
    { fullName: 'Dr. Ramesh Kumar', deptCode: 'CSE', designation: 'associate_professor' },
    { fullName: 'Dr. Priya Verma', deptCode: 'CSE', designation: 'assistant_professor' },
    { fullName: 'Dr. Kavita Nair', deptCode: 'CSE', designation: 'assistant_professor' },
    { fullName: 'Mr. Vikram Joshi', deptCode: 'CSE', designation: 'lecturer' },
    // AIML (5)
    { fullName: 'Dr. Rajesh Reddy', deptCode: 'AIML', designation: 'professor' },
    { fullName: 'Dr. Suresh Rao', deptCode: 'AIML', designation: 'associate_professor' },
    { fullName: 'Dr. Sneha Gupta', deptCode: 'AIML', designation: 'assistant_professor' },
    { fullName: 'Dr. Divya Nair', deptCode: 'AIML', designation: 'assistant_professor' },
    { fullName: 'Mrs. Neha Sen', deptCode: 'AIML', designation: 'lecturer' },
    // DS (4)
    { fullName: 'Dr. Manish Iyer', deptCode: 'DS', designation: 'professor' },
    { fullName: 'Dr. Gaurav Patel', deptCode: 'DS', designation: 'associate_professor' },
    { fullName: 'Dr. Pooja Choudhury', deptCode: 'DS', designation: 'assistant_professor' },
    { fullName: 'Mr. Rohan Roy', deptCode: 'DS', designation: 'lecturer' },
    // ECE (4)
    { fullName: 'Dr. Anil Patil', deptCode: 'ECE', designation: 'professor' },
    { fullName: 'Dr. Vivek Deshmukh', deptCode: 'ECE', designation: 'associate_professor' },
    { fullName: 'Dr. Shreya Kulkarni', deptCode: 'ECE', designation: 'assistant_professor' },
    { fullName: 'Mr. Varun Bhat', deptCode: 'ECE', designation: 'lecturer' }
  ];

  const facultyUserRows: any[][] = [];
  const facultyProfileRows: any[][] = [];
  const facultyMapByDept: Record<string, string[]> = { CSE: [], AIML: [], DS: [], ECE: [] };

  FACULTY_LIST.forEach((f, idx) => {
    const uId = uuidv4();
    const fId = uuidv4();
    const emailName = f.fullName.toLowerCase().replace(/^(dr|mr|mrs|prof)\.\s+/i, '').replace(/\s+/g, '.');
    const email = `${emailName}@college.erp`;
    const employeeNum = `FAC2026${(idx + 1).toString().padStart(3, '0')}`;
    const dept = DEPARTMENTS.find(d => d.code === f.deptCode)!;

    facultyUserRows.push([uId, email, facultyHash, 'faculty', f.fullName]);
    facultyProfileRows.push([fId, uId, employeeNum, f.fullName, dept.id, f.designation, 'active']);
    facultyMapByDept[f.deptCode].push(fId);
  });

  await bulkInsert('users', ['id', 'email', 'password_hash', 'role', 'full_name'], facultyUserRows);
  await bulkInsert('faculty', ['id', 'user_id', 'employee_number', 'full_name', 'department_id', 'designation', 'status'], facultyProfileRows);
  logStep('faculty staff members', FACULTY_LIST.length);

  // ── Academic Subjects ──────────────────────────────────────────────────────
  console.log('\n[5/12] Seeding comprehensive academic subject catalog...');

  interface SubjectSeed {
    id: string;
    code: string;
    name: string;
    deptCode: string;
    progCode: string;
    semester: number;
    credits: number;
    type: 'core' | 'elective' | 'lab';
  }

  const SUBJECTS_LIST: SubjectSeed[] = [];

  // Generate subjects dynamically across 8 semesters for each program
  const deptSubjects = {
    CSE: {
      1: [['CS101', 'Programming in C', 3, 'core'], ['CS102', 'Engineering Mathematics I', 4, 'core'], ['CS103', 'Programming Lab', 2, 'lab']],
      2: [['CS201', 'Data Structures', 4, 'core'], ['CS202', 'Engineering Mathematics II', 4, 'core'], ['CS203', 'Data Structures Lab', 2, 'lab']],
      3: [['CS301', 'Database Management Systems', 4, 'core'], ['CS302', 'Discrete Mathematics', 3, 'core'], ['CS303', 'DBMS Lab', 2, 'lab']],
      4: [['CS401', 'Operating Systems', 4, 'core'], ['CS402', 'Design & Analysis of Algorithms', 4, 'core'], ['CS403', 'OS Lab', 2, 'lab']],
      5: [['CS501', 'Computer Networks', 4, 'core'], ['CS502', 'Software Engineering', 3, 'core'], ['CS503', 'Computer Networks Lab', 2, 'lab']],
      6: [['CS601', 'Compiler Design', 4, 'core'], ['CS602', 'Web Technologies', 3, 'core'], ['CS603', 'Web Lab', 2, 'lab']],
      7: [['CS701', 'Cryptography & Network Security', 4, 'core'], ['CS702', 'Cloud Computing', 3, 'elective']],
      8: [['CS801', 'Cyber Security & Forensics', 3, 'elective'], ['CS802', 'Distributed Systems', 4, 'core']]
    },
    AIML: {
      1: [['AM101', 'Python Programming', 3, 'core'], ['AM102', 'Engineering Mathematics I', 4, 'core'], ['AM103', 'Python Lab', 2, 'lab']],
      2: [['AM201', 'Data Structures with Python', 4, 'core'], ['AM202', 'Probability & Statistics', 4, 'core'], ['AM203', 'DS Lab', 2, 'lab']],
      3: [['AM301', 'Artificial Intelligence', 4, 'core'], ['AM302', 'Linear Algebra & Optimization', 3, 'core'], ['AM303', 'AI Lab', 2, 'lab']],
      4: [['AM401', 'Machine Learning', 4, 'core'], ['AM402', 'R for Data Science', 3, 'core'], ['AM403', 'ML Lab', 2, 'lab']],
      5: [['AM501', 'Deep Learning', 4, 'core'], ['AM502', 'Data Warehousing & Mining', 3, 'core'], ['AM503', 'Deep Learning Lab', 2, 'lab']],
      6: [['AM601', 'Natural Language Processing', 4, 'core'], ['AM602', 'Reinforcement Learning', 3, 'elective'], ['AM603', 'NLP Lab', 2, 'lab']],
      7: [['AM701', 'Computer Vision', 4, 'core'], ['AM702', 'Generative AI', 3, 'elective']],
      8: [['AM801', 'Explainable AI', 3, 'elective'], ['AM802', 'AI Ethics & Policy', 3, 'elective']]
    },
    DS: {
      1: [['DS101', 'Introduction to Data Science', 3, 'core'], ['DS102', 'Engineering Mathematics I', 4, 'core'], ['DS103', 'DS Tools Lab', 2, 'lab']],
      2: [['DS201', 'Data Structures & Algorithms', 4, 'core'], ['DS202', 'Probability & Statistics', 4, 'core'], ['DS203', 'DSA Lab', 2, 'lab']],
      3: [['DS301', 'Advanced DBMS', 4, 'core'], ['DS302', 'Linear Algebra', 3, 'core'], ['DS303', 'Advanced DBMS Lab', 2, 'lab']],
      4: [['DS401', 'Data Visualization', 3, 'core'], ['DS402', 'Mathematical Modeling', 4, 'core'], ['DS403', 'Visualization Lab', 2, 'lab']],
      5: [['DS501', 'Big Data Analytics', 4, 'core'], ['DS502', 'Predictive Analytics', 3, 'core'], ['DS503', 'Big Data Lab', 2, 'lab']],
      6: [['DS601', 'Time Series Analysis', 3, 'core'], ['DS602', 'Data Engineering', 4, 'core'], ['DS603', 'Data Engineering Lab', 2, 'lab']],
      7: [['DS701', 'Social Media Analytics', 3, 'elective'], ['DS702', 'Data Security & Privacy', 4, 'core']],
      8: [['DS801', 'Large Language Models', 4, 'core'], ['DS802', 'Business Analytics', 3, 'elective']]
    },
    ECE: {
      1: [['EC101', 'Basic Electrical Engineering', 3, 'core'], ['EC102', 'Engineering Mathematics I', 4, 'core'], ['EC103', 'EE Lab', 2, 'lab']],
      2: [['EC201', 'Electronic Devices & Circuits', 4, 'core'], ['EC202', 'Network Analysis', 3, 'core'], ['EC203', 'EDC Lab', 2, 'lab']],
      3: [['EC301', 'Signals & Systems', 4, 'core'], ['EC302', 'Digital System Design', 4, 'core'], ['EC303', 'DSD Lab', 2, 'lab']],
      4: [['EC401', 'Analog Communications', 4, 'core'], ['EC402', 'Electromagnetic Fields', 3, 'core'], ['EC403', 'Analog Comm Lab', 2, 'lab']],
      5: [['EC501', 'Digital Signal Processing', 4, 'core'], ['EC502', 'Microprocessors & Microcontrollers', 4, 'core'], ['EC503', 'MPMC Lab', 2, 'lab']],
      6: [['EC601', 'VLSI Design', 4, 'core'], ['EC602', 'Digital Communications', 3, 'core'], ['EC603', 'VLSI Lab', 2, 'lab']],
      7: [['EC701', 'Microwave Engineering', 4, 'core'], ['EC702', 'Wireless Communications', 3, 'elective']],
      8: [['EC801', 'Embedded Systems', 4, 'core'], ['EC802', 'Satellite Communications', 3, 'elective']]
    }
  };

  const subjectRows: any[][] = [];

  for (const dept of DEPARTMENTS) {
    const prog = PROGRAMS.find(p => p.department_id === dept.id)!;
    const semMap = deptSubjects[dept.code as keyof typeof deptSubjects];

    for (let sem = 1; sem <= 8; sem++) {
      const list = semMap[sem as keyof typeof semMap] || [];
      for (const [code, name, credits, type] of list) {
        const id = uuidv4();
        SUBJECTS_LIST.push({
          id,
          code: code as string,
          name: name as string,
          deptCode: dept.code,
          progCode: prog.code,
          semester: sem,
          credits: credits as number,
          type: type as 'core' | 'elective' | 'lab'
        });
        subjectRows.push([id, code, name, dept.id, prog.id, sem, credits, type, 'active']);
      }
    }
  }

  await bulkInsert('subjects', ['id', 'code', 'name', 'department_id', 'program_id', 'semester', 'credits', 'type', 'status'], subjectRows);
  logStep('subjects', SUBJECTS_LIST.length);

  // ── Faculty Assignments ────────────────────────────────────────────────────
  console.log('\n[6/12] Assigning faculty members to active curriculum subjects...');

  // Target Year: 2026-2027. Active Semesters for Students: Odd Semesters (1, 3, 5, 7)
  const activeSemesters = [1, 3, 5, 7];
  const fsaRows: any[][] = [];
  
  // Store subject_id -> faculty_id mapping for attendance and internal marks
  const activeSubjectFacultyMap: Record<string, string> = {};

  for (const dept of DEPARTMENTS) {
    const deptFacs = facultyMapByDept[dept.code];
    const deptSubjs = SUBJECTS_LIST.filter(s => s.deptCode === dept.code && activeSemesters.includes(s.semester));

    deptSubjs.forEach((subj, sIdx) => {
      // Round robin assign faculty to department subjects
      const facultyId = deptFacs[sIdx % deptFacs.length];
      const fsaId = uuidv4();
      
      activeSubjectFacultyMap[subj.id] = facultyId;
      fsaRows.push([fsaId, facultyId, subj.id, '2026-2027', 'A', true]);
    });
  }

  await bulkInsert('faculty_subject_assignments', ['id', 'faculty_id', 'subject_id', 'academic_year', 'section', 'is_active'], fsaRows);
  logStep('faculty assignments', fsaRows.length);

  // ── Students Generation ────────────────────────────────────────────────────
  console.log('\n[7/12] Generating student user registry (~240 students)...');

  interface StudentSeed {
    id: string;
    userId: string;
    fullName: string;
    rollNumber: string;
    deptId: string;
    progId: string;
    semester: number;
    performanceClass: number; // 0-9
  }

  const STUDENT_LIST: StudentSeed[] = [];
  const studentUserRows: any[][] = [];
  const studentProfileRows: any[][] = [];

  const yearSemesterMap = { 1: 1, 2: 3, 3: 5, 4: 7 }; // Year -> Active Odd Sem
  const yearEntryCode = { 1: 26, 2: 25, 3: 24, 4: 23 }; // Year -> JNTUH join year

  let studentIdx = 0;

  for (const dept of DEPARTMENTS) {
    const prog = PROGRAMS.find(p => p.department_id === dept.id)!;
    
    for (let yr = 1; yr <= 4; yr++) {
      const currentSem = yearSemesterMap[yr as keyof typeof yearSemesterMap];
      const entryYr = yearEntryCode[yr as keyof typeof yearEntryCode];

      for (let seq = 1; seq <= 15; seq++) {
        studentIdx++;
        const sUserId = uuidv4();
        const sStudentId = uuidv4();
        const rollNum = getRollNumber(entryYr, dept.branchCode, seq);
        const name = generateIndianName(studentIdx);
        const email = `${rollNum.toLowerCase()}@college.erp`;

        studentUserRows.push([sUserId, email, studentHash, 'student', name]);
        studentProfileRows.push([sStudentId, sUserId, rollNum, name, dept.id, prog.id, currentSem, 'A', '2026-2027', 'active']);
        
        STUDENT_LIST.push({
          id: sStudentId,
          userId: sUserId,
          fullName: name,
          rollNumber: rollNum,
          deptId: dept.id,
          progId: prog.id,
          semester: currentSem,
          performanceClass: studentIdx % 10
        });
      }
    }
  }

  await bulkInsert('users', ['id', 'email', 'password_hash', 'role', 'full_name'], studentUserRows);
  await bulkInsert('students', ['id', 'user_id', 'roll_number', 'full_name', 'department_id', 'program_id', 'semester', 'section', 'academic_year', 'status'], studentProfileRows);
  logStep('students', STUDENT_LIST.length);

  // ── Results History (Semesters 1 to 6) ───────────────────────────────────────
  console.log('\n[8/12] Seeding completed historical semester result ledgers (~2,400 entries)...');
  const resultsRows: any[][] = [];

  for (const stud of STUDENT_LIST) {
    // Determine completed semesters
    const completedSems: number[] = [];
    for (let s = 1; s < stud.semester; s++) {
      completedSems.push(s);
    }

    for (const prevSem of completedSems) {
      // Find subjects for program in prevSem
      const semSubjs = SUBJECTS_LIST.filter(s => s.progCode === PROGRAMS.find(p => p.id === stud.progId)!.code && s.semester === prevSem);
      
      for (const subj of semSubjs) {
        const id = uuidv4();
        // Select a faculty member of that department to list as grader
        const deptFacs = facultyMapByDept[subj.deptCode];
        const randomFacultyId = deptFacs[Math.floor(Math.random() * deptFacs.length)];

        // Generate marks based on performance profiles
        let internal = 20;
        let external = 45;
        if (stud.performanceClass < 3) { // High (30%)
          internal = Math.floor(24 + Math.random() * 7);
          external = Math.floor(54 + Math.random() * 17);
        } else if (stud.performanceClass < 8) { // Avg (50%)
          internal = Math.floor(18 + Math.random() * 6);
          external = Math.floor(40 + Math.random() * 14);
        } else { // Low / Risk (20%)
          internal = Math.floor(12 + Math.random() * 7);
          external = Math.floor(25 + Math.random() * 16);
        }

        const total = internal + external;
        let grade: 'O' | 'A+' | 'A' | 'B+' | 'B' | 'C' | 'F' = 'C';
        let status: 'Pass' | 'Fail' = 'Pass';

        if (total >= 90) grade = 'O';
        else if (total >= 80) grade = 'A+';
        else if (total >= 70) grade = 'A';
        else if (total >= 60) grade = 'B+';
        else if (total >= 50) grade = 'B';
        else if (total >= 40) grade = 'C';
        else {
          grade = 'F';
          status = 'Fail';
        }

        // 3% flat fail rate override for realistic failures
        if (Math.random() < 0.03) {
          grade = 'F';
          status = 'Fail';
          external = Math.floor(10 + Math.random() * 14);
        }

        const actualTotal = internal + external;
        const histPublishedAt = prevSem % 2 === 0 
          ? `2026-05-20T10:00:00Z` 
          : `2025-12-18T10:00:00Z`;

        resultsRows.push([
          id, stud.id, subj.id, null, randomFacultyId, prevSem, 'A',
          internal, 30.00, external, 70.00, actualTotal, grade, status,
          'Published', histPublishedAt, 'Semester Complete'
        ]);
      }
    }
  }

  await bulkInsert('results', [
    'id', 'student_id', 'subject_id', 'exam_id', 'faculty_id', 'semester', 'section',
    'internal_marks', 'internal_max_marks', 'external_marks', 'external_max_marks',
    'total_marks', 'grade', 'result_status', 'publication_status', 'published_at', 'remarks'
  ], resultsRows);
  logStep('historical result records', resultsRows.length);

  // ── Current Semester Attendance Logs ──────────────────────────────────────────
  console.log('\n[9/12] Simulating student active daily attendance logs...');

  // Weekdays (Monday - Friday) from June 1, 2026 to June 22, 2026 (approx 16 working days)
  const ATTENDANCE_DATES = [
    '2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05',
    '2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11', '2026-06-12',
    '2026-06-15', '2026-06-16', '2026-06-17', '2026-06-18', '2026-06-19',
    '2026-06-22'
  ];

  const attendanceRows: any[][] = [];
  const marksRows: any[][] = [];

  for (const stud of STUDENT_LIST) {
    // Current semester subjects
    const activeSubjs = SUBJECTS_LIST.filter(s => s.progCode === PROGRAMS.find(p => p.id === stud.progId)!.code && s.semester === stud.semester);

    // Target attendance probability based on distribution bands
    const attSelector = stud.performanceClass;
    let targetProb = 0.85; // Default Good
    if (attSelector < 3) targetProb = 0.95; // Excellent
    else if (attSelector < 7) targetProb = 0.85; // Good
    else if (attSelector < 9) targetProb = 0.77; // Average
    else if (attSelector === 9) {
      targetProb = Math.random() < 0.5 ? 0.70 : 0.55; // Risk / Defaulter
    }

    for (const subj of activeSubjs) {
      const assignedFac = activeSubjectFacultyMap[subj.id];
      if (!assignedFac) continue;

      // Seed 12 random dates out of the 16 working days
      const sampledDates = ATTENDANCE_DATES.sort(() => 0.5 - Math.random()).slice(0, 12);
      
      sampledDates.forEach(date => {
        const attId = uuidv4();
        const status = Math.random() < targetProb ? 'present' : 'absent';
        attendanceRows.push([attId, stud.id, assignedFac, subj.id, 'A', date, status]);
      });

      // Seed Mid-1 and Assignment marks for current subjects
      let midScore = 18;
      let assgScore = 7;
      if (stud.performanceClass < 3) {
        midScore = Math.floor(24 + Math.random() * 7);
        assgScore = Math.floor(8 + Math.random() * 3);
      } else if (stud.performanceClass < 8) {
        midScore = Math.floor(18 + Math.random() * 6);
        assgScore = Math.floor(6 + Math.random() * 3);
      } else {
        midScore = Math.floor(9 + Math.random() * 9);
        assgScore = Math.floor(3 + Math.random() * 4);
      }

      marksRows.push([uuidv4(), stud.id, assignedFac, subj.id, 'A', 'Assignment', 10.00, assgScore, 'First Assignment Upload']);
      marksRows.push([uuidv4(), stud.id, assignedFac, subj.id, 'A', 'Mid-1', 30.00, midScore, 'Mid-Term 1 Marks']);
    }
  }

  await bulkInsert('attendance', ['id', 'student_id', 'faculty_id', 'subject_id', 'section', 'attendance_date', 'status'], attendanceRows);
  logStep('attendance records', attendanceRows.length);

  await bulkInsert('internal_marks', ['id', 'student_id', 'faculty_id', 'subject_id', 'section', 'assessment_type', 'maximum_marks', 'obtained_marks', 'remarks'], marksRows);
  logStep('internal marks items', marksRows.length);

  // ── Semester Examinations ──────────────────────────────────────────────────
  console.log('\n[10/12] Seeding active semester examination timetables...');
  const examRows: any[][] = [];

  for (const dept of DEPARTMENTS) {
    const activeSubjs = SUBJECTS_LIST.filter(s => s.deptCode === dept.code && activeSemesters.includes(s.semester));
    
    for (const subj of activeSubjs) {
      const assignedFac = activeSubjectFacultyMap[subj.id];
      if (!assignedFac) continue;

      // Completed Mid-1 Exam
      examRows.push([
        uuidv4(), subj.id, assignedFac, subj.semester, 'A', 'Mid-1',
        '2026-06-15', '10:00:00', '11:30:00', 30.00, 'Completed'
      ]);
      // Scheduled Mid-2 Exam
      examRows.push([
        uuidv4(), subj.id, assignedFac, subj.semester, 'A', 'Mid-2',
        '2026-07-20', '10:00:00', '11:30:00', 30.00, 'Scheduled'
      ]);
      // Scheduled End Semester Exam
      examRows.push([
        uuidv4(), subj.id, assignedFac, subj.semester, 'A', 'End Semester',
        '2026-08-25', '10:00:00', '13:00:00', 70.00, 'Scheduled'
      ]);
    }
  }

  await bulkInsert('exams', [
    'id', 'subject_id', 'faculty_id', 'semester', 'section', 'exam_type',
    'exam_date', 'start_time', 'end_time', 'maximum_marks', 'status'
  ], examRows);
  logStep('examination schedules', examRows.length);

  // ── Fees & Financial Payments Ledger ─────────────────────────────────────────
  console.log('\n[11/12] Generating tuition, exam, lab, and misc fee logs...');
  const feeRows: any[][] = [];
  const paymentRows: any[][] = [];

  for (const stud of STUDENT_LIST) {
    const feesToCreate = [
      { type: 'Tuition Fee', amount: 106000.00, dueDate: '2026-07-15' }
    ];

    const payStatusSelector = stud.performanceClass;
    let paymentStatus: 'Paid' | 'Partially Paid' | 'Pending' = 'Paid';
    if (payStatusSelector < 7) paymentStatus = 'Paid';       // 70% Paid
    else if (payStatusSelector < 9) paymentStatus = 'Partially Paid'; // 20% Partial
    else paymentStatus = 'Pending';                          // 10% Pending

    for (const item of feesToCreate) {
      const feeId = uuidv4();
      let paid = 0.00;
      
      if (paymentStatus === 'Paid') {
        paid = item.amount;
      } else if (paymentStatus === 'Partially Paid') {
        paid = 50000.00; // Partial payment amount is dynamic (₹50,000)
      }

      const pending = item.amount - paid;
      const status: 'Paid' | 'Partially Paid' | 'Pending' | 'Overdue' = 
        pending === 0 ? 'Paid' : (paid > 0 ? 'Partially Paid' : 'Pending');

      feeRows.push([
        feeId, stud.id, '2026-2027', stud.semester, item.type,
        item.amount, paid, pending, item.dueDate, status, 'Standard Term Billing'
      ]);

      // Seed immutable payment receipt if payment occurred
      if (paid > 0) {
        const payId = uuidv4();
        const payModes: ('Online' | 'Cash' | 'DD' | 'Cheque')[] = ['Online', 'Cash', 'DD', 'Cheque'];
        const mode = payModes[stud.performanceClass % payModes.length];
        const txnRef = mode === 'Online' ? `TXN2026${uuidv4().substring(0, 8).toUpperCase()}` : null;

        paymentRows.push([
          payId, feeId, paid, '2026-06-10', mode, txnRef, adminUserId, 'Billing Receipt Entry'
        ]);
      }
    }
  }

  await bulkInsert('fees', [
    'id', 'student_id', 'academic_year', 'semester', 'fee_type',
    'total_amount', 'paid_amount', 'pending_amount', 'due_date', 'payment_status', 'remarks'
  ], feeRows);
  logStep('student invoices (fees)', feeRows.length);

  await bulkInsert('fee_payments', [
    'id', 'fee_id', 'amount', 'payment_date', 'payment_mode', 'transaction_ref', 'recorded_by', 'remarks'
  ], paymentRows);
  logStep('receipt transactions (fee payments)', paymentRows.length);

  // ── Bulletins & Announcements ───────────────────────────────────────────────
  console.log('\n[12/12] Seeding institutional announcements and academic calendar...');
  
  const ANNOUNCEMENTS = [
    { title: 'Mid-1 Examination Schedule Released', content: 'The Mid-term 1 theory examinations schedule for all programs has been published. Exams commence on June 15, 2026. Hall tickets can be collected from admin block.', target: 'Students', priority: 'High', sem: null, dept: null },
    { title: 'AI/ML Technical Workshop Registration Open', content: 'Department of AIML is hosting a two-day workshop on Generative AI and LLM prompt design from August 18-19. Limited seats, register on portal.', target: 'Students', priority: 'Medium', sem: null, dept: null },
    { title: 'Semester Tuition Fee Deadline Reminder', content: 'All students are requested to clear their academic and hostel tuition fee dues for the 2026-27 odd semester on or before July 15, 2026 to avoid late fee charges.', target: 'Students', priority: 'Urgent', sem: null, dept: null },
    { title: 'Major Project Phase-1 Review Schedule', content: 'B.Tech Semester 7 (IV Year) major project review-1 is scheduled for August 10, 2026. Submit abstracts to project coordinators.', target: 'Semester Specific', priority: 'High', sem: 7, dept: null },
    { title: 'Campus Recruitment Placement Drive 2026', content: 'Infosys and TCS placement training sessions start this weekend. Attendance is mandatory for IV Year registered students.', target: 'Semester Specific', priority: 'Urgent', sem: 7, dept: null },
    { title: 'Research Grant Proposals Submission', content: 'Faculty members are invited to submit research proposals for DST grants. Direct queries to the Research & Development Dean by next Friday.', target: 'Faculty', priority: 'High', sem: null, dept: null },
    { title: 'Annual Technical Fest SREEVISION 2026', content: 'Preparations for the national-level annual technical symposium Sreevision are underway. Student coordinators registration opens on Monday.', target: 'All', priority: 'Medium', sem: null, dept: null },
    { title: 'Independence Day Holiday Notice', content: 'The college will remain closed on August 15, 2026 on account of Independence Day celebrations. Flag hoisting ceremony is at 8:30 AM.', target: 'All', priority: 'Low', sem: null, dept: null },
    { title: 'National Coding Hackathon 2026', content: 'Hackathon 2026 registration is live. Team size: 2-4 members. Prizes worth 1 Lakh INR. Deadline to submit idea: August 5.', target: 'Students', priority: 'Medium', sem: null, dept: null },
    { title: 'Guest Lecture: Security in IoT and Edge Computing', content: 'CSE department guest lecture by Dr. Sridhar from IIT Hyderabad on Edge node security. Venue: Seminar Hall-3, June 25, 2:00 PM.', target: 'Department Specific', priority: 'Low', sem: null, dept: DEPARTMENTS.find(d => d.code === 'CSE')!.id },
    { title: 'Lab Internal Timetables Published', content: 'Laboratory internal practical evaluations will take place between August 3 and August 7, 2026 during normal lab hours.', target: 'Students', priority: 'High', sem: null, dept: null },
    { title: 'Academic Board Council Meeting Agenda', content: 'Academic advisory meet is scheduled for June 28 at Boardroom-1. Department Heads are requested to bring course file status reports.', target: 'Faculty', priority: 'Low', sem: null, dept: null },
    { title: 'Hostel Registration and Allocations 2026-27', content: 'Odd semester hostel room booking status is now open. Confirm payments through the portal by the weekend.', target: 'Students', priority: 'Medium', sem: null, dept: null },
    { title: 'NPTEL Certification Course Registration', content: 'Students can register for credit-equivalent NPTEL courses. Select subjects mapping to curriculum electives. Submit details by July 10.', target: 'Students', priority: 'Medium', sem: null, dept: null },
    { title: 'Outstanding Library Book Returns Notice', content: 'All students are instructed to return borrowed library textbooks of the previous semester by June 30 to prevent fine limits.', target: 'Students', priority: 'Low', sem: null, dept: null }
  ];

  const announcementRows: any[][] = [];
  for (const ann of ANNOUNCEMENTS) {
    announcementRows.push([
      uuidv4(), ann.title, ann.content, ann.target, ann.dept, ann.sem,
      ann.priority, '2026-06-01', '2026-09-01', 'Published', adminUserId
    ]);
  }

  await bulkInsert('announcements', [
    'id', 'title', 'content', 'target_audience', 'department_id', 'semester',
    'priority', 'publish_date', 'expiry_date', 'status', 'created_by'
  ], announcementRows);
  logStep('bulletin announcements', announcementRows.length);

  // ── Document & Academic Calendar ───────────────────────────────────────────
  const docId = uuidv4();
  await query(`
    INSERT INTO documents 
      (id, title, file_name, file_path, document_type, upload_date, uploaded_by, status)
    VALUES 
      ($1, 'Academic Calendar 2026-27 Odd Semester', 'academic_calendar_2026_27_odd.pdf', 
       '/uploads/academic_calendar_2026_27_odd.pdf', 'Academic Calendar', '2026-06-01', $2, 'Processed')
  `, [docId, adminUserId]);
  logStep('calendar documents', 1);

  const CALENDAR_EVENTS = [
    { title: 'Odd Semester Class Commencement', start: '2026-06-01', end: null, type: 'Class Commencement', audience: 'All', sem: null, dept: null },
    { title: 'Submission of Course Files and Lesson Plans', start: '2026-06-05', end: null, type: 'Academic Activity', audience: 'Faculty', sem: null, dept: null },
    { title: 'Weekly Coding Contest - Round 1', start: '2026-06-12', end: null, type: 'Academic Activity', audience: 'All', sem: null, dept: null },
    { title: 'First Mid-Term Theory Examinations', start: '2026-06-15', end: '2026-06-18', type: 'Mid-Term Examination', audience: 'All', sem: null, dept: null },
    { title: 'Expert Guest Lecture on Generative AI', start: '2026-06-25', end: null, type: 'Academic Activity', audience: 'III Year', sem: null, dept: null },
    { title: 'First Parent-Teacher Meeting (PTM)', start: '2026-07-05', end: null, type: 'Academic Activity', audience: 'All', sem: null, dept: null },
    { title: 'Odd Semester Sports and Cultural Week', start: '2026-07-10', end: '2026-07-14', type: 'Academic Activity', audience: 'All', sem: null, dept: null },
    { title: 'Second Mid-Term Theory Examinations', start: '2026-07-20', end: '2026-07-23', type: 'Mid-Term Examination', audience: 'All', sem: null, dept: null },
    { title: 'Major Project Phase-1 Review-2', start: '2026-07-28', end: null, type: 'Internal Assessment', audience: 'IV Year', sem: null, dept: null },
    { title: 'Practical Laboratory Internal Evaluations', start: '2026-08-03', end: '2026-08-07', type: 'Lab Examination', audience: 'All', sem: null, dept: null },
    { title: 'Major Project Phase-1 Review-1', start: '2026-08-10', end: null, type: 'Internal Assessment', audience: 'IV Year', sem: null, dept: null },
    { title: 'National Independence Day Holiday', start: '2026-08-15', end: null, type: 'Holiday', audience: 'All', sem: null, dept: null },
    { title: 'National Level Technical Fest - Sreevision', start: '2026-08-18', end: null, type: 'Academic Activity', audience: 'All', sem: null, dept: null },
    { title: 'National Coding Hackathon 2026', start: '2026-08-20', end: '2026-08-21', type: 'Academic Activity', audience: 'All', sem: null, dept: null },
    { title: 'Preparation Holidays for Theory Exams', start: '2026-08-22', end: '2026-08-24', type: 'Holiday', audience: 'All', sem: null, dept: null },
    { title: 'End Semester Theory Examinations', start: '2026-08-25', end: '2026-09-05', type: 'End Semester Examination', audience: 'All', sem: null, dept: null },
    { title: 'End Semester Practical External Exams', start: '2026-09-07', end: '2026-09-11', type: 'Lab Examination', audience: 'All', sem: null, dept: null },
    { title: 'Ganesh Chaturthi Public Holiday', start: '2026-09-15', end: null, type: 'Holiday', audience: 'All', sem: null, dept: null },
    { title: 'Supplementary Semester Examinations', start: '2026-09-14', end: '2026-09-18', type: 'Supplementary Examination', audience: 'All', sem: null, dept: null },
    { title: 'Commencement of Next Odd/Even Semester', start: '2026-09-21', end: null, type: 'Class Commencement', audience: 'All', sem: null, dept: null },
    { title: 'Teachers Day Celebrations', start: '2026-09-05', end: null, type: 'Academic Activity', audience: 'All', sem: null, dept: null }
  ];

  const parsedEventsRows: any[][] = [];
  const calEventsRows: any[][] = [];

  CALENDAR_EVENTS.forEach(ev => {
    const pEvId = uuidv4();
    const cEvId = uuidv4();

    parsedEventsRows.push([
      pEvId, docId, ev.title, ev.title, ev.start, ev.end,
      ev.type, ev.audience, null, ev.sem, 'Approved'
    ]);

    calEventsRows.push([
      cEvId, pEvId, docId, ev.title, ev.title, ev.start, ev.end,
      ev.type, ev.audience, null, ev.sem, 'Published', false, adminUserId
    ]);
  });

  await bulkInsert('parsed_events', [
    'id', 'document_id', 'title', 'description', 'start_date', 'end_date',
    'event_type', 'target_audience', 'department_id', 'semester', 'status'
  ], parsedEventsRows);
  logStep('parsed candidates (parsed_events)', parsedEventsRows.length);

  await bulkInsert('academic_calendar_events', [
    'id', 'parsed_event_id', 'source_document_id', 'title', 'description', 'start_date', 'end_date',
    'event_type', 'target_audience', 'department_id', 'semester', 'publish_status', 'is_edited', 'created_by'
  ], calEventsRows);
  logStep('live academic calendar events', calEventsRows.length);

  console.log('\n────────────────────────────────────────────────────────');
  console.log('College ERP Comprehensive Seeding Complete!');
  console.log(`  Total Users Created:       ${(2 + FACULTY_LIST.length + STUDENT_LIST.length).toString().padEnd(6)}`);
  console.log(`  Total Subjects Catalogued: ${SUBJECTS_LIST.length.toString().padEnd(6)}`);
  console.log(`  Total Attendance Records:  ${attendanceRows.length.toString().padEnd(6)}`);
  console.log(`  Total Grade Result Logs:   ${resultsRows.length.toString().padEnd(6)}`);
  console.log(`  Logins:`);
  console.log(`    Admin:   admin@college.erp  /  Admin@12345`);
  console.log(`    Accountant: accountant@college.erp / Accountant@12345`);
  console.log(`    Faculty: amit.sharma@college.erp  /  Faculty@12345`);
  console.log(`    Student: 23ve1a0501@college.erp  /  Student@12345 (4th Year CSE)`);
  console.log('────────────────────────────────────────────────────────\n');
}

seed()
  .then(() => pool.end())
  .catch((err) => {
    console.error('Seed execution aborted due to error:', err);
    process.exit(1);
  });
