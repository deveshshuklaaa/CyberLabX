import mongoose from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler.js';

/** API/database readiness; lab providers still run their existing per-start checks. */
export const healthCheck = asyncHandler(async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  const database = mongoose.connection.db;
  if (mongoose.connection.readyState === 1 && database) {
    try {
      const result = await database.admin().command({ ping: 1 }, { timeoutMS: 1500 });
      if (result.ok === 1) return res.json({ status: 'ok' });
    } catch { /* Public readiness must not expose connection details or driver errors. */ }
  }
  res.status(503).json({ status: 'unavailable' });
});
