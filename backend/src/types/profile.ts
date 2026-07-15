import { z } from 'zod';
import type { Role } from './roles';

// ── Domain Interfaces ─────────────────────────────────────────────────────────

export interface BaseProfile {
  userId: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  lastLogin: Date | null;
}

export interface AdminProfile extends BaseProfile {
  role: 'admin';
}

export interface FacultyProfile extends BaseProfile {
  role: 'faculty';
  employeeNumber: string;
  designation: string;
  department: { id: string; name: string; code: string };
}

export interface StudentProfile extends BaseProfile {
  role: 'student';
  id: string;
  rollNumber: string;
  semester: number;
  year: number;
  section: string | null;
  academicYear: string;
  status: string;
  department: { id: string; name: string; code: string };
  program: { id: string; name: string; code: string };
}

export type ProfileView = AdminProfile | FacultyProfile | StudentProfile;

// ── Zod Validation Schemas ────────────────────────────────────────────────────

export const updateProfileSchema = z
  .object({
    phoneNumber: z
      .string()
      .trim()
      .min(7, 'Phone number must be at least 7 characters')
      .max(20, 'Phone number must be at most 20 characters')
      .regex(/^[+\d\s\-().]+$/, 'Invalid phone number format')
      .optional(),
    email: z.string().email('Invalid email address').toLowerCase().trim().optional(),
  })
  .refine((data) => data.phoneNumber !== undefined || data.email !== undefined, {
    message: 'At least one field must be provided (phoneNumber or email)',
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Password must contain at least one uppercase letter, one lowercase letter, and one number'
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: 'New password must be different from the current password',
    path: ['newPassword'],
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
