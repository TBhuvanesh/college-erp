import type { Request } from 'express';
import { query } from '../config/database';

export interface AuditEvent {
  actorId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  changes?: Record<string, unknown>;
  req?: Request;
}

export async function auditLog({
  actorId,
  action,
  resource,
  resourceId,
  changes,
  req,
}: AuditEvent): Promise<void> {
  await query(
    `INSERT INTO audit_logs
       (actor_id, action, resource, resource_id, changes, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6::inet, $7)`,
    [
      actorId ?? null,
      action,
      resource,
      resourceId ?? null,
      changes ? JSON.stringify(changes) : null,
      req?.ip ?? null,
      req?.headers['user-agent'] ?? null,
    ]
  );
}
