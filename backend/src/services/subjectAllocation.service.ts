// Deprecated: Subject Allocation has been superseded by Teaching Assignment
// Management (see docs/teaching-assignment-refactor-plan.md and
// services/teachingAssignment.service.ts). This module is kept only so the
// existing /api/subject-allocations routes and subjectAllocation.controller.ts
// keep working unmodified during the transition — it carries no logic of its
// own, so there is nothing to duplicate or drift.
export * from './teachingAssignment.service';
