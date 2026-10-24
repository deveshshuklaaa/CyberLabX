import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);

// env.ts is:
// C:\dev\CyberLabX\server\src\config\env.ts
//
// ../../../.env resolves to:
// C:\dev\CyberLabX\.env
const rootEnvPath = path.resolve(currentDir, '../../../.env');

dotenv.config({ path: rootEnvPath });

export const environmentSchema = z.object({
  GOOGLE_CLIENT_ID: z.preprocess(value => value === '' ? undefined : value, z.string().min(1).optional()),
  GOOGLE_CLIENT_SECRET: z.preprocess(value => value === '' ? undefined : value, z.string().min(1).optional()),
  GOOGLE_CALLBACK_URL: z.preprocess(value => value === '' ? undefined : value, z.string().url().optional()),
  LAB_BACKEND: z.enum(['docker', 'qemu']).default('docker'),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  SERVER_PORT: z.coerce
    .number()
    .int()
    .positive()
    .default(5000),

  CLIENT_URL: z
    .string()
    .url()
    .default('http://localhost:5173'),

  MONGO_URI: z
    .string()
    .min(1)
    .default('mongodb://localhost:27017/cyberlabx'),

  JWT_SECRET: z
    .string()
    .min(24, 'JWT_SECRET must be at least 24 characters'),

  JWT_EXPIRES_IN: z
    .string()
    .default('7d'),

  BCRYPT_ROUNDS: z.coerce
    .number()
    .int()
    .min(10)
    .max(15)
    .default(12),

  LAB_NETWORK_PREFIX: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]*$/)
    .default('cyberlabx-lab'),

  LAB_IMAGE: z
    .string()
    .default('cyberlabx-kali:latest'),

  TARGET_IMAGE: z
    .string()
    .default('cyberlabx-target:latest'),

  DOS_ATTACKER_IMAGE: z.string().default('cyberlabx-dos-attacker:latest'),
  DOS_VICTIM_IMAGE: z.string().default('cyberlabx-dos-victim:latest'),
  DOS_CLIENT_IMAGE: z.string().default('cyberlabx-dos-client:latest'),

  RECON_STUDENT_IMAGE: z.string().default('cyberlabx-recon:latest'),
  RECON_TARGET_IMAGE: z.string().default('cyberlabx-recon-target:latest'),
  KEYLOGGER_IMAGE: z.string().default('cyberlabx-keylogger-lab:latest'),
  EMAIL_FORENSICS_IMAGE: z.string().default('cyberlabx-email-forensics:latest'),
  FILE_FORENSICS_IMAGE: z.string().default('cyberlabx-file-forensics:latest'),
  DISK_FORENSICS_IMAGE: z.string().default('cyberlabx-disk-forensics:latest'),

  REPORT_DIR: z
    .string()
    .default('./reports'),

  LAB_TTL_MINUTES: z.coerce
    .number()
    .int()
    .min(5)
    .max(180)
    .default(45),

  LAB_MEMORY_MB: z.coerce
    .number()
    .int()
    .min(128)
    .max(2048)
    .default(512),

  LAB_CPU_NANOS: z.coerce
    .number()
    .int()
    .min(100000000)
    .default(500000000),
}).superRefine((value, context) => {
  const google = [value.GOOGLE_CLIENT_ID, value.GOOGLE_CLIENT_SECRET, value.GOOGLE_CALLBACK_URL];
  if (google.some(Boolean) && !google.every(Boolean)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['GOOGLE_CLIENT_ID'], message: 'Configure all three Google OAuth environment variables or leave all three empty.' });
  }
  if (value.GOOGLE_CALLBACK_URL) {
    let callback: URL;
    try { callback = new URL(value.GOOGLE_CALLBACK_URL); } catch { return; }
    const localHttp = callback.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(callback.hostname);
    if ((callback.protocol !== 'https:' && !localHttp) || (value.NODE_ENV === 'production' && callback.protocol !== 'https:') || callback.username || callback.password || callback.search || callback.hash || callback.pathname !== '/api/auth/google/callback') {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['GOOGLE_CALLBACK_URL'], message: 'Use the backend /api/auth/google/callback URL with HTTPS (HTTP localhost is allowed in development).' });
    }
    if (value.NODE_ENV === 'production' && !value.CLIENT_URL.startsWith('https://')) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['CLIENT_URL'], message: 'Google sign-in requires an HTTPS frontend in production.' });
    }
  }
});

export const env = environmentSchema.parse(process.env);

export const isProduction = env.NODE_ENV === 'production';
