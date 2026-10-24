import { Link, useLocation } from 'react-router-dom';
import { useSessionStore } from '../../store/sessionStore';

export function PortalNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const role = useSessionStore(state => state.user?.role);
  const { pathname } = useLocation();
  const links = role === 'student'
    ? [['/student', 'Dashboard'], ['/experiments', 'Experiments'], ['/progress', 'My Progress'], ['/history', 'History'], ['/profile', 'Profile']]
    : role === 'admin' ? [['/admin', 'Admin Dashboard'], ['/teacher', 'Teacher Portal']]
    : role === 'faculty' ? [['/teacher', 'Teacher Dashboard']] : [];
  const current = pathname.replace(/^\/student\//, '/').replace(/^\/faculty(?=\/|$)/, '/teacher');
  return <>{links.map(([path, label]) => {
    const active = path === '/student'
      ? current === '/student' || current === '/dashboard'
      : current === path || current.startsWith(`${path}/`);
    return <Link key={path} to={path} onClick={onNavigate}
      aria-current={active ? 'page' : undefined} className={`nav-link ${active ? 'nav-link-active' : ''}`}>{label}</Link>;
  })}</>;
}
