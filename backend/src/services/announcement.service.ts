import { query } from '../config/database';
import { auditLog } from '../utils/audit';
import { AppError } from '../errors/AppError';
import type {
  Announcement,
  PaginatedAnnouncements,
  AnnouncementAudience,
  AnnouncementPriority,
  AnnouncementStatus,
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
  ListAnnouncementsQuery,
} from '../types/announcement';
import type { Role } from '../types/roles';

// ── Row type (snake_case from PostgreSQL) ──────────────────────────────────────

interface AnnouncementRow {
  id: string;
  title: string;
  content: string;
  target_audience: AnnouncementAudience;
  department_id: string | null;
  department_name: string | null;
  semester: number | null;
  priority: AnnouncementPriority;
  status: AnnouncementStatus;
  publish_date: string;       // TO_CHAR output
  expiry_date: string | null;
  created_by: string;
  created_by_name: string;
  created_at: Date;
  updated_at: Date;
}

interface AnnouncementListRow extends AnnouncementRow {
  total_count: string;
}

// ── Shared query fragments ─────────────────────────────────────────────────────

const DETAIL_COLS = `
  a.id,           a.title,         a.content,
  a.target_audience,
  a.department_id, d.name                          AS department_name,
  a.semester,      a.priority,      a.status,
  TO_CHAR(a.publish_date, 'YYYY-MM-DD')            AS publish_date,
  TO_CHAR(a.expiry_date,  'YYYY-MM-DD')            AS expiry_date,
  a.created_by,    u.full_name                     AS created_by_name,
  a.created_at,    a.updated_at
`;

const DETAIL_JOINS = `
  LEFT JOIN departments d ON d.id = a.department_id
  JOIN users u ON u.id = a.created_by
`;

// Priority sort order: Urgent(1) → High(2) → Medium(3) → Low(4), then newest first
const ORDER_CLAUSE = `
  CASE a.priority
    WHEN 'Urgent' THEN 1
    WHEN 'High'   THEN 2
    WHEN 'Medium' THEN 3
    WHEN 'Low'    THEN 4
  END ASC,
  a.publish_date DESC,
  a.created_at DESC
`;

// ── Mapper ────────────────────────────────────────────────────────────────────

