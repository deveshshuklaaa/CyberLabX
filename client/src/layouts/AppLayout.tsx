import { Link, Outlet, useNavigate } from 'react-router-dom';
import { LogOut, Shield } from 'lucide-react';
import { api } from '../services/api';
import { useSessionStore } from '../store/sessionStore';

export function AppLayout() {
  const { user, setUser } = useSessionStore();
  const navigate = useNavigate();
  const logout = async () => { await api.post('/auth/logout'); setUser(null); navigate('/login'); };

  return <div className="min-h-screen bg-canvas">
    <header className="border-t-4 border-brand border-b border-line bg-surface shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
        <Link to="/" className="flex items-center gap-2 text-lg font-bold text-ink">
          <span className="rounded-lg bg-brand p-2 text-white"><Shield size={18}/></span>
          CyberLabX
        </Link>
        <div className="flex items-center gap-4 text-sm text-muted">
          <span>{user?.firstName} · {user?.role}</span>
          <button onClick={logout} className="text-muted transition hover:text-brand-dark" title="Log out"><LogOut size={18}/></button>
        </div>
      </div>
    </header>
    <main className="mx-auto max-w-7xl px-5 py-8"><Outlet /></main>
    <footer className="mt-8 bg-footer text-footer-text">
      <div className="mx-auto max-w-7xl px-4 py-4 text-center text-xs leading-6 sm:px-5 sm:text-sm">
        <p>Guided By: Prof. Harsh Bhor</p>
        <p>Developed By: Devesh Shukla, Divya JI & Arvind Shekhawat.</p>
      </div>
    </footer>
  </div>;
}
