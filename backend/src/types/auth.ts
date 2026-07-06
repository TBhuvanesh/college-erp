import type { Role } from './roles';

export interface JwtAccessPayload {
  sub: string;
  email: string;
  role: Role;
  designation?: string;
  departmentId?: string;
  facultyId?: string;
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
  designation?: string;
  departmentId?: string;
  facultyId?: string;
  facultyProfile?: {
    id: string;
    employeeNumber: string;
    fullName: string;
    departmentId: string;
    departmentName: string;
    departmentCode: string;
    designation: string;
  };
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}
