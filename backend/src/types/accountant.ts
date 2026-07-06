import { z } from 'zod';

export const createAccountantSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
  employeeNumber: z.string().min(1, 'Employee ID is required').max(20).trim().toUpperCase(),
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(255).trim(),
  phoneNumber: z.string().max(20).trim().optional(),
  avatarUrl: z.string().url('Invalid photo URL').optional(),
});

export const updateAccountantSchema = z
  .object({
    fullName: z.string().min(2).max(255).trim().optional(),
    phoneNumber: z.string().max(20).trim().optional(),
    avatarUrl: z.string().url('Invalid photo URL').optional(),
    employeeNumber: z.string().min(1).max(20).trim().toUpperCase().optional(),
    email: z.string().email().toLowerCase().trim().optional(),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Password must contain at least one uppercase letter, one lowercase letter, and one number'
      )
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const listAccountantsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(20),
  search: z.string().max(100).trim().optional(),
  isActive: z.preprocess(
    (val) => (val === 'true' ? true : val === 'false' ? false : undefined),
    z.boolean().optional()
  ),
});

export type CreateAccountantInput = z.infer<typeof createAccountantSchema>;
export type UpdateAccountantInput = z.infer<typeof updateAccountantSchema>;
export type ListAccountantsQuery = z.infer<typeof listAccountantsQuerySchema>;

export interface AccountantDetail {
  id: string;
  userId: string;
  employeeNumber: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  avatarUrl?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
