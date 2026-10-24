import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FacultyDashboard } from '../pages/FacultyDashboard';
import { api } from '../services/api';

vi.mock('../services/api', () => ({ api: { get: vi.fn() } }));
const metrics = { students: 28, completedAttempts: 63, averageScore: 84, reports: 51 };
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><FacultyDashboard /></QueryClientProvider>);
}
beforeEach(() => { vi.clearAllMocks(); });
describe('Teacher overview', () => {
  it('displays all four real metrics with clear platform scope and definitions', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { metrics } }); setup();
    const summary = within(screen.getByRole('region', { name: 'Platform summary' }));
    expect(await summary.findByText('28')).toBeInTheDocument();
    expect(summary.getByText('63')).toBeInTheDocument();
    expect(summary.getByText('84%')).toBeInTheDocument();
    expect(summary.getByText('51')).toBeInTheDocument();
    expect(summary.getByText('Active students')).toBeInTheDocument();
    expect(summary.getByText(/including repeated experiments/)).toBeInTheDocument();
    expect(screen.getByText(/not restricted to an assigned class/)).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/faculty/dashboard');
  });
  it('shows pending sections without invented student records, charts or report downloads', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { metrics } }); setup();
    await screen.findByText('28');
    expect(screen.getByRole('region', { name: 'Student monitoring' })).toHaveTextContent('Student directory unavailable');
    expect(screen.getByRole('region', { name: 'Experiment performance' })).toHaveTextContent('Experiment breakdown unavailable');
    expect(screen.getByRole('region', { name: 'Reports and assessment review' })).toHaveTextContent('Teacher report browser unavailable');
    expect(screen.getAllByText('Pending integration')).toHaveLength(4);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Download/ })).not.toBeInTheDocument();
    expect(vi.mocked(api.get).mock.calls.every(([path]) => path === '/faculty/dashboard')).toBe(true);
    expect(screen.getByRole('link', { name: 'Student monitoring' })).toHaveAttribute('href', '#student-monitoring');
  });
  it('distinguishes empty metrics from pending integrations', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { metrics: { students: 0, completedAttempts: 0, averageScore: 0, reports: 0 } } }); setup();
    expect(await screen.findByText('No student activity recorded yet')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByText('No reports recorded yet.')).toBeInTheDocument();
    expect(screen.getByText('Student directory unavailable')).toBeInTheDocument();
  });
  it('does not treat active students as completed learning activity', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { metrics: { ...metrics, completedAttempts: 0 } } }); setup();
    expect(await screen.findByText(/No completed attempts yet/)).toBeInTheDocument();
    expect(screen.queryByText('No student activity recorded yet')).not.toBeInTheDocument();
  });
  it('supports refresh and displays the newly returned totals', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { metrics } }).mockResolvedValue({ data: { metrics: { ...metrics, students: 29 } } }); setup();
    await screen.findByText('28');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh overview' }));
    expect(await screen.findByText('29')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledTimes(2);
  });
  it('does not convert an incomplete response into zero metrics', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { metrics: { students: 28 } } }); setup();
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load dashboard data.');
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
    expect(screen.queryByText('No student activity recorded yet')).not.toBeInTheDocument();
  });
});
