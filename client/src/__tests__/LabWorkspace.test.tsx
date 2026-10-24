import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LabWorkspace } from '../pages/LabWorkspace';
import { ExperimentOverview } from '../pages/ExperimentOverview';
import { api } from '../services/api';
import type { Experiment } from '../types/api';

vi.mock('../services/api', () => ({ api: { get: vi.fn(), post: vi.fn(), defaults: { baseURL: 'http://localhost:5000/api' } }, errorMessage: () => 'Request failed. Please try again.' }));
// Workspace UI tests isolate the real transport; Terminal.test.tsx covers its event wiring.
vi.mock('../components/terminal/Terminal', () => ({ Terminal: () => <div aria-label="Terminal transport mounted" /> }));
const experiment: Experiment = {
  _id: 'e1', title: 'Nmap practical', slug: 'nmap', description: 'Map a controlled network.', aim: 'Identify hosts.', objectives: ['Discover the assigned target.'],
  theorySections: [{ title: 'Host discovery', content: 'Discovery theory.' }], procedureSections: ['Run discovery against the assigned target.'],
  difficulty: 'Beginner', estimatedTimeMinutes: 40, lab: { profile: 'shell-target-v1', studentImageKey: 'kali-nmap', target: { imageKey: 'nmap-http-target', hostname: 'nmap-target', displayName: 'Controlled target' }, terminal: { promptLabel: 'Kali shell' } },
  tasks: [{ id: 't1', title: 'Discover hosts', description: 'Execute host discovery.', hints: ['Use the assigned hostname.'], marks: 80, order: 1 }],
  quiz: { questions: [{ id: 'q1', question: 'Which target is allowed?', options: ['Assigned target', 'Public server'], explanation: 'Use controlled targets.', marks: 20 }] },
};
let status: string;
let taskIndex: number;
function responses(path: string) {
  if (path.startsWith('/labs/')) return Promise.resolve({ data: { labSession: { id: 'l1', attemptId: 'a1', status, backend: 'qemu', expiresAt: '2030-01-01T12:00:00Z', failureReason: status === 'failed' ? 'Provider unavailable' : undefined } } });
  if (path.startsWith('/attempts/')) return Promise.resolve({ data: { attempt: { experiment, currentTaskIndex: taskIndex } } });
  return Promise.resolve({ data: { experiment } });
}
function setup(path = '/labs/l1') {
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={query}><MemoryRouter initialEntries={[path]}><Link to="/labs/l2">Other session</Link><Routes>
    <Route path="/labs/:labSessionId" element={<LabWorkspace />} /><Route path="/experiments/:id" element={<ExperimentOverview />} /><Route path="/experiments" element={<p>Catalogue destination</p>} />
  </Routes></MemoryRouter></QueryClientProvider>);
}
beforeEach(() => { vi.clearAllMocks(); status = 'running'; taskIndex = 0; vi.mocked(api.get).mockImplementation(path => responses(String(path))); });
describe('Workspace API-driven states', () => {
  it.each(['provisioning', 'stopping', 'stopped', 'expired', 'failed'])('disables terminal and verification for %s', async value => {
    status = value; setup();
    await screen.findByRole('heading', { name: 'Nmap practical' });
    expect(screen.getByLabelText('Lab session state')).toHaveTextContent(value === 'stopping' ? 'cleanup in progress' : value === 'provisioning' ? 'Provisioning' : value);
    expect(screen.queryByLabelText('Terminal transport mounted')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verify Task' })).toBeDisabled();
    if (value === 'failed') expect(screen.getByText('Provider unavailable')).toBeInTheDocument();
  });
  it('restores a running lab and verifies a task using server grading', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { result: { passed: true, score: 80, feedback: 'Discovery verified.', ruleResults: [{ type: 'scan_result', passed: true, message: 'Target found.' }] }, currentTaskIndex: 1, score: 80 } });
    setup();
    expect(await screen.findByLabelText('Terminal transport mounted')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Verify Task' })).toBeEnabled());
    fireEvent.change(screen.getByLabelText(/Command Submission/), { target: { value: 'nmap -sn nmap-target' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify Task' }));
    expect(await screen.findByText('Discovery verified.')).toBeInTheDocument();
    expect(screen.getByText('Target found.', { exact: false })).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/tasks/t1/submit', { attemptId: 'a1', command: 'nmap -sn nmap-target' });
    expect(screen.getByText('Which target is allowed?', { exact: false })).toBeInTheDocument();
  });
  it('shows negative grading without advancing', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { result: { passed: false, score: 0, feedback: 'No matching evidence.', ruleResults: [] }, currentTaskIndex: 0, score: 0 } });
    setup(); await screen.findByLabelText(/Command Submission/);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Verify Task' })).toBeEnabled());
    fireEvent.change(screen.getByLabelText(/Command Submission/), { target: { value: 'nmap nmap-target' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify Task' }));
    expect(await screen.findByText('No matching evidence.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Submit Practical/ })).not.toBeInTheDocument();
  });
  it('submits quiz answers, displays real results and unmounts terminal after completion', async () => {
    taskIndex = 1;
    vi.mocked(api.post).mockResolvedValue({ data: { score: 20, totalMarks: 20, totalScore: 100, reportId: 'r1', downloadUrl: '/api/reports/r1/download', reportError: null, answers: [{ questionId: 'q1', selectedOption: 0, correct: true, explanation: 'Use controlled targets.' }] } });
    setup();
    const submit = await screen.findByRole('button', { name: /Submit Practical/ });
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: 'Assigned target' }));
    fireEvent.click(submit);
    expect(await screen.findByTestId('completion-panel')).toHaveTextContent('100');
    expect(screen.getByText('Correct: Use controlled targets.')).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/quizzes/e1/submit', { attemptId: 'a1', answers: [{ questionId: 'q1', selectedOption: 0 }] });
    expect(screen.queryByLabelText('Terminal transport mounted')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Download Report' })).toHaveAttribute('href', 'http://localhost:5000/api/reports/r1/download');
  });
  it('keeps quiz failures visible and permits retry', async () => {
    taskIndex = 1; vi.mocked(api.post).mockRejectedValue(new Error('offline')); setup();
    const submit = await screen.findByRole('button', { name: /Submit Practical/ });
    fireEvent.click(screen.getByRole('radio', { name: 'Assigned target' })); fireEvent.click(submit);
    expect(await screen.findByRole('alert')).toHaveTextContent('Request failed');
    expect(submit).toBeEnabled();
    expect(screen.queryByTestId('completion-panel')).not.toBeInTheDocument();
  });
  it('shows stop failures, then reflects a successful stop response', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(api.post).mockRejectedValueOnce(new Error('offline')).mockImplementation(async () => { status = 'stopped'; return { data: undefined }; });
    setup(); const stop = await screen.findByRole('button', { name: 'End Lab Session' });
    fireEvent.click(stop); expect(await screen.findByRole('alert')).toHaveTextContent('Request failed');
    fireEvent.click(stop); await waitFor(() => expect(screen.getByLabelText('Lab session state')).toHaveTextContent('Lab session stopped'));
    expect(api.post).toHaveBeenLastCalledWith('/labs/l1/stop');
    expect(screen.queryByLabelText('Terminal transport mounted')).not.toBeInTheDocument();
  });
  it('preserves non-Nmap experiments and their command guidance', async () => {
    const other = { ...experiment, title: 'Email forensics', lab: { profile: 'email-forensics-v1', studentImageKey: 'kali-email-forensics', terminal: { promptLabel: 'Analysis shell' } } };
    vi.mocked(api.get).mockImplementation(path => String(path).startsWith('/attempts/') ? Promise.resolve({ data: { attempt: { experiment: other, currentTaskIndex: 0 } } }) : responses(String(path)));
    setup();
    await screen.findByRole('heading', { name: 'Email forensics' });
    expect(screen.getByPlaceholderText('Enter the command you executed')).toBeInTheDocument();
    expect(screen.queryByText(/Nmap: execute/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Terminal transport mounted')).toBeInTheDocument();
  });
  it('resets command and grading state when the route changes to another session', async () => {
    setup(); const input = await screen.findByLabelText(/Command Submission/);
    await waitFor(() => expect(input).toBeEnabled());
    fireEvent.change(input, { target: { value: 'old session command' } });
    fireEvent.click(screen.getByRole('link', { name: 'Other session' }));
    await waitFor(() => expect(screen.getByLabelText(/Command Submission/)).toHaveValue(''));
    expect(api.get).toHaveBeenCalledWith('/labs/l2');
  });
  it('recovers from session lookup failure', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('offline')); setup();
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load lab session');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByLabelText('Terminal transport mounted')).toBeInTheDocument();
  });
});
describe('Experiment detail', () => {
  it('shows real overview, duration, syllabus and starts through the existing endpoint', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { labSession: { id: 'l1' }, attemptId: 'a1' } }); setup('/experiments/e1');
    await screen.findByRole('heading', { name: 'Nmap practical' });
    expect(screen.getByText('40 min')).toBeInTheDocument();
    expect(screen.getByText('Map a controlled network.')).toBeInTheDocument();
    expect(screen.getByText('Discovery theory.')).toBeInTheDocument();
    expect(screen.getByText('Identify hosts.')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Start Experiment Lab' })[0]);
    await screen.findByLabelText('Lab session state');
    expect(api.post).toHaveBeenCalledWith('/labs/start', { experimentId: 'e1' });
  });
  it('offers retry for detail failures instead of an endless spinner', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('offline')); setup('/experiments/e1');
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load experiment details');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Nmap practical' })).toBeInTheDocument();
  });
  it('displays provisioning failure without claiming a running lab', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('provider failed')); setup('/experiments/e1');
    fireEvent.click((await screen.findAllByRole('button', { name: 'Start Experiment Lab' }))[0]);
    expect(await screen.findByRole('alert')).toHaveTextContent('Request failed');
    expect(screen.queryByLabelText('Terminal transport mounted')).not.toBeInTheDocument();
  });
});
