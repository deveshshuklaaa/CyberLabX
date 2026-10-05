import { useNavigate, Link } from 'react-router-dom';
import {
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  GraduationCap,
  History,
  LogOut,
  Mail,
  MapPin,
  Shield,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';
import { api } from '../services/api';
import { useSessionStore } from '../store/sessionStore';

export function StudentProfile() {
  const { user, setUser } = useSessionStore();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore
    } finally {
      setUser(null);
      navigate('/login');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* ── Page Header ── */}
      <div className="border-b border-line pb-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-brand bg-brand/5 border border-brand/20 px-2.5 py-0.5 rounded">
            Somaiya Vidyavihar University
          </span>
          <span className="text-xs font-semibold text-muted bg-canvas border border-line px-2.5 py-0.5 rounded">
            Institutional Identity &amp; Account
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-ink uppercase tracking-tight font-sans">
          Student Profile
        </h1>
        <p className="mt-1 text-sm text-muted">
          Authenticated user credentials and enrolled university academic profile details.
        </p>
      </div>

      {/* ── Profile Information Card ── */}
      <div className="panel bg-surface border border-line shadow-xs overflow-hidden" data-testid="profile-card">
        {/* Top Accent Stripe */}
        <div className="h-1.5 bg-brand w-full" />

        <div className="p-6 sm:p-8 space-y-6">
          {/* Header with Avatar & Name */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-line">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-brand/10 border-2 border-brand/20 text-brand flex items-center justify-center font-bold text-xl font-sans shrink-0">
                {user?.firstName?.[0] ?? 'S'}{user?.lastName?.[0] ?? 'V'}
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-ink" data-testid="profile-name">
                  {user?.firstName} {user?.lastName}
                </h2>
                <p className="text-xs text-muted mt-0.5 flex items-center gap-1.5">
                  <Mail size={13} />
                  <span data-testid="profile-email">{user?.email}</span>
                </p>
              </div>
            </div>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-brand/5 border border-brand/20 text-brand uppercase tracking-wider self-start sm:self-auto">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span data-testid="profile-role">{user?.role} Account</span>
            </span>
          </div>

          {/* Academic Details Grid */}
          <div className="grid gap-6 sm:grid-cols-2 text-sm">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Institution</p>
              <p className="font-bold text-ink" data-testid="profile-university">Somaiya Vidyavihar University</p>
              <p className="text-xs text-muted flex items-center gap-1">
                <MapPin size={12} />
                <span>Vidyavihar (E), Mumbai - 400077</span>
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Department</p>
              <p className="font-bold text-ink">Department of Computer Engineering</p>
              <p className="text-xs text-muted">KJSIEIT Campus</p>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Account Status</p>
              <p className="font-bold text-emerald-700 flex items-center gap-1.5">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <span>{user?.isActive ? 'Active & Verified' : 'Inactive'}</span>
              </p>
              <p className="text-xs text-muted">Authorized for laboratory sessions</p>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Platform Identity ID</p>
              <p className="font-mono text-xs text-ink font-semibold bg-canvas px-2.5 py-1.5 rounded border border-line select-all inline-block">
                {user?.id ?? '—'}
              </p>
            </div>
          </div>

          {/* Quick Academic Navigation Links */}
          <div className="pt-6 border-t border-line">
            <p className="text-xs font-bold uppercase tracking-wider text-muted mb-3">Academic Navigation</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Link
                to="/progress"
                className="panel p-3.5 bg-canvas hover:border-brand/40 transition flex items-center gap-2.5 text-xs font-bold text-ink"
              >
                <Award size={16} className="text-brand" />
                <span>View Academic Progress</span>
              </Link>

              <Link
                to="/history"
                className="panel p-3.5 bg-canvas hover:border-brand/40 transition flex items-center gap-2.5 text-xs font-bold text-ink"
              >
                <History size={16} className="text-brand" />
                <span>View Attempt History</span>
              </Link>

              <Link
                to="/experiments"
                className="panel p-3.5 bg-canvas hover:border-brand/40 transition flex items-center gap-2.5 text-xs font-bold text-ink"
              >
                <BookOpen size={16} className="text-brand" />
                <span>Browse Experiments</span>
              </Link>
            </div>
          </div>

          {/* Authentication & Sign Out Section */}
          <div className="pt-6 border-t border-line flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-xs text-muted">
              <p className="font-semibold text-ink">Session Management</p>
              <p className="mt-0.5">End your current session across university laboratory services.</p>
            </div>

            <button
              onClick={handleSignOut}
              className="button-secondary text-xs py-2 px-5 gap-2 text-danger border-danger/30 hover:bg-danger/5 hover:border-danger hover:text-danger font-bold shrink-0 inline-flex items-center"
              data-testid="profile-signout"
            >
              <LogOut size={15} />
              <span>Sign Out of Portal</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Institutional Academic Guidelines ── */}
      <div className="panel p-5 bg-canvas border border-line text-xs text-muted flex items-start gap-3">
        <ShieldCheck size={20} className="text-brand shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-ink">Somaiya Academic Integrity Statement</p>
          <p className="mt-0.5 leading-relaxed">
            All virtual laboratory attempts, terminal commands, and quiz submissions are recorded and audited for academic assessment.
            Sharing credentials or attempting unauthorized network penetration outside the disposable sandbox violates university computing policy.
          </p>
        </div>
      </div>
    </div>
  );
}
