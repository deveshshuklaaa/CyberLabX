import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Filter,
  History,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { useState } from 'react';
import { api } from '../services/api';
import type { StudentHistoryAttempt, StudentHistoryData, StudentDashboardData } from '../types/api';

const dateTime = (value?: string) =>
  value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : '—';

const readableStatus = (status: StudentHistoryAttempt['status']) =>
  ({ completed: 'Completed', running: 'In Progress', expired: 'Expired', failed: 'Failed' }[status] ?? status);

export function StudentHistory() {
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const history = useQuery({
    queryKey: ['student-history'],
    queryFn: async (): Promise<StudentHistoryAttempt[]> => {
      try {
        const { data } = await api.get<StudentHistoryData>('/student/history');
        // Guard: ensure we always return an array
        if (Array.isArray(data?.attempts)) return data.attempts;
        if (Array.isArray(data)) return data as unknown as StudentHistoryAttempt[];
        return [];
      } catch {
        // Fallback to recentAttempts from dashboard endpoint if history endpoint fails
        try {
          const { data } = await api.get<StudentDashboardData>('/student/dashboard');
          return Array.isArray(data?.recentAttempts)
            ? (data.recentAttempts as StudentHistoryAttempt[])
            : [];
        } catch {
          return [];
        }
      }
    },
  });

  const allAttempts = Array.isArray(history.data) ? history.data : [];

  const filtered = allAttempts.filter(att => {
    if (statusFilter === 'all') return true;
    return att.status === statusFilter;
  });

  return (
    <div className="space-y-8">
      {/* ── Page Header ── */}
      <div className="border-b border-line pb-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-brand bg-brand/5 border border-brand/20 px-2.5 py-0.5 rounded">
            Somaiya Vidyavihar University
          </span>
          <span className="text-xs font-semibold text-muted bg-canvas border border-line px-2.5 py-0.5 rounded">
            Official Evaluation Records
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-ink uppercase tracking-tight font-sans">
          Practical Attempt History
        </h1>
        <p className="mt-1 text-sm text-muted max-w-3xl leading-relaxed">
          Complete chronological record of all laboratory sessions, automated rule verifications, scores, and downloadable academic evaluation reports.
        </p>
      </div>

      {/* ── Filters & Controls ── */}
      <div className="panel p-4 bg-surface border border-line shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <Filter size={15} className="text-muted mr-1 shrink-0" />
          {['all', 'completed', 'running', 'expired', 'failed'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold capitalize transition-colors whitespace-nowrap ${
                statusFilter === status
                  ? 'bg-brand text-white shadow-xs'
                  : 'bg-canvas text-muted hover:text-ink hover:bg-slate-200'
              }`}
            >
              {status === 'all' ? 'All Attempts' : readableStatus(status as any)}
            </button>
          ))}
        </div>

        <span className="text-xs text-muted font-medium bg-canvas border border-line px-3 py-1 rounded">
          {filtered.length} {filtered.length === 1 ? 'Record' : 'Records'}
        </span>
      </div>

      {/* ── Loading & Error States ── */}
      {history.isLoading && (
        <div className="panel p-12 text-center" data-testid="history-loading">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-brand border-t-transparent mb-3" />
          <p className="text-sm text-muted">Retrieving student academic records…</p>
        </div>
      )}

      {history.error && (
        <div className="panel p-6 border-danger/30 bg-danger/5" data-testid="history-error">
          <p className="text-sm font-semibold text-danger">Unable to load practical history. Please try again.</p>
        </div>
      )}

      {/* ── Attempt History Content ── */}
      {!history.isLoading && !history.error && (
        <>
          {filtered.length === 0 ? (
            <div className="panel p-12 text-center" data-testid="history-empty">
              <History size={36} className="mx-auto text-muted/50 mb-3" />
              <h3 className="text-base font-bold text-ink">No attempt records found</h3>
              <p className="text-xs text-muted mt-1">
                {statusFilter === 'all'
                  ? 'You have not initiated any virtual laboratory practicals yet.'
                  : `No attempts with status "${readableStatus(statusFilter as any)}" found.`}
              </p>
              <Link to="/experiments" className="button mt-5 inline-flex text-xs py-2 px-4 gap-1.5">
                <span>Browse Experiments</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Desktop Table View */}
              <div className="panel overflow-hidden border border-line bg-surface shadow-xs hidden md:block">
                <table className="min-w-full text-left text-sm" data-testid="history-table">
                  <thead className="bg-canvas border-b border-line text-muted text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3.5 font-semibold">Laboratory Practical</th>
                      <th className="px-5 py-3.5 font-semibold">Category</th>
                      <th className="px-5 py-3.5 font-semibold">Status</th>
                      <th className="px-5 py-3.5 font-semibold">Final Grade</th>
                      <th className="px-5 py-3.5 font-semibold">Started At</th>
                      <th className="px-5 py-3.5 font-semibold">Completed At</th>
                      <th className="px-5 py-3.5 font-semibold text-right">Official Report</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {filtered.map(attempt => {
                      const statusColor = {
                        completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                        running: 'bg-amber-50 text-amber-700 border-amber-200',
                        expired: 'bg-slate-100 text-slate-700 border-slate-200',
                        failed: 'bg-rose-50 text-rose-700 border-rose-200',
                      }[attempt.status];

                      return (
                        <tr key={attempt.attemptId} className="hover:bg-canvas/50 transition-colors">
                          <td className="px-5 py-4 font-bold text-ink">
                            {attempt.experimentTitle ?? 'Experiment unavailable'}
                          </td>
                          <td className="px-5 py-4 text-xs text-muted">
                            {attempt.experimentCategory ?? 'Network Security'}
                          </td>
                          <td className="px-5 py-4">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusColor}`}>
                              {readableStatus(attempt.status)}
                            </span>
                          </td>
                          <td className="px-5 py-4 font-bold text-ink">
                            {attempt.score === null ? '—' : `${attempt.score}/100`}
                          </td>
                          <td className="px-5 py-4 text-xs text-muted font-mono">
                            {dateTime(attempt.startedAt)}
                          </td>
                          <td className="px-5 py-4 text-xs text-muted font-mono">
                            {dateTime(attempt.completedAt)}
                          </td>
                          <td className="px-5 py-4 text-right">
                            {attempt.reportAvailable && attempt.reportId ? (
                              <a
                                href={`${api.defaults.baseURL}/reports/${attempt.reportId}/download`}
                                target="_blank"
                                rel="noreferrer"
                                className="button-secondary text-xs py-1.5 px-3 gap-1.5 font-semibold inline-flex"
                              >
                                <Download size={13} />
                                <span>Download</span>
                              </a>
                            ) : (
                              <span className="text-muted text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Stacked Card View */}
              <div className="md:hidden space-y-3" data-testid="history-mobile-cards">
                {filtered.map(attempt => {
                  const statusColor = {
                    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    running: 'bg-amber-50 text-amber-700 border-amber-200',
                    expired: 'bg-slate-100 text-slate-700 border-slate-200',
                    failed: 'bg-rose-50 text-rose-700 border-rose-200',
                  }[attempt.status];

                  return (
                    <div key={attempt.attemptId} className="panel p-4 bg-surface border border-line shadow-xs space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-brand bg-brand/5 border border-brand/20 px-2 py-0.5 rounded">
                            {attempt.experimentCategory ?? 'Network Security'}
                          </span>
                          <h3 className="font-bold text-ink text-sm mt-1">
                            {attempt.experimentTitle ?? 'Experiment unavailable'}
                          </h3>
                        </div>
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold border shrink-0 ${statusColor}`}>
                          {readableStatus(attempt.status)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-line">
                        <div>
                          <p className="text-muted text-[11px]">Score</p>
                          <p className="font-bold text-ink">{attempt.score === null ? '—' : `${attempt.score}/100`}</p>
                        </div>
                        <div>
                          <p className="text-muted text-[11px]">Date</p>
                          <p className="text-muted font-mono">{dateTime(attempt.completedAt ?? attempt.startedAt)}</p>
                        </div>
                      </div>

                      {attempt.reportAvailable && attempt.reportId && (
                        <div className="pt-2 border-t border-line">
                          <a
                            href={`${api.defaults.baseURL}/reports/${attempt.reportId}/download`}
                            target="_blank"
                            rel="noreferrer"
                            className="button-secondary w-full text-xs py-2 gap-1.5 justify-center font-semibold"
                          >
                            <Download size={14} />
                            <span>Download Academic Report</span>
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Security & Auditing Assurance ── */}
      <div className="panel p-5 bg-canvas border border-line text-xs text-muted flex items-start gap-3">
        <ShieldCheck size={20} className="text-brand shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-ink">Verifiable Student Records Policy</p>
          <p className="mt-0.5 leading-relaxed">
            All attempts are cryptographically verified and recorded server-side against student identity.
            Evaluation reports are generated automatically upon successful task submission and completion quiz verification.
          </p>
        </div>
      </div>
    </div>
  );
}
