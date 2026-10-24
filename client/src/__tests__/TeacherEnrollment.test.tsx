import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeacherEnrollment } from '../components/faculty/TeacherEnrollment';
import { useSessionStore } from '../store/sessionStore';
import { api } from '../services/api';
import { enrollmentKeys } from '../services/enrollment';

vi.mock('../services/api', () => ({ api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() }, errorMessage: () => 'Request failed. Please try again.' }));
const studentId = '00000000000000000000000c';
const row = { student: { id: studentId, firstName: 'Demo', lastName: 'Student', email: 'student@example.test', role: 'student' as const, isActive: true }, enrollment: { teacherId: 'teacher', status: 'active' as const, enrolledAt: '2026-10-24T10:00:00Z' } };
const progress = { attempts: 3, completedAttempts: 2, averageScore: 75, bestScore: 90 };
let assigned: boolean;
function DashboardProbe() {
  const query = useQuery({ queryKey: ['faculty-dashboard'], queryFn: () => api.get('/faculty/dashboard').then(r => r.data.metrics) });
  return <p>Dashboard cohort: {query.data?.students ?? 'loading'}</p>;
}
function setup(probe = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
  const result = render(<QueryClientProvider client={client}>{probe && <DashboardProbe />}<TeacherEnrollment /></QueryClientProvider>);
  return { ...result, client };
}
const enroll = (value = 'student@example.test') => { fireEvent.change(screen.getByLabelText('Student email address'), { target: { value } }); fireEvent.click(screen.getByRole('button', { name: 'Enroll student' })); };
beforeEach(() => {
  vi.resetAllMocks(); assigned = false;
  useSessionStore.setState({ loaded: true, user: { id: 'teacher', firstName: 'Test', lastName: 'Teacher', email: 'teacher@example.test', role: 'faculty', isActive: true } });
  vi.mocked(api.get).mockImplementation(path => Promise.resolve({ data: path === '/teacher/students' ? { students: assigned ? [row] : [], pagination: { page: 1, limit: 10, total: assigned ? 1 : 0 } } : String(path).endsWith('/attempts') ? { attempts: [], pagination: { page: 1, limit: 10, total: 0 } } : path === '/faculty/dashboard' ? { metrics: { students: assigned ? 1 : 0 } } : { ...row, progress } }));
  vi.mocked(api.post).mockImplementation(async () => { assigned = true; return { data: row }; });
  vi.mocked(api.delete).mockImplementation(async () => { assigned = false; return { data: undefined }; });
});

