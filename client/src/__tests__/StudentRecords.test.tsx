import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StudentProgress } from '../pages/StudentProgress';
import { StudentHistory } from '../pages/StudentHistory';
import { StudentProfile } from '../pages/StudentProfile';
import { useSessionStore } from '../store/sessionStore';
import { api } from '../services/api';
import type { StudentHistoryAttempt } from '../types/api';

vi.mock('../services/api', () => ({ api: { get: vi.fn(), post: vi.fn(), defaults: { baseURL: 'http://localhost:5000/api' } } }));
const attempts: StudentHistoryAttempt[] = [
  { attemptId: 'a1', experimentId: 'e1', experimentTitle: 'Mapping', status: 'completed', score: 0, startedAt: '2026-01-01T10:00:00Z', completedAt: '2026-01-01T11:00:00Z', reportAvailable: true, reportId: 'r1' },
  { attemptId: 'a2', experimentId: 'e1', experimentTitle: 'Mapping', status: 'completed', score: 90, startedAt: '2026-02-01T10:00:00Z', completedAt: '2026-02-01T11:00:00Z', reportAvailable: false, reportId: 'stale-id' },
  { attemptId: 'a3', experimentId: 'e2', experimentTitle: 'Forensics', status: 'running', score: null, startedAt: '2026-03-01T10:00:00Z', reportAvailable: true },
  { attemptId: 'a4', experimentId: 'archived', experimentTitle: 'New practical', status: 'failed', score: null, startedAt: '2026-04-01T10:00:00Z', reportAvailable: false },
];
const experiments = [
  { _id: 'e1', title: 'Mapping', slug: 'mapping', description: 'Controlled network.', difficulty: 'Beginner', estimatedTimeMinutes: 40, taskCount: 3 },
  { _id: 'e2', title: 'Forensics', slug: 'forensics', description: 'Investigate evidence.', difficulty: 'Beginner', estimatedTimeMinutes: 30, taskCount: 2 },
  { _id: 'e3', title: 'New practical', slug: 'new', description: 'A published practical.', difficulty: 'Beginner', estimatedTimeMinutes: 30, taskCount: 2 },
];
const dashboard = { stats: { totalExperiments: 3, experimentsAttempted: 3, experimentsCompleted: 1, averageScore: 90, bestScore: 90 }, recentAttempts: [] };
function dataFor(path: string) { return path === '/student/history' ? { attempts } : path === '/student/dashboard' ? dashboard : { experiments }; }
function setup(path = '/progress') {
  const query = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  return render(<QueryClientProvider client={query}><MemoryRouter initialEntries={[path]}>
    <nav aria-label="Test routes"><Link to="/progress">Progress route</Link><Link to="/history">History route</Link></nav>
    <Routes><Route path="/progress" element={<StudentProgress />} /><Route path="/history" element={<StudentHistory />} /><Route path="/profile" element={<StudentProfile />} /><Route path="/login" element={<p>Login destination</p>} /></Routes>
  </MemoryRouter></QueryClientProvider>);
}
beforeEach(() => {
  vi.clearAllMocks(); vi.mocked(api.get).mockImplementation(path => Promise.resolve({ data: dataFor(String(path)) }));
  useSessionStore.setState({ loaded: true, user: { id: 'student-id', firstName: 'Demo', lastName: 'Student', email: 'demo@example.test', role: 'student', isActive: true } });
});
describe('Student progress', () => {
  it('uses summary statistics and full history matched by experiment ID', async () => {
    setup();
    const section = await screen.findByRole('region', { name: 'Experiment-wise progress' });
    await within(section).findByText('Not started', { selector: 'span' });
    const cards = within(section).getAllByRole('article');
    expect(within(cards[0]).getByText('90/100')).toBeInTheDocument();
    expect(within(cards[0]).getByText('Completed')).toBeInTheDocument();
    expect(within(cards[0]).getByText('2')).toBeInTheDocument();
    expect(within(cards[1]).getByText('In progress')).toBeInTheDocument();
    expect(within(cards[2]).getByText('Not started', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Curriculum completion' })).toHaveAttribute('value', '33');
    expect(screen.getAllByText('90%')).toHaveLength(2);
    expect(within(cards[0]).getByRole('link')).toHaveAttribute('href', '/experiments/e1');
  });
  it('does not claim experiments are unstarted when history fails and allows retry', async () => {
    let failed = true;
    vi.mocked(api.get).mockImplementation(path => path === '/student/history' && failed ? Promise.reject(new Error('offline')) : Promise.resolve({ data: dataFor(String(path)) }));
    setup(); expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load experiment progress');
    expect(screen.queryByText('Not started')).not.toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    failed = false; fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Not started', { selector: 'span' })).toBeInTheDocument();
  });
  it('handles zero published experiments without dividing by zero', async () => {
    vi.mocked(api.get).mockImplementation(path => Promise.resolve({ data: path === '/student/dashboard' ? { stats: { ...dashboard.stats, totalExperiments: 0, experimentsCompleted: 0 }, recentAttempts: [] } : path === '/experiments' ? { experiments: [] } : { attempts: [] } }));
    setup(); expect(await screen.findByText('No published experiments available')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
  it('shares the same cached response shape when navigating from history to progress and back', async () => {
    setup('/history'); await screen.findByText('4 of 4 attempts');
    fireEvent.click(screen.getByRole('link', { name: 'Progress route' }));
    expect(await screen.findByText('90/100')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'History route' }));
    expect(await screen.findByText('4 of 4 attempts')).toBeInTheDocument();
    expect(vi.mocked(api.get).mock.calls.filter(([path]) => path === '/student/history')).toHaveLength(1);
  });
});
describe('Student history', () => {
  it('shows dates, preserves zero scores and links only genuinely available reports', async () => {
    setup('/history'); await screen.findByText('4 of 4 attempts');
    const records = within(screen.getByRole('region', { name: 'Recorded attempts' }));
    expect(records.getByText('0/100')).toBeInTheDocument();
    expect(records.getAllByText('Not graded')).toHaveLength(2);
    const reports = records.getAllByRole('link', { name: /Download report/ });
    expect(reports).toHaveLength(1); expect(reports[0]).toHaveAttribute('href', 'http://localhost:5000/api/reports/r1/download');
    expect(records.getAllByText('Report unavailable')).toHaveLength(3);
    expect(records.getAllByRole('article')[0]).toHaveTextContent('Attempt a4');
    expect(records.getAllByText(/2026/).length).toBeGreaterThan(0);
  });
  it('combines search/status filtering, sorting and reset controls', async () => {
    setup('/history'); await screen.findByText('4 of 4 attempts');
    fireEvent.change(screen.getByLabelText('Search experiments'), { target: { value: ' MAPPING ' } });
    fireEvent.change(screen.getByLabelText('Attempt status'), { target: { value: 'completed' } });
    expect(screen.getByText('2 of 4 attempts')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Sort attempts'), { target: { value: 'oldest' } });
    expect(screen.getAllByRole('article')[0]).toHaveTextContent('Attempt a1');
    fireEvent.change(screen.getByLabelText('Sort attempts'), { target: { value: 'score' } });
    expect(screen.getAllByRole('article')[0]).toHaveTextContent('Attempt a2');
    fireEvent.change(screen.getByLabelText('Attempt status'), { target: { value: 'expired' } });
    expect(screen.getByText('No matching attempts')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByText('4 of 4 attempts')).toBeInTheDocument();
  });
  it('keeps failed requests distinct from an empty history and retries the history endpoint', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ data: { attempts: [] } });
    setup('/history'); expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load attempt history');
    expect(screen.queryByText('No attempts yet')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('No attempts yet')).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalledWith('/student/dashboard');
  });
  it('announces loading', () => {
    vi.mocked(api.get).mockImplementation(() => new Promise(() => {})); setup('/history');
    expect(screen.getByRole('status')).toHaveTextContent('Loading attempt history');
  });
});
describe('Student profile', () => {
  it('shows authenticated account fields with read-only status and existing navigation', () => {
    setup('/profile'); const account = within(screen.getByRole('region', { name: 'Account information' }));
    expect(account.getByRole('heading')).toHaveTextContent('Demo Student');
    expect(account.getByText('student-id')).toBeInTheDocument();
    expect(account.getByText('Active')).toBeInTheDocument();
    expect(account.getByText('student')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View history' })).toHaveAttribute('href', '/history');
    expect(api.get).not.toHaveBeenCalled();
  });
  it.each([true, false])('clears the session through existing logout handling (request succeeds: %s)', async success => {
    if (success) vi.mocked(api.post).mockResolvedValue({ data: {} }); else vi.mocked(api.post).mockRejectedValue(new Error('offline'));
    setup('/profile'); fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByText('Login destination')).toBeInTheDocument();
    expect(useSessionStore.getState().user).toBeNull(); expect(api.post).toHaveBeenCalledWith('/auth/logout');
  });
  it('shows inactive status accurately', () => {
    useSessionStore.setState({ user: { ...useSessionStore.getState().user!, isActive: false } }); setup('/profile');
    expect(screen.getByText('Inactive')).toBeInTheDocument(); expect(screen.queryByText('Active')).not.toBeInTheDocument();
  });
  it('handles unavailable session information without inventing a profile', () => {
    useSessionStore.setState({ user: null }); setup('/profile');
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('region', { name: 'Account information' })).not.toBeInTheDocument();
  });
});
