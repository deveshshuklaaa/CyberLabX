export function PendingIntegration({ title, description }: { title: string; description: string }) {
  return <div className="rounded-lg border border-dashed border-line bg-canvas p-4 space-y-2">
    <span className="status-badge status-neutral">Pending integration</span>
    <h3 className="font-semibold text-sm">{title}</h3>
    <p className="text-sm text-muted leading-relaxed">{description}</p>
  </div>;
}
