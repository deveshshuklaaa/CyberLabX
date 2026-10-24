import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FacultyDashboard } from '../pages/FacultyDashboard';
import { AdminDashboard } from '../pages/AdminDashboard';
import { api } from '../services/api';

vi.mock('../services/api', () => ({ api: { get: vi.fn() } }));
function setup(Page: typeof FacultyDashboard) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><Page /></QueryClientProvider>);
}

describe.each([['faculty', FacultyDashboard, '/faculty/dashboard'], ['admin', AdminDashboard, '/admin/dashboard']] as const)('%s dashboard states', (_role, Page, endpoint) => {
  beforeEach(() => { vi.clearAllMocks(); });
  it('announces loading', () => {
    vi.mocked(api.get).mockImplementation(() => new Promise(() => {}));
    setup(Page);
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
  });
  it('recovers from a failed request using the existing endpoint', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ data: { metrics: { students: 12, completedAttempts: 3, averageScore: 80, reports: 2 }, events: [] } });
    setup(Page);
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load dashboard data.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getByText('12')).toBeInTheDocument());
    expect(api.get).toHaveBeenLastCalledWith(endpoint);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
