import { query, withTransaction } from '../config/database';
import { AppError } from '../errors/AppError';
import { auditLog } from '../utils/audit';
import { listFacultyAvailability, overlaps } from './resourceAvailability.service';
import type { Role } from '../types/roles';
import type {
  InvigilationDuty,
  InvigilationDutyExamCoverage,
  GenerateInvigilationInput,
  UpdateInvigilationDutyInput,
  ListInvigilationQuery,
  PaginatedInvigilationDuties,
} from '../types/examSeating';

interface SchedulingScope {
  departmentId: string | null;
}

async function resolveSchedulingScope(userId: string, role: Role): Promise<SchedulingScope> {
  if (role === 'admin') return { departmentId: null };

  if (role === 'faculty') {
    const { rows } = await query<{ department_id: string; designation: string | null }>(
      'SELECT department_id, designation FROM faculty WHERE user_id = $1 AND deleted_at IS NULL',
      [userId]
    );
    if (!rows[0]) throw AppError.forbidden('No faculty profile is linked to this account');
    if (rows[0].designation !== 'hod') throw AppError.forbidden('Only admins and HODs can manage exam invigilation');
    return { departmentId: rows[0].department_id };
  }

  throw AppError.forbidden('You do not have access to exam invigilation management');
}

// ── Generation ─────────────────────────────────────────────────────────────────
// Load-balanced, deterministic round-robin over faculty ordered by their
// existing (non-cancelled) duty count — not ML/AI, just "give it to whoever
// has done the fewest so far," excluding conflicts of interest and time clashes.

