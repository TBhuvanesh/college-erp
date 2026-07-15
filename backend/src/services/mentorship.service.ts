import { query, withTransaction } from '../config/database';
import { AppError } from '../errors/AppError';
import type { 
  AssignMentorInput, 
  ReassignMentorInput, 
  CreateMentoringNoteInput, 
  UpdateMentoringNoteInput,
  MentorAssignment,
  MentoringNote
} from '../types/mentorship';

export async function assignMentor(data: AssignMentorInput, adminUserId: string): Promise<MentorAssignment> {
  // Validate faculty mentor exists
  const mentorCheck = await query('SELECT id FROM faculty WHERE id = $1 AND deleted_at IS NULL', [data.mentorId]);
  if (mentorCheck.rowCount === 0) {
    throw AppError.notFound('Faculty mentor not found');
  }

  // Validate student exists
  const studentCheck = await query('SELECT id FROM students WHERE id = $1 AND deleted_at IS NULL', [data.studentId]);
  if (studentCheck.rowCount === 0) {
    throw AppError.notFound('Student not found');
  }

  // Validate student doesn't already have an active assignment
  const activeCheck = await query(
    'SELECT id FROM mentor_assignments WHERE student_id = $1 AND status = \'active\' AND deleted_at IS NULL',
    [data.studentId]
  );
  if (activeCheck.rowCount && activeCheck.rowCount > 0) {
    throw AppError.conflict('Student already has an active mentor assigned. Use reassign instead.');
  }

  const { rows } = await query<MentorAssignment>(
    `INSERT INTO mentor_assignments (mentor_id, student_id, assigned_by, status)
     VALUES ($1, $2, $3, 'active')
     RETURNING 
       id, 
       mentor_id AS "mentorId", 
       student_id AS "studentId", 
       assigned_by AS "assignedBy", 
       assigned_date AS "assignedDate", 
       status, 
       created_at AS "createdAt", 
       updated_at AS "updatedAt"`,
    [data.mentorId, data.studentId, adminUserId]
  );

  return rows[0];
}

export async function reassignMentor(data: ReassignMentorInput, adminUserId: string): Promise<MentorAssignment> {
  // Validate faculty mentor exists
  const mentorCheck = await query('SELECT id FROM faculty WHERE id = $1 AND deleted_at IS NULL', [data.mentorId]);
  if (mentorCheck.rowCount === 0) {
    throw AppError.notFound('New faculty mentor not found');
  }

  // Validate student exists
  const studentCheck = await query('SELECT id FROM students WHERE id = $1 AND deleted_at IS NULL', [data.studentId]);
  if (studentCheck.rowCount === 0) {
    throw AppError.notFound('Student not found');
  }

  return withTransaction(async (client) => {
    // 1. Mark existing active assignment as reassigned
    await client.query(
      `UPDATE mentor_assignments 
       SET status = 'reassigned', updated_at = NOW() 
       WHERE student_id = $1 AND status = 'active' AND deleted_at IS NULL`,
      [data.studentId]
    );

    // 2. Create the new assignment
    const { rows } = await client.query<MentorAssignment>(
      `INSERT INTO mentor_assignments (mentor_id, student_id, assigned_by, status)
       VALUES ($1, $2, $3, 'active')
       RETURNING 
         id, 
         mentor_id AS "mentorId", 
         student_id AS "studentId", 
         assigned_by AS "assignedBy", 
         assigned_date AS "assignedDate", 
         status, 
         created_at AS "createdAt", 
         updated_at AS "updatedAt"`,
      [data.mentorId, data.studentId, adminUserId]
    );

    return rows[0];
  });
}

export async function getMentorByStudent(studentId: string) {
  const { rows } = await query(
    `SELECT 
       mg.id AS "assignmentId",
       mg.created_at AS "assignedDate",
       'active' AS status,
       f.id AS "mentorId",
       f.full_name AS "mentorName",
       f.employee_number AS "employeeNumber",
       d.name AS "departmentName",
       u.email AS "mentorEmail"
     FROM mentor_groups mg
     JOIN faculty f ON mg.mentor_id = f.id
     JOIN users u ON f.user_id = u.id
     JOIN departments d ON f.department_id = d.id
     JOIN students s ON s.id = $1 AND s.deleted_at IS NULL
     LEFT JOIN mentor_group_students mgs ON mg.id = mgs.mentor_group_id AND mgs.deleted_at IS NULL
     WHERE mg.deleted_at IS NULL AND f.deleted_at IS NULL AND (
       (mg.assignment_method = 'manual' AND mgs.student_id = s.id)
       OR
       (mg.assignment_method = 'section' AND mg.department_id = s.department_id AND mg.semester = s.semester AND mg.section = s.section)
       OR
       (mg.assignment_method = 'range' AND mg.department_id = s.department_id AND mg.semester = s.semester AND mg.section = s.section AND s.roll_number >= mg.roll_number_start AND s.roll_number <= mg.roll_number_end)
     )
     ORDER BY mg.created_at DESC
     LIMIT 1`,
    [studentId]
  );
  return rows[0] || null;
}

