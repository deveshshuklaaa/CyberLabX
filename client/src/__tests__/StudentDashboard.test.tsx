import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StudentDashboard } from '../pages/StudentDashboard';
import { useSessionStore } from '../store/sessionStore';

vi.mock('../services/api', () => ({ api: { get: vi.fn(), defaults: { baseURL: 'http://localhost:5000/api' } } }));
import { api } from '../services/api';

const progress = { stats: { totalExperiments: 3, experimentsAttempted: 2, experimentsCompleted: 1, publishedExperimentsCompleted: 1, averageScore: 92, bestScore: 100 }, recentAttempts: [{ attemptId: 'a1', experimentId: 'e1', experimentTitle: 'Network Mapping using Nmap', status: 'completed' as const, score: 92, startedAt: '2026-08-16T10:00:00.000Z', completedAt: '2026-08-16T10:30:00.000Z', reportAvailable: true, reportId: 'r1' }, { attemptId: 'a2', experimentId: 'e2', experimentTitle: 'Controlled DoS Attack Simulation & Traffic Analysis', status: 'running' as const, score: null, startedAt: '2026-08-15T10:00:00.000Z', reportAvailable: false } ] };
const experiments = { experiments: [{ _id: 'e1', title: 'Network Mapping using Nmap', slug: 'nmap', description: 'Controlled scan.', aim: 'a', objectives: [], theorySections: [], procedureSections: [], difficulty: 'Beginner', estimatedTimeMinutes: 45, lab: {} as any, tasks: [], quiz: { questions: [] }, taskCount: 4 }] };

function renderDashboard() { const query = new QueryClient({ defaultOptions: { queries: { retry: false } } }); return render(<QueryClientProvider client={query}><MemoryRouter><StudentDashboard/></MemoryRouter></QueryClientProvider>); }

describe('StudentDashboard', () => {
  beforeEach(() => { vi.clearAllMocks(); useSessionStore.setState({ user: { id: 'student', firstName: 'Demo', lastName: 'Student', email: 'demo@example.test', role: 'student', isActive: true } }); });
  it('renders a loading state for progress', () => { (api.get as any).mockImplementation(() => new Promise(() => {})); renderDashboard(); expect(screen.getByTestId('progress-loading')).toBeInTheDocument(); });
  it('renders real statistics, recent attempts, report access, and dynamic experiments', async () => { (api.get as any).mockImplementation((path: string) => Promise.resolve({ data: path === '/student/dashboard' ? progress : experiments })); renderDashboard(); await waitFor(() => expect(screen.getByText('1 / 3')).toBeInTheDocument()); expect(screen.getByText('92 points')).toBeInTheDocument(); expect(screen.getAllByText('Network Mapping using Nmap')).toHaveLength(2); expect(screen.getByText('92 points \u00b7 maximum unknown')).toBeInTheDocument(); expect(screen.getByText('In Progress')).toBeInTheDocument(); expect(screen.getByText('Not graded')).toBeInTheDocument(); const reportLinks = screen.getAllByRole('link', { name: /report/i }); const downloadLink = reportLinks.find(el => el.getAttribute('href')?.includes('/api/reports/')); expect(downloadLink).toHaveAttribute('href', 'http://localhost:5000/api/reports/r1/download'); });
  it('renders a useful empty state', async () => { (api.get as any).mockImplementation((path: string) => Promise.resolve({ data: path === '/student/dashboard' ? { stats: { totalExperiments: 2, experimentsAttempted: 0, experimentsCompleted: 0, publishedExperimentsCompleted: 0, averageScore: 0, bestScore: 0 }, recentAttempts: [] } : experiments })); renderDashboard(); expect(await screen.findByTestId('recent-empty')).toHaveTextContent('No attempts yet'); expect(screen.getByText('0 / 2')).toBeInTheDocument(); });
  it('renders an API error state without hiding the experiment catalog', async () => { (api.get as any).mockImplementation((path: string) => path === '/student/dashboard' ? Promise.reject(new Error('offline')) : Promise.resolve({ data: experiments })); renderDashboard(); expect(await screen.findByTestId('progress-error')).toHaveTextContent('Unable to load your learning progress'); expect(await screen.findByText('Network Mapping using Nmap')).toBeInTheDocument(); });
  it('continues only a matching running experiment and does not invent a session URL', async () => {
    vi.mocked(api.get).mockImplementation((path) => Promise.resolve({ data: path === '/student/dashboard' ? { ...progress, recentAttempts: [{ ...progress.recentAttempts[1], experimentId: 'e1' }] } : experiments }));
    renderDashboard();
    expect(await screen.findByRole('link', { name: 'Continue experiment' })).toHaveAttribute('href', '/experiments/e1');
    expect(screen.getByText('demo@example.test', { exact: false })).toBeInTheDocument();
    expect(screen.getByTestId('stat-total-experiments')).toHaveTextContent('3');
    expect(screen.getByTestId('stat-experiments-attempted')).toHaveTextContent('2');
  });
  it('does not label another experiment as a running session', async () => {
    vi.mocked(api.get).mockImplementation((path) => Promise.resolve({ data: path === '/student/dashboard' ? progress : experiments }));
    renderDashboard();
    expect(await screen.findByRole('link', { name: 'Explore experiment' })).toHaveAttribute('href', '/experiments/e1');
    expect(screen.queryByRole('link', { name: 'Continue experiment' })).not.toBeInTheDocument();
  });
  it('retries progress independently of the catalogue', async () => {
    let failed = true;
    vi.mocked(api.get).mockImplementation((path) => path === '/student/dashboard' && failed ? Promise.reject(new Error('offline')) : Promise.resolve({ data: path === '/student/dashboard' ? progress : experiments }));
    renderDashboard();
    await screen.findByTestId('progress-error');
    failed = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('92 points')).toBeInTheDocument();
  });
  it('shows catalogue failure and retries without losing progress', async () => {
    let failed = true;
    vi.mocked(api.get).mockImplementation((path) => path === '/experiments' && failed ? Promise.reject(new Error('offline')) : Promise.resolve({ data: path === '/student/dashboard' ? progress : experiments }));
    renderDashboard();
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load available experiments');
    expect(screen.getByText('92 points')).toBeInTheDocument();
    failed = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('link', { name: 'Explore experiment' })).toBeInTheDocument();
  });
  it('shows an empty catalogue without a fabricated recommendation', async () => {
    vi.mocked(api.get).mockImplementation((path) => Promise.resolve({ data: path === '/student/dashboard' ? progress : { experiments: [] } }));
    renderDashboard();
    expect(await screen.findByText('No experiments available yet.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Explore experiment' })).not.toBeInTheDocument();
  });

});
