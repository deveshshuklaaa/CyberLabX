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

const schema = z.object({
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
});

export const env = schema.parse(process.env);

export const isProduction = env.NODE_ENV === 'production';
