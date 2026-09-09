import 'dotenv/config';
import { z } from 'zod';

/**
 * Every environment variable is parsed here. The process refuses to start on a
 * missing or malformed value rather than failing later at an awkward moment.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1).default('file:./prisma/dev.db'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL_MIN: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  WEB_ORIGIN: z.string().default('http://localhost:3000'),

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('var/uploads'),
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:4000'),

  SMS_PROVIDER: z.enum(['noop', 'log']).default('noop'),
  ENABLE_CRON: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${issues}\n\nSee .env.example.`);
}

const env = parsed.data;

export const config = {
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  port: env.PORT,
  databaseUrl: env.DATABASE_URL,
  auth: {
    jwtSecret: new TextEncoder().encode(env.JWT_SECRET),
    accessTokenTtlMin: env.ACCESS_TOKEN_TTL_MIN,
    refreshTokenTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
  },
  corsOrigins: env.WEB_ORIGIN.split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  storage: {
    driver: env.STORAGE_DRIVER,
    localDir: env.STORAGE_LOCAL_DIR,
    publicBaseUrl: env.PUBLIC_BASE_URL.replace(/\/$/, ''),
  },
  smsProvider: env.SMS_PROVIDER,
  enableCron: env.ENABLE_CRON,
} as const;

export type Config = typeof config;
