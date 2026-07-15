import { query, withTransaction } from '../config/database';
import { AppError } from '../errors/AppError';
import { auditLog } from '../utils/audit';
import { createNotification } from './notification.service';
import { getSeatingPatternById, applySeatingPattern, type PatternableStudent } from './seatingPattern.service';
import { listRoomsWithAvailability } from './resourceAvailability.service';
import type { Role } from '../types/roles';
import type {
  ExamSlotSummary,
  SeatAllocation,
  RoomSeatingChart,
  SeatingGenerationResult,
  GenerateSeatingInput,
  ListSlotsQuery,
  BenchType,
  SeatPosition,
  SwapSeatsInput,
  MoveSeatInput,
  LockSeatInput,
  SearchSeatingQuery,
  SeatingSearchResult,
  SeatingAnalytics,
  SeatingConflict,
  ConflictCheckResult,
} from '../types/examSeating';

// ── Scheduling authority — admin institution-wide, HOD within their own department ──

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
    if (rows[0].designation !== 'hod') throw AppError.forbidden('Only admins and HODs can manage exam seating');
    return { departmentId: rows[0].department_id };
  }

  throw AppError.forbidden('You do not have access to exam seating management');
}

// ── View access control (fixes the audit-found gap: exam/room seating reads
// used to have no scope check at all) ───────────────────────────────────────

// canSeeDraft = true for admin/managing-HOD (the authoring workflow, which must
// review seating before it's published); false for a conducting/invigilating
// faculty member or a student (recipient-only — gated to published seating,
// see PUBLISHED_FILTER below).

async function assertExamViewAccess(userId: string, role: Role, examId: string): Promise<{ canSeeDraft: boolean }> {
  if (role === 'admin') return { canSeeDraft: true };

  if (role === 'student') {
    const { rows } = await query<{ id: string }>(
      `SELECT esa.id FROM exam_seat_allocations esa
       JOIN students st ON st.id = esa.student_id
       WHERE esa.exam_id = $1 AND st.user_id = $2 AND esa.deleted_at IS NULL`,
      [examId, userId]
    );
    if (!rows[0]) throw AppError.forbidden("You do not have access to this exam's seating");
    return { canSeeDraft: false };
  }

  if (role === 'faculty') {
    const { rows: facRows } = await query<{ department_id: string; designation: string | null; faculty_id: string }>(
      `SELECT department_id, designation, id AS faculty_id FROM faculty WHERE user_id = $1 AND deleted_at IS NULL`,
      [userId]
    );
    if (!facRows[0]) throw AppError.forbidden('No faculty profile is linked to this account');

    const { rows: examRows } = await query<{ department_id: string; faculty_id: string }>(
      `SELECT sub.department_id, e.faculty_id FROM exams e JOIN subjects sub ON sub.id = e.subject_id
       WHERE e.id = $1 AND e.deleted_at IS NULL`,
      [examId]
    );
    if (!examRows[0]) throw AppError.notFound('Exam not found');

    if (facRows[0].designation === 'hod' && examRows[0].department_id === facRows[0].department_id) return { canSeeDraft: true };
    if (examRows[0].faculty_id === facRows[0].faculty_id) return { canSeeDraft: false };

    const { rows: invigRows } = await query<{ id: string }>(
      `SELECT eid.id FROM exam_invigilation_duties eid
       JOIN exam_seat_allocations esa ON esa.room_id = eid.room_id
       WHERE esa.exam_id = $1 AND eid.faculty_id = $2 AND eid.deleted_at IS NULL AND esa.deleted_at IS NULL
       LIMIT 1`,
      [examId, facRows[0].faculty_id]
    );
    if (invigRows[0]) return { canSeeDraft: false };

    throw AppError.forbidden("You do not have access to this exam's seating");
  }

  throw AppError.forbidden("You do not have access to this exam's seating");
}

async function assertRoomViewAccess(userId: string, role: Role, roomId: string): Promise<{ canSeeDraft: boolean }> {
  if (role === 'admin') return { canSeeDraft: true };

  if (role === 'faculty') {
    const { rows } = await query<{ department_id: string; designation: string | null; faculty_id: string }>(
      `SELECT department_id, designation, id AS faculty_id FROM faculty WHERE user_id = $1 AND deleted_at IS NULL`,
      [userId]
    );
    if (!rows[0]) throw AppError.forbidden('No faculty profile is linked to this account');
    if (rows[0].designation === 'hod') return { canSeeDraft: true };

    const { rows: invigRows } = await query<{ id: string }>(
      `SELECT id FROM exam_invigilation_duties WHERE room_id = $1 AND faculty_id = $2 AND deleted_at IS NULL LIMIT 1`,
      [roomId, rows[0].faculty_id]
    );
    if (invigRows[0]) return { canSeeDraft: false };

    throw AppError.forbidden("You do not have access to this room's seating");
  }

  if (role === 'student') {
    const { rows } = await query<{ id: string }>(
      `SELECT esa.id FROM exam_seat_allocations esa JOIN students st ON st.id = esa.student_id
       WHERE esa.room_id = $1 AND st.user_id = $2 AND esa.deleted_at IS NULL LIMIT 1`,
      [roomId, userId]
    );
    if (!rows[0]) throw AppError.forbidden("You do not have access to this room's seating");
    return { canSeeDraft: false };
  }

  throw AppError.forbidden("You do not have access to this room's seating");
}

// Rows with no exam_session_id belong to the legacy direct-examIds flow, which
// has no draft/publish concept and stays visible immediately (unchanged
// behavior). Rows with an exam_session_id are only visible once that session
// is published/completed — unless the caller has management access.
const PUBLISHED_FILTER = `(esa.exam_session_id IS NULL OR EXISTS (
  SELECT 1 FROM exam_sessions pes WHERE pes.id = esa.exam_session_id AND pes.status IN ('published', 'completed')
))`;

