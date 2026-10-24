import { Link } from 'react-router-dom';
import type { CatalogueExperiment } from '../../services/catalogue';

export function ExperimentCard({ experiment }: { experiment: CatalogueExperiment }) {
  return <article className="panel p-5 sm:p-6 flex min-w-0 flex-col gap-4 border-t-4 border-t-brand">
    <div className="flex flex-wrap gap-2 text-xs">
      <span className="status-badge status-neutral">{experiment.category?.trim() || 'Uncategorized'}</span>
      <span className="status-badge status-neutral">{experiment.difficulty}</span>
    </div>
    <h3 className="text-lg font-bold text-ink">{experiment.title}</h3>
    <p className="text-sm text-muted leading-relaxed break-words">{experiment.description}</p>
    <dl className="flex flex-wrap gap-4 text-sm text-muted">
      <div><dt className="sr-only">Estimated duration</dt><dd>{experiment.estimatedTimeMinutes} min</dd></div>
      <div><dt className="sr-only">Task count</dt><dd>{experiment.taskCount} guided {experiment.taskCount === 1 ? 'task' : 'tasks'}</dd></div>
    </dl>
    <Link className="button-secondary mt-auto self-start text-sm" to={`/experiments/${experiment._id}`} aria-label={`View experiment: ${experiment.title}`}>View experiment</Link>
  </article>;
}
