import { query, withTransaction } from '../config/database';
import { auditLog } from '../utils/audit';
import { AppError } from '../errors/AppError';
import { createNotification } from './notification.service';
import * as mentorshipSettingsService from './mentorshipSettings.service';
import { semesterToYear, semesterToSessionLabel } from '../types/mentorGroup';
import type {
  CreateMentorGroupInput,
  UpdateMentorGroupInput,
  MentorGroup,
  ResolvedStudent,
  AssignmentMethod,
  CheckConflictsInput,
  MentorGroupConflict,
  MentorGroupConflictCheckResult,
  SuggestBalancedGroupsInput,
  BalancedGroupsResult,
  BalancedGroupProposal,
  MentorCandidate,
  SplitMentorGroupInput,
  MergeMentorGroupsInput,
} from '../types/mentorGroup';

const GROUP_COLS = `
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
  mg.updated_at AS "updatedAt"
`;

function withSession<T extends { semester: number }>(row: T): T & { academicSession: string } {
  return { ...row, academicSession: semesterToSessionLabel(row.semester) };
}

async function fetchGroupRow(id: string): Promise<MentorGroup | null> {
  const { rows } = await query<MentorGroup>(
    `SELECT ${GROUP_COLS} FROM mentor_groups mg
     JOIN faculty f ON mg.mentor_id = f.id
     JOIN departments d ON mg.department_id = d.id
     WHERE mg.id = $1 AND mg.deleted_at IS NULL`,
    [id]
  );
  return rows[0] ? withSession(rows[0]) : null;
}

// ── Shared membership resolution — replaces the 6+ duplicated OR-chain SQL
// blocks that used to live independently in mentorship.service.ts (x5) and
// middleware/mentorshipAuth.ts. One query, reused everywhere, and (fixing a
// real gap found in the pre-refactor audit) now actually filters to active
// students only. ──────────────────────────────────────────────────────────────

export interface GroupMembership {
  studentId: string;
  mentorGroupId: string;
  mentorId: string;
  groupCreatedAt: Date;
}

