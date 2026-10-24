import bcrypt from 'bcrypt'; import jwt from 'jsonwebtoken'; import type { Response } from 'express'; import { env, isProduction } from '../config/env.js'; import { User, type UserDocument } from '../models/User.js';

export class RegistrationConflictError extends Error {
  constructor() {
    super('An account with this email already exists.');
    this.name = 'RegistrationConflictError';
  }
}

export async function registerUser(input: { firstName: string; lastName: string; email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  if (await User.exists({ email })) throw new RegistrationConflictError();
  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);
  try {
    return await User.create({ firstName: input.firstName, lastName: input.lastName, email, passwordHash, role: 'student', isActive: true });
  } catch (error) {
    // The unique index is authoritative when two registrations race past the pre-check.
    if ((error as { code?: number })?.code === 11000) throw new RegistrationConflictError();
    throw error;
  }
}
export async function authenticate(email: string, password: string) { const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+passwordHash'); if (!user || !user.isActive || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) return null; return user; }
export function setSessionCookie(res: Response, user: UserDocument) { const token = jwt.sign({ sub: String(user._id), role: user.role }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] }); res.cookie('cyberlabx_session', token, { httpOnly: true, secure: isProduction, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000, path: '/' }); }
export function clearSessionCookie(res: Response) { res.clearCookie('cyberlabx_session', { httpOnly: true, secure: isProduction, sameSite: 'lax', path: '/' }); }
export function publicUser(user: UserDocument) { return { id: String(user._id), firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role, isActive: user.isActive }; }
