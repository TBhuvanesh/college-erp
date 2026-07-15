import { query } from '../config/database';
import { auditLog } from '../utils/audit';
import { AppError } from '../errors/AppError';
import type { Role } from '../types/roles';
import type {
  Notification,
  NotificationCount,
  NotificationType,
  NotificationTargetRole,
  CreateNotificationInput,
  ListNotificationsQuery,
  PaginatedNotifications,
} from '../types/notification';

// ── Row types ────────────────────────────────────────────────────────────────────

interface NotificationRow {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  source_module: string | null;
  source_id: string | null;
  target_role: NotificationTargetRole;
  department_id: string | null;
  department_name: string | null;
  semester: number | null;
  recipient_user_id: string | null;
  is_important: boolean;
  is_read: boolean;
  created_by: string;
  created_by_name: string;
  created_at: Date;
}

interface NotificationListRow extends NotificationRow {
  total_count: string;
}

// ── SQL fragments ────────────────────────────────────────────────────────────────

const COLS = `
  n.id,
  n.title,
  n.message,
  n.type,
  n.source_module,
  n.source_id,
  n.target_role,
  n.department_id,
  d.name              AS department_name,
  n.semester,
  n.recipient_user_id,
  n.is_important,
  n.created_by,
  u.full_name         AS created_by_name,
  n.created_at
`;

const JOINS = `
  LEFT JOIN departments d ON d.id = n.department_id
  JOIN      users       u ON u.id = n.created_by
`;

// ── Mapper ───────────────────────────────────────────────────────────────────────

function toNotification(r: NotificationRow): Notification {
  return {
    id:             r.id,
    title:          r.title,
    message:        r.message,
    type:           r.type,
    sourceModule:   r.source_module,
    sourceId:       r.source_id,
    targetRole:     r.target_role,
    departmentId:   r.department_id,
    departmentName: r.department_name,
    semester:       r.semester,
    recipientUserId: r.recipient_user_id,
    isImportant:    r.is_important,
    isRead:         r.is_read ?? false,
    createdBy:      r.created_by,
    createdByName:  r.created_by_name,
    createdAt:      r.created_at,
  };
}

// ── Source enrichment ────────────────────────────────────────────────────────────

async function enrichSource(
  sourceModule: string,
  sourceId: string
): Promise<{ title: string; message: string } | null> {
  switch (sourceModule) {
    case 'announcement': {
      const { rows } = await query<{ title: string; content: string }>(
        'SELECT title, content FROM announcements WHERE id = $1 AND deleted_at IS NULL',
        [sourceId]
      );
      if (!rows[0]) return null;
      return { title: rows[0].title, message: rows[0].content.slice(0, 500) };
    }
    case 'academic_calendar': {
      const { rows } = await query<{ title: string; event_type: string; start_date: Date }>(
        'SELECT title, event_type, start_date FROM academic_calendar_events WHERE id = $1 AND deleted_at IS NULL',
        [sourceId]
      );
      if (!rows[0]) return null;
      return {
        title:   rows[0].title,
        message: `Academic event (${rows[0].event_type}) on ${new Date(rows[0].start_date).toDateString()}`,
      };
    }
    case 'lms_assignment': {
      const { rows } = await query<{ title: string; due_date: Date }>(
        'SELECT title, due_date FROM assignments WHERE id = $1 AND deleted_at IS NULL',
        [sourceId]
      );
      if (!rows[0]) return null;
      return {
        title:   rows[0].title,
        message: `Assignment due on ${new Date(rows[0].due_date).toDateString()}`,
      };
    }
    case 'opportunity': {
      const { rows } = await query<{ title: string; type: string; deadline: Date | null }>(
        'SELECT title, type, deadline FROM opportunities WHERE id = $1 AND deleted_at IS NULL',
        [sourceId]
      );
      if (!rows[0]) return null;
      const deadline = rows[0].deadline
        ? ` — Deadline: ${new Date(rows[0].deadline).toDateString()}`
        : '';
      return {
        title:   rows[0].title,
        message: `${rows[0].type} opportunity${deadline}`,
      };
    }
    default:
      return null;
  }
}

