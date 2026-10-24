import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { env: { JWT_SECRET: 'test-only-secret-never-use-in-production', LAB_BACKEND: 'docker' } } });