// ── Slots (derived from exams, never stored) ─────────────────────────────────

export async function getExamSlots(userId: string, role: Role, filters: ListSlotsQuery): Promise<ExamSlotSummary[]> {
  const scope = await resolveSchedulingScope(userId, role);
  const conditions: string[] = ["e.deleted_at IS NULL", "e.status = 'Scheduled'"];
  const params: unknown[] = [];
  const push = (cond: string, val: unknown) => {
    params.push(val);
    conditions.push(`${cond} $${params.length}`);
  };

  const departmentId = scope.departmentId ?? filters.departmentId;
  if (departmentId) push('sub.department_id =', departmentId);
  if (filters.from) push('e.exam_date >=', filters.from);
  if (filters.to) push('e.exam_date <=', filters.to);

  const { rows } = await query<{
    exam_date: string;
    start_time: string;
    end_time: string;
    exam_id: string;
    subject_code: string;
    subject_name: string;
    section: string;
    exam_type: string;
    roster_size: string;
    has_seating: boolean;
  }>(
    `SELECT
       TO_CHAR(e.exam_date, 'YYYY-MM-DD') AS exam_date,
       TO_CHAR(e.start_time, 'HH24:MI')   AS start_time,
       TO_CHAR(e.end_time, 'HH24:MI')     AS end_time,
       e.id AS exam_id, sub.code AS subject_code, sub.name AS subject_name, e.section, e.exam_type::text AS exam_type,
       (SELECT COUNT(*) FROM students st
        WHERE st.program_id = sub.program_id AND st.semester = sub.semester AND st.section = e.section
          AND st.status = 'active' AND st.deleted_at IS NULL)::text AS roster_size,
       EXISTS (SELECT 1 FROM exam_seat_allocations esa WHERE esa.exam_id = e.id AND esa.deleted_at IS NULL) AS has_seating
     FROM exams e JOIN subjects sub ON sub.id = e.subject_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY e.exam_date ASC, e.start_time ASC, sub.code ASC`,
    params
  );

  const slots = new Map<string, ExamSlotSummary>();
  for (const r of rows) {
    const key = `${r.exam_date}|${r.start_time}|${r.end_time}`;
    if (!slots.has(key)) {
      slots.set(key, { examDate: r.exam_date, startTime: r.start_time, endTime: r.end_time, exams: [], totalStudents: 0 });
    }
    const slot = slots.get(key)!;
    slot.exams.push({
      examId: r.exam_id,
      subjectCode: r.subject_code,
      subjectName: r.subject_name,
      section: r.section,
      examType: r.exam_type,
      rosterSize: Number(r.roster_size),
      hasSeating: r.has_seating,
    });
    slot.totalStudents += Number(r.roster_size);
  }

  return Array.from(slots.values());
}

// ── Seating generation ────────────────────────────────────────────────────────
// Allocation order is delegated to seatingPattern.service's applySeatingPattern,
// which falls back to the original round-robin-by-exam behavior when no pattern
// is supplied — so pre-existing callers see zero behavior change.

interface RosterEntry extends PatternableStudent {}

interface RoomInfo {
  id: string;
  name: string;
  capacity: number;
  benchType: BenchType | null;
}

interface Placement extends RosterEntry {
  roomId: string;
  roomName: string;
  seatNumber: number;
  benchNumber: number;
  seatPosition: SeatPosition;
}

/** Mirrors the exact bench-mapping formula used by migration 030's backfill. */
function benchPlacement(seatNumber: number, benchType: BenchType | null): { benchNumber: number; seatPosition: SeatPosition } {
  if (benchType === 'double') {
    return { benchNumber: Math.ceil(seatNumber / 2), seatPosition: seatNumber % 2 === 1 ? 'Left' : 'Right' };
  }
  if (benchType === 'triple') {
    const idx = (seatNumber - 1) % 3;
    return { benchNumber: Math.ceil(seatNumber / 3), seatPosition: idx === 0 ? 'Left' : idx === 1 ? 'Middle' : 'Right' };
  }
  return { benchNumber: seatNumber, seatPosition: 'Left' };
}

function assignSeats(students: RosterEntry[], rooms: RoomInfo[]): Placement[] {
  const placements: Placement[] = [];
  let roomIdx = 0;
  let seatInRoom = 1;

  for (const student of students) {
    while (roomIdx < rooms.length && seatInRoom > rooms[roomIdx].capacity) {
      roomIdx++;
      seatInRoom = 1;
    }
    if (roomIdx >= rooms.length) {
      throw AppError.badRequest('Selected rooms do not have enough combined capacity for this roster', 'INSUFFICIENT_CAPACITY');
    }
    const room = rooms[roomIdx];
    const { benchNumber, seatPosition } = benchPlacement(seatInRoom, room.benchType);
    placements.push({ ...student, roomId: room.id, roomName: room.name, seatNumber: seatInRoom, benchNumber, seatPosition });
    seatInRoom++;
  }

  return placements;
}

