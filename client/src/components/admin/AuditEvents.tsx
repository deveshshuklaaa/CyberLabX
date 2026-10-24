import { useState } from 'react';
import { attemptDate } from '../../services/studentHistory';

export interface AuditEvent { _id: string; action: string; createdAt: string; userId?: string; resourceType?: string; resourceId?: string; }
export function AuditEvents({ events }: { events: AuditEvent[] }) {
  const [action, setAction] = useState('');
  const [search, setSearch] = useState('');
  const actions = [...new Set(events.map(event => event.action))].sort();
  const filtered = events.filter(event => (!action || event.action === action) && [event.action, event.userId, event.resourceType, event.resourceId].some(value => value?.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())));
  return <div className="space-y-4">
    <p className="text-sm text-muted">Latest 20 events returned by the server, newest first. Filters apply only to this snapshot; this is not a live stream or full audit search.</p>
    {events.length > 0 && <div className="grid gap-4 sm:grid-cols-2"><div><label className="label" htmlFor="audit-action">Event action</label><select id="audit-action" className="field" value={action} onChange={event => setAction(event.target.value)}><option value="">All actions</option>{actions.map(value => <option key={value} value={value}>{value}</option>)}</select></div><div><label className="label" htmlFor="audit-search">Search recent events</label><input id="audit-search" type="search" className="field" value={search} onChange={event => setSearch(event.target.value)} placeholder="Action, actor ID or resource" /></div></div>}
    {!events.length ? <div className="state-panel"><h3 className="font-bold">No audit events recorded yet</h3><p className="page-description mx-auto">Refresh the overview after platform activity to check for new events.</p></div> : <>
      <p role="status" className="text-xs text-muted">{filtered.length} of {events.length} recent events</p>
      {!filtered.length ? <div className="state-panel"><p>No matching recent events.</p><button className="button-secondary mt-3" onClick={() => { setAction(''); setSearch(''); }}>Clear audit filters</button></div>
        : <ol className="space-y-3" aria-label="Recent audit records">{filtered.map(event => <li key={event._id} className="border border-line rounded-lg p-4 space-y-3"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-mono font-semibold text-sm text-brand break-all">{event.action}</h3><p className="text-xs text-muted">{attemptDate(event.createdAt)}</p></div><dl className="grid gap-3 sm:grid-cols-2 text-xs"><div><dt className="text-muted">Actor ID</dt><dd className="font-mono break-all">{event.userId || 'Not recorded'}</dd></div><div><dt className="text-muted">Resource</dt><dd className="break-all">{event.resourceType || 'Not recorded'}{event.resourceId ? ` | ${event.resourceId}` : ''}</dd></div></dl></li>)}</ol>}
    </>}
  </div>;
}
