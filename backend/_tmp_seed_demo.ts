/**
 * Demo ecosystem seed — creates a small, clearly-identifiable, fully
 * interconnected slice of data by calling the SAME service functions the
 * real API uses (never raw inserts for business data). Idempotency is not
 * attempted — this is a one-shot demo seed; re-running will fail on unique
 * constraints (email/roll number), which is the desired safety behavior.
 */
import fs from 'fs';
import path from 'path';
import { query } from './src/config/database';
import { createFaculty } from './src/services/faculty.service';
import { createStudent } from './src/services/student.service';
import { createAllocation } from './src/services/teachingAssignment.service';
import { markAttendance } from './src/services/attendance.service';
import { createTeachingPlan, updateLessonStatus } from './src/services/teachingPlan.service';
import { createMaterial } from './src/services/material.service';
import { createAssignment as createLmsAssignment } from './src/services/lmsAssignment.service';
import { submitAssignment, gradeSubmission } from './src/services/lmsSubmission.service';
import { bulkEnterMarks } from './src/services/internal-marks.service';
import { createExam, updateExamStatus } from './src/services/examination.service';
import { bulkSubmitResults, publishResults } from './src/services/result.service';
import {
  createTemplate as createFeedbackTemplate,
  createQuestion as createFeedbackQuestion,
  createCampaign,
  publishCampaign,
  submitFeedback,
} from './src/services/feedback.service';
import { assignMentor, addNote } from './src/services/mentorship.service';
import { createNotification } from './src/services/notification.service';
import { createCalendarEntry } from './src/services/calendarEntry.service';

const PASSWORD = 'Demo@12345';
const ACADEMIC_YEAR = '2026-2027';

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}
// Deterministic pseudo-random so re-reading logs is reproducible.
let seed = 42;
function rand(): number {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}

