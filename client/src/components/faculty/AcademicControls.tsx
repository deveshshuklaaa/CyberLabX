import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import type { AcademicPage } from '../../services/teacherAcademics';

export function AcademicFilters({ id, onApply, statuses = false }: { id: string; onApply: (filters: { status?: string; experimentId?: string; from?: string; to?: string }) => void; statuses?: boolean }) {
  const [status, setStatus] = useState(''), [experimentId, setExperimentId] = useState(''), [from, setFrom] = useState(''), [to, setTo] = useState(''), [error, setError] = useState('');
  const apply = (event: FormEvent) => {
    event.preventDefault();
    if (experimentId && !/^[a-f\d]{24}$/i.test(experimentId.trim())) { setError('Enter an exact 24-character experiment ID.'); return; }
    if (from && to && from >= to) { setError('The end date must be after the start date.'); return; }
    setError('');
    onApply({ ...(status ? { status } : {}), ...(experimentId.trim() ? { experimentId: experimentId.trim() } : {}), ...(from ? { from: new Date(from + 'T00:00:00Z').toISOString() } : {}), ...(to ? { to: new Date(to + 'T00:00:00Z').toISOString() } : {}) });
  };
  return <form aria-label={`${id} filters`} onSubmit={apply} className="rounded-lg border border-line p-4 space-y-3">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {statuses && <div><label className="label" htmlFor={`${id}-status`}>Attempt status</label><select className="field" id={`${id}-status`} value={status} onChange={event => setStatus(event.target.value)}><option value="">All statuses</option><option value="running">In progress</option><option value="completed">Completed</option><option value="failed">Failed</option><option value="expired">Expired</option></select></div>}
      <div><label className="label" htmlFor={`${id}-experiment`}>Exact experiment ID</label><input id={`${id}-experiment`} className="field" value={experimentId} onChange={event => setExperimentId(event.target.value)} /></div>
      <div><label className="label" htmlFor={`${id}-from`}>From date (UTC)</label><input id={`${id}-from`} className="field" type="date" value={from} onChange={event => setFrom(event.target.value)} /></div>
      <div><label className="label" htmlFor={`${id}-to`}>Before date (UTC)</label><input id={`${id}-to`} className="field" type="date" value={to} onChange={event => setTo(event.target.value)} /></div>
    </div><p className="text-xs text-muted">Dates start at midnight UTC. The end date is excluded. Exact IDs filter only your authorized records; no directory search is performed.</p>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    <div className="flex flex-wrap gap-3"><button className="button-secondary text-sm">Apply filters</button><button type="button" className="button-secondary text-sm" onClick={() => { setStatus(''); setExperimentId(''); setFrom(''); setTo(''); setError(''); onApply({}); }}>Reset filters</button></div>
  </form>;
}
export function AcademicPagination({ data, page, onPage, busy }: { data: AcademicPage; page: number; onPage: (page: number) => void; busy: boolean }) {
  const pages = Math.max(1, Math.min(10000, Math.ceil(data.total / data.limit)));
  useEffect(() => { if (!busy && page > pages) onPage(pages); }, [busy, page, pages, onPage]);
  return <nav aria-label="Academic results pagination" className="flex flex-wrap gap-3 items-center"><button className="button-secondary text-sm" disabled={busy || page <= 1} onClick={() => onPage(page - 1)}>Previous results</button><p className="text-sm" role="status">Page {page} of {pages} · {data.total} records</p><button className="button-secondary text-sm" disabled={busy || page >= pages} onClick={() => onPage(page + 1)}>Next results</button></nav>;
}
