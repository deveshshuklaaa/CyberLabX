import { useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ExternalLink, LogOut, Menu, ShieldCheck, X } from 'lucide-react';
import { BrandLockup } from './BrandLockup';
import { PortalNavigation } from './PortalNavigation';
import { useSignOut } from '../../hooks/useSignOut';
import { useSessionStore } from '../../store/sessionStore';

export function UniversityHeader() {
  const { signOut, pending, error } = useSignOut();
  const { user } = useSessionStore();
  const location = useLocation();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const open = openPath === location.pathname;
  const close = () => setOpenPath(null);
  const logout = () => { void signOut(); };
  return <header className="border-b border-line bg-surface shadow-sm">
    <div className="bg-brand-dark text-white px-4 sm:px-6 py-2 text-xs">
      <div className="mx-auto max-w-7xl flex flex-wrap justify-between gap-2">
        <a href="https://www.somaiya.edu/en/" target="_blank" rel="noreferrer" className="!text-white inline-flex items-center gap-2">
          Somaiya Vidyavihar University <ExternalLink size={12} aria-hidden="true" />
        </a>
        <span className="inline-flex items-center gap-2"><ShieldCheck size={14} aria-hidden="true" />Cybersecurity learning lab</span>
      </div>
    </div>
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
      <BrandLockup size="sm" />
      <div className="hidden md:flex items-center gap-4 min-w-0">
        <div className="text-right min-w-0 text-sm">
          <p className="font-semibold break-words">{user?.firstName} {user?.lastName}</p>
          <p className="text-xs text-muted">{user?.role === 'faculty' ? 'Teacher' : user?.role} account</p>
        </div>
        <button type="button" className="button-secondary gap-2 text-sm" onClick={logout} disabled={pending}><LogOut size={16} aria-hidden="true" />{pending ? 'Signing out...' : 'Sign Out'}</button>
      </div>
      <button ref={toggle} type="button" className="button-secondary md:hidden shrink-0 !p-3" aria-label="Toggle navigation menu"
        aria-expanded={open} aria-controls="mobile-portal-navigation" onClick={() => setOpenPath(open ? null : location.pathname)}>
        {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
      </button>
    </div>
    <nav aria-label="Main navigation" className="hidden md:flex mx-auto max-w-7xl px-6 pb-3 flex-wrap gap-2"><PortalNavigation /></nav>
    <div id="mobile-portal-navigation" hidden={!open} className="md:hidden border-t border-line px-4 py-4"
      onKeyDown={event => { if (event.key === 'Escape') { close(); toggle.current?.focus(); } }}>
      <p className="text-sm font-semibold break-words mb-3">{user?.firstName} {user?.lastName}</p>
      <nav aria-label="Mobile navigation" className="flex flex-col gap-1"><PortalNavigation onNavigate={close} /></nav>
      <button type="button" className="button-secondary gap-2 mt-4 w-full" onClick={logout} disabled={pending}><LogOut size={16} aria-hidden="true" />{pending ? 'Signing out...' : 'Sign Out'}</button>
    </div>
    {error && <p role="alert" className="error-panel m-4 text-sm">{error}</p>}
  </header>;
}
