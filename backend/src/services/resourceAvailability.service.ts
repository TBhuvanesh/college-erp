import { query } from '../config/database';
import type { RoomAvailability, FacultyAvailability, RoomSuggestionResult, BenchType } from '../types/examSeating';

// ── Resource Availability Engine ─────────────────────────────────────────────
// Centralizes "is this room/faculty free right now" — reused by classroom
// listing, invigilator candidate selection, and the Conflict Engine, replacing
// the ad-hoc overlap queries that used to live separately in
// examSeating.service.ts and examInvigilation.service.ts.
//
// Nothing here is stored — every state is derived live from exam_seat_allocations,
// exam_invigilation_duties, exams (as conducting faculty), calendar_entries, and
// the room's own is_active/under_maintenance flags or the faculty's status flag.
// This is deliberate: there is no generic room-reservation or faculty-leave
// module in this ERP, so calendar_entries (already used for exactly this
// purpose by examInvigilation.service.ts's duty sync) is the one cross-module
// signal reused here, alongside the exam/invigilation tables this module owns.

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return timeToMinutes(aStart) < timeToMinutes(bEnd) && timeToMinutes(bStart) < timeToMinutes(aEnd);
}

// ── Room availability ─────────────────────────────────────────────────────────

export async function checkRoomAvailability(
  roomId: string,
  date: string,
  startTime: string,
  endTime: string
): Promise<RoomAvailability> {
  const results = await listRoomsWithAvailability(date, startTime, endTime, { roomIds: [roomId] });
  if (!results[0]) {
    return { roomId, roomName: 'Unknown room', capacity: 0, state: 'inactive', conflictReason: 'Room not found', occupiedBy: null, timeSlot: null };
  }
  return results[0];
}

export async function listRoomsWithAvailability(
  date: string,
  startTime: string,
  endTime: string,
  filters: { isActive?: boolean; roomIds?: string[]; excludeExamIds?: string[] } = {}
): Promise<RoomAvailability[]> {
  const conditions: string[] = ['er.deleted_at IS NULL'];
  const params: unknown[] = [];
  if (filters.isActive !== undefined) {
    params.push(filters.isActive);
    conditions.push(`er.is_active = $${params.length}`);
  }
  if (filters.roomIds && filters.roomIds.length > 0) {
    params.push(filters.roomIds);
    conditions.push(`er.id = ANY($${params.length}::uuid[])`);
  }

  const { rows: rooms } = await query<{
    id: string; name: string; capacity: number; is_active: boolean; under_maintenance: boolean; maintenance_note: string | null; bench_type: BenchType | null;
  }>(
    `SELECT er.id, er.name, er.capacity, er.is_active, er.under_maintenance, er.maintenance_note, er.bench_type
     FROM exam_rooms er WHERE ${conditions.join(' AND ')} ORDER BY er.name ASC`,
    params
  );
  if (rooms.length === 0) return [];

  const roomIds = rooms.map((r) => r.id);

  const examBookingParams: unknown[] = [roomIds, date];
  let examBookingExclusion = '';
  if (filters.excludeExamIds && filters.excludeExamIds.length > 0) {
    examBookingParams.push(filters.excludeExamIds);
    examBookingExclusion = `AND e.id != ALL($${examBookingParams.length}::uuid[])`;
  }
  const { rows: examBookings } = await query<{
    room_id: string; subject_code: string; exam_type: string; start_time: string; end_time: string;
  }>(
    `SELECT DISTINCT esa.room_id, sub.code AS subject_code, e.exam_type::text AS exam_type, e.start_time::text, e.end_time::text
     FROM exam_seat_allocations esa
     JOIN exams e ON e.id = esa.exam_id
     JOIN subjects sub ON sub.id = e.subject_id
     WHERE esa.room_id = ANY($1::uuid[]) AND esa.deleted_at IS NULL AND e.exam_date = $2 AND e.deleted_at IS NULL ${examBookingExclusion}`,
    examBookingParams
  );

  const { rows: calendarBookings } = await query<{ room_id: string; title: string; start_date: string; end_date: string | null }>(
    `SELECT room_id, title, start_date::text, end_date::text
     FROM calendar_entries
     WHERE room_id = ANY($1::uuid[]) AND deleted_at IS NULL AND start_date::date = $2::date`,
    [roomIds, date]
  );

  return rooms.map((r) => {
    if (!r.is_active) {
      return { roomId: r.id, roomName: r.name, capacity: r.capacity, state: 'inactive', conflictReason: 'Room is deactivated', occupiedBy: null, timeSlot: null };
    }
    if (r.under_maintenance) {
      return {
        roomId: r.id, roomName: r.name, capacity: r.capacity, state: 'maintenance',
        conflictReason: r.maintenance_note ?? 'Room is under maintenance', occupiedBy: null, timeSlot: null,
      };
    }

    const examHit = examBookings.find((b) => b.room_id === r.id && overlaps(b.start_time, b.end_time, startTime, endTime));
    if (examHit) {
      return {
        roomId: r.id, roomName: r.name, capacity: r.capacity, state: 'occupied',
        conflictReason: `Occupied by ${examHit.subject_code} (${examHit.exam_type}) exam`,
        occupiedBy: `${examHit.subject_code} (${examHit.exam_type})`,
        timeSlot: { date, startTime: examHit.start_time, endTime: examHit.end_time },
      };
    }

    const calHit = calendarBookings.find((b) => {
      if (b.room_id !== r.id) return false;
      const bStart = b.start_date.slice(11, 16) || '00:00';
      const bEnd = b.end_date ? b.end_date.slice(11, 16) : bStart;
      return overlaps(bStart, bEnd, startTime, endTime);
    });
    if (calHit) {
      const bStart = calHit.start_date.slice(11, 16) || '00:00';
      const bEnd = calHit.end_date ? calHit.end_date.slice(11, 16) : bStart;
      return {
        roomId: r.id, roomName: r.name, capacity: r.capacity, state: 'occupied',
        conflictReason: `Reserved via calendar: ${calHit.title}`, occupiedBy: calHit.title,
        timeSlot: { date, startTime: bStart, endTime: bEnd },
      };
    }

    return { roomId: r.id, roomName: r.name, capacity: r.capacity, state: 'available', conflictReason: null, occupiedBy: null, timeSlot: null };
  });
}

