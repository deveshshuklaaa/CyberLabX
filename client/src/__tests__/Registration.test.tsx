import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../services/api', () => ({ api: { post: vi.fn() }, errorMessage: () => 'An account with this email already exists.' }));
import { Registration } from '../pages/Registration';
import { api } from '../services/api';
import { useSessionStore } from '../store/sessionStore';

beforeEach(() => { vi.resetAllMocks(); useSessionStore.setState({ user: null, loaded: true }); });
afterEach(cleanup);

function registration(client = new QueryClient()) {
  return { client, ...render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/register']}><Routes>
    <Route path="/register" element={<Registration />} />
    <Route path="/student" element={<p>Student home</p>} />
  </Routes></MemoryRouter></QueryClientProvider>) };
}

function fillValidForm() {
  fireEvent.change(screen.getByLabelText('First Name'), { target: { value: ' Ada ' } });
  fireEvent.change(screen.getByLabelText('Last Name'), { target: { value: ' Lovelace ' } });
  fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: ' ADA@Example.Test ' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'a-long-test-passphrase' } });
  fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'a-long-test-passphrase' } });
}

describe('Student registration', () => {
  it('validates fields and never submits privileged role data', async () => {
    registration();
    fireEvent.click(screen.getByRole('button', { name: 'Create Student Account' }));
    expect(await screen.findByText('Enter your first name.')).toBeInTheDocument();
    expect(screen.getByText('Use at least 12 characters.')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();

    fillValidForm();
    vi.mocked(api.post).mockResolvedValue({ data: { user: { id: 'student-1', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.test', role: 'student', isActive: true } } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Student Account' }));
    await screen.findByText('Student home');
    expect(api.post).toHaveBeenCalledWith('/auth/register', { firstName: 'Ada', lastName: 'Lovelace', email: 'ADA@Example.Test', password: 'a-long-test-passphrase' });
    expect(vi.mocked(api.post).mock.calls[0][1]).not.toHaveProperty('role');
  });

  it('checks password confirmation and provides an accessible visibility control', async () => {
    registration(); fillValidForm();
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'different-passphrase' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Student Account' }));
    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();
    const password = screen.getByLabelText('Password');
    expect(password).toHaveAttribute('type', 'password');
    fireEvent.click(screen.getByRole('button', { name: 'Show passwords' }));
    expect(password).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide passwords' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows duplicate and network errors without creating a local session', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('conflict'));
    registration(); fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: 'Create Student Account' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('An account with this email already exists.');
    expect(useSessionStore.getState().user).toBeNull();
  });

  it('clears prior-account queries before storing the registered identity', async () => {
    const client = new QueryClient(); client.setQueryData(['teacher-students', 'old-user'], { private: true });
    const cancel = vi.spyOn(client, 'cancelQueries');
    vi.mocked(api.post).mockResolvedValue({ data: { user: { id: 'student-2', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.test', role: 'student', isActive: true } } });
    registration(client); fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: 'Create Student Account' }));
    await screen.findByText('Student home');
    await waitFor(() => expect(cancel).toHaveBeenCalled());
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    expect(useSessionStore.getState().user?.id).toBe('student-2');
  });
});
