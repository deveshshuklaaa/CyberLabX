import { cleanup, render, screen } from '@testing-library/react';
import { Outlet } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../hooks/useSession', () => ({ useSessionBootstrap: () => undefined }));
vi.mock('../layouts/AppLayout', () => ({ AppLayout: () => <Outlet /> }));
vi.mock('../pages/Login', () => ({ Login: () => <p>Login page</p> }));
vi.mock('../pages/StudentDashboard', () => ({ StudentDashboard: () => <p>Student home</p> }));
vi.mock('../pages/FacultyDashboard', () => ({ FacultyDashboard: () => <p>Teacher home</p> }));
vi.mock('../pages/AdminDashboard', () => ({ AdminDashboard: () => <p>Admin home</p> }));
vi.mock('../pages/Experiments', () => ({ Experiments: () => <p>Experiments</p> }));
vi.mock('../pages/ExperimentOverview', () => ({ ExperimentOverview: () => <p>Experiment</p> }));
vi.mock('../pages/LabWorkspace', () => ({ LabWorkspace: () => <p>Lab</p> }));
vi.mock('../pages/StudentProgress', () => ({ StudentProgress: () => <p>Progress</p> }));
vi.mock('../pages/StudentHistory', () => ({ StudentHistory: () => <p>History</p> }));
vi.mock('../pages/StudentProfile', () => ({ StudentProfile: () => <p>Profile</p> }));
import App from '../App';
import { useSessionStore } from '../store/sessionStore';
import type { Role } from '../types/api';
beforeEach(() => useSessionStore.setState({ user: null, loaded: true }));
afterEach(cleanup);
function visit(path: string, role?: Role) {
  if (role) useSessionStore.setState({ user: { id: 'user', firstName: 'Test', lastName: 'User', email: 'test@example.test', role, isActive: true } });
  window.history.replaceState({}, '', path); render(<App />);
}
describe('actual app protected routes', () => {
  it.each(['/student', '/teacher', '/teacher/dashboard', '/faculty', '/admin'])('requires a session for %s', async path => {
    visit(path); expect(await screen.findByText('Login page')).toBeInTheDocument();
  });
  it.each([
    ['student', '/teacher', 'Student home'], ['student', '/faculty', 'Student home'], ['student', '/admin/dashboard', 'Student home'],
    ['faculty', '/teacher', 'Teacher home'], ['faculty', '/faculty', 'Teacher home'], ['admin', '/faculty', 'Teacher home'], ['faculty', '/teacher/dashboard', 'Teacher home'], ['faculty', '/admin', 'Teacher home'],
    ['admin', '/admin', 'Admin home'], ['admin', '/teacher', 'Teacher home'],
    ['student', '/', 'Student home'], ['faculty', '/', 'Teacher home'], ['admin', '/', 'Admin home'],
    ['student', '/student/experiments', 'Experiments'],
  ])('routes %s at %s safely', async (role, path, expected) => {
    visit(path, role as Role); expect(await screen.findByText(expected)).toBeInTheDocument();
  });
  it.each([
    ['/student', 'Student home'], ['/experiments', 'Experiments'], ['/experiments/e1', 'Experiment'],
    ['/labs/l1', 'Lab'], ['/progress', 'Progress'], ['/history', 'History'], ['/profile', 'Profile'],
  ].flatMap(([path, expected]) => [
    [path, 'student', expected], [path, 'faculty', 'Teacher home'], [path, 'admin', 'Admin home'], [path, '', 'Login page'],
  ]))('checks student route %s for role %s', async (path, role, expected) => {
    visit(path, role ? role as Role : undefined);
    expect(await screen.findByText(expected)).toBeInTheDocument();
  });
  it('waits for session bootstrap before rendering protected content', () => {
    useSessionStore.setState({ loaded: false }); visit('/admin');
    expect(screen.getByText('Loading Somaiya Virtual Labs…')).toBeInTheDocument();
    expect(screen.queryByText('Admin home')).not.toBeInTheDocument();
  });
});
