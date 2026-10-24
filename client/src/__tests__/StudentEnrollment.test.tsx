import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StudentEnrollment } from '../components/student/StudentEnrollment';
import { api } from '../services/api';
import { useSessionStore } from '../store/sessionStore';

vi.mock('../services/api', () => ({ api: { get: vi.fn() }, errorMessage: () => 'Request failed. Please try again.' }));
const enrollment = { teacherId: 'teacher', status: 'active', enrolledAt: '2026-10-24T10:00:00Z', teacher: { id: 'teacher', firstName: 'Lab', lastName: 'Instructor', email: 'teacher@example.test', isActive: true } };
function setup() { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><StudentEnrollment /></QueryClientProvider>); }
beforeEach(() => {
  vi.resetAllMocks();useSessionStore.setState({ user: { id: 'student', firstName: 'Demo', lastName: 'Student', email: 'student@example.test', role: 'student', isActive: true } });
  vi.mocked(api.get).mockResolvedValue({ data: { enrollment: null } });
});
describe('Student own enrollment', () => {
  it('shows loading then an unassigned state without inventing a teacher', async () => {
    setup();expect(screen.getByText('Loading your enrollment...')).toBeInTheDocument();expect(await screen.findByText('Not enrolled with a teacher')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledExactlyOnceWith('/student/enrollment');expect(screen.queryByText('Lab Instructor')).not.toBeInTheDocument();
  });
  it('displays actual teacher details and active assignment', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { enrollment } });setup();expect(await screen.findByText('Lab Instructor')).toBeInTheDocument();
    expect(screen.getByText('teacher@example.test')).toBeInTheDocument();expect(screen.getByText('Active enrollment')).toBeInTheDocument();expect(screen.queryByRole('button', { name: 'Enroll student' })).not.toBeInTheDocument();
  });
  it('keeps inactive assignments visible without implying reassignment', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { enrollment: { ...enrollment, status: 'inactive', teacher: { ...enrollment.teacher, isActive: false } } } });setup();
    expect(await screen.findByText('Inactive enrollment')).toBeInTheDocument();expect(screen.getByText(/remains assigned until an authorized removal/)).toBeInTheDocument();
  });
  it('explains a deleted/demoted teacher with a retained assignment', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { enrollment: { ...enrollment, status: 'inactive', teacher: null } } });setup();
    expect(await screen.findByText(/Your assigned teacher is unavailable/)).toBeInTheDocument();expect(screen.queryByText('Not enrolled with a teacher')).not.toBeInTheDocument();
  });
  it('refreshes an assignment changed in another authenticated session', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { enrollment } }).mockResolvedValue({ data: { enrollment: null } });setup();await screen.findByText('Lab Instructor');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh enrollment' }));expect(await screen.findByText('Not enrolled with a teacher')).toBeInTheDocument();expect(screen.queryByText('Lab Instructor')).not.toBeInTheDocument();
  });
  it('shows errors rather than claiming no enrollment, and supports retry', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('offline'));setup();expect(await screen.findByRole('alert')).toHaveTextContent('Request failed');expect(screen.queryByText('Not enrolled with a teacher')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));expect(await screen.findByText('Not enrolled with a teacher')).toBeInTheDocument();
  });
  it.each(['faculty', 'admin', null] as const)('never requests the student-only route for %s', role => {
    const user=useSessionStore.getState().user!;useSessionStore.setState({ user: role ? { ...user, role } : null });setup();expect(api.get).not.toHaveBeenCalled();expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });
});
