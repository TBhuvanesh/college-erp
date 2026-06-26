import type { Role } from './roles';

export interface JwtAccessPayload {
  sub: string;
  email: string;
  role: Role;
}

export interface JwtRefreshPayload {
  sub: string;
  tokenId: string;
}

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}
