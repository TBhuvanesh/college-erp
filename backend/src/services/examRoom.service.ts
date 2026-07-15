import { query } from '../config/database';
import { auditLog } from '../utils/audit';
import { AppError } from '../errors/AppError';
import { benchSeatCount } from '../types/examSeating';
import { listRoomsWithAvailability } from './resourceAvailability.service';
import type { ExamRoom, BenchType, CreateExamRoomInput, UpdateExamRoomInput, ListExamRoomsQuery, RoomAvailability } from '../types/examSeating';

interface ExamRoomRow {
  id: string;
  name: string;
  building: string | null;
  floor: string | null;
  room_number: string | null;
  capacity: number;
  rows: number | null;
  columns: number | null;
  bench_type: BenchType | null;
  notes: string | null;
  is_active: boolean;
  under_maintenance: boolean;
  maintenance_note: string | null;
  created_at: Date;
  updated_at: Date;
}

const COLS = `id, name, building, floor, room_number, capacity, rows, columns, bench_type, notes, is_active, under_maintenance, maintenance_note, created_at, updated_at`;

function toExamRoom(r: ExamRoomRow): ExamRoom {
  return {
    id: r.id,
    name: r.name,
    building: r.building,
    floor: r.floor,
    roomNumber: r.room_number,
    capacity: r.capacity,
    rows: r.rows,
    columns: r.columns,
    benchType: r.bench_type,
    notes: r.notes,
    isActive: r.is_active,
    underMaintenance: r.under_maintenance,
    maintenanceNote: r.maintenance_note,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

async function fetchRoomRow(id: string): Promise<ExamRoomRow | null> {
  const { rows } = await query<ExamRoomRow>(`SELECT ${COLS} FROM exam_rooms WHERE id = $1 AND deleted_at IS NULL`, [id]);
  return rows[0] ?? null;
}

export async function listExamRooms(filters: ListExamRoomsQuery): Promise<ExamRoom[]> {
  const conditions: string[] = ['deleted_at IS NULL'];
  const params: unknown[] = [];
  if (filters.isActive !== undefined) {
    params.push(filters.isActive === 'true');
    conditions.push(`is_active = $${params.length}`);
  }
  if (filters.hasGeometry === 'true') conditions.push('rows IS NOT NULL AND columns IS NOT NULL AND bench_type IS NOT NULL');
  if (filters.hasGeometry === 'false') conditions.push('(rows IS NULL OR columns IS NULL OR bench_type IS NULL)');

  const { rows } = await query<ExamRoomRow>(
    `SELECT ${COLS} FROM exam_rooms WHERE ${conditions.join(' AND ')} ORDER BY building NULLS LAST, floor NULLS LAST, name ASC`,
    params
  );
  return rows.map(toExamRoom);
}

export async function getExamRoomById(id: string): Promise<ExamRoom> {
  const row = await fetchRoomRow(id);
  if (!row) throw AppError.notFound('Exam room not found');
  return toExamRoom(row);
}

// ── Classroom Synchronization: Available / Occupied / Maintenance / Inactive ──
export async function listExamRoomsWithAvailability(date: string, startTime: string, endTime: string): Promise<RoomAvailability[]> {
  return listRoomsWithAvailability(date, startTime, endTime);
}

/** Full trio present and consistent, or none present at all (flat-capacity legacy mode). */
function assertGeometry(rows: number | null | undefined, columns: number | null | undefined, benchType: BenchType | null | undefined, capacity: number) {
  const provided = [rows, columns, benchType].filter((v) => v !== undefined && v !== null);
  if (provided.length === 0) return;
  if (provided.length < 3) {
    throw AppError.badRequest('rows, columns and benchType must be provided together (or not at all)', 'INCOMPLETE_GEOMETRY');
  }
  const computed = rows! * columns! * benchSeatCount(benchType!);
  if (computed < capacity) {
    throw AppError.badRequest(
      `rows x columns x bench seats (${computed}) is less than capacity (${capacity})`,
      'GEOMETRY_CAPACITY_MISMATCH'
    );
  }
}

export async function createExamRoom(userId: string, data: CreateExamRoomInput): Promise<ExamRoom> {
  assertGeometry(data.rows, data.columns, data.benchType, data.capacity);

  const { rows } = await query<{ id: string }>(
    `INSERT INTO exam_rooms (name, building, floor, room_number, capacity, rows, columns, bench_type, notes, is_active, under_maintenance, maintenance_note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
    [
      data.name,
      data.building ?? null,
      data.floor ?? null,
      data.roomNumber ?? null,
      data.capacity,
      data.rows ?? null,
      data.columns ?? null,
      data.benchType ?? null,
      data.notes ?? null,
      data.isActive,
      data.underMaintenance ?? false,
      data.maintenanceNote ?? null,
    ]
  );

  await auditLog({ actorId: userId, action: 'CREATE', resource: 'exam_room', resourceId: rows[0].id });

  const row = await fetchRoomRow(rows[0].id);
  return toExamRoom(row!);
}

export async function updateExamRoom(userId: string, id: string, data: UpdateExamRoomInput): Promise<ExamRoom> {
  const existing = await fetchRoomRow(id);
  if (!existing) throw AppError.notFound('Exam room not found');

  // Validate the MERGED (existing + incoming) geometry, since partial updates
  // can't be validated for cross-field consistency at the zod schema layer alone.
  const mergedRows = 'rows' in data ? data.rows : existing.rows;
  const mergedColumns = 'columns' in data ? data.columns : existing.columns;
  const mergedBenchType = 'benchType' in data ? data.benchType : existing.bench_type;
  const mergedCapacity = data.capacity ?? existing.capacity;
  assertGeometry(mergedRows, mergedColumns, mergedBenchType, mergedCapacity);

  const sets: string[] = [];
  const params: unknown[] = [];
  const push = (col: string, val: unknown) => {
    params.push(val);
    sets.push(`${col} = $${params.length}`);
  };

  if (data.name !== undefined) push('name', data.name);
  if ('building' in data) push('building', data.building ?? null);
  if ('floor' in data) push('floor', data.floor ?? null);
  if ('roomNumber' in data) push('room_number', data.roomNumber ?? null);
  if (data.capacity !== undefined) push('capacity', data.capacity);
  if ('rows' in data) push('rows', data.rows ?? null);
  if ('columns' in data) push('columns', data.columns ?? null);
  if ('benchType' in data) push('bench_type', data.benchType ?? null);
  if ('notes' in data) push('notes', data.notes ?? null);
  if (data.isActive !== undefined) push('is_active', data.isActive);
  if (data.underMaintenance !== undefined) push('under_maintenance', data.underMaintenance);
  if ('maintenanceNote' in data) push('maintenance_note', data.maintenanceNote ?? null);

  if (sets.length === 0) throw AppError.badRequest('No fields to update');

  params.push(id);
  await query(`UPDATE exam_rooms SET ${sets.join(', ')} WHERE id = $${params.length}`, params);

  await auditLog({ actorId: userId, action: 'UPDATE', resource: 'exam_room', resourceId: id, changes: data as Record<string, unknown> });

  const updated = await fetchRoomRow(id);
  return toExamRoom(updated!);
}

export async function deleteExamRoom(userId: string, id: string): Promise<void> {
  const existing = await fetchRoomRow(id);
  if (!existing) throw AppError.notFound('Exam room not found');

  const { rows: inUse } = await query<{ id: string }>(
    `SELECT id FROM exam_seat_allocations WHERE room_id = $1 AND deleted_at IS NULL LIMIT 1`,
    [id]
  );
  if (inUse[0]) {
    throw AppError.badRequest('Cannot delete a room with active seating allocations. Deactivate it instead.', 'ROOM_IN_USE');
  }

  await query('UPDATE exam_rooms SET deleted_at = NOW() WHERE id = $1', [id]);
  await auditLog({ actorId: userId, action: 'DELETE', resource: 'exam_room', resourceId: id });
}