export async function generateSeatingPlan(
  userId: string,
  role: Role,
  data: GenerateSeatingInput
): Promise<SeatingGenerationResult> {
  const scope = await resolveSchedulingScope(userId, role);

  const { rows: examRows } = await query<{
    id: string;
    exam_date: string;
    start_time: string;
    end_time: string;
    subject_id: string;
    subject_code: string;
    program_id: string;
    semester: number;
    department_id: string;
    section: string;
    exam_type: string;
    status: string;
  }>(
    `SELECT e.id, TO_CHAR(e.exam_date,'YYYY-MM-DD') AS exam_date, e.start_time::text, e.end_time::text,
       e.subject_id, sub.code AS subject_code, sub.program_id, sub.semester, sub.department_id, e.section,
       e.exam_type::text AS exam_type, e.status::text AS status
     FROM exams e JOIN subjects sub ON sub.id = e.subject_id
     WHERE e.id = ANY($1::uuid[]) AND e.deleted_at IS NULL`,
    [data.examIds]
  );

  if (examRows.length !== data.examIds.length) throw AppError.notFound('One or more exams were not found');
  if (examRows.some((e) => e.status === 'Cancelled' || e.status === 'Completed')) {
    throw AppError.badRequest('Cannot generate seating for a cancelled or completed exam');
  }

  const [first, ...rest] = examRows;
  if (rest.some((e) => e.exam_date !== first.exam_date || e.start_time !== first.start_time || e.end_time !== first.end_time)) {
    throw AppError.badRequest('All exams must share the same date and time slot to be seated together', 'MIXED_SLOT');
  }

  if (scope.departmentId && examRows.some((e) => e.department_id !== scope.departmentId)) {
    throw AppError.forbidden('You can only manage seating for exams within your own department');
  }

  const { rows: roomRows } = await query<{ id: string; name: string; capacity: number; bench_type: BenchType | null }>(
    `SELECT id, name, capacity, bench_type FROM exam_rooms WHERE id = ANY($1::uuid[]) AND is_active = TRUE AND deleted_at IS NULL ORDER BY name ASC`,
    [data.roomIds]
  );
  if (roomRows.length !== data.roomIds.length) throw AppError.notFound('One or more rooms were not found or are inactive');

  // Resource Availability Engine gate — a room already occupied by another
  // activity (another exam, or a calendar reservation) at this slot is refused
  // unless the admin explicitly opts into an override (audited below).
  const availability = await listRoomsWithAvailability(first.exam_date, first.start_time, first.end_time, {
    roomIds: data.roomIds,
    excludeExamIds: data.examIds,
  });
  const unavailable = availability.filter((a) => a.state !== 'available');
  if (unavailable.length > 0 && !data.allowOverride) {
    throw AppError.badRequest(
      `Room(s) unavailable for this slot: ${unavailable.map((a) => `${a.roomName} (${a.conflictReason})`).join('; ')}`,
      'ROOM_UNAVAILABLE'
    );
  }

  const rosters = await Promise.all(
    examRows.map(async (e) => {
      const { rows } = await query<{ id: string; roll_number: string; full_name: string }>(
        `SELECT id, roll_number, full_name FROM students
         WHERE program_id = $1 AND semester = $2 AND section = $3 AND status = 'active' AND deleted_at IS NULL
         ORDER BY roll_number ASC`,
        [e.program_id, e.semester, e.section]
      );
      return rows.map<RosterEntry>((r) => ({
        studentId: r.id,
        rollNumber: r.roll_number,
        studentName: r.full_name,
        examId: e.id,
        subjectCode: e.subject_code,
        examType: e.exam_type,
        departmentId: e.department_id,
      }));
    })
  );

  const totalStudents = rosters.reduce((s, r) => s + r.length, 0);
  const totalCapacity = roomRows.reduce((s, r) => s + r.capacity, 0);
  if (totalStudents > totalCapacity) {
    throw AppError.badRequest(
      `Roster size (${totalStudents}) exceeds selected rooms' combined capacity (${totalCapacity})`,
      'INSUFFICIENT_CAPACITY'
    );
  }
  if (totalStudents === 0) {
    throw AppError.badRequest('No enrolled students found for the selected exams');
  }

  let pattern: { patternType: import('../types/examSeating').SeatingPatternType; departmentSequence: string[] } | null = null;
  if (data.seatingPatternId) {
    const p = await getSeatingPatternById(data.seatingPatternId);
    pattern = { patternType: p.patternType, departmentSequence: p.departmentSequence };
  }

  const ordered = applySeatingPattern(rosters.flat(), pattern);
  const placements = assignSeats(ordered, roomRows.map((r) => ({ id: r.id, name: r.name, capacity: r.capacity, benchType: r.bench_type })));

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE exam_seat_allocations SET deleted_at = NOW() WHERE exam_id = ANY($1::uuid[]) AND deleted_at IS NULL`,
      [data.examIds]
    );
    for (const p of placements) {
      await client.query(
        `INSERT INTO exam_seat_allocations (exam_id, room_id, student_id, seat_number, bench_number, seat_position, exam_session_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [p.examId, p.roomId, p.studentId, p.seatNumber, p.benchNumber, p.seatPosition, data.examSessionId ?? null]
      );
    }
  });

  await auditLog({
    actorId: userId,
    action: data.examSessionId ? 'GENERATE' : 'CREATE',
    resource: 'seat_allocation',
    resourceId: data.examSessionId ?? data.examIds[0],
    changes: { examIds: data.examIds, roomIds: data.roomIds, totalStudents, allowOverride: data.allowOverride },
  });
  if (unavailable.length > 0 && data.allowOverride) {
    await auditLog({
      actorId: userId,
      action: 'OVERRIDE',
      resource: 'seat_allocation',
      resourceId: data.examSessionId ?? data.examIds[0],
      changes: { overriddenRooms: unavailable.map((a) => ({ roomId: a.roomId, roomName: a.roomName, reason: a.conflictReason })) },
    });
  }

  // Notify affected students once per exam (department+semester scoped broadcast —
  // no per-student notification channel exists in this codebase, see teachingPlan.service.ts).
  // isImportant is always false here: HOD-triggered generation is authenticated as role
  // 'faculty', and createNotification forbids faculty from setting isImportant=true.
  // Session-driven generation intentionally SKIPS this notification: seats are not
  // visible to students until the session is published (see getSeatingByExam/
  // getMySeating's published-only filter below), and publishExamSession sends this
  // broadcast at the correct time instead. The legacy direct-examIds flow (no
  // session) keeps notifying immediately here, exactly as before.
  if (!data.examSessionId) {
    for (const e of examRows) {
      await createNotification(userId, role === 'admin' ? 'admin' : 'faculty', {
        title: 'Exam Seating Published',
        message: `Seating has been published for ${e.subject_code} (${e.exam_type}) on ${e.exam_date}. Check your seat assignment.`,
        type: 'Academic Alert',
        targetRole: 'student',
        departmentId: e.department_id,
        semester: e.semester,
        isImportant: false,
      });
    }
  }

  const roomsMap = new Map<string, RoomSeatingChart>();
  for (const room of roomRows) {
    roomsMap.set(room.id, {
      roomId: room.id,
      roomName: room.name,
      rows: null,
      columns: null,
      benchType: room.bench_type,
      capacity: room.capacity,
      occupied: 0,
      seats: [],
    });
  }
  for (const p of placements) {
    const chart = roomsMap.get(p.roomId)!;
    chart.occupied++;
    chart.seats.push({
      id: '',
      examId: p.examId,
      subjectCode: p.subjectCode,
      examType: p.examType,
      departmentId: p.departmentId,
      departmentCode: '',
      departmentColor: null,
      roomId: p.roomId,
      roomName: p.roomName,
      studentId: p.studentId,
      rollNumber: p.rollNumber,
      studentName: p.studentName,
      seatNumber: p.seatNumber,
      benchNumber: p.benchNumber,
      seatPosition: p.seatPosition,
      isLocked: false,
    });
  }

  return { examIds: data.examIds, totalStudents, rooms: Array.from(roomsMap.values()) };
}

