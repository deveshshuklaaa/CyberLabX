import { scoreText, recordedPoints } from '../services/studentScores';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeading } from '../components/common/PageHeading';
import { LoadingState, ErrorState } from '../components/common/QueryState';
import { AttemptStatus } from '../components/common/AttemptStatus';
import { ReportLink } from '../components/common/ReportLink';
import { attemptDate, useStudentHistory } from '../services/studentHistory';

export function StudentHistory() {
  const history = useStudentHistory();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const attempts = history.data?.attempts ?? [];
  const filtered = attempts.filter(attempt => (!status || attempt.status === status)
    && (attempt.experimentTitle || 'Experiment unavailable').toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
    .sort((a, b) => sort === 'score' ? (recordedPoints(b.status, b.score) ?? -Infinity) - (recordedPoints(a.status, a.score) ?? -Infinity) || Date.parse(b.startedAt) - Date.parse(a.startedAt)
      : (Date.parse(a.startedAt) - Date.parse(b.startedAt)) * (sort === 'oldest' ? 1 : -1));
  const reset = () => { setStatus(''); setSearch(''); setSort('newest'); };
  return <div className="space-y-6">
    <PageHeading title="Attempt History" eyebrow="Somaiya Virtual Labs" description="Review your recorded attempts, dates and scores. Reports appear only when the server confirms they are available." actions={<Link to="/experiments" className="button">Browse experiments</Link>} />
    <div className="panel p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div><label htmlFor="history-search" className="label">Search experiments</label><input id="history-search" type="search" className="field" value={search} onChange={event => setSearch(event.target.value)} /></div>
      <div><label htmlFor="history-status" className="label">Attempt status</label><select id="history-status" className="field" value={status} onChange={event => setStatus(event.target.value)}><option value="">All statuses</option><option value="completed">Completed</option><option value="running">In progress</option><option value="expired">Expired</option><option value="failed">Failed</option></select></div>
      <div><label htmlFor="history-sort" className="label">Sort attempts</label><select id="history-sort" className="field" value={sort} onChange={event => setSort(event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="score">Highest recorded points first</option></select></div>
    </div>
    {history.isPending ? <LoadingState message="Loading attempt history..." /> : history.isError ? <ErrorState message="Unable to load attempt history." onRetry={() => { void history.refetch(); }} retrying={history.isFetching} /> : <>
      <p role="status" className="text-sm text-muted">{filtered.length} of {attempts.length} attempts</p>
      {!attempts.length ? <div className="state-panel"><h2 className="font-bold">No attempts yet</h2><p className="page-description mx-auto">Start a practical to build your learning record.</p><Link to="/experiments" className="button mt-4">Explore experiments</Link></div>
        : !filtered.length ? <div className="state-panel"><h2 className="font-bold">No matching attempts</h2><button className="button-secondary mt-4" onClick={reset}>Clear filters</button></div>
        : <section aria-label="Recorded attempts" className="space-y-4">{filtered.map(attempt => <article key={attempt.attemptId} className="panel p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="eyebrow">{attempt.experimentCategory || 'Uncategorized'}</p><h2 className="text-lg font-bold">{attempt.experimentTitle || 'Experiment unavailable'}</h2><p className="text-xs text-muted break-all mt-1">Attempt {attempt.attemptId}</p></div><AttemptStatus status={attempt.status} /></div>
          <dl className="grid gap-4 sm:grid-cols-3 text-sm"><div><dt className="text-muted">Score</dt><dd className="font-bold">{scoreText(attempt.status, attempt.score, attempt.assessmentScore)}</dd></div><div><dt className="text-muted">Started</dt><dd>{attemptDate(attempt.startedAt)}</dd></div><div><dt className="text-muted">Completed</dt><dd>{attemptDate(attempt.completedAt)}</dd></div></dl>
          {attempt.taskProgress && <p className="text-sm text-muted">Verified tasks recorded: {attempt.taskProgress.verifiedTaskCount}. Historical required-task total is not recorded.</p>}
          <ReportLink attempt={attempt} />
        </article>)}</section>}
      {(status || search || sort !== 'newest') && filtered.length > 0 && <button className="button-secondary" onClick={reset}>Reset filters and sorting</button>}
    </>}
  </div>;
}
