import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database';
import { hashPassword, verifyPassword } from '../utils/password';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { AppError } from '../errors/AppError';
import type { Role } from '../types/roles';
import type { TokenPair, AuthUser } from '../types/auth';

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: Role;
  is_active: boolean;
}

interface RefreshTokenRow {
  user_id: string;
  revoked_at: Date | null;
  expires_at: Date;
  email: string;
  role: Role;
  is_active: boolean;
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Cached after first computation — prevents timing attacks when a user is not found
// by ensuring bcrypt always runs regardless of whether the email exists.
let timingDummyHash: string | undefined;

async function getTimingDummyHash(): Promise<string> {
  if (!timingDummyHash) {
    timingDummyHash = await hashPassword('__timing_safe_dummy_never_matches__');
  }
  return timingDummyHash;
}

export async function login(
  email: string,
  password: string
): Promise<{ tokens: TokenPair; user: AuthUser }> {
  const { rows } = await query<UserRow>(
    `SELECT id, email, password_hash, role, is_active
     FROM users
     WHERE email = $1 AND deleted_at IS NULL`,
    [email.toLowerCase()]
  );

  const user = rows[0];

  // Always run bcrypt regardless of whether user exists to prevent timing-based
  // user enumeration attacks.
  const hashToCompare = user?.password_hash ?? (await getTimingDummyHash());
  const passwordValid = await verifyPassword(password, hashToCompare);

  if (!user || !passwordValid) {
    throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  if (!user.is_active) {
    throw AppError.forbidden('Account is deactivated. Contact your administrator.', 'ACCOUNT_DEACTIVATED');
  }

  const tokens = await issueTokenPair(user.id, user.email, user.role);

  let designation: string | undefined;
  let departmentId: string | undefined;

  if (user.role === 'faculty') {
    const { rows: facRows } = await query<{ designation: string; department_id: string }>(
      'SELECT designation, department_id FROM faculty WHERE user_id = $1 AND deleted_at IS NULL',
      [user.id]
    );
    if (facRows[0]) {
      designation = facRows[0].designation;
      departmentId = facRows[0].department_id;
    }
  }

  await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

  return {
    tokens,
    user: { id: user.id, email: user.email, role: user.role, isActive: user.is_active, designation, departmentId },
  };
}

export async function refresh(
  refreshToken: string
): Promise<{ tokens: TokenPair; user: AuthUser }> {
  // Verify JWT signature before touching the database
  const payload = verifyRefreshToken(refreshToken);
  const tokenHash = hashToken(refreshToken);

  const { rows } = await query<RefreshTokenRow>(
    `SELECT rt.user_id, rt.revoked_at, rt.expires_at,
            u.email, u.role, u.is_active
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1 AND rt.user_id = $2`,
    [tokenHash, payload.sub]
  );

  const stored = rows[0];

  // 1. Token doesn't exist
  if (!stored) {
    throw AppError.unauthorized('Refresh token is invalid', 'TOKEN_INVALID');
  }

  // 2. Natural expiration check (simply return unauthorized without global revocation)
  if (new Date(stored.expires_at) < new Date()) {
    throw AppError.unauthorized('Refresh token has expired', 'TOKEN_EXPIRED');
  }

  // 3. Token reuse detection (revoked_at is not null)
  if (stored.revoked_at !== null) {
    await query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
      [payload.sub]
    );
    throw AppError.unauthorized('Refresh token has been reused', 'TOKEN_REUSED');
  }

  if (!stored.is_active) {
    throw AppError.forbidden('Account is deactivated', 'ACCOUNT_DEACTIVATED');
  }

  // Rotate: revoke consumed token before issuing new pair
  await query(
    'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1',
    [tokenHash]
  );

  const tokens = await issueTokenPair(stored.user_id, stored.email, stored.role);

  let designation: string | undefined;
  let departmentId: string | undefined;

  if (stored.role === 'faculty') {
    const { rows: facRows } = await query<{ designation: string; department_id: string }>(
      'SELECT designation, department_id FROM faculty WHERE user_id = $1 AND deleted_at IS NULL',
      [stored.user_id]
    );
    if (facRows[0]) {
      designation = facRows[0].designation;
      departmentId = facRows[0].department_id;
    }
  }

  return {
    tokens,
    user: {
      id: stored.user_id,
      email: stored.email,
      role: stored.role,
      isActive: stored.is_active,
      designation,
      departmentId,
    },
  };
}

export async function logout(refreshToken: string): Promise<void> {
  const tokenHash = hashToken(refreshToken);
  await query(
    'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1',
    [tokenHash]
  );
}

export async function logoutAll(userId: string): Promise<void> {
  await query(
    'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
    [userId]
  );
}

async function issueTokenPair(
  userId: string,
  email: string,
  role: Role
): Promise<TokenPair> {
  const tokenId = uuidv4();
  const refreshToken = signRefreshToken({ sub: userId, tokenId });

  let designation: string | undefined;
  let departmentId: string | undefined;

  if (role === 'faculty') {
    const { rows } = await query<{ designation: string; department_id: string }>(
      'SELECT designation, department_id FROM faculty WHERE user_id = $1 AND deleted_at IS NULL',
      [userId]
    );
    if (rows[0]) {
      designation = rows[0].designation;
      departmentId = rows[0].department_id;
    }
  }

  const accessToken = signAccessToken({ sub: userId, email, role, designation, departmentId });
  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );

  return { accessToken, refreshToken };
}