// ── Role context helpers ─────────────────────────────────────────────────────────

async function resolveFacultyDept(userId: string): Promise<string | null> {
  const { rows } = await query<{ department_id: string }>(
    'SELECT department_id FROM faculty WHERE user_id = $1 AND deleted_at IS NULL',
    [userId]
  );
  return rows[0]?.department_id ?? null;
}

interface StudentCtx {
  departmentId: string;
  semester: number;
}

async function resolveStudentCtx(userId: string): Promise<StudentCtx | null> {
  const { rows } = await query<{ department_id: string; semester: number }>(
    'SELECT department_id, semester FROM students WHERE user_id = $1 AND deleted_at IS NULL',
    [userId]
  );
  if (!rows[0]) return null;
  return { departmentId: rows[0].department_id, semester: rows[0].semester };
}

// ── Role-scoped WHERE conditions ─────────────────────────────────────────────────

async function buildScopeConditions(
  userId: string,
  role: Role,
  params: unknown[]
): Promise<string[]> {
  const conditions: string[] = [];

  if (role === 'admin') {
    // Admin sees all notifications — no targeting filter
    return conditions;
  }

  // A single-recipient notification (e.g. "you've been assigned invigilation
  // duty") is always visible to that recipient regardless of the broadcast
  // targeting rules below.
  params.push(userId);
  const recipientIdx = params.length;
  const recipientClause = `n.recipient_user_id = $${recipientIdx}`;

  if (role === 'accountant') {
    conditions.push(`(n.target_role = 'all' OR ${recipientClause})`);
    return conditions;
  }

  if (role === 'faculty') {
    const deptId = await resolveFacultyDept(userId);
    if (deptId) {
      params.push(deptId);
      conditions.push(
        `((n.target_role IN ('all', 'faculty') AND (n.department_id IS NULL OR n.department_id = $${params.length})) OR ${recipientClause})`
      );
    } else {
      conditions.push(`(n.target_role IN ('all', 'faculty') OR ${recipientClause})`);
    }
    return conditions;
  }

  // Student
  const ctx = await resolveStudentCtx(userId);
  if (!ctx) throw AppError.notFound('Student profile not found');

  params.push(ctx.departmentId, ctx.semester);
  conditions.push(
    `((n.target_role IN ('all', 'student') AND (n.department_id IS NULL OR n.department_id = $${params.length - 1}) AND (n.semester IS NULL OR n.semester = $${params.length})) OR ${recipientClause})`
  );
  return conditions;
}

// ── Exports ──────────────────────────────────────────────────────────────────────

export async function createNotification(
  userId: string,
  role: Role,
  data: CreateNotificationInput
): Promise<Notification> {
  // Faculty restrictions
  if (role === 'faculty') {
    if (data.targetRole === 'admin') {
      throw AppError.forbidden('Faculty cannot send notifications to admin');
    }
    if (data.isImportant) {
      throw AppError.forbidden('Only admin can mark notifications as important');
    }
  }

  let title   = data.title;
  let message = data.message ?? '';

  // Source enrichment — override title/message from source if not explicitly provided
  if (data.sourceModule && data.sourceId) {
    const enriched = await enrichSource(data.sourceModule, data.sourceId);
    if (!enriched) {
      throw AppError.badRequest(`Source ${data.sourceModule}:${data.sourceId} not found`);
    }
    if (!data.message) message = enriched.message;
  }

  if (!message) {
    throw AppError.badRequest('message is required when sourceModule/sourceId are not provided');
  }

  // Faculty: auto-set departmentId to their own department
  let departmentId = data.departmentId ?? null;
  if (role === 'faculty') {
    const facultyDeptId = await resolveFacultyDept(userId);
    departmentId = facultyDeptId;
  }

  const { rows } = await query<{ id: string }>(
    `INSERT INTO notifications
       (title, message, type, source_module, source_id, target_role,
        department_id, semester, recipient_user_id, is_important, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id`,
    [
      title,
      message,
      data.type,
      data.sourceModule ?? null,
      data.sourceId     ?? null,
      data.targetRole,
      departmentId,
      data.semester ?? null,
      data.recipientUserId ?? null,
      data.isImportant,
      userId,
    ]
  );

  await auditLog({ actorId: userId, action: 'CREATE', resource: 'notification', resourceId: rows[0].id });

  const { rows: created } = await query<NotificationRow>(
    `SELECT ${COLS}, FALSE AS is_read
     FROM notifications n ${JOINS}
     WHERE n.id = $1 AND n.deleted_at IS NULL`,
    [rows[0].id]
  );
  return toNotification(created[0]);
}

