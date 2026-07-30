import { query, withTransaction } from '../config/database';
import { AppError } from '../errors/AppError';
import {
  CreateTimetableInput,
  UpdateTimetableInput,
  TimetableDetail,
  TimetableStatus,
  ClassType,
  TimetableSlotType,
} from '../types/timetable';
import { auditLog } from '../utils/audit';

// Helper to convert HH:MM:SS or HH:MM to seconds for overlap checks
function timeToSeconds(timeStr: string): number {
  const parts = timeStr.split(':').map(Number);
  const hrs = parts[0] || 0;
  const mins = parts[1] || 0;
  const secs = parts[2] || 0;
  return hrs * 3600 + mins * 60 + secs;
}

// Check if two time ranges overlap
function rangesOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  const s1 = timeToSeconds(start1);
  const e1 = timeToSeconds(end1);
  const s2 = timeToSeconds(start2);
  const e2 = timeToSeconds(end2);
  return s1 < e2 && s2 < e1;
}

// ── Read operations ───────────────────────────────────────────────────────────

export async function getTimetableById(id: string): Promise<TimetableDetail> {
  const { rows: ttRows } = await query<any>(
    `SELECT t.id, t.academic_year, t.department_id, d.name AS department_name, d.code AS department_code,
            t.program_id, p.name AS program_name, t.year, t.semester, t.section, t.room_number,
            t.status, t.working_days, t.version, t.effective_from, t.created_by, t.created_at, t.updated_at
     FROM timetables t
     JOIN departments d ON d.id = t.department_id
     LEFT JOIN programs p ON p.id = t.program_id
     WHERE t.id = $1 AND t.deleted_at IS NULL`,
    [id]
  );
  if (!ttRows[0]) throw AppError.notFound('Timetable not found');
  const tt = ttRows[0];

  // Fetch slots
  const { rows: slotRows } = await query<any>(
    `SELECT id, start_time::text AS start_time, end_time::text AS end_time, slot_type, sequence_order
     FROM timetable_slots
     WHERE timetable_id = $1
     ORDER BY sequence_order ASC`,
    [id]
  );

  // Fetch entries
  const { rows: entryRows } = await query<any>(
    `SELECT te.id, te.day_of_week, te.subject_id, s.code AS subject_code, s.name AS subject_name,
            s.abbreviation AS subject_abbreviation, te.class_type
     FROM timetable_entries te
     JOIN subjects s ON s.id = te.subject_id
     WHERE te.timetable_id = $1`,
    [id]
  );

  const entries: any[] = [];
  for (const entry of entryRows) {
    // Fetch slots mapped to this entry
    const { rows: mappedSlots } = await query<any>(
      `SELECT s.id, s.start_time::text AS start_time, s.end_time::text AS end_time, s.sequence_order, s.slot_type
       FROM timetable_entry_slots tes
       JOIN timetable_slots s ON s.id = tes.slot_id
       WHERE tes.entry_id = $1
       ORDER BY s.sequence_order ASC`,
      [entry.id]
    );

    // Fetch faculty mapped to this entry
    const { rows: mappedFaculty } = await query<any>(
      `SELECT f.id, f.full_name, f.employee_number
       FROM timetable_entry_faculty tef
       JOIN faculty f ON f.id = tef.faculty_id
       WHERE tef.entry_id = $1`,
      [entry.id]
    );

    entries.push({
      id: entry.id,
      dayOfWeek: entry.day_of_week,
      subjectId: entry.subject_id,
      subjectCode: entry.subject_code,
      subjectName: entry.subject_name,
      subjectAbbreviation: entry.subject_abbreviation || entry.subject_code,
      classType: entry.class_type as ClassType,
      slots: mappedSlots.map((ms) => ({
        id: ms.id,
        startTime: ms.start_time,
        endTime: ms.end_time,
        sequenceOrder: ms.sequence_order,
        slotType: ms.slot_type as TimetableSlotType,
      })),
      faculties: mappedFaculty.map((mf) => ({
        id: mf.id,
        fullName: mf.full_name,
        employeeNumber: mf.employee_number,
      })),
    });
  }

  return {
    id: tt.id,
    academicYear: tt.academic_year,
    departmentId: tt.department_id,
    departmentName: tt.department_name,
    departmentCode: tt.department_code,
    programId: tt.program_id,
    programName: tt.program_name,
    year: tt.year,
    semester: Number(tt.semester),
    section: tt.section,
    roomNumber: tt.room_number,
    status: tt.status as TimetableStatus,
    workingDays: tt.working_days,
    version: Number(tt.version),
    effectiveFrom: tt.effective_from ? new Date(tt.effective_from).toISOString().slice(0, 10) : null,
    createdBy: tt.created_by,
    createdAt: tt.created_at,
    updatedAt: tt.updated_at,
    slots: slotRows.map((s) => ({
      id: s.id,
      startTime: s.start_time,
      endTime: s.end_time,
      slotType: s.slot_type as TimetableSlotType,
      sequenceOrder: s.sequence_order,
    })),
    entries,
  };
}

