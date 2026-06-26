import { z } from 'zod';

/**
 * Password validation rule regex:
 * - At least 8 characters long
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one numeric digit
 * - At least one special character from the set [@$!%*?&]
 */
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export const passwordValidationSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .regex(
    PASSWORD_REGEX,
    'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)'
  );
