import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { api, errorMessage } from '../services/api';
import { useSessionStore } from '../store/sessionStore';

export function Login() {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const navigate = useNavigate(); const setUser = useSessionStore(s => s.setUser);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setBusy(true); setError(''); try { const { data } = await api.post('/auth/login', { email, password }); setUser(data.user); navigate(data.user.role === 'faculty' ? '/faculty' : data.user.role === 'admin' ? '/admin' : '/'); } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); } };

  return <div className="grid min-h-screen place-items-center bg-canvas px-5">
    <form onSubmit={submit} className="panel w-full max-w-md border-t-4 border-t-brand p-8 shadow-md">
      <div className="mb-7 text-center"><span className="mx-auto mb-3 inline-flex rounded-xl bg-brand p-3 text-white"><Shield/></span><h1 className="text-2xl font-bold text-ink">Welcome to CyberLabX</h1><p className="mt-2 text-sm text-muted">Your isolated cybersecurity learning lab.</p></div>
      {error && <p role="alert" className="mb-4 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      <label className="label">Email<input required type="email" className="field mt-1" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email"/></label>
      <label className="label mt-4">Password<input required type="password" className="field mt-1" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password"/></label>
      <button disabled={busy} className="button mt-6 w-full">{busy ? 'Signing in…' : 'Sign in'}</button>
      <p className="mt-5 text-center text-xs text-muted">Use the local development credentials configured in your environment.</p>
    </form>
  </div>;
}
