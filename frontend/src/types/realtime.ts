export type RealtimeEventType =
  | 'ATTENDANCE_UPDATED'
  | 'TEACHING_PLAN_CHANGED'
  | 'NOTIFICATION_EMITTED'
  | 'EXAM_SEATING_CHANGED';

export interface RealtimeEventPayloads {
  ATTENDANCE_UPDATED: {
    studentId?: string;
    subjectId?: string;
    date?: string;
  };
  TEACHING_PLAN_CHANGED: {
    facultyId?: string;
    subjectId?: string;
  };
  NOTIFICATION_EMITTED: {
    userId?: string;
    notificationId: string;
    title: string;
    message: string;
    type: string;
    targetRole?: string;
    departmentId?: string;
    semester?: number;
  };
  EXAM_SEATING_CHANGED: {
    examId?: string;
    roomId?: string;
    studentId?: string;
  };
}

export type RealtimeEvent = {
  [K in RealtimeEventType]: {
    type: K;
    payload: RealtimeEventPayloads[K];
    timestamp: string;
  };
}[RealtimeEventType];
