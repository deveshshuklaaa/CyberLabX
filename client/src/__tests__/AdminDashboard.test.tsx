import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminDashboard } from '../pages/AdminDashboard';
import { CreateUserForm } from '../components/admin/CreateUserForm';
import { api } from '../services/api';
import { useSessionStore } from '../store/sessionStore';

vi.mock('../services/api', () => ({ api: { get: vi.fn(), post: vi.fn() }, errorMessage: () => 'Request failed.' }));
const data = { metrics: { users: 42, activeStudents: 31, attempts: 88 }, events: [
  { _id: 'event1', action: 'user.created', userId: 'actor1', resourceType: 'User', resourceId: 'user1', createdAt: '2026-01-02T10:00:00Z' },
  { _id: 'event2', action: 'lab.stopped', createdAt: '2026-01-01T10:00:00Z' },
] };
const catalogue = { experiments: [{ _id: 'e1', title: 'Nmap practical', description: 'Map a controlled target.', difficulty: 'Beginner', estimatedTimeMinutes: 40, taskCount: 4 }] };
const management = { writesAvailable: false, code: 'ACCOUNT_UPDATE_UNAVAILABLE', message: 'Account changes unavailable' };
function payload(path: unknown, overview: unknown = data, experiments: unknown = catalogue) {
  return path === '/admin/dashboard' ? overview : path === '/admin/users' ? { users: [], pagination: { page: 1, limit: 10, total: 0 }, management } : path === '/admin/audit-events' ? { events: [], pagination: { page: 1, limit: 10, total: 0 } } : experiments;
}
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><AdminDashboard /></QueryClientProvider>);
}
beforeEach(() => { vi.clearAllMocks(); useSessionStore.setState({ loaded: true, user: { id: 'admin', firstName: 'Admin', lastName: 'Example', email: 'admin@example.test', role: 'admin', isActive: true } }); vi.mocked(api.get).mockImplementation(path => Promise.resolve({ data: payload(path) })); });
describe('Admin overview', () => {
  it('uses real metrics, audit actor/resource IDs and a read-only published catalogue', async () => {
    setup(); expect(await screen.findByText('42')).toBeInTheDocument();
    expect(screen.getByText('31')).toBeInTheDocument(); expect(screen.getByText('88')).toBeInTheDocument();
    expect(screen.getByText('actor1')).toBeInTheDocument(); expect(screen.getByText('User | user1')).toBeInTheDocument();
    expect(screen.getByText('Nmap practical')).toBeInTheDocument(); expect(screen.getByText(/40 min/)).toBeInTheDocument();
    expect(screen.getByText(/not a live stream/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Users' })).toHaveAttribute('href', '#admin-users');
    expect(vi.mocked(api.get).mock.calls.every(([path]) => ['/admin/dashboard', '/experiments', '/admin/users', '/admin/audit-events'].includes(String(path)))).toBe(true);
    expect(screen.queryByRole('link', { name: /View experiment/ })).not.toBeInTheDocument();
  });
  it('filters the recent audit snapshot and clears unmatched filters', async () => {
    setup(); await screen.findByText('2 of 2 recent events');
    fireEvent.change(screen.getByLabelText('Event action'), { target: { value: 'user.created' } });
    expect(screen.getByText('1 of 2 recent events')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search recent events'), { target: { value: 'MISSING' } });
    expect(screen.getByText('No matching recent events.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear audit filters' }));
    expect(screen.getByText('2 of 2 recent events')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search recent events'), { target: { value: 'ACTOR1' } });
    expect(screen.getByText('1 of 2 recent events')).toBeInTheDocument();
  });
  it('shows genuine zero counts and empty audit/catalogue states', async () => {
    vi.mocked(api.get).mockImplementation(path => Promise.resolve({ data: payload(path, { metrics: { users: 0, activeStudents: 0, attempts: 0 }, events: [] }, { experiments: [] }) }));
    setup(); expect(await screen.findByText('No audit events recorded yet')).toBeInTheDocument();
    expect(screen.getAllByText('0')).toHaveLength(3); expect(screen.getByText('No published experiments available.')).toBeInTheDocument();
    expect(await screen.findByText('No users match these filters.')).toBeInTheDocument();
  });
  it('keeps catalogue failures independent of the overview and retries', async () => {
    let failed = true; vi.mocked(api.get).mockImplementation(path => path === '/experiments' && failed ? Promise.reject(new Error('offline')) : Promise.resolve({ data: payload(path) }));
    setup(); expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load published experiments');
    expect(screen.getByText('42')).toBeInTheDocument(); failed = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' })); expect(await screen.findByText('Nmap practical')).toBeInTheDocument();
  });
  it('rejects malformed overview data without fabricating counts or audit events', async () => {
    vi.mocked(api.get).mockImplementation(path => Promise.resolve({ data: payload(path, { metrics: {} }) }));
    setup(); expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load dashboard data');
    expect(screen.queryByText('No audit events recorded yet')).not.toBeInTheDocument();
  });
});
function fillForm() {
  fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'New' } });
  fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Teacher' } });
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'new@example.test' } });
  fireEvent.change(screen.getByLabelText('Initial password'), { target: { value: 'temporary-test-password' } });
}
describe('Retained account creation form (isolated fixtures; gated in the admin UI)', () => {
  it('defaults to student, requires valid inputs and does not post before review confirmation', () => {
    render(<CreateUserForm onCreated={() => {}} />);
    expect(screen.getByLabelText('Account role')).toHaveValue('student');
    expect(screen.getByLabelText('Initial password')).toHaveAttribute('minlength', '12');
    expect(screen.getByLabelText('Email address')).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('Initial password')).toHaveAttribute('type', 'password');
    fillForm(); fireEvent.click(screen.getByRole('button', { name: 'Review account' }));
    expect(screen.getByRole('region', { name: 'Review account creation' })).not.toHaveTextContent('temporary-test-password');
    expect(api.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Back to form' })); expect(api.post).not.toHaveBeenCalled();
  });
  it('creates a teacher with role faculty and shows only the returned account', async () => {
    const onCreated = vi.fn(); vi.mocked(api.post).mockResolvedValue({ data: { user: { id: 'new-id', firstName: 'New', lastName: 'Teacher', email: 'new@example.test', role: 'faculty', isActive: true } } });
    render(<CreateUserForm onCreated={onCreated} />); fillForm();
    fireEvent.change(screen.getByLabelText('Account role'), { target: { value: 'faculty' } });
    fireEvent.click(screen.getByRole('button', { name: 'Review account' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm create account' }));
    expect(await screen.findByText('Account created')).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/admin/users', { firstName: 'New', lastName: 'Teacher', email: 'new@example.test', password: 'temporary-test-password', role: 'faculty' });
    expect(screen.getByRole('status')).toHaveTextContent('new-id'); expect(onCreated).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Initial password')).toHaveValue('');
  });
  it('requires an explicit review of administrator privileges', () => {
    render(<CreateUserForm onCreated={() => {}} />); fillForm();
    fireEvent.change(screen.getByLabelText('Account role'), { target: { value: 'admin' } });
    fireEvent.click(screen.getByRole('button', { name: 'Review account' }));
    expect(screen.getByText('This account will have platform administrator access.')).toBeInTheDocument(); expect(api.post).not.toHaveBeenCalled();
  });
  it('blocks duplicate in-flight submissions', async () => {
    vi.mocked(api.post).mockImplementation(() => new Promise(() => {})); render(<CreateUserForm onCreated={() => {}} />); fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Review account' })); fireEvent.click(screen.getByRole('button', { name: 'Confirm create account' }));
    const pending = screen.getByRole('button', { name: 'Creating account...' }); expect(pending).toBeDisabled(); fireEvent.click(pending);
    expect(api.post).toHaveBeenCalledTimes(1);
  });
  it('does not claim success on failure and clears the password before a deliberate retry', async () => {
    const onCreated = vi.fn(); vi.mocked(api.post).mockRejectedValue(new Error('offline'));
    render(<CreateUserForm onCreated={onCreated} />); fillForm(); fireEvent.click(screen.getByRole('button', { name: 'Review account' })); fireEvent.click(screen.getByRole('button', { name: 'Confirm create account' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Creation could not be confirmed');
    expect(screen.queryByText('Account created')).not.toBeInTheDocument(); expect(onCreated).not.toHaveBeenCalled(); expect(screen.getByLabelText('Initial password')).toHaveValue('');
    expect(api.post).toHaveBeenCalledTimes(1);
  });
  it('keeps account creation disabled while the backend atomic-management gate is closed', async () => {
    setup(); await screen.findByText('42'); fireEvent.click(screen.getByText('Create a user account'));
    expect(screen.getByRole('button', { name: 'Review account' })).toBeDisabled();
    expect(screen.getByLabelText('Initial password')).toBeDisabled(); expect(api.post).not.toHaveBeenCalled();
  });
  it.each([409, 503])('explains a %s creation rejection without retaining the password', async status => {
    vi.mocked(api.post).mockRejectedValue({ isAxiosError: true, response: { status, data: { code: status === 409 ? 'DUPLICATE_EMAIL' : 'ACCOUNT_UPDATE_UNAVAILABLE' } } });
    render(<CreateUserForm onCreated={() => {}} />); fillForm(); fireEvent.click(screen.getByRole('button', { name: 'Review account' })); fireEvent.click(screen.getByRole('button', { name: 'Confirm create account' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(status === 409 ? 'already exists' : 'unavailable'); expect(screen.getByLabelText('Initial password')).toHaveValue(''); expect(screen.queryByText('Account created')).not.toBeInTheDocument();
  });
});
