import { query, withTransaction } from '../config/database';
import { hashPassword } from '../utils/password';
import { auditLog } from '../utils/audit';
import { AppError } from '../errors/AppError';
import type {
  CreateAccountantInput,
  UpdateAccountantInput,
  ListAccountantsQuery,
  AccountantDetail,
} from '../types/accountant';

interface AccountantDetailRow {
  id: string;
  user_id: string;
  employee_number: string;
  full_name: string;
  avatar_url: string | null;
  email: string;
  phone_number: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface AccountantListRow extends AccountantDetailRow {
  total_count: string;
}

const DETAIL_COLS = `
  a.id, a.user_id, a.employee_number, a.full_name, a.avatar_url,
  u.email, u.phone_number, u.is_active,
  a.created_at, a.updated_at
`;

const JOINS = `
  JOIN users u ON u.id = a.user_id
`;

function toDetail(r: AccountantDetailRow): AccountantDetail {
  return {
    id: r.id,
    userId: r.user_id,
    employeeNumber: r.employee_number,
    fullName: r.full_name,
    email: r.email,
    phoneNumber: r.phone_number ?? undefined,
    avatarUrl: r.avatar_url ?? undefined,
    isActive: r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function getAccountantById(id: string): Promise<AccountantDetail> {
  const { rows } = await query<AccountantDetailRow>(
    `SELECT ${DETAIL_COLS} FROM accountants a ${JOINS}
     WHERE a.id = $1 AND a.deleted_at IS NULL`,
    [id]
  );
  if (!rows[0]) throw AppError.notFound('Accountant not found');
  return toDetail(rows[0]);
}

export async function createAccountant(
  data: CreateAccountantInput,
  actorId: string
): Promise<AccountantDetail> {
  return withTransaction(async (client) => {
    // Validate employee number uniqueness
    const { rows: empCheck } = await client.query<{ id: string }>(
      'SELECT id FROM accountants WHERE employee_number = $1 AND deleted_at IS NULL',
      [data.employeeNumber]
    );
    if (empCheck[0]) {
      throw AppError.badRequest(`Employee ID '${data.employeeNumber}' is already registered`, 'EMPLOYEE_NUMBER_DUPLICATE');
    }

    // Validate email uniqueness
    const { rows: emailCheck } = await client.query<{ id: string }>(
      'SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL',
      [data.email.toLowerCase()]
    );
    if (emailCheck[0]) {
      throw AppError.badRequest(`Email '${data.email}' is already registered`, 'EMAIL_DUPLICATE');
    }

    // Create auth account
    const passwordHash = await hashPassword(data.password);
    const { rows: userRows } = await client.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, role, full_name, phone_number)
       VALUES ($1, $2, 'accountant', $3, $4)
       RETURNING id`,
      [data.email, passwordHash, data.fullName, data.phoneNumber ?? null]
    );
    const userId = userRows[0].id;

    // Create profile
    const { rows: profileRows } = await client.query<{ id: string }>(
      `INSERT INTO accountants (user_id, employee_number, full_name, avatar_url)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [userId, data.employeeNumber, data.fullName, data.avatarUrl ?? null]
    );
    const accountantId = profileRows[0].id;

    // Fetch full details
    const { rows: detail } = await client.query<AccountantDetailRow>(
      `SELECT ${DETAIL_COLS} FROM accountants a ${JOINS} WHERE a.id = $1`,
      [accountantId]
    );

    await auditLog({
      actorId,
      action: 'CREATE_ACCOUNTANT',
      resource: 'accountants',
      resourceId: accountantId,
      changes: { employeeNumber: data.employeeNumber, email: data.email },
    });

    return toDetail(detail[0]);
  });
}

export async function updateAccountant(
  id: string,
  data: UpdateAccountantInput,
  actorId: string
): Promise<AccountantDetail> {
  const current = await getAccountantById(id);

  return withTransaction(async (client) => {
    // If updating email, check uniqueness
    if (data.email && data.email.toLowerCase() !== current.email.toLowerCase()) {
      const { rows: emailCheck } = await client.query<{ id: string }>(
        'SELECT id FROM users WHERE email = $1 AND id != $2 AND deleted_at IS NULL',
        [data.email.toLowerCase(), current.userId]
      );
      if (emailCheck[0]) {
        throw AppError.badRequest(`Email '${data.email}' is already registered`, 'EMAIL_DUPLICATE');
      }
      await client.query('UPDATE users SET email = $1 WHERE id = $2', [data.email.toLowerCase(), current.userId]);
    }

    // If updating password, hash it
    if (data.password) {
      const passwordHash = await hashPassword(data.password);
      await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, current.userId]);
    }

    // Update phone_number in users table
    if (data.phoneNumber !== undefined) {
      await client.query('UPDATE users SET phone_number = $1 WHERE id = $2', [data.phoneNumber || null, current.userId]);
    }

    // Update accountants table fields
    const setClauses: string[] = [];
    const params: unknown[] = [];

    const set = (col: string, val: unknown) => {
      params.push(val);
      setClauses.push(`${col} = $${params.length}`);
    };

    if (data.fullName !== undefined) {
      set('full_name', data.fullName);
      await client.query('UPDATE users SET full_name = $1 WHERE id = $2', [data.fullName, current.userId]);
    }
    if (data.employeeNumber !== undefined) {
      // Validate unique employee ID
      const { rows: empCheck } = await client.query<{ id: string }>(
        'SELECT id FROM accountants WHERE employee_number = $1 AND id != $2 AND deleted_at IS NULL',
        [data.employeeNumber, id]
      );
      if (empCheck[0]) {
        throw AppError.badRequest(`Employee ID '${data.employeeNumber}' is already registered`, 'EMPLOYEE_NUMBER_DUPLICATE');
      }
      set('employee_number', data.employeeNumber);
    }
    if (data.avatarUrl !== undefined) {
      set('avatar_url', data.avatarUrl || null);
    }

    if (setClauses.length > 0) {
      params.push(id);
      await client.query(
        `UPDATE accountants
         SET ${setClauses.join(', ')}
         WHERE id = $${params.length} AND deleted_at IS NULL`,
        params
      );
    }

    await auditLog({
      actorId,
      action: 'UPDATE_ACCOUNTANT',
      resource: 'accountants',
      resourceId: id,
      changes: data as Record<string, unknown>,
    });

    const { rows: detail } = await client.query<AccountantDetailRow>(
      `SELECT ${DETAIL_COLS} FROM accountants a ${JOINS} WHERE a.id = $1`,
      [id]
    );

    return toDetail(detail[0]);
  });
}