// ── Read paths ─────────────────────────────────────────────────────────────────

const SEAT_COLS = `
  esa.id, esa.exam_id, sub.code AS subject_code, e.exam_type::text AS exam_type,
  dept.id AS department_id, dept.code AS department_code, dept.color AS department_color,
  esa.room_id, er.name AS room_name, esa.student_id, st.roll_number, st.full_name AS student_name,
  esa.seat_number, esa.bench_number, esa.seat_position, esa.is_locked
`;
const SEAT_JOINS = `
  JOIN exams e         ON e.id  = esa.exam_id
  JOIN subjects sub    ON sub.id = e.subject_id
  JOIN departments dept ON dept.id = sub.department_id
  JOIN exam_rooms er   ON er.id = esa.room_id
  JOIN students st     ON st.id = esa.student_id
`;

interface SeatRow {
  id: string;
  exam_id: string;
  subject_code: string;
  exam_type: string;
  department_id: string;
  department_code: string;
  department_color: string | null;
  room_id: string;
  room_name: string;
  student_id: string;
  roll_number: string;
  student_name: string;
  seat_number: number;
  bench_number: number | null;
  seat_position: SeatPosition | null;
  is_locked: boolean;
}

function toSeatAllocation(r: SeatRow): SeatAllocation {
  return {
    id: r.id,
    examId: r.exam_id,
    subjectCode: r.subject_code,
    examType: r.exam_type,
    departmentId: r.department_id,
    departmentCode: r.department_code,
    departmentColor: r.department_color,
    roomId: r.room_id,
    roomName: r.room_name,
    studentId: r.student_id,
    rollNumber: r.roll_number,
    studentName: r.student_name,
    seatNumber: r.seat_number,
    benchNumber: r.bench_number,
    seatPosition: r.seat_position,
    isLocked: r.is_locked,
  };
}

export async function getSeatingByExam(userId: string, role: Role, examId: string): Promise<RoomSeatingChart[]> {
  const { canSeeDraft } = await assertExamViewAccess(userId, role, examId);

  const { rows } = await query<SeatRow & { capacity: number; rows: number | null; columns: number | null; bench_type: BenchType | null }>(
    `SELECT ${SEAT_COLS}, er.capacity, er.rows, er.columns, er.bench_type
     FROM exam_seat_allocations esa ${SEAT_JOINS}
     WHERE esa.exam_id = $1 AND esa.deleted_at IS NULL ${canSeeDraft ? '' : `AND ${PUBLISHED_FILTER}`}
     ORDER BY er.name ASC, esa.seat_number ASC`,
    [examId]
  );

  const roomsMap = new Map<string, RoomSeatingChart>();
  for (const r of rows) {
    if (!roomsMap.has(r.room_id)) {
      roomsMap.set(r.room_id, {
        roomId: r.room_id,
        roomName: r.room_name,
        rows: r.rows,
        columns: r.columns,
        benchType: r.bench_type,
        capacity: r.capacity,
        occupied: 0,
        seats: [],
      });
    }
    const chart = roomsMap.get(r.room_id)!;
    chart.occupied++;
    chart.seats.push(toSeatAllocation(r));
  }
  return Array.from(roomsMap.values());
}

