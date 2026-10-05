import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  Compass,
  FileText,
  History,
  Layers,
  Play,
  RotateCcw,
  Target,
  User as UserIcon,
} from 'lucide-react';
import { api } from '../services/api';
import type { Experiment, RecentAttempt, StudentDashboardData } from '../types/api';
import { useSessionStore } from '../store/sessionStore';

const dateTime = (value?: string) =>
  value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : '—';

const readableStatus = (status: RecentAttempt['status']) =>
  ({ completed: 'Completed', running: 'In Progress', expired: 'Expired', failed: 'Failed' }[status] ?? status);

export function StudentDashboard() {
  const user = useSessionStore(s => s.user);

  const progress = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: () => api.get<StudentDashboardData>('/student/dashboard').then(r => r.data),
  });

  const experiments = useQuery({
    queryKey: ['experiments'],
    queryFn: () => api.get<{ experiments: Experiment[] }>('/experiments').then(r => r.data),
  });

  const allExperiments = experiments.data?.experiments ?? [];
  const recentAttempts = progress.data?.recentAttempts ?? [];

  // Determine the most relevant "Continue Learning" practicals
  // 1. In-progress attempts first
  // 2. Unattempted experiments
  // 3. Recently completed
  const runningAttempt = recentAttempts.find(a => a.status === 'running');
  const runningExperiment = runningAttempt
    ? allExperiments.find(e => e._id === runningAttempt.experimentId)
    : null;

  const attemptedIds = new Set(recentAttempts.map(a => a.experimentId));
  const unattempted = allExperiments.filter(e => !attemptedIds.has(e._id));
  const primaryExperiment = runningExperiment ?? unattempted[0] ?? allExperiments[0];

  return (
    <div className="space-y-8" data-testid="student-dashboard">
      {/* ── 1. Welcome Section ── */}
      <section className="bg-surface rounded-xl border border-line p-6 sm:p-8 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-brand" />

        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-brand bg-brand/5 border border-brand/20 px-2.5 py-0.5 rounded">
              Somaiya Vidyavihar University
            </span>
            <span className="text-xs font-semibold text-muted bg-canvas border border-line px-2.5 py-0.5 rounded">
              Academic Virtual Laboratory Portal
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-ink uppercase tracking-tight font-sans">
            Welcome back, {user?.firstName}.
          </h1>

          <p className="mt-1 text-sm sm:text-base text-muted leading-relaxed">
            Continue your practical cybersecurity and network engineering coursework in an isolated, safe university virtual environment.
          </p>
        </div>
      </section>

      {/* ── 2. Summary Statistics ── */}
      {progress.isLoading ? (
        <div className="panel p-8 text-center" data-testid="progress-loading">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-brand border-t-transparent mb-3" />
          <p className="text-sm font-medium text-muted">Loading your learning progress…</p>
        </div>
      ) : progress.error ? (
        <div className="panel p-6 border-danger/30 bg-danger/5" data-testid="progress-error">
          <p className="text-sm font-semibold text-danger">Unable to load your learning progress. Please try again.</p>
        </div>
      ) : (
        progress.data && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ProgressStat
              icon={<CheckCircle2 size={20} />}
              label="Experiments Completed"
              value={`${progress.data.stats.experimentsCompleted} / ${progress.data.stats.totalExperiments}`}
              subtitle="Curriculum progress"
            />
            <ProgressStat
              icon={<Target size={20} />}
              label="Average Score"
              value={`${progress.data.stats.averageScore}%`}
              subtitle="Across completed labs"
            />
            <ProgressStat
              icon={<Award size={20} />}
              label="Best Score"
              value={`${progress.data.stats.bestScore}%`}
              subtitle="Highest score achieved"
            />
            <ProgressStat
              icon={<BookOpen size={20} />}
              label="Experiments Attempted"
              value={progress.data.stats.experimentsAttempted}
              subtitle="Total laboratory attempts"
            />
          </div>
        )
      )}

      {/* ── 3. Continue Learning ── */}
      {primaryExperiment && (
        <section className="panel p-6 sm:p-7 bg-surface border border-line shadow-xs">
          <div className="flex items-center justify-between border-b border-line pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-brand animate-pulse" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-brand">Continue Learning</h2>
            </div>
            <span className="text-xs text-muted font-medium bg-canvas px-2.5 py-0.5 rounded border border-line">
              Recommended Practical
            </span>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="space-y-1.5 max-w-2xl">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-brand uppercase tracking-wider bg-brand/5 border border-brand/20 px-2 py-0.5 rounded">
                  {primaryExperiment.category ?? 'Network Security'}
                </span>
                <span className="text-muted">•</span>
                <span className="text-muted flex items-center gap-1">
                  <Clock size={12} />
                  <span>{primaryExperiment.estimatedTimeMinutes} min</span>
                </span>
                <span className="text-muted">•</span>
                <span className="font-semibold text-ink">Level: {primaryExperiment.difficulty}</span>
              </div>

              <h3 className="text-lg font-bold text-ink">{primaryExperiment.title}</h3>
              <p className="text-xs sm:text-sm text-muted leading-relaxed">{primaryExperiment.description}</p>
            </div>

            <div className="shrink-0 flex items-center gap-3">
              <Link
                to={`/experiments/${primaryExperiment._id}`}
                className="button text-xs py-2 px-5 gap-2 font-bold shadow-xs"
              >
                <span>{runningAttempt ? 'Resume Lab Session' : 'Start Experiment'}</span>
                <Play size={13} />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── 4. Quick Access Navigation Cards ── */}
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
          <div className="border-b border-line px-5 py-4 bg-canvas/40 flex items-center justify-between">
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
              <p className="text-sm font-bold text-ink">No experiments completed yet.</p>
              <p className="text-xs text-muted mt-0.5">Start with a guided lab when you are ready.</p>
              <Link to="/experiments" className="button mt-4 inline-flex text-xs py-2 px-4 gap-1.5 font-bold">
                <span>Explore Experiments</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-canvas border-b border-line text-muted text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Experiment</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Score</th>
                    <th className="px-5 py-3 font-semibold">Attempted</th>
                    <th className="px-5 py-3 font-semibold text-right">Report</th>
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
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    running: 'bg-amber-50 text-amber-700 border-amber-200',
    expired: 'bg-slate-100 text-slate-700 border-slate-200',
    failed: 'bg-rose-50 text-rose-700 border-rose-200',
  }[attempt.status];

  return (
    <tr className="hover:bg-canvas/50 transition-colors">
      <td className="px-5 py-3.5 font-bold text-ink">
        {attempt.experimentTitle ?? 'Experiment unavailable'}
      </td>
      <td className="px-5 py-3.5">
        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusColor}`}>
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
