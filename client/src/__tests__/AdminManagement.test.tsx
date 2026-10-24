import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserDirectory } from '../components/admin/UserDirectory';
import { AdminAuditSearch } from '../components/admin/AdminAuditSearch';
import { AdminTeacherCohort } from '../components/admin/AdminTeacherCohort';
import { useSessionStore } from '../store/sessionStore';
import { api } from '../services/api';
import type { AdminUser } from '../services/adminManagement';
vi.mock('../services/api', () => ({ api: { get: vi.fn(), post: vi.fn(), delete: vi.fn(), patch: vi.fn() }, errorMessage: () => 'Request failed. Please try again.' }));
const adminId = '000000000000000000000001', teacherId = '000000000000000000000003', studentId = '000000000000000000000004';
const management = { writesAvailable: false, code: 'ACCOUNT_UPDATE_UNAVAILABLE', message: 'Changes unavailable' };
const teacher: AdminUser = { id: teacherId, firstName: 'Demo', lastName: 'Teacher', email: 'teacher@example.test', role: 'faculty', isActive: true, teacherId: null, enrolledAt: null, managementVersion: null, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' };
const row = { student: { id: studentId, firstName: 'Demo', lastName: 'Student', email: 'student@example.test', role: 'student', isActive: true }, enrollment: { teacherId, enrolledAt: '2026-10-01T00:00:00Z', status: 'active' } };
const pagination = { page: 1, limit: 10, total: 1 };
const event = { id: '000000000000000000000064', action: 'user.created', createdAt: '2026-10-01T00:00:00Z', actorId: adminId, resource: { type: 'User', id: studentId }, changes: [] };
let assigned: boolean;
function setup(view: 'directory' | 'audit' | 'cohort' = 'directory', inactive = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return { client, ...render(<QueryClientProvider client={client}>{view === 'directory' ? <UserDirectory /> : view === 'audit' ? <AdminAuditSearch /> : <AdminTeacherCohort adminId={adminId} teacher={{ ...teacher, isActive: !inactive }} />}</QueryClientProvider>) };
}
beforeEach(() => {
  vi.resetAllMocks(); assigned = false;
  useSessionStore.setState({ loaded: true, user: { ...teacher, id: adminId, role: 'admin' } });
  vi.mocked(api.get).mockImplementation(path => Promise.resolve({ data: path === '/admin/users' ? { users: [teacher], pagination, management } : path === `/admin/users/${teacherId}` ? { user: teacher, management } : String(path).endsWith('/students') ? { students: assigned ? [row] : [], pagination: { ...pagination, total: assigned ? 1 : 0 } } : String(path).includes('/students/') ? { ...row, progress: { attempts: 2, completedAttempts: 1, averageScore: 75, bestScore: 75 } } : { events: [event], pagination } }));
  vi.mocked(api.post).mockImplementation(async () => { assigned = true; return { data: row }; }); vi.mocked(api.delete).mockImplementation(async () => { assigned = false; return { data: undefined }; });
});
describe('Admin directory and safe account review', () => {
  it('loads supported users and filters teachers server-side', async () => {
    setup(); expect(screen.getByText('Loading user directory...')).toBeInTheDocument(); await screen.findByRole('list', { name: 'Platform users' });
    fireEvent.click(screen.getByRole('button', { name: 'List teachers' }));
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/admin/users', { params: { page: 1, limit: 10, role: 'faculty' } }));
    expect(screen.getByLabelText('Directory role')).toHaveValue('faculty');
  });
  it('combines role/status with literal name search and then exact email instead of both search modes', async () => {
    setup(); await screen.findByText('Demo Teacher'); fireEvent.change(screen.getByLabelText('Directory role'), { target: { value: 'student' } }); fireEvent.change(screen.getByLabelText('Account status filter'), { target: { value: 'false' } }); fireEvent.change(screen.getByLabelText('Directory search'), { target: { value: '.*' } }); fireEvent.click(screen.getByRole('button', { name: 'Search users' }));
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/admin/users', { params: { page: 1, limit: 10, role: 'student', isActive: 'false', q: '.*' } }));
    fireEvent.change(screen.getByLabelText('Search by'), { target: { value: 'email' } }); fireEvent.change(screen.getByLabelText('Directory search'), { target: { value: ' STUDENT@EXAMPLE.TEST ' } }); fireEvent.click(screen.getByRole('button', { name: 'Search users' }));
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/admin/users', { params: { page: 1, limit: 10, role: 'student', isActive: 'false', email: 'student@example.test' } }));
  });
  it('loads the selected account afresh, shows real status and provides an explicit teacher cohort', async () => {
    setup(); fireEvent.click(await screen.findByRole('button', { name: 'View account: Demo Teacher' }));
    await screen.findByRole('region', { name: 'Selected teacher cohort' }); expect(api.get).toHaveBeenCalledWith(`/admin/users/${teacherId}`);
    expect(api.get).toHaveBeenCalledWith(`/admin/teachers/${teacherId}/students`, { params: { page: 1, limit: 10 } });
    expect(screen.getByRole('heading', { name: 'Account detail' })).toHaveFocus(); expect(await screen.findByText('No students assigned to this teacher.')).toBeInTheDocument();
  });
  it('reviews proposed account changes in a cancellable dialog without ever issuing a blocked PATCH', async () => {
    setup(); fireEvent.click(await screen.findByRole('button', { name: 'View account: Demo Teacher' })); await screen.findByLabelText('Proposed account role');
    fireEvent.change(screen.getByLabelText('Proposed account role'), { target: { value: 'student' } }); fireEvent.click(screen.getByRole('button', { name: 'Review proposed changes' }));
    const dialog = await screen.findByRole('dialog', { name: 'Confirm account changes' }); expect(within(dialog).getByRole('button', { name: 'Apply account changes unavailable' })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel account changes' })); expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(api.patch).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Review proposed changes' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Review proposed changes' }));
    fireEvent(screen.getByRole('dialog', { name: 'Confirm account changes' }), new Event('cancel', { bubbles: false, cancelable: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review proposed changes' })).toHaveFocus();
    expect(api.patch).not.toHaveBeenCalled();
  });
  it('never enables self demotion/deactivation or account creation', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { users: [{ ...teacher, id: adminId, role: 'admin' }], pagination, management } }).mockResolvedValueOnce({ data: { user: { ...teacher, id: adminId, role: 'admin' }, management } });
    setup(); fireEvent.click(await screen.findByRole('button', { name: 'View account: Demo Teacher' })); await screen.findByLabelText('Proposed account role');
    fireEvent.change(screen.getByLabelText('Proposed account role'), { target: { value: 'student' } }); expect(screen.getByRole('button', { name: 'Review proposed changes' })).toBeDisabled();
    fireEvent.click(screen.getByText('Create a user account')); expect(screen.getByLabelText('Initial password')).toBeDisabled(); expect(screen.getByRole('button', { name: 'Review account' })).toBeDisabled(); expect(api.post).not.toHaveBeenCalled();
  });
  it.each([401, 403, 500])('shows %s as an error and retries the directory explicitly', async status => {
    vi.mocked(api.get).mockRejectedValueOnce({ isAxiosError: true, response: { status } }); setup(); await screen.findByRole('alert'); expect(screen.queryByRole('list', { name: 'Platform users' })).not.toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'Try again' })); await screen.findByText('Demo Teacher');
  });
  it('keeps missing user detail separate from list data', async () => {
    const get = vi.mocked(api.get).getMockImplementation()!; vi.mocked(api.get).mockImplementation((path, config) => path === `/admin/users/${teacherId}` ? Promise.reject({ isAxiosError: true, response: { status: 404 } }) : get(path, config));
    setup(); fireEvent.click(await screen.findByRole('button', { name: 'View account: Demo Teacher' })); expect(await screen.findByRole('alert')).toHaveTextContent('unavailable'); expect(screen.queryByLabelText('Proposed account role')).not.toBeInTheDocument();
  });
  it('handles genuine empty directory and pagination without fake user rows', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { users: [], pagination: { ...pagination, total: 0 }, management } }); setup(); await screen.findByText('No users match these filters.'); expect(screen.getByRole('button', { name: 'Next results' })).toBeDisabled();
  });
  it('requests the next user page from the backend', async () => {
    const users = Array.from({ length: 11 }, (_, n) => ({ ...teacher, id: (n + 20).toString(16).padStart(24, '0'), firstName: `Directory${n}` }));
    vi.mocked(api.get).mockImplementation((_path, config) => {
      const page = (config?.params as { page: number }).page;
      return Promise.resolve({ data: { users: users.slice((page - 1) * 10, page * 10), pagination: { ...pagination, page, total: 11 }, management } });
    });
    setup(); await screen.findByText('Page 1 of 2 · 11 records'); fireEvent.click(screen.getByRole('button', { name: 'Next results' })); await screen.findByText('Directory10 Teacher');
    expect(screen.queryByText('Directory0 Teacher')).not.toBeInTheDocument(); expect(api.get).toHaveBeenLastCalledWith('/admin/users', { params: { page: 2, limit: 10 } });
  });
  it.each(['faculty', 'student', null] as const)('does not request admin reads as %s', role => {
    useSessionStore.setState({ user: role ? { ...useSessionStore.getState().user!, role } : null }); setup(); expect(api.get).not.toHaveBeenCalled(); setup('audit'); setup('cohort'); expect(api.get).not.toHaveBeenCalled();
  });
});
describe('Admin explicit teacher-cohort management', () => {
  const enroll = async () => { await screen.findByText('No students assigned to this teacher.'); fireEvent.change(screen.getByLabelText('Existing student email'), { target: { value: ' STUDENT@EXAMPLE.TEST ' } }); fireEvent.click(screen.getByRole('button', { name: 'Enroll with selected teacher' })); };
  it('enrolls through the selected teacher route and invalidates related metrics/audits/cohorts', async () => {
    const { client } = setup('cohort'), invalidate = vi.spyOn(client, 'invalidateQueries'); await enroll(); await screen.findByText('Student enrolled with the selected teacher.');
    expect(api.post).toHaveBeenCalledWith(`/admin/teachers/${teacherId}/students`, { email: 'student@example.test' }); await screen.findByRole('button', { name: 'View cohort student: Demo Student' });
    for (const key of ['admin-dashboard', 'admin-audit', 'admin-users', 'admin-cohort', 'faculty-dashboard', 'student-enrollment', 'teacher-academics', 'teacher-analytics']) expect(invalidate).toHaveBeenCalledWith({ queryKey: [key] });
  });
  it('requires confirmation, supports cancel, then releases the selected pair and evicts detail', async () => {
    assigned = true; const { client } = setup('cohort'); fireEvent.click(await screen.findByRole('button', { name: 'View cohort student: Demo Student' })); await screen.findByText('Average recorded points'); fireEvent.click(screen.getByRole('button', { name: 'Release teacher assignment' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel assignment removal' })); expect(api.delete).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: 'Release teacher assignment' })); fireEvent.click(screen.getByRole('button', { name: 'Confirm release assignment' }));
    await screen.findByText('Assignment removed. The account and academic records are preserved.'); expect(api.delete).toHaveBeenCalledWith(`/admin/teachers/${teacherId}/students/${studentId}`); expect(client.getQueriesData({ queryKey: ['admin-student'] })).toEqual([]);
  });
  it('explains a 409 without overwriting or claiming enrollment', async () => {
    vi.mocked(api.post).mockRejectedValue({ isAxiosError: true, response: { status: 409, data: { message: 'Student is already enrolled.' } } }); setup('cohort'); await enroll(); expect(await screen.findByRole('alert')).toHaveTextContent('already enrolled'); expect(screen.queryByText('Student enrolled with the selected teacher.')).not.toBeInTheDocument();
  });
  it('leaves a failed removal visible and does not claim success', async () => {
    assigned = true; vi.mocked(api.delete).mockRejectedValue({ isAxiosError: true, response: { status: 404 } }); setup('cohort'); fireEvent.click(await screen.findByRole('button', { name: 'View cohort student: Demo Student' })); fireEvent.click(await screen.findByRole('button', { name: 'Release teacher assignment' })); fireEvent.click(screen.getByRole('button', { name: 'Confirm release assignment' })); expect(await screen.findByRole('alert')).toHaveTextContent('Removal was not confirmed');
  });
  it('does not assign students to an inactive teacher', async () => { setup('cohort', true); await screen.findByText('No students assigned to this teacher.'); expect(screen.getByRole('button', { name: 'Enroll with selected teacher' })).toBeDisabled(); expect(api.post).not.toHaveBeenCalled(); });
});
describe('Server-side admin audit search', () => {
  it('requests the stored collection independently of overview samples and displays legacy change uncertainty', async () => {
    setup('audit'); await screen.findByRole('list', { name: 'Full audit results' }); expect(api.get).toHaveBeenCalledWith('/admin/audit-events', { params: { page: 1, limit: 10 } }); expect(screen.getByText('No structured before/after changes recorded.')).toBeInTheDocument();
  });
  it('sends exact filters and UTC dates to the server, not a local recent-20 filter', async () => {
    setup('audit'); await screen.findByText('user.created'); fireEvent.change(screen.getByLabelText('Exact audit action'), { target: { value: 'user.updated' } }); fireEvent.change(screen.getByLabelText('Audit actor ID'), { target: { value: adminId } }); fireEvent.change(screen.getByLabelText('Audit resource type'), { target: { value: 'User' } }); fireEvent.change(screen.getByLabelText('Audit resource ID'), { target: { value: studentId } }); fireEvent.change(screen.getByLabelText('Audit from date (UTC)'), { target: { value: '2026-10-01' } }); fireEvent.change(screen.getByLabelText('Audit before date (UTC)'), { target: { value: '2026-10-02' } }); fireEvent.click(screen.getByRole('button', { name: 'Search audit events' }));
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/admin/audit-events', { params: { page: 1, limit: 10, action: 'user.updated', actorId: adminId, resourceType: 'User', resourceId: studentId, from: '2026-10-01T00:00:00.000Z', to: '2026-10-02T00:00:00.000Z' } }));
  });
  it('paginates more than 20 stored event fixtures and shows filtered emptiness honestly', async () => {
    const events = Array.from({ length: 27 }, (_, n) => ({ ...event, id: (n + 100).toString(16).padStart(24, '0'), action: `stored.event.${n}` }));
    vi.mocked(api.get).mockImplementation((_path, config) => { const params = config?.params as { page: number; action?: string }; const filtered = params.action ? [] : events; return Promise.resolve({ data: { events: filtered.slice((params.page - 1) * 10, params.page * 10), pagination: { ...pagination, page: params.page, total: filtered.length } } }); });
    setup('audit'); await screen.findByText('Page 1 of 3 · 27 records'); fireEvent.click(screen.getByRole('button', { name: 'Next results' })); await screen.findByText('stored.event.10'); expect(api.get).toHaveBeenLastCalledWith('/admin/audit-events', { params: { page: 2, limit: 10 } });
    fireEvent.change(screen.getByLabelText('Exact audit action'), { target: { value: 'missing.action' } }); fireEvent.click(screen.getByRole('button', { name: 'Search audit events' })); await screen.findByText('No stored audit events match these filters.');
  });
  it('validates IDs before searching', async () => { setup('audit'); await screen.findByText('user.created'); fireEvent.change(screen.getByLabelText('Audit actor ID'), { target: { value: 'bad' } }); fireEvent.click(screen.getByRole('button', { name: 'Search audit events' })); expect(await screen.findByRole('alert')).toHaveTextContent('24 hexadecimal'); expect(api.get).toHaveBeenCalledTimes(1); });
  it('separates an API failure from an empty history and recovers by explicit retry', async () => { vi.mocked(api.get).mockRejectedValueOnce(new Error('offline')); setup('audit'); await screen.findByRole('alert'); expect(screen.queryByText('No stored audit events match these filters.')).not.toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'Try again' })); await screen.findByText('user.created'); });
});
