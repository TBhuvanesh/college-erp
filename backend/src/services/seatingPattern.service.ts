import { query } from '../config/database';
import { auditLog } from '../utils/audit';
import { AppError } from '../errors/AppError';
import type {
  SeatingPattern,
  SeatingPatternType,
  CreateSeatingPatternInput,
  UpdateSeatingPatternInput,
  ListSeatingPatternsQuery,
} from '../types/examSeating';

interface SeatingPatternRow {
  id: string;
  name: string;
  pattern_type: SeatingPatternType;
  department_sequence: string[];
  department_sequence_codes: string[] | null;
  is_default: boolean;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

const COLS = `
  sp.id, sp.name, sp.pattern_type, sp.department_sequence, sp.is_default, sp.created_by, sp.created_at, sp.updated_at,
  (SELECT array_agg(d.code ORDER BY array_position(sp.department_sequence, d.id))
   FROM departments d WHERE d.id = ANY(sp.department_sequence)) AS department_sequence_codes
`;

function toSeatingPattern(r: SeatingPatternRow): SeatingPattern {
  return {
    id: r.id,
    name: r.name,
    patternType: r.pattern_type,
    departmentSequence: r.department_sequence,
    departmentSequenceCodes: r.department_sequence_codes ?? [],
    isDefault: r.is_default,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

async function fetchPatternRow(id: string): Promise<SeatingPatternRow | null> {
  const { rows } = await query<SeatingPatternRow>(
    `SELECT ${COLS} FROM seating_patterns sp WHERE sp.id = $1 AND sp.deleted_at IS NULL`,
    [id]
  );
  return rows[0] ?? null;
}

export async function listSeatingPatterns(filters: ListSeatingPatternsQuery): Promise<SeatingPattern[]> {
  const conditions: string[] = ['sp.deleted_at IS NULL'];
  const params: unknown[] = [];
  if (filters.patternType) {
    params.push(filters.patternType);
    conditions.push(`sp.pattern_type = $${params.length}`);
  }

  const { rows } = await query<SeatingPatternRow>(
    `SELECT ${COLS} FROM seating_patterns sp WHERE ${conditions.join(' AND ')} ORDER BY sp.is_default DESC, sp.name ASC`,
    params
  );
  return rows.map(toSeatingPattern);
}

export async function getSeatingPatternById(id: string): Promise<SeatingPattern> {
  const row = await fetchPatternRow(id);
  if (!row) throw AppError.notFound('Seating pattern not found');
  return toSeatingPattern(row);
}

export async function createSeatingPattern(userId: string, data: CreateSeatingPatternInput): Promise<SeatingPattern> {
  if (data.patternType !== 'random' && data.departmentSequence.length === 0) {
    throw AppError.badRequest('departmentSequence is required for mid/semester/custom patterns', 'SEQUENCE_REQUIRED');
  }

  const { rows } = await query<{ id: string }>(
    `INSERT INTO seating_patterns (name, pattern_type, department_sequence, is_default, created_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [data.name, data.patternType, data.departmentSequence, data.isDefault, userId]
  );

  await auditLog({ actorId: userId, action: 'CREATE', resource: 'seating_pattern', resourceId: rows[0].id });

  const row = await fetchPatternRow(rows[0].id);
  return toSeatingPattern(row!);
}

export async function updateSeatingPattern(
  userId: string,
  id: string,
  data: UpdateSeatingPatternInput
): Promise<SeatingPattern> {
  const existing = await fetchPatternRow(id);
  if (!existing) throw AppError.notFound('Seating pattern not found');

  const sets: string[] = [];
  const params: unknown[] = [];
  const push = (col: string, val: unknown) => {
    params.push(val);
    sets.push(`${col} = $${params.length}`);
  };

  if (data.name !== undefined) push('name', data.name);
  if (data.departmentSequence !== undefined) push('department_sequence', data.departmentSequence);
  if (data.isDefault !== undefined) push('is_default', data.isDefault);

  if (sets.length === 0) throw AppError.badRequest('No fields to update');

  params.push(id);
  await query(`UPDATE seating_patterns SET ${sets.join(', ')} WHERE id = $${params.length}`, params);

  await auditLog({ actorId: userId, action: 'UPDATE', resource: 'seating_pattern', resourceId: id, changes: data as Record<string, unknown> });

  const updated = await fetchPatternRow(id);
  return toSeatingPattern(updated!);
}

export async function deleteSeatingPattern(userId: string, id: string): Promise<void> {
  const existing = await fetchPatternRow(id);
  if (!existing) throw AppError.notFound('Seating pattern not found');

  await query('UPDATE seating_patterns SET deleted_at = NOW() WHERE id = $1', [id]);
  await auditLog({ actorId: userId, action: 'DELETE', resource: 'seating_pattern', resourceId: id });
}

// ── Allocation-order engine ───────────────────────────────────────────────────
// Generalizes the original "interleave by exam" round-robin into "interleave by
// configured department sequence" — exam-based interleave is the implicit
// fallback when no pattern is supplied, so the pre-existing behavior of
// examSeating.service.ts is preserved exactly when callers don't opt in.

export interface PatternableStudent {
  studentId: string;
  rollNumber: string;
  studentName: string;
  examId: string;
  subjectCode: string;
  examType: string;
  departmentId: string;
}

function interleaveByExam(students: PatternableStudent[]): PatternableStudent[] {
  const byExam = new Map<string, PatternableStudent[]>();
  for (const s of students) {
    if (!byExam.has(s.examId)) byExam.set(s.examId, []);
    byExam.get(s.examId)!.push(s);
  }
  const rosters = Array.from(byExam.values());
  const result: PatternableStudent[] = [];
  const maxLen = Math.max(0, ...rosters.map((r) => r.length));
  for (let i = 0; i < maxLen; i++) {
    for (const roster of rosters) {
      if (roster[i]) result.push(roster[i]);
    }
  }
  return result;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function applySeatingPattern(
  students: PatternableStudent[],
  pattern: { patternType: SeatingPatternType; departmentSequence: string[] } | null
): PatternableStudent[] {
  if (!pattern) return interleaveByExam(students);
  if (pattern.patternType === 'random') return shuffle(students);

  const queues = new Map<string, PatternableStudent[]>();
  for (const s of students) {
    if (!queues.has(s.departmentId)) queues.set(s.departmentId, []);
    queues.get(s.departmentId)!.push(s);
  }

  // Departments present in the roster but missing from the configured sequence
  // are appended to the cycle so nobody is silently dropped from seating.
  const cycle = [
    ...pattern.departmentSequence,
    ...Array.from(queues.keys()).filter((d) => !pattern.departmentSequence.includes(d)),
  ];
  if (cycle.length === 0) return students;

  const result: PatternableStudent[] = [];
  let remaining = students.length;
  let cursor = 0;
  // Bounded: `remaining` only decrements on a real placement, and every
  // department with students is guaranteed to appear somewhere in `cycle`,
  // so the cursor always reaches a non-empty queue within one full lap.
  while (remaining > 0) {
    const deptId = cycle[cursor % cycle.length];
    const queue = queues.get(deptId);
    if (queue && queue.length > 0) {
      result.push(queue.shift()!);
      remaining--;
    }
    cursor++;
  }
  return result;
}
