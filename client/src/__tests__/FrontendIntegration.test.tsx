import { cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { useSessionStore } from '../store/sessionStore';
import { api } from '../services/api';

vi.mock('../services/api', () => ({ api: { get: vi.fn(), post: vi.fn(), defaults: { baseURL: 'http://localhost:5000/api' } }, errorMessage: () => 'Request failed.' }));
vi.mock('../components/terminal/Terminal', () => ({ Terminal: () => <div aria-label="Transport test boundary" /> }));
const experiment = { _id: 'e1', title: 'Controlled Nmap', slug: 'nmap', description: 'Discover assigned hosts.', aim: 'Identify the controlled target.', objectives: ['Discover hosts'], theorySections: [{ title: 'Discovery', content: 'Controlled scans only.' }], procedureSections: ['Use assigned target'], difficulty: 'Beginner', estimatedTimeMinutes: 40, taskCount: 1, tasks: [{ id: 't1', title: 'Discover target', description: 'Run host discovery', hints: [], marks: 80, order: 1 }], quiz: { questions: [{ id: 'q1', question: 'Which host?', options: ['Assigned target', 'External target'], explanation: 'Assigned only', marks: 20 }] }, lab: { profile: 'shell-target-v1', target: { hostname: 'nmap-target', displayName: 'Controlled target' }, terminal: { promptLabel: 'Kali' } } };
let started = false; let verified = false; let completed = false;
beforeEach(() => {
  vi.clearAllMocks(); started = false; verified = false; completed = false;
  useSessionStore.setState({ loaded: true, user: { id: 'integration-student', firstName: 'Integration', lastName: 'Student', email: 'integration@example.test', role: 'student', isActive: true } });
  vi.mocked(api.get).mockImplementation(async path => {
    if (path === '/student/dashboard') return { data: { stats: { totalExperiments: 1, experimentsAttempted: started ? 1 : 0, experimentsCompleted: completed ? 1 : 0, publishedExperimentsCompleted: completed ? 1 : 0, averageScore: completed ? 100 : 0, bestScore: completed ? 100 : 0 }, recentAttempts: [] } };
    if (path === '/student/history') return { data: { attempts: completed ? [{ attemptId: 'a1', experimentId: 'e1', experimentTitle: experiment.title, status: 'completed', score: 100, assessmentScore: { value: 100, max: 100, percentage: 100, basis: 'report' }, startedAt: '2026-01-01T10:00:00Z', completedAt: '2026-01-01T11:00:00Z', reportAvailable: true, reportId: 'r1' }] : [] } };
    if (path === '/experiments') return { data: { experiments: [experiment] } };
    if (path === '/experiments/e1') return { data: { experiment } };
    if (path === '/labs/l1') return { data: { labSession: { id: 'l1', attemptId: 'a1', status: completed ? 'stopped' : 'running', backend: 'docker', expiresAt: '2030-01-01T10:00:00Z' } } };
    if (path === '/attempts/a1') return { data: { attempt: { experiment, currentTaskIndex: verified ? 1 : 0, status: completed ? 'completed' : 'running', score: completed ? 100 : 0 } } };
    throw new Error(`Unexpected endpoint ${path}`);
  });
  vi.mocked(api.post).mockImplementation(async path => {
    if (path === '/labs/start') { started = true; return { data: { labSession: { id: 'l1' }, attemptId: 'a1' } }; }
    if (path === '/tasks/t1/submit') { verified = true; return { data: { result: { passed: true, score: 80, feedback: 'Target verified', ruleResults: [] }, currentTaskIndex: 1, score: 80 } }; }
    if (path === '/quizzes/e1/submit') { completed = true; return { data: { totalScore: 100, score: 20, totalMarks: 20, reportId: 'r1', downloadUrl: '/api/reports/r1/download', reportError: null, answers: [{ questionId: 'q1', selectedOption: 0, correct: true, explanation: 'Assigned only' }] } }; }
    throw new Error(`Unexpected mutation ${path}`);
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function open(path: string) { window.history.replaceState({}, '', path); return render(<App />); }
describe('Frontend delivery integration', () => {
  it('connects dashboard, catalogue, details, lab grading, results, history and progress with existing contracts', async () => {
    const errors = vi.spyOn(console, 'error');
    open('/student'); await screen.findByText('0 / 1');
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute('href', '#main-content');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
    fireEvent.click(screen.getByRole('link', { name: 'Browse experiments' }));
    fireEvent.click(await screen.findByRole('link', { name: 'View experiment: Controlled Nmap' }));
    fireEvent.click((await screen.findAllByRole('button', { name: 'Start Experiment Lab' }))[0]);
    const input = await screen.findByLabelText(/Command Submission/);
    await waitFor(() => expect(input).toBeEnabled());
    fireEvent.change(input, { target: { value: 'nmap -sn nmap-target' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify Task' }));
    fireEvent.click(await screen.findByRole('radio', { name: 'Assigned target' }));
    fireEvent.click(screen.getByRole('button', { name: /Submit Practical/ }));
    expect(await screen.findByTestId('final-score')).toHaveTextContent('100');
    fireEvent.click(screen.getByRole('link', { name: 'View attempt history' }));
    expect(await screen.findByText('100 / 100 (100%)')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Download report for/ })).toHaveAttribute('href', 'http://localhost:5000/api/reports/r1/download');
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('link', { name: 'My Progress' }));
    expect(await screen.findByText('1 completed / 1 published experiments')).toBeInTheDocument();
    expect(screen.getByText('100 / 100 (100%)')).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('link', { name: 'Dashboard' }));
    expect(await screen.findByText('1 / 1')).toBeInTheDocument();
    expect(errors).not.toHaveBeenCalled();
    expect(api.post).toHaveBeenCalledWith('/tasks/t1/submit', { attemptId: 'a1', command: 'nmap -sn nmap-target' });
  });
  it('restores saved completion after a direct visit instead of offering quiz resubmission', async () => {
    started = verified = completed = true; open('/labs/l1');
    expect(await screen.findByRole('region', { name: 'Saved completion' })).toHaveTextContent('Saved total score (points): 100');
    expect(screen.queryByRole('button', { name: /Submit Practical/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Transport test boundary')).not.toBeInTheDocument();
  });
  it('provides labeled login fields without embedded development credentials', async () => {
    useSessionStore.setState({ user: null }); open('/login');
    expect(screen.getByLabelText('University Email ID')).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('Account Password')).toHaveAttribute('type', 'password');
    expect(screen.queryByText('Development Seed Accounts:')).not.toBeInTheDocument();
  });
});
