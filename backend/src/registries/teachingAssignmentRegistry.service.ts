// ── TeachingAssignmentRegistry ───────────────────────────────────────────────
// The central academic relationship — Faculty + Subject (via Curriculum) +
// Section + Academic Year. teachingAssignment.service.ts remains the single
// owner of the `teaching_assignments` table and its full CRUD/workflow
// surface; assignment.service.ts owns the legacy resolution helpers still
// relied on by Attendance/LMS/Internal Marks/Results. This registry re-exports
// both so no module reaches into either table directly or re-derives "is this
// faculty assigned to this subject/section" on its own.

export {
  resolveTeachingAssignmentId,
  resolveAnyTeachingAssignmentId,
  isFacultyAssigned,
} from '../services/assignment.service';

export {
  getAllocationById,
  getAllocations,
  resolveMyTeachingAssignments,
} from '../services/teachingAssignment.service';
