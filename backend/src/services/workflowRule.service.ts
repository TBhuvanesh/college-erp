import { query } from '../config/database';
import { auditLog } from '../utils/audit';
import { AppError } from '../errors/AppError';
import type {
  WorkflowRule,
  WorkflowTriggerEvent,
  WorkflowActionType,
  WorkflowCondition,
  CreateWorkflowRuleInput,
  UpdateWorkflowRuleInput,
  ListWorkflowRulesQuery,
} from '../types/workflow';

interface WorkflowRuleRow {
  id: string;
  name: string;
  trigger_event: WorkflowTriggerEvent;
  condition: WorkflowCondition[] | null;
  actions: WorkflowActionType[];
  is_active: boolean;
  created_by: string;
  created_by_name: string;
  created_at: Date;
  updated_at: Date;
}

// actions::text[] — pg has no built-in array parser for arrays of a custom
// enum type, so a bare SELECT returns the raw literal string "{a,b}" instead
// of a JS array. Casting to text[] makes Postgres return a real text array,
// which pg's driver does parse natively.
const COLS = `
  wr.id, wr.name, wr.trigger_event, wr.condition, wr.actions::text[] AS actions, wr.is_active,
  wr.created_by, u.full_name AS created_by_name, wr.created_at, wr.updated_at
`;
const JOINS = `JOIN users u ON u.id = wr.created_by`;

function toWorkflowRule(r: WorkflowRuleRow): WorkflowRule {
  return {
    id: r.id,
    name: r.name,
    triggerEvent: r.trigger_event,
    condition: r.condition,
    actions: r.actions,
    isActive: r.is_active,
    createdBy: r.created_by,
    createdByName: r.created_by_name,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

async function fetchRuleRow(id: string): Promise<WorkflowRuleRow | null> {
  const { rows } = await query<WorkflowRuleRow>(
    `SELECT ${COLS} FROM workflow_rules wr ${JOINS} WHERE wr.id = $1 AND wr.deleted_at IS NULL`,
    [id]
  );
  return rows[0] ?? null;
}

export async function listWorkflowRules(filters: ListWorkflowRulesQuery): Promise<WorkflowRule[]> {
  const conditions: string[] = ['wr.deleted_at IS NULL'];
  const params: unknown[] = [];
  const push = (cond: string, val: unknown) => {
    params.push(val);
    conditions.push(`${cond} $${params.length}`);
  };

  if (filters.triggerEvent) push('wr.trigger_event =', filters.triggerEvent);
  if (filters.isActive !== undefined) push('wr.is_active =', filters.isActive === 'true');

  const { rows } = await query<WorkflowRuleRow>(
    `SELECT ${COLS} FROM workflow_rules wr ${JOINS} WHERE ${conditions.join(' AND ')} ORDER BY wr.created_at DESC`,
    params
  );
  return rows.map(toWorkflowRule);
}

export async function getWorkflowRuleById(id: string): Promise<WorkflowRule> {
  const row = await fetchRuleRow(id);
  if (!row) throw AppError.notFound('Workflow rule not found');
  return toWorkflowRule(row);
}

export async function createWorkflowRule(userId: string, data: CreateWorkflowRuleInput): Promise<WorkflowRule> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO workflow_rules (name, trigger_event, condition, actions, is_active, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      data.name,
      data.triggerEvent,
      data.condition ? JSON.stringify(data.condition) : null,
      data.actions,
      data.isActive,
      userId,
    ]
  );

  await auditLog({ actorId: userId, action: 'CREATE', resource: 'workflow_rule', resourceId: rows[0].id });

  const row = await fetchRuleRow(rows[0].id);
  return toWorkflowRule(row!);
}

export async function updateWorkflowRule(
  userId: string,
  id: string,
  data: UpdateWorkflowRuleInput
): Promise<WorkflowRule> {
  const existing = await fetchRuleRow(id);
  if (!existing) throw AppError.notFound('Workflow rule not found');

  const sets: string[] = [];
  const params: unknown[] = [];
  const push = (col: string, val: unknown) => {
    params.push(val);
    sets.push(`${col} = $${params.length}`);
  };

  if (data.name !== undefined) push('name', data.name);
  if ('condition' in data) push('condition', data.condition ? JSON.stringify(data.condition) : null);
  if (data.actions !== undefined) push('actions', data.actions);
  if (data.isActive !== undefined) push('is_active', data.isActive);

  if (sets.length === 0) throw AppError.badRequest('No fields to update');

  params.push(id);
  await query(`UPDATE workflow_rules SET ${sets.join(', ')} WHERE id = $${params.length}`, params);

  await auditLog({
    actorId: userId,
    action: 'UPDATE',
    resource: 'workflow_rule',
    resourceId: id,
    changes: data as Record<string, unknown>,
  });

  const updated = await fetchRuleRow(id);
  return toWorkflowRule(updated!);
}

export async function deleteWorkflowRule(userId: string, id: string): Promise<void> {
  const existing = await fetchRuleRow(id);
  if (!existing) throw AppError.notFound('Workflow rule not found');

  await query('UPDATE workflow_rules SET deleted_at = NOW() WHERE id = $1', [id]);

  await auditLog({ actorId: userId, action: 'DELETE', resource: 'workflow_rule', resourceId: id });
}