export async function generateInvigilationDuties(
  userId: string,
  role: Role,
  data: GenerateInvigilationInput
): Promise<InvigilationDuty[]> {
  const scope = await resolveSchedulingScope(userId, role);

  const { rows: examRows } = await query<{
    id: string;
    exam_date: string;
    start_time: string;
    end_time: string;
    faculty_id: string;
    department_id: string;
    subject_code: string;
    exam_type: string;
  }>(
    `SELECT e.id, TO_CHAR(e.exam_date, 'YYYY-MM-DD') AS exam_date, e.start_time::text, e.end_time::text,
       e.faculty_id, sub.department_id, sub.code AS subject_code, e.exam_type::text AS exam_type
     FROM exams e JOIN subjects sub ON sub.id = e.subject_id
     WHERE e.id = ANY($1::uuid[]) AND e.deleted_at IS NULL`,
    [data.examIds]
  );
  if (examRows.length !== data.examIds.length) throw AppError.notFound('One or more exams were not found');

  const [first, ...rest] = examRows;
  if (rest.some((e) => e.exam_date !== first.exam_date || e.start_time !== first.start_time || e.end_time !== first.end_time)) {
    throw AppError.badRequest('All exams must share the same date and time slot', 'MIXED_SLOT');
  }
  if (scope.departmentId && examRows.some((e) => e.department_id !== scope.departmentId)) {
    throw AppError.forbidden('You can only manage invigilation for exams within your own department');
  }

  const { rows: roomRows } = await query<{ room_id: string; room_name: string }>(
    `SELECT DISTINCT esa.room_id, er.name AS room_name
     FROM exam_seat_allocations esa JOIN exam_rooms er ON er.id = esa.room_id
     WHERE esa.exam_id = ANY($1::uuid[]) AND esa.deleted_at IS NULL
     ORDER BY er.name ASC`,
    [data.examIds]
  );
  if (roomRows.length === 0) {
    throw AppError.badRequest('Generate seating for these exams before assigning invigilators', 'SEATING_REQUIRED');
  }

  const conductingFacultyIds = new Set(examRows.map((e) => e.faculty_id));
  const eligibleDeptId = data.departmentId ?? scope.departmentId ?? first.department_id;

  const { rows: candidateRows } = await query<{ id: string; full_name: string }>(
    `SELECT id, full_name FROM faculty WHERE department_id = $1 AND status = 'active' AND deleted_at IS NULL`,
    [eligibleDeptId]
  );
  const eligibleFaculty = candidateRows.filter((f) => !conductingFacultyIds.has(f.id));
  if (eligibleFaculty.length === 0) {
    throw AppError.badRequest('No eligible faculty available (all are conducting these exams)', 'NO_ELIGIBLE_FACULTY');
  }

  const eligibleIds = eligibleFaculty.map((f) => f.id);
  const { rows: loadRows } = await query<{ faculty_id: string; count: string }>(
    `SELECT faculty_id, COUNT(*)::text AS count FROM exam_invigilation_duties
     WHERE faculty_id = ANY($1::uuid[]) AND status != 'Cancelled' AND deleted_at IS NULL
     GROUP BY faculty_id`,
    [eligibleIds]
  );
  const loadMap = new Map<string, number>(eligibleFaculty.map((f) => [f.id, 0]));
  for (const r of loadRows) loadMap.set(r.faculty_id, Number(r.count));

  // Resource Availability Engine check — excludes the rooms/slot being
  // (re)generated right now (those existing duties are about to be superseded,
  // not a real scheduling conflict) and also now factors in on-leave status and
  // calendar reservations, not just other exam/invigilation duties.
  const roomIdsForSlot = roomRows.map((r) => r.room_id);
  const availability = await listFacultyAvailability(eligibleIds, first.exam_date, first.start_time, first.end_time, {
    excludeRoomIds: roomIdsForSlot,
  });
  const busySet = new Set(availability.filter((a) => a.state === 'unavailable').map((a) => a.facultyId));

  const pool = data.allowOverride ? eligibleFaculty : eligibleFaculty.filter((f) => !busySet.has(f.id));
  const totalNeeded = roomRows.length * data.invigilatorsPerRoom;
  if (pool.length < totalNeeded) {
    throw AppError.badRequest(
      `Not enough eligible faculty: need ${totalNeeded}, only ${pool.length} available (excluding conducting/already-busy faculty)`,
      'INSUFFICIENT_FACULTY'
    );
  }

  const usedInThisSlot = new Set<string>();
  const assignments: Array<{ roomId: string; roomName: string; facultyId: string; facultyName: string }> = [];

  for (const room of roomRows) {
    for (let i = 0; i < data.invigilatorsPerRoom; i++) {
      const candidate = pool
        .filter((f) => !usedInThisSlot.has(f.id))
        .sort((a, b) => (loadMap.get(a.id) ?? 0) - (loadMap.get(b.id) ?? 0))[0];
      if (!candidate) throw AppError.badRequest('Ran out of eligible faculty while assigning invigilators', 'INSUFFICIENT_FACULTY');
      usedInThisSlot.add(candidate.id);
      loadMap.set(candidate.id, (loadMap.get(candidate.id) ?? 0) + 1);
      assignments.push({ roomId: room.room_id, roomName: room.room_name, facultyId: candidate.id, facultyName: candidate.full_name });
    }
  }

  const roomIds = roomRows.map((r) => r.room_id);

  const insertedIds = await withTransaction(async (client) => {
    const { rows: staleDuties } = await client.query<{ id: string }>(
      `SELECT id FROM exam_invigilation_duties
       WHERE room_id = ANY($1::uuid[]) AND duty_date = $2 AND start_time = $3 AND end_time = $4 AND deleted_at IS NULL`,
      [roomIds, first.exam_date, first.start_time, first.end_time]
    );
    if (staleDuties.length > 0) {
      const staleIds = staleDuties.map((d) => d.id);
      await client.query(
        `UPDATE calendar_entries SET deleted_at = NOW() WHERE source_module = 'exam_invigilation' AND source_id = ANY($1::uuid[])`,
        [staleIds]
      );
      await client.query(`UPDATE exam_invigilation_duties SET deleted_at = NOW() WHERE id = ANY($1::uuid[])`, [staleIds]);
    }

    const ids: string[] = [];
    for (const a of assignments) {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO exam_invigilation_duties (room_id, faculty_id, duty_date, start_time, end_time, assigned_by)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [a.roomId, a.facultyId, first.exam_date, first.start_time, first.end_time, userId]
      );
      ids.push(rows[0].id);
    }
    return ids;
  });

  // Personal calendar sync — one entry per assigned faculty, visible only to them.
  for (let i = 0; i < assignments.length; i++) {
    const a = assignments[i];
    const { rows: facUser } = await query<{ user_id: string }>('SELECT user_id FROM faculty WHERE id = $1', [a.facultyId]);
    if (!facUser[0]) continue;
    await query(
      `INSERT INTO calendar_entries
         (title, description, event_type, start_date, visibility, source_module, source_id, department_id, created_by)
       VALUES ($1, $2, 'Meeting', $3, 'personal', 'exam_invigilation', $4, $5, $6)`,
      [
        `Invigilation Duty: ${a.roomName}`,
        `Invigilate exams in ${a.roomName} on ${first.exam_date}`,
        `${first.exam_date}T${first.start_time}`,
        insertedIds[i],
        eligibleDeptId,
        facUser[0].user_id,
      ]
    );
  }

  await auditLog({
    actorId: userId,
    action: 'CREATE',
    resource: 'invigilation_duty',
    resourceId: roomIds[0],
    changes: { examIds: data.examIds, assignments: assignments.map((a) => ({ roomId: a.roomId, facultyId: a.facultyId })) },
  });
  const overriddenAssignments = assignments.filter((a) => busySet.has(a.facultyId));
  if (overriddenAssignments.length > 0) {
    await auditLog({
      actorId: userId,
      action: 'OVERRIDE',
      resource: 'invigilation_duty',
      resourceId: roomIds[0],
      changes: { overriddenFaculty: overriddenAssignments.map((a) => ({ facultyId: a.facultyId, facultyName: a.facultyName, roomId: a.roomId })) },
    });
  }

  return getDutiesByRoomsAndSlot(roomIds, first.exam_date, first.start_time, first.end_time);
}

