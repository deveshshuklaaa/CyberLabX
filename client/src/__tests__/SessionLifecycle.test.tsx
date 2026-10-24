import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionBootstrap } from '../hooks/useSession';
import { useSignOut } from '../hooks/useSignOut';
import { useSessionStore } from '../store/sessionStore';
import { api } from '../services/api';
vi.mock('../services/api', () => ({ api: { get: vi.fn(), post: vi.fn(), interceptors: { request: { use: vi.fn(), eject: vi.fn() }, response: { use: vi.fn(), eject: vi.fn() } } } }));
const user = { id: 'student-a', firstName: 'Private', lastName: 'Student', email: 'student@example.test', role: 'student' as const, isActive: true };
let request: (config: object) => object, rejected: (error: object) => Promise<never>;
function Boundary() { useSessionBootstrap(); return null; }
function Session() { const { pending, error, signOut } = useSignOut(); return <><button disabled={pending} onClick={() => { void signOut(); }}>{pending ? 'Signing out' : 'End session'}</button>{error && <p role="alert">{error}</p>}</>; }
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['student-private', user.id], { record: 'private' });
  return { client, ...render(<QueryClientProvider client={client}><MemoryRouter><Boundary /><Routes><Route path="/" element={<Session />} /><Route path="/login" element={<p>Login destination</p>} /></Routes></MemoryRouter></QueryClientProvider>) };
}
beforeEach(() => {
  vi.resetAllMocks(); useSessionStore.setState({ loaded: true, user });
  vi.mocked(api.interceptors.request.use).mockImplementation(fn => { request = fn as never; return 1; });
  vi.mocked(api.interceptors.response.use).mockImplementation((_fulfilled, fail) => { rejected = fail as never; return 2; });
});
describe('session boundaries', () => {
  it('clears cached data and identity on a current protected-request 401', async () => {
    const { client } = setup(), config = request({ url: '/student/history' });
    await act(async () => { await rejected({ config, response: { status: 401 } }).catch(() => {}); });
    expect(useSessionStore.getState().user).toBeNull(); expect(client.getQueryCache().getAll()).toHaveLength(0);
  });
  it('does not expire a newer account because an old account request returned late', async () => {
    const { client } = setup(), oldConfig = request({ url: '/student/history' });
    act(() => useSessionStore.setState({ user: { ...user, id: 'student-b' } })); client.setQueryData(['student-private', 'student-b'], { new: true });
    await act(async () => { await rejected({ config: oldConfig, response: { status: 401 } }).catch(() => {}); });
    expect(useSessionStore.getState().user?.id).toBe('student-b'); expect(client.getQueryData(['student-private', 'student-b'])).toEqual({ new: true });
  });
  it('leaves a login rejection for the login form to explain', async () => {
    const { client } = setup(), config = request({ url: '/auth/login' });
    await act(async () => { await rejected({ config, response: { status: 401 } }).catch(() => {}); });
    expect(useSessionStore.getState().user).toEqual(user); expect(client.getQueryCache().getAll()).toHaveLength(1);
  });
  it('cancels in-flight queries and clears all role caches after confirmed logout', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: {} }); const { client } = setup(); let aborted = false;
    void client.fetchQuery({ queryKey: ['admin-private', 'old-admin'], queryFn: ({ signal }) => new Promise((_resolve, reject) => { signal.addEventListener('abort', () => { aborted = true; reject(new Error('Cancelled')); }); }) }).catch(() => {});
    fireEvent.click(screen.getByRole('button', { name: 'End session' })); await screen.findByText('Login destination');
    expect(aborted).toBe(true); expect(client.getQueryCache().getAll()).toHaveLength(0); expect(useSessionStore.getState().user).toBeNull();
  });
  it('keeps an unconfirmed logout honest, then permits explicit retry', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ data: {} }); setup(); fireEvent.click(screen.getByRole('button', { name: 'End session' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('server session may still be active'); expect(useSessionStore.getState().user?.id).toBe(user.id); expect(screen.queryByText('Login destination')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'End session' })); await screen.findByText('Login destination'); expect(api.post).toHaveBeenCalledTimes(2);
  });
  it('does not let an unmounted bootstrap request replace a newer identity', async () => {
    useSessionStore.setState({ loaded: false, user: null }); let finish!: (value: unknown) => void;
    vi.mocked(api.get).mockImplementation(() => new Promise(resolve => { finish = resolve as never; }));
    const view = setup(); await waitFor(() => expect(api.get).toHaveBeenCalled()); const signal = vi.mocked(api.get).mock.calls[0][1]?.signal;
    view.unmount(); expect(signal?.aborted).toBe(true); useSessionStore.setState({ loaded: true, user: { ...user, id: 'student-b' } });
    await act(async () => { finish({ data: { user } }); }); expect(useSessionStore.getState().user?.id).toBe('student-b');
    expect(api.interceptors.request.eject).toHaveBeenCalledWith(1); expect(api.interceptors.response.eject).toHaveBeenCalledWith(2);
  });
});
