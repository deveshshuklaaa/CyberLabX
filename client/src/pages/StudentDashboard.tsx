import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, Award, BookOpen, Compass, FileText, History, User as UserIcon } from 'lucide-react';
import { api } from '../services/api';
import type { RecentAttempt, StudentDashboardData } from '../types/api';
import { useSessionStore } from '../store/sessionStore';
import { useCatalogue } from '../services/catalogue';
import { ExperimentCard } from '../components/common/ExperimentCard';
import { LoadingState, ErrorState } from '../components/common/QueryState';

const dateTime = (value?: string) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '\u2014';
const readableStatus = (status: RecentAttempt['status']) => ({ completed: 'Completed', running: 'In Progress', expired: 'Expired', failed: 'Failed' }[status] ?? status);

export function StudentDashboard() {
  const user = useSessionStore(state => state.user);
  const progress = useQuery({ queryKey: ['student-dashboard'], queryFn: () => api.get<StudentDashboardData>('/student/dashboard').then(response => response.data) });
  const catalogue = useCatalogue();
  const experiments = catalogue.data?.experiments ?? [];
  const recentAttempts = progress.data?.recentAttempts ?? [];
  const running = recentAttempts.find(attempt => attempt.status === 'running' && experiments.some(experiment => experiment._id === attempt.experimentId));
  const primary = experiments.find(experiment => experiment._id === running?.experimentId) ?? experiments[0];
  const stats = progress.data?.stats;
  return (<div className="space-y-8" data-testid="student-dashboard">
    <section className="panel p-6 sm:p-8 border-t-4 border-t-brand">
      <p className="eyebrow">Somaiya Virtual Labs | Student Portal</p>
      <h1 className="page-title">Welcome back, {user?.firstName || 'student'}.</h1>
      <p className="mt-2 text-sm text-muted break-words">{user?.firstName} {user?.lastName} {user?.email && `| ${user.email}`}</p>
      <p className="page-description">Build practical cybersecurity skills in a controlled learning environment.</p>
      <div className="mt-5 flex flex-wrap gap-3"><Link to="/experiments" className="button">Browse experiments</Link><Link to="/progress" className="button-secondary">View progress</Link></div>
    </section>
    {progress.isPending ? <div data-testid="progress-loading"><LoadingState message="Loading your learning progress..." /></div>
      : progress.isError ? <div data-testid="progress-error"><ErrorState message="Unable to load your learning progress." onRetry={() => { void progress.refetch(); }} retrying={progress.isFetching} /></div>
      : stats && <section aria-label="Learning statistics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <ProgressStat icon={<BookOpen size={20} />} label="Total Experiments" value={stats.totalExperiments} subtitle="Published catalogue" />
        <ProgressStat icon={<Compass size={20} />} label="Experiments Attempted" value={stats.experimentsAttempted} subtitle="Distinct experiments" />
        <ProgressStat icon={<Award size={20} />} label="Experiments Completed" value={`${stats.experimentsCompleted} / ${stats.totalExperiments}`} subtitle="Curriculum progress" />
        <ProgressStat icon={<Award size={20} />} label="Average Score" value={`${stats.averageScore}%`} subtitle="Best scores per completed experiment" />
        <ProgressStat icon={<Award size={20} />} label="Best Score" value={`${stats.bestScore}%`} subtitle="Highest completed score" />
      </section>}
    <section aria-labelledby="continue-heading" className="panel p-5 sm:p-7 border-l-4 border-l-brand space-y-4">
      <h2 id="continue-heading" className="text-xl font-bold">Continue Learning</h2>
      {catalogue.isPending ? <LoadingState message="Loading available experiments..." />
        : catalogue.isError ? <ErrorState message="Unable to load available experiments." onRetry={() => { void catalogue.refetch(); }} retrying={catalogue.isFetching} />
        : primary ? <>
          <p className="text-sm text-muted">{running ? 'You have an in-progress attempt. Open the experiment to continue through the existing lab flow.' : 'Choose a practical from the published catalogue to keep learning.'}</p>
          <div className="grid gap-5 md:grid-cols-2"><ExperimentCard experiment={primary} />
            <div className="flex flex-col justify-center gap-3"><p className="font-semibold">{running ? 'Continue your in-progress experiment' : 'Ready for your next practical?'}</p><Link className="button self-start" to={`/experiments/${primary._id}`}>{running ? 'Continue experiment' : 'Explore experiment'}</Link><Link className="text-sm underline" to="/experiments">View all experiments</Link></div>
          </div>
        </> : <div><p className="font-semibold">No experiments available yet.</p><p className="page-description">Check the catalogue again when new practicals are published.</p><Link className="button-secondary mt-4" to="/experiments">Browse catalogue</Link></div>}
    </section>
    {!catalogue.isPending && !catalogue.isError && experiments.length > 1 && <section aria-labelledby="available-heading" className="space-y-4">
      <h2 id="available-heading" className="text-xl font-bold">Available experiments</h2>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{experiments.filter(experiment => experiment._id !== primary?._id).slice(0, 3).map(experiment => <ExperimentCard key={experiment._id} experiment={experiment} />)}</div>
    </section>}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted">Quick Access Portal</h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            to="/experiments"
            className="panel p-5 bg-surface hover:border-brand/40 transition-all shadow-xs group flex flex-col justify-between"
          >
            <div>
              <div className="p-3 rounded-lg bg-brand/10 text-brand inline-flex mb-3 group-hover:bg-brand group-hover:text-white transition-colors">
                <Compass size={20} />
              </div>
              <h3 className="font-bold text-ink text-sm group-hover:text-brand transition-colors">
                Explore Experiments
              </h3>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                Browse the complete academic syllabus and launch interactive practicals.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-line flex items-center justify-between text-xs font-semibold text-brand">
              <span>View catalog</span>
              <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          <Link
            to="/progress"
            className="panel p-5 bg-surface hover:border-brand/40 transition-all shadow-xs group flex flex-col justify-between"
          >
            <div>
              <div className="p-3 rounded-lg bg-brand/10 text-brand inline-flex mb-3 group-hover:bg-brand group-hover:text-white transition-colors">
                <Award size={20} />
              </div>
              <h3 className="font-bold text-ink text-sm group-hover:text-brand transition-colors">
                My Progress
              </h3>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                View curriculum completion metrics, breakdown by practical, and average grades.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-line flex items-center justify-between text-xs font-semibold text-brand">
              <span>View progress</span>
              <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          <Link
            to="/history"
            className="panel p-5 bg-surface hover:border-brand/40 transition-all shadow-xs group flex flex-col justify-between"
          >
            <div>
              <div className="p-3 rounded-lg bg-brand/10 text-brand inline-flex mb-3 group-hover:bg-brand group-hover:text-white transition-colors">
                <History size={20} />
              </div>
              <h3 className="font-bold text-ink text-sm group-hover:text-brand transition-colors">
                Attempt History
              </h3>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                Inspect past attempts, review score records, and download official PDF reports.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-line flex items-center justify-between text-xs font-semibold text-brand">
              <span>View history</span>
              <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          <Link
            to="/profile"
            className="panel p-5 bg-surface hover:border-brand/40 transition-all shadow-xs group flex flex-col justify-between"
          >
            <div>
              <div className="p-3 rounded-lg bg-brand/10 text-brand inline-flex mb-3 group-hover:bg-brand group-hover:text-white transition-colors">
                <UserIcon size={20} />
              </div>
              <h3 className="font-bold text-ink text-sm group-hover:text-brand transition-colors">
                Student Profile
              </h3>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                Check enrollment credentials, institutional affiliation, and account status.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-line flex items-center justify-between text-xs font-semibold text-brand">
              <span>View profile</span>
              <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>
      </section>

      {/* ── 5. Recent Activity Preview (3–5 attempts) ── */}
      {progress.data && (
        <section className="panel overflow-hidden border border-line bg-surface shadow-xs" aria-labelledby="recent-activity-heading">
          <div className="border-b border-line px-5 py-4 bg-canvas/40 flex flex-wrap gap-3 items-center justify-between">
            <div>
              <h2 id="recent-activity-heading" className="text-sm font-bold uppercase tracking-wider text-ink">
                Recent Practical Activity
              </h2>
              <p className="text-xs text-muted">Latest laboratory attempts and grading logs</p>
            </div>
            <Link
              to="/history"
              className="text-xs font-bold text-brand hover:text-brand-dark transition-colors flex items-center gap-1"
            >
              <span>View Full History</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          {recentAttempts.length === 0 ? (
            <div className="p-8 text-center" data-testid="recent-empty">
              <BookOpen size={32} className="mx-auto text-muted/50 mb-2" />
              <p className="text-sm font-bold text-ink">No attempts yet.</p>
              <p className="text-xs text-muted mt-0.5">Start with a guided lab when you are ready.</p>
              <Link to="/experiments" className="button mt-4 inline-flex text-xs py-2 px-4 gap-1.5 font-bold">
                <span>Explore Experiments</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <caption className="sr-only">Your five most recent experiment attempts</caption>
                <thead className="bg-canvas border-b border-line text-muted text-xs uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="px-5 py-3 font-semibold">Experiment</th>
                    <th scope="col" className="px-5 py-3 font-semibold">Status</th>
                    <th scope="col" className="px-5 py-3 font-semibold">Score</th>
                    <th scope="col" className="px-5 py-3 font-semibold">Attempted</th>
                    <th scope="col" className="px-5 py-3 font-semibold text-right">Report</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {recentAttempts.slice(0, 5).map(attempt => (
                    <AttemptRow key={attempt.attemptId} attempt={attempt} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function ProgressStat({
  icon,
  label,
  value,
  subtitle,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <div
      className="panel p-5 border border-line bg-surface shadow-xs flex items-center gap-3.5"
      data-testid={`stat-${label.toLowerCase().replaceAll(' ', '-')}`}
    >
      <div className="p-3 rounded-lg bg-brand/10 text-brand shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-black text-ink font-sans leading-none">{value}</p>
        <p className="text-xs font-bold text-muted uppercase tracking-wider mt-1">{label}</p>
        {subtitle && <p className="text-[11px] text-muted/80 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function AttemptRow({ attempt }: { attempt: RecentAttempt }) {
  const statusColor = {
    completed: 'status-success',
    running: 'status-warning',
    expired: 'status-neutral',
    failed: 'status-danger',
  }[attempt.status];

  return (
    <tr className="hover:bg-canvas/50 transition-colors">
      <td className="px-5 py-3.5 font-bold text-ink">
        {attempt.experimentTitle ?? 'Experiment unavailable'}
      </td>
      <td className="px-5 py-3.5">
        <span className={`status-badge ${statusColor}`}>
          {readableStatus(attempt.status)}
        </span>
      </td>
      <td className="px-5 py-3.5 font-bold text-ink">
        {attempt.score === null ? '—' : `${attempt.score}/100`}
      </td>
      <td className="px-5 py-3.5 text-xs text-muted">
        {dateTime(attempt.completedAt ?? attempt.startedAt)}
      </td>
      <td className="px-5 py-3.5 text-right">
        {attempt.reportAvailable && attempt.reportId ? (
          <a
            className="inline-flex items-center gap-1 font-semibold text-xs text-brand hover:text-brand-dark transition-colors bg-brand/5 border border-brand/20 px-2.5 py-1 rounded"
            href={`${api.defaults.baseURL}/reports/${attempt.reportId}/download`}
            target="_blank"
            rel="noreferrer"
          >
            <FileText size={13} />
            <span>Report</span>
          </a>
        ) : (
          <span className="text-muted text-xs">—</span>
        )}
      </td>
    </tr>
  );
}
