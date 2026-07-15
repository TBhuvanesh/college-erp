import { query, withTransaction } from '../config/database';
import { AppError } from '../errors/AppError';
import type { 
  CreateMentorGroupInput, 
  UpdateMentorGroupInput, 
  MentorGroup 
} from '../types/mentorGroup';

export async function createMentorGroup(data: CreateMentorGroupInput, createdBy: string): Promise<MentorGroup> {
  // Validate faculty mentor exists
  const mentorCheck = await query('SELECT id FROM faculty WHERE id = $1 AND deleted_at IS NULL', [data.mentorId]);
  if (mentorCheck.rowCount === 0) {
    throw AppError.notFound('Faculty mentor not found');
  }

  // Validate department exists
  const deptCheck = await query('SELECT id FROM departments WHERE id = $1', [data.departmentId]);
  if (deptCheck.rowCount === 0) {
    throw AppError.notFound('Department not found');
  }

  return withTransaction(async (client) => {
    // 1. Create the mentor group
    const { rows } = await client.query<MentorGroup>(
      `INSERT INTO mentor_groups (
        mentor_id, department_id, year, semester, section, 
        assignment_method, roll_number_start, roll_number_end, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING 
        id, 
        mentor_id AS "mentorId", 
        department_id AS "departmentId", 
        year, 
        semester, 
        section, 
        assignment_method AS "assignmentMethod", 
        roll_number_start AS "rollNumberStart", 
        roll_number_end AS "rollNumberEnd", 
        created_by AS "createdBy", 
        created_at AS "createdAt", 
        updated_at AS "updatedAt"`,
      [
        data.mentorId,
        data.departmentId,
        data.year,
        data.semester,
        data.section,
        data.assignmentMethod,
        data.rollNumberStart || null,
        data.rollNumberEnd || null,
        createdBy
      ]
    );

    const group = rows[0];

    // 2. If assignment method is manual and studentIds are provided, insert them into junction table
    if (data.assignmentMethod === 'manual' && data.studentIds && data.studentIds.length > 0) {
      for (const studentId of data.studentIds) {
        await client.query(
          `INSERT INTO mentor_group_students (mentor_group_id, student_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [group.id, studentId]
        );
      }
    }

    return group;
  });
}

export async function getMentorGroups(filters: {
  mentorId?: string;
  departmentId?: string;
  year?: number;
  semester?: number;
  section?: string;
  assignmentMethod?: string;
}): Promise<MentorGroup[]> {
  const params: any[] = [];
  let paramIdx = 1;
  let sql = `
    SELECT 
      mg.id,
      mg.mentor_id AS "mentorId",
      f.full_name AS "mentorName",
      mg.department_id AS "departmentId",
      d.name AS "departmentName",
      mg.year,
      mg.semester,
      mg.section,
      mg.assignment_method AS "assignmentMethod",
      mg.roll_number_start AS "rollNumberStart",
      mg.roll_number_end AS "rollNumberEnd",
      mg.created_by AS "createdBy",
      mg.created_at AS "createdAt",
      mg.updated_at AS "updatedAt",
      (
        SELECT COUNT(s.id)::int
        FROM students s
        LEFT JOIN mentor_group_students mgs ON mg.id = mgs.mentor_group_id AND mgs.deleted_at IS NULL
        WHERE s.deleted_at IS NULL AND (
          (mg.assignment_method = 'manual' AND mgs.student_id = s.id)
          OR
          (mg.assignment_method = 'section' AND mg.department_id = s.department_id AND mg.semester = s.semester AND mg.section = s.section)
          OR
          (mg.assignment_method = 'range' AND mg.department_id = s.department_id AND mg.semester = s.semester AND mg.section = s.section AND s.roll_number >= mg.roll_number_start AND s.roll_number <= mg.roll_number_end)
        )
      ) AS "studentCount"
    FROM mentor_groups mg
    JOIN faculty f ON mg.mentor_id = f.id
    JOIN departments d ON mg.department_id = d.id
    WHERE mg.deleted_at IS NULL AND f.deleted_at IS NULL
  `;

  if (filters.mentorId) {
    sql += ` AND mg.mentor_id = $${paramIdx++}`;
    params.push(filters.mentorId);
  }
  if (filters.departmentId && filters.departmentId !== 'ALL') {
    sql += ` AND mg.department_id = $${paramIdx++}`;
    params.push(filters.departmentId);
  }
  if (filters.year) {
    sql += ` AND mg.year = $${paramIdx++}`;
    params.push(filters.year);
  }
  if (filters.semester) {
    sql += ` AND mg.semester = $${paramIdx++}`;
    params.push(filters.semester);
  }
  if (filters.section && filters.section !== 'ALL') {
    sql += ` AND mg.section = $${paramIdx++}`;
    params.push(filters.section);
  }
  if (filters.assignmentMethod && filters.assignmentMethod !== 'ALL') {
    sql += ` AND mg.assignment_method = $${paramIdx++}`;
    params.push(filters.assignmentMethod);
  }

  sql += ` ORDER BY mg.created_at DESC`;

  const { rows } = await query<MentorGroup>(sql, params);
  return rows;
}

export async function updateMentorGroup(id: string, data: UpdateMentorGroupInput): Promise<MentorGroup> {
  // Check if group exists
  const groupCheck = await query('SELECT * FROM mentor_groups WHERE id = $1 AND deleted_at IS NULL', [id]);
  if (groupCheck.rowCount === 0) {
    throw AppError.notFound('Mentor group not found');
  }

  return withTransaction(async (client) => {
    // 1. Build update SQL
    const setFields: string[] = [];
    const params: any[] = [id];
    let paramIdx = 2;

    if (data.mentorId !== undefined) {
      setFields.push(`mentor_id = $${paramIdx++}`);
      params.push(data.mentorId);
    }
    if (data.departmentId !== undefined) {
      setFields.push(`department_id = $${paramIdx++}`);
      params.push(data.departmentId);
    }
    if (data.year !== undefined) {
      setFields.push(`year = $${paramIdx++}`);
      params.push(data.year);
    }
    if (data.semester !== undefined) {
      setFields.push(`semester = $${paramIdx++}`);
      params.push(data.semester);
    }
    if (data.section !== undefined) {
      setFields.push(`section = $${paramIdx++}`);
      params.push(data.section);
    }
    if (data.assignmentMethod !== undefined) {
      setFields.push(`assignment_method = $${paramIdx++}`);
      params.push(data.assignmentMethod);
    }
    if (data.rollNumberStart !== undefined) {
      setFields.push(`roll_number_start = $${paramIdx++}`);
      params.push(data.rollNumberStart);
    }
    if (data.rollNumberEnd !== undefined) {
      setFields.push(`roll_number_end = $${paramIdx++}`);
      params.push(data.rollNumberEnd);
    }

    let group: MentorGroup;
    if (setFields.length > 0) {
      const sql = `
        UPDATE mentor_groups 
        SET ${setFields.join(', ')}, updated_at = NOW() 
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING 
          id, 
          mentor_id AS "mentorId", 
          department_id AS "departmentId", 
          year, 
          semester, 
          section, 
          assignment_method AS "assignmentMethod", 
          roll_number_start AS "rollNumberStart", 
          roll_number_end AS "rollNumberEnd", 
          created_by AS "createdBy", 
          created_at AS "createdAt", 
          updated_at AS "updatedAt"`;
      
      const { rows } = await client.query<MentorGroup>(sql, params);
      group = rows[0];
    } else {
      const { rows } = await client.query<MentorGroup>(
        `SELECT 
          id, 
          mentor_id AS "mentorId", 
          department_id AS "departmentId", 
          year, 
          semester, 
          section, 
          assignment_method AS "assignmentMethod", 
          roll_number_start AS "rollNumberStart", 
          roll_number_end AS "rollNumberEnd", 
          created_by AS "createdBy", 
          created_at AS "createdAt", 
          updated_at AS "updatedAt"
         FROM mentor_groups WHERE id = $1`, [id]
      );
      group = rows[0];
    }

    // 2. If studentIds are provided, synchronize the manual student list
    if (data.studentIds !== undefined) {
      // Hard delete previous manual students
      await client.query('DELETE FROM mentor_group_students WHERE mentor_group_id = $1', [id]);
      
      for (const studentId of data.studentIds) {
        await client.query(
          `INSERT INTO mentor_group_students (mentor_group_id, student_id)
           VALUES ($1, $2)`,
          [id, studentId]
        );
      }
    }

    return group;
  });
}

export async function deleteMentorGroup(id: string): Promise<void> {
  const result = await query(
    `UPDATE mentor_groups 
     SET deleted_at = NOW() 
     WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  if (result.rowCount === 0) {
    throw AppError.notFound('Mentor group not found');
  }
}

export async function resolveStudentsInGroup(groupId: string): Promise<any[]> {
  const groupRes = await query<MentorGroup>(
    `SELECT 
       id, 
       mentor_id AS "mentorId", 
       department_id AS "departmentId", 
       year, 
       semester, 
       section, 
       assignment_method AS "assignmentMethod", 
       roll_number_start AS "rollNumberStart", 
       roll_number_end AS "rollNumberEnd"
     FROM mentor_groups 
     WHERE id = $1 AND deleted_at IS NULL`,
    [groupId]
  );
  const group = groupRes.rows[0];
  if (!group) {
    throw AppError.notFound('Mentor group not found');
  }

  if (group.assignmentMethod === 'section') {
    const { rows } = await query(
      `SELECT 
         s.id, 
         s.full_name AS "name", 
         s.roll_number AS "rollNumber", 
         d.name AS "department", 
         s.semester, 
         CEIL(s.semester::numeric / 2)::integer AS "year",
         u.phone_number AS "phoneNumber",
         s.parent_contact AS "parentContact",
         u.email
       FROM students s
       JOIN users u ON s.user_id = u.id
       JOIN departments d ON s.department_id = d.id
       WHERE s.department_id = $1 AND s.semester = $2 AND s.section = $3 AND s.deleted_at IS NULL`,
      [group.departmentId, group.semester, group.section]
    );
    return rows;
  }

  if (group.assignmentMethod === 'range') {
    const { rows } = await query(
      `SELECT 
         s.id, 
         s.full_name AS "name", 
         s.roll_number AS "rollNumber", 
         d.name AS "department", 
         s.semester, 
         CEIL(s.semester::numeric / 2)::integer AS "year",
         u.phone_number AS "phoneNumber",
         s.parent_contact AS "parentContact",
         u.email
       FROM students s
       JOIN users u ON s.user_id = u.id
       JOIN departments d ON s.department_id = d.id
       WHERE s.department_id = $1 AND s.semester = $2 AND s.section = $3 
         AND s.roll_number >= $4 AND s.roll_number <= $5 AND s.deleted_at IS NULL`,
      [group.departmentId, group.semester, group.section, group.rollNumberStart, group.rollNumberEnd]
    );
    return rows;
  }

  // manual selection
  const { rows } = await query(
    `SELECT 
       s.id, 
       s.full_name AS "name", 
       s.roll_number AS "rollNumber", 
       d.name AS "department", 
       s.semester, 
       CEIL(s.semester::numeric / 2)::integer AS "year",
       u.phone_number AS "phoneNumber",
       s.parent_contact AS "parentContact",
       u.email
     FROM mentor_group_students mgs
     JOIN students s ON mgs.student_id = s.id
     JOIN users u ON s.user_id = u.id
     JOIN departments d ON s.department_id = d.id
     WHERE mgs.mentor_group_id = $1 AND mgs.deleted_at IS NULL AND s.deleted_at IS NULL`,
    [groupId]
  );
  return rows;
}