async function main() {
  console.log('=== 1. Reference data ===');
  const { rows: depts } = await query<{ id: string; code: string }>(
    `SELECT id, code FROM departments WHERE code IN ('CSE','AIML')`
  );
  const CSE = depts.find((d) => d.code === 'CSE')!.id;
  const AIML = depts.find((d) => d.code === 'AIML')!.id;
  const { rows: progs } = await query<{ id: string; department_id: string }>(
    `SELECT id, department_id FROM programs WHERE department_id IN ($1,$2)`,
    [CSE, AIML]
  );
  const PROG_CSE = progs.find((p) => p.department_id === CSE)!.id;
  const PROG_AIML = progs.find((p) => p.department_id === AIML)!.id;

  const { rows: admins } = await query<{ id: string }>(`SELECT id FROM users WHERE role='admin' LIMIT 1`);
  const ADMIN_USER_ID = admins[0].id;

  // Real curriculum subjects — never invented. (Note: CS301/CS302/AM501/AM502
  // exist as legacy soft-deleted subject rows whose curriculum mappings were
  // never cleaned up — excluded via deleted_at IS NULL; the *PC-suffixed
  // codes are the live catalog.)
  const { rows: cseSubj } = await query<{ id: string; code: string; name: string }>(
    `SELECT s.id, s.code, s.name FROM subjects s
     JOIN subject_curriculum_mappings scm ON scm.subject_id = s.id
     WHERE scm.department_id = $1 AND scm.semester = 3 AND scm.regulation = 'R22'
       AND s.code IN ('CS305PC','CS304PC') AND s.deleted_at IS NULL AND scm.deleted_at IS NULL`,
    [CSE]
  );
  const { rows: aimlSubj } = await query<{ id: string; code: string; name: string }>(
    `SELECT s.id, s.code, s.name FROM subjects s
     JOIN subject_curriculum_mappings scm ON scm.subject_id = s.id
     WHERE scm.department_id = $1 AND scm.semester = 5 AND scm.regulation = 'R22'
       AND s.code IN ('AM501PC','AM502PC','AM503PC') AND s.deleted_at IS NULL AND scm.deleted_at IS NULL`,
    [AIML]
  );
  const CS301 = cseSubj.find((s) => s.code === 'CS305PC')!; // Operating Systems
  const CS302 = cseSubj.find((s) => s.code === 'CS304PC')!; // Software Engineering
  const AM501 = aimlSubj.find((s) => s.code === 'AM501PC')!; // Design and Analysis of Algorithms
  const AM502 = aimlSubj.find((s) => s.code === 'AM502PC')!; // Machine Learning
  const AM503 = aimlSubj.find((s) => s.code === 'AM503PC')!; // Computer Networks
  console.log('Subjects:', CS301.code, CS302.code, AM501.code, AM502.code, AM503.code);

  console.log('=== 2. Faculty ===');
  const f1 = await createFaculty(
    { email: 'ananya.krishnan.demo@sreyas.ac.in', password: PASSWORD, employeeNumber: 'DEMOFAC101', fullName: 'Dr. Ananya Krishnan', departmentId: CSE, designation: 'professor' },
    ADMIN_USER_ID
  );
  const f2 = await createFaculty(
    { email: 'arjun.mehta.demo@sreyas.ac.in', password: PASSWORD, employeeNumber: 'DEMOFAC102', fullName: 'Mr. Arjun Mehta', departmentId: AIML, designation: 'associate_professor' },
    ADMIN_USER_ID
  );
  const f3 = await createFaculty(
    { email: 'kavya.iyer.demo@sreyas.ac.in', password: PASSWORD, employeeNumber: 'DEMOFAC103', fullName: 'Ms. Kavya Iyer', departmentId: AIML, designation: 'assistant_professor' },
    ADMIN_USER_ID
  );
  console.log('Faculty created:', f1.id, f2.id, f3.id);

  console.log('=== 3. Students ===');
  const cseNames = ['Rohit Sharma', 'Sneha Reddy', 'Aditya Kumar', 'Priya Nair', 'Karthik Rao', 'Ananya Iyer', 'Vikram Singh', 'Divya Menon'];
  const aimlYNames = ['Rahul Verma', 'Meera Pillai', 'Siddharth Joshi', 'Kavitha Krishnan', 'Arjun Nair', 'Pooja Desai', 'Manoj Kumar', 'Swathi Reddy'];
  const aimlXNames = ['Nikhil Rao', 'Anjali Menon', 'Suresh Babu', 'Divya Shetty', 'Rajesh Patil', 'Lakshmi Iyer', 'Varun Kapoor', 'Nithya Raman'];

  async function makeStudents(names: string[], deptId: string, progId: string, semester: number, section: string, rollPrefix: string) {
    const created = [];
    for (let i = 0; i < names.length; i++) {
      const roll = `${rollPrefix}${String(i + 1).padStart(2, '0')}`;
      const email = `${names[i].toLowerCase().replace(/\s+/g, '.')}.demo@sreyas.ac.in`;
      const s = await createStudent(
        { email, password: PASSWORD, rollNumber: roll, fullName: names[i], departmentId: deptId, programId: progId, semester, section, academicYear: ACADEMIC_YEAR },
        ADMIN_USER_ID
      );
      created.push(s);
    }
    return created;
  }

  const cseStudents = await makeStudents(cseNames, CSE, PROG_CSE, 3, 'Z', '26DM1A05');
  const aimlYStudents = await makeStudents(aimlYNames, AIML, PROG_AIML, 5, 'Y', '26DM1A66');
  const aimlXStudents = await makeStudents(aimlXNames, AIML, PROG_AIML, 5, 'X', '26DM1A67');
  console.log(`Students created: CSE-Z=${cseStudents.length} AIML-Y=${aimlYStudents.length} AIML-X=${aimlXStudents.length}`);

  // userId map for student-scoped service calls (faculty/attendance/etc need users.id)
  const allStudents = [
    ...cseStudents.map((s) => ({ ...s, section: 'Z', subjects: [CS301, CS302], facultyUserId: f1.userId })),
    ...aimlYStudents.map((s) => ({ ...s, section: 'Y', subjects: [AM501, AM502], facultyUserId: f2.userId })),
    ...aimlXStudents.map((s) => ({ ...s, section: 'X', subjects: [AM502, AM503], facultyUserId: f3.userId })),
  ];

  console.log('=== 4. Teaching Assignments ===');
  const ta_f1_cs301 = await createAllocation({ facultyId: f1.id, subjectId: CS301.id, academicYear: ACADEMIC_YEAR, section: 'Z', status: 'active', weeklyTeachingHours: 4 }, ADMIN_USER_ID);
  const ta_f1_cs302 = await createAllocation({ facultyId: f1.id, subjectId: CS302.id, academicYear: ACADEMIC_YEAR, section: 'Z', status: 'active', weeklyTeachingHours: 4 }, ADMIN_USER_ID);
  const ta_f2_am501 = await createAllocation({ facultyId: f2.id, subjectId: AM501.id, academicYear: ACADEMIC_YEAR, section: 'Y', status: 'active', weeklyTeachingHours: 4 }, ADMIN_USER_ID);
  const ta_f2_am502 = await createAllocation({ facultyId: f2.id, subjectId: AM502.id, academicYear: ACADEMIC_YEAR, section: 'Y', status: 'active', weeklyTeachingHours: 4 }, ADMIN_USER_ID);
  const ta_f3_am502 = await createAllocation({ facultyId: f3.id, subjectId: AM502.id, academicYear: ACADEMIC_YEAR, section: 'X', status: 'active', weeklyTeachingHours: 4 }, ADMIN_USER_ID);
  const ta_f3_am503 = await createAllocation({ facultyId: f3.id, subjectId: AM503.id, academicYear: ACADEMIC_YEAR, section: 'X', status: 'active', weeklyTeachingHours: 4 }, ADMIN_USER_ID);
  console.log('Teaching assignments created: 6');

  console.log('=== 5. Attendance (varied 75-98% over last 12 weekdays) ===');
  const today = new Date();
  const weekdays: Date[] = [];
  let cursor = addDays(today, -1);
  while (weekdays.length < 12) {
    if (cursor.getDay() !== 0 && cursor.getDay() !== 6) weekdays.push(new Date(cursor));
    cursor = addDays(cursor, -1);
  }
  weekdays.reverse();

  // Each student gets a target attendance rate; a couple deliberately land below 75% for mentorship-warning realism.
  const targetRateByStudent = new Map<string, number>();
  allStudents.forEach((s, idx) => {
    const belowThreshold = idx % 8 === 7; // last student of every group of 8 = low attendance
    targetRateByStudent.set(s.id, belowThreshold ? 60 + rand() * 10 : 75 + rand() * 23);
  });

  async function markSectionAttendance(subjectId: string, section: string, students: typeof allStudents, facultyUserId: string) {
    for (const date of weekdays) {
      const records = students
        .filter((s) => s.section === section)
        .map((s) => ({
          studentId: s.id,
          status: (rand() * 100 < (targetRateByStudent.get(s.id) ?? 85) ? 'present' : 'absent') as 'present' | 'absent',
        }));
      await markAttendance({ subjectId, section, date: isoDate(date), records }, facultyUserId);
    }
  }
  await markSectionAttendance(CS301.id, 'Z', allStudents, f1.userId);
  await markSectionAttendance(CS302.id, 'Z', allStudents, f1.userId);
  await markSectionAttendance(AM501.id, 'Y', allStudents, f2.userId);
  await markSectionAttendance(AM502.id, 'Y', allStudents, f2.userId);
  await markSectionAttendance(AM502.id, 'X', allStudents, f3.userId);
  await markSectionAttendance(AM503.id, 'X', allStudents, f3.userId);
  console.log('Attendance marked for 12 sessions x 6 subject-sections');

  console.log('=== 6. Teaching Planner ===');
  const thisWeek = today;
  const nextWeek = addDays(today, 7);
  const weekNum = (d: Date) => Math.ceil((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / (7 * 24 * 3600 * 1000));

  async function seedPlan(subject: { id: string; name: string }, section: string, facultyUserId: string, topics: { title: string; date: Date; status?: 'Completed' | 'In Progress' | 'Partially Completed' }[]) {
    for (const t of topics) {
      const plan = await createTeachingPlan(facultyUserId, {
        subjectId: subject.id,
        section,
        weekNumber: weekNum(t.date),
        lessonDate: t.date,
        topicTitle: t.title,
        topicDescription: `Core topic for ${subject.name}`,
        estimatedDuration: 50,
        quizPlanned: false,
        autoShiftEnabled: true,
      });
      if (t.status === 'Completed') {
        await updateLessonStatus(facultyUserId, plan.id, { status: 'Completed' });
      } else if (t.status === 'In Progress') {
        await updateLessonStatus(facultyUserId, plan.id, { status: 'In Progress' });
      }
      // Topics with no status left as default 'Planned' — the deliberately pending ones.
    }
  }
  await seedPlan(CS301, 'Z', f1.userId, [
    { title: 'Process Scheduling Algorithms', date: addDays(thisWeek, -2), status: 'Completed' },
    { title: 'Deadlocks: Detection and Avoidance', date: thisWeek, status: 'In Progress' },
    { title: 'Memory Management and Paging', date: nextWeek },
  ]);
  await seedPlan(AM501, 'Y', f2.userId, [
    { title: 'Divide and Conquer Algorithms', date: addDays(thisWeek, -3), status: 'Completed' },
    { title: 'Dynamic Programming', date: thisWeek, status: 'In Progress' },
    { title: 'Greedy Algorithms', date: nextWeek },
  ]);
  await seedPlan(AM502, 'X', f3.userId, [
    { title: 'Supervised Learning: Regression', date: addDays(thisWeek, -3), status: 'Completed' },
    { title: 'Supervised Learning: Classification', date: thisWeek },
    { title: 'Model Evaluation and Cross-Validation', date: nextWeek },
  ]);
  console.log('Teaching plans created (with intentionally pending topics)');

  console.log('=== 7. LMS: materials, assignments, submissions ===');
  const lmsDir = path.join(__dirname, 'uploads', 'lms');
  fs.mkdirSync(lmsDir, { recursive: true });
  function makeDummyFile(name: string): Express.Multer.File {
    const filePath = path.join(lmsDir, name);
    fs.writeFileSync(filePath, `Demo content for ${name}\n`);
    const stat = fs.statSync(filePath);
    return { originalname: name, path: filePath, size: stat.size } as Express.Multer.File;
  }

  const mat1 = await createMaterial(f1.userId, { title: 'Operating Systems Unit 2 — Process Scheduling Notes', description: 'Lecture notes covering FCFS, SJF, Round Robin scheduling', subjectId: CS301.id }, makeDummyFile('os-unit2-scheduling.pdf'));
  const mat2 = await createMaterial(f2.userId, { title: 'DAA — Dynamic Programming Slides', description: 'Slides on dynamic programming and greedy techniques', subjectId: AM501.id }, makeDummyFile('daa-dynamic-programming.pdf'));
  console.log('Materials created:', mat1.id, mat2.id);

  const pastDue = addDays(today, -2).toISOString();
  const futureDue = addDays(today, 5).toISOString();
  const asg1 = await createLmsAssignment(f1.userId, { title: 'OS Assignment 1 — CPU Scheduling Simulation', description: 'Simulate FCFS, SJF and Round Robin scheduling for a given process set', subjectId: CS301.id, dueDate: pastDue, maxMarks: 20 });
  const asg2 = await createLmsAssignment(f2.userId, { title: 'DAA Assignment 1 — Knapsack via DP', description: 'Implement the 0/1 knapsack problem using dynamic programming', subjectId: AM501.id, dueDate: futureDue, maxMarks: 20 });
  const asg3 = await createLmsAssignment(f3.userId, { title: 'ML Assignment 1 — Linear Regression', description: 'Implement linear regression from scratch and evaluate on a sample dataset', subjectId: AM502.id, dueDate: futureDue, maxMarks: 20 });
  console.log('Assignments created:', asg1.id, asg2.id, asg3.id);

  // Mixed submission scenarios: most submit on-time/late, some stay pending.
  async function seedSubmissions(assignmentId: string, students: typeof allStudents, section: string, facultyUserId: string, gradeSome: boolean) {
    const secStudents = students.filter((s) => s.section === section);
    for (let i = 0; i < secStudents.length; i++) {
      if (i === secStudents.length - 1) continue; // leave last student's submission Pending
      const s = secStudents[i];
      const file = makeDummyFile(`submission-${assignmentId}-${s.rollNumber}.pdf`);
      const sub = await submitAssignment(s.userId, assignmentId, file);
      if (gradeSome && i % 2 === 0) {
        await gradeSubmission(facultyUserId, sub.id, { marks: 14 + Math.round(rand() * 6), feedback: 'Good effort, review the edge cases.' });
      }
    }
  }
  await seedSubmissions(asg1.id, allStudents, 'Z', f1.userId, true); // past-due -> Late Submission for these
  await seedSubmissions(asg2.id, allStudents, 'Y', f2.userId, true);
  await seedSubmissions(asg3.id, allStudents, 'X', f3.userId, false);
  console.log('Submissions seeded (submitted / late / pending mix)');

  console.log('=== 8. Internal Marks ===');
  async function seedMarks(subjectId: string, section: string, students: typeof allStudents) {
    const secStudents = students.filter((s) => s.section === section);
    const marksPool = [18, 16, 20, 12, 15, 19, 14, 17];
    await bulkEnterMarks(
      {
        subjectId,
        section,
        assessmentType: 'Mid-1',
        maximumMarks: 20,
        records: secStudents.map((s, i) => ({ studentId: s.id, obtainedMarks: marksPool[i % marksPool.length], remarks: undefined })),
      },
      students.find((s) => s.section === section)!.facultyUserId
    );
  }
  await seedMarks(CS301.id, 'Z', allStudents);
  await seedMarks(AM501.id, 'Y', allStudents);
  await seedMarks(AM502.id, 'X', allStudents);
  console.log('Internal marks entered');

  console.log('=== 9. Examinations ===');
  const midExam = await createExam(
    { subjectId: CS301.id, section: 'Z', examType: 'Mid-1', examDate: isoDate(addDays(today, -5)), startTime: '10:00', endTime: '12:00', maximumMarks: 20 },
    f1.userId,
    'faculty'
  );
  await updateExamStatus(midExam.id, 'Ongoing', f1.userId, 'faculty');
  await updateExamStatus(midExam.id, 'Completed', f1.userId, 'faculty');
  console.log('Mid exam lifecycle: Scheduled -> Ongoing -> Completed:', midExam.id);

  const semExam = await createExam(
    { subjectId: AM501.id, section: 'Y', examType: 'End Semester', examDate: isoDate(addDays(today, 10)), startTime: '09:30', endTime: '12:30', maximumMarks: 100 },
    f2.userId,
    'faculty'
  );
  await updateExamStatus(semExam.id, 'Ongoing', f2.userId, 'faculty');
  console.log('Semester exam lifecycle: Scheduled -> Ongoing (in progress):', semExam.id);

  console.log('=== 10. Results (for the Completed mid exam only) ===');
  const cseZ = allStudents.filter((s) => s.section === 'Z');
  const internalExternalPool = [
    { internal: 18, external: 62 }, { internal: 16, external: 55 }, { internal: 20, external: 78 },
    { internal: 12, external: 48 }, { internal: 15, external: 58 }, { internal: 19, external: 70 },
    { internal: 14, external: 50 }, { internal: 17, external: 65 },
  ];
  await bulkSubmitResults(
    {
      subjectId: CS301.id,
      section: 'Z',
      examId: midExam.id,
      internalMaxMarks: 20,
      externalMaxMarks: 80,
      records: cseZ.map((s, i) => ({ studentId: s.id, internalMarks: internalExternalPool[i % internalExternalPool.length].internal, externalMarks: internalExternalPool[i % internalExternalPool.length].external, isAbsent: false })),
    },
    f1.userId
  );
  await publishResults({ subjectId: CS301.id, section: 'Z' }, f1.userId);
  console.log('Results entered and published for CS301 / Section Z');

  console.log('=== 11. Feedback ===');
  const template = await createFeedbackTemplate({ title: 'Faculty Teaching Feedback — Demo', type: 'faculty' }, ADMIN_USER_ID);
  const q1 = await createFeedbackQuestion({ templateId: template.id, text: 'How would you rate the clarity of lectures?', type: 'rating', orderIndex: 0, isRequired: true }, ADMIN_USER_ID);
  const q2 = await createFeedbackQuestion({ templateId: template.id, text: 'Any additional comments?', type: 'text', orderIndex: 1, isRequired: false }, ADMIN_USER_ID);
  const campaign = await createCampaign(
    {
      title: 'Mid-Semester Faculty Feedback 2026-2027',
      academicYear: ACADEMIC_YEAR,
      startDate: isoDate(addDays(today, -7)),
      endDate: isoDate(addDays(today, 7)),
      templateId: template.id,
      targetDepartmentIds: [CSE, AIML],
      targetSemesters: [3, 5],
      targetSections: [],
      targetSubjectIds: [CS301.id, CS302.id, AM501.id, AM502.id],
      targetFacultyIds: [f1.id, f2.id, f3.id],
    },
    ADMIN_USER_ID
  );
  await publishCampaign(campaign.id, ADMIN_USER_ID);
  console.log('Feedback campaign published:', campaign.id);

  // Most students submit; a few left pending deliberately.
  for (const s of allStudents) {
    const isLastOfGroup = ['08'].some((suffix) => s.rollNumber.endsWith(suffix));
    if (isLastOfGroup) continue; // leave pending
    const facultyId = s.section === 'Z' ? f1.id : s.section === 'Y' ? f2.id : f3.id;
    const subjectId = s.section === 'Z' ? CS301.id : AM501.id;
    try {
      await submitFeedback(s.userId, {
        campaignId: campaign.id,
        subjectId,
        facultyId,
        answers: [
          { questionId: q1.id, ratingValue: 3 + Math.round(rand() * 2) },
          { questionId: q2.id, textValue: 'Lectures were clear and well-paced.' },
        ],
      });
    } catch (e: any) {
      console.log('  feedback submit skipped for', s.rollNumber, '-', e.message);
    }
  }
  console.log('Feedback submissions seeded (some left pending)');

  console.log('=== 12. Mentorship ===');
  for (const s of cseStudents) await assignMentor({ mentorId: f1.id, studentId: s.id }, ADMIN_USER_ID);
  for (const s of aimlYStudents) await assignMentor({ mentorId: f2.id, studentId: s.id }, ADMIN_USER_ID);
  for (const s of aimlXStudents) await assignMentor({ mentorId: f3.id, studentId: s.id }, ADMIN_USER_ID);

  await addNote({ studentId: cseStudents[0].id, title: 'Semester check-in', remarks: 'Doing well academically; encouraged to participate more in lab sessions.', meetingDate: addDays(today, -4), followUpDate: addDays(today, 10) }, f1.userId);
  await addNote({ studentId: cseStudents[7].id, title: 'Attendance concern', remarks: 'Discussed low attendance in DBMS; student cited health issues, advised to submit medical certificate.', meetingDate: addDays(today, -2), followUpDate: addDays(today, 5) }, f1.userId);
  await addNote({ studentId: aimlYStudents[7].id, title: 'Attendance concern', remarks: 'Low attendance flagged; parent to be informed if it persists.', meetingDate: addDays(today, -1), followUpDate: addDays(today, 6) }, f2.userId);
  console.log('Mentor assignments + notes created (attendance-warning notifications already fired automatically via markAttendance)');

  console.log('=== 13. Extra notifications ===');
  await createNotification(ADMIN_USER_ID, 'admin', {
    title: 'Exam Tomorrow: End Semester — Deep Learning',
    message: 'Reminder: your End Semester examination for Deep Learning (AM501) is scheduled soon. Please review the syllabus.',
    type: 'Reminder',
    targetRole: 'student',
    departmentId: AIML,
    semester: 5,
  });
  await createNotification(ADMIN_USER_ID, 'admin', {
    title: 'Assignment Due Soon: Perceptron Implementation',
    message: 'The Deep Learning Assignment 1 (Perceptron) is due soon. Submit before the deadline to avoid a late mark.',
    type: 'Assignment',
    targetRole: 'student',
    departmentId: AIML,
    semester: 5,
  });
  await createNotification(ADMIN_USER_ID, 'admin', {
    title: 'Feedback Reminder',
    message: 'Please complete the Mid-Semester Faculty Feedback before it closes.',
    type: 'Reminder',
    targetRole: 'student',
    departmentId: CSE,
    semester: 3,
  });
  console.log('Extra notifications created');

  console.log('=== 14. Academic Calendar ===');
  await createCalendarEntry(ADMIN_USER_ID, 'admin', {
    title: 'CS301 Mid-1 Examination',
    eventType: 'Examination',
    startDate: new Date(isoDate(addDays(today, -5)) + 'T10:00:00.000Z').toISOString(),
    visibility: 'department',
    departmentId: CSE,
    semester: 3,
    sourceModule: undefined,
  });
  await createCalendarEntry(ADMIN_USER_ID, 'admin', {
    title: 'AM501 End Semester Examination',
    eventType: 'Examination',
    startDate: new Date(isoDate(addDays(today, 10)) + 'T09:30:00.000Z').toISOString(),
    visibility: 'department',
    departmentId: AIML,
    semester: 5,
  });
  await createCalendarEntry(ADMIN_USER_ID, 'admin', {
    title: 'Deep Learning Assignment 1 Deadline',
    eventType: 'Assignment Deadline',
    startDate: new Date(futureDue).toISOString(),
    visibility: 'department',
    departmentId: AIML,
    semester: 5,
  });
  await createCalendarEntry(ADMIN_USER_ID, 'admin', {
    title: 'Mid-Semester Faculty Feedback Closes',
    eventType: 'Reminder',
    startDate: new Date(isoDate(addDays(today, 7)) + 'T23:59:00.000Z').toISOString(),
    visibility: 'institution_wide',
  });
  await createCalendarEntry(ADMIN_USER_ID, 'admin', {
    title: 'DBMS Unit 2 Teaching Milestone — Normalization Complete',
    eventType: 'Academic',
    startDate: new Date(isoDate(thisWeek) + 'T00:00:00.000Z').toISOString(),
    visibility: 'department',
    departmentId: CSE,
    semester: 3,
  });
  console.log('Academic calendar entries created');

  console.log('\n=== DONE ===');
  console.log(JSON.stringify({
    faculty: [f1.id, f2.id, f3.id],
    students: allStudents.map((s) => s.rollNumber),
    subjects: [CS301.code, CS302.code, AM501.code, AM502.code],
    midExamId: midExam.id,
    semExamId: semExam.id,
    campaignId: campaign.id,
  }, null, 2));
  process.exit(0);
}

main().catch((e) => {
  console.error('SEED FAILED:', e);
  process.exit(1);
});