export async function updateAccountantStatus(
  id: string,
  isActive: boolean,
  actorId: string
): Promise<AccountantDetail> {
  const current = await getAccountantById(id);

  await query('UPDATE users SET is_active = $1 WHERE id = $2', [isActive, current.userId]);

  await auditLog({
    actorId,
    action: 'UPDATE_ACCOUNTANT_STATUS',
    resource: 'accountants',
    resourceId: id,
    changes: { isActive },
  });

  return getAccountantById(id);
}

export async function deleteAccountant(id: string, actorId: string): Promise<void> {
  const current = await getAccountantById(id);

  await withTransaction(async (client) => {
    await client.query('UPDATE accountants SET deleted_at = NOW() WHERE id = $1', [id]);
    await client.query('UPDATE users SET is_active = FALSE, deleted_at = NOW() WHERE id = $1', [current.userId]);
  });

  await auditLog({
    actorId,
    action: 'DELETE_ACCOUNTANT',
    resource: 'accountants',
    resourceId: id,
  });
}

export async function listAccountants(filters: ListAccountantsQuery): Promise<{
  accountants: AccountantDetail[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> {
  const conditions: string[] = ['a.deleted_at IS NULL'];
  const params: unknown[] = [];

  const push = (condition: string, value: unknown) => {
    params.push(value);
    conditions.push(`${condition} $${params.length}`);
  };

  if (filters.isActive !== undefined) {
    push('u.is_active =', filters.isActive);
  }

  if (filters.search) {
    const term = `%${filters.search}%`;
    params.push(term);
    conditions.push(
      `(a.full_name ILIKE $${params.length} OR a.employee_number ILIKE $${params.length} OR u.email ILIKE $${params.length})`
    );
  }

  const offset = (filters.page - 1) * filters.limit;
  params.push(filters.limit, offset);

  const { rows } = await query<AccountantListRow>(
    `SELECT ${DETAIL_COLS}, COUNT(*) OVER() AS total_count
     FROM accountants a ${JOINS}
     WHERE ${conditions.join(' AND ')}
     ORDER BY a.employee_number ASC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const total = rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0;

  return {
    accountants: rows.map(toDetail),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.ceil(total / filters.limit),
    },
  };
}
