import { useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Mail, ShieldAlert, ArrowRight } from 'lucide-react';
import { api, errorMessage } from '../services/api';
import { useSessionStore } from '../store/sessionStore';
import { roleHome } from '../routes/roleHome';

const googleErrors: Record<string, string> = {
  not_configured: 'Google sign-in is not configured yet. Use your account password.',
  access_denied: 'Google sign-in was cancelled. You can try again.',
  invalid_callback: 'This sign-in request expired or is invalid. Please start again.',
  invalid_identity: 'Google did not provide a valid verified profile. Please try again.',
  account_exists: 'An account already uses this email. Sign in with its password, then return to this page to link Google.',
  account_disabled: 'Your account is disabled. Contact an administrator.',
  account_conflict: 'Google could not be linked to this account. Contact an administrator.',
  provider_unavailable: 'Google sign-in is temporarily unavailable. Please try again.',
};

export function Login() {
  const client = useQueryClient();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(() => {
    const code = searchParams.get('oauth_error') ?? '';
    return Object.hasOwn(googleErrors, code) ? googleErrors[code] : '';
  });
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const setUser = useSessionStore(s => s.setUser);
  const currentUser = useSessionStore(s => s.user);
  const googleLoginUrl = `${(api.defaults.baseURL ?? '/api').replace(/\/$/, '')}/auth/google`;

  const linkGoogle = async () => {
    setBusy(true); setError('');
    try {
      const { data } = await api.post('/auth/google/link');
      window.location.assign(data.url);
    } catch (err) { setError(errorMessage(err)); setBusy(false); }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post('/auth/login', { email, password });
      await client.cancelQueries(); client.clear(); setUser(data.user); useSessionStore.getState().setLoaded(); setPassword('');
      navigate(roleHome(data.user.role), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col justify-between">
      {/* Top Institutional Header Bar */}
      <div className="bg-brand-dark text-white/90 text-xs py-2 px-4 sm:px-6 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap gap-2 items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold tracking-wide">Somaiya Vidyavihar University</span>
            <span className="text-white/40">|</span>
            <span className="hidden sm:inline text-white/80">Department of Computer Engineering</span>
          </div>
          <span className="text-xs text-white/80">Virtual Laboratory Access Portal</span>
        </div>
      </div>

      {/* Main Login Box */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Main Card */}
          <div className="bg-surface rounded-xl border border-line shadow-sm overflow-hidden">
            {/* Somaiya Red Accent Stripe */}
            <div className="h-1.5 bg-brand w-full" />

            <div className="p-8 sm:p-9">
              {/* Institutional Brand Lockup */}
              <div className="flex flex-col items-center text-center pb-6 border-b border-line mb-6">
                <img
                  src="/assets/somaiya-emblem.png"
                  alt="Somaiya Vidyavihar University"
                  className="h-16 w-16 object-contain mb-3"
                />
                <h1 className="text-xl sm:text-2xl font-black text-brand tracking-wider uppercase font-sans">
                  SOMAIYA <span className="text-ink">VIRTUAL LABS</span>
                </h1>
                <p className="text-xs uppercase tracking-widest font-semibold text-muted mt-1">
                  Somaiya Vidyavihar University
                </p>
                <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand/5 border border-brand/15 text-brand text-xs font-medium">
                  <span>Student &amp; Faculty Academic Sign In</span>
                </div>
              </div>

              {/* Error Alert */}
              {error && (
                <div
                  role="alert"
                  className="mb-5 rounded-lg border border-danger/30 bg-danger/5 p-3.5 text-xs sm:text-sm text-danger flex items-start gap-2.5"
                >
                  <ShieldAlert size={18} className="shrink-0 mt-0.5 text-danger" />
                  <div>
                    <p className="font-semibold">Authentication failed</p>
                    <p className="text-xs text-danger/90 mt-0.5">{error}</p>
                  </div>
                </div>
              )}

              <a href={googleLoginUrl} className="button-secondary w-full justify-center mb-5 py-2.5 text-sm">
                Continue with Google
              </a>
              {currentUser && (
                <div className="mb-5 rounded-lg border border-line p-3 text-sm">
                  <p className="mb-2">Signed in as {currentUser.email}.</p>
                  <button type="button" className="button-secondary w-full" disabled={busy} onClick={linkGoogle}>
                    Link Google to this account
                  </button>
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label htmlFor="login-email" className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                    University Email ID
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
                      <Mail size={16} />
                    </span>
                    <input
                      required
                      id="login-email"
                      type="email"
                      className="field pl-9 text-sm"
                      placeholder="student@somaiya.edu"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="login-password" className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                    Account Password
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
                      <Lock size={16} />
                    </span>
                    <input
                      required
                      id="login-password"
                      type="password"
                      className="field pl-9 text-sm"
                      placeholder="••••••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      autoComplete="current-password"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="button w-full mt-6 py-2.5 text-sm gap-2"
                >
                  <span>{busy ? 'Authenticating with Somaiya Portal…' : 'Access Virtual Laboratories'}</span>
                  {!busy && <ArrowRight size={16} />}
                </button>
              </form>

            </div>
          </div>

          {/* Academic Portal Disclaimer */}
          <div className="mt-6 text-center text-xs text-muted space-y-1">
            <p>Authorized access only. All laboratory sessions are logged for academic assessment.</p>
            <p className="text-[11px] text-muted/80">Guided By: Prof. Harsh Bhor · Developed By: Devesh Shukla &amp; Arvind Shekhawat</p>
          </div>
        </div>
      </div>

      {/* University Copyright Footer */}
      <div className="bg-surface border-t border-line py-3 px-4 text-center text-xs text-muted">
        © 2026 Somaiya Vidyavihar University. All rights reserved.
      </div>
    </div>
  );
}
