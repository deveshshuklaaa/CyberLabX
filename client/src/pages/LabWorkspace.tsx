import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Check, ClipboardCheck, Send, SquareTerminal, X } from 'lucide-react';
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
  const navigate = useNavigate();
  const state = useLocation().state as { attemptId?: string; experiment?: Experiment } | null;

  const [output, setOutput] = useState('');
  const [command, setCommand] = useState('');
  const [notice, setNotice] = useState('');
  const [ruleResults, setRuleResults] = useState<RuleResult[]>([]);
  const [taskFeedback, setTaskFeedback] = useState('');
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [completion, setCompletion] = useState<Completion | null>(null);

  const { data: lab } = useQuery({
    queryKey: ['lab', labSessionId],
    queryFn: () => api.get<{ labSession: LabSession }>(`/labs/${labSessionId}`).then(r => r.data.labSession),
    refetchInterval: 15000,
  });

  const attemptId = state?.attemptId ?? lab?.attemptId;

  const { data: attempt } = useQuery({
    queryKey: ['attempt', attemptId],
    enabled: Boolean(attemptId),
    queryFn: () => api.get<{ attempt: { experiment: Experiment; currentTaskIndex: number } }>(`/attempts/${attemptId}`).then(r => r.data.attempt),
  });

  const experiment = state?.experiment ?? attempt?.experiment;

  useEffect(() => {
    if (!state?.experiment && attempt) setIndex(attempt.currentTaskIndex);
  }, [attempt, state?.experiment]);

  const append = useCallback((chunk: string) => setOutput(value => (value + chunk).slice(-50000)), []);

  if (!experiment) {
    return (
      <section className="panel p-8">
        <h1 className="text-xl font-semibold">Restoring lab workspace…</h1>
        <p className="mt-2 text-muted">Fetching saved progress.</p>
      </section>
    );
  }

  const task = experiment.tasks[index];
  const experimentVictim = experiment.lab.profile === 'shell-target-v1'
    ? experiment.lab.target
    : experiment.lab.resources.find(resource => resource.role === 'victim')!;
  const targetHostname = lab?.targetHostname ?? experimentVictim.hostname;
  const targetDisplayName = lab?.targetDisplayName ?? experimentVictim.displayName;
  const terminalPrompt = lab?.terminalPrompt ?? experiment.lab.terminal.promptLabel;

  const submit = async () => {
    if (!attemptId || !task || !command.trim()) {
      return setNotice('Enter the command you ran before verification.');
    }
    try {
      const { data } = await api.post<TaskSubmitResponse>(`/tasks/${task.id}/submit`, {
        attemptId,
        command,
      });
      setRuleResults(data.result.ruleResults ?? []);
      setTaskFeedback(data.result.feedback ?? '');
      setNotice(data.result.passed ? '' : '');
      if (data.result.passed) {
        setIndex(data.currentTaskIndex);
        setCommand('');
      }
    } catch (error) {
      setNotice(errorMessage(error));
      setRuleResults([]);
      setTaskFeedback('');
    }
  };

  const quiz = async () => {
    if (!attemptId) return;
    try {
      const { data } = await api.post<QuizSubmitResponse>(`/quizzes/${experiment._id}/submit`, {
        attemptId,
        answers: Object.entries(answers).map(([questionId, selectedOption]) => ({
          questionId,
          selectedOption,
        })),
      });
      setCompletion({
        totalScore: data.totalScore,
        quizScore: data.score,
        quizTotalMarks: data.totalMarks,
        downloadUrl: data.downloadUrl,
        reportError: data.reportError,
      });
    } catch (error) {
      setNotice(errorMessage(error));
    }
  };

  return (
    <section>
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold tracking-wide text-brand">LAB WORKSPACE · {lab?.status ?? 'connecting'}</p>
          <h1 className="text-xl font-bold text-ink">{experiment.title}</h1>
        </div>
        <button
          className="button-secondary gap-2 text-danger"
          onClick={async () => { await api.post(`/labs/${labSessionId}/stop`); navigate('/'); }}
        >
          <X size={16} />Stop lab
        </button>
      </div>

      {/* ── Main grid ───────────────────────────────────────────── */}
      <div className="grid gap-5 xl:grid-cols-[350px_1fr]">
        {/* ── Task sidebar ──────────────────────────────────────── */}
        <aside className="panel p-5">
          <h2 className="font-semibold">Guided tasks</h2>
          {experiment.tasks.map((item, itemIndex) => (
            <div
              key={item.id}
              className={`mt-3 rounded-lg border p-3 ${itemIndex < index
                  ? 'border-success/40 bg-success/10'
                  : itemIndex === index
                    ? 'border-brand bg-brand/5'
                    : 'border-line opacity-60'
                }`}
            >
              <div className="flex gap-2 font-semibold text-sm">
                {itemIndex < index && <Check size={16} className="text-success" />}
                {item.order}. {item.title}
                <span className="ml-auto text-muted">{item.marks} pts</span>
              </div>
              {itemIndex === index && (
                <>
                  <p className="mt-2 text-sm text-muted">{item.description}</p>
                  <p className="mt-2 text-sm text-brand">Hint: {item.hints[0]}</p>
                </>
              )}
            </div>
          ))}
          <p className="mt-5 text-sm text-muted">
            Only interact with <code className="font-semibold text-brand">{targetHostname}</code> ({targetDisplayName}) inside this private network.
          </p>
        </aside>

        {/* ── Terminal + verification ───────────────────────────── */}
        <div className="panel overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-700 bg-[#151923] px-4 py-3 text-sm text-slate-100">
            <SquareTerminal size={17} className="text-success" />
            {terminalPrompt}
            <span className="ml-auto text-emerald-300">
              Target: {targetHostname}
            </span>
          </div>
          <div className="bg-terminal">
            <Terminal labSessionId={labSessionId} targetHostname={targetHostname} onOutput={append} />
          </div>

          {task && (
            <div className="border-t border-line p-4">
              <label className="label">Command used for task {task.order}</label>
              <div className="flex gap-2">
                <input
                  className="field font-mono text-sm"
                  value={command}
                  onChange={event => setCommand(event.target.value)}
                  placeholder={`Enter the command used against ${targetHostname}`}
                />
                <button className="button gap-2" onClick={submit}>
                  <Send size={16} />Verify
                </button>
              </div>
              {notice && <p className="mt-3 text-sm text-muted">{notice}</p>}
              <RuleResults ruleResults={ruleResults} feedback={taskFeedback} />
            </div>
          )}
        </div>
      </div>

      {/* ── Quiz section ────────────────────────────────────────── */}
      {index >= experiment.tasks.length && !completion && (
        <section className="panel mt-6 p-6">
          <h2 className="flex gap-2 text-lg font-semibold">
            <ClipboardCheck className="text-brand" />Knowledge check
          </h2>
          {experiment.quiz.questions.map(question => (
            <fieldset className="mt-5" key={question.id}>
              <legend>{question.question}</legend>
              {question.options.map((option, optionIndex) => (
                <label className="mt-2 block rounded-lg border border-line p-3 text-sm" key={option}>
                  <input
                    className="mr-2"
                    type="radio"
                    name={question.id}
                    onChange={() => setAnswers(value => ({ ...value, [question.id]: optionIndex }))}
                  />
                  {option}
                </label>
              ))}
            </fieldset>
          ))}
          <button
            disabled={Object.keys(answers).length !== experiment.quiz.questions.length}
            className="button mt-6"
            onClick={quiz}
          >
            Submit quiz
          </button>
        </section>
      )}

      {/* ── Completion panel ────────────────────────────────────── */}
      {completion && (
        <CompletionPanel
          totalScore={completion.totalScore}
          quizScore={completion.quizScore}
          quizTotalMarks={completion.quizTotalMarks}
          downloadUrl={completion.downloadUrl}
          reportError={completion.reportError}
        />
      )}
    </section>
  );
}