export async function getSeatingByRoom(userId: string, role: Role, roomId: string, date?: string): Promise<RoomSeatingChart> {
  const { canSeeDraft } = await assertRoomViewAccess(userId, role, roomId);

  const { rows: roomRows } = await query<{ id: string; name: string; capacity: number; rows: number | null; columns: number | null; bench_type: BenchType | null }>(
    'SELECT id, name, capacity, rows, columns, bench_type FROM exam_rooms WHERE id = $1 AND deleted_at IS NULL',
    [roomId]
  );
  if (!roomRows[0]) throw AppError.notFound('Exam room not found');

  const params: unknown[] = [roomId];
  let dateFilter = '';
  if (date) {
    params.push(date);
    dateFilter = `AND e.exam_date = $${params.length}`;
  }

  const { rows } = await query<SeatRow>(
    `SELECT ${SEAT_COLS}
     FROM exam_seat_allocations esa ${SEAT_JOINS}
     WHERE esa.room_id = $1 AND esa.deleted_at IS NULL ${dateFilter} ${canSeeDraft ? '' : `AND ${PUBLISHED_FILTER}`}
     ORDER BY esa.seat_number ASC`,
    params
  );

  return {
    roomId: roomRows[0].id,
    roomName: roomRows[0].name,
    rows: roomRows[0].rows,
    columns: roomRows[0].columns,
    benchType: roomRows[0].bench_type,
    capacity: roomRows[0].capacity,
    occupied: rows.length,
    seats: rows.map(toSeatAllocation),
  };
}

export async function getMySeating(userId: string): Promise<SeatAllocation[]> {
  const { rows: stuRows } = await query<{ id: string }>(
    'SELECT id FROM students WHERE user_id = $1 AND deleted_at IS NULL',
    [userId]
  );
  if (!stuRows[0]) throw AppError.forbidden('No student profile is linked to this account');

  const { rows } = await query<SeatRow & { exam_date: string }>(
    `SELECT ${SEAT_COLS}, TO_CHAR(e.exam_date, 'YYYY-MM-DD') AS exam_date
     FROM exam_seat_allocations esa ${SEAT_JOINS}
     WHERE esa.student_id = $1 AND esa.deleted_at IS NULL AND e.exam_date >= CURRENT_DATE AND ${PUBLISHED_FILTER}
     ORDER BY e.exam_date ASC`,
    [stuRows[0].id]
  );
  return rows.map(toSeatAllocation);
}

// ── Manual adjustment: swap / move / lock individual seats ──────────────────
// Operates on single allocation rows only, never a full regenerate — satisfies
// "recalculate only affected seats."

async function fetchAllocationForAdjustment(id: string): Promise<{
  id: string;
  examId: string;
  roomId: string;
  studentId: string;
  seatNumber: number;
  isLocked: boolean;
  departmentId: string;
}> {
  const { rows } = await query<{ id: string; exam_id: string; room_id: string; student_id: string; seat_number: number; is_locked: boolean; department_id: string }>(
    `SELECT esa.id, esa.exam_id, esa.room_id, esa.student_id, esa.seat_number, esa.is_locked, sub.department_id
     FROM exam_seat_allocations esa
     JOIN exams e ON e.id = esa.exam_id
     JOIN subjects sub ON sub.id = e.subject_id
     WHERE esa.id = $1 AND esa.deleted_at IS NULL`,
    [id]
  );
  if (!rows[0]) throw AppError.notFound('Seat allocation not found');
  return {
    id: rows[0].id,
    examId: rows[0].exam_id,
    roomId: rows[0].room_id,
    studentId: rows[0].student_id,
    seatNumber: rows[0].seat_number,
    isLocked: rows[0].is_locked,
    departmentId: rows[0].department_id,
  };
}

export async function swapSeats(userId: string, role: Role, data: SwapSeatsInput): Promise<void> {
  const scope = await resolveSchedulingScope(userId, role);
  const [a, b] = await Promise.all([
    fetchAllocationForAdjustment(data.allocationIdA),
    fetchAllocationForAdjustment(data.allocationIdB),
  ]);

  if (scope.departmentId && (a.departmentId !== scope.departmentId || b.departmentId !== scope.departmentId)) {
    throw AppError.forbidden('You can only adjust seating within your own department');
  }
  if (a.isLocked || b.isLocked) {
    throw AppError.badRequest('Cannot swap a locked seat. Unlock it first.', 'SEAT_LOCKED');
  }

  const { rows: roomARows } = await query<{ bench_type: BenchType | null }>('SELECT bench_type FROM exam_rooms WHERE id = $1', [a.roomId]);
  const { rows: roomBRows } = await query<{ bench_type: BenchType | null }>('SELECT bench_type FROM exam_rooms WHERE id = $1', [b.roomId]);
  const benchA = benchPlacement(b.seatNumber, roomARows[0].bench_type);
  const benchB = benchPlacement(a.seatNumber, roomBRows[0].bench_type);

  // Park allocation A on a temporary out-of-range seat number first — swapping
  // directly can transiently collide with the (room_id, seat_number, exam_id)
  // unique index when both allocations share a room (each UPDATE is checked
  // as it runs, not deferred to end-of-transaction).
  await withTransaction(async (client) => {
    await client.query(`UPDATE exam_seat_allocations SET seat_number = seat_number + 20000 WHERE id = $1`, [a.id]);
    await client.query(
      `UPDATE exam_seat_allocations SET room_id = $1, seat_number = $2, bench_number = $3, seat_position = $4 WHERE id = $5`,
      [a.roomId, a.seatNumber, benchB.benchNumber, benchB.seatPosition, b.id]
    );
    await client.query(
      `UPDATE exam_seat_allocations SET room_id = $1, seat_number = $2, bench_number = $3, seat_position = $4 WHERE id = $5`,
      [b.roomId, b.seatNumber, benchA.benchNumber, benchA.seatPosition, a.id]
    );
  });

  await auditLog({
    actorId: userId,
    action: 'SWAP',
    resource: 'seat_allocation',
    resourceId: a.id,
    changes: {
      from: { allocationId: a.id, roomId: a.roomId, seatNumber: a.seatNumber },
      to: { allocationId: a.id, roomId: b.roomId, seatNumber: b.seatNumber },
      swappedWith: { allocationId: b.id, roomId: b.roomId, seatNumber: b.seatNumber },
    },
  });
}

