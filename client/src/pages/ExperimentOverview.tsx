import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, Play, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { api, errorMessage } from '../services/api';
import type { Experiment } from '../types/api';

export function ExperimentOverview() {
  const { id = '' } = useParams(); const navigate = useNavigate(); const [error, setError] = useState(''); const [starting, setStarting] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['experiment', id], queryFn: () => api.get<{ experiment: Experiment }>(`/experiments/${id}`).then(r => r.data.experiment) });
  const start = async () => { setStarting(true); setError(''); try { const { data: response } = await api.post('/labs/start', { experimentId: id }); navigate(`/labs/${response.labSession.id}`, { state: { attemptId: response.attemptId, experiment: data } }); } catch (err) { const message = errorMessage(err); setError(message); const labId = (err as any).response?.data?.labSessionId; if (labId) navigate(`/labs/${labId}`); } finally { setStarting(false); } };
  if (isLoading || !data) return <p className="text-muted">Loading experiment…</p>;

  return <section className="mx-auto max-w-4xl">
    <span className="text-sm font-semibold tracking-wide text-brand">ISOLATED NETWORK LAB</span>
    <h1 className="mt-2 text-3xl font-bold text-ink">{data.title}</h1>
    <p className="mt-3 text-lg leading-7 text-muted">{data.aim}</p>
    <div className="mt-7 border-l-4 border-brand bg-brand/5 p-5 text-sm text-ink"><ShieldCheck className="mr-2 inline text-brand" size={18}/>All scans are restricted to CyberLabX’s private disposable network. Never scan systems you do not own or have permission to test.</div>
    <div className="mt-8 grid gap-6 md:grid-cols-2">
      <div className="panel p-6"><h2 className="font-semibold text-ink">Learning objectives</h2><ul className="mt-4 space-y-3 text-sm text-muted">{data.objectives.map(item => <li className="flex gap-2" key={item}><CheckCircle2 className="mt-0.5 shrink-0 text-success" size={16}/>{item}</li>)}</ul></div>
      <div className="panel p-6"><h2 className="font-semibold text-ink">Lab plan</h2><ol className="mt-4 space-y-3 text-sm text-muted">{data.procedureSections.map((item, index) => <li key={item}><span className="mr-2 font-semibold text-brand">0{index + 1}</span>{item}</li>)}</ol></div>
    </div>
    <div className="mt-8 space-y-4">{data.theorySections.map(section => <article className="panel p-6" key={section.title}><h2 className="font-semibold text-ink">{section.title}</h2><p className="mt-2 leading-7 text-muted">{section.content}</p></article>)}</div>
    {error && <p className="mt-5 text-danger">{error}</p>}
    <button onClick={start} disabled={starting} className="button mt-8 gap-2"><Play size={18}/>{starting ? 'Provisioning secure lab…' : 'Start lab'}</button>
  </section>;
}