export async function getStudentsByMentor(mentorId: string) {
  const { rows } = await query(
    `SELECT DISTINCT
       mg.id AS "assignmentId",
       mg.created_at AS "assignedDate",
       s.id AS "studentId",
       s.full_name AS "studentName",
       s.roll_number AS "rollNumber",
       s.semester,
       d.name AS "departmentName"
     FROM mentor_groups mg
     JOIN departments d ON mg.department_id = d.id
     CROSS JOIN students s
     LEFT JOIN mentor_group_students mgs ON mg.id = mgs.mentor_group_id AND mgs.deleted_at IS NULL
     WHERE mg.mentor_id = $1 AND mg.deleted_at IS NULL AND s.deleted_at IS NULL AND (
       (mg.assignment_method = 'manual' AND mgs.student_id = s.id)
       OR
       (mg.assignment_method = 'section' AND mg.department_id = s.department_id AND mg.semester = s.semester AND mg.section = s.section)
       OR
       (mg.assignment_method = 'range' AND mg.department_id = s.department_id AND mg.semester = s.semester AND mg.section = s.section AND s.roll_number >= mg.roll_number_start AND s.roll_number <= mg.roll_number_end)
     )
     ORDER BY s.roll_number ASC`,
    [mentorId]
  );
  return rows;
}

