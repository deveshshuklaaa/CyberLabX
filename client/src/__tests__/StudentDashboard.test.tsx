import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StudentDashboard } from '../pages/StudentDashboard';
import { useSessionStore } from '../store/sessionStore';

vi.mock('../services/api', () => ({ api: { get: vi.fn(), defaults: { baseURL: 'http://localhost:5000/api' } } }));
import { api } from '../services/api';

const progress = { stats: { totalExperiments: 3, experimentsAttempted: 2, experimentsCompleted: 1, averageScore: 92, bestScore: 100 }, recentAttempts: [{ attemptId: 'a1', experimentId: 'e1', experimentTitle: 'Network Mapping using Nmap', status: 'completed' as const, score: 92, startedAt: '2026-08-16T10:00:00.000Z', completedAt: '2026-08-16T10:30:00.000Z', reportAvailable: true, reportId: 'r1' }, { attemptId: 'a2', experimentId: 'e2', experimentTitle: 'Controlled DoS Attack Simulation & Traffic Analysis', status: 'running' as const, score: null, startedAt: '2026-08-15T10:00:00.000Z', reportAvailable: false } ] };
const experiments = { experiments: [{ _id: 'e1', title: 'Network Mapping using Nmap', slug: 'nmap', description: 'Controlled scan.', aim: 'a', objectives: [], theorySections: [], procedureSections: [], difficulty: 'Beginner', estimatedTimeMinutes: 45, lab: {} as any, tasks: [], quiz: { questions: [] }, taskCount: 4 }] };

function renderDashboard() { const query = new QueryClient({ defaultOptions: { queries: { retry: false } } }); return render(<QueryClientProvider client={query}><MemoryRouter><StudentDashboard/></MemoryRouter></QueryClientProvider>); }

describe('StudentDashboard', () => {
  beforeEach(() => { vi.clearAllMocks(); useSessionStore.setState({ user: { id: 'student', firstName: 'Demo', lastName: 'Student', email: 'demo@example.test', role: 'student', isActive: true } }); });
  it('renders a loading state for progress', () => { (api.get as any).mockImplementation(() => new Promise(() => {})); renderDashboard(); expect(screen.getByTestId('progress-loading')).toBeInTheDocument(); });
  it('renders real statistics, recent attempts, report access, and dynamic experiments', async () => { (api.get as any).mockImplementation((path: string) => Promise.resolve({ data: path === '/student/dashboard' ? progress : experiments })); renderDashboard(); await waitFor(() => expect(screen.getByText('1 / 3')).toBeInTheDocument()); expect(screen.getByText('92%')).toBeInTheDocument(); expect(screen.getAllByText('Network Mapping using Nmap')).toHaveLength(2); expect(screen.getByText('92/100')).toBeInTheDocument(); expect(screen.getByText('In Progress')).toBeInTheDocument(); expect(screen.getAllByText('—').length).toBeGreaterThan(0); const reportLinks = screen.getAllByRole('link', { name: /report/i }); const downloadLink = reportLinks.find(el => el.getAttribute('href')?.includes('/api/reports/')); expect(downloadLink).toHaveAttribute('href', 'http://localhost:5000/api/reports/r1/download'); });
  it('renders a useful empty state', async () => { (api.get as any).mockImplementation((path: string) => Promise.resolve({ data: path === '/student/dashboard' ? { stats: { totalExperiments: 2, experimentsAttempted: 0, experimentsCompleted: 0, averageScore: 0, bestScore: 0 }, recentAttempts: [] } : experiments })); renderDashboard(); expect(await screen.findByTestId('recent-empty')).toHaveTextContent('No experiments completed yet'); expect(screen.getByText('0 / 2')).toBeInTheDocument(); });
  it('renders an API error state without hiding the experiment catalog', async () => { (api.get as any).mockImplementation((path: string) => path === '/student/dashboard' ? Promise.reject(new Error('offline')) : Promise.resolve({ data: experiments })); renderDashboard(); expect(await screen.findByTestId('progress-error')).toHaveTextContent('Unable to load your learning progress'); expect(await screen.findByText('Network Mapping using Nmap')).toBeInTheDocument(); });
});
