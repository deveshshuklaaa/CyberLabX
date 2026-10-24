import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UniversityHeader } from '../components/common/UniversityHeader';
import { UniversityFooter } from '../components/common/UniversityFooter';
import { useSessionStore } from '../store/sessionStore';
import type { Role } from '../types/api';
import { api } from '../services/api';

vi.mock('../services/api', () => ({ api: { post: vi.fn() } }));
function setup(role: Role = 'student', path = '/student') {
  useSessionStore.setState({ user: { id: 's1', firstName: 'Demo', lastName: 'Student', email: 'demo@example.test', role, isActive: true } });
  return render(<MemoryRouter initialEntries={[path]}><UniversityHeader /><UniversityFooter /></MemoryRouter>);
}

describe('Portal navigation', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it('shows student routes and marks the current nested route', () => {
    setup('student', '/student/experiments/e1');
    const nav = within(screen.getByRole('navigation', { name: 'Main navigation' }));
    expect(nav.getByRole('link', { name: 'Experiments' })).toHaveAttribute('aria-current', 'page');
    expect(nav.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
    expect(nav.queryByRole('link', { name: /Teacher/ })).not.toBeInTheDocument();
    const footer = within(screen.getByRole('navigation', { name: 'Footer navigation' }));
    expect(footer.getByRole('link', { name: 'My Progress' })).toHaveAttribute('href', '/progress');
  });
  it.each([['faculty', '/faculty', ['Teacher Dashboard']], ['admin', '/admin', ['Admin Dashboard', 'Teacher Portal']]] as const)(
    'limits %s navigation to allowed routes', (role, path, labels) => {
      setup(role, path);
      const nav = within(screen.getByRole('navigation', { name: 'Main navigation' }));
      expect(nav.getAllByRole('link').map(link => link.textContent)).toEqual([...labels]);
      expect(nav.getByRole('link', { name: labels[0] })).toHaveAttribute('aria-current', 'page');
      expect(within(screen.getByRole('navigation', { name: 'Footer navigation' })).queryByRole('link', { name: 'Experiments' })).not.toBeInTheDocument();
    });
  it('opens with an accessible toggle, closes on Escape and restores focus', () => {
    setup();
    const toggle = screen.getByRole('button', { name: 'Toggle navigation menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(screen.getByRole('navigation', { name: 'Mobile navigation' }), { key: 'Escape' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveFocus();
  });
  it('closes mobile navigation after following a link', () => {
    setup();
    const toggle = screen.getByRole('button', { name: 'Toggle navigation menu' });
    fireEvent.click(toggle);
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Mobile navigation' })).getByRole('link', { name: 'Experiments' }));
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
  it('keeps logout connected to the existing API and clears the session', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: {} });
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Sign Out' }));
    await waitFor(() => expect(useSessionStore.getState().user).toBeNull());
    expect(api.post).toHaveBeenCalledWith('/auth/logout');
  });
});
