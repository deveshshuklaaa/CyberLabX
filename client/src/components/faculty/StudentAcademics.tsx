import { useState } from 'react';
import { api } from '../../services/api';
import { enrollmentDate, enrollmentError } from '../../services/enrollment';
import { useAcademicAttempts, useAcademicReports } from '../../services/teacherAcademics';
import type { AcademicFilters, AcademicReport } from '../../services/teacherAcademics';
import { LoadingState, ErrorState } from '../common/QueryState';
import { AttemptStatus } from '../common/AttemptStatus';
import { AcademicFilters as Filters, AcademicPagination } from './AcademicControls';

export function StudentAcademics({ teacherId, studentId }: { teacherId: string; studentId: string }) {
  const [tab, setTab] = useState<'attempts' | 'reports'>('attempts');
  return <section aria-label="Student academic records" className="space-y-4 border-t border-line pt-5">
    <h4 className="font-bold">Academic records</h4><p className="text-sm text-muted">Current enrollment grants access to this student’s recorded history, including work before enrollment. Removing the assignment revokes future access.</p>
    <div className="flex flex-wrap gap-3" role="group" aria-label="Academic record view"><button className="button-secondary" type="button" aria-pressed={tab === 'attempts'} onClick={() => setTab('attempts')}>Attempt history</button><button className="button-secondary" type="button" aria-pressed={tab === 'reports'} onClick={() => setTab('reports')}>Student reports</button></div>
    {tab === 'attempts' ? <Attempts teacherId={teacherId} studentId={studentId} /> : <Reports teacherId={teacherId} studentId={studentId} />}
  </section>;
}
function Attempts({ teacherId, studentId }: { teacherId: string; studentId: string }) {
  const [filters, setFilters] = useState<AcademicFilters>({ page: 1, limit: 10 });
  const query = useAcademicAttempts(teacherId, studentId, filters);
  return <div className="space-y-4"><Filters id="attempt-history" statuses onApply={value => setFilters({ ...value, page: 1, limit: 10 })} />
    <button className="button-secondary text-sm" disabled={query.isFetching} onClick={() => { void query.refetch(); }}>Refresh attempts</button>
    {query.isPending ? <LoadingState message="Loading student attempts..." /> : query.isError ? <ErrorState message={enrollmentError(query.error)} onRetry={() => { void query.refetch(); }} retrying={query.isFetching} /> : <>
      {!query.data.attempts.length ? <p className="state-panel">No attempts match these filters.</p> : <ul aria-label="Student attempts" className="space-y-3">{query.data.attempts.map(attempt => <li key={attempt.id} className="rounded-lg border border-line p-4 space-y-3 min-w-0">
        <h5 className="font-bold break-words">{attempt.experiment.title ?? 'Experiment unavailable'}</h5><AttemptStatus status={attempt.status} /><p className="text-xs text-muted break-all">Experiment ID: {attempt.experiment.id} · Attempt: {attempt.id}</p>
        <dl className="grid gap-3 sm:grid-cols-2 text-sm"><div><dt className="text-muted">Score</dt><dd>{attempt.assessmentScore.value === null ? 'Not graded' : `${attempt.assessmentScore.value}${attempt.assessmentScore.max === null ? ' points · maximum unknown' : ` / ${attempt.assessmentScore.max}`}`}{attempt.assessmentScore.percentage !== null && ` (${attempt.assessmentScore.percentage}%)`}</dd></div><div><dt className="text-muted">Verified tasks</dt><dd>{attempt.taskProgress.verifiedTaskCount}{attempt.taskProgress.requiredTaskCount === null ? ' · total not recorded' : ` / ${attempt.taskProgress.requiredTaskCount}`}</dd></div><div><dt className="text-muted">Started</dt><dd>{enrollmentDate(attempt.startedAt)}</dd></div><div><dt className="text-muted">Completed</dt><dd>{enrollmentDate(attempt.completedAt)}</dd></div></dl>
      </li>)}</ul>}
      <AcademicPagination data={query.data.pagination} page={filters.page} busy={query.isFetching} onPage={page => setFilters({ ...filters, page })} />
    </>}
  </div>;
}
function Reports({ teacherId, studentId }: { teacherId: string; studentId: string }) {
  const [filters, setFilters] = useState<AcademicFilters>({ page: 1, limit: 10 });
  const [downloading, setDownloading] = useState<string | null>(null), [error, setError] = useState('');
  const query = useAcademicReports(teacherId, studentId, filters);
  const download = async (report: AcademicReport) => {
    if (downloading) return; setDownloading(report.id); setError('');
    try {
      // Construct only the authorized teacher route; never navigate a server-supplied arbitrary URL.
      const response = await api.get<Blob>(`/teacher/students/${studentId}/reports/${report.id}/download`, { responseType: 'blob' });
      if (!String(response.headers['content-type']).includes('application/pdf')) throw new Error('PDF unavailable');
      const url = URL.createObjectURL(response.data), link = document.createElement('a');
      link.href = url; link.download = `CyberLabX-report-${report.id}.pdf`; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError('Report could not be downloaded. It may be unavailable or your enrollment access may have changed. Refresh reports before retrying.'); }
    finally { setDownloading(null); }
  };
  return <div className="space-y-4"><Filters id="student-reports" onApply={value => { setError(''); setFilters({ ...value, page: 1, limit: 10 }); }} />
    <button className="button-secondary text-sm" disabled={query.isFetching || Boolean(downloading)} onClick={() => { setError(''); void query.refetch(); }}>Refresh reports</button>
    {error && <p role="alert" className="error-panel text-sm">{error}</p>}
    {query.isPending ? <LoadingState message="Loading student reports..." /> : query.isError ? <ErrorState message={enrollmentError(query.error)} onRetry={() => { void query.refetch(); }} retrying={query.isFetching} /> : <>
      {!query.data.reports.length ? <p className="state-panel">No report records match these filters. This view does not generate reports.</p> : <ul aria-label="Student report records" className="space-y-3">{query.data.reports.map(report => <li key={report.id} className="rounded-lg border border-line p-4 space-y-3 min-w-0">
        <h5 className="font-bold break-words">{report.experiment.title ?? 'Experiment unavailable'}</h5><p className="text-sm">Score: {report.score} / {report.totalMarks} · Quiz: {report.quizScore}</p><p className="text-xs text-muted">Generated: {enrollmentDate(report.generatedAt)}</p><p className="text-xs text-muted break-all">Report: {report.id}</p>
        {report.available ? <button type="button" className="button-secondary text-sm" disabled={Boolean(downloading)} onClick={() => { void download(report); }}>{downloading === report.id ? 'Downloading PDF...' : 'Download student PDF'}</button> : <p className="text-sm text-muted">PDF unavailable. The academic record is preserved.</p>}
      </li>)}</ul>}
      <AcademicPagination data={query.data.pagination} page={filters.page} busy={query.isFetching} onPage={page => setFilters({ ...filters, page })} />
    </>}
  </div>;
}
