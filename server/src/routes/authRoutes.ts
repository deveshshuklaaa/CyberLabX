import { Router } from 'express'; import rateLimit from 'express-rate-limit'; import { login, logout, me, register } from '../controllers/authController.js'; import { requireAuth } from '../middleware/auth.js';
import { googleCallback, startGoogleLink, startGoogleLogin } from '../controllers/googleAuthController.js';
export const authRouter = Router(); const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many login attempts. Try again later.' } }); authRouter.post('/register', loginLimiter, register); authRouter.post('/login', loginLimiter, login); authRouter.post('/logout', logout); authRouter.get('/me', requireAuth, me);
authRouter.get('/google', loginLimiter, startGoogleLogin);
authRouter.post('/google/link', loginLimiter, requireAuth, startGoogleLink);
authRouter.get('/google/callback', loginLimiter, googleCallback);
