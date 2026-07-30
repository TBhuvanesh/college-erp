const mockQuery = jest.fn().mockImplementation((sql) => {
  return { rows: [], rowCount: 0 };
});
const mockAuditLog = jest.fn().mockResolvedValue(undefined);

jest.mock('../config/database', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  withTransaction: async (callback: any) => {
    const mockClient = {
      query: (...args: unknown[]) => mockQuery(...args),
    };
    return callback(mockClient);
  },
}));

jest.mock('../utils/audit', () => ({
  auditLog: (...args: unknown[]) => mockAuditLog(...args),
}));

import * as timetableService from '../services/timetable.service';
import { CreateTimetableInput } from '../types/timetable';

const DEPT_ID = '11111111-1111-1111-1111-111111111111';
const SUBJECT_ID = '22222222-2222-2222-2222-222222222222';
const FACULTY_ID = '33333333-3333-3333-3333-333333333333';
const ACTOR_ID = '44444444-4444-4444-4444-444444444444';

describe('Timetable Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createTimetable', () => {
    it('creates a new timetable and inserts slots and entries', async () => {
      const mockTimetableId = 'timetable-uuid-1';
      const mockSlotId = 'slot-uuid-1';
      const mockEntryId = 'entry-uuid-1';

      mockQuery.mockImplementation((sql, params) => {
        if (sql.includes('SELECT id FROM departments')) {
          return { rows: [{ id: DEPT_ID }], rowCount: 1 };
        }
        if (sql.includes('INSERT INTO timetables')) {
          return { rows: [{ id: mockTimetableId }], rowCount: 1 };
        }
        if (sql.includes('INSERT INTO timetable_slots')) {
          return { rows: [{ id: mockSlotId }], rowCount: 1 };
        }
        if (sql.includes('INSERT INTO timetable_entries')) {
          return { rows: [{ id: mockEntryId }], rowCount: 1 };
        }
        if (sql.includes('SELECT t.id, t.academic_year')) {
          // getTimetableById select query mock
          return {
            rows: [{
              id: mockTimetableId,
              academic_year: '2023-2024',
              department_id: DEPT_ID,
              department_name: 'CSE',
              department_code: 'CSE',
              program_id: null,
              program_name: null,
              year: 'I',
              semester: 1,
              section: 'A',
              room_number: '101',
              status: 'draft',
              working_days: ['Monday', 'Tuesday'],
              version: 1,
              effective_from: null,
              created_by: ACTOR_ID,
              created_at: new Date(),
              updated_at: new Date(),
            }],
            rowCount: 1,
          };
        }
        if (sql.includes('SELECT id, start_time::text')) {
          // slots
          return {
            rows: [
              { id: mockSlotId, start_time: '09:00:00', end_time: '10:00:00', slot_type: 'TEACHING', sequence_order: 1 },
            ],
            rowCount: 1,
          };
        }
        if (sql.includes('SELECT te.id, te.day_of_week')) {
          // entries
          return {
            rows: [
              { id: mockEntryId, day_of_week: 'Monday', subject_id: SUBJECT_ID, subject_code: 'CS101', subject_name: 'Intro to CS', subject_abbreviation: 'ICS', class_type: 'Theory' },
            ],
            rowCount: 1,
          };
        }
        if (sql.includes('SELECT s.id, s.start_time::text')) {
          // entry slots
          return {
            rows: [
              { id: mockSlotId, start_time: '09:00:00', end_time: '10:00:00', sequence_order: 1, slot_type: 'TEACHING' },
            ],
            rowCount: 1,
          };
        }
        if (sql.includes('SELECT f.id, f.full_name')) {
          // entry faculty
          return {
            rows: [
              { id: FACULTY_ID, full_name: 'Amit Sharma', employee_number: 'EMP101' },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      });

      const input: CreateTimetableInput = {
        academicYear: '2023-2024',
        departmentId: DEPT_ID,
        year: 'I',
        semester: 1,
        section: 'A',
        roomNumber: '101',
        workingDays: ['Monday', 'Tuesday'],
        slots: [
          { startTime: '09:00', endTime: '10:00', slotType: 'TEACHING', sequenceOrder: 1 },
        ],
        entries: [
          { dayOfWeek: 'Monday', subjectId: SUBJECT_ID, classType: 'Theory', slotSequenceOrders: [1], facultyIds: [FACULTY_ID] },
        ],
      };

      const result = await timetableService.createTimetable(input, ACTOR_ID);
      expect(result.id).toBe(mockTimetableId);
      expect(result.slots.length).toBe(1);
      expect(result.entries.length).toBe(1);
      expect(result.entries[0].faculties[0].fullName).toBe('Amit Sharma');
    });
  });

  describe('validateTimetableDetails', () => {
    it('detects slot overlaps', async () => {
      const input: CreateTimetableInput = {
        academicYear: '2023-2024',
        departmentId: DEPT_ID,
        year: 'I',
        semester: 1,
        section: 'A',
        slots: [
          { startTime: '09:00', endTime: '10:00', slotType: 'TEACHING', sequenceOrder: 1 },
          { startTime: '09:30', endTime: '10:30', slotType: 'TEACHING', sequenceOrder: 2 },
        ],
        workingDays: ['Monday'],
        entries: [],
      };

      const errors = await timetableService.validateTimetableDetails(input);
      expect(errors.some((e) => e.code === 'SLOT_OVERLAP')).toBe(true);
    });

    it('detects invalid slot duration (end time before start time)', async () => {
      const input: CreateTimetableInput = {
        academicYear: '2023-2024',
        departmentId: DEPT_ID,
        year: 'I',
        semester: 1,
        section: 'A',
        slots: [
          { startTime: '10:00', endTime: '09:00', slotType: 'TEACHING', sequenceOrder: 1 },
        ],
        workingDays: ['Monday'],
        entries: [],
      };

      const errors = await timetableService.validateTimetableDetails(input);
      expect(errors.some((e) => e.code === 'INVALID_SLOT_TIME')).toBe(true);
    });

    it('detects class session overlaps on the same day/slot', async () => {
      const input: CreateTimetableInput = {
        academicYear: '2023-2024',
        departmentId: DEPT_ID,
        year: 'I',
        semester: 1,
        section: 'A',
        slots: [
          { startTime: '09:00', endTime: '10:00', slotType: 'TEACHING', sequenceOrder: 1 },
        ],
        workingDays: ['Monday'],
        entries: [
          { dayOfWeek: 'Monday', subjectId: SUBJECT_ID, classType: 'Theory', slotSequenceOrders: [1], facultyIds: [FACULTY_ID] },
          { dayOfWeek: 'Monday', subjectId: SUBJECT_ID, classType: 'Theory', slotSequenceOrders: [1], facultyIds: [FACULTY_ID] },
        ],
      };

      const errors = await timetableService.validateTimetableDetails(input);
      expect(errors.some((e) => e.code === 'CLASS_CONFLICT')).toBe(true);
    });
  });
});
