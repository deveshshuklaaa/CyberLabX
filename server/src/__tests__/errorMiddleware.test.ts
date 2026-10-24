import { describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../middleware/error.js';
import { z } from 'zod';

describe('error middleware', () => {
  it('is registered as a four-argument Express error handler and returns 400 for validation errors', () => {
    const validationError = { name: 'ZodError' };
    const res: any = {
      statusCode: 200,
      body: undefined,
      status(code: number) { this.statusCode = code; return this; },
      json(body: unknown) { this.body = body; return this; },
    };

    (errorHandler as any)(validationError, {}, res, vi.fn());

    expect(errorHandler).toHaveLength(4);
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('Invalid request data.');
  });

  it('returns the documented JSON validation error even when runtime logging cannot inspect Zod errors', () => {
    const validation = z.object({ page: z.number().default(1) }).strict().safeParse({ teacherId: 'untrusted' });
    const logger = vi.spyOn(console, 'error').mockImplementation((...values: unknown[]) => {
      if (values.some(value => value !== null && typeof value === 'object')) throw new TypeError('Structured error inspection failed.');
    });
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    try {
      expect(() => (errorHandler as any)(validation.error, {}, res, vi.fn())).not.toThrow();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid request data.' });
    } finally { logger.mockRestore(); }
  });

  it('returns a generic JSON server error without inspecting the structured error object', () => {
    const logger = vi.spyOn(console, 'error').mockImplementation((...values: unknown[]) => {
      if (values.some(value => value !== null && typeof value === 'object')) throw new TypeError('Structured error inspection failed.');
    });
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    try {
      expect(() => (errorHandler as any)(new Error('Internal failure'), {}, res, vi.fn())).not.toThrow();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'An unexpected server error occurred.' });
    } finally { logger.mockRestore(); }
  });
});
