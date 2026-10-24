import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { CookieOptions, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env, isProduction } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import { setSessionCookie } from '../services/authService.js';
import { exchangeGoogleIdentity, googleAuthorizationUrl, GoogleAuthError, resolveGoogleUser, roleDestination } from '../services/googleAuthService.js';

const transactionCookie = 'cyberlabx_google_oauth';
const cookieOptions: CookieOptions = { httpOnly: true, secure: isProduction, sameSite: 'lax', path: '/api/auth/google' };
const transactionSchema = z.object({ state: z.string().regex(/^[a-f\d]{64}$/i), nonce: z.string().length(64),
  verifier: z.string().min(43).max(128), linkUserId: z.string().regex(/^[a-f\d]{24}$/i).optional() });

function noStore(res: Response) { res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }); }
function failed(res: Response, error: unknown) {
  const code = error instanceof GoogleAuthError ? error.code : 'provider_unavailable';
  // No provider errors, codes, tokens, stack traces or client secrets in redirects or logs.
  res.redirect(303, new URL(`/login?oauth_error=${code}`, env.CLIENT_URL).toString());
}
function begin(req: Request, res: Response, linkUserId?: string) {
  noStore(res);
  try {
    const state = randomBytes(32).toString('hex'); const nonce = randomBytes(32).toString('hex');
    const verifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256').update(verifier).digest('base64url');
    const url = googleAuthorizationUrl({ state, nonce, codeChallenge });
    const transaction = jwt.sign({ state, nonce, verifier, ...(linkUserId ? { linkUserId } : {}) }, env.JWT_SECRET,
      { algorithm: 'HS256', issuer: 'cyberlabx', audience: 'cyberlabx:google-oauth', expiresIn: '10m' });
    res.cookie(transactionCookie, transaction, { ...cookieOptions, maxAge: 10 * 60_000 });
    if (linkUserId) res.json({ url }); else res.redirect(302, url);
  } catch (error) { failed(res, error); }
}

export function startGoogleLogin(req: Request, res: Response) { begin(req, res); }
export function startGoogleLink(req: Request, res: Response) {
  noStore(res);
  if (req.get('origin') !== new URL(env.CLIENT_URL).origin) return res.status(403).json({ message: 'This account-link request is not allowed.' });
  begin(req, res, String(req.user!._id));
}
export function clearGoogleTransaction(res: Response) { res.clearCookie(transactionCookie, cookieOptions); }

export async function googleCallback(req: Request, res: Response) {
  noStore(res); clearGoogleTransaction(res);
  try {
    const query = z.object({ state: z.string().regex(/^[a-f\d]{64}$/i), code: z.string().min(1).max(4096).optional(), error: z.string().max(256).optional() }).safeParse(req.query);
    if (!query.success || typeof req.cookies?.[transactionCookie] !== 'string') throw new GoogleAuthError('invalid_callback');
    let transaction: z.infer<typeof transactionSchema>;
    try {
      transaction = transactionSchema.parse(jwt.verify(req.cookies[transactionCookie], env.JWT_SECRET,
        { algorithms: ['HS256'], issuer: 'cyberlabx', audience: 'cyberlabx:google-oauth' }));
    } catch { throw new GoogleAuthError('invalid_callback'); }
    if (!timingSafeEqual(Buffer.from(query.data.state), Buffer.from(transaction.state))) throw new GoogleAuthError('invalid_callback');
    if (query.data.error) throw new GoogleAuthError(query.data.error === 'access_denied' ? 'access_denied' : 'provider_unavailable');
    if (!query.data.code) throw new GoogleAuthError('invalid_callback');
    if (transaction.linkUserId) {
      // The same active account must still be authenticated when the link finishes.
      let authenticated = false;
      await requireAuth(req, res, () => { authenticated = true; });
      if (!authenticated) return;
      if (String(req.user!._id) !== transaction.linkUserId) throw new GoogleAuthError('account_conflict');
    }
    const identity = await exchangeGoogleIdentity(query.data.code, transaction.verifier, transaction.nonce);
    const user = await resolveGoogleUser(identity, transaction.linkUserId);
    setSessionCookie(res, user);
    res.redirect(303, new URL(roleDestination(user.role), env.CLIENT_URL).toString());
  } catch (error) {
    // A failed login does not replace an existing authenticated session.
    failed(res, error);
  }
}
