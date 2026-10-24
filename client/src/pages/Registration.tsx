import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Eye, EyeOff, Lock, Mail, ShieldAlert, UserRound } from 'lucide-react';
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { roleHome } from '../routes/roleHome';
import { api, errorMessage } from '../services/api';
import { useSessionStore } from '../store/sessionStore';

type Fields = { firstName: string; lastName: string; email: string; password: string; confirmPassword: string };
type FieldErrors = Partial<Record<keyof Fields, string>>;

const initialFields: Fields = { firstName: '', lastName: '', email: '', password: '', confirmPassword: '' };

function validate(fields: Fields): FieldErrors {
  const errors: FieldErrors = {};
  const firstName = fields.firstName.trim();
  const lastName = fields.lastName.trim();
  const email = fields.email.trim();
  if (!firstName) errors.firstName = 'Enter your first name.';
  else if (firstName.length > 60) errors.firstName = 'First name must be 60 characters or fewer.';
  if (!lastName) errors.lastName = 'Enter your last name.';
  else if (lastName.length > 60) errors.lastName = 'Last name must be 60 characters or fewer.';
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) errors.email = 'Enter a valid email address.';
  else if (email.length > 254) errors.email = 'Email address must be 254 characters or fewer.';
  if (fields.password.length < 12) errors.password = 'Use at least 12 characters.';
  else if (fields.password.length > 128) errors.password = 'Password must be 128 characters or fewer.';
  if (!fields.confirmPassword) errors.confirmPassword = 'Confirm your password.';
  else if (fields.confirmPassword !== fields.password) errors.confirmPassword = 'Passwords do not match.';
  return errors;
}

export function Registration() {
  const client = useQueryClient();
  const navigate = useNavigate();
  const setUser = useSessionStore(state => state.setUser);
  const [fields, setFields] = useState(initialFields);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [requestError, setRequestError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const update = (name: keyof Fields, value: string) => {
    setFields(current => ({ ...current, [name]: value }));
    setErrors(current => ({ ...current, [name]: undefined }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const validation = validate(fields);
    setErrors(validation);
    setRequestError('');
    if (Object.keys(validation).length) return;
    setBusy(true);
    try {
      const { data } = await api.post('/auth/register', {
        firstName: fields.firstName.trim(), lastName: fields.lastName.trim(), email: fields.email.trim(), password: fields.password,
      });
      await client.cancelQueries();
      client.clear();
      setUser(data.user);
      useSessionStore.getState().setLoaded();
      setFields(initialFields);
      navigate(roleHome(data.user.role), { replace: true, state: { registrationSuccess: true } });
    } catch (error) {
      setRequestError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col justify-between">
      <div className="bg-brand-dark text-white/90 text-xs py-2 px-4 sm:px-6 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap gap-2 items-center justify-between">
          <span className="font-semibold tracking-wide">Somaiya Vidyavihar University</span>
          <span className="text-xs text-white/80">Student Account Registration</span>
        </div>
      </div>

      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-xl">
          <div className="bg-surface rounded-xl border border-line shadow-sm overflow-hidden">
            <div className="h-1.5 bg-brand w-full" />
            <div className="p-6 sm:p-9">
              <div className="text-center pb-6 border-b border-line mb-6">
                <img src="/assets/somaiya-emblem.png" alt="Somaiya Vidyavihar University" className="h-14 w-14 object-contain mx-auto mb-3" />
                <p className="eyebrow">CyberLabX Student Portal</p>
                <h1 className="text-2xl font-black text-ink">Create your account</h1>
                <p className="mt-2 text-sm text-muted">Register for a Student account to access the practical experiment catalogue.</p>
              </div>

              {requestError && (
                <div role="alert" className="mb-5 rounded-lg border border-danger/30 bg-danger/5 p-3.5 text-sm text-danger flex items-start gap-2.5">
                  <ShieldAlert size={18} className="shrink-0 mt-0.5" />
                  <div><p className="font-semibold">Account could not be created</p><p className="mt-0.5">{requestError}</p></div>
                </div>
              )}

              <form onSubmit={submit} noValidate className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="First Name" name="firstName" icon={<UserRound size={16} />} value={fields.firstName} error={errors.firstName} autoComplete="given-name" onChange={update} />
                  <Field label="Last Name" name="lastName" icon={<UserRound size={16} />} value={fields.lastName} error={errors.lastName} autoComplete="family-name" onChange={update} />
                </div>
                <Field label="Email Address" name="email" type="email" icon={<Mail size={16} />} value={fields.email} error={errors.email} autoComplete="email" onChange={update} />

                <div>
                  <label htmlFor="registration-password" className="label">Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-3.5 text-muted pointer-events-none" />
                    <input id="registration-password" name="password" type={showPassword ? 'text' : 'password'} className="field pl-9 pr-12" value={fields.password} onChange={event => update('password', event.target.value)} autoComplete="new-password" aria-invalid={Boolean(errors.password)} aria-describedby={`registration-password-help${errors.password ? ' registration-password-error' : ''}`} />
                    <button type="button" className="absolute right-1 top-1 min-h-9 min-w-9 inline-flex items-center justify-center rounded-md text-muted hover:text-ink" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide passwords' : 'Show passwords'} aria-pressed={showPassword}>
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <p id="registration-password-help" className="mt-1 text-xs text-muted">Use 12–128 characters. A longer, unique passphrase is recommended.</p>
                  {errors.password && <p id="registration-password-error" className="mt-1 text-xs text-danger">{errors.password}</p>}
                </div>

                <div>
                  <label htmlFor="registration-confirmPassword" className="label">Confirm Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-3.5 text-muted pointer-events-none" />
                    <input id="registration-confirmPassword" name="confirmPassword" type={showPassword ? 'text' : 'password'} className="field pl-9" value={fields.confirmPassword} onChange={event => update('confirmPassword', event.target.value)} autoComplete="new-password" aria-invalid={Boolean(errors.confirmPassword)} aria-describedby={errors.confirmPassword ? 'registration-confirmPassword-error' : undefined} />
                  </div>
                  {errors.confirmPassword && <p id="registration-confirmPassword-error" className="mt-1 text-xs text-danger">{errors.confirmPassword}</p>}
                </div>

                <button type="submit" disabled={busy} className="button w-full gap-2"><span>{busy ? 'Creating account…' : 'Create Student Account'}</span>{!busy && <ArrowRight size={16} />}</button>
              </form>

              <p className="mt-6 text-center text-sm text-muted">Already have an account? <Link to="/login" className="font-semibold underline">Sign in</Link></p>
              <p className="mt-3 text-center text-xs text-muted">Registration creates a Student account. Faculty and Admin access is assigned only through authorized administration.</p>
            </div>
          </div>
        </div>
      </main>
      <div className="bg-surface border-t border-line py-3 px-4 text-center text-xs text-muted">© 2026 Somaiya Vidyavihar University. All rights reserved.</div>
    </div>
  );
}

function Field({ label, name, value, type = 'text', icon, error, autoComplete, onChange }: { label: string; name: 'firstName' | 'lastName' | 'email'; value: string; type?: string; icon: React.ReactNode; error?: string; autoComplete: string; onChange: (name: keyof Fields, value: string) => void }) {
  const id = `registration-${name}`;
  return <div>
    <label htmlFor={id} className="label">{label}</label>
    <div className="relative"><span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">{icon}</span><input id={id} name={name} type={type} className="field pl-9" value={value} onChange={event => onChange(name, event.target.value)} autoComplete={autoComplete} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} /></div>
    {error && <p id={`${id}-error`} className="mt-1 text-xs text-danger">{error}</p>}
  </div>;
}
