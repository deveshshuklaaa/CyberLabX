import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import type { StudentDashboardData } from '../types/api';
import { useCatalogue } from '../services/catalogue';
import { attemptDate, useStudentHistory } from '../services/studentHistory';
import { PageHeading } from '../components/common/PageHeading';
import { LoadingState, ErrorState } from '../components/common/QueryState';
import { AttemptStatus } from '../components/common/AttemptStatus';

export function StudentProgress() {
  const dashboard = useQuery({ queryKey: ['student-dashboard'], queryFn: () => api.get<StudentDashboardData>('/student/dashboard').then(response => response.data) });
  const catalogue = useCatalogue();
  const history = useStudentHistory();
  const stats = dashboard.data?.stats;
  const experiments = catalogue.data?.experiments ?? [];
  const percent = stats && stats.totalExperiments > 0 ? Math.round(stats.experimentsCompleted / stats.totalExperiments * 100) : 0;
  return <div className="space-y-8">
    <PageHeading title="My Learning Progress" eyebrow="Somaiya Virtual Labs" description="Track completed experiments and your best recorded scores. Completion means a completed attempt, rather than time spent or tasks viewed." actions={<Link to="/experiments" className="button">Browse experiments</Link>} />
    {dashboard.isPending ? <LoadingState message="Loading progress summary..." /> : dashboard.isError ? <ErrorState message="Unable to load progress summary." onRetry={() => { void dashboard.refetch(); }} retrying={dashboard.isFetching} /> : stats && <section aria-label="Progress summary" className="space-y-4">
      <div className="panel p-6 space-y-3"><h2 className="text-lg font-bold">Curriculum completion</h2><p>{stats.experimentsCompleted} completed / {stats.totalExperiments} published experiments</p>
        {stats.totalExperiments > 0 ? <><progress className="w-full h-3 accent-brand" aria-label="Curriculum completion" max={100} value={Math.min(100, percent)} /><p className="text-sm text-muted">{percent}% against the current published catalogue. Summary totals include your recorded completed experiments.</p></> : <p className="text-sm text-muted">No published experiments are currently available.</p>}
      </div>
      <dl className="grid gap-4 sm:grid-cols-3">{[['Experiments attempted', stats.experimentsAttempted], ['Average score', `${stats.averageScore}%`], ['Best score', `${stats.bestScore}%`]].map(([label, value]) => <div key={label} className="panel p-5"><dt className="text-sm text-muted">{label}</dt><dd className="mt-2 text-2xl font-bold">{value}</dd></div>)}</dl>
      <p className="text-sm text-muted">Attempted counts distinct experiments. Average score uses the best completed score for each experiment; failed, expired and running attempts do not contribute. Zero scores are displayed as recorded by the server.</p>
    </section>}
    <section aria-labelledby="experiment-progress-heading" className="space-y-4">
      <h2 id="experiment-progress-heading" className="text-xl font-bold">Experiment-wise progress</h2>
      <p className="text-sm text-muted">Based on your full attempt history and the published catalogue. This view shows experiment completion rather than partial task completion.</p>
      {catalogue.isPending || history.isPending ? <LoadingState message="Loading experiment progress..." /> : catalogue.isError || history.isError ? <ErrorState message="Unable to load experiment progress. Completion states are unavailable until both catalogue and history load." onRetry={() => { if (catalogue.isError) void catalogue.refetch(); if (history.isError) void history.refetch(); }} retrying={catalogue.isFetching || history.isFetching} />
        : !experiments.length ? <div className="state-panel"><h3 className="font-bold">No published experiments available</h3><Link to="/history" className="button-secondary mt-4">View recorded attempts</Link></div>
        : <div className="grid gap-4 md:grid-cols-2">{experiments.map(experiment => {
          const attempts = (history.data?.attempts ?? []).filter(attempt => attempt.experimentId === experiment._id).sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
          const completed = attempts.filter(attempt => attempt.status === 'completed');
          const scores = completed.flatMap(attempt => attempt.score === null ? [] : [attempt.score]);
          const status = completed.length ? 'completed' : attempts.some(attempt => attempt.status === 'running') ? 'running' : attempts[0]?.status ?? 'not-started';
          return <article key={experiment._id} className="panel p-5 space-y-3"><h3 className="text-lg font-bold">{experiment.title}</h3><AttemptStatus status={status} /><p className="text-sm text-muted">{experiment.description}</p>
            <dl className="grid gap-3 sm:grid-cols-2 text-sm"><div><dt className="text-muted">Attempts recorded</dt><dd>{attempts.length}</dd></div><div><dt className="text-muted">Best completed score</dt><dd>{scores.length ? `${Math.max(...scores)}/100` : 'Not graded'}</dd></div><div className="sm:col-span-2"><dt className="text-muted">Last started</dt><dd>{attempts[0] ? attemptDate(attempts[0].startedAt) : 'Not started'}</dd></div></dl>
            <Link className="button-secondary text-sm" to={`/experiments/${experiment._id}`} aria-label={`View experiment: ${experiment.title}`}>View experiment</Link>
          </article>;
        })}</div>}
    </section>
  </div>;
}
