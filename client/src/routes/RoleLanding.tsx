import { Navigate, useLocation } from 'react-router-dom';
import { useSessionStore } from '../store/sessionStore';
import { roleHome } from './roleHome';

export function RoleLanding() {
  const user = useSessionStore(state => state.user);
  return <Navigate to={user ? roleHome(user.role) : '/login'} replace />;
}

/** Retain established student links while accepting the /student/* entry points. */
export function StudentRouteAlias() {
  const location = useLocation();
  const path = location.pathname.replace(/^\/student/, '');
  const target = /^\/(?:experiments|labs|progress|history|profile)(?:\/|$)/.test(path) ? path : '/student';
  return <Navigate to={`${target}${location.search}`} replace />;
}
