import { Link } from 'react-router-dom';
import { LoadingState, ErrorState } from '../components/common/QueryState';
import { useCallback, useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardCheck,
  HelpCircle,
  Radio,
  Send,
  ShieldCheck,
  SquareTerminal,
  StopCircle,
  X,
} from 'lucide-react';
import { api, errorMessage } from '../services/api';
import type { Experiment, LabSession, RuleResult, QuizSubmitResponse, TaskSubmitResponse } from '../types/api';
import { Terminal } from '../components/terminal/Terminal';
import { RuleResults } from '../components/lab/RuleResults';
import { CompletionPanel } from '../components/lab/CompletionPanel';

interface Completion {
  totalScore: number;
  quizScore: number;
  quizTotalMarks: number;
  downloadUrl: string | null;
  reportError: string | null;
}

export function LabWorkspace() {
  const { labSessionId = '' } = useParams();
  const state = useLocation().state as { attemptId?: string; experiment?: Experiment } | null;

  const [output, setOutput] = useState('');
  const [command, setCommand] = useState('');
  const [notice, setNotice] = useState('');
  const [ruleResults, setRuleResults] = useState<RuleResult[]>([]);
  const [taskFeedback, setTaskFeedback] = useState('');
  const [lastGrade, setLastGrade] = useState<{ title: string; score: number } | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<'task' | 'quiz' | 'stop' | null>(null);
  const [connection, setConnection] = useState('Connecting');
  const [quizFeedback, setQuizFeedback] = useState<QuizSubmitResponse['answers']>([]);
  const [completion, setCompletion] = useState<Completion | null>(null);

  const labQuery = useQuery({
    queryKey: ['lab', labSessionId],
    queryFn: () => api.get<{ labSession: LabSession }>(`/labs/${labSessionId}`).then(r => r.data.labSession),
    refetchInterval: 15000,
  });

  const lab = labQuery.data;
  const attemptId = state?.attemptId ?? lab?.attemptId;

  const attemptQuery = useQuery({
    queryKey: ['attempt', attemptId],
    enabled: Boolean(attemptId),
    queryFn: () => api.get<{ attempt: { experiment: Experiment; currentTaskIndex: number } }>(`/attempts/${attemptId}`).then(r => r.data.attempt),
  });

  const attempt = attemptQuery.data;
  const experiment = attempt?.experiment ?? state?.experiment;

  useEffect(() => {
    if (attempt) setIndex(attempt.currentTaskIndex);
  }, [attempt, state?.experiment]);

  const append = useCallback((chunk: string) => setOutput(value => (value + chunk).slice(-50000)), []);

  const active = lab?.status === 'running' && !labQuery.isError && !completion;
  if (labQuery.isPending) return <LoadingState message="Checking lab session..." />;
  if (labQuery.isError || !lab) return <div className="space-y-4"><Link to="/experiments" className="button-secondary">Exit to catalogue</Link><ErrorState message="Unable to load lab session." onRetry={() => { void labQuery.refetch(); }} retrying={labQuery.isFetching} /></div>;
  if (attemptQuery.isError) return <div className="space-y-4"><Link to="/experiments" className="button-secondary">Exit to catalogue (does not stop lab)</Link><ErrorState message="Unable to restore attempt instructions." onRetry={() => { void attemptQuery.refetch(); }} retrying={attemptQuery.isFetching} /></div>;
  if (!experiment) {
    return <div className="space-y-4"><p role="status" className="panel p-4">Lab session: {lab.status}. {lab.failureReason}</p><LoadingState message="Restoring laboratory instructions..." /><Link to="/experiments" className="button-secondary">Exit to catalogue (does not stop lab)</Link></div>;
  }

  const task = experiment.tasks[index];
  const experimentVictim = experiment.lab.profile === 'shell-target-v1' || experiment.lab.profile === 'recon-v1'
    ? experiment.lab.target
    : experiment.lab.profile === 'dos-analysis-v1'
      ? experiment.lab.resources.find(resource => resource.role === 'victim')
      : undefined;
  const targetHostname = lab?.targetHostname ?? experimentVictim?.hostname ?? 'Internal Sandbox';
  const targetDisplayName = lab?.targetDisplayName ?? experimentVictim?.displayName ?? 'Isolated Laboratory Environment';
  const terminalPrompt = lab?.terminalPrompt ?? experiment.lab.terminal.promptLabel;

  const submit = async () => {
    if (!active || busy || !attemptQuery.isSuccess) return;
    if (!attemptId || !task || !command.trim()) {
      return setNotice('Enter the command you ran before verification.');
    }
    setBusy('task');
    setNotice('');
    try {
      const { data } = await api.post<TaskSubmitResponse>(`/tasks/${task.id}/submit`, {
        attemptId,
        command,
      });
      setRuleResults(data.result.ruleResults ?? []);
      setTaskFeedback(data.result.feedback ?? '');
      setLastGrade({ title: task.title, score: data.result.score });
      setNotice(data.result.passed ? 'Task verified. Progress saved.' : 'Task not yet verified. Review the feedback and try again.');
      if (data.result.passed) {
        setIndex(data.currentTaskIndex);
        setCommand('');
      }
    } catch (error) {
      setNotice(errorMessage(error));
      setRuleResults([]);
      setTaskFeedback('');
      setLastGrade(null);
    } finally { setBusy(null); }
  };

  const quiz = async () => {
    if (!attemptId || !active || busy || !attemptQuery.isSuccess) return;
    setBusy('quiz');
    setNotice('');
    try {
      const { data } = await api.post<QuizSubmitResponse>(`/quizzes/${experiment._id}/submit`, {
        attemptId,
        answers: Object.entries(answers).map(([questionId, selectedOption]) => ({
          questionId,
          selectedOption,
        })),
      });
      setQuizFeedback(data.answers);
      setCompletion({
        totalScore: data.totalScore,
        quizScore: data.score,
        quizTotalMarks: data.totalMarks,
        downloadUrl: data.downloadUrl,
        reportError: data.reportError,
      });
      void labQuery.refetch();
    } catch (error) {
      setNotice(errorMessage(error));
    } finally { setBusy(null); }
  };

  return (
    <div className="space-y-6">
      {/* ── Top Workspace Header ──────────────────────────────────────── */}
      <div className="panel p-5 bg-surface border border-line shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-brand/5 border border-brand/20 text-brand">

              Somaiya Virtual Labs · Session {lab.status}
            </span>
            <span className="text-xs text-muted font-medium bg-canvas px-2.5 py-0.5 rounded border border-line">
              Target: <code className="font-mono text-brand font-bold">{targetHostname}</code>
            </span>
          </div>
          <h1 className="text-lg sm:text-xl font-black text-ink tracking-tight uppercase font-sans">
            {experiment.title}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link className="button-secondary text-xs" to="/experiments">Exit to catalogue</Link>
          <button
            className="button-secondary text-xs gap-1.5 py-2 px-3 text-danger border-danger/30 hover:bg-danger/5 hover:border-danger hover:text-danger font-semibold"
            disabled={Boolean(busy) || ['stopped', 'expired', 'stopping'].includes(lab.status)}
            onClick={async () => {
              if (!window.confirm('End this lab session? Unsubmitted work will be lost. Saved grading records are retained.')) return;
              setBusy('stop'); setNotice('');
              try { await api.post(`/labs/${labSessionId}/stop`); await labQuery.refetch(); }
              catch (error) { setNotice(errorMessage(error)); }
              finally { setBusy(null); }
            }}
          >
            <StopCircle size={15} />
            <span>{busy === 'stop' ? 'Stopping...' : 'End Lab Session'}</span>
          </button>
        </div>
      </div>

      {/* ── Main Split Grid: Guided Tasks & Terminal ───────────────────────────── */}
      <section className="panel p-4 space-y-2" aria-label="Lab session state">
        <p role="status" className="font-semibold">{({ provisioning: 'Provisioning lab environment', running: 'Lab environment active', stopping: 'Lab cleanup in progress', stopped: 'Lab session stopped', expired: 'Lab session expired', failed: 'Lab session failed' } as Record<string, string>)[lab.status] ?? `Lab status: ${lab.status}`}</p>
        {lab.failureReason && <p className="text-sm text-danger">{lab.failureReason}</p>}
        <p className="text-xs text-muted">{active ? `Expires: ${new Date(lab.expiresAt).toLocaleString()}. Exiting this page does not stop the lab; use End Lab Session to release it.` : 'Terminal input and grading are unavailable while the lab is not active.'}</p>
        {lab.status === 'running' && <p className="text-xs text-muted">Provider: {lab.backend === 'qemu' ? 'Real Kali VM' : lab.backend === 'docker' ? 'Docker' : 'Not specified'}</p>}
      </section>
      {notice && <p role="alert" className="panel p-4 text-sm">{notice}</p>}
      <details className="panel p-5"><summary className="font-bold cursor-pointer">Experiment instructions and safety</summary>
        <p className="page-description">{experiment.aim}</p>
        <ol className="list-decimal pl-5 mt-3 space-y-2 text-sm">{experiment.procedureSections.map((step, i) => <li key={i}>{step}</li>)}</ol>
        <p className="mt-4 text-sm font-semibold">Use only the assigned target: {targetHostname}. Never scan external systems.</p>
        {experiment.lab.profile === 'shell-target-v1' && <p className="mt-2 text-sm">Nmap: execute the requested scan in the terminal, then submit the exact command for server verification. For real Kali, privileged SYN and OS scans may require sudo.</p>}
      </details>
      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* ── Task Sidebar ──────────────────────────────────────── */}
        <aside className="panel p-5 bg-surface border border-line flex flex-col justify-between">
          <div>
            <div className="border-b border-line pb-3 mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-ink">Guided Practical Tasks</h2>
                <p className="text-[11px] text-muted">Complete tasks sequentially for verification</p>
              </div>
              <span className="text-xs font-bold text-brand bg-brand/5 px-2 py-0.5 rounded border border-brand/20">
                {Math.min(index, experiment.tasks.length)} / {experiment.tasks.length}
              </span>
            </div>

            <div className="space-y-3">
              {experiment.tasks.map((item, itemIndex) => {
                const isPassed = itemIndex < index;
                const isCurrent = itemIndex === index;

                return (
                  <div
                    key={item.id}
                    aria-current={isCurrent ? 'step' : undefined}
                    className={`rounded-lg border p-3.5 transition-all ${
                      isPassed
                        ? 'border-emerald-300 bg-emerald-50/60'
                        : isCurrent
                        ? 'border-brand bg-brand/5 ring-1 ring-brand/20 shadow-xs'
                        : 'border-line bg-canvas/50 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {isPassed ? (
                          <div className="p-0.5 rounded-full bg-emerald-600 text-white shrink-0">
                            <Check size={12} strokeWidth={3} />
                          </div>
                        ) : isCurrent ? (
                          <span className="w-5 h-5 rounded-full bg-brand text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                            {item.order}
                          </span>
                        ) : (
                          <span className="w-5 h-5 rounded-full bg-muted/20 text-muted font-bold text-[11px] flex items-center justify-center shrink-0">
                            {item.order}
                          </span>
                        )}
                        <span className={`text-xs font-bold ${isCurrent ? 'text-ink' : isPassed ? 'text-emerald-900' : 'text-muted'}`}>
                          {item.title}
                        </span>
                      </div>
                      <span className="text-[11px] font-bold text-muted shrink-0">
                        {item.marks} pts
                      </span>
                    </div>

                    {isCurrent && (
                      <div className="mt-3 pt-2.5 border-t border-brand/15 text-xs space-y-2">
                        <p className="text-ink leading-relaxed">{item.description}</p>
                        {item.hints?.[0] && (
                          <div className="p-2.5 rounded bg-surface border border-line flex items-start gap-2 text-[11px] text-brand">
                            <HelpCircle size={14} className="shrink-0 mt-0.5" />
                            <span><strong>Hint:</strong> {item.hints[0]}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-line text-xs text-muted space-y-1">
            <p className="flex items-center gap-1.5 text-ink font-semibold">
              <ShieldCheck size={14} className="text-brand" />
              <span>Target Constraint</span>
            </p>
            <p className="text-[11px] leading-relaxed">
              Scan &amp; probe only <code className="font-mono text-brand font-bold">{targetHostname}</code> ({targetDisplayName}). Private network isolation is enforced.
            </p>
          </div>
        </aside>

        {/* ── Terminal & Task Verification Section ───────────────────────────── */}
        <div className="space-y-4 min-w-0">
          <div className="panel overflow-hidden border border-line bg-terminal shadow-md rounded-xl">
            {/* Terminal Window Header */}
            <div className="flex flex-wrap gap-3 items-center justify-between border-b border-slate-700/80 bg-[#161B26] px-4 py-2.5 text-xs text-slate-200">
              <div className="flex items-center gap-2">
                <SquareTerminal size={15} className="text-emerald-400" />
                <span className="font-mono text-slate-300 font-semibold">{terminalPrompt}</span>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-mono">
                <span className="text-slate-400">Target: <span className="text-emerald-300 font-bold">{targetHostname}</span></span>
                <span role="status" className="text-slate-200">{active ? connection : 'Disconnected'}</span>
              </div>
            </div>

            {/* Terminal Canvas */}
            <div className="p-2 bg-terminal min-h-[360px]">
              {active ? <Terminal labSessionId={labSessionId} targetHostname={targetHostname} onOutput={append} onConnectionChange={setConnection} /> : <p className="p-6 text-sm text-slate-200">{completion ? 'Assessment submitted. Terminal closed.' : `Terminal unavailable: ${lab.status}.`}</p>}
            </div>
          </div>

          {/* Verification Command Submission Box */}
          {task && (
            <div className="panel p-5 bg-surface border border-line shadow-xs space-y-3">
              <div className="flex flex-wrap gap-2 items-center justify-between">
                <label htmlFor="verification-command" className="text-xs font-bold uppercase tracking-wider text-ink">
                  Task {task.order} Command Submission
                </label>
                <span className="text-xs text-muted">Enter exact tool invocation used in terminal</span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  id="verification-command"
                  disabled={!active || Boolean(busy) || !attemptQuery.isSuccess}
                  className="field font-mono text-xs sm:text-sm bg-canvas"
                  value={command}
                  onChange={event => setCommand(event.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') submit(); }}
                  placeholder={experiment.lab.profile === 'shell-target-v1' ? `e.g. nmap -sn ${targetHostname}` : 'Enter the command you executed'}
                />
                <button
                  className="button text-xs gap-1.5 py-2 px-5 font-bold shadow-xs shrink-0"
                  disabled={!active || Boolean(busy) || !attemptQuery.isSuccess}
                  onClick={submit}
                >
                  <Send size={14} />
                  <span>{busy === 'task' ? 'Verifying...' : 'Verify Task'}</span>
                </button>
              </div>

            </div>
          )}
          {lastGrade && <p className="text-sm font-semibold" role="status">Last verification: {lastGrade.title} | {lastGrade.score} points awarded</p>}
          <RuleResults ruleResults={ruleResults} feedback={taskFeedback} />
        </div>
      </div>

      {/* ── Section: Knowledge Check Quiz ────────────────────────────────────────── */}
      {index >= experiment.tasks.length && !completion && active && attemptQuery.isSuccess && (
        <section className="panel p-6 sm:p-8 bg-surface border border-line shadow-xs space-y-6">
          <div className="border-b border-line pb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded bg-brand/10 text-brand">
                <ClipboardCheck size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-ink uppercase tracking-wide">
                  Laboratory Assessment · Knowledge Check
                </h2>
                <p className="text-xs text-muted">
                  Answer the theoretical comprehension questions to calculate your final practical score and generate your official report.
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-brand bg-brand/5 border border-brand/20 px-3 py-1 rounded">
              Final Evaluation
            </span>
          </div>

          <div className="space-y-6">
            {experiment.quiz.questions.map((question, qIdx) => (
              <fieldset key={question.id} className="p-5 rounded-lg bg-canvas border border-line space-y-3">
                <legend className="text-sm font-bold text-ink px-2">
                  Question {qIdx + 1}: {question.question}
                </legend>

                <div className="space-y-2 mt-2">
                  {question.options.map((option, optionIndex) => {
                    const isSelected = answers[question.id] === optionIndex;

                    return (
                      <label
                        key={option}
                        className={`flex items-center gap-3 p-3 rounded-md border text-xs sm:text-sm font-medium cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-surface border-brand text-brand ring-1 ring-brand'
                            : 'bg-surface border-line text-ink hover:border-brand/40'
                        }`}
                      >
                        <input
                          type="radio"
                          name={question.id}
                          className="accent-brand cursor-pointer"
                          checked={isSelected}
                          onChange={() => setAnswers(value => ({ ...value, [question.id]: optionIndex }))}
                        />
                        <span>{option}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>

          <div className="pt-4 border-t border-line flex flex-wrap gap-3 items-center justify-between">
            <span className="text-xs text-muted">
              {Object.keys(answers).length} of {experiment.quiz.questions.length} questions answered
            </span>
            <button
              disabled={Boolean(busy) || Object.keys(answers).length !== experiment.quiz.questions.length}
              className="button text-sm gap-2 py-2.5 px-6 font-bold shadow-xs"
              onClick={quiz}
            >
              <span>{busy === 'quiz' ? 'Submitting assessment...' : 'Submit Practical & Generate Report'}</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </section>
      )}

      {/* ── Section: Completion Panel ────────────────────────────────────── */}
      {completion && <section className="panel p-5 space-y-3" aria-label="Quiz feedback"><h2 className="text-lg font-bold">Assessment feedback</h2>{quizFeedback.map(answer => <div key={answer.questionId} className="border-b border-line pb-3"><p className="font-semibold">{experiment.quiz.questions.find(question => question.id === answer.questionId)?.question}</p><p className="text-sm">{answer.correct ? 'Correct' : 'Incorrect'}: {answer.explanation}</p></div>)}<Link className="button-secondary" to="/history">View attempt history</Link></section>}
      {completion && (
        <CompletionPanel
          totalScore={completion.totalScore}
          quizScore={completion.quizScore}
          quizTotalMarks={completion.quizTotalMarks}
          downloadUrl={completion.downloadUrl}
          reportError={completion.reportError}
        />
      )}
    </div>
  );
}
