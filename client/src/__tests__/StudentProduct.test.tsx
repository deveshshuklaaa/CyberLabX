import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { scoreText } from '../services/studentScores';
import { StudentProgress } from '../pages/StudentProgress';
import { StudentProfile } from '../pages/StudentProfile';
import { PdfDownloadLink } from '../components/common/PdfDownloadLink';
import { CompletionPanel } from '../components/lab/CompletionPanel';
import { useStudentHistory } from '../services/studentHistory';
import { useSessionStore } from '../store/sessionStore';
import { api } from '../services/api';
vi.mock('../services/api', () => ({ api: { get: vi.fn(), post: vi.fn(), defaults: { baseURL: 'http://localhost:5000/api' } }, errorMessage: () => 'Request failed.' }));
const summary = { scoreUnit: 'points', stats: { totalExperiments: 1, experimentsAttempted: 4, experimentsCompleted: 4, publishedExperimentsCompleted: 1, averageScore: 75, bestScore: 100 }, recentAttempts: [] };
const experiment = { _id: 'e1', title: 'Nmap', description: 'Controlled scan', taskCount: 4, category: 'Network', estimatedTimeMinutes: 40, difficulty: 'Beginner' };
const record = { attemptId: 'a1', experimentId: 'e1', status: 'completed', score: 75, assessmentScore: { value: 75, max: 75, percentage: 100, basis: 'report' as const }, startedAt: '2026-10-01T10:00:00Z' };
function setup(view: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  return { client, ...render(<QueryClientProvider client={client}><MemoryRouter>{view}</MemoryRouter></QueryClientProvider>) };
}
beforeEach(() => {
  vi.restoreAllMocks(); vi.resetAllMocks(); useSessionStore.setState({ loaded: true, user: { id: 'student-a', firstName: 'Student', lastName: '', email: 'student@example.test', role: 'student', isActive: true } });
  vi.mocked(api.get).mockImplementation(path => Promise.resolve({ data: path === '/student/dashboard' ? summary : path === '/student/history' ? { attempts: [record] } : path === '/student/enrollment' ? { enrollment: null } : { experiments: [experiment] } }));
});
describe('truthful student score/progress presentation', () => {
  it('uses known historical denominators, retains zero and never infers /100 for legacy data', () => {
    expect(scoreText('completed', 75, record.assessmentScore)).toBe('75 / 75 (100%)');
    expect(scoreText('completed', 0)).toBe('0 points · maximum unknown'); expect(scoreText('running', 99)).toBe('Not graded'); expect(scoreText('failed', 75)).toBe('Not graded');
    expect(scoreText('completed', NaN)).toBe('Not graded');
  });
  it('divides published completions by the published catalogue, with raw summary points and genuine report score', async () => {
    setup(<StudentProgress />); await screen.findByText('1 completed / 1 published experiments'); expect(screen.getByRole('progressbar')).toHaveAttribute('value', '100');
    expect(screen.getByText('75 points')).toBeInTheDocument(); expect(await screen.findByText('75 / 75 (100%)')).toBeInTheDocument(); expect(screen.queryByText('400%')).not.toBeInTheDocument();
  });
  it('shows an unknown denominator instead of using historical completions when the additive field is absent', async () => {
    const get = vi.mocked(api.get).getMockImplementation()!; vi.mocked(api.get).mockImplementation((path, config) => path === '/student/dashboard' ? Promise.resolve({ data: { ...summary, stats: { ...summary.stats, publishedExperimentsCompleted: undefined } } }) : get(path, config));
    setup(<StudentProgress />); await screen.findByText('Unknown completed / 1 published experiments'); expect(screen.queryByRole('progressbar')).not.toBeInTheDocument(); expect(screen.getByText(/Published completion count is unavailable/)).toBeInTheDocument();
  });
  it('does not infer missing family name or account-editing capabilities', async () => {
    setup(<StudentProfile />); expect(screen.getByText('Not provided')).toBeInTheDocument(); expect(screen.queryByRole('textbox')).not.toBeInTheDocument(); await screen.findByRole('heading', { name: 'Not enrolled with a teacher' });
  });
  it('isolates history cache by account even when a different account is selected without a page reload', async () => {
    function Probe() { const query = useStudentHistory(); return <p>{query.data?.attempts.map(row => row.attemptId).join(',') ?? 'Loading history'}</p>; }
    const { client } = setup(<Probe />); await screen.findByText('a1'); vi.mocked(api.get).mockResolvedValue({ data: { attempts: [] } });
    act(() => useSessionStore.setState({ user: { ...useSessionStore.getState().user!, id: 'student-b' } })); await waitFor(() => expect(screen.queryByText('a1')).not.toBeInTheDocument());
    await waitFor(() => expect(client.getQueryData(['student-history', 'student-b'])).toEqual({ attempts: [] })); expect(api.get).toHaveBeenCalledTimes(2);
  });
});
describe('student PDF download failures and retries', () => {
  it('renders a real access/unavailable failure rather than navigating to raw error JSON', async () => {
    vi.mocked(api.get).mockRejectedValue({ isAxiosError: true, response: { status: 404 } }); render(<PdfDownloadLink reportId="report-a" />);
    fireEvent.click(screen.getByRole('link', { name: 'Download report' })); expect(await screen.findByRole('alert')).toHaveTextContent('report file is unavailable'); expect(api.get).toHaveBeenCalledWith('/reports/report-a/download', { responseType: 'blob' });
  });
  it('rejects non-PDF responses without claiming a download', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: new Blob(['error']), headers: { 'content-type': 'application/json' } }); render(<PdfDownloadLink reportId="report-a" />); fireEvent.click(screen.getByRole('link')); expect(await screen.findByRole('alert')).toHaveTextContent('PDF download failed');
  });
  it('recovers from a failed request through the actual canonical route contract', async () => {
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:unit-pdf') }); Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() }); const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.mocked(api.get).mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ data: new Blob(['%PDF-test']), headers: { 'content-type': 'application/pdf' } }); render(<PdfDownloadLink reportId="report-a" />);
    fireEvent.click(screen.getByRole('link')); await screen.findByRole('alert'); fireEvent.click(screen.getByRole('link')); await waitFor(() => expect(click).toHaveBeenCalledOnce()); expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('does not follow an arbitrary completion download URL', () => {
    render(<CompletionPanel totalScore={75} quizScore={15} quizTotalMarks={15} downloadUrl="https://untrusted.example/file.pdf" reportError={null} />); expect(screen.queryByRole('link')).not.toBeInTheDocument(); expect(screen.getByText(/Report download is unavailable/)).toBeInTheDocument();
  });
  it('does not download a late response after leaving the authenticated report view', async () => {
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn() }); let finish!: (value: unknown) => void;
    vi.mocked(api.get).mockImplementation(() => new Promise(resolve => { finish = resolve as never; }));
    const view = render(<PdfDownloadLink reportId="report-a" />); fireEvent.click(screen.getByRole('link')); view.unmount();
    await act(async () => { finish({ data: new Blob(['%PDF-unit']), headers: { 'content-type': 'application/pdf' } }); }); expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});