// ── Read paths ─────────────────────────────────────────────────────────────────

async function fetchExamCoverage(roomId: string, dutyDate: string, startTime: string, endTime: string): Promise<InvigilationDutyExamCoverage[]> {
  const { rows } = await query<{ exam_id: string; subject_code: string; exam_type: string }>(
    `SELECT DISTINCT e.id AS exam_id, sub.code AS subject_code, e.exam_type::text AS exam_type
     FROM exam_seat_allocations esa
     JOIN exams e ON e.id = esa.exam_id
     JOIN subjects sub ON sub.id = e.subject_id
     WHERE esa.room_id = $1 AND esa.deleted_at IS NULL
       AND e.exam_date = $2 AND e.start_time::text = $3 AND e.end_time::text = $4 AND e.deleted_at IS NULL`,
    [roomId, dutyDate, startTime, endTime]
  );
  return rows.map((r) => ({ examId: r.exam_id, subjectCode: r.subject_code, examType: r.exam_type }));
}

async function getDutiesByRoomsAndSlot(roomIds: string[], dutyDate: string, startTime: string, endTime: string): Promise<InvigilationDuty[]> {
  const { rows } = await query<{
    id: string;
    room_id: string;
    room_name: string;
    faculty_id: string;
    faculty_name: string;
    duty_date: string;
    start_time: string;
    end_time: string;
    status: string;
    assigned_by: string;
  }>(
    `SELECT eid.id, eid.room_id, er.name AS room_name, eid.faculty_id, f.full_name AS faculty_name,
       TO_CHAR(eid.duty_date, 'YYYY-MM-DD') AS duty_date, eid.start_time::text, eid.end_time::text,
       eid.status::text AS status, eid.assigned_by
     FROM exam_invigilation_duties eid
     JOIN exam_rooms er ON er.id = eid.room_id
     JOIN faculty f ON f.id = eid.faculty_id
     WHERE eid.room_id = ANY($1::uuid[]) AND eid.duty_date = $2 AND eid.start_time::text = $3 AND eid.end_time::text = $4
       AND eid.deleted_at IS NULL
     ORDER BY er.name ASC`,
    [roomIds, dutyDate, startTime, endTime]
  );

  return Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      roomId: r.room_id,
      roomName: r.room_name,
      facultyId: r.faculty_id,
      facultyName: r.faculty_name,
      dutyDate: r.duty_date,
      startTime: r.start_time,
      endTime: r.end_time,
      status: r.status as InvigilationDuty['status'],
      assignedBy: r.assigned_by,
      exams: await fetchExamCoverage(r.room_id, dutyDate, r.start_time, r.end_time),
    }))
  );
}

export async function listInvigilationDuties(
  userId: string,
  role: Role,
  filters: ListInvigilationQuery
): Promise<PaginatedInvigilationDuties> {
  const conditions: string[] = ['eid.deleted_at IS NULL'];
  const params: unknown[] = [];
  const push = (cond: string, val: unknown) => {
    params.push(val);
    conditions.push(`${cond} $${params.length}`);
  };

  if (role === 'faculty') {
    const { rows } = await query<{ id: string; department_id: string; designation: string | null }>(
      'SELECT id, department_id, designation FROM faculty WHERE user_id = $1 AND deleted_at IS NULL',
      [userId]
    );
    if (!rows[0]) throw AppError.forbidden('No faculty profile is linked to this account');
    if (rows[0].designation === 'hod') {
      params.push(rows[0].department_id);
      conditions.push(`eid.faculty_id IN (SELECT id FROM faculty WHERE department_id = $${params.length} AND deleted_at IS NULL)`);
    } else {
      push('eid.faculty_id =', rows[0].id);
    }
  } else if (role !== 'admin') {
    throw AppError.forbidden('You do not have access to invigilation duties');
  } else if (filters.facultyId) {
    push('eid.faculty_id =', filters.facultyId);
  }

  if (filters.roomId) push('eid.room_id =', filters.roomId);
  if (filters.status) push('eid.status =', filters.status);
  if (filters.from) push('eid.duty_date >=', filters.from);
  if (filters.to) push('eid.duty_date <=', filters.to);

  params.push(filters.limit, (filters.page - 1) * filters.limit);
  const limitN = params.length - 1;
  const offsetN = params.length;

  const { rows } = await query<{
    id: string;
    room_id: string;
    room_name: string;
    faculty_id: string;
    faculty_name: string;
    duty_date: string;
    start_time: string;
    end_time: string;
    status: string;
    assigned_by: string;
    total_count: string;
  }>(
    `SELECT eid.id, eid.room_id, er.name AS room_name, eid.faculty_id, f.full_name AS faculty_name,
       TO_CHAR(eid.duty_date, 'YYYY-MM-DD') AS duty_date, eid.start_time::text, eid.end_time::text,
       eid.status::text AS status, eid.assigned_by,
       COUNT(*) OVER()::text AS total_count
     FROM exam_invigilation_duties eid
     JOIN exam_rooms er ON er.id = eid.room_id
     JOIN faculty f ON f.id = eid.faculty_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY eid.duty_date ASC, eid.start_time ASC, er.name ASC
     LIMIT $${limitN} OFFSET $${offsetN}`,
    params
  );

  const total = rows[0] ? Number(rows[0].total_count) : 0;
  const duties = await Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      roomId: r.room_id,
      roomName: r.room_name,
      facultyId: r.faculty_id,
      facultyName: r.faculty_name,
      dutyDate: r.duty_date,
      startTime: r.start_time,
      endTime: r.end_time,
      status: r.status as InvigilationDuty['status'],
      assignedBy: r.assigned_by,
      exams: await fetchExamCoverage(r.room_id, r.duty_date, r.start_time, r.end_time),
    }))
  );

  return { duties, total, page: filters.page, limit: filters.limit, totalPages: Math.ceil(total / filters.limit) };
}