function toAnnouncement(r: AnnouncementRow): Announcement {
  return {
    id: r.id,
    title: r.title,
    content: r.content,
    targetAudience: r.target_audience,
    departmentId: r.department_id,
    departmentName: r.department_name,
    semester: r.semester !== null ? Number(r.semester) : null,
    priority: r.priority,
    status: r.status,
    publishDate: r.publish_date,
    expiryDate: r.expiry_date,
    createdBy: r.created_by,
    createdByName: r.created_by_name,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ── Private helpers ───────────────────────────────────────────────────────────

/**
 * Marks all Published announcements whose expiry_date has passed as Expired.
 * Called before any list query so the status column is always accurate.
 * Zero-cost when nothing is stale (the partial index keeps it fast).
 */
async function refreshExpiredAnnouncements(): Promise<void> {
  await query(
    `UPDATE announcements
     SET status = 'Expired', updated_at = NOW()
     WHERE status = 'Published'
       AND expiry_date IS NOT NULL
       AND expiry_date < CURRENT_DATE
       AND deleted_at IS NULL`
  );
}

interface FacultyContext {
  departmentId: string | null;
}

interface StudentContext {
  semester: number | null;
  departmentId: string | null;
}

async function resolveFacultyContext(userId: string): Promise<FacultyContext> {
  const { rows } = await query<{ department_id: string }>(
    'SELECT department_id FROM faculty WHERE user_id = $1 AND deleted_at IS NULL',
    [userId]
  );
  return { departmentId: rows[0]?.department_id ?? null };
}

async function resolveStudentContext(userId: string): Promise<StudentContext> {
  const { rows } = await query<{ semester: number; department_id: string }>(
    `SELECT st.semester, p.department_id
     FROM students st
     JOIN programs p ON p.id = st.program_id
     WHERE st.user_id = $1 AND st.deleted_at IS NULL`,
    [userId]
  );
  return {
    semester: rows[0]?.semester ?? null,
    departmentId: rows[0]?.department_id ?? null,
  };
}

/**
 * Builds the visibility WHERE clause conditions and params for a given role.
 * Admin: no audience restriction.
 * Faculty: Published + (All | Faculty | Dept match).
 * Student: Published + (All | Students | Dept match | Semester match).
 */
function buildVisibilityConditions(
  role: Role,
  ctx: { departmentId?: string | null; semester?: number | null },
  params: unknown[]
): string[] {
  const conditions: string[] = [];

  if (role === 'admin') return conditions;

  conditions.push("a.status = 'Published'");

  const parts: string[] = [
    "a.target_audience = 'All'",
    role === 'faculty' ? "a.target_audience = 'Faculty'" : "a.target_audience = 'Students'",
  ];

  if (ctx.departmentId) {
    params.push(ctx.departmentId);
    parts.push(
      `(a.target_audience = 'Department Specific' AND a.department_id = $${params.length})`
    );
  }

  if (role === 'student' && ctx.semester) {
    params.push(ctx.semester);
    parts.push(
      `(a.target_audience = 'Semester Specific' AND a.semester = $${params.length})`
    );
  }

  conditions.push(`(${parts.join(' OR ')})`);
  return conditions;
}

// ── Read operations ───────────────────────────────────────────────────────────

export async function getAnnouncementById(
  id: string,
  userId: string,
  userRole: Role
): Promise<Announcement> {
  const { rows } = await query<AnnouncementRow>(
    `SELECT ${DETAIL_COLS} FROM announcements a ${DETAIL_JOINS}
     WHERE a.id = $1 AND a.deleted_at IS NULL`,
    [id]
  );
  if (!rows[0]) throw AppError.notFound('Announcement not found');

  const ann = rows[0];

  if (userRole === 'admin') return toAnnouncement(ann);

  // Faculty and students may only access Published announcements that target them
  if (ann.status !== 'Published') throw AppError.notFound('Announcement not found');

  if (userRole === 'faculty') {
    const { departmentId } = await resolveFacultyContext(userId);
    if (!isVisibleToFaculty(ann, departmentId)) throw AppError.notFound('Announcement not found');
  } else {
    const { semester, departmentId } = await resolveStudentContext(userId);
    if (!isVisibleToStudent(ann, departmentId, semester)) throw AppError.notFound('Announcement not found');
  }

  return toAnnouncement(ann);
}

/** In-memory visibility check for a single already-fetched announcement row. */
function isVisibleToFaculty(
  ann: AnnouncementRow,
  departmentId: string | null
): boolean {
  if (ann.target_audience === 'All' || ann.target_audience === 'Faculty') return true;
  if (ann.target_audience === 'Department Specific' && departmentId && ann.department_id === departmentId) return true;
  return false;
}

function isVisibleToStudent(
  ann: AnnouncementRow,
  departmentId: string | null,
  semester: number | null
): boolean {
  if (ann.target_audience === 'All' || ann.target_audience === 'Students') return true;
  if (ann.target_audience === 'Department Specific' && departmentId && ann.department_id === departmentId) return true;
  if (ann.target_audience === 'Semester Specific' && semester && ann.semester === semester) return true;
  return false;
}

export async function listAnnouncements(
  filters: ListAnnouncementsQuery,
  userId: string,
  userRole: Role
): Promise<PaginatedAnnouncements> {
  await refreshExpiredAnnouncements();

  const conditions: string[] = ['a.deleted_at IS NULL'];
  const params: unknown[] = [];

  // Role-based visibility
  if (userRole !== 'admin') {
    let ctx: { departmentId?: string | null; semester?: number | null } = {};

    if (userRole === 'faculty') {
      ctx = await resolveFacultyContext(userId);
    } else {
      ctx = await resolveStudentContext(userId);
    }

    const visConditions = buildVisibilityConditions(userRole, ctx, params);
    conditions.push(...visConditions);
  }

  // Admin-only filters
  if (userRole === 'admin') {
    if (filters.status)         { params.push(filters.status);         conditions.push(`a.status = $${params.length}`); }
    if (filters.targetAudience) { params.push(filters.targetAudience); conditions.push(`a.target_audience = $${params.length}`); }
    if (filters.departmentId)   { params.push(filters.departmentId);   conditions.push(`a.department_id = $${params.length}`); }
    if (filters.publishDateFrom){ params.push(filters.publishDateFrom); conditions.push(`a.publish_date >= $${params.length}`); }
    if (filters.publishDateTo)  { params.push(filters.publishDateTo);  conditions.push(`a.publish_date <= $${params.length}`); }
  }

  // Filters available to all roles
  if (filters.priority) { params.push(filters.priority); conditions.push(`a.priority = $${params.length}`); }
  if (filters.semester) { params.push(filters.semester); conditions.push(`a.semester = $${params.length}`); }
  if (filters.search) {
    params.push(`%${filters.search}%`);
    conditions.push(`a.title ILIKE $${params.length}`);
  }

  const offset = (filters.page - 1) * filters.limit;
  params.push(filters.limit, offset);

  const { rows } = await query<AnnouncementListRow>(
    `SELECT ${DETAIL_COLS}, COUNT(*) OVER() AS total_count
     FROM announcements a ${DETAIL_JOINS}
     WHERE ${conditions.join(' AND ')}
     ORDER BY ${ORDER_CLAUSE}
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const total = rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0;

  return {
    announcements: rows.map(toAnnouncement),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.ceil(total / filters.limit),
    },
  };
}

// ── Write operations ──────────────────────────────────────────────────────────

export async function createAnnouncement(
  data: CreateAnnouncementInput,
  userId: string
): Promise<Announcement> {
  if (data.departmentId) {
    const { rows } = await query<{ id: string }>(
      'SELECT id FROM departments WHERE id = $1',
      [data.departmentId]
    );
    if (!rows[0]) throw AppError.notFound('Department not found');
  }

  const { rows } = await query<{ id: string }>(
    `INSERT INTO announcements
       (title, content, target_audience, department_id, semester,
        priority, publish_date, expiry_date, status, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Draft', $9)
     RETURNING id`,
    [
      data.title,
      data.content,
      data.targetAudience,
      data.departmentId ?? null,
      data.semester ?? null,
      data.priority,
      data.publishDate,
      data.expiryDate ?? null,
      userId,
    ]
  );

  const ann = await getAnnouncementById(rows[0].id, userId, 'admin');

  await auditLog({
    actorId: userId,
    action: 'CREATE_ANNOUNCEMENT',
    resource: 'announcements',
    resourceId: ann.id,
    changes: {
      title: data.title,
      targetAudience: data.targetAudience,
      priority: data.priority,
      publishDate: data.publishDate,
    },
  });

  return ann;
}

/**
 * Updates content and scheduling fields of an announcement.
 * targetAudience, departmentId, and semester are immutable after creation.
 * Any announcement status can be updated (admin responsibility).
 */
export async function updateAnnouncement(
  id: string,
  data: UpdateAnnouncementInput,
  userId: string
): Promise<Announcement> {
  const { rows } = await query<{ id: string }>(
    'SELECT id FROM announcements WHERE id = $1 AND deleted_at IS NULL',
    [id]
  );
  if (!rows[0]) throw AppError.notFound('Announcement not found');

  const updates: string[] = [];
  const params: unknown[] = [];

  const pushUpdate = (col: string, val: unknown) => {
    params.push(val);
    updates.push(`${col} = $${params.length}`);
  };

  if (data.title !== undefined)       pushUpdate('title',        data.title);
  if (data.content !== undefined)     pushUpdate('content',      data.content);
  if (data.priority !== undefined)    pushUpdate('priority',     data.priority);
  if (data.publishDate !== undefined) pushUpdate('publish_date', data.publishDate);
  if (data.expiryDate !== undefined)  pushUpdate('expiry_date',  data.expiryDate);

  if (updates.length === 0) throw AppError.badRequest('No valid fields to update');

  params.push(id);
  await query(
    `UPDATE announcements SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`,
    params
  );

  await auditLog({
    actorId: userId,
    action: 'UPDATE_ANNOUNCEMENT',
    resource: 'announcements',
    resourceId: id,
    changes: data,
  });

  return getAnnouncementById(id, userId, 'admin');
}

/**
 * Transitions the announcement to a new status.
 * All status transitions are valid for admin — no terminal states.
 * Expired → Published allows admin to republish recurring announcements.
 */
export async function updateAnnouncementStatus(
  id: string,
  newStatus: AnnouncementStatus,
  userId: string
): Promise<Announcement> {
  const { rows } = await query<{ status: AnnouncementStatus }>(
    'SELECT status FROM announcements WHERE id = $1 AND deleted_at IS NULL',
    [id]
  );
  if (!rows[0]) throw AppError.notFound('Announcement not found');

  const currentStatus = rows[0].status;
  if (currentStatus === newStatus) {
    throw AppError.badRequest(
      `Announcement is already in ${newStatus} status`,
      'ALREADY_IN_STATUS'
    );
  }

  await query(
    'UPDATE announcements SET status = $1, updated_at = NOW() WHERE id = $2',
    [newStatus, id]
  );

  await auditLog({
    actorId: userId,
    action: 'UPDATE_ANNOUNCEMENT_STATUS',
    resource: 'announcements',
    resourceId: id,
    changes: { from: currentStatus, to: newStatus },
  });

  return getAnnouncementById(id, userId, 'admin');
}

/**
 * Soft-deletes an announcement. Admin only — enforced at the route level.
 */
export async function deleteAnnouncement(id: string, userId: string): Promise<void> {
  const { rows } = await query<{ id: string }>(
    'SELECT id FROM announcements WHERE id = $1 AND deleted_at IS NULL',
    [id]
  );
  if (!rows[0]) throw AppError.notFound('Announcement not found');

  await query(
    'UPDATE announcements SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1',
    [id]
  );

  await auditLog({
    actorId: userId,
    action: 'DELETE_ANNOUNCEMENT',
    resource: 'announcements',
    resourceId: id,
    changes: {},
  });
}
