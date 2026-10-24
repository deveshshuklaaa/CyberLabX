import type { ReactNode } from 'react';

export function MetricCard({ label, value, description, icon }: {
  label: string; value: ReactNode; description: string; icon: ReactNode;
}) {
  return <div className="panel p-5 sm:p-6 border-t-4 border-t-brand">
    <div aria-hidden="true" className="inline-flex rounded-lg bg-brand/10 p-3 text-brand mb-4">{icon}</div>
    <dl><dt className="text-sm font-semibold text-muted">{label}</dt><dd className="mt-2 text-3xl font-bold text-ink break-words">{value}</dd></dl>
    <p className="mt-3 text-xs leading-relaxed text-muted">{description}</p>
  </div>;
}