export async function moveSeat(userId: string, role: Role, data: MoveSeatInput): Promise<SeatAllocation> {
  const scope = await resolveSchedulingScope(userId, role);
  const allocation = await fetchAllocationForAdjustment(data.allocationId);

  if (scope.departmentId && allocation.departmentId !== scope.departmentId) {
    throw AppError.forbidden('You can only adjust seating within your own department');
  }
  if (allocation.isLocked) {
    throw AppError.badRequest('Cannot move a locked seat. Unlock it first.', 'SEAT_LOCKED');
  }

  const { rows: roomRows } = await query<{ id: string; capacity: number; bench_type: BenchType | null }>(
    'SELECT id, capacity, bench_type FROM exam_rooms WHERE id = $1 AND is_active = TRUE AND deleted_at IS NULL',
    [data.targetRoomId]
  );
  if (!roomRows[0]) throw AppError.notFound('Target room not found or inactive');
  if (data.targetSeatNumber > roomRows[0].capacity) {
    throw AppError.badRequest('Target seat number exceeds room capacity', 'INSUFFICIENT_CAPACITY');
  }

  const { rows: occupied } = await query<{ id: string }>(
    `SELECT id FROM exam_seat_allocations
     WHERE room_id = $1 AND seat_number = $2 AND exam_id = $3 AND deleted_at IS NULL AND id != $4`,
    [data.targetRoomId, data.targetSeatNumber, allocation.examId, allocation.id]
  );
  if (occupied[0]) throw AppError.conflict('Target seat is already occupied. Use swap instead.', 'SEAT_OCCUPIED');

  const { benchNumber, seatPosition } = benchPlacement(data.targetSeatNumber, roomRows[0].bench_type);

  await query(
    `UPDATE exam_seat_allocations SET room_id = $1, seat_number = $2, bench_number = $3, seat_position = $4 WHERE id = $5`,
    [data.targetRoomId, data.targetSeatNumber, benchNumber, seatPosition, allocation.id]
  );

  await auditLog({
    actorId: userId,
    action: 'MOVE',
    resource: 'seat_allocation',
    resourceId: allocation.id,
    changes: {
      from: { roomId: allocation.roomId, seatNumber: allocation.seatNumber },
      to: { roomId: data.targetRoomId, seatNumber: data.targetSeatNumber },
    },
  });

  const { rows } = await query<SeatRow>(
    `SELECT ${SEAT_COLS} FROM exam_seat_allocations esa ${SEAT_JOINS} WHERE esa.id = $1`,
    [allocation.id]
  );
  return toSeatAllocation(rows[0]);
}

export async function lockSeat(userId: string, role: Role, allocationId: string, data: LockSeatInput): Promise<SeatAllocation> {
  const scope = await resolveSchedulingScope(userId, role);
  const allocation = await fetchAllocationForAdjustment(allocationId);

  if (scope.departmentId && allocation.departmentId !== scope.departmentId) {
    throw AppError.forbidden('You can only adjust seating within your own department');
  }

  await query('UPDATE exam_seat_allocations SET is_locked = $1 WHERE id = $2', [data.isLocked, allocationId]);

  await auditLog({
    actorId: userId,
    action: 'UPDATE',
    resource: 'seat_allocation',
    resourceId: allocationId,
    changes: { from: { isLocked: allocation.isLocked }, to: { isLocked: data.isLocked } },
  });

  const { rows } = await query<SeatRow>(
    `SELECT ${SEAT_COLS} FROM exam_seat_allocations esa ${SEAT_JOINS} WHERE esa.id = $1`,
    [allocationId]
  );
  return toSeatAllocation(rows[0]);
}

// ── Search ────────────────────────────────────────────────────────────────────

