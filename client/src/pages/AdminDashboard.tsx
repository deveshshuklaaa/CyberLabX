import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, UserCheck, Users } from 'lucide-react';
import { api } from '../services/api';
import { PageHeading } from '../components/common/PageHeading';
import { LoadingState, ErrorState } from '../components/common/QueryState';
import { MetricCard } from '../components/common/MetricCard';
import { PendingIntegration } from '../components/common/PendingIntegration';
import { AuditEvents } from '../components/admin/AuditEvents';
import type { AuditEvent } from '../components/admin/AuditEvents';
import { CreateUserForm } from '../components/admin/CreateUserForm';
import { AdminExperiments } from '../components/admin/AdminExperiments';

interface AdminData { metrics: { users: number; activeStudents: number; attempts: number }; events: AuditEvent[]; }
export function AdminDashboard() {
  const queryClient = useQueryClient();
  const dashboard = useQuery({ queryKey: ['admin-dashboard'], queryFn: async () => {
    const { data } = await api.get<AdminData>('/admin/dashboard');
    if (!data?.metrics || !['users', 'activeStudents', 'attempts'].every(key => {
      const value = data.metrics[key as keyof AdminData['metrics']];
      return typeof value === 'number' && Number.isFinite(value) && value >= 0;
    }) || !Array.isArray(data.events)) throw new Error('Invalid admin overview response.');
    return data;
  } });
  return <div className="space-y-8">
    <PageHeading title="Platform Administration" eyebrow="Somaiya Virtual Labs | Admin Portal" description="Review account totals, laboratory activity and recent audit records. Manage supported account creation from this admin workspace." actions={<button className="button-secondary" disabled={dashboard.isFetching} onClick={() => { void dashboard.refetch(); }}>{dashboard.isFetching ? 'Refreshing...' : 'Refresh overview'}</button>} />
    <nav aria-label="Admin overview sections" className="flex flex-wrap gap-2"><a className="button-secondary text-sm" href="#admin-summary">Overview</a><a className="button-secondary text-sm" href="#admin-users">Users</a><a className="button-secondary text-sm" href="#admin-experiments">Experiments</a><a className="button-secondary text-sm" href="#admin-audit">Audit events</a></nav>
    <section id="admin-summary" aria-label="Administrative statistics" className="space-y-4 scroll-mt-6">
      {dashboard.isPending ? <LoadingState message="Loading administrative data..." /> : dashboard.isError || !dashboard.data ? <ErrorState message="Unable to load dashboard data." onRetry={() => { void dashboard.refetch(); }} retrying={dashboard.isFetching} /> : <>
        <div className="grid gap-4 sm:grid-cols-3"><MetricCard label="Total users" value={dashboard.data.metrics.users} description="All account records across platform roles." icon={<Users size={22} />} /><MetricCard label="Active students" value={dashboard.data.metrics.activeStudents} description="Active accounts with the student role." icon={<UserCheck size={22} />} /><MetricCard label="Total attempts" value={dashboard.data.metrics.attempts} description="All recorded attempts, across completion states." icon={<Activity size={22} />} /></div>
        <p className="text-xs text-muted">Last fetched: {new Date(dashboard.dataUpdatedAt).toLocaleString()}. Refresh to request updated totals and audit records.</p>
      </>}
    </section>
    <section id="admin-audit" aria-labelledby="admin-audit-heading" className="panel p-5 sm:p-6 space-y-4 scroll-mt-6"><h2 id="admin-audit-heading" className="text-xl font-bold">Recent audit events</h2>
      {dashboard.isPending ? <p className="text-sm text-muted">Audit records are loading with the overview.</p> : dashboard.isError || !dashboard.data ? <p className="text-sm text-muted">Audit records are unavailable. Retry the overview request above.</p> : <AuditEvents events={dashboard.data.events} />}
    </section>
    <section id="admin-users" aria-labelledby="admin-users-heading" className="panel p-5 sm:p-6 space-y-5 scroll-mt-6"><h2 id="admin-users-heading" className="text-xl font-bold">User management</h2>
      <PendingIntegration title="User directory and updates unavailable" description="No user listing or lookup API is available. Existing users cannot yet be selected reliably for role or active-status updates." />
      <details className="rounded-lg border border-line p-4"><summary className="font-semibold cursor-pointer">Create a user account</summary><div className="mt-4"><CreateUserForm onCreated={() => { void queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] }); void queryClient.invalidateQueries({ queryKey: ['faculty-dashboard'] }); }} /></div></details>
      <PendingIntegration title="Teacher management pending" description="Teacher accounts can be created using the faculty role. Existing teacher listing, assignments and cohort management need additional APIs." />
    </section>
    <AdminExperiments />
  </div>;
}
