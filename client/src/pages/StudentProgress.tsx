import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Play,
  RotateCcw,
  Target,
  TrendingUp,
} from 'lucide-react';
import { api } from '../services/api';
import type { Experiment, StudentDashboardData, StudentHistoryData } from '../types/api';

const dateTime = (value?: string) =>
  value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : '—';

export function StudentProgress() {
  const dashboard = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: () => api.get<StudentDashboardData>('/student/dashboard').then(r => r.data),
  });

  const experiments = useQuery({
    queryKey: ['experiments'],
    queryFn: () => api.get<{ experiments: Experiment[] }>('/experiments').then(r => r.data),
  });

  const history = useQuery({
    queryKey: ['student-history'],
    queryFn: () =>
      api.get<StudentHistoryData>('/student/history').then(r => r.data).catch(() => ({
        attempts: dashboard.data?.recentAttempts ?? [],
      })),
    enabled: Boolean(dashboard.data),
  });

  const isLoading = dashboard.isLoading || experiments.isLoading;
  const isError = dashboard.isError || experiments.isError;

  const stats = dashboard.data?.stats;
  const allExperiments = experiments.data?.experiments ?? [];
  const allAttempts = history.data?.attempts ?? dashboard.data?.recentAttempts ?? [];

  // Calculate percentage of curriculum completed
  const curriculumPercent =
    stats && stats.totalExperiments > 0
      ? Math.round((stats.experimentsCompleted / stats.totalExperiments) * 100)
      : 0;

  return (
    <div className="space-y-8">
      {/* ── Page Header ── */}
      <div className="border-b border-line pb-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-brand bg-brand/5 border border-brand/20 px-2.5 py-0.5 rounded">
            Somaiya Vidyavihar University
          </span>
          <span className="text-xs font-semibold text-muted bg-canvas border border-line px-2.5 py-0.5 rounded">
            Academic Performance Evaluation
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-ink uppercase tracking-tight font-sans">
          My Academic Progress
        </h1>
        <p className="mt-1 text-sm text-muted max-w-3xl leading-relaxed">
          Detailed evaluation records, curriculum completion metrics, and scoring breakdowns calculated from verified laboratory attempts.
        </p>
      </div>

      {isLoading && (
        <div className="panel p-12 text-center" data-testid="progress-page-loading">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-brand border-t-transparent mb-3" />
          <p className="text-sm text-muted">Calculating academic progress metrics…</p>
        </div>
      )}

      {isError && (
        <div className="panel p-6 border-danger/30 bg-danger/5" data-testid="progress-page-error">
          <p className="text-sm font-semibold text-danger">Unable to load progress data. Please try again later.</p>
        </div>
      )}

      {!isLoading && !isError && stats && (
        <>
          {/* ── Overall Academic Progress Summary ── */}
          <section className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-ink">Overall Curriculum Summary</h2>

            {/* Curriculum Progress Bar Card */}
            <div className="panel p-6 bg-surface border border-line shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div>
                  <h3 className="text-base font-bold text-ink">Curriculum Completion</h3>
                  <p className="text-xs text-muted">
                    {stats.experimentsCompleted} of {stats.totalExperiments} required practical laboratories successfully completed
                  </p>
                </div>
                <span className="text-2xl font-black text-brand font-sans">{curriculumPercent}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-line">
                <div
                  className="bg-brand h-full rounded-full transition-all duration-500"
                  style={{ width: `${curriculumPercent}%` }}
                />
              </div>
            </div>

            {/* 4 Restrained Academic Stat Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="panel p-5 bg-surface border border-line shadow-xs flex items-center gap-3.5">
                <div className="p-3 rounded-lg bg-brand/10 text-brand shrink-0">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <p className="text-2xl font-black text-ink font-sans leading-none">
                    {stats.experimentsCompleted} / {stats.totalExperiments}
                  </p>
                  <p className="text-xs font-bold text-muted uppercase tracking-wider mt-1">Completed Labs</p>
                </div>
              </div>

              <div className="panel p-5 bg-surface border border-line shadow-xs flex items-center gap-3.5">
                <div className="p-3 rounded-lg bg-brand/10 text-brand shrink-0">
                  <Target size={20} />
                </div>
                <div>
                  <p className="text-2xl font-black text-ink font-sans leading-none">{stats.averageScore}%</p>
                  <p className="text-xs font-bold text-muted uppercase tracking-wider mt-1">Average Grade</p>
                </div>
              </div>

              <div className="panel p-5 bg-surface border border-line shadow-xs flex items-center gap-3.5">
                <div className="p-3 rounded-lg bg-brand/10 text-brand shrink-0">
                  <Award size={20} />
                </div>
                <div>
                  <p className="text-2xl font-black text-ink font-sans leading-none">{stats.bestScore}%</p>
                  <p className="text-xs font-bold text-muted uppercase tracking-wider mt-1">Best Score</p>
                </div>
              </div>

              <div className="panel p-5 bg-surface border border-line shadow-xs flex items-center gap-3.5">
                <div className="p-3 rounded-lg bg-brand/10 text-brand shrink-0">
                  <BookOpen size={20} />
                </div>
                <div>
                  <p className="text-2xl font-black text-ink font-sans leading-none">{stats.experimentsAttempted}</p>
                  <p className="text-xs font-bold text-muted uppercase tracking-wider mt-1">Total Attempts</p>
                </div>
              </div>
            </div>
          </section>

          {/* ── Per-Experiment Progress Breakdown ── */}
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-ink">
                  Individual Practical Progress
                </h2>
                <p className="text-xs text-muted">Authoritative status for each laboratory in the academic syllabus</p>
              </div>
              <span className="text-xs text-muted font-medium bg-canvas px-2.5 py-1 rounded border border-line">
                {allExperiments.length} Practicals
              </span>
            </div>

            <div className="space-y-4" data-testid="experiment-progress-list">
              {allExperiments.map(exp => {
                const expAttempts = allAttempts.filter(
                  a => a.experimentId === exp._id || a.experimentTitle === exp.title
                );
                const completedAttempts = expAttempts.filter(a => a.status === 'completed');
                const isCompleted = completedAttempts.length > 0;
                const isRunning = expAttempts.some(a => a.status === 'running');
                const hasAttempts = expAttempts.length > 0;
                const bestScore = isCompleted
                  ? Math.max(...completedAttempts.map(a => a.score ?? 0))
                  : null;
                const latestAttempt = expAttempts[0];

                return (
                  <article
                    key={exp._id}
                    className="panel p-6 bg-surface border border-line shadow-xs relative overflow-hidden"
                  >
                    <div
                      className={`absolute top-0 left-0 bottom-0 w-1.5 ${
                        isCompleted ? 'bg-emerald-600' : isRunning ? 'bg-amber-500' : hasAttempts ? 'bg-slate-400' : 'bg-line'
                      }`}
                    />

                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 pl-2">
                      <div className="space-y-2 max-w-2xl">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-bold text-brand uppercase tracking-wider bg-brand/5 border border-brand/20 px-2 py-0.5 rounded">
                            {exp.category ?? 'Network Security'}
                          </span>
                          <span className="text-muted bg-canvas border border-line px-2 py-0.5 rounded">
                            Level: {exp.difficulty}
                          </span>
                          <span className="text-muted bg-canvas border border-line px-2 py-0.5 rounded flex items-center gap-1">
                            <Clock size={12} />
                            <span>{exp.estimatedTimeMinutes} min</span>
                          </span>
                        </div>

                        <h3 className="text-lg font-bold text-ink">{exp.title}</h3>
                        <p className="text-xs text-muted leading-relaxed">{exp.description}</p>

                        <div className="pt-2 flex flex-wrap items-center gap-4 text-xs text-muted">
                          <span>
                            Attempts logged: <strong className="text-ink">{expAttempts.length}</strong>
                          </span>
                          <span>•</span>
                          <span>
                            Last activity:{' '}
                            <strong className="text-ink">
                              {latestAttempt ? dateTime(latestAttempt.completedAt ?? latestAttempt.startedAt) : 'Never attempted'}
                            </strong>
                          </span>
                        </div>
                      </div>

                      {/* Right Evaluation Status & CTA */}
                      <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end justify-between gap-3 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-line">
                        <div className="flex items-center gap-3">
                          {isCompleted ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 size={14} />
                              <span>Completed · {bestScore}/100</span>
                            </span>
                          ) : isRunning ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <RotateCcw size={14} className="animate-spin" />
                              <span>In Progress</span>
                            </span>
                          ) : hasAttempts ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              <span>Incomplete</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-canvas text-muted border border-line">
                              <span>Not Started</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {latestAttempt?.reportAvailable && latestAttempt.reportId && (
                            <a
                              href={`${api.defaults.baseURL}/reports/${latestAttempt.reportId}/download`}
                              target="_blank"
                              rel="noreferrer"
                              className="button-secondary text-xs py-1.5 px-3 gap-1"
                            >
                              <FileText size={13} />
                              <span>Report</span>
                            </a>
                          )}
                          <Link
                            to={`/experiments/${exp._id}`}
                            className="button text-xs py-1.5 px-3 gap-1 font-semibold"
                          >
                            <span>{isCompleted ? 'Review Lab' : isRunning ? 'Resume Lab' : 'Start Lab'}</span>
                            <Play size={12} />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
