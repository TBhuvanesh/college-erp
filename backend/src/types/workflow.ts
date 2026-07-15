import { z } from 'zod';
import type { NotificationType } from './notification';

// ── Enums ──────────────────────────────────────────────────────────────────────

export const WORKFLOW_TRIGGER_EVENTS = [
  'material.created',
  'assignment.created',
  'lesson.completed',
  'lesson.rescheduled',
  'quiz.published',
  'exam_seating.published',
] as const;
export type WorkflowTriggerEvent = (typeof WORKFLOW_TRIGGER_EVENTS)[number];

// Closed set of built-in, safe handlers — rules select WHICH of these run for a
// trigger, they never carry arbitrary executable code.
export const WORKFLOW_ACTION_TYPES = ['notify_students', 'create_calendar_event', 'log_only'] as const;
export type WorkflowActionType = (typeof WORKFLOW_ACTION_TYPES)[number];

export const WORKFLOW_LOG_STATUSES = ['success', 'failed', 'retrying'] as const;
export type WorkflowLogStatus = (typeof WORKFLOW_LOG_STATUSES)[number];

export const CONDITION_OPERATORS = ['eq', 'neq', 'gt', 'lt', 'gte', 'lte'] as const;
export type ConditionOperator = (typeof CONDITION_OPERATORS)[number];

// ── Model ──────────────────────────────────────────────────────────────────────

export interface WorkflowCondition {
  field: string;
  operator: ConditionOperator;
  value: string | number | boolean;
}

export interface WorkflowRule {
  id: string;
  name: string;
  triggerEvent: WorkflowTriggerEvent;
  condition: WorkflowCondition[] | null;
  actions: WorkflowActionType[];
  isActive: boolean;
  createdBy: string;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowLog {
  id: string;
  workflowName: string;
  triggerEvent: WorkflowTriggerEvent;
  ruleId: string | null;
  action: WorkflowActionType | null;
  actorId: string | null;
  actorName: string | null;
  payload: Record<string, unknown> | null;
  status: WorkflowLogStatus;
  errorMessage: string | null;
  retryCount: number;
  executedAt: Date;
}

// Standard shape emitted at every trigger call site — extra fields are allowed
// so rule conditions can match on trigger-specific context beyond the basics.
export interface WorkflowEventPayload {
  departmentId: string;
  semester: number;
  title: string;
  message: string;
  notificationType: NotificationType;
  sourceId?: string;
  calendarDate?: string | Date;
  calendarEventType?: string;
  [key: string]: unknown;
}

export interface PaginatedWorkflowLogs {
  logs: WorkflowLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ── Zod schemas ──────────────────────────────────────────────────────────────────

const conditionSchema = z.object({
  field: z.string().trim().min(1).max(100),
  operator: z.enum(CONDITION_OPERATORS),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

export const createWorkflowRuleSchema = z.object({
  name: z.string().trim().min(1).max(255),
  triggerEvent: z.enum(WORKFLOW_TRIGGER_EVENTS),
  condition: z.array(conditionSchema).max(10).optional(),
  actions: z.array(z.enum(WORKFLOW_ACTION_TYPES)).min(1, 'At least one action is required'),
  isActive: z.boolean().default(true),
});
export type CreateWorkflowRuleInput = z.infer<typeof createWorkflowRuleSchema>;

export const updateWorkflowRuleSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    condition: z.array(conditionSchema).max(10).nullable().optional(),
    actions: z.array(z.enum(WORKFLOW_ACTION_TYPES)).min(1).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided for update' });
export type UpdateWorkflowRuleInput = z.infer<typeof updateWorkflowRuleSchema>;

export const listWorkflowRulesQuerySchema = z.object({
  triggerEvent: z.enum(WORKFLOW_TRIGGER_EVENTS).optional(),
  isActive: z.enum(['true', 'false']).optional(),
});
export type ListWorkflowRulesQuery = z.infer<typeof listWorkflowRulesQuerySchema>;

export const listWorkflowLogsQuerySchema = z.object({
  triggerEvent: z.enum(WORKFLOW_TRIGGER_EVENTS).optional(),
  status: z.enum(WORKFLOW_LOG_STATUSES).optional(),
  actorId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListWorkflowLogsQuery = z.infer<typeof listWorkflowLogsQuerySchema>;