describe('Teacher enrollment', () => {
  it('loads a genuine empty cohort with disabled pagination', async () => {
    setup(); expect(screen.getByText('Loading enrolled students...')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'No enrolled students' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled(); expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
    expect(api.get).toHaveBeenCalledWith('/teacher/students', { params: { page: 1, limit: 10 } });
  });
  it('enrolls by normalized exact email and refreshes the active list and dashboard', async () => {
    const { client } = setup(true); await screen.findByText('Dashboard cohort: 0');
    const invalidate = vi.spyOn(client, 'invalidateQueries'); enroll(' Student@EXAMPLE.test ');
    expect(await screen.findByText('Student enrolled successfully.')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'View student: Demo Student' })).toBeInTheDocument();
    expect(await screen.findByText('Dashboard cohort: 1')).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledExactlyOnceWith('/teacher/students', { email: 'student@example.test' });
    expect(screen.getByLabelText('Student email address')).toHaveValue('');
    for (const queryKey of [enrollmentKeys.lists, enrollmentKeys.details, ['faculty-dashboard'], ['student-enrollment'], ['teacher-academics'], ['teacher-analytics']]) expect(invalidate).toHaveBeenCalledWith({ queryKey });
  });
  it('uses only studentId after switching identifier modes', async () => {
    setup(); await screen.findByText('No enrolled students');
    fireEvent.change(screen.getByLabelText('Student email address'), { target: { value: 'old@example.test' } });
    fireEvent.change(screen.getByLabelText('Identify student by'), { target: { value: 'studentId' } });
    expect(screen.getByLabelText('Student ID')).toHaveValue('');
    fireEvent.change(screen.getByLabelText('Student ID'), { target: { value: studentId } });fireEvent.click(screen.getByRole('button', { name: 'Enroll student' }));
    await screen.findByText('Student enrolled successfully.');expect(api.post).toHaveBeenCalledExactlyOnceWith('/teacher/students', { studentId });
  });
  it('validates missing/invalid selectors without a write', async () => {
    setup(); enroll('not-an-email');expect(await screen.findByRole('alert')).toHaveTextContent('exact email');
    fireEvent.change(screen.getByLabelText('Identify student by'), { target: { value: 'studentId' } });
    fireEvent.change(screen.getByLabelText('Student ID'), { target: { value: 'invalid' } });fireEvent.click(screen.getByRole('button', { name: 'Enroll student' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('24 hexadecimal');expect(api.post).not.toHaveBeenCalled();
  });
  it('explains a 409 without inventing success or automatic retry', async () => {
    vi.mocked(api.post).mockRejectedValue({ isAxiosError: true, response: { status: 409, data: { message: 'Student is already enrolled.' } } });
    setup(); enroll();expect(await screen.findByRole('alert')).toHaveTextContent('already enrolled');expect(screen.queryByText('Student enrolled successfully.')).not.toBeInTheDocument();
    expect(api.post).toHaveBeenCalledTimes(1);expect(screen.getByLabelText('Student email address')).toHaveValue('student@example.test');
  });
  it('shows owned student detail and real aggregate scores without report links', async () => {
    assigned = true; setup();fireEvent.click(await screen.findByRole('button', { name: 'View student: Demo Student' }));
    const detail = within(screen.getByRole('region', { name: 'Student detail' }));
    expect(await detail.findByText('75')).toBeInTheDocument();expect(detail.getByText('90')).toBeInTheDocument();expect(detail.getByText('3')).toBeInTheDocument();expect(detail.getByText('2')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith(`/teacher/students/${studentId}`);expect(detail.queryByRole('link')).not.toBeInTheDocument();
  });
  it('requires confirmation, supports cancel, removes assignment and evicts cached detail', async () => {
    assigned = true; const { client } = setup(true); await screen.findByText('Dashboard cohort: 1');fireEvent.click(await screen.findByRole('button', { name: 'View student: Demo Student' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Remove enrollment' }));expect(screen.getByRole('heading', { name: 'Confirm unenrollment' })).toHaveFocus();
    expect(screen.getByText(/Their account, attempts and reports will be preserved/)).toBeInTheDocument();expect(api.delete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel removal' }));expect(screen.queryByRole('button', { name: 'Confirm remove enrollment' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove enrollment' }));fireEvent.click(screen.getByRole('button', { name: 'Confirm remove enrollment' }));
    expect(await screen.findByText('Enrollment removed. The student’s account and academic records are preserved.')).toBeInTheDocument();
    expect(await screen.findByText('Dashboard cohort: 0')).toBeInTheDocument();expect(await screen.findByText('No enrolled students')).toBeInTheDocument();
    expect(api.delete).toHaveBeenCalledExactlyOnceWith(`/teacher/students/${studentId}`);expect(screen.queryByRole('region', { name: 'Student detail' })).not.toBeInTheDocument();
    expect(client.getQueryData(enrollmentKeys.detail('teacher', studentId))).toBeUndefined();
    expect(client.getQueriesData({ queryKey: ['teacher-academics', 'teacher', studentId] })).toEqual([]);
  });
  it('keeps an unsuccessful removal visible instead of claiming deletion', async () => {
    assigned = true; vi.mocked(api.delete).mockRejectedValue(new Error('offline'));setup();fireEvent.click(await screen.findByRole('button', { name: 'View student: Demo Student' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Remove enrollment' }));fireEvent.click(screen.getByRole('button', { name: 'Confirm remove enrollment' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Removal was not confirmed');expect(screen.getByRole('region', { name: 'Student detail' })).toBeInTheDocument();
  });
  it('hides progress and removal actions when detail ownership is no longer available', async () => {
    assigned = true;
    const get = vi.mocked(api.get).getMockImplementation()!;
    vi.mocked(api.get).mockImplementation((path, config) => path === `/teacher/students/${studentId}` ? Promise.reject({ isAxiosError: true, response: { status: 404 } }) : get(path, config));
    setup();fireEvent.click(await screen.findByRole('button', { name: 'View student: Demo Student' }));
    const detail = within(screen.getByRole('region', { name: 'Student detail' }));
    expect(await detail.findByRole('alert')).toHaveTextContent('unavailable');expect(detail.queryByText('75')).not.toBeInTheDocument();expect(detail.queryByRole('button', { name: 'Remove enrollment' })).not.toBeInTheDocument();
  });
  it('uses server pagination without inventing a search endpoint', async () => {
    vi.mocked(api.get).mockImplementation((_path, config) => {
      const page = (config?.params as { page: number }).page;
      return Promise.resolve({ data: { students: [{ ...row, student: { ...row.student, firstName: page === 2 ? 'Second' : 'First' } }], pagination: { page, limit: 10, total: 11 } } });
    });
    setup();await screen.findByRole('button', { name: 'View student: First Student' });fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(await screen.findByRole('button', { name: 'View student: Second Student' })).toBeInTheDocument();expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    expect(api.get).toHaveBeenLastCalledWith('/teacher/students', { params: { page: 2, limit: 10 } });
  });
  it.each([401, 403, 404])('shows a real %s failure instead of an empty cohort', async status => {
    vi.mocked(api.get).mockRejectedValue({ isAxiosError: true, response: { status } });setup();
    expect(await screen.findByRole('alert')).toHaveTextContent(status === 401 ? 'Sign in again' : status === 403 ? 'permission' : 'unavailable');expect(screen.queryByText('No enrolled students')).not.toBeInTheDocument();
  });
  it('retries failed list reads only when requested', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('offline'));setup();await screen.findByRole('alert');expect(api.get).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));expect(await screen.findByText('No enrolled students')).toBeInTheDocument();
  });
  it.each(['admin', 'student', null] as const)('does not render or fetch faculty endpoints for %s', async role => {
    const user = useSessionStore.getState().user!;useSessionStore.setState({ user: role ? { ...user, role } : null });setup();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();expect(api.get).not.toHaveBeenCalled();expect(api.post).not.toHaveBeenCalled();
  });
  it('disables the enrollment form during a pending write', async () => {
    let finish!: (value: { data: typeof row }) => void;
    vi.mocked(api.post).mockImplementation(() => new Promise(resolve => { finish = resolve; }));setup();enroll();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Enrolling...' })).toBeDisabled());expect(screen.getByLabelText('Identify student by')).toBeDisabled();
    finish({ data: row });await screen.findByText('Student enrolled successfully.');
  });
});
