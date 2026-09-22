import 'dotenv/config';
import { z } from 'zod';

/**
 * Centralized, validated environment configuration.
 * The app refuses to boot with an invalid environment.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  API_BASE_URL: z.string().url().default('http://localhost:4000'),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  SESSION_IDLE_MINUTES: z.coerce.number().int().positive().default(480),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(60),
  TOTP_ISSUER: z.string().default('Береке ТехСервис CRM'),

  FRONTEND_CRM_URL: z.string().url().default('http://localhost:3000'),
  FRONTEND_LANDING_URL: z.string().url().default('http://localhost:3001'),
  /** Extra CORS origins, comma-separated (e.g. http://87.199.130.251). */
  CORS_ORIGINS: z.string().optional(),
  /**
   * Secure-флаг cookie refresh-токена.
   * auto = true в production (HTTPS). На HTTP по IP поставьте false.
   */
  COOKIE_SECURE: z.enum(['true', 'false', 'auto']).default('auto'),

  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().default('tisei-attachments'),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  S3_PUBLIC_URL: z.string().optional(),

  EMAIL_PROVIDER: z.enum(['smtp', 'sendgrid', 'mailgun', 'console']).default('console'),
  EMAIL_FROM: z.string().default('Береке ТехСервис CRM <no-reply@tisei.kz>'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_SECURE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  SENDGRID_API_KEY: z.string().optional(),
  MAILGUN_API_KEY: z.string().optional(),
  MAILGUN_DOMAIN: z.string().optional(),

  WEB_PUSH_VAPID_PUBLIC_KEY: z.string().optional(),
  WEB_PUSH_VAPID_PRIVATE_KEY: z.string().optional(),
  WEB_PUSH_SUBJECT: z.string().default('mailto:admin@tisei.kz'),

  /** Firebase Cloud Messaging (native push). Optional — without these, inbox still works. */
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  /** Alternative: full service-account JSON as a single string */
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  /** Preferred: absolute/relative path to downloaded Firebase service account JSON */
  FIREBASE_SERVICE_ACCOUNT_PATH: z.string().optional(),

  GEO_PROVIDER: z.enum(['twogis', 'yandex']).default('twogis'),
  TWOGIS_API_KEY: z.string().optional(),
  YANDEX_GEOCODER_API_KEY: z.string().optional(),
  YANDEX_MAPS_API_KEY: z.string().optional(),

  RECAPTCHA_SECRET: z.string().optional(),
  RECAPTCHA_MIN_SCORE: z.coerce.number().default(0.5),

  PUBLIC_REQUEST_RATE_MAX: z.coerce.number().int().positive().default(5),
  PUBLIC_REQUEST_RATE_WINDOW: z.string().default('1 minute'),
  LOGIN_RATE_MAX: z.coerce.number().int().positive().default(10),
  LOGIN_RATE_WINDOW: z.string().default('1 minute'),

  SOFT_DELETE_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment configuration:');
  // eslint-disable-next-line no-console
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;

export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
export const isCookieSecure =
  env.COOKIE_SECURE === 'true' || (env.COOKIE_SECURE === 'auto' && isProd);

export function corsOrigins(): string[] {
  const extra = (env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([env.FRONTEND_CRM_URL, env.FRONTEND_LANDING_URL, ...extra])];
}
