import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ExternalLink, HelpCircle, LogOut, Menu, User as UserIcon, X } from 'lucide-react';
import { BrandLockup } from './BrandLockup';
import { api } from '../../services/api';
import { useSessionStore } from '../../store/sessionStore';

export const UniversityHeader: React.FC = () => {
  const { user, setUser } = useSessionStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore
    } finally {
      setUser(null);
      navigate('/login');
    }
  };

  const isActive = (path: string) =>
    path === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(path);

  const navLinkClass = (path: string) =>
    `hover:text-brand transition-colors py-1 border-b-2 ${
      isActive(path) ? 'text-brand border-brand' : 'border-transparent hover:border-brand'
    }`;

  return (
    <header className="w-full bg-white border-b border-line shadow-xs">
      {/* ── Level 1: Top Institutional Bar ── */}
      <div className="bg-brand-dark text-white/90 text-xs py-1.5 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a
              href="https://www.somaiya.edu/en/"
              target="_blank"
              rel="noreferrer"
              className="font-medium hover:text-white flex items-center gap-1 transition-colors"
            >
              <span>Somaiya Vidyavihar University</span>
              <ExternalLink size={12} className="opacity-70" />
            </a>
            <span className="hidden md:inline text-white/40">|</span>
            <span className="hidden md:inline text-white/80">Academic Year 2025–2026</span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <a
              href="https://kjsieit.somaiya.edu/en/"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline hover:text-white transition-colors"
            >
              KJSIEIT Campus
            </a>
            <span className="hidden sm:inline text-white/40">|</span>
            <Link
              to="/profile"
              className="hover:text-white flex items-center gap-1 transition-colors"
            >
              <HelpCircle size={12} />
              <span>Student Support &amp; Help</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Level 2: Main University Header ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
        {/* Brand Lockup */}
        <BrandLockup size="md" />

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-ink">
          <Link to="/" className={navLinkClass('/')}>Dashboard</Link>
          <Link to="/experiments" className={navLinkClass('/experiments')}>Experiments</Link>
          <Link to="/progress" className={navLinkClass('/progress')}>My Progress</Link>
          <Link to="/history" className={navLinkClass('/history')}>History</Link>
          <Link to="/profile" className={navLinkClass('/profile')}>Profile</Link>

          {/* Role-Specific Links */}
          {(user?.role === 'faculty' || user?.role === 'admin') && (
            <Link to="/faculty" className={navLinkClass('/faculty')}>
              Faculty Portal
            </Link>
          )}
          {user?.role === 'admin' && (
            <Link to="/admin" className={navLinkClass('/admin')}>
              System Admin
            </Link>
          )}
        </nav>

        {/* User Session & Logout */}
        <div className="hidden sm:flex items-center gap-4">
          <div className="flex items-center gap-2.5 bg-canvas border border-line py-1.5 px-3 rounded-md text-xs">
            <span className="p-1 rounded bg-brand/10 text-brand">
              <UserIcon size={14} />
            </span>
            <div className="flex flex-col text-left leading-tight">
              <span className="font-semibold text-ink">{user?.firstName} {user?.lastName}</span>
              <span className="text-[10px] text-muted uppercase tracking-wider">{user?.role} Account</span>
            </div>
          </div>

          <button
            onClick={logout}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-brand transition-colors py-2 px-3 border border-line rounded-md hover:bg-canvas"
            title="Sign out of virtual laboratory portal"
          >
            <LogOut size={15} />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Mobile Hamburger Button */}
        <div className="lg:hidden flex items-center gap-2">
          <button
            onClick={() => setMobileMenuOpen(prev => !prev)}
            className="p-2 rounded-md border border-line text-ink hover:text-brand hover:bg-canvas transition"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* ── Mobile Navigation Drawer ── */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-line bg-surface px-5 py-4 shadow-lg animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-3 border-b border-line mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded bg-brand/10 text-brand">
                <UserIcon size={16} />
              </div>
              <div>
                <p className="text-sm font-bold text-ink">{user?.firstName} {user?.lastName}</p>
                <p className="text-xs text-muted capitalize">{user?.role} · Somaiya Vidyavihar University</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 text-sm font-medium">
            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className="text-left py-2 px-3 rounded-md hover:bg-canvas hover:text-brand transition"
            >
              Dashboard
            </Link>
            <Link
              to="/experiments"
              onClick={() => setMobileMenuOpen(false)}
              className="text-left py-2 px-3 rounded-md hover:bg-canvas hover:text-brand transition"
            >
              Experiments
            </Link>
            <Link
              to="/progress"
              onClick={() => setMobileMenuOpen(false)}
              className="text-left py-2 px-3 rounded-md hover:bg-canvas hover:text-brand transition"
            >
              My Progress
            </Link>
            <Link
              to="/history"
              onClick={() => setMobileMenuOpen(false)}
              className="text-left py-2 px-3 rounded-md hover:bg-canvas hover:text-brand transition"
            >
              Practical History
            </Link>
            <Link
              to="/profile"
              onClick={() => setMobileMenuOpen(false)}
              className="text-left py-2 px-3 rounded-md hover:bg-canvas hover:text-brand transition"
            >
              My Profile
            </Link>

            {(user?.role === 'faculty' || user?.role === 'admin') && (
              <Link
                to="/faculty"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2 px-3 rounded-md text-brand hover:bg-brand/5 transition"
              >
                Faculty Portal
              </Link>
            )}
            {user?.role === 'admin' && (
              <Link
                to="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2 px-3 rounded-md text-brand hover:bg-brand/5 transition"
              >
                System Administration
              </Link>
            )}

            <div className="border-t border-line pt-3 mt-1 flex flex-col gap-2">
              <a
                href="https://www.somaiya.edu/en/"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted flex items-center justify-between py-1.5 px-3 rounded hover:bg-canvas"
              >
                <span>Somaiya Vidyavihar University Website</span>
                <ExternalLink size={14} />
              </a>
              <button
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-danger bg-danger/5 py-2.5 rounded-md hover:bg-danger/10 transition mt-2"
              >
                <LogOut size={16} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
