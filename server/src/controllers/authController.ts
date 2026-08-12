import { z } from 'zod'; import { asyncHandler } from '../utils/asyncHandler.js'; import { authenticate, clearSessionCookie, publicUser, registerUser, setSessionCookie } from '../services/authService.js';
const registration = z.object({ firstName: z.string().trim().min(1).max(60), lastName: z.string().trim().min(1).max(60), email: z.string().trim().email().max(254), password: z.string().min(12).max(128), role: z.enum(['student', 'faculty']).optional() });
export const register = asyncHandler(async (req, res) => { const user = await registerUser(registration.parse(req.body)); setSessionCookie(res, user); res.status(201).json({ user: publicUser(user) }); });
export const login = asyncHandler(async (req, res) => { const input = z.object({ email: z.string().email(), password: z.string().min(1).max(128) }).parse(req.body); const user = await authenticate(input.email, input.password); if (!user) return res.status(401).json({ message: 'Invalid email or password.' }); setSessionCookie(res, user); res.json({ user: publicUser(user) }); });
export const logout = asyncHandler(async (_req, res) => { clearSessionCookie(res); res.status(204).send(); });
export const me = asyncHandler(async (req, res) => res.json({ user: publicUser(req.user!) }));