export async function getAllGroupMemberships(filters: { mentorId?: string; studentId?: string } = {}): Promise<GroupMembership[]> {
  const params: unknown[] = [];
  const conditions: string[] = [];
  if (filters.mentorId) {
    params.push(filters.mentorId);
    conditions.push(`mentor_id = $${params.length}`);
  }
  if (filters.studentId) {
    params.push(filters.studentId);
    conditions.push(`student_id = $${params.length}`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await query<GroupMembership>(
    `WITH memberships AS (
       SELECT s.id AS student_id, mg.id AS mentor_group_id, mg.mentor_id, mg.created_at AS group_created_at
       FROM mentor_groups mg
       JOIN students s
         ON s.department_id = mg.department_id AND s.semester = mg.semester AND s.section = mg.section
        AND s.status = 'active' AND s.deleted_at IS NULL
       WHERE mg.deleted_at IS NULL AND mg.assignment_method IN ('range', 'section')
         AND (mg.assignment_method != 'range' OR (s.roll_number >= mg.roll_number_start AND s.roll_number <= mg.roll_number_end))
       UNION ALL
       SELECT mgs.student_id, mg.id AS mentor_group_id, mg.mentor_id, mg.created_at AS group_created_at
       FROM mentor_group_students mgs
       JOIN mentor_groups mg ON mg.id = mgs.mentor_group_id AND mg.deleted_at IS NULL AND mg.assignment_method = 'manual'
       JOIN students s ON s.id = mgs.student_id AND s.status = 'active' AND s.deleted_at IS NULL
       WHERE mgs.deleted_at IS NULL
     )
     SELECT student_id AS "studentId", mentor_group_id AS "mentorGroupId", mentor_id AS "mentorId", group_created_at AS "groupCreatedAt"
     FROM memberships
     ${where}`,
    params
  );
  return rows;
}

interface GroupCriteria {
  id?: string;
  assignmentMethod: AssignmentMethod;
  departmentId: string;
  semester: number;
  section: string;
  rollNumberStart?: string | null;
  rollNumberEnd?: string | null;
}

const RESOLVED_STUDENT_COLS = `
  s.id, s.full_name AS name, s.roll_number AS "rollNumber", d.name AS department, s.semester,
  CEIL(s.semester::numeric / 2)::int AS year, u.phone_number AS "phoneNumber", s.parent_contact AS "parentContact", u.email
`;

/** Single resolver for "who is in this group" — replaces the 3 duplicated branches in the old resolveStudentsInGroup. */
async function resolveGroupMembers(group: GroupCriteria): Promise<ResolvedStudent[]> {
  if (group.assignmentMethod === 'manual') {
    if (!group.id) return [];
    const { rows } = await query<ResolvedStudent>(
      `SELECT ${RESOLVED_STUDENT_COLS}
       FROM mentor_group_students mgs
       JOIN students s ON mgs.student_id = s.id AND s.status = 'active' AND s.deleted_at IS NULL
       JOIN users u ON s.user_id = u.id
       JOIN departments d ON s.department_id = d.id
       WHERE mgs.mentor_group_id = $1 AND mgs.deleted_at IS NULL
       ORDER BY s.roll_number ASC`,
      [group.id]
    );
    return rows;
  }

  const params: unknown[] = [group.departmentId, group.semester, group.section];
  let rangeFilter = '';
  if (group.assignmentMethod === 'range') {
    params.push(group.rollNumberStart, group.rollNumberEnd);
    rangeFilter = 'AND s.roll_number >= $4 AND s.roll_number <= $5';
  }
  const { rows } = await query<ResolvedStudent>(
    `SELECT ${RESOLVED_STUDENT_COLS}
     FROM students s
     JOIN users u ON s.user_id = u.id
     JOIN departments d ON s.department_id = d.id
     WHERE s.department_id = $1 AND s.semester = $2 AND s.section = $3 AND s.status = 'active' AND s.deleted_at IS NULL ${rangeFilter}
     ORDER BY s.roll_number ASC`,
    params
  );
  return rows;
}

export async function resolveStudentsInGroup(groupId: string): Promise<ResolvedStudent[]> {
  const group = await fetchGroupRow(groupId);
  if (!group) throw AppError.notFound('Mentor group not found');
  return resolveGroupMembers({ ...group, id: groupId });
}

// ── Conflict & Capacity Engine ───────────────────────────────────────────────

export async function checkMentorGroupConflicts(input: CheckConflictsInput): Promise<MentorGroupConflictCheckResult> {
  const conflicts: MentorGroupConflict[] = [];

  const { rows: progRows } = await query<{ max_sem: number }>(
    `SELECT COALESCE(MAX(total_semesters), 0)::int AS max_sem FROM programs WHERE department_id = $1 AND is_active = TRUE AND deleted_at IS NULL`,
    [input.departmentId]
  );
  const maxSemester = progRows[0]?.max_sem ?? 0;
  if (maxSemester === 0) {
    conflicts.push({ type: 'invalid_academic_session', severity: 'error', message: 'The selected department has no active programs' });
  } else if (input.semester > maxSemester) {
    conflicts.push({
      type: 'invalid_academic_session',
      severity: 'error',
      message: `Semester ${input.semester} exceeds the maximum semester (${maxSemester}) offered by this department's programs`,
    });
  }

  let resolvedIds: string[] = [];
  if (input.assignmentMethod === 'manual') {
    resolvedIds = input.studentIds ?? [];
    if (resolvedIds.length === 0) {
      conflicts.push({ type: 'empty_group', severity: 'error', message: 'No students selected for manual assignment' });
    }
  } else if (input.assignmentMethod === 'range') {
    if (!input.rollNumberStart || !input.rollNumberEnd) {
      conflicts.push({ type: 'invalid_roll_range', severity: 'error', message: 'Both start and end roll numbers are required' });
    } else if (input.rollNumberStart > input.rollNumberEnd) {
      conflicts.push({ type: 'invalid_roll_range', severity: 'error', message: 'Start roll number must not be greater than the end roll number' });
    } else {
      const { rows } = await query<{ id: string }>(
        `SELECT id FROM students
         WHERE department_id = $1 AND semester = $2 AND section = $3 AND status = 'active' AND deleted_at IS NULL
           AND roll_number >= $4 AND roll_number <= $5`,
        [input.departmentId, input.semester, input.section, input.rollNumberStart, input.rollNumberEnd]
      );
      resolvedIds = rows.map((r) => r.id);
      if (resolvedIds.length === 0) {
        conflicts.push({ type: 'invalid_roll_range', severity: 'error', message: 'No active students were found within this roll number range' });
      }
    }
  } else {
    const { rows } = await query<{ id: string }>(
      `SELECT id FROM students WHERE department_id = $1 AND semester = $2 AND section = $3 AND status = 'active' AND deleted_at IS NULL`,
      [input.departmentId, input.semester, input.section]
    );
    resolvedIds = rows.map((r) => r.id);
    if (resolvedIds.length === 0) {
      conflicts.push({ type: 'empty_group', severity: 'error', message: 'No active students were found in this section' });
    }
  }

  const settings = await mentorshipSettingsService.getMentorshipSettings();
  if (resolvedIds.length > settings.maximumStudents) {
    conflicts.push({
      type: 'capacity_exceeded',
      severity: 'error',
      message: `Resolved group size (${resolvedIds.length}) exceeds the maximum allowed per mentor (${settings.maximumStudents}) — this is exactly why a whole section should never automatically become one mentor's group`,
    });
  } else if (resolvedIds.length > settings.recommendedStudentsPerMentor) {
    conflicts.push({
      type: 'capacity_exceeded',
      severity: 'warning',
      message: `Resolved group size (${resolvedIds.length}) exceeds the recommended size (${settings.recommendedStudentsPerMentor})`,
    });
  }

  if (resolvedIds.length > 0) {
    const memberships = await getAllGroupMemberships();
    const resolvedSet = new Set(resolvedIds);
    const dupStudentIds = new Set(
      memberships.filter((m) => resolvedSet.has(m.studentId) && m.mentorGroupId !== input.excludeGroupId).map((m) => m.studentId)
    );
    if (dupStudentIds.size > 0) {
      conflicts.push({
        type: 'duplicate_student',
        severity: 'error',
        message: `${dupStudentIds.size} student(s) already belong to another mentor group`,
        context: { studentIds: Array.from(dupStudentIds) },
      });
    }
  }

  const dupMentorParams: unknown[] = [input.mentorId, input.departmentId, input.semester, input.section];
  let dupMentorExclusion = '';
  if (input.excludeGroupId) {
    dupMentorParams.push(input.excludeGroupId);
    dupMentorExclusion = `AND id != $${dupMentorParams.length}`;
  }
  const { rows: dupMentorRows } = await query<{ id: string }>(
    `SELECT id FROM mentor_groups WHERE mentor_id = $1 AND department_id = $2 AND semester = $3 AND section = $4 AND deleted_at IS NULL ${dupMentorExclusion}`,
    dupMentorParams
  );
  if (dupMentorRows.length > 0) {
    conflicts.push({
      type: 'duplicate_mentor_assignment',
      severity: 'error',
      message: 'This mentor already has an active group for the same department, academic session and section',
      context: { existingGroupId: dupMentorRows[0].id },
    });
  }

  const hasBlockingConflicts = conflicts.some((c) => c.severity === 'error');
  return { hasBlockingConflicts, conflicts, resolvedCount: resolvedIds.length };
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

async function notifyGroupParticipants(group: MentorGroup, action: 'created' | 'updated' | 'split' | 'merged', actorId: string, actorRole: 'admin' | 'faculty'): Promise<void> {
  const { rows: mentorRows } = await query<{ user_id: string }>('SELECT user_id FROM faculty WHERE id = $1', [group.mentorId]);
  if (mentorRows[0]) {
    await createNotification(actorId, actorRole, {
      title: `Mentor Group ${action === 'created' ? 'Assigned' : 'Updated'}`,
      message: `You have been assigned as mentor for ${group.departmentName} — Session ${group.academicSession}, Section ${group.section}.`,
      type: 'Academic Alert',
      targetRole: 'faculty',
      recipientUserId: mentorRows[0].user_id,
      isImportant: false,
    });
  }

  const members = await resolveStudentsInGroup(group.id);
  for (const student of members) {
    const { rows: studentUserRows } = await query<{ user_id: string }>('SELECT user_id FROM students WHERE id = $1', [student.id]);
    if (!studentUserRows[0]) continue;
    await createNotification(actorId, actorRole, {
      title: 'Mentor Assigned',
      message: `${group.mentorName ?? 'Your mentor'} has been assigned as your mentor.`,
      type: 'Academic Alert',
      targetRole: 'student',
      recipientUserId: studentUserRows[0].user_id,
      isImportant: false,
    });
  }

  const { rows: hodRows } = await query<{ user_id: string }>(
    `SELECT user_id FROM faculty WHERE department_id = $1 AND designation = 'hod' AND deleted_at IS NULL LIMIT 1`,
    [group.departmentId]
  );
  if (hodRows[0] && hodRows[0].user_id !== actorId) {
    await createNotification(actorId, actorRole, {
      title: `Mentor Group ${action === 'created' ? 'Created' : action === 'merged' ? 'Merged' : action === 'split' ? 'Split' : 'Updated'}`,
      message: `A mentor group in ${group.departmentName} (Session ${group.academicSession}, Section ${group.section}) was ${action}.`,
      type: 'Academic Alert',
      targetRole: 'faculty',
      recipientUserId: hodRows[0].user_id,
      isImportant: false,
    });
  }
}

export async function createMentorGroup(data: CreateMentorGroupInput, createdBy: string, actorRole: 'admin' | 'faculty'): Promise<MentorGroup> {
  const mentorCheck = await query('SELECT id FROM faculty WHERE id = $1 AND deleted_at IS NULL', [data.mentorId]);
  if (mentorCheck.rowCount === 0) throw AppError.notFound('Faculty mentor not found');

  const deptCheck = await query('SELECT id FROM departments WHERE id = $1', [data.departmentId]);
  if (deptCheck.rowCount === 0) throw AppError.notFound('Department not found');

  const conflictResult = await checkMentorGroupConflicts({
    mentorId: data.mentorId,
    departmentId: data.departmentId,
    semester: data.semester,
    section: data.section,
    assignmentMethod: data.assignmentMethod,
    rollNumberStart: data.rollNumberStart,
    rollNumberEnd: data.rollNumberEnd,
    studentIds: data.studentIds,
  });
  if (conflictResult.hasBlockingConflicts) {
    throw AppError.badRequest(
      `Cannot create mentor group: ${conflictResult.conflicts.filter((c) => c.severity === 'error').map((c) => c.message).join('; ')}`,
      'MENTOR_GROUP_CONFLICT'
    );
  }

  const year = semesterToYear(data.semester);

  const groupId = await withTransaction(async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO mentor_groups (mentor_id, department_id, year, semester, section, assignment_method, roll_number_start, roll_number_end, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [data.mentorId, data.departmentId, year, data.semester, data.section, data.assignmentMethod, data.rollNumberStart || null, data.rollNumberEnd || null, createdBy]
    );
    const id = rows[0].id;

    if (data.assignmentMethod === 'manual' && data.studentIds && data.studentIds.length > 0) {
      for (const studentId of data.studentIds) {
        await client.query(`INSERT INTO mentor_group_students (mentor_group_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [id, studentId]);
      }
    }
    return id;
  });

  await auditLog({ actorId: createdBy, action: 'CREATE', resource: 'mentor_group', resourceId: groupId, changes: { to: data } });

  const group = await fetchGroupRow(groupId);
  await notifyGroupParticipants(group!, 'created', createdBy, actorRole);

  return group!;
}

export async function getMentorGroups(filters: {
  mentorId?: string;
  departmentId?: string;
  semester?: number;
  section?: string;
  assignmentMethod?: string;
}): Promise<MentorGroup[]> {
  const params: unknown[] = [];
  const conditions: string[] = ['mg.deleted_at IS NULL', 'f.deleted_at IS NULL'];
  const push = (cond: string, val: unknown) => {
    params.push(val);
    conditions.push(`${cond} $${params.length}`);
  };

  if (filters.mentorId) push('mg.mentor_id =', filters.mentorId);
  if (filters.departmentId && filters.departmentId !== 'ALL') push('mg.department_id =', filters.departmentId);
  if (filters.semester) push('mg.semester =', filters.semester);
  if (filters.section && filters.section !== 'ALL') push('mg.section =', filters.section);
  if (filters.assignmentMethod && filters.assignmentMethod !== 'ALL') push('mg.assignment_method =', filters.assignmentMethod);

  const { rows } = await query<MentorGroup>(
    `SELECT ${GROUP_COLS} FROM mentor_groups mg
     JOIN faculty f ON mg.mentor_id = f.id
     JOIN departments d ON mg.department_id = d.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY mg.created_at DESC`,
    params
  );

  const memberships = await getAllGroupMemberships();
  const countByGroup = new Map<string, number>();
  for (const m of memberships) countByGroup.set(m.mentorGroupId, (countByGroup.get(m.mentorGroupId) ?? 0) + 1);

  return rows.map((r) => withSession({ ...r, studentCount: countByGroup.get(r.id) ?? 0 }));
}

export async function updateMentorGroup(id: string, data: UpdateMentorGroupInput, actorId: string, actorRole: 'admin' | 'faculty'): Promise<MentorGroup> {
  const existing = await fetchGroupRow(id);
  if (!existing) throw AppError.notFound('Mentor group not found');

  const merged = {
    mentorId: data.mentorId ?? existing.mentorId,
    departmentId: data.departmentId ?? existing.departmentId,
    semester: data.semester ?? existing.semester,
    section: data.section ?? existing.section,
    assignmentMethod: data.assignmentMethod ?? existing.assignmentMethod,
    rollNumberStart: 'rollNumberStart' in data ? data.rollNumberStart : existing.rollNumberStart,
    rollNumberEnd: 'rollNumberEnd' in data ? data.rollNumberEnd : existing.rollNumberEnd,
    studentIds: data.studentIds,
  };

  const conflictResult = await checkMentorGroupConflicts({ ...merged, excludeGroupId: id });
  if (conflictResult.hasBlockingConflicts) {
    throw AppError.badRequest(
      `Cannot update mentor group: ${conflictResult.conflicts.filter((c) => c.severity === 'error').map((c) => c.message).join('; ')}`,
      'MENTOR_GROUP_CONFLICT'
    );
  }

  await withTransaction(async (client) => {
    const sets: string[] = [];
    const params: unknown[] = [id];
    const push = (col: string, val: unknown) => {
      params.push(val);
      sets.push(`${col} = $${params.length}`);
    };

    if (data.mentorId !== undefined) push('mentor_id', data.mentorId);
    if (data.departmentId !== undefined) push('department_id', data.departmentId);
    if (data.semester !== undefined) {
      push('semester', data.semester);
      push('year', semesterToYear(data.semester));
    }
    if (data.section !== undefined) push('section', data.section);
    if (data.assignmentMethod !== undefined) push('assignment_method', data.assignmentMethod);
    if (data.rollNumberStart !== undefined) push('roll_number_start', data.rollNumberStart);
    if (data.rollNumberEnd !== undefined) push('roll_number_end', data.rollNumberEnd);

    if (sets.length > 0) {
      await client.query(`UPDATE mentor_groups SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL`, params);
    }

    if (data.studentIds !== undefined) {
      await client.query('DELETE FROM mentor_group_students WHERE mentor_group_id = $1', [id]);
      for (const studentId of data.studentIds) {
        await client.query(`INSERT INTO mentor_group_students (mentor_group_id, student_id) VALUES ($1, $2)`, [id, studentId]);
      }
    }
  });

  await auditLog({ actorId, action: 'UPDATE', resource: 'mentor_group', resourceId: id, changes: { from: existing, to: data } });

  const group = await fetchGroupRow(id);
  await notifyGroupParticipants(group!, 'updated', actorId, actorRole);

  return group!;
}

export async function deleteMentorGroup(id: string, actorId: string): Promise<void> {
  const existing = await fetchGroupRow(id);
  if (!existing) throw AppError.notFound('Mentor group not found');

  const result = await query(`UPDATE mentor_groups SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`, [id]);
  if (result.rowCount === 0) throw AppError.notFound('Mentor group not found');

  await auditLog({ actorId, action: 'DELETE', resource: 'mentor_group', resourceId: id, changes: { from: existing } });
}

// ── Auto Suggestion Engine ───────────────────────────────────────────────────

export async function suggestBalancedGroups(input: SuggestBalancedGroupsInput): Promise<BalancedGroupsResult> {
  const settings = await mentorshipSettingsService.getMentorshipSettings();
  const targetSize = input.targetSize ?? settings.recommendedStudentsPerMentor;

  const { rows } = await query<{ id: string; roll_number: string }>(
    `SELECT id, roll_number FROM students
     WHERE department_id = $1 AND semester = $2 AND section = $3 AND status = 'active' AND deleted_at IS NULL
     ORDER BY roll_number ASC`,
    [input.departmentId, input.semester, input.section]
  );

  const proposals: BalancedGroupProposal[] = [];
  for (let i = 0; i < rows.length; i += targetSize) {
    const chunk = rows.slice(i, i + targetSize);
    proposals.push({
      rollNumberStart: chunk[0].roll_number,
      rollNumberEnd: chunk[chunk.length - 1].roll_number,
      studentCount: chunk.length,
      studentIds: chunk.map((s) => s.id),
    });
  }

  return { section: input.section, totalStudents: rows.length, targetSize, proposals };
}

// ── Faculty (mentor) synchronization — capacity-aware candidate listing ─────

export async function listMentorCandidates(departmentId: string): Promise<MentorCandidate[]> {
  const settings = await mentorshipSettingsService.getMentorshipSettings();
  const params: unknown[] = [];
  let deptFilter = '';
  if (!settings.allowCrossDepartment) {
    params.push(departmentId);
    deptFilter = 'AND f.department_id = $1';
  }

  const { rows } = await query<{
    facultyId: string; facultyName: string; employeeNumber: string; departmentId: string; departmentName: string;
    isMentoringHead: boolean; status: string; currentGroups: number;
  }>(
    `SELECT f.id AS "facultyId", f.full_name AS "facultyName", f.employee_number AS "employeeNumber",
       f.department_id AS "departmentId", d.name AS "departmentName", f.is_mentoring_head AS "isMentoringHead",
       f.status::text AS status, COUNT(DISTINCT mg.id)::int AS "currentGroups"
     FROM faculty f
     JOIN departments d ON d.id = f.department_id
     LEFT JOIN mentor_groups mg ON mg.mentor_id = f.id AND mg.deleted_at IS NULL
     WHERE f.deleted_at IS NULL AND f.status NOT IN ('resigned', 'retired', 'on_leave') ${deptFilter}
     GROUP BY f.id, f.full_name, f.employee_number, f.department_id, d.name, f.is_mentoring_head, f.status
     ORDER BY "currentGroups" ASC, f.full_name ASC`,
    params
  );

  const allMemberships = await getAllGroupMemberships();
  const studentsByMentor = new Map<string, Set<string>>();
  for (const m of allMemberships) {
    if (!studentsByMentor.has(m.mentorId)) studentsByMentor.set(m.mentorId, new Set());
    studentsByMentor.get(m.mentorId)!.add(m.studentId);
  }

  return rows.map((r) => {
    const currentStudents = studentsByMentor.get(r.facultyId)?.size ?? 0;
    return {
      ...r,
      currentStudents,
      availableCapacity: Math.max(0, settings.maximumStudents - currentStudents),
      overLimit: currentStudents > settings.maximumStudents,
    };
  });
}

// ── Split / Merge ─────────────────────────────────────────────────────────────

export async function splitMentorGroup(groupId: string, data: SplitMentorGroupInput, actorId: string, actorRole: 'admin' | 'faculty'): Promise<{ original: MentorGroup; created: MentorGroup }> {
  const group = await fetchGroupRow(groupId);
  if (!group) throw AppError.notFound('Mentor group not found');
  if (group.assignmentMethod === 'manual') {
    throw AppError.badRequest('Manually-assembled groups cannot be split by roll number — remove students individually instead', 'SPLIT_NOT_SUPPORTED');
  }

  const members = await resolveGroupMembers({ ...group, id: groupId });
  const splitIndex = members.findIndex((m) => m.rollNumber >= data.splitAtRollNumber);
  if (splitIndex <= 0 || splitIndex >= members.length) {
    throw AppError.badRequest('Split roll number must fall strictly between the group\'s first and last roll numbers', 'INVALID_SPLIT_POINT');
  }

  const originalMembers = members.slice(0, splitIndex);
  const newMembers = members.slice(splitIndex);

  const mentorCheck = await query('SELECT id FROM faculty WHERE id = $1 AND deleted_at IS NULL', [data.newMentorId]);
  if (mentorCheck.rowCount === 0) throw AppError.notFound('New mentor faculty not found');

  const conflictResult = await checkMentorGroupConflicts({
    mentorId: data.newMentorId,
    departmentId: group.departmentId,
    semester: group.semester,
    section: group.section,
    assignmentMethod: 'range',
    rollNumberStart: newMembers[0].rollNumber,
    rollNumberEnd: newMembers[newMembers.length - 1].rollNumber,
    // The new range is being carved out of `group` itself — its current
    // (pre-shrink) membership must not be treated as a duplicate conflict.
    excludeGroupId: groupId,
  });
  if (conflictResult.hasBlockingConflicts) {
    throw AppError.badRequest(
      `Cannot split group: ${conflictResult.conflicts.filter((c) => c.severity === 'error').map((c) => c.message).join('; ')}`,
      'MENTOR_GROUP_CONFLICT'
    );
  }

  const newGroupId = await withTransaction(async (client) => {
    await client.query(
      `UPDATE mentor_groups SET assignment_method = 'range', roll_number_start = $1, roll_number_end = $2, updated_at = NOW() WHERE id = $3`,
      [originalMembers[0].rollNumber, originalMembers[originalMembers.length - 1].rollNumber, groupId]
    );
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO mentor_groups (mentor_id, department_id, year, semester, section, assignment_method, roll_number_start, roll_number_end, created_by)
       VALUES ($1, $2, $3, $4, $5, 'range', $6, $7, $8) RETURNING id`,
      [
        data.newMentorId,
        group.departmentId,
        semesterToYear(group.semester),
        group.semester,
        group.section,
        newMembers[0].rollNumber,
        newMembers[newMembers.length - 1].rollNumber,
        actorId,
      ]
    );
    return rows[0].id;
  });

  await auditLog({
    actorId,
    action: 'SPLIT',
    resource: 'mentor_group',
    resourceId: groupId,
    changes: {
      from: { rollNumberStart: group.rollNumberStart, rollNumberEnd: group.rollNumberEnd },
      to: { originalGroupId: groupId, newGroupId, splitAtRollNumber: data.splitAtRollNumber },
    },
  });

  const [original, created] = await Promise.all([fetchGroupRow(groupId), fetchGroupRow(newGroupId)]);
  await Promise.all([
    notifyGroupParticipants(original!, 'split', actorId, actorRole),
    notifyGroupParticipants(created!, 'split', actorId, actorRole),
  ]);

  return { original: original!, created: created! };
}

export async function mergeMentorGroups(data: MergeMentorGroupsInput, actorId: string, actorRole: 'admin' | 'faculty'): Promise<MentorGroup> {
  const [a, b] = await Promise.all([fetchGroupRow(data.groupIdA), fetchGroupRow(data.groupIdB)]);
  if (!a || !b) throw AppError.notFound('One or both mentor groups were not found');
  if (a.departmentId !== b.departmentId || a.semester !== b.semester || a.section !== b.section) {
    throw AppError.badRequest('Groups must belong to the same department, academic session and section to merge', 'MERGE_SCOPE_MISMATCH');
  }
  if (a.assignmentMethod !== b.assignmentMethod || (a.assignmentMethod !== 'range' && a.assignmentMethod !== 'manual')) {
    throw AppError.badRequest('Only two range-based or two manual-based groups can be merged into one', 'MERGE_METHOD_MISMATCH');
  }

  await withTransaction(async (client) => {
    if (a.assignmentMethod === 'range') {
      const start = [a.rollNumberStart, b.rollNumberStart].sort()[0]!;
      const end = [a.rollNumberEnd, b.rollNumberEnd].sort().reverse()[0]!;
      await client.query(`UPDATE mentor_groups SET roll_number_start = $1, roll_number_end = $2, updated_at = NOW() WHERE id = $3`, [start, end, a.id]);
    } else {
      await client.query(
        `INSERT INTO mentor_group_students (mentor_group_id, student_id)
         SELECT $1, student_id FROM mentor_group_students WHERE mentor_group_id = $2 AND deleted_at IS NULL
         ON CONFLICT DO NOTHING`,
        [a.id, b.id]
      );
    }
    await client.query(`UPDATE mentor_groups SET deleted_at = NOW() WHERE id = $1`, [b.id]);
  });

  await auditLog({
    actorId,
    action: 'MERGE',
    resource: 'mentor_group',
    resourceId: a.id,
    changes: { from: { groupIdA: a.id, groupIdB: b.id }, to: { survivingGroupId: a.id } },
  });

  const merged = await fetchGroupRow(a.id);
  await notifyGroupParticipants(merged!, 'merged', actorId, actorRole);

  return merged!;
}
