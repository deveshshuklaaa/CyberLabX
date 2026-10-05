import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Compass,
  Filter,
  Layers,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { useState } from 'react';
import { api } from '../services/api';
import type { Experiment } from '../types/api';

export function Experiments() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const experiments = useQuery({
    queryKey: ['experiments'],
    queryFn: () => api.get<{ experiments: Experiment[] }>('/experiments').then(r => r.data),
  });

  const allExperiments = experiments.data?.experiments ?? [];
  const categories = ['all', ...Array.from(new Set(allExperiments.map(e => e.category ?? 'Network Security')))];

  const filtered = allExperiments.filter(exp => {
    const matchesCat = selectedCategory === 'all' || (exp.category ?? 'Network Security') === selectedCategory;
    const matchesSearch =
      exp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exp.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-8">
      {/* ── Page Header ── */}
      <div className="border-b border-line pb-5">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-brand bg-brand/5 border border-brand/20 px-2.5 py-0.5 rounded">
            Somaiya Vidyavihar University
          </span>
          <span className="text-xs font-semibold text-muted bg-canvas border border-line px-2.5 py-0.5 rounded">
            Department of Computer Engineering
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-ink uppercase tracking-tight font-sans">
          Virtual Laboratory Practicals
        </h1>
        <p className="mt-1 text-sm text-muted max-w-3xl leading-relaxed">
          Select an authorized curriculum practical to inspect learning objectives, review syllabus procedures,
          and instantiate a dedicated, isolated sandbox environment.
        </p>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="panel p-4 bg-surface border border-line shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Categories */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <Filter size={15} className="text-muted mr-1 shrink-0" />
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold capitalize transition-colors whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-brand text-white shadow-xs'
                  : 'bg-canvas text-muted hover:text-ink hover:bg-slate-200'
              }`}
            >
              {cat === 'all' ? 'All Practicals' : cat}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search experiments…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="field pl-8 py-1.5 text-xs bg-canvas"
          />
        </div>
      </div>

      {/* ── Loading & Error States ── */}
      {experiments.isLoading && (
        <div className="panel p-12 text-center" data-testid="experiments-loading">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-brand border-t-transparent mb-3" />
          <p className="text-sm text-muted">Loading experiment catalogue…</p>
        </div>
      )}

      {experiments.error && (
        <div className="panel p-6 border-danger/30 bg-danger/5" data-testid="experiments-error">
          <p className="text-sm font-semibold text-danger">Unable to load experiments. Please check server connectivity.</p>
        </div>
      )}

      {/* ── Experiments Grid ── */}
      {!experiments.isLoading && !experiments.error && (
        <>
          {filtered.length === 0 ? (
            <div className="panel p-12 text-center" data-testid="experiments-empty">
              <Compass size={36} className="mx-auto text-muted/50 mb-3" />
              <h3 className="text-base font-bold text-ink">No practicals found</h3>
              <p className="text-xs text-muted mt-1">Try adjusting your filter or search query.</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2" data-testid="experiments-grid">
              {filtered.map(experiment => (
                <article
                  key={experiment._id}
                  className="panel bg-surface border border-line hover:border-brand/40 transition-all p-6 sm:p-7 flex flex-col justify-between group shadow-xs relative"
                >
                  <div className="absolute top-0 left-0 right-0 h-1 bg-brand rounded-t-xl" />

                  <div>
                    {/* Meta Header */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-brand bg-brand/5 border border-brand/20 px-2.5 py-0.5 rounded">
                        {experiment.category ?? 'Network Security'}
                      </span>
                      <div className="flex items-center gap-2 text-xs text-muted">
                        <span className="flex items-center gap-1">
                          <Clock size={13} />
                          <span>
                            {experiment.estimatedTimeMinutes === 40 ? '35–40 min' : `${experiment.estimatedTimeMinutes} min`}
                          </span>
                        </span>
                        <span>•</span>
                        <span className="font-semibold text-ink">{experiment.difficulty}</span>
                      </div>
                    </div>

                    {/* Title */}
                    <h2 className="text-xl font-bold text-ink group-hover:text-brand transition-colors">
                      {experiment.title}
                    </h2>

                    {/* Description */}
                    <p className="mt-2 text-sm text-muted leading-relaxed min-h-12">
                      {experiment.description}
                    </p>
                  </div>

                  {/* Card Action */}
                  <div className="mt-6 pt-4 border-t border-line flex items-center justify-between text-xs sm:text-sm">
                    <span className="font-medium text-muted flex items-center gap-1.5">
                      <CheckCircle2 size={15} className="text-emerald-600" />
                      <span>{experiment.taskCount} guided tasks &amp; quiz</span>
                    </span>
                    <Link
                      to={`/experiments/${experiment._id}`}
                      className="button text-xs py-2 px-4 gap-1.5 font-semibold"
                    >
                      <span>Open Lab</span>
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Institutional Security Notice ── */}
      <div className="panel p-5 bg-canvas border border-line text-xs text-muted flex items-start gap-3">
        <ShieldCheck size={20} className="text-brand shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-ink">Strict Laboratory Isolation Policy</p>
          <p className="mt-0.5 leading-relaxed">
            All virtual laboratories at Somaiya Vidyavihar University are hosted inside disposable, non-routable Docker container networks.
            Scanning, probing, or attacking internet-facing systems is strictly prohibited by university academic integrity guidelines.
          </p>
        </div>
      </div>
    </div>
  );
}
