import { useState } from 'react';
import { useSessionStore } from '../../store/sessionStore';
import { academicError, useCohortAnalytics } from '../../services/teacherAcademics';
import type { AcademicFilters } from '../../services/teacherAcademics';
import { LoadingState, ErrorState } from '../common/QueryState';
import { AcademicFilters as Filters, AcademicPagination } from './AcademicControls';

export function CohortPerformance() {
  const user = useSessionStore(state => state.user);
  return user?.role === 'faculty' ? <Performance key={user.id} teacherId={user.id} /> : null;
}
function Performance({ teacherId }: { teacherId: string }) {
  const [filters, setFilters] = useState<AcademicFilters>({ page: 1, limit: 10 });
  const query = useCohortAnalytics(teacherId, filters);
  const cohort = query.data?.cohort;
  return <div className="space-y-4"><p className="text-sm text-muted">Current enrolled cohort, including inactive students and history before enrollment. Dates filter attempt start times. Counts below apply across all filtered results, not just this page.</p>
    <Filters id="cohort-performance" onApply={value => setFilters({ ...value, page: 1, limit: 10 })} />
    <button className="button-secondary text-sm" disabled={query.isFetching} onClick={() => { void query.refetch(); }}>Refresh performance</button>
    {query.isPending ? <LoadingState message="Loading cohort performance..." /> : query.isError || !cohort || !query.data ? <ErrorState message={academicError(query.error)} onRetry={() => { void query.refetch(); }} retrying={query.isFetching} /> : <>
      <dl aria-label="Cohort academic summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[['Enrolled students', cohort.enrolledStudents], ['Active / inactive', `${cohort.activeStudents} / ${cohort.inactiveStudents}`], ['Students with attempts', cohort.attemptedStudents], ['Students with completions', cohort.completedStudents], ['Attempts recorded', cohort.attemptCount], ['Completed attempts', cohort.completedAttemptCount]].map(([label, value]) => <div key={label} className="rounded-lg bg-canvas p-3"><dt className="text-sm text-muted">{label}</dt><dd className="font-bold text-xl">{value}</dd></div>)}</dl>
      {!cohort.enrolledStudents && <p className="state-panel">No enrolled students. Published experiments are shown below without invented learning activity.</p>}
      {!query.data.experiments.length ? <p className="state-panel">No experiments match this authorized scope and filter.</p> : <ul aria-label="Experiment performance records" className="grid gap-4 md:grid-cols-2">{query.data.experiments.map(({ experiment, performance: p }) => <li key={experiment.id} className="rounded-lg border border-line p-4 space-y-3 min-w-0">
        <h3 className="font-bold break-words">{experiment.title ?? 'Experiment unavailable'}</h3><p className="text-xs text-muted break-all">Experiment ID: {experiment.id}</p>
        <dl className="grid gap-3 sm:grid-cols-2 text-sm">{[['Students attempted / completed', `${p.attemptedStudents} / ${p.completedStudents}`], ['Attempts / completed', `${p.attemptCount} / ${p.completedAttemptCount}`], ['Average / best points', `${p.averageScore ?? 'Not graded'} / ${p.bestScore ?? 'Not graded'}`], ['Average normalized score', p.averagePercentage === null ? 'Unknown' : `${p.averagePercentage}%`], ['Known score maxima', `${p.normalizedScoreCount} of ${p.completedAttemptCount} completed attempts`], ['Cohort completion', p.completionPercentage === null ? 'No cohort denominator' : `${p.completionPercentage}%`]].map(([label, value]) => <div key={label}><dt className="text-muted">{label}</dt><dd>{value}</dd></div>)}</dl>
        <p className="text-xs text-muted">Point averages divide the sum of recorded completed scores by the number of completed attempts with a score, including repeats. Normalized averages include only completed attempts with a recorded valid maximum. Cohort completion divides distinct completing students by all enrolled students, including inactive accounts.</p>
      </li>)}</ul>}
      <AcademicPagination data={query.data.pagination} page={filters.page} busy={query.isFetching} onPage={page => setFilters({ ...filters, page })} />
    </>}
  </div>;
}