export async function suggestRooms(
  requiredCapacity: number,
  date: string,
  startTime: string,
  endTime: string
): Promise<RoomSuggestionResult> {
  const all = await listRoomsWithAvailability(date, startTime, endTime, { isActive: true });
  const available = all.filter((r) => r.state === 'available');
  const capacityAvailable = available.reduce((s, r) => s + r.capacity, 0);

  // Greedy: smallest-first-fit combination that satisfies requiredCapacity with
  // the fewest rooms, minimizing wasted seats — deterministic, not AI.
  const sorted = [...available].sort((a, b) => a.capacity - b.capacity);
  const recommended: RoomAvailability[] = [];
  let remaining = requiredCapacity;
  for (const room of sorted) {
    if (remaining <= 0) break;
    recommended.push(room);
    remaining -= room.capacity;
  }
  if (remaining > 0) {
    // Not enough total capacity — return every available room so the admin sees the full shortfall.
    return { recommended: available, capacityRequired: requiredCapacity, capacityAvailable };
  }

  return { recommended, capacityRequired: requiredCapacity, capacityAvailable };
}

// ── Faculty availability ──────────────────────────────────────────────────────

export async function checkFacultyAvailability(
  facultyId: string,
  date: string,
  startTime: string,
  endTime: string
): Promise<FacultyAvailability> {
  const results = await listFacultyAvailability([facultyId], date, startTime, endTime);
  return results[0];
}

