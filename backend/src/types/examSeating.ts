import { z } from 'zod';
import { EXAM_TYPES } from './examination';

// ── Enums ──────────────────────────────────────────────────────────────────────

export const INVIGILATION_STATUSES = ['Assigned', 'Completed', 'Cancelled'] as const;
export type InvigilationStatus = (typeof INVIGILATION_STATUSES)[number];

export const BENCH_TYPES = ['single', 'double', 'triple'] as const;
export type BenchType = (typeof BENCH_TYPES)[number];

const BENCH_SEAT_COUNT: Record<BenchType, number> = { single: 1, double: 2, triple: 3 };
export function benchSeatCount(benchType: BenchType | null): number {
  return benchType ? BENCH_SEAT_COUNT[benchType] : 1;
}

export const SEAT_POSITIONS = ['Left', 'Middle', 'Right'] as const;
export type SeatPosition = (typeof SEAT_POSITIONS)[number];

export const SEATING_PATTERN_TYPES = ['mid', 'semester', 'random', 'custom'] as const;
export type SeatingPatternType = (typeof SEATING_PATTERN_TYPES)[number];

export const EXAM_SESSION_STATUSES = ['draft', 'generated', 'validated', 'published', 'completed', 'archived'] as const;
export type ExamSessionStatus = (typeof EXAM_SESSION_STATUSES)[number];

export const DEPARTMENT_COLOR_PALETTE = [
  'violet', 'green', 'orange', 'red', 'blue', 'amber', 'rose', 'cyan', 'indigo', 'teal', 'pink', 'lime',
] as const;
export type DepartmentColor = (typeof DEPARTMENT_COLOR_PALETTE)[number];

// ── Exam Rooms (Classroom Management) ────────────────────────────────────────

export interface ExamRoom {
  id: string;
  name: string;
  building: string | null;
  floor: string | null;
  roomNumber: string | null;
  capacity: number;
  rows: number | null;
  columns: number | null;
  benchType: BenchType | null;
  notes: string | null;
  isActive: boolean;
  underMaintenance: boolean;
  maintenanceNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// rows/columns/benchType are an all-or-nothing trio: either a room has full
// geometry (unlocks the visual layout) or none of it (flat-capacity legacy mode).
const roomGeometrySchema = z.object({
  rows: z.coerce.number().int().positive().max(100).optional(),
  columns: z.coerce.number().int().positive().max(100).optional(),
  benchType: z.enum(BENCH_TYPES).optional(),
});

function assertGeometryConsistent(data: { rows?: number; columns?: number; benchType?: BenchType; capacity?: number }) {
  const provided = [data.rows, data.columns, data.benchType].filter((v) => v !== undefined);
  if (provided.length > 0 && provided.length < 3) {
    return 'rows, columns and benchType must be provided together (or not at all)';
  }
  if (data.rows && data.columns && data.benchType && data.capacity !== undefined) {
    const computed = data.rows * data.columns * benchSeatCount(data.benchType);
    if (computed < data.capacity) {
      return `rows x columns x bench seats (${computed}) is less than capacity (${data.capacity})`;
    }
  }
  return null;
}

export const createExamRoomSchema = z
  .object({
    name: z.string().trim().min(1).max(50),
    building: z.string().trim().max(100).optional(),
    floor: z.string().trim().max(20).optional(),
    roomNumber: z.string().trim().max(20).optional(),
    capacity: z.coerce.number().int().positive().max(1000),
    notes: z.string().trim().max(2000).optional(),
    isActive: z.boolean().default(true),
    underMaintenance: z.boolean().default(false),
    maintenanceNote: z.string().trim().max(2000).optional(),
  })
  .merge(roomGeometrySchema)
  .superRefine((data, ctx) => {
    const error = assertGeometryConsistent(data);
    if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error, path: ['rows'] });
  });
export type CreateExamRoomInput = z.infer<typeof createExamRoomSchema>;

