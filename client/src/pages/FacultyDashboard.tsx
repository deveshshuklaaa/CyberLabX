import { useSessionStore } from '../store/sessionStore';
import { useQuery } from '@tanstack/react-query';
import { Award, BookOpen, FileText, Users } from 'lucide-react';
import { api } from '../services/api';
import { PageHeading } from '../components/common/PageHeading';
import { LoadingState, ErrorState } from '../components/common/QueryState';
import { MetricCard } from '../components/common/MetricCard';
import { PendingIntegration } from '../components/common/PendingIntegration';
import { TeacherEnrollment } from '../components/faculty/TeacherEnrollment';

interface FacultyMetrics { students: number; completedAttempts: number; averageScore: number; reports: number; }

export function FacultyDashboard() {
  const isAdmin = useSessionStore(state => state.user?.role === 'admin');
  const scope = isAdmin ? 'Platform' : 'Enrolled cohort';
  const dashboard = useQuery({
    queryKey: ['faculty-dashboard'],
    queryFn: async () => {
      const { data } = await api.get<{ metrics: FacultyMetrics }>('/faculty/dashboard');
      // Incomplete responses must remain errors rather than become invented zero counts.
      if (!data?.metrics || !['students', 'completedAttempts', 'averageScore', 'reports'].every(key => {
        const value = data.metrics[key as keyof FacultyMetrics];
        return typeof value === 'number' && Number.isFinite(value) && value >= 0;
      })) throw new Error('Invalid faculty metrics response.');
      return data;
    },
  });
  const metrics = dashboard.data?.metrics;
  return <div className="space-y-8">
    <PageHeading title="Teacher Overview" eyebrow="Somaiya Virtual Labs | Faculty Portal"
      description={isAdmin ? 'Review platform-wide laboratory participation and assessment activity across CyberLabX.' : 'Review laboratory participation and assessment activity for students currently enrolled with you.'}
      actions={<button type="button" className="button-secondary" disabled={dashboard.isFetching} onClick={() => { void dashboard.refetch(); }}>{dashboard.isFetching ? 'Refreshing...' : 'Refresh overview'}</button>} />
    <nav aria-label="Teacher overview sections" className="flex flex-wrap gap-2"><a className="button-secondary text-sm" href="#student-monitoring">Student monitoring</a><a className="button-secondary text-sm" href="#experiment-performance">Experiment performance</a><a className="button-secondary text-sm" href="#teacher-reports">Reports</a></nav>
    <section aria-label={`${scope} summary`} className="space-y-4">
      {dashboard.isPending ? <LoadingState message="Loading teacher overview..." />
        : dashboard.isError || !metrics ? <ErrorState message="Unable to load dashboard data." onRetry={() => { void dashboard.refetch(); }} retrying={dashboard.isFetching} />
        : <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Active students" value={metrics.students} description={isAdmin ? 'Active student accounts across the platform.' : 'Active student accounts currently enrolled with you.'} icon={<Users size={22} />} />
            <MetricCard label="Completed attempts" value={metrics.completedAttempts} description={isAdmin ? 'All completed attempts, including repeated experiments.' : 'Completed attempts by your enrolled students, including repeats and history before enrollment.'} icon={<BookOpen size={22} />} />
            <MetricCard label="Average score" value={metrics.averageScore} description="Rounded average recorded score across completed attempts, including repeats. Scores are not converted to percentages. The average is zero when no completed attempts exist." icon={<Award size={22} />} />
            <MetricCard label="Reports recorded" value={metrics.reports} description={isAdmin ? 'Report records across the platform. Individual teacher downloads are not available yet.' : 'Report records for your enrolled students. Individual teacher downloads are not available yet.'} icon={<FileText size={22} />} />
          </div>
          {!isAdmin && <p className="text-sm text-muted">The student count includes active enrolled accounts. Assessment totals also include inactive enrolled students' history. Unassigned students are excluded.</p>}
          <p className="text-xs text-muted">Last fetched: {new Date(dashboard.dataUpdatedAt).toLocaleString()}. Use Refresh overview for updated totals.</p>
          {metrics.students === 0 && metrics.completedAttempts === 0 && metrics.reports === 0 && <div className="state-panel"><h2 className="font-bold">{isAdmin ? 'No student activity recorded yet' : 'No enrolled cohort activity recorded yet'}</h2><p className="page-description mx-auto">{isAdmin ? 'There are no active student accounts, completed attempts or report records in the overview.' : 'No active enrolled students, completed attempts or report records were returned. Existing unassigned accounts do not appear until explicitly enrolled.'}</p></div>}
          {metrics.students > 0 && metrics.completedAttempts === 0 && <p className="panel p-4 text-sm text-muted">No completed attempts yet. Active student accounts do not imply that an experiment has been completed.</p>}
        </>}
    </section>
    <div className="grid gap-5">
      <section id="student-monitoring" aria-labelledby="student-monitoring-heading" className="panel p-5 sm:p-6 space-y-4 scroll-mt-6">
        <h2 id="student-monitoring-heading" className="text-xl font-bold">Student monitoring</h2>
        {isAdmin ? <><p className="text-sm text-muted">Student monitoring requires an explicitly selected teacher; admin access does not impersonate a faculty session.</p><PendingIntegration title="Teacher selection required" description="Admin teacher-scoped APIs exist. Select a teacher through a future admin management flow; faculty-only enrollment controls are not available to administrators." /></> : <TeacherEnrollment />}
      </section>
      <section id="experiment-performance" aria-labelledby="experiment-performance-heading" className="panel p-5 sm:p-6 space-y-4 scroll-mt-6">
        <h2 id="experiment-performance-heading" className="text-xl font-bold">Experiment performance</h2>
        <p className="text-sm text-muted">The summary provides an overall score average and completed-attempt count. It does not provide a breakdown by experiment.</p>
        <PendingIntegration title="Experiment breakdown unavailable" description="Per-experiment participation, completion and score comparisons require an authorized performance response. No comparison chart can be shown yet." />
      </section>
    </div>
    <section id="teacher-reports" aria-labelledby="teacher-reports-heading" className="panel p-5 sm:p-6 space-y-4 scroll-mt-6">
      <h2 id="teacher-reports-heading" className="text-xl font-bold">Reports and assessment review</h2>
      <p className="text-sm text-muted">{isAdmin ? 'The overview counts report records across the platform. Report ownership and download access remain enforced by the server.' : 'The overview counts report records for your enrolled students. Enrollment does not grant access to student-only report downloads.'}</p>
      {!dashboard.isError && metrics?.reports === 0 && <p className="text-sm font-semibold">No reports recorded yet.</p>}
      <PendingIntegration title="Teacher report browser unavailable" description="The existing report routes are for students. A teacher-authorized report listing and download contract is required before individual reports can be displayed here." />
    </section>
  </div>;
}