export async function listFacultyAvailability(
  facultyIds: string[],
  date: string,
  startTime: string,
  endTime: string,
  options: { excludeRoomIds?: string[] } = {}
): Promise<FacultyAvailability[]> {
  if (facultyIds.length === 0) return [];

  const { rows: faculty } = await query<{ id: string; full_name: string; status: string; user_id: string }>(
    `SELECT id, full_name, status::text, user_id FROM faculty WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`,
    [facultyIds]
  );

  const { rows: conducting } = await query<{ faculty_id: string; subject_code: string; start_time: string; end_time: string }>(
    `SELECT e.faculty_id, sub.code AS subject_code, e.start_time::text, e.end_time::text
     FROM exams e JOIN subjects sub ON sub.id = e.subject_id
     WHERE e.faculty_id = ANY($1::uuid[]) AND e.exam_date = $2 AND e.deleted_at IS NULL AND e.status != 'Cancelled'`,
    [facultyIds, date]
  );

  // Existing duties in the room(s)/slot currently being (re)generated are about
  // to be superseded, not a real conflict — exclude them so regenerating for the
  // same slot never locks out the faculty it previously assigned.
  const invigParams: unknown[] = [facultyIds, date];
  let invigExclusion = '';
  if (options.excludeRoomIds && options.excludeRoomIds.length > 0) {
    invigParams.push(options.excludeRoomIds, startTime, endTime);
    invigExclusion = `AND NOT (eid.room_id = ANY($${invigParams.length - 2}::uuid[]) AND eid.start_time::text = $${invigParams.length - 1} AND eid.end_time::text = $${invigParams.length})`;
  }
  const { rows: invigilating } = await query<{ faculty_id: string; room_name: string; start_time: string; end_time: string }>(
    `SELECT eid.faculty_id, er.name AS room_name, eid.start_time::text, eid.end_time::text
     FROM exam_invigilation_duties eid JOIN exam_rooms er ON er.id = eid.room_id
     WHERE eid.faculty_id = ANY($1::uuid[]) AND eid.duty_date = $2 AND eid.status != 'Cancelled' AND eid.deleted_at IS NULL ${invigExclusion}`,
    invigParams
  );

  const userIds = faculty.map((f) => f.user_id);
  const { rows: calendarHits } = await query<{ created_by: string; title: string; start_date: string; end_date: string | null }>(
    `SELECT created_by, title, start_date::text, end_date::text
     FROM calendar_entries
     WHERE created_by = ANY($1::uuid[]) AND deleted_at IS NULL AND start_date::date = $2::date`,
    [userIds, date]
  );

  return faculty.map((f) => {
    if (f.status === 'on_leave') {
      return { facultyId: f.id, facultyName: f.full_name, state: 'unavailable', conflictReason: 'On leave', occupiedUntil: null };
    }

    const conductHit = conducting.find((c) => c.faculty_id === f.id && overlaps(c.start_time, c.end_time, startTime, endTime));
    if (conductHit) {
      return {
        facultyId: f.id, facultyName: f.full_name, state: 'unavailable',
        conflictReason: `Conducting ${conductHit.subject_code} exam`, occupiedUntil: conductHit.end_time,
      };
    }

    const invigHit = invigilating.find((i) => i.faculty_id === f.id && overlaps(i.start_time, i.end_time, startTime, endTime));
    if (invigHit) {
      return {
        facultyId: f.id, facultyName: f.full_name, state: 'unavailable',
        conflictReason: `Invigilating ${invigHit.room_name}`, occupiedUntil: invigHit.end_time,
      };
    }

    const calHit = calendarHits.find((c) => {
      if (c.created_by !== f.user_id) return false;
      const cStart = c.start_date.slice(11, 16) || '00:00';
      const cEnd = c.end_date ? c.end_date.slice(11, 16) : cStart;
      return overlaps(cStart, cEnd, startTime, endTime);
    });
    if (calHit) {
      const cEnd = calHit.end_date ? calHit.end_date.slice(11, 16) : calHit.start_date.slice(11, 16);
      return { facultyId: f.id, facultyName: f.full_name, state: 'unavailable', conflictReason: `Calendar: ${calHit.title}`, occupiedUntil: cEnd };
    }

    return { facultyId: f.id, facultyName: f.full_name, state: 'available', conflictReason: null, occupiedUntil: null };
  });
}

export async function suggestInvigilators(
  departmentId: string,
  date: string,
  startTime: string,
  endTime: string,
  count: number
): Promise<FacultyAvailability[]> {
  const { rows: candidates } = await query<{ id: string }>(
    `SELECT id FROM faculty WHERE department_id = $1 AND status != 'resigned' AND status != 'retired' AND deleted_at IS NULL`,
    [departmentId]
  );
  const availability = await listFacultyAvailability(candidates.map((c) => c.id), date, startTime, endTime);
  return availability.filter((a) => a.state === 'available').slice(0, count);
}
