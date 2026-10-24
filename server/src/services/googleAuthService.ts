import { OAuth2Client, CodeChallengeMethod } from 'google-auth-library';
import { z } from 'zod';
import { env } from '../config/env.js';
import { User, type Role, type UserDocument } from '../models/User.js';

export type GoogleAuthErrorCode = 'not_configured' | 'access_denied' | 'invalid_callback' | 'invalid_identity' | 'account_exists' | 'account_disabled' | 'account_conflict' | 'provider_unavailable';
export class GoogleAuthError extends Error {
  constructor(public readonly code: GoogleAuthErrorCode) { super(code); }
}

function googleClient() {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_CALLBACK_URL) throw new GoogleAuthError('not_configured');
  return new OAuth2Client({ clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: env.GOOGLE_CALLBACK_URL, transporterOptions: { timeout: 10_000, retry: false } });
}

export function googleAuthorizationUrl(input: { state: string; nonce: string; codeChallenge: string }) {
  return googleClient().generateAuthUrl({ scope: ['openid', 'email', 'profile'],
    response_type: 'code', state: input.state, nonce: input.nonce,
    code_challenge: input.codeChallenge, code_challenge_method: CodeChallengeMethod.S256,
    prompt: 'select_account', access_type: 'online' });
}

const claimsSchema = z.object({
  sub: z.string().min(1).max(255), email: z.string().email().max(254), email_verified: z.literal(true),
  name: z.string().trim().min(1).max(300), given_name: z.string().trim().optional(), family_name: z.string().trim().optional(),
  nonce: z.string(), aud: z.string(), iss: z.enum(['https://accounts.google.com', 'accounts.google.com']),
  exp: z.number(), picture: z.string().max(2048).optional(),
});
export interface GoogleIdentity { subject: string; email: string; firstName: string; lastName: string; avatarUrl?: string; }

/** Signature, issuer, audience and expiry are checked by Google's library before claims are used. */
export async function exchangeGoogleIdentity(code: string, codeVerifier: string, nonce: string): Promise<GoogleIdentity> {
  const client = googleClient();
  let idToken: string;
  try {
    const { tokens } = await client.getToken({ code, codeVerifier });
    if (!tokens.id_token) throw new GoogleAuthError('invalid_identity');
    idToken = tokens.id_token;
  } catch (error) {
    if (error instanceof GoogleAuthError) throw error;
    const providerError = (error as { response?: { data?: { error?: string } } }).response?.data?.error;
    throw new GoogleAuthError(providerError === 'invalid_grant' ? 'invalid_callback' : 'provider_unavailable');
  }
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: env.GOOGLE_CLIENT_ID });
    const claims = claimsSchema.parse(ticket.getPayload());
    if (claims.nonce !== nonce || claims.aud !== env.GOOGLE_CLIENT_ID || claims.exp <= Date.now() / 1000) throw new GoogleAuthError('invalid_identity');
    const avatarUrl = claims.picture?.startsWith('https://') ? claims.picture : undefined;
    return { subject: claims.sub, email: claims.email.toLowerCase(),
      firstName: (claims.given_name || claims.name).slice(0, 60), lastName: (claims.family_name || '').slice(0, 60), avatarUrl };
  } catch (error) {
    const transportError = error as { code?: string; response?: { status?: number } };
    const unavailable = ['ENOTFOUND', 'ECONNRESET', 'ETIMEDOUT'].includes(transportError.code ?? '') || (transportError.response?.status ?? 0) >= 500;
    throw new GoogleAuthError(unavailable ? 'provider_unavailable' : 'invalid_identity');
  }
}

function active(user: UserDocument) {
  if (!user.isActive) throw new GoogleAuthError('account_disabled');
  return user;
}

/** Never grant access to a password account based solely on matching Google email. */
export async function resolveGoogleUser(identity: GoogleIdentity, linkUserId?: string): Promise<UserDocument> {
  await User.init(); // Wait for the unique provider/email indexes before accepting concurrent signups.
  const existing = await User.findOne({ googleId: identity.subject });
  if (existing) {
    if (linkUserId && String(existing._id) !== linkUserId) throw new GoogleAuthError('account_conflict');
    return active(existing);
  }
  try {
    if (linkUserId) {
      const user = await User.findById(linkUserId);
      if (!user) throw new GoogleAuthError('account_conflict');
      active(user);
      if (user.email !== identity.email || user.googleId) throw new GoogleAuthError('account_conflict');
      const linked = await User.findOneAndUpdate({ _id: user._id, isActive: true, email: identity.email, googleId: { $exists: false } },
        { $set: { googleId: identity.subject, avatarUrl: identity.avatarUrl } }, { new: true, runValidators: true });
      if (!linked) throw new GoogleAuthError('account_conflict');
      return linked;
    }
    if (await User.exists({ email: identity.email })) throw new GoogleAuthError('account_exists');
    return await User.create({ firstName: identity.firstName, lastName: identity.lastName, email: identity.email,
      googleId: identity.subject, avatarUrl: identity.avatarUrl, role: 'student', isActive: true });
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    // Unique email/provider indexes arbitrate concurrent callbacks; never merge different identities.
    const winner = await User.findOne({ googleId: identity.subject });
    if (winner && (!linkUserId || String(winner._id) === linkUserId)) return active(winner);
    throw new GoogleAuthError('account_conflict');
  }
}

export function roleDestination(role: Role) {
  return role === 'admin' ? '/admin' : role === 'faculty' ? '/teacher' : '/student';
}