export async function getMentorDashboard(mentorUserId: string) {
  // Resolve faculty ID from user ID
  const facultyRes = await query<{ id: string }>('SELECT id FROM faculty WHERE user_id = $1 AND deleted_at IS NULL', [mentorUserId]);
  const mentorId = facultyRes.rows[0]?.id;
  if (!mentorId) {
    throw AppError.forbidden('No faculty profile linked to this account');
  }

  // Get all active mentees
  const mentees = await query<{
    id: string;
    full_name: string;
    roll_number: string;
    department_name: string;
    semester: number;
    parent_contact: string | null;
    phone_number: string | null;
    email: string;
    academic_year: string;
    program_id: string;
  }>(
    `SELECT DISTINCT
       s.id,
       s.full_name,
       s.roll_number,
       d.name AS department_name,
       s.semester,
       s.parent_contact,
       u.phone_number,
       u.email,
       s.academic_year,
       s.program_id
     FROM students s
     JOIN users u ON s.user_id = u.id
     JOIN departments d ON s.department_id = d.id
     CROSS JOIN mentor_groups mg
     LEFT JOIN mentor_group_students mgs ON mg.id = mgs.mentor_group_id AND mgs.deleted_at IS NULL
     WHERE mg.mentor_id = $1 AND mg.deleted_at IS NULL AND s.deleted_at IS NULL AND (
       (mg.assignment_method = 'manual' AND mgs.student_id = s.id)
       OR
       (mg.assignment_method = 'section' AND mg.department_id = s.department_id AND mg.semester = s.semester AND mg.section = s.section)
       OR
       (mg.assignment_method = 'range' AND mg.department_id = s.department_id AND mg.semester = s.semester AND mg.section = s.section AND s.roll_number >= mg.roll_number_start AND s.roll_number <= mg.roll_number_end)
     )`,
    [mentorId]
  );

  const studentsDashboardData = [];

  for (const student of mentees.rows) {
    // 1. Attendance Percentage
    const attRes = await query<{ attendance_pct: number }>(
      `SELECT 
         COALESCE(
           ROUND(
             (COUNT(id) FILTER (WHERE status = 'present')::numeric / NULLIF(COUNT(id), 0)) * 100, 
             2
           ), 
           0
         )::float AS attendance_pct
       FROM attendance
       WHERE student_id = $1`,
      [student.id]
    );
    const attendancePct = attRes.rows[0]?.attendance_pct ?? 0;

    // 2. Latest CGPA & Failed Subjects
    const resRes = await query<{ grade: string; result_status: string; credits: number }>(
      `SELECT r.grade, r.result_status, sub.credits
       FROM results r
       JOIN subjects sub ON r.subject_id = sub.id
       WHERE r.student_id = $1 AND r.publication_status = 'Published' AND r.deleted_at IS NULL`,
      [student.id]
    );
    
    let totalPoints = 0;
    let totalCredits = 0;
    let failedSubjectsCount = 0;
    const gradeMap: Record<string, number> = { 'O': 10, 'A+': 9, 'A': 8, 'B+': 7, 'B': 6, 'C': 5, 'F': 0 };

    resRes.rows.forEach(r => {
      const points = gradeMap[r.grade] ?? 0;
      const credits = Number(r.credits) || 0;
      totalPoints += points * credits;
      totalCredits += credits;
      if (r.result_status === 'Fail' || r.grade === 'F') {
        failedSubjectsCount++;
      }
    });
    const latestCGPA = totalCredits > 0 ? Number((totalPoints / totalCredits).toFixed(2)) : 0;

    // 3. Internal Marks Summary
    const intRes = await query<{ obtained: number; maximum: number }>(
      `SELECT 
         COALESCE(SUM(obtained_marks), 0)::float AS obtained, 
         COALESCE(SUM(maximum_marks), 0)::float AS maximum 
       FROM internal_marks 
       WHERE student_id = $1`,
      [student.id]
    );
    const intSummary = intRes.rows[0] || { obtained: 0, maximum: 0 };
    const internalPercentage = intSummary.maximum > 0 ? (intSummary.obtained / intSummary.maximum) * 100 : 100;

    // 4. Fee Status
    const feeRes = await query<{ pending: number; total: number; overdue_count: number }>(
      `SELECT 
         COALESCE(SUM(pending_amount), 0)::float AS pending, 
         COALESCE(SUM(total_amount), 0)::float AS total,
         COUNT(id) FILTER (WHERE payment_status = 'Overdue')::int AS overdue_count
       FROM fees 
       WHERE student_id = $1 AND deleted_at IS NULL`,
      [student.id]
    );
    const feeInfo = feeRes.rows[0] || { pending: 0, total: 0, overdue_count: 0 };

    // 5. Assignment Status
    const assignRes = await query<{ total: number; submitted: number; overdue: number }>(
      `SELECT 
         COUNT(a.id)::int AS total, 
         COUNT(sub.id)::int AS submitted, 
         COUNT(a.id) FILTER (WHERE a.due_date < NOW() AND sub.id IS NULL)::int AS overdue
       FROM assignments a
       JOIN subjects s ON a.subject_id = s.id
       JOIN students st ON st.program_id = s.program_id AND st.semester = s.semester
       LEFT JOIN assignment_submissions sub ON sub.assignment_id = a.id AND sub.student_id = st.id AND sub.deleted_at IS NULL
       WHERE st.id = $1 AND a.deleted_at IS NULL AND s.deleted_at IS NULL AND st.deleted_at IS NULL`,
      [student.id]
    );
    const assignInfo = assignRes.rows[0] || { total: 0, submitted: 0, overdue: 0 };

    // Identify Alerts
    const alerts = {
      attendanceBelow75: attendancePct < 75,
      feePending: feeInfo.pending > 0,
      assignmentOverdue: assignInfo.overdue > 0,
      failedSubjects: failedSubjectsCount > 0,
      lowInternalMarks: internalPercentage < 50
    };

    studentsDashboardData.push({
      profile: {
        id: student.id,
        name: student.full_name,
        rollNumber: student.roll_number,
        department: student.department_name,
        semester: student.semester,
        year: Math.ceil(student.semester / 2),
        phoneNumber: student.phone_number,
        parentContact: student.parent_contact,
        email: student.email
      },
      summary: {
        attendancePercentage: attendancePct,
        latestCGPA,
        internalMarksSummary: `${intSummary.obtained}/${intSummary.maximum} (${Math.round(internalPercentage)}%)`,
        feeStatus: feeInfo.pending > 0 ? `Pending: ₦${feeInfo.pending.toFixed(2)}` : 'Paid',
        assignmentStatus: `${assignInfo.submitted}/${assignInfo.total} Submitted`
      },
      alerts
    });
  }

  return studentsDashboardData;
}

