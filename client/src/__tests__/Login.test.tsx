import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../services/api', () => ({ api: { post: vi.fn(), defaults: { baseURL: 'http://localhost:5000/api' } }, errorMessage: () => 'Please try again.' }));
import { api } from '../services/api';
import { Login } from '../pages/Login';
import { useSessionStore } from '../store/sessionStore';

beforeEach(() => { vi.resetAllMocks(); useSessionStore.setState({ user: null, loaded: true }); });
afterEach(cleanup);
function login(path = '/login') {
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/student" element={<p>Student home</p>} />
    <Route path="/teacher" element={<p>Teacher home</p>} />
    <Route path="/admin" element={<p>Admin home</p>} />
  </Routes></MemoryRouter>);
}
describe('Google login entry and existing password login', () => {
  it('links directly to the backend with no frontend OAuth credentials', () => {
    login();
    expect(screen.getByRole('link', { name: 'Continue with Google' })).toHaveAttribute('href', 'http://localhost:5000/api/auth/google');
    expect(screen.queryByRole('button', { name: 'Link Google to this account' })).not.toBeInTheDocument();
  });
  it('shows a safe, actionable OAuth error and ignores unrecognized error strings', () => {
    login('/login?oauth_error=account_exists');
    expect(screen.getByRole('alert')).toHaveTextContent('Sign in with its password');
    cleanup(); login('/login?oauth_error=__proto__');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it.each([['student', 'Student home'], ['faculty', 'Teacher home'], ['admin', 'Admin home']])('routes existing %s password login to its own home without localStorage tokens', async (role, home) => {
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    const user = { id: 'user', email: 'user@example.test', firstName: 'Test', lastName: 'User', role, isActive: true };
    vi.mocked(api.post).mockResolvedValue({ data: { user } });
    const view = login();
    fireEvent.change(screen.getByPlaceholderText('student@somaiya.edu'), { target: { value: 'user@example.test' } });
    fireEvent.change(view.container.querySelector('input[type=password]')!, { target: { value: 'test-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Access Virtual Laboratories' }));
    expect(await screen.findByText(home)).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/auth/login', { email: 'user@example.test', password: 'test-password' });
    expect(storage).not.toHaveBeenCalled(); storage.mockRestore();
  });
  it('offers explicit account linking only to a signed-in user', async () => {
    useSessionStore.setState({ user: { id: 'teacher', email: 'teacher@example.test', firstName: 'Test', lastName: 'Teacher', role: 'faculty', isActive: true } });
    vi.mocked(api.post).mockRejectedValue(new Error('unavailable'));
    login();
    fireEvent.click(screen.getByRole('button', { name: 'Link Google to this account' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/auth/google/link'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Please try again.');
  });
});