export const updateExamRoomSchema = z
  .object({
    name: z.string().trim().min(1).max(50).optional(),
    building: z.string().trim().max(100).nullable().optional(),
    floor: z.string().trim().max(20).nullable().optional(),
    roomNumber: z.string().trim().max(20).nullable().optional(),
    capacity: z.coerce.number().int().positive().max(1000).optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    isActive: z.boolean().optional(),
    underMaintenance: z.boolean().optional(),
    maintenanceNote: z.string().trim().max(2000).nullable().optional(),
  })
  .merge(z.object({
    rows: z.coerce.number().int().positive().max(100).nullable().optional(),
    columns: z.coerce.number().int().positive().max(100).nullable().optional(),
    benchType: z.enum(BENCH_TYPES).nullable().optional(),
  }))
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided for update' });
export type UpdateExamRoomInput = z.infer<typeof updateExamRoomSchema>;

export const listExamRoomsQuerySchema = z.object({
  isActive: z.enum(['true', 'false']).optional(),
  hasGeometry: z.enum(['true', 'false']).optional(),
});
export type ListExamRoomsQuery = z.infer<typeof listExamRoomsQuerySchema>;

// ── Resource Availability Engine ─────────────────────────────────────────────

export const RESOURCE_AVAILABILITY_STATES = ['available', 'occupied', 'maintenance', 'inactive'] as const;
export type RoomAvailabilityState = (typeof RESOURCE_AVAILABILITY_STATES)[number];

export interface RoomAvailability {
  roomId: string;
  roomName: string;
  capacity: number;
  state: RoomAvailabilityState;
  conflictReason: string | null;
  occupiedBy: string | null;
  timeSlot: { date: string; startTime: string; endTime: string } | null;
}

export interface FacultyAvailability {
  facultyId: string;
  facultyName: string;
  state: 'available' | 'unavailable';
  conflictReason: string | null;
  occupiedUntil: string | null;
}

export interface RoomSuggestionResult {
  recommended: RoomAvailability[];
  capacityRequired: number;
  capacityAvailable: number;
}

export const availabilityQuerySchema = z.object({
  date: z.string().refine((v) => !isNaN(Date.parse(v)), { message: 'date must be a valid date' }),
  startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'startTime must be HH:MM'),
  endTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'endTime must be HH:MM'),
});
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;

export const roomSuggestionQuerySchema = availabilityQuerySchema.extend({
  requiredCapacity: z.coerce.number().int().positive(),
});
export type RoomSuggestionQuery = z.infer<typeof roomSuggestionQuerySchema>;

export const invigilatorSuggestionQuerySchema = availabilityQuerySchema.extend({
  departmentId: z.string().uuid(),
  count: z.coerce.number().int().positive().max(50).default(1),
});
export type InvigilatorSuggestionQuery = z.infer<typeof invigilatorSuggestionQuerySchema>;

// ── Exam Slots (derived, not stored) ─────────────────────────────────────────

export interface ExamSlotSummary {
  examDate: string;
  startTime: string;
  endTime: string;
  exams: Array<{
    examId: string;
    subjectCode: string;
    subjectName: string;
    section: string;
    examType: string;
    rosterSize: number;
    hasSeating: boolean;
  }>;
  totalStudents: number;
}

export const listSlotsQuerySchema = z.object({
  from: z.string().refine((v) => !isNaN(Date.parse(v)), { message: 'from must be a valid date' }).optional(),
  to: z.string().refine((v) => !isNaN(Date.parse(v)), { message: 'to must be a valid date' }).optional(),
  departmentId: z.string().uuid().optional(),
});
export type ListSlotsQuery = z.infer<typeof listSlotsQuerySchema>;

// ── Seating ────────────────────────────────────────────────────────────────────

export interface SeatAllocation {
  id: string;
  examId: string;
  subjectCode: string;
  examType: string;
  departmentId: string;
  departmentCode: string;
  departmentColor: string | null;
  roomId: string;
  roomName: string;
  studentId: string;
  rollNumber: string;
  studentName: string;
  seatNumber: number;
  benchNumber: number | null;
  seatPosition: SeatPosition | null;
  isLocked: boolean;
}

export interface RoomSeatingChart {
  roomId: string;
  roomName: string;
  rows: number | null;
  columns: number | null;
  benchType: BenchType | null;
  capacity: number;
  occupied: number;
  seats: SeatAllocation[];
}

