import { LoadingState, ErrorState } from '../components/common/QueryState';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock,
  HelpCircle,
  Layers,
  ListOrdered,
  Play,
  ShieldAlert,
  ShieldCheck,
  Target,
} from 'lucide-react';
import { useState } from 'react';
import { api, errorMessage } from '../services/api';
import type { Experiment } from '../types/api';

export function ExperimentOverview() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);

  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: ['experiment', id],
    queryFn: () => api.get<{ experiment: Experiment }>(`/experiments/${id}`).then(r => r.data.experiment),
  });

  const start = async () => {
    if (starting) return;
    setStarting(true);
    setError('');
    try {
      const { data: response } = await api.post('/labs/start', { experimentId: id });
      navigate(`/labs/${response.labSession.id}`, {
        state: { attemptId: response.attemptId, experiment: data },
      });
    } catch (err) {
      const message = errorMessage(err);
      setError(message);
      const labId = (err as any).response?.data?.labSessionId;
      if (labId) navigate(`/labs/${labId}`);
    } finally {
      setStarting(false);
    }
  };

  if (isPending) return <LoadingState message="Loading experiment details..." />;
  if (isError || !data) return <div className="space-y-4"><Link to="/experiments" className="button-secondary">Back to catalogue</Link><ErrorState message="Unable to load experiment details." onRetry={() => { void refetch(); }} retrying={isFetching} /></div>;

  const totalTaskMarks = data.tasks.reduce((sum, t) => sum + t.marks, 0);
  const quizMarks = data.quiz?.questions.reduce((sum, q) => sum + q.marks, 0) ?? 0;
  const totalMarks = totalTaskMarks + quizMarks;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* ── Breadcrumb & Back Link ── */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <Link
          to="/experiments"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-brand transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Back to Virtual Labs Catalog</span>
        </Link>

        <span className="text-xs font-semibold text-muted bg-canvas border border-line px-2.5 py-1 rounded">
          Somaiya Vidyavihar University · Practical Module
        </span>
      </div>

      {/* ── Main Syllabus Header Card ── */}
      <article className="panel p-6 sm:p-9 bg-surface border border-line shadow-xs relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-brand" />

        {/* Academic Badges */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-brand bg-brand/5 border border-brand/20 px-2.5 py-0.5 rounded">
            {data.category || 'Uncategorized'}
          </span>
          <span className="text-xs font-semibold text-muted bg-canvas border border-line px-2.5 py-0.5 rounded flex items-center gap-1">
            <Clock size={12} />
            <span>{data.estimatedTimeMinutes} min</span>
          </span>
          <span className="text-xs font-semibold text-ink bg-canvas border border-line px-2.5 py-0.5 rounded">
            Level: {data.difficulty}
          </span>
          <span className="text-xs font-semibold text-muted bg-canvas border border-line px-2.5 py-0.5 rounded">
            Assessment: {totalMarks} Total Marks
          </span>
        </div>

        {/* Experiment Title */}
        <h1 className="text-2xl sm:text-3xl font-black text-ink tracking-tight uppercase font-sans">
          {data.title}
        </h1>

        <p className="page-description whitespace-pre-wrap">{data.description}</p>
        {data.lab.profile === 'shell-target-v1' && <p className="mt-4 text-sm text-muted">Nmap: use only the assigned target shown in the workspace. The configured provider may use Docker or real Kali; a connection message alone does not verify a successful scan.</p>}
        {/* Aim Statement */}
        <div className="mt-4 p-4 rounded-lg bg-canvas border-l-4 border-brand">
          <p className="text-xs font-bold uppercase tracking-wider text-brand mb-1">Academic Aim</p>
          <p className="text-sm sm:text-base text-ink font-medium leading-relaxed">{data.aim}</p>
        </div>

        {/* Security / Containment Banner */}
        <div className="mt-5 border-l-4 border-brand bg-brand/5 p-4 rounded-r-lg text-xs sm:text-sm text-ink flex items-start gap-2.5">
          <ShieldCheck className="shrink-0 text-brand mt-0.5" size={18} />
          <div>
            <span className="font-bold text-brand">Institutional Laboratory Protocol: </span>
            <span>
              All lab traffic is restricted to Somaiya Virtual Labs’ private disposable network.
              Never target systems you do not own or have permission to test.
            </span>
          </div>
        </div>

        {/* Start Lab Button */}
        {error && (
          <div role="alert" className="mt-5 p-3.5 rounded-lg border border-danger/30 bg-danger/5 text-xs text-danger flex items-center gap-2">
            <ShieldAlert size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-6 pt-5 border-t border-line flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-xs text-muted">
            Start Lab requests the configured isolated lab provider. Provisioning can take a few moments.
          </div>
          <button
            onClick={start}
            disabled={starting}
            className="button text-sm gap-2 py-2.5 px-6 font-bold shadow-xs whitespace-nowrap"
          >
            <Play size={16} />
            <span>{starting ? 'Provisioning Secure Lab…' : 'Start Experiment Lab'}</span>
          </button>
        </div>
      </article>

      {/* ── Two-Column Objectives & Procedure ── */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Learning Objectives */}
        <section className="panel p-6 bg-surface border border-line">
          <div className="flex items-center gap-2 border-b border-line pb-3 mb-4">
            <Target className="text-brand" size={18} />
            <h2 className="text-base font-bold text-ink uppercase tracking-wide">Learning Objectives</h2>
          </div>
          <ul className="space-y-3 text-xs sm:text-sm text-muted">
            {data.objectives.map((item, i) => (
              <li className="flex items-start gap-2.5" key={i}>
                <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={16} />
                <span className="text-ink font-medium leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Practical Plan / Procedure */}
        <section className="panel p-6 bg-surface border border-line">
          <div className="flex items-center gap-2 border-b border-line pb-3 mb-4">
            <ListOrdered className="text-brand" size={18} />
            <h2 className="text-base font-bold text-ink uppercase tracking-wide">Laboratory Procedure</h2>
          </div>
          <ol className="space-y-3.5 text-xs sm:text-sm text-muted">
            {data.procedureSections.map((item, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-brand/10 text-brand font-bold text-xs flex items-center justify-center">
                  0{index + 1}
                </span>
                <span className="text-ink font-medium leading-relaxed">{item}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {/* ── Guided Tasks & Verification Breakdown ── */}
      <section className="panel p-6 sm:p-7 bg-surface border border-line">
        <div className="flex flex-wrap gap-3 items-center justify-between border-b border-line pb-3 mb-5">
          <div className="flex items-center gap-2">
            <Layers className="text-brand" size={18} />
            <h2 className="text-base font-bold text-ink uppercase tracking-wide">Guided Practical Tasks</h2>
          </div>
          <span className="text-xs font-semibold text-muted bg-canvas px-2.5 py-1 rounded border border-line">
            {data.tasks.length} Step-by-Step Tasks ({totalTaskMarks} Marks)
          </span>
        </div>

        <div className="space-y-3">
          {data.tasks.map(task => (
            <div
              key={task.id}
              className="p-4 rounded-lg bg-canvas border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-brand uppercase tracking-wider">
                    Task {task.order}
                  </span>
                  <span className="text-ink font-bold text-sm">{task.title}</span>
                </div>
                <p className="text-xs text-muted mt-1 leading-relaxed">{task.description}</p>
              </div>
              <span className="shrink-0 text-xs font-bold text-brand bg-surface border border-line px-3 py-1 rounded">
                {task.marks} Marks
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Theoretical Background ── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-line pb-2">
          <BookOpen className="text-brand" size={18} />
          <h2 className="text-base font-bold text-ink uppercase tracking-wide">Theoretical Background</h2>
        </div>

        <div className="space-y-4">
          {data.theorySections.map((section, idx) => (
            <article className="panel p-6 bg-surface border border-line" key={idx}>
              <h3 className="font-bold text-ink text-sm sm:text-base border-b border-line pb-2 mb-3">
                {section.title}
              </h3>
              <p className="text-xs sm:text-sm leading-relaxed text-muted font-normal whitespace-pre-wrap break-words">{section.content}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <div className="panel p-6 bg-canvas border border-line rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-ink">Ready to start the practical?</p>
          <p className="text-xs text-muted">You will be provided an authenticated Linux shell in an isolated network.</p>
        </div>
        <button
          onClick={start}
          disabled={starting}
          className="button text-sm gap-2 py-2.5 px-6 font-bold shadow-xs whitespace-nowrap"
        >
          <Play size={16} />
          <span>{starting ? 'Provisioning Secure Lab…' : 'Start Experiment Lab'}</span>
        </button>
      </div>
    </div>
  );
}
