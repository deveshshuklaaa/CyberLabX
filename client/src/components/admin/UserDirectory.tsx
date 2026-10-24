import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useSessionStore } from '../../store/sessionStore';
import { useAdminUser, useAdminUsers, adminError, blockedAccountMessage } from '../../services/adminManagement';
import type { AdminUser, UserFilters } from '../../services/adminManagement';
import type { Role } from '../../types/api';
import { LoadingState, ErrorState } from '../common/QueryState';
import { AcademicPagination } from '../faculty/AcademicControls';
import { enrollmentDate } from '../../services/enrollment';
import { CreateUserForm } from './CreateUserForm';
import { AdminTeacherCohort } from './AdminTeacherCohort';
import { ConfirmDialog } from '../common/ConfirmDialog';

export function UserDirectory() {
  const user = useSessionStore(state => state.user);
  return user?.role === 'admin' ? <Directory key={user.id} adminId={user.id} /> : null;
}
function Directory({ adminId }: { adminId: string }) {
  const [filters, setFilters] = useState<UserFilters>({ page: 1, limit: 10 });
  const [role, setRole] = useState(''), [active, setActive] = useState(''), [searchBy, setSearchBy] = useState('q'), [search, setSearch] = useState(''), [error, setError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const query = useAdminUsers(adminId, filters);
  const heading = useRef<HTMLHeadingElement>(null);
  const apply = (event: FormEvent) => {
    event.preventDefault(); const value = search.trim();
    if (value && (searchBy === 'email' ? !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || value.length > 254 : value.length > 80)) { setError(searchBy === 'email' ? 'Enter a valid exact email address.' : 'Use at most 80 characters for name search.'); return; }
    setError(''); setSelected(null); setFilters({ page: 1, limit: 10, ...(role ? { role: role as Role } : {}), ...(active ? { isActive: active } : {}), ...(value ? { [searchBy]: searchBy === 'email' ? value.toLowerCase() : value } : {}) });
  };
  return <div className="space-y-5">
    <form aria-label="User directory filters" className="rounded-lg border border-line p-4 space-y-4" onSubmit={apply}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div><label className="label" htmlFor="directory-role">Directory role</label><select className="field" id="directory-role" value={role} onChange={e => setRole(e.target.value)}><option value="">All roles</option><option value="student">Student</option><option value="faculty">Teacher (faculty)</option><option value="admin">Administrator</option></select></div>
        <div><label className="label" htmlFor="directory-active">Account status filter</label><select className="field" id="directory-active" value={active} onChange={e => setActive(e.target.value)}><option value="">All statuses</option><option value="true">Active</option><option value="false">Inactive</option></select></div>
        <div><label className="label" htmlFor="directory-search-by">Search by</label><select className="field" id="directory-search-by" value={searchBy} onChange={e => { setSearchBy(e.target.value); setSearch(''); }}><option value="q">Name contains</option><option value="email">Exact email</option></select></div>
        <div><label className="label" htmlFor="directory-search">Directory search</label><input className="field" id="directory-search" value={search} onChange={e => setSearch(e.target.value)} maxLength={searchBy === 'email' ? 254 : 80} /></div>
      </div><p className="text-xs text-muted">Name search matches first or last names literally. Email search requires an exact address. Apply filters to search the full server directory.</p>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap gap-3"><button className="button-secondary">Search users</button><button type="button" className="button-secondary" onClick={() => { setRole(''); setActive(''); setSearch(''); setError(''); setSelected(null); setFilters({ page: 1, limit: 10 }); }}>Reset directory filters</button></div>
    </form>
    <div className="flex flex-wrap gap-3 justify-between"><h3 ref={heading} tabIndex={-1} className="font-bold">Platform user directory</h3><div className="flex flex-wrap gap-3"><button className="button-secondary" onClick={() => { setRole('faculty'); setActive(''); setSearch(''); setSelected(null); setFilters({ page: 1, limit: 10, role: 'faculty' }); }}>List teachers</button><button className="button-secondary" disabled={query.isFetching} onClick={() => { setSelected(null); void query.refetch(); }}>Refresh directory</button></div></div>
    {query.isPending ? <LoadingState message="Loading user directory..." /> : query.isError ? <ErrorState message={adminError(query.error)} onRetry={() => { void query.refetch(); }} retrying={query.isFetching} /> : <>
      <p className="state-panel text-sm">{blockedAccountMessage}</p>
      {!query.data.users.length ? <p className="state-panel">No users match these filters.</p> : <ul aria-label="Platform users" className="grid gap-4 md:grid-cols-2">{query.data.users.map(user => <li key={user.id} className="rounded-lg border border-line p-4 space-y-3 min-w-0"><h4 className="font-bold break-words">{user.firstName} {user.lastName}</h4><p className="text-sm break-all">{user.email}</p><div className="flex flex-wrap gap-2"><span className="status-badge status-neutral">{user.role === 'faculty' ? 'Teacher (faculty)' : user.role}</span><span className={`status-badge ${user.isActive ? 'status-success' : 'status-neutral'}`}>{user.isActive ? 'Active account' : 'Inactive account'}</span></div><p className="text-xs break-all">Account ID: {user.id}</p><button className="button-secondary text-sm" aria-expanded={selected === user.id} aria-controls="admin-user-detail" onClick={() => setSelected(user.id)}>View account: {user.firstName} {user.lastName}</button></li>)}</ul>}
      <AcademicPagination data={query.data.pagination} page={filters.page} busy={query.isFetching} onPage={page => { setSelected(null); setFilters({ ...filters, page }); }} />
    </>}
    {selected && !query.isError && <UserDetail key={selected} adminId={adminId} userId={selected} onClose={() => { setSelected(null); heading.current?.focus(); }} />}
    <details className="rounded-lg border border-line p-4"><summary className="font-semibold cursor-pointer">Create a user account</summary><div className="mt-4"><CreateUserForm blockedReason={blockedAccountMessage} onCreated={() => {}} /></div></details>
  </div>;
}
function UserDetail({ adminId, userId, onClose }: { adminId: string; userId: string; onClose: () => void }) {
  const query = useAdminUser(adminId, userId), heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  return <section id="admin-user-detail" aria-labelledby="admin-account-heading" className="rounded-lg border border-brand/30 p-4 sm:p-5 space-y-5">
    <div className="flex flex-wrap gap-3 justify-between"><h3 ref={heading} tabIndex={-1} id="admin-account-heading" className="font-bold text-lg">Account detail</h3><button className="button-secondary" onClick={onClose}>Close account detail</button></div>
    {query.isPending ? <LoadingState message="Loading selected account..." /> : query.isError ? <ErrorState message={adminError(query.error)} onRetry={() => { void query.refetch(); }} retrying={query.isFetching} /> : <>
      <dl className="grid gap-4 sm:grid-cols-2 text-sm">{[['Name', `${query.data.user.firstName} ${query.data.user.lastName}`], ['Email', query.data.user.email], ['Current role', query.data.user.role], ['Account status', query.data.user.isActive ? 'Active' : 'Inactive'], ['Account ID', query.data.user.id], ['Assigned teacher ID', query.data.user.teacherId ?? 'Unassigned'], ['Enrolled', enrollmentDate(query.data.user.enrolledAt)], ['Created', enrollmentDate(query.data.user.createdAt)], ['Updated', enrollmentDate(query.data.user.updatedAt)]].map(([label, value]) => <div key={label}><dt className="text-muted">{label}</dt><dd className="break-all">{value}</dd></div>)}</dl>
      <AccountReview key={query.data.user.updatedAt} user={query.data.user} adminId={adminId} />
      {query.data.user.role === 'faculty' && <AdminTeacherCohort adminId={adminId} teacher={query.data.user} />}
    </>}
  </section>;
}
function AccountReview({ user, adminId }: { user: AdminUser; adminId: string }) {
  const [role, setRole] = useState<Role>(user.role), [active, setActive] = useState(user.isActive), [review, setReview] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (review) heading.current?.focus(); }, [review]);
  return <section aria-label="Account change review" className="rounded-lg border border-line p-4 space-y-4">
    <h4 className="font-bold">Review role and status changes</h4><p className="text-sm text-muted">{blockedAccountMessage} Draft selections below do not change the account.</p>
    {user.id === adminId && <p className="text-sm text-danger">You cannot demote or deactivate your own administrator account.</p>}
    {review ? <ConfirmDialog label="Confirm account changes" onCancel={() => setReview(false)}><div className="space-y-3"><h5 ref={heading} tabIndex={-1} className="font-bold">Review selected account</h5><p className="text-sm break-all">Account: {user.id}</p><p className="text-sm">Role: {user.role} → {role}. Status: {user.isActive ? 'Active' : 'Inactive'} → {active ? 'Active' : 'Inactive'}.</p><p className="text-sm text-muted">No change has been submitted. Account updates are unavailable.</p><div className="flex flex-wrap gap-3"><button className="button" disabled>Apply account changes unavailable</button><button className="button-secondary" onClick={() => setReview(false)}>Cancel account changes</button></div></div></ConfirmDialog> : <>
      <div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="account-draft-role" className="label">Proposed account role</label><select id="account-draft-role" className="field" value={role} onChange={e => setRole(e.target.value as Role)}><option value="student">Student</option><option value="faculty">Teacher (faculty)</option><option value="admin">Administrator</option></select></div><div><label htmlFor="account-draft-active" className="label">Proposed account status</label><select id="account-draft-active" className="field" value={String(active)} onChange={e => setActive(e.target.value === 'true')}><option value="true">Active</option><option value="false">Inactive</option></select></div></div>
      <p className="text-xs text-muted">Students promoted to another role must lose only their assignment, retaining academic records. Inactive students/teachers retain assignments. Teacher role removal requires explicit cohort releases. These guarded updates remain unavailable.</p>
      <button className="button-secondary" disabled={role === user.role && active === user.isActive || user.id === adminId && (role !== 'admin' || !active)} onClick={() => setReview(true)}>Review proposed changes</button>
    </>}
  </section>;
}
