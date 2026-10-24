import { useSessionStore } from '../store/sessionStore';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FacultyDashboard } from '../pages/FacultyDashboard';
import { api } from '../services/api';

vi.mock('../services/api', () => ({ api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() }, errorMessage: () => 'Request failed. Please try again.' }));
const metrics = { students: 28, completedAttempts: 63, averageScore: 84, reports: 51 };
const emptyList = { students: [], pagination: { page: 1, limit: 10, total: 0 } };
function responses(value = metrics) { vi.mocked(api.get).mockImplementation(path => Promise.resolve({ data: path === '/teacher/students' ? emptyList : { metrics: value } })); }
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><FacultyDashboard /></QueryClientProvider>);
}
beforeEach(() => { vi.clearAllMocks(); useSessionStore.setState({ user: { id: 'teacher', firstName: 'Test', lastName: 'Teacher', email: 'teacher@example.test', role: 'faculty', isActive: true } }); });
describe('Teacher overview', () => {
  it('displays all four real metrics with clear enrolled-cohort scope and definitions', async () => {
    responses(); setup();
    const summary = within(screen.getByRole('region', { name: 'Enrolled cohort summary' }));
    expect(await summary.findByText('28')).toBeInTheDocument();
    expect(summary.getByText('63')).toBeInTheDocument();
    expect(summary.getByText('84')).toBeInTheDocument();
    expect(summary.queryByText('84%')).not.toBeInTheDocument();
    expect(summary.getByText('51')).toBeInTheDocument();
    expect(summary.getByText('Active students')).toBeInTheDocument();
    expect(summary.getByText(/including repeats and history before enrollment/)).toBeInTheDocument();
    expect(screen.getByText(/students currently enrolled with you/)).toBeInTheDocument();
    expect(screen.getByText(/inactive enrolled students/)).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/faculty/dashboard');
  });
  it('connects enrollment while keeping unsupported performance and reports pending', async () => {
    responses(); setup();
    await screen.findByText('28');
    expect(await screen.findByText('No enrolled students')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Student monitoring' })).toHaveTextContent('Enroll an existing student');
    expect(screen.getByRole('region', { name: 'Experiment performance' })).toHaveTextContent('Experiment breakdown unavailable');
    expect(screen.getByRole('region', { name: 'Reports and assessment review' })).toHaveTextContent('Teacher report browser unavailable');
    expect(screen.getAllByText('Pending integration')).toHaveLength(2);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Download/ })).not.toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/teacher/students', { params: { page: 1, limit: 10 } });
    expect(screen.getByRole('link', { name: 'Student monitoring' })).toHaveAttribute('href', '#student-monitoring');
  });
  it('distinguishes empty metrics from pending integrations', async () => {
    responses({ students: 0, completedAttempts: 0, averageScore: 0, reports: 0 }); setup();
    expect(await screen.findByText('No enrolled cohort activity recorded yet')).toBeInTheDocument();
    expect(screen.getByText('Average score').parentElement).toHaveTextContent('0');
    expect(screen.getByText('No reports recorded yet.')).toBeInTheDocument();
    expect(await screen.findByText('No enrolled students')).toBeInTheDocument();
  });
  it('does not treat active students as completed learning activity', async () => {
    responses({ ...metrics, completedAttempts: 0 }); setup();
    expect(await screen.findByText(/No completed attempts yet/)).toBeInTheDocument();
    expect(screen.queryByText('No enrolled cohort activity recorded yet')).not.toBeInTheDocument();
  });
  it('supports refresh and displays the newly returned totals', async () => {
    let count = 0;
    vi.mocked(api.get).mockImplementation(path => Promise.resolve({ data: path === '/teacher/students' ? emptyList : { metrics: count++ ? { ...metrics, students: 29 } : metrics } })); setup();
    await screen.findByText('28');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh overview' }));
    expect(await screen.findByText('29')).toBeInTheDocument();
    expect(vi.mocked(api.get).mock.calls.filter(([path]) => path === '/faculty/dashboard')).toHaveLength(2);
  });
  it('does not convert an incomplete response into zero metrics', async () => {
    vi.mocked(api.get).mockImplementation(path => Promise.resolve({ data: path === '/teacher/students' ? emptyList : { metrics: { students: 28 } } })); setup();
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load dashboard data.');
    expect(screen.queryByText('Average score')).not.toBeInTheDocument();
    expect(screen.queryByText('No enrolled cohort activity recorded yet')).not.toBeInTheDocument();
  });
  it('keeps admin metrics platform-wide without calling faculty-only student routes', async () => {
    useSessionStore.setState({ user: { ...useSessionStore.getState().user!, role: 'admin' } });
    vi.mocked(api.get).mockResolvedValue({ data: { metrics } }); setup();
    const summary = within(screen.getByRole('region', { name: 'Platform summary' }));
    expect(await summary.findByText('28')).toBeInTheDocument();
    expect(screen.getByText(/platform-wide laboratory/)).toBeInTheDocument();
    expect(screen.getByText(/explicitly selected teacher/)).toBeInTheDocument();
    expect(vi.mocked(api.get).mock.calls.every(([path]) => path === '/faculty/dashboard')).toBe(true);
  });

});
