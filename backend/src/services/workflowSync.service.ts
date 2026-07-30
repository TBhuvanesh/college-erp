import { query } from '../config/database';

/**
 * Automatically enrolls and synchronizes mentorship for a student.
 * If a mentor group matches the student's department, semester, and section,
 * they are enrolled in the group and linked to the mentor.
 */
export async function syncStudentMentorship(studentId: string): Promise<void> {
  const { rows: student } = await query(
    `SELECT id, department_id, semester, section, roll_number FROM students WHERE id = $1 AND status = 'active' AND deleted_at IS NULL`,
    [studentId]
  );
  if (!student[0]) return;
  const s = student[0];

  // Find active mentor group matching department, semester, section
  const { rows: groups } = await query(
    `SELECT id, mentor_id, assignment_method, roll_number_start, roll_number_end 
     FROM mentor_groups 
     WHERE department_id = $1 AND semester = $2 AND section = $3 AND deleted_at IS NULL`,
    [s.department_id, s.semester, s.section]
  );

  for (const g of groups) {
    let matches = false;
    if (g.assignment_method === 'section') matches = true;
    else if (g.assignment_method === 'range') {
      matches = s.roll_number >= (g.roll_number_start || '') && s.roll_number <= (g.roll_number_end || '');
    } else if (g.assignment_method === 'manual') {
      matches = true; // Auto-assign to group
    }

    if (matches) {
      if (g.assignment_method === 'manual') {
        // Insert into mentor_group_students
        await query(
          `INSERT INTO mentor_group_students (mentor_group_id, student_id)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [g.id, s.id]
        );
      }
      // Create active mentor assignment
      const activeCheck = await query(
        `SELECT id FROM mentor_assignments WHERE student_id = $1 AND status = 'active' AND deleted_at IS NULL`,
        [s.id]
      );
      if (activeCheck.rowCount === 0) {
        await query(
          `INSERT INTO mentor_assignments (mentor_id, student_id, assigned_by, status)
           VALUES ($1, $2, $3, 'active')`,
          [g.mentor_id, s.id, g.mentor_id]
        );
      }
    }
  }
}

/**
 * Scans all active students without active mentor assignments and runs mentorship synchronization.
 */
export async function syncAllUnassignedStudents(): Promise<void> {
  const { rows: students } = await query(
    `SELECT id FROM students s
     WHERE s.status = 'active' AND s.deleted_at IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM mentor_assignments ma 
         WHERE ma.student_id = s.id AND ma.status = 'active' AND ma.deleted_at IS NULL
       )`
  );
  for (const row of students) {
    await syncStudentMentorship(row.id);
  }
}

/**
 * Cascading deactivation of faculty member workload.
 */
export async function handleFacultyDeactivation(facultyId: string, actorId: string): Promise<void> {
  // 1. Find all active teaching assignments for this faculty
  const { rows: assignments } = await query(
    `SELECT id, subject_id, section, department_id, academic_year FROM teaching_assignments
     WHERE faculty_id = $1 AND is_active = TRUE AND deleted_at IS NULL`,
    [facultyId]
  );

  if (assignments.length === 0) return;

  // 2. Mark teaching assignments as inactive
  await query(
    `UPDATE teaching_assignments SET is_active = FALSE, status = 'inactive'
     WHERE faculty_id = $1 AND deleted_at IS NULL`,
    [facultyId]
  );

  // 3. Find HOD user ID for each department to notify them
  for (const ta of assignments) {
    const { rows: hod } = await query(
      `SELECT user_id FROM faculty WHERE department_id = $1 AND designation = 'hod' AND deleted_at IS NULL LIMIT 1`,
      [ta.department_id]
    );
    if (hod[0]) {
      await query(
        `INSERT INTO notifications (id, title, message, type, target_role, department_id, is_important, created_by, recipient_user_id)
         VALUES (uuid_generate_v4(), $1, $2, 'Academic Alert', 'faculty', $3, true, $4, $5)`,
        [
          'Teaching Assignment Reassignment Needed',
          `Faculty deactivation has left Subject (ID: ${ta.subject_id}) (Section ${ta.section}) unassigned. Please reassign this class.`,
          ta.department_id,
          actorId,
          hod[0].user_id
        ]
      );
    }
  }
}

/**
 * Cascading updates when a teaching assignment is revoked.
 */
export async function handleAssignmentRevocation(assignmentId: string, actorId: string): Promise<void> {
  const { rows: assignment } = await query(
    `SELECT faculty_id, subject_id, section, department_id FROM teaching_assignments WHERE id = $1`,
    [assignmentId]
  );
  if (!assignment[0]) return;
  const ta = assignment[0];

  // Notify the old faculty member
  const { rows: oldUser } = await query(`SELECT user_id FROM faculty WHERE id = $1`, [ta.faculty_id]);
  if (oldUser[0]) {
    await query(
      `INSERT INTO notifications (id, title, message, type, target_role, department_id, is_important, created_by, recipient_user_id)
       VALUES (uuid_generate_v4(), $1, $2, 'Academic Alert', 'faculty', $3, false, $4, $5)`,
      [
        'Teaching Assignment Revoked',
        `Your assignment for Subject (ID: ${ta.subject_id}) Section ${ta.section} has been revoked.`,
        ta.department_id,
        actorId,
        oldUser[0].user_id
      ]
    );
  }
}

/**
 * Cascading updates when a teaching assignment is updated or transferred.
 */
export async function handleAssignmentUpdate(
  assignmentId: string,
  oldFacultyId: string,
  newFacultyId: string,
  actorId: string
): Promise<void> {
  if (oldFacultyId === newFacultyId) return;

  // Update LMS assignments
  await query(
    `UPDATE assignments SET faculty_id = $1 WHERE teaching_assignment_id = $2`,
    [newFacultyId, assignmentId]
  );

  // Update course materials
  await query(
    `UPDATE course_materials SET faculty_id = $1 WHERE teaching_assignment_id = $2`,
    [newFacultyId, assignmentId]
  );

  // Update teaching plans
  await query(
    `UPDATE teaching_plans SET faculty_id = $1 WHERE teaching_assignment_id = $2`,
    [newFacultyId, assignmentId]
  );

  // Update result entry tasks
  await query(
    `UPDATE result_entry_tasks SET faculty_id = $1 WHERE teaching_assignment_id = $2`,
    [newFacultyId, assignmentId]
  );

  // Notify old faculty
  const { rows: oldUser } = await query(`SELECT user_id FROM faculty WHERE id = $1`, [oldFacultyId]);
  if (oldUser[0]) {
    await query(
      `INSERT INTO notifications (id, title, message, type, target_role, is_important, created_by, recipient_user_id)
       VALUES (uuid_generate_v4(), $1, $2, 'Academic Alert', 'faculty', false, $3, $4)`,
      ['Teaching Assignment Transferred', `Your teaching assignment has been transferred to another faculty.`, actorId, oldUser[0].user_id]
    );
  }

  // Notify new faculty
  const { rows: newUser } = await query(`SELECT user_id FROM faculty WHERE id = $1`, [newFacultyId]);
  if (newUser[0]) {
    await query(
      `INSERT INTO notifications (id, title, message, type, target_role, is_important, created_by, recipient_user_id)
       VALUES (uuid_generate_v4(), $1, $2, 'Academic Alert', 'faculty', false, $3, $4)`,
      ['New Teaching Assignment Transferred', `You have received a transferred teaching assignment.`, actorId, newUser[0].user_id]
    );
  }
}

/**
 * Handle Result Finalization cascades.
 */
export async function handleResultFinalization(payload: any, actorId: string): Promise<void> {
  const { departmentId, semester, title, message } = payload;
  
  // Create welcome notification/grade release notification for students of this cohort
  await query(
    `INSERT INTO notifications (id, title, message, type, target_role, department_id, semester, is_important, created_by)
     VALUES (uuid_generate_v4(), $1, $2, 'Grade Released', 'student', $3, $4, false, $5)`,
    [title || 'Results Finalized', message || 'Final results have been published for this semester.', departmentId, semester, actorId]
  );

  // Invalidate dashboard and analytics cached metrics so they are instantly updated
  const { invalidateTtlCachePrefix, invalidateTtlCache } = require('../utils/ttlCache');
  invalidateTtlCachePrefix('analytics:');
  invalidateTtlCache('dashboard:institutionCounts');
}

/**
 * Checks if all subjects in a cohort's curriculum have published results, and if so, finalizes results.
 */
export async function checkAndFinalizeCohortResults(departmentId: string, semester: number, actorId: string): Promise<void> {
  const { rows: curriculum } = await query(
    `SELECT DISTINCT subject_id FROM subject_curriculum_mappings 
     WHERE department_id = $1 AND semester = $2 AND deleted_at IS NULL`,
    [departmentId, semester]
  );
  if (curriculum.length === 0) return;

  const { rows: published } = await query(
    `SELECT COUNT(DISTINCT r.subject_id)::int AS count 
     FROM results r
     JOIN students s ON s.id = r.student_id
     WHERE s.department_id = $1 AND s.semester = $2 AND r.publication_status = 'Published' AND r.deleted_at IS NULL`,
    [departmentId, semester]
  );

  if (published[0]?.count === curriculum.length) {
    // All subjects have published results! Emit result.finalized
    // Wait, import emitWorkflowEvent dynamically to avoid any potential circular dependencies
    const { emitWorkflowEvent } = require('./workflowEngine.service');
    await emitWorkflowEvent('result.finalized', actorId, {
      departmentId,
      semester,
      title: 'Cohort Results Finalized',
      message: `Final results have been compiled and finalized for Semester ${semester}.`,
      notificationType: 'Grade Released',
    });
  }
}
