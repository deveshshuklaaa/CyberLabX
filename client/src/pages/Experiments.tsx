import { useState } from 'react';
import { PageHeading } from '../components/common/PageHeading';
import { LoadingState, ErrorState } from '../components/common/QueryState';
import { ExperimentCard } from '../components/common/ExperimentCard';
import { useCatalogue } from '../services/catalogue';

export function Experiments() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const catalogue = useCatalogue();
  const experiments = catalogue.data?.experiments ?? [];
  const categoryOf = (experiment: (typeof experiments)[number]) => experiment.category?.trim() || 'Uncategorized';
  const categories = [...new Set(experiments.map(categoryOf))].sort();
  const query = search.trim().toLocaleLowerCase();
  const filtered = experiments.filter(experiment => (!category || categoryOf(experiment) === category)
    && [experiment.title, experiment.description, categoryOf(experiment)].some(value => value.toLocaleLowerCase().includes(query)));
  const reset = () => { setSearch(''); setCategory(''); };
  return <div className="space-y-6">
    <PageHeading title="Experiment Catalogue" eyebrow="Somaiya Virtual Labs" description="Explore guided cybersecurity practicals. Review an experiment before starting your controlled lab." />
    <div className="panel p-4 grid gap-4 sm:grid-cols-2">
      <div><label className="label" htmlFor="experiment-search">Search experiments</label><input id="experiment-search" type="search" className="field" placeholder="Search by title or description" value={search} onChange={event => setSearch(event.target.value)} /></div>
      <div><label className="label" htmlFor="experiment-category">Category</label><select id="experiment-category" className="field" value={category} onChange={event => setCategory(event.target.value)}><option value="">All categories</option>{categories.map(value => <option key={value} value={value}>{value}</option>)}</select></div>
    </div>
    {catalogue.isPending ? <LoadingState message="Loading experiment catalogue..." />
      : catalogue.isError ? <ErrorState message="Unable to load experiments." onRetry={() => { void catalogue.refetch(); }} retrying={catalogue.isFetching} />
      : <>
        <p className="text-sm text-muted" role="status">{filtered.length} of {experiments.length} experiments</p>
        {!experiments.length ? <div className="state-panel"><h2 className="font-bold">No experiments available yet</h2><p className="page-description mx-auto">Published experiments will appear here when available.</p><button className="button-secondary mt-4" disabled={catalogue.isFetching} onClick={() => { void catalogue.refetch(); }}>Refresh catalogue</button></div>
          : !filtered.length ? <div className="state-panel"><h2 className="font-bold">No matching experiments</h2><p className="page-description mx-auto">Try a different search or category.</p><button className="button-secondary mt-4" onClick={reset}>Clear filters</button></div>
          : <section aria-label="Available experiments" className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{filtered.map(experiment => <ExperimentCard key={experiment._id} experiment={experiment} />)}</section>}
        {(search || category) && filtered.length > 0 && <button className="button-secondary" onClick={reset}>Clear filters</button>}
      </>}
    <p className="text-xs text-muted">Categories are shown when provided by the catalogue. All practical activity must remain within authorized CyberLabX targets.</p>
  </div>;
}
