import { buildStudentTimeline } from './timelineEngine.service';
import { generateTodayTasks } from './facultyTasks.service';
import { resolveFacultyId } from './facultyWorkload.service';
import type { TimelineEvent, ActionItem, ActionType, Priority } from '../types/experience';
import type { TaskType } from '../types/facultyOperations';

// ── Student Action Engine ────────────────────────────────────────────────────
// Rule-based mapping of timeline event categories to concrete next actions —
// no ML, no scoring model, just "this kind of event implies this action",
// derived from the SAME event collection the timeline already computed
// (see timelineEngine.service.ts's cache) rather than re-querying.

const STUDENT_ACTION_RULES: Partial<Record<TimelineEvent['category'], { type: ActionType; label: (e: TimelineEvent) => string }>> = {
  assignment: { type: 'complete_assignment', label: (e) => `Complete Assignment: ${e.title.replace(/^Assignment Due: /, '')}` },
  fee: { type: 'pay_fees', label: (e) => `Pay Fees: ${e.title.replace(/^Fee Due: /, '')}` },
  attendance: { type: 'meet_mentor', label: () => 'Meet Mentor — attendance below threshold' },
  quiz: { type: 'study_materials', label: (e) => `Study Materials: ${e.title.replace(/^Quiz: /, '')}` },
};

export async function buildStudentActions(userId: string, windowDays: number): Promise<ActionItem[]> {
  const events = await buildStudentTimeline(userId, windowDays);
  const actions: ActionItem[] = [];

  for (const e of events) {
    const rule = STUDENT_ACTION_RULES[e.category];
    if (!rule) continue;
    actions.push({
      id: `action-${e.id}`,
      type: rule.type,
      title: rule.label(e),
      description: e.subtitle,
      priority: e.priority,
      dueDate: e.timestamp,
      sourceModule: e.sourceModule,
      sourceId: e.sourceId,
    });
  }

  return actions;
}

// ── Faculty Action Engine ────────────────────────────────────────────────────
// Faculty Operations' Task Center already generates the day's concrete actions
// (take attendance, evaluate N assignments, submit marks, mentor meeting…) —
// this is a straight reshape into the shared ActionItem contract, not a
// second implementation of the same rules.

const TASK_TYPE_TO_ACTION: Record<TaskType, ActionType> = {
  attendance: 'take_attendance',
  evaluation: 'evaluate_assignments',
  lesson: 'conduct_lesson',
  mentor_meeting: 'meet_mentor',
  quiz: 'review_quiz',
  internal_marks: 'submit_marks',
  invigilation: 'invigilate_exam',
};

export async function buildFacultyActions(userId: string): Promise<ActionItem[]> {
  const facultyId = await resolveFacultyId(userId);
  const tasks = await generateTodayTasks(facultyId);

  const priorityRank: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
  return tasks
    .map((t) => ({
      id: `action-${t.id}`,
      type: TASK_TYPE_TO_ACTION[t.type],
      title: t.title,
      description: t.context,
      priority: t.priority,
      dueDate: t.dueDate,
      sourceModule: 'faculty_operations',
      sourceId: null,
    }))
    .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]);
}
