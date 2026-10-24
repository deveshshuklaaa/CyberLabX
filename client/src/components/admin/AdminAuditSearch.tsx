import { useState } from 'react';
import type { FormEvent } from 'react';
import { useSessionStore } from '../../store/sessionStore';
import { adminError, useAdminAudit } from '../../services/adminManagement';
import type { AuditFilters } from '../../services/adminManagement';
import { enrollmentDate } from '../../services/enrollment';
import { LoadingState, ErrorState } from '../common/QueryState';
import { AcademicPagination } from '../faculty/AcademicControls';

export function AdminAuditSearch() {
  const user = useSessionStore(state => state.user);
  return user?.role === 'admin' ? <Search key={user.id} adminId={user.id} /> : null;
}
function Search({ adminId }: { adminId: string }) {
  const [filters, setFilters] = useState<AuditFilters>({ page: 1, limit: 10 });
  const [draft, setDraft] = useState({ action: '', actorId: '', resourceType: '', resourceId: '', from: '', to: '' }), [error, setError] = useState('');
  const query = useAdminAudit(adminId, filters);
  const apply = (event: FormEvent) => {
    event.preventDefault();
    if ([draft.actorId, draft.resourceId].some(value => value.trim() && !/^[a-f\d]{24}$/i.test(value.trim()))) { setError('Actor and resource IDs must contain 24 hexadecimal characters.'); return; }
    if (draft.from && draft.to && draft.from >= draft.to) { setError('The end date must be after the start date.'); return; }
    setError(''); setFilters({ page: 1, limit: 10, ...(draft.action.trim() ? { action: draft.action.trim() } : {}), ...(draft.actorId.trim() ? { actorId: draft.actorId.trim() } : {}), ...(draft.resourceType ? { resourceType: draft.resourceType } : {}), ...(draft.resourceId.trim() ? { resourceId: draft.resourceId.trim() } : {}), ...(draft.from ? { from: draft.from + 'T00:00:00.000Z' } : {}), ...(draft.to ? { to: draft.to + 'T00:00:00.000Z' } : {}) });
  };
  return <div className="space-y-4"><p className="text-sm text-muted">Search the complete stored audit collection on the server. Results are newest first, with ID tie ordering. Pagination totals describe the filtered collection, independently of the latest-20 overview sample.</p>
    <form aria-label="Full audit search filters" onSubmit={apply} className="rounded-lg border border-line p-4 space-y-4"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {([['action', 'Exact audit action'], ['actorId', 'Audit actor ID'], ['resourceId', 'Audit resource ID'], ['from', 'Audit from date (UTC)'], ['to', 'Audit before date (UTC)']] as const).map(([key, label]) => <div key={key}><label className="label" htmlFor={`full-audit-${key}`}>{label}</label><input id={`full-audit-${key}`} className="field" type={key === 'from' || key === 'to' ? 'date' : 'text'} maxLength={key === 'action' ? 80 : undefined} value={draft[key]} onChange={e => setDraft({ ...draft, [key]: e.target.value })} /></div>)}
      <div><label className="label" htmlFor="full-audit-type">Audit resource type</label><select id="full-audit-type" className="field" value={draft.resourceType} onChange={e => setDraft({ ...draft, resourceType: e.target.value })}><option value="">All resource types</option><option value="User">User</option><option value="Experiment">Experiment</option></select></div>
    </div><p className="text-xs text-muted">Date bounds start at midnight UTC; the end date is excluded. No private metadata search is performed.</p>{error && <p role="alert" className="text-sm text-danger">{error}</p>}<div className="flex flex-wrap gap-3"><button className="button-secondary">Search audit events</button><button type="button" className="button-secondary" onClick={() => { setDraft({ action: '', actorId: '', resourceType: '', resourceId: '', from: '', to: '' }); setError(''); setFilters({ page: 1, limit: 10 }); }}>Reset full audit filters</button></div></form>
    <button className="button-secondary" disabled={query.isFetching} onClick={() => { void query.refetch(); }}>Refresh full audit</button>
    {query.isPending ? <LoadingState message="Loading audit search..." /> : query.isError ? <ErrorState message={adminError(query.error)} onRetry={() => { void query.refetch(); }} retrying={query.isFetching} /> : <>
      {!query.data.events.length ? <p className="state-panel">No stored audit events match these filters.</p> : <ol aria-label="Full audit results" className="space-y-3">{query.data.events.map(event => <li key={event.id} className="rounded-lg border border-line p-4 space-y-3"><h3 className="font-semibold text-sm break-all">{event.action}</h3><p className="text-xs text-muted">{enrollmentDate(event.createdAt)}</p><dl className="grid gap-3 sm:grid-cols-2 text-xs">{[['Event ID', event.id], ['Audit actor', event.actorId ?? 'Not recorded'], ['Resource type', event.resource.type ?? 'Not recorded'], ['Resource ID', event.resource.id ?? 'Not recorded']].map(([label, value]) => <div key={label}><dt className="text-muted">{label}</dt><dd className="break-all">{value}</dd></div>)}</dl>{event.changes.length ? <ul className="text-sm space-y-1" aria-label="Recorded changes">{event.changes.map(change => <li key={change.field}>{change.field}: {String(change.before ?? 'Not recorded')} → {String(change.after ?? 'Not recorded')}</li>)}</ul> : <p className="text-xs text-muted">No structured before/after changes recorded.</p>}</li>)}</ol>}
      <AcademicPagination data={query.data.pagination} page={filters.page} busy={query.isFetching} onPage={page => setFilters({ ...filters, page })} />
    </>}
  </div>;
}
