import { describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../middleware/error.js';

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
});