export async function listTimetables(filters: {
  academicYear?: string;
  departmentId?: string;
  year?: string;
  semester?: number;
  section?: string;
  status?: TimetableStatus;
}): Promise<any[]> {
  const conditions: string[] = ['t.deleted_at IS NULL'];
  const params: any[] = [];

  const push = (col: string, val: any) => {
    params.push(val);
    conditions.push(`${col} = $${params.length}`);
  };

  if (filters.academicYear) push('t.academic_year', filters.academicYear);
  if (filters.departmentId) push('t.department_id', filters.departmentId);
  if (filters.year) push('t.year', filters.year);
  if (filters.semester) push('t.semester', filters.semester);
  if (filters.section) push('t.section', filters.section);
  if (filters.status) push('t.status', filters.status);

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await query<any>(
    `SELECT t.id, t.academic_year, t.department_id, d.name AS department_name, d.code AS department_code,
            t.program_id, p.name AS program_name, t.year, t.semester, t.section, t.room_number,
            t.status, t.working_days, t.version, t.effective_from, t.created_at, t.updated_at
     FROM timetables t
     JOIN departments d ON d.id = t.department_id
     LEFT JOIN programs p ON p.id = t.program_id
     ${where}
     ORDER BY t.academic_year DESC, d.code ASC, t.semester ASC, t.section ASC, t.version DESC`,
    params
  );
  return rows.map((r) => ({
    id: r.id,
    academicYear: r.academic_year,
    departmentId: r.department_id,
    departmentName: r.department_name,
    departmentCode: r.department_code,
    programId: r.program_id,
    programName: r.program_name,
    year: r.year,
    semester: Number(r.semester),
    section: r.section,
    roomNumber: r.room_number,
    status: r.status,
    workingDays: r.working_days,
    version: r.version,
    effectiveFrom: r.effective_from ? new Date(r.effective_from).toISOString().slice(0, 10) : null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

// ── Validation & Conflict Detection ──────────────────────────────────────────

export interface ValidationError {
  type: 'error' | 'warning';
  code: string;
  message: string;
  meta?: any;
}

export async function validateTimetableDetails(
  data: CreateTimetableInput,
  excludeTimetableId?: string
): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];

  // 1. Time Overlap (among slots configuration)
  const slots = [...data.slots].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  for (let i = 0; i < slots.length; i++) {
    if (slots[i].startTime >= slots[i].endTime) {
      errors.push({
        type: 'error',
        code: 'INVALID_SLOT_TIME',
        message: `Slot ${slots[i].sequenceOrder} (${slots[i].startTime}-${slots[i].endTime}) has invalid duration (end time must be after start time)`,
      });
    }
    for (let j = i + 1; j < slots.length; j++) {
      if (rangesOverlap(slots[i].startTime, slots[i].endTime, slots[j].startTime, slots[j].endTime)) {
        errors.push({
          type: 'error',
          code: 'SLOT_OVERLAP',
          message: `Slot ${slots[i].sequenceOrder} (${slots[i].startTime}-${slots[i].endTime}) overlaps with Slot ${slots[j].sequenceOrder} (${slots[j].startTime}-${slots[j].endTime})`,
        });
      }
    }
  }

  // 2. Class Conflict: same section cannot have overlapping classes on the same day
  // Since we map entries to slots using slotSequenceOrders:
  // Two entries conflict on the same day if they share any slot sequence order!
  const entries = data.entries || [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      if (entries[i].dayOfWeek === entries[j].dayOfWeek) {
        const sharedSlots = entries[i].slotSequenceOrders.filter((s) =>
          entries[j].slotSequenceOrders.includes(s)
        );
        if (sharedSlots.length > 0) {
          errors.push({
            type: 'error',
            code: 'CLASS_CONFLICT',
            message: `Section has duplicate/overlapping session on ${entries[i].dayOfWeek} at Slot(s) ${sharedSlots.join(', ')}`,
            meta: { day: entries[i].dayOfWeek, slots: sharedSlots },
          });
        }
      }
    }
  }

  // 3. Subject curriculum context validation
  for (const entry of entries) {
    const { rows: scmRows } = await query(
      `SELECT id FROM subject_curriculum_mappings
       WHERE subject_id = $1 AND department_id = $2 AND semester = $3 AND deleted_at IS NULL`,
      [entry.subjectId, data.departmentId, data.semester]
    );
    if (scmRows.length === 0) {
      errors.push({
        type: 'error',
        code: 'INVALID_SUBJECT',
        message: `Subject ID ${entry.subjectId} is not in the curriculum mapping for Department ID ${data.departmentId} and Semester ${data.semester}`,
      });
    }
  }

  // 4. Faculty teaching allocation eligibility warnings
  for (const entry of entries) {
    for (const facultyId of entry.facultyIds) {
      const { rows: assignmentRows } = await query(
        `SELECT id FROM teaching_assignments
         WHERE faculty_id = $1 AND subject_id = $2 AND section = $3 AND academic_year = $4 AND deleted_at IS NULL AND is_active = TRUE`,
        [facultyId, entry.subjectId, data.section, data.academicYear]
      );
      if (assignmentRows.length === 0) {
        // Query faculty name and subject code for warning message
        const { rows: infoRows } = await query<any>(
          `SELECT f.full_name, s.code FROM faculty f, subjects s WHERE f.id = $1 AND s.id = $2`,
          [facultyId, entry.subjectId]
        );
        const facName = infoRows[0]?.full_name || facultyId;
        const subCode = infoRows[0]?.code || entry.subjectId;
        errors.push({
          type: 'warning',
          code: 'UNALLOCATED_FACULTY',
          message: `Faculty member ${facName} is not allocated to teach subject ${subCode} in Section ${data.section} for academic year ${data.academicYear}`,
          meta: { facultyId, subjectId: entry.subjectId },
        });
      }
    }
  }

  // 5. Faculty Conflict: Same faculty cannot teach two classes at the same time
  // Query all other published timetable slots of this academic year
  const facultyTimetableSlotsQuery = `
    SELECT t.section, t.semester, d.code AS department_code, te.day_of_week, ts.start_time::text AS start_time, ts.end_time::text AS end_time,
           f.full_name AS faculty_name, f.id AS faculty_id, sub.code AS subject_code
    FROM timetable_entry_faculty tef
    JOIN timetable_entries te ON te.id = tef.entry_id
    JOIN timetables t ON t.id = te.timetable_id
    JOIN timetable_entry_slots tes ON tes.entry_id = te.id
    JOIN timetable_slots ts ON ts.id = tes.slot_id
    JOIN faculty f ON f.id = tef.faculty_id
    JOIN subjects sub ON sub.id = te.subject_id
    JOIN departments d ON d.id = t.department_id
    WHERE t.academic_year = $1
      AND t.status = 'published'
      AND t.id != COALESCE($2::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
      AND t.deleted_at IS NULL
  `;
  const { rows: otherSlots } = await query<any>(facultyTimetableSlotsQuery, [
    data.academicYear,
    excludeTimetableId || null,
  ]);

  for (const entry of entries) {
    // Map our entry sequence orders to start/end times
    const entryTimes = entry.slotSequenceOrders.map((seq) => {
      const slot = data.slots.find((s) => s.sequenceOrder === seq);
      return slot ? { start: slot.startTime, end: slot.endTime } : null;
    }).filter(Boolean) as Array<{ start: string; end: string }>;

    for (const facultyId of entry.facultyIds) {
      // Find other published timetables where this faculty teaches
      const matchingFacultySlots = otherSlots.filter((os) => os.faculty_id === facultyId);

      for (const entryTime of entryTimes) {
        for (const os of matchingFacultySlots) {
          if (os.day_of_week === entry.dayOfWeek) {
            if (rangesOverlap(entryTime.start, entryTime.end, os.start_time, os.end_time)) {
              errors.push({
                type: 'error',
                code: 'FACULTY_CONFLICT',
                message: `Faculty member ${os.faculty_name} is already teaching ${os.subject_code} in ${os.department_code} Sem ${os.semester}-${os.section} on ${entry.dayOfWeek} at ${os.start_time}-${os.end_time}`,
                meta: { facultyId, day: entry.dayOfWeek, time: `${entryTime.start}-${entryTime.end}` },
              });
            }
          }
        }
      }
    }
  }

  return errors;
}

// ── Write operations ──────────────────────────────────────────────────────────

export async function createTimetable(
  data: CreateTimetableInput,
  creatorId: string
): Promise<TimetableDetail> {
  // Validate department exists
  const { rows: deptRows } = await query('SELECT id FROM departments WHERE id = $1 AND deleted_at IS NULL', [data.departmentId]);
  if (deptRows.length === 0) throw AppError.notFound('Department not found');

  // If validation errors are present, they are stored, but block publish. We allow saving draft.
  const timetableId = await withTransaction<string>(async (client) => {
    // 1. Insert timetable
    const ttRes = await client.query<{ id: string }>(
      `INSERT INTO timetables (
         academic_year, department_id, program_id, year, semester, section, room_number, working_days, effective_from, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [
        data.academicYear,
        data.departmentId,
        data.programId || null,
        data.year,
        data.semester,
        data.section,
        data.roomNumber || null,
        data.workingDays,
        data.effectiveFrom || null,
        creatorId,
      ]
    );
    const id = ttRes.rows[0].id;

    // 2. Insert slots & keep track of sequenceOrder -> slotId map
    const slotMap = new Map<number, string>();
    for (const slot of data.slots) {
      const slotRes = await client.query<{ id: string }>(
        `INSERT INTO timetable_slots (timetable_id, start_time, end_time, slot_type, sequence_order)
         VALUES ($1, $2::time, $3::time, $4, $5) RETURNING id`,
        [id, slot.startTime, slot.endTime, slot.slotType, slot.sequenceOrder]
      );
      slotMap.set(slot.sequenceOrder, slotRes.rows[0].id);
    }

    // 3. Insert entries
    for (const entry of data.entries) {
      const entryRes = await client.query<{ id: string }>(
        `INSERT INTO timetable_entries (timetable_id, day_of_week, subject_id, class_type)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [id, entry.dayOfWeek, entry.subjectId, entry.classType]
      );
      const entryId = entryRes.rows[0].id;

      // Map entry slots
      for (const seq of entry.slotSequenceOrders) {
        const slotId = slotMap.get(seq);
        if (!slotId) {
          throw AppError.badRequest(`Invalid slot sequence order ${seq} referenced in entries`);
        }
        await client.query(
          `INSERT INTO timetable_entry_slots (entry_id, slot_id) VALUES ($1, $2)`,
          [entryId, slotId]
        );
      }

      // Map entry faculty
      for (const facultyId of entry.facultyIds) {
        await client.query(
          `INSERT INTO timetable_entry_faculty (entry_id, faculty_id) VALUES ($1, $2)`,
          [entryId, facultyId]
        );
      }
    }

    return id;
  });

  await auditLog({
    actorId: creatorId,
    action: 'CREATE_TIMETABLE',
    resource: 'timetables',
    resourceId: timetableId,
    changes: { academicYear: data.academicYear, section: data.section },
  });

  return getTimetableById(timetableId);
}

