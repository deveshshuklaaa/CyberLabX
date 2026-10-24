import type { ErrorRequestHandler, RequestHandler } from 'express'; import { ZodError } from 'zod';
export const notFound: RequestHandler = (req, res) => res.status(404).json({ message: `Route not found: ${req.method} ${req.path}` });
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const name = (err as { name?: string })?.name;
  if (err instanceof ZodError || name === 'ZodError' || name === '$ZodError') return res.status(400).json({ message: 'Invalid request data.' });
  if (name === 'CastError') return res.status(404).json({ message: 'Resource not found.' });
  // Inspecting structured errors can itself throw on the development Node/Zod runtime.
  console.error(err instanceof Error ? err.message : 'Unexpected request error.');
  res.status((err as { status?: number })?.status ?? 500).json({ message: 'An unexpected server error occurred.' });
};
