# Google OAuth local setup

CyberLabX already implements Google's real OpenID Connect authorization-code
flow with state, nonce, S256 PKCE, a signed 10-minute HttpOnly transaction cookie,
server-side token exchange and ID-token verification. The local provider test is
currently **BLOCKED** because no Google client ID, client secret or callback URL
is configured. Do not invent values or put the client secret in the frontend.

## Exact local values

| Setting | Value |
| --- | --- |
| Application type | Web application |
| Frontend origin | `http://localhost:5173` |
| Backend origin | `http://localhost:5000` |
| Authorized redirect URI | `http://localhost:5000/api/auth/google/callback` |
| Scopes | `openid`, `email`, `profile` |

The callback is fixed by `server/src/config/env.ts` and
`server/src/routes/authRoutes.ts`. HTTP is accepted only for loopback development;
production configuration requires HTTPS.

## Google Cloud Console steps

1. Open Google Cloud Console and select or create a development project.
2. Open **Google Auth Platform**. Configure Branding with the application name,
   support email and developer contact required by Google.
3. Under Audience, choose the audience appropriate for the organization. For an
   External app in Testing, add every Google account that will test the flow as
   a test user. Do not publish the app merely for local testing.
4. Under Data Access, retain the minimal OpenID scopes: `openid`, `email` and
   `profile`. CyberLabX does not require Drive, Gmail or offline access.
5. Open Clients and create an OAuth client with type **Web application**.
6. Add authorized JavaScript origin `http://localhost:5173`. The backend flow
   does not exchange tokens in JavaScript, but registering the exact frontend
   origin keeps the local client definition explicit.
7. Add the exact authorized redirect URI
   `http://localhost:5000/api/auth/google/callback`. A trailing slash, 127.0.0.1,
   different port or frontend callback is a different URI and will fail.
8. Copy the generated client ID and secret directly to the ignored root `.env`.
   Never paste the secret into chat, a screenshot, source file or `VITE_*` value.

Configure all three existing variables together:

```dotenv
GOOGLE_CLIENT_ID=<Google Web application client ID>
GOOGLE_CLIENT_SECRET=<Google Web application client secret>
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
```

The environment validator rejects partial configuration and unsafe callback
URLs. Restart the backend after saving `.env`; a Vite restart is not required
unless its own configuration changed.

## Live acceptance procedure

1. Start MongoDB, API and client using
   [AUTHENTICATION_AND_REGISTRATION_SETUP.md](AUTHENTICATION_AND_REGISTRATION_SETUP.md).
2. In a clean Chrome profile, open `/login` and select **Continue with Google**.
3. Confirm the browser is on Google's real domain, select an authorized test
   account, review the minimal consent, and complete the callback.
4. For a new Google identity, expect a new active Student and `/student`. Confirm
   its stored `googleId` is present without displaying it and no local password
   is fabricated.
5. Sign out and repeat. Expect the same account and database role.
6. For an existing password account with the same email, expect `account_exists`.
   Password-sign in, remain authenticated, open `/login`, choose **Link Google to
   this account**, and complete Google consent. Confirm no second user is created.
7. Repeat linking for an existing Faculty/Admin only when the Google verified
   email exactly matches that authorized account. On return, the database role
   must remain `faculty` or `admin`.
8. Test cancellation, stale/mismatched state, reused callback and conflicting
   Google subject. Expect controlled login errors and no unexpected session.
9. Sign out, refresh and confirm protected routes return to `/login`.

Do not record provider pages, tokens, cookies, authorization codes or secrets in
screenshots/HAR files. Respect the shared 10 requests/15 minutes authentication
limiter. A 429 includes standard rate-limit headers; wait for `Retry-After`.

## Troubleshooting

| Error | Likely cause |
| --- | --- |
| `not_configured` | One or all three backend variables are absent; configure all and restart API |
| `redirect_uri_mismatch` at Google | Console URI differs from the exact backend callback above |
| `access_denied` | User cancelled or is not an allowed test user |
| `invalid_callback` | State/transaction expired, mismatched or replayed; start again from `/login` |
| `invalid_identity` | Provider did not return a verified usable email/profile |
| `account_exists` | Matching password account must be authenticated before explicit linking |
| `account_conflict` | Subject/email is already linked incompatibly; do not force-merge records |
| `account_disabled` | Database account is inactive; Google cannot bypass status |
| `provider_unavailable` | Provider/token exchange failed; preserve the account and retry later |

A PASS requires a real Google account-selection/consent, successful callback,
MongoDB identity resolution and role-correct dashboard. Mocked tests and the
unconfigured redirect are supporting evidence only.
