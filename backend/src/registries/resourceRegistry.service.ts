// ── ResourceRegistry ─────────────────────────────────────────────────────────
// Single source of truth for physical resources (currently: exam rooms /
// classrooms). examRoom.service.ts remains the single owner of the
// `exam_rooms` table; this registry re-exports its read surface so any future
// module (Timetable, Events, Laboratories) that needs "what rooms exist and
// are they available" goes through one import path instead of querying
// `exam_rooms` directly, as search.service.ts, facultyTasks.service.ts and
// resourceAvailability.service.ts each currently do.

export {
  listExamRooms,
  getExamRoomById,
  listExamRoomsWithAvailability,
} from '../services/examRoom.service';
