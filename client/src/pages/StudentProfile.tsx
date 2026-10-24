import { Link } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useSignOut } from '../hooks/useSignOut';
import { useSessionStore } from '../store/sessionStore';
import { PageHeading } from '../components/common/PageHeading';
import { LoadingState } from '../components/common/QueryState';
import { StudentEnrollment } from '../components/student/StudentEnrollment';

export function StudentProfile() {
  const { user, loaded } = useSessionStore();
  const { signOut, pending: signingOut, error } = useSignOut();
  if (!loaded) return <LoadingState message="Loading authenticated account..." />;
  if (!user) return <div className="state-panel"><p>Your session is unavailable. Sign in to view your account.</p><Link to="/login" className="button mt-4">Sign in</Link></div>;
  return <div className="max-w-4xl mx-auto space-y-6">
    <PageHeading title="Student Profile" eyebrow="Somaiya Virtual Labs" description="Your authenticated CyberLabX account information." />
    <section className="panel p-5 sm:p-8 border-t-4 border-t-brand space-y-6" aria-label="Account information">
      <div className="flex flex-wrap items-center gap-4"><div aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand font-bold text-xl">{user.firstName[0]}{user.lastName[0]}</div><div className="min-w-0"><h2 className="text-xl font-bold break-words">{user.firstName} {user.lastName}</h2><p className="text-sm text-muted break-all">{user.email}</p></div></div>
      <dl className="grid gap-6 sm:grid-cols-2 border-t border-line pt-6 text-sm">
        <div><dt className="label text-muted">First name</dt><dd className="break-words">{user.firstName}</dd></div><div><dt className="label text-muted">Last name</dt><dd className="break-words">{user.lastName || 'Not provided'}</dd></div>
        <div><dt className="label text-muted">Email address</dt><dd className="break-all">{user.email}</dd></div><div><dt className="label text-muted">Role</dt><dd className="capitalize">{user.role === 'faculty' ? 'Teacher' : user.role}</dd></div>
        <div><dt className="label text-muted">Account status</dt><dd><span className={`status-badge ${user.isActive ? 'status-success' : 'status-neutral'}`}>{user.isActive ? 'Active' : 'Inactive'}</span></dd></div><div><dt className="label text-muted">Account ID</dt><dd className="font-mono text-xs break-all select-all">{user.id}</dd></div>
      </dl>
    </section>
    <StudentEnrollment />
    <nav aria-label="Learning account links" className="grid gap-3 sm:grid-cols-3"><Link className="button-secondary" to="/progress">View progress</Link><Link className="button-secondary" to="/history">View history</Link><Link className="button-secondary" to="/experiments">Browse experiments</Link></nav>
    <section className="panel p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div><h2 className="font-bold">Session management</h2><p className="page-description">Sign out of your current CyberLabX session.</p></div><button type="button" className="button-secondary gap-2 shrink-0" onClick={signOut} disabled={signingOut}><LogOut size={16} aria-hidden="true" />{signingOut ? 'Signing out...' : 'Sign out'}</button></section>
    {error && <p role="alert" className="error-panel text-sm">{error}</p>}
    <p className="text-sm text-muted">Account details are read-only. Contact your institution for account corrections.</p>
  </div>;
}
