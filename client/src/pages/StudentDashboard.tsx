import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Clock, Target } from 'lucide-react';
import { api } from '../services/api';
import type { Experiment } from '../types/api';
import { useSessionStore } from '../store/sessionStore';

export function StudentDashboard() {
  const user = useSessionStore(s => s.user);
  const { data, isLoading, error } = useQuery({ queryKey: ['experiments'], queryFn: () => api.get<{ experiments: Experiment[] }>('/experiments').then(r => r.data) });

  return <section>
    <p className="text-sm font-semibold tracking-wide text-brand">STUDENT DASHBOARD</p>
    <h1 className="mt-1 text-3xl font-bold text-ink">Welcome back, {user?.firstName}.</h1>
    <p className="mt-2 text-muted">Continue building practical skills in safe, isolated labs.</p>
    <div className="mt-8 grid gap-4 sm:grid-cols-3">
      <Stat icon={<Target/>} label="Available labs" value={data?.experiments.length ?? '—'}/>
      <Stat icon={<BookOpen/>} label="Learning path" value="Multi-lab V1"/>
      <Stat icon={<Clock/>} label="Typical session" value="35–45 min"/>
    </div>
    <h2 className="mt-10 text-xl font-semibold text-ink">Available experiments</h2>
    {isLoading && <p className="mt-4 text-muted">Loading experiments…</p>}
    {error && <p className="mt-4 text-danger">Unable to load experiments. Is the API running?</p>}
    <div className="mt-4 grid gap-5 md:grid-cols-2">
      {data?.experiments.map(experiment => <article className="panel border-t-4 border-t-brand p-6" key={experiment._id}>
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand-dark">{experiment.difficulty}</span>
          <span className="text-sm text-muted">{experiment.category ?? 'Network Security'} • {experiment.estimatedTimeMinutes === 40 ? '35–40 min' : `${experiment.estimatedTimeMinutes} min`}</span>
        </div>
        <h3 className="mt-4 text-xl font-semibold text-ink">{experiment.title}</h3>
        <p className="mt-2 min-h-12 text-sm leading-6 text-muted">{experiment.description}</p>
        <div className="mt-5 flex items-center justify-between text-sm text-muted">
          <span>{experiment.taskCount} guided tasks</span>
          <Link className="inline-flex items-center gap-1 font-semibold text-link hover:text-brand-dark" to={`/experiments/${experiment._id}`}>Open lab <ArrowRight size={16}/></Link>
        </div>
      </article>)}
    </div>
  </section>;
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return <div className="panel flex items-center gap-4 p-5"><span className="rounded-lg bg-brand/10 p-3 text-brand">{icon}</span><div><p className="text-2xl font-bold text-ink">{value}</p><p className="text-sm text-muted">{label}</p></div></div>;
}
