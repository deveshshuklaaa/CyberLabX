import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../../services/api';
import { adminError } from '../../services/adminManagement';
import type { Role, User } from '../../types/api';

export function CreateUserForm({ onCreated, blockedReason }: { onCreated: () => void; blockedReason?: string }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('student');
  const [review, setReview] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<User | null>(null);
  const prepare = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!firstName.trim() || !lastName.trim()) { setError('First and last names cannot be blank.'); return; }
    setError(''); setCreated(null); setReview(true);
  };
  const create = async () => {
    if (pending || !review || blockedReason) return;
    setPending(true); setError('');
    try {
      const { data } = await api.post<{ user: User }>('/admin/users', { firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), password, role });
      if (!data?.user?.id || !data.user.email || !data.user.role) throw new Error('Account creation response unavailable.');
      setCreated(data.user); setFirstName(''); setLastName(''); setEmail(''); setRole('student');
      onCreated();
    } catch (err) { setError(`${adminError(err)} Creation could not be confirmed. Verify the account with your administrator before submitting again.`); }
    finally { setPassword(''); setReview(false); setPending(false); }
  };
  return <div className="space-y-4">
    {blockedReason && <p role="status" className="state-panel text-sm">{blockedReason}</p>}
    {created && <div role="status" className="panel p-4 border-emerald-200 space-y-2"><h3 className="font-bold">Account created</h3><p className="text-sm break-words">{created.firstName} {created.lastName} | {created.email}</p><p className="text-sm">Role: {created.role === 'faculty' ? 'Teacher (faculty)' : created.role}</p><p className="text-xs font-mono break-all">Account ID: {created.id}</p><p className="text-xs text-muted">This is the last created account, not a user directory.</p></div>}
    {error && <p role="alert" className="error-panel text-sm">{error}</p>}
    {review ? <section aria-label="Review account creation" className="rounded-lg border border-line p-4 space-y-4">
      <h3 className="font-bold">Review new account</h3><dl className="text-sm space-y-2"><div><dt className="text-muted">Name</dt><dd className="break-words">{firstName.trim()} {lastName.trim()}</dd></div><div><dt className="text-muted">Email</dt><dd className="break-all">{email.trim()}</dd></div><div><dt className="text-muted">Role</dt><dd>{role === 'faculty' ? 'Teacher (faculty)' : role}</dd></div></dl>
      {role === 'admin' && <p className="text-sm font-semibold text-danger">This account will have platform administrator access.</p>}
      <p className="text-sm text-muted">Creation sets the supplied password. It does not send an invitation or enroll a student into a class.</p>
      <div className="flex flex-wrap gap-3"><button type="button" className="button" disabled={pending || Boolean(blockedReason)} onClick={create}>{pending ? 'Creating account...' : 'Confirm create account'}</button><button type="button" className="button-secondary" disabled={pending} onClick={() => setReview(false)}>Back to form</button></div>
    </section> : <form onSubmit={prepare} className="space-y-4" aria-label="Create user account"><fieldset disabled={Boolean(blockedReason)} className="space-y-4"><legend className="sr-only">New account information</legend>
      <div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="new-first-name" className="label">First name</label><input id="new-first-name" className="field" required maxLength={60} autoComplete="off" value={firstName} onChange={event => setFirstName(event.target.value)} /></div><div><label htmlFor="new-last-name" className="label">Last name</label><input id="new-last-name" className="field" required maxLength={60} autoComplete="off" value={lastName} onChange={event => setLastName(event.target.value)} /></div></div>
      <div><label htmlFor="new-email" className="label">Email address</label><input id="new-email" className="field" type="email" maxLength={254} required autoComplete="off" value={email} onChange={event => setEmail(event.target.value)} /></div>
      <div><label htmlFor="new-password" className="label">Initial password</label><input id="new-password" className="field" type="password" required minLength={12} maxLength={128} autoComplete="new-password" aria-describedby="password-guidance" value={password} onChange={event => setPassword(event.target.value)} /><p id="password-guidance" className="mt-1 text-xs text-muted">At least 12 characters. Share credentials through your institution's approved process.</p></div>
      <div><label htmlFor="new-role" className="label">Account role</label><select id="new-role" className="field" value={role} onChange={event => setRole(event.target.value as Role)}><option value="student">Student</option><option value="faculty">Teacher (faculty)</option><option value="admin">Administrator</option></select></div>
      <button type="submit" className="button">Review account</button>
    </fieldset></form>}
  </div>;
}