export async function updateInvigilationDuty(
  userId: string,
  role: Role,
  id: string,
  data: UpdateInvigilationDutyInput
): Promise<InvigilationDuty> {
  await resolveSchedulingScope(userId, role);

  const { rows: existing } = await query<{ room_id: string; duty_date: string; start_time: string; end_time: string; faculty_id: string; status: string }>(
    `SELECT room_id, TO_CHAR(duty_date, 'YYYY-MM-DD') AS duty_date, start_time::text, end_time::text, faculty_id, status::text AS status
     FROM exam_invigilation_duties WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  if (!existing[0]) throw AppError.notFound('Invigilation duty not found');

  // Manual reassignment must be re-validated the same way generation is: the new
  // faculty must not already be conducting an exam in this room/slot, nor be busy
  // with another (non-cancelled) duty that overlaps this slot elsewhere.
  if (data.facultyId !== undefined) {
    const { rows: conducting } = await query<{ id: string }>(
      `SELECT 1 FROM exam_seat_allocations esa
       JOIN exams e ON e.id = esa.exam_id
       WHERE esa.room_id = $1 AND e.faculty_id = $2 AND e.exam_date::text = $3
         AND e.start_time::text = $4 AND e.end_time::text = $5 AND esa.deleted_at IS NULL AND e.deleted_at IS NULL
       LIMIT 1`,
      [existing[0].room_id, data.facultyId, existing[0].duty_date, existing[0].start_time, existing[0].end_time]
    );
    if (conducting[0]) {
      throw AppError.badRequest('This faculty is conducting an exam in this room/slot and cannot also invigilate it', 'CONDUCTING_CONFLICT');
    }

    const { rows: busyRows } = await query<{ start_time: string; end_time: string }>(
      `SELECT start_time::text, end_time::text FROM exam_invigilation_duties
       WHERE faculty_id = $1 AND duty_date = $2 AND status != 'Cancelled' AND deleted_at IS NULL AND id != $3`,
      [data.facultyId, existing[0].duty_date, id]
    );
    const isBusy = busyRows.some((b) => overlaps(b.start_time, b.end_time, existing[0].start_time, existing[0].end_time));
    if (isBusy) {
      throw AppError.badRequest('This faculty already has an overlapping invigilation duty', 'FACULTY_BUSY');
    }
  }

  const sets: string[] = [];
  const params: unknown[] = [];
  const push = (col: string, val: unknown) => {
    params.push(val);
    sets.push(`${col} = $${params.length}`);
  };
  if (data.facultyId !== undefined) push('faculty_id', data.facultyId);
  if (data.status !== undefined) push('status', data.status);
  if (sets.length === 0) throw AppError.badRequest('No fields to update');

  params.push(id);
  await query(`UPDATE exam_invigilation_duties SET ${sets.join(', ')} WHERE id = $${params.length}`, params);

  await auditLog({
    actorId: userId,
    action: 'UPDATE',
    resource: 'invigilation_duty',
    resourceId: id,
    changes: {
      from: { facultyId: existing[0].faculty_id, status: existing[0].status },
      to: { facultyId: data.facultyId ?? existing[0].faculty_id, status: data.status ?? existing[0].status },
    },
  });

  const [updated] = await getDutiesByRoomsAndSlot(
    [existing[0].room_id],
    existing[0].duty_date,
    existing[0].start_time,
    existing[0].end_time
  );
  return updated;
}