export interface SeatingGenerationResult {
  examIds: string[];
  totalStudents: number;
  rooms: RoomSeatingChart[];
}

export const generateSeatingSchema = z.object({
  examIds: z.array(z.string().uuid()).min(1, 'At least one exam is required'),
  roomIds: z.array(z.string().uuid()).min(1, 'At least one room is required'),
  seatingPatternId: z.string().uuid().optional(),
  examSessionId: z.string().uuid().optional(),
  allowOverride: z.boolean().default(false),
});
export type GenerateSeatingInput = z.infer<typeof generateSeatingSchema>;

export const swapSeatsSchema = z.object({
  allocationIdA: z.string().uuid(),
  allocationIdB: z.string().uuid(),
});
export type SwapSeatsInput = z.infer<typeof swapSeatsSchema>;

export const moveSeatSchema = z.object({
  allocationId: z.string().uuid(),
  targetRoomId: z.string().uuid(),
  targetSeatNumber: z.coerce.number().int().positive(),
});
export type MoveSeatInput = z.infer<typeof moveSeatSchema>;

export const lockSeatSchema = z.object({
  isLocked: z.boolean(),
});
export type LockSeatInput = z.infer<typeof lockSeatSchema>;

export const searchSeatingQuerySchema = z.object({
  q: z.string().trim().min(1, 'Search query is required').max(100),
  examId: z.string().uuid().optional(),
});
export type SearchSeatingQuery = z.infer<typeof searchSeatingQuerySchema>;

export interface SeatingSearchResult {
  type: 'student' | 'room' | 'invigilator';
  label: string;
  context: string;
  seatAllocation?: SeatAllocation;
  invigilationDuty?: InvigilationDuty;
}

export const seatingAnalyticsQuerySchema = z.object({
  examId: z.string().uuid().optional(),
  examSessionId: z.string().uuid().optional(),
});
export type SeatingAnalyticsQuery = z.infer<typeof seatingAnalyticsQuerySchema>;

export interface SeatingAnalytics {
  totalStudents: number;
  roomsUsed: number;
  capacityUtilizationPercent: number;
  invigilatorsAssigned: number;
  averageOccupancyPercent: number;
  conflictCount: number;
  studentsPerDepartment: Array<{ departmentId: string; departmentCode: string; departmentColor: string | null; count: number }>;
}

// ── Invigilation ───────────────────────────────────────────────────────────────

export interface InvigilationDutyExamCoverage {
  examId: string;
  subjectCode: string;
  examType: string;
}

export interface InvigilationDuty {
  id: string;
  roomId: string;
  roomName: string;
  facultyId: string;
  facultyName: string;
  dutyDate: string;
  startTime: string;
  endTime: string;
  status: InvigilationStatus;
  assignedBy: string;
  exams: InvigilationDutyExamCoverage[];
}

export const generateInvigilationSchema = z.object({
  examIds: z.array(z.string().uuid()).min(1, 'At least one exam is required'),
  invigilatorsPerRoom: z.coerce.number().int().min(1).max(5).default(1),
  departmentId: z.string().uuid().optional(),
  allowOverride: z.boolean().default(false),
});
export type GenerateInvigilationInput = z.infer<typeof generateInvigilationSchema>;

export const updateInvigilationDutySchema = z.object({
  facultyId: z.string().uuid().optional(),
  status: z.enum(INVIGILATION_STATUSES).optional(),
}).refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided for update' });
export type UpdateInvigilationDutyInput = z.infer<typeof updateInvigilationDutySchema>;