export async function searchSeating(userId: string, role: Role, filters: SearchSeatingQuery): Promise<SeatingSearchResult[]> {
  const scope = await resolveSchedulingScope(userId, role);
  const like = `%${filters.q}%`;
  const results: SeatingSearchResult[] = [];

  const seatConditions: string[] = ['esa.deleted_at IS NULL', '(st.roll_number ILIKE $1 OR st.full_name ILIKE $1 OR er.name ILIKE $1 OR er.building ILIKE $1 OR esa.bench_number::text = $2)'];
  const seatParams: unknown[] = [like, filters.q];
  if (scope.departmentId) {
    seatParams.push(scope.departmentId);
    seatConditions.push(`dept.id = $${seatParams.length}`);
  }
  if (filters.examId) {
    seatParams.push(filters.examId);
    seatConditions.push(`esa.exam_id = $${seatParams.length}`);
  }

  const { rows: seatRows } = await query<SeatRow>(
    `SELECT ${SEAT_COLS} FROM exam_seat_allocations esa ${SEAT_JOINS}
     WHERE ${seatConditions.join(' AND ')} ORDER BY st.roll_number ASC LIMIT 50`,
    seatParams
  );
  for (const r of seatRows) {
    const seat = toSeatAllocation(r);
    results.push({
      type: 'student',
      label: `${seat.rollNumber} — ${seat.studentName}`,
      context: `${seat.roomName}, Bench ${seat.benchNumber ?? seat.seatNumber} (${seat.seatPosition ?? '-'})`,
      seatAllocation: seat,
    });
  }

  const invigConditions: string[] = ['eid.deleted_at IS NULL', '(f.full_name ILIKE $1 OR er.name ILIKE $1)'];
  const invigParams: unknown[] = [like];
  if (scope.departmentId) {
    invigParams.push(scope.departmentId);
    invigConditions.push(`f.department_id = $${invigParams.length}`);
  }

  const { rows: invigRows } = await query<{
    id: string; room_id: string; room_name: string; faculty_id: string; faculty_name: string;
    duty_date: string; start_time: string; end_time: string; status: string; assigned_by: string;
  }>(
    `SELECT eid.id, eid.room_id, er.name AS room_name, eid.faculty_id, f.full_name AS faculty_name,
       TO_CHAR(eid.duty_date, 'YYYY-MM-DD') AS duty_date, eid.start_time::text, eid.end_time::text,
       eid.status::text AS status, eid.assigned_by
     FROM exam_invigilation_duties eid
     JOIN exam_rooms er ON er.id = eid.room_id
     JOIN faculty f ON f.id = eid.faculty_id
     WHERE ${invigConditions.join(' AND ')} ORDER BY eid.duty_date DESC LIMIT 20`,
    invigParams
  );
  for (const r of invigRows) {
    results.push({
      type: 'invigilator',
      label: `${r.faculty_name} — ${r.room_name}`,
      context: `${r.duty_date}, ${r.start_time}-${r.end_time} (${r.status})`,
      invigilationDuty: {
        id: r.id,
        roomId: r.room_id,
        roomName: r.room_name,
        facultyId: r.faculty_id,
        facultyName: r.faculty_name,
        dutyDate: r.duty_date,
        startTime: r.start_time,
        endTime: r.end_time,
        status: r.status as import('../types/examSeating').InvigilationStatus,
        assignedBy: r.assigned_by,
        exams: [],
      },
    });
  }

  return results;
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export async function getSeatingAnalytics(
  userId: string,
  role: Role,
  filters: { examId?: string; examSessionId?: string }
): Promise<SeatingAnalytics> {
  const scope = await resolveSchedulingScope(userId, role);

  const conditions: string[] = ['esa.deleted_at IS NULL'];
  const params: unknown[] = [];
  if (scope.departmentId) {
    params.push(scope.departmentId);
    conditions.push(`dept.id = $${params.length}`);
  }
  if (filters.examId) {
    params.push(filters.examId);
    conditions.push(`esa.exam_id = $${params.length}`);
  }
  if (filters.examSessionId) {
    params.push(filters.examSessionId);
    conditions.push(`esa.exam_session_id = $${params.length}`);
  }

  const { rows: seatRows } = await query<{
    department_id: string; department_code: string; department_color: string | null; dept_count: string;
  }>(
    `SELECT dept.id AS department_id, dept.code AS department_code, dept.color AS department_color, COUNT(*)::text AS dept_count
     FROM exam_seat_allocations esa ${SEAT_JOINS}
     WHERE ${conditions.join(' AND ')}
     GROUP BY dept.id, dept.code, dept.color`,
    params
  );

  const totalStudents = seatRows.reduce((s, r) => s + Number(r.dept_count), 0);
  const roomIdsUsed = new Set<string>();
  const { rows: roomAgg } = await query<{ room_id: string; capacity: number }>(
    `SELECT DISTINCT esa.room_id, er.capacity FROM exam_seat_allocations esa
     JOIN exam_rooms er ON er.id = esa.room_id
     JOIN exams e ON e.id = esa.exam_id JOIN subjects sub ON sub.id = e.subject_id JOIN departments dept ON dept.id = sub.department_id
     WHERE ${conditions.join(' AND ')}`,
    params
  );
  let totalCapacity = 0;
  for (const r of roomAgg) {
    roomIdsUsed.add(r.room_id);
    totalCapacity += r.capacity;
  }

  const { rows: invigRows } = await query<{ count: string }>(
    `SELECT COUNT(DISTINCT eid.faculty_id)::text AS count FROM exam_invigilation_duties eid
     WHERE eid.deleted_at IS NULL AND eid.room_id = ANY($1::uuid[])`,
    [Array.from(roomIdsUsed)]
  );

  const studentsPerDepartment = seatRows.map((r) => ({
    departmentId: r.department_id,
    departmentCode: r.department_code,
    departmentColor: r.department_color,
    count: Number(r.dept_count),
  }));

  let conflictCount = 0;
  if (filters.examSessionId) {
    const { rows: sessionRows } = await query<{ last_conflict_count: number | null }>(
      'SELECT last_conflict_count FROM exam_sessions WHERE id = $1',
      [filters.examSessionId]
    );
    conflictCount = sessionRows[0]?.last_conflict_count ?? 0;
  }

  return {
    totalStudents,
    roomsUsed: roomIdsUsed.size,
    capacityUtilizationPercent: totalCapacity > 0 ? Math.round((totalStudents / totalCapacity) * 100) : 0,
    invigilatorsAssigned: invigRows[0] ? Number(invigRows[0].count) : 0,
    averageOccupancyPercent:
      roomIdsUsed.size > 0 ? Math.round((totalStudents / roomIdsUsed.size / (totalCapacity / Math.max(1, roomIdsUsed.size))) * 100) : 0,
    conflictCount,
    studentsPerDepartment,
  };
}

// ── Conflict detection (computed on demand, never stored) ───────────────────

export async function checkSeatingConflicts(
  userId: string,
  role: Role,
  data: { examIds: string[]; roomIds: string[] }
): Promise<ConflictCheckResult> {
  const scope = await resolveSchedulingScope(userId, role);
  const conflicts: SeatingConflict[] = [];

  const { rows: examRows } = await query<{
    id: string;
    program_id: string;
    semester: number;
    section: string;
    department_id: string;
    exam_date: string;
    start_time: string;
    end_time: string;
  }>(
    `SELECT e.id, sub.program_id, sub.semester, e.section, sub.department_id,
       TO_CHAR(e.exam_date, 'YYYY-MM-DD') AS exam_date, e.start_time::text, e.end_time::text
     FROM exams e JOIN subjects sub ON sub.id = e.subject_id
     WHERE e.id = ANY($1::uuid[]) AND e.deleted_at IS NULL`,
    [data.examIds]
  );
  if (examRows.length !== data.examIds.length) throw AppError.notFound('One or more exams were not found');
  if (scope.departmentId && examRows.some((e) => e.department_id !== scope.departmentId)) {
    throw AppError.forbidden('You can only manage seating for exams within your own department');
  }

  const [firstExam, ...restExams] = examRows;
  const sameSlot = !restExams.some(
    (e) => e.exam_date !== firstExam.exam_date || e.start_time !== firstExam.start_time || e.end_time !== firstExam.end_time
  );
  if (!sameSlot) {
    conflicts.push({
      type: 'time_overlap',
      severity: 'error',
      message: 'Selected exams span more than one date/time slot and cannot be seated together',
    });
  }

  const rosterCounts = new Map<string, number>();
  for (const e of examRows) {
    const { rows } = await query<{ id: string }>(
      `SELECT id FROM students WHERE program_id=$1 AND semester=$2 AND section=$3 AND status='active' AND deleted_at IS NULL`,
      [e.program_id, e.semester, e.section]
    );
    for (const r of rows) rosterCounts.set(r.id, (rosterCounts.get(r.id) ?? 0) + 1);
  }
  const dupCount = Array.from(rosterCounts.values()).filter((c) => c > 1).length;
  if (dupCount > 0) {
    conflicts.push({
      type: 'duplicate_student',
      severity: 'error',
      message: `${dupCount} student(s) are enrolled in more than one selected exam and would receive duplicate seats`,
    });
  }

  const { rows: roomRows } = await query<{ id: string; name: string; capacity: number; is_active: boolean }>(
    `SELECT id, name, capacity, is_active FROM exam_rooms WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`,
    [data.roomIds]
  );
  if (roomRows.length !== data.roomIds.length) throw AppError.notFound('One or more rooms were not found');

  for (const r of roomRows.filter((r) => !r.is_active)) {
    conflicts.push({ type: 'unavailable_room', severity: 'error', message: `Room ${r.name} is inactive`, context: { roomId: r.id } });
  }

  if (sameSlot) {
    const availability = await listRoomsWithAvailability(firstExam.exam_date, firstExam.start_time, firstExam.end_time, {
      roomIds: data.roomIds,
      excludeExamIds: data.examIds,
    });
    for (const a of availability) {
      if (a.state === 'maintenance') {
        conflicts.push({ type: 'unavailable_room', severity: 'error', message: `Room ${a.roomName}: ${a.conflictReason}`, context: { roomId: a.roomId } });
      } else if (a.state === 'occupied') {
        const isCalendarHit = a.conflictReason?.startsWith('Reserved via calendar');
        conflicts.push({
          type: isCalendarHit ? 'calendar_conflict' : 'time_overlap',
          severity: 'error',
          message: `Room ${a.roomName}: ${a.conflictReason}`,
          context: { roomId: a.roomId },
        });
      }
    }

    const { rows: invigDuties } = await query<{ faculty_id: string; faculty_name: string }>(
      `SELECT eid.faculty_id, f.full_name AS faculty_name
       FROM exam_invigilation_duties eid JOIN faculty f ON f.id = eid.faculty_id
       WHERE eid.room_id = ANY($1::uuid[]) AND eid.duty_date = $2 AND eid.status != 'Cancelled' AND eid.deleted_at IS NULL
         AND eid.start_time::text < $3 AND eid.end_time::text > $4`,
      [data.roomIds, firstExam.exam_date, firstExam.end_time, firstExam.start_time]
    );
    const invigByFaculty = new Map<string, number>();
    for (const d of invigDuties) invigByFaculty.set(d.faculty_id, (invigByFaculty.get(d.faculty_id) ?? 0) + 1);
    for (const [facultyId, count] of invigByFaculty) {
      if (count > 1) {
        const name = invigDuties.find((d) => d.faculty_id === facultyId)?.faculty_name;
        conflicts.push({
          type: 'duplicate_invigilator',
          severity: 'error',
          message: `${name} is assigned to invigilate more than one room in this slot`,
          context: { facultyId },
        });
      }
    }
  }

  const totalStudents = rosterCounts.size;
  const totalCapacity = roomRows.reduce((s, r) => s + r.capacity, 0);
  if (totalStudents > totalCapacity) {
    conflicts.push({
      type: 'capacity_exceeded',
      severity: 'error',
      message: `Roster size (${totalStudents}) exceeds selected rooms' combined capacity (${totalCapacity})`,
    });
  } else if (roomRows.length > 1) {
    // Simulate sequential fill (matches assignSeats' room-ordering) to flag rooms
    // that would end up completely unused given the current selection.
    let remaining = totalStudents;
    for (const r of [...roomRows].sort((a, b) => a.name.localeCompare(b.name))) {
      if (remaining <= 0) {
        conflicts.push({
          type: 'empty_classroom',
          severity: 'warning',
          message: `Room ${r.name} would receive no students with the current selection`,
          context: { roomId: r.id },
        });
      }
      remaining -= r.capacity;
    }
  }

  const hasBlockingConflicts = conflicts.some((c) => c.severity === 'error');
  return { hasBlockingConflicts, conflicts };
}
