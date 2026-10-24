import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Experiments } from '../pages/Experiments';
import { api } from '../services/api';

vi.mock('../services/api', () => ({ api: { get: vi.fn() } }));
const items = [
  { _id: 'e1', slug: 'nmap', title: 'Network Mapping', description: 'Discover controlled hosts with Nmap.', difficulty: 'Beginner', estimatedTimeMinutes: 40, taskCount: 4 },
  { _id: 'e2', slug: 'email', title: 'Email Investigation', category: 'Forensics', description: 'Analyze message headers.', difficulty: 'Intermediate', estimatedTimeMinutes: 25, taskCount: 1 },
];
function setup() {
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={query}><MemoryRouter><Experiments /></MemoryRouter></QueryClientProvider>);
}
describe('Experiment catalogue', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it('renders the actual list shape without needing detail-only fields', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { experiments: items } }); setup();
    expect(await screen.findByRole('heading', { name: 'Network Mapping' })).toBeInTheDocument();
    const card = within(screen.getByRole('heading', { name: 'Network Mapping' }).closest('article')!);
    expect(card.getByText('Uncategorized')).toBeInTheDocument();
    expect(card.getByText('Beginner')).toBeInTheDocument();
    expect(card.getByText('40 min')).toBeInTheDocument();
    expect(card.getByText('4 guided tasks')).toBeInTheDocument();
    expect(card.getByRole('link')).toHaveAttribute('href', '/experiments/e1');
    expect(api.get).toHaveBeenCalledWith('/experiments');
  });
  it('combines case-insensitive trimmed search and category filters, then resets', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { experiments: items } }); setup();
    await screen.findByText('2 of 2 experiments');
    fireEvent.change(screen.getByLabelText('Search experiments'), { target: { value: '  HEADERS  ' } });
    expect(screen.getByText('1 of 2 experiments')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Network Mapping' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Uncategorized' } });
    expect(screen.getByText('No matching experiments')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByText('2 of 2 experiments')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Forensics' } });
    expect(screen.getByText('1 of 2 experiments')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Email Investigation' })).toBeInTheDocument();
  });
  it('announces loading', () => {
    vi.mocked(api.get).mockImplementation(() => new Promise(() => {})); setup();
    expect(screen.getByRole('status')).toHaveTextContent('Loading experiment catalogue');
  });
  it('distinguishes an empty published catalogue from no search matches', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { experiments: [] } }); setup();
    expect(await screen.findByText('No experiments available yet')).toBeInTheDocument();
    expect(screen.queryByText('No matching experiments')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh catalogue' })).toBeInTheDocument();
  });
  it('recovers from an API failure with retry', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ data: { experiments: items } }); setup();
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load experiments');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Network Mapping' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