export async function updateTimetable(
  id: string,
  data: UpdateTimetableInput,
  actorId: string
): Promise<TimetableDetail> {
  const current = await getTimetableById(id);

  if (current.status === 'archived') {
    throw AppError.badRequest('Archived timetables cannot be modified');
  }

  // Versioning & safe edits on PUBLISHED timetables:
  if (current.status === 'published' && data.status !== 'archived') {
    // Edits to a published timetable: Create a new version, copy and merge fields, set status to published, archive the old one!
    const mergedData: CreateTimetableInput = {
      academicYear: current.academicYear,
      departmentId: current.departmentId,
      programId: current.programId,
      year: current.year as any,
      semester: current.semester,
      section: current.section,
      roomNumber: data.roomNumber !== undefined ? data.roomNumber : current.roomNumber,
      workingDays: data.workingDays !== undefined ? data.workingDays : current.workingDays,
      slots: data.slots !== undefined ? data.slots : current.slots,
      effectiveFrom: data.effectiveFrom !== undefined ? data.effectiveFrom : current.effectiveFrom,
      entries: data.entries !== undefined ? data.entries : current.entries.map((e) => ({
        dayOfWeek: e.dayOfWeek as any,
        subjectId: e.subjectId,
        classType: e.classType,
        slotSequenceOrders: e.slots.map((s) => s.sequenceOrder),
        facultyIds: e.faculties.map((f) => f.id),
      })),
    };

    // Validate the new version details for conflicts
    const validationErrors = await validateTimetableDetails(mergedData, id);
    if (validationErrors.some((v) => v.type === 'error')) {
      const err = AppError.badRequest('Timetable update failed due to conflict validation errors', 'CONFLICT_ERRORS');
      (err as any).details = validationErrors;
      throw err;
    }

    const newTimetableId = await withTransaction<string>(async (client) => {
      // 1. Archive the previous version
      await client.query(
        `UPDATE timetables SET status = 'archived', updated_at = NOW() WHERE id = $1`,
        [id]
      );

      // 2. Insert new version timetable with version incremented
      const ttRes = await client.query<{ id: string }>(
        `INSERT INTO timetables (
           academic_year, department_id, program_id, year, semester, section, room_number, working_days, version, status, effective_from, created_by
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'published', $10, $11) RETURNING id`,
        [
          mergedData.academicYear,
          mergedData.departmentId,
          mergedData.programId,
          mergedData.year,
          mergedData.semester,
          mergedData.section,
          mergedData.roomNumber,
          mergedData.workingDays,
          current.version + 1,
          mergedData.effectiveFrom,
          actorId,
        ]
      );
      const newId = ttRes.rows[0].id;

      // 3. Insert slots
      const slotMap = new Map<number, string>();
      for (const slot of mergedData.slots) {
        const slotRes = await client.query<{ id: string }>(
          `INSERT INTO timetable_slots (timetable_id, start_time, end_time, slot_type, sequence_order)
           VALUES ($1, $2::time, $3::time, $4, $5) RETURNING id`,
          [newId, slot.startTime, slot.endTime, slot.slotType, slot.sequenceOrder]
        );
        slotMap.set(slot.sequenceOrder, slotRes.rows[0].id);
      }

      // 4. Insert entries
      for (const entry of mergedData.entries) {
        const entryRes = await client.query<{ id: string }>(
          `INSERT INTO timetable_entries (timetable_id, day_of_week, subject_id, class_type)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [newId, entry.dayOfWeek, entry.subjectId, entry.classType]
        );
        const entryId = entryRes.rows[0].id;

        for (const seq of entry.slotSequenceOrders) {
          const slotId = slotMap.get(seq);
          if (!slotId) throw AppError.badRequest(`Invalid slot sequence order ${seq}`);
          await client.query(
            `INSERT INTO timetable_entry_slots (entry_id, slot_id) VALUES ($1, $2)`,
            [entryId, slotId]
          );
        }

        for (const facultyId of entry.facultyIds) {
          await client.query(
            `INSERT INTO timetable_entry_faculty (entry_id, faculty_id) VALUES ($1, $2)`,
            [entryId, facultyId]
          );
        }
      }

      return newId;
    });

    await auditLog({
      actorId,
      action: 'UPDATE_TIMETABLE_VERSION',
      resource: 'timetables',
      resourceId: newTimetableId,
      changes: { newVersion: current.version + 1, previousId: id },
    });

    return getTimetableById(newTimetableId);
  }

  // If it's a DRAFT or status changed to archived:
  const updatedId = await withTransaction<string>(async (client) => {
    // 1. Update basic fields if draft
    const sets: string[] = [];
    const params: any[] = [];
    const pushSet = (col: string, val: any) => {
      params.push(val);
      sets.push(`${col} = $${params.length}`);
    };

    if (data.roomNumber !== undefined) pushSet('room_number', data.roomNumber);
    if (data.workingDays !== undefined) pushSet('working_days', data.workingDays);
    if (data.effectiveFrom !== undefined) pushSet('effective_from', data.effectiveFrom);
    if (data.status !== undefined) pushSet('status', data.status);

    if (sets.length > 0) {
      params.push(id);
      await client.query(
        `UPDATE timetables SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`,
        params
      );
    }

    // 2. Re-create slots and entries if they changed AND status is draft
    if (current.status === 'draft') {
      if (data.slots !== undefined) {
        // Clear slots (cascades to entries/joins)
        await client.query('DELETE FROM timetable_slots WHERE timetable_id = $1', [id]);
        
        const slotMap = new Map<number, string>();
        for (const slot of data.slots) {
          const slotRes = await client.query<{ id: string }>(
            `INSERT INTO timetable_slots (timetable_id, start_time, end_time, slot_type, sequence_order)
             VALUES ($1, $2::time, $3::time, $4, $5) RETURNING id`,
            [id, slot.startTime, slot.endTime, slot.slotType, slot.sequenceOrder]
          );
          slotMap.set(slot.sequenceOrder, slotRes.rows[0].id);
        }

        // Re-insert entries since slots was cleared
        const entriesToUse = data.entries !== undefined ? data.entries : current.entries.map((e) => ({
          dayOfWeek: e.dayOfWeek as any,
          subjectId: e.subjectId,
          classType: e.classType,
          slotSequenceOrders: e.slots.map((s) => s.sequenceOrder),
          facultyIds: e.faculties.map((f) => f.id),
        }));

        for (const entry of entriesToUse) {
          const entryRes = await client.query<{ id: string }>(
            `INSERT INTO timetable_entries (timetable_id, day_of_week, subject_id, class_type)
             VALUES ($1, $2, $3, $4) RETURNING id`,
            [id, entry.dayOfWeek, entry.subjectId, entry.classType]
          );
          const entryId = entryRes.rows[0].id;

          for (const seq of entry.slotSequenceOrders) {
            const slotId = slotMap.get(seq);
            if (!slotId) throw AppError.badRequest(`Invalid slot sequence order ${seq}`);
            await client.query(
              `INSERT INTO timetable_entry_slots (entry_id, slot_id) VALUES ($1, $2)`,
              [entryId, slotId]
            );
          }

          for (const facultyId of entry.facultyIds) {
            await client.query(
              `INSERT INTO timetable_entry_faculty (entry_id, faculty_id) VALUES ($1, $2)`,
              [entryId, facultyId]
            );
          }
        }
      } else if (data.entries !== undefined) {
        // Clear entries only
        await client.query('DELETE FROM timetable_entries WHERE timetable_id = $1', [id]);

        // Load slots again to get mapping IDs
        const { rows: currentSlots } = await client.query<{ id: string; sequence_order: number }>(
          'SELECT id, sequence_order FROM timetable_slots WHERE timetable_id = $1',
          [id]
        );
        const slotMap = new Map<number, string>(currentSlots.map((s) => [s.sequence_order, s.id]));

        for (const entry of data.entries) {
          const entryRes = await client.query<{ id: string }>(
            `INSERT INTO timetable_entries (timetable_id, day_of_week, subject_id, class_type)
             VALUES ($1, $2, $3, $4) RETURNING id`,
            [id, entry.dayOfWeek, entry.subjectId, entry.classType]
          );
          const entryId = entryRes.rows[0].id;

          for (const seq of entry.slotSequenceOrders) {
            const slotId = slotMap.get(seq);
            if (!slotId) throw AppError.badRequest(`Invalid slot sequence order ${seq}`);
            await client.query(
              `INSERT INTO timetable_entry_slots (entry_id, slot_id) VALUES ($1, $2)`,
              [entryId, slotId]
            );
          }

          for (const facultyId of entry.facultyIds) {
            await client.query(
              `INSERT INTO timetable_entry_faculty (entry_id, faculty_id) VALUES ($1, $2)`,
              [entryId, facultyId]
            );
          }
        }
      }
    }

    return id;
  });

  await auditLog({
    actorId,
    action: 'UPDATE_TIMETABLE',
    resource: 'timetables',
    resourceId: updatedId,
    changes: data,
  });

  return getTimetableById(updatedId);
}

export async function deleteTimetable(id: string, actorId: string): Promise<void> {
  const current = await getTimetableById(id);
  
  await query(
    `UPDATE timetables SET deleted_at = NOW(), status = 'archived' WHERE id = $1`,
    [id]
  );

  await auditLog({
    actorId,
    action: 'DELETE_TIMETABLE',
    resource: 'timetables',
    resourceId: id,
    changes: { previousStatus: current.status },
  });
}

// ── Publish flow ──────────────────────────────────────────────────────────────

export async function publishTimetable(id: string, effectiveFrom: string, actorId: string): Promise<TimetableDetail> {
  const current = await getTimetableById(id);

  // Validate for conflicts before allowing publication
  const dataInput: CreateTimetableInput = {
    academicYear: current.academicYear,
    departmentId: current.departmentId,
    programId: current.programId,
    year: current.year as any,
    semester: current.semester,
    section: current.section,
    roomNumber: current.roomNumber,
    workingDays: current.workingDays,
    slots: current.slots,
    entries: current.entries.map((e) => ({
      dayOfWeek: e.dayOfWeek as any,
      subjectId: e.subjectId,
      classType: e.classType,
      slotSequenceOrders: e.slots.map((s) => s.sequenceOrder),
      facultyIds: e.faculties.map((f) => f.id),
    })),
    effectiveFrom,
  };

  const validationErrors = await validateTimetableDetails(dataInput, id);
  const errors = validationErrors.filter((v) => v.type === 'error');
  if (errors.length > 0) {
    const err = AppError.badRequest('Timetable contains conflict errors and cannot be published', 'CONFLICT_ERRORS');
    (err as any).details = validationErrors;
    throw err;
  }

  await withTransaction(async (client) => {
    // 1. Archive other published timetables for the same academic group
    await client.query(
      `UPDATE timetables
       SET status = 'archived', updated_at = NOW()
       WHERE academic_year = $1 AND department_id = $2 AND year = $3 AND semester = $4 AND section = $5
         AND status = 'published' AND id != $6`,
      [current.academicYear, current.departmentId, current.year, current.semester, current.section, id]
    );

    // 2. Set this timetable to published
    await client.query(
      `UPDATE timetables
       SET status = 'published', effective_from = $1::date, updated_at = NOW()
       WHERE id = $2`,
      [effectiveFrom, id]
    );
  });

  await auditLog({
    actorId,
    action: 'PUBLISH_TIMETABLE',
    resource: 'timetables',
    resourceId: id,
    changes: { effectiveFrom },
  });

  return getTimetableById(id);
}

// ── Student timetable query ───────────────────────────────────────────────────

export async function getTimetableForStudent(userId: string): Promise<TimetableDetail | null> {
  const studentProfileRes = await query<any>(
    `SELECT department_id, semester, section, academic_year
     FROM students
     WHERE user_id = $1 AND deleted_at IS NULL`,
    [userId]
  );
  const studentProfile = studentProfileRes?.rows || [];
  if (!studentProfile[0]) return null;

  const sp = studentProfile[0];
  const ttRowsRes = await query<{ id: string }>(
    `SELECT id FROM timetables
     WHERE academic_year = $1 AND department_id = $2 AND semester = $3 AND section = $4
       AND status = 'published' AND deleted_at IS NULL
     ORDER BY version DESC, created_at DESC LIMIT 1`,
    [sp.academic_year, sp.department_id, sp.semester, sp.section]
  );
  const ttRows = ttRowsRes?.rows || [];
  if (!ttRows[0]) return null;

  return getTimetableById(ttRows[0].id);
}

// ── Faculty timetable query ───────────────────────────────────────────────────

export async function getTimetableForFaculty(userId: string): Promise<any> {
  const facProfileRes = await query<any>(
    `SELECT id, full_name, employee_number FROM faculty WHERE user_id = $1 AND deleted_at IS NULL`,
    [userId]
  );
  const facProfile = facProfileRes?.rows || [];
  if (!facProfile[0]) return null;

  const facultyId = facProfile[0].id;

  // Retrieve all entry-slots where this faculty member is assigned in active published timetables
  const entrySlotsRes = await query<any>(
    `SELECT t.id AS timetable_id, t.academic_year, t.section, t.semester, t.room_number, d.code AS department_code, t.department_id,
            te.id AS entry_id, te.day_of_week, te.class_type,
            sub.id AS subject_id, sub.code AS subject_code, sub.name AS subject_name, sub.abbreviation AS subject_abbreviation,
            ts.id AS slot_id, ts.start_time::text AS start_time, ts.end_time::text AS end_time, ts.sequence_order, ts.slot_type
     FROM timetable_entry_faculty tef
     JOIN timetable_entries te ON te.id = tef.entry_id
     JOIN timetables t ON t.id = te.timetable_id
     JOIN subjects sub ON sub.id = te.subject_id
     JOIN departments d ON d.id = t.department_id
     JOIN timetable_entry_slots tes ON tes.entry_id = te.id
     JOIN timetable_slots ts ON ts.id = tes.slot_id
     WHERE tef.faculty_id = $1
       AND t.status = 'published'
       AND t.deleted_at IS NULL
     ORDER BY te.day_of_week ASC, ts.start_time ASC`,
    [facultyId]
  );
  const entrySlots = entrySlotsRes?.rows || [];

  // Group by day of week and entry
  const grouped: Record<string, any[]> = {
    Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: []
  };

  // Find unique entries and their slots/meta
  const entriesMap = new Map<string, any>();
  for (const row of entrySlots) {
    if (!entriesMap.has(row.entry_id)) {
      entriesMap.set(row.entry_id, {
        id: row.entry_id,
        timetableId: row.timetable_id,
        departmentId: row.department_id,
        academicYear: row.academic_year,
        departmentCode: row.department_code,
        semester: Number(row.semester),
        section: row.section,
        roomNumber: row.room_number,
        dayOfWeek: row.day_of_week,
        classType: row.class_type,
        subjectId: row.subject_id,
        subjectCode: row.subject_code,
        subjectName: row.subject_name,
        subjectAbbreviation: row.subject_abbreviation || row.subject_code,
        slots: [],
      });
    }

    const entry = entriesMap.get(row.entry_id);
    entry.slots.push({
      id: row.slot_id,
      startTime: row.start_time,
      endTime: row.end_time,
      sequenceOrder: row.sequence_order,
      slotType: row.slot_type,
    });
  }

  for (const entry of entriesMap.values()) {
    grouped[entry.dayOfWeek].push(entry);
  }

  return {
    faculty: {
      id: facultyId,
      fullName: facProfile[0].full_name,
      employeeNumber: facProfile[0].employee_number,
    },
    schedule: grouped,
  };
}

// ── Today's classes helper ────────────────────────────────────────────────────

export async function getTodayClassesForStudent(userId: string): Promise<any[]> {
  const timetable = await getTimetableForStudent(userId);
  if (!timetable) return [];

  // Check if today is a holiday
  const { rows: holidayCheck } = await query(
    `SELECT 1 FROM academic_calendar_events
     WHERE event_type = 'Holiday'
       AND (CURRENT_DATE BETWEEN start_date AND COALESCE(end_date, start_date))
       AND (target_audience = 'All' OR target_audience = 'Students' OR department_id = $1)
       AND deleted_at IS NULL AND publish_status != 'Archived'`,
    [timetable.departmentId]
  );
  if (holidayCheck.length > 0) return []; // Today is a holiday

  const todayDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const entries = timetable.entries.filter((e) => e.dayOfWeek === todayDay);

  return entries.map((e) => ({
    id: e.id,
    subjectCode: e.subjectCode,
    subjectName: e.subjectName,
    subjectAbbreviation: e.subjectAbbreviation,
    classType: e.classType,
    time: e.slots.map((s) => s.startTime.slice(0, 5) + ' - ' + s.endTime.slice(0, 5)).join(', '),
    startTime: e.slots[0]?.startTime,
    endTime: e.slots[e.slots.length - 1]?.endTime,
    room: timetable.roomNumber,
    faculties: e.faculties.map((f) => f.fullName).join(', '),
  })).sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
}

export async function getTodayClassesForFaculty(userId: string): Promise<any[]> {
  const scheduleData = await getTimetableForFaculty(userId);
  if (!scheduleData) return [];

  // Check if today is a holiday
  const { rows: holidayCheck } = await query(
    `SELECT 1 FROM academic_calendar_events
     WHERE event_type = 'Holiday'
       AND (CURRENT_DATE BETWEEN start_date AND COALESCE(end_date, start_date))
       AND (target_audience = 'All' OR target_audience = 'Faculty')
       AND deleted_at IS NULL AND publish_status != 'Archived'`
  );
  if (holidayCheck.length > 0) return []; // Today is a holiday

  const todayDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const dayEntries = scheduleData.schedule[todayDay] || [];

  return dayEntries.map((e: any) => ({
    id: e.id,
    subjectCode: e.subjectCode,
    subjectName: e.subjectName,
    subjectAbbreviation: e.subjectAbbreviation,
    classType: e.classType,
    time: e.slots.map((s: any) => s.startTime.slice(0, 5) + ' - ' + s.endTime.slice(0, 5)).join(', '),
    startTime: e.slots[0]?.startTime,
    endTime: e.slots[e.slots.length - 1]?.endTime,
    room: e.roomNumber,
    sectionDetails: `${e.departmentCode} Sem ${e.semester}-${e.section}`,
    departmentCode: e.departmentCode,
    semester: e.semester,
    section: e.section,
    subjectId: e.subjectId,
  })).sort((a: any, b: any) => (a.startTime || '').localeCompare(b.startTime || ''));
}
