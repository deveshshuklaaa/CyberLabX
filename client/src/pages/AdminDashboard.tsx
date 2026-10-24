import { PageHeading } from '../components/common/PageHeading';
import { LoadingState, ErrorState } from '../components/common/QueryState';
import { useQuery } from '@tanstack/react-query';
import { Activity, ShieldCheck, UserCheck, Users } from 'lucide-react';
import { api } from '../services/api';

const ICONS: Record<string, React.ReactNode> = {
  users: <Users size={20} />,
  activeStudents: <UserCheck size={20} />,
  attempts: <Activity size={20} />,
};

export function AdminDashboard() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => api.get('/admin/dashboard').then(r => r.data),
  });

  return (
    <div className="space-y-8">
      <PageHeading title="System &amp; Laboratory Administration" description="Platform metrics and recent security audit events." eyebrow="Somaiya Vidyavihar University | Platform Administration" />

      {isLoading ? (
        <LoadingState message="Loading administrative data..." />
      ) : isError || !data ? (
        <ErrorState message="Unable to load dashboard data." onRetry={() => { void refetch(); }} retrying={isFetching} />
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-3">
            {Object.entries(data.metrics).map(([key, value]) => (
              <div key={key} className="panel p-6 bg-surface border border-line shadow-xs relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-brand" />
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-brand/10 text-brand shrink-0">
                    {ICONS[key] ?? <Activity size={20} />}
                  </div>
                  <div>
                    <p className="text-2xl font-black text-ink font-sans leading-none">{String(value)}</p>
                    <p className="text-xs font-bold text-muted uppercase tracking-wider mt-1.5">
                      {key.replace(/([A-Z])/g, ' $1')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <section className="panel overflow-hidden border border-line bg-surface shadow-xs">
            <div className="border-b border-line p-5 bg-canvas/40 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-ink">
                  Recent Security &amp; Audit Events
                </h2>
                <p className="text-xs text-muted">Real-time immutable audit trail</p>
              </div>
              <span className="text-xs text-muted font-medium bg-surface px-2.5 py-1 rounded border border-line">
                Logged Sessions
              </span>
            </div>

            <div className="divide-y divide-line">
              {data.events.length ? (
                data.events.map((event: any) => (
                  <div key={event._id} className="p-4 text-xs sm:text-sm flex items-center justify-between hover:bg-canvas/40 transition">
                    <span className="font-semibold text-brand font-mono">{event.action}</span>
                    <span className="text-xs text-muted">{new Date(event.createdAt).toLocaleString()}</span>
                  </div>
                ))
              ) : (
                <p className="p-5 text-sm text-muted">No audit events recorded yet.</p>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