export async function listNotifications(
  userId: string,
  role: Role,
  filters: ListNotificationsQuery
): Promise<PaginatedNotifications> {
  const { page, limit, type, isRead, isImportant } = filters;
  const offset = (page - 1) * limit;
  const params: unknown[] = [userId];
  const conditions: string[] = ['n.deleted_at IS NULL'];

  // Per-user read join param is always $1 = userId
  const scopeConditions = await buildScopeConditions(userId, role, params);
  conditions.push(...scopeConditions);

  if (type) {
    params.push(type);
    conditions.push(`n.type = $${params.length}`);
  }
  if (isImportant !== undefined) {
    conditions.push(`n.is_important = ${isImportant === 'true'}`);
  }

  // is_read filter depends on the LEFT JOIN result
  const isReadFilter = isRead === 'true'
    ? 'AND nr.id IS NOT NULL'
    : isRead === 'false'
      ? 'AND nr.id IS NULL'
      : '';

  params.push(limit, offset);
  const limitN  = params.length - 1;
  const offsetN = params.length;

  const { rows } = await query<NotificationListRow>(
    `SELECT ${COLS},
            CASE WHEN nr.id IS NOT NULL THEN TRUE ELSE FALSE END AS is_read,
            COUNT(*) OVER() AS total_count
     FROM   notifications n
     ${JOINS}
     LEFT JOIN notification_reads nr ON nr.notification_id = n.id AND nr.user_id = $1
     WHERE  ${conditions.join(' AND ')}
     ${isReadFilter}
     ORDER  BY n.is_important DESC, n.created_at DESC
     LIMIT  $${limitN} OFFSET $${offsetN}`,
    params
  );

  const total = rows[0] ? Number(rows[0].total_count) : 0;
  return {
    notifications: rows.map(toNotification),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getNotificationCount(
  userId: string,
  role: Role
): Promise<NotificationCount> {
  const params: unknown[] = [userId];
  const conditions: string[] = ['n.deleted_at IS NULL'];

  const scopeConditions = await buildScopeConditions(userId, role, params);
  conditions.push(...scopeConditions);

  const { rows } = await query<{ total: string; unread: string }>(
    `SELECT COUNT(*)                              AS total,
            COUNT(*) FILTER (WHERE nr.id IS NULL) AS unread
     FROM notifications n
     ${JOINS}
     LEFT JOIN notification_reads nr ON nr.notification_id = n.id AND nr.user_id = $1
     WHERE ${conditions.join(' AND ')}`,
    params
  );

  return {
    total:  Number(rows[0]?.total  ?? 0),
    unread: Number(rows[0]?.unread ?? 0),
  };
}

export async function markAsRead(userId: string, notificationId: string): Promise<void> {
  const { rows } = await query<{ id: string }>(
    'SELECT id FROM notifications WHERE id = $1 AND deleted_at IS NULL',
    [notificationId]
  );
  if (!rows[0]) throw AppError.notFound('Notification not found');

  await query(
    `INSERT INTO notification_reads (notification_id, user_id) VALUES ($1, $2)
     ON CONFLICT (notification_id, user_id) DO NOTHING`,
    [notificationId, userId]
  );
}

export async function markAsUnread(userId: string, notificationId: string): Promise<void> {
  const { rows } = await query<{ id: string }>(
    'SELECT id FROM notifications WHERE id = $1 AND deleted_at IS NULL',
    [notificationId]
  );
  if (!rows[0]) throw AppError.notFound('Notification not found');

  await query(
    'DELETE FROM notification_reads WHERE notification_id = $1 AND user_id = $2',
    [notificationId, userId]
  );
}
