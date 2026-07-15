import { query, pool } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

async function seedExamsAndSeating() {
  console.log('Seeding Exam Rooms, Schedules, Seating Allocations, and Invigilation Duties...');

  try {
    // 1. Reset Seating & Invigilation & Exams
    await query(`DELETE FROM exam_seat_allocations`);
    await query(`DELETE FROM exam_invigilation_duties`);
    await query(`DELETE FROM exams`);
    await query(`DELETE FROM exam_rooms`);
    console.log('  - Cleared old exam seating, duties, exams, and rooms.');

    // 2. Seed Exam Rooms
    const rooms = [
      { id: uuidv4(), name: 'Room 101 (Block A)', building: 'Block A', capacity: 40 },
      { id: uuidv4(), name: 'Room 204 (Block B)', building: 'Block B', capacity: 40 },
      { id: uuidv4(), name: 'Seminar Hall 1', building: 'Science Block', capacity: 60 },
      { id: uuidv4(), name: 'Main Gallery Hall', building: 'Admin Block', capacity: 80 }
    ];

    for (const r of rooms) {
      await query(
        `INSERT INTO exam_rooms (id, name, building, capacity, is_active) VALUES ($1, $2, $3, $4, TRUE)`,
        [r.id, r.name, r.building, r.capacity]
      );
    }
    console.log(`  - Seeded ${rooms.length} exam rooms.`);

    // 3. Query Subjects & Faculty
    const { rows: subjects } = await query<{ id: string; name: string; code: string; semester: number; program_id: string }>(
      `SELECT id, name, code, semester, program_id FROM subjects LIMIT 10`
    );
    const { rows: faculty } = await query<{ id: string; user_id: string }>(
      `SELECT id, user_id FROM faculty LIMIT 10`
    );
    const { rows: adminUser } = await query<{ id: string }>(
      `SELECT id FROM users WHERE role = 'admin' LIMIT 1`
    );

    if (subjects.length === 0 || faculty.length === 0 || adminUser.length === 0) {
      throw new Error('Baseline data missing. Run seed.ts first.');
    }

    const adminId = adminUser[0].id;

    // 4. Seed Scheduled Exams
    const examDate = new Date();
    examDate.setDate(examDate.getDate() + 5); // 5 days from today
    const examDateStr = examDate.toISOString().split('T')[0];

    const examsList = [
      {
        id: uuidv4(),
        subject_id: subjects[0].id,
        faculty_id: faculty[0].id,
        semester: subjects[0].semester,
        section: 'A',
        exam_type: 'Mid-1',
        exam_date: examDateStr,
        start_time: '10:00:00',
        end_time: '12:00:00',
        maximum_marks: 30.00
      },
      {
        id: uuidv4(),
        subject_id: subjects[1 % subjects.length].id,
        faculty_id: faculty[1 % faculty.length].id,
        semester: subjects[1 % subjects.length].semester,
        section: 'A',
        exam_type: 'Mid-1',
        exam_date: examDateStr,
        start_time: '10:00:00',
        end_time: '12:00:00',
        maximum_marks: 30.00
      },
      {
        id: uuidv4(),
        subject_id: subjects[2 % subjects.length].id,
        faculty_id: faculty[2 % faculty.length].id,
        semester: subjects[2 % subjects.length].semester,
        section: 'A',
        exam_type: 'End Semester',
        exam_date: examDateStr,
        start_time: '14:00:00',
        end_time: '17:00:00',
        maximum_marks: 70.00
      }
    ];

    for (const e of examsList) {
      await query(
        `INSERT INTO exams (id, subject_id, faculty_id, semester, section, exam_type, exam_date, start_time, end_time, maximum_marks, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Scheduled')`,
        [e.id, e.subject_id, e.faculty_id, e.semester, e.section, e.exam_type, e.exam_date, e.start_time, e.end_time, e.maximum_marks]
      );
    }
    console.log(`  - Seeded ${examsList.length} exams.`);

    // 5. Seed Seat Allocations dynamically
    // Select students for the first two exams (sharing slot 10:00 AM - 12:00 PM)
    const exam1 = examsList[0];
    const exam2 = examsList[1];

    const { rows: studentsExam1 } = await query<{ id: string; roll_number: string }>(
      `SELECT id, roll_number FROM students WHERE program_id = $1 AND semester = $2 AND section = 'A' AND status = 'active' ORDER BY roll_number`,
      [subjects[0].program_id, exam1.semester]
    );

    const { rows: studentsExam2 } = await query<{ id: string; roll_number: string }>(
      `SELECT id, roll_number FROM students WHERE program_id = $1 AND semester = $2 AND section = 'A' AND status = 'active' ORDER BY roll_number`,
      [subjects[1 % subjects.length].program_id, exam2.semester]
    );

    // Interleave seating allocations in Room 101 (Block A)
    let seatNum = 1;
    const roomId = rooms[0].id; // Room 101

    const maxLen = Math.max(studentsExam1.length, studentsExam2.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < studentsExam1.length) {
        await query(
          `INSERT INTO exam_seat_allocations (id, exam_id, room_id, student_id, seat_number) VALUES ($1, $2, $3, $4, $5)`,
          [uuidv4(), exam1.id, roomId, studentsExam1[i].id, seatNum++]
        );
      }
      if (i < studentsExam2.length) {
        await query(
          `INSERT INTO exam_seat_allocations (id, exam_id, room_id, student_id, seat_number) VALUES ($1, $2, $3, $4, $5)`,
          [uuidv4(), exam2.id, roomId, studentsExam2[i].id, seatNum++]
        );
      }
    }
    console.log(`  - Allocated seats for ${seatNum - 1} students in ${rooms[0].name}.`);

    // 6. Seed Invigilation Duties
    await query(
      `INSERT INTO exam_invigilation_duties (id, room_id, faculty_id, duty_date, start_time, end_time, status, assigned_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'Assigned', $7)`,
      [uuidv4(), roomId, faculty[0].id, examDateStr, '10:00:00', '12:00:00', adminId]
    );

    await query(
      `INSERT INTO exam_invigilation_duties (id, room_id, faculty_id, duty_date, start_time, end_time, status, assigned_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'Assigned', $7)`,
      [uuidv4(), rooms[1].id, faculty[1 % faculty.length].id, examDateStr, '14:00:00', '17:00:00', adminId]
    );

    console.log(`  - Seeded invigilation duties for faculty tutors.`);
    console.log('Exam Seating & Invigilation seeding completed successfully.');

  } catch (error) {
    console.error('Seeding exam modules failed:', error);
  }
}

seedExamsAndSeating().then(() => pool.end());
