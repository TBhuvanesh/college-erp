export type TimetableSlotType = 'TEACHING' | 'BREAK' | 'LUNCH';
export type TimetableStatus = 'draft' | 'validated' | 'published' | 'archived';
export type ClassType = 'Theory' | 'Lab' | 'Project' | 'Elective' | 'Tutorial' | 'Other';

export interface TimetableSlotConfig {
  id?: string;
  startTime: string;
  endTime: string;
  slotType: TimetableSlotType;
  sequenceOrder: number;
}

export interface TimetableEntryConfig {
  id?: string;
  dayOfWeek: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  subjectId: string;
  subjectCode?: string;
  subjectName?: string;
  subjectAbbreviation?: string | null;
  classType: ClassType;
  slotSequenceOrders: number[];
  facultyIds: string[];
  faculties?: Array<{ id: string; fullName: string }>;
}

export interface CreateTimetableInput {
  academicYear: string;
  departmentId: string;
  programId?: string | null;
  year: 'I' | 'II' | 'III' | 'IV';
  semester: number;
  section: string;
  roomNumber?: string | null;
  workingDays: string[];
  slots: Array<{
    startTime: string;
    endTime: string;
    slotType: TimetableSlotType;
    sequenceOrder: number;
  }>;
  entries: Array<{
    dayOfWeek: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
    subjectId: string;
    classType: ClassType;
    slotSequenceOrders: number[];
    facultyIds: string[];
  }>;
  effectiveFrom?: string | null;
}

export interface UpdateTimetableInput {
  roomNumber?: string | null;
  workingDays?: string[];
  slots?: TimetableSlotConfig[];
  entries?: TimetableEntryConfig[];
  effectiveFrom?: string | null;
  status?: TimetableStatus;
}
