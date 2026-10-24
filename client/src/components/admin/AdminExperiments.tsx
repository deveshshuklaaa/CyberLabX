import { useCatalogue } from '../../services/catalogue';
import { LoadingState, ErrorState } from '../common/QueryState';
import { PendingIntegration } from '../common/PendingIntegration';

export function AdminExperiments() {
  const catalogue = useCatalogue();
  const experiments = catalogue.data?.experiments ?? [];
  return <section id="admin-experiments" aria-labelledby="admin-experiments-heading" className="panel p-5 sm:p-6 space-y-4 scroll-mt-6">
    <h2 id="admin-experiments-heading" className="text-xl font-bold">Experiment overview</h2><p className="text-sm text-muted">Read-only published catalogue. Drafts, archived experiments and publishing controls are not supplied by this view.</p>
    {catalogue.isPending ? <LoadingState message="Loading published experiments..." /> : catalogue.isError ? <ErrorState message="Unable to load published experiments." onRetry={() => { void catalogue.refetch(); }} retrying={catalogue.isFetching} /> : !experiments.length ? <p className="state-panel">No published experiments available.</p> : <ul className="grid gap-4 md:grid-cols-2" aria-label="Published experiments">{experiments.map(experiment => <li key={experiment._id} className="border border-line rounded-lg p-4 space-y-2"><h3 className="font-bold">{experiment.title}</h3><p className="text-sm text-muted">{experiment.description}</p><p className="text-xs text-muted">{experiment.difficulty} | {experiment.estimatedTimeMinutes} min | {experiment.taskCount} guided tasks</p><p className="text-xs font-mono break-all">ID: {experiment._id}</p></li>)}</ul>}
    <PendingIntegration title="Experiment management unavailable" description="Creation, editing, publishing and archival require authorized management APIs. The published catalogue does not provide those actions." />
  </section>;
}