export async function addNote(data: CreateMentoringNoteInput, mentorUserId: string): Promise<MentoringNote> {
  const facultyRes = await query<{ id: string }>('SELECT id FROM faculty WHERE user_id = $1 AND deleted_at IS NULL', [mentorUserId]);
  const mentorId = facultyRes.rows[0]?.id;
  if (!mentorId) {
    throw AppError.forbidden('No faculty profile linked to this account');
  }

  // Ensure this faculty is the student's mentor
  const assResult = await query(
    `SELECT 1
     FROM mentor_groups mg
     JOIN students s ON s.id = $2 AND s.deleted_at IS NULL
     LEFT JOIN mentor_group_students mgs ON mg.id = mgs.mentor_group_id AND mgs.deleted_at IS NULL
     WHERE mg.mentor_id = $1 AND mg.deleted_at IS NULL AND (
       (mg.assignment_method = 'manual' AND mgs.student_id = s.id)
       OR
       (mg.assignment_method = 'section' AND mg.department_id = s.department_id AND mg.semester = s.semester AND mg.section = s.section)
       OR
       (mg.assignment_method = 'range' AND mg.department_id = s.department_id AND mg.semester = s.semester AND mg.section = s.section AND s.roll_number >= mg.roll_number_start AND s.roll_number <= mg.roll_number_end)
     )
     LIMIT 1`,
    [mentorId, data.studentId]
  );
  if (assResult.rowCount === 0) {
    throw AppError.forbidden('You are not assigned as the mentor for this student');
  }

  const { rows } = await query<MentoringNote>(
    `INSERT INTO mentoring_notes (mentor_id, student_id, title, remarks, meeting_date, follow_up_date)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING 
       id, 
       mentor_id AS "mentorId", 
       student_id AS "studentId", 
       title, 
       remarks, 
       meeting_date AS "meetingDate", 
       follow_up_date AS "followUpDate", 
       created_at AS "createdAt", 
       updated_at AS "updatedAt"`,
    [mentorId, data.studentId, data.title, data.remarks, data.meetingDate, data.followUpDate || null]
  );

  return rows[0];
}

export async function updateNote(noteId: string, data: UpdateMentoringNoteInput): Promise<MentoringNote> {
  const sets: string[] = [];
  const params: unknown[] = [noteId];

  const push = (field: string, value: unknown) => {
    params.push(value);
    sets.push(`${field} = $${params.length}`);
  };

  if (data.title !== undefined) push('title', data.title);
  if (data.remarks !== undefined) push('remarks', data.remarks);
  if (data.meetingDate !== undefined) push('meeting_date', data.meetingDate);
  if (data.followUpDate !== undefined) push('follow_up_date', data.followUpDate);

  if (sets.length === 0) {
    throw AppError.badRequest('No updates provided');
  }

  const { rows } = await query<MentoringNote>(
    `UPDATE mentoring_notes 
     SET ${sets.join(', ')}, updated_at = NOW() 
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING 
       id, 
       mentor_id AS "mentorId", 
       student_id AS "studentId", 
       title, 
       remarks, 
       meeting_date AS "meetingDate", 
       follow_up_date AS "followUpDate", 
       created_at AS "createdAt", 
       updated_at AS "updatedAt"`,
    params
  );

  if (rows.length === 0) {
    throw AppError.notFound('Mentoring note not found');
  }

  return rows[0];
}

export async function deleteNote(noteId: string): Promise<void> {
  const result = await query(
    'UPDATE mentoring_notes SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL',
    [noteId]
  );
  if (result.rowCount === 0) {
    throw AppError.notFound('Mentoring note not found or already deleted');
  }
}

export async function getNotesByStudent(studentId: string): Promise<MentoringNote[]> {
  const { rows } = await query<MentoringNote>(
    `SELECT 
       id, 
       mentor_id AS "mentorId", 
       student_id AS "studentId", 
       title, 
       remarks, 
       meeting_date AS "meetingDate", 
       follow_up_date AS "followUpDate", 
       created_at AS "createdAt", 
       updated_at AS "updatedAt"
     FROM mentoring_notes 
     WHERE student_id = $1 AND deleted_at IS NULL
     ORDER BY meeting_date DESC, created_at DESC`,
    [studentId]
  );
  return rows;
}