export const listInvigilationQuerySchema = z.object({
  facultyId: z.string().uuid().optional(),
  roomId: z.string().uuid().optional(),
  status: z.enum(INVIGILATION_STATUSES).optional(),
  from: z.string().refine((v) => !isNaN(Date.parse(v)), { message: 'from must be a valid date' }).optional(),
  to: z.string().refine((v) => !isNaN(Date.parse(v)), { message: 'to must be a valid date' }).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type ListInvigilationQuery = z.infer<typeof listInvigilationQuerySchema>;

export interface PaginatedInvigilationDuties {
  duties: InvigilationDuty[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ── Seating Pattern Engine ───────────────────────────────────────────────────

export interface SeatingPattern {
  id: string;
  name: string;
  patternType: SeatingPatternType;
  departmentSequence: string[];
  departmentSequenceCodes: string[];
  isDefault: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const createSeatingPatternSchema = z.object({
  name: z.string().trim().min(1).max(255),
  patternType: z.enum(SEATING_PATTERN_TYPES),
  // Required for 'mid'/'semester'/'custom'; ignored for 'random'.
  departmentSequence: z.array(z.string().uuid()).max(20).default([]),
  isDefault: z.boolean().default(false),
});
export type CreateSeatingPatternInput = z.infer<typeof createSeatingPatternSchema>;

export const updateSeatingPatternSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    departmentSequence: z.array(z.string().uuid()).max(20).optional(),
    isDefault: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided for update' });
export type UpdateSeatingPatternInput = z.infer<typeof updateSeatingPatternSchema>;

export const listSeatingPatternsQuerySchema = z.object({
  patternType: z.enum(SEATING_PATTERN_TYPES).optional(),
});
export type ListSeatingPatternsQuery = z.infer<typeof listSeatingPatternsQuerySchema>;

// ── Exam Session ───────────────────────────────────────────────────────────────

export interface ExamSession {
  id: string;
  name: string;
  // examType/departmentIds/years/semester/sections/examDates/subjectIds are all
  // DERIVED from the linked exams (never admin-entered) — see examSession.service.ts.
  examType: (typeof EXAM_TYPES)[number];
  departmentIds: string[];
  years: number[];
  semester: number;
  sections: string[];
  examDates: string[];
  subjectIds: string[];
  classroomIds: string[];
  invigilatorIds: string[];
  seatingPatternId: string | null;
  status: ExamSessionStatus;
  resolvedExamCount: number;
  lastConflictCount: number | null;
  validatedAt: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// The admin picks real, already-scheduled exams (surfaced via GET
// /exam-seating/slots) — every other criterion is derived from them server-side.
// This is the fix for the "never ask the admin to manually choose departments/
// years/sections/students" requirement: those fields already exist on `exams`.
export const createExamSessionSchema = z.object({
  name: z.string().trim().min(1).max(255),
  examIds: z.array(z.string().uuid()).min(1, 'At least one scheduled exam is required'),
  classroomIds: z.array(z.string().uuid()).default([]),
  invigilatorIds: z.array(z.string().uuid()).default([]),
  seatingPatternId: z.string().uuid().optional(),
});
export type CreateExamSessionInput = z.infer<typeof createExamSessionSchema>;

export const updateExamSessionSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    examIds: z.array(z.string().uuid()).min(1).optional(),
    classroomIds: z.array(z.string().uuid()).optional(),
    invigilatorIds: z.array(z.string().uuid()).optional(),
    seatingPatternId: z.string().uuid().nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided for update' });
export type UpdateExamSessionInput = z.infer<typeof updateExamSessionSchema>;

export const listExamSessionsQuerySchema = z.object({
  status: z.enum(EXAM_SESSION_STATUSES).optional(),
  departmentId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListExamSessionsQuery = z.infer<typeof listExamSessionsQuerySchema>;

export interface PaginatedExamSessions {
  sessions: ExamSession[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Re-sync action: re-derives session criteria from its currently-linked exams
// and drops any link whose exam is no longer Scheduled (e.g. cancelled after linking).
export interface ResolveExamsResult {
  linkedExamIds: string[];
  removedExamIds: string[];
}

// ── Conflict Detection (computed on demand, never stored) ───────────────────

export const CONFLICT_TYPES = [
  'duplicate_student',
  'duplicate_invigilator',
  'capacity_exceeded',
  'unavailable_room',
  'empty_classroom',
  'time_overlap',
  'calendar_conflict',
] as const;
export type ConflictType = (typeof CONFLICT_TYPES)[number];

export interface SeatingConflict {
  type: ConflictType;
  severity: 'warning' | 'error';
  message: string;
  context?: Record<string, unknown>;
}

export interface ConflictCheckResult {
  hasBlockingConflicts: boolean;
  conflicts: SeatingConflict[];
}
