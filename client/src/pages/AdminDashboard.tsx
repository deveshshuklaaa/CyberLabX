import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

export function AdminDashboard() {
  const { data, isLoading } = useQuery({ queryKey: ['admin-dashboard'], queryFn: () => api.get('/admin/dashboard').then(r => r.data) });
  return <section><p className="text-sm font-semibold tracking-wide text-brand">ADMIN DASHBOARD</p><h1 className="mt-1 text-3xl font-bold text-ink">System administration</h1>{isLoading ? <p className="mt-6 text-muted">Loading system data…</p> : <><div className="mt-8 grid gap-5 sm:grid-cols-3">{Object.entries(data.metrics).map(([key, value]) => <div className="panel border-t-4 border-t-brand p-5" key={key}><p className="text-3xl font-bold text-ink">{String(value)}</p><p className="mt-1 capitalize text-muted">{key.replace(/([A-Z])/g, ' $1')}</p></div>)}</div><section className="panel mt-7 overflow-hidden"><h2 className="border-b border-line p-5 font-semibold text-ink">Recent audit events</h2><div className="divide-y divide-line">{data.events.length ? data.events.map((event: any) => <div key={event._id} className="p-4 text-sm"><span className="font-medium text-brand">{event.action}</span><span className="ml-3 text-muted">{new Date(event.createdAt).toLocaleString()}</span></div>) : <p className="p-5 text-sm text-muted">No audit events recorded yet.</p>}</div></section></>}</section>;
}
