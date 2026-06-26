import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  BCRYPT_ROUNDS: z.coerce.number().min(10).max(14).default(12),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  UPLOAD_DIR: z.string().default('uploads/documents'),
  LMS_UPLOAD_DIR: z.string().default('uploads/lms'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  const fieldErrors = parsed.error.flatten().fieldErrors;
  for (const [key, errors] of Object.entries(fieldErrors)) {
    console.error(`  ${key}: ${errors?.join(', ')}`);
  }
  process.exit(1);
}

export const env = parsed.data;
