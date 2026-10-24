import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StudentAcademics } from '../components/faculty/StudentAcademics';
import { CohortPerformance } from '../components/faculty/CohortPerformance';
import { useSessionStore } from '../store/sessionStore';
import { api } from '../services/api';

vi.mock('../services/api', () => ({ api: { get: vi.fn() }, errorMessage: () => 'Request failed. Please try again.' }));
const studentId = '000000000000000000000003', experimentId = '00000000000000000000000a';
const ref = { id: experimentId, title: 'Nmap discovery', category: 'Network', status: 'published' };
const pagination = { page: 1, limit: 10, total: 1 };
const attempt = { id: 'attempt-one', experiment: ref, status: 'completed', startedAt: '2026-10-01T10:00:00Z', completedAt: '2026-10-01T11:00:00Z', assessmentScore: { value: 0, max: 75, percentage: 0, basis: 'report' }, taskProgress: { verifiedTaskCount: 2, requiredTaskCount: null, percentage: null, basis: 'unknown' }, report: { id: 'report-one', available: true } };
const report = { id: 'report-one', attemptId: 'attempt-one', experiment: ref, generatedAt: attempt.completedAt, score: 0, totalMarks: 75, quizScore: 0, available: true, downloadUrl: 'https://untrusted.example/not-used' };
const analytics = { cohort: { enrolledStudents: 2, activeStudents: 1, inactiveStudents: 1, attemptedStudents: 1, completedStudents: 1, attemptCount: 3, completedAttemptCount: 2 }, experiments: [{ experiment: ref, performance: { attemptedStudents: 1, completedStudents: 1, attemptCount: 3, completedAttemptCount: 2, averageScore: 25, bestScore: 50, normalizedScoreCount: 1, averagePercentage: 50, completionPercentage: 50 } }], pagination };
function setup(cohort = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return { client, ...render(<QueryClientProvider client={client}>{cohort ? <CohortPerformance /> : <StudentAcademics teacherId="teacher" studentId={studentId} />}</QueryClientProvider>) };
}
beforeEach(() => {
  vi.restoreAllMocks(); vi.resetAllMocks();
  useSessionStore.setState({ user: { id: 'teacher', firstName: 'Test', lastName: 'Teacher', email: 'teacher@example.test', role: 'faculty', isActive: true }, loaded: true });
  vi.mocked(api.get).mockImplementation(path => Promise.resolve({ data: String(path).endsWith('/attempts') ? { attempts: [attempt], pagination } : String(path).endsWith('/reports') ? { reports: [report], pagination } : analytics }));
});
describe('Teacher academic history and reports', () => {
  it('renders real completed zero scores, unknown task totals and accessible tabs', async () => {
    setup(); expect(screen.getByText('Loading student attempts...')).toBeInTheDocument();
    const rows = await screen.findByRole('list', { name: 'Student attempts' });
    expect(rows).toHaveTextContent('0 / 75 (0%)'); expect(rows).toHaveTextContent('total not recorded');
    expect(screen.getByRole('button', { name: 'Attempt history' })).toHaveAttribute('aria-pressed', 'true');
    expect(api.get).toHaveBeenCalledWith(`/teacher/students/${studentId}/attempts`, { params: { page: 1, limit: 10 } });
    expect(screen.getByRole('button', { name: 'Next results' })).toBeDisabled();
  });
  it.each(['running', 'failed', 'expired'])('presents %s without a fake grade', async status => {
    vi.mocked(api.get).mockResolvedValue({ data: { attempts: [{ ...attempt, status, assessmentScore: { value: null, max: null, percentage: null } }], pagination } });
    setup(); const rows = await screen.findByRole('list', { name: 'Student attempts' });
    expect(rows).toHaveTextContent(status === 'running' ? 'In progress' : status === 'failed' ? 'Failed' : 'Expired'); expect(rows).toHaveTextContent('Not graded');
  });
  it('applies supported exact filters, resets page and displays genuine empty data', async () => {
    const mock = vi.mocked(api.get);
    mock.mockImplementation((_path, config) => {
      const params = config?.params as { status?: string; page: number };
      return Promise.resolve({ data: { attempts: params.status ? [] : [attempt], pagination: { ...pagination, total: params.status ? 0 : 11, page: params.page } } });
    });
    setup(); await screen.findByText('Nmap discovery'); fireEvent.click(screen.getByRole('button', { name: 'Next results' }));
    await waitFor(() => expect(mock).toHaveBeenLastCalledWith(expect.any(String), { params: { page: 2, limit: 10 } }));
    fireEvent.change(screen.getByLabelText('Attempt status'), { target: { value: 'failed' } });
    fireEvent.change(screen.getByLabelText('Exact experiment ID'), { target: { value: experimentId } });
    fireEvent.change(screen.getByLabelText('From date (UTC)'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('Before date (UTC)'), { target: { value: '2026-10-02' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    await screen.findByText('No attempts match these filters.');
    expect(mock).toHaveBeenLastCalledWith(expect.any(String), { params: { page: 1, limit: 10, status: 'failed', experimentId, from: '2026-10-01T00:00:00.000Z', to: '2026-10-02T00:00:00.000Z' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset filters' })); await screen.findByText('Nmap discovery');
  });
  it('rejects invalid exact IDs and inverted dates before querying', async () => {
    setup(); await screen.findByText('Nmap discovery');
    fireEvent.change(screen.getByLabelText('Exact experiment ID'), { target: { value: 'bad' } }); fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('24-character'); expect(api.get).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText('Exact experiment ID'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('From date (UTC)'), { target: { value: '2026-10-02' } }); fireEvent.change(screen.getByLabelText('Before date (UTC)'), { target: { value: '2026-10-01' } }); fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('after the start'); expect(api.get).toHaveBeenCalledTimes(1);
  });
  it('recovers to an available page when refreshed records shrink', async () => {
    let total = 11;
    vi.mocked(api.get).mockImplementation((_path, config) => Promise.resolve({ data: { attempts: total ? [attempt] : [], pagination: { ...pagination, total, page: (config?.params as { page: number }).page } } }));
    setup(); await screen.findByText('Nmap discovery'); fireEvent.click(screen.getByRole('button', { name: 'Next results' })); await screen.findByText('Page 2 of 2 · 11 records');
    total = 0; fireEvent.click(screen.getByRole('button', { name: 'Refresh attempts' })); await screen.findByText('Page 1 of 1 · 0 records');
    expect(screen.getByRole('button', { name: 'Previous results' })).toBeDisabled();
  });
  it.each([401, 403, 404, 500])('shows %s as an error and retries explicitly without disclosing cached records', async status => {
    vi.mocked(api.get).mockRejectedValueOnce({ isAxiosError: true, response: { status } }); setup();
    await screen.findByRole('alert'); expect(screen.queryByText('Nmap discovery')).not.toBeInTheDocument(); expect(api.get).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' })); await screen.findByText('Nmap discovery');
  });
  it('renders metadata and downloads only via the canonical authorized route', async () => {
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:academic-test') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const get = vi.mocked(api.get).getMockImplementation()!;
    vi.mocked(api.get).mockImplementation((path, config) => String(path).endsWith('/download') ? Promise.resolve({ data: new Blob(['%PDF-test']), headers: { 'content-type': 'application/pdf' } }) : get(path, config));
    setup(); fireEvent.click(screen.getByRole('button', { name: 'Student reports' }));
    expect(await screen.findByText(/Score: 0 \/ 75/)).toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'Download student PDF' }));
    await waitFor(() => expect(click).toHaveBeenCalledOnce());
    expect(api.get).toHaveBeenCalledWith(`/teacher/students/${studentId}/reports/report-one/download`, { responseType: 'blob' });
  });
  it('keeps unavailable metadata and genuine empty report states', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { attempts: [], pagination } }).mockResolvedValueOnce({ data: { reports: [{ ...report, available: false }], pagination } }).mockResolvedValueOnce({ data: { reports: [], pagination: { ...pagination, total: 0 } } });
    setup(); await screen.findByText('No attempts match these filters.'); fireEvent.click(screen.getByRole('button', { name: 'Student reports' }));
    await screen.findByText('PDF unavailable. The academic record is preserved.'); expect(screen.queryByRole('button', { name: 'Download student PDF' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh reports' })); await screen.findByText(/No report records match/);
  });
  it('shows failed downloads without generating a report or claiming success', async () => {
    const get = vi.mocked(api.get).getMockImplementation()!;
    vi.mocked(api.get).mockImplementation((path, config) => String(path).endsWith('/download') ? Promise.reject({ response: { status: 404 } }) : get(path, config));
    setup(); fireEvent.click(screen.getByRole('button', { name: 'Student reports' })); fireEvent.click(await screen.findByRole('button', { name: 'Download student PDF' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('enrollment access may have changed');
    expect(screen.getByRole('button', { name: 'Download student PDF' })).toBeEnabled();
  });
});
describe('Teacher cohort analytics', () => {
  it('explains repeat attempts, inactive membership, raw points and partial normalized coverage', async () => {
    setup(true); const rows = await screen.findByRole('list', { name: 'Experiment performance records' });
    expect(rows).toHaveTextContent('25 / 50'); expect(rows).toHaveTextContent('1 of 2 completed attempts');
    expect(rows).toHaveTextContent('including repeats'); expect(rows).toHaveTextContent('including inactive accounts');
    expect(screen.getByText('Students with attempts')).toBeInTheDocument();
  });
  it('distinguishes a real empty cohort and unknown scores from zero achievement', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { ...analytics, cohort: { ...analytics.cohort, enrolledStudents: 0 }, experiments: [{ experiment: ref, performance: { ...analytics.experiments[0].performance, averageScore: null, bestScore: null, averagePercentage: null, completionPercentage: null } }] } });
    setup(true); await screen.findByText(/No enrolled students. Published experiments/);
    expect(screen.getByText('Not graded / Not graded')).toBeInTheDocument(); expect(screen.getByText('No cohort denominator')).toBeInTheDocument();
  });
  it('explains a concurrent cohort change instead of an enrollment conflict', async () => {
    vi.mocked(api.get).mockRejectedValue({ isAxiosError: true, response: { status: 409, data: { code: 'COHORT_CHANGED' } } });
    setup(true); expect(await screen.findByRole('alert')).toHaveTextContent('cohort changed'); expect(screen.queryByText(/already enrolled/)).not.toBeInTheDocument();
  });
  it.each(['admin', 'student', null] as const)('does not request teacher analytics as %s', role => {
    useSessionStore.setState({ user: role ? { ...useSessionStore.getState().user!, role } : null }); setup(true); expect(api.get).not.toHaveBeenCalled();
  });
});