export async function getMentorWorkloads() {
  const { rows } = await query(
    `WITH student_mentor_relations AS (
       SELECT DISTINCT ON (s.id)
         s.id AS student_id,
         mg.mentor_id AS mentor_id
       FROM students s
       CROSS JOIN mentor_groups mg
       LEFT JOIN mentor_group_students mgs ON mg.id = mgs.mentor_group_id AND mgs.deleted_at IS NULL
       WHERE s.deleted_at IS NULL AND mg.deleted_at IS NULL AND (
         (mg.assignment_method = 'manual' AND mgs.student_id = s.id)
         OR
         (mg.assignment_method = 'section' AND mg.department_id = s.department_id AND mg.semester = s.semester AND mg.section = s.section)
         OR
         (mg.assignment_method = 'range' AND mg.department_id = s.department_id AND mg.semester = s.semester AND mg.section = s.section AND s.roll_number >= mg.roll_number_start AND s.roll_number <= mg.roll_number_end)
       )
       ORDER BY s.id, mg.created_at DESC
     )
     SELECT 
       f.id AS "mentorId",
       f.full_name AS "mentorName",
       f.employee_number AS "employeeNumber",
       d.name AS "departmentName",
       f.is_mentoring_head AS "isMentoringHead",
       COALESCE(COUNT(smr.student_id), 0)::int AS "activeMenteesCount"
     FROM faculty f
     JOIN departments d ON f.department_id = d.id
     LEFT JOIN student_mentor_relations smr ON f.id = smr.mentor_id
     WHERE f.deleted_at IS NULL
     GROUP BY f.id, f.full_name, f.employee_number, d.name, f.is_mentoring_head
     ORDER BY "activeMenteesCount" DESC, f.full_name ASC`
  );
  return rows;
}

export async function getMentorshipReports() {
  const totalStudentsRes = await query<{ count: string }>('SELECT COUNT(*)::text AS count FROM students WHERE deleted_at IS NULL');
  
  const assignedStudentsRes = await query<{ count: string }>(
    `WITH student_mentor_relations AS (
       SELECT DISTINCT ON (s.id)
         s.id AS student_id
       FROM students s
       CROSS JOIN mentor_groups mg
       LEFT JOIN mentor_group_students mgs ON mg.id = mgs.mentor_group_id AND mgs.deleted_at IS NULL
       WHERE s.deleted_at IS NULL AND mg.deleted_at IS NULL AND (
         (mg.assignment_method = 'manual' AND mgs.student_id = s.id)
         OR
         (mg.assignment_method = 'section' AND mg.department_id = s.department_id AND mg.semester = s.semester AND mg.section = s.section)
         OR
         (mg.assignment_method = 'range' AND mg.department_id = s.department_id AND mg.semester = s.semester AND mg.section = s.section AND s.roll_number >= mg.roll_number_start AND s.roll_number <= mg.roll_number_end)
       )
     )
     SELECT COUNT(student_id)::text AS count FROM student_mentor_relations`
  );

  const totalStudents = parseInt(totalStudentsRes.rows[0]?.count || '0', 10);
  const assignedStudents = parseInt(assignedStudentsRes.rows[0]?.count || '0', 10);

  const { rows: relationships } = await query(
    `WITH student_mentor_relations AS (
       SELECT DISTINCT ON (s.id)
         s.id AS student_id,
         mg.mentor_id AS mentor_id,
         f.full_name AS mentor_name
       FROM students s
       CROSS JOIN mentor_groups mg
       JOIN faculty f ON mg.mentor_id = f.id AND f.deleted_at IS NULL
       LEFT JOIN mentor_group_students mgs ON mg.id = mgs.mentor_group_id AND mgs.deleted_at IS NULL
       WHERE s.deleted_at IS NULL AND mg.deleted_at IS NULL AND (
         (mg.assignment_method = 'manual' AND mgs.student_id = s.id)
         OR
         (mg.assignment_method = 'section' AND mg.department_id = s.department_id AND mg.semester = s.semester AND mg.section = s.section)
         OR
         (mg.assignment_method = 'range' AND mg.department_id = s.department_id AND mg.semester = s.semester AND mg.section = s.section AND s.roll_number >= mg.roll_number_start AND s.roll_number <= mg.roll_number_end)
       )
       ORDER BY s.id, mg.created_at DESC
     )
     SELECT 
       s.id AS "studentId",
       s.full_name AS "studentName",
       s.roll_number AS "rollNumber",
       d.name AS "departmentName",
       s.semester,
       smr.mentor_name AS "mentorName",
       smr.mentor_id AS "mentorId"
     FROM students s
     JOIN departments d ON s.department_id = d.id
     LEFT JOIN student_mentor_relations smr ON s.id = smr.student_id
     WHERE s.deleted_at IS NULL
     ORDER BY d.name, s.semester, s.roll_number`
  );

  return {
    summary: {
      totalStudents,
      assignedStudents,
      unassignedStudents: totalStudents - assignedStudents
    },
    relationships
  };
}
